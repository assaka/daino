-- Create canonical_urls table for managing custom canonical URL mappings
CREATE TABLE IF NOT EXISTS canonical_urls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    page_url VARCHAR(500) NOT NULL,
    canonical_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(store_id, page_url)
);

-- Create indexes for canonical_urls table
CREATE INDEX IF NOT EXISTS idx_canonical_urls_store_id ON canonical_urls(store_id);
CREATE INDEX IF NOT EXISTS idx_canonical_urls_page_url ON canonical_urls(page_url);
CREATE INDEX IF NOT EXISTS idx_canonical_urls_is_active ON canonical_urls(is_active);

-- Create trigger for canonical_urls updated_at timestamp
CREATE TRIGGER update_canonical_urls_updated_at
    BEFORE UPDATE ON canonical_urls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

SELECT 'Canonical URLs table created successfully!' as message;
