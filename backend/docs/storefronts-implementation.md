# Storefronts Feature Implementation

## Overview
Multiple storefronts per store with one marked as `is_primary`. Supports theme/layout variants, preview via query parameter, and scheduling for campaigns.

## Use Cases
- B2B vs B2C themes (same products, different layouts)
- Seasonal campaigns (Black Friday, Holiday themes)
- A/B testing new designs before going live
- Preview upcoming changes without affecting live store

---

## Completed

### Database
- [x] Migration script created: `backend/src/database/migrations/create-storefronts-table.sql`
- [ ] **Run migration on tenant database** (see SQL below)

### Backend
- [x] CRUD routes: `backend/src/routes/storefronts.js`
  - GET `/api/storefronts` - List all storefronts
  - POST `/api/storefronts` - Create storefront
  - PUT `/api/storefronts/:id` - Update storefront
  - DELETE `/api/storefronts/:id` - Delete storefront
  - POST `/api/storefronts/:id/set-primary` - Set as primary
  - POST `/api/storefronts/:id/duplicate` - Duplicate storefront
- [x] Bootstrap endpoint updated: `backend/src/routes/storefront-bootstrap.js`
  - Supports `?storefront=slug` query parameter for preview
  - Priority: preview param → scheduled (active window) → primary
  - Merges `storefront.settings_override` with `store.settings`
- [x] Routes registered in `backend/src/server.js`

### Frontend
- [x] Hook updated: `src/hooks/useStoreBootstrap.js`
  - Reads storefront from URL query params
  - Passes to bootstrap API
- [x] Store context updated: `src/components/storefront/StoreProvider.jsx`
  - Added `storefront` and `isPreviewMode` to context
- [x] Preview banner: `src/components/storefront/StorefrontPreviewBanner.jsx`
  - Shows amber banner when previewing non-primary storefront
  - Exit preview button removes query param
- [x] Layout updated: `src/components/storefront/StorefrontLayout.jsx`
  - Includes StorefrontPreviewBanner component
- [x] Admin page: `src/pages/admin/Storefronts.jsx`
  - Card-based layout matching SalesSettings.jsx
  - Auto-creates default primary storefront (temporary for migration)
  - List/Create/Edit/Duplicate/Delete functionality
  - Scheduling with publish_start_at and publish_end_at
- [x] Route added: `src/App.jsx` - `/admin/storefronts`
- [x] Export added: `src/pages/index.jsx`

---

## TODO

### High Priority
- [ ] Run database migration on tenant DB
- [ ] Add Storefronts to admin navigation menu
- [ ] Test storefront preview with `?storefront=slug`
- [ ] Test scheduled storefront activation

### Medium Priority
- [ ] Storefront-specific slot configurations (use `storefront_id` FK)
- [ ] Theme/layout picker in storefront settings
- [ ] Preview button in admin that opens storefront URL with query param

### Low Priority / Future
- [ ] Remove auto-creation of default storefront (after all stores migrated)
- [ ] Storefront analytics (track which storefront was active)
- [ ] Storefront duplication improvements (copy slot configurations)
- [ ] Bulk scheduling for campaigns

---

## Database Migration

Run this SQL on your **tenant database**:

```sql
-- Create storefronts table
CREATE TABLE IF NOT EXISTS storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  is_primary BOOLEAN DEFAULT false NOT NULL,
  settings_override JSONB DEFAULT '{}'::jsonb NOT NULL,
  publish_start_at TIMESTAMP WITH TIME ZONE,
  publish_end_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_slug_per_store UNIQUE (store_id, slug)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_storefronts_store_id ON storefronts(store_id);
CREATE INDEX IF NOT EXISTS idx_storefronts_is_primary ON storefronts(store_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_storefronts_slug ON storefronts(store_id, slug);
CREATE INDEX IF NOT EXISTS idx_storefronts_scheduling ON storefronts(publish_start_at, publish_end_at);

-- Add storefront_id to slot_configurations (optional)
ALTER TABLE slot_configurations
ADD COLUMN IF NOT EXISTS storefront_id UUID REFERENCES storefronts(id) ON DELETE SET NULL;
```

---

## How It Works

### Storefront Selection Priority
1. **Preview mode**: `?storefront=slug` query parameter (highest priority)
2. **Scheduled**: Storefront with active `publish_start_at` / `publish_end_at` window
3. **Primary**: Storefront marked as `is_primary` (default fallback)

### Settings Override
Storefront settings are merged on top of store settings:
```javascript
const mergedSettings = {
  ...store.settings,
  ...storefront.settings_override
};
```

### Preview URL Format
```
https://your-store.com/?storefront=black-friday
https://your-store.com/products?storefront=b2b-theme
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `backend/src/routes/storefronts.js` | CRUD API routes |
| `backend/src/routes/storefront-bootstrap.js` | Bootstrap with storefront selection |
| `src/pages/admin/Storefronts.jsx` | Admin management UI |
| `src/components/storefront/StoreProvider.jsx` | React context with storefront |
| `src/components/storefront/StorefrontPreviewBanner.jsx` | Preview mode banner |
| `src/hooks/useStoreBootstrap.js` | Bootstrap hook with query param |
