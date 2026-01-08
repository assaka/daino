-- Migration: Add 'provisioned' status to stores table
-- Run this on existing master databases
-- The 'provisioned' status indicates DB is ready but profile/country not yet completed

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
