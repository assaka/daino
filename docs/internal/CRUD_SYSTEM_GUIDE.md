# Complete CRUD System Guide - 100% Database-Driven

This guide documents how to build a complete CRUD (Create, Read, Update, Delete) system using the DainoStore plugin architecture. Everything is stored in database tables - no hardcoded routes, components, or forms!

## Table of Contents
1. [Overview](#overview)
2. [The 5 Database Tables](#the-5-database-tables)
3. [Step-by-Step: Building Email Capture CRUD](#step-by-step-building-email-capture-crud)
4. [Complete Flow Diagram](#complete-flow-diagram)
5. [Code Examples](#code-examples)
6. [Common Issues & Solutions](#common-issues--solutions)
7. [Best Practices](#best-practices)

---

## Overview

A complete CRUD system in DainoStore requires **5 database tables**:

| Table | Purpose | What It Stores |
|-------|---------|----------------|
| `plugin_entities` | Data structure | Table schema (columns, indexes, SQL) |
| `plugin_controllers` | API endpoints | CRUD operations (handler code) |
| `plugin_events` | Event listeners | Auto-capture logic (event handlers) |
| `plugin_admin_pages` | Admin UI | React components for management |
| `plugin_registry` | Plugin metadata | Name, slug, manifest with navigation |

**Key Principle:** Everything comes from the database. No hardcoded routes or components!

---

## The 5 Database Tables

### 1. plugin_entities
**Defines the data structure** (what table to create)

```javascript
{
  plugin_id: UUID,
  entity_name: 'CartEmail',           // Entity identifier
  table_name: 'cart_emails',          // Actual table name
  schema_definition: {                // JSON schema
    columns: [
      {
        name: 'id',
        type: 'UUID',
        primaryKey: true,
        default: 'gen_random_uuid()'
      },
      {
        name: 'email',
        type: 'VARCHAR(255)',
        notNull: true
      },
      // ... more columns
    ],
    indexes: [
      { name: 'idx_cart_emails_email', columns: ['email'], unique: true }
    ]
  },
  create_table_sql: 'CREATE TABLE IF NOT EXISTS cart_emails (...)',
  drop_table_sql: 'DROP TABLE IF EXISTS cart_emails CASCADE;',
  migration_status: 'pending' | 'migrated'
}
```

### 2. plugin_controllers
**Defines API endpoints** (CRUD operations)

```javascript
{
  plugin_id: UUID,
  controller_name: 'createEmail',     // Function name
  method: 'POST',                     // HTTP method
  path: '/emails',                    // URL path
  handler_code: `async function createEmail(req, res, { sequelize }) {
    // Controller logic here
    const { email } = req.body;
    const result = await sequelize.query(
      'INSERT INTO cart_emails (email) VALUES ($1) RETURNING *',
      { bind: [email], type: sequelize.QueryTypes.INSERT }
    );
    return res.json({ success: true, email: result[0][0] });
  }`,
  is_enabled: true
}
```

**URL Format:** `/api/plugins/{slug}/exec/{path}`
- Example: `POST /api/plugins/my-cart-alert/exec/emails`
- Path supports parameters: `/emails/:id` matches `/emails/abc-123`

### 3. plugin_events
**Auto-capture logic** (triggers on events)

```javascript
{
  plugin_id: UUID,
  event_name: 'cart.viewed',          // Event to listen for
  file_name: 'cart-viewed-capture-email.js',
  listener_function: `export default async function onCartViewed(data) {
    const email = data?.user?.email || 'test@example.com';

    await fetch('/api/plugins/my-cart-alert/exec/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, cart_total: data.total })
    });
  }`,
  priority: 10,
  is_enabled: true
}
```

### 4. plugin_admin_pages
**Admin UI components** (management interface)

```javascript
{
  plugin_id: UUID,
  page_key: 'emails',                 // URL segment
  page_name: 'Email Capture',         // Display name
  route: '/admin/plugins/my-cart-alert/emails',
  component_code: `import React, { useState, useEffect } from 'react';
import apiClient from '@/api/client';

export default function EmailCaptureManager() {
  const [emails, setEmails] = useState([]);

  // Load data from API
  useEffect(() => {
    apiClient.get('plugins/my-cart-alert/exec/emails')
      .then(data => setEmails(data.emails));
  }, []);

  // Render UI (use React.createElement, not JSX!)
  return React.createElement('div', { className: 'p-6' },
    React.createElement('h1', null, 'Email Capture Dashboard'),
    emails.map(email =>
      React.createElement('div', { key: email.id }, email.email)
    )
  );
}`,
  icon: 'Mail',
  category: 'marketing',
  is_enabled: true
}
```

**IMPORTANT:** Use `React.createElement()` instead of JSX because the code is eval'd in the browser!

### 5. plugin_registry
**Plugin metadata** (navigation and routing)

```javascript
{
  id: UUID,
  name: 'My Cart Alert',
  slug: 'my-cart-alert',              // Used in URLs
  manifest: {
    adminNavigation: {                // Admin sidebar menu
      enabled: true,
      label: 'Email Capture',
      icon: 'Mail',
      route: '/admin/plugins/my-cart-alert/emails',
      order: 100,
      category: 'marketing'
    }
  }
}
```

---

## Step-by-Step: Building Email Capture CRUD

### Step 1: Create the Entity

**Script:** `create-email-capture-crud-example.js`

```javascript
await client.query(`
  INSERT INTO plugin_entities (
    plugin_id, entity_name, table_name, schema_definition,
    create_table_sql, drop_table_sql, migration_status
  )
  VALUES ($1, $2, $3, $4, $5, $6, 'pending')
`, [
  pluginId,
  'CartEmail',
  'cart_emails',
  schemaDefinition,
  createTableSQL,
  dropTableSQL
]);
```

### Step 2: Create CRUD Controllers

**6 Controllers needed for complete CRUD:**

```javascript
const controllers = [
  {
    name: 'createEmail',
    method: 'POST',
    path: '/emails',
    code: `async function createEmail(req, res, { sequelize }) {
      const { email, cart_total, subscribed } = req.body;

      const result = await sequelize.query(
        'INSERT INTO cart_emails (email, cart_total, subscribed) VALUES ($1, $2, $3) RETURNING *',
        { bind: [email, cart_total || 0, subscribed || false], type: sequelize.QueryTypes.INSERT }
      );

      return res.json({ success: true, email: result[0][0] });
    }`
  },
  {
    name: 'getAllEmails',
    method: 'GET',
    path: '/emails',
    code: `async function getAllEmails(req, res, { sequelize }) {
      const emails = await sequelize.query(
        'SELECT * FROM cart_emails ORDER BY created_at DESC',
        { type: sequelize.QueryTypes.SELECT }
      );

      return res.json({ success: true, emails });
    }`
  },
  {
    name: 'getEmailById',
    method: 'GET',
    path: '/emails/:id',
    code: `async function getEmailById(req, res, { sequelize }) {
      const { id } = req.params;

      const result = await sequelize.query(
        'SELECT * FROM cart_emails WHERE id = $1',
        { bind: [id], type: sequelize.QueryTypes.SELECT }
      );

      if (result.length === 0) {
        return res.status(404).json({ success: false, error: 'Email not found' });
      }

      return res.json({ success: true, email: result[0] });
    }`
  },
  {
    name: 'updateEmail',
    method: 'PUT',
    path: '/emails/:id',
    code: `async function updateEmail(req, res, { sequelize }) {
      const { id } = req.params;
      const { email, subscribed, source } = req.body;

      const result = await sequelize.query(
        'UPDATE cart_emails SET email = COALESCE($1, email), subscribed = COALESCE($2, subscribed), source = COALESCE($3, source) WHERE id = $4 RETURNING *',
        { bind: [email, subscribed, source, id], type: sequelize.QueryTypes.UPDATE }
      );

      return res.json({ success: true, email: result[1][0] });
    }`
  },
  {
    name: 'deleteEmail',
    method: 'DELETE',
    path: '/emails/:id',
    code: `async function deleteEmail(req, res, { sequelize }) {
      const { id } = req.params;

      await sequelize.query(
        'DELETE FROM cart_emails WHERE id = $1',
        { bind: [id], type: sequelize.QueryTypes.DELETE }
      );

      return res.json({ success: true });
    }`
  },
  {
    name: 'getEmailStats',
    method: 'GET',
    path: '/emails/stats',
    code: `async function getEmailStats(req, res, { sequelize }) {
      const stats = await sequelize.query(
        'SELECT COUNT(*) as total, AVG(cart_total) as avg_cart_total FROM cart_emails',
        { type: sequelize.QueryTypes.SELECT }
      );

      return res.json({ success: true, ...stats[0] });
    }`
  }
];

// Insert controllers
for (const ctrl of controllers) {
  await client.query(`
    INSERT INTO plugin_controllers (
      plugin_id, controller_name, method, path, handler_code, is_enabled
    )
    VALUES ($1, $2, $3, $4, $5, true)
  `, [pluginId, ctrl.name, ctrl.method, ctrl.path, ctrl.code]);
}
```

### Step 3: Create Event Listener (Auto-Capture)

```javascript
const eventListener = `export default async function onCartViewed(data) {
  const email = data?.user?.email || 'test@example.com';

  if (!email) return;

  await fetch('/api/plugins/my-cart-alert/exec/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      cart_total: data.total,
      cart_items_count: data.items?.length || 0,
      source: 'cart'
    })
  });
}`;

await client.query(`
  INSERT INTO plugin_events (
    plugin_id, event_name, file_name, listener_function, priority
  )
  VALUES ($1, $2, $3, $4, $5)
`, [pluginId, 'cart.viewed', 'cart-viewed-capture-email.js', eventListener, 50]);
```

### Step 4: Create Admin Page Component

**IMPORTANT:** Use `React.createElement()` instead of JSX!

```javascript
const adminPageCode = `import React, { useState, useEffect } from 'react';
import apiClient from '@/api/client';

export default function EmailCaptureManager() {
  const [emails, setEmails] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadEmails();
  }, []);

  const loadEmails = async () => {
    const data = await apiClient.get('plugins/my-cart-alert/exec/emails');
    if (data.success) {
      setEmails(data.emails);
    }
  };

  const handleCreate = async (newEmail) => {
    await apiClient.post('plugins/my-cart-alert/exec/emails', newEmail);
    loadEmails();
  };

  const handleDelete = async (id) => {
    await apiClient.delete('plugins/my-cart-alert/exec/emails/' + id);
    loadEmails();
  };

  // Use React.createElement - NOT JSX!
  return React.createElement('div', { className: 'p-6' },
    React.createElement('h1', null, 'Email Capture Dashboard'),
    React.createElement('button', {
      onClick: () => setShowModal(true)
    }, '+ Add Email'),
    emails.map(email =>
      React.createElement('div', { key: email.id },
        React.createElement('span', null, email.email),
        React.createElement('button', {
          onClick: () => handleDelete(email.id)
        }, 'Delete')
      )
    )
  );
}`;

await client.query(`
  INSERT INTO plugin_admin_pages (
    plugin_id, page_key, page_name, route, component_code, icon, category
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7)
`, [
  pluginId,
  'emails',
  'Email Capture',
  '/admin/plugins/my-cart-alert/emails',
  adminPageCode,
  'Mail',
  'marketing'
]);
```

### Step 5: Add Admin Navigation

```javascript
const manifest = {
  adminNavigation: {
    enabled: true,
    label: 'Email Capture',
    icon: 'Mail',
    route: '/admin/plugins/my-cart-alert/emails',
    order: 100,
    category: 'marketing'
  }
};

await client.query(`
  UPDATE plugin_registry
  SET manifest = $1
  WHERE id = $2
`, [manifest, pluginId]);
```

### Step 6: Run Migration

1. Open plugin in editor
2. Navigate to `entities/CartEmail.json`
3. Click **"Generate Migration"**
4. Go to migrations folder
5. Click **"Run Migration"**
6. Table created! ✅

---

## Complete Flow Diagram

### CREATE Flow
```
User clicks [+ Add Email]
  ↓
Modal opens (from plugin_admin_pages.component_code)
  ↓
User fills form and clicks Create
  ↓
Component calls: POST /api/plugins/my-cart-alert/exec/emails
  ↓
Dynamic router (plugin-api.js:2581) receives request
  ↓
Extracts: pluginId='my-cart-alert', method='POST', path='/emails'
  ↓
Queries plugin_controllers table:
  WHERE slug='my-cart-alert' AND method='POST' AND path='/emails'
  ↓
Finds: createEmail controller
  ↓
Executes handler_code from database using eval()
  ↓
Controller inserts into cart_emails table
  ↓
Returns: { success: true, email: {...} }
  ↓
Component refreshes list
  ↓
New email appears! ✅
```

### READ Flow
```
User visits /admin/plugins/my-cart-alert/emails
  ↓
DynamicPluginAdminPage component loads
  ↓
Queries plugin_registry: WHERE slug='my-cart-alert'
  ↓
Queries plugin_admin_pages: WHERE page_key='emails'
  ↓
Gets component_code from database
  ↓
Removes import statements, strips export default
  ↓
Dynamically imports dependencies (React, apiClient, etc.)
  ↓
Uses eval() to execute component_code
  ↓
Component loads, calls: GET /api/plugins/my-cart-alert/exec/emails
  ↓
getAllEmails controller executes
  ↓
Returns list from cart_emails table
  ↓
Component renders email list! ✅
```

### UPDATE Flow
```
User clicks [✏️ Edit] on email
  ↓
Edit modal opens with pre-filled data
  ↓
User changes subscription status, source, or email
  ↓
Clicks Update
  ↓
Component calls: PUT /api/plugins/my-cart-alert/exec/emails/{id}
  ↓
Router matches pattern: /emails/:id
  ↓
Extracts: req.params.id = {uuid}
  ↓
Executes updateEmail controller
  ↓
Updates cart_emails table: UPDATE ... WHERE id = $1
  ↓
Returns updated email
  ↓
Component refreshes list
  ↓
Changes visible! ✅
```

### DELETE Flow
```
User clicks [🗑️ Delete]
  ↓
Confirms deletion
  ↓
Component calls: DELETE /api/plugins/my-cart-alert/exec/emails/{id}
  ↓
Router matches: /emails/:id
  ↓
Executes deleteEmail controller
  ↓
Deletes from cart_emails table
  ↓
Component refreshes list
  ↓
Email removed! ✅
```

### AUTO-CAPTURE Flow
```
User visits cart page
  ↓
Cart.jsx emits: eventSystem.emit('cart.viewed', data)
  ↓
App.jsx loads event listeners from plugin_events table
  ↓
Executes cart-viewed-capture-email.js listener_function
  ↓
Listener extracts email from data
  ↓
Calls: POST /api/plugins/my-cart-alert/exec/emails
  ↓
createEmail controller inserts into cart_emails
  ↓
Email captured automatically! ✅
```

---

## Code Examples

### Controller Code Template

**Key Points:**
- ✅ Use single-line SQL strings (no backticks/template literals)
- ✅ Use `{ bind: [...] }` for parameters
- ✅ Return JSON with `{ success: true }`
- ✅ Handle errors with try/catch

```javascript
async function controllerName(req, res, { sequelize }) {
  // Extract data
  const { field1, field2 } = req.body;
  const { id } = req.params;

  // Validate
  if (!field1) {
    return res.status(400).json({
      success: false,
      error: 'Field1 is required'
    });
  }

  try {
    // Execute SQL (single-line string, no backticks!)
    const result = await sequelize.query(
      'INSERT INTO table_name (field1, field2) VALUES ($1, $2) RETURNING *',
      { bind: [field1, field2], type: sequelize.QueryTypes.INSERT }
    );

    // Return success
    return res.json({
      success: true,
      data: result[0][0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

### Event Listener Template

**Key Points:**
- ✅ Use `export default` or arrow functions
- ✅ Named functions for better debugging
- ✅ Use `fetch()` or `apiClient` to call controllers
- ✅ Handle errors gracefully

```javascript
export default async function onEventName(data) {
  // Extract data
  const { field1, field2 } = data;

  // Validate
  if (!field1) {
    console.log('⚠️ Required field missing');
    return;
  }

  // Call controller
  try {
    const response = await fetch('/api/plugins/plugin-slug/exec/resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field1, field2 })
    });

    if (response.ok) {
      console.log('✅ Data captured successfully');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}
```

### Admin Page Component Template

**Key Points:**
- ❌ **NO JSX!** Use `React.createElement()`
- ✅ Use `apiClient` for API calls
- ✅ Import dependencies at top
- ✅ Single-line strings (no template literals)

```javascript
import React, { useState, useEffect } from 'react';
import apiClient from '@/api/client';

export default function ResourceManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await apiClient.get('plugins/plugin-slug/exec/resource');
      if (data && data.success) {
        setItems(data.items || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Load failed:', error);
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    await apiClient.delete('plugins/plugin-slug/exec/resource/' + id);
    loadItems();
  };

  if (loading) {
    return React.createElement('div', null, 'Loading...');
  }

  return React.createElement('div', { className: 'p-6' },
    React.createElement('h1', { className: 'text-2xl font-bold' }, 'Resource Manager'),
    items.map(item =>
      React.createElement('div', { key: item.id },
        React.createElement('span', null, item.name),
        React.createElement('button', {
          onClick: () => handleDelete(item.id)
        }, 'Delete')
      )
    )
  );
}
```

---

## Common Issues & Solutions

### Issue 1: "invalid escape sequence"
**Cause:** Template literals with `\`` or `\${}`

**Solution:** Use string concatenation
```javascript
// ❌ BAD (causes errors when eval'd):
console.log(`Items: ${items.length}`);

// ✅ GOOD:
console.log('Items: ' + items.length);
```

### Issue 2: "expected expression, got '<'"
**Cause:** JSX syntax in component code

**Solution:** Use React.createElement
```javascript
// ❌ BAD (JSX doesn't work with eval):
return <div>Hello</div>;

// ✅ GOOD:
return React.createElement('div', null, 'Hello');
```

### Issue 3: "Named bind parameter $2 has no value"
**Cause:** Mismatched bind array length vs SQL parameters

**Solution:** Match exactly
```javascript
// ❌ BAD:
query = 'SELECT * WHERE id = $1 AND name = $2';
bind: [id];  // Missing $2!

// ✅ GOOD:
query = 'SELECT * WHERE id = $1 AND name = $2';
bind: [id, name];  // Both parameters provided
```

### Issue 4: "Controller not found: DELETE /emails/abc-123"
**Cause:** Path parameter not matching

**Solution:** Ensure route sorting prioritizes exact matches
```javascript
// Controllers should be sorted:
// 1. GET /emails/stats (exact match)
// 2. GET /emails/:id (parameterized)

// So /emails/stats doesn't match /:id pattern
```

### Issue 5: "Plugin admin page shows CMS page"
**Cause:** Missing route for dynamic plugin pages

**Solution:** Add route in App.jsx
```javascript
import DynamicPluginAdminPage from '@/components/plugins/DynamicPluginAdminPage';

<Route
  path="/admin/plugins/:pluginSlug/:pageKey"
  element={<PageWrapper Component={DynamicPluginAdminPage} />}
/>
```

### Issue 6: "Slug is undefined"
**Cause:** API not returning slug field

**Solution:** Add slug to SELECT statement
```sql
-- Add 'slug' to SELECT:
SELECT id, name, slug, version FROM plugin_registry
```

### Issue 7: "toFixed is not a function"
**Cause:** Database returns DECIMAL as string

**Solution:** Use parseFloat
```javascript
// ❌ BAD:
email.cart_total.toFixed(2)  // String doesn't have toFixed

// ✅ GOOD:
parseFloat(email.cart_total || 0).toFixed(2)
```

---

## Best Practices

### 1. Controller Code

✅ **DO:**
- Use single-line SQL strings
- Use clear bind parameter names
- Handle errors with try/catch
- Return consistent JSON format: `{ success: true, data: {...} }`
- Validate input before queries
- Use COALESCE for optional updates

❌ **DON'T:**
- Use template literals (backticks)
- Use multi-line SQL in backticks
- Mix parameter styles
- Skip error handling
- Return different response formats

### 2. Event Listeners

✅ **DO:**
- Use named functions for debugging (`onCartViewed`)
- Use `export default function`
- Log successes and errors
- Handle missing data gracefully
- Use try/catch for fetch calls

❌ **DON'T:**
- Use anonymous functions (hard to debug)
- Use `return function()` (syntax errors)
- Skip validation
- Let errors crash the listener

### 3. Admin Components

✅ **DO:**
- Use `React.createElement()` (not JSX)
- Use `apiClient` for API calls
- Use string concatenation (not template literals)
- Import dependencies at top
- Handle loading and error states
- Use `parseFloat()` for decimal fields

❌ **DON'T:**
- Use JSX syntax (`<div>`)
- Use template literals
- Use direct `fetch()` calls (use apiClient)
- Forget error handling
- Assume data types from database

### 4. Path Parameters

✅ **DO:**
- Use Express-style params: `/emails/:id`
- Access via `req.params.id`
- Prioritize exact matches over parameterized routes
- Order routes from specific to general

❌ **DON'T:**
- Use `/emails/:id` for static routes like `/emails/stats`
- Parse manually with string operations

### 5. SQL Queries

✅ **DO:**
```javascript
// Single-line, clear bind array
await sequelize.query(
  'SELECT * FROM table WHERE id = $1 AND status = $2',
  { bind: [id, status], type: sequelize.QueryTypes.SELECT }
);
```

❌ **DON'T:**
```javascript
// Multi-line with backticks (breaks when eval'd)
await sequelize.query(`
  SELECT *
  FROM table
  WHERE id = $1
`, { bind: [id] });
```

---

## URL Structure Reference

### API Endpoints (Controllers)
```
Base: /api/plugins/{slug}/exec/{path}

Examples:
POST   /api/plugins/my-cart-alert/exec/emails
GET    /api/plugins/my-cart-alert/exec/emails
GET    /api/plugins/my-cart-alert/exec/emails/stats
GET    /api/plugins/my-cart-alert/exec/emails/:id
PUT    /api/plugins/my-cart-alert/exec/emails/:id
DELETE /api/plugins/my-cart-alert/exec/emails/:id
```

### Admin Pages
```
Base: /admin/plugins/{slug}/{pageKey}

Examples:
/admin/plugins/my-cart-alert/emails
/admin/plugins/customer-chat/conversations
/admin/plugins/analytics/dashboard
```

---

## Database Table Relationships

```
plugin_registry (parent)
    ↓ (plugin_id foreign key)
    ├── plugin_entities (defines tables)
    ├── plugin_controllers (API endpoints)
    ├── plugin_events (event listeners)
    ├── plugin_admin_pages (UI components)
    ├── plugin_hooks (data filters)
    ├── plugin_migrations (schema changes)
    └── plugin_data (key-value storage)
```

---

## Testing Checklist

After creating a CRUD system:

- [ ] Entity created in `plugin_entities`
- [ ] Migration generated and run successfully
- [ ] Table exists in database
- [ ] CREATE controller works (POST)
- [ ] READ controller works (GET list)
- [ ] READ single controller works (GET :id)
- [ ] UPDATE controller works (PUT :id)
- [ ] DELETE controller works (DELETE :id)
- [ ] Stats controller works (if applicable)
- [ ] Event listener captures data automatically
- [ ] Admin page loads without errors
- [ ] Admin navigation shows menu item
- [ ] Create modal opens and works
- [ ] Edit modal opens and works
- [ ] Delete confirmation works
- [ ] List refreshes after CREATE
- [ ] List refreshes after UPDATE
- [ ] List refreshes after DELETE

---

## Full Example: Email Capture System

See the complete working example in:
- **Script:** `backend/create-email-capture-crud-example.js`
- **Admin Page:** Plugin ID `4eb11832-5429-4146-af06-de86d319a0e5`
- **Table:** `cart_emails`
- **Live URL:** `/admin/plugins/my-cart-alert/emails`

**Features:**
- ✅ Auto-capture emails from cart.viewed event
- ✅ Manual email entry with Create modal
- ✅ Edit email, subscription, source
- ✅ Delete emails
- ✅ View statistics (total, subscribed, avg cart value)
- ✅ All 100% database-driven!

---

## External API Integration

Controllers can call ANY external API:

```javascript
async function myController(req, res, { sequelize }) {
  // Call Amazon API
  const amazonRes = await fetch('https://api.amazon.com/products', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer xxx' },
    body: JSON.stringify({ query: 'electronics' })
  });

  // Call Stripe API
  const stripeRes = await fetch('https://api.stripe.com/v1/prices', {
    headers: { 'Authorization': 'Bearer sk_test_xxx' }
  });

  // Call your own backend
  const analyticsRes = await fetch('/api/analytics/track', {
    method: 'POST',
    body: JSON.stringify({ event: 'purchase' })
  });

  // Any HTTP endpoint works!
  return res.json({ success: true });
}
```

---

## Advanced: Path Parameters

### Simple Parameter
```javascript
// Controller:
path: '/emails/:id'

// Request:
GET /api/plugins/my-cart-alert/exec/emails/abc-123

// Result:
req.params.id = 'abc-123'
```

### Multiple Parameters
```javascript
// Controller:
path: '/users/:userId/orders/:orderId'

// Request:
GET /api/plugins/my-plugin/exec/users/123/orders/456

// Result:
req.params.userId = '123'
req.params.orderId = '456'
```

### Query Parameters
```javascript
// Request:
GET /api/plugins/my-plugin/exec/emails?search=john&limit=10

// Access:
req.query.search  // 'john'
req.query.limit   // '10'
```

---

## Scripts Reference

Helpful scripts created during Email Capture development:

| Script | Purpose |
|--------|---------|
| `create-email-capture-crud-example.js` | Creates complete CRUD system |
| `add-create-email-modal.js` | Adds Create modal to admin page |
| `add-update-email-modal.js` | Adds Edit modal to admin page |
| `fix-all-email-controllers.js` | Fixes syntax errors in controllers |
| `ultra-simple-createemail.js` | Simplifies createEmail controller |
| `mock-email-capture.js` | Inserts test data |
| `add-email-admin-nav.js` | Adds navigation to manifest |
| `check-email-capture-setup.js` | Verifies all components exist |

---

## Architecture Benefits

### 100% Database-Driven Means:

✅ **No code deployments needed** - Update logic in database
✅ **Dynamic routes** - Controllers define endpoints
✅ **Extensible** - Add new CRUD systems without changing code
✅ **Portable** - Clone plugins, get same functionality
✅ **Testable** - Each controller is isolated
✅ **Maintainable** - Logic stored in database, versioned
✅ **Flexible** - Call external APIs, chain controllers

### Traditional vs Database-Driven

**Traditional (Hardcoded):**
```
routes/emails.js  →  controllers/emailController.js  →  models/Email.js
└─ Hardcoded        └─ Hardcoded                       └─ Hardcoded

Changes require: Code deployment, server restart, testing
```

**Database-Driven (DainoStore):**
```
plugin_controllers.handler_code  →  cart_emails table
└─ In database                      └─ In database

Changes require: Database update only!
```

---

## Summary

Building a CRUD system in DainoStore:

1. **Entity** → Define table structure in `plugin_entities`
2. **Controllers** → Create 6 endpoints in `plugin_controllers`
3. **Event Listener** → Auto-capture in `plugin_events`
4. **Admin Page** → UI component in `plugin_admin_pages`
5. **Navigation** → Menu item in `plugin_registry.manifest`
6. **Migration** → Run to create table
7. **Test** → All CRUD operations work!

**Everything is 100% database-driven!**

No hardcoded routes, components, or forms needed! 🎉

---

## Next Steps

To build your own CRUD system:

1. Copy `create-email-capture-crud-example.js`
2. Change table name and fields
3. Update controller logic for your use case
4. Customize admin page UI
5. Run the script
6. Test your new CRUD system!

Happy building! 🚀
