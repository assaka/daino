-- Migration: Add custom options and original price to order items
-- This migration adds fields to store custom options and original price before discounts

-- Add selected_options column to store custom options chosen for the product
ALTER TABLE order_items ADD COLUMN selected_options JSON DEFAULT '[]'::json;

-- Add original_price column to store price before discounts
ALTER TABLE order_items ADD COLUMN original_price DECIMAL(10,2);

-- Add comments for clarity
COMMENT ON COLUMN order_items.selected_options IS 'Custom options selected for this order item';
COMMENT ON COLUMN order_items.original_price IS 'Price before any discounts applied';

-- Create index for performance if needed
CREATE INDEX IF NOT EXISTS idx_order_items_original_price ON order_items(original_price);