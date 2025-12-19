-- Add connection status fields to integration_configs table
-- This allows persistent connection status that survives page reloads

ALTER TABLE integration_configs 
ADD COLUMN IF NOT EXISTS connection_status VARCHAR(20) DEFAULT 'untested' CHECK (connection_status IN ('untested', 'success', 'failed')),
ADD COLUMN IF NOT EXISTS connection_tested_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS connection_error TEXT;

-- Create index for faster connection status queries
CREATE INDEX IF NOT EXISTS idx_integration_configs_connection_status 
ON integration_configs(store_id, integration_type, connection_status);

-- Update existing records to have 'untested' status if they don't have one
UPDATE integration_configs 
SET connection_status = 'untested' 
WHERE connection_status IS NULL;