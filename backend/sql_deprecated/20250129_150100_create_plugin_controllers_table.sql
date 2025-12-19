-- =====================================================
-- MIGRATION: Create plugin_controllers table
-- =====================================================
-- Plugin: Core Platform (00000000-0000-0000-0000-000000000000)
-- Version: 20250129_150100
-- Description: Create plugin_controllers table for storing API endpoint definitions
-- =====================================================

-- UP Migration
CREATE TABLE IF NOT EXISTS plugin_controllers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  controller_name VARCHAR(255) NOT NULL,
  description TEXT,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  handler_code TEXT NOT NULL,
  request_schema JSONB,
  response_schema JSONB,
  requires_auth BOOLEAN DEFAULT false,
  allowed_roles JSONB,
  rate_limit INTEGER DEFAULT 100,
  is_enabled BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_plugin_controllers_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,
  CONSTRAINT unique_plugin_controller UNIQUE (plugin_id, method, path),
  CONSTRAINT valid_http_method CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'))
);

CREATE INDEX IF NOT EXISTS idx_plugin_controllers_plugin_id ON plugin_controllers(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_controllers_method_path ON plugin_controllers(method, path);
CREATE INDEX IF NOT EXISTS idx_plugin_controllers_enabled ON plugin_controllers(is_enabled);

COMMENT ON TABLE plugin_controllers IS 'Stores API endpoint/controller definitions for plugins - 100% AI Studio driven';
COMMENT ON COLUMN plugin_controllers.path IS 'Endpoint path relative to /api/plugins/{plugin-slug}/';
COMMENT ON COLUMN plugin_controllers.handler_code IS 'JavaScript function with signature: async (req, res, context) => {}';

-- =====================================================
-- DOWN Migration (Rollback)
-- =====================================================
-- DROP TABLE IF EXISTS plugin_controllers CASCADE;
