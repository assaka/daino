-- =====================================================
-- PLUGIN ARCHITECTURE - DATABASE SCHEMA
-- =====================================================
-- Creates all tables for the modern plugin architecture
-- Supports: Marketplace, Dynamic Navigation, Widgets, Monetization
-- Multi-tenant: Master DB (shared) + Tenant DB (isolated)
-- =====================================================

-- =====================================================
-- MASTER DATABASE TABLES (Shared across all tenants)
-- =====================================================

-- Plugin Marketplace: Central marketplace for all plugins
CREATE TABLE IF NOT EXISTS plugin_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  long_description TEXT,
  author_id UUID, -- References users table
  author_name VARCHAR(255),
  category VARCHAR(100), -- 'payment', 'shipping', 'marketing', 'analytics', etc.

  -- Pricing & Monetization
  pricing_model VARCHAR(50) NOT NULL DEFAULT 'free', -- 'free', 'one_time', 'subscription', 'freemium', 'custom'
  base_price DECIMAL(10, 2) DEFAULT 0.00,
  monthly_price DECIMAL(10, 2),
  yearly_price DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  license_type VARCHAR(50) DEFAULT 'per_store', -- 'per_store', 'unlimited', 'per_user'
  trial_days INTEGER DEFAULT 0,

  -- Marketplace Metadata
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'suspended'
  downloads INTEGER DEFAULT 0,
  active_installations INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0.00,
  reviews_count INTEGER DEFAULT 0,

  -- Media
  icon_url TEXT,
  screenshots JSONB DEFAULT '[]'::jsonb,

  -- Plugin Structure (stored as JSON for flexibility)
  plugin_structure JSONB, -- Complete plugin code, hooks, events, widgets
  dependencies JSONB DEFAULT '[]'::jsonb,
  requirements JSONB DEFAULT '{}'::jsonb, -- Min version, required features

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_pricing_model CHECK (pricing_model IN ('free', 'one_time', 'subscription', 'freemium', 'custom')),
  CONSTRAINT chk_license_type CHECK (license_type IN ('per_store', 'unlimited', 'per_user')),
  CONSTRAINT chk_marketplace_status CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'))
);

CREATE INDEX idx_plugin_marketplace_slug ON plugin_marketplace(slug);
CREATE INDEX idx_plugin_marketplace_category ON plugin_marketplace(category);
CREATE INDEX idx_plugin_marketplace_status ON plugin_marketplace(status);
CREATE INDEX idx_plugin_marketplace_author ON plugin_marketplace(author_id);

-- Plugin Versions: Version history for marketplace plugins
CREATE TABLE IF NOT EXISTS plugin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_plugin_id UUID NOT NULL,
  version VARCHAR(50) NOT NULL,
  changelog TEXT,
  plugin_structure JSONB,
  is_current BOOLEAN DEFAULT false,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_plugin_versions_marketplace FOREIGN KEY (marketplace_plugin_id)
    REFERENCES plugin_marketplace(id) ON DELETE CASCADE,
  CONSTRAINT uq_plugin_version UNIQUE (marketplace_plugin_id, version)
);

CREATE INDEX idx_plugin_versions_marketplace ON plugin_versions(marketplace_plugin_id);
CREATE INDEX idx_plugin_versions_current ON plugin_versions(is_current) WHERE is_current = true;

-- Admin Navigation Registry: Master registry for all navigation items
CREATE TABLE IF NOT EXISTS admin_navigation_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE, -- 'dashboard', 'products', 'orders', etc.
  label VARCHAR(255) NOT NULL,
  icon VARCHAR(50), -- Lucide icon name
  route VARCHAR(255),
  parent_key VARCHAR(100), -- For hierarchical menus
  order_position INTEGER DEFAULT 0,

  -- Categorization
  is_core BOOLEAN DEFAULT false, -- Core vs Plugin-added
  is_visible BOOLEAN DEFAULT true, -- Show/hide navigation item
  plugin_id UUID, -- NULL for core items
  category VARCHAR(50), -- 'system', 'catalog', 'sales', 'marketing', etc.

  -- Permissions
  required_permission VARCHAR(100),

  -- Metadata
  description TEXT,
  badge_config JSONB, -- {text: 'New', color: '#FF5733'}

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_navigation_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_marketplace(id) ON DELETE CASCADE,
  CONSTRAINT fk_navigation_parent FOREIGN KEY (parent_key)
    REFERENCES admin_navigation_registry(key) ON DELETE CASCADE
);

CREATE INDEX idx_navigation_registry_key ON admin_navigation_registry(key);
CREATE INDEX idx_navigation_registry_parent ON admin_navigation_registry(parent_key);
CREATE INDEX idx_navigation_registry_plugin ON admin_navigation_registry(plugin_id);
CREATE INDEX idx_navigation_registry_core ON admin_navigation_registry(is_core);

-- Plugin Licenses: License management for purchased plugins
CREATE TABLE IF NOT EXISTS plugin_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_plugin_id UUID NOT NULL,
  tenant_id VARCHAR(255) NOT NULL, -- Could be store_id or organization_id
  user_id UUID,

  -- License Details
  license_key VARCHAR(255) NOT NULL UNIQUE,
  license_type VARCHAR(50) NOT NULL, -- 'per_store', 'unlimited', 'per_user'
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'cancelled', 'suspended'

  -- Subscription Management (for subscription-based plugins)
  subscription_id VARCHAR(255), -- Stripe subscription ID
  billing_interval VARCHAR(20), -- 'monthly', 'yearly'
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,

  -- Payment Details
  amount_paid DECIMAL(10, 2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50), -- 'stripe', 'paypal', etc.

  -- Metadata
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_validated_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_plugin_licenses_marketplace FOREIGN KEY (marketplace_plugin_id)
    REFERENCES plugin_marketplace(id) ON DELETE CASCADE,
  CONSTRAINT chk_license_type CHECK (license_type IN ('per_store', 'unlimited', 'per_user')),
  CONSTRAINT chk_license_status CHECK (status IN ('active', 'trial', 'expired', 'cancelled', 'suspended'))
);

CREATE INDEX idx_plugin_licenses_marketplace ON plugin_licenses(marketplace_plugin_id);
CREATE INDEX idx_plugin_licenses_tenant ON plugin_licenses(tenant_id);
CREATE INDEX idx_plugin_licenses_key ON plugin_licenses(license_key);
CREATE INDEX idx_plugin_licenses_status ON plugin_licenses(status);

-- =====================================================
-- TENANT DATABASE TABLES (Isolated per tenant/store)
-- =====================================================
-- Note: In multi-tenant setup, these tables exist in each tenant's database
-- In single-DB setup, add tenant_id/store_id columns to these tables
-- =====================================================

-- Plugins: Installed plugins per tenant
CREATE TABLE IF NOT EXISTS plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace_plugin_id UUID, -- NULL for custom/private plugins
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,

  -- Installation Details
  status VARCHAR(50) DEFAULT 'inactive', -- 'active', 'inactive', 'updating', 'error'
  is_enabled BOOLEAN DEFAULT false,

  -- Plugin Structure
  plugin_structure JSONB, -- Complete plugin code
  configuration JSONB DEFAULT '{}'::jsonb, -- User-configured settings

  -- Metadata
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_error TEXT,

  CONSTRAINT chk_plugin_status CHECK (status IN ('active', 'inactive', 'updating', 'error'))
);

CREATE INDEX idx_plugins_marketplace ON plugins(marketplace_plugin_id);
CREATE INDEX idx_plugins_slug ON plugins(slug);
CREATE INDEX idx_plugins_status ON plugins(status);

-- Plugin Hooks: Hook registrations per plugin
CREATE TABLE IF NOT EXISTS plugin_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  hook_name VARCHAR(255) NOT NULL, -- 'product.price_calculate', 'cart.add_item', etc.
  hook_type VARCHAR(20) NOT NULL DEFAULT 'filter', -- 'filter', 'action'
  handler_function TEXT NOT NULL, -- JavaScript function code
  priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_plugin_hooks_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugins(id) ON DELETE CASCADE,
  CONSTRAINT chk_hook_type CHECK (hook_type IN ('filter', 'action'))
);

CREATE INDEX idx_plugin_hooks_plugin ON plugin_hooks(plugin_id);
CREATE INDEX idx_plugin_hooks_name ON plugin_hooks(hook_name);
CREATE INDEX idx_plugin_hooks_enabled ON plugin_hooks(is_enabled) WHERE is_enabled = true;

-- Plugin Events: Event listeners per plugin
CREATE TABLE IF NOT EXISTS plugin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  event_name VARCHAR(255) NOT NULL, -- 'order.created', 'product.updated', etc.
  listener_function TEXT NOT NULL, -- JavaScript function code
  priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_plugin_events_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugins(id) ON DELETE CASCADE
);

CREATE INDEX idx_plugin_events_plugin ON plugin_events(plugin_id);
CREATE INDEX idx_plugin_events_name ON plugin_events(event_name);
CREATE INDEX idx_plugin_events_enabled ON plugin_events(is_enabled) WHERE is_enabled = true;

-- Plugin Widgets: Widget definitions for slot editor
CREATE TABLE IF NOT EXISTS plugin_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  widget_id VARCHAR(255) NOT NULL, -- Unique widget identifier
  widget_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Widget Code
  component_code TEXT NOT NULL, -- React component code
  default_config JSONB DEFAULT '{}'::jsonb, -- Default configuration

  -- Slot Editor Integration
  category VARCHAR(100), -- 'content', 'promotional', 'functional', etc.
  icon VARCHAR(50), -- Icon for slot editor palette
  preview_image TEXT, -- URL to preview screenshot

  -- Metadata
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_plugin_widgets_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugins(id) ON DELETE CASCADE,
  CONSTRAINT uq_plugin_widget_id UNIQUE (plugin_id, widget_id)
);

CREATE INDEX idx_plugin_widgets_plugin ON plugin_widgets(plugin_id);
CREATE INDEX idx_plugin_widgets_widget_id ON plugin_widgets(widget_id);
CREATE INDEX idx_plugin_widgets_enabled ON plugin_widgets(is_enabled) WHERE is_enabled = true;

-- Plugin Scripts: JavaScript/CSS files for plugins
CREATE TABLE IF NOT EXISTS plugin_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  script_type VARCHAR(20) NOT NULL, -- 'js', 'css'
  scope VARCHAR(20) NOT NULL, -- 'frontend', 'backend', 'admin'
  file_name VARCHAR(255) NOT NULL,
  file_content TEXT NOT NULL,
  load_priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_plugin_scripts_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugins(id) ON DELETE CASCADE,
  CONSTRAINT chk_script_type CHECK (script_type IN ('js', 'css')),
  CONSTRAINT chk_script_scope CHECK (scope IN ('frontend', 'backend', 'admin'))
);

CREATE INDEX idx_plugin_scripts_plugin ON plugin_scripts(plugin_id);
CREATE INDEX idx_plugin_scripts_type_scope ON plugin_scripts(script_type, scope);
CREATE INDEX idx_plugin_scripts_enabled ON plugin_scripts(is_enabled) WHERE is_enabled = true;

-- Plugin Data: Key-value storage for plugin data
CREATE TABLE IF NOT EXISTS plugin_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  data_key VARCHAR(255) NOT NULL,
  data_value JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_plugin_data_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugins(id) ON DELETE CASCADE,
  CONSTRAINT uq_plugin_data_key UNIQUE (plugin_id, data_key)
);

CREATE INDEX idx_plugin_data_plugin ON plugin_data(plugin_id);
CREATE INDEX idx_plugin_data_key ON plugin_data(data_key);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_plugin_marketplace_updated_at BEFORE UPDATE ON plugin_marketplace
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugins_updated_at BEFORE UPDATE ON plugins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_hooks_updated_at BEFORE UPDATE ON plugin_hooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_events_updated_at BEFORE UPDATE ON plugin_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_widgets_updated_at BEFORE UPDATE ON plugin_widgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_scripts_updated_at BEFORE UPDATE ON plugin_scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_data_updated_at BEFORE UPDATE ON plugin_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA SEEDING
-- =====================================================
-- Note: Core navigation items will be seeded via POST /api/admin/navigation/seed
-- This keeps the migration focused on schema only
-- =====================================================

COMMENT ON TABLE plugin_marketplace IS 'Master marketplace catalog for all available plugins';
COMMENT ON TABLE plugin_versions IS 'Version history and changelog for marketplace plugins';
COMMENT ON TABLE admin_navigation_registry IS 'Master registry for core and plugin navigation items';
COMMENT ON TABLE plugin_licenses IS 'License management and subscription tracking for purchased plugins';
COMMENT ON TABLE plugins IS 'Tenant-specific installed plugins';
COMMENT ON TABLE plugin_hooks IS 'Hook registrations for plugin functionality';
COMMENT ON TABLE plugin_events IS 'Event listener registrations for plugins';
COMMENT ON TABLE plugin_widgets IS 'Widget definitions available in slot editor';
COMMENT ON TABLE plugin_scripts IS 'JavaScript and CSS files for plugin frontend/backend';
COMMENT ON TABLE plugin_data IS 'Key-value storage for plugin configuration and data';
