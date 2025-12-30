import apiClient from './client';
import storefrontApiClient from './storefront-client';
import { createPublicUrl } from '@/utils/urlUtils';

// Stripe payment functions
export const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
  try {
    const response = await apiClient.post('payments/create-intent', {
      amount,
      currency,
      metadata
    });

    if (!response) {
      return { data: null, error: new Error('No response from server') };
    }

    if (!response.data) {
      return { data: null, error: new Error('Invalid response format') };
    }

    return { data: response.data, error: null };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return { data: null, error: error };
  }
};

export const createStripeCheckout = async (checkoutData) => {
  try {
    
    // Extract data from checkoutData object
    const {
      cartItems,
      shippingAddress,
      billingAddress,
      store,
      taxAmount,
      shippingCost,
      paymentFee,
      shippingMethod,
      selectedShippingMethod,
      selectedPaymentMethod,
      selectedPaymentMethodName,
      discountAmount,
      appliedCoupon,
      deliveryDate,
      deliveryTimeSlot,
      deliveryComments,
      email,
      userId,
      sessionId
    } = checkoutData;

    // Build URLs using createPublicUrl which handles custom domain detection
    // Custom domain: /order-success, Platform domain: /public/{storeSlug}/order-success
    const successPath = createPublicUrl(store.slug, 'ORDER_SUCCESS');
    const cancelPath = createPublicUrl(store.slug, 'CHECKOUT');

    const requestPayload = {
      items: cartItems, // Map cartItems to items
      store_id: store?.id,
      success_url: `${window.location.origin}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}${cancelPath}`,
      customer_email: email,
      customer_id: userId, // Pass customer ID if available
      shipping_address: shippingAddress,
      shipping_method: shippingMethod,
      selected_shipping_method: selectedShippingMethod,
      shipping_cost: shippingCost,
      tax_amount: taxAmount,
      payment_fee: paymentFee,
      selected_payment_method: selectedPaymentMethod,
      selected_payment_method_name: selectedPaymentMethodName,
      discount_amount: discountAmount,
      applied_coupon: appliedCoupon,
      delivery_date: deliveryDate,
      delivery_time_slot: deliveryTimeSlot,
      delivery_instructions: deliveryComments,
      session_id: sessionId, // Include session_id for guest checkout
    };

    // Use storefront API client instead of admin API client for guest/customer checkout
    const response = await storefrontApiClient.postCustomer('payments/create-checkout', requestPayload);

    // Ensure we return the data
    const result = response.data || response;

    // Store session ID for fallback on order-success page
    if (result.data?.session_id) {
      localStorage.setItem('stripe_session_id', result.data.session_id);
    }
    
    return result;
  } catch (error) {
    console.error('Error creating Stripe checkout:', error);
    console.error('Error response:', error.response);
    throw error;
  }
};

export const stripeWebhook = async (payload, signature) => {
  try {
    const response = await apiClient.post('payments/stripe-webhook', {
      payload,
      signature
    });
    return response.data;
  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    throw error;
  }
};

export const createStripeConnectAccount = async (storeId, country = 'US', businessType = 'company') => {
  try {
    const response = await apiClient.post('payments/connect-account', {
      store_id: storeId,
      country: country,
      business_type: businessType
    });
    return { data: response.data || response };
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    throw error;
  }
};

export const createStripeConnectLink = async (returnUrl, refreshUrl, storeId) => {
  try {
    const response = await apiClient.post('payments/connect-link', {
      return_url: returnUrl,
      refresh_url: refreshUrl,
      store_id: storeId
    });
    return { data: response.data || response };
  } catch (error) {
    console.error('Error creating Stripe Connect link:', error);
    throw error;
  }
};

export const linkExistingStripeAccount = async (storeId, accountId) => {
  try {
    const response = await apiClient.post('payments/link-existing-account', {
      store_id: storeId,
      account_id: accountId
    });
    return { data: response.data || response };
  } catch (error) {
    console.error('Error linking existing Stripe account:', error);
    throw error;
  }
};

export const getStripeConnectOAuthUrl = async (storeId) => {
  try {
    const response = await apiClient.get(`payments/connect-oauth-url?store_id=${storeId}`);
    return { data: response.data || response };
  } catch (error) {
    console.error('Error getting Stripe OAuth URL:', error);
    throw error;
  }
};

export const completeStripeOAuthCallback = async (code, state) => {
  try {
    const response = await apiClient.post('payments/connect-oauth-callback', {
      code,
      state
    });
    return { data: response.data || response };
  } catch (error) {
    console.error('Error completing Stripe OAuth callback:', error);
    throw error;
  }
};

export const checkStripeConnectStatus = async (storeId) => {
  try {
    const response = await apiClient.get(`payments/connect-status${storeId ? `?store_id=${storeId}` : ''}`);
    return { data: response.data || response };
  } catch (error) {
    console.error('Error checking Stripe Connect status:', error);
    throw error;
  }
};

export const getStripePublishableKey = async () => {
  try {
    const response = await apiClient.get('payments/publishable-key');

    // Backend returns: { data: { publishableKey: 'pk_...' } }
    // After apiClient: response = { data: { publishableKey: 'pk_...' } } OR response = { data: { data: { publishableKey: 'pk_...' } } }

    let publishableKey = null;

    // Try different possible response structures
    if (response?.data?.data?.publishableKey) {
      // Double nested: { data: { data: { publishableKey } } }
      publishableKey = response.data.data.publishableKey;
    } else if (response?.data?.publishableKey) {
      // Single nested: { data: { publishableKey } }
      publishableKey = response.data.publishableKey;
    } else if (response?.publishableKey) {
      // Direct: { publishableKey }
      publishableKey = response.publishableKey;
    }

    const result = {
      data: {
        publishableKey: publishableKey
      }
    };

    return result;
  } catch (error) {
    console.error('Error getting Stripe publishable key:', error);

    // Try fallback key from environment variables
    const fallbackKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

    return {
      data: {
        publishableKey: fallbackKey
      }
    };
  }
};

// ============================================================================
// MOLLIE PAYMENT FUNCTIONS
// ============================================================================

export const connectMollie = async (storeId, apiKey) => {
  try {
    const response = await apiClient.post('payments/mollie/connect', {
      store_id: storeId,
      api_key: apiKey
    });
    return { data: response.data || response };
  } catch (error) {
    console.error('Error connecting Mollie:', error);
    throw error;
  }
};

export const checkMollieStatus = async (storeId) => {
  try {
    const response = await apiClient.get(`payments/mollie/status?store_id=${storeId}`);
    return { data: response.data || response };
  } catch (error) {
    console.error('Error checking Mollie status:', error);
    throw error;
  }
};

export const getMollieEnabledMethods = async (storeId) => {
  try {
    const response = await apiClient.get(`payments/mollie/enabled-methods?store_id=${storeId}`);
    return { data: response.data || response };
  } catch (error) {
    console.error('Error getting Mollie enabled methods:', error);
    throw error;
  }
};

export const syncMollieMethods = async (storeId) => {
  try {
    const response = await apiClient.post('payments/mollie/sync-methods', {
      store_id: storeId
    });
    return { data: response.data || response };
  } catch (error) {
    console.error('Error syncing Mollie methods:', error);
    throw error;
  }
};

export const disconnectMollie = async (storeId) => {
  try {
    const response = await apiClient.delete(`payments/mollie/disconnect?store_id=${storeId}`);
    return { data: response.data || response };
  } catch (error) {
    console.error('Error disconnecting Mollie:', error);
    throw error;
  }
};

// ============================================================================
// ADYEN PAYMENT FUNCTIONS
// ============================================================================

export const connectAdyen = async (storeId, apiKey, merchantAccount, environment = 'test', clientKey = null) => {
  try {
    const response = await apiClient.post('payments/adyen/connect', {
      store_id: storeId,
      api_key: apiKey,
      merchant_account: merchantAccount,
      environment,
      client_key: clientKey
    });
    return { data: response.data || response };
  } catch (error) {
    console.error('Error connecting Adyen:', error);
    throw error;
  }
};

export const checkAdyenStatus = async (storeId) => {
  try {
    const response = await apiClient.get(`payments/adyen/status?store_id=${storeId}`);
    return { data: response.data || response };
  } catch (error) {
    console.error('Error checking Adyen status:', error);
    throw error;
  }
};

export const getAdyenEnabledMethods = async (storeId) => {
  try {
    const response = await apiClient.get(`payments/adyen/enabled-methods?store_id=${storeId}`);
    return { data: response.data || response };
  } catch (error) {
    console.error('Error getting Adyen enabled methods:', error);
    throw error;
  }
};

export const syncAdyenMethods = async (storeId) => {
  try {
    const response = await apiClient.post('payments/adyen/sync-methods', {
      store_id: storeId
    });
    return { data: response.data || response };
  } catch (error) {
    console.error('Error syncing Adyen methods:', error);
    throw error;
  }
};

export const disconnectAdyen = async (storeId) => {
  try {
    const response = await apiClient.delete(`payments/adyen/disconnect?store_id=${storeId}`);
    return { data: response.data || response };
  } catch (error) {
    console.error('Error disconnecting Adyen:', error);
    throw error;
  }
};