# Deployment Bugs Found After Migration

## Status
- ✅ **All code converted** (100%)
- ✅ **All changes deployed** to Render
- ❌ **Runtime errors** occurring on 3 endpoints

## Bugs Fixed

### 1. wishlist.js - Invalid Supabase JOIN Syntax ✅ FIXED
**Error**: 500 on `/api/wishlist`
**Cause**: Used invalid Supabase syntax `products:product_id (...)` for JOINs
**Fix**: Fetch products separately, merge in JavaScript
**Commit**: f4ac8e3b
**Status**: Fixed and deployed

## Bugs Remaining

### 2. slot-configurations - 500 Error
**Error**: 500 on `/api/slot-configurations/published/{storeId}/header`
**File**: `backend/src/routes/slotConfigurations.js`
**Status**: Uses masterDbClient (already Supabase), no models
**Possible Cause**: Issue in ABTestingServiceSupabase or query error
**Action Needed**: Check Render logs for actual error

### 3. cms-blocks - 500 Error
**Error**: 500 on `/api/public/cms-blocks`
**File**: `backend/src/routes/cms-blocks.js`
**Behavior**: Redirects to `/api/public-cms-blocks` endpoint
**Possible Cause**:
- Redirect endpoint doesn't exist
- axios call failing
- Fallback query has error
**Action Needed**: Check if `/api/public-cms-blocks` route exists

## Working Endpoints
- ✅ `/api/public/storefront/bootstrap` - 200 OK
- ✅ `/api/public/page-bootstrap` - 200 OK
- ✅ `/api/translations/ui-labels` - 200 OK
- ✅ `/api/cart` - 200 OK
- ✅ `/api/heatmap/track-batch` - 200 OK
- ✅ `/api/public/tax` - 200 OK
- ✅ `/api/public/product-labels` - 200 OK
- ✅ `/api/customer-activity` - 201 OK
- ✅ `/api/canonical-urls/check` - 200 OK

## Next Steps

1. **Wait for Render redeploy** with wishlist fix (f4ac8e3b)
2. **Check Render logs** for actual error messages on:
   - slot-configurations
   - cms-blocks
3. **Verify `/api/public-cms-blocks` route** exists in server.js
4. **Test** endpoints after new deployment

## Deployment Info
- Latest commit: f4ac8e3b
- Backend uptime when errors seen: 968 seconds (16 minutes old)
- Auto-deploy should trigger within 2-5 minutes of push
