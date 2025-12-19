-- Complete migration to rename orders tables and add sales_invoices/sales_shipments
-- This script should be run ONCE on your existing database
-- All data will be preserved during the rename operations

-- IMPORTANT: Run this migration in a transaction so it can be rolled back if needed
BEGIN;

-- Step 1: Create sales_invoices table
-- This table tracks all invoices sent to customers for orders
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(255) UNIQUE NOT NULL,
    order_id UUID NOT NULL,
    store_id UUID NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pdf_generated BOOLEAN DEFAULT false,
    pdf_url TEXT,
    email_status VARCHAR(50) DEFAULT 'sent' CHECK (email_status IN ('sent', 'failed', 'bounced', 'delivered')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- NOTE: Foreign key constraint will be added after table rename
);

-- Create indexes for sales_invoices
CREATE INDEX IF NOT EXISTS idx_sales_invoices_order_id ON sales_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_store_id ON sales_invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_email ON sales_invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_sent_at ON sales_invoices(sent_at);

-- Create trigger for sales_invoices
CREATE OR REPLACE FUNCTION update_sales_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sales_invoices_updated_at_trigger
    BEFORE UPDATE ON sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_invoices_updated_at();

-- Step 2: Create sales_shipments table
-- This table tracks all shipment notifications sent to customers for orders
CREATE TABLE IF NOT EXISTS sales_shipments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_number VARCHAR(255) UNIQUE NOT NULL,
    order_id UUID NOT NULL,
    store_id UUID NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    tracking_number VARCHAR(255),
    tracking_url TEXT,
    carrier VARCHAR(255),
    shipping_method VARCHAR(255),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estimated_delivery_date DATE,
    actual_delivery_date DATE,
    email_status VARCHAR(50) DEFAULT 'sent' CHECK (email_status IN ('sent', 'failed', 'bounced', 'delivered')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- NOTE: Foreign key constraint will be added after table rename
);

-- Create indexes for sales_shipments
CREATE INDEX IF NOT EXISTS idx_sales_shipments_order_id ON sales_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_shipments_store_id ON sales_shipments(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_shipments_customer_email ON sales_shipments(customer_email);
CREATE INDEX IF NOT EXISTS idx_sales_shipments_tracking_number ON sales_shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_sales_shipments_sent_at ON sales_shipments(sent_at);

-- Create trigger for sales_shipments
CREATE OR REPLACE FUNCTION update_sales_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sales_shipments_updated_at_trigger
    BEFORE UPDATE ON sales_shipments
    FOR EACH ROW
    EXECUTE FUNCTION update_sales_shipments_updated_at();

-- Step 3: Rename orders to sales_orders
-- IMPORTANT: This preserves ALL existing data - it's just a rename operation
DO $$
BEGIN
    -- Check if orders table exists and sales_orders doesn't
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders')
       AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_orders') THEN

        -- Drop foreign key constraints that reference orders table
        ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

        -- Rename the orders table to sales_orders
        ALTER TABLE orders RENAME TO sales_orders;

        -- Rename the sequence if it exists
        ALTER SEQUENCE IF EXISTS orders_id_seq RENAME TO sales_orders_id_seq;

        -- Add comment to the table
        COMMENT ON TABLE sales_orders IS 'Stores all sales orders (formerly known as orders table)';

        RAISE NOTICE 'Successfully renamed orders table to sales_orders';
    ELSE
        RAISE NOTICE 'Table orders does not exist or sales_orders already exists - skipping rename';
    END IF;
END $$;

-- Step 4: Rename order_items to sales_order_items
-- IMPORTANT: This preserves ALL existing data - it's just a rename operation
DO $$
BEGIN
    -- Check if order_items table exists and sales_order_items doesn't
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'order_items')
       AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_order_items') THEN

        -- Rename the order_items table to sales_order_items
        ALTER TABLE order_items RENAME TO sales_order_items;

        -- Rename the sequence if it exists
        ALTER SEQUENCE IF EXISTS order_items_id_seq RENAME TO sales_order_items_id_seq;

        -- Add comment to the table
        COMMENT ON TABLE sales_order_items IS 'Stores all line items for sales orders (formerly known as order_items table)';

        RAISE NOTICE 'Successfully renamed order_items table to sales_order_items';
    ELSE
        RAISE NOTICE 'Table order_items does not exist or sales_order_items already exists - skipping rename';
    END IF;
END $$;

-- Step 5: Recreate foreign key constraints with new table names
ALTER TABLE sales_order_items
    DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
    ADD CONSTRAINT sales_order_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE;

-- Step 6: Add foreign key constraints to new tables
ALTER TABLE sales_invoices
    ADD CONSTRAINT sales_invoices_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE;

ALTER TABLE sales_invoices
    ADD CONSTRAINT sales_invoices_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE sales_shipments
    ADD CONSTRAINT sales_shipments_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE;

ALTER TABLE sales_shipments
    ADD CONSTRAINT sales_shipments_store_id_fkey
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

-- Step 7: Verify data migration
DO $$
DECLARE
    orders_count INTEGER;
    items_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orders_count FROM sales_orders;
    SELECT COUNT(*) INTO items_count FROM sales_order_items;

    RAISE NOTICE 'Migration complete!';
    RAISE NOTICE 'Total orders in sales_orders: %', orders_count;
    RAISE NOTICE 'Total items in sales_order_items: %', items_count;
    RAISE NOTICE 'All existing data has been preserved in the renamed tables';
END $$;

-- If everything looks good, commit the transaction
COMMIT;

-- If you need to rollback, run: ROLLBACK;
