-- ============================================
-- Add slug column to master stores table
-- For storefront routing by slug
-- ============================================

-- Add slug column
ALTER TABLE stores ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Make slug unique (for fast routing lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- Add index for active stores with slug (most common query)
CREATE INDEX IF NOT EXISTS idx_stores_slug_active ON stores(slug, is_active) WHERE is_active = true AND slug IS NOT NULL;

-- Comments
COMMENT ON COLUMN stores.slug IS 'Store slug for routing (duplicated from tenant DB for fast lookups)';
