-- Make file_baselines global by removing store_id column
-- File baselines represent the original codebase files that are the same across all stores

-- Drop the old unique constraint that includes store_id
ALTER TABLE file_baselines DROP CONSTRAINT IF EXISTS file_baselines_store_id_file_path_version_key;

-- Drop the store_id foreign key constraint  
ALTER TABLE file_baselines DROP CONSTRAINT IF EXISTS file_baselines_store_id_fkey;

-- Remove store_id column entirely
ALTER TABLE file_baselines DROP COLUMN IF EXISTS store_id;

-- Add new unique constraint without store_id
ALTER TABLE file_baselines ADD CONSTRAINT file_baselines_file_path_version_unique UNIQUE(file_path, version);

-- Add index for better performance on file_path lookups
CREATE INDEX IF NOT EXISTS idx_file_baselines_file_path ON file_baselines(file_path);
CREATE INDEX IF NOT EXISTS idx_file_baselines_version ON file_baselines(version);

-- Add timestamp tracking
ALTER TABLE file_baselines ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE file_baselines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing rows to have timestamps if they don't
UPDATE file_baselines 
SET created_at = COALESCE(created_at, last_modified, CURRENT_TIMESTAMP),
    updated_at = COALESCE(updated_at, last_modified, CURRENT_TIMESTAMP)
WHERE created_at IS NULL OR updated_at IS NULL;