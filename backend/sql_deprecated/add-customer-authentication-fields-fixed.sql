-- Migration: Add authentication fields to customers table (FIXED VERSION)
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

-- Make first_name and last_name NOT NULL for authentication requirements (skip if they have NULL values)
DO $$
BEGIN
  -- Only set NOT NULL if there are no NULL values
  IF NOT EXISTS (SELECT 1 FROM customers WHERE first_name IS NULL) THEN
    ALTER TABLE customers ALTER COLUMN first_name SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM customers WHERE last_name IS NULL) THEN
    ALTER TABLE customers ALTER COLUMN last_name SET NOT NULL;
  END IF;
END $$;

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

-- Drop the old constraint (not just index) and create new unique constraint on email only
DO $$
BEGIN
  -- Drop the old composite unique constraint if it exists
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
             WHERE constraint_name = 'customers_store_id_email_key' 
             AND table_name = 'customers') THEN
    ALTER TABLE customers DROP CONSTRAINT customers_store_id_email_key;
  END IF;
END $$;

-- Create unique constraint on email only (for customer authentication)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'customers_email_unique' 
                 AND table_name = 'customers') THEN
    ALTER TABLE customers ADD CONSTRAINT customers_email_unique UNIQUE (email);
  END IF;
END $$;

-- Add support for customer addresses in addresses table
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS customer_id UUID;

-- Add foreign key constraint for customer_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'fk_addresses_customer_id' 
                 AND table_name = 'addresses') THEN
    ALTER TABLE addresses ADD CONSTRAINT fk_addresses_customer_id 
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make user_id optional in addresses table since we can have customer_id instead
ALTER TABLE addresses ALTER COLUMN user_id DROP NOT NULL;

-- Add check constraint to ensure either user_id or customer_id is present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'chk_addresses_user_or_customer' 
                 AND table_name = 'addresses') THEN
    ALTER TABLE addresses ADD CONSTRAINT chk_addresses_user_or_customer 
      CHECK ((user_id IS NOT NULL AND customer_id IS NULL) OR (user_id IS NULL AND customer_id IS NOT NULL));
  END IF;
END $$;

-- Create index on customer_id for better performance
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON addresses(customer_id);

-- Create index for customer authentication
CREATE INDEX IF NOT EXISTS idx_customers_email_active ON customers(email, is_active);

-- Add comments for documentation
COMMENT ON COLUMN customers.password IS 'Hashed password for customer authentication';
COMMENT ON COLUMN customers.role IS 'Always customer for this table';
COMMENT ON COLUMN customers.account_type IS 'Always individual for customers';
COMMENT ON COLUMN customers.email_verified IS 'Whether customer email has been verified';
COMMENT ON COLUMN addresses.customer_id IS 'Foreign key to customers table for customer addresses';