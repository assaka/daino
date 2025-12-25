const express = require('express');
const { body, validationResult } = require('express-validator');
const ConnectionManager = require('../services/database/ConnectionManager');
const { masterDbClient } = require('../database/masterConnection');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');
const { validateCustomerOrderAccess } = require('../middleware/customerStoreAuth');
const emailService = require('../services/email-service');
const { cacheOrder } = require('../middleware/cacheMiddleware');
const IntegrationConfig = require('../models/IntegrationConfig');
const { getStoreUrlFromRequest } = require('../utils/domainConfig');
const router = express.Router();

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paymentProviderService = require('../services/payment-provider-service');

// Stripe integration type constant
const STRIPE_INTEGRATION_TYPE = 'stripe-connect';

/**
 * Get store from master database
 */
async function getMasterStore(storeId) {
  const { data } = await masterDbClient
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .maybeSingle();
  return data;
}

/**
 * Atomically check and deduct stock for order items
 */
async function checkAndDeductStock(tenantDb, orderItems, storeId) {
  const insufficientItems = [];
  const deductedItems = [];

  for (const item of orderItems) {
    try {
      const { data: product } = await tenantDb
        .from('products')
        .select('id, sku, name, manage_stock, stock_quantity, infinite_stock, allow_backorders, purchase_count')
        .eq('id', item.product_id)
        .single();

      if (!product) continue;

      if (!product.manage_stock || product.infinite_stock) {
        await tenantDb
          .from('products')
          .update({
            purchase_count: (product.purchase_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);
        continue;
      }

      const quantity = item.quantity || 1;

      if (product.stock_quantity < quantity && !product.allow_backorders) {
        insufficientItems.push({
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          requested: quantity,
          available: product.stock_quantity
        });
        continue;
      }

      const newStockQuantity = product.stock_quantity - quantity;
      await tenantDb
        .from('products')
        .update({
          stock_quantity: Math.max(0, newStockQuantity),
          purchase_count: (product.purchase_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      deductedItems.push({ product_id: product.id, sku: product.sku, quantity });
      console.log(`✅ Stock deducted for ${product.sku}: ${product.stock_quantity} -> ${Math.max(0, newStockQuantity)}`);
    } catch (error) {
      console.error('Error checking/deducting stock for item:', item.product_id, error);
    }
  }

  return { success: insufficientItems.length === 0, insufficientItems, deductedItems };
}

/**
 * Handle stock issue for an order
 */
async function handleStockIssue({ tenantDb, storeId, order, insufficientItems, paymentIntentId }) {
  try {
    console.log('⚠️ Stock issue detected for order:', order.id);

    const store = await getMasterStore(storeId);
    const stockIssueHandling = store?.settings?.sales_settings?.stock_issue_handling || 'manual_review';
    const storeEmail = store?.email || store?.owner_email;

    await tenantDb
      .from('sales_orders')
      .update({
        fulfillment_status: 'stock_issue',
        admin_notes: `Stock issue: ${insufficientItems.map(i => `${i.sku} (requested: ${i.requested}, available: ${i.available})`).join(', ')}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    const itemsList = insufficientItems.map(i => `- ${i.name} (SKU: ${i.sku}): Requested ${i.requested}, Available ${i.available}`).join('\n');

    // Send notifications
    try {
      if (order.customer_email) {
        await emailService.sendEmail(storeId, 'stock_issue_customer', order.customer_email, {
          customer_first_name: order.shipping_address?.full_name?.split(' ')[0] || 'Customer',
          order_number: order.order_number,
          store_name: store?.name || 'Our Store',
          items_list: itemsList
        }, 'en').catch(err => console.error('Failed to send stock issue email to customer:', err.message));
      }

      if (storeEmail) {
        await emailService.sendEmail(storeId, 'stock_issue_admin', storeEmail, {
          order_number: order.order_number,
          customer_email: order.customer_email,
          customer_name: order.shipping_address?.full_name || 'Unknown',
          items_list: itemsList,
          store_name: store?.name || 'Store'
        }, 'en').catch(err => console.error('Failed to send stock issue email to admin:', err.message));
      }
    } catch (emailError) {
      console.error('Error sending stock issue notifications:', emailError);
    }

    // Auto-refund if enabled
    if (stockIssueHandling === 'auto_refund') {
      const refundResult = await paymentProviderService.refund({
        order: { ...order, payment_reference: paymentIntentId || order.payment_reference },
        reason: 'stock_issue',
        store
      });

      if (refundResult.success) {
        await tenantDb
          .from('sales_orders')
          .update({
            status: 'cancelled',
            payment_status: 'refunded',
            admin_notes: `Auto-refunded due to stock issue via ${refundResult.provider}. Refund ID: ${refundResult.refundId}`,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (order.customer_email) {
          await emailService.sendEmail(storeId, 'stock_issue_refunded', order.customer_email, {
            customer_first_name: order.shipping_address?.full_name?.split(' ')[0] || 'Customer',
            order_number: order.order_number,
            store_name: store?.name || 'Our Store',
            refund_amount: order.total_amount,
            currency: order.currency
          }, 'en').catch(err => console.error('Failed to send refund notification:', err.message));
        }

        return { refunded: true, refundId: refundResult.refundId, provider: refundResult.provider };
      } else if (refundResult.requiresManualRefund) {
        await tenantDb
          .from('sales_orders')
          .update({
            admin_notes: `Stock issue detected. Auto-refund not available for ${refundResult.provider} - please process manually.`,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);
      }
    }

    return { refunded: false };
  } catch (error) {
    console.error('Error handling stock issue:', error);
    throw error;
  }
}

// @route   GET /api/orders/test
// @desc    Test endpoint to verify deployment
// @access  Public (no auth required)
router.get('/test', (req, res) => {
  console.log('🔍 Orders test endpoint hit');
  res.json({
    success: true,
    message: 'Orders routes are working',
    timestamp: new Date().toISOString(),
    deployment_version: '2.0'
  });
});

// @route   GET /api/orders/by-payment-reference/:paymentReference
// @desc    Get order by payment reference (for order success page)
// @access  Public (no auth required for order success)
// @cache   1 minute (Redis/in-memory) - short TTL as orders may update
router.get('/by-payment-reference/:paymentReference', cacheOrder(60), async (req, res) => {
  try {
    const { paymentReference } = req.params;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find order by payment reference - try multiple fields
    let order = null;

    // Try payment_reference first
    const { data: orderByRef } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('payment_reference', paymentReference)
      .maybeSingle();

    if (orderByRef) {
      order = orderByRef;
    } else {
      // Try stripe_session_id
      const { data: orderBySession } = await tenantDb
        .from('sales_orders')
        .select('*')
        .eq('stripe_session_id', paymentReference)
        .maybeSingle();

      if (orderBySession) {
        order = orderBySession;
      } else {
        // Try stripe_payment_intent_id
        const { data: orderByIntent } = await tenantDb
          .from('sales_orders')
          .select('*')
          .eq('stripe_payment_intent_id', paymentReference)
          .maybeSingle();

        order = orderByIntent;
      }
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Load order items
    const { data: orderItems } = await tenantDb
      .from('sales_order_items')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    // Load products for order items
    const productIds = (orderItems || []).map(item => item.product_id).filter(Boolean);
    let products = [];

    if (productIds.length > 0) {
      const { data: prods } = await tenantDb
        .from('products')
        .select('id, name, sku')
        .in('id', productIds);

      products = prods || [];
    }

    const productMap = new Map(products.map(p => [p.id, p]));

    // Build response
    const orderResponse = {
      ...order,
      OrderItems: (orderItems || []).map(item => {
        const product = productMap.get(item.product_id);
        return {
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          selected_options: item.selected_options,
          Product: product ? {
            id: product.id,
            name: product.name,
            sku: product.sku
          } : null
        };
      })
    };

    res.json({
      success: true,
      data: orderResponse
    });

  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/orders/finalize-order
// @desc    Finalize order after successful Stripe payment (for connected accounts)
// @access  Public (called from OrderSuccess page)
router.post('/finalize-order', async (req, res) => {
  try {
    const { session_id, save_shipping_address, save_billing_address } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'session_id is required'
      });
    }

    console.log('🎯 Finalizing order for session:', session_id);

    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;
    console.log('🔍 Store ID from header:', req.headers['x-store-id']);
    console.log('🔍 Store ID from body:', req.body.store_id);
    console.log('🔍 Final store_id:', store_id);

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Find the order by payment reference using Supabase
    // Try multiple lookups since .or() can have issues with special characters
    let order = null;
    let orderError = null;

    console.log('🔍 Looking for order with payment_reference:', session_id);

    // Try payment_reference first (most common)
    const { data: orderByRef, error: refError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('payment_reference', session_id)
      .maybeSingle();

    console.log('🔍 payment_reference lookup result:', orderByRef ? `Found order ${orderByRef.id}` : 'Not found', refError ? `Error: ${refError.message}` : '');

    if (orderByRef) {
      order = orderByRef;
    } else {
      // Try stripe_session_id
      const { data: orderBySession, error: sessionError } = await tenantDb
        .from('sales_orders')
        .select('*')
        .eq('stripe_session_id', session_id)
        .maybeSingle();

      console.log('🔍 stripe_session_id lookup result:', orderBySession ? `Found order ${orderBySession.id}` : 'Not found');

      if (orderBySession) {
        order = orderBySession;
      } else {
        // Try stripe_payment_intent_id
        const { data: orderByIntent, error: intentError } = await tenantDb
          .from('sales_orders')
          .select('*')
          .eq('stripe_payment_intent_id', session_id)
          .maybeSingle();

        console.log('🔍 stripe_payment_intent_id lookup result:', orderByIntent ? `Found order ${orderByIntent.id}` : 'Not found');

        if (orderByIntent) {
          order = orderByIntent;
        }
        orderError = intentError || sessionError || refError;
      }
    }

    if (!order) {
      console.error('❌ Order not found for session:', session_id);
      console.error('❌ Searched in payment_reference, stripe_session_id, stripe_payment_intent_id');
      console.error('❌ Store ID used:', store_id);
      console.error('❌ Database errors:', orderError);

      // Debug: List recent orders for this store
      try {
        const { data: recentOrders } = await tenantDb
          .from('sales_orders')
          .select('id, payment_reference, stripe_session_id, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        console.error('❌ Recent orders in this store:', recentOrders?.map(o => ({
          id: o.id,
          payment_ref: o.payment_reference,
          session_id: o.stripe_session_id,
          created: o.created_at
        })));
      } catch (e) {
        console.error('❌ Could not list recent orders');
      }

      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('✅ Found order:', order.id, 'Current status:', order.status, 'Payment status:', order.payment_status);

    // Check if already finalized
    if (order.status === 'processing' && order.payment_status === 'paid') {
      console.log('✅ Order already finalized, checking if email was sent...');

      // Check if order email was already sent FOR THIS SPECIFIC ORDER
      let emailAlreadySent = false;
      try {
        const { data: emailLogs } = await tenantDb
          .from('email_send_logs')
          .select('id, metadata')
          .eq('recipient_email', order.customer_email)
          .eq('status', 'sent')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

        console.log('🔍 Email logs found:', emailLogs?.length || 0);
        console.log('🔍 Looking for order_id:', order.id);

        // Check if any email was sent for THIS specific order (not just same recipient)
        // Note: orderId is stored in metadata.variables.orderId
        if (emailLogs && emailLogs.length > 0) {
          emailAlreadySent = emailLogs.some(log =>
            log.metadata?.templateIdentifier === 'order_success_email' &&
            (log.metadata?.orderId === order.id || log.metadata?.variables?.orderId === order.id)
          );
        }

        if (emailAlreadySent) {
          console.log('✅ Order email already sent for this order, skipping duplicate');
        } else {
          console.log('📧 No order email found for this order, will send email');
        }
      } catch (emailCheckError) {
        console.log('⚠️ Could not check email logs:', emailCheckError.message, '- will send email to be safe');
      }

      // Send email if not already sent
      if (!emailAlreadySent && order.customer_email) {
        console.log('📧 Order was finalized but email not sent yet, sending now...');
        try {
          // Get store info
          const { data: store } = await masterDbClient
            .from('stores')
            .select('*')
            .eq('id', order.store_id)
            .maybeSingle();

          // Get order items
          const { data: orderItems } = await tenantDb
            .from('sales_order_items')
            .select('*')
            .eq('order_id', order.id);

          // Get customer info
          let customer = null;
          if (order.customer_id) {
            const { data } = await tenantDb
              .from('customers')
              .select('*')
              .eq('id', order.customer_id)
              .maybeSingle();
            customer = data;
          }

          const customerName = customer
            ? `${customer.first_name} ${customer.last_name}`
            : (order.shipping_address?.full_name || order.shipping_address?.name || 'Customer');
          const [firstName, ...lastNameParts] = customerName.split(' ');
          const lastName = lastNameParts.join(' ') || '';

          const completeOrder = { ...order, OrderItems: orderItems || [], Store: store };

          // Get store URL from request origin
          const storeUrlForEmail = getStoreUrlFromRequest(req, store?.slug);

          await emailService.sendTransactionalEmail(store_id, 'order_success_email', {
            recipientEmail: order.customer_email,
            customer: customer || {
              first_name: firstName,
              last_name: lastName,
              email: order.customer_email
            },
            order: completeOrder,
            store: store,
            origin: storeUrlForEmail,
            languageCode: 'en',
            orderId: order.id  // Include orderId for duplicate detection
          });
          console.log('✅ Order confirmation email sent successfully');
        } catch (emailError) {
          console.error('⚠️ Failed to send order email:', emailError.message);
        }
      }

      return res.json({
        success: true,
        message: 'Order already finalized',
        data: { order_id: order.id, already_finalized: true }
      });
    }

    // Get the store for the connected account
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', order.store_id)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get Stripe account from integration_configs
    const stripeConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    const stripeAccountId = stripeConfig?.config_data?.accountId;

    // Verify payment with Stripe - Stripe Connect required
    if (!stripeAccountId) {
      console.error('❌ Store does not have a connected Stripe account:', store_id);
      return res.status(400).json({
        success: false,
        message: 'Stripe Connect not configured for this store.'
      });
    }

    const stripeOptions = { stripeAccount: stripeAccountId };

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id, stripeOptions);
      console.log('✅ Retrieved Stripe session:', session.id, 'Payment status:', session.payment_status);
    } catch (stripeError) {
      console.error('❌ Failed to retrieve Stripe session:', stripeError.message);
      return res.status(400).json({
        success: false,
        message: 'Failed to verify payment with Stripe'
      });
    }

    // Verify payment was successful
    if (session.payment_status !== 'paid') {
      console.log('⚠️ Payment not complete yet, status:', session.payment_status);
      return res.json({
        success: false,
        message: 'Payment not yet completed',
        data: { payment_status: session.payment_status }
      });
    }

    // Update order status
    console.log('🔄 Updating order status to processing/paid...');
    const previousStatus = order.status;
    const previousPaymentStatus = order.payment_status;

    const { error: updateError } = await tenantDb
      .from('sales_orders')
      .update({
        status: 'processing',
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    console.log('✅ Order status updated successfully');

    // Deduct stock if transitioning from pending to paid (payment just confirmed)
    if (previousStatus === 'pending' && previousPaymentStatus === 'pending') {
      console.log('📦 Payment confirmed via finalize-order - checking and reducing stock...');
      const { data: orderItems } = await tenantDb
        .from('sales_order_items')
        .select('product_id, quantity')
        .eq('order_id', order.id);

      const stockResult = await checkAndDeductStock(tenantDb, orderItems || [], store_id);

      // Handle stock issues if any
      if (!stockResult.success && stockResult.insufficientItems.length > 0) {
        console.log('⚠️ Stock issue detected in finalize-order, handling...');
        // Get payment intent from session
        let paymentIntentId = null;
        try {
          const stockStripeOptions = stripeAccountId ? { stripeAccount: stripeAccountId } : {};
          const stripeSession = await stripe.checkout.sessions.retrieve(session_id, stockStripeOptions);
          paymentIntentId = stripeSession.payment_intent;
        } catch (e) {
          console.error('Could not retrieve payment intent:', e.message);
        }

        await handleStockIssue({
          tenantDb,
          storeId: store_id,
          order: order,
          insufficientItems: stockResult.insufficientItems,
          paymentIntentId
        });
      }
    }

    // Send order confirmation email
    try {
      const emailService = require('../services/email-service');

      // Get updated order with items
      const { data: completeOrder } = await tenantDb
        .from('sales_orders')
        .select('*')
        .eq('id', order.id)
        .single();

      // Fetch order items
      const { data: orderItems } = await tenantDb
        .from('sales_order_items')
        .select('*')
        .eq('order_id', order.id);

      completeOrder.OrderItems = orderItems || [];
      completeOrder.Store = store;

      // Get customer info
      let customer = null;
      if (order.customer_id) {
        const { data } = await tenantDb
          .from('customers')
          .select('*')
          .eq('id', order.customer_id)
          .maybeSingle();
        customer = data;
      }

      const customerName = customer
        ? `${customer.first_name} ${customer.last_name}`
        : (order.shipping_address?.full_name || order.shipping_address?.name || 'Customer');
      const [firstName, ...lastNameParts] = customerName.split(' ');
      const lastName = lastNameParts.join(' ') || '';

      console.log('📧 Sending order confirmation email to:', order.customer_email);

      // Get store URL from request origin
      const orderEmailOrigin = getStoreUrlFromRequest(req, store?.slug);

      await emailService.sendTransactionalEmail(store_id, 'order_success_email', {
        recipientEmail: order.customer_email,
        customer: customer || {
          first_name: firstName,
          last_name: lastName,
          email: order.customer_email
        },
        order: completeOrder,
        store: store,
        origin: orderEmailOrigin,
        languageCode: 'en'
      });

      console.log('✅ Order confirmation email sent successfully');

      // For online payment methods, also send invoice email automatically
      try {
        // Check if payment method is online
        const { data: paymentMethod } = await tenantDb
          .from('payment_methods')
          .select('payment_flow')
          .eq('id', order.payment_method_id)
          .maybeSingle();

        if (paymentMethod?.payment_flow === 'online') {
          console.log('📧 Online payment detected, sending invoice email...');

          // Generate invoice number if not exists
          let invoiceNumber = completeOrder.invoice_number;
          if (!invoiceNumber) {
            invoiceNumber = `INV-${completeOrder.order_number}`;
            await tenantDb
              .from('sales_orders')
              .update({ invoice_number: invoiceNumber })
              .eq('id', order.id);
          }

          // Send invoice email
          await emailService.sendTransactionalEmail(store_id, 'invoice_email', {
            recipientEmail: order.customer_email,
            customer: customer || {
              first_name: firstName,
              last_name: lastName,
              email: order.customer_email
            },
            order: { ...completeOrder, invoice_number: invoiceNumber },
            store: store,
            languageCode: 'en',
            invoice_number: invoiceNumber,
            invoice_date: new Date().toISOString()
          });
          console.log('✅ Invoice email sent automatically for online payment order', order.id);
        }
      } catch (invoiceError) {
        console.error('⚠️ Failed to send automatic invoice email:', invoiceError.message);
        // Don't fail the order - invoice email is non-critical
      }
    } catch (emailError) {
      console.error('⚠️ Failed to send order email:', emailError.message);
      // Don't fail the order finalization if email fails
    }

    res.json({
      success: true,
      message: 'Order finalized successfully',
      data: {
        order_id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status
      }
    });

  } catch (error) {
    console.error('❌ Error finalizing order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finalize order',
      error: error.message
    });
  }
});

// Database diagnostic endpoint
router.get('/db-diagnostic/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Query using Supabase client - try multiple fields
    let orderResult = null;

    // Try payment_reference first
    const { data: orderByRef } = await tenantDb
      .from('sales_orders')
      .select('id, order_number, customer_email, total_amount, store_id, created_at')
      .eq('payment_reference', sessionId)
      .maybeSingle();

    if (orderByRef) {
      orderResult = orderByRef;
    } else {
      // Try stripe_session_id
      const { data: orderBySession } = await tenantDb
        .from('sales_orders')
        .select('id, order_number, customer_email, total_amount, store_id, created_at')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();

      if (orderBySession) {
        orderResult = orderBySession;
      } else {
        // Try stripe_payment_intent_id
        const { data: orderByIntent } = await tenantDb
          .from('sales_orders')
          .select('id, order_number, customer_email, total_amount, store_id, created_at')
          .eq('stripe_payment_intent_id', sessionId)
          .maybeSingle();

        orderResult = orderByIntent;
      }
    }

    let orderItemsResult = [];
    if (orderResult) {
      const { data: items } = await tenantDb
        .from('sales_order_items')
        .select('id, order_id, product_id, product_name, quantity, unit_price, total_price, created_at')
        .eq('order_id', orderResult.id);

      orderItemsResult = items || [];
    }

    res.json({
      diagnostic: true,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      order_found: !!orderResult,
      order_data: orderResult || null,
      order_items_count: orderItemsResult.length,
      order_items: orderItemsResult
    });

  } catch (error) {
    res.status(500).json({
      diagnostic: true,
      error: error.message,
      stack: error.stack
    });
  }
});

// Deployment verification endpoint
router.get('/deployment-check', (req, res) => {
  res.json({
    version: '3.0',
    timestamp: new Date().toISOString(),
    message: 'DEPLOYMENT v3.0 ACTIVE - OrderItems fix deployed',
    server_time: Date.now()
  });
});

// Test endpoint - direct query
router.get('/test-direct/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Query using Supabase client
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    const { data: items, error: itemsError } = await tenantDb
      .from('sales_order_items')
      .select('*')
      .eq('order_id', orderId);

    res.json({
      order_found: !!order,
      order: order || null,
      items_count: (items || []).length,
      items: items || [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// @route   GET /api/orders/customer-orders
// @desc    Get orders for authenticated customer with full details (temporary workaround)
// @access  Private (customer authentication required)
router.get('/customer-orders', authMiddleware, async (req, res) => {
  try {
    console.log('🔍 Customer orders request from user:', req.user?.id, 'role:', req.user?.role);
    console.log('🔍 Full user object:', JSON.stringify(req.user, null, 2));
    
    // Only allow customer role to access this endpoint
    if (req.user?.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Customer access required.'
      });
    }

    const customerId = req.user.id;
    const customerStoreId = req.user.store_id; // Get from JWT token
    console.log('🔍 Loading orders for customer ID:', customerId, 'Store ID:', customerStoreId);
    console.log('🔍 Customer ID type:', typeof customerId);
    console.log('🔍 Customer ID length:', customerId?.length);

    // Validate that customerId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!customerId || !uuidRegex.test(customerId)) {
      console.error('❌ Invalid customer ID format:', customerId);
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
    }

    // Enhanced query with full order details including order items and store info
    // IMPORTANT: Filter by both customer_id AND store_id to prevent cross-store access
    console.log('🔍 About to execute enhanced Sequelize query with customer_id:', customerId);

    const whereClause = { customer_id: customerId };

    // Add store_id filter if available from JWT
    if (customerStoreId) {
      whereClause.store_id = customerStoreId;
      console.log('🔒 Enforcing store binding: only orders from store', customerStoreId);
    }

    console.log('🔍 Where clause:', JSON.stringify(whereClause, null, 2));

    const store_id = customerStoreId || req.headers['x-store-id'] || req.query.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Query orders using Supabase (no includes, query separately)
    let ordersQuery = tenantDb
      .from('sales_orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (customerStoreId) {
      ordersQuery = ordersQuery.eq('store_id', customerStoreId);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch orders'
      });
    }

    console.log('🔍 Enhanced query executed successfully');
    console.log('🔍 Found orders for customer:', orders?.length || 0);
    
    // Add payment method details if available
    const ordersWithDetails = (orders || []).map(order => {
      const orderData = order; // Already plain object from Supabase
      
      // Parse payment method details if stored as JSON
      if (orderData.payment_method_details) {
        try {
          orderData.payment_method_details = typeof orderData.payment_method_details === 'string' 
            ? JSON.parse(orderData.payment_method_details) 
            : orderData.payment_method_details;
        } catch (e) {
          console.warn('Could not parse payment_method_details for order:', orderData.id);
        }
      }
      
      // Parse shipping address if stored as JSON
      if (orderData.shipping_address) {
        try {
          orderData.shipping_address = typeof orderData.shipping_address === 'string' 
            ? JSON.parse(orderData.shipping_address) 
            : orderData.shipping_address;
        } catch (e) {
          console.warn('Could not parse shipping_address for order:', orderData.id);
        }
      }
      
      // Parse billing address if stored as JSON
      if (orderData.billing_address) {
        try {
          orderData.billing_address = typeof orderData.billing_address === 'string' 
            ? JSON.parse(orderData.billing_address) 
            : orderData.billing_address;
        } catch (e) {
          console.warn('Could not parse billing_address for order:', orderData.id);
        }
      }
      
      return orderData;
    });

    res.json({
      success: true,
      data: ordersWithDetails
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/orders/customer-orders/:orderId/status
// @desc    Update order status for customer orders
// @access  Private (customer authentication required)
router.put('/customer-orders/:orderId/status', authMiddleware, validateCustomerOrderAccess, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    // Only allow customer role to access this endpoint
    if (req.user?.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Customer access required.'
      });
    }

    const customerId = req.user.id;
    const customerStoreId = req.user.store_id;
    console.log('🔍 Customer updating order status:', { orderId, status, customerId });

    // Get store_id
    const store_id = customerStoreId || req.headers['x-store-id'] || req.body.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Validate status
    const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'return_requested'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses: ${allowedStatuses.join(', ')}`
      });
    }

    // Find the order and verify it belongs to the customer
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', orderId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or access denied'
      });
    }

    // Allow customers to perform limited actions based on current status
    if (req.user.role === 'customer') {
      const currentStatus = order.status?.toLowerCase();

      // Define allowed transitions for customers (more restrictive)
      const allowedTransitions = {
        'pending': ['cancelled'],
        'processing': ['return_requested'],
        'shipped': ['return_requested'],
        'delivered': ['return_requested']
      };

      const allowedStatusesForCurrent = allowedTransitions[currentStatus] || [];

      if (!allowedStatusesForCurrent.includes(status)) {
        return res.status(403).json({
          success: false,
          message: `Cannot change order from ${currentStatus} to ${status}. Customer allowed changes: ${allowedStatusesForCurrent.join(', ') || 'none'}`
        });
      }

      // Additional validation for final statuses
      if (['cancelled', 'refunded', 'return_requested'].includes(currentStatus)) {
        return res.status(400).json({
          success: false,
          message: `Order is already ${currentStatus} and cannot be modified`
        });
      }
    }

    // Update the order
    const { error: updateError } = await tenantDb
      .from('sales_orders')
      .update({
        status,
        status_notes: notes || null,
        cancelled_at: status === 'cancelled' ? new Date().toISOString() : order.cancelled_at,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Restore stock if order is cancelled or refunded (and was previously in a paid state)
    const previousStatus = order.status?.toLowerCase();
    const paidStatuses = ['processing', 'shipped', 'delivered'];
    const shouldRestoreStock = ['cancelled', 'refunded'].includes(status) && paidStatuses.includes(previousStatus);

    if (shouldRestoreStock) {
      console.log('📦 Restoring stock for cancelled/refunded order:', orderId);

      // Get order items
      const { data: orderItems } = await tenantDb
        .from('sales_order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId);

      for (const item of (orderItems || [])) {
        try {
          const { data: product } = await tenantDb
            .from('products')
            .select('id, sku, manage_stock, stock_quantity, infinite_stock, purchase_count')
            .eq('id', item.product_id)
            .single();

          if (product && product.manage_stock && !product.infinite_stock) {
            const newStockQuantity = product.stock_quantity + item.quantity;

            await tenantDb
              .from('products')
              .update({
                stock_quantity: newStockQuantity,
                purchase_count: Math.max(0, (product.purchase_count || 0) - 1),
                updated_at: new Date().toISOString()
              })
              .eq('id', product.id);

            console.log(`✅ Stock restored for product ${product.sku}: ${product.stock_quantity} -> ${newStockQuantity}`);
          }
        } catch (stockError) {
          console.error('Error restoring stock for product:', item.product_id, stockError);
        }
      }
    }

    // Fetch updated order
    const { data: updatedOrder } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    console.log('🔍 Order status updated successfully:', { orderId, oldStatus: order.status, newStatus: status });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        status_notes: updatedOrder.status_notes,
        updated_at: updatedOrder.updated_at
      }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/orders/my-orders
// @desc    Get orders for authenticated customer
// @access  Private (customer authentication required)
router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    console.log('🔍 Customer orders request from user:', req.user?.id, 'role:', req.user?.role);
    console.log('🔍 Full user object:', JSON.stringify(req.user, null, 2));
    
    // Only allow customer role to access this endpoint
    if (req.user?.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Customer access required.'
      });
    }

    const customerId = req.user.id;
    const customerStoreId = req.user.store_id;
    console.log('🔍 Loading orders for customer ID:', customerId);
    console.log('🔍 Customer ID type:', typeof customerId);
    console.log('🔍 Customer ID length:', customerId?.length);

    // Validate that customerId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!customerId || !uuidRegex.test(customerId)) {
      console.error('❌ Invalid customer ID format:', customerId);
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
    }

    // Get store_id
    const store_id = customerStoreId || req.headers['x-store-id'] || req.query.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Simple query without complex associations to avoid 500 errors
    console.log('🔍 About to execute Supabase query with customer_id:', customerId);

    const { data: orders, error: ordersError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch orders'
      });
    }

    console.log('🔍 Query executed successfully');
    console.log('🔍 Found orders for customer:', orders?.length || 0);

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/orders
// @desc    Get orders
// @access  Private
router.get('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Build query
    let query = tenantDb
      .from('sales_orders')
      .select('*', { count: 'exact' })
      .eq('store_id', store_id);

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: orders, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Load order items for all orders
    const orderIds = (orders || []).map(o => o.id);
    let orderItems = [];

    if (orderIds.length > 0) {
      const { data: items } = await tenantDb
        .from('sales_order_items')
        .select('*')
        .in('order_id', orderIds);

      orderItems = items || [];
    }

    // Group items by order
    const itemsByOrder = {};
    orderItems.forEach(item => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      itemsByOrder[item.order_id].push(item);
    });

    // Add items to orders
    const ordersWithItems = (orders || []).map(order => ({
      ...order,
      OrderItems: itemsByOrder[order.id] || []
    }));

    res.json({
      success: true,
      data: {
        orders: ordersWithItems,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Load order items
    const { data: orderItems } = await tenantDb
      .from('sales_order_items')
      .select('*')
      .eq('order_id', order.id);

    order.OrderItems = orderItems || [];

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, order.Store.id);
      
      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/orders
// @desc    Create new order
// @access  Private
router.post('/', authMiddleware, authorize(['admin', 'store_owner']), [
  body('store_id').isUUID().withMessage('Store ID must be a valid UUID'),
  body('customer_email').isEmail().withMessage('Customer email must be valid'),
  body('billing_address').notEmpty().withMessage('Billing address is required'),
  body('shipping_address').notEmpty().withMessage('Shipping address is required'),
  body('total_amount').isDecimal().withMessage('Total amount must be a valid decimal'),
  body('items').isArray().withMessage('Items must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id, items, ...orderData } = req.body;

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check store ownership
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', store_id)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store.id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Create order
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .insert({ ...orderData, store_id })
      .select()
      .single();

    if (orderError) {
      throw new Error(orderError.message);
    }

    // Create order items
    const orderItemsData = items.map(item => ({
      ...item,
      order_id: order.id
    }));

    const { error: itemsError } = await tenantDb
      .from('sales_order_items')
      .insert(orderItemsData);

    if (itemsError) {
      throw new Error(itemsError.message);
    }

    // Fetch the complete order with items
    const { data: completeOrder, error: fetchError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', order.id)
      .single();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    // Load order items
    const { data: orderItems } = await tenantDb
      .from('sales_order_items')
      .select('*')
      .eq('order_id', order.id);

    completeOrder.OrderItems = orderItems || [];

    // Send order success email asynchronously
    try {
      console.log('📧 Attempting to send order success email for order:', completeOrder.order_number);
      console.log('📧 Store:', store?.name, '(', store_id, ')');
      console.log('📧 Recipient:', completeOrder.customer_email);

      // Get customer information
      let customer = null;
      if (completeOrder.customer_id) {
        const { data: customerData } = await tenantDb
          .from('customers')
          .select('*')
          .eq('id', completeOrder.customer_id)
          .maybeSingle();
        customer = customerData;
        console.log('📧 Customer found:', customer ? `${customer.first_name} ${customer.last_name}` : 'Not found');
      }

      // If no customer record, create a guest customer object from order data
      if (!customer) {
        customer = {
          first_name: completeOrder.customer_first_name || completeOrder.customer_email?.split('@')[0] || 'Customer',
          last_name: completeOrder.customer_last_name || '',
          email: completeOrder.customer_email
        };
        console.log('📧 Using guest customer data:', customer.first_name, customer.last_name);
      }

      // Send email asynchronously (don't block response)
      emailService.sendTransactionalEmail(store_id, 'order_success_email', {
        recipientEmail: completeOrder.customer_email,
        customer,
        order: completeOrder,
        store: store,
        languageCode: 'en' // TODO: Get from customer preferences or order metadata
      }).then((result) => {
        if (result.success) {
          console.log('✅ Order success email sent successfully to:', completeOrder.customer_email);
        } else {
          console.error('❌ Order success email failed:', result.message || 'Unknown error');
        }
      }).catch(emailError => {
        console.error('❌ Failed to send order success email to:', completeOrder.customer_email);
        console.error('❌ Error details:', emailError.message);
        console.error('❌ Full error:', emailError);
        // Don't fail order creation if email fails
      });
    } catch (emailError) {
      console.error('❌ Error in order success email setup:', emailError.message);
      console.error('❌ Full error:', emailError);
      // Don't fail order creation if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: completeOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/orders/:id
// @desc    Update order
// @access  Private
router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Load store
    const { data: store } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', order.store_id)
      .maybeSingle();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store.id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const { data: updatedOrder, error: updateError } = await tenantDb
      .from('sales_orders')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/orders/:id/resend-confirmation
// @desc    Resend order confirmation email
// @access  Private (admin)
router.post('/:id/resend-confirmation', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Load order with all details
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Load order items
    const { data: orderItems } = await tenantDb
      .from('sales_order_items')
      .select('*')
      .eq('order_id', order.id);

    order.OrderItems = orderItems || [];

    // Load store
    const { data: store } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', order.store_id)
      .maybeSingle();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get customer details
    const customer = order.customer_id ? await tenantDb.from("customers").select("*").eq("id", order.customer_id).maybeSingle().then(r => r.data) : null;

    // Parse customer name from billing address
    let firstName = 'Customer';
    let lastName = '';
    const fullName = order.billing_address?.full_name || order.billing_address?.name || '';
    if (fullName && fullName.trim()) {
      const nameParts = fullName.trim().split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    }

    // Send order confirmation email
    await emailService.sendTransactionalEmail(order.store_id, 'order_success_email', {
      recipientEmail: order.customer_email,
      customer: customer || { first_name: firstName, last_name: lastName, email: order.customer_email },
      order: order,
      store: store
    });

    res.json({
      success: true,
      message: 'Order confirmation email resent successfully'
    });
  } catch (error) {
    console.error('Resend order confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend order confirmation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/orders/:id/send-invoice
// @desc    Send or resend invoice email
// @access  Private (admin)
router.post('/:id/send-invoice', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { withPdf = true } = req.body;

    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Load order with all details
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Load order items
    const { data: orderItems } = await tenantDb
      .from('sales_order_items')
      .select('*')
      .eq('order_id', order.id);

    order.OrderItems = orderItems || [];

    // Load store
    const { data: store } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', order.store_id)
      .maybeSingle();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    order.Store = store;

    // Get customer details
    const customer = order.customer_id ? await tenantDb.from("customers").select("*").eq("id", order.customer_id).maybeSingle().then(r => r.data) : null;

    // Parse customer name from billing address
    let firstName = 'Customer';
    let lastName = '';
    const fullName = order.billing_address?.full_name || order.billing_address?.name || '';
    if (fullName && fullName.trim()) {
      const nameParts = fullName.trim().split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    }

    // Check if invoice already exists
    const { data: invoice } = await tenantDb
      .from('sales_invoices')
      .select('*')
      .eq('order_id', id)
      .maybeSingle();

    // Generate invoice number once (reuse if invoice exists)
    const invoiceNumber = invoice ? invoice.invoice_number : ('INV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase());

    // Prepare attachments if PDF is requested
    let attachments = [];
    let pdfGeneratedSuccessfully = false;
    if (withPdf) {
      try {
        const pdfService = require('../services/pdf-service');
        const invoicePdf = await pdfService.generateInvoicePDF(order, order.Store, order.OrderItems);
        attachments = [{
          filename: pdfService.getInvoiceFilename(order),
          content: invoicePdf.toString('base64'),
          contentType: 'application/pdf'
        }];
        pdfGeneratedSuccessfully = true;
        console.log('✅ Invoice PDF generated successfully');
      } catch (pdfError) {
        console.error('❌ PDF generation failed, sending invoice without PDF:', pdfError.message);
        // Continue without PDF - invoice email can still be sent
      }
    }

    // Send invoice email (with or without PDF attachment)
    await emailService.sendTransactionalEmail(order.store_id, 'invoice_email', {
      recipientEmail: order.customer_email,
      customer: customer || { first_name: firstName, last_name: lastName, email: order.customer_email },
      order: order,
      store: order.Store,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toLocaleDateString(),
      attachments: attachments
    });

    // Create or update invoice record
    let updatedInvoice;
    if (invoice) {
      const { data: updated, error: updateError } = await tenantDb
        .from('sales_invoices')
        .update({
          sent_at: new Date().toISOString(),
          pdf_generated: pdfGeneratedSuccessfully,
          email_status: 'sent'
        })
        .eq('id', invoice.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }
      updatedInvoice = updated;
    } else {
      const { data: created, error: createError } = await tenantDb
        .from('sales_invoices')
        .insert({
          invoice_number: invoiceNumber,
          order_id: id,
          store_id: order.store_id,
          customer_email: order.customer_email,
          pdf_generated: pdfGeneratedSuccessfully,
          email_status: 'sent'
        })
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message);
      }
      updatedInvoice = created;
    }

    // Update order status to 'processing' when invoice is sent
    if (order.status === 'pending') {
      const { error: orderUpdateError } = await tenantDb
        .from('sales_orders')
        .update({
          status: 'processing',
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (orderUpdateError) {
        throw new Error(orderUpdateError.message);
      }
    }

    res.json({
      success: true,
      message: 'Invoice email sent successfully',
      data: { invoice_id: updatedInvoice.id }
    });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/orders/:id/send-shipment
// @desc    Send or resend shipment notification email
// @access  Private (admin)
router.post('/:id/send-shipment', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { trackingNumber, trackingUrl, carrier, estimatedDeliveryDate } = req.body;

    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;
    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Load order with all details
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (orderError || !order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Load order items
    const { data: orderItems } = await tenantDb
      .from('sales_order_items')
      .select('*')
      .eq('order_id', order.id);

    order.OrderItems = orderItems || [];

    // Load store
    const { data: store } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', order.store_id)
      .maybeSingle();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    order.Store = store;

    // Get customer details
    const customer = order.customer_id ? await tenantDb.from("customers").select("*").eq("id", order.customer_id).maybeSingle().then(r => r.data) : null;

    // Parse customer name from billing address
    let firstName = 'Customer';
    let lastName = '';
    const fullName = order.billing_address?.full_name || order.billing_address?.name || '';
    if (fullName && fullName.trim()) {
      const nameParts = fullName.trim().split(' ');
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    }

    // Update order tracking info if provided
    if (trackingNumber) {
      const { error: updateError } = await tenantDb
        .from('sales_orders')
        .update({
          tracking_number: trackingNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    // Check if shipment already exists
    const { data: shipment } = await tenantDb
      .from('sales_shipments')
      .select('*')
      .eq('order_id', id)
      .maybeSingle();

    // Check if PDF should be generated for shipment
    const salesSettings = order.Store.settings?.sales_settings || {};
    let shipmentAttachments = [];

    if (salesSettings.auto_invoice_pdf_enabled) { // Reuse PDF setting for shipment
      try {
        console.log('📄 Generating PDF shipment notice...');
        const pdfService = require('../services/pdf-service');

        const shipmentPdf = await pdfService.generateShipmentPDF(
          order,
          order.Store,
          order.OrderItems
        );

        shipmentAttachments = [{
          filename: pdfService.getShipmentFilename(order),
          content: shipmentPdf.toString('base64'),
          contentType: 'application/pdf'
        }];

        console.log('✅ PDF shipment notice generated successfully');
      } catch (pdfError) {
        console.error('❌ Failed to generate shipment PDF:', pdfError);
        // Continue without PDF if generation fails
      }
    }

    // Send shipment notification email
    await emailService.sendTransactionalEmail(order.store_id, 'shipment_email', {
      recipientEmail: order.customer_email,
      customer: customer || { first_name: firstName, last_name: lastName, email: order.customer_email },
      order: order,
      store: order.Store,
      tracking_number: trackingNumber || order.tracking_number || 'Not provided',
      tracking_url: trackingUrl || '',
      carrier: carrier || 'Not specified',
      shipping_method: carrier || order.shipping_method || 'Not specified',
      estimated_delivery_date: estimatedDeliveryDate ? new Date(estimatedDeliveryDate).toLocaleDateString() : 'To be confirmed',
      attachments: shipmentAttachments
    });

    // Create or update shipment record
    let updatedShipment;
    if (shipment) {
      const { data: updated, error: updateError } = await tenantDb
        .from('sales_shipments')
        .update({
          sent_at: new Date().toISOString(),
          tracking_number: trackingNumber || shipment.tracking_number,
          tracking_url: trackingUrl || shipment.tracking_url,
          carrier: carrier || shipment.carrier,
          estimated_delivery_date: estimatedDeliveryDate || shipment.estimated_delivery_date,
          email_status: 'sent'
        })
        .eq('id', shipment.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }
      updatedShipment = updated;
    } else {
      // Generate shipment number (in case hook doesn't fire)
      const shipmentNumber = 'SHIP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

      const { data: created, error: createError } = await tenantDb
        .from('sales_shipments')
        .insert({
          shipment_number: shipmentNumber,
          order_id: id,
          store_id: order.store_id,
          customer_email: order.customer_email,
          tracking_number: trackingNumber || order.tracking_number,
          tracking_url: trackingUrl,
          carrier: carrier,
          shipping_method: order.shipping_method,
          estimated_delivery_date: estimatedDeliveryDate,
          email_status: 'sent'
        })
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message);
      }
      updatedShipment = created;
    }

    // Update order status to shipped if not already
    if (order.status !== 'shipped' && order.status !== 'delivered') {
      const { error: orderUpdateError } = await tenantDb
        .from('sales_orders')
        .update({
          status: 'shipped',
          fulfillment_status: 'shipped',
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (orderUpdateError) {
        throw new Error(orderUpdateError.message);
      }
    }

    res.json({
      success: true,
      message: 'Shipment notification sent successfully',
      data: { shipment_id: updatedShipment.id }
    });
  } catch (error) {
    console.error('Send shipment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send shipment notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/orders/test-invoice-settings/:storeId
// @desc    Test endpoint to check auto-invoice settings for a store
// @access  Public (for debugging)
router.get('/test-invoice-settings/:storeId', async (req, res) => {
  try {
    const { storeId } = req.params;

    console.log('🔍 Testing invoice settings for store:', storeId);

    // Load store with settings
    const { data: store, error: storeError } = await masterDbClient
      .from('stores')
      .select('id, name, slug, currency, settings')
      .eq('id', storeId)
      .maybeSingle();

    if (storeError || !store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    const salesSettings = store.settings?.sales_settings || {};

    console.log('✅ Store loaded:', store.name);
    console.log('📋 Settings:', JSON.stringify(store.settings, null, 2));
    console.log('📋 Sales Settings:', JSON.stringify(salesSettings, null, 2));

    res.json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug
      },
      settings: store.settings,
      sales_settings: salesSettings,
      auto_invoice_enabled: salesSettings.auto_invoice_enabled || false,
      auto_invoice_pdf_enabled: salesSettings.auto_invoice_pdf_enabled || false,
      auto_ship_enabled: salesSettings.auto_ship_enabled || false,
      message: salesSettings.auto_invoice_enabled
        ? '✅ Auto-invoice is ENABLED - invoices will be sent automatically'
        : '⚠️ Auto-invoice is DISABLED - invoices will NOT be sent automatically'
    });
  } catch (error) {
    console.error('❌ Error testing invoice settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing invoice settings',
      error: error.message
    });
  }
});

module.exports = router;