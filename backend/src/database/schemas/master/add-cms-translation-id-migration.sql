-- Insert migration to add id column to CMS translation tables
-- Run this on the MASTER database to register the migration
-- Then run migrations via superadmin to apply to all tenant databases

INSERT INTO migrations (version, name, description, sql_up, sql_down)
VALUES (
  4,
  'add_id_to_cms_translations',
  'Add id column to cms_page_translations and cms_block_translations tables for simpler queries',
  $SQL_UP$
-- ============================================================================
-- CMS PAGE TRANSLATIONS
-- ============================================================================

-- Add id column if it doesn't exist
ALTER TABLE cms_page_translations
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Populate id for existing rows that might have NULL
UPDATE cms_page_translations SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id NOT NULL
ALTER TABLE cms_page_translations ALTER COLUMN id SET NOT NULL;

-- Drop existing primary key constraint (composite key)
ALTER TABLE cms_page_translations DROP CONSTRAINT IF EXISTS cms_page_translations_pkey;

-- Add new primary key on id
ALTER TABLE cms_page_translations ADD PRIMARY KEY (id);

-- Ensure unique constraint on (cms_page_id, language_code) still exists
ALTER TABLE cms_page_translations
DROP CONSTRAINT IF EXISTS cms_page_translations_cms_page_id_language_code_key;

ALTER TABLE cms_page_translations
ADD CONSTRAINT cms_page_translations_cms_page_id_language_code_key
UNIQUE (cms_page_id, language_code);

-- ============================================================================
-- CMS BLOCK TRANSLATIONS
-- ============================================================================

-- Add id column if it doesn't exist
ALTER TABLE cms_block_translations
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Populate id for existing rows that might have NULL
UPDATE cms_block_translations SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id NOT NULL
ALTER TABLE cms_block_translations ALTER COLUMN id SET NOT NULL;

-- Drop existing primary key constraint (composite key)
ALTER TABLE cms_block_translations DROP CONSTRAINT IF EXISTS cms_block_translations_pkey;

-- Add new primary key on id
ALTER TABLE cms_block_translations ADD PRIMARY KEY (id);

-- Ensure unique constraint on (cms_block_id, language_code) still exists
ALTER TABLE cms_block_translations
DROP CONSTRAINT IF EXISTS cms_block_translations_cms_block_id_language_code_key;

ALTER TABLE cms_block_translations
ADD CONSTRAINT cms_block_translations_cms_block_id_language_code_key
UNIQUE (cms_block_id, language_code);
$SQL_UP$,
  $SQL_DOWN$
-- Rollback: Remove id column and restore composite primary key

-- CMS PAGE TRANSLATIONS
ALTER TABLE cms_page_translations DROP CONSTRAINT IF EXISTS cms_page_translations_pkey;
ALTER TABLE cms_page_translations DROP CONSTRAINT IF EXISTS cms_page_translations_cms_page_id_language_code_key;
ALTER TABLE cms_page_translations DROP COLUMN IF EXISTS id;
ALTER TABLE cms_page_translations ADD PRIMARY KEY (cms_page_id, language_code);

-- CMS BLOCK TRANSLATIONS
ALTER TABLE cms_block_translations DROP CONSTRAINT IF EXISTS cms_block_translations_pkey;
ALTER TABLE cms_block_translations DROP CONSTRAINT IF EXISTS cms_block_translations_cms_block_id_language_code_key;
ALTER TABLE cms_block_translations DROP COLUMN IF EXISTS id;
ALTER TABLE cms_block_translations ADD PRIMARY KEY (cms_block_id, language_code);
$SQL_DOWN$
)
ON CONFLICT (version) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sql_up = EXCLUDED.sql_up,
  sql_down = EXCLUDED.sql_down;
