-- ============================================
-- Fix CMS Translation Tables Primary Keys
-- ============================================
--
-- PROBLEM: Translation tables have single-column primary keys which only
-- allows ONE translation per block/page. Should be composite keys to allow
-- multiple languages.
--
-- This migration:
-- 1. Drops existing incorrect primary keys
-- 2. Creates composite primary keys (entity_id, language_code)
-- 3. Removes incorrect DEFAULT gen_random_uuid() from foreign key columns
-- ============================================

-- Fix cms_block_translations table
-- Step 1: Drop existing primary key
ALTER TABLE cms_block_translations DROP CONSTRAINT IF EXISTS cms_block_translations_pkey;

-- Step 2: Remove incorrect DEFAULT from foreign key column
ALTER TABLE cms_block_translations ALTER COLUMN cms_block_id DROP DEFAULT;

-- Step 3: Add composite primary key
ALTER TABLE cms_block_translations
  ADD CONSTRAINT cms_block_translations_pkey
  PRIMARY KEY (cms_block_id, language_code);

-- Step 4: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_cms_block_translations_block_id
  ON cms_block_translations(cms_block_id);

-- Fix cms_page_translations table
-- Step 1: Drop existing primary key
ALTER TABLE cms_page_translations DROP CONSTRAINT IF EXISTS cms_page_translations_pkey;

-- Step 2: Remove incorrect DEFAULT from foreign key column
ALTER TABLE cms_page_translations ALTER COLUMN cms_page_id DROP DEFAULT;

-- Step 3: Add composite primary key
ALTER TABLE cms_page_translations
  ADD CONSTRAINT cms_page_translations_pkey
  PRIMARY KEY (cms_page_id, language_code);

-- Step 4: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_cms_page_translations_page_id
  ON cms_page_translations(cms_page_id);

-- Verify the changes
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as key_columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('cms_block_translations', 'cms_page_translations')
  AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name;
