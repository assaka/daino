# Clean Plugin Architecture - No Duplicates!

## 🎯 Core Principle: ONE File Type = ONE Table

Each plugin file type has **exactly ONE** storage location. No duplicates, no confusion.

---

## 📊 Table Purposes

### Executable Code

**`plugin_scripts`** - Frontend executable code ONLY
- ✅ `components/*.jsx` - React components
- ✅ `utils/*.js` - Utility functions
- ✅ `services/*.js` - API clients
- ✅ `styles/*.css` - Stylesheets
- ❌ Nothing else belongs here!

**`plugin_events`** - Event listeners
- ✅ Event handler functions
- Example: `cart.viewed`, `product.view`
- FileTree: `events/cart_viewed.js`

**`plugin_hooks`** - Hook handlers
- ✅ Data transformation functions
- Example: `product.price`, `cart.total`
- FileTree: `hooks/product_price.js`

**`plugin_controllers`** - API endpoints
- ✅ HTTP request handlers
- Example: `trackVisit`, `getStats`
- FileTree: `controllers/trackVisit.js`

**`plugin_widgets`** - UI widgets
- ✅ Reusable UI components with metadata
- Example: Cart widget, banner widget

---

### Data & Schema

**`plugin_entities`** - Database entity schemas
- ✅ JSON schema definitions for database tables
- Example: `{ entity_name: "HamidCart", table_name: "hamid_cart", columns: [...] }`
- FileTree: `entities/HamidCart.json`
- NOT executable - used to generate migrations

**`plugin_migrations`** - Migration SQL
- ✅ Up/down SQL for schema changes
- Example: CREATE TABLE, ALTER TABLE
- FileTree: `migrations/20251029_create_hamid_cart.sql`
- NOT automatically executed - user runs manually

---

### Documentation

**`plugin_docs`** - Documentation and metadata
- ✅ README.md - Plugin documentation
- ✅ manifest.json - Plugin metadata
- ✅ CHANGELOG.md - Version history
- ✅ LICENSE - License info
- ✅ CONTRIBUTING.md - Contribution guide
- FileTree: `README.md`, `manifest.json`
- NOT executed - reference only

---

### Runtime Data

**`plugin_data`** - Key-value storage
- **Purpose:** Runtime data storage (like localStorage)
- **Example:** User preferences, cache, temp state
- **Usage:** `await pluginData.set('lastSync', Date.now())`
- **Not files** - just data

**`plugin_dependencies`** - npm packages
- **Purpose:** Track required npm packages
- **Example:** `["lodash", "axios", "moment"]`
- **Usage:** Install when plugin activates
- **Not files** - package names only

---

## 🗂️ FileTree Structure

```
📁 My Plugin
  📁 components/          → plugin_scripts
     Widget.jsx
     Banner.jsx
  📁 utils/               → plugin_scripts
     formatters.js
     validators.js
  📁 services/            → plugin_scripts
     api.js
  📁 styles/              → plugin_scripts
     custom.css
  📁 events/              → plugin_events
     cart_viewed.js
     product_view.js
  📁 hooks/               → plugin_hooks
     product_price.js
  📁 entities/            → plugin_entities
     HamidCart.json
     ProductReview.json
  📁 controllers/         → plugin_controllers
     trackVisit.js
     getStats.js
  📁 migrations/          → plugin_migrations
     20251029_create_hamid_cart.sql
     20251030_alter_hamid_cart_add_notes.sql
  📄 README.md            → plugin_docs
  📄 manifest.json        → plugin_docs
  📄 CHANGELOG.md         → plugin_docs
```

---

## ⚙️ API Behavior

### GET /api/plugins/registry/:id

Loads files from:
1. plugin_scripts
2. plugin_events
3. plugin_entities
4. plugin_controllers
5. plugin_migrations
6. plugin_docs

❌ NEVER from manifest.generatedFiles or source_code JSON

### PUT /api/plugins/registry/:id/files

Routes to correct table:
- `README.md` → plugin_docs
- `manifest.json` → plugin_docs
- `entities/*.json` → plugin_entities
- `controllers/*.js` → plugin_controllers (error - can't edit directly)
- `events/*.js` → plugin_events
- `hooks/*.js` → plugin_hooks
- `components/*.jsx` → plugin_scripts ✅
- `utils/*.js` → plugin_scripts ✅

### DELETE /api/plugins/registry/:id/files

Deletes from correct table:
- Docs → plugin_docs
- Events → plugin_events
- Entities → plugin_entities (+ plugin_scripts for legacy cleanup)
- Controllers → plugin_controllers (+ plugin_scripts for legacy cleanup)
- Scripts → plugin_scripts

---

## 🚀 Benefits of Clean Architecture

✅ **No Duplicates** - Each file in exactly one table
✅ **Clear Purpose** - Each table has one job
✅ **Fast Queries** - No joining/merging needed
✅ **Easy to Understand** - Obvious where files go
✅ **Type Safety** - Validation prevents mistakes
✅ **Scalable** - Add new types easily
✅ **Debuggable** - Know exactly where to look

---

## 🔧 Validation Enforced

PUT endpoint rejects files in wrong table:
```
PUT entities/HamidCart.json to plugin_scripts
→ 400 "Entities belong in plugin_entities table, not plugin_scripts"

PUT controllers/trackVisit.js to plugin_scripts
→ 400 "Controllers belong in plugin_controllers table, not plugin_scripts"

PUT README.md to plugin_scripts
→ Saved to plugin_docs instead ✅
```

---

## 📋 Migration Guide

### If You Have Old Plugins with JSON Data

Old plugins may have files in `manifest.generatedFiles` or `source_code` JSON fields.

**What happens:**
- These are completely IGNORED
- Files won't appear in FileTree
- Need to recreate in AI Studio

**How to migrate:**
1. Open plugin in AI Studio
2. Recreate files (they'll go to correct tables)
3. Old JSON data can be deleted eventually

### For Fresh Start

All new plugins automatically use clean architecture:
- Create file → Goes to correct table
- Load plugin → Loads from tables only
- Delete file → Removes from table only
- No legacy issues!

---

## ✨ Summary

**Before:** Mixed mess, duplicates, confusion
**After:** Clean, simple, one place per file type

**Tables by Purpose:**
- Executable: plugin_scripts (frontend), plugin_events, plugin_hooks, plugin_controllers
- Data: plugin_entities, plugin_migrations
- Docs: plugin_docs
- Runtime: plugin_data, plugin_dependencies
- UI: plugin_widgets

**Result:** Professional, maintainable, scalable plugin system! 🎉
