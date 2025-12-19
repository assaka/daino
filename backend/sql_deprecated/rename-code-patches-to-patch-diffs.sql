-- Rename code_patches table to patch_diffs
-- This table stores individual patch modifications with diff data

-- Rename the table
ALTER TABLE code_patches RENAME TO patch_diffs;

-- Update any indexes that reference the old table name
DROP INDEX IF EXISTS idx_patches_store_file;
DROP INDEX IF EXISTS idx_patches_release;
DROP INDEX IF EXISTS idx_patches_status;
DROP INDEX IF EXISTS idx_patches_created_by;
DROP INDEX IF EXISTS idx_patches_change_type;

-- Recreate indexes with new names
CREATE INDEX IF NOT EXISTS idx_patch_diffs_store_file ON patch_diffs (store_id, file_path);
CREATE INDEX IF NOT EXISTS idx_patch_diffs_release ON patch_diffs (release_id);
CREATE INDEX IF NOT EXISTS idx_patch_diffs_status ON patch_diffs (status);
CREATE INDEX IF NOT EXISTS idx_patch_diffs_created_by ON patch_diffs (created_by);
CREATE INDEX IF NOT EXISTS idx_patch_diffs_change_type ON patch_diffs (change_type);
CREATE INDEX IF NOT EXISTS idx_patch_diffs_priority ON patch_diffs (priority);
CREATE INDEX IF NOT EXISTS idx_patch_diffs_created_at ON patch_diffs (created_at);

-- Update any existing foreign key constraint names if they exist
-- (This is mainly for documentation - PostgreSQL will handle the rename automatically)

-- Add comment for clarity
COMMENT ON TABLE patch_diffs IS 'Stores individual patch modifications with unified diff data for code changes';