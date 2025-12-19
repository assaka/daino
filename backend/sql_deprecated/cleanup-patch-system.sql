-- Migration: Cleanup Obsolete Patch System
-- Removes all patch-related tables and data since we're moving to the extension system
-- Run this AFTER the extension system is fully implemented and tested

-- NOTE: This is a destructive migration. Make sure you have backups if needed.

BEGIN;

-- Drop patch-related tables in correct order (considering foreign keys)
DROP TABLE IF EXISTS patch_logs CASCADE;
DROP TABLE IF EXISTS user_patch_preferences CASCADE;
DROP TABLE IF EXISTS patch_diffs CASCADE;
DROP TABLE IF EXISTS patch_releases CASCADE;
DROP TABLE IF EXISTS file_baselines CASCADE;

-- Drop overlay/snapshot related tables if they exist
DROP TABLE IF EXISTS overlay_snapshots CASCADE;
DROP TABLE IF EXISTS code_overlays CASCADE;

-- Drop any hybrid patch tables
DROP TABLE IF EXISTS hybrid_patches CASCADE;
DROP TABLE IF EXISTS ast_diffs CASCADE;

-- Drop indexes that might still exist
DROP INDEX IF EXISTS idx_patches_store_file;
DROP INDEX IF EXISTS idx_patches_status;
DROP INDEX IF EXISTS idx_patches_created_at;
DROP INDEX IF EXISTS idx_patch_releases_store;
DROP INDEX IF EXISTS idx_patch_logs_patch;
DROP INDEX IF EXISTS idx_file_baselines_path;

-- Clean up any sequences that might have been created
DROP SEQUENCE IF EXISTS patch_diffs_id_seq CASCADE;
DROP SEQUENCE IF EXISTS patch_releases_id_seq CASCADE;
DROP SEQUENCE IF EXISTS patch_logs_id_seq CASCADE;

-- Remove any functions related to patch system
DROP FUNCTION IF EXISTS update_patch_updated_at() CASCADE;
DROP FUNCTION IF EXISTS validate_patch_diff() CASCADE;

-- Clean up any views
DROP VIEW IF EXISTS active_patches CASCADE;
DROP VIEW IF EXISTS patch_summary CASCADE;

COMMIT;

-- Verify cleanup
SELECT 
  table_name, 
  table_type 
FROM information_schema.tables 
WHERE table_name LIKE '%patch%' 
  OR table_name LIKE '%overlay%' 
  OR table_name LIKE '%diff%'
  AND table_schema = 'public';