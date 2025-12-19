-- Migration: Consolidate social media and schema settings into single JSON field
-- This migration adds the new social_media_settings column and migrates data from old columns

-- Step 1: Add the new consolidated column
ALTER TABLE seo_settings
ADD COLUMN IF NOT EXISTS social_media_settings JSONB DEFAULT '{
  "open_graph": {
    "enabled": true,
    "default_title": "",
    "default_description": "",
    "default_image_url": "",
    "facebook_app_id": "",
    "facebook_page_url": ""
  },
  "twitter": {
    "enabled": true,
    "card_type": "summary_large_image",
    "site_username": "",
    "creator_username": ""
  },
  "social_profiles": {
    "facebook": "",
    "twitter": "",
    "instagram": "",
    "linkedin": "",
    "youtube": "",
    "pinterest": "",
    "tiktok": "",
    "other": []
  },
  "schema": {
    "enable_product_schema": true,
    "enable_organization_schema": true,
    "enable_breadcrumb_schema": true,
    "organization_name": "",
    "organization_logo_url": "",
    "organization_description": "",
    "contact_type": "customer service",
    "contact_telephone": "",
    "contact_email": "",
    "price_range": "",
    "founded_year": "",
    "founder_name": ""
  }
}'::jsonb;

-- Step 2: Migrate existing data from old columns to new consolidated column
UPDATE seo_settings
SET social_media_settings = jsonb_build_object(
  'open_graph', COALESCE(
    open_graph_settings,
    '{"enabled": true, "default_title": "", "default_description": "", "default_image_url": "", "facebook_app_id": "", "facebook_page_url": ""}'::jsonb
  ),
  'twitter', COALESCE(
    twitter_card_settings,
    '{"enabled": true, "card_type": "summary_large_image", "site_username": "", "creator_username": ""}'::jsonb
  ),
  'social_profiles', COALESCE(
    social_profiles,
    '{"facebook": "", "twitter": "", "instagram": "", "linkedin": "", "youtube": "", "pinterest": "", "tiktok": "", "other": []}'::jsonb
  ),
  'schema', COALESCE(
    schema_settings,
    '{"enable_product_schema": true, "enable_organization_schema": true, "enable_breadcrumb_schema": true, "organization_name": "", "organization_logo_url": "", "organization_description": "", "contact_type": "customer service", "contact_telephone": "", "contact_email": "", "price_range": "", "founded_year": "", "founder_name": ""}'::jsonb
  )
)
WHERE social_media_settings IS NULL
   OR social_media_settings = '{}'::jsonb;

-- Step 3: Drop old columns (commented out for safety - run manually after verifying data migration)
-- ALTER TABLE seo_settings DROP COLUMN IF EXISTS open_graph_settings;
-- ALTER TABLE seo_settings DROP COLUMN IF EXISTS twitter_card_settings;
-- ALTER TABLE seo_settings DROP COLUMN IF EXISTS social_profiles;
-- ALTER TABLE seo_settings DROP COLUMN IF EXISTS schema_settings;

-- Verification query (run this to check migration)
-- SELECT
--   id,
--   store_id,
--   social_media_settings,
--   open_graph_settings,
--   twitter_card_settings,
--   social_profiles,
--   schema_settings
-- FROM seo_settings
-- LIMIT 5;
