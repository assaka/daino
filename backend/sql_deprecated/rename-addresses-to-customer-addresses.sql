-- Rename addresses table to customer_addresses
-- This migration renames the addresses table to customer_addresses for clarity

-- Rename the table
ALTER TABLE addresses RENAME TO customer_addresses;

-- Update any indexes that reference the table name
-- (PostgreSQL automatically updates indexes, constraints, and sequences)

-- Note: This migration does not affect foreign key constraints or references
-- as they are automatically updated by PostgreSQL when renaming tables

-- Update comment on the customer_id column to reflect new table name
COMMENT ON COLUMN customer_addresses.customer_id IS 'Foreign key to customers table for customer addresses';
