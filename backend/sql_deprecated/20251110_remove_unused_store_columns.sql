-- Migration: Remove unused columns from stores table
-- Date: 2025-11-10
-- Description: Removes deprecated social media, SEO meta, and deployment automation columns

-- Remove social media columns (never actively used)
ALTER TABLE stores DROP COLUMN IF EXISTS facebook_url;
ALTER TABLE stores DROP COLUMN IF EXISTS twitter_url;
ALTER TABLE stores DROP COLUMN IF EXISTS instagram_url;

-- Remove SEO meta columns (migrated to seo_settings table)
ALTER TABLE stores DROP COLUMN IF EXISTS meta_title;
ALTER TABLE stores DROP COLUMN IF EXISTS meta_description;
ALTER TABLE stores DROP COLUMN IF EXISTS meta_keywords;

-- Remove deployment automation columns (either never implemented or migrated to settings JSONB)
ALTER TABLE stores DROP COLUMN IF EXISTS render_service_id;
ALTER TABLE stores DROP COLUMN IF EXISTS render_service_url;
ALTER TABLE stores DROP COLUMN IF EXISTS auto_supabase_project_id;
ALTER TABLE stores DROP COLUMN IF EXISTS auto_supabase_project_url;
ALTER TABLE stores DROP COLUMN IF EXISTS github_repo_url;

-- Remove associated index for render_service_id
DROP INDEX IF EXISTS idx_stores_render_service_id;

-- Note: owner_email column will be removed in a separate migration after code cleanup
-- is completed in AuthMiddleware.jsx, Stores.jsx, seed-sample-data.js, and store entity
