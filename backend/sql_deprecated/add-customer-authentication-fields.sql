-- Migration: Add authentication fields to customers table
-- Date: 2025-01-28
-- Description: Add password, authentication and security fields to customers table for separate customer authentication

-- Add password field for authentication
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Add avatar_url field
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);

-- Add authentication tracking fields
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;

-- Add role and account_type fields (with defaults)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'individual';

-- Make first_name and last_name NOT NULL for authentication requirements
ALTER TABLE customers ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE customers ALTER COLUMN last_name SET NOT NULL;

-- Make store_id optional since customers can exist without being tied to a specific store
ALTER TABLE customers ALTER COLUMN store_id DROP NOT NULL;

-- Update existing customers to have default values
UPDATE customers SET 
  role = 'customer',
  account_type = 'individual',
  email_verified = FALSE
WHERE role IS NULL OR account_type IS NULL;

-- Create index on email for faster authentication lookups
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Add constraint to ensure email uniqueness for customers
DROP INDEX IF EXISTS customers_store_id_email_key; -- Remove old composite unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique ON customers(email);

-- Add support for customer addresses in addresses table
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE addresses ADD CONSTRAINT fk_addresses_customer_id 
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- Make user_id optional in addresses table since we can have customer_id instead
ALTER TABLE addresses ALTER COLUMN user_id DROP NOT NULL;

-- Add check constraint to ensure either user_id or customer_id is present
ALTER TABLE addresses ADD CONSTRAINT chk_addresses_user_or_customer 
  CHECK ((user_id IS NOT NULL AND customer_id IS NULL) OR (user_id IS NULL AND customer_id IS NOT NULL));

-- Create index on customer_id for better performance
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON addresses(customer_id);

-- Create index for customer authentication
CREATE INDEX IF NOT EXISTS idx_customers_email_active ON customers(email, is_active);

COMMENT ON COLUMN customers.password IS 'Hashed password for customer authentication';
COMMENT ON COLUMN customers.role IS 'Always customer for this table';
COMMENT ON COLUMN customers.account_type IS 'Always individual for customers';
COMMENT ON COLUMN customers.email_verified IS 'Whether customer email has been verified';
COMMENT ON COLUMN addresses.customer_id IS 'Foreign key to customers table for customer addresses';