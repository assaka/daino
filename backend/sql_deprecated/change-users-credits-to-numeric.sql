-- Migration: Change users.credits from INTEGER to NUMERIC(10,2)
-- This allows storing decimal credit values (e.g., 0.1, 0.5, 1.0)
-- Previously credits were restricted to whole numbers only

-- Step 1: Alter the column type
ALTER TABLE users
ALTER COLUMN credits TYPE NUMERIC(10,2) USING credits::numeric;

-- Step 2: Ensure default is still 0
ALTER TABLE users
ALTER COLUMN credits SET DEFAULT 0.00;

-- Step 3: Add a check constraint to prevent negative credits
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_credits_check;

ALTER TABLE users
ADD CONSTRAINT users_credits_check CHECK (credits >= 0);

-- Verify the change
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name = 'credits';
