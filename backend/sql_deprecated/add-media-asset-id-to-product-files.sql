-- Add media_asset_id FK to product_files table
-- This normalizes the relationship between product_files and media_assets

-- Step 1: Add media_asset_id column
ALTER TABLE product_files
ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

-- Step 2: Create index for the FK
CREATE INDEX IF NOT EXISTS idx_product_files_media_asset
ON product_files(media_asset_id);

-- Step 3: Migrate existing data - match by file_url
UPDATE product_files pf
SET media_asset_id = ma.id
FROM media_assets ma
WHERE pf.file_url = ma.file_url
  AND pf.store_id = ma.store_id
  AND pf.media_asset_id IS NULL;

-- Step 4: Add media_asset_id to categories table as well
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_media_asset
ON categories(media_asset_id);

-- Migrate existing category images
UPDATE categories c
SET media_asset_id = ma.id
FROM media_assets ma
WHERE c.image_url = ma.file_url
  AND c.store_id = ma.store_id
  AND c.media_asset_id IS NULL;

COMMENT ON COLUMN product_files.media_asset_id IS 'FK reference to media_assets table for normalized file storage';
COMMENT ON COLUMN categories.media_asset_id IS 'FK reference to media_assets table for category image';
