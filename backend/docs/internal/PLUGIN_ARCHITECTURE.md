# Plugin Architecture - Database-Driven Implementation

Complete guide on how models, controllers, hooks, events, and widgets are implemented in the database-driven plugin system.

---

## 📊 Database Schema Overview

### Core Tables

| Table | Purpose | Storage Type | Execution Context |
|-------|---------|--------------|-------------------|
| `plugin_registry` | Plugin metadata | Metadata | - |
| `plugin_scripts` | **Executable frontend code ONLY** | TEXT (code) | Frontend |
| `plugin_events` | Event listeners | TEXT (code) | Frontend/Backend |
| `plugin_hooks` | Hook handlers | TEXT (code) | Frontend/Backend |
| `plugin_widgets` | UI components | TEXT (code) | Frontend |
| `plugin_entities` | Database schemas | JSONB schema | Database |
| `plugin_controllers` | API endpoints | TEXT (code) | Backend |
| `plugin_migrations` | Migration SQL | TEXT (SQL) | Database |
| `plugin_docs` | **Documentation/metadata** | TEXT | Reference |
| `plugin_data` | Runtime key-value storage | JSONB | Runtime |
| `plugin_dependencies` | npm packages | TEXT | Runtime |

---

## 1️⃣ Entities (Database Models)

### ✅ Fully Implemented - `plugin_entities` Table

**Schema:**
```sql
CREATE TABLE plugin_entities (
  id UUID PRIMARY KEY,
  plugin_id UUID NOT NULL,
  entity_name VARCHAR(255) NOT NULL,       -- e.g., "HamidCart"
  table_name VARCHAR(255) NOT NULL,        -- e.g., "hamid_cart"
  description TEXT,
  schema_definition JSONB NOT NULL,        -- Column definitions, indexes, constraints
  migration_status VARCHAR(50) DEFAULT 'pending',  -- pending, migrated, failed
  migration_version VARCHAR(50),
  migrated_at TIMESTAMP WITH TIME ZONE,
  create_table_sql TEXT,                   -- Auto-generated CREATE TABLE
  drop_table_sql TEXT,                     -- Auto-generated DROP TABLE
  model_code TEXT,                         -- Optional Sequelize model
  is_enabled BOOLEAN DEFAULT true,
  CONSTRAINT unique_plugin_entity UNIQUE (plugin_id, entity_name)
);
```

**How It Works:**

#### **Defining Entities in AI Studio:**
Users can define database entities directly in AI Studio:

```json
{
  "entity_name": "HamidCart",
  "table_name": "hamid_cart",
  "schema_definition": {
    "columns": [
      { "name": "id", "type": "UUID", "primaryKey": true, "default": "gen_random_uuid()" },
      { "name": "user_id", "type": "UUID", "nullable": true, "comment": "User reference" },
      { "name": "session_id", "type": "VARCHAR(255)", "nullable": true },
      { "name": "cart_items_count", "type": "INTEGER", "default": 0 },
      { "name": "visited_at", "type": "TIMESTAMP", "default": "NOW()" }
    ],
    "indexes": [
      { "name": "idx_hamid_cart_user", "columns": ["user_id"] },
      { "name": "idx_hamid_cart_visited_at", "columns": ["visited_at"], "order": "DESC" }
    ],
    "foreignKeys": [
      { "column": "user_id", "references": "users(id)", "onDelete": "SET NULL" }
    ]
  }
}
```

#### **FileTree Representation:**
```
📁 entities/
  └─ HamidCart.json [🗄️ hamid_cart] [Run Migration ▶]
```

**When user clicks "Run Migration":**
1. Generate CREATE TABLE SQL from schema_definition
2. Create timestamped migration file
3. Execute migration via plugin-migration-tracker
4. Update migration_status to 'migrated'
5. Table is now available for queries

**Workflow:**
```
AI Studio:
1. User creates entity "HamidCart" in FileTree
2. AI generates schema_definition JSON
3. Saved to plugin_entities table (status: pending)
4. User clicks [Run Migration ▶] button
5. Migration executes, creates hamid_cart table
6. Status updates to 'migrated'
7. Controllers can now use the table
```

**Example: Cart Hamid Plugin**
```javascript
// Entity stored in plugin_entities
{
  entity_name: 'HamidCart',
  table_name: 'hamid_cart',
  migration_status: 'migrated',
  schema_definition: { /* full schema */ }
}

// After migration, table exists in database:
SELECT * FROM hamid_cart;
```

---

## 2️⃣ Controllers (API Endpoints)

### ✅ Fully Implemented - `plugin_controllers` Table

**Schema:**
```sql
CREATE TABLE plugin_controllers (
  id UUID PRIMARY KEY,
  plugin_id UUID NOT NULL,
  controller_name VARCHAR(255) NOT NULL,  -- e.g., "trackVisit"
  description TEXT,
  method VARCHAR(10) NOT NULL,            -- GET, POST, PUT, DELETE, PATCH
  path VARCHAR(500) NOT NULL,             -- e.g., "/track-visit"
  handler_code TEXT NOT NULL,             -- JavaScript function code
  request_schema JSONB,                   -- Request validation schema
  response_schema JSONB,                  -- Response format schema
  requires_auth BOOLEAN DEFAULT false,
  allowed_roles JSONB,                    -- ["admin", "user"]
  rate_limit INTEGER DEFAULT 100,
  is_enabled BOOLEAN DEFAULT true,
  CONSTRAINT unique_plugin_controller UNIQUE (plugin_id, method, path)
);
```

**How It Works:**

#### **Defining Controllers in AI Studio:**
Users can define API endpoints directly in AI Studio:

```javascript
{
  controller_name: "trackVisit",
  method: "POST",
  path: "/track-visit",
  handler_code: `async function trackVisit(req, res, { sequelize }) {
    const { user_id, session_id, cart_items_count } = req.body;

    const result = await sequelize.query(\`
      INSERT INTO hamid_cart (user_id, session_id, cart_items_count)
      VALUES ($1, $2, $3) RETURNING *
    \`, {
      bind: [user_id, session_id, cart_items_count],
      type: sequelize.QueryTypes.INSERT
    });

    return res.json({ success: true, visit: result[0][0] });
  }`
}
```

#### **FileTree Representation:**
```
📁 controllers/
  └─ trackVisit.js [POST /track-visit]
  └─ getVisits.js [GET /visits]
  └─ getStats.js [GET /stats]
```

#### **URL Pattern:**
```
/api/plugins/{plugin-slug}/{path}

Examples:
- POST /api/plugins/cart-hamid/track-visit
- GET  /api/plugins/cart-hamid/visits
- GET  /api/plugins/cart-hamid/stats
```

#### **Execution Flow:**
```javascript
// 1. Request comes in: POST /api/plugins/cart-hamid/track-visit

// 2. Backend looks up controller in plugin_controllers table
const controller = await getController('cart-hamid', 'POST', '/track-visit');

// 3. Execute handler_code with context
const handler = new Function('req', 'res', 'context', controller.handler_code);
await handler(req, res, { sequelize, models, plugin });

// 4. Return response to client
```

**Features:**
- ✅ Dynamic route registration
- ✅ Full database access via sequelize
- ✅ Request/response schema validation
- ✅ Authentication & authorization
- ✅ Rate limiting per endpoint
- ✅ Execution tracking
- ✅ 100% AI Studio driven

**Example: Cart Hamid Plugin**
```javascript
// Controllers stored in plugin_controllers:
[
  { method: 'POST', path: '/track-visit', controller_name: 'trackVisit' },
  { method: 'GET',  path: '/visits',      controller_name: 'getVisits' },
  { method: 'GET',  path: '/stats',       controller_name: 'getStats' }
]

// Available as:
POST /api/plugins/cart-hamid/track-visit
GET  /api/plugins/cart-hamid/visits
GET  /api/plugins/cart-hamid/stats
```

---

## 3️⃣ Hooks (Data Transformation)

### ✅ Fully Implemented - `plugin_hooks` Table

**Schema:**
```sql
CREATE TABLE plugin_hooks (
  id UUID PRIMARY KEY,
  plugin_id UUID NOT NULL,
  hook_name VARCHAR(255) NOT NULL,      -- 'product.price', 'cart.total'
  hook_type VARCHAR(20) DEFAULT 'filter', -- 'filter' or 'action'
  handler_function TEXT NOT NULL,        -- JavaScript function code
  priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true
);
```

**How It Works:**

#### **Storage (Database):**
```javascript
// Stored in plugin_hooks table
{
  plugin_id: 'eea24e22-...',
  hook_name: 'product.price',
  hook_type: 'filter',
  handler_function: `
    function(price, product) {
      // Apply 10% discount
      return price * 0.9;
    }
  `,
  priority: 10
}
```

#### **Loading (App Initialization):**
```javascript
// App.jsx:94-102
GET /api/plugins/active
→ Returns hooks from plugin_hooks table

for (const hook of plugin.hooks) {
  const handlerFunction = createHandlerFromDatabaseCode(hook.handler_code);
  hookSystem.register(hook.hook_name, handlerFunction, hook.priority);
}
```

#### **Execution (Runtime):**
```javascript
// ProductCard.jsx (example)
let finalPrice = hookSystem.apply('product.price', basePrice, product);
// Plugin hook executes, modifies price
// Returns discounted price
```

**Hook Types:**
- **Filter:** Transform data, must return value
  - Example: `product.price`, `cart.total`, `email.content`
- **Action:** Side effects, no return value expected
  - Example: `product.save`, `order.complete`

**Priority:**
- Lower number = higher priority
- Example: priority 5 runs before priority 10
- Hooks chain: output of one becomes input of next

---

## 4️⃣ Events (Notifications)

### ✅ Fully Implemented - `plugin_events` Table

**Schema:**
```sql
CREATE TABLE plugin_events (
  id UUID PRIMARY KEY,
  plugin_id UUID NOT NULL,
  event_name VARCHAR(255) NOT NULL,  -- 'cart.viewed', 'product.view'
  listener_function TEXT NOT NULL,   -- JavaScript function code
  priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true
);
```

**How It Works:**

#### **Storage (Database):**
```javascript
// Stored in plugin_events table
{
  plugin_id: 'eea24e22-...',
  event_name: 'cart.viewed',
  listener_function: `
    export default function onCartViewed(data) {
      console.log('Cart viewed!', data);
      alert('Welcome to cart!');
    }
  `,
  priority: 10
}
```

#### **FileTree Representation:**
```
📁 events/
  └─ cart_viewed.js [🟣 cart.viewed]
  └─ test.js [🟣 product.view]
```

**Filename ↔ Event Name Mapping:**
- Database: `cart.viewed` (dot notation)
- FileTree: `cart_viewed.js` (underscore notation)
- Conversion: Replace `.` ↔ `_`

#### **Loading (App Initialization):**
```javascript
// App.jsx:104-112
GET /api/plugins/active/:pluginId
→ Returns events from plugin_events table

for (const event of plugin.events) {
  const listenerFunction = createHandlerFromDatabaseCode(event.listener_code);
  eventSystem.on(event.event_name, listenerFunction);
}
```

#### **Triggering (Runtime):**
```javascript
// Cart.jsx:1051-1062
eventSystem.emit('cart.viewed', {
  items: cartItems,
  subtotal,
  total,
  ...cartContext
});

// All registered listeners execute in priority order
```

**Creating New Events:**
1. Click "New File" → Event Listener
2. Choose event name (e.g., `product.view`)
3. Write listener code
4. Saves to `plugin_events` table
5. Appears as `events/product_view.js` in FileTree

**Remapping Events:**
1. Select event file (e.g., `test.js`)
2. Click "Edit Event" button (⚡)
3. Change event name (e.g., `product.view` → `cart.viewed`)
4. Updates `plugin_events.event_name` column
5. Now listens to different event!

---

## 5️⃣ Scripts (Executable Frontend Code ONLY)

### ✅ Fully Implemented - `plugin_scripts` Table

**Schema:**
```sql
CREATE TABLE plugin_scripts (
  id UUID PRIMARY KEY,
  plugin_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,   -- 'components/Widget.jsx'
  file_content TEXT NOT NULL,        -- JavaScript/CSS code
  script_type VARCHAR(20) NOT NULL,  -- 'js' or 'css'
  scope VARCHAR(20) NOT NULL,        -- 'frontend', 'backend', 'admin'
  load_priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true
);
```

**How It Works:**

#### **Storage (Database):**
```javascript
{
  plugin_id: 'eea24e22-...',
  file_name: 'components/CartHamidWidget.jsx',
  file_content: `function CartHamidWidget() {
    return React.createElement('div', {...}, 'Hello!');
  }`,
  script_type: 'js',
  scope: 'frontend',
  load_priority: 0
}
```

#### **FileTree Representation:**
```
📁 components/
  └─ CartHamidWidget.jsx
📁 utils/
  └─ formatters.js
📄 README.md
```

#### **Loading (Frontend):**
```javascript
// App.jsx:124-159
GET /api/plugins/:pluginId/scripts?scope=frontend

for (const script of scripts) {
  const scriptElement = document.createElement('script');
  scriptElement.type = 'module';
  scriptElement.textContent = script.content;
  document.head.appendChild(scriptElement);
}
```

#### **Loading (Backend):**
```javascript
// PluginModuleLoader.js:189-247
GET /api/plugins/:pluginId/scripts?scope=backend

for (const script of scripts) {
  const transformedCode = transformModuleCode(script.file_content);
  // Execute in isolated context using new Function()
  // Provide: require(), console, pluginData API
}
```

**Allowed File Types (ONLY executable code):**
- **Components:** React widgets, UI elements (`components/*.jsx`)
- **Utilities:** Helper functions, formatters (`utils/*.js`)
- **Services:** Business logic, API clients (`services/*.js`)
- **Styles:** CSS for custom styling (`styles/*.css`)

**NOT Allowed (use specialized tables):**
- ❌ `events/*.js` → Use `plugin_events`
- ❌ `hooks/*.js` → Use `plugin_hooks`
- ❌ `entities/*.json` → Use `plugin_entities`
- ❌ `controllers/*.js` → Use `plugin_controllers`
- ❌ `migrations/*.sql` → Use `plugin_migrations`
- ❌ `admin/*.jsx` → Special handling
- ❌ `README.md` → Use `plugin_docs`
- ❌ `manifest.json` → Use `plugin_docs`

---

## 6️⃣ Documentation & Metadata

### ✅ Fully Implemented - `plugin_docs` Table

**Schema:**
```sql
CREATE TABLE plugin_docs (
  id UUID PRIMARY KEY,
  plugin_id UUID NOT NULL,
  doc_type VARCHAR(50) NOT NULL,      -- 'readme', 'manifest', 'changelog', 'license'
  file_name VARCHAR(255) NOT NULL,    -- 'README.md', 'manifest.json'
  content TEXT NOT NULL,              -- File content
  format VARCHAR(20) DEFAULT 'markdown',  -- 'markdown', 'json', 'text'
  description TEXT,
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0
);
```

**Purpose:**
- Store documentation files (README.md, CHANGELOG.md, LICENSE)
- Store metadata files (manifest.json)
- Reference only - NOT executed
- Separate from executable code

**Document Types:**
- `readme` → README.md
- `manifest` → manifest.json
- `changelog` → CHANGELOG.md
- `license` → LICENSE
- `contributing` → CONTRIBUTING.md

---

## 6️⃣ Widgets (UI Components)

### ✅ Fully Implemented - `plugin_widgets` Table

**Schema:**
```sql
CREATE TABLE plugin_widgets (
  id UUID PRIMARY KEY,
  plugin_id UUID NOT NULL,
  widget_id VARCHAR(255) NOT NULL,    -- 'cart-hamid-widget'
  widget_name VARCHAR(255) NOT NULL,  -- 'Cart Hamid Widget'
  description TEXT,
  component_code TEXT NOT NULL,       -- React component code
  default_config JSONB DEFAULT '{}',
  category VARCHAR(100),              -- 'functional', 'promotional'
  icon VARCHAR(50),                   -- 'BarChart3'
  is_enabled BOOLEAN DEFAULT true
);
```

**How It Works:**

#### **Storage (Database):**
```javascript
{
  widget_id: 'cart-hamid-widget',
  widget_name: 'Cart Hamid Widget',
  component_code: `function CartHamidWidget() {
    const [count, setCount] = React.useState(0);
    return React.createElement('div', {...}, 'Visits: ', count);
  }`,
  category: 'functional',
  icon: 'BarChart3'
}
```

#### **Adding to Page:**

**Via Slot Editor:**
1. Cart Editor → "Add New" → "Plugin Widgets"
2. Select widget from list
3. Creates slot with `type: 'plugin_widget'`
4. Saves to `slot_configurations` table

**Via Database:**
```javascript
{
  id: 'header_widget',
  type: 'plugin_widget',
  widgetId: 'cart-hamid-widget',
  position: { col: 1, row: 1 }
}
```

#### **Rendering (Runtime):**
```javascript
// UnifiedSlotRenderer.jsx:1103-1128
if (slot.type === 'plugin_widget') {
  GET /api/plugins/widgets/:widgetId
  → Returns component_code

  // Compile code
  const cleanCode = code.replace(/^export\s+default\s+/, '');
  const createComponent = new Function('React', `return ${cleanCode};`);
  const Widget = createComponent(React);

  // Render
  return <Widget config={slot.config} slotData={data} />;
}
```

**Widget Code Requirements:**
- ❌ No JSX syntax (can't compile at runtime)
- ✅ Use `React.createElement()` instead
- ✅ Export as function: `export default function Widget() {...}`
- ✅ Access React hooks: `React.useState()`, `React.useEffect()`

---

## 🔄 Complete Plugin Lifecycle

### **1. Plugin Creation**

```
User: Click "Create with AI" or "Clone Template"
↓
AI generates or template clones
↓
INSERT INTO plugin_registry (metadata)
INSERT INTO plugin_scripts (files)
INSERT INTO plugin_events (events)
INSERT INTO plugin_widgets (widgets)
↓
Plugin appears in My Plugins
```

### **2. Plugin Activation**

```
App.jsx initialization
↓
GET /api/plugins/active
↓
For each active plugin:
  ├─ Load hooks → hookSystem.register()
  ├─ Load events → eventSystem.on()
  └─ Load frontend scripts → inject <script> tags
↓
window.__pluginsReady = true
```

### **3. Plugin Editing**

```
User: Click "Edit in AI Studio"
↓
DeveloperPluginEditor opens
↓
GET /api/plugins/registry/:id
  ├─ Query plugin_scripts → files
  ├─ Query plugin_events → events
  ├─ Query plugin_hooks → hooks
  └─ Merge into source_code array
↓
FileTree shows all files
↓
User edits file
↓
PUT /api/plugins/registry/:id/files
  ├─ events/* → UPDATE plugin_events
  ├─ hooks/* → UPDATE plugin_hooks
  └─ other → UPDATE plugin_scripts
↓
Changes saved to database
```

### **4. Runtime Execution**

```
User Action (e.g., navigate to /cart)
↓
Cart.jsx component renders
↓
eventSystem.emit('cart.viewed', data)
↓
EventSystem looks up registered listeners
↓
Executes all listeners in priority order:
  1. Cart Hamid plugin (priority 10)
  2. Analytics plugin (priority 15)
  3. Custom tracking (priority 20)
↓
Each listener's code executes
↓
User sees alert, data logged, etc.
```

---

## 🛠️ Implementation Details

### **How Files Are Stored**

**Directory Structure (Logical):**
```
plugin-name/
├── events/
│   ├── cart_viewed.js       → plugin_events (event_name: 'cart.viewed')
│   └── test.js              → plugin_events (event_name: 'product.view')
├── hooks/
│   └── price_discount.js    → plugin_hooks (hook_name: 'product.price')
├── components/
│   └── Widget.jsx           → plugin_scripts (scope: 'frontend')
├── utils/
│   └── formatters.js        → plugin_scripts (scope: 'frontend')
├── README.md                → plugin_scripts
└── manifest.json            → plugin_registry.manifest (JSONB)
```

**Database Storage (Physical):**
```sql
-- All files in one table (plugin_scripts)
| file_name                  | file_content      | scope    |
|----------------------------|-------------------|----------|
| components/Widget.jsx      | function...       | frontend |
| utils/formatters.js        | export...         | frontend |
| README.md                  | # Documentation   | frontend |

-- Events in separate table (plugin_events)
| event_name   | listener_function   | priority |
|--------------|---------------------|----------|
| cart.viewed  | export default...   | 10       |
| product.view | export default...   | 10       |

-- Hooks in separate table (plugin_hooks)
| hook_name      | handler_function | hook_type |
|----------------|------------------|-----------|
| product.price  | function...      | filter    |
```

---

## 🔌 File Type Handlers

### **Events (events/*.js)**

**Create:**
```javascript
// Frontend: DeveloperPluginEditor.jsx:472-481
POST /api/plugins/:pluginId/event-listeners
{
  event_name: 'cart.viewed',
  listener_function: 'export default function...',
  priority: 10
}
→ INSERT INTO plugin_events
```

**Save:**
```javascript
// Backend: plugin-api.js:1234-1280
PUT /api/plugins/registry/:id/files
path: 'events/cart_viewed.js'
→ Extract event name: 'cart.viewed'
→ UPDATE plugin_events SET listener_function = ...
```

**Load:**
```javascript
// Backend: plugin-api.js:707-722
SELECT * FROM plugin_events WHERE plugin_id = :id
→ Map to files: event_name.replace(/\./g, '_') + '.js'
→ Include in source_code array with eventName metadata
```

**Display:**
```javascript
// Frontend: DeveloperPluginEditor.jsx:194-198
// Normalize event_name → eventName
// Preserve in file node metadata
→ FileTree shows with purple badge
→ Edit Event button appears (if eventName exists)
```

---

### **Hooks (hooks/*.js)**

**Create:**
```javascript
// Similar to events, but uses plugin_hooks table
POST creates entry in plugin_hooks
→ hook_name, hook_type, handler_function
```

**Load:**
```javascript
// Backend: plugin-api.js:628-643
SELECT * FROM plugin_hooks WHERE plugin_id = :id
→ Returns as hooks array
→ App.jsx registers in hookSystem
```

**Execute:**
```javascript
// HookSystem.js:46-67
hookSystem.apply('product.price', 100, product)
→ Executes all registered handlers in priority order
→ Chains output: handler1(100) → handler2(90) → handler3(81)
→ Returns final value: 81
```

---

### **Scripts (components/, utils/, etc.)**

**Create:**
```javascript
// New File → Component/Controller/etc.
→ PUT /api/plugins/registry/:id/files
→ INSERT INTO plugin_scripts
```

**Load:**
```javascript
// Backend: plugin-api.js:676-693
SELECT * FROM plugin_scripts WHERE plugin_id = :id
→ Returns as files array with name, code properties
→ Merged into source_code
```

**Execute (Frontend):**
```javascript
// App.jsx:124-159
GET /api/plugins/:pluginId/scripts?scope=frontend
→ For each script:
  document.createElement('script')
  script.textContent = code
  document.head.appendChild(script)
→ Code executes, exports to window if needed
```

---

### **Widgets (Registered Components)**

**Register:**
```javascript
// Script or manual INSERT
INSERT INTO plugin_widgets (
  widget_id, widget_name, component_code
)
→ Widget available in selector
```

**Add to Page:**
```javascript
// Slot Editor → Add New → Plugin Widgets
→ Creates slot: { type: 'plugin_widget', widgetId: 'cart-hamid-widget' }
→ Saves to slot_configurations
```

**Render:**
```javascript
// UnifiedSlotRenderer.jsx:1103-1128
GET /api/plugins/widgets/:widgetId
→ Returns component_code

const cleanCode = code.replace(/^export default /, '');
const createComponent = new Function('React', `return ${cleanCode};`);
const Widget = createComponent(React);

return <Widget />;
```

---

## 📝 Code Execution Methods

### **Frontend Execution**

**Method 1: Script Injection (plugin_scripts)**
```javascript
// For utility files, libraries
<script type="module">
  export function formatCurrency(amount) {...}
  window.MyUtils = { formatCurrency };
</script>
```

**Method 2: Function Constructor (hooks, events)**
```javascript
// For hooks and events
const code = `function(price) { return price * 0.9; }`;
const handler = new Function(`return ${code}`)();
hookSystem.register('product.price', handler);
```

**Method 3: Lazy Component (widgets)**
```javascript
// For React widgets
const componentCode = `function Widget() {...}`;
const Widget = new Function('React', `return ${componentCode}`)(React);
return <Widget />;
```

### **Backend Execution**

**Method: Module Transformation**
```javascript
// PluginModuleLoader.js:252-322

// Transform ES6 → CommonJS
import X from 'Y' → const X = require('Y')
export default X → module.exports = X

// Execute in isolated context
const func = new Function('module', 'exports', 'require', transformedCode);
const module = { exports: {} };
func(module, exports, customRequire);

// Store result
context.modules.set(moduleName, module.exports);
```

---

## 🔒 Security & Isolation

### **Frontend Sandbox:**
- Plugins run in browser context (same as app)
- Access to: React, window, document, fetch
- Can't access: Node.js modules, filesystem
- Subject to: Browser security policies (CORS, CSP)

### **Backend Sandbox:**
- Isolated execution context per plugin
- Limited globals: console, setTimeout, Math, Date, JSON
- Custom require(): Only approved dependencies
- No access to: process, fs, child_process
- Controlled database access via `pluginData` API

---

## 📂 File Organization Best Practices

### **Recommended Structure:**

```
your-plugin/
├── events/
│   ├── cart_viewed.js       # Event listeners
│   └── order_created.js
├── hooks/
│   ├── product_price.js     # Hook handlers
│   └── cart_total.js
├── components/
│   ├── MyWidget.jsx         # React components (use createElement!)
│   └── MyBanner.jsx
├── utils/
│   ├── formatters.js        # Utility functions
│   ├── validators.js
│   └── helpers.js
├── services/
│   └── api.js               # API clients
├── README.md
└── manifest.json
```

### **File Naming Conventions:**

**Events:**
- Pattern: `{event_name_with_underscores}.js`
- Example: `cart_viewed.js` → maps to `cart.viewed`
- Convention: Use descriptive names matching event

**Hooks:**
- Pattern: `{hook_name_with_underscores}.js`
- Example: `product_price.js` → maps to `product.price`
- Convention: Use hook name in filename

**Components:**
- Pattern: `PascalCase.jsx`
- Example: `CartHamidWidget.jsx`, `ProductBadge.jsx`
- Convention: React component naming

**Utilities:**
- Pattern: `camelCase.js`
- Example: `formatters.js`, `validators.js`, `helpers.js`
- Convention: Descriptive, purpose-based names

---

## 🚀 Plugin Distribution

### **Export Package:**
```json
{
  "packageVersion": "1.0.0",
  "plugin": {
    "name": "Cart Hamid",
    "slug": "cart-hamid",
    "version": "1.0.0",
    ...
  },
  "files": [
    {"name": "components/Widget.jsx", "content": "..."},
    {"name": "utils/formatters.js", "content": "..."}
  ],
  "events": [
    {"eventName": "cart.viewed", "listenerCode": "..."}
  ],
  "hooks": [...],
  "widgets": [...]
}
```

### **Import Process:**
```
1. Upload JSON package
2. Generate new UUID
3. Create plugin_registry entry
4. INSERT all files → plugin_scripts
5. INSERT all events → plugin_events
6. INSERT all hooks → plugin_hooks
7. INSERT all widgets → plugin_widgets
8. Auto-increment name/slug if duplicate
9. Set creator_id to current user
10. Plugin ready to use!
```

---

## 🎯 Quick Reference

| Want to... | Use Table | File Location | Code Access |
|------------|-----------|---------------|-------------|
| Listen to events | `plugin_events` | `events/event_name.js` | `eventSystem.on()` |
| Transform data | `plugin_hooks` | `hooks/hook_name.js` | `hookSystem.apply()` |
| Add UI component | `plugin_widgets` | Register in table | Slot editor |
| Share utilities | `plugin_scripts` | `utils/*.js` | Export to window |
| Store settings | `plugin_data` | - | `pluginData.get/set()` |
| Create database tables | `plugin_migrations` | `migrations/*.sql` | Migration tracker |
| Define data models | `plugin_entities` | `entities/*.json` | AI Studio + migration |
| Create API endpoints | `plugin_controllers` | `controllers/*.js` | Dynamic routes |

---

## 7️⃣ Migrations (Database Schema Changes)

### ✅ Fully Implemented - `plugin_migrations` Table

**Schema:**
```sql
CREATE TABLE plugin_migrations (
  id UUID PRIMARY KEY,
  plugin_id UUID NOT NULL,
  plugin_name VARCHAR(255) NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  migration_version VARCHAR(50) NOT NULL,  -- e.g., "20250129_143000"
  migration_description TEXT,
  status VARCHAR(50) DEFAULT 'pending',    -- pending, running, completed, failed, rolled_back
  executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  execution_time_ms INTEGER,
  error_message TEXT,
  checksum VARCHAR(64),
  up_sql TEXT,        -- SQL to create/alter tables
  down_sql TEXT,      -- SQL to rollback changes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_plugin_migration UNIQUE (plugin_id, migration_version)
);
```

**How It Works:**

#### **Migration File Format:**
```sql
-- =====================================================
-- MIGRATION: Create hamid_cart table
-- =====================================================
-- Plugin: Cart Hamid (109c940f-5d33-472c-b7df-c48e68c35696)
-- Version: 20250129_143000
-- Description: Create hamid_cart table for tracking cart page visits
-- =====================================================

-- UP Migration
CREATE TABLE IF NOT EXISTS hamid_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id VARCHAR(255),
  cart_items_count INTEGER DEFAULT 0,
  -- ... more columns
);

CREATE INDEX IF NOT EXISTS idx_hamid_cart_user ON hamid_cart(user_id);

-- =====================================================
-- DOWN Migration (Rollback)
-- =====================================================
DROP TABLE IF EXISTS hamid_cart CASCADE;
```

#### **Running Migrations:**
```bash
# List all migrations
node run-plugin-migration.js list

# List migrations for specific plugin
node run-plugin-migration.js list 109c940f-5d33-472c-b7df-c48e68c35696

# Dry run (preview without executing)
node run-plugin-migration.js run 20250129_143000_create_hamid_cart_table.sql --dry-run

# Run migration
node run-plugin-migration.js run 20250129_143000_create_hamid_cart_table.sql

# Force re-run (if already executed)
node run-plugin-migration.js run 20250129_143000_create_hamid_cart_table.sql --force

# Rollback migration
node run-plugin-migration.js rollback 109c940f-5d33-472c-b7df-c48e68c35696 20250129_143000
```

#### **Migration Tracking:**
```javascript
// backend/src/database/migrations/plugin-migration-tracker.js
class PluginMigrationTracker {
  async executeMigration(filename, options) {
    // 1. Parse migration file (extract plugin_id, version, up/down SQL)
    // 2. Check if already executed
    // 3. Record as 'running' in plugin_migrations table
    // 4. Execute up_sql
    // 5. Record as 'completed' with execution time
    // 6. On error, record as 'failed' with error message
  }

  async rollbackMigration(pluginId, version) {
    // 1. Find completed migration
    // 2. Execute down_sql
    // 3. Mark as 'rolled_back'
  }
}
```

**Features:**
- ✅ Timestamped versions (e.g., `20250129_143000`)
- ✅ Up/Down migrations (rollback capability)
- ✅ Execution tracking (status, time, errors)
- ✅ Checksum verification
- ✅ Dry run mode
- ✅ Force re-run option
- ✅ Per-plugin migration history
- ✅ Separate from core platform migrations (`_migrations` table)

**Example: Cart Hamid Plugin**
```sql
-- Migration creates hamid_cart table
-- Tracked in plugin_migrations:
{
  plugin_id: '109c940f-5d33-472c-b7df-c48e68c35696',
  plugin_name: 'Cart Hamid',
  migration_version: '20250129_143000',
  status: 'completed',
  executed_at: '2025-01-29 14:30:00',
  execution_time_ms: 125
}
```

---

## 📋 TODO: Future Enhancements

### Not Yet Implemented:

1. **Middleware:**
   - `plugin_middleware` table
   - Express middleware registration
   - Request/response transformation

4. **Scheduled Jobs:**
   - `plugin_jobs` table
   - Cron-style scheduling
   - Background task execution

---

## ✅ What's Working Now:

- ✅ Events (cart.viewed, product.view, etc.)
- ✅ Hooks (product.price, cart.total, etc.)
- ✅ Scripts (components, utilities, services)
- ✅ Widgets (UI components in slots)
- ✅ Entities (database models with JSON schema)
- ✅ Controllers (API endpoints with dynamic routes)
- ✅ Migrations (database schema changes with tracking)
- ✅ Data storage (key-value via plugin_data)
- ✅ Dependencies (npm packages)
- ✅ Export/Import (JSON packages)
- ✅ Starter templates (instant cloning)
- ✅ FileTree editor (all file types)

**The system is production-ready for events, hooks, scripts, widgets, entities, controllers, and migrations!** 🎉

**100% AI Studio Driven** - Users can create entities, controllers, and migrations entirely from AI Studio!
