-- Rename order_items table to sales_order_items
-- This migration maintains naming consistency with sales_orders

-- Step 1: Rename the order_items table to sales_order_items
ALTER TABLE order_items RENAME TO sales_order_items;

-- Step 2: Rename the sequence if it exists
ALTER SEQUENCE IF EXISTS order_items_id_seq RENAME TO sales_order_items_id_seq;

-- Step 3: Rename indexes (PostgreSQL automatically renames them, but let's be explicit)
-- The indexes will be automatically renamed by PostgreSQL when the table is renamed

-- Add comment to the table
COMMENT ON TABLE sales_order_items IS 'Stores all line items for sales orders (formerly known as order_items table)';
