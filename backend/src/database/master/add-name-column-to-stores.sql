-- Migration: Add name column to stores table
-- Run this on existing master databases

-- Add name column if it doesn't exist
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT 'My Store';

-- Set name to match slug for existing stores (converted to title case)
UPDATE stores
SET name = INITCAP(REPLACE(slug, '-', ' '))
WHERE name IS NULL OR name = 'My Store';

-- Make name NOT NULL after populating
ALTER TABLE stores
ALTER COLUMN name SET NOT NULL;
