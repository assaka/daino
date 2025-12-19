-- Migration: Add optimized index for custom domain lookups
-- Purpose: Speed up domain → store resolution for custom domain requests
-- Created: 2025-11-03

-- Drop existing index if it exists (to recreate with better configuration)
DROP INDEX IF EXISTS idx_custom_domains_active_lookup;

-- Create partial index for active, verified domains only
-- This makes lookups extremely fast and reduces index size
CREATE INDEX idx_custom_domains_active_lookup
ON custom_domains(domain, store_id)
WHERE is_active = true AND verification_status = 'verified';

-- Add comment
COMMENT ON INDEX idx_custom_domains_active_lookup IS 'Optimized partial index for fast custom domain lookups - only indexes active, verified domains';

-- Analyze table to update statistics
ANALYZE custom_domains;
