-- Create sales_invoices table
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_sales_invoices_order_id ON sales_invoices(order_id);
CREATE INDEX idx_sales_invoices_store_id ON sales_invoices(store_id);
CREATE INDEX idx_sales_invoices_customer_email ON sales_invoices(customer_email);
CREATE INDEX idx_sales_invoices_sent_at ON sales_invoices(sent_at);

-- Trigger to update updated_at timestamp
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
