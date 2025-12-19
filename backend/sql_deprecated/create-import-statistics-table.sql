-- Create akeneo_import_statistics table to track Akeneo import results
CREATE TABLE IF NOT EXISTS akeneo_import_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    import_type VARCHAR(50) NOT NULL, -- 'categories', 'attributes', 'families', 'products'
    import_date TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Import results
    total_processed INTEGER NOT NULL DEFAULT 0,
    successful_imports INTEGER NOT NULL DEFAULT 0,
    failed_imports INTEGER NOT NULL DEFAULT 0,
    skipped_imports INTEGER NOT NULL DEFAULT 0,
    
    -- Additional metadata
    import_source VARCHAR(100) DEFAULT 'akeneo',
    import_method VARCHAR(50) DEFAULT 'manual', -- 'manual', 'scheduled', 'webhook'
    error_details TEXT,
    processing_time_seconds INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_akeneo_import_statistics_store_id ON akeneo_import_statistics(store_id);
CREATE INDEX IF NOT EXISTS idx_akeneo_import_statistics_type ON akeneo_import_statistics(import_type);
CREATE INDEX IF NOT EXISTS idx_akeneo_import_statistics_date ON akeneo_import_statistics(import_date DESC);
CREATE INDEX IF NOT EXISTS idx_akeneo_import_statistics_store_type ON akeneo_import_statistics(store_id, import_type);

-- Create a unique index to prevent duplicate stats for the same import session
CREATE INDEX IF NOT EXISTS idx_akeneo_import_statistics_unique ON akeneo_import_statistics(store_id, import_type, import_date);