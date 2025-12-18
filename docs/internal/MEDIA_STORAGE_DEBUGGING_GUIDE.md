# Media Storage Debugging Guide

## Problem Identified

Media storage (store → media storage) is not working due to missing Supabase OAuth configuration.

## Root Causes Found

### 1. Missing OAuth Configuration
The following environment variables were not configured in `backend/.env`:
- `SUPABASE_OAUTH_CLIENT_ID` - Required for OAuth authentication
- `SUPABASE_OAUTH_CLIENT_SECRET` - Required for OAuth authentication
- `SUPABASE_OAUTH_REDIRECT_URI` - Callback URL for OAuth flow
- `BACKEND_URL` - Base URL for the backend API

### 2. Missing Master Database URL
- `MASTER_DB_URL` was not set, preventing:
  - Store configuration lookups
  - Integration config retrieval
  - OAuth token management

### 3. Placeholder API Keys
The following had placeholder values that need to be replaced:
- `SUPABASE_ANON_KEY=your-anon-key-here`
- `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here`

## Solutions Applied

### ✅ Step 1: Added Master Database URL
Added to `backend/.env`:
```env
MASTER_DB_URL=postgresql://postgres.jqqfjfoigtwdpnlicjmh:Lgr5ovbpji64CooD@aws-0-eu-north-1.pooler.supabase.com:6543/postgres
```

### ✅ Step 2: Added Supabase OAuth Configuration
Added to `backend/.env`:
```env
# Supabase OAuth Configuration for Media Storage
# Register your app at: https://supabase.com/dashboard/org/_/apps
SUPABASE_OAUTH_CLIENT_ID=your-supabase-oauth-client-id
SUPABASE_OAUTH_CLIENT_SECRET=your-supabase-oauth-client-secret
SUPABASE_OAUTH_REDIRECT_URI=http://localhost:5000/api/supabase/callback
BACKEND_URL=http://localhost:5000
```

## Next Steps to Complete Setup

### 1. Register OAuth Application with Supabase

1. **Go to Supabase OAuth Apps**: https://supabase.com/dashboard/org/_/apps
2. **Click "New OAuth Application"**
3. **Fill in details**:
   - **Application name**: `DainoStore Media Storage`
   - **Homepage URL**: `http://localhost:5179` (local) or your production URL
   - **Redirect URL**: `http://localhost:5000/api/supabase/callback` (local) or your production callback
   - **Scopes**: Select the following:
     - `email`
     - `profile`
     - `projects:read`
     - `projects:write`
     - `secrets:read` (IMPORTANT for service role key access)
     - `storage:read`
     - `storage:write`
     - `database:read`
     - `database:write`

4. **Copy the credentials** you receive:
   - Client ID
   - Client Secret

### 2. Update Environment Variables

Replace the placeholder values in `backend/.env`:

```env
SUPABASE_OAUTH_CLIENT_ID=<paste-your-client-id>
SUPABASE_OAUTH_CLIENT_SECRET=<paste-your-client-secret>
```

### 3. Get Your Supabase Project Keys

Go to your Supabase project dashboard → Settings → API:

```env
SUPABASE_ANON_KEY=<your-actual-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-actual-service-role-key>
```

### 4. Restart Your Backend Server

```bash
cd backend
npm run dev
```

### 5. Test Media Storage Connection

1. **In your application**:
   - Navigate to the Integrations section
   - Click on "Supabase Integration"
   - Click "Connect Supabase Account"
   - Complete the OAuth flow

2. **Test Upload**:
   - Go to your media library or product upload
   - Try uploading an image
   - Verify it appears in your Supabase storage bucket

## How Media Storage Works

### Architecture Flow:

1. **Store Selection** → User selects which store to work with
2. **Storage Manager** (`backend/src/services/storage-manager.js`):
   - Checks store configuration for default media storage provider
   - Looks up Supabase OAuth connection status
   - Retrieves service role key from encrypted storage
3. **Supabase Integration** (`backend/src/services/supabase-integration.js`):
   - Validates OAuth tokens (refreshes if expired)
   - Creates Supabase client with service role key
4. **Supabase Storage Provider** (`backend/src/services/supabase-storage-provider.js`):
   - Handles actual file uploads to Supabase Storage
   - Manages bucket creation and file organization
5. **Media Assets Tracking** (`media_assets` table in tenant DB):
   - Records all uploads for file library display
   - Tracks file metadata and URLs

### Storage Bucket Structure:

All files are stored in the `suprshop-assets` bucket with this organization:
```
suprshop-assets/
├── library/           # General file library uploads
│   └── a/            # Organized by first letter
│       └── abc123.jpg
├── category/
│   └── images/       # Category images
├── product/
│   ├── images/       # Product images
│   └── files/        # Product files (PDFs, etc.)
└── test-products/    # Test uploads
```

## Debugging Commands

### Check OAuth Configuration:
```bash
cd backend
node -e "console.log('OAuth Client ID:', process.env.SUPABASE_OAUTH_CLIENT_ID || 'NOT SET'); console.log('OAuth Secret:', process.env.SUPABASE_OAUTH_CLIENT_SECRET ? 'SET' : 'NOT SET');"
```

### Check Database Connection:
```bash
cd backend
node -e "const { masterDbClient } = require('./src/database/masterConnection'); (async () => { try { const { data, error } = await masterDbClient.from('stores').select('id, name').limit(1); console.log('Master DB:', error ? 'ERROR: ' + error.message : 'Connected'); } catch(e) { console.log('Master DB Error:', e.message); } })();"
```

### Check Supabase Connection for a Store:
```bash
cd backend
node -e "const si = require('./src/services/supabase-integration'); (async () => { const status = await si.getConnectionStatus('YOUR-STORE-ID'); console.log('Connection Status:', JSON.stringify(status, null, 2)); })();"
```

## Common Errors and Fixes

### Error: "No storage provider is configured"
**Cause**: Supabase OAuth not connected or service role key missing
**Fix**: Complete OAuth setup above, ensure `secrets:read` scope is granted

### Error: "Invalid service role key"
**Cause**: Service role key is malformed or incorrect
**Fix**:
1. Check your Supabase dashboard → Settings → API
2. Copy the correct service role key
3. Update in OAuth integration settings or `.env`

### Error: "MASTER_DB_URL not set"
**Cause**: Master database connection string missing
**Fix**: Already added to `.env`, restart backend

### Error: "OAuth token lacks secrets:read scope"
**Cause**: OAuth app registration doesn't have proper scopes
**Fix**:
1. Go to https://supabase.com/dashboard/org/_/apps
2. Edit your OAuth app
3. Add `secrets:read` to scopes
4. Reconnect in your application

### Error: "Authorization was revoked"
**Cause**: User revoked app access in Supabase account
**Fix**: Reconnect via OAuth flow in your application

## Production Deployment

For production (Render.com, Vercel, etc.), update these URLs:

```env
# Production URLs
BACKEND_URL=https://backend.dainostore.com
SUPABASE_OAUTH_REDIRECT_URI=https://backend.dainostore.com/api/supabase/callback
FRONTEND_URL=https://www..dainostore.com
```

And update your Supabase OAuth app registration to match the production callback URL.

## File Locations Reference

- **Storage Manager**: `backend/src/services/storage-manager.js`
- **Supabase Integration**: `backend/src/services/supabase-integration.js`
- **Supabase Storage Service**: `backend/src/services/supabase-storage.js`
- **Supabase Storage Provider**: `backend/src/services/supabase-storage-provider.js`
- **Media Storage Routes**: `backend/src/routes/store-mediastorage.js`
- **OAuth Token Model**: `backend/src/models/SupabaseOAuthToken.js`
- **Environment Config**: `backend/.env`

## Summary

The media storage system requires:
1. ✅ **Master DB URL** - Added
2. ✅ **OAuth Configuration placeholders** - Added
3. ⏳ **OAuth App Registration** - You need to do this
4. ⏳ **Update credentials** - You need to do this
5. ⏳ **Test connection** - You need to do this

Once you complete steps 3-5, media storage will work via OAuth connection to your Supabase project!
