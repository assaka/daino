-- Create plugin_configurations table for store-specific plugin settings
-- This allows plugins to be installed platform-wide but configured per store

CREATE TABLE IF NOT EXISTS plugin_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign Keys
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Configuration Status
    is_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Store-specific Configuration
    config_data JSONB DEFAULT '{}' NOT NULL,
    
    -- Settings metadata
    last_configured_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_configured_at TIMESTAMP,
    
    -- Status tracking
    enabled_at TIMESTAMP,
    disabled_at TIMESTAMP,
    
    -- Health and monitoring
    last_health_check TIMESTAMP,
    health_status VARCHAR(50),
    error_log TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT unique_plugin_store_config UNIQUE (plugin_id, store_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_store_id ON plugin_configurations(store_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_plugin_id ON plugin_configurations(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_is_enabled ON plugin_configurations(is_enabled);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_health_status ON plugin_configurations(health_status);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_updated_at ON plugin_configurations(updated_at);

-- Comments for documentation
COMMENT ON TABLE plugin_configurations IS 'Store-specific plugin configurations - allows one plugin to be installed platform-wide but configured per store';
COMMENT ON COLUMN plugin_configurations.plugin_id IS 'Reference to the installed plugin';
COMMENT ON COLUMN plugin_configurations.store_id IS 'Reference to the store';
COMMENT ON COLUMN plugin_configurations.is_enabled IS 'Whether this plugin is enabled for this store';
COMMENT ON COLUMN plugin_configurations.config_data IS 'Store-specific configuration values as JSON';
COMMENT ON COLUMN plugin_configurations.last_configured_by IS 'User who last configured this plugin for this store';
COMMENT ON COLUMN plugin_configurations.health_status IS 'Health status for this store: healthy, unhealthy, unknown';

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_plugin_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_plugin_configurations_updated_at ON plugin_configurations;
CREATE TRIGGER update_plugin_configurations_updated_at
    BEFORE UPDATE ON plugin_configurations
    FOR EACH ROW EXECUTE FUNCTION update_plugin_configurations_updated_at();