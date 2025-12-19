-- Add customer_type column to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS customer_type VARCHAR(20) DEFAULT 'guest' NOT NULL;

-- Update existing customers with passwords to 'registered'
UPDATE customers
SET customer_type = 'registered'
WHERE password IS NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_customer_type ON customers(customer_type);

-- Add comment
COMMENT ON COLUMN customers.customer_type IS 'Type of customer: guest (no password) or registered (has password)';
