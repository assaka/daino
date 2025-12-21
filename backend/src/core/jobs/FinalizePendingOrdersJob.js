const BaseJobHandler = require('./BaseJobHandler');
const { masterDbClient } = require('../../database/masterConnection');
const ConnectionManager = require('../../services/database/ConnectionManager');
const emailService = require('../../services/email-service');
const IntegrationConfig = require('../../models/IntegrationConfig');

const STRIPE_INTEGRATION_TYPE = 'stripe-connect';

/**
 * Finalize Pending Orders Job
 *
 * Checks for orders that are "pending" and verifies payment status with Stripe.
 * This handles edge cases where user paid but never reached the success page
 * (browser crash, connection lost, etc.)
 *
 * Runs every 5-15 minutes
 */
class FinalizePendingOrdersJob extends BaseJobHandler {
  async execute() {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    console.log('🔍 FinalizePendingOrdersJob: Starting...');

    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
      console.warn('⚠️ Stripe not configured, skipping pending orders job');
      return { success: false, message: 'Stripe not configured' };
    }

    // Get all published stores from master DB
    const { data: stores, error: storesError } = await masterDbClient
      .from('stores')
      .select('id, slug, name')
      .eq('published', true);

    if (storesError) {
      console.error('❌ Failed to fetch stores:', storesError.message);
      return { success: false, message: `Failed to fetch stores: ${storesError.message}` };
    }

    if (!stores || stores.length === 0) {
      console.log('📭 No published stores found');
      return { success: true, message: 'No published stores to process', checked: 0 };
    }

    console.log(`🏪 Processing ${stores.length} published stores for pending orders`);

    let totalProcessed = 0;
    let totalFinalized = 0;
    let totalFailed = 0;
    let totalChecked = 0;

    // Find orders that are pending for more than 3 minutes AND email not sent
    // This means instant finalization didn't work, so job needs to handle it
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    for (const store of stores) {
      try {
        // Get tenant connection for this store
        const tenantDb = await ConnectionManager.getStoreConnection(store.id);

        // Query pending orders from tenant database
        const { data: pendingOrders, error: ordersError } = await tenantDb
          .from('orders')
          .select('*')
          .eq('store_id', store.id)
          .eq('status', 'pending')
          .eq('payment_status', 'pending')
          .lt('created_at', threeMinutesAgo)
          .not('payment_reference', 'is', null)
          .is('confirmation_email_sent_at', null)
          .limit(100);

        if (ordersError) {
          console.warn(`⚠️ Failed to query orders for store ${store.slug}:`, ordersError.message);
          continue;
        }

        if (!pendingOrders || pendingOrders.length === 0) {
          continue;
        }

        console.log(`🔍 Found ${pendingOrders.length} pending orders in store ${store.slug}`);
        totalChecked += pendingOrders.length;

        for (const order of pendingOrders) {
          try {
            console.log(`🔍 Checking order ${order.order_number} (${order.id})`);

            // Determine payment provider
            const paymentProvider = order.payment_method || 'stripe';
            console.log(`💳 Payment provider for order ${order.order_number}:`, paymentProvider);

            // Verify payment based on provider
            let paymentVerified = false;

            if (paymentProvider === 'stripe' || paymentProvider.includes('card') || paymentProvider.includes('credit')) {
              // Stripe verification - get connected account from IntegrationConfig
              const stripeConfig = await IntegrationConfig.findByStoreAndType(store.id, STRIPE_INTEGRATION_TYPE);
              const stripeAccountId = stripeConfig?.config_data?.accountId;

              const stripeOptions = {};
              if (stripeAccountId) {
                stripeOptions.stripeAccount = stripeAccountId;
              }

              try {
                const session = await stripe.checkout.sessions.retrieve(
                  order.payment_reference,
                  stripeOptions
                );
                console.log(`✅ Retrieved Stripe session ${session.id} - Payment status: ${session.payment_status}`);

                if (session.payment_status === 'paid') {
                  paymentVerified = true;
                } else {
                  console.log(`⏳ Order ${order.order_number} - Stripe payment status: ${session.payment_status}`);
                }
              } catch (stripeError) {
                console.warn(`⚠️ Could not retrieve Stripe session for order ${order.order_number}:`, stripeError.message);
                totalFailed++;
                continue;
              }
            } else if (paymentProvider === 'adyen') {
              // TODO: Implement Adyen verification
              console.log(`⚠️ Adyen verification not yet implemented for order ${order.order_number}`);
              continue;
            } else if (paymentProvider === 'mollie') {
              // TODO: Implement Mollie verification
              console.log(`⚠️ Mollie verification not yet implemented for order ${order.order_number}`);
              continue;
            } else {
              // Unknown provider - skip verification (might be offline payment)
              console.log(`⚠️ Unknown provider "${paymentProvider}" for order ${order.order_number}, skipping`);
              continue;
            }

            // Check if payment was verified
            if (paymentVerified) {
              console.log(`🔄 Payment confirmed for order ${order.order_number} - finalizing...`);

              // Update order status
              const { error: updateError } = await tenantDb
                .from('orders')
                .update({
                  status: 'processing',
                  payment_status: 'paid',
                  updated_at: new Date().toISOString()
                })
                .eq('id', order.id);

              if (updateError) {
                console.error(`❌ Failed to update order ${order.order_number}:`, updateError.message);
                totalFailed++;
                continue;
              }

              totalFinalized++;
              console.log(`✅ Order ${order.order_number} finalized successfully`);

              // Send confirmation email (atomic check-and-set to prevent race condition)
              const { data: emailUpdate, error: emailUpdateError } = await tenantDb
                .from('orders')
                .update({ confirmation_email_sent_at: new Date().toISOString() })
                .eq('id', order.id)
                .is('confirmation_email_sent_at', null)
                .select('id');

              if (emailUpdateError) {
                console.warn(`⚠️ Failed to set email flag for order ${order.order_number}:`, emailUpdateError.message);
              }

              if (emailUpdate && emailUpdate.length > 0) {
                // We successfully claimed email sending
                try {
                  // Get order with items for email
                  const { data: orderItems } = await tenantDb
                    .from('order_items')
                    .select(`
                      *,
                      product:products(id, sku)
                    `)
                    .eq('order_id', order.id);

                  // Try to get customer details
                  let customer = null;
                  if (order.customer_id) {
                    const { data: customerData } = await tenantDb
                      .from('customers')
                      .select('*')
                      .eq('id', order.customer_id)
                      .maybeSingle();
                    customer = customerData;
                  }

                  // Extract customer name from shipping/billing address if customer not found
                  const customerName = customer
                    ? `${customer.first_name} ${customer.last_name}`
                    : (order.shipping_address?.full_name || order.shipping_address?.name || order.billing_address?.full_name || order.billing_address?.name || 'Customer');

                  const [firstName, ...lastNameParts] = customerName.split(' ');
                  const lastName = lastNameParts.join(' ') || '';

                  // Build order object with items for email
                  const orderWithItems = {
                    ...order,
                    OrderItems: orderItems || []
                  };

                  // Send order success email
                  await emailService.sendTransactionalEmail(order.store_id, 'order_success_email', {
                    recipientEmail: order.customer_email,
                    customer: customer || {
                      first_name: firstName,
                      last_name: lastName,
                      email: order.customer_email
                    },
                    order: orderWithItems,
                    store: store
                  });

                  console.log(`📧 Sent confirmation email to ${order.customer_email}`);
                } catch (emailError) {
                  console.error(`❌ Failed to send email for order ${order.order_number}:`, emailError.message);
                  // Rollback flag if email failed
                  await tenantDb
                    .from('orders')
                    .update({ confirmation_email_sent_at: null })
                    .eq('id', order.id);
                }
              } else {
                console.log(`✅ Confirmation email already sent by another process for order ${order.order_number}`);
              }
            } else {
              // Payment not verified - already logged in provider-specific blocks above
              console.log(`⏳ Order ${order.order_number} payment not yet verified - keeping as pending`);
            }

            totalProcessed++;

          } catch (error) {
            console.error(`❌ Error processing order ${order.id}:`, error.message);
            totalFailed++;
          }
        }

      } catch (storeError) {
        console.error(`❌ Error processing store ${store.slug}:`, storeError.message);
      }
    }

    const result = {
      success: true,
      stores_processed: stores.length,
      checked: totalChecked,
      processed: totalProcessed,
      finalized: totalFinalized,
      failed: totalFailed,
      message: `Checked ${totalChecked} pending orders across ${stores.length} stores, finalized ${totalFinalized}`
    };

    console.log(`✅ FinalizePendingOrdersJob completed:`, result);
    return result;
  }
}

module.exports = FinalizePendingOrdersJob;
