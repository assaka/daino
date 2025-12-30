/**
 * Payment Provider Service
 * Abstraction layer for multiple payment providers (Stripe, Mollie, Adyen, PayPal)
 * Handles refunds and other payment operations across different providers
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const IntegrationConfig = require('../models/IntegrationConfig');

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
   * Mollie refund implementation
   */
  async refundMollie({ order, amount, reason, store }) {
    console.log('💳 Processing Mollie refund for order:', order.order_number);

    // Get Mollie config from IntegrationConfig
    const mollieConfig = await IntegrationConfig.findByStoreAndType(store.id, 'mollie-connect');

    if (!mollieConfig?.config_data?.apiKey) {
      return {
        success: false,
        error: 'Mollie not configured for this store',
        provider: 'mollie',
        requiresManualRefund: true
      };
    }

    const apiKey = mollieConfig.config_data.apiKey;
    const paymentId = order.payment_reference;

    if (!paymentId || !paymentId.startsWith('tr_')) {
      return {
        success: false,
        error: 'Invalid Mollie payment reference',
        provider: 'mollie',
        requiresManualRefund: true
      };
    }

    try {
      // Create refund via Mollie API
      const refundAmount = amount || order.total_amount;
      const response = await fetch(`https://api.mollie.com/v2/payments/${paymentId}/refunds`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: {
            currency: order.currency || 'EUR',
            value: refundAmount.toFixed(2)
          },
          description: reason || 'Refund requested'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Mollie refund error:', error);
        return {
          success: false,
          error: error.detail || error.title || 'Mollie refund failed',
          provider: 'mollie',
          requiresManualRefund: true
        };
      }

      const refund = await response.json();
      console.log('✅ Mollie refund created:', refund.id);

      return {
        success: true,
        refundId: refund.id,
        provider: 'mollie',
        status: refund.status
      };
    } catch (error) {
      console.error('Mollie refund error:', error);
      return {
        success: false,
        error: error.message,
        provider: 'mollie',
        requiresManualRefund: true
      };
    }
  }

  /**
   * Adyen refund implementation
   */
  async refundAdyen({ order, amount, reason, store }) {
    console.log('💳 Processing Adyen refund for order:', order.order_number);

    // Get Adyen config from IntegrationConfig
    const adyenConfig = await IntegrationConfig.findByStoreAndType(store.id, 'adyen-connect');

    if (!adyenConfig?.config_data?.apiKey || !adyenConfig?.config_data?.merchantAccount) {
      return {
        success: false,
        error: 'Adyen not configured for this store',
        provider: 'adyen',
        requiresManualRefund: true
      };
    }

    const { apiKey, merchantAccount, environment = 'test' } = adyenConfig.config_data;
    const pspReference = order.payment_reference;

    if (!pspReference) {
      return {
        success: false,
        error: 'Invalid Adyen payment reference',
        provider: 'adyen',
        requiresManualRefund: true
      };
    }

    try {
      // Determine base URL based on environment
      const baseUrl = environment === 'live'
        ? 'https://checkout-live.adyen.com/v71'
        : 'https://checkout-test.adyen.com/v71';

      // Create refund via Adyen API
      const refundAmount = amount || order.total_amount;
      const response = await fetch(`${baseUrl}/payments/${pspReference}/refunds`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          merchantAccount,
          amount: {
            currency: order.currency || 'EUR',
            value: Math.round(refundAmount * 100) // Adyen uses minor units
          },
          reference: `refund-${order.order_number}-${Date.now()}`
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Adyen refund error:', error);
        return {
          success: false,
          error: error.message || error.errorType || 'Adyen refund failed',
          provider: 'adyen',
          requiresManualRefund: true
        };
      }

      const refund = await response.json();
      console.log('✅ Adyen refund created:', refund.pspReference);

      return {
        success: true,
        refundId: refund.pspReference,
        provider: 'adyen',
        status: refund.status
      };
    } catch (error) {
      console.error('Adyen refund error:', error);
      return {
        success: false,
        error: error.message,
        provider: 'adyen',
        requiresManualRefund: true
      };
    }
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
      mollie: true,
      adyen: true,
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
      { id: 'mollie', name: 'Mollie', autoRefund: true },
      { id: 'adyen', name: 'Adyen', autoRefund: true },
      { id: 'paypal', name: 'PayPal', autoRefund: false }
    ];
  }
}

module.exports = new PaymentProviderService();
