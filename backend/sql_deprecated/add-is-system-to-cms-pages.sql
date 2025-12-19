-- Add is_system column to cms_pages table
-- System pages (like 404 pages) cannot be deleted from the admin panel

ALTER TABLE cms_pages
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Mark existing 404 pages as system pages
UPDATE cms_pages
SET is_system = true
WHERE slug IN ('404', 'not-found', 'page-not-found')
  AND is_system IS NOT true;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cms_pages_is_system ON cms_pages(is_system);

-- Add comment to the column
COMMENT ON COLUMN cms_pages.is_system IS 'System pages cannot be deleted from admin panel. Used for critical pages like 404, maintenance, etc.';
