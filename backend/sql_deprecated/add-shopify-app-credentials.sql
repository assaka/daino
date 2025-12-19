-- Add columns to store Shopify app credentials per store
ALTER TABLE shopify_oauth_tokens 
ADD COLUMN IF NOT EXISTS client_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS client_secret TEXT,
ADD COLUMN IF NOT EXISTS redirect_uri TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopify_oauth_tokens_client_id ON shopify_oauth_tokens(client_id);

-- Update the updated_at trigger to handle new columns
-- (trigger already exists from initial migration)