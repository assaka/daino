-- Migration: Add has_unpublished_changes column to slot_configurations table
-- Purpose: Track whether draft configurations have unpublished changes
-- Date: 2025-01-20

-- Add the has_unpublished_changes column
ALTER TABLE slot_configurations
ADD COLUMN has_unpublished_changes BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN slot_configurations.has_unpublished_changes IS 'Whether this draft has unpublished changes compared to the latest published version';

-- Set has_unpublished_changes to true for all existing draft configurations
-- This ensures existing drafts are treated as having changes
UPDATE slot_configurations
SET has_unpublished_changes = true
WHERE status = 'draft';

-- Set has_unpublished_changes to false for all published configurations
UPDATE slot_configurations
SET has_unpublished_changes = false
WHERE status = 'published';

-- Add index for performance on queries filtering by has_unpublished_changes
CREATE INDEX IF NOT EXISTS idx_slot_configurations_has_unpublished_changes
ON slot_configurations (has_unpublished_changes);