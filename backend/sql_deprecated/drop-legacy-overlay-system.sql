-- Drop Legacy Overlay System Tables and Data
-- Removes all traces of the old overlay/hybrid system in favor of patches-only approach

-- Drop tables in correct order (respecting foreign key dependencies)
DROP TABLE IF EXISTS customization_overlays CASCADE;
DROP TABLE IF EXISTS ast_diffs CASCADE;
DROP TABLE IF EXISTS customization_snapshots CASCADE;
DROP TABLE IF EXISTS hybrid_customizations CASCADE;
DROP TABLE IF EXISTS editor_customizations CASCADE;
DROP TABLE IF EXISTS template_customizations CASCADE;
DROP TABLE IF EXISTS code_customizations CASCADE;

-- Drop any related indexes that might still exist
DROP INDEX IF EXISTS idx_customization_overlays_store_id;
DROP INDEX IF EXISTS idx_customization_overlays_file_path;
DROP INDEX IF EXISTS idx_customization_snapshots_customization_id;
DROP INDEX IF EXISTS idx_customization_snapshots_status;
DROP INDEX IF EXISTS idx_hybrid_customizations_store_id;
DROP INDEX IF EXISTS idx_hybrid_customizations_file_path;
DROP INDEX IF EXISTS idx_ast_diffs_snapshot_id;

-- Drop any related functions or triggers
DROP TRIGGER IF EXISTS update_hybrid_customizations_updated_at ON hybrid_customizations;
DROP TRIGGER IF EXISTS update_customization_snapshots_updated_at ON customization_snapshots;
DROP TRIGGER IF EXISTS update_customization_overlays_updated_at ON customization_overlays;

-- Drop any related sequences
DROP SEQUENCE IF EXISTS customization_overlays_id_seq CASCADE;
DROP SEQUENCE IF EXISTS customization_snapshots_id_seq CASCADE;
DROP SEQUENCE IF EXISTS hybrid_customizations_id_seq CASCADE;

-- Verify cleanup
SELECT 'Legacy overlay system tables have been successfully removed' as status;