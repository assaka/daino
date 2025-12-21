# How Controllers Are Triggered (100% Database-Driven)

## Complete Flow Example: Creating an Email

### Step 1: Make HTTP Request
```javascript
// From event listener or admin page:
fetch('/api/plugins/my-cart-alert/exec/emails', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    cart_total: 99.99
  })
})
```

### Step 2: Request Hits Dynamic Route
**File:** `backend/src/routes/plugin-api.js:2578`

```javascript
router.all('/:pluginId/exec/*', async (req, res) => {
  // Extracts from URL: POST /api/plugins/my-cart-alert/exec/emails

  const pluginId = 'my-cart-alert';      // From :pluginId parameter
  const controllerPath = '/emails';       // From * wildcard
  const method = 'POST';                  // From req.method

  // ...continues to Step 3
});
```

### Step 3: Lookup Controller in Database
```javascript
// Query plugin_controllers table
const controllers = await sequelize.query(`
  SELECT pc.handler_code, pc.controller_name
  FROM plugin_controllers pc
  JOIN plugin_registry pr ON pc.plugin_id = pr.id
  WHERE pr.slug = 'my-cart-alert'    -- ← Match plugin slug
    AND pc.method = 'POST'            -- ← Match HTTP method
    AND pc.path = '/emails'           -- ← Match path
    AND pc.is_enabled = true
`);

// Returns:
{
  controller_name: 'createEmail',
  handler_code: 'async function createEmail(req, res, { sequelize }) { ... }'
}
```

### Step 4: Execute Handler Code from Database
```javascript
// Create executable function from database code
const handlerFunc = new Function('req', 'res', 'context', `
  const { sequelize } = context;
  return (${controller.handler_code})(req, res, { sequelize });
`);

// Execute it with request context
await handlerFunc(
  { body: { email: 'user@example.com', cart_total: 99.99 }, ... },  // req
  { json: () => { ... }, status: () => { ... } },                    // res
  { sequelize }                                                       // context
);
```

### Step 5: Controller Executes (From Database Code)
```javascript
// This code runs (loaded from plugin_controllers.handler_code column):
async function createEmail(req, res, { sequelize }) {
  const { email, cart_total } = req.body;

  // Insert into cart_emails table
  const result = await sequelize.query(`
    INSERT INTO cart_emails (email, cart_total, created_at)
    VALUES ($1, $2, NOW())
    RETURNING *
  `, {
    bind: [email, cart_total],
    type: sequelize.QueryTypes.INSERT
  });

  return res.json({
    success: true,
    email: result[0][0]
  });
}
```

### Step 6: Response Sent Back
```json
{
  "success": true,
  "email": {
    "id": "abc-123",
    "email": "user@example.com",
    "cart_total": 99.99,
    "created_at": "2025-10-29T22:00:00Z"
  }
}
```

---

## Where Controllers Are Triggered From:

### 1. **Event Listeners** (Most Common)
```javascript
// File: cart-viewed-capture-email.js (stored in plugin_events)
export default async function onCartViewedCaptureEmail(data) {
  const email = data?.user?.email;

  // ← TRIGGERS THE CONTROLLER
  await fetch('/api/plugins/my-cart-alert/exec/emails', {
    method: 'POST',
    body: JSON.stringify({ email, cart_total: data.total })
  });
}
```

### 2. **Admin Pages**
```javascript
// File: EmailCaptureManager (stored in plugin_admin_pages)
const loadEmails = async () => {
  // ← TRIGGERS THE CONTROLLER
  const response = await fetch('/api/plugins/my-cart-alert/exec/emails');
  const data = await response.json();
  setEmails(data.emails);
};
```

### 3. **Hooks** (Modifying Data)
```javascript
// Can also trigger controllers from hooks
hookSystem.register('cart.calculate_total', async (total, data) => {
  // Send data to external API via controller
  await fetch('/api/plugins/my-cart-alert/exec/emails', { ... });
  return total;
});
```

### 4. **External Webhooks**
```javascript
// External services can call your controllers directly!
// POST https://your-domain.com/api/plugins/my-cart-alert/exec/emails
// From: Zapier, Stripe webhooks, Amazon SNS, etc.
```

---

## Key Points:

✅ **Controllers are just HTTP endpoints** - Call them like any API
✅ **No hardcoding** - Everything from `plugin_controllers` table
✅ **Dynamic execution** - Code runs from `handler_code` column
✅ **Use slug or UUID** - Both work in `:pluginId` parameter
✅ **Works for clones** - Each clone has different UUID but can customize slug

---

## Database Tables Used:

| Table | What It Stores |
|-------|----------------|
| `plugin_registry` | Plugin metadata (id, slug, name) |
| `plugin_controllers` | Controller definitions (method, path, handler_code) |
| `plugin_entities` | Table schemas (create_table_sql) |
| `plugin_events` | Event listener code |
| `plugin_admin_pages` | React component code for admin UI |

Everything is in the database! No hardcoded routes! 🎉
