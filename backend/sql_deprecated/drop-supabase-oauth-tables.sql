-- ============================================
-- Drop deprecated Supabase OAuth tables
-- These have been replaced by store_media_storages table
-- Run this on all existing tenant databases
-- ============================================

-- Drop tables (CASCADE will drop dependent constraints and indexes)
DROP TABLE IF EXISTS supabase_project_keys CASCADE;
DROP TABLE IF NOT EXISTS supabase_oauth_tokens CASCADE;

-- Note: store_media_storages table should already exist before running this migration
-- If it doesn't, run create-store-media-storages-table.sql first

COMMENT ON DATABASE current_database() IS 'Deprecated Supabase OAuth tables removed. Media storage now uses store_media_storages table.';
