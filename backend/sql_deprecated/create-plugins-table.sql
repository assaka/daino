-- Create plugins table to track installed plugins
CREATE TABLE IF NOT EXISTS plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    author VARCHAR(255),
    category VARCHAR(100),
    type VARCHAR(50) DEFAULT 'plugin',
    
    -- Installation details
    source_type VARCHAR(50) NOT NULL DEFAULT 'local', -- 'local', 'github', 'marketplace'
    source_url TEXT, -- GitHub URL or marketplace URL
    install_path VARCHAR(500), -- Local filesystem path
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'available', -- 'available', 'installing', 'installed', 'enabled', 'disabled', 'error'
    is_installed BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT FALSE,
    
    -- Configuration
    config_schema JSONB, -- Plugin configuration schema from manifest
    config_data JSONB DEFAULT '{}', -- User configuration values
    
    -- Dependencies and permissions
    dependencies JSONB DEFAULT '[]', -- Required dependencies
    permissions JSONB DEFAULT '[]', -- Required permissions
    
    -- Metadata
    manifest JSONB, -- Full plugin manifest
    installation_log TEXT, -- Installation/error logs
    last_health_check TIMESTAMP,
    health_status VARCHAR(50), -- 'healthy', 'unhealthy', 'unknown'
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    installed_at TIMESTAMP,
    enabled_at TIMESTAMP,
    disabled_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plugins_slug ON plugins(slug);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_plugins_installed ON plugins(is_installed);
CREATE INDEX IF NOT EXISTS idx_plugins_enabled ON plugins(is_enabled);
CREATE INDEX IF NOT EXISTS idx_plugins_category ON plugins(category);
CREATE INDEX IF NOT EXISTS idx_plugins_source_type ON plugins(source_type);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_plugins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_plugins_updated_at
    BEFORE UPDATE ON plugins
    FOR EACH ROW
    EXECUTE FUNCTION update_plugins_updated_at();

COMMENT ON TABLE plugins IS 'Tracks installed and available plugins with their configuration and status';
COMMENT ON COLUMN plugins.source_type IS 'How the plugin was installed: local, github, marketplace';
COMMENT ON COLUMN plugins.status IS 'Current plugin status: available, installing, installed, enabled, disabled, error';
COMMENT ON COLUMN plugins.config_schema IS 'Plugin configuration schema from plugin.json manifest';
COMMENT ON COLUMN plugins.config_data IS 'User-configured values for the plugin';
COMMENT ON COLUMN plugins.manifest IS 'Complete plugin manifest data from plugin.json';