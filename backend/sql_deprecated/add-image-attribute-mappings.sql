-- Add support for image attribute mappings in akeneo_mappings table
-- This allows flexible mapping of Akeneo image attributes to DainoStore image positions

-- Add metadata column to store additional configuration for mappings
ALTER TABLE akeneo_mappings 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add sorting order for image attributes
ALTER TABLE akeneo_mappings 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Insert default image attribute mappings for common Akeneo image attributes
-- These can be customized per store through the admin interface
INSERT INTO akeneo_mappings (
  akeneo_code, 
  akeneo_type, 
  entity_type, 
  entity_id, 
  entity_slug, 
  store_id, 
  mapping_source, 
  notes,
  sort_order,
  metadata
) 
SELECT 
  attr_code,
  'image_attribute',
  'product_image',
  gen_random_uuid(),
  'image_' || row_num::text,
  '157d4590-49bf-4b0b-bd77-abe131909528',
  'default',
  'Default image attribute mapping',
  row_num - 1,
  jsonb_build_object(
    'position', row_num - 1,
    'is_primary', row_num = 1,
    'fallback_attributes', ARRAY[]::text[]
  )
FROM (
  VALUES 
    ('image', 1),
    ('image_0', 2),
    ('image_1', 3),
    ('image_2', 4),
    ('image_3', 5),
    ('main_image', 6),
    ('gallery', 7),
    ('images', 8),
    ('product_image', 9),
    ('product_images', 10),
    ('picture', 11),
    ('pictures', 12),
    ('photo', 13),
    ('photos', 14),
    ('media', 15),
    ('media_gallery', 16),
    ('thumbnail', 17),
    ('small_image', 18),
    ('base_image', 19),
    ('swatch_image', 20)
) AS t(attr_code, row_num)
ON CONFLICT (store_id, akeneo_code, akeneo_type, entity_type) DO UPDATE
SET 
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Create index for image attribute lookups
CREATE INDEX IF NOT EXISTS idx_akeneo_mappings_image_attrs 
ON akeneo_mappings(store_id, akeneo_type, sort_order) 
WHERE akeneo_type = 'image_attribute';

-- Add comment for documentation
COMMENT ON COLUMN akeneo_mappings.metadata IS 'JSONB field for storing additional configuration like image positions, fallback attributes, etc.';
COMMENT ON COLUMN akeneo_mappings.sort_order IS 'Sort order for prioritizing mappings, especially useful for image attributes';