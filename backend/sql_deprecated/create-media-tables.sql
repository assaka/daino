-- Create media_assets table for tracking files in suprshop-assets bucket
-- This table tracks general media files uploaded via File Library
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_path TEXT NOT NULL, -- Full path in bucket (e.g., library/uuid.pdf)
    file_url TEXT NOT NULL, -- Public URL
    mime_type VARCHAR(100),
    file_size BIGINT, -- Size in bytes
    folder VARCHAR(100) DEFAULT 'library', -- Folder within bucket
    tags TEXT[], -- Array of tags for organization
    description TEXT,
    metadata JSONB DEFAULT '{}', -- Additional metadata
    uploaded_by UUID REFERENCES users(id),
    usage_count INTEGER DEFAULT 0, -- Track how many times file is used
    last_accessed TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, file_path)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_media_assets_store_id ON media_assets(store_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_folder ON media_assets(folder);
CREATE INDEX IF NOT EXISTS idx_media_assets_tags ON media_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_media_assets_updated_at
    BEFORE UPDATE ON media_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_media_updated_at();

-- Add comments for documentation
COMMENT ON TABLE media_assets IS 'Tracks all media files in the suprshop-assets bucket for general store assets and File Library uploads';

COMMENT ON COLUMN media_assets.folder IS 'Folder within the bucket, default is library (replacing old uploads folder)';
COMMENT ON COLUMN media_assets.usage_count IS 'Number of times this asset has been referenced or used';
COMMENT ON COLUMN media_assets.tags IS 'Array of tags for organizing and searching files';