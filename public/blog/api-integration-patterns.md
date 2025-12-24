# API Integration Patterns

Learn how to integrate external services, handle webhooks, and build robust API connections for your store.

---

## Overview

API integrations enable:
- Third-party service connections
- Data synchronization
- Automated workflows
- External notifications
- Custom functionality

---

## Integration Methods

### REST API

Standard HTTP-based integration:

```javascript
// GET request
const response = await fetch('https://api.service.com/data', {
  headers: {
    'Authorization': 'Bearer token'
  }
});
const data = await response.json();

// POST request
const response = await fetch('https://api.service.com/create', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'value' })
});
```

### Webhooks

Event-driven notifications:

```javascript
// Receive webhook
app.post('/webhook/service', (req, res) => {
  const event = req.body;

  switch(event.type) {
    case 'order.created':
      handleNewOrder(event.data);
      break;
    case 'payment.completed':
      handlePayment(event.data);
      break;
  }

  res.status(200).send('OK');
});
```

### OAuth 2.0

Secure authorization:

```javascript
// Authorization URL
const authUrl = `https://service.com/oauth/authorize?
  client_id=${clientId}&
  redirect_uri=${redirectUri}&
  response_type=code&
  scope=read write`;

// Exchange code for token
const tokenResponse = await fetch('https://service.com/oauth/token', {
  method: 'POST',
  body: JSON.stringify({
    grant_type: 'authorization_code',
    code: authCode,
    client_id: clientId,
    client_secret: clientSecret
  })
});
```

---

## DainoStore API

### Authentication

All API calls require authentication:

```javascript
// Using API key
const response = await fetch('https://api.dainostore.com/v1/products', {
  headers: {
    'X-API-Key': 'your-api-key',
    'X-Store-ID': 'store-id'
  }
});

// Using Bearer token
const response = await fetch('https://api.dainostore.com/v1/products', {
  headers: {
    'Authorization': 'Bearer access-token'
  }
});
```

### Rate Limits

| Plan | Requests/Minute | Burst |
|------|-----------------|-------|
| Free | 60 | 100 |
| Pro | 300 | 500 |
| Enterprise | 1000 | 2000 |

Handle rate limits:

```javascript
async function apiCall(url) {
  const response = await fetch(url);

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    await sleep(retryAfter * 1000);
    return apiCall(url);
  }

  return response.json();
}
```

### Pagination

For list endpoints:

```javascript
// Request
GET /api/v1/products?page=1&limit=50

// Response
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500,
    "pages": 10
  }
}
```

Iterate all pages:

```javascript
async function getAllProducts() {
  let products = [];
  let page = 1;

  while (true) {
    const response = await fetch(`/api/products?page=${page}`);
    const data = await response.json();

    products = [...products, ...data.data];

    if (page >= data.pagination.pages) break;
    page++;
  }

  return products;
}
```

---

## Webhook Configuration

### Outgoing Webhooks

Send events to external services:

1. Go to **Settings > Webhooks**
2. Click **Add Webhook**
3. Configure:

| Field | Description |
|-------|-------------|
| URL | Endpoint to call |
| Events | Which events to send |
| Secret | For signature verification |
| Active | Enable/disable |

### Available Events

| Event | Trigger |
|-------|---------|
| order.created | New order placed |
| order.updated | Order modified |
| order.fulfilled | Order shipped |
| product.created | New product |
| product.updated | Product changed |
| customer.created | New customer |
| inventory.low | Stock below threshold |

### Webhook Payload

Standard format:

```json
{
  "id": "evt_123",
  "type": "order.created",
  "created": "2024-01-15T10:30:00Z",
  "data": {
    "id": "ord_456",
    "total": 99.99,
    "items": [...]
  },
  "store_id": "store_789"
}
```

### Signature Verification

Verify webhook authenticity:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## Incoming Webhooks

### Receiving External Webhooks

Create webhook endpoints:

```javascript
// In your plugin or custom code
app.post('/webhooks/stripe', async (req, res) => {
  // Verify Stripe signature
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(
    req.body,
    sig,
    webhookSecret
  );

  // Handle event
  if (event.type === 'payment_intent.succeeded') {
    await handlePayment(event.data.object);
  }

  res.status(200).json({ received: true });
});
```

### Webhook Best Practices

1. **Respond quickly** - Return 200 immediately
2. **Process async** - Queue heavy work
3. **Verify signatures** - Always authenticate
4. **Handle duplicates** - Idempotent processing
5. **Log everything** - Debug failures

---

## OAuth Integration

### Implementing OAuth

Connect to OAuth services:

```javascript
// Step 1: Redirect to authorize
app.get('/auth/service', (req, res) => {
  const authUrl = new URL('https://service.com/oauth/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', generateState());

  res.redirect(authUrl.toString());
});

// Step 2: Handle callback
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // Verify state
  if (!verifyState(state)) {
    return res.status(400).send('Invalid state');
  }

  // Exchange code for token
  const token = await exchangeCodeForToken(code);

  // Store token securely
  await saveToken(token);

  res.redirect('/settings/integrations');
});
```

### Token Refresh

Handle token expiration:

```javascript
async function getValidToken() {
  const token = await getStoredToken();

  if (isExpired(token)) {
    const newToken = await refreshToken(token.refresh_token);
    await saveToken(newToken);
    return newToken.access_token;
  }

  return token.access_token;
}
```

---

## Error Handling

### Retry Logic

Handle transient failures:

```javascript
async function apiCallWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response.json();
      }

      // Don't retry client errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      // Exponential backoff
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}
```

### Circuit Breaker

Prevent cascading failures:

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 30000) {
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.isOpen = false;
  }

  async call(fn) {
    if (this.isOpen) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.isOpen = true;
        setTimeout(() => this.isOpen = false, this.timeout);
      }
      throw error;
    }
  }
}
```

---

## Data Synchronization

### Full Sync

Initial data load:

```javascript
async function fullSync() {
  const externalProducts = await fetchAllExternalProducts();

  for (const product of externalProducts) {
    await upsertProduct(transformProduct(product));
  }

  console.log(`Synced ${externalProducts.length} products`);
}
```

### Incremental Sync

Sync only changes:

```javascript
async function incrementalSync() {
  const lastSync = await getLastSyncTime();

  const changes = await fetchChanges(lastSync);

  for (const change of changes) {
    switch (change.type) {
      case 'created':
      case 'updated':
        await upsertProduct(change.data);
        break;
      case 'deleted':
        await deleteProduct(change.id);
        break;
    }
  }

  await setLastSyncTime(new Date());
}
```

### Conflict Resolution

Handle sync conflicts:

```javascript
function resolveConflict(local, remote) {
  // Last write wins
  if (remote.updatedAt > local.updatedAt) {
    return remote;
  }

  // Or merge fields
  return {
    ...local,
    ...remote,
    // Keep local price
    price: local.price
  };
}
```

---

## Common Integration Patterns

### Event-Driven Architecture

```
Order Created
    |
    +-> Update Inventory System
    |
    +-> Notify Shipping Provider
    |
    +-> Send to CRM
    |
    +-> Trigger Email
```

### Saga Pattern

For distributed transactions:

```javascript
class OrderSaga {
  async execute(order) {
    try {
      await this.reserveInventory(order);
      await this.chargePayment(order);
      await this.createShipment(order);
      await this.sendConfirmation(order);
    } catch (error) {
      await this.compensate(order, error);
    }
  }

  async compensate(order, error) {
    // Rollback in reverse order
    await this.cancelShipment(order);
    await this.refundPayment(order);
    await this.releaseInventory(order);
  }
}
```

### Adapter Pattern

Normalize external APIs:

```javascript
class ShippingAdapter {
  constructor(provider) {
    this.provider = provider;
  }

  async createLabel(order) {
    switch (this.provider) {
      case 'ups':
        return this.createUPSLabel(order);
      case 'fedex':
        return this.createFedExLabel(order);
      default:
        throw new Error('Unknown provider');
    }
  }

  async createUPSLabel(order) {
    // UPS-specific implementation
  }

  async createFedExLabel(order) {
    // FedEx-specific implementation
  }
}
```

---

## Testing Integrations

### Mock External APIs

```javascript
// Mock service
const mockAPI = {
  async getProducts() {
    return [
      { id: 1, name: 'Product 1' },
      { id: 2, name: 'Product 2' }
    ];
  }
};

// Test
test('syncs products', async () => {
  const syncer = new ProductSyncer(mockAPI);
  await syncer.sync();

  expect(await Product.count()).toBe(2);
});
```

### Webhook Testing

Test webhook handlers:

```javascript
test('handles order webhook', async () => {
  const payload = {
    type: 'order.created',
    data: { id: 'ord_123', total: 99.99 }
  };

  const signature = generateSignature(payload);

  const response = await request(app)
    .post('/webhooks/orders')
    .set('X-Signature', signature)
    .send(payload);

  expect(response.status).toBe(200);
  expect(await Order.findById('ord_123')).toBeDefined();
});
```

---

## Security Best Practices

### API Keys

1. **Never expose in client** - Server-side only
2. **Use environment variables** - Don't hardcode
3. **Rotate regularly** - Schedule rotation
4. **Scope appropriately** - Minimal permissions

### Webhooks

1. **Verify signatures** - Always validate
2. **Use HTTPS** - Encrypted transport
3. **Validate payloads** - Schema validation
4. **Rate limit** - Prevent abuse

### OAuth

1. **Use state parameter** - Prevent CSRF
2. **Secure token storage** - Encrypt at rest
3. **Handle expiration** - Refresh properly
4. **Validate scopes** - Check permissions

---

## Monitoring and Logging

### Integration Metrics

Track:
- Request count
- Error rate
- Latency
- Success rate

### Logging

```javascript
async function apiCall(url) {
  const start = Date.now();

  try {
    const response = await fetch(url);
    const duration = Date.now() - start;

    logger.info('API call', {
      url,
      status: response.status,
      duration
    });

    return response;
  } catch (error) {
    logger.error('API call failed', {
      url,
      error: error.message
    });
    throw error;
  }
}
```

---

## Next Steps

After setting up integrations:

1. **Test thoroughly** - All scenarios
2. **Monitor health** - Set up alerts
3. **Document** - For team reference
4. **Plan for failures** - Error handling
5. **Review security** - Regular audits

See our Multi-Tenant Architecture guide for platform architecture.
