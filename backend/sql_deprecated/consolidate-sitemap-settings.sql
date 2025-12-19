-- Consolidate XML and HTML sitemap settings into JSON columns
-- This follows the existing pattern in the codebase (schema_settings, open_graph_settings, etc.)

-- Step 1: Add new JSON columns
ALTER TABLE seo_settings
  ADD COLUMN IF NOT EXISTS xml_sitemap_settings JSONB DEFAULT '{"enabled": true, "include_products": true, "include_categories": true, "include_pages": true, "include_images": false, "include_videos": false, "enable_news": false, "enable_index": false, "max_urls": 50000, "google_search_console_api_key": "", "auto_submit": false, "category_priority": "0.8", "category_changefreq": "weekly", "product_priority": "0.7", "product_changefreq": "daily", "page_priority": "0.6", "page_changefreq": "monthly"}',
  ADD COLUMN IF NOT EXISTS html_sitemap_settings JSONB DEFAULT '{"enabled": true, "include_products": true, "include_categories": true, "include_pages": true, "max_products": 20, "product_sort": "-updated_date"}';

-- Step 2: Migrate existing data from individual columns to JSON columns
UPDATE seo_settings
SET
  xml_sitemap_settings = jsonb_build_object(
    'enabled', COALESCE(enable_sitemap, true),
    'include_products', COALESCE(sitemap_include_products, true),
    'include_categories', COALESCE(sitemap_include_categories, true),
    'include_pages', COALESCE(sitemap_include_pages, true),
    'include_images', false,
    'include_videos', false,
    'enable_news', false,
    'enable_index', false,
    'max_urls', 50000,
    'google_search_console_api_key', '',
    'auto_submit', false,
    'category_priority', '0.8',
    'category_changefreq', 'weekly',
    'product_priority', '0.7',
    'product_changefreq', 'daily',
    'page_priority', '0.6',
    'page_changefreq', 'monthly'
  ),
  html_sitemap_settings = jsonb_build_object(
    'enabled', COALESCE(enable_html_sitemap, true),
    'include_products', COALESCE(html_sitemap_include_products, true),
    'include_categories', COALESCE(html_sitemap_include_categories, true),
    'include_pages', COALESCE(html_sitemap_include_pages, true),
    'max_products', COALESCE(html_sitemap_max_products, 20),
    'product_sort', COALESCE(html_sitemap_product_sort, '-updated_date')
  );

-- Step 3: Drop old individual columns (keeping enable_sitemap for backward compatibility during transition)
-- We'll keep enable_sitemap as a top-level field since it's commonly referenced
-- But remove the granular settings that are now in JSON

ALTER TABLE seo_settings
  DROP COLUMN IF EXISTS sitemap_include_products,
  DROP COLUMN IF EXISTS sitemap_include_categories,
  DROP COLUMN IF EXISTS sitemap_include_pages,
  DROP COLUMN IF EXISTS enable_html_sitemap,
  DROP COLUMN IF EXISTS html_sitemap_include_products,
  DROP COLUMN IF EXISTS html_sitemap_include_categories,
  DROP COLUMN IF EXISTS html_sitemap_include_pages,
  DROP COLUMN IF EXISTS html_sitemap_max_products,
  DROP COLUMN IF EXISTS html_sitemap_product_sort;

-- Create indexes for JSON columns
CREATE INDEX IF NOT EXISTS idx_seo_settings_xml_sitemap ON seo_settings USING GIN (xml_sitemap_settings);
CREATE INDEX IF NOT EXISTS idx_seo_settings_html_sitemap ON seo_settings USING GIN (html_sitemap_settings);

SELECT 'Sitemap settings consolidated into JSON columns successfully!' as message;
