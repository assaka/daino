-- ============================================
-- MASTER DATABASE - Add Metadata Columns
-- ============================================
-- Run this on your MASTER Supabase database
-- Adds metadata JSONB columns for grace period tracking

-- Add metadata column to stores table (for credit grace period)
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add metadata column to custom_domains_lookup table (for domain grace period)
ALTER TABLE custom_domains_lookup
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for querying stores in grace period
CREATE INDEX IF NOT EXISTS idx_stores_metadata_grace_period
ON stores USING gin ((metadata->'credit_grace_period_start'));

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('stores', 'custom_domains_lookup')
AND column_name = 'metadata';
