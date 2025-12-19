-- Migration: Add plugin_admin_pages and plugin_admin_scripts tables
-- Purpose: Separate admin-only plugin content from frontend plugins for performance
-- Frontend plugins (plugin_scripts) load on every page - must be lightweight
-- Admin plugins load only in admin panel - can be heavy

-- ============================================================
-- Table: plugin_admin_pages
-- Purpose: Store admin UI page components (React components)
-- ============================================================
CREATE TABLE IF NOT EXISTS plugin_admin_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255) NOT NULL,  -- Matches plugin_scripts.plugin_id format

  -- Page identification
  page_key VARCHAR(255) NOT NULL, -- e.g., 'chat-support'
  page_name VARCHAR(255) NOT NULL, -- e.g., 'Chat Support'
  route VARCHAR(500) NOT NULL, -- e.g., '/admin/chat-support'

  -- React component code
  component_code TEXT NOT NULL,

  -- Metadata
  description TEXT,
  icon VARCHAR(100), -- Lucide icon name
  category VARCHAR(100), -- e.g., 'main', 'tools', 'settings'
  order_position INTEGER DEFAULT 100,

  -- State
  is_enabled BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure unique page keys per plugin
  UNIQUE(plugin_id, page_key),
  UNIQUE(route)
);

CREATE INDEX idx_plugin_admin_pages_plugin ON plugin_admin_pages(plugin_id);
CREATE INDEX idx_plugin_admin_pages_enabled ON plugin_admin_pages(is_enabled);
CREATE INDEX idx_plugin_admin_pages_route ON plugin_admin_pages(route);

COMMENT ON TABLE plugin_admin_pages IS 'Admin UI page components - loaded only in admin panel';
COMMENT ON COLUMN plugin_admin_pages.component_code IS 'Full React component code for the admin page';
COMMENT ON COLUMN plugin_admin_pages.route IS 'Admin route path for this page';

-- ============================================================
-- Table: plugin_admin_scripts
-- Purpose: Store admin-only JavaScript utilities and helpers
-- ============================================================
CREATE TABLE IF NOT EXISTS plugin_admin_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255) NOT NULL,  -- Matches plugin_scripts.plugin_id format

  -- Script identification
  script_name VARCHAR(255) NOT NULL, -- e.g., 'chat-api-helper.js'

  -- JavaScript code
  script_code TEXT NOT NULL,

  -- Metadata
  description TEXT,
  load_order INTEGER DEFAULT 100, -- Lower numbers load first

  -- State
  is_enabled BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Ensure unique script names per plugin
  UNIQUE(plugin_id, script_name)
);

CREATE INDEX idx_plugin_admin_scripts_plugin ON plugin_admin_scripts(plugin_id);
CREATE INDEX idx_plugin_admin_scripts_enabled ON plugin_admin_scripts(is_enabled);
CREATE INDEX idx_plugin_admin_scripts_order ON plugin_admin_scripts(load_order);

COMMENT ON TABLE plugin_admin_scripts IS 'Admin-only JavaScript utilities - loaded only in admin panel';
COMMENT ON COLUMN plugin_admin_scripts.script_code IS 'JavaScript code for admin utilities';
COMMENT ON COLUMN plugin_admin_scripts.load_order IS 'Lower numbers load first (dependencies)';

-- ============================================================
-- Update triggers for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_plugin_admin_pages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plugin_admin_pages_updated_at
BEFORE UPDATE ON plugin_admin_pages
FOR EACH ROW
EXECUTE FUNCTION update_plugin_admin_pages_timestamp();

CREATE OR REPLACE FUNCTION update_plugin_admin_scripts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER plugin_admin_scripts_updated_at
BEFORE UPDATE ON plugin_admin_scripts
FOR EACH ROW
EXECUTE FUNCTION update_plugin_admin_scripts_timestamp();

-- ============================================================
-- Performance notes:
-- ============================================================
-- Frontend (plugin_scripts): Loads on EVERY page load
--   - Keep minimal: only essential customer-facing features
--   - Examples: chat widget, tracking pixels, frontend hooks
--
-- Admin (plugin_admin_pages/scripts): Loads ONLY in admin
--   - Can be heavy: full admin UI, complex utilities
--   - Examples: admin dashboards, settings panels, reports
-- ============================================================
