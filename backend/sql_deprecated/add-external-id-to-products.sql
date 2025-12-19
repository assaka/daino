-- Add external_id and external_source columns to products table
-- This allows tracking products imported from external systems like Shopify, Akeneo, etc.

ALTER TABLE products
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

-- Create index for faster lookups by external_id
CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_id);
CREATE INDEX IF NOT EXISTS idx_products_external_source ON products(external_source);

-- Create composite index for external_id + external_source combination
CREATE INDEX IF NOT EXISTS idx_products_external_id_source ON products(external_id, external_source);

-- Add comment
COMMENT ON COLUMN products.external_id IS 'External system ID (e.g., Shopify product ID, Akeneo product ID)';
COMMENT ON COLUMN products.external_source IS 'Source of external_id (e.g., shopify, akeneo, woocommerce)';
