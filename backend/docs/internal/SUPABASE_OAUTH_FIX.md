# Supabase OAuth Error Fix

## Issue Identified
After successful Supabase authentication, users were experiencing errors due to **state parameter parsing failures** in the OAuth callback.

## Root Cause
The OAuth callback was trying to parse the state parameter directly without URL-decoding it first. When Supabase redirects back with the authorization code, the state parameter (which contains JSON data) arrives URL-encoded, causing `JSON.parse()` to fail.

## Changes Made

### 1. Fixed State Parameter Parsing (`backend/src/routes/supabase.js`)
**Before:**
```javascript
const stateData = JSON.parse(state);
storeId = stateData.storeId;
```

**After:**
```javascript
// Decode the state parameter first (it may be URL-encoded)
const decodedState = decodeURIComponent(state);
console.log('Decoded state:', decodedState);

const stateData = JSON.parse(decodedState);
storeId = stateData.storeId;

if (!storeId) {
  throw new Error('Store ID not found in state');
}
```

### 2. Enhanced Error Logging
Added detailed logging to help debug OAuth issues:
- Log decoded state before parsing
- Log parsed state data structure
- Log frontend URL configuration
- Enhanced error details with stack traces

## Required Render Environment Variables

Make sure these environment variables are set on Render.com:

```bash
# Supabase OAuth Configuration (Required)
SUPABASE_OAUTH_CLIENT_ID=your_client_id_here
SUPABASE_OAUTH_CLIENT_SECRET=your_client_secret_here
SUPABASE_OAUTH_REDIRECT_URI=https://backend.dainostore.com/api/supabase/callback

# Frontend URL (Required for OAuth callback)
FRONTEND_URL=https://www..dainostore.com

# Optional - Encryption key for storing tokens
SUPABASE_TOKEN_ENCRYPTION_KEY=your-secure-encryption-key-here
```

## How to Deploy the Fix

1. **Commit the changes:**
   ```bash
   git add backend/src/routes/supabase.js
   git commit -m "Fix Supabase OAuth callback state parsing error"
   git push
   ```

2. **Verify environment variables on Render:**
   - Go to https://dashboard.render.com
   - Select your backend service
   - Go to "Environment" tab
   - Ensure `FRONTEND_URL=https://www..dainostore.com` is set
   - Ensure all Supabase OAuth variables are configured

3. **Test the OAuth flow:**
   - Navigate to your admin panel
   - Go to Supabase Integration
   - Click "Connect Supabase Account"
   - Complete the authorization
   - Should redirect back successfully without errors

## Debugging OAuth Issues

If you still encounter errors, check the Render logs for:
```
Supabase OAuth callback received: { ... }
Decoded state: {"storeId":"...","state":"..."}
Parsed state data: { storeId: '...', state: '...' }
```

Common issues:
- ❌ `Invalid state parameter` → State parameter corrupted or malformed
- ❌ `Store ID not found in state` → State doesn't contain storeId
- ❌ `postMessage` not received → FRONTEND_URL mismatch

## Additional Notes

- The fix handles URL-encoded state parameters properly
- Better error messages help identify the exact failure point
- Frontend origin validation ensures secure postMessage communication
- All OAuth tokens are encrypted before storage in the database
