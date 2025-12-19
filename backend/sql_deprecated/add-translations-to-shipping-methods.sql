-- Add translations column to shipping_methods table
-- This allows storing multilingual shipping method names and descriptions

ALTER TABLE shipping_methods
ADD COLUMN IF NOT EXISTS translations JSON DEFAULT '{}'::json;

-- Add comment to column
COMMENT ON COLUMN shipping_methods.translations IS 'Multilingual translations: {"en": {"name": "...", "description": "..."}, "nl": {...}}';

-- Update existing records to have default English translations from name and description
UPDATE shipping_methods
SET translations = jsonb_build_object(
  'en', jsonb_build_object(
    'name', COALESCE(name, ''),
    'description', COALESCE(description, '')
  )
)::json
WHERE translations IS NULL OR translations::text = '{}'::text;
