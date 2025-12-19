-- Add customer blocking fields to customers table
-- This allows administrators to block/disable customer accounts

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;

-- Add index for faster lookups of blocked customers
CREATE INDEX IF NOT EXISTS idx_customers_is_blocked ON customers(is_blocked);

-- Add comment to document the purpose
COMMENT ON COLUMN customers.is_blocked IS 'Indicates if the customer account is blocked/disabled';
COMMENT ON COLUMN customers.blocked_reason IS 'Optional reason for blocking the customer';
COMMENT ON COLUMN customers.blocked_at IS 'Timestamp when the customer was blocked';
