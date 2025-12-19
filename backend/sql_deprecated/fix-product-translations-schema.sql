-- ============================================
-- FIX PRODUCT_TRANSLATIONS TABLE SCHEMA
-- ============================================
-- Problem: product_id is PRIMARY KEY, but we need multiple translations per product
-- Solution: Add id as PRIMARY KEY, make (product_id, language_code) UNIQUE
-- ============================================

-- Drop existing table and recreate with correct schema
DROP TABLE IF EXISTS product_translations CASCADE;

CREATE TABLE product_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  short_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Unique constraint for ON CONFLICT in upsert operations
  UNIQUE(product_id, language_code)
);

-- Add foreign key to products table
ALTER TABLE product_translations
  ADD CONSTRAINT fk_product_translations_product
  FOREIGN KEY (product_id)
  REFERENCES products(id)
  ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_product_translations_product_id ON product_translations(product_id);
CREATE INDEX idx_product_translations_language ON product_translations(language_code);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_product_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_product_translations_updated_at
  BEFORE UPDATE ON product_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_product_translations_updated_at();

COMMENT ON TABLE product_translations IS 'Multilingual translations for product names and descriptions';
COMMENT ON COLUMN product_translations.product_id IS 'Reference to the product being translated';
COMMENT ON COLUMN product_translations.language_code IS 'ISO language code (e.g., en, fr, de)';
