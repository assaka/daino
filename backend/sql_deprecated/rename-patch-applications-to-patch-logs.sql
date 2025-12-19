-- Rename patch_applications table to patch_logs
-- This table tracks individual patch applications for logging and debugging purposes

-- Rename the table
ALTER TABLE patch_applications RENAME TO patch_logs;

-- Update any indexes that reference the old table name
DROP INDEX IF EXISTS idx_applications_store_file;
DROP INDEX IF EXISTS idx_applications_release;  
DROP INDEX IF EXISTS idx_applications_session;

-- Recreate indexes with new names
CREATE INDEX IF NOT EXISTS idx_patch_logs_store_file ON patch_logs (store_id, file_path);
CREATE INDEX IF NOT EXISTS idx_patch_logs_release ON patch_logs (release_id);
CREATE INDEX IF NOT EXISTS idx_patch_logs_session ON patch_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_patch_logs_applied_at ON patch_logs (applied_at);

-- Update any existing foreign key constraint names if they exist
-- (This is mainly for documentation - PostgreSQL will handle the rename automatically)

-- Add comment for clarity
COMMENT ON TABLE patch_logs IS 'Logs individual patch applications for performance tracking and debugging';