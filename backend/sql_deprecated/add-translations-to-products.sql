-- Add translations column to products table
-- This column stores multilingual translations for product names and descriptions

ALTER TABLE products
ADD COLUMN IF NOT EXISTS translations JSON DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN products.translations IS 'Multilingual translations: {"en": {"name": "...", "description": "...", "short_description": "..."}, "es": {...}}';
