-- Migration: Consolidate default meta settings into single JSON column
-- Combines default_meta_title, default_meta_description, default_meta_keywords, default_meta_robots
-- into a single default_meta_settings JSON column

-- Step 1: Add new JSON column
ALTER TABLE seo_settings
  ADD COLUMN IF NOT EXISTS default_meta_settings JSONB DEFAULT '{"meta_title": "", "meta_description": "", "meta_keywords": "", "meta_robots": "index, follow"}'::jsonb;

-- Step 2: Migrate existing data to new JSON structure
UPDATE seo_settings
SET default_meta_settings = jsonb_build_object(
  'meta_title', COALESCE(default_meta_title, ''),
  'meta_description', COALESCE(default_meta_description, ''),
  'meta_keywords', COALESCE(default_meta_keywords, ''),
  'meta_robots', COALESCE(default_meta_robots, 'index, follow')
)
WHERE default_meta_settings IS NULL OR default_meta_settings = '{}'::jsonb;

-- Step 3: Drop old individual columns
ALTER TABLE seo_settings
  DROP COLUMN IF EXISTS default_meta_title,
  DROP COLUMN IF EXISTS default_meta_description,
  DROP COLUMN IF EXISTS default_meta_keywords,
  DROP COLUMN IF EXISTS default_meta_robots;

-- Step 4: Add comment
COMMENT ON COLUMN seo_settings.default_meta_settings IS 'Consolidated default meta tag settings including title, description, keywords, and robots directive';
