-- Create a table to store API keys per project
CREATE TABLE IF NOT EXISTS supabase_project_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    project_id VARCHAR(255) NOT NULL,
    project_url TEXT NOT NULL,
    anon_key TEXT,
    service_role_key TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, project_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_supabase_project_keys_store_project 
ON supabase_project_keys(store_id, project_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_supabase_project_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_supabase_project_keys_updated_at ON supabase_project_keys;
CREATE TRIGGER update_supabase_project_keys_updated_at
    BEFORE UPDATE ON supabase_project_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_supabase_project_keys_updated_at();