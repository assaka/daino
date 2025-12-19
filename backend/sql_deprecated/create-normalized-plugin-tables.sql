-- Create Normalized Plugin Tables
-- These tables support modular plugin architecture with separate code modules

-- 1. plugin_scripts - Store individual code modules/files
CREATE TABLE IF NOT EXISTS plugin_scripts (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) REFERENCES plugin_registry(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  type VARCHAR(50) DEFAULT 'module',
  code TEXT NOT NULL,
  exports JSONB DEFAULT '[]',
  imports JSONB DEFAULT '[]',
  language VARCHAR(50) DEFAULT 'javascript',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, name)
);

-- 2. plugin_dependencies - Store npm packages (bundled code)
CREATE TABLE IF NOT EXISTS plugin_dependencies (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) REFERENCES plugin_registry(id) ON DELETE CASCADE,
  package_name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  code TEXT NOT NULL,
  exports JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, package_name)
);

-- 3. plugin_data - Key-value storage for plugin persistent data
CREATE TABLE IF NOT EXISTS plugin_data (
  id SERIAL PRIMARY KEY,
  plugin_id VARCHAR(255) REFERENCES plugin_registry(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plugin_id, key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plugin_scripts_plugin_id ON plugin_scripts(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_scripts_name ON plugin_scripts(plugin_id, name);
CREATE INDEX IF NOT EXISTS idx_plugin_scripts_order ON plugin_scripts(plugin_id, order_index);
CREATE INDEX IF NOT EXISTS idx_plugin_dependencies_plugin_id ON plugin_dependencies(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_data_plugin_key ON plugin_data(plugin_id, key);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_plugin_scripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_plugin_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_plugin_scripts_updated_at ON plugin_scripts;
CREATE TRIGGER trigger_plugin_scripts_updated_at
  BEFORE UPDATE ON plugin_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_plugin_scripts_updated_at();

DROP TRIGGER IF EXISTS trigger_plugin_data_updated_at ON plugin_data;
CREATE TRIGGER trigger_plugin_data_updated_at
  BEFORE UPDATE ON plugin_data
  FOR EACH ROW
  EXECUTE FUNCTION update_plugin_data_updated_at();

-- Success message
SELECT 'Normalized plugin tables created successfully!' as message;
