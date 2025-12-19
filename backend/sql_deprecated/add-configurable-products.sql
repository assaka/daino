-- Migration: Add Configurable Product Support
-- This migration adds support for Magento-style configurable products

-- Step 1: Add product type column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'simple' CHECK (type IN ('simple', 'configurable', 'bundle', 'grouped', 'virtual', 'downloadable'));

-- Step 2: Add parent_id for product variants (simple products that belong to a configurable)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- Step 3: Add configurable_attributes field to store which attributes are used for configuration
ALTER TABLE products
ADD COLUMN IF NOT EXISTS configurable_attributes JSONB DEFAULT '[]'::jsonb;

-- Step 4: Create product_variants junction table for explicit variant relationships
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_values JSONB DEFAULT '{}'::jsonb, -- stores the specific attribute values for this variant
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(parent_product_id, variant_product_id)
);

-- Step 5: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_parent_id ON products(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_parent ON product_variants(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_variant ON product_variants(variant_product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_attribute_values ON product_variants USING gin(attribute_values);

-- Step 6: Add is_configurable flag to attributes table to mark which attributes can be used for product configuration
ALTER TABLE attributes
ADD COLUMN IF NOT EXISTS is_configurable BOOLEAN DEFAULT false;

-- Step 7: Create index for configurable attributes
CREATE INDEX IF NOT EXISTS idx_attributes_is_configurable ON attributes(is_configurable) WHERE is_configurable = true;

-- Step 8: Add comments for documentation
COMMENT ON COLUMN products.type IS 'Product type: simple, configurable, bundle, grouped, virtual, or downloadable';
COMMENT ON COLUMN products.parent_id IS 'Parent product ID if this is a variant of a configurable product';
COMMENT ON COLUMN products.configurable_attributes IS 'Array of attribute IDs used for configuration (only for configurable products)';
COMMENT ON TABLE product_variants IS 'Junction table linking configurable products with their simple product variants';
COMMENT ON COLUMN product_variants.attribute_values IS 'JSON object mapping attribute codes to values for this variant';
COMMENT ON COLUMN attributes.is_configurable IS 'Whether this attribute can be used for product configuration (e.g., size, color)';
