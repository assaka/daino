# Supabase OAuth Integration Setup Guide

## 1. Create Supabase OAuth Application

1. Go to https://supabase.com/dashboard/account/apps
2. Click "New OAuth Application"
3. Fill in the following details:
   - **Application name**: DainoStore E-commerce Platform
   - **Homepage URL**: https://www..dainostore.com
   - **Redirect URL**: https://backend.dainostore.com/api/supabase/callback
   - **Description**: E-commerce platform integration for database and storage management

4. After creation, you'll receive:
   - Client ID
   - Client Secret

## 2. Add Environment Variables to Render.com

Go to your Render.com dashboard and add these environment variables:

```env
# Supabase OAuth Configuration
SUPABASE_OAUTH_CLIENT_ID=your_client_id_here
SUPABASE_OAUTH_CLIENT_SECRET=your_client_secret_here
SUPABASE_OAUTH_REDIRECT_URI=https://backend.dainostore.com/api/supabase/callback

# Frontend URL for redirect after OAuth
FRONTEND_URL=https://www..dainostore.com

# Encryption key for storing tokens (generate a secure random string)
SUPABASE_TOKEN_ENCRYPTION_KEY=your-secure-encryption-key-here
```

## 3. Generate Encryption Key

Run this command to generate a secure encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. OAuth Flow

1. User clicks "Connect Supabase Account" in the dashboard
2. Opens popup window with Supabase OAuth authorization
3. User approves access to their Supabase account
4. Supabase redirects to callback URL with authorization code
5. Backend exchanges code for access token
6. Token is encrypted and stored in database
7. User is redirected back to dashboard with success message

## 5. Permissions Required

The OAuth app will request the following permissions:
- Read access to project metadata
- Storage bucket management
- Database connection details
- File upload/download capabilities

## 6. Security Notes

- All OAuth tokens are encrypted using AES-256-CBC encryption
- Tokens are automatically refreshed when expired
- Store-specific isolation ensures each store only accesses its own Supabase project
- SSL/TLS encryption for all API communications

## 7. Testing the Integration

After setup:
1. Navigate to Dashboard > Plugins > Integrations
2. Click on Supabase Integration
3. Click "Connect Supabase Account"
4. Complete the OAuth flow
5. Test the connection using the "Test Connection" button

## Troubleshooting

If you encounter "Error checking store ownership":
- Ensure you're logged in as a store owner
- Check that the store ID is being passed correctly
- Verify JWT token is valid and not expired

For OAuth errors:
- Verify redirect URI matches exactly in both Supabase and Render
- Check that environment variables are set correctly
- Ensure CORS is configured for your frontend domain