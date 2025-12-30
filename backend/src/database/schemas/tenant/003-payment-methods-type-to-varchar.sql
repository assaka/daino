-- Migration: Change payment_methods.type from enum to VARCHAR
-- This allows adding new payment providers (mollie, adyen, etc.) without migrations

-- Step 1: Add a temporary column
ALTER TABLE payment_methods ADD COLUMN type_new VARCHAR(50);

-- Step 2: Copy data from old column to new column
UPDATE payment_methods SET type_new = type::text;

-- Step 3: Drop the old column
ALTER TABLE payment_methods DROP COLUMN type;

-- Step 4: Rename the new column to the original name
ALTER TABLE payment_methods RENAME COLUMN type_new TO type;

-- Step 5: Set default value and NOT NULL constraint
ALTER TABLE payment_methods ALTER COLUMN type SET DEFAULT 'other';
ALTER TABLE payment_methods ALTER COLUMN type SET NOT NULL;

-- Step 6: Optionally drop the enum type if no longer needed elsewhere
-- DROP TYPE IF EXISTS enum_payment_methods_type;
