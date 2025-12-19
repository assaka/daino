-- =====================================================
-- ADD REDIRECT COLUMNS TO CUSTOM DOMAINS TABLES
-- =====================================================
-- Purpose: Support www/non-www domain redirects
-- Run this on both master and tenant databases

-- Add to tenant custom_domains table
ALTER TABLE custom_domains
ADD COLUMN IF NOT EXISTS is_redirect BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS redirect_to VARCHAR(255);

-- Add index for redirect domains
CREATE INDEX IF NOT EXISTS idx_custom_domains_is_redirect ON custom_domains(is_redirect) WHERE is_redirect = true;

COMMENT ON COLUMN custom_domains.is_redirect IS 'Whether this domain redirects to another domain';
COMMENT ON COLUMN custom_domains.redirect_to IS 'Target domain to redirect to (e.g., example.com redirects to www.example.com)';

-- =====================================================
-- For Master DB: custom_domains_lookup table
-- Run this separately on master database
-- =====================================================

-- ALTER TABLE custom_domains_lookup
-- ADD COLUMN IF NOT EXISTS is_redirect BOOLEAN DEFAULT false,
-- ADD COLUMN IF NOT EXISTS redirect_to VARCHAR(255);
--
-- CREATE INDEX IF NOT EXISTS idx_custom_domains_lookup_redirect ON custom_domains_lookup(is_redirect, redirect_to) WHERE is_redirect = true;
--
-- COMMENT ON COLUMN custom_domains_lookup.is_redirect IS 'Whether this domain redirects to another domain';
-- COMMENT ON COLUMN custom_domains_lookup.redirect_to IS 'Target domain to redirect to';
