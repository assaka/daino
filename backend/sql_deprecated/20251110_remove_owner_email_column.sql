-- Migration: Remove owner_email column from stores table
-- Date: 2025-11-10
-- Description: Removes deprecated owner_email column after code migration to user_id is complete

-- Note: This migration should only be run AFTER the following code changes have been deployed:
-- 1. AuthMiddleware.jsx updated to use user_id
-- 2. Stores.jsx updated to use user_id
-- 3. seed-sample-data.js updated to use user_id
-- 4. store entity definition updated to remove owner_email

-- Remove owner_email column (deprecated in favor of user_id)
ALTER TABLE stores DROP COLUMN IF EXISTS owner_email;

-- Verify that user_id column exists and is properly set up
-- (This is just a check - the column should already exist from previous migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'ERROR: user_id column does not exist in stores table. Migration cannot proceed.';
  END IF;
END $$;
