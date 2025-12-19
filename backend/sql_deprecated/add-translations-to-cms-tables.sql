-- Add translations column to cms_pages and cms_blocks tables
-- These columns store multilingual translations for titles and content

-- CMS Pages
ALTER TABLE cms_pages
ADD COLUMN IF NOT EXISTS translations JSON DEFAULT '{}';

COMMENT ON COLUMN cms_pages.translations IS 'Multilingual translations: {"en": {"title": "...", "content": "..."}, "es": {...}}';

-- CMS Blocks
ALTER TABLE cms_blocks
ADD COLUMN IF NOT EXISTS translations JSON DEFAULT '{}';

COMMENT ON COLUMN cms_blocks.translations IS 'Multilingual translations: {"en": {"title": "...", "content": "..."}, "es": {...}}';
