-- Create sales_shipments table
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_sales_shipments_order_id ON sales_shipments(order_id);
CREATE INDEX idx_sales_shipments_store_id ON sales_shipments(store_id);
CREATE INDEX idx_sales_shipments_customer_email ON sales_shipments(customer_email);
CREATE INDEX idx_sales_shipments_tracking_number ON sales_shipments(tracking_number);
CREATE INDEX idx_sales_shipments_sent_at ON sales_shipments(sent_at);

-- Trigger to update updated_at timestamp
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
