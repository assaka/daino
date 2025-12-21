# Translation & SEO Normalization - Implementation Status

## 🎯 Project Goal

Refactor from JSON-based translations to normalized relational tables for:
- **Better search performance** - Full-text search with GIN indexes
- **Admin filtering** - Search products by translated name
- **Storefront performance** - Faster queries, smaller payloads
- **Zero frontend changes** - Backend constructs same JSON format

## ✅ Completed Work

### 1. Database Schema (✅ Complete)

**File:** `backend/src/migrations/20251024_create_normalized_translations_and_seo.js`

Created 15 normalized tables:
- **12 Translation Tables:**
  - product_translations
  - category_translations
  - cms_page_translations
  - attribute_translations
  - attribute_value_translations
  - cms_block_translations
  - product_tab_translations
  - product_label_translations
  - coupon_translations
  - shipping_method_translations
  - payment_method_translations
  - cookie_consent_settings_translations

- **3 SEO Tables:**
  - product_seo
  - category_seo
  - cms_page_seo

**Features:**
- Composite primary keys (entity_id, language_code)
- Foreign keys with CASCADE delete
- GIN full-text search indexes on searchable fields
- All timestamps (created_at, updated_at)

### 2. Data Migration (✅ Complete)

**File:** `backend/src/migrations/20251024_migrate_json_to_normalized_tables.js`

**What it does:**
- Reads all entities with translations/seo JSON columns
- Extracts data for each language
- Inserts into normalized tables
- **Preserves original JSON columns** (for rollback safety)
- Idempotent (can be re-run safely)

**Safety features:**
- `ON CONFLICT DO NOTHING` (won't duplicate data)
- Detailed logging per entity type
- Original JSON stays intact
- Easy rollback

### 3. Migration Runner (✅ Complete)

**File:** `backend/src/database/migrations/run-normalize-translations.js`

**Usage:**
```bash
node backend/src/database/migrations/run-normalize-translations.js
```

Runs both migrations in sequence with:
- Connection verification
- Progress logging
- Error handling
- Verification queries
- Rollback instructions

### 4. Translation Helpers (✅ Complete)

**Files:**
- `backend/src/utils/translationHelpers.js`
- `backend/src/utils/cookieConsentHelpers.js`

**Functions:**
- `getProductsWithTranslations(where)` - Get products with translations + SEO
- `getCategoriesWithTranslations(where)` - Get categories with translations + SEO
- `getCmsPagesWithTranslations(where)` - Get CMS pages with translations + SEO
- `getCookieConsentSettingsWithTranslations(where)` - Get cookie consent with translations
- `buildEntityComplete()` - Generic builder for any entity

**How it works:**
```javascript
// Backend uses helper
const products = await getProductsWithTranslations({ store_id: '123' });

// Returns same JSON format frontend expects:
[{
  id: '123',
  sku: 'PROD-001',
  translations: {
    en: { name: 'Product', description: '...' },
    nl: { name: 'Product', description: '...' }
  },
  seo: {
    en: { meta_title: '...', og_title: '...' },
    nl: { meta_title: '...', og_title: '...' }
  }
}]
```

### 5. Implementation Guide (✅ Complete)

**File:** `backend/NORMALIZED_TRANSLATIONS_GUIDE.md`

Comprehensive documentation with:
- Before/after comparison
- Route update examples
- Search implementation
- Full-text search queries
- Testing checklist
- Performance comparison
- Rollback plan

### 6. Model Files (✅ Partial)

Created example models:
- `backend/src/models/ProductTranslation.js`
- `backend/src/models/ProductSeo.js`
- `backend/src/models/CategoryTranslation.js`
- `backend/src/models/CookieConsentSettingsTranslation.js`
- `backend/src/models/associations.js`

### 7. Cookie Consent Implementation (✅ Complete - Oct 25, 2025)

**Files Modified:**
- `backend/src/utils/cookieConsentHelpers.js` - Updated to return full translations object
- `backend/src/models/CookieConsentSettingsTranslation.js` - Created model
- `backend/src/models/associations.js` - Added cookie consent associations
- `backend/src/migrations/20251024_migrate_json_to_normalized_tables.js` - Fixed field name bug

**What was done:**
1. Created `cookie_consent_settings_translations` table (already existed)
2. Migrated data from JSON column to normalized table
3. Updated helpers to use `json_object_agg()` pattern (same as products/categories)
4. Created Sequelize model and associations
5. Frontend requires zero changes (already using `translations[lang][field]` pattern)

**Data Migration:**
- Migrated 2 translation records (en, nl)
- Fixed field name bug: `settings_id` → `cookie_consent_settings_id`
- Data verified and working correctly

**Status:** ✅ Fully operational
- Backend returns `translations: { en: {...}, nl: {...} }` format
- Frontend reads translations correctly via `getTranslatedText()`
- Language switching works (en ↔ nl)
- StoreProvider caches cookie consent settings (1-hour TTL)

## 🔄 Pending Work

### 1. Update Backend Routes (⏳ Pending)

Need to update routes to use translation helpers:

**High Priority (Storefront):**
- [ ] `backend/src/routes/storefront-products.js`
- [ ] `backend/src/routes/storefront-categories.js`
- [ ] `backend/src/routes/storefront-cms.js`
- [ ] `backend/src/routes/checkout.js`

**Medium Priority (Admin):**
- [ ] `backend/src/routes/products.js`
- [ ] `backend/src/routes/categories.js`
- [ ] `backend/src/routes/cms.js`
- [ ] `backend/src/routes/attributes.js`

**Pattern:**
```javascript
// BEFORE
const products = await Product.findAll({ where: { store_id } });

// AFTER
const { getProductsWithTranslations } = require('../utils/translationHelpers');
const products = await getProductsWithTranslations({ store_id });
```

### 2. Update Translation Service (⏳ Pending)

Update `backend/src/services/translation-service.js`:
- Change `saveEntityTranslation()` to insert into normalized tables
- Update `getEntityTranslation()` to query normalized tables
- Keep same API contract (no frontend changes)

### 3. Run Migrations (⏳ Ready)

```bash
# Make sure you have a database backup first!
node backend/src/database/migrations/run-normalize-translations.js
```

**What happens:**
1. Creates 15 new tables
2. Copies all JSON data to normalized tables
3. Original JSON columns stay intact
4. Takes ~30 seconds (depends on data volume)

### 4. Testing (⏳ Pending)

**Storefront Tests:**
- [ ] Product pages load with correct translations
- [ ] Language switcher works
- [ ] Category pages display translated names
- [ ] CMS pages render correctly
- [ ] Checkout shows translated shipping/payment methods

**Admin Tests:**
- [ ] Product list loads
- [ ] Search by translated name works
- [ ] Editing translations updates DB
- [ ] Creating products creates translation rows

### 5. Cleanup (⏳ Future)

After everything works:
- Drop JSON columns from entity tables (separate migration)
- Remove old JSON-based code paths
- Update documentation

## 🚀 Next Steps

### Option A: Run Migrations First (Recommended)
1. **Backup database**
2. Run: `node backend/src/database/migrations/run-normalize-translations.js`
3. Verify data: `SELECT COUNT(*) FROM product_translations;`
4. Update one route as proof-of-concept
5. Test that route thoroughly
6. Update remaining routes

### Option B: Test One Route First
1. Create normalized tables manually (psql)
2. Insert sample data
3. Update one route (e.g., storefront products)
4. Test thoroughly
5. Run full migration if successful
6. Update remaining routes

## 📊 Architecture Benefits

### Before (JSON Columns)
```javascript
// Backend
const product = await Product.findOne({ where: { id } });
// Returns: { id, translations: {...}, seo: {...} }

// Problems:
❌ Can't search by translated name
❌ No full-text search
❌ JSON parsing overhead
❌ No indexes on translations
```

### After (Normalized Tables)
```javascript
// Backend
const products = await getProductsWithTranslations({ id });
// Returns: SAME FORMAT { id, translations: {...}, seo: {...} }

// Benefits:
✅ Full-text search with GIN indexes
✅ Search by translated name (admin)
✅ Faster queries (indexed columns)
✅ Can send only current language (future optimization)
✅ Frontend requires ZERO changes
```

## 🔄 How It Works

### Data Flow
```
┌─────────────────────────────────────────────────────────┐
│ Frontend (translationUtils.js)                          │
│ - getProductName(product, 'nl')                         │
│ - Expects: product.translations.nl.name                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP Request
                     │
┌────────────────────▼────────────────────────────────────┐
│ Backend Route                                            │
│ const products = await getProductsWithTranslations(...)  │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ SQL Query
                     │
┌────────────────────▼────────────────────────────────────┐
│ PostgreSQL                                               │
│ SELECT p.*, json_object_agg(                            │
│   t.language_code,                                       │
│   json_build_object('name', t.name, ...)                │
│ ) as translations                                        │
│ FROM products p                                          │
│ LEFT JOIN product_translations t ON p.id = t.product_id │
│ GROUP BY p.id                                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Result: Same JSON format
                     │
┌────────────────────▼────────────────────────────────────┐
│ Response                                                 │
│ {                                                        │
│   id: '123',                                             │
│   translations: {                                        │
│     en: { name: 'Product' },                             │
│     nl: { name: 'Product' }                              │
│   }                                                      │
│ }                                                        │
└──────────────────────────────────────────────────────────┘
```

### Frontend Impact
**ZERO CHANGES REQUIRED**

All these continue working:
```javascript
// translationUtils.js
getProductName(product, 'nl') // Works exactly the same
getTranslatedField(entity, 'name', 'en') // Works exactly the same

// ProductTabs.jsx
tab.translations[currentLang].name // Works exactly the same

// ProductLabel.jsx
label.translations[currentLang].text // Works exactly the same

// stockLabelUtils.js
stockSettings.translations[lang].in_stock_label // Works exactly the same
```

## 📝 Files Created

1. `backend/src/migrations/20251024_create_normalized_translations_and_seo.js` (723 lines)
2. `backend/src/migrations/20251024_migrate_json_to_normalized_tables.js` (438 lines)
3. `backend/src/database/migrations/run-normalize-translations.js` (95 lines)
4. `backend/src/utils/translationHelpers.js` (264 lines)
5. `backend/NORMALIZED_TRANSLATIONS_GUIDE.md` (520 lines)
6. `backend/src/models/ProductTranslation.js` (44 lines)
7. `backend/src/models/ProductSeo.js` (75 lines)
8. `backend/src/models/CategoryTranslation.js` (22 lines)
9. `backend/src/models/associations.js` (69 lines)
10. `NORMALIZATION_STATUS.md` (this file)

**Total:** ~2,250 lines of implementation + documentation

## 🎯 Success Criteria

- [ ] All storefront pages load with correct translations
- [ ] Admin can search products by translated name
- [ ] Page load times same or faster
- [ ] All translation editing works in admin
- [ ] Language switcher functions correctly
- [ ] Zero frontend code changes required
- [ ] Easy rollback available

## ⚠️ Important Notes

1. **Backup First**: Always backup database before running migrations
2. **Original JSON Preserved**: JSON columns stay intact for rollback
3. **Idempotent**: Migrations can be re-run safely
4. **Zero Frontend Changes**: Backend constructs same JSON format
5. **Easy Rollback**: Just revert route changes, JSON still has data

## 📞 Support

If issues arise:
1. Check `backend/NORMALIZED_TRANSLATIONS_GUIDE.md`
2. Review migration logs
3. Verify data: `SELECT * FROM product_translations LIMIT 5;`
4. Rollback if needed (instructions in guide)
