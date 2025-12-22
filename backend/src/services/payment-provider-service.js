/**
 * Payment Provider Service
 * Abstraction layer for multiple payment providers (Stripe, Mollie, Adyen, PayPal)
 * Handles refunds and other payment operations across different providers
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentProviderService {
  /**
   * Process a refund for an order
   * @param {Object} params - Refund parameters
   * @param {Object} params.order - Order object with payment details
   * @param {number} params.amount - Amount to refund (optional, full refund if not specified)
   * @param {string} params.reason - Reason for refund
   * @param {Object} params.store - Store object with provider credentials
   * @returns {Promise<Object>} - { success: boolean, refundId?: string, error?: string, provider: string }
   */
  async refund({ order, amount, reason = 'requested_by_customer', store }) {
    const paymentMethod = order.payment_method?.toLowerCase();
    const paymentReference = order.payment_reference;

    if (!paymentReference) {
      return { success: false, error: 'No payment reference found', provider: paymentMethod };
    }

    try {
      switch (paymentMethod) {
        case 'stripe':
          return await this.refundStripe({ order, amount, reason, store });

        case 'mollie':
          return await this.refundMollie({ order, amount, reason, store });

        case 'adyen':
          return await this.refundAdyen({ order, amount, reason, store });

        case 'paypal':
          return await this.refundPayPal({ order, amount, reason, store });

        default:
          console.log(`⚠️ Auto-refund not supported for payment method: ${paymentMethod}`);
          return {
            success: false,
            error: `Auto-refund not supported for ${paymentMethod}. Please process refund manually.`,
            provider: paymentMethod,
            requiresManualRefund: true
          };
      }
    } catch (error) {
      console.error(`Error processing refund via ${paymentMethod}:`, error);
      return {
        success: false,
        error: error.message,
        provider: paymentMethod
      };
    }
  }

  /**
   * Stripe refund implementation
   */
  async refundStripe({ order, amount, reason, store }) {
    console.log('💳 Processing Stripe refund for order:', order.order_number);

    const stripeOptions = {};
    if (store?.settings?.stripe_account_id) {
      stripeOptions.stripeAccount = store.settings.stripe_account_id;
    }

    const refundParams = {
      reason: reason === 'stock_issue' ? 'requested_by_customer' : reason
    };

    // Determine if we have a payment intent or charge ID
    if (order.payment_reference?.startsWith('pi_')) {
      refundParams.payment_intent = order.payment_reference;
    } else if (order.payment_reference?.startsWith('ch_')) {
      refundParams.charge = order.payment_reference;
    } else {
      // Try to get payment intent from checkout session
      try {
        const session = await stripe.checkout.sessions.retrieve(order.payment_reference, stripeOptions);
        if (session.payment_intent) {
          refundParams.payment_intent = session.payment_intent;
        }
      } catch (e) {
        console.error('Could not retrieve session:', e.message);
        return { success: false, error: 'Could not find payment to refund', provider: 'stripe' };
      }
    }

    // Add amount if partial refund
    if (amount && amount < order.total_amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await stripe.refunds.create(refundParams, stripeOptions);

    console.log('✅ Stripe refund created:', refund.id);
    return {
      success: true,
      refundId: refund.id,
      provider: 'stripe',
      status: refund.status
    };
  }

  /**
   * Mollie refund implementation (placeholder)
   * TODO: Implement when Mollie integration is added
   */
  async refundMollie({ order, amount, reason, store }) {
    console.log('💳 Mollie refund requested for order:', order.order_number);

    // Check if Mollie is configured
    if (!store?.mollie_api_key) {
      return {
        success: false,
        error: 'Mollie not configured for this store',
        provider: 'mollie',
        requiresManualRefund: true
      };
    }

    // TODO: Implement Mollie refund
    // const mollie = require('@mollie/api-client')({ apiKey: store.mollie_api_key });
    // const refund = await mollie.paymentRefunds.create({
    //   paymentId: order.payment_reference,
    //   amount: { currency: order.currency, value: amount || order.total_amount }
    // });

    return {
      success: false,
      error: 'Mollie refund integration coming soon. Please process refund manually.',
      provider: 'mollie',
      requiresManualRefund: true
    };
  }

  /**
   * Adyen refund implementation (placeholder)
   * TODO: Implement when Adyen integration is added
   */
  async refundAdyen({ order, amount, reason, store }) {
    console.log('💳 Adyen refund requested for order:', order.order_number);

    // Check if Adyen is configured
    if (!store?.adyen_api_key) {
      return {
        success: false,
        error: 'Adyen not configured for this store',
        provider: 'adyen',
        requiresManualRefund: true
      };
    }

    // TODO: Implement Adyen refund
    // const { Client, CheckoutAPI } = require('@adyen/api-library');
    // const client = new Client({ apiKey: store.adyen_api_key, environment: 'live' });
    // const checkout = new CheckoutAPI(client);
    // const refund = await checkout.refunds({
    //   paymentPspReference: order.payment_reference,
    //   amount: { currency: order.currency, value: Math.round((amount || order.total_amount) * 100) }
    // });

    return {
      success: false,
      error: 'Adyen refund integration coming soon. Please process refund manually.',
      provider: 'adyen',
      requiresManualRefund: true
    };
  }

  /**
   * PayPal refund implementation (placeholder)
   * TODO: Implement when PayPal integration is added
   */
  async refundPayPal({ order, amount, reason, store }) {
    console.log('💳 PayPal refund requested for order:', order.order_number);

    // Check if PayPal is configured
    if (!store?.paypal_client_id || !store?.paypal_client_secret) {
      return {
        success: false,
        error: 'PayPal not configured for this store',
        provider: 'paypal',
        requiresManualRefund: true
      };
    }

    // TODO: Implement PayPal refund
    // const paypal = require('@paypal/checkout-server-sdk');
    // const environment = new paypal.core.LiveEnvironment(store.paypal_client_id, store.paypal_client_secret);
    // const client = new paypal.core.PayPalHttpClient(environment);
    // const request = new paypal.payments.CapturesRefundRequest(order.payment_reference);
    // request.requestBody({
    //   amount: { currency_code: order.currency, value: (amount || order.total_amount).toFixed(2) },
    //   note_to_payer: reason
    // });
    // const refund = await client.execute(request);

    return {
      success: false,
      error: 'PayPal refund integration coming soon. Please process refund manually.',
      provider: 'paypal',
      requiresManualRefund: true
    };
  }

  /**
   * Check if a payment method supports auto-refund
   */
  supportsAutoRefund(paymentMethod) {
    const supported = {
      stripe: true,
      mollie: false,  // Coming soon
      adyen: false,   // Coming soon
      paypal: false   // Coming soon
    };
    return supported[paymentMethod?.toLowerCase()] || false;
  }

  /**
   * Get list of supported payment providers
   */
  getSupportedProviders() {
    return [
      { id: 'stripe', name: 'Stripe', autoRefund: true },
      { id: 'mollie', name: 'Mollie', autoRefund: false },
      { id: 'adyen', name: 'Adyen', autoRefund: false },
      { id: 'paypal', name: 'PayPal', autoRefund: false }
    ];
  }
}

module.exports = new PaymentProviderService();
