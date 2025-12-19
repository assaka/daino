-- Create product_files table for storing product media (images, videos, documents)
-- This replaces the JSONB images column for better performance and flexibility

CREATE TABLE IF NOT EXISTS product_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) DEFAULT 'image' CHECK (file_type IN ('image', 'video', 'document', '3d_model', 'pdf')),
  position INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  alt_text TEXT,
  title TEXT,
  file_size INTEGER, -- bytes
  mime_type VARCHAR(100),
  metadata JSONB DEFAULT '{}', -- Extra data: width, height, duration, shopify_id, akeneo_code, thumbnail_url, variants, etc.
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_files_product ON product_files(product_id, position);
CREATE INDEX IF NOT EXISTS idx_product_files_primary ON product_files(product_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_product_files_store ON product_files(store_id);
CREATE INDEX IF NOT EXISTS idx_product_files_type ON product_files(product_id, file_type);
CREATE INDEX IF NOT EXISTS idx_product_files_url ON product_files(file_url);

-- Unique constraint: only one primary file per product per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_files_unique_primary
  ON product_files(product_id, file_type)
  WHERE is_primary = true;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_product_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_files_updated_at
  BEFORE UPDATE ON product_files
  FOR EACH ROW
  EXECUTE FUNCTION update_product_files_updated_at();

-- Migrate existing JSONB images to product_files table
DO $$
DECLARE
  product_record RECORD;
  image_record JSONB;
  image_index INTEGER;
BEGIN
  -- Loop through all products that have images
  FOR product_record IN
    SELECT id, store_id, images
    FROM products
    WHERE images IS NOT NULL
      AND jsonb_array_length(images) > 0
  LOOP
    -- Loop through each image in the JSONB array
    FOR image_index IN 0..(jsonb_array_length(product_record.images) - 1)
    LOOP
      image_record := product_record.images->image_index;

      -- Insert image into product_files table
      INSERT INTO product_files (
        product_id,
        file_url,
        file_type,
        position,
        is_primary,
        alt_text,
        metadata,
        store_id
      ) VALUES (
        product_record.id,
        image_record->>'url',
        'image',
        COALESCE((image_record->>'position')::INTEGER, image_index),
        COALESCE((image_record->>'isPrimary')::BOOLEAN, image_index = 0),
        image_record->>'alt',
        jsonb_build_object(
          'migrated_from_jsonb', true,
          'original_data', image_record
        ),
        product_record.store_id
      )
      ON CONFLICT DO NOTHING; -- Skip if somehow already exists
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Successfully migrated images from JSONB to product_files table';
END $$;

-- Comment on table
COMMENT ON TABLE product_files IS 'Stores product media files (images, videos, documents, etc.) with proper indexing and relationships';
COMMENT ON COLUMN product_files.file_type IS 'Type of file: image, video, document, 3d_model, pdf';
COMMENT ON COLUMN product_files.position IS 'Display order of the file (0-based)';
COMMENT ON COLUMN product_files.is_primary IS 'Whether this is the primary/featured file for this product and file_type';
COMMENT ON COLUMN product_files.metadata IS 'Additional metadata: shopify_id, akeneo_code, thumbnails, variants, etc.';
