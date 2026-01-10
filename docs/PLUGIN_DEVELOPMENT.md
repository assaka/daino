# Plugin Development Guide

A comprehensive guide for developing plugins for the DainoStore platform.

## Table of Contents

1. [Overview](#overview)
2. [Plugin Architecture](#plugin-architecture)
3. [Plugin Structure](#plugin-structure)
4. [Creating a Plugin](#creating-a-plugin)
5. [Plugin Components](#plugin-components)
   - [Widgets](#widgets)
   - [Admin Pages](#admin-pages)
   - [Controllers](#controllers)
   - [Hooks](#hooks)
   - [Events](#events)
   - [Migrations](#migrations)
   - [Entities](#entities)
   - [Cron Jobs](#cron-jobs)
6. [API Reference](#api-reference)
7. [Context & Dependencies](#context--dependencies)
8. [Example Plugins](#example-plugins)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

DainoStore plugins are **100% database-driven**. Plugin code, configurations, and metadata are stored in PostgreSQL tables and executed at runtime. This allows:

- Dynamic plugin installation without deployments
- Per-tenant plugin configurations
- Hot-reloading of plugin code
- AI-generated plugins

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Plugin Registry** | Central table storing plugin metadata |
| **Plugin Starters** | Template plugins available for installation |
| **Tenant Isolation** | Each store has its own plugin data |
| **Runtime Execution** | Plugin code is evaluated at runtime |

---

## Plugin Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
├─────────────────────────────────────────────────────────────┤
│  GlobalPluginWidgets     │  DynamicPluginAdminPage          │
│  (Storefront widgets)    │  (Admin panel pages)             │
│          │               │           │                       │
│          ▼               │           ▼                       │
│  PluginWidgetRenderer    │  Babel-compiled JSX              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND API                             │
├─────────────────────────────────────────────────────────────┤
│  /api/plugins/active          - Get active plugins          │
│  /api/plugins/:id/exec/*      - Execute plugin controllers  │
│  /api/plugins/registry        - Plugin management           │
│  /api/plugins/import          - Install plugins             │
│  /api/plugins/starters        - Browse available plugins    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE TABLES                           │
├─────────────────────────────────────────────────────────────┤
│  plugin_registry        - Plugin metadata                   │
│  plugin_widgets         - Widget components                 │
│  plugin_admin_pages     - Admin UI pages                    │
│  plugin_controllers     - API endpoints                     │
│  plugin_hooks           - Hook handlers                     │
│  plugin_events          - Event listeners                   │
│  plugin_migrations      - Database migrations               │
│  plugin_configurations  - Per-store settings                │
└─────────────────────────────────────────────────────────────┘
```

---

## Plugin Structure

A plugin is defined as a JSON package with the following structure:

```json
{
  "packageVersion": "1.0.0",
  "exportedAt": "2024-01-01T00:00:00.000Z",
  "plugin": {
    "name": "My Plugin",
    "slug": "my-plugin",
    "version": "1.0.0",
    "description": "Plugin description",
    "author": "Your Name",
    "category": "utility",
    "type": "utility",
    "framework": "react",
    "manifest": {
      "name": "My Plugin",
      "version": "1.0.0",
      "permissions": ["products:read"],
      "adminNavigation": {
        "enabled": true,
        "label": "My Plugin",
        "icon": "Settings",
        "route": "/admin/plugins/my-plugin/dashboard",
        "order": 100
      }
    },
    "permissions": ["products:read"],
    "dependencies": [],
    "tags": ["utility"]
  },
  "widgets": [],
  "adminPages": [],
  "controllers": [],
  "hooks": [],
  "events": [],
  "migrations": [],
  "entities": [],
  "cronJobs": [],
  "pluginData": [],
  "pluginDocs": []
}
```

### Plugin Categories

| Category | Description |
|----------|-------------|
| `marketing` | Marketing & promotions |
| `analytics` | Analytics & reporting |
| `shipping` | Shipping & logistics |
| `payment` | Payment processing |
| `support` | Customer support |
| `integration` | Third-party integrations |
| `utility` | General utilities |

---

## Creating a Plugin

### Method 1: JSON File

Create a `.json` file in `public/example-plugins/`:

```bash
public/example-plugins/my-plugin.json
```

### Method 2: Admin UI

1. Go to `/admin/plugins`
2. Click "Create Plugin"
3. Use the visual builder or AI assistant

### Method 3: API

```bash
POST /api/plugins/import
Content-Type: application/json
x-store-id: <your-store-id>

{
  "plugin": { ... },
  "widgets": [ ... ],
  "controllers": [ ... ]
}
```

---

## Plugin Components

### Widgets

Widgets are React components rendered on the storefront or admin panel.

```json
{
  "widgets": [
    {
      "widgetId": "my-widget",
      "widgetName": "My Widget",
      "description": "A floating widget",
      "category": "support",
      "icon": "MessageCircle",
      "defaultConfig": {
        "primaryColor": "#3b82f6",
        "position": "right"
      },
      "componentCode": "function MyWidget({ config = {} }) {\n  const { primaryColor, position } = config;\n  \n  return React.createElement('div', {\n    style: {\n      position: 'fixed',\n      bottom: '20px',\n      [position]: '20px',\n      background: primaryColor,\n      padding: '16px',\n      borderRadius: '8px',\n      color: 'white'\n    }\n  }, 'Hello from widget!');\n}"
    }
  ]
}
```

#### Widget Categories for Global Display

Widgets with these categories render automatically on all storefront pages:
- `support`
- `floating`
- `global`
- `chat`

#### Available Dependencies in Widgets

```javascript
// React hooks
React, useState, useEffect, useCallback, useMemo

// UI Components
Card, CardContent, CardHeader, CardTitle
Button, Input, Badge

// Icons (from lucide-react)
LucideIcons.Star, LucideIcons.Check, LucideIcons.X, etc.
```

#### Widget Code Example (with JSX)

JSX is automatically transformed to `React.createElement()` on the backend:

```jsx
function ChatWidget({ config = {} }) {
  const [open, setOpen] = useState(false);
  const { primaryColor = '#3b82f6' } = config;

  // Helper to include store_id in API calls
  const getHeaders = () => {
    const headers = {};
    const storeId = localStorage.getItem('selectedStoreId');
    if (storeId) headers['x-store-id'] = storeId;
    return headers;
  };

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: primaryColor, color: 'white', padding: '12px' }}
      >
        Chat
      </button>
    </div>
  );
}
```

---

### Admin Pages

Admin pages provide UI for plugin configuration and management.

```json
{
  "adminPages": [
    {
      "pageKey": "dashboard",
      "pageName": "Plugin Dashboard",
      "route": "/admin/plugins/my-plugin/dashboard",
      "icon": "Settings",
      "category": "settings",
      "description": "Main dashboard for the plugin",
      "componentCode": "import React, { useState, useEffect } from 'react';\nimport { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';\n\nexport default function Dashboard() {\n  return (\n    <div className=\"p-6\">\n      <Card>\n        <CardHeader>\n          <CardTitle>My Plugin Dashboard</CardTitle>\n        </CardHeader>\n        <CardContent>\n          <p>Plugin content here</p>\n        </CardContent>\n      </Card>\n    </div>\n  );\n}"
    }
  ]
}
```

#### Admin Navigation

To show the plugin in the admin sidebar:

```json
{
  "manifest": {
    "adminNavigation": {
      "enabled": true,
      "label": "My Plugin",
      "icon": "Settings",
      "route": "/admin/plugins/my-plugin/dashboard",
      "order": 100
    }
  }
}
```

#### Available Dependencies in Admin Pages

```javascript
// React
React, useState, useEffect, useCallback, useMemo

// UI Components
Card, CardContent, CardHeader, CardTitle
Button, Input, Badge, Checkbox

// Icons
MessageCircle, Send, Star, Check, X, MessageSquare, AlertCircle

// API Client
apiClient  // Use for authenticated requests
```

---

### Controllers

Controllers define backend API endpoints for your plugin.

```json
{
  "controllers": [
    {
      "name": "getData",
      "method": "GET",
      "path": "/data",
      "description": "Get plugin data",
      "code": "async function getData(req, res, { supabase }) {\n  const { id } = req.query;\n\n  try {\n    const { data, error } = await supabase\n      .from('my_table')\n      .select('*')\n      .eq('id', id);\n\n    if (error) throw error;\n    return res.json({ success: true, data });\n  } catch (error) {\n    return res.status(500).json({ success: false, error: error.message });\n  }\n}"
    },
    {
      "name": "createData",
      "method": "POST",
      "path": "/data",
      "description": "Create new data",
      "code": "async function createData(req, res, { supabase }) {\n  const { name, value } = req.body;\n\n  try {\n    const { data, error } = await supabase\n      .from('my_table')\n      .insert({ name, value })\n      .select()\n      .single();\n\n    if (error) throw error;\n    return res.json({ success: true, data });\n  } catch (error) {\n    return res.status(500).json({ success: false, error: error.message });\n  }\n}"
    }
  ]
}
```

#### Controller Endpoint URL

Controllers are accessible at:
```
/api/plugins/{plugin-slug}/exec/{controller-path}
```

Example:
```
GET  /api/plugins/my-plugin/exec/data
POST /api/plugins/my-plugin/exec/data
```

#### Path Parameters

Use `:param` syntax for dynamic routes:

```json
{
  "path": "/items/:itemId",
  "code": "async function getItem(req, res, { supabase }) {\n  const { itemId } = req.params;\n  // ...\n}"
}
```

#### Controller Context

Controllers receive these in the context:

```javascript
async function myController(req, res, { supabase }) {
  // req.body     - POST/PUT body data
  // req.query    - Query parameters (?foo=bar)
  // req.params   - URL parameters (:id)
  // req.headers  - Request headers
  // req.user     - Authenticated user (if any)
  // req.method   - HTTP method

  // supabase     - Supabase client for database operations

  // res.json()   - Send JSON response
  // res.status() - Set HTTP status code
}
```

#### Supabase Query Examples

```javascript
// SELECT
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('column', value)
  .order('created_at', { ascending: false });

// INSERT
const { data, error } = await supabase
  .from('table')
  .insert({ column: value })
  .select()
  .single();

// UPDATE
const { data, error } = await supabase
  .from('table')
  .update({ column: newValue })
  .eq('id', id);

// DELETE
const { error } = await supabase
  .from('table')
  .delete()
  .eq('id', id);

// UPSERT
const { data, error } = await supabase
  .from('table')
  .upsert({ id, column: value }, { onConflict: 'id' });

// COUNT
const { count, error } = await supabase
  .from('table')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'active');
```

---

### Hooks

Hooks intercept and modify data at specific points in the application.

```json
{
  "hooks": [
    {
      "hookName": "cart.processLoadedItems",
      "priority": 10,
      "handlerFunction": "async function processCart(items, context) {\n  // Modify cart items\n  return items.map(item => ({\n    ...item,\n    customField: 'added by plugin'\n  }));\n}"
    }
  ]
}
```

#### Available Hooks

| Hook Name | Description | Input |
|-----------|-------------|-------|
| `app.ready` | App initialization complete | context |
| `app.init` | App starting | context |
| `cart.processLoadedItems` | Cart items loaded | items, context |
| `checkout.processLoadedItems` | Checkout items loaded | items, context |
| `page.render` | Page about to render | page, context |
| `page.onRender` | Page rendered | page, context |
| `product.processInventory` | Product inventory check | product, context |
| `order.processShipment` | Order shipment processing | order, context |
| `frontend.render` | Frontend rendering | context |

---

### Events

Events respond to system events asynchronously.

```json
{
  "events": [
    {
      "eventName": "order.created",
      "priority": 10,
      "listenerFunction": "async function onOrderCreated(event, context) {\n  const { orderId, customerId, total } = event;\n  \n  // Send notification, update analytics, etc.\n  console.log('New order:', orderId);\n}"
    }
  ]
}
```

#### Available Events

| Event Name | Description | Event Data |
|------------|-------------|------------|
| `order.created` | New order placed | orderId, customerId, total, items |
| `order.updated` | Order status changed | orderId, status, previousStatus |
| `product.created` | New product added | productId, sku, name |
| `product.updated` | Product modified | productId, changes |
| `customer.registered` | New customer signup | customerId, email |
| `inventory.low` | Stock below threshold | productId, currentStock, threshold |

---

### Migrations

Migrations create database tables and indexes for your plugin.

```json
{
  "migrations": [
    {
      "name": "create_plugin_tables",
      "pluginName": "My Plugin",
      "migrationVersion": "1704067200000_create_tables",
      "code": "CREATE TABLE IF NOT EXISTS my_plugin_data (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  name VARCHAR(255) NOT NULL,\n  value JSONB DEFAULT '{}',\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),\n  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()\n);\n\nCREATE INDEX IF NOT EXISTS idx_my_plugin_name ON my_plugin_data(name);"
    }
  ]
}
```

#### Migration Best Practices

1. Always use `IF NOT EXISTS` for tables and indexes
2. Use UUID primary keys with `gen_random_uuid()`
3. Include `created_at` and `updated_at` timestamps
4. Create indexes for frequently queried columns
5. Use meaningful prefixes for table names (e.g., `chat_`, `review_`)

---

### Entities

Entities define the schema for your plugin's data tables (used for documentation and schema generation).

```json
{
  "entities": [
    {
      "name": "PluginData",
      "tableName": "my_plugin_data",
      "description": "Stores plugin data",
      "schemaDefinition": {
        "columns": [
          {
            "name": "id",
            "type": "UUID",
            "default": "gen_random_uuid()",
            "primaryKey": true
          },
          {
            "name": "name",
            "type": "VARCHAR(255)",
            "notNull": true
          },
          {
            "name": "value",
            "type": "JSONB",
            "default": "'{}'"
          },
          {
            "name": "created_at",
            "type": "TIMESTAMP WITH TIME ZONE",
            "default": "NOW()"
          }
        ],
        "indexes": [
          {
            "name": "idx_my_plugin_name",
            "columns": ["name"]
          }
        ]
      }
    }
  ]
}
```

---

### Cron Jobs

Cron jobs run scheduled tasks for your plugin.

```json
{
  "cronJobs": [
    {
      "name": "daily-cleanup",
      "schedule": "0 0 * * *",
      "description": "Clean up old data daily",
      "handlerCode": "async function cleanup(context) {\n  const { supabase } = context;\n  \n  // Delete records older than 30 days\n  const thirtyDaysAgo = new Date();\n  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);\n  \n  await supabase\n    .from('my_plugin_logs')\n    .delete()\n    .lt('created_at', thirtyDaysAgo.toISOString());\n}",
      "isEnabled": true
    }
  ]
}
```

#### Cron Schedule Format

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

Examples:
- `0 * * * *` - Every hour
- `0 0 * * *` - Daily at midnight
- `0 0 * * 0` - Weekly on Sunday
- `*/15 * * * *` - Every 15 minutes

---

## API Reference

### Plugin Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plugins/registry` | GET | List all plugins |
| `/api/plugins/registry/:id` | GET | Get plugin details |
| `/api/plugins/active` | GET | Get active plugins with widgets |
| `/api/plugins/import` | POST | Install a plugin |
| `/api/plugins/:id/uninstall` | DELETE | Uninstall a plugin |
| `/api/plugins/:id/activate` | POST | Activate a plugin |
| `/api/plugins/:id/deactivate` | POST | Deactivate a plugin |

### Plugin Starters

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plugins/starters` | GET | List available starters |
| `/api/plugins/starters/:slug` | GET | Get starter details |
| `/api/plugins/starters/seed` | POST | Seed starters from JSON |

### Plugin Execution

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plugins/:pluginId/exec/*` | ALL | Execute plugin controller |
| `/api/plugins/widgets/:widgetId` | GET | Get widget component |

### Headers

Always include these headers for authenticated requests:

```javascript
{
  'Content-Type': 'application/json',
  'x-store-id': '<store-uuid>',
  'Authorization': 'Bearer <token>'  // For admin endpoints
}
```

---

## Context & Dependencies

### Frontend (Widgets & Admin Pages)

```javascript
// Available globally
React, useState, useEffect, useCallback, useMemo

// UI Components
Card, CardContent, CardHeader, CardTitle
Button, Input, Badge, Checkbox

// Icons (LucideIcons namespace)
LucideIcons.MessageCircle
LucideIcons.Settings
LucideIcons.Star
// ... all lucide-react icons

// API Client (admin pages only)
apiClient.get('/endpoint')
apiClient.post('/endpoint', data)
```

### Backend (Controllers)

```javascript
async function controller(req, res, { supabase }) {
  // Request object
  req.body      // POST data
  req.query     // URL query params
  req.params    // URL path params
  req.headers   // HTTP headers
  req.user      // Authenticated user
  req.method    // HTTP method

  // Response object
  res.json({ success: true, data })
  res.status(400).json({ error: 'Bad request' })

  // Database
  supabase.from('table').select('*')
}
```

---

## Example Plugins

### 1. Live Chat (`live-chat.json`)
- Floating chat widget for customer support
- Admin dashboard for managing conversations
- Real-time messaging with session tracking

### 2. Product Reviews (`product-reviews.json`)
- Star rating system
- Review moderation admin page
- Review display widget

### 3. Product Q&A (`product-qa.json`)
- Customer questions on products
- Admin answer management
- Q&A display widget

### 4. Free Gift Modal (`free-gift-modal.json`)
- Promotional popup widget
- Cart threshold triggers
- Configurable gift products

View all examples in: `public/example-plugins/`

---

## Best Practices

### 1. Always Include Store ID

```javascript
// In widgets/admin pages
const getHeaders = () => {
  const headers = {};
  const storeId = localStorage.getItem('selectedStoreId');
  if (storeId) headers['x-store-id'] = storeId;
  return headers;
};

fetch('/api/plugins/my-plugin/exec/data', { headers: getHeaders() });
```

### 2. Error Handling in Controllers

```javascript
async function controller(req, res, { supabase }) {
  try {
    const { data, error } = await supabase.from('table').select('*');
    if (error) throw error;
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

### 3. Use Supabase, Not Sequelize

Controllers receive `{ supabase }` context. Always use Supabase client methods:

```javascript
// CORRECT
const { data } = await supabase.from('table').select('*');

// WRONG - will cause errors
const data = await sequelize.query('SELECT * FROM table');
```

### 4. Validate Input

```javascript
async function createItem(req, res, { supabase }) {
  const { name, value } = req.body;

  if (!name || !value) {
    return res.status(400).json({
      success: false,
      error: 'Name and value are required'
    });
  }

  // Continue with valid data...
}
```

### 5. Use Appropriate Widget Categories

For global/floating widgets, use these categories:
- `support` - Customer support widgets
- `chat` - Chat widgets
- `floating` - Any floating UI
- `global` - Site-wide widgets

### 6. Migration Naming

Use timestamp prefixes for migration versions:
```
1704067200000_create_tables
1704153600000_add_indexes
1704240000000_add_column
```

---

## Troubleshooting

### Error: "Cannot read properties of undefined (reading 'query')"

**Cause**: Controller code uses `sequelize` instead of `supabase`.

**Fix**: Update controller to use Supabase:
```javascript
// Change from:
async function getData(req, res, { sequelize }) {
  const result = await sequelize.query('SELECT * FROM table');
}

// To:
async function getData(req, res, { supabase }) {
  const { data } = await supabase.from('table').select('*');
}
```

### Error: 401 Unauthorized on Plugin Exec

**Cause**: Missing store ID in request.

**Fix**: Include `x-store-id` header:
```javascript
fetch('/api/plugins/my-plugin/exec/data', {
  headers: {
    'x-store-id': localStorage.getItem('selectedStoreId')
  }
});
```

### Widget Not Appearing on Storefront

**Cause**: Widget category not in global list.

**Fix**: Set widget category to `support`, `floating`, `global`, or `chat`.

### Admin Page Shows "Page Not Found"

**Cause**: Route mismatch between manifest and admin page.

**Fix**: Ensure `adminNavigation.route` matches `adminPages[].route`:
```json
{
  "manifest": {
    "adminNavigation": {
      "route": "/admin/plugins/my-plugin/dashboard"
    }
  },
  "adminPages": [{
    "pageKey": "dashboard",
    "route": "/admin/plugins/my-plugin/dashboard"
  }]
}
```

### JSX Not Rendering

**Cause**: JSX transformation failed.

**Fix**:
1. Check browser console for Babel errors
2. Ensure JSX syntax is valid
3. Re-install the plugin to trigger transformation

---

## File Locations

| File | Purpose |
|------|---------|
| `public/example-plugins/*.json` | Plugin starter templates |
| `backend/src/routes/plugin-api.js` | Plugin API endpoints |
| `backend/src/utils/jsxTransformer.js` | JSX to JS transformation |
| `src/components/plugins/DynamicPluginAdminPage.jsx` | Admin page renderer |
| `src/components/plugins/PluginWidgetRenderer.jsx` | Widget renderer |
| `src/components/storefront/GlobalPluginWidgets.jsx` | Global widget loader |

---

## Support

For questions or issues:
- Check the example plugins in `public/example-plugins/`
- Review error messages in browser console
- Check backend logs on Render dashboard

