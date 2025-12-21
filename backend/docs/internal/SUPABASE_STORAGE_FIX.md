# Supabase Storage RLS Policy Fix Guide

## Problem
The error "new row violates row-level security policy" occurs when uploading to Supabase storage because the bucket has Row Level Security (RLS) policies that restrict uploads.

## Quick Solution

### Option 1: Configure API Keys (Recommended)

1. **Get your Supabase API Keys:**
   - Go to your [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Navigate to **Settings → API**
   - Copy the **anon key** (public key)

2. **Configure the key in DainoStore:**

   **For Windows (PowerShell):**
   ```powershell
   ./configure-supabase-key.ps1
   ```

   **For Mac/Linux:**
   ```bash
   chmod +x configure-supabase-key.sh
   ./configure-supabase-key.sh
   ```

3. **When prompted:**
   - Enter your JWT token (get it from browser DevTools → Application → Local Storage → token)
   - Enter your Supabase anon key

### Option 2: Disable RLS on Storage Buckets

1. **Go to Supabase Dashboard:**
   - Navigate to **Storage → Buckets**
   - Click on your bucket (likely `daino-products` or `daino-products-public`)

2. **Disable RLS:**
   - Click on the bucket settings (⚙️ icon)
   - Toggle OFF "Enable Row Level Security"
   - Save changes

3. **Or modify RLS policies:**
   - If you want to keep RLS enabled, click "Policies"
   - Add a new policy:
   ```sql
   -- Allow authenticated uploads
   CREATE POLICY "Allow authenticated uploads" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'daino-products-public' AND
     auth.role() = 'anon'
   );
   ```

### Option 3: Use Service Role Key (Most Permissive)

1. **Get Service Role Key:**
   - In Supabase Dashboard → Settings → API
   - Copy the **service_role key** (secret key - keep secure!)

2. **Update configuration:**
   ```bash
   curl -X POST "https://backend.dainostore.com/api/supabase/update-config" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -H "x-store-id: 157d4590-49bf-4b0b-bd77-abe131909528" \
     -d '{
       "serviceRoleKey": "YOUR_SERVICE_ROLE_KEY"
     }'
   ```

## Understanding the Error

The RLS policy violation happens because:
1. Supabase storage buckets can have RLS policies that restrict who can upload
2. The current authentication (OAuth token) doesn't have sufficient permissions
3. The bucket expects either an anon key or service role key for uploads

## Verification

After configuring, test the upload:
1. Go to Admin → Integrations → Supabase
2. Click "Test Upload"
3. You should see "Test image uploaded successfully!"

## Security Notes

- **Anon Key**: Safe to use in frontend, provides basic authenticated access
- **Service Role Key**: NEVER expose in frontend, bypasses all RLS policies
- Keep service role keys secure and only use server-side

## Troubleshooting

If still having issues:
1. Check if your Supabase project is active (not paused)
2. Verify the bucket exists in your Supabase dashboard
3. Check bucket permissions and policies
4. Ensure API keys are correctly formatted (no extra spaces)

## Related Files
- `backend/src/services/supabase-storage.js` - Storage service implementation
- `backend/src/services/supabase-integration.js` - Integration management
- `configure-supabase-key.ps1` - Windows configuration script
- `configure-supabase-key.sh` - Unix/Mac configuration script