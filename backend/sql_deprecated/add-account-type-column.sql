-- Add account_type column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) DEFAULT 'agency' 
CHECK (account_type IN ('agency', 'individual', 'customer'));

-- Update existing store_owner users to have agency account_type
UPDATE users 
SET account_type = 'agency' 
WHERE role = 'store_owner' AND account_type IS NULL;

-- Update existing customer users to have customer account_type
UPDATE users 
SET account_type = 'customer' 
WHERE role = 'customer' AND account_type IS NULL;