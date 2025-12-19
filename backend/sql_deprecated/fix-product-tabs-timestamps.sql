-- Fix product_tabs created_at and updated_at to have DEFAULT NOW()
-- This ensures inserts without explicit timestamps don't fail

ALTER TABLE product_tabs
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

SELECT 'Fixed product_tabs timestamp defaults' as message;
