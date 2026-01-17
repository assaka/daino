-- Add id column to CMS translation tables
-- Previously used composite primary key (cms_page_id/cms_block_id, language_code)
-- Now use id as primary key with unique constraint on composite

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

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN cms_page_translations.id IS 'Primary key - UUID auto-generated';
COMMENT ON COLUMN cms_block_translations.id IS 'Primary key - UUID auto-generated';
