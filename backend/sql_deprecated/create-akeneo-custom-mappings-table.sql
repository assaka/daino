-- Create table for storing Akeneo custom field mappings
CREATE TABLE IF NOT EXISTS akeneo_custom_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    mapping_type VARCHAR(50) NOT NULL, -- 'attributes', 'images', 'files'
    mappings JSON NOT NULL DEFAULT '[]', -- Array of mapping configurations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(store_id, mapping_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_akeneo_custom_mappings_store_id ON akeneo_custom_mappings(store_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_akeneo_custom_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_akeneo_custom_mappings_updated_at ON akeneo_custom_mappings;
CREATE TRIGGER update_akeneo_custom_mappings_updated_at
    BEFORE UPDATE ON akeneo_custom_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_akeneo_custom_mappings_updated_at();