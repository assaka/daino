# Building Custom Plugins

Extend DainoStore's functionality with custom plugins. Learn the architecture, hooks, and best practices for plugin development.

---

## Overview

Plugins let you:
- Add custom features
- Integrate third-party services
- Modify existing behavior
- Create reusable extensions
- Build for the marketplace

---

## Plugin Architecture

### Plugin Structure

A plugin follows this structure:

```
my-plugin/
  - manifest.json       # Plugin metadata
  - index.js           # Main entry point
  - routes/            # API routes
  - hooks/             # Event handlers
  - components/        # UI components
  - migrations/        # Database migrations
  - assets/            # Static files
```

### Manifest File

Define your plugin:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "displayName": "My Custom Plugin",
  "description": "Adds custom functionality",
  "author": "Your Name",
  "permissions": [
    "products:read",
    "orders:read",
    "settings:write"
  ],
  "hooks": [
    "order.created",
    "product.updated"
  ],
  "settings": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "required": true
    }
  }
}
```

---

## Getting Started

### Create Plugin

1. Go to **Settings > Plugins > Developer**
2. Click **Create Plugin**
3. Enter basic info
4. Download scaffold

### Local Development

Set up development environment:

```bash
# Clone plugin template
git clone https://github.com/dainostore/plugin-template my-plugin

# Install dependencies
cd my-plugin
npm install

# Start development server
npm run dev
```

### Development Mode

Enable in your store:
1. Go to **Settings > Plugins**
2. Enable **Developer Mode**
3. Load local plugin

---

## Plugin Entry Point

### Main File

```javascript
// index.js
module.exports = {
  // Called when plugin is activated
  async activate(context) {
    console.log('Plugin activated');

    // Register hooks
    context.hooks.on('order.created', this.onOrderCreated);

    // Register routes
    context.routes.register(require('./routes'));
  },

  // Called when plugin is deactivated
  async deactivate(context) {
    console.log('Plugin deactivated');
  },

  // Hook handler
  async onOrderCreated(order, context) {
    // Handle new order
    console.log('New order:', order.id);
  }
};
```

### Context Object

Available in all handlers:

| Property | Description |
|----------|-------------|
| store | Current store info |
| settings | Plugin settings |
| hooks | Hook registration |
| routes | Route registration |
| db | Database access |
| api | API client |
| logger | Logging utility |

---

## Hooks System

### Available Hooks

| Hook | Trigger |
|------|---------|
| order.created | New order placed |
| order.updated | Order modified |
| order.fulfilled | Order shipped |
| product.created | New product added |
| product.updated | Product modified |
| customer.created | New customer |
| cart.updated | Cart changed |
| checkout.completed | Checkout finished |

### Registering Hooks

```javascript
// Register single hook
context.hooks.on('order.created', async (order) => {
  // Handle order
});

// Register multiple hooks
context.hooks.on([
  'product.created',
  'product.updated'
], async (product) => {
  // Handle product changes
});

// With priority (lower runs first)
context.hooks.on('order.created', handler, { priority: 10 });
```

### Hook Payload

Each hook receives relevant data:

```javascript
context.hooks.on('order.created', async (order, context) => {
  console.log(order.id);
  console.log(order.total);
  console.log(order.customer);
  console.log(order.items);
});
```

---

## Custom Routes

### Defining Routes

```javascript
// routes/index.js
module.exports = [
  {
    method: 'GET',
    path: '/my-plugin/data',
    handler: async (req, res, context) => {
      const data = await context.db.query('SELECT * FROM my_table');
      res.json({ data });
    }
  },
  {
    method: 'POST',
    path: '/my-plugin/webhook',
    handler: async (req, res, context) => {
      // Handle webhook
      res.json({ success: true });
    }
  }
];
```

### Route Options

| Option | Purpose |
|--------|---------|
| method | HTTP method |
| path | URL path |
| handler | Request handler |
| middleware | Custom middleware |
| auth | Authentication required |
| permissions | Required permissions |

### Authentication

```javascript
{
  method: 'GET',
  path: '/my-plugin/secure',
  auth: true,  // Requires login
  permissions: ['admin'],  // Requires admin
  handler: async (req, res) => {
    // Authenticated route
  }
}
```

---

## Database Access

### Using the Database

```javascript
async function getData(context) {
  // Query data
  const products = await context.db.query(
    'SELECT * FROM products WHERE store_id = $1',
    [context.store.id]
  );

  // Insert data
  await context.db.query(
    'INSERT INTO my_table (name, value) VALUES ($1, $2)',
    ['name', 'value']
  );

  return products;
}
```

### Migrations

Create database tables:

```javascript
// migrations/001_create_tables.js
module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS my_plugin_data (
        id SERIAL PRIMARY KEY,
        store_id INTEGER NOT NULL,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS my_plugin_data');
  }
};
```

---

## Plugin Settings

### Defining Settings

In manifest.json:

```json
{
  "settings": {
    "apiKey": {
      "type": "string",
      "label": "API Key",
      "required": true,
      "secret": true
    },
    "enableFeature": {
      "type": "boolean",
      "label": "Enable Feature",
      "default": true
    },
    "syncInterval": {
      "type": "select",
      "label": "Sync Interval",
      "options": [
        { "value": "5", "label": "5 minutes" },
        { "value": "15", "label": "15 minutes" },
        { "value": "60", "label": "1 hour" }
      ],
      "default": "15"
    }
  }
}
```

### Accessing Settings

```javascript
async function myHandler(context) {
  const apiKey = context.settings.apiKey;
  const enabled = context.settings.enableFeature;

  if (enabled) {
    await callExternalAPI(apiKey);
  }
}
```

---

## UI Components

### Admin Pages

Add pages to admin:

```javascript
// components/AdminPage.jsx
export default function AdminPage({ context }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <h1>My Plugin Dashboard</h1>
      {/* Your UI */}
    </div>
  );
}
```

### Registering Pages

```javascript
// In activate()
context.admin.registerPage({
  path: '/my-plugin',
  title: 'My Plugin',
  icon: 'puzzle',
  component: require('./components/AdminPage')
});
```

### Widgets

Add dashboard widgets:

```javascript
context.admin.registerWidget({
  id: 'my-plugin-stats',
  title: 'Plugin Stats',
  component: require('./components/StatsWidget'),
  size: 'small'  // small, medium, large
});
```

---

## External API Integration

### Making API Calls

```javascript
async function callExternalAPI(context) {
  const response = await fetch('https://api.example.com/data', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.settings.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ store: context.store.id })
  });

  return response.json();
}
```

### Webhooks

Receive external webhooks:

```javascript
{
  method: 'POST',
  path: '/my-plugin/webhook',
  auth: false,  // Public endpoint
  handler: async (req, res, context) => {
    // Verify webhook signature
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process webhook
    await processWebhook(req.body, context);

    res.json({ received: true });
  }
}
```

---

## Background Jobs

### Scheduling Jobs

```javascript
// Register cron job
context.jobs.schedule({
  name: 'my-plugin-sync',
  cron: '0 * * * *',  // Every hour
  handler: async (context) => {
    await syncData(context);
  }
});
```

### One-Time Jobs

```javascript
// Queue a job
await context.jobs.queue({
  type: 'my-plugin:process',
  payload: { orderId: 123 },
  delay: 5000  // 5 seconds
});

// Handle job
context.jobs.on('my-plugin:process', async (payload, context) => {
  await processOrder(payload.orderId, context);
});
```

---

## Testing

### Unit Tests

```javascript
// tests/plugin.test.js
const plugin = require('../index');

describe('My Plugin', () => {
  it('should handle order created', async () => {
    const mockOrder = { id: 1, total: 100 };
    const mockContext = createMockContext();

    await plugin.onOrderCreated(mockOrder, mockContext);

    expect(mockContext.db.query).toHaveBeenCalled();
  });
});
```

### Integration Tests

```javascript
describe('API Routes', () => {
  it('should return data', async () => {
    const response = await request(app)
      .get('/api/my-plugin/data')
      .set('Authorization', 'Bearer token');

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });
});
```

---

## Publishing

### Prepare for Release

1. Update version in manifest
2. Write documentation
3. Test thoroughly
4. Create changelog

### Submit to Marketplace

1. Go to **Developer Portal**
2. Click **Submit Plugin**
3. Upload plugin package
4. Fill in listing details
5. Submit for review

### Review Process

- Security review
- Functionality check
- Documentation review
- Performance testing

---

## Best Practices

### Security

1. **Validate all input** - Never trust user data
2. **Use parameterized queries** - Prevent SQL injection
3. **Secure API keys** - Use secret settings
4. **Authenticate webhooks** - Verify signatures
5. **Limit permissions** - Request only what's needed

### Performance

1. **Async operations** - Don't block
2. **Batch database calls** - Reduce queries
3. **Cache when possible** - Reduce load
4. **Background jobs** - For heavy work
5. **Efficient queries** - Index properly

### Code Quality

1. **Follow conventions** - Consistent style
2. **Document code** - Comments and docs
3. **Handle errors** - Graceful failures
4. **Log appropriately** - Debug without spam
5. **Test thoroughly** - Unit and integration

---

## Troubleshooting

### Common Issues

**Plugin not loading**:
- Check manifest.json syntax
- Verify file paths
- Check console for errors

**Hooks not firing**:
- Verify hook name spelling
- Check registration timing
- Enable debug logging

**Database errors**:
- Check migration ran
- Verify query syntax
- Check permissions

---

## Next Steps

After building your plugin:

1. **Test locally** - Full functionality
2. **Write documentation** - Usage guide
3. **Security review** - Check vulnerabilities
4. **Performance test** - Under load
5. **Submit** - To marketplace

See our Database Integrations guide for storage options.
