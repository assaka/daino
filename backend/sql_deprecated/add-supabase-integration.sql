-- Add Supabase to integration_type enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'supabase' 
        AND enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'enum_integration_configs_integration_type'
        )
    ) THEN
        ALTER TYPE enum_integration_configs_integration_type ADD VALUE 'supabase';
    END IF;
END $$;

-- Create supabase_oauth_tokens table for storing OAuth tokens
CREATE TABLE IF NOT EXISTS supabase_oauth_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    project_url TEXT NOT NULL,
    anon_key TEXT NOT NULL,
    service_role_key TEXT,
    database_url TEXT,
    storage_url TEXT,
    auth_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_supabase_oauth_tokens_store_id ON supabase_oauth_tokens(store_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_supabase_oauth_tokens_updated_at
    BEFORE UPDATE ON supabase_oauth_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();