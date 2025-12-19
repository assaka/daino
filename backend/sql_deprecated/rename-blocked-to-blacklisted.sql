-- Rename customer blocking fields to blacklist terminology
-- This updates the customers table to use blacklist naming convention

-- Rename columns
ALTER TABLE customers
RENAME COLUMN is_blocked TO is_blacklisted;

ALTER TABLE customers
RENAME COLUMN blocked_reason TO blacklist_reason;

ALTER TABLE customers
RENAME COLUMN blocked_at TO blacklisted_at;

-- Update comments
COMMENT ON COLUMN customers.is_blacklisted IS 'Indicates if the customer account is blacklisted';
COMMENT ON COLUMN customers.blacklist_reason IS 'Optional reason for blacklisting the customer';
COMMENT ON COLUMN customers.blacklisted_at IS 'Timestamp when the customer was blacklisted';

-- Update the index name
DROP INDEX IF EXISTS idx_customers_is_blocked;
CREATE INDEX IF NOT EXISTS idx_customers_is_blacklisted ON customers(is_blacklisted);
