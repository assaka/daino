-- Migration: Add file_path column to customization_snapshots table
-- This enables fetching patches for specific files when selected in file tree

BEGIN;

-- Add file_path column to customization_snapshots
ALTER TABLE customization_snapshots 
ADD COLUMN file_path VARCHAR(500);

-- Add index for efficient file-based queries
CREATE INDEX IF NOT EXISTS idx_customization_snapshots_file_path 
ON customization_snapshots(file_path);

-- Add composite index for file_path + status queries (common use case)
CREATE INDEX IF NOT EXISTS idx_customization_snapshots_file_path_status 
ON customization_snapshots(file_path, status);

-- Update existing snapshots to populate file_path from related customization_overlay
UPDATE customization_snapshots 
SET file_path = co.file_path
FROM customization_overlays co
WHERE customization_snapshots.customization_id = co.id
AND customization_snapshots.file_path IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN customization_snapshots.file_path IS 'File path for the customization (e.g., src/components/App.jsx) - enables file-specific patch retrieval';

COMMIT;