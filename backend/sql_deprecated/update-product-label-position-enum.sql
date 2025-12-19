-- Migration to update product_labels position enum to support all 8 positions
-- Run this in Supabase SQL editor

-- Step 1: Change the column to VARCHAR temporarily to bypass enum constraint
ALTER TABLE product_labels
ALTER COLUMN position TYPE VARCHAR(20);

-- Step 2: Drop the old enum type
DROP TYPE IF EXISTS enum_product_labels_position CASCADE;

-- Step 3: Create the new enum with all 8 positions
CREATE TYPE enum_product_labels_position AS ENUM (
  'top-left',
  'top-right',
  'top-center',
  'center-left',
  'center-right',
  'bottom-left',
  'bottom-right',
  'bottom-center'
);

-- Step 4: Convert the column back to the enum type
ALTER TABLE product_labels
ALTER COLUMN position TYPE enum_product_labels_position
USING position::enum_product_labels_position;

-- Step 5: Set default to top-right (most common position)
ALTER TABLE product_labels
ALTER COLUMN position SET DEFAULT 'top-right'::enum_product_labels_position;

-- Verify the changes
SELECT DISTINCT position FROM product_labels ORDER BY position;