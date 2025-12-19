-- Rename orders table to sales_orders and update all references
-- This migration must run AFTER the sales_invoices and sales_shipments tables are created

-- Step 1: Drop foreign key constraints that reference orders table
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_order_id_fkey;
ALTER TABLE sales_shipments DROP CONSTRAINT IF EXISTS sales_shipments_order_id_fkey;

-- Step 2: Rename the orders table to sales_orders
ALTER TABLE orders RENAME TO sales_orders;

-- Step 3: Rename the sequence if it exists
ALTER SEQUENCE IF EXISTS orders_id_seq RENAME TO sales_orders_id_seq;

-- Step 4: Recreate foreign key constraints with new table name
ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE;

ALTER TABLE sales_invoices
    ADD CONSTRAINT sales_invoices_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE;

ALTER TABLE sales_shipments
    ADD CONSTRAINT sales_shipments_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE;

-- Step 5: Update any indexes (they should be automatically renamed, but let's ensure consistency)
-- The indexes will be automatically renamed by PostgreSQL when the table is renamed
-- But we can verify/update them if needed

-- Add comment to the table
COMMENT ON TABLE sales_orders IS 'Stores all sales orders (formerly known as orders table)';
