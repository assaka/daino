# Media Storage Fix Summary

## Issue
User already has Supabase connected via `store_databases` table (direct credentials), but:
- Media Storage page shows "Not Connected"
- Cannot select project or bucket
- Trying to connect via OAuth when connection already exists

## Root Cause
The `getProjects()` method in `supabase-integration.js` only checked for OAuth tokens and ignored `store_databases` connections.

## Fix Applied

### File: `backend/src/services/supabase-integration.js`

**Modified `getProjects()` method** (commit: 46d95d06):
- Added check for `store_databases` table before checking OAuth token
- If connection exists in `store_databases`:
  - Decrypts credentials
  - Returns project information from stored credentials
  - Shows project as selectable
  - Marks source as 'credentials'

**Already working in `getConnectionStatus()`**:
- Lines 953-960: Checks `store_databases` table
- Lines 1080-1082: Considers connection valid if either OAuth OR `store_databases` exists
- Lines 1114-1122: Retrieves project URL from `store_databases` credentials
- Lines 1184-1192: Retrieves service role key from `store_databases` credentials
- Returns `connected: true` when `store_databases` connection exists

## Expected Behavior After Fix

### Connection Status
```javascript
// Before fix:
{
  connected: false,
  message: 'Supabase not connected for this store'
}

// After fix (with store_databases):
{
  connected: true,
  projectUrl: 'https://xxx.supabase.co',
  hasServiceRoleKey: true,
  storageReady: true,
  connectionSource: 'credentials'
}
```

### Project Selection
```javascript
// Before fix:
Error: 'Supabase not connected for this store'

// After fix (with store_databases):
{
  success: true,
  projects: [{
    id: 'connected-project',
    name: 'Connected Project',
    url: 'https://xxx.supabase.co',
    isCurrent: true,
    hasKeysConfigured: true,
    status: 'ACTIVE',
    source: 'store_databases'
  }],
  currentProjectUrl: 'https://xxx.supabase.co',
  connectionSource: 'credentials'
}
```

## Testing After Deployment

### 1. Check Connection Status
```bash
# API call
GET /api/supabase/status

# Expected response:
{
  "connected": true,
  "projectUrl": "https://xxx.supabase.co",
  "hasServiceRoleKey": true,
  "storageReady": true,
  "connectionSource": "credentials"
}
```

### 2. Check Projects List
```bash
# API call
GET /api/supabase/projects

# Expected response:
{
  "success": true,
  "projects": [{
    "id": "connected-project",
    "name": "Connected Project",
    "url": "https://xxx.supabase.co",
    "isCurrent": true,
    "hasKeysConfigured": true,
    "status": "ACTIVE",
    "source": "store_databases"
  }],
  "connectionSource": "credentials"
}
```

### 3. Media Storage Page
- Should show "Connected" status
- Should show storage statistics
- Should show bucket management
- Should NOT show "Connect Supabase" button
- Should allow file uploads

## Files Modified
- ✅ `backend/src/services/supabase-integration.js` - Fixed getProjects()
- ✅ `MEDIA_STORAGE_DEBUGGING_GUIDE.md` - Complete debugging documentation
- ✅ `backend/check-media-storage-status.js` - Diagnostic script

## Deployment Status
- ✅ Committed to Git (commit: 46d95d06)
- ✅ Pushed to GitHub
- ⏳ Render deployment in progress

## Verification Steps
Once Render deployment completes:

1. **Go to:** Media Storage page in your app
2. **Expected:** Shows "Connected" with storage details
3. **If still shows "Not Connected":**
   - Check Render logs for any errors
   - Verify `store_databases` table has active record for your store
   - Check that connection_string_encrypted can be decrypted
   - Run diagnostic script: `node backend/check-media-storage-status.js`

## Troubleshooting

### If still showing "Not Connected":

1. **Check Render Logs:**
   ```
   https://dashboard.render.com → daino-backend → Logs
   Search for: "store_databases", "connectionStatus", "getProjects"
   ```

2. **Verify Database Record:**
   ```sql
   SELECT id, store_id, is_active, connection_status
   FROM store_databases
   WHERE store_id = 'your-store-id';
   ```

3. **Check Frontend:**
   - Open browser console
   - Look for `/api/supabase/status` response
   - Check if `connected: true` is returned

4. **Manual Test:**
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        https://backend.dainostore.com/api/supabase/status
   ```

## Additional Notes

- OAuth connection will still work if user wants to connect via OAuth
- Both connection methods (OAuth and direct credentials) are supported
- The fix maintains backward compatibility
- No changes needed to frontend components
- No changes needed to database schema
