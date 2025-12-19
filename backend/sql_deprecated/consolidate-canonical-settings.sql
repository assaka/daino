-- Migration: Consolidate canonical settings into single JSON column
-- Combines canonical_base_url and auto_canonical_filtered_pages
-- into a single canonical_settings JSON column

-- Step 1: Add new JSON column
ALTER TABLE seo_settings
  ADD COLUMN IF NOT EXISTS canonical_settings JSONB DEFAULT '{"base_url": "", "auto_canonical_filtered_pages": true}'::jsonb;

-- Step 2: Migrate existing data to new JSON structure
UPDATE seo_settings
SET canonical_settings = jsonb_build_object(
  'base_url', COALESCE(canonical_base_url, ''),
  'auto_canonical_filtered_pages', COALESCE(auto_canonical_filtered_pages, true)
)
WHERE canonical_settings IS NULL OR canonical_settings = '{}'::jsonb;

-- Step 3: Drop old individual columns
ALTER TABLE seo_settings
  DROP COLUMN IF EXISTS canonical_base_url,
  DROP COLUMN IF EXISTS auto_canonical_filtered_pages;

-- Step 4: Add comment
COMMENT ON COLUMN seo_settings.canonical_settings IS 'Consolidated canonical URL settings including base URL and auto-canonical configuration';
