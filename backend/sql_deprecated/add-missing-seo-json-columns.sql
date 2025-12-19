-- Add Missing SEO JSON Columns Migration
-- Run this in Supabase SQL Editor to fix "column seo does not exist" and "column template does not exist" errors
--
-- This script adds the JSON columns needed after the SEO refactor:
-- 1. seo JSON column to products, categories, cms_pages
-- 2. template JSON column to seo_templates

-- Add seo column to products (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='products' AND column_name='seo'
  ) THEN
    ALTER TABLE products ADD COLUMN seo JSON DEFAULT '{}';
    RAISE NOTICE 'Added seo column to products';
  ELSE
    RAISE NOTICE 'seo column already exists in products';
  END IF;
END $$;

-- Add seo column to categories (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='categories' AND column_name='seo'
  ) THEN
    ALTER TABLE categories ADD COLUMN seo JSON DEFAULT '{}';
    RAISE NOTICE 'Added seo column to categories';
  ELSE
    RAISE NOTICE 'seo column already exists in categories';
  END IF;
END $$;

-- Add seo column to cms_pages (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='cms_pages' AND column_name='seo'
  ) THEN
    ALTER TABLE cms_pages ADD COLUMN seo JSON DEFAULT '{}';
    RAISE NOTICE 'Added seo column to cms_pages';
  ELSE
    RAISE NOTICE 'seo column already exists in cms_pages';
  END IF;
END $$;

-- Add template column to seo_templates (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='seo_templates' AND column_name='template'
  ) THEN
    ALTER TABLE seo_templates ADD COLUMN template JSON DEFAULT '{}';
    RAISE NOTICE 'Added template column to seo_templates';
  ELSE
    RAISE NOTICE 'template column already exists in seo_templates';
  END IF;
END $$;

-- Verify columns were added
SELECT
  'products' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'seo'

UNION ALL

SELECT
  'categories' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'categories' AND column_name = 'seo'

UNION ALL

SELECT
  'cms_pages' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'cms_pages' AND column_name = 'seo'

UNION ALL

SELECT
  'seo_templates' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'seo_templates' AND column_name = 'template';
