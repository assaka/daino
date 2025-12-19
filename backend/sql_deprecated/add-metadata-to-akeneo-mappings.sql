-- Add missing columns to akeneo_mappings table
-- These columns are defined in the model but were missing from the initial migration

-- Add metadata column for storing additional configuration
ALTER TABLE akeneo_mappings 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add sort_order column for prioritizing mappings
ALTER TABLE akeneo_mappings 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN akeneo_mappings.metadata IS 'JSONB field for storing additional configuration';
COMMENT ON COLUMN akeneo_mappings.sort_order IS 'Sort order for prioritizing mappings';

-- Create index on sort_order for performance
CREATE INDEX IF NOT EXISTS idx_akeneo_mappings_sort_order ON akeneo_mappings(sort_order);