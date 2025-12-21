# Bug Fixes After Migration Deployment

## Bugs Found and Fixed

After deploying the 100% Sequelize to Supabase migration, we discovered parameter mismatch bugs in several files where helper function calls were missing required parameters.

### Root Cause
When converting from Sequelize models to Supabase, helper functions were updated to require `storeId` and `tenantDb` parameters, but some route files weren't updated to pass these parameters.

---

## Fixes Applied

### 1. wishlist.js ✅
**Issue**: Invalid Supabase JOIN syntax + missing tenantDb parameter
**Error**: 500 on `/api/wishlist`
**Fix**:
- Removed invalid `products:product_id (...)` JOIN syntax
- Fetch products separately and merge in JavaScript
- Added `tenantDb` parameter to `applyProductTranslationsToMany(products, lang, tenantDb)`
**Commit**: f4ac8e3b

### 2. public-cms-blocks.js ✅
**Issue**: Missing storeId parameter
**Error**: 500 on `/api/public/cms-blocks`
**Fix**:
- Changed `getCMSBlocksWithTranslations(where, lang)`
- To: `getCMSBlocksWithTranslations(store_id, where, lang)`
**Commit**: a23f9a1c

### 3. categories.js ✅
**Issue**: Missing storeId parameter in translate route
**Error**: Likely causing 500 on category translation
**Fix**:
- Changed `getCategoryById(req.params.id, fromLang)`
- To: `getCategoryById(store_id, req.params.id, fromLang)`
- Added store_id validation from req.body
**Commit**: 2758a89b

### 4. publicProducts.js ✅
**Issue**: Missing tenantDb parameter
**Error**: Potential 500 on product listing with translations
**Fix**:
- Changed `applyProductTranslationsToMany(rows, lang)`
- To: `applyProductTranslationsToMany(rows, lang, tenantDb)`
**Commit**: 2758a89b

---

## Helper Function Signatures (Correct)

```javascript
// CMS Helpers
getCMSPagesWithTranslations(storeId, where = {}, lang = 'en')
getCMSBlocksWithTranslations(storeId, where = {}, lang = 'en')
getCMSPageById(storeId, id, lang = 'en')
getCMSBlockById(storeId, id, lang = 'en')

// Category Helpers
getCategoriesWithTranslations(storeId, where = {}, lang = 'en', options = {})
getCategoryById(storeId, id, lang = 'en')

// Product Helpers
applyProductTranslationsToMany(products, lang = 'en', tenantDb = null)
applyProductTranslations(storeId, product, lang = 'en')

// Cookie Consent Helpers
getCookieConsentSettingsWithTranslations(storeId, where = {}, lang = 'en')

// Shipping Method Helpers
getShippingMethodsWithTranslations(storeId, where = {}, options = {})
```

---

## Verification Checklist

After these fixes deploy, verify:
- ✅ `/api/wishlist` - Should return 200
- ✅ `/api/public/cms-blocks` - Should return 200
- ✅ `/api/public/categories/by-slug/fietsen/full` - Should return category data (if is_active=true)
- ✅ `/api/categories/:id/translate` - Should work for translations
- ✅ Product listing pages - Should show translated products

---

## Remaining Issues

### Category 404 - /public/welhof/category/fietsen
**Status**: Route code is correct
**Possible Causes**:
1. Category "fietsen" has `is_active = false` in database
2. Category slug is different (case sensitivity?)
3. Category doesn't belong to store 947fa171-625f-4374-9c30-574d8c6e5abf

**SQL to check**:
```sql
SELECT id, slug, is_active, store_id
FROM categories
WHERE store_id = '947fa171-625f-4374-9c30-574d8c6e5abf'
  AND slug = 'fietsen';
```

**Action**: Verify category data in tenant database

### Slot Configurations 500
**Status**: Investigating
**File**: slotConfigurations.js (uses masterDbClient, not affected by migration)
**Needs**: Check Render logs for actual error

---

## Deployment Timeline

- **f4ac8e3b** - Fixed wishlist (2 minutes ago)
- **a23f9a1c** - Fixed cms-blocks (1 minute ago)
- **2758a89b** - Fixed categories + publicProducts (just now)

**Next**: Wait 2-5 minutes for Render auto-deployment

---

## Success Metrics

**Before Fixes**: 3+ endpoints with 500 errors
**After Fixes**: Should be 0-1 errors remaining (only slot-configurations)
**Total Bugs Fixed**: 4 parameter mismatch bugs
