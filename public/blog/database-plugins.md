# Database Plugins: No-Code Extensions for Your Store

Build custom functionality for your store without uploading files. Database plugins store all code directly in your store's database, making them easy to create, update, and manage through the admin interface or API.

---

## Overview

Database plugins let you:
- Extend store functionality without file uploads
- Create custom API endpoints
- Hook into store events (orders, products, customers)
- Store plugin-specific data
- Run safely in a sandboxed environment

**Best for:**
- Custom pricing rules
- Order processing workflows
- Product transformations
- Simple integrations
- Store-specific business logic

---

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                  Your Store Database                 │
├─────────────────────────────────────────────────────┤
│  plugin_registry     - Plugin definitions            │
│  plugin_hooks        - Event handlers                │
│  plugin_endpoints    - Custom API routes             │
│  plugin_scripts      - Reusable code modules         │
│  plugin_data         - Key-value storage             │
│  plugin_dependencies - Bundled libraries             │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│              Plugin Sandbox (Secure VM)              │
│  - 5 second timeout                                  │
│  - No filesystem access                              │
│  - Restricted network (allowlist only)               │
│  - Memory limits                                     │
└─────────────────────────────────────────────────────┘
```

---

## Creating a Plugin

### Via Admin UI

1. Go to **Settings > Plugins > Create Plugin**
2. Enter plugin details:
   - Name and description
   - Category (commerce, utility, integration)
   - Permissions required
3. Add hooks, endpoints, or scripts
4. Activate the plugin

### Via API

```javascript
// Register a new plugin
POST /api/plugins/registry

{
  "id": "my-custom-plugin",
  "name": "My Custom Plugin",
  "version": "1.0.0",
  "description": "Adds custom functionality to my store",
  "type": "custom",
  "category": "utility",
  "permissions": ["products:read", "orders:read"],
  "tags": ["custom", "automation"]
}
```

Response:
```json
{
  "success": true,
  "pluginId": "my-custom-plugin"
}
```

---

## Hooks

Hooks let your plugin respond to store events. When an event occurs, all registered hooks execute in priority order.

### Available Hooks

| Hook | Trigger | Use Case |
|------|---------|----------|
| `order.created` | New order placed | Send notifications, update inventory |
| `order.updated` | Order modified | Sync with external systems |
| `order.fulfilled` | Order shipped | Trigger follow-up emails |
| `product.created` | New product added | Auto-categorize, validate |
| `product.updated` | Product modified | Sync prices, update feeds |
| `customer.created` | New customer | Welcome flow, CRM sync |
| `cart.updated` | Cart changed | Apply custom discounts |
| `checkout.completed` | Checkout finished | Post-purchase processing |

### Registering a Hook

```javascript
// Register a hook for your plugin
POST /api/plugins/registry/my-custom-plugin/hooks

{
  "hook_name": "order.created",
  "priority": 10,
  "enabled": true,
  "handler_code": `
    // 'input' contains the order data
    console.log('New order:', input.id);

    // Apply loyalty points
    const points = Math.floor(input.total);

    // Return modified data (or same data if no changes)
    return {
      ...input,
      metadata: {
        ...input.metadata,
        loyalty_points_earned: points
      }
    };
  `
}
```

### Hook Execution Context

Your hook code receives:

| Variable | Description |
|----------|-------------|
| `input` | The event data (order, product, etc.) |
| `context` | Store info, user, timestamp |
| `hookName` | Name of the hook being executed |
| `console` | Logging (log, warn, error) |

### Hook Priority

Lower numbers run first:

```javascript
// Runs first (priority 1)
{ "hook_name": "order.created", "priority": 1, "handler_code": "..." }

// Runs second (priority 10)
{ "hook_name": "order.created", "priority": 10, "handler_code": "..." }

// Runs last (priority 100)
{ "hook_name": "order.created", "priority": 100, "handler_code": "..." }
```

---

## Custom API Endpoints

Create custom API routes for your plugin.

### Register an Endpoint

```javascript
POST /api/plugins/registry/my-custom-plugin/endpoints

{
  "method": "GET",
  "path": "/stats",
  "enabled": true,
  "handler_code": `
    // Access request data
    const { query, params, user, storeId } = req;

    // Your logic here
    const stats = {
      totalOrders: 150,
      revenue: 15000,
      topProduct: 'Widget Pro'
    };

    // Send response
    res.json({ success: true, data: stats });
  `
}
```

### Calling Your Endpoint

```javascript
GET /api/plugins/dynamic/my-custom-plugin/stats

// Response:
{
  "success": true,
  "data": {
    "totalOrders": 150,
    "revenue": 15000,
    "topProduct": "Widget Pro"
  }
}
```

### Endpoint Context

Your endpoint code receives:

| Variable | Description |
|----------|-------------|
| `req.method` | HTTP method (GET, POST, etc.) |
| `req.params` | URL parameters |
| `req.query` | Query string parameters |
| `req.body` | Request body (POST/PUT) |
| `req.headers` | Request headers |
| `req.user` | Authenticated user (if any) |
| `req.storeId` | Current store ID |
| `res.json()` | Send JSON response |
| `res.status()` | Set HTTP status code |

---

## Plugin Data Storage

Store plugin-specific data using the key-value storage API.

### Save Data

```javascript
PUT /api/plugins/registry/my-custom-plugin/data/settings

{
  "value": {
    "notificationsEnabled": true,
    "discountThreshold": 100,
    "welcomeMessage": "Thanks for shopping!"
  }
}
```

### Retrieve Data

```javascript
GET /api/plugins/registry/my-custom-plugin/data/settings

// Response:
{
  "success": true,
  "data": {
    "notificationsEnabled": true,
    "discountThreshold": 100,
    "welcomeMessage": "Thanks for shopping!"
  }
}
```

### Delete Data

```javascript
DELETE /api/plugins/registry/my-custom-plugin/data/settings
```

### Using Storage in Hook/Endpoint Code

```javascript
// In your handler_code:
const settings = await DainoStoreAPI.storage.get('settings');

if (settings.notificationsEnabled) {
  // Send notification
}

// Update storage
await DainoStoreAPI.storage.set('lastRun', new Date().toISOString());
```

---

## Plugin Scripts

Break your plugin into reusable modules.

### Register a Script

```javascript
POST /api/plugins/registry/my-custom-plugin/scripts

{
  "name": "pricing-utils",
  "type": "module",
  "order_index": 1,
  "exports": ["calculateDiscount", "applyTax"],
  "code": `
    function calculateDiscount(total, percentage) {
      return total * (1 - percentage / 100);
    }

    function applyTax(amount, rate) {
      return amount * (1 + rate / 100);
    }

    module.exports = { calculateDiscount, applyTax };
  `
}
```

---

## Available APIs

Inside your plugin code, you have access to:

### DainoStoreAPI

```javascript
// Store information
const store = DainoStoreAPI.getStoreInfo(storeId);
// { id, name, url, theme }

// Key-value storage
await DainoStoreAPI.storage.get('key');
await DainoStoreAPI.storage.set('key', value);
await DainoStoreAPI.storage.remove('key');

// Events
DainoStoreAPI.events.on('custom-event', handler);
DainoStoreAPI.events.emit('custom-event', data);

// Utilities
DainoStoreAPI.utils.formatCurrency(99.99, 'USD');  // "$99.99"
DainoStoreAPI.utils.formatDate(new Date());         // "1/15/2025"
DainoStoreAPI.utils.generateId();                   // "x7k2m9p4q"
DainoStoreAPI.utils.escapeHTML('<script>');         // "&lt;script&gt;"
```

### Safe Globals

```javascript
// Available in sandbox:
console.log(), console.warn(), console.error()
JSON.parse(), JSON.stringify()
Date, Math
parseInt(), parseFloat()
encodeURIComponent(), decodeURIComponent()
setTimeout(), setInterval()  // Limited delays
```

### HTTP Requests (Restricted)

```javascript
// Only allowed domains can be called:
const response = await DainoStoreAPI.fetch('https://api.stripe.com/v1/charges', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer sk_...' },
  body: JSON.stringify({ amount: 1000 })
});

const data = await response.json();
```

**Allowed domains:**
- api.stripe.com
- api.paypal.com
- graph.facebook.com
- api.twitter.com

---

## Example: Custom Pricing Plugin

A complete example showing hooks, storage, and endpoints.

### 1. Register the Plugin

```javascript
POST /api/plugins/registry

{
  "id": "tiered-pricing",
  "name": "Tiered Pricing",
  "version": "1.0.0",
  "description": "Apply volume discounts based on order quantity",
  "category": "commerce",
  "permissions": ["orders:read", "products:read"]
}
```

### 2. Add Pricing Rules (Data)

```javascript
PUT /api/plugins/registry/tiered-pricing/data/rules

{
  "value": {
    "tiers": [
      { "minQty": 1, "discount": 0 },
      { "minQty": 10, "discount": 5 },
      { "minQty": 25, "discount": 10 },
      { "minQty": 50, "discount": 15 },
      { "minQty": 100, "discount": 20 }
    ]
  }
}
```

### 3. Add Cart Hook

```javascript
POST /api/plugins/registry/tiered-pricing/hooks

{
  "hook_name": "cart.updated",
  "priority": 5,
  "handler_code": `
    const rules = await DainoStoreAPI.storage.get('rules');
    const cart = input;

    // Calculate total quantity
    const totalQty = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    // Find applicable tier
    const tier = rules.tiers
      .filter(t => totalQty >= t.minQty)
      .sort((a, b) => b.minQty - a.minQty)[0];

    if (tier && tier.discount > 0) {
      // Apply discount
      const discountAmount = cart.subtotal * (tier.discount / 100);

      return {
        ...cart,
        discounts: [
          ...cart.discounts,
          {
            type: 'volume',
            name: 'Volume Discount (' + tier.discount + '%)',
            amount: discountAmount
          }
        ],
        total: cart.subtotal - discountAmount
      };
    }

    return cart;
  `
}
```

### 4. Add Admin Endpoint

```javascript
POST /api/plugins/registry/tiered-pricing/endpoints

{
  "method": "GET",
  "path": "/tiers",
  "handler_code": `
    const rules = await DainoStoreAPI.storage.get('rules');
    res.json({ success: true, tiers: rules?.tiers || [] });
  `
}
```

---

## Security & Limitations

### Sandbox Restrictions

| Feature | Status |
|---------|--------|
| Filesystem access | Blocked |
| Arbitrary HTTP requests | Blocked (allowlist only) |
| Node.js modules | Blocked (except crypto, url, querystring) |
| process, global, __dirname | Blocked |
| eval, Function constructor | Blocked |
| Execution time | 5 seconds max |
| Memory | 32MB max |
| Output size | 10KB max |

### What You CAN'T Do

- Call arbitrary external APIs (only allowlisted domains)
- Read/write files on the server
- Import npm packages
- Run long-running processes
- Access other stores' data

### What You CAN Do

- Process store events (orders, products, etc.)
- Transform data in hooks
- Store plugin configuration
- Create custom API endpoints
- Call approved payment/social APIs
- Use basic JavaScript utilities

---

## Managing Plugins

### List All Plugins

```javascript
GET /api/plugins/registry
```

### Get Plugin Details

```javascript
GET /api/plugins/registry/my-custom-plugin

// Response includes:
// - Plugin metadata
// - Registered hooks
// - Endpoints
// - Scripts
// - Dependencies
```

### Update Plugin Status

```javascript
PATCH /api/plugins/registry/my-custom-plugin/status

{
  "status": "inactive"  // active, inactive, error
}
```

### Delete Plugin

```javascript
DELETE /api/plugins/registry/my-custom-plugin
```

---

## Debugging

### View Execution Logs

Plugin console.log outputs are prefixed with the plugin ID:

```
[Plugin tiered-pricing] Processing cart with 5 items
[Plugin tiered-pricing] Applied 10% volume discount
```

### Test Hook Execution

```javascript
POST /api/plugins/hooks/cart.updated

{
  "input": {
    "items": [{ "id": "prod-1", "quantity": 25, "price": 10 }],
    "subtotal": 250
  },
  "context": {}
}

// Response shows all hook executions:
{
  "success": true,
  "data": { /* transformed cart */ },
  "hookExecutions": [
    { "pluginId": "tiered-pricing", "success": true, "executionTime": 12 }
  ]
}
```

---

## Best Practices

1. **Keep hooks fast** - Under 1 second execution time
2. **Use storage wisely** - Cache computed values
3. **Handle errors gracefully** - Return original input if processing fails
4. **Log meaningfully** - Debug without spam
5. **Test thoroughly** - Use the hooks test endpoint
6. **Version your plugins** - Track changes in version field

---

## Database Plugins vs File Plugins

| Feature | Database Plugins | File Plugins |
|---------|------------------|--------------|
| Setup | No files needed | Requires file upload |
| Security | Sandboxed | Full server access |
| External APIs | Allowlist only | Unrestricted |
| npm packages | Not available | Full access |
| UI components | Limited | Full React components |
| Background jobs | Not available | Full scheduling |
| Best for | Simple customizations | Complex integrations |

---

## Next Steps

1. **Start simple** - Create a plugin with one hook
2. **Test the flow** - Use the hooks test endpoint
3. **Add endpoints** - Build admin functionality
4. **Iterate** - Expand based on needs

For complex integrations requiring external API access or background jobs, see our Workflow Integrations guide for connecting to n8n, Zapier, and Make.
