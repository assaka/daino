/**
 * Universal Commerce Protocol (UCP) Routes
 *
 * Implements the UCP specification for agentic commerce:
 * - /.well-known/ucp - Business profile discovery
 * - /api/ucp/checkout-sessions - Checkout session management
 *
 * @see https://ucp.dev/specification/overview
 */

const express = require('express');
const router = express.Router();
const { masterDbClient } = require('../database/masterConnection');
const ConnectionManager = require('../services/database/ConnectionManager');
const ucpService = require('../services/ucp-service');
const { buildStoreUrl } = require('../utils/domainConfig');

/**
 * Middleware to resolve store from request
 * Supports: x-store-id header, store_id query param, or domain resolution
 */
async function resolveStore(req, res, next) {
  try {
    // Check for store ID from various sources
    const storeId = req.storeId || req.headers['x-store-id'] || req.query.store_id;

    if (!storeId) {
      return res.status(400).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'store_not_specified',
          message: 'Store ID is required',
          severity: 'fatal'
        }]
      });
    }

    // Verify store exists and is active
    const { data: store, error } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      return res.status(404).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'store_not_found',
          message: 'Store not found',
          severity: 'fatal'
        }]
      });
    }

    // Check if UCP is enabled for this store
    const ucpEnabled = await ucpService.isUcpEnabled(storeId);
    if (!ucpEnabled) {
      return res.status(403).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'ucp_not_enabled',
          message: 'UCP is not enabled for this store',
          severity: 'fatal'
        }]
      });
    }

    req.ucpStore = store;
    req.storeId = storeId;
    next();
  } catch (error) {
    console.error('UCP store resolution error:', error);
    res.status(500).json({
      status: 'error',
      messages: [{
        type: 'error',
        code: 'internal_error',
        message: 'Internal server error',
        severity: 'fatal'
      }]
    });
  }
}

/**
 * Parse UCP-Agent header
 * @param {Object} req - Express request
 * @returns {Object|null} Agent profile info
 */
function parseUcpAgentHeader(req) {
  const agentHeader = req.headers['ucp-agent'];
  if (!agentHeader) return null;

  // Parse structured field (RFC 8941 format: profile="url")
  const match = agentHeader.match(/profile="([^"]+)"/);
  if (match) {
    return { profile: match[1] };
  }

  return null;
}

// =============================================================================
// PUBLIC ROUTES (no auth required - for agent discovery)
// =============================================================================

/**
 * GET /.well-known/ucp
 * UCP Business Profile Discovery Endpoint
 *
 * Returns the store's UCP business profile including capabilities,
 * services, and payment handlers.
 */
router.get('/profile/:storeSlug', async (req, res) => {
  try {
    const { storeSlug } = req.params;

    // Find store by slug
    const { data: masterStore, error: storeError } = await masterDbClient
      .from('stores')
      .select('*')
      .eq('slug', storeSlug)
      .single();

    if (storeError || !masterStore) {
      return res.status(404).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'store_not_found',
          message: 'Store not found',
          severity: 'fatal'
        }]
      });
    }

    // Check if UCP is enabled
    const ucpEnabled = await ucpService.isUcpEnabled(masterStore.id);
    if (!ucpEnabled) {
      return res.status(403).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'ucp_not_enabled',
          message: 'UCP is not enabled for this store',
          severity: 'fatal'
        }]
      });
    }

    // Build base URL
    const tenantDb = await ConnectionManager.getStoreConnection(masterStore.id);
    const baseUrl = await buildStoreUrl({
      tenantDb,
      storeId: masterStore.id,
      storeSlug: masterStore.slug
    });

    // Build and return the business profile
    const profile = await ucpService.buildBusinessProfile({
      storeId: masterStore.id,
      storeSlug: masterStore.slug,
      baseUrl
    });

    // Add UCP version header
    res.set('UCP-Version', ucpService.UCP_VERSION);
    res.set('Content-Type', 'application/json');

    res.json(profile);
  } catch (error) {
    console.error('UCP profile error:', error);
    res.status(500).json({
      status: 'error',
      messages: [{
        type: 'error',
        code: 'internal_error',
        message: 'Failed to build UCP profile',
        severity: 'fatal'
      }]
    });
  }
});

/**
 * GET /schemas/checkout.json
 * OpenAPI schema for checkout capability
 */
router.get('/schemas/checkout.json', (req, res) => {
  const schema = {
    openapi: '3.0.3',
    info: {
      title: 'UCP Checkout API',
      version: ucpService.UCP_VERSION,
      description: 'Checkout capability for Universal Commerce Protocol'
    },
    paths: {
      '/checkout-sessions': {
        post: {
          summary: 'Create checkout session',
          operationId: 'createCheckoutSession',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateCheckoutSessionRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Session created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CheckoutSession' }
                }
              }
            }
          }
        }
      },
      '/checkout-sessions/{sessionId}': {
        get: {
          summary: 'Get checkout session',
          operationId: 'getCheckoutSession',
          parameters: [{
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }],
          responses: {
            '200': {
              description: 'Session details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CheckoutSession' }
                }
              }
            }
          }
        },
        patch: {
          summary: 'Update checkout session',
          operationId: 'updateCheckoutSession',
          parameters: [{
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }],
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateCheckoutSessionRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Session updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CheckoutSession' }
                }
              }
            }
          }
        }
      },
      '/checkout-sessions/{sessionId}/complete': {
        post: {
          summary: 'Complete checkout session',
          operationId: 'completeCheckoutSession',
          parameters: [{
            name: 'sessionId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' }
          }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CompleteCheckoutRequest' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Checkout completed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CheckoutCompletionResult' }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        CreateCheckoutSessionRequest: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['product_id', 'quantity'],
                properties: {
                  product_id: { type: 'string', format: 'uuid' },
                  quantity: { type: 'integer', minimum: 1 }
                }
              }
            },
            customer: { $ref: '#/components/schemas/Customer' },
            shipping_address: { $ref: '#/components/schemas/Address' },
            billing_address: { $ref: '#/components/schemas/Address' },
            metadata: { type: 'object' }
          }
        },
        UpdateCheckoutSessionRequest: {
          type: 'object',
          properties: {
            customer: { $ref: '#/components/schemas/Customer' },
            shipping_address: { $ref: '#/components/schemas/Address' },
            billing_address: { $ref: '#/components/schemas/Address' },
            metadata: { type: 'object' }
          }
        },
        CompleteCheckoutRequest: {
          type: 'object',
          required: ['payment'],
          properties: {
            payment: {
              type: 'object',
              required: ['method'],
              properties: {
                method: { type: 'string' },
                token: { type: 'string' },
                status: { type: 'string', enum: ['pending', 'paid', 'failed'] }
              }
            }
          }
        },
        CheckoutSession: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            store_id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['open', 'completed', 'expired', 'cancelled'] },
            line_items: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
            customer: { $ref: '#/components/schemas/Customer' },
            shipping_address: { $ref: '#/components/schemas/Address' },
            billing_address: { $ref: '#/components/schemas/Address' },
            subtotal: { type: 'integer', description: 'Amount in minor units (cents)' },
            tax_amount: { type: 'integer' },
            shipping_amount: { type: 'integer' },
            total: { type: 'integer' },
            currency: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            expires_at: { type: 'string', format: 'date-time' }
          }
        },
        CheckoutCompletionResult: {
          type: 'object',
          properties: {
            session_id: { type: 'string', format: 'uuid' },
            order_id: { type: 'string', format: 'uuid' },
            order_number: { type: 'string' },
            status: { type: 'string' },
            total: { type: 'integer' },
            currency: { type: 'string' }
          }
        },
        LineItem: {
          type: 'object',
          properties: {
            product_id: { type: 'string', format: 'uuid' },
            sku: { type: 'string' },
            name: { type: 'string' },
            quantity: { type: 'integer' },
            unit_price: { type: 'integer' },
            total: { type: 'integer' },
            currency: { type: 'string' },
            image_url: { type: 'string', format: 'uri' }
          }
        },
        Customer: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' }
          }
        },
        Address: {
          type: 'object',
          properties: {
            line1: { type: 'string' },
            line2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postal_code: { type: 'string' },
            country: { type: 'string' }
          }
        }
      }
    }
  };

  res.set('Content-Type', 'application/json');
  res.json(schema);
});

// =============================================================================
// CHECKOUT SESSION ROUTES (require store resolution)
// =============================================================================

/**
 * POST /checkout-sessions
 * Create a new UCP checkout session
 */
router.post('/checkout-sessions', resolveStore, async (req, res) => {
  try {
    const { items, customer, shipping_address, billing_address, metadata } = req.body;

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'invalid_items',
          message: 'Items array is required and must not be empty',
          severity: 'requires_buyer_input'
        }]
      });
    }

    // Log agent info if present
    const agentInfo = parseUcpAgentHeader(req);
    if (agentInfo) {
      console.log(`UCP checkout session created by agent: ${agentInfo.profile}`);
    }

    const session = await ucpService.createCheckoutSession({
      storeId: req.storeId,
      items,
      customer,
      shippingAddress: shipping_address,
      billingAddress: billing_address,
      metadata: {
        ...metadata,
        agent_profile: agentInfo?.profile
      }
    });

    // Add UCP headers
    res.set('UCP-Version', ucpService.UCP_VERSION);

    res.status(201).json({
      status: 'success',
      ucp: { version: ucpService.UCP_VERSION },
      data: session
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({
      status: 'error',
      messages: [{
        type: 'error',
        code: 'session_creation_failed',
        message: error.message,
        severity: 'fatal'
      }]
    });
  }
});

/**
 * GET /checkout-sessions/:sessionId
 * Get checkout session details
 */
router.get('/checkout-sessions/:sessionId', resolveStore, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ucpService.getCheckoutSession(req.storeId, sessionId);

    if (!session) {
      return res.status(404).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'session_not_found',
          message: 'Checkout session not found',
          severity: 'fatal'
        }]
      });
    }

    res.set('UCP-Version', ucpService.UCP_VERSION);

    res.json({
      status: 'success',
      ucp: { version: ucpService.UCP_VERSION },
      data: session
    });
  } catch (error) {
    console.error('Get checkout session error:', error);
    res.status(500).json({
      status: 'error',
      messages: [{
        type: 'error',
        code: 'internal_error',
        message: error.message,
        severity: 'fatal'
      }]
    });
  }
});

/**
 * PATCH /checkout-sessions/:sessionId
 * Update checkout session (add shipping, customer info, etc.)
 */
router.patch('/checkout-sessions/:sessionId', resolveStore, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    const session = await ucpService.updateCheckoutSession(req.storeId, sessionId, updates);

    res.set('UCP-Version', ucpService.UCP_VERSION);

    res.json({
      status: 'success',
      ucp: { version: ucpService.UCP_VERSION },
      data: session
    });
  } catch (error) {
    console.error('Update checkout session error:', error);

    if (error.message === 'Session not found') {
      return res.status(404).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'session_not_found',
          message: 'Checkout session not found',
          severity: 'fatal'
        }]
      });
    }

    res.status(500).json({
      status: 'error',
      messages: [{
        type: 'error',
        code: 'update_failed',
        message: error.message,
        severity: 'fatal'
      }]
    });
  }
});

/**
 * POST /checkout-sessions/:sessionId/complete
 * Complete checkout and create order
 */
router.post('/checkout-sessions/:sessionId/complete', resolveStore, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { payment } = req.body;

    if (!payment) {
      return res.status(400).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'payment_required',
          message: 'Payment information is required',
          severity: 'requires_buyer_input'
        }]
      });
    }

    const result = await ucpService.completeCheckoutSession(req.storeId, sessionId, payment);

    res.set('UCP-Version', ucpService.UCP_VERSION);

    res.json({
      status: 'success',
      ucp: { version: ucpService.UCP_VERSION },
      data: result
    });
  } catch (error) {
    console.error('Complete checkout session error:', error);

    if (error.message === 'Session not found') {
      return res.status(404).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'session_not_found',
          message: 'Checkout session not found',
          severity: 'fatal'
        }]
      });
    }

    if (error.message === 'Session already completed') {
      return res.status(400).json({
        status: 'error',
        messages: [{
          type: 'error',
          code: 'session_completed',
          message: 'This checkout session has already been completed',
          severity: 'fatal'
        }]
      });
    }

    res.status(500).json({
      status: 'error',
      messages: [{
        type: 'error',
        code: 'completion_failed',
        message: error.message,
        severity: 'fatal'
      }]
    });
  }
});

// =============================================================================
// ADMIN ROUTES (for store owners to manage UCP settings)
// =============================================================================

/**
 * GET /settings
 * Get UCP settings for the authenticated user's store
 */
router.get('/settings', resolveStore, async (req, res) => {
  try {
    const tenantDb = await ConnectionManager.getStoreConnection(req.storeId);

    const { data: store } = await tenantDb
      .from('stores')
      .select('settings')
      .eq('id', req.storeId)
      .single();

    const ucpSettings = {
      enabled: store?.settings?.ucp_enabled || false,
      has_signing_keys: !!store?.settings?.ucp_signing_keys
    };

    res.json({
      success: true,
      data: ucpSettings
    });
  } catch (error) {
    console.error('Get UCP settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get UCP settings'
    });
  }
});

/**
 * POST /settings/enable
 * Enable UCP for the store
 */
router.post('/settings/enable', resolveStore, async (req, res) => {
  try {
    const settings = await ucpService.setUcpEnabled(req.storeId, true);

    res.json({
      success: true,
      message: 'UCP enabled successfully',
      data: {
        enabled: settings.ucp_enabled,
        has_signing_keys: !!settings.ucp_signing_keys
      }
    });
  } catch (error) {
    console.error('Enable UCP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enable UCP'
    });
  }
});

/**
 * POST /settings/disable
 * Disable UCP for the store
 */
router.post('/settings/disable', resolveStore, async (req, res) => {
  try {
    const settings = await ucpService.setUcpEnabled(req.storeId, false);

    res.json({
      success: true,
      message: 'UCP disabled successfully',
      data: {
        enabled: settings.ucp_enabled
      }
    });
  } catch (error) {
    console.error('Disable UCP error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable UCP'
    });
  }
});

/**
 * POST /settings/rotate-keys
 * Generate new signing keys (invalidates old ones)
 */
router.post('/settings/rotate-keys', resolveStore, async (req, res) => {
  try {
    const tenantDb = await ConnectionManager.getStoreConnection(req.storeId);

    // Generate new keys
    const newKeys = ucpService.generateSigningKeyPair();

    // Get current settings
    const { data: store } = await tenantDb
      .from('stores')
      .select('settings')
      .eq('id', req.storeId)
      .single();

    const settings = store?.settings || {};
    settings.ucp_signing_keys = newKeys;

    // Save new keys
    await tenantDb
      .from('stores')
      .update({ settings })
      .eq('id', req.storeId);

    res.json({
      success: true,
      message: 'Signing keys rotated successfully',
      data: {
        public_key: newKeys.publicKey
      }
    });
  } catch (error) {
    console.error('Rotate keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rotate signing keys'
    });
  }
});

module.exports = router;
