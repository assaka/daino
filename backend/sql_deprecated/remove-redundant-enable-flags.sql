-- Migration: Remove redundant enable flags from seo_settings table
-- These flags are now redundant as features are controlled via JSON settings

-- Drop the redundant boolean columns
ALTER TABLE seo_settings
  DROP COLUMN IF EXISTS enable_rich_snippets,
  DROP COLUMN IF EXISTS enable_open_graph,
  DROP COLUMN IF EXISTS enable_twitter_cards,
  DROP COLUMN IF EXISTS enable_sitemap;

-- Drop index if it exists
DROP INDEX IF EXISTS idx_seo_settings_enable_sitemap;

-- Add comment
COMMENT ON TABLE seo_settings IS 'SEO settings for stores. Features like Open Graph, Twitter Cards, and Rich Snippets are now controlled via the social_media_settings and xml_sitemap_settings JSON columns.';
