# Plugin Development Guide

Learn how to create plugins using the AI Workspace.

## Getting Started

### Opening the Plugin Editor

1. Go to **AI Workspace** (`/ai-workspace`)
2. Click **Plugins** dropdown in the header
3. Select an existing plugin OR click **Create New Plugin**

### Creating a Plugin with AI

1. Click **Plugins** → **Create New Plugin**
2. Enter a name and description
3. The AI chat opens - tell it what you want:

```
"Create a live chat plugin with a floating chat button on the storefront
and an admin dashboard to view and respond to messages"
```

The AI generates the necessary files automatically.

---

## Plugin File Types

### Overview

| File Type | Purpose | Where it Runs |
|-----------|---------|---------------|
| **Widgets** | UI components on storefront | Browser (customer-facing) |
| **Admin Pages** | Dashboard pages for store owners | Browser (admin panel) |
| **Controllers** | API endpoints | Server (backend) |
| **Migrations** | Database table creation | Server (on install) |

### How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                    STOREFRONT (Customer)                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                      Widget                              ││
│  │  • Displays chat button                                  ││
│  │  • Sends messages via fetch()                            ││
│  │  • Calls: POST /api/plugins/my-plugin/exec/messages      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP Request
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     Controller                           ││
│  │  • Receives request (req.body, req.params)               ││
│  │  • Queries database using Supabase                       ││
│  │  • Returns JSON response                                 ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                      Database                            ││
│  │  • Tables created by Migrations                          ││
│  │  • Stores: messages, sessions, etc.                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP Request
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL (Store Owner)                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                     Admin Page                           ││
│  │  • Displays dashboard UI                                 ││
│  │  • Fetches messages via fetch()                          ││
│  │  • Calls: GET /api/plugins/my-plugin/exec/sessions       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Widgets

Widgets are React components displayed on the storefront.

### What They Do
- Display UI to customers (buttons, modals, banners)
- Call your plugin's controllers via fetch()
- Store local state (open/closed, user input)

### Categories

| Category | Behavior |
|----------|----------|
| `support`, `floating`, `chat`, `global` | Shows on **ALL** storefront pages |
| `product` | Shows on product pages only |
| `cart` | Shows on cart pages only |

### Code Format

Widgets **must use `React.createElement()`** (not JSX):

```javascript
function MyWidget({ config = {} }) {
  const [open, setOpen] = React.useState(false);

  // REQUIRED: Include store ID for tenant isolation
  const getHeaders = () => {
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    return storeId ? { 'x-store-id': storeId } : {};
  };

  // Call your plugin's controller
  const sendMessage = async (text) => {
    await fetch('/api/plugins/my-plugin/exec/messages', {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
  };

  return React.createElement('button', {
    onClick: () => setOpen(!open),
    style: { position: 'fixed', bottom: 20, right: 20, padding: 16 }
  }, '💬 Chat');
}
```

---

## Admin Pages

Admin pages are dashboard UI for store owners.

### What They Do
- Display management UI (tables, forms, settings)
- Call your plugin's controllers via fetch()
- Allow store owners to configure the plugin

### Code Format

Admin pages **can use JSX** syntax:

```jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const [messages, setMessages] = useState([]);

  const getHeaders = () => {
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    return storeId ? { 'x-store-id': storeId } : {};
  };

  useEffect(() => {
    // Fetch from your controller
    fetch('/api/plugins/my-plugin/exec/messages', { headers: getHeaders() })
      .then(r => r.json())
      .then(data => setMessages(data.messages));
  }, []);

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.map(m => <div key={m.id}>{m.text}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Available Imports

```javascript
// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Icons
import { MessageCircle, Send, Settings } from 'lucide-react';
```

---

## Controllers

Controllers are API endpoints that run on the server.

### What They Do
- Handle HTTP requests (GET, POST, PUT, DELETE)
- Access the database using Supabase
- Return JSON responses to widgets/admin pages

### Endpoint URL

```
/api/plugins/{plugin-slug}/exec/{controller-path}
```

Example paths:
```
GET  /api/plugins/my-plugin/exec/messages      → getMessages controller
POST /api/plugins/my-plugin/exec/messages      → sendMessage controller
GET  /api/plugins/my-plugin/exec/messages/123  → getMessage controller (id=123)
```

### Code Format

Controllers receive `req`, `res`, and `{ supabase }`:

```javascript
async function getMessages(req, res, { supabase }) {
  // req.query - URL query params (?status=active)
  // req.body  - POST request body
  // req.params - URL path params (:id)

  try {
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function sendMessage(req, res, { supabase }) {
  const { message, session_id } = req.body;

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ message, session_id })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
  return res.json({ success: true, message: data });
}
```

### Supabase Query Reference

```javascript
// SELECT all
const { data } = await supabase.from('table').select('*');

// SELECT with filter
const { data } = await supabase.from('table').select('*').eq('status', 'active');

// INSERT
const { data } = await supabase.from('table').insert({ name: 'Test' }).select().single();

// UPDATE
const { data } = await supabase.from('table').update({ name: 'New' }).eq('id', 123);

// DELETE
await supabase.from('table').delete().eq('id', 123);

// COUNT
const { count } = await supabase.from('table').select('*', { count: 'exact', head: true });
```

---

## Migrations

Migrations create database tables for your plugin.

### When They Run

1. **On Plugin Install**: When you or a user installs the plugin
2. **Manually**: Click "Run Migration" button in the plugin editor

### Migration Status

In the plugin editor file tree, click the **database icon** to see:
- ✅ **Applied**: Migration has run successfully
- ⏳ **Pending**: Migration needs to be run
- ❌ **Failed**: Migration encountered an error

### Code Format

Migrations are raw SQL:

```sql
-- Always use IF NOT EXISTS to prevent errors on re-run
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL UNIQUE,
  customer_email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  from_type VARCHAR(20) NOT NULL,  -- 'customer' or 'agent'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_status
  ON chat_sessions(status);
```

### Common Column Types

| Type | Use For |
|------|---------|
| `UUID` | Primary keys, IDs |
| `VARCHAR(n)` | Short text (names, emails) |
| `TEXT` | Long text (messages, descriptions) |
| `JSONB` | JSON data (configs, metadata) |
| `BOOLEAN` | True/false flags |
| `INTEGER` | Numbers |
| `DECIMAL(10,2)` | Money/prices |
| `TIMESTAMP WITH TIME ZONE` | Dates/times |

---

## Store ID Header (CRITICAL)

**Every API call must include the store ID** for multi-tenant isolation.

```javascript
const getHeaders = () => {
  const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
  return storeId ? { 'x-store-id': storeId } : {};
};

// GET request
fetch('/api/plugins/my-plugin/exec/data', {
  headers: getHeaders()
});

// POST request
fetch('/api/plugins/my-plugin/exec/data', {
  method: 'POST',
  headers: { ...getHeaders(), 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test' })
});
```

---

## Example AI Requests

### Create a complete plugin
```
"Create a product reviews plugin with:
- A star rating widget on product pages
- An admin page to moderate reviews
- Controllers to save and fetch reviews
- Database tables for reviews"
```

### Add a component
```
"Add a floating notification widget that shows on all pages"
```

### Fix an error
```
"I'm getting a 401 error when calling the API from my widget"
```

### Modify existing code
```
"Change the chat button color to blue and move it to the left side"
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Widget not showing | Wrong category | Set to `support`, `floating`, or `chat` |
| 401 error on API | Missing store ID | Add `x-store-id` header to fetch |
| Controller error | Using Sequelize | Use `{ supabase }` not `{ sequelize }` |
| Admin page 404 | Route mismatch | Match `adminNavigation.route` to `adminPages[].route` |
| Widget JSX error | Using JSX syntax | Use `React.createElement()` in widgets |

---

## Example Plugins

See working examples in `public/example-plugins/`:
- **live-chat.json** - Chat widget + admin dashboard
- **product-reviews.json** - Star ratings on products
- **free-gift-modal.json** - Promotional popup
