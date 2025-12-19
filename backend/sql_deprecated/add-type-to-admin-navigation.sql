-- Add type column to admin_navigation_registry
-- Allows marking items as 'standard', 'premium', 'coming_soon', 'beta', etc.

ALTER TABLE admin_navigation_registry
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'standard';

-- Add a check constraint to ensure valid types
ALTER TABLE admin_navigation_registry
ADD CONSTRAINT chk_navigation_type
CHECK (type IN ('standard', 'premium', 'coming_soon', 'beta', 'new'));

-- Add an index for better query performance
CREATE INDEX IF NOT EXISTS idx_navigation_registry_type ON admin_navigation_registry(type);

COMMENT ON COLUMN admin_navigation_registry.type IS 'Navigation item type: standard, premium, coming_soon, beta, or new';
