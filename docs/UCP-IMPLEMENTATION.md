# Universal Commerce Protocol (UCP) Implementation Guide

This document provides technical documentation for the UCP implementation in DainoStore.

## Overview

UCP (Universal Commerce Protocol) is an open standard for agentic commerce, enabling AI agents to discover, browse, and purchase products from your store. This implementation follows the [UCP specification](https://ucp.dev/specification/overview).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Agent                                │
│              (Google Gemini, ChatGPT, etc.)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   UCP Endpoints                              │
│  /.well-known/ucp          - Business Profile Discovery     │
│  /api/ucp/checkout-sessions - Checkout Session Management   │
│  /api/ucp/schemas/*        - OpenAPI Schemas                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   UCP Service                                │
│  - Signing Key Management                                    │
│  - Business Profile Builder                                  │
│  - Checkout Session Logic                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Existing Store Services                      │
│  - Products, Cart, Orders                                    │
│  - Payment Processing (Stripe)                               │
│  - Tax & Shipping Calculation                                │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
backend/src/
├── services/
│   └── ucp-service.js          # Core UCP service
├── routes/
│   └── ucp.js                  # UCP API routes
└── server.js                   # /.well-known/ucp endpoint

src/pages/admin/
└── UCPSettings.jsx             # Admin settings page
```

## API Reference

### Discovery Endpoint

#### GET `/.well-known/ucp` (via `/public/:storeSlug/.well-known/ucp`)

Returns the business profile for a store, enabling AI agent discovery.

**Response Headers:**
- `Content-Type: application/json`
- `UCP-Version: 2026-01-11`
- `Cache-Control: public, max-age=300`

**Response Body:**
```json
{
  "ucp": {
    "version": "2026-01-11",
    "services": [
      {
        "name": "com.dainostore.{storeSlug}.checkout",
        "version": "2026-01-11",
        "spec": "https://{baseUrl}/.well-known/ucp/spec/checkout",
        "rest": {
          "schema": "https://{baseUrl}/api/ucp/schemas/checkout.json",
          "endpoint": "https://{baseUrl}/api/ucp"
        }
      }
    ],
    "capabilities": [
      {
        "name": "dev.ucp.shopping.checkout",
        "version": "2026-01-11",
        "spec": "https://ucp.dev/specification/capabilities/checkout",
        "config": {
          "supports_guest_checkout": true,
          "supports_shipping": true,
          "supports_tax_calculation": true,
          "supports_coupons": true,
          "supported_currencies": ["USD"],
          "supported_countries": ["US"]
        }
      }
    ]
  },
  "payment": {
    "handlers": [
      {
        "id": "{storeSlug}-stripe",
        "name": "com.stripe.payments",
        "version": "2026-01-11",
        "spec": "https://stripe.com/docs/ucp",
        "config": {
          "supported_methods": ["card", "apple_pay", "google_pay"]
        }
      }
    ]
  },
  "signing_keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "x": "...",
      "y": "...",
      "kid": "uuid",
      "use": "sig",
      "alg": "ES256"
    }
  ],
  "business": {
    "name": "Store Name",
    "description": "Store description",
    "logo_url": "https://...",
    "website": "https://...",
    "contact": {
      "email": "store@example.com",
      "phone": "+1..."
    },
    "address": {
      "line1": "...",
      "city": "...",
      "state": "...",
      "postal_code": "...",
      "country": "US"
    }
  }
}
```

**Error Responses:**
- `404` - Store not found
- `403` - UCP not enabled for store
- `500` - Internal server error

---

### Checkout Session Endpoints

#### POST `/api/ucp/checkout-sessions`

Create a new checkout session.

**Headers:**
- `Content-Type: application/json`
- `X-Store-Id: {storeId}` or `?store_id={storeId}`
- `UCP-Agent: profile="https://agent.example/profile.json"` (optional)

**Request Body:**
```json
{
  "items": [
    {
      "product_id": "uuid",
      "quantity": 2
    }
  ],
  "customer": {
    "email": "customer@example.com",
    "phone": "+1234567890",
    "first_name": "John",
    "last_name": "Doe"
  },
  "shipping_address": {
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "billing_address": {
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "metadata": {}
}
```

**Response:**
```json
{
  "status": "success",
  "ucp": {
    "version": "2026-01-11"
  },
  "data": {
    "id": "uuid",
    "store_id": "uuid",
    "status": "open",
    "line_items": [
      {
        "product_id": "uuid",
        "sku": "PROD-001",
        "name": "Product Name",
        "quantity": 2,
        "unit_price": 2999,
        "total": 5998,
        "currency": "USD",
        "image_url": "https://..."
      }
    ],
    "customer": {...},
    "shipping_address": {...},
    "billing_address": {...},
    "subtotal": 5998,
    "tax_amount": 540,
    "shipping_amount": 500,
    "total": 7038,
    "currency": "USD",
    "created_at": "2026-01-13T10:00:00Z",
    "updated_at": "2026-01-13T10:00:00Z",
    "expires_at": "2026-01-13T10:30:00Z"
  }
}
```

---

#### GET `/api/ucp/checkout-sessions/:sessionId`

Retrieve checkout session details.

**Response:** Same as creation response.

---

#### PATCH `/api/ucp/checkout-sessions/:sessionId`

Update a checkout session (add customer info, shipping address, etc.).

**Request Body:**
```json
{
  "customer": {...},
  "shipping_address": {...},
  "billing_address": {...},
  "metadata": {...}
}
```

---

#### POST `/api/ucp/checkout-sessions/:sessionId/complete`

Complete the checkout and create an order.

**Request Body:**
```json
{
  "payment": {
    "method": "stripe",
    "token": "tok_...",
    "status": "paid"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "ucp": {
    "version": "2026-01-11"
  },
  "data": {
    "session_id": "uuid",
    "order_id": "uuid",
    "order_number": "ORD-1234567890-ABCDEF",
    "status": "completed",
    "total": 7038,
    "currency": "USD"
  }
}
```

---

### Admin Settings Endpoints

#### GET `/api/ucp/settings`

Get UCP settings for the store.

**Response:**
```json
{
  "success": true,
  "data": {
    "enabled": false,
    "has_signing_keys": false
  }
}
```

#### POST `/api/ucp/settings/enable`

Enable UCP for the store. Automatically generates signing keys.

#### POST `/api/ucp/settings/disable`

Disable UCP for the store.

#### POST `/api/ucp/settings/rotate-keys`

Generate new signing keys (invalidates old ones).

---

## Service Methods

### `ucp-service.js`

#### `generateSigningKeyPair()`
Generates EC P-256 key pair in JWK format for request signing.

#### `getOrCreateSigningKeys(storeId)`
Gets existing signing keys or creates new ones for a store.

#### `buildBusinessProfile({ storeId, storeSlug, baseUrl })`
Builds the complete UCP business profile for a store.

#### `isUcpEnabled(storeId)`
Checks if UCP is enabled for a store.

#### `setUcpEnabled(storeId, enabled)`
Enables or disables UCP for a store.

#### `createCheckoutSession({ storeId, items, customer, shippingAddress, billingAddress, metadata })`
Creates a new checkout session.

#### `getCheckoutSession(storeId, sessionId)`
Retrieves a checkout session.

#### `updateCheckoutSession(storeId, sessionId, updates)`
Updates a checkout session.

#### `completeCheckoutSession(storeId, sessionId, payment)`
Completes checkout and creates an order.

#### `signResponse(storeId, payload)`
Signs a response payload with the store's private key.

---

## Database Schema

UCP uses existing tables with additional settings:

### Store Settings (JSON field)

```json
{
  "ucp_enabled": true,
  "ucp_signing_keys": {
    "publicKey": {
      "kty": "EC",
      "crv": "P-256",
      "x": "...",
      "y": "...",
      "kid": "uuid",
      "use": "sig",
      "alg": "ES256"
    },
    "privateKey": {
      "kty": "EC",
      "crv": "P-256",
      "x": "...",
      "y": "...",
      "d": "...",
      "kid": "uuid",
      "use": "sig",
      "alg": "ES256"
    }
  }
}
```

### Cart Table (for UCP sessions)

UCP sessions are stored in the `carts` table with `metadata.ucp_session = true`:

```json
{
  "ucp_session": true,
  "customer": {...},
  "shipping_address": {...},
  "billing_address": {...},
  "status": "open",
  "expires_at": "2026-01-13T10:30:00Z"
}
```

---

## Security

### Request Authentication

UCP requests include an `UCP-Agent` header identifying the calling agent:

```
UCP-Agent: profile="https://agent.example/profiles/shopping-agent.json"
```

### Response Signing

Responses can be signed using EC P-256 keys for verification:

```javascript
const signature = await ucpService.signResponse(storeId, responsePayload);
```

### Key Rotation

Signing keys can be rotated via the admin API. Old keys are immediately invalidated.

---

## Error Handling

All errors follow the UCP error format:

```json
{
  "status": "error",
  "messages": [
    {
      "type": "error",
      "code": "error_code",
      "message": "Human-readable message",
      "severity": "fatal|requires_buyer_input"
    }
  ]
}
```

### Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `store_not_found` | 404 | Store does not exist |
| `ucp_not_enabled` | 403 | UCP is disabled for store |
| `session_not_found` | 404 | Checkout session not found |
| `session_completed` | 400 | Session already completed |
| `invalid_items` | 400 | Items array is invalid |
| `payment_required` | 400 | Payment info missing |
| `internal_error` | 500 | Server error |

---

## Testing

### UCP Playground

Test your integration at [ucp.dev/playground](https://ucp.dev/playground/).

### Local Testing

1. Enable UCP for a test store
2. Access `http://localhost:5000/public/{storeSlug}/.well-known/ucp`
3. Create a checkout session via POST to `/api/ucp/checkout-sessions`

### Example cURL Commands

**Get Business Profile:**
```bash
curl -X GET "http://localhost:5000/public/my-store/.well-known/ucp"
```

**Create Checkout Session:**
```bash
curl -X POST "http://localhost:5000/api/ucp/checkout-sessions?store_id=<uuid>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product_id": "<uuid>", "quantity": 1}]
  }'
```

**Complete Checkout:**
```bash
curl -X POST "http://localhost:5000/api/ucp/checkout-sessions/<session_id>/complete?store_id=<uuid>" \
  -H "Content-Type: application/json" \
  -d '{
    "payment": {"method": "stripe", "status": "paid"}
  }'
```

---

## Future Enhancements

### Planned Features

1. **Identity Linking** - OAuth 2.0 account linking for loyalty programs
2. **Order Webhooks** - Push order updates to AI platforms
3. **MCP Transport** - Model Context Protocol binding
4. **A2A Support** - Agent-to-Agent communication
5. **AP2 Integration** - Agent Payments Protocol for enhanced security

### Integration Roadmap

- [ ] Stripe payment token exchange
- [ ] Google Pay integration
- [ ] Apple Pay integration
- [ ] PayPal integration
- [ ] Real-time inventory validation
- [ ] Dynamic pricing support

---

## Resources

- [UCP Specification](https://ucp.dev/specification/overview)
- [Google Developer Guide](https://developers.google.com/merchant/ucp)
- [GitHub Repository](https://github.com/Universal-Commerce-Protocol/ucp)
- [OpenAI ACP (related)](https://openai.com/acp)
