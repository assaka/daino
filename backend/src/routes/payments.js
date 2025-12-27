const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/auth');
const ConnectionManager = require('../services/database/ConnectionManager');
const { getMasterStore, getMasterStoreSafe, updateMasterStore, getMasterUser, checkUserStoreAccess } = require('../utils/dbHelpers');
const { v4: uuidv4 } = require('uuid');
const IntegrationConfig = require('../models/IntegrationConfig');
const { buildStoreUrl } = require('../utils/domainConfig');

const router = express.Router();

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { masterDbClient } = require('../database/masterConnection');
const paymentProviderService = require('../services/payment-provider-service');

// Stripe integration type constant
const STRIPE_INTEGRATION_TYPE = 'stripe-connect';

// Zero-decimal currencies (currencies without decimal places)
// These should NOT be multiplied by 100 for Stripe
const ZERO_DECIMAL_CURRENCIES = [
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW',
  'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF',
  'XOF', 'XPF'
];

/**
 * Convert amount to Stripe format based on currency
 * @param {number} amount - Amount in standard units (e.g., dollars, yen)
 * @param {string} currency - ISO currency code (e.g., 'USD', 'JPY')
 * @returns {number} - Amount in Stripe format (cents for decimal currencies, same for zero-decimal)
 */
function convertToStripeAmount(amount, currency) {
  const currencyUpper = (currency || 'USD').toUpperCase();

  // Zero-decimal currencies: use amount as-is (already in smallest unit)
  if (ZERO_DECIMAL_CURRENCIES.includes(currencyUpper)) {
    return Math.round(amount);
  }

  // Decimal currencies: multiply by 100 to convert to cents
  return Math.round(amount * 100);
}

/**
 * Stripe payment methods configuration
 * Each payment method has its display info and Stripe capability requirement
 */
const STRIPE_PAYMENT_METHODS = [
  { code: 'stripe_card', name: 'Credit/Debit Card', stripeType: 'card', icon: 'credit-card', description: 'Pay securely with your credit or debit card' },
  { code: 'stripe_apple_pay', name: 'Apple Pay', stripeType: 'apple_pay', icon: 'apple', description: 'Pay with Apple Pay' },
  { code: 'stripe_google_pay', name: 'Google Pay', stripeType: 'google_pay', icon: 'google', description: 'Pay with Google Pay' },
  { code: 'stripe_link', name: 'Link', stripeType: 'link', icon: 'link', description: 'Fast checkout with Link by Stripe' },
  { code: 'stripe_klarna', name: 'Klarna', stripeType: 'klarna', icon: 'klarna', description: 'Buy now, pay later with Klarna' },
  { code: 'stripe_afterpay', name: 'Afterpay / Clearpay', stripeType: 'afterpay_clearpay', icon: 'afterpay', description: 'Buy now, pay later with Afterpay' },
  { code: 'stripe_ideal', name: 'iDEAL', stripeType: 'ideal', icon: 'ideal', description: 'Pay with iDEAL (Netherlands)' },
  { code: 'stripe_bancontact', name: 'Bancontact', stripeType: 'bancontact', icon: 'bancontact', description: 'Pay with Bancontact (Belgium)' },
  { code: 'stripe_giropay', name: 'Giropay', stripeType: 'giropay', icon: 'giropay', description: 'Pay with Giropay (Germany)' },
  { code: 'stripe_sepa', name: 'SEPA Direct Debit', stripeType: 'sepa_debit', icon: 'bank', description: 'Pay via SEPA bank transfer' },
  { code: 'stripe_sofort', name: 'Sofort', stripeType: 'sofort', icon: 'sofort', description: 'Pay with Sofort (Europe)' },
  { code: 'stripe_eps', name: 'EPS', stripeType: 'eps', icon: 'eps', description: 'Pay with EPS (Austria)' },
  { code: 'stripe_p24', name: 'Przelewy24', stripeType: 'p24', icon: 'p24', description: 'Pay with Przelewy24 (Poland)' },
];

/**
 * Ensure provider column exists in payment_methods table
 * @param {Object} tenantDb - Tenant database connection
 */
async function ensureProviderColumn(tenantDb) {
  try {
    // Try to select with provider to check if column exists
    const { error } = await tenantDb
      .from('payment_methods')
      .select('provider')
      .limit(1);

    if (error && error.message.includes('provider')) {
      // Column doesn't exist, add it via raw SQL
      const sequelize = tenantDb.sequelize;
      if (sequelize) {
        await sequelize.query(`
          ALTER TABLE payment_methods
          ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT NULL
        `);
        console.log('✅ Added provider column to payment_methods table');
      }
    }
  } catch (err) {
    console.warn('Could not ensure provider column:', err.message);
  }
}

/**
 * Insert all available Stripe payment methods for a store after connection
 * @param {string} storeId - Store ID
 * @param {string} stripeAccountId - Connected Stripe account ID
 */
async function insertStripePaymentMethods(storeId, stripeAccountId) {
  try {
    console.log(`🔧 Inserting Stripe payment methods for store ${storeId}...`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Ensure provider column exists
    await ensureProviderColumn(tenantDb);

    // Get existing payment methods to avoid duplicates (check by code AND provider)
    const { data: existingMethods } = await tenantDb
      .from('payment_methods')
      .select('code, provider')
      .eq('store_id', storeId);

    const existingCodes = new Set((existingMethods || []).map(m => `${m.provider || ''}:${m.code}`));

    // Get enabled payment method types from Stripe account
    let enabledTypes = new Set(['card']); // Card is always available

    try {
      // Retrieve account to check capabilities
      const account = await stripe.accounts.retrieve(stripeAccountId);
      const capabilities = account.capabilities || {};

      // Map Stripe capabilities to payment method types
      if (capabilities.card_payments === 'active') enabledTypes.add('card');
      if (capabilities.link_payments === 'active') enabledTypes.add('link');
      if (capabilities.klarna_payments === 'active') enabledTypes.add('klarna');
      if (capabilities.afterpay_clearpay_payments === 'active') enabledTypes.add('afterpay_clearpay');
      if (capabilities.ideal_payments === 'active') enabledTypes.add('ideal');
      if (capabilities.bancontact_payments === 'active') enabledTypes.add('bancontact');
      if (capabilities.giropay_payments === 'active') enabledTypes.add('giropay');
      if (capabilities.sepa_debit_payments === 'active') enabledTypes.add('sepa_debit');
      if (capabilities.sofort_payments === 'active') enabledTypes.add('sofort');
      if (capabilities.eps_payments === 'active') enabledTypes.add('eps');
      if (capabilities.p24_payments === 'active') enabledTypes.add('p24');

      // Apple Pay and Google Pay are enabled through card capability
      if (capabilities.card_payments === 'active') {
        enabledTypes.add('apple_pay');
        enabledTypes.add('google_pay');
      }

      console.log(`✅ Stripe account capabilities loaded, enabled types:`, Array.from(enabledTypes));
    } catch (capError) {
      console.warn('Could not retrieve Stripe capabilities, using defaults:', capError.message);
    }

    // Prepare payment methods to insert
    const methodsToInsert = [];
    let sortOrder = 0;

    for (const pm of STRIPE_PAYMENT_METHODS) {
      // Skip if already exists (check by provider:code combination)
      if (existingCodes.has(`stripe:${pm.code}`)) {
        console.log(`⏭️ Skipping ${pm.code} - already exists for Stripe provider`);
        continue;
      }

      // Skip if not enabled in Stripe account
      if (!enabledTypes.has(pm.stripeType)) {
        console.log(`⏭️ Skipping ${pm.code} - not enabled in Stripe account`);
        continue;
      }

      methodsToInsert.push({
        name: pm.name,
        code: pm.code,
        type: 'stripe',
        payment_flow: 'online',
        description: pm.description,
        settings: { stripe_type: pm.stripeType, icon: pm.icon },
        provider: 'stripe',
        is_active: true,
        sort_order: sortOrder++,
        store_id: storeId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    if (methodsToInsert.length === 0) {
      console.log('ℹ️ No new Stripe payment methods to insert');
      return { inserted: 0 };
    }

    // Insert all payment methods
    const { data: inserted, error } = await tenantDb
      .from('payment_methods')
      .insert(methodsToInsert)
      .select();

    if (error) {
      console.error('Error inserting Stripe payment methods:', error);
      throw error;
    }

    console.log(`✅ Inserted ${inserted.length} Stripe payment methods for store ${storeId}`);
    return { inserted: inserted.length, methods: inserted };

  } catch (error) {
    console.error('Failed to insert Stripe payment methods:', error);
    // Don't throw - this is a non-critical operation
    return { inserted: 0, error: error.message };
  }
}

/**
 * Insert ALL Stripe payment methods regardless of capabilities
 * Used for Standard accounts where capabilities aren't exposed
 * @param {string} storeId - Store ID
 */
async function insertAllStripePaymentMethods(storeId) {
  try {
    console.log(`🔧 Inserting ALL Stripe payment methods for store ${storeId}...`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Ensure provider column exists
    await ensureProviderColumn(tenantDb);

    // Get existing payment methods to avoid duplicates
    const { data: existingMethods } = await tenantDb
      .from('payment_methods')
      .select('code, provider')
      .eq('store_id', storeId);

    const existingCodes = new Set((existingMethods || []).map(m => `${m.provider || ''}:${m.code}`));

    // Prepare payment methods to insert - ALL of them
    const methodsToInsert = [];
    let sortOrder = 0;

    for (const pm of STRIPE_PAYMENT_METHODS) {
      // Skip if already exists
      if (existingCodes.has(`stripe:${pm.code}`)) {
        console.log(`⏭️ Skipping ${pm.code} - already exists for Stripe provider`);
        continue;
      }

      methodsToInsert.push({
        name: pm.name,
        code: pm.code,
        type: 'stripe',
        payment_flow: 'online',
        description: pm.description,
        settings: { stripe_type: pm.stripeType, icon: pm.icon },
        provider: 'stripe',
        is_active: true,
        sort_order: sortOrder++,
        store_id: storeId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    if (methodsToInsert.length === 0) {
      console.log('ℹ️ No new Stripe payment methods to insert');
      return { inserted: 0 };
    }

    // Insert all payment methods
    const { data: inserted, error } = await tenantDb
      .from('payment_methods')
      .insert(methodsToInsert)
      .select();

    if (error) {
      console.error('Error inserting Stripe payment methods:', error);
      throw error;
    }

    console.log(`✅ Inserted ${inserted.length} Stripe payment methods for store ${storeId}`);
    return { inserted: inserted.length, methods: inserted };

  } catch (error) {
    console.error('Failed to insert all Stripe payment methods:', error);
    return { inserted: 0, error: error.message };
  }
}

/**
 * Hide/deactivate Stripe payment methods when disconnecting
 * @param {string} storeId - Store ID
 */
async function hideStripePaymentMethods(storeId) {
  try {
    console.log(`🔧 Hiding Stripe payment methods for store ${storeId}...`);

    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Deactivate all payment methods with provider = 'stripe'
    const { data: updated, error } = await tenantDb
      .from('payment_methods')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('store_id', storeId)
      .eq('provider', 'stripe')
      .select();

    if (error) {
      console.error('Error hiding Stripe payment methods:', error);
      throw error;
    }

    console.log(`✅ Deactivated ${updated?.length || 0} Stripe payment methods for store ${storeId}`);
    return { deactivated: updated?.length || 0 };

  } catch (error) {
    console.error('Failed to hide Stripe payment methods:', error);
    return { deactivated: 0, error: error.message };
  }
}

/**
 * Handle stock issue for an order - notify customer and store, optionally refund
 * @param {Object} params - Parameters for handling stock issue
 * @param {Object} params.tenantDb - Tenant database connection
 * @param {string} params.storeId - Store ID
 * @param {Object} params.order - Order object
 * @param {Array} params.insufficientItems - Array of items with insufficient stock
 * @param {string} params.paymentIntentId - Stripe payment intent ID for refund
 */
async function handleStockIssue({ tenantDb, storeId, order, insufficientItems, paymentIntentId }) {
  try {
    console.log('⚠️ Stock issue detected for order:', order.id, 'Items:', insufficientItems);

    // Get store settings to check handling preference
    const store = await getMasterStore(storeId);
    const stockIssueHandling = store?.settings?.sales_settings?.stock_issue_handling || 'manual_review';
    const storeEmail = store?.email || store?.owner_email;

    // Update order fulfillment status to stock_issue
    await tenantDb
      .from('sales_orders')
      .update({
        fulfillment_status: 'stock_issue',
        admin_notes: `Stock issue detected: ${insufficientItems.map(i => `${i.sku} (requested: ${i.requested}, available: ${i.available})`).join(', ')}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    // Prepare notification data
    const itemsList = insufficientItems.map(i => `- ${i.name} (SKU: ${i.sku}): Requested ${i.requested}, Available ${i.available}`).join('\n');

    // Send notifications
    try {
      const emailService = require('../services/email-service');

      // Email to customer - friendly, humble tone
      if (order.customer_email) {
        await emailService.sendEmail(
          storeId,
          'stock_issue_customer',
          order.customer_email,
          {
            customer_first_name: order.shipping_address?.full_name?.split(' ')[0] || 'Customer',
            order_number: order.order_number,
            store_name: store?.name || 'Our Store',
            store_url: store?.url || '',
            items_list: itemsList
          },
          'en'
        ).catch(err => console.error('Failed to send stock issue email to customer:', err.message));
      }

      // Email to store owner
      if (storeEmail) {
        await emailService.sendEmail(
          storeId,
          'stock_issue_admin',
          storeEmail,
          {
            order_number: order.order_number,
            order_id: order.id,
            customer_email: order.customer_email,
            customer_name: order.shipping_address?.full_name || 'Unknown',
            items_list: itemsList,
            store_name: store?.name || 'Store',
            admin_url: `${process.env.FRONTEND_URL || ''}/admin/orders`
          },
          'en'
        ).catch(err => console.error('Failed to send stock issue email to admin:', err.message));
      }
    } catch (emailError) {
      console.error('Error sending stock issue notifications:', emailError);
    }

    // Auto-refund if enabled
    if (stockIssueHandling === 'auto_refund') {
      console.log('💰 Auto-refund enabled, attempting refund via payment provider service...');

      const refundResult = await paymentProviderService.refund({
        order: { ...order, payment_reference: paymentIntentId || order.payment_reference },
        reason: 'stock_issue',
        store
      });

      if (refundResult.success) {
        console.log(`✅ Refund created via ${refundResult.provider}:`, refundResult.refundId);

        // Update order status
        await tenantDb
          .from('sales_orders')
          .update({
            status: 'cancelled',
            payment_status: 'refunded',
            admin_notes: `Auto-refunded due to stock issue via ${refundResult.provider}. Refund ID: ${refundResult.refundId}. Items: ${insufficientItems.map(i => i.sku).join(', ')}`,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        // Send refund notification to customer
        if (order.customer_email) {
          const emailService = require('../services/email-service');
          await emailService.sendEmail(
            storeId,
            'stock_issue_refunded',
            order.customer_email,
            {
              customer_first_name: order.shipping_address?.full_name?.split(' ')[0] || 'Customer',
              order_number: order.order_number,
              store_name: store?.name || 'Our Store',
              refund_amount: order.total_amount,
              currency: order.currency
            },
            'en'
          ).catch(err => console.error('Failed to send refund notification:', err.message));
        }

        return { refunded: true, refundId: refundResult.refundId, provider: refundResult.provider };
      } else {
        console.warn(`⚠️ Auto-refund failed: ${refundResult.error}`);

        // Update order notes with refund failure or manual requirement
        const noteMessage = refundResult.requiresManualRefund
          ? `Stock issue detected. Auto-refund not available for ${refundResult.provider} - please process refund manually.`
          : `Stock issue detected. Auto-refund FAILED: ${refundResult.error}.`;

        await tenantDb
          .from('sales_orders')
          .update({
            admin_notes: `${noteMessage} Items: ${insufficientItems.map(i => i.sku).join(', ')}`,
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

/**
 * Atomically check and deduct stock for order items
 * Returns list of items with insufficient stock if any
 * @param {Object} tenantDb - Tenant database connection
 * @param {Array} orderItems - Array of order items with product_id and quantity
 * @param {string} storeId - Store ID
 * @returns {Object} - { success: boolean, insufficientItems: Array }
 */
async function checkAndDeductStock(tenantDb, orderItems, storeId) {
  const insufficientItems = [];
  const deductedItems = [];

  for (const item of orderItems) {
    try {
      // Get current product stock with row-level consideration
      const { data: product } = await tenantDb
        .from('products')
        .select('id, sku, name, manage_stock, stock_quantity, infinite_stock, allow_backorders, purchase_count')
        .eq('id', item.product_id)
        .single();

      if (!product) {
        console.warn(`Product not found: ${item.product_id}`);
        continue;
      }

      // Skip if stock management disabled or infinite stock
      if (!product.manage_stock || product.infinite_stock) {
        // Still update purchase count
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

      // Check if sufficient stock
      if (product.stock_quantity < quantity && !product.allow_backorders) {
        insufficientItems.push({
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          requested: quantity,
          available: product.stock_quantity
        });
        continue; // Don't deduct, but continue checking other items
      }

      // Deduct stock
      const newStockQuantity = product.stock_quantity - quantity;
      await tenantDb
        .from('products')
        .update({
          stock_quantity: Math.max(0, newStockQuantity),
          purchase_count: (product.purchase_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      deductedItems.push({
        product_id: product.id,
        sku: product.sku,
        quantity: quantity,
        oldStock: product.stock_quantity,
        newStock: Math.max(0, newStockQuantity)
      });

      console.log(`✅ Stock deducted for ${product.sku}: ${product.stock_quantity} -> ${Math.max(0, newStockQuantity)}`);
    } catch (error) {
      console.error('Error checking/deducting stock for item:', item.product_id, error);
    }
  }

  return {
    success: insufficientItems.length === 0,
    insufficientItems,
    deductedItems
  };
}

// @route   GET /api/payments/connect-status
// @desc    Get Stripe Connect status
// @access  Private
router.get('/connect-status', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.json({
        success: true,
        data: {
          connected: false,
          error: 'Stripe not configured'
        }
      });
    }

    // Get Stripe config from integration_configs
    const stripeConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    console.log('🔍 Stripe config lookup:', {
      store_id,
      integrationType: STRIPE_INTEGRATION_TYPE,
      foundConfig: !!stripeConfig,
      configData: stripeConfig?.config_data,
      configDataType: typeof stripeConfig?.config_data
    });
    const stripeAccountId = stripeConfig?.config_data?.accountId;

    if (!stripeConfig || !stripeAccountId) {
      console.log('❌ No stripe config or accountId found:', { stripeConfig, stripeAccountId });
      return res.json({
        success: true,
        data: {
          connected: false,
          account_id: null,
          charges_enabled: false,
          payouts_enabled: false,
          requirements: {
            currently_due: [],
            eventually_due: [],
            past_due: []
          },
          capabilities: {
            card_payments: 'inactive',
            transfers: 'inactive'
          }
        }
      });
    }

    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId);

    // Determine if onboarding is complete
    // In test mode, skip onboarding requirements since verification isn't needed
    const isTestMode = stripeConfig.config_data?.livemode === false;
    const onboardingComplete = isTestMode || (account.details_submitted && account.charges_enabled);

    const connectStatus = {
      connected: true,
      account_id: account.id,
      email: account.email,
      business_name: account.business_profile?.name || account.settings?.dashboard?.display_name,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      requirements: {
        currently_due: account.requirements?.currently_due || [],
        eventually_due: account.requirements?.eventually_due || [],
        past_due: account.requirements?.past_due || []
      },
      capabilities: {
        card_payments: account.capabilities?.card_payments || 'inactive',
        transfers: account.capabilities?.transfers || 'inactive'
      },
      details_submitted: account.details_submitted,
      onboardingComplete: onboardingComplete,
      type: account.type
    };

    // Update integration config if onboarding is complete (for caching/performance)
    if (onboardingComplete && !stripeConfig.config_data?.onboardingComplete) {
      try {
        await IntegrationConfig.createOrUpdate(store_id, STRIPE_INTEGRATION_TYPE, {
          ...stripeConfig.config_data,
          onboardingComplete: true,
          onboardingCompletedAt: new Date().toISOString()
        });
        console.log('Updated Stripe integration config with onboarding status');

        // Insert Stripe payment methods now that onboarding is complete
        const paymentMethodsResult = await insertStripePaymentMethods(store_id, stripeAccountId);
        console.log(`Stripe payment methods insertion result:`, paymentMethodsResult);
      } catch (updateError) {
        console.error('Could not update Stripe config:', updateError.message);
      }
    }

    res.json({
      success: true,
      data: connectStatus
    });
  } catch (error) {
    console.error('Get Stripe Connect status error:', error);

    // If the account doesn't exist, return disconnected status
    if (error.code === 'account_invalid') {
      return res.json({
        success: true,
        data: {
          connected: false,
          account_id: null,
          error: 'Invalid Stripe account'
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/payments/disconnect-stripe
// @desc    Disconnect Stripe Connect account
// @access  Private
router.delete('/disconnect-stripe', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Delete the Stripe integration config
    const deleted = await IntegrationConfig.deleteByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'No Stripe connection found for this store'
      });
    }

    // Hide/deactivate Stripe payment methods
    const hideResult = await hideStripePaymentMethods(store_id);
    console.log(`Disconnected Stripe for store ${store_id}, deactivated ${hideResult.deactivated} payment methods`);

    res.json({
      success: true,
      message: 'Stripe account disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnect Stripe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Stripe',
      error: error.message
    });
  }
});

// @route   POST /api/payments/sync-stripe-methods
// @desc    Sync/refresh Stripe payment methods based on current account capabilities
// @access  Private
router.post('/sync-stripe-methods', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id, force_all } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Get Stripe config
    const stripeConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    if (!stripeConfig?.config_data?.accountId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe account connected to this store'
      });
    }

    const stripeAccountId = stripeConfig.config_data.accountId;

    // Get account capabilities for debugging
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const capabilities = account.capabilities || {};

    console.log('🔍 Stripe account type:', account.type);
    console.log('🔍 Stripe capabilities:', JSON.stringify(capabilities, null, 2));

    // Insert/update payment methods
    // For Standard accounts (OAuth), force_all=true inserts all methods since capabilities aren't exposed
    const result = force_all
      ? await insertAllStripePaymentMethods(store_id)
      : await insertStripePaymentMethods(store_id, stripeAccountId);

    res.json({
      success: true,
      message: `Synced Stripe payment methods`,
      data: {
        inserted: result.inserted,
        accountType: account.type,
        capabilities: capabilities,
        hint: account.type === 'standard'
          ? 'Standard accounts do not expose payment method capabilities. Use force_all=true to insert all methods.'
          : null,
        availablePaymentMethods: STRIPE_PAYMENT_METHODS.map(pm => ({
          code: pm.code,
          name: pm.name,
          stripeType: pm.stripeType,
          enabled: capabilities[`${pm.stripeType}_payments`] === 'active' ||
                   (pm.stripeType === 'card' && capabilities.card_payments === 'active') ||
                   (pm.stripeType === 'apple_pay' && capabilities.card_payments === 'active') ||
                   (pm.stripeType === 'google_pay' && capabilities.card_payments === 'active')
        }))
      }
    });
  } catch (error) {
    console.error('Sync Stripe methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync Stripe payment methods',
      error: error.message
    });
  }
});

// @route   POST /api/payments/link-existing-account
// @desc    Link an existing Stripe account (for testing/development)
// @access  Private
router.post('/link-existing-account', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id, account_id } = req.body;

    if (!store_id || !account_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id and account_id are required'
      });
    }

    // Validate the account_id format
    if (!account_id.startsWith('acct_')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account ID format. Must start with "acct_"'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Stripe not configured'
      });
    }

    // Verify the account exists in Stripe
    let account;
    try {
      account = await stripe.accounts.retrieve(account_id);
    } catch (stripeError) {
      return res.status(400).json({
        success: false,
        message: `Stripe account not found: ${stripeError.message}`
      });
    }

    // Check onboarding status
    // In test mode, skip onboarding requirements since verification isn't needed
    const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
    const onboardingComplete = isTestMode || (account.details_submitted && account.charges_enabled);

    // Save account ID to integration_configs
    await IntegrationConfig.createOrUpdate(store_id, STRIPE_INTEGRATION_TYPE, {
      accountId: account.id,
      onboardingComplete: onboardingComplete,
      onboardingCompletedAt: onboardingComplete ? new Date().toISOString() : null,
      linkedManually: true,
      livemode: !isTestMode,
      createdAt: new Date().toISOString()
    });

    console.log(`Linked existing Stripe account ${account_id} to store ${store_id}`);

    res.json({
      success: true,
      data: {
        account_id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboardingComplete: onboardingComplete
      }
    });
  } catch (error) {
    console.error('Link existing Stripe account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to link Stripe account',
      error: error.message
    });
  }
});

// @route   GET /api/payments/connect-oauth-url
// @desc    Generate Stripe Connect OAuth URL to connect existing Standard accounts
// @access  Private
router.get('/connect-oauth-url', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Stripe not configured'
      });
    }

    // STRIPE_CLIENT_ID is required for OAuth
    const stripeClientId = process.env.STRIPE_CLIENT_ID;
    if (!stripeClientId) {
      return res.status(400).json({
        success: false,
        message: 'Stripe OAuth not configured. Please set STRIPE_CLIENT_ID environment variable.'
      });
    }

    // Get store to verify it exists
    const store = await getMasterStore(store_id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check if account already exists
    const existingConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    if (existingConfig?.config_data?.accountId) {
      return res.status(400).json({
        success: false,
        message: 'A Stripe account is already connected to this store. Disconnect it first to connect a different account.'
      });
    }

    // Generate state token for security (includes store_id)
    const state = Buffer.from(JSON.stringify({
      store_id: store_id,
      timestamp: Date.now(),
      nonce: uuidv4()
    })).toString('base64');

    // Build OAuth URL
    const redirectUri = `${process.env.CORS_ORIGIN}/admin/payments/oauth-callback`;
    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('client_id', stripeClientId);
    oauthUrl.searchParams.set('scope', 'read_write');
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('state', state);
    // stripe_user[business_type] can be pre-filled if needed
    // oauthUrl.searchParams.set('stripe_user[business_type]', 'company');

    console.log(`Generated Stripe OAuth URL for store ${store_id}`);

    res.json({
      success: true,
      data: {
        oauth_url: oauthUrl.toString(),
        state: state
      }
    });
  } catch (error) {
    console.error('Generate Stripe OAuth URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate OAuth URL',
      error: error.message
    });
  }
});

// @route   POST /api/payments/connect-oauth-callback
// @desc    Handle Stripe Connect OAuth callback - exchange code for account
// @access  Private
router.post('/connect-oauth-callback', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'code and state are required'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Stripe not configured'
      });
    }

    // Decode and validate state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state parameter'
      });
    }

    const { store_id, timestamp } = stateData;

    // Check state is not too old (15 minutes)
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'OAuth session expired. Please try again.'
      });
    }

    // Verify store exists and user has access
    const store = await getMasterStore(store_id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check if account already exists (prevent duplicate connections)
    const existingConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    if (existingConfig?.config_data?.accountId) {
      return res.status(400).json({
        success: false,
        message: 'A Stripe account is already connected to this store'
      });
    }

    // Exchange authorization code for account credentials
    let tokenResponse;
    try {
      tokenResponse = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code: code
      });
    } catch (stripeError) {
      console.error('Stripe OAuth token exchange error:', stripeError);
      return res.status(400).json({
        success: false,
        message: `Failed to connect Stripe account: ${stripeError.message}`
      });
    }

    const connectedAccountId = tokenResponse.stripe_user_id;

    // Retrieve account details to check status
    const account = await stripe.accounts.retrieve(connectedAccountId);
    // In test mode, skip onboarding requirements since verification isn't needed
    const isTestMode = !tokenResponse.livemode;
    const onboardingComplete = isTestMode || (account.details_submitted && account.charges_enabled);

    // Save account to integration_configs
    await IntegrationConfig.createOrUpdate(store_id, STRIPE_INTEGRATION_TYPE, {
      accountId: connectedAccountId,
      accountType: 'standard', // OAuth connects Standard accounts
      onboardingComplete: onboardingComplete,
      onboardingCompletedAt: onboardingComplete ? new Date().toISOString() : null,
      connectedViaOAuth: true,
      accessToken: tokenResponse.access_token, // Store for API calls on behalf of account
      refreshToken: tokenResponse.refresh_token,
      tokenType: tokenResponse.token_type,
      livemode: tokenResponse.livemode,
      createdAt: new Date().toISOString()
    });

    console.log(`Connected existing Stripe account ${connectedAccountId} to store ${store_id} via OAuth`);

    // Insert available Stripe payment methods for the store
    const paymentMethodsResult = await insertStripePaymentMethods(store_id, connectedAccountId);
    console.log(`Stripe payment methods insertion result:`, paymentMethodsResult);

    res.json({
      success: true,
      data: {
        account_id: connectedAccountId,
        account_type: account.type,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboardingComplete: onboardingComplete,
        business_profile: account.business_profile
      }
    });
  } catch (error) {
    console.error('Stripe OAuth callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete OAuth connection',
      error: error.message
    });
  }
});

// @route   POST /api/payments/connect-account
// @desc    Create Stripe Connect account
// @access  Private
router.post('/connect-account', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { store_id, country = 'US', business_type = 'company' } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Stripe not configured'
      });
    }

    // Get store
    const store = await getMasterStore(store_id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check if account already exists in integration_configs
    const existingConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    if (existingConfig?.config_data?.accountId) {
      return res.status(400).json({
        success: false,
        message: 'Stripe account already exists for this store'
      });
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: country,
      business_type: business_type,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      metadata: {
        store_id: store_id,
        store_name: store.name
      }
    });

    // Save account ID to integration_configs
    await IntegrationConfig.createOrUpdate(store_id, STRIPE_INTEGRATION_TYPE, {
      accountId: account.id,
      country: country,
      businessType: business_type,
      onboardingComplete: false,
      createdAt: new Date().toISOString()
    });

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.CORS_ORIGIN}/dashboard/payments/connect?refresh=true`,
      return_url: `${process.env.CORS_ORIGIN}/dashboard/payments/connect?success=true`,
      type: 'account_onboarding'
    });

    res.json({
      success: true,
      data: {
        account_id: account.id,
        onboarding_url: accountLink.url
      }
    });
  } catch (error) {
    console.error('Create Stripe Connect account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/payments/connect-link
// @desc    Create Stripe Connect account link for onboarding
// @access  Private
router.post('/connect-link', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const { return_url, refresh_url, store_id } = req.body;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Stripe not configured'
      });
    }

    // Get Stripe config from integration_configs
    const stripeConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    const stripeAccountId = stripeConfig?.config_data?.accountId;

    if (!stripeAccountId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe account found for this store. Please create an account first.'
      });
    }

    // Create account link for existing account
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refresh_url || `${process.env.CORS_ORIGIN}/dashboard/payments/connect?refresh=true`,
      return_url: return_url || `${process.env.CORS_ORIGIN}/dashboard/payments/connect?success=true`,
      type: 'account_onboarding'
    });

    res.json({
      success: true,
      data: {
        url: accountLink.url,
        account_id: stripeAccountId
      }
    });
  } catch (error) {
    console.error('Create Stripe Connect link error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/payments/create-intent
// @desc    Create Stripe Payment Intent for credit purchases
// @access  Private
router.post('/create-intent', authMiddleware, async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();

  console.log('='.repeat(80));
  console.log(`🟦 [${requestId}] CREATE PAYMENT INTENT REQUEST STARTED`);
  console.log(`🟦 [${requestId}] Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  try {
    // Log environment configuration (without exposing secrets)
    console.log(`🔧 [${requestId}] Environment check:`, {
      hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
      stripeKeyPrefix: process.env.STRIPE_SECRET_KEY ? process.env.STRIPE_SECRET_KEY.substring(0, 7) + '...' : 'MISSING',
      hasPublishableKey: !!process.env.STRIPE_PUBLISHABLE_KEY,
      publishableKeyPrefix: process.env.STRIPE_PUBLISHABLE_KEY?.substring(0, 7) + '...' || 'MISSING',
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      nodeEnv: process.env.NODE_ENV
    });

    console.log(`📝 [${requestId}] Request details:`, {
      method: req.method,
      url: req.url,
      headers: {
        contentType: req.headers['content-type'],
        authorization: req.headers.authorization ? 'Bearer ***' : 'MISSING'
      },
      bodyKeys: Object.keys(req.body),
      body: req.body,
      userId: req.user?.id,
      userEmail: req.user?.email
    });

    const { amount, currency = 'usd', metadata = {} } = req.body;

    // Validate amount
    console.log(`🔍 [${requestId}] Validating request data...`);
    console.log(`🔍 [${requestId}] Amount object:`, {
      amount,
      type: typeof amount,
      isObject: typeof amount === 'object',
      hasCredits: amount?.credits,
      hasAmount: amount?.amount
    });

    if (!amount || typeof amount !== 'object' || !amount.credits || !amount.amount) {
      console.error(`❌ [${requestId}] Invalid amount format:`, amount);
      return res.status(400).json({
        success: false,
        error: 'Invalid amount format. Expected { credits, amount }'
      });
    }

    const { credits, amount: amountUsd } = amount;

    // Validate credits and amount
    if (!credits || credits < 1) {
      console.error(`❌ [${requestId}] Invalid credits:`, credits);
      return res.status(400).json({
        success: false,
        error: 'Credits must be at least 1'
      });
    }

    if (!amountUsd || amountUsd < 1) {
      console.error(`❌ [${requestId}] Invalid amount:`, amountUsd);
      return res.status(400).json({
        success: false,
        error: 'Amount must be at least $1'
      });
    }

    // Calculate Dutch VAT (BTW) - 21%
    const pricingService = require('../services/pricing-service');
    const taxInfo = pricingService.calculateTax(amountUsd);
    const totalWithTax = taxInfo.total;

    console.log(`✅ [${requestId}] Validation passed:`, {
      credits,
      subtotal: amountUsd,
      taxAmount: taxInfo.taxAmount,
      taxRate: `${taxInfo.taxPercentage}%`,
      totalWithTax,
      currency
    });

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error(`❌ [${requestId}] Stripe secret key not configured`);
      console.error(`❌ [${requestId}] Available env vars:`, Object.keys(process.env).filter(k => k.includes('STRIPE')));
      return res.status(400).json({
        success: false,
        error: 'Stripe payment is not configured. Please contact support.'
      });
    }

    const userId = req.user.id;
    console.log(`👤 [${requestId}] User authenticated:`, {
      userId,
      email: req.user.email,
      role: req.user.role
    });

    // Get store_id from request (required)
    const storeId = metadata.store_id || req.body.store_id || req.headers['x-store-id'];

    if (!storeId) {
      console.error(`❌ [${requestId}] No store_id provided in request`);
      return res.status(400).json({
        success: false,
        error: 'store_id is required for credit purchase'
      });
    }

    // Verify the store exists and belongs to the user
    console.log(`🔍 [${requestId}] Looking up store:`, storeId);
    const hasAccess = await checkUserStoreAccess(userId, storeId);

    if (!hasAccess) {
      console.error(`❌ [${requestId}] Store not found or doesn't belong to user:`, { storeId, userId });
      return res.status(403).json({
        success: false,
        error: 'Store not found or you do not have permission to purchase credits for this store'
      });
    }

    // Get store details for logging
    const userStore = await getMasterStore(storeId);
    console.log(`🏪 [${requestId}] User store verified:`, {
      storeId: userStore.id,
      storeName: userStore.name,
      storeSlug: userStore.slug
    });

    // Create credit transaction record first
    console.log(`💾 [${requestId}] Creating credit transaction record...`);
    const creditService = require('../services/credit-service');

    let transaction;
    try {
      transaction = await creditService.createPurchaseTransaction(
        userId,
        userStore.id,
        amountUsd,
        credits
      );
      console.log(`💳 [${requestId}] Transaction created:`, {
        transactionId: transaction.id,
        status: transaction.status,
        amount: amountUsd,
        credits: credits
      });
    } catch (txError) {
      console.error(`❌ [${requestId}] Failed to create transaction:`, {
        error: txError.message,
        stack: txError.stack
      });
      throw txError;
    }

    // Create Stripe payment intent with total including tax
    const stripeAmount = convertToStripeAmount(totalWithTax, currency);
    console.log(`💰 [${requestId}] Preparing Stripe payment intent:`, {
      subtotal: amountUsd,
      taxAmount: taxInfo.taxAmount,
      taxRate: `${taxInfo.taxPercentage}%`,
      totalWithTax,
      stripeAmount,
      currency,
      credits,
      description: `Credit purchase: ${credits} credits (incl. ${taxInfo.taxPercentage}% BTW)`
    });

    let paymentIntent;
    try {
      console.log(`🔵 [${requestId}] Calling Stripe API...`);
      paymentIntent = await stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: currency.toLowerCase(),
        metadata: {
          user_id: userId,
          credits_amount: credits.toString(),
          transaction_id: transaction.id,
          type: 'credit_purchase',
          subtotal: amountUsd.toString(),
          tax_amount: taxInfo.taxAmount.toString(),
          tax_rate: taxInfo.taxRate.toString(),
          tax_percentage: taxInfo.taxPercentage.toString(),
          total_with_tax: totalWithTax.toString(),
          ...metadata
        },
        description: `Credit purchase: ${credits} credits (incl. ${taxInfo.taxPercentage}% BTW)`
      });

      console.log(`✅ [${requestId}] Stripe payment intent created:`, {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        clientSecretPrefix: paymentIntent.client_secret.substring(0, 20) + '...'
      });
    } catch (stripeError) {
      console.error(`❌ [${requestId}] Stripe API error:`, {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        statusCode: stripeError.statusCode,
        requestId: stripeError.requestId,
        stack: stripeError.stack
      });
      throw stripeError;
    }

    // Update transaction with payment intent ID
    console.log(`💾 [${requestId}] Updating transaction with payment intent ID...`);
    const CreditTransaction = require('../models/CreditTransaction');
    await CreditTransaction.update(
      { metadata: { ...transaction.metadata, payment_intent_id: paymentIntent.id } },
      { where: { id: transaction.id } }
    );

    const responseData = {
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        transactionId: transaction.id,
        taxInfo: {
          subtotal: amountUsd,
          taxAmount: taxInfo.taxAmount,
          total: totalWithTax,
          taxRate: taxInfo.taxRate,
          taxPercentage: taxInfo.taxPercentage
        }
      }
    };

    const elapsed = Date.now() - startTime;
    console.log(`✅ [${requestId}] SUCCESS - Returning response (${elapsed}ms):`, {
      hasClientSecret: !!responseData.data.clientSecret,
      paymentIntentId: responseData.data.paymentIntentId,
      transactionId: responseData.data.transactionId
    });
    console.log('='.repeat(80));

    res.json(responseData);

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('='.repeat(80));
    console.error(`❌ [${requestId}] CREATE PAYMENT INTENT FAILED (${elapsed}ms)`);
    console.error(`❌ [${requestId}] Error type:`, error.constructor.name);
    console.error(`❌ [${requestId}] Error message:`, error.message);
    console.error(`❌ [${requestId}] Error stack:`, error.stack);
    if (error.response) {
      console.error(`❌ [${requestId}] Error response:`, error.response);
    }
    console.error('='.repeat(80));

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment intent'
    });
  }
});

// @route   GET /api/payments/publishable-key
// @desc    Get Stripe publishable key
// @access  Public
router.get('/publishable-key', (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return res.status(500).json({
      success: false,
      error: 'STRIPE_PUBLISHABLE_KEY environment variable is not configured'
    });
  }

  res.json({
    data: {
      publishableKey
    }
  });
});

// @route   POST /api/payments/create-checkout
// @desc    Create Stripe Checkout Session
// @access  Public
router.post('/create-checkout', async (req, res) => {
  try {
    const { 
      items, 
      store_id, 
      success_url, 
      cancel_url,
      customer_email,
      customer_id, // Add customer_id
      shipping_address,
      shipping_method,
      selected_shipping_method,
      shipping_cost,
      tax_amount,
      payment_fee,
      selected_payment_method,
      selected_payment_method_name,
      discount_amount,
      applied_coupon,
      delivery_date,
      delivery_time_slot,
      delivery_instructions,
      coupon_code
    } = req.body;

    // Debug: Log received data
    console.log('🔍 Stripe checkout request data:', {
      customer_email,
      tax_amount: { value: tax_amount, type: typeof tax_amount, parsed: parseFloat(tax_amount) },
      payment_fee: { value: payment_fee, type: typeof payment_fee, parsed: parseFloat(payment_fee) },
      shipping_cost: { value: shipping_cost, type: typeof shipping_cost },
      selected_payment_method,
      selected_payment_method_name,
      shipping_address,
      items: items?.length || 0
    });

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required'
      });
    }

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required'
      });
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Stripe not configured'
      });
    }

    // Get store to check for Stripe account
    const store = await getMasterStore(store_id);
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Get Stripe account from integration_configs
    const stripeConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    const stripeAccountId = stripeConfig?.config_data?.accountId;

    // Get tenant DB connection for blacklist checks
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get blacklist settings
    const { data: blacklistSettings } = await tenantDb
      .from('blacklist_settings')
      .select('*')
      .eq('store_id', store_id)
      .maybeSingle();
    const settings = blacklistSettings || { block_by_ip: false, block_by_email: true, block_by_country: false };

    // Get IP address from request
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

    // Get country from headers (if provided by reverse proxy like Cloudflare)
    const countryCode = req.headers['cf-ipcountry'] || req.headers['x-country-code'];

    // Check IP blacklist
    if (settings.block_by_ip && ipAddress) {
      const { data: blacklistedIP } = await tenantDb
        .from('blacklist_ips')
        .select('*')
        .eq('store_id', store_id)
        .eq('ip_address', ipAddress)
        .maybeSingle();

      if (blacklistedIP) {
        const { getTranslation } = require('../utils/translationHelper');
        const language = req.headers['x-language'] || 'en';
        const message = await getTranslation('error.blacklist.ip', language);
        return res.status(403).json({
          success: false,
          message
        });
      }
    }

    // Check email blacklist
    if (settings.block_by_email && customer_email) {
      // Check standalone email blacklist
      const { data: blacklistedEmail } = await tenantDb
        .from('blacklist_emails')
        .select('*')
        .eq('store_id', store_id)
        .eq('email', customer_email.toLowerCase())
        .maybeSingle();

      if (blacklistedEmail) {
        const { getTranslation } = require('../utils/translationHelper');
        const language = req.headers['x-language'] || 'en';
        const message = await getTranslation('error.blacklist.checkout', language);
        return res.status(403).json({
          success: false,
          message
        });
      }

      // Check if customer email is blacklisted (from customers table)
      const { data: blacklistedCustomer } = await tenantDb
        .from('customers')
        .select('*')
        .eq('email', customer_email)
        .eq('store_id', store_id)
        .eq('is_blacklisted', true)
        .maybeSingle();

      if (blacklistedCustomer) {
        const { getTranslation } = require('../utils/translationHelper');
        const language = req.headers['x-language'] || 'en';
        const message = await getTranslation('error.blacklist.checkout', language);
        return res.status(403).json({
          success: false,
          message
        });
      }
    }

    // Check country blacklist
    if (settings.block_by_country && countryCode) {
      const { data: blacklistedCountry } = await tenantDb
        .from('blacklist_countries')
        .select('*')
        .eq('store_id', store_id)
        .eq('country_code', countryCode.toUpperCase())
        .maybeSingle();

      if (blacklistedCountry) {
        const { getTranslation } = require('../utils/translationHelper');
        const language = req.headers['x-language'] || 'en';
        const message = await getTranslation('error.blacklist.country', language);
        return res.status(403).json({
          success: false,
          message
        });
      }
    }

    // Check if this is an offline payment method (COD, bank transfer, etc.)
    let paymentMethodRecord = null;
    if (selected_payment_method) {
      const { data: pmRecord } = await tenantDb
        .from('payment_methods')
        .select('*')
        .eq('code', selected_payment_method)
        .eq('store_id', store_id)
        .maybeSingle();

      if (pmRecord) {
        paymentMethodRecord = pmRecord;
      }
    }

    // Handle offline payment methods (COD, bank transfer, etc.) - skip Stripe
    if (paymentMethodRecord && paymentMethodRecord.payment_flow === 'offline') {
      console.log('💵 Processing OFFLINE payment method:', selected_payment_method);

      // Generate a unique order ID for offline payments
      const offlineOrderId = uuidv4();

      // Create order directly without Stripe
      const orderData = {
        items,
        store_id,
        customer_email,
        customer_id,
        shipping_address,
        billing_address: shipping_address,
        shipping_method,
        selected_shipping_method,
        shipping_cost,
        tax_amount,
        payment_fee,
        selected_payment_method,
        selected_payment_method_name: paymentMethodRecord.name || selected_payment_method_name,
        discount_amount,
        applied_coupon,
        delivery_date,
        delivery_time_slot,
        delivery_instructions,
        store
      };

      // Create a mock session object for the preliminary order function
      const mockSession = {
        id: `offline_${offlineOrderId}`,
        payment_status: 'unpaid', // Offline payments are unpaid until fulfilled
        amount_total: 0, // Will be calculated from items
        metadata: {
          store_id: store_id.toString(),
          customer_id: customer_id || '',
          delivery_date: delivery_date || '',
          delivery_time_slot: delivery_time_slot || '',
          delivery_instructions: delivery_instructions || '',
          coupon_code: applied_coupon?.code || '',
          discount_amount: discount_amount?.toString() || '0',
          shipping_method_name: shipping_method?.name || selected_shipping_method || '',
          shipping_method_id: shipping_method?.id?.toString() || '',
          shipping_cost: shipping_cost?.toString() || '0',
          tax_amount: (parseFloat(tax_amount) || 0).toString(),
          payment_fee: (parseFloat(payment_fee) || 0).toString(),
          payment_method: selected_payment_method || ''
        }
      };

      try {
        await createPreliminaryOrder(mockSession, orderData);
        console.log('✅ Offline order created successfully:', mockSession.id);

        // Send order confirmation email for offline orders
        console.log('📧 Sending order confirmation email for offline payment...');
        try {
          const emailService = require('../services/email-service');

          // Get the created order to send email
          console.log('📧 Looking up order with payment_reference:', mockSession.id);
          const { data: createdOrder, error: orderLookupError } = await tenantDb
            .from('sales_orders')
            .select('*')
            .eq('payment_reference', mockSession.id)
            .single();

          if (orderLookupError) {
            console.error('❌ Error looking up order for email:', orderLookupError.message);
          }

          if (createdOrder) {
            console.log('📧 Found order for email:', createdOrder.id, createdOrder.order_number);

            // Get order items separately
            const { data: orderItems } = await tenantDb
              .from('sales_order_items')
              .select('*')
              .eq('order_id', createdOrder.id);

            const customerName = shipping_address?.full_name || customer_email?.split('@')[0] || 'Customer';
            const nameParts = customerName.split(' ');
            const firstName = nameParts[0] || 'Customer';
            const lastName = nameParts.slice(1).join(' ') || '';

            console.log('📧 Sending email to:', customer_email);

            // Send the order confirmation email - email service extracts origin from req automatically
            try {
              await emailService.sendTransactionalEmail(store_id, 'order_success_email', {
                recipientEmail: customer_email,
                orderId: createdOrder.id,
                customer: {
                  first_name: firstName,
                  last_name: lastName,
                  email: customer_email
                },
                order: {
                  ...createdOrder,
                  OrderItems: orderItems || []
                },
                store: store,
                languageCode: 'en'
              }, req);
              console.log(`🎉 Offline order confirmation email sent to: ${customer_email}`);
            } catch (emailSendError) {
              console.error('❌ Failed to send offline order confirmation email:', emailSendError.message);
            }
          } else {
            console.error('❌ Could not find order with payment_reference:', mockSession.id);
          }
        } catch (emailError) {
          console.error('⚠️ Error sending offline order email:', emailError.message);
          console.error('⚠️ Error stack:', emailError.stack);
          // Don't fail the order if email fails
        }

        // Build success URL for offline payment
        const successUrl = await buildStoreUrl({
          tenantDb,
          storeId: store_id,
          storeSlug: store.slug,
          path: '/order-success',
          queryParams: { session_id: mockSession.id }
        });

        return res.json({
          success: true,
          data: {
            session_id: mockSession.id,
            checkout_url: successUrl, // Redirect directly to success page
            payment_flow: 'offline',
            message: 'Order placed successfully. Payment will be collected on delivery.'
          }
        });
      } catch (offlineOrderError) {
        console.error('❌ Failed to create offline order:', offlineOrderError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to create order. Please try again.'
        });
      }
    }

    // Get store currency
    const storeCurrency = store.currency || 'usd';
    
    // Calculate amounts and prepare additional charges
    const taxAmountNum = parseFloat(tax_amount) || 0;
    const paymentFeeNum = parseFloat(payment_fee) || 0;
    const shippingCostNum = parseFloat(shipping_cost) || 0;
    
    console.log('💵 Calculated amounts:', {
      tax: taxAmountNum,
      paymentFee: paymentFeeNum,
      shipping: shippingCostNum
    });
    
    // Calculate subtotal for tax percentage
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
      return sum + itemTotal;
    }, 0);

    // Create separate rates for charges (similar to shipping rates)
    let taxRateId = null;

    // Determine Stripe options for Connect account
    const stripeOptions = {};
    if (stripeAccountId) {
      stripeOptions.stripeAccount = stripeAccountId;
    }

    // Create tax rate if provided
    if (taxAmountNum > 0) {
      try {
        console.log('💰 Creating tax rate:', taxAmountNum, 'cents:', Math.round(taxAmountNum * 100));

        const taxPercentage = subtotal > 0 ? ((taxAmountNum / subtotal) * 100).toFixed(2) : '';
        const taxName = taxPercentage ? `Tax (${taxPercentage}%)` : 'Tax';

        const taxRateParams = {
          display_name: taxName,
          description: 'Sales Tax',
          percentage: parseFloat(taxPercentage) || 0,
          inclusive: false,
          metadata: {
            item_type: 'tax',
            tax_rate: taxPercentage
          }
        };
        const taxRate = stripeAccountId
          ? await stripe.taxRates.create(taxRateParams, stripeOptions)
          : await stripe.taxRates.create(taxRateParams);
        
        taxRateId = taxRate.id;
        console.log('✅ Created tax rate:', taxRateId);
      } catch (taxError) {
        console.error('Failed to create tax rate:', taxError.message);
        taxRateId = null;
      }
    }

    // Create line items for Stripe - separate main product and custom options
    const line_items = [];
    
    // Pre-fetch product data for all items to get actual product names
    const productIds = [...new Set(items.map(item => item.product_id).filter(Boolean))];
    const productMap = new Map();
    
    if (productIds.length > 0) {
      try {
        const { data: products, error } = await tenantDb
          .from('products')
          .select('*')
          .in('id', productIds);

        if (!error && products) {
          products.forEach(product => {
            productMap.set(product.id, product);
          });
          console.log('Pre-fetched product data for', products.length, 'products');
        }
      } catch (error) {
        console.warn('Could not pre-fetch product data:', error.message);
      }
    }
    
    items.forEach(item => {
      // Main product line item
      const basePrice = item.price || 0;
      const unit_amount = convertToStripeAmount(basePrice, storeCurrency); // Convert based on currency type
      
      // Handle different name formats from frontend with database lookup
      let productName = item.product_name || 
                       item.name || 
                       item.product?.name || 
                       'Product';
      
      // Look up actual product name from database if needed
      if ((!productName || productName === 'Product') && item.product_id) {
        const product = productMap.get(item.product_id);
        if (product) {
          productName = product.name;
          console.log('Using database product name for Stripe:', productName);
        }
      }
      
      // Add main product line item
      const productLineItem = {
        price_data: {
          currency: storeCurrency.toLowerCase(),
          product_data: {
            name: productName,
            description: item.description || item.product?.description || undefined,
            images: item.image_url ? [item.image_url] : item.product?.image_url ? [item.product.image_url] : undefined,
            metadata: {
              product_id: item.product_id?.toString() || '',
              sku: item.sku || item.product?.sku || '',
              item_type: 'main_product'
            }
          },
          unit_amount: unit_amount,
        },
        quantity: item.quantity || 1,
      };
      
      // Apply tax rate if created
      if (taxRateId) {
        productLineItem.tax_rates = [taxRateId];
      }
      
      line_items.push(productLineItem);
      
      // Add separate line items for each custom option
      if (item.selected_options && item.selected_options.length > 0) {
        item.selected_options.forEach(option => {
          if (option.price && option.price > 0) {
            const optionUnitAmount = convertToStripeAmount(option.price, storeCurrency); // Convert based on currency type
            
            const optionLineItem = {
              price_data: {
                currency: storeCurrency.toLowerCase(),
                product_data: {
                  name: `${option.name}`,
                  description: `Custom option for ${productName}`,
                  metadata: {
                    product_id: item.product_id?.toString() || '',
                    option_name: option.name,
                    parent_product: productName,
                    item_type: 'custom_option'
                  }
                },
                unit_amount: optionUnitAmount,
              },
              quantity: item.quantity || 1,
            };
            
            // Apply tax rate to options too
            if (taxRateId) {
              optionLineItem.tax_rates = [taxRateId];
            }
            
            line_items.push(optionLineItem);
          }
        });
      }
    });

    // Add payment fee as line item (no direct rate support like shipping)
    if (paymentFeeNum > 0) {
      const paymentFeeStripeAmount = convertToStripeAmount(paymentFeeNum, storeCurrency);
      console.log('💳 Adding payment fee line item:', paymentFeeNum, 'stripe amount:', paymentFeeStripeAmount, 'method:', selected_payment_method, 'name:', selected_payment_method_name);

      // Use the payment method name from frontend (e.g., "Bank Transfer", "Credit Card")
      let paymentMethodName = selected_payment_method_name || selected_payment_method || 'Payment Method';

      line_items.push({
        price_data: {
          currency: storeCurrency.toLowerCase(),
          product_data: {
            name: paymentMethodName,
            metadata: {
              item_type: 'payment_fee',
              payment_method: selected_payment_method || '',
              payment_method_name: selected_payment_method_name || ''
            }
          },
          unit_amount: paymentFeeStripeAmount,
        },
        quantity: 1,
      });
    }

    // Build checkout session configuration
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: line_items,
      mode: 'payment',
      success_url: success_url || `${process.env.CORS_ORIGIN}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.CORS_ORIGIN}/checkout`,
      metadata: {
        store_id: store_id.toString(),
        customer_id: customer_id || '', // Add customer_id to metadata
        delivery_date: delivery_date || '',
        delivery_time_slot: delivery_time_slot || '',
        delivery_instructions: delivery_instructions || '',
        coupon_code: applied_coupon?.code || coupon_code || '',
        discount_amount: discount_amount?.toString() || '0',
        shipping_method_name: shipping_method?.name || selected_shipping_method || '',
        shipping_method_id: shipping_method?.id?.toString() || '',
        shipping_cost: shipping_cost?.toString() || '0',
        tax_amount: taxAmountNum.toString() || '0',
        payment_fee: paymentFeeNum.toString() || '0',
        payment_method: selected_payment_method || ''
      }
    };

    // Apply discount if provided
    if (applied_coupon && discount_amount > 0) {
      try {
        // Create a Stripe coupon for the discount
        const couponParams = {
          amount_off: convertToStripeAmount(discount_amount, storeCurrency), // Convert based on currency type
          currency: storeCurrency.toLowerCase(),
          duration: 'once',
          name: `Discount: ${applied_coupon.code}`,
          metadata: {
            original_coupon_code: applied_coupon.code,
            original_coupon_id: applied_coupon.id?.toString() || ''
          }
        };
        const stripeCoupon = stripeAccountId
          ? await stripe.coupons.create(couponParams, stripeOptions)
          : await stripe.coupons.create(couponParams);

        // Apply the coupon to the session so it's pre-applied
        sessionConfig.discounts = [{
          coupon: stripeCoupon.id
        }];
        
        // Note: Cannot use allow_promotion_codes when discounts are pre-applied

        console.log('Applied Stripe discount:', stripeCoupon.id, 'Amount:', discount_amount);
      } catch (discountError) {
        console.error('Failed to create Stripe coupon:', discountError.message);
        // Continue without discount rather than failing the entire checkout
      }
    } else {
      // If no discount is pre-applied, allow customers to enter promotion codes
      sessionConfig.allow_promotion_codes = true;
    }

    // 3. Set up shipping as the last charge item
    console.log('🚚 Shipping setup - method:', shipping_method?.name, 'cost:', shipping_cost);
    if (shipping_method && shipping_cost !== undefined) {
      // Create a shipping rate for the pre-selected method
      const shippingRateData = {
        type: 'fixed_amount',
        fixed_amount: {
          amount: convertToStripeAmount(shipping_cost || 0, storeCurrency), // Convert based on currency type
          currency: storeCurrency.toLowerCase(),
        },
        display_name: shipping_method.name || selected_shipping_method || 'Selected Shipping',
      };

      // Add delivery estimate if available
      if (shipping_method.estimated_delivery_days) {
        shippingRateData.delivery_estimate = {
          minimum: {
            unit: 'business_day',
            value: Math.max(1, shipping_method.estimated_delivery_days - 1),
          },
          maximum: {
            unit: 'business_day',
            value: shipping_method.estimated_delivery_days + 1,
          },
        };
      }

      // Create the shipping rate first
      try {
        const shippingRate = stripeAccountId
          ? await stripe.shippingRates.create(shippingRateData, stripeOptions)
          : await stripe.shippingRates.create(shippingRateData);
        
        // Use the created shipping rate in the session via shipping_options
        sessionConfig.shipping_options = [{
          shipping_rate: shippingRate.id
        }];
        
        console.log('Created and applied shipping rate:', shippingRate.id, 'for method:', shipping_method.name);
      } catch (shippingError) {
        console.error('Failed to create shipping rate:', shippingError.message);
        // Fallback to line item for shipping
        sessionConfig.line_items.push({
          price_data: {
            currency: storeCurrency.toLowerCase(),
            product_data: {
              name: `Shipping: ${shipping_method.name || selected_shipping_method}`,
              metadata: {
                item_type: 'shipping'
              }
            },
            unit_amount: convertToStripeAmount(shipping_cost || 0, storeCurrency),
          },
          quantity: 1,
        });
      }
    } else if (shipping_address && shipping_cost !== undefined) {
      // If we have shipping cost but no method, add as line item
      sessionConfig.line_items.push({
        price_data: {
          currency: storeCurrency.toLowerCase(),
          product_data: {
            name: 'Shipping',
            metadata: {
              item_type: 'shipping'
            }
          },
          unit_amount: convertToStripeAmount(shipping_cost || 0, storeCurrency),
        },
        quantity: 1,
      });
    }

    // Enable shipping address collection only if we don't have complete shipping data
    if (sessionConfig.shipping_options && (!shipping_address || !shipping_address.street || !shipping_address.city)) {
      // Only enable shipping address collection if we're missing shipping details
      sessionConfig.shipping_address_collection = {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'NL', 'DE', 'FR', 'ES', 'IT', 'BE', 'AT', 'CH']
      };
      console.log('🚚 Enabled shipping address collection - missing shipping details');
    } else if (shipping_address && shipping_address.street && shipping_address.city) {
      console.log('🚚 Complete shipping address provided - skipping address collection');
      // We have complete shipping address, so we'll use the customer with prefilled address
    }

    // Pre-fill customer details if we have shipping address
    let customerCreated = false;
    if (shipping_address && (shipping_address.full_name || shipping_address.street || shipping_address.address)) {
      // Handle different address formats
      const customerName = shipping_address.full_name || shipping_address.name || '';
      const line1 = shipping_address.street || shipping_address.address || shipping_address.address_line1 || '';
      const line2 = shipping_address.address_line2 || '';
      const city = shipping_address.city || '';
      const state = shipping_address.state || shipping_address.province || '';
      const postal_code = shipping_address.postal_code || shipping_address.zip || '';
      const country = shipping_address.country || 'US';
      
      // For now, just use customer_email instead of creating customer objects
      // This avoids customer ID conflicts between different Stripe accounts
      // Store owners can still see customer emails in their Stripe dashboard
      if (customer_email) {
        sessionConfig.customer_email = customer_email;
        console.log('📧 Using customer_email for checkout:', customer_email);
      }
    }
    
    // Log shipping address collection status
    console.log('🚚 Shipping address collection enabled:', !!sessionConfig.shipping_address_collection);

    // Log the session config for debugging
    console.log('Creating Stripe session with config:', {
      success_url: sessionConfig.success_url,
      cancel_url: sessionConfig.cancel_url,
      customer: sessionConfig.customer,
      customer_email: sessionConfig.customer_email,
      line_items_count: sessionConfig.line_items?.length || 0,
      shipping_options: sessionConfig.shipping_options?.length || 0,
      metadata: sessionConfig.metadata
    });
    
    // Log line items for debugging
    console.log('Line items:', sessionConfig.line_items?.map(item => ({
      name: item.price_data?.product_data?.name,
      amount: item.price_data?.unit_amount,
      quantity: item.quantity,
      type: item.price_data?.product_data?.metadata?.item_type
    })));
    
    // Specifically log tax and fee items
    const taxItems = sessionConfig.line_items?.filter(item => 
      item.price_data?.product_data?.metadata?.item_type === 'tax'
    );
    const feeItems = sessionConfig.line_items?.filter(item => 
      item.price_data?.product_data?.metadata?.item_type === 'payment_fee'
    );
    
    console.log('🔍 Tax line items:', taxItems.length, taxItems.length > 0 ? taxItems[0].price_data?.product_data?.name : 'None');
    console.log('🔍 Fee line items:', feeItems.length, feeItems.length > 0 ? feeItems[0].price_data?.product_data?.name : 'None');

    // Create checkout session - Stripe Connect required
    console.log('💰 Creating Stripe Checkout session...');

    // Enforce Stripe Connect - no platform account fallback
    if (!stripeAccountId) {
      console.error('❌ Store does not have a connected Stripe account:', store_id);
      return res.status(400).json({
        success: false,
        message: 'Stripe Connect not configured. Please connect your Stripe account in Payment Settings.'
      });
    }

    console.log('💰 Using connected account (Direct Charge):', stripeAccountId);

    const session = await stripe.checkout.sessions.create(sessionConfig, {
      stripeAccount: stripeAccountId
    });

    console.log('Created Stripe session:', {
      id: session.id,
      url: session.url,
      success_url: session.success_url
    });

    // Create preliminary order and OrderItems immediately for lazy loading
    console.log('💾 *** LAZY LOADING v7.0 *** Creating preliminary order for immediate availability...');
    console.log('💾 Session ID:', session.id);
    console.log('💾 Store ID:', store_id);
    console.log('💾 Customer Email:', customer_email);
    console.log('💾 Items count:', items?.length);
    try {
      await createPreliminaryOrder(session, {
        items,
        store_id,
        customer_email,
        customer_id, // Pass customer_id
        shipping_address,
        billing_address: shipping_address, // Use shipping as billing if not provided separately
        shipping_method,
        selected_shipping_method,
        shipping_cost,
        tax_amount,
        payment_fee,
        selected_payment_method,
        selected_payment_method_name,
        discount_amount,
        applied_coupon,
        delivery_date,
        delivery_time_slot,
        delivery_instructions,
        store
      });
      console.log('✅ Preliminary order created successfully for session:', session.id);
    } catch (preliminaryOrderError) {
      console.error('⚠️ Failed to create preliminary order for session:', session.id);
      console.error('⚠️ Error:', preliminaryOrderError.message);
      console.error('⚠️ Stack:', preliminaryOrderError.stack);
      // Don't fail the checkout if preliminary order fails - webhook will handle it
    }

    res.json({
      success: true,
      data: {
        session_id: session.id,
        checkout_url: session.url,
        public_key: process.env.STRIPE_PUBLISHABLE_KEY
      }
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
});

// @route   POST /api/payments/webhook
// @desc    Handle Stripe webhooks
// @access  Public
router.post('/webhook', async (req, res) => {
  const webhookId = Math.random().toString(36).substring(7);

  console.log('='.repeat(80));
  console.log('💥💥💥 STRIPE WEBHOOK HIT - THIS SHOULD BE VERY VISIBLE 💥💥💥');
  console.log(`🔔 [${webhookId}] WEBHOOK RECEIVED`);
  console.log(`🔔 [${webhookId}] Timestamp: ${new Date().toISOString()}`);
  console.log('💥💥💥 IF YOU SEE THIS, WEBHOOKS ARE WORKING 💥💥💥');
  console.log('='.repeat(80));

  console.log(`📋 [${webhookId}] Request details:`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  console.log(`📋 [${webhookId}] Headers:`, {
    allHeaders: Object.keys(req.headers),
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    hasStripeSignature: !!req.headers['stripe-signature']
  });

  console.log(`📋 [${webhookId}] Body info:`, {
    bodyType: typeof req.body,
    isBuffer: Buffer.isBuffer(req.body),
    isObject: typeof req.body === 'object' && !Buffer.isBuffer(req.body),
    bodyLength: req.body ? req.body.length : 'undefined',
    bodySample: req.body ? (Buffer.isBuffer(req.body) ? req.body.toString('utf8', 0, 100) : JSON.stringify(req.body).substring(0, 100)) : 'NONE'
  });

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error(`❌ [${webhookId}] No stripe-signature header found`);
    return res.status(400).send('No stripe-signature header');
  }

  console.log(`✅ [${webhookId}] Stripe signature header present:`, sig.substring(0, 50) + '...');

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error(`❌ [${webhookId}] STRIPE_WEBHOOK_SECRET not configured`);
    console.error(`❌ [${webhookId}] Available Stripe env vars:`, Object.keys(process.env).filter(k => k.includes('STRIPE')));
    return res.status(500).send('Webhook secret not configured');
  }

  console.log(`✅ [${webhookId}] Platform webhook secret configured:`, {
    prefix: process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10) + '...',
    length: process.env.STRIPE_WEBHOOK_SECRET.length
  });

  let event;

  try {
    console.log(`🔐 [${webhookId}] Verifying with PLATFORM secret...`);
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`✅ [${webhookId}] Webhook signature verified successfully!`);
    console.log(`✅ [${webhookId}] Event type: ${event.type}`);
    console.log(`✅ [${webhookId}] Event ID: ${event.id}`);
  } catch (err) {
    console.error('='.repeat(80));
    console.error(`❌ [${webhookId}] WEBHOOK SIGNATURE VERIFICATION FAILED`);
    console.error(`❌ [${webhookId}] Error message:`, err.message);
    console.error(`❌ [${webhookId}] Error type:`, err.type);
    console.error(`❌ [${webhookId}] Error code:`, err.code);
    console.error(`❌ [${webhookId}] Signature provided:`, sig.substring(0, 100) + '...');
    console.error(`❌ [${webhookId}] Body type:`, typeof req.body);
    console.error(`❌ [${webhookId}] Body is Buffer:`, Buffer.isBuffer(req.body));
    console.error(`❌ [${webhookId}] Body is Object:`, typeof req.body === 'object' && !Buffer.isBuffer(req.body));

    if (Buffer.isBuffer(req.body)) {
      console.error(`❌ [${webhookId}] Body length:`, req.body.length);
      console.error(`❌ [${webhookId}] Body sample (first 200 chars):`, req.body.toString('utf8', 0, 200));
    } else if (typeof req.body === 'object') {
      console.error(`❌ [${webhookId}] Body is already parsed as object (THIS IS THE PROBLEM!)`);
      console.error(`❌ [${webhookId}] Body keys:`, Object.keys(req.body));
      console.error(`❌ [${webhookId}] This means express.json() middleware ran before express.raw()`);
    } else {
      console.error(`❌ [${webhookId}] Body sample:`, String(req.body).substring(0, 200));
    }

    console.error('='.repeat(80));
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Processing webhook event:', event.type);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Processing checkout.session.completed for session:', session.id);
      console.log('Session metadata:', session.metadata);
      console.log('Session customer details:', session.customer_details);

      try {
        // Check if preliminary order already exists
        const store_id = session.metadata?.store_id;
        if (!store_id) {
          console.error('❌ No store_id in session metadata');
          return res.status(400).json({ error: 'Missing store_id in session metadata' });
        }

        // Get tenant DB connection for customer lookups
        const tenantDb = await ConnectionManager.getStoreConnection(store_id);

        const { data: existingOrder, error: orderError } = await tenantDb
          .from('sales_orders')
          .select('*')
          .eq('payment_reference', session.id)
          .maybeSingle();

        if (orderError) {
          console.error('Error finding existing order:', orderError);
        }

        let finalOrder = null;
        let statusAlreadyUpdated = false; // Track if email was already sent

        if (existingOrder) {
          console.log('✅ Found existing preliminary order:', existingOrder.id, existingOrder.order_number);
          console.log('🔍 Current order status:', existingOrder.status, 'payment_status:', existingOrder.payment_status);

          // Check if this is an online payment that needs to be updated to paid
          const isOnlinePayment = existingOrder.status === 'pending' && existingOrder.payment_status === 'pending';

          if (isOnlinePayment) {
            console.log('🔄 Online payment confirmed - updating order status to paid/processing...');
            // Update the existing preliminary order to mark as paid and processing
            await tenantDb
              .from('sales_orders')
              .update({
                status: 'processing',
                payment_status: 'paid',
                updated_at: new Date().toISOString()
              })
              .eq('id', existingOrder.id);
            statusAlreadyUpdated = false; // Send email since this is first confirmation

            // NOW check and deduct stock atomically since payment is confirmed
            console.log('📦 Payment confirmed - checking and reducing stock for order items...');
            const { data: orderItems } = await tenantDb
              .from('sales_order_items')
              .select('product_id, quantity')
              .eq('order_id', existingOrder.id);

            const stockResult = await checkAndDeductStock(tenantDb, orderItems || [], store_id);

            // Handle stock issues if any
            if (!stockResult.success && stockResult.insufficientItems.length > 0) {
              console.log('⚠️ Stock issue detected, handling...');
              await handleStockIssue({
                tenantDb,
                storeId: store_id,
                order: existingOrder,
                insufficientItems: stockResult.insufficientItems,
                paymentIntentId: session.payment_intent
              });
            }
          } else {
            console.log('✅ Order status already correct (offline payment or already updated)');
            statusAlreadyUpdated = true; // Don't send email again
          }

          // Verify order items exist
          const { count: itemCount, error: countError } = await tenantDb
            .from('sales_order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', existingOrder.id);
          console.log('✅ Verified:', itemCount, 'OrderItems already exist for order', existingOrder.id);

          if (itemCount === 0) {
            console.error('⚠️ WARNING: Preliminary order exists but no OrderItems found! Creating them now...');
            // Fallback: create order items from session if they don't exist
            await createOrderFromCheckoutSession(session);
          }

          finalOrder = existingOrder;
        } else {
          console.log('⚠️ No preliminary order found, creating new order from session...');
          // Fallback: create order from checkout session (original behavior)
          const order = await createOrderFromCheckoutSession(session);
          console.log('Order created successfully with ID:', order.id, 'Order Number:', order.order_number);

          // Verify order items were created
          const { count: itemCount } = await tenantDb
            .from('sales_order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id);
          console.log('✅ Verified:', itemCount, 'OrderItems created for order', order.id);

          if (itemCount === 0) {
            console.error('⚠️ WARNING: Order created but no OrderItems found!');
          }

          finalOrder = order;
        }

        // Send order success email
        // NOTE: Email is NOT sent during preliminary order creation, so we should send it here
        // The statusAlreadyUpdated flag is used to track if the order was already in processing/paid state
        // but we still need to send email if it hasn't been sent yet
        if (finalOrder && finalOrder.customer_email) {
          // Always send email - the email service will log it and we can check logs to prevent duplicates
          {
            console.log('📧 Sending order success email to:', finalOrder.customer_email);

            const emailService = require('../services/email-service');

            // Get order with full details for email - fetch related data separately
            const { data: orderWithDetails } = await tenantDb
              .from('sales_orders')
              .select('*')
              .eq('id', finalOrder.id)
              .single();

            // Fetch order items with products
            const { data: orderItems } = await tenantDb
              .from('sales_order_items')
              .select('*')
              .eq('order_id', finalOrder.id);

            // Fetch products for the items
            const productIds = orderItems?.map(item => item.product_id).filter(Boolean) || [];
            const { data: products } = productIds.length > 0 ? await tenantDb
              .from('products')
              .select('id, sku')
              .in('id', productIds) : { data: [] };

            const productMap = {};
            (products || []).forEach(p => { productMap[p.id] = p; });

            // Attach products to items
            orderWithDetails.OrderItems = (orderItems || []).map(item => ({
              ...item,
              Product: productMap[item.product_id] || null
            }));

            // Fetch store from tenant DB (has name, slug, currency, settings)
            const { data: storeData, error: storeError } = await tenantDb
              .from('stores')
              .select('id, name, slug, currency, settings')
              .eq('id', store_id)
              .maybeSingle();

            console.log('🔍 Store fetch - store_id:', store_id);
            console.log('🔍 Store fetch - storeData:', storeData ? 'found' : 'NOT FOUND');
            if (storeError) console.log('🔍 Store fetch - error:', storeError.message);

            orderWithDetails.Store = storeData;

            // Try to get customer details
            let customer = null;
            if (finalOrder.customer_id) {
              const { data } = await tenantDb
                .from('customers')
                .select('*')
                .eq('id', finalOrder.customer_id)
                .eq('store_id', store_id)
                .maybeSingle();
              customer = data;
            }

            // Extract customer name from shipping/billing address if customer not found
            const customerName = customer
              ? `${customer.first_name} ${customer.last_name}`
              : (finalOrder.shipping_address?.full_name || finalOrder.shipping_address?.name || finalOrder.billing_address?.full_name || finalOrder.billing_address?.name || 'Customer');

            const [firstName, ...lastNameParts] = customerName.split(' ');
            const lastName = lastNameParts.join(' ') || '';

            // Send order success email asynchronously
            emailService.sendTransactionalEmail(finalOrder.store_id, 'order_success_email', {
              recipientEmail: finalOrder.customer_email,
              customer: customer || {
                first_name: firstName,
                last_name: lastName,
                email: finalOrder.customer_email
              },
              order: orderWithDetails,
              store: orderWithDetails.Store,
              languageCode: 'en'
            }).then(async () => {
              console.log('🎉 ========================================');
              console.log('🎉 ORDER SUCCESS EMAIL CALLBACK EXECUTING');
              console.log(`🎉 Order success email sent successfully to: ${finalOrder.customer_email}`);
              console.log('🎉 ========================================');

              // Check if auto-invoice is enabled in sales settings
              const store = orderWithDetails.Store;
              if (!store) {
                console.log('⚠️ Store not found in orderWithDetails, skipping auto-invoice check');
                return;
              }
              const salesSettings = store.settings?.sales_settings || {};

              console.log('🔍 ========================================');
              console.log('🔍 DEBUG: Checking auto-invoice settings...');
              console.log('🔍 DEBUG: Store ID:', store.id);
              console.log('🔍 DEBUG: Store name:', store.name);
              console.log('🔍 DEBUG: Store settings:', JSON.stringify(store.settings, null, 2));
              console.log('🔍 DEBUG: Sales settings:', JSON.stringify(salesSettings, null, 2));
              console.log('🔍 DEBUG: auto_invoice_enabled:', salesSettings.auto_invoice_enabled);
              console.log('🔍 ========================================');

              if (salesSettings.auto_invoice_enabled) {
                console.log('📧 ========================================');
                console.log('📧 AUTO-INVOICE ENABLED - Starting invoice send process...');
                console.log('📧 ========================================');

                try {
                  // Generate invoice number and date BEFORE sending email
                  const invoiceNumber = 'INV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                  const invoiceDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                  console.log('📋 Generated invoice details:', { invoiceNumber, invoiceDate });

                  // Check if PDF attachment should be included
                  let attachments = [];
                  if (salesSettings.auto_invoice_pdf_enabled) {
                    try {
                      console.log('📄 Generating PDF invoice...');
                      const pdfService = require('../services/pdf-service');

                      // Generate invoice PDF
                      const invoicePdf = await pdfService.generateInvoicePDF(
                        orderWithDetails,
                        orderWithDetails.Store,
                        orderWithDetails.OrderItems
                      );

                      attachments = [{
                        filename: pdfService.getInvoiceFilename(orderWithDetails),
                        content: invoicePdf.toString('base64'),
                        contentType: 'application/pdf'
                      }];

                      console.log('✅ PDF invoice generated successfully');
                    } catch (pdfError) {
                      console.error('⚠️ PDF generation failed, sending invoice email without PDF:', pdfError.message);
                      // Continue without PDF attachment - email is more important
                    }
                  } else {
                    console.log('ℹ️ PDF generation skipped (auto_invoice_pdf_enabled = false)');
                  }

                  console.log('📧 Preparing to send invoice email...');
                  console.log('📧 Recipient:', finalOrder.customer_email);
                  console.log('📧 Store ID:', finalOrder.store_id);
                  console.log('📧 Order ID:', finalOrder.id);

                  // Send invoice email
                  const invoiceResult = await emailService.sendTransactionalEmail(finalOrder.store_id, 'invoice_email', {
                    recipientEmail: finalOrder.customer_email,
                    customer: customer || {
                      first_name: firstName,
                      last_name: lastName,
                      email: finalOrder.customer_email
                    },
                    order: orderWithDetails,
                    store: orderWithDetails.Store,
                    attachments: attachments,
                    invoice_number: invoiceNumber,
                    invoice_date: invoiceDate
                  });

                  console.log('✅ ========================================');
                  console.log('✅ INVOICE EMAIL SENT SUCCESSFULLY!');
                  console.log('✅ Result:', JSON.stringify(invoiceResult, null, 2));
                  console.log('✅ ========================================');

                  // Create invoice record to track that invoice was sent
                  try {
                    const tenantDb = await ConnectionManager.getStoreConnection(finalOrder.store_id);
                    const { data: invoice, error } = await tenantDb
                      .from('invoices')
                      .insert({
                        id: uuidv4(),
                        invoice_number: invoiceNumber,
                        order_id: finalOrder.id,
                        store_id: finalOrder.store_id,
                        customer_email: finalOrder.customer_email,
                        pdf_generated: salesSettings.auto_invoice_pdf_enabled || false,
                        email_status: 'sent',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                      })
                      .select()
                      .single();

                    if (error) throw error;
                    console.log('✅ Invoice record created:', invoiceNumber);
                  } catch (invoiceCreateError) {
                    console.error('❌ Failed to create invoice record:', invoiceCreateError);
                    // Don't fail if invoice record creation fails
                  }

                  // Check if auto-ship is enabled and trigger shipment
                  if (salesSettings.auto_ship_enabled) {
                    console.log('📦 Auto-ship enabled, sending shipment notification...');
                    try {
                      // Generate shipment PDF if enabled
                      let shipmentAttachments = [];
                      if (salesSettings.auto_shipment_pdf_enabled) {
                        try {
                          console.log('📄 Generating PDF shipment notice...');
                          const pdfService = require('../services/pdf-service');

                          const shipmentPdf = await pdfService.generateShipmentPDF(
                            orderWithDetails,
                            orderWithDetails.Store,
                            orderWithDetails.OrderItems
                          );

                          shipmentAttachments = [{
                            filename: pdfService.getShipmentFilename(orderWithDetails),
                            content: shipmentPdf.toString('base64'),
                            contentType: 'application/pdf'
                          }];

                          console.log('✅ PDF shipment notice generated successfully');
                        } catch (pdfError) {
                          console.error('⚠️ Shipment PDF generation failed, sending email without PDF:', pdfError.message);
                          // Continue without PDF attachment
                        }
                      }

                      // Send shipment notification email
                      await emailService.sendTransactionalEmail(finalOrder.store_id, 'shipment_email', {
                        recipientEmail: finalOrder.customer_email,
                        customer: customer || {
                          first_name: firstName,
                          last_name: lastName,
                          email: finalOrder.customer_email
                        },
                        order: orderWithDetails,
                        store: orderWithDetails.Store,
                        tracking_number: finalOrder.tracking_number || 'Will be provided soon',
                        tracking_url: finalOrder.tracking_url || '',
                        carrier: 'Standard',
                        shipping_method: finalOrder.shipping_method || 'Standard Shipping',
                        estimated_delivery_date: 'To be confirmed',
                        attachments: shipmentAttachments
                      });

                      console.log('✅ Shipment email sent successfully');

                      // Create shipment record
                      const shipmentNumber = 'SHIP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();

                      const tenantDb = await ConnectionManager.getStoreConnection(finalOrder.store_id);
                      const { data: shipment, error: shipmentError } = await tenantDb
                        .from('shipments')
                        .insert({
                          id: uuidv4(),
                          shipment_number: shipmentNumber,
                          order_id: finalOrder.id,
                          store_id: finalOrder.store_id,
                          customer_email: finalOrder.customer_email,
                          tracking_number: finalOrder.tracking_number,
                          tracking_url: finalOrder.tracking_url,
                          carrier: 'Standard',
                          shipping_method: finalOrder.shipping_method,
                          email_status: 'sent',
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString()
                        })
                        .select()
                        .single();

                      if (shipmentError) throw shipmentError;

                      // Update order status to shipped
                      await orderWithDetails.update({
                        status: 'shipped',
                        fulfillment_status: 'shipped',
                        shipped_at: new Date()
                      });

                      console.log('✅ Shipment record created and order marked as shipped');
                    } catch (shipmentError) {
                      console.error('❌ Failed to send shipment notification:', shipmentError);
                      // Don't fail if shipment notification fails
                    }
                  }
                } catch (invoiceError) {
                  console.error('❌ ========================================');
                  console.error('❌ FAILED TO SEND INVOICE EMAIL!');
                  console.error('❌ Error:', invoiceError);
                  console.error('❌ Error message:', invoiceError.message);
                  console.error('❌ Error stack:', invoiceError.stack);
                  console.error('❌ ========================================');
                  // Don't fail the webhook if invoice email fails
                }
              } else {
                console.log('⚠️ ========================================');
                console.log('⚠️ AUTO-INVOICE IS DISABLED');
                console.log('⚠️ Invoice email will NOT be sent automatically');
                console.log('⚠️ ========================================');
              }
            }).catch(emailError => {
              console.error('❌ ========================================');
              console.error('❌ FAILED TO SEND ORDER SUCCESS EMAIL!');
              console.error('❌ This means the .then() callback never ran');
              console.error('❌ Error:', emailError.message);
              console.error('❌ Error stack:', emailError.stack);
              console.error('❌ ========================================');
              // Don't fail the webhook if email fails
            });
          }
        }

        if (!finalOrder || !finalOrder.customer_email) {
          console.log('⚠️ Skipping order success email - no customer email found');
        }

      } catch (error) {
        console.error('Error processing order from checkout session:', error);
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          code: error.code,
          sql: error.sql
        });
        return res.status(500).json({ error: 'Failed to process order' });
      }
      
      break;
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const piRequestId = Math.random().toString(36).substring(7);

      console.log('='.repeat(80));
      console.log(`💳 [${piRequestId}] PAYMENT INTENT SUCCEEDED`);
      console.log(`💳 [${piRequestId}] Payment Intent ID: ${paymentIntent.id}`);
      console.log(`💳 [${piRequestId}] Amount: ${paymentIntent.amount / 100} ${paymentIntent.currency.toUpperCase()}`);
      console.log(`💳 [${piRequestId}] Status: ${paymentIntent.status}`);
      console.log('='.repeat(80));

      console.log(`🔍 [${piRequestId}] Payment Intent Metadata:`, {
        metadata: paymentIntent.metadata,
        hasType: !!paymentIntent.metadata?.type,
        type: paymentIntent.metadata?.type,
        hasTransactionId: !!paymentIntent.metadata?.transaction_id,
        transactionId: paymentIntent.metadata?.transaction_id,
        userId: paymentIntent.metadata?.user_id,
        creditsAmount: paymentIntent.metadata?.credits_amount
      });

      // Check if this is a credit purchase
      if (paymentIntent.metadata?.type === 'credit_purchase' && paymentIntent.metadata?.transaction_id) {
        console.log(`✅ [${piRequestId}] This is a CREDIT PURCHASE - processing...`);
        console.log(`📋 [${piRequestId}] Transaction ID: ${paymentIntent.metadata.transaction_id}`);
        console.log(`👤 [${piRequestId}] User ID: ${paymentIntent.metadata.user_id}`);
        console.log(`💰 [${piRequestId}] Credits: ${paymentIntent.metadata.credits_amount}`);

        try {
          console.log(`🔄 [${piRequestId}] Calling creditService.completePurchaseTransaction...`);

          const creditService = require('../services/credit-service');
          const result = await creditService.completePurchaseTransaction(
            paymentIntent.metadata.transaction_id,
            paymentIntent.id
          );

          console.log(`✅ [${piRequestId}] Credit purchase COMPLETED successfully!`);
          console.log(`✅ [${piRequestId}] Transaction result:`, {
            id: result.id,
            status: result.status,
            credits_purchased: result.credits_purchased,
            user_id: result.user_id
          });

          // Verify user credits were updated
          let finalUserBalance = null;
          try {
            const masterConnection = require('../database/masterConnection');
            const { masterDbClient } = masterConnection;
            const { data: users, error } = await masterDbClient
              .from('users')
              .select('id, email, credits')
              .eq('id', paymentIntent.metadata.user_id)
              .limit(1);

            if (error) throw error;

            const user = users?.[0];
            finalUserBalance = user?.credits;

            console.log(`✅ [${piRequestId}] User balance after purchase:`, {
              userId: user?.id,
              email: user?.email,
              credits: user?.credits
            });
          } catch (verifyError) {
            console.warn(`⚠️ [${piRequestId}] Could not verify user balance:`, verifyError.message);
          }

          // Send credit purchase confirmation email using master email service
          try {
            console.log(`📧 [${piRequestId}] Sending credit purchase confirmation email...`);

            const masterEmailService = require('../services/master-email-service');

            const user = await getMasterUser(result.user_id);

            if (user) {
              console.log(`📧 [${piRequestId}] Email recipient:`, {
                userEmail: user.email,
                userName: user.first_name
              });

              const creditsAmount = result.credits_amount || paymentIntent.metadata?.credits_amount || 0;
              const amountUsd = result.amount_usd || (paymentIntent.amount / 100) || 0;
              const newBalance = finalUserBalance || user.credits || 0;

              // Use master email service with uniform template
              masterEmailService.sendCreditsPurchaseEmail({
                recipientEmail: user.email,
                customerName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Valued Customer',
                customerFirstName: user.first_name || 'there',
                creditsPurchased: creditsAmount,
                amountPaid: parseFloat(amountUsd),
                currency: 'USD',
                transactionId: result.id,
                currentBalance: parseFloat(newBalance),
                paymentMethod: 'Credit Card'
              }).then(emailResult => {
                if (emailResult.success) {
                  console.log(`✅ [${piRequestId}] Credit purchase email sent successfully to: ${user.email}`);
                } else {
                  console.warn(`⚠️ [${piRequestId}] Credit purchase email not sent: ${emailResult.message}`);
                }
              }).catch(emailError => {
                console.error(`❌ [${piRequestId}] Failed to send credit purchase email:`, emailError.message);
                // Don't fail the webhook if email fails
              });
            } else {
              console.warn(`⚠️ [${piRequestId}] Cannot send email - user not found for ID: ${result.user_id}`);
            }
          } catch (emailError) {
            console.error(`❌ [${piRequestId}] Error preparing credit purchase email:`, emailError.message);
            // Don't fail the webhook if email fails
          }

          console.log('='.repeat(80));
        } catch (error) {
          console.error('='.repeat(80));
          console.error(`❌ [${piRequestId}] FAILED to complete credit purchase`);
          console.error(`❌ [${piRequestId}] Error:`, {
            message: error.message,
            stack: error.stack,
            transactionId: paymentIntent.metadata.transaction_id
          });
          console.error('='.repeat(80));
          return res.status(500).json({ error: 'Failed to complete credit purchase' });
        }
      } else {
        // Not a credit purchase - check if this is an order payment
        console.log(`ℹ️ [${piRequestId}] Not a credit purchase - checking if this is an order payment...`);

        try {
          // Find the checkout session associated with this payment intent
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntent.id,
            limit: 1
          });

          if (sessions.data.length > 0) {
            const checkoutSession = sessions.data[0];
            console.log(`✅ [${piRequestId}] Found checkout session: ${checkoutSession.id}`);
            console.log(`✅ [${piRequestId}] Session metadata:`, checkoutSession.metadata);

            const store_id = checkoutSession.metadata?.store_id;
            if (store_id) {
              console.log(`📦 [${piRequestId}] This is a store order - store_id: ${store_id}`);

              // Get tenant connection
              const tenantDb = await ConnectionManager.getStoreConnection(store_id);

              // Find order by payment_reference (checkout session ID)
              const { data: order } = await tenantDb
                .from('sales_orders')
                .select('*')
                .eq('payment_reference', checkoutSession.id)
                .maybeSingle();

              if (order) {
                console.log(`✅ [${piRequestId}] Found order: ${order.id} (${order.order_number})`);
                console.log(`📋 [${piRequestId}] Order status: ${order.status}, payment_status: ${order.payment_status}`);

                // Update order status if needed (for online payments)
                if (order.status === 'pending' && order.payment_status === 'pending') {
                  console.log(`🔄 [${piRequestId}] Updating order to processing/paid...`);
                  await tenantDb
                    .from('sales_orders')
                    .update({
                      status: 'processing',
                      payment_status: 'paid',
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id);
                }

                // Check if email was already sent FOR THIS SPECIFIC ORDER
                let emailAlreadySent = false;
                try {
                  const { data: emailLogs } = await tenantDb
                    .from('email_send_logs')
                    .select('id, metadata')
                    .eq('recipient_email', order.customer_email)
                    .eq('status', 'sent')
                    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

                  console.log(`🔍 [${piRequestId}] Email logs found: ${emailLogs?.length || 0}`);
                  console.log(`🔍 [${piRequestId}] Looking for order_id: ${order.id}`);

                  // Check if any email was sent for THIS specific order (not just same recipient)
                  // Note: orderId is stored in metadata.variables.orderId
                  emailAlreadySent = emailLogs?.some(log =>
                    log.metadata?.templateIdentifier === 'order_success_email' &&
                    (log.metadata?.orderId === order.id || log.metadata?.variables?.orderId === order.id)
                  ) || false;

                  console.log(`🔍 [${piRequestId}] Email already sent for this order: ${emailAlreadySent}`);
                } catch (e) {
                  console.log(`⚠️ [${piRequestId}] Could not check email logs:`, e.message);
                }

                console.log(`🔍 [${piRequestId}] Customer email: "${order.customer_email}"`);
                console.log(`🔍 [${piRequestId}] Will send email: ${!emailAlreadySent && !!order.customer_email}`);

                if (!emailAlreadySent && order.customer_email) {
                  console.log(`📧 [${piRequestId}] Sending order confirmation email to: ${order.customer_email}`);

                  const emailService = require('../services/email-service');

                  // Get order items
                  const { data: orderItems } = await tenantDb
                    .from('sales_order_items')
                    .select('*')
                    .eq('order_id', order.id);

                  // Get store info from tenant DB
                  const { data: storeData } = await tenantDb
                    .from('stores')
                    .select('id, name, slug, currency, settings')
                    .eq('id', store_id)
                    .maybeSingle();

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
                    : (order.shipping_address?.full_name || 'Customer');
                  const [firstName, ...lastNameParts] = customerName.split(' ');
                  const lastName = lastNameParts.join(' ') || '';

                  const orderWithDetails = {
                    ...order,
                    OrderItems: orderItems || [],
                    Store: storeData
                  };

                  emailService.sendTransactionalEmail(store_id, 'order_success_email', {
                    recipientEmail: order.customer_email,
                    customer: customer || {
                      first_name: firstName,
                      last_name: lastName,
                      email: order.customer_email
                    },
                    order: orderWithDetails,
                    store: storeData,
                    languageCode: 'en',
                    orderId: order.id  // Include orderId for duplicate detection
                  }).then(() => {
                    console.log(`✅ [${piRequestId}] Order confirmation email sent!`);
                  }).catch(emailError => {
                    console.error(`❌ [${piRequestId}] Failed to send order email:`, emailError.message);
                  });
                } else {
                  console.log(`ℹ️ [${piRequestId}] Order email already sent or no customer email`);
                }
              } else {
                console.log(`⚠️ [${piRequestId}] No order found for session: ${checkoutSession.id}`);
              }
            } else {
              console.log(`ℹ️ [${piRequestId}] No store_id in session metadata - not a store order`);
            }
          } else {
            console.log(`ℹ️ [${piRequestId}] No checkout session found for this payment intent`);
          }
        } catch (orderError) {
          console.error(`⚠️ [${piRequestId}] Error processing order payment:`, orderError.message);
          // Don't fail the webhook
        }

        console.log('='.repeat(80));
      }
      break;
    case 'payment_intent.created':
      console.log('Payment intent created, no action needed');
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

// @route   POST /api/payments/webhook-connect
// @desc    Handle Stripe webhooks from CONNECTED ACCOUNTS (tenant stores)
// @access  Public
router.post('/webhook-connect', async (req, res) => {
  const webhookId = Math.random().toString(36).substring(7);

  console.log('='.repeat(80));
  console.log('🏪🏪🏪 CONNECTED ACCOUNT WEBHOOK HIT 🏪🏪🏪');
  console.log(`🔔 [${webhookId}] CONNECTED WEBHOOK RECEIVED`);
  console.log(`🔔 [${webhookId}] Timestamp: ${new Date().toISOString()}`);
  console.log('🏪 This webhook handles STORE ORDERS (tenant events)');
  console.log('='.repeat(80));

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    console.error(`❌ [${webhookId}] No stripe-signature header found`);
    return res.status(400).send('No stripe-signature header');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET_CONNECT) {
    console.error(`❌ [${webhookId}] STRIPE_WEBHOOK_SECRET_CONNECT not configured`);
    return res.status(500).send('Connected webhook secret not configured');
  }

  let event;

  try {
    console.log(`🔐 [${webhookId}] Verifying with CONNECTED ACCOUNT secret...`);
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET_CONNECT);
    console.log(`✅ [${webhookId}] Webhook signature verified successfully!`);
    console.log(`✅ [${webhookId}] Event type: ${event.type}`);
    console.log(`✅ [${webhookId}] Event ID: ${event.id}`);
    console.log(`✅ [${webhookId}] Account: ${event.account || 'platform'}`);
  } catch (err) {
    console.error('='.repeat(80));
    console.error(`❌ [${webhookId}] WEBHOOK SIGNATURE VERIFICATION FAILED`);
    console.error(`❌ [${webhookId}] Error:`, err.message);
    console.error('='.repeat(80));
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('🏪 Processing CONNECTED ACCOUNT event:', event.type);

  // Handle connected account events
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('🏪 Processing store checkout.session.completed for session:', session.id);
      console.log('🏪 Session metadata:', session.metadata);
      console.log('🏪 Session customer details:', session.customer_details);

      try {
        // Check if preliminary order already exists
        const store_id = session.metadata?.store_id;
        if (!store_id) {
          console.error('❌ No store_id in session metadata');
          return res.status(400).json({ error: 'Missing store_id in session metadata' });
        }

        // Get tenant DB connection for customer lookups
        const tenantDb = await ConnectionManager.getStoreConnection(store_id);

        const { data: existingOrder, error: orderError } = await tenantDb
          .from('sales_orders')
          .select('*')
          .eq('payment_reference', session.id)
          .maybeSingle();

        if (orderError) {
          console.error('Error finding existing order:', orderError);
        }

        let finalOrder = null;
        let statusAlreadyUpdated = false;

        if (existingOrder) {
          console.log('✅ Found existing preliminary order:', existingOrder.id, existingOrder.order_number);
          console.log('🔍 Order current status:', {
            status: existingOrder.status,
            payment_status: existingOrder.payment_status
          });

          const isOnlinePayment = existingOrder.status === 'pending' && existingOrder.payment_status === 'pending';
          console.log('🔍 Is this an online payment needing confirmation?', isOnlinePayment);

          if (isOnlinePayment) {
            console.log('🔄 Online payment confirmed - updating order status to paid/processing...');
            await tenantDb
              .from('sales_orders')
              .update({
                status: 'processing',
                payment_status: 'paid',
                updated_at: new Date().toISOString()
              })
              .eq('id', existingOrder.id);
            statusAlreadyUpdated = false; // Send emails
            console.log('📧 Will SEND emails (order was pending, now confirmed)');
          } else {
            statusAlreadyUpdated = true; // Skip emails
            console.log('⚠️ Will SKIP emails - order already processed');
            console.log('⚠️ Status:', existingOrder.status, '| Payment status:', existingOrder.payment_status);
          }

          finalOrder = existingOrder;
        } else {
          console.log('⚠️ No preliminary order found, creating new order...');
          const order = await createOrderFromCheckoutSession(session);
          finalOrder = order;
        }

        // Send order success email + auto-invoice
        // ALWAYS send emails for connected account webhooks (this is the authoritative confirmation from Stripe)
        if (finalOrder && finalOrder.customer_email) {
          console.log('📧 Sending order success email to:', finalOrder.customer_email);
          console.log('📧 NOTE: Sending from webhook (authoritative Stripe confirmation)');

          const emailService = require('../services/email-service');

          // Get order with full details using Supabase
          const { data: orderWithDetails } = await tenantDb
            .from('sales_orders')
            .select('*')
            .eq('id', finalOrder.id)
            .single();

          // Fetch order items
          const { data: orderItems } = await tenantDb
            .from('sales_order_items')
            .select('*')
            .eq('order_id', finalOrder.id);

          // Fetch products for the items
          const productIds = orderItems?.map(item => item.product_id).filter(Boolean) || [];
          const { data: products } = productIds.length > 0 ? await tenantDb
            .from('products')
            .select('id, sku')
            .in('id', productIds) : { data: [] };

          const productMap = {};
          (products || []).forEach(p => { productMap[p.id] = p; });

          // Attach products to items
          orderWithDetails.OrderItems = (orderItems || []).map(item => ({
            ...item,
            Product: productMap[item.product_id] || null
          }));

          // Fetch store from tenant DB (has name, slug, currency, settings)
          const { data: storeData, error: storeError } = await tenantDb
            .from('stores')
            .select('id, name, slug, currency, settings')
            .eq('id', store_id)
            .maybeSingle();

          console.log('🔍 Store fetch (path 2) - store_id:', store_id);
          console.log('🔍 Store fetch (path 2) - storeData:', storeData ? 'found' : 'NOT FOUND');
          if (storeError) console.log('🔍 Store fetch (path 2) - error:', storeError.message);

          orderWithDetails.Store = storeData;

          let customer = null;
          if (finalOrder.customer_id) {
            const { data } = await tenantDb
              .from('customers')
              .select('*')
              .eq('id', finalOrder.customer_id)
              .eq('store_id', store_id)
              .maybeSingle();
            customer = data;
          }

          const customerName = customer
            ? `${customer.first_name} ${customer.last_name}`
            : (finalOrder.shipping_address?.full_name || 'Customer');

          const [firstName, ...lastNameParts] = customerName.split(' ');
          const lastName = lastNameParts.join(' ') || '';

          // Send order success email
          emailService.sendTransactionalEmail(finalOrder.store_id, 'order_success_email', {
            recipientEmail: finalOrder.customer_email,
            customer: customer || {
              first_name: firstName,
              last_name: lastName,
              email: finalOrder.customer_email
            },
            order: orderWithDetails,
            store: orderWithDetails.Store,
            languageCode: 'en'
          }).then(async () => {
            console.log(`🎉 Order success email sent to: ${finalOrder.customer_email}`);

            // Check auto-invoice settings
            const store = orderWithDetails.Store;
            if (!store) {
              console.log('⚠️ Store not found in orderWithDetails, skipping auto-invoice check');
              return;
            }
            const salesSettings = store.settings?.sales_settings || {};

            console.log('🔍 Checking auto-invoice settings:', {
              storeId: store.id,
              auto_invoice_enabled: salesSettings.auto_invoice_enabled
            });

            if (salesSettings.auto_invoice_enabled) {
              console.log('📧 AUTO-INVOICE ENABLED - Sending invoice email now!');

              try {
                // Generate invoice number and date BEFORE sending email
                const invoiceNumber = 'INV-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                const invoiceDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                console.log('📋 Generated invoice details:', { invoiceNumber, invoiceDate });

                let attachments = [];
                if (salesSettings.auto_invoice_pdf_enabled) {
                  try {
                    console.log('📄 Generating PDF invoice...');
                    const pdfService = require('../services/pdf-service');
                    const invoicePdf = await pdfService.generateInvoicePDF(
                      orderWithDetails,
                      orderWithDetails.Store,
                      orderWithDetails.OrderItems
                    );

                    attachments = [{
                      filename: pdfService.getInvoiceFilename(orderWithDetails),
                      content: invoicePdf.toString('base64'),
                      contentType: 'application/pdf'
                    }];
                    console.log('✅ PDF invoice generated successfully');
                  } catch (pdfError) {
                    console.error('⚠️ PDF generation failed, sending invoice email without PDF:', pdfError.message);
                    // Continue without PDF attachment - email is more important
                  }
                }

                await emailService.sendTransactionalEmail(finalOrder.store_id, 'invoice_email', {
                  recipientEmail: finalOrder.customer_email,
                  customer: customer || {
                    first_name: firstName,
                    last_name: lastName,
                    email: finalOrder.customer_email
                  },
                  order: orderWithDetails,
                  store: orderWithDetails.Store,
                  attachments: attachments,
                  invoice_number: invoiceNumber,
                  invoice_date: invoiceDate
                });

                console.log('✅ INVOICE EMAIL SENT SUCCESSFULLY!');

                // Create invoice record to track that invoice was sent
                try {
                  const tenantDbInvoice = await ConnectionManager.getStoreConnection(finalOrder.store_id);
                  const { data: invoice, error } = await tenantDbInvoice
                    .from('invoices')
                    .insert({
                      id: uuidv4(),
                      invoice_number: invoiceNumber,
                      order_id: finalOrder.id,
                      store_id: finalOrder.store_id,
                      customer_email: finalOrder.customer_email,
                      pdf_generated: salesSettings.auto_invoice_pdf_enabled || false,
                      email_status: 'sent',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                  if (error) throw error;
                  console.log('✅ Invoice record created:', invoiceNumber);
                } catch (invoiceCreateError) {
                  console.error('❌ Failed to create invoice record:', invoiceCreateError);
                  // Don't fail if invoice record creation fails
                }
              } catch (invoiceError) {
                console.error('❌ Failed to send invoice email:', invoiceError);
              }
            } else {
              console.log('⚠️ Auto-invoice is DISABLED');
            }
          }).catch(emailError => {
            console.error(`❌ Failed to send order success email:`, emailError.message);
          });
        }
      } catch (error) {
        console.error('❌ Error processing store order:', error);
        return res.status(500).json({ error: 'Failed to process order' });
      }
      break;

    default:
      console.log(`Unhandled connected account event type ${event.type}`);
  }

  res.json({ received: true, source: 'connected-account' });
});

// Debug endpoint to check OrderItems for a specific order
router.get('/debug/order-items/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log('🔍 Debug: Checking OrderItems for order:', orderId);
    
    // Count OrderItems
    const itemCount = await OrderItem.count({ where: { order_id: orderId } });
    console.log('📊 OrderItems count in database:', itemCount);
    
    // Get actual OrderItems with raw data
    const items = await OrderItem.findAll({ 
      where: { order_id: orderId },
      raw: true 
    });
    console.log('📋 OrderItems raw data:', items);
    
    // Check the actual order_id values
    if (items.length > 0) {
      console.log('🔍 First OrderItem order_id:', items[0].order_id);
      console.log('🔍 Looking for order_id:', orderId);
      console.log('🔍 IDs match:', items[0].order_id === orderId);
    }
    
    // Get Order with includes - try different approaches
    const order1 = await Order.findByPk(orderId, {
      include: [OrderItem]
    });
    
    const order2 = await Order.findOne({
      where: { id: orderId },
      include: [OrderItem]
    });
    
    // Check if associations are loaded properly
    const associationsLoaded = Order.associations;
    console.log('🔍 Order associations:', Object.keys(associationsLoaded));
    console.log('🔍 OrderItem association exists:', !!associationsLoaded.OrderItems);
    
    res.json({
      success: true,
      order_exists: !!order1,
      order_items_count: itemCount,
      order_items_via_findByPk: order1?.OrderItems?.length || 0,
      order_items_via_findOne: order2?.OrderItems?.length || 0,
      associations_available: Object.keys(associationsLoaded),
      has_orderitems_association: !!associationsLoaded.OrderItems,
      direct_items: items,
      first_item_order_id: items[0]?.order_id,
      looking_for_order_id: orderId,
      ids_match: items[0]?.order_id === orderId
    });
    
  } catch (error) {
    console.error('Debug OrderItems error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Debug endpoint to manually process a specific session
router.post('/debug-session', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }
    
    console.log('🔍 Debug: Manually processing session:', session_id);
    
    // Get the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log('🔍 Debug: Retrieved session:', JSON.stringify(session, null, 2));
    
    // Process it like a webhook
    const order = await createOrderFromCheckoutSession(session);
    console.log('🔍 Debug: Order created:', order.id);
    
    // Count items
    const itemCount = await OrderItem.count({ where: { order_id: order.id } });
    console.log('🔍 Debug: OrderItems created:', itemCount);
    
    res.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      items_created: itemCount
    });
    
  } catch (error) {
    console.error('Debug session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to create preliminary order immediately after checkout session creation
async function createPreliminaryOrder(session, orderData) {
  const {
    items,
    store_id,
    customer_email,
    customer_id,
    shipping_address,
    billing_address,
    shipping_method,
    selected_shipping_method,
    shipping_cost,
    tax_amount,
    payment_fee,
    selected_payment_method,
    selected_payment_method_name,
    discount_amount,
    applied_coupon,
    delivery_date,
    delivery_time_slot,
    delivery_instructions,
    store
  } = orderData;

  console.log('💾 Creating preliminary order with session ID:', session.id);
  console.log('🔍 Received customer_id:', customer_id);
  console.log('🔍 Received shipping_address:', JSON.stringify(shipping_address, null, 2));
  console.log('🔍 Received billing_address:', JSON.stringify(billing_address, null, 2));

  // Get tenant DB connection early - used for all lookups
  const tenantDb = await ConnectionManager.getStoreConnection(store_id);

  // Lookup payment method to check payment_flow (online vs offline)
  let paymentFlow = 'online'; // default to online for Stripe
  let paymentMethodRecord = null;
  if (selected_payment_method) {
    try {
      const { data: pmRecord } = await tenantDb
        .from('payment_methods')
        .select('*')
        .eq('code', selected_payment_method)
        .eq('store_id', store_id)
        .maybeSingle();

      if (pmRecord) {
        paymentMethodRecord = pmRecord;
        paymentFlow = pmRecord.payment_flow || 'online';
        console.log(`🔍 Payment method "${selected_payment_method}" has flow: ${paymentFlow}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not lookup payment method, defaulting to online flow:', error.message);
    }
  } else {
    console.log('🔍 No payment method specified, defaulting to online flow for Stripe');
  }

  // Validate customer_id BEFORE starting transaction - ensure it exists AND matches the email
  let validatedCustomerId = null;
  if (customer_id) {
    try {
      console.log('🔍 Looking up customer_id in database:', customer_id);
      console.log('🔍 Order email:', customer_email);
      const { data: customerExists } = await tenantDb
        .from('customers')
        .select('*')
        .eq('id', customer_id)
        .eq('store_id', store_id)
        .maybeSingle();

      console.log('🔍 Customer lookup result:', customerExists ? 'Found' : 'Not found');
      console.log('🔍 Customer details:', customerExists ? { id: customerExists.id, email: customerExists.email } : 'None');

      if (customerExists) {
        // IMPORTANT: Verify that the customer email matches the order email
        if (customerExists.email === customer_email) {
          validatedCustomerId = customer_id;
          console.log('✅ Validated customer_id and email match:', customer_id);
        } else {
          console.log('⚠️ Customer ID exists but email does not match! Customer email:', customerExists.email, 'Order email:', customer_email);
          console.log('⚠️ This is a data integrity issue - treating as guest checkout to prevent wrong customer assignment');
          validatedCustomerId = null;
        }
      } else {
        console.log('⚠️ Customer ID provided but not found in database, treating as guest checkout:', customer_id);
        validatedCustomerId = null; // Explicitly set to null
      }
    } catch (error) {
      console.log('⚠️ Error validating customer_id, treating as guest checkout:', error.message);
      console.log('⚠️ Error stack:', error.stack);
      validatedCustomerId = null; // Explicitly set to null on error
    }
  } else {
    console.log('ℹ️ No customer_id provided, creating guest order');
  }

  console.log('🔍 Final validatedCustomerId to be used:', validatedCustomerId);

  let orderId = null;

  try {
    // Calculate totals
    const subtotal = items.reduce((sum, item) => {
      const basePrice = parseFloat(item.price || 0);
      const optionsPrice = (item.selected_options || []).reduce((optSum, opt) => optSum + parseFloat(opt.price || 0), 0);
      return sum + ((basePrice + optionsPrice) * (item.quantity || 1));
    }, 0);

    const taxAmountNum = parseFloat(tax_amount) || 0;
    const shippingCostNum = parseFloat(shipping_cost) || 0;
    const paymentFeeNum = parseFloat(payment_fee) || 0;
    const discountAmountNum = parseFloat(discount_amount) || 0;
    const totalAmount = subtotal + taxAmountNum + shippingCostNum + paymentFeeNum - discountAmountNum;

    // Generate order number
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const order_number = `ORD-${timestamp}-${randomStr}`;

    console.log('💾 Generated order_number:', order_number);

    // Ensure addresses are objects and not null/undefined
    const finalShippingAddress = shipping_address && typeof shipping_address === 'object' ? shipping_address : {};
    const finalBillingAddress = billing_address && typeof billing_address === 'object' ? billing_address : (shipping_address && typeof shipping_address === 'object' ? shipping_address : {});

    console.log('💾 Final shipping address for order:', JSON.stringify(finalShippingAddress, null, 2));
    console.log('💾 Final billing address for order:', JSON.stringify(finalBillingAddress, null, 2));

    // Determine order status based on payment_flow
    // For offline payments (COD, bank transfer): order is 'processing', payment is 'pending' (not yet collected)
    // For online payments (Stripe): order is 'pending' until payment confirmed, then 'processing'
    const orderStatus = paymentFlow === 'offline' ? 'processing' : 'pending';
    const paymentStatus = paymentFlow === 'offline' ? 'pending' : 'pending'; // Offline = pending until collected on delivery

    console.log(`💾 Order status will be: ${orderStatus}, payment status: ${paymentStatus} (payment flow: ${paymentFlow})`);

    // Create the preliminary order (using Supabase)
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .insert({
        order_number: order_number,
        status: orderStatus,
        payment_status: paymentStatus,
        fulfillment_status: 'pending',
        customer_email,
        customer_id: validatedCustomerId,
        billing_address: finalBillingAddress,
        shipping_address: finalShippingAddress,
        subtotal: subtotal.toFixed(2),
        tax_amount: taxAmountNum.toFixed(2),
        shipping_amount: shippingCostNum.toFixed(2),
        discount_amount: discountAmountNum.toFixed(2),
        payment_fee_amount: paymentFeeNum.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        currency: store.currency || 'USD',
        delivery_date: delivery_date ? new Date(delivery_date).toISOString() : null,
        delivery_time_slot,
        delivery_instructions,
        payment_method: selected_payment_method_name || selected_payment_method || 'stripe',
        payment_reference: session.id,
        shipping_method: selected_shipping_method,
        coupon_code: applied_coupon?.code || null,
        store_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error creating order:', orderError);
      throw orderError;
    }

    orderId = order.id;
    console.log('💾 Preliminary order created:', order.id, order.order_number);

    // Create OrderItems (sequential operations)
    const orderItemsData = [];
    for (const item of items) {
      const basePrice = parseFloat(item.price || 0);
      const optionsPrice = (item.selected_options || []).reduce((sum, opt) => sum + parseFloat(opt.price || 0), 0);
      const unitPrice = basePrice + optionsPrice;
      const totalPrice = unitPrice * (item.quantity || 1);

      let productImage = null;
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        const firstImage = item.images[0];
        productImage = typeof firstImage === 'object' ? firstImage.url : firstImage;
      }

      orderItemsData.push({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name || item.name || 'Product',
        product_sku: item.sku || '',
        product_image: productImage,
        quantity: item.quantity || 1,
        unit_price: unitPrice.toFixed(2),
        total_price: totalPrice.toFixed(2),
        original_price: unitPrice.toFixed(2),
        selected_options: item.selected_options || [],
        product_attributes: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log('💾 Prepared OrderItem:', orderItemsData[orderItemsData.length - 1].product_name);
    }

    // Bulk insert order items
    const { error: itemsError } = await tenantDb
      .from('sales_order_items')
      .insert(orderItemsData);

    if (itemsError) {
      console.error('❌ Error creating order items:', itemsError);
      throw itemsError;
    }

    console.log('✅ Preliminary order and items created successfully');

    // Only reduce stock for OFFLINE payments (already confirmed)
    // For ONLINE payments (Stripe), stock is deducted in webhook after payment confirmation
    if (paymentFlow === 'offline') {
      console.log('💰 Offline payment - reducing stock immediately');
      for (const item of items) {
        try {
          const { data: product } = await tenantDb
            .from('products')
            .select('id, sku, manage_stock, stock_quantity, infinite_stock, allow_backorders, purchase_count')
            .eq('id', item.product_id)
            .single();

          if (product && product.manage_stock && !product.infinite_stock) {
            const quantity = item.quantity || 1;
            const newStockQuantity = product.stock_quantity - quantity;

            if (newStockQuantity < 0 && !product.allow_backorders) {
              console.warn(`⚠️ Insufficient stock for product ${product.sku}: requested ${quantity}, available ${product.stock_quantity}`);
            }

            await tenantDb
              .from('products')
              .update({
                stock_quantity: Math.max(0, newStockQuantity),
                purchase_count: (product.purchase_count || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', product.id);

            console.log(`✅ Stock reduced for product ${product.sku}: ${product.stock_quantity} -> ${Math.max(0, newStockQuantity)}`);
          } else if (product && product.infinite_stock) {
            await tenantDb
              .from('products')
              .update({
                purchase_count: (product.purchase_count || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', product.id);
            console.log(`✅ Purchase count updated for infinite stock product ${product.sku}`);
          }
        } catch (stockError) {
          console.error('Error reducing stock for product:', item.product_id, stockError);
          // Don't fail the order if stock reduction fails
        }
      }
    } else {
      console.log('💳 Online payment - stock will be reduced after payment confirmation in webhook');
    }

    // IMPORTANT: Never send email from createPreliminaryOrder
    // This function is called from Stripe checkout flow - ALL payments here require webhook confirmation
    // Email will be sent from webhook-connect handler after checkout.session.completed event
    console.log(`📧 Email will be sent after webhook confirmation (Stripe checkout flow)`);

    return order;

  } catch (error) {
    // Cleanup on error - delete order if it was created
    if (orderId) {
      console.log('🧹 Cleaning up failed order:', orderId);
      await tenantDb.from('sales_order_items').delete().eq('order_id', orderId);
      await tenantDb.from('sales_orders').delete().eq('id', orderId);
    }
    console.error('❌ Error creating preliminary order:', error);
    throw error;
  }
}

// Helper function to create order from Stripe checkout session
async function createOrderFromCheckoutSession(session) {
  const { store_id } = session.metadata || {};
  if (!store_id) {
    throw new Error('store_id not found in session metadata');
  }

  // Get tenant DB connection for orders
  const tenantDb = await ConnectionManager.getStoreConnection(store_id);

  // Converted to Supabase with sequential operations and error recovery
  let orderId = null;

  try {
    const { delivery_date, delivery_time_slot, delivery_instructions, coupon_code, shipping_method_name, shipping_method_id, payment_fee, payment_method, tax_amount } = session.metadata || {};

    console.log('Creating order for store_id:', store_id);

    // Get store to determine if we need Connect account context
    const store = await getMasterStore(store_id);
    if (!store) {
      throw new Error(`Store not found: ${store_id}`);
    }

    // Get Stripe account from integration_configs
    const stripeConfig = await IntegrationConfig.findByStoreAndType(store_id, STRIPE_INTEGRATION_TYPE);
    const stripeAccountId = stripeConfig?.config_data?.accountId;

    // Prepare Stripe options for Connect account if needed
    const sessionStripeOptions = {};
    if (stripeAccountId) {
      sessionStripeOptions.stripeAccount = stripeAccountId;
      console.log('Using Connect account for session retrieval:', stripeAccountId);
    }
    
    // Get line items from the session with correct account context
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      expand: ['data.price.product']
    }, sessionStripeOptions);
    
    console.log('🛒 Line items retrieved:', JSON.stringify(lineItems, null, 2));
    console.log('📊 Number of line items:', lineItems.data.length);
    
    if (lineItems.data.length === 0) {
      console.error('❌ CRITICAL: No line items found in Stripe session!');
      console.log('Session details for debugging:', {
        id: session.id,
        metadata: session.metadata,
        mode: session.mode,
        status: session.status
      });
    }
    
    // Calculate order totals from session
    const subtotal = session.amount_subtotal / 100; // Convert from cents
    // Use tax from metadata if available, otherwise from Stripe's total_details
    const tax_amount_calculated = (session.total_details?.amount_tax || 0) / 100;
    const tax_amount_from_metadata = parseFloat(tax_amount) || 0;
    const final_tax_amount = tax_amount_from_metadata || tax_amount_calculated;
    
    let shipping_cost = (session.total_details?.amount_shipping || 0) / 100;
    const payment_fee_amount = parseFloat(payment_fee) || 0;
    const total_amount = session.amount_total / 100;
    
    console.log('Session details:', {
      id: session.id,
      amount_total: session.amount_total,
      amount_subtotal: session.amount_subtotal,
      total_details: session.total_details,
      shipping_cost: session.shipping_cost,
      shipping_details: session.shipping_details,
      metadata: session.metadata
    });
    
    console.log('Shipping cost from total_details:', shipping_cost);
    
    // If shipping cost is 0, try to get it from shipping_cost in session or metadata
    if (shipping_cost === 0 && session.shipping_cost) {
      shipping_cost = session.shipping_cost.amount_total / 100;
      console.log('Using shipping_cost.amount_total:', shipping_cost);
    }
    
    // Alternative: get shipping cost from the selected shipping rate
    if (shipping_cost === 0 && session.shipping_cost?.amount_total) {
      shipping_cost = session.shipping_cost.amount_total / 100;
      console.log('Using session.shipping_cost:', shipping_cost);
    }
    
    // If still 0, check if there's a shipping rate ID and retrieve it
    if (shipping_cost === 0 && session.shipping_rate) {
      try {
        const shippingRate = await stripe.shippingRates.retrieve(session.shipping_rate);
        shipping_cost = shippingRate.fixed_amount.amount / 100;
        console.log('Retrieved shipping cost from shipping rate:', shipping_cost);
      } catch (shippingRateError) {
        console.log('Could not retrieve shipping rate:', shippingRateError.message);
      }
    }
    
    // Final fallback: check if shipping cost was passed in metadata 
    if (shipping_cost === 0 && session.metadata?.shipping_cost) {
      try {
        const metadataShippingCost = parseFloat(session.metadata.shipping_cost);
        if (!isNaN(metadataShippingCost) && metadataShippingCost > 0) {
          shipping_cost = metadataShippingCost;
          console.log('Using shipping cost from metadata:', shipping_cost);
        }
      } catch (metadataError) {
        console.log('Could not parse shipping cost from metadata:', metadataError.message);
      }
    }
    
    console.log('Final shipping cost used:', shipping_cost);
    
    // Generate order number
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
    const order_number = `ORD-${timestamp}-${randomStr}`;
    
    console.log('Generated order_number:', order_number);

    // Validate customer_id from metadata if provided - must exist AND match email
    let validatedCustomerId = null;
    const metadataCustomerId = session.metadata?.customer_id;
    const sessionEmail = session.customer_email || session.customer_details?.email;

    if (metadataCustomerId) {
      try {
        const { data: customerExists } = await tenantDb
          .from('customers')
          .select('*')
          .eq('id', metadataCustomerId)
          .eq('store_id', store_id)
          .maybeSingle();

        console.log('🔍 Customer lookup result from metadata:', customerExists ? 'Found' : 'Not found');
        console.log('🔍 Session email:', sessionEmail);
        console.log('🔍 Customer email:', customerExists?.email);

        if (customerExists) {
          // IMPORTANT: Verify email match to prevent wrong customer assignment
          if (customerExists.email === sessionEmail) {
            validatedCustomerId = metadataCustomerId;
            console.log('✅ Validated customer_id from metadata and email match:', metadataCustomerId);
          } else {
            console.log('⚠️ Customer ID exists but email mismatch! Customer email:', customerExists.email, 'Session email:', sessionEmail);
            console.log('⚠️ Treating as guest checkout to prevent wrong customer assignment');
            validatedCustomerId = null;
          }
        } else {
          console.log('⚠️ Customer ID in metadata not found in database, treating as guest checkout:', metadataCustomerId);
        }
      } catch (error) {
        console.log('⚠️ Error validating customer_id from metadata, treating as guest checkout:', error.message);
      }
    }

    // Prepare shipping address with name included
    const shippingAddress = session.shipping_details?.address || session.customer_details?.address || {};
    if (shippingAddress && Object.keys(shippingAddress).length > 0) {
      // Add name to address object from shipping_details or customer_details
      const shippingName = session.shipping_details?.name || session.customer_details?.name || '';
      if (shippingName) {
        shippingAddress.full_name = shippingName;
        shippingAddress.name = shippingName; // Add both for compatibility
      }
    }

    // Prepare billing address with name included
    const billingAddress = session.customer_details?.address || {};
    if (billingAddress && Object.keys(billingAddress).length > 0) {
      const billingName = session.customer_details?.name || '';
      if (billingName) {
        billingAddress.full_name = billingName;
        billingAddress.name = billingName; // Add both for compatibility
      }
    }

    // Create the order (using Supabase)
    const { data: order, error: orderError } = await tenantDb
      .from('sales_orders')
      .insert({
        order_number: order_number,
        store_id: store_id,
        customer_email: session.customer_email || session.customer_details?.email,
        customer_id: validatedCustomerId,
        customer_phone: session.customer_details?.phone,
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        subtotal: subtotal,
        tax_amount: final_tax_amount,
        shipping_amount: shipping_cost,
        discount_amount: (session.total_details?.amount_discount || 0) / 100,
        payment_fee_amount: payment_fee_amount,
        total_amount: total_amount,
        currency: session.currency.toUpperCase(),
        delivery_date: delivery_date ? new Date(delivery_date).toISOString() : null,
        delivery_time_slot: delivery_time_slot || null,
        delivery_instructions: delivery_instructions || null,
        payment_method: 'stripe',
        payment_reference: session.id,
        payment_status: 'paid',
        status: 'processing',
        coupon_code: coupon_code || null,
        shipping_method: shipping_method_name || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error('❌ Error creating order:', orderError);
      throw orderError;
    }

    orderId = order.id;
    
    // Group line items by product and reconstruct order items
    const productMap = new Map();
    
    for (const lineItem of lineItems.data) {
      console.log('🔍 Processing line item:', JSON.stringify(lineItem, null, 2));
      
      const productMetadata = lineItem.price.product.metadata || {};
      const itemType = productMetadata.item_type || 'main_product';
      const productId = productMetadata.product_id;
      
      console.log('📋 Line item details:', {
        productId,
        itemType,
        productName: lineItem.price.product.name,
        metadata: productMetadata,
        hasMetadata: Object.keys(productMetadata).length > 0,
        allMetadataKeys: Object.keys(productMetadata)
      });
      
      if (!productId) {
        console.error('❌ CRITICAL: No product_id found in line item metadata, skipping item');
        console.log('🔍 Metadata debug:', {
          available_keys: Object.keys(productMetadata),
          metadata_values: productMetadata,
          product_name: lineItem.price.product.name,
          price_id: lineItem.price.id
        });
        continue;
      }
      
      if (itemType === 'main_product') {
        // Main product line item
        console.log('Adding main product to map:', productId);
        productMap.set(productId, {
          product_id: productId,
          product_name: lineItem.price.product.name,
          product_sku: productMetadata.sku || '',
          quantity: lineItem.quantity,
          unit_price: lineItem.price.unit_amount / 100,
          base_total: lineItem.amount_total / 100,
          selected_options: []
        });
      } else if (itemType === 'custom_option') {
        // Custom option line item
        console.log('Adding custom option for product:', productId);
        if (productMap.has(productId)) {
          const product = productMap.get(productId);
          product.selected_options.push({
            name: productMetadata.option_name,
            price: lineItem.price.unit_amount / 100,
            total: lineItem.amount_total / 100
          });
        } else {
          console.warn('Custom option found but no main product in map for product_id:', productId);
        }
      }
    }
    
    // Create order items from grouped data
    console.log('🛍️ Creating order items for order:', order.id);
    console.log('📊 Product map has', productMap.size, 'products');
    
    if (productMap.size === 0) {
      console.error('❌ CRITICAL: No products in productMap! No OrderItems will be created!');
      console.log('🔍 Debug info:', {
        lineItemsCount: lineItems.data.length,
        sessionId: session.id,
        metadata: session.metadata,
        storeId: store_id,
        stripeAccountId: stripeAccountId
      });
      
      // This is a critical error - we should not commit an order without items
      throw new Error(`No valid products found in checkout session ${session.id}. LineItems: ${lineItems.data.length}, ProductMap: ${productMap.size}`);
    }
    
    for (const [productId, productData] of productMap) {
      // Look up actual product name and image from database if needed
      let actualProductName = productData.product_name;
      let productImage = null;
      if (!actualProductName || actualProductName === 'Product') {
        try {
          const { data: product } = await tenantDb
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('store_id', store_id)
            .maybeSingle();

          if (product) {
            actualProductName = product.name;
            // Extract first image URL from images array
            if (product.images && Array.isArray(product.images) && product.images.length > 0) {
              const firstImage = product.images[0];
              productImage = typeof firstImage === 'object' ? firstImage.url : firstImage;
            }
            console.log('Retrieved actual product name and image from database:', actualProductName, productImage);
          }
        } catch (productLookupError) {
          console.warn('Could not look up product name for ID:', productId, productLookupError.message);
        }
      }
      
      const optionsTotal = productData.selected_options.reduce((sum, opt) => sum + opt.total, 0);
      const totalPrice = productData.base_total + optionsTotal;
      
      const basePrice = productData.unit_price;
      const optionsPrice = productData.selected_options.reduce((sum, opt) => sum + opt.price, 0);
      const finalPrice = basePrice + optionsPrice;
      
      const orderItemData = {
        order_id: order.id,
        product_id: productData.product_id,
        product_name: actualProductName,
        product_sku: productData.product_sku,
        product_image: productImage, // Store product image URL
        quantity: productData.quantity,
        unit_price: finalPrice,
        total_price: totalPrice,
        original_price: finalPrice, // Store original price before any discounts
        selected_options: productData.selected_options || [], // Store custom options directly
        product_attributes: {
          // Keep any other product attributes here
        }
      };
      
      console.log('Creating order item:', JSON.stringify(orderItemData, null, 2));
      
      const { data: createdItem, error: itemError } = await tenantDb
        .from('sales_order_items')
        .insert({
          ...orderItemData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (itemError) {
        console.error('❌ Error creating order item:', itemError);
        throw itemError;
      }

      console.log('Created order item with ID:', createdItem.id);
    }

    // Now check and deduct stock atomically for all items
    console.log('📦 Checking and deducting stock for all order items...');
    const orderItemsForStock = Array.from(productMap.values()).map(p => ({
      product_id: p.product_id,
      quantity: p.quantity
    }));

    const stockResult = await checkAndDeductStock(tenantDb, orderItemsForStock, store_id);

    // Handle stock issues if any
    if (!stockResult.success && stockResult.insufficientItems.length > 0) {
      console.log('⚠️ Stock issue detected in createOrderFromCheckoutSession, handling...');
      await handleStockIssue({
        tenantDb,
        storeId: store_id,
        order: order,
        insufficientItems: stockResult.insufficientItems,
        paymentIntentId: session.payment_intent
      });
    }

    console.log(`Order created successfully: ${order.order_number}`);
    return order;

  } catch (error) {
    // Cleanup on error - delete order if it was created
    if (orderId) {
      console.log('🧹 Cleaning up failed order:', orderId);
      await tenantDb.from('sales_order_items').delete().eq('order_id', orderId);
      await tenantDb.from('sales_orders').delete().eq('id', orderId);
    }
    console.error('Error creating order from checkout session:', error);
    throw error;
  }
}

// @route   POST /api/payments/process
// @desc    Process payment
// @access  Public
router.post('/process', async (req, res) => {
  try {
    // This would normally process a payment with Stripe
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        payment_intent_id: 'pi_placeholder',
        status: 'succeeded',
        amount: req.body.amount || 0
      }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Test endpoint to verify deployment and auto-invoice feature
router.get('/test-auto-invoice-deployment', (req, res) => {
  res.json({
    success: true,
    message: '✅ Auto-invoice feature is deployed',
    deployment_date: '2025-01-06',
    commit: '10cf159d',
    features: {
      auto_invoice_after_order_email: 'ENABLED',
      comprehensive_logging: 'ENABLED',
      store_settings_fix: 'ENABLED'
    },
    test_instructions: 'Place a Stripe checkout order and search Render logs for: 💥 (webhook hit), 🎉 (order email), 🔍 (settings check), 📧 (invoice email)',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;