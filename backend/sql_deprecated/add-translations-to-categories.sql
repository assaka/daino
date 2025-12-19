-- Add translations column to categories table
-- This column stores multilingual translations for category names and descriptions

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS translations JSON DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN categories.translations IS 'Multilingual translations: {"en": {"name": "...", "description": "..."}, "es": {...}}';
