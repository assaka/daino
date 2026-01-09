-- Migration: Add profile columns to stores table and 'demo' status
-- Run this on existing master databases
-- These columns store profile data collected during onboarding step 1

-- Add country column (ISO 2-letter code)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS country VARCHAR(2);

-- Add phone column
ALTER TABLE stores ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Add store email column
ALTER TABLE stores ADD COLUMN IF NOT EXISTS store_email VARCHAR(255);

-- Index for country lookups (useful for regional reporting)
CREATE INDEX IF NOT EXISTS idx_stores_country ON stores(country);

-- Update status CHECK constraint to include 'demo' status
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_status_check;
ALTER TABLE stores ADD CONSTRAINT stores_status_check CHECK (status IN (
  'pending_database',
  'provisioning',
  'provisioned',
  'active',
  'demo',
  'suspended',
  'inactive'
));
