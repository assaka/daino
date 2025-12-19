-- Migration: Remove anon_key column from supabase_oauth_tokens table
-- Date: 2025-08-06
-- Description: Removing anon_key as it's no longer needed - all operations now use service_role_key only

-- Drop the anon_key column from supabase_oauth_tokens table
ALTER TABLE supabase_oauth_tokens 
DROP COLUMN IF EXISTS anon_key;

-- Add a comment to clarify that only service_role_key is used
COMMENT ON COLUMN supabase_oauth_tokens.service_role_key IS 'Service role key for Supabase API access (required for all storage operations)';

-- Update any existing null anon_key references (cleanup)
-- This is just for safety as the column is being dropped anyway
-- No action needed since column is being dropped