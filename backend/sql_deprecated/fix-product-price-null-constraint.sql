-- Migration: Allow null values for product price
-- This fixes the "notNull Violation: Product.price cannot be null" error during Akeneo import

-- Remove the NOT NULL constraint from the price column
ALTER TABLE products ALTER COLUMN price DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN products.price IS 'Product price - can be null for products without pricing information, especially during imports';