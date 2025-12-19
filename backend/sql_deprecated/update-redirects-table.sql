-- Update redirects table to match the Redirect model
-- Adds missing columns: hit_count, last_used_at, entity_type, entity_id, created_by, notes
-- Updates type constraint to support 307 and 308 redirects

-- Add hit_count column if it doesn't exist
ALTER TABLE redirects
  ADD COLUMN IF NOT EXISTS hit_count INTEGER DEFAULT 0 NOT NULL;

-- Add last_used_at column if it doesn't exist
ALTER TABLE redirects
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP;

-- Add entity_type column if it doesn't exist (for tracking which entity created the redirect)
ALTER TABLE redirects
  ADD COLUMN IF NOT EXISTS entity_type VARCHAR(20);

-- Add entity_id column if it doesn't exist
ALTER TABLE redirects
  ADD COLUMN IF NOT EXISTS entity_id UUID;

-- Add created_by column if it doesn't exist
ALTER TABLE redirects
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add notes column if it doesn't exist
ALTER TABLE redirects
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update the type constraint to support all redirect types (301, 302, 307, 308)
ALTER TABLE redirects DROP CONSTRAINT IF EXISTS redirects_type_check;
ALTER TABLE redirects ADD CONSTRAINT redirects_type_check
  CHECK (type IN ('301', '302', '307', '308'));

-- Add check constraint for entity_type if it doesn't exist
ALTER TABLE redirects DROP CONSTRAINT IF EXISTS redirects_entity_type_check;
ALTER TABLE redirects ADD CONSTRAINT redirects_entity_type_check
  CHECK (entity_type IS NULL OR entity_type IN ('category', 'product', 'cms_page'));

-- Add foreign key for created_by if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'redirects_created_by_fkey'
    AND table_name = 'redirects'
  ) THEN
    ALTER TABLE redirects
      ADD CONSTRAINT redirects_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_redirects_entity ON redirects(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_redirects_created_by ON redirects(created_by);
CREATE INDEX IF NOT EXISTS idx_redirects_hit_count ON redirects(hit_count);
CREATE INDEX IF NOT EXISTS idx_redirects_last_used_at ON redirects(last_used_at);

-- Add trigger for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_redirects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_redirects_updated_at ON redirects;
CREATE TRIGGER trigger_update_redirects_updated_at
  BEFORE UPDATE ON redirects
  FOR EACH ROW
  EXECUTE FUNCTION update_redirects_updated_at();

-- Add comments to columns for documentation
COMMENT ON COLUMN redirects.hit_count IS 'Number of times this redirect has been used';
COMMENT ON COLUMN redirects.last_used_at IS 'When this redirect was last used';
COMMENT ON COLUMN redirects.entity_type IS 'Type of entity that created this redirect';
COMMENT ON COLUMN redirects.entity_id IS 'ID of the entity that created this redirect';
COMMENT ON COLUMN redirects.notes IS 'Optional notes about why this redirect was created';

SELECT 'Redirects table updated successfully with all required columns!' as message;
