# Remaining Sequelize Model Conversions

## Status: 11 Admin Route Files Still Use Sequelize Models

These files use **tenant DB** via `ConnectionManager.getStoreConnection()` but access `connection.models` which returns Sequelize models instead of Supabase client.

### Files to Convert (by complexity):

#### Simple (4-5 uses each) - Priority 1:
1. **images.js** - 4 model uses
2. **payments.js** - 4 model uses
3. **cookie-consent-settings.js** - 4 model uses
4. **product-images.js** - 5 model uses
5. **store-teams.js** - 5 model uses (also uses masterDbClient for invitations)
6. **translations.js** - 5 model uses
7. **store-mediastorage.js** - 3 model uses

#### Medium (6-8 uses each) - Priority 2:
8. **category-images.js** - 6 model uses (Category model)
9. **slot-configurations.js** - 7 model uses (**Note: May be unused - server uses slotConfigurations.js**)
10. **domains.js** - 8 model uses (Store model)

#### Complex (12+ uses) - Priority 3:
11. **heatmap.js** - 12 model uses
    - Uses `HeatmapInteraction.getHeatmapData()` - static model method
    - Uses `HeatmapSession.getSessionAnalytics()` - static model method
    - Uses `HeatmapInteraction.getHeatmapSummary()` - static model method
    - Uses aggregation functions (`sequelize.fn()`)
    - **Requires moving model logic into service layer**

### Conversion Pattern:

```javascript
// OLD (Sequelize Model)
const connection = await ConnectionManager.getStoreConnection(storeId);
const { Category } = connection.models;
const category = await Category.findOne({ where: { id, store_id: storeId } });
await category.update({ name: 'New Name' });

// NEW (Supabase Client)
const tenantDb = await ConnectionManager.getStoreConnection(storeId);
const { data: category } = await tenantDb
  .from('categories')
  .select('*')
  .eq('id', id)
  .eq('store_id', storeId)
  .single();

await tenantDb
  .from('categories')
  .update({ name: 'New Name' })
  .eq('id', id);
```

### For Complex Static Methods (like heatmap.js):

Static methods on models need to be:
1. Extracted into service files (e.g., `HeatmapService.js`)
2. Rewritten to use Supabase queries
3. Route updated to call service instead of model

Example:
```javascript
// OLD
const heatmapData = await HeatmapInteraction.getHeatmapData(storeId, pageUrl, options);

// NEW
const HeatmapService = require('../services/HeatmapService');
const heatmapData = await HeatmapService.getHeatmapData(tenantDb, storeId, pageUrl, options);
```

## Impact Assessment

### Current Status:
- ✅ **All public storefront routes working** (page-bootstrap, cms-blocks, wishlist, etc.)
- ✅ **All helper utilities converted** (6/6 files)
- ✅ **All critical 500 errors resolved**
- ⚠️ **11 admin routes** still use Sequelize models

### Risk Level: LOW
- These are admin/management routes
- Not causing current user-facing errors
- Can be converted incrementally
- Backend is stable and working

### Recommendation:
Convert these files as you use/modify them, or in batches:
1. Start with simple files (images, payments, cookie-consent)
2. Move to medium complexity (category-images, domains)
3. Handle complex ones last (heatmap - requires service layer refactoring)

## Testing Strategy

After converting each file:
1. Test the specific route endpoints
2. Check for any model-specific methods that need service extraction
3. Verify admin UI functionality
4. Commit incrementally

Total effort estimate: 4-6 hours for all 11 files
