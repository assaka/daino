# Database OAuth Configuration Guide

Complete guide to setting up OAuth integrations for Neon and PlanetScale database providers on Render.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step 1: Register Neon OAuth Application](#step-1-register-neon-oauth-application)
- [Step 2: Register PlanetScale OAuth Application](#step-2-register-planetscale-oauth-application)
- [Step 3: Configure Render Environment Variables](#step-3-configure-render-environment-variables)
- [Step 4: Deploy and Test](#step-4-deploy-and-test)
- [Troubleshooting](#troubleshooting)

---

## Overview

This guide will help you configure OAuth authentication for:
- **Neon** - Serverless PostgreSQL provider
- **PlanetScale** - Serverless MySQL provider

Once configured, store owners can connect their own Neon or PlanetScale databases via one-click OAuth, providing:
- Automatic database provisioning
- Secure credential management
- Free tier options for store owners
- Seamless integration with your platform

**Time Required:** ~15 minutes

---

## Prerequisites

Before starting, ensure you have:

- ✅ Access to your production domain (e.g., `https://www..dainostore.com`)
- ✅ Access to your Render dashboard (backend service)
- ✅ Neon account (free at https://neon.tech)
- ✅ PlanetScale account (free at https://planetscale.com)
- ✅ Admin access to configure OAuth applications

---

## Step 1: Register Neon OAuth Application

### 1.1 Navigate to Neon OAuth Settings

1. Go to: **https://console.neon.tech**
2. Sign in to your account
3. Click on **Settings** in the left sidebar
4. Click on **OAuth** tab
5. Click **"Create OAuth Application"** button

### 1.2 Configure OAuth Application

Fill in the following details:

| Field | Value |
|-------|-------|
| **Application Name** | `DainoStore Platform` (or your platform name) |
| **Redirect URI** | `https://www..dainostore.com/oauth/neon/callback` |
| **Description** | `Database integration for DainoStore e-commerce platform` |
| **Application Logo** | (Optional) Upload your logo |

**⚠️ IMPORTANT:** The redirect URI must match EXACTLY (no trailing slash)

### 1.3 Save Credentials

After clicking "Create", you'll see:

```
Client ID: neon_oauth_abc123def456
Client Secret: neon_secret_xyz789abc123def456ghi789
```

**⚠️ CRITICAL:** Copy the **Client Secret** immediately - it will only be shown once!

**Save these values** - you'll need them for Render configuration.

---

## Step 2: Register PlanetScale OAuth Application

### 2.1 Navigate to PlanetScale OAuth Settings

1. Go to: **https://app.planetscale.com**
2. Sign in to your account
3. Click on your **profile icon** (top right)
4. Select **Settings**
5. Click **OAuth applications** in the left menu
6. Click **"New OAuth application"** button

### 2.2 Configure OAuth Application

Fill in the following details:

| Field | Value |
|-------|-------|
| **Application Name** | `DainoStore Platform` |
| **Homepage URL** | `https://www..dainostore.com` |
| **Authorization Callback URL** | `https://www..dainostore.com/oauth/planetscale/callback` |
| **Description** | `Database integration for DainoStore stores` |
| **Application Logo** | (Optional) Upload your logo |

**⚠️ IMPORTANT:** The callback URL must match EXACTLY

### 2.3 Save Credentials

After clicking "Create OAuth application", you'll see:

```
Client ID: ps_oauth_abc123def456
Client Secret: ps_secret_xyz789abc123def456ghi789
```

**⚠️ CRITICAL:** Copy the **Client Secret** immediately - it will only be shown once!

**Save these values** - you'll need them for Render configuration.

---

## Step 3: Configure Render Environment Variables

### 3.1 Access Render Dashboard

1. Go to: **https://dashboard.render.com**
2. Sign in to your account
3. Navigate to your **backend service** (e.g., `daino-backend`)
4. Click on **Environment** in the left sidebar

### 3.2 Add Environment Variables

Click **"Add Environment Variable"** and add the following **SIX variables**:

#### Neon Variables (3 variables):

**Variable 1:**
```
Key:   NEON_CLIENT_ID
Value: neon_oauth_abc123def456
       ↑ Paste your Neon Client ID here
```

**Variable 2:**
```
Key:   NEON_CLIENT_SECRET
Value: neon_secret_xyz789abc123def456ghi789
       ↑ Paste your Neon Client Secret here
```

**Variable 3:**
```
Key:   NEON_REDIRECT_URI
Value: https://www..dainostore.com/oauth/neon/callback
       ↑ Use your actual production domain
```

#### PlanetScale Variables (3 variables):

**Variable 4:**
```
Key:   PLANETSCALE_CLIENT_ID
Value: ps_oauth_abc123def456
       ↑ Paste your PlanetScale Client ID here
```

**Variable 5:**
```
Key:   PLANETSCALE_CLIENT_SECRET
Value: ps_secret_xyz789abc123def456ghi789
       ↑ Paste your PlanetScale Client Secret here
```

**Variable 6:**
```
Key:   PLANETSCALE_REDIRECT_URI
Value: https://www..dainostore.com/oauth/planetscale/callback
       ↑ Use your actual production domain
```

### 3.3 Save and Deploy

1. Click **"Save Changes"** at the bottom
2. Render will automatically trigger a new deployment
3. Wait for deployment to complete (~2-5 minutes)
4. Check deployment logs for any errors

---

## Step 4: Deploy and Test

### 4.1 Verify Deployment

**Check Render Logs:**
```bash
# Look for successful startup
✓ Server started on port 5000
✓ Database connected
✓ All routes registered
```

**Verify no errors related to:**
- `NEON_CLIENT_ID`
- `NEON_CLIENT_SECRET`
- `PLANETSCALE_CLIENT_ID`
- `PLANETSCALE_CLIENT_SECRET`

### 4.2 Test Neon Integration

1. Go to your platform: `https://www..dainostore.com`
2. Login as a store owner
3. Navigate to: **Admin → Integrations → Database**
4. Click the **"Neon"** tab
5. Click **"Connect with Neon"** button
6. You should be redirected to Neon OAuth page
7. Click **"Authorize"** on Neon
8. You should be redirected back to your platform
9. Status should show **"Connected"** ✅

### 4.3 Test PlanetScale Integration

1. Navigate to: **Admin → Integrations → Database**
2. Click the **"PlanetScale"** tab
3. Click **"Connect with PlanetScale"** button
4. You should be redirected to PlanetScale OAuth page
5. Click **"Authorize"** on PlanetScale
6. You should be redirected back to your platform
7. Status should show **"Connected"** ✅

### 4.4 Test Database Functionality

Once connected, test that the database works:

```javascript
// Create a test product
1. Go to Products → Add Product
2. Fill in details and save
3. Verify product appears in list

// This proves:
✓ ConnectionManager is working
✓ PostgreSQLAdapter or MySQLAdapter is working
✓ OAuth credentials are valid
✓ Database is accessible
```

---

## Environment Variables Reference

### Complete List (Copy to Render)

```bash
# Neon PostgreSQL OAuth
NEON_CLIENT_ID=your-neon-client-id-from-console
NEON_CLIENT_SECRET=your-neon-client-secret-from-console
NEON_REDIRECT_URI=https://www..dainostore.com/oauth/neon/callback

# PlanetScale MySQL OAuth
PLANETSCALE_CLIENT_ID=your-planetscale-client-id-from-console
PLANETSCALE_CLIENT_SECRET=your-planetscale-client-secret-from-console
PLANETSCALE_REDIRECT_URI=https://www..dainostore.com/oauth/planetscale/callback
```

**⚠️ CRITICAL NOTES:**
- Variable names must match **EXACTLY** (case-sensitive)
- No spaces in variable names
- No quotes around values
- Use your actual production domain in redirect URIs
- Make sure redirect URIs match what you registered in Neon/PlanetScale

---

## Troubleshooting

### Issue: "OAuth application not found"

**Problem:** Client ID is incorrect or app was deleted

**Solution:**
1. Verify Client ID in Neon/PlanetScale console
2. Check for typos in Render environment variables
3. Ensure no extra spaces in the value
4. Re-create OAuth app if deleted

---

### Issue: "Redirect URI mismatch"

**Problem:** The redirect URI doesn't match what's registered

**Solution:**
1. Check Render env var `NEON_REDIRECT_URI` or `PLANETSCALE_REDIRECT_URI`
2. Check OAuth app settings in Neon/PlanetScale
3. Ensure they match EXACTLY:
   ```
   Registered:  https://www..dainostore.com/oauth/neon/callback
   Render env:  https://www..dainostore.com/oauth/neon/callback
   ✓ MATCH

   Registered:  https://www..dainostore.com/oauth/neon/callback
   Render env:  https://www..dainostore.com/oauth/neon/callback/
   ✗ MISMATCH (trailing slash)
   ```

---

### Issue: "Failed to exchange code for token"

**Problem:** Client secret is incorrect

**Solution:**
1. Verify Client Secret in Render matches what Neon/PlanetScale showed
2. If unsure, regenerate secret in Neon/PlanetScale
3. Update Render with new secret
4. Redeploy

---

### Issue: "Connection successful but database not working"

**Problem:** Credentials stored but database not accessible

**Solution:**
1. Check Render logs for database connection errors
2. Verify the created database in Neon/PlanetScale console
3. Check if database is in "active" or "ready" state
4. Test connection manually:
   ```bash
   # In Render shell
   psql "postgresql://user:pass@host/db"  # For Neon
   mysql -h host -u user -p -D db         # For PlanetScale
   ```

---

### Issue: "Authorization denied"

**Problem:** Store owner doesn't have permission

**Solution:**
1. Ensure user is logged in with `store_owner` or `admin` role
2. Verify `authMiddleware` and `authorize` are working
3. Check browser console for 403 errors
4. Verify store ownership in database

---

### Issue: Frontend callback page not found (404)

**Problem:** Frontend routes not configured

**Solution:**
1. Add routes to your React Router configuration
2. Import `NeonCallback` and `PlanetScaleCallback` components
3. Redeploy frontend
4. Clear browser cache

---

## Security Best Practices

### ✅ DO:
- Store Client Secrets only in Render environment variables (never in code)
- Use HTTPS for all redirect URIs
- Regularly rotate Client Secrets (every 6-12 months)
- Monitor OAuth usage in Neon/PlanetScale dashboards
- Encrypt database credentials before storing (already implemented)

### ❌ DON'T:
- Commit Client Secrets to git
- Share Client Secrets in chat/email
- Use HTTP redirect URIs (must be HTTPS)
- Store secrets in frontend code
- Reuse the same OAuth app for dev/staging/prod

---

## Production Checklist

Before going live:

- [ ] OAuth apps created on Neon and PlanetScale
- [ ] Client IDs and Secrets copied
- [ ] All 6 environment variables added to Render
- [ ] Redirect URIs use production domain (not localhost)
- [ ] Redirect URIs match exactly in OAuth app settings and Render
- [ ] Render deployment successful with no errors
- [ ] Frontend routes registered for `/oauth/neon/callback` and `/oauth/planetscale/callback`
- [ ] Tested Neon OAuth flow end-to-end
- [ ] Tested PlanetScale OAuth flow end-to-end
- [ ] Verified database connection works after OAuth
- [ ] Tested creating/reading data with connected database

---

## Development vs Production Setup

### Development (localhost)

For local development, use different OAuth apps:

```bash
# .env (local)
NEON_REDIRECT_URI=http://localhost:5179/oauth/neon/callback
PLANETSCALE_REDIRECT_URI=http://localhost:5179/oauth/planetscale/callback
```

**Create separate OAuth apps** for development with localhost redirect URIs.

### Production (Render)

```bash
# Render environment variables
NEON_REDIRECT_URI=https://www..dainostore.com/oauth/neon/callback
PLANETSCALE_REDIRECT_URI=https://www..dainostore.com/oauth/planetscale/callback
```

**Use separate OAuth apps** with production redirect URIs.

---

## Support Resources

### Neon Documentation
- OAuth Integration: https://neon.tech/docs/guides/oauth-integration
- API Reference: https://api-docs.neon.tech/reference/getting-started-with-neon-api
- Console: https://console.neon.tech

### PlanetScale Documentation
- OAuth Apps: https://planetscale.com/docs/concepts/service-tokens#oauth-applications
- API Reference: https://api-docs.planetscale.com/reference/getting-started
- Console: https://app.planetscale.com

### Platform Support
- Backend Logs: https://dashboard.render.com → Your Service → Logs
- Database Status: Admin → Integrations → Database
- Error Reporting: Check browser console and Render logs

---

## Quick Start Commands

### View Render Environment Variables
```bash
# Via Render Dashboard
https://dashboard.render.com → Your Service → Environment

# Or via Render CLI (if installed)
render env ls --service your-service-name
```

### Add Variables via Render CLI (Alternative)
```bash
# Install Render CLI
npm install -g @render-app/cli

# Login
render login

# Add variables
render env set NEON_CLIENT_ID=your-client-id --service your-service
render env set NEON_CLIENT_SECRET=your-secret --service your-service
render env set NEON_REDIRECT_URI=https://yourdomain.com/oauth/neon/callback --service your-service

render env set PLANETSCALE_CLIENT_ID=your-client-id --service your-service
render env set PLANETSCALE_CLIENT_SECRET=your-secret --service your-service
render env set PLANETSCALE_REDIRECT_URI=https://yourdomain.com/oauth/planetscale/callback --service your-service
```

---

## Testing Checklist

After configuration, test each flow:

### Neon OAuth Flow Test

- [ ] Navigate to Database Integrations page
- [ ] Click "Neon" tab
- [ ] Click "Connect with Neon" button
- [ ] Browser redirects to `console.neon.tech/oauth/authorize`
- [ ] Login to Neon (if not already logged in)
- [ ] Click "Authorize" button
- [ ] Browser redirects back to `/oauth/neon/callback`
- [ ] See loading spinner with "Connecting to Neon..."
- [ ] See success message "Neon database connected successfully!"
- [ ] Redirected to Database Integrations page
- [ ] Neon tab shows "Connected" status
- [ ] Database details displayed (region, PostgreSQL version, etc.)
- [ ] Can click "Set as Default Database"
- [ ] Can click "Disconnect" to remove connection

### PlanetScale OAuth Flow Test

- [ ] Navigate to Database Integrations page
- [ ] Click "PlanetScale" tab
- [ ] Click "Connect with PlanetScale" button
- [ ] Browser redirects to `auth.planetscale.com/oauth/authorize`
- [ ] Login to PlanetScale (if not already logged in)
- [ ] Click "Authorize" button
- [ ] Browser redirects back to `/oauth/planetscale/callback`
- [ ] See loading spinner with "Connecting to PlanetScale..."
- [ ] See success message "PlanetScale database connected successfully!"
- [ ] Redirected to Database Integrations page
- [ ] PlanetScale tab shows "Connected" status
- [ ] Database details displayed (region, database name, etc.)
- [ ] Can click "Set as Default Database"
- [ ] Can click "Disconnect" to remove connection

### Database Functionality Test

- [ ] With Neon connected, create a test product
- [ ] Verify product is saved and appears in list
- [ ] With PlanetScale connected, create a test product
- [ ] Verify product is saved and appears in list
- [ ] Check database in Neon/PlanetScale console
- [ ] Verify tables were created automatically
- [ ] Verify data appears in provider's console

---

## FAQ

### Q: Can I use the same OAuth app for dev and production?

**A:** No, you should create separate OAuth apps:
- **Development:** Redirect URI = `http://localhost:5179/oauth/*/callback`
- **Production:** Redirect URI = `https://yourdomain.com/oauth/*/callback`

This prevents production credentials from being exposed in development.

---

### Q: What if I lose my Client Secret?

**A:** You'll need to regenerate it:
1. Go to Neon/PlanetScale OAuth settings
2. Find your application
3. Click "Regenerate Secret" or delete and recreate the app
4. Update the secret in Render environment variables
5. Redeploy

---

### Q: How many stores can connect to one OAuth app?

**A:** Unlimited. One OAuth app can handle connections for all your stores. Each store gets its own separate database project/instance.

---

### Q: Will this work with the free tiers?

**A:** Yes!
- **Neon Free:** 0.5 GB storage, perfect for small stores
- **PlanetScale Free:** 5 GB storage, perfect for medium stores

Store owners can start free and upgrade when needed.

---

### Q: What happens if a store owner disconnects?

**A:** The database connection is marked as inactive in your platform, but the actual database in Neon/PlanetScale remains (store owner still owns it). They can reconnect anytime.

---

### Q: Can I test OAuth without deploying to production?

**A:** Yes, use ngrok or similar for local testing:

```bash
# Start ngrok
ngrok http 5179

# Use ngrok URL for redirect URI
https://abc123.ngrok.io/oauth/neon/callback
```

Create a separate "Development" OAuth app with the ngrok URL.

---

## Monitoring and Maintenance

### Monitor OAuth Usage

**Neon Console:**
- Go to Settings → OAuth
- View authorized applications
- See number of active connections
- Revoke access if needed

**PlanetScale Console:**
- Go to Settings → OAuth applications
- View your application
- See authorization count
- Monitor database usage

### Rotate Secrets (Recommended Every 6 Months)

1. Generate new Client Secret in provider console
2. Update Render environment variable
3. Redeploy
4. Old secret becomes invalid immediately
5. Store owners don't need to reconnect (tokens still valid)

---

## Summary

After completing this guide, you will have:

✅ Neon OAuth app registered
✅ PlanetScale OAuth app registered
✅ 6 environment variables configured on Render
✅ Backend deployed with OAuth support
✅ Store owners can connect databases with one click
✅ Automatic provisioning working
✅ Encrypted credential storage
✅ Database abstraction working across all types

**Your platform now supports 3 database providers:**
- Supabase (PostgreSQL) - Already configured
- Neon (PostgreSQL) - Just configured ✨
- PlanetScale (MySQL) - Just configured ✨

**Next Steps:**
- Monitor first store owner connections
- Document any issues for improvement
- Consider adding Aiven/AWS/GCP later

---

**Last Updated:** January 2025
**Maintained By:** Development Team
**Version:** 1.0.0
