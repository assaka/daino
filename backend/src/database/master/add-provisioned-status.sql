-- Migration: Add 'provisioned' status to stores table
-- Run this on existing master databases
-- The 'provisioned' status indicates DB is ready but profile/country not yet completed

-- First, check what status values exist (run this SELECT first to see current values):
-- SELECT DISTINCT status FROM stores;

-- Fix any invalid status values before adding constraint
-- Map old/invalid statuses to valid ones
UPDATE stores SET status = 'pending_database' WHERE status = 'pending';
UPDATE stores SET status = 'active' WHERE status NOT IN (
  'pending_database', 'provisioning', 'provisioned', 'active', 'suspended', 'inactive'
) AND status IS NOT NULL;

-- Drop the old constraint and create a new one with 'provisioned' status
ALTER TABLE stores
DROP CONSTRAINT IF EXISTS stores_status_check;

ALTER TABLE stores
ADD CONSTRAINT stores_status_check CHECK (status IN (
  'pending_database',  -- Waiting for DB connection
  'provisioning',      -- Creating tenant DB
  'provisioned',       -- DB ready, awaiting profile completion (step 3)
  'active',           -- Fully operational
  'suspended',        -- Temporarily disabled
  'inactive'          -- Permanently disabled
));

-- Update any stores that are 'active' but don't have country set to 'provisioned'
-- This helps identify stores that skipped the profile step
-- (Optional - uncomment if needed)
-- UPDATE stores s
-- SET status = 'provisioned'
-- WHERE s.status = 'active'
--   AND NOT EXISTS (
--     SELECT 1 FROM store_databases sd
--     WHERE sd.store_id = s.id
--     AND sd.is_active = true
--   );
