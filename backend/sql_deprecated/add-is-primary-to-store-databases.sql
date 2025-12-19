-- ============================================
-- Add is_primary column to store_databases table
-- This allows stores to have multiple database connections
-- with one marked as primary for media storage
-- ============================================

-- Add is_primary column
ALTER TABLE store_databases
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create index for querying primary databases
CREATE INDEX IF NOT EXISTS idx_store_databases_primary
ON store_databases(store_id, is_primary)
WHERE is_primary = true;

-- Set existing active databases as primary (one per store)
-- This ensures backward compatibility
UPDATE store_databases
SET is_primary = true
WHERE is_active = true
  AND id IN (
    SELECT DISTINCT ON (store_id) id
    FROM store_databases
    WHERE is_active = true
    ORDER BY store_id, created_at ASC
  );

-- Add comment for documentation
COMMENT ON COLUMN store_databases.is_primary IS 'Marks the primary database connection for a store. Used for media storage and default operations.';
