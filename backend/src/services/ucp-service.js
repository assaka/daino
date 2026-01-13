/**
 * Universal Commerce Protocol (UCP) Service
 *
 * Handles UCP business profile generation, signing key management,
 * and checkout session operations for agentic commerce.
 *
 * @see https://ucp.dev/specification/overview
 */

const crypto = require('crypto');
const { masterDbClient } = require('../database/masterConnection');
const ConnectionManager = require('./database/ConnectionManager');

// UCP Protocol Version (date-based format: YYYY-MM-DD)
const UCP_VERSION = '2026-01-11';

/**
 * Generate EC P-256 signing key pair for UCP
 * @returns {Object} { publicKey, privateKey } in JWK format
 */
function generateSigningKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256'
  });

  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateJwk = privateKey.export({ format: 'jwk' });

  // Add required JWK fields
  const kid = crypto.randomUUID();

  return {
    publicKey: {
      kty: 'EC',
      crv: 'P-256',
      x: publicJwk.x,
      y: publicJwk.y,
      kid: kid,
      use: 'sig',
      alg: 'ES256'
    },
    privateKey: {
      ...privateJwk,
      kid: kid,
      use: 'sig',
      alg: 'ES256'
    }
  };
}

/**
 * Get or create UCP signing keys for a store
 * @param {string} storeId - Store UUID
 * @returns {Object} { publicKey, privateKey }
 */
async function getOrCreateSigningKeys(storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Check if store has existing UCP keys in settings
  const { data: store, error } = await tenantDb
    .from('stores')
    .select('settings')
    .eq('id', storeId)
    .single();

  if (error) {
    throw new Error(`Failed to get store: ${error.message}`);
  }

  const settings = store?.settings || {};

  if (settings.ucp_signing_keys?.publicKey && settings.ucp_signing_keys?.privateKey) {
    return settings.ucp_signing_keys;
  }

  // Generate new keys
  const keys = generateSigningKeyPair();

  // Store keys in settings
  const updatedSettings = {
    ...settings,
    ucp_signing_keys: keys
  };

  const { error: updateError } = await tenantDb
    .from('stores')
    .update({ settings: updatedSettings })
    .eq('id', storeId);

  if (updateError) {
    throw new Error(`Failed to save signing keys: ${updateError.message}`);
  }

  return keys;
}

/**
 * Build the UCP Business Profile for a store
 * @param {Object} params - Parameters
 * @param {string} params.storeId - Store UUID
 * @param {string} params.storeSlug - Store slug
 * @param {string} params.baseUrl - Base URL for the store
 * @returns {Object} UCP Business Profile
 */
async function buildBusinessProfile({ storeId, storeSlug, baseUrl }) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Get store details
  const { data: store, error: storeError } = await tenantDb
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (storeError || !store) {
    throw new Error('Store not found');
  }

  // Get signing keys
  const signingKeys = await getOrCreateSigningKeys(storeId);

  // Get payment methods
  const { data: paymentMethods } = await tenantDb
    .from('payment_methods')
    .select('*')
    .eq('is_active', true);

  // Build payment handlers based on configured payment methods
  const paymentHandlers = [];

  if (paymentMethods?.some(pm => pm.code === 'stripe')) {
    paymentHandlers.push({
      id: `${storeSlug}-stripe`,
      name: 'com.stripe.payments',
      version: UCP_VERSION,
      spec: 'https://stripe.com/docs/ucp',
      config: {
        supported_methods: ['card', 'apple_pay', 'google_pay']
      }
    });
  }

  // Build the business profile
  const profile = {
    ucp: {
      version: UCP_VERSION,
      services: [
        {
          name: `com.dainostore.${storeSlug}.checkout`,
          version: UCP_VERSION,
          spec: `${baseUrl}/.well-known/ucp/spec/checkout`,
          rest: {
            schema: `${baseUrl}/api/ucp/schemas/checkout.json`,
            endpoint: `${baseUrl}/api/ucp`
          }
        }
      ],
      capabilities: [
        {
          name: 'dev.ucp.shopping.checkout',
          version: UCP_VERSION,
          spec: 'https://ucp.dev/specification/capabilities/checkout',
          config: {
            supports_guest_checkout: true,
            supports_shipping: true,
            supports_tax_calculation: true,
            supports_coupons: true,
            supported_currencies: [store.currency || 'USD'],
            supported_countries: store.settings?.shipping_countries || ['US']
          }
        }
      ]
    },
    payment: {
      handlers: paymentHandlers
    },
    signing_keys: [signingKeys.publicKey],
    business: {
      name: store.name,
      description: store.description,
      logo_url: store.settings?.logo_url || store.logo_url,
      website: baseUrl,
      contact: {
        email: store.contact_email || store.settings?.contact_email,
        phone: store.contact_phone || store.settings?.contact_phone
      },
      address: {
        line1: store.address_line1 || store.settings?.address_line1,
        line2: store.address_line2 || store.settings?.address_line2,
        city: store.city || store.settings?.city,
        state: store.state || store.settings?.state,
        postal_code: store.postal_code || store.settings?.postal_code,
        country: store.country || store.settings?.country
      }
    }
  };

  return profile;
}

/**
 * Check if UCP is enabled for a store
 * @param {string} storeId - Store UUID
 * @returns {boolean}
 */
async function isUcpEnabled(storeId) {
  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: store } = await tenantDb
      .from('stores')
      .select('settings')
      .eq('id', storeId)
      .single();

    return store?.settings?.ucp_enabled === true;
  } catch (error) {
    console.error('Error checking UCP status:', error);
    return false;
  }
}

/**
 * Enable or disable UCP for a store
 * @param {string} storeId - Store UUID
 * @param {boolean} enabled - Whether to enable or disable
 * @returns {Object} Updated settings
 */
async function setUcpEnabled(storeId, enabled) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { data: store, error: getError } = await tenantDb
    .from('stores')
    .select('settings')
    .eq('id', storeId)
    .single();

  if (getError) {
    throw new Error(`Failed to get store: ${getError.message}`);
  }

  const settings = store?.settings || {};
  settings.ucp_enabled = enabled;

  // If enabling, ensure signing keys exist
  if (enabled) {
    await getOrCreateSigningKeys(storeId);
  }

  const { data: updated, error: updateError } = await tenantDb
    .from('stores')
    .update({ settings })
    .eq('id', storeId)
    .select('settings')
    .single();

  if (updateError) {
    throw new Error(`Failed to update settings: ${updateError.message}`);
  }

  return updated.settings;
}

/**
 * Create a UCP checkout session
 * @param {Object} params - Session parameters
 * @returns {Object} Checkout session
 */
async function createCheckoutSession({ storeId, items, customer, shippingAddress, billingAddress, metadata }) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Generate session ID
  const sessionId = crypto.randomUUID();

  // Calculate totals from items
  let subtotal = 0;
  const lineItems = [];

  for (const item of items) {
    // Get product details
    const { data: product } = await tenantDb
      .from('products')
      .select('*')
      .eq('id', item.product_id)
      .single();

    if (!product) {
      throw new Error(`Product not found: ${item.product_id}`);
    }

    const itemTotal = product.price * item.quantity;
    subtotal += itemTotal;

    lineItems.push({
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      quantity: item.quantity,
      unit_price: product.price,
      total: itemTotal,
      currency: product.currency || 'USD',
      image_url: product.images?.[0] || null
    });
  }

  // Get tax rate
  let taxAmount = 0;
  if (shippingAddress?.country) {
    const { data: taxRules } = await tenantDb
      .from('taxes')
      .select('*')
      .eq('is_active', true);

    // Simple tax calculation - in production, use proper tax service
    const applicableTax = taxRules?.find(t =>
      t.country === shippingAddress.country || t.country === '*'
    );
    if (applicableTax) {
      taxAmount = Math.round(subtotal * (applicableTax.rate / 100));
    }
  }

  // Get shipping cost
  let shippingAmount = 0;
  const { data: shippingMethods } = await tenantDb
    .from('shipping_methods')
    .select('*')
    .eq('is_active', true)
    .limit(1);

  if (shippingMethods?.[0]) {
    shippingAmount = shippingMethods[0].base_rate || 0;
  }

  const total = subtotal + taxAmount + shippingAmount;

  // Create session object
  const session = {
    id: sessionId,
    store_id: storeId,
    status: 'open',
    line_items: lineItems,
    customer: customer || null,
    shipping_address: shippingAddress || null,
    billing_address: billingAddress || null,
    subtotal,
    tax_amount: taxAmount,
    shipping_amount: shippingAmount,
    total,
    currency: 'USD',
    metadata: metadata || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min expiry
  };

  // Store session (using cart table with ucp_session flag)
  const { error: insertError } = await tenantDb
    .from('carts')
    .insert({
      id: sessionId,
      store_id: storeId,
      items: lineItems,
      subtotal,
      tax: taxAmount,
      shipping: shippingAmount,
      total,
      metadata: {
        ...metadata,
        ucp_session: true,
        customer,
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        status: 'open',
        expires_at: session.expires_at
      }
    });

  if (insertError) {
    throw new Error(`Failed to create session: ${insertError.message}`);
  }

  return session;
}

/**
 * Get a UCP checkout session
 * @param {string} storeId - Store UUID
 * @param {string} sessionId - Session UUID
 * @returns {Object} Checkout session
 */
async function getCheckoutSession(storeId, sessionId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { data: cart, error } = await tenantDb
    .from('carts')
    .select('*')
    .eq('id', sessionId)
    .eq('store_id', storeId)
    .single();

  if (error || !cart) {
    return null;
  }

  // Check if this is a UCP session
  if (!cart.metadata?.ucp_session) {
    return null;
  }

  return {
    id: cart.id,
    store_id: cart.store_id,
    status: cart.metadata.status || 'open',
    line_items: cart.items,
    customer: cart.metadata.customer,
    shipping_address: cart.metadata.shipping_address,
    billing_address: cart.metadata.billing_address,
    subtotal: cart.subtotal,
    tax_amount: cart.tax,
    shipping_amount: cart.shipping,
    total: cart.total,
    currency: 'USD',
    metadata: cart.metadata,
    created_at: cart.created_at,
    updated_at: cart.updated_at,
    expires_at: cart.metadata.expires_at
  };
}

/**
 * Update a UCP checkout session
 * @param {string} storeId - Store UUID
 * @param {string} sessionId - Session UUID
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated session
 */
async function updateCheckoutSession(storeId, sessionId, updates) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Get existing session
  const existing = await getCheckoutSession(storeId, sessionId);
  if (!existing) {
    throw new Error('Session not found');
  }

  if (existing.status === 'completed') {
    throw new Error('Cannot update completed session');
  }

  // Merge updates
  const updatedMetadata = {
    ...existing.metadata,
    ...updates.metadata,
    customer: updates.customer || existing.customer,
    shipping_address: updates.shipping_address || existing.shipping_address,
    billing_address: updates.billing_address || existing.billing_address
  };

  const { error } = await tenantDb
    .from('carts')
    .update({
      metadata: updatedMetadata,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('store_id', storeId);

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }

  return getCheckoutSession(storeId, sessionId);
}

/**
 * Complete a UCP checkout session (create order)
 * @param {string} storeId - Store UUID
 * @param {string} sessionId - Session UUID
 * @param {Object} payment - Payment details
 * @returns {Object} Completed order
 */
async function completeCheckoutSession(storeId, sessionId, payment) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Get session
  const session = await getCheckoutSession(storeId, sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status === 'completed') {
    throw new Error('Session already completed');
  }

  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  // Create order
  const order = {
    id: crypto.randomUUID(),
    store_id: storeId,
    order_number: orderNumber,
    status: 'pending',
    payment_status: payment?.status || 'pending',
    fulfillment_status: 'pending',
    customer_email: session.customer?.email,
    customer_phone: session.customer?.phone,
    shipping_address: session.shipping_address,
    billing_address: session.billing_address,
    subtotal: session.subtotal,
    tax_amount: session.tax_amount,
    shipping_cost: session.shipping_amount,
    total: session.total,
    currency: session.currency,
    items: session.line_items,
    metadata: {
      ...session.metadata,
      ucp_session_id: sessionId,
      payment
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: orderError } = await tenantDb
    .from('orders')
    .insert(order);

  if (orderError) {
    throw new Error(`Failed to create order: ${orderError.message}`);
  }

  // Update session status
  await tenantDb
    .from('carts')
    .update({
      metadata: {
        ...session.metadata,
        status: 'completed',
        order_id: order.id,
        order_number: orderNumber
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId);

  // Delete cart (cleanup)
  await tenantDb
    .from('carts')
    .delete()
    .eq('id', sessionId);

  return {
    session_id: sessionId,
    order_id: order.id,
    order_number: orderNumber,
    status: 'completed',
    total: session.total,
    currency: session.currency
  };
}

/**
 * Sign a UCP response for verification
 * @param {string} storeId - Store UUID
 * @param {Object} payload - Payload to sign
 * @returns {string} Signature
 */
async function signResponse(storeId, payload) {
  const keys = await getOrCreateSigningKeys(storeId);

  const privateKeyObject = crypto.createPrivateKey({
    key: keys.privateKey,
    format: 'jwk'
  });

  const payloadString = JSON.stringify(payload);
  const sign = crypto.createSign('SHA256');
  sign.update(payloadString);

  return sign.sign(privateKeyObject, 'base64');
}

module.exports = {
  UCP_VERSION,
  generateSigningKeyPair,
  getOrCreateSigningKeys,
  buildBusinessProfile,
  isUcpEnabled,
  setUcpEnabled,
  createCheckoutSession,
  getCheckoutSession,
  updateCheckoutSession,
  completeCheckoutSession,
  signResponse
};
