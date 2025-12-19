-- Add public/private status and deprecation fields to plugin_registry table
ALTER TABLE plugin_registry
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deprecation_reason TEXT,
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for querying public plugins
CREATE INDEX IF NOT EXISTS idx_plugin_registry_is_public ON plugin_registry(is_public);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_deprecated ON plugin_registry(deprecated_at);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_creator ON plugin_registry(creator_id);

-- Add comments
COMMENT ON COLUMN plugin_registry.is_public IS 'Whether the plugin is publicly available in the marketplace. Private plugins are only visible to the creator.';
COMMENT ON COLUMN plugin_registry.deprecated_at IS 'Timestamp when the plugin was deprecated (soft delete for public plugins)';
COMMENT ON COLUMN plugin_registry.deprecation_reason IS 'Reason for deprecation provided by the creator';
COMMENT ON COLUMN plugin_registry.creator_id IS 'User who created this plugin';
