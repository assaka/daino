-- Update SEO settings table to match frontend entity requirements
-- This migration adds all missing columns that the frontend expects

-- Add new columns to seo_settings table
ALTER TABLE seo_settings
  ADD COLUMN IF NOT EXISTS default_meta_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS default_meta_description TEXT,
  ADD COLUMN IF NOT EXISTS default_meta_keywords TEXT,
  ADD COLUMN IF NOT EXISTS canonical_base_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS robots_txt_content TEXT,
  ADD COLUMN IF NOT EXISTS enable_sitemap BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sitemap_include_products BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sitemap_include_categories BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sitemap_include_pages BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_canonical_filtered_pages BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS hreflang_settings JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS open_graph_settings JSONB DEFAULT '{"default_image_url": "", "facebook_app_id": ""}',
  ADD COLUMN IF NOT EXISTS twitter_card_settings JSONB DEFAULT '{"card_type": "summary_large_image", "site_username": ""}';

-- Update schema_settings default value to match frontend expectations
ALTER TABLE seo_settings 
  ALTER COLUMN schema_settings SET DEFAULT '{"enable_product_schema": true, "enable_organization_schema": true, "organization_name": "", "organization_logo_url": "", "social_profiles": []}';

-- Create redirects table if it doesn't exist
CREATE TABLE IF NOT EXISTS redirects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    from_url VARCHAR(500) NOT NULL,
    to_url VARCHAR(500) NOT NULL,
    type VARCHAR(3) NOT NULL DEFAULT '301' CHECK (type IN ('301', '302')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE(store_id, from_url)
);

-- Create indexes for redirects table
CREATE INDEX IF NOT EXISTS idx_redirects_store_id ON redirects(store_id);
CREATE INDEX IF NOT EXISTS idx_redirects_from_url ON redirects(from_url);
CREATE INDEX IF NOT EXISTS idx_redirects_is_active ON redirects(is_active);

-- Create trigger for redirects
CREATE TRIGGER update_redirects_updated_at BEFORE UPDATE ON redirects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update seo_templates table to match frontend schema
ALTER TABLE seo_templates 
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
  ADD COLUMN IF NOT EXISTS og_title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS og_description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{"categories": [], "attribute_sets": []}';

-- Drop the old unique constraint and create new one for seo_templates
ALTER TABLE seo_templates DROP CONSTRAINT IF EXISTS seo_templates_store_id_page_type_key;
ALTER TABLE seo_templates ADD CONSTRAINT seo_templates_store_id_name_key UNIQUE (store_id, name);

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_seo_settings_canonical_base_url ON seo_settings(canonical_base_url);
CREATE INDEX IF NOT EXISTS idx_seo_settings_enable_sitemap ON seo_settings(enable_sitemap);
CREATE INDEX IF NOT EXISTS idx_seo_templates_type ON seo_templates(type);
CREATE INDEX IF NOT EXISTS idx_seo_templates_sort_order ON seo_templates(sort_order);

SELECT 'SEO settings, templates, and redirects schema updated successfully!' as message;