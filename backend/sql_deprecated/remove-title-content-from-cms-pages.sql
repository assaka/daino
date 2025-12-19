-- Remove old title and content columns from cms_pages
-- These fields are now stored in the translations JSON column

-- Drop title and content columns from cms_pages
ALTER TABLE cms_pages
DROP COLUMN IF EXISTS title,
DROP COLUMN IF EXISTS content;

-- Same for cms_blocks if needed
ALTER TABLE cms_blocks
DROP COLUMN IF EXISTS title,
DROP COLUMN IF EXISTS content;
