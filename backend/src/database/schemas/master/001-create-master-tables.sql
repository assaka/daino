-- ============================================
-- MASTER DATABASE SCHEMA
-- Platform-level tables for multi-tenant architecture
-- ============================================

-- ============================================
-- 1. USERS TABLE (Agency users only)
-- Identical structure to tenant users table
-- Only contains rows where account_type = 'agency'
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  last_login TIMESTAMP,
  role VARCHAR(50) DEFAULT 'store_owner' CHECK (role IN ('admin', 'store_owner')),
  account_type VARCHAR(50) DEFAULT 'agency' CHECK (account_type = 'agency'),
  credits DECIMAL(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Unique constraint on email + role (same as tenant)
CREATE UNIQUE INDEX IF NOT EXISTS unique_email_role ON users(email, role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);

-- ============================================
-- 2. STORES TABLE (Minimal registry)
-- Only contains: id, user_id, slug, status, is_active, created_at
-- Full store data (name, settings, etc.) in tenant DB
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending_database' CHECK (status IN (
    'pending_database',  -- Waiting for DB connection
    'provisioning',      -- Creating tenant DB
    'active',           -- Fully operational
    'suspended',        -- Temporarily disabled
    'inactive'          -- Permanently disabled
  )),
  is_active BOOLEAN DEFAULT false,
  theme_preset VARCHAR(50) DEFAULT 'default',  -- Reference to selected theme preset (full settings in tenant DB)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add theme_preset column if not exists (for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores' AND column_name = 'theme_preset') THEN
    ALTER TABLE stores ADD COLUMN theme_preset VARCHAR(50) DEFAULT 'default';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active) WHERE is_active = true;

-- ============================================
-- 3. STORE_DATABASES TABLE
-- Encrypted tenant database connection credentials
-- ============================================
CREATE TABLE IF NOT EXISTS store_databases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID UNIQUE NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  database_type VARCHAR(50) NOT NULL CHECK (database_type IN ('supabase', 'postgresql', 'mysql')),

  -- Encrypted credentials (AES-256)
  connection_string_encrypted TEXT NOT NULL,

  -- Connection details (non-sensitive)
  host VARCHAR(255),
  port INTEGER,
  database_name VARCHAR(255) DEFAULT 'postgres',

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_connection_test TIMESTAMP,
  connection_status VARCHAR(50) DEFAULT 'pending' CHECK (connection_status IN (
    'pending',
    'connected',
    'failed',
    'timeout'
  )),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_databases_store_id ON store_databases(store_id);
CREATE INDEX IF NOT EXISTS idx_store_databases_active ON store_databases(is_active) WHERE is_active = true;

-- ============================================
-- 4. STORE_HOSTNAMES TABLE
-- Maps hostnames to stores for fast resolution
-- ============================================
CREATE TABLE IF NOT EXISTS store_hostnames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  hostname VARCHAR(255) UNIQUE NOT NULL, -- 'myshop.daino.com'
  slug VARCHAR(255) NOT NULL,            -- 'myshop'
  is_primary BOOLEAN DEFAULT true,
  is_custom_domain BOOLEAN DEFAULT false,
  ssl_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_hostname ON store_hostnames(hostname);
CREATE INDEX IF NOT EXISTS idx_store_hostnames_store_id ON store_hostnames(store_id);
CREATE INDEX IF NOT EXISTS idx_store_hostnames_slug ON store_hostnames(slug);
CREATE INDEX IF NOT EXISTS idx_store_hostnames_primary ON store_hostnames(store_id, is_primary) WHERE is_primary = true;

-- ============================================
-- 5. SUBSCRIPTIONS TABLE
-- Store subscription plans and billing
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID UNIQUE NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Plan details
  plan_name VARCHAR(50) NOT NULL CHECK (plan_name IN ('free', 'starter', 'professional', 'enterprise')),
  status VARCHAR(50) NOT NULL DEFAULT 'trial' CHECK (status IN (
    'trial',
    'active',
    'cancelled',
    'expired',
    'suspended'
  )),

  -- Pricing
  price_monthly DECIMAL(10, 2),
  price_annual DECIMAL(10, 2),
  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')),

  -- Resource limits
  max_products INTEGER,
  max_orders_per_month INTEGER,
  max_storage_gb INTEGER,
  max_api_calls_per_month INTEGER,

  -- Dates
  started_at TIMESTAMP DEFAULT NOW(),
  trial_ends_at TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancelled_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_store_id ON subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_name);

-- ============================================
-- 6. CREDIT_TRANSACTIONS TABLE
-- All credit purchases, adjustments, refunds
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Transaction details
  amount DECIMAL(10, 2) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    'purchase',        -- User bought credits
    'adjustment',      -- Manual admin adjustment
    'refund',         -- Refund issued
    'bonus',          -- Promotional credits
    'migration'       -- Data migration
  )),

  -- Payment info (for purchases)
  payment_method VARCHAR(50),           -- 'stripe', 'paypal', etc.
  payment_provider_id VARCHAR(255),     -- External transaction ID
  payment_status VARCHAR(50) DEFAULT 'completed' CHECK (payment_status IN (
    'pending',
    'completed',
    'failed',
    'refunded'
  )),

  -- Metadata
  description TEXT,
  reference_id VARCHAR(255),            -- Related invoice/order ID
  processed_by UUID REFERENCES users(id), -- Admin who processed (for adjustments)
  notes TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_store_id ON credit_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at DESC);

-- ============================================
-- 7. SERVICE_CREDIT_COSTS TABLE
-- Pricing for all services that consume credits
-- (Keep existing if already exists, or create new)
-- ============================================
CREATE TABLE IF NOT EXISTS service_credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key VARCHAR(100) UNIQUE NOT NULL,  -- Code reference key
  service_name VARCHAR(255) NOT NULL,
  service_category VARCHAR(50) CHECK (service_category IN (
    'store_operations',
    'plugin_management',
    'ai_services',
    'data_migration',
    'storage',
    'akeneo_integration',
    'other'
  )),

  -- Pricing
  cost_per_unit DECIMAL(10, 4) NOT NULL,
  billing_type VARCHAR(50) NOT NULL CHECK (billing_type IN (
    'per_use',
    'per_day',
    'per_month',
    'per_hour',
    'per_item',
    'per_mb',
    'flat_rate'
  )),

  -- Display
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,      -- Show in pricing page
  display_order INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_credit_costs_key ON service_credit_costs(service_key);
CREATE INDEX IF NOT EXISTS idx_service_credit_costs_category ON service_credit_costs(service_category);
CREATE INDEX IF NOT EXISTS idx_service_credit_costs_active ON service_credit_costs(is_active) WHERE is_active = true;

-- ============================================
-- 8. JOB_QUEUE TABLE - REMOVED
-- Migrated to tenant's jobs table via Job Sequelize model
-- Use BackgroundJobManager with jobs table instead
-- ============================================
-- REMOVED: job_queue table and indexes

-- ============================================
-- 9. USAGE_METRICS TABLE
-- Store usage tracking for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,

  -- Product metrics
  products_created INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_deleted INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,

  -- Order metrics
  orders_created INTEGER DEFAULT 0,
  orders_total_value DECIMAL(10, 2) DEFAULT 0,

  -- Storage metrics
  storage_uploaded_bytes BIGINT DEFAULT 0,
  storage_deleted_bytes BIGINT DEFAULT 0,
  storage_total_bytes BIGINT DEFAULT 0,

  -- API metrics
  api_calls INTEGER DEFAULT 0,
  api_errors INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_store_date ON usage_metrics(store_id, metric_date DESC);

-- ============================================
-- 10. BILLING_TRANSACTIONS TABLE
-- Payment history for subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS billing_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),

  -- Transaction details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'completed',
    'failed',
    'refunded'
  )),

  -- Payment provider
  payment_method VARCHAR(50),           -- 'stripe', 'paypal', 'credit_card'
  payment_provider_id VARCHAR(255),     -- External payment ID

  -- Invoice
  description TEXT,
  invoice_url TEXT,

  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_store_id ON billing_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_subscription ON billing_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON billing_transactions(status);

-- ============================================
-- SEED DATA - Default Service Credit Costs
-- ============================================
INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, billing_type, description, is_active, is_visible, display_order)
VALUES
  ('store_creation', 'Store Creation', 'store_operations', 0.00, 'per_use', 'Create a new store', true, false, 1),
  ('product_import', 'Product Import', 'data_migration', 0.10, 'per_item', 'Import products from external source', true, true, 10),
  ('product_export', 'Product Export', 'data_migration', 0.05, 'per_item', 'Export products to external format', true, true, 11),
  ('ai_translation', 'AI Translation', 'ai_services', 1.00, 'per_use', 'Translate content using AI', true, true, 20),
  ('ai_content_generation', 'AI Content Generation', 'ai_services', 2.00, 'per_use', 'Generate product descriptions with AI', true, true, 21),
  ('storage_usage', 'Storage Usage', 'storage', 0.10, 'per_mb', 'Cloud storage for media files', true, true, 30),
  ('akeneo_sync', 'Akeneo Sync', 'akeneo_integration', 5.00, 'per_day', 'Daily Akeneo synchronization', true, true, 40),
  ('plugin_marketplace', 'Plugin Purchase', 'plugin_management', 0.00, 'flat_rate', 'Purchase plugins from marketplace', true, false, 50)
ON CONFLICT (service_key) DO NOTHING;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_databases_updated_at BEFORE UPDATE ON store_databases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_hostnames_updated_at BEFORE UPDATE ON store_hostnames
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. THEME_DEFAULTS TABLE
-- Centralized theme presets for all tenants
-- ============================================
CREATE TABLE IF NOT EXISTS theme_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  theme_settings JSONB NOT NULL DEFAULT '{}',
  is_system_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  type VARCHAR(20) NOT NULL DEFAULT 'system',
  user_id UUID NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_defaults_preset ON theme_defaults(preset_name);
CREATE INDEX IF NOT EXISTS idx_theme_defaults_active ON theme_defaults(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_theme_defaults_type ON theme_defaults(type);
CREATE INDEX IF NOT EXISTS idx_theme_defaults_user_id ON theme_defaults(user_id) WHERE user_id IS NOT NULL;

-- Ensure only one system default
CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_defaults_single_default
  ON theme_defaults(is_system_default) WHERE is_system_default = true;

-- Trigger for updated_at
CREATE TRIGGER update_theme_defaults_updated_at BEFORE UPDATE ON theme_defaults
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default theme presets
INSERT INTO theme_defaults (preset_name, display_name, description, theme_settings, is_system_default, sort_order)
VALUES
  ('default', 'Default', 'Standard blue/green theme', '{
    "primary_button_color": "#007bff",
    "secondary_button_color": "#6c757d",
    "add_to_cart_button_color": "#28a745",
    "view_cart_button_color": "#17a2b8",
    "checkout_button_color": "#007bff",
    "place_order_button_color": "#28a745",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#374151",
    "breadcrumb_active_item_color": "#111827",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#007bff",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#EFF6FF",
    "product_tabs_content_color": "#374151",
    "product_tabs_attribute_label_color": "#16A34A",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#007bff",
    "product_tabs_hover_bg": "#EFF6FF",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#E5E7EB",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#007bff",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#10B981",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#111827",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#E5E7EB",
    "checkout_section_text_color": "#374151",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#374151",
    "pagination_button_hover_bg_color": "#F3F4F6",
    "pagination_button_border_color": "#D1D5DB",
    "pagination_active_bg_color": "#007bff",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, true, 1),
  ('dark', 'Dark Mode', 'Dark theme with muted colors', '{
    "primary_button_color": "#6366F1",
    "secondary_button_color": "#4B5563",
    "add_to_cart_button_color": "#10B981",
    "view_cart_button_color": "#06B6D4",
    "checkout_button_color": "#6366F1",
    "place_order_button_color": "#10B981",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#9CA3AF",
    "breadcrumb_item_hover_color": "#D1D5DB",
    "breadcrumb_active_item_color": "#F9FAFB",
    "breadcrumb_separator_color": "#6B7280",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#6366f1",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#1F2937",
    "product_tabs_content_color": "#D1D5DB",
    "product_tabs_attribute_label_color": "#34D399",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#9CA3AF",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#F9FAFB",
    "product_tabs_hover_bg": "#374151",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#d1d5db",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#6366F1",
    "checkout_step_indicator_inactive_color": "#4B5563",
    "checkout_step_indicator_completed_color": "#10B981",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#F9FAFB",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#1F2937",
    "checkout_section_border_color": "#374151",
    "checkout_section_text_color": "#D1D5DB",
    "pagination_button_bg_color": "#1F2937",
    "pagination_button_text_color": "#D1D5DB",
    "pagination_button_hover_bg_color": "#374151",
    "pagination_button_border_color": "#4B5563",
    "pagination_active_bg_color": "#6366F1",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 2),
  ('professional', 'Professional', 'Clean professional look', '{
    "primary_button_color": "#1E40AF",
    "secondary_button_color": "#475569",
    "add_to_cart_button_color": "#059669",
    "view_cart_button_color": "#0284C7",
    "checkout_button_color": "#1E40AF",
    "place_order_button_color": "#059669",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#64748B",
    "breadcrumb_item_hover_color": "#334155",
    "breadcrumb_active_item_color": "#0F172A",
    "breadcrumb_separator_color": "#94A3B8",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#1E40AF",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#F8FAFC",
    "product_tabs_content_color": "#334155",
    "product_tabs_attribute_label_color": "#059669",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#64748B",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#1E40AF",
    "product_tabs_hover_bg": "#F8FAFC",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#E2E8F0",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#1E40AF",
    "checkout_step_indicator_inactive_color": "#CBD5E1",
    "checkout_step_indicator_completed_color": "#059669",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#0F172A",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#E2E8F0",
    "checkout_section_text_color": "#334155",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#334155",
    "pagination_button_hover_bg_color": "#F1F5F9",
    "pagination_button_border_color": "#E2E8F0",
    "pagination_active_bg_color": "#1E40AF",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 3),
  ('red', 'Red', 'Vibrant red theme for high-energy brands', '{
    "primary_button_color": "#DC2626",
    "secondary_button_color": "#6B7280",
    "add_to_cart_button_color": "#B91C1C",
    "view_cart_button_color": "#EF4444",
    "checkout_button_color": "#DC2626",
    "place_order_button_color": "#B91C1C",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#DC2626",
    "breadcrumb_active_item_color": "#111827",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#DC2626",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FEF2F2",
    "product_tabs_content_color": "#374151",
    "product_tabs_attribute_label_color": "#B91C1C",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#DC2626",
    "product_tabs_hover_bg": "#FEE2E2",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#FECACA",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#DC2626",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#B91C1C",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#111827",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#FECACA",
    "checkout_section_text_color": "#374151",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#374151",
    "pagination_button_hover_bg_color": "#FEE2E2",
    "pagination_button_border_color": "#FECACA",
    "pagination_active_bg_color": "#DC2626",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 4),
  ('ocean', 'Ocean', 'Calming ocean blue tones', '{
    "primary_button_color": "#0077B6",
    "secondary_button_color": "#90E0EF",
    "add_to_cart_button_color": "#00B4D8",
    "view_cart_button_color": "#48CAE4",
    "checkout_button_color": "#0077B6",
    "place_order_button_color": "#023E8A",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#0077B6",
    "breadcrumb_active_item_color": "#023E8A",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#0077B6",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#CAF0F8",
    "product_tabs_content_color": "#03045E",
    "product_tabs_attribute_label_color": "#00B4D8",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#0077B6",
    "product_tabs_hover_bg": "#CAF0F8",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#90E0EF",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#0077B6",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#00B4D8",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#023E8A",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#90E0EF",
    "checkout_section_text_color": "#03045E",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#03045E",
    "pagination_button_hover_bg_color": "#CAF0F8",
    "pagination_button_border_color": "#90E0EF",
    "pagination_active_bg_color": "#0077B6",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 5),
  ('forest', 'Forest', 'Natural green woodland theme', '{
    "primary_button_color": "#2D6A4F",
    "secondary_button_color": "#95D5B2",
    "add_to_cart_button_color": "#40916C",
    "view_cart_button_color": "#52B788",
    "checkout_button_color": "#2D6A4F",
    "place_order_button_color": "#1B4332",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#2D6A4F",
    "breadcrumb_active_item_color": "#1B4332",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#2D6A4F",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#D8F3DC",
    "product_tabs_content_color": "#1B4332",
    "product_tabs_attribute_label_color": "#40916C",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#2D6A4F",
    "product_tabs_hover_bg": "#D8F3DC",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#95D5B2",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#2D6A4F",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#40916C",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#1B4332",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#95D5B2",
    "checkout_section_text_color": "#1B4332",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#1B4332",
    "pagination_button_hover_bg_color": "#D8F3DC",
    "pagination_button_border_color": "#95D5B2",
    "pagination_active_bg_color": "#2D6A4F",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 6),
  ('sunset', 'Sunset', 'Warm orange and coral tones', '{
    "primary_button_color": "#E85D04",
    "secondary_button_color": "#FAA307",
    "add_to_cart_button_color": "#F48C06",
    "view_cart_button_color": "#FFBA08",
    "checkout_button_color": "#E85D04",
    "place_order_button_color": "#D00000",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#E85D04",
    "breadcrumb_active_item_color": "#370617",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#E85D04",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FFF3E0",
    "product_tabs_content_color": "#370617",
    "product_tabs_attribute_label_color": "#F48C06",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#E85D04",
    "product_tabs_hover_bg": "#FFF3E0",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#FAA307",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#E85D04",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#F48C06",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#370617",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#FAA307",
    "checkout_section_text_color": "#370617",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#370617",
    "pagination_button_hover_bg_color": "#FFF3E0",
    "pagination_button_border_color": "#FAA307",
    "pagination_active_bg_color": "#E85D04",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 7),
  ('lavender', 'Lavender', 'Soft purple and violet tones', '{
    "primary_button_color": "#7C3AED",
    "secondary_button_color": "#C4B5FD",
    "add_to_cart_button_color": "#8B5CF6",
    "view_cart_button_color": "#A78BFA",
    "checkout_button_color": "#7C3AED",
    "place_order_button_color": "#5B21B6",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#7C3AED",
    "breadcrumb_active_item_color": "#4C1D95",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#7C3AED",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#EDE9FE",
    "product_tabs_content_color": "#4C1D95",
    "product_tabs_attribute_label_color": "#8B5CF6",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#7C3AED",
    "product_tabs_hover_bg": "#EDE9FE",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#C4B5FD",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#7C3AED",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#8B5CF6",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#4C1D95",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#C4B5FD",
    "checkout_section_text_color": "#4C1D95",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#4C1D95",
    "pagination_button_hover_bg_color": "#EDE9FE",
    "pagination_button_border_color": "#C4B5FD",
    "pagination_active_bg_color": "#7C3AED",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 8),
  ('coral', 'Coral', 'Vibrant coral and pink accents', '{
    "primary_button_color": "#F472B6",
    "secondary_button_color": "#FBCFE8",
    "add_to_cart_button_color": "#EC4899",
    "view_cart_button_color": "#F9A8D4",
    "checkout_button_color": "#F472B6",
    "place_order_button_color": "#DB2777",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#F472B6",
    "breadcrumb_active_item_color": "#831843",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#F472B6",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FCE7F3",
    "product_tabs_content_color": "#831843",
    "product_tabs_attribute_label_color": "#EC4899",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#F472B6",
    "product_tabs_hover_bg": "#FCE7F3",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#FBCFE8",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#F472B6",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#EC4899",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#831843",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#FBCFE8",
    "checkout_section_text_color": "#831843",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#831843",
    "pagination_button_hover_bg_color": "#FCE7F3",
    "pagination_button_border_color": "#FBCFE8",
    "pagination_active_bg_color": "#F472B6",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 9),
  ('midnight', 'Midnight', 'Deep navy and gold luxury theme', '{
    "primary_button_color": "#1E3A5F",
    "secondary_button_color": "#D4AF37",
    "add_to_cart_button_color": "#2E5077",
    "view_cart_button_color": "#4DA8DA",
    "checkout_button_color": "#1E3A5F",
    "place_order_button_color": "#0C1929",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#D4AF37",
    "breadcrumb_active_item_color": "#1E3A5F",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#1E3A5F",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#E8F4FC",
    "product_tabs_content_color": "#0C1929",
    "product_tabs_attribute_label_color": "#D4AF37",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#1E3A5F",
    "product_tabs_hover_bg": "#E8F4FC",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#4DA8DA",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#1E3A5F",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#D4AF37",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#0C1929",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#4DA8DA",
    "checkout_section_text_color": "#0C1929",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#0C1929",
    "pagination_button_hover_bg_color": "#E8F4FC",
    "pagination_button_border_color": "#4DA8DA",
    "pagination_active_bg_color": "#1E3A5F",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 10),
  ('mint', 'Mint', 'Fresh mint and teal combination', '{
    "primary_button_color": "#14B8A6",
    "secondary_button_color": "#99F6E4",
    "add_to_cart_button_color": "#2DD4BF",
    "view_cart_button_color": "#5EEAD4",
    "checkout_button_color": "#14B8A6",
    "place_order_button_color": "#0F766E",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#14B8A6",
    "breadcrumb_active_item_color": "#134E4A",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#14B8A6",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#CCFBF1",
    "product_tabs_content_color": "#134E4A",
    "product_tabs_attribute_label_color": "#2DD4BF",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#14B8A6",
    "product_tabs_hover_bg": "#CCFBF1",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#99F6E4",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#14B8A6",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#2DD4BF",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#134E4A",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#99F6E4",
    "checkout_section_text_color": "#134E4A",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#134E4A",
    "pagination_button_hover_bg_color": "#CCFBF1",
    "pagination_button_border_color": "#99F6E4",
    "pagination_active_bg_color": "#14B8A6",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 11),
  ('coffee', 'Coffee', 'Warm brown and cream tones', '{
    "primary_button_color": "#78350F",
    "secondary_button_color": "#D6D3D1",
    "add_to_cart_button_color": "#92400E",
    "view_cart_button_color": "#B45309",
    "checkout_button_color": "#78350F",
    "place_order_button_color": "#451A03",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#78716C",
    "breadcrumb_item_hover_color": "#78350F",
    "breadcrumb_active_item_color": "#451A03",
    "breadcrumb_separator_color": "#A8A29E",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#78350F",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FEF3C7",
    "product_tabs_content_color": "#451A03",
    "product_tabs_attribute_label_color": "#92400E",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#78716C",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#78350F",
    "product_tabs_hover_bg": "#FEF3C7",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#D6D3D1",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#78350F",
    "checkout_step_indicator_inactive_color": "#D6D3D1",
    "checkout_step_indicator_completed_color": "#92400E",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#451A03",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFBEB",
    "checkout_section_border_color": "#D6D3D1",
    "checkout_section_text_color": "#451A03",
    "pagination_button_bg_color": "#FFFBEB",
    "pagination_button_text_color": "#451A03",
    "pagination_button_hover_bg_color": "#FEF3C7",
    "pagination_button_border_color": "#D6D3D1",
    "pagination_active_bg_color": "#78350F",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 12),
  ('slate', 'Slate', 'Modern gray and blue-gray tones', '{
    "primary_button_color": "#475569",
    "secondary_button_color": "#CBD5E1",
    "add_to_cart_button_color": "#334155",
    "view_cart_button_color": "#64748B",
    "checkout_button_color": "#475569",
    "place_order_button_color": "#1E293B",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#64748B",
    "breadcrumb_item_hover_color": "#475569",
    "breadcrumb_active_item_color": "#1E293B",
    "breadcrumb_separator_color": "#94A3B8",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#475569",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#F1F5F9",
    "product_tabs_content_color": "#1E293B",
    "product_tabs_attribute_label_color": "#334155",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#64748B",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#475569",
    "product_tabs_hover_bg": "#F1F5F9",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#CBD5E1",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#475569",
    "checkout_step_indicator_inactive_color": "#CBD5E1",
    "checkout_step_indicator_completed_color": "#334155",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#1E293B",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#CBD5E1",
    "checkout_section_text_color": "#1E293B",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#1E293B",
    "pagination_button_hover_bg_color": "#F1F5F9",
    "pagination_button_border_color": "#CBD5E1",
    "pagination_active_bg_color": "#475569",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 13),
  ('rose', 'Rose', 'Elegant rose and dusty pink', '{
    "primary_button_color": "#BE185D",
    "secondary_button_color": "#FECDD3",
    "add_to_cart_button_color": "#DB2777",
    "view_cart_button_color": "#F472B6",
    "checkout_button_color": "#BE185D",
    "place_order_button_color": "#9D174D",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#BE185D",
    "breadcrumb_active_item_color": "#881337",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#BE185D",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FFE4E6",
    "product_tabs_content_color": "#881337",
    "product_tabs_attribute_label_color": "#DB2777",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#BE185D",
    "product_tabs_hover_bg": "#FFE4E6",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#FECDD3",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#BE185D",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#DB2777",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#881337",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#FECDD3",
    "checkout_section_text_color": "#881337",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#881337",
    "pagination_button_hover_bg_color": "#FFE4E6",
    "pagination_button_border_color": "#FECDD3",
    "pagination_active_bg_color": "#BE185D",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 14),
  ('emerald', 'Emerald', 'Rich emerald green luxury', '{
    "primary_button_color": "#047857",
    "secondary_button_color": "#A7F3D0",
    "add_to_cart_button_color": "#059669",
    "view_cart_button_color": "#34D399",
    "checkout_button_color": "#047857",
    "place_order_button_color": "#065F46",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#047857",
    "breadcrumb_active_item_color": "#064E3B",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#047857",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#D1FAE5",
    "product_tabs_content_color": "#064E3B",
    "product_tabs_attribute_label_color": "#059669",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#047857",
    "product_tabs_hover_bg": "#D1FAE5",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#A7F3D0",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#047857",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#059669",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#064E3B",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#A7F3D0",
    "checkout_section_text_color": "#064E3B",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#064E3B",
    "pagination_button_hover_bg_color": "#D1FAE5",
    "pagination_button_border_color": "#A7F3D0",
    "pagination_active_bg_color": "#047857",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 15),
  ('amber', 'Amber', 'Warm amber and honey gold', '{
    "primary_button_color": "#D97706",
    "secondary_button_color": "#FDE68A",
    "add_to_cart_button_color": "#F59E0B",
    "view_cart_button_color": "#FBBF24",
    "checkout_button_color": "#D97706",
    "place_order_button_color": "#B45309",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#78716C",
    "breadcrumb_item_hover_color": "#D97706",
    "breadcrumb_active_item_color": "#78350F",
    "breadcrumb_separator_color": "#A8A29E",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#D97706",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FEF3C7",
    "product_tabs_content_color": "#78350F",
    "product_tabs_attribute_label_color": "#F59E0B",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#78716C",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#D97706",
    "product_tabs_hover_bg": "#FEF3C7",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#FDE68A",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#D97706",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#F59E0B",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#78350F",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFBEB",
    "checkout_section_border_color": "#FDE68A",
    "checkout_section_text_color": "#78350F",
    "pagination_button_bg_color": "#FFFBEB",
    "pagination_button_text_color": "#78350F",
    "pagination_button_hover_bg_color": "#FEF3C7",
    "pagination_button_border_color": "#FDE68A",
    "pagination_active_bg_color": "#D97706",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 16),
  ('sky', 'Sky', 'Light sky blue and white', '{
    "primary_button_color": "#0284C7",
    "secondary_button_color": "#BAE6FD",
    "add_to_cart_button_color": "#0EA5E9",
    "view_cart_button_color": "#38BDF8",
    "checkout_button_color": "#0284C7",
    "place_order_button_color": "#0369A1",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#0284C7",
    "breadcrumb_active_item_color": "#0C4A6E",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#0284C7",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#E0F2FE",
    "product_tabs_content_color": "#0C4A6E",
    "product_tabs_attribute_label_color": "#0EA5E9",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#0284C7",
    "product_tabs_hover_bg": "#E0F2FE",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#BAE6FD",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#0284C7",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#0EA5E9",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#0C4A6E",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#BAE6FD",
    "checkout_section_text_color": "#0C4A6E",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#0C4A6E",
    "pagination_button_hover_bg_color": "#E0F2FE",
    "pagination_button_border_color": "#BAE6FD",
    "pagination_active_bg_color": "#0284C7",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 17),
  ('indigo', 'Indigo', 'Deep indigo and electric blue', '{
    "primary_button_color": "#4F46E5",
    "secondary_button_color": "#C7D2FE",
    "add_to_cart_button_color": "#6366F1",
    "view_cart_button_color": "#818CF8",
    "checkout_button_color": "#4F46E5",
    "place_order_button_color": "#3730A3",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#4F46E5",
    "breadcrumb_active_item_color": "#312E81",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#4F46E5",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#E0E7FF",
    "product_tabs_content_color": "#312E81",
    "product_tabs_attribute_label_color": "#6366F1",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#4F46E5",
    "product_tabs_hover_bg": "#E0E7FF",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#C7D2FE",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#4F46E5",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#6366F1",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#312E81",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#C7D2FE",
    "checkout_section_text_color": "#312E81",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#312E81",
    "pagination_button_hover_bg_color": "#E0E7FF",
    "pagination_button_border_color": "#C7D2FE",
    "pagination_active_bg_color": "#4F46E5",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 18),
  ('fuchsia', 'Fuchsia', 'Bold fuchsia and magenta', '{
    "primary_button_color": "#A21CAF",
    "secondary_button_color": "#F5D0FE",
    "add_to_cart_button_color": "#C026D3",
    "view_cart_button_color": "#E879F9",
    "checkout_button_color": "#A21CAF",
    "place_order_button_color": "#86198F",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#A21CAF",
    "breadcrumb_active_item_color": "#701A75",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#A21CAF",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FAE8FF",
    "product_tabs_content_color": "#701A75",
    "product_tabs_attribute_label_color": "#C026D3",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#A21CAF",
    "product_tabs_hover_bg": "#FAE8FF",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#F5D0FE",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#A21CAF",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#C026D3",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#701A75",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#F5D0FE",
    "checkout_section_text_color": "#701A75",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#701A75",
    "pagination_button_hover_bg_color": "#FAE8FF",
    "pagination_button_border_color": "#F5D0FE",
    "pagination_active_bg_color": "#A21CAF",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 19),
  ('lime', 'Lime', 'Fresh lime green energy', '{
    "primary_button_color": "#65A30D",
    "secondary_button_color": "#D9F99D",
    "add_to_cart_button_color": "#84CC16",
    "view_cart_button_color": "#A3E635",
    "checkout_button_color": "#65A30D",
    "place_order_button_color": "#4D7C0F",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#65A30D",
    "breadcrumb_active_item_color": "#365314",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#65A30D",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#ECFCCB",
    "product_tabs_content_color": "#365314",
    "product_tabs_attribute_label_color": "#84CC16",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#65A30D",
    "product_tabs_hover_bg": "#ECFCCB",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#D9F99D",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#65A30D",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#84CC16",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#365314",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#D9F99D",
    "checkout_section_text_color": "#365314",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#365314",
    "pagination_button_hover_bg_color": "#ECFCCB",
    "pagination_button_border_color": "#D9F99D",
    "pagination_active_bg_color": "#65A30D",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 20),
  ('cyan', 'Cyan', 'Bright cyan and turquoise', '{
    "primary_button_color": "#0891B2",
    "secondary_button_color": "#A5F3FC",
    "add_to_cart_button_color": "#06B6D4",
    "view_cart_button_color": "#22D3EE",
    "checkout_button_color": "#0891B2",
    "place_order_button_color": "#0E7490",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#0891B2",
    "breadcrumb_active_item_color": "#164E63",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#0891B2",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#CFFAFE",
    "product_tabs_content_color": "#164E63",
    "product_tabs_attribute_label_color": "#06B6D4",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#0891B2",
    "product_tabs_hover_bg": "#CFFAFE",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#A5F3FC",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#0891B2",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#06B6D4",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#164E63",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#A5F3FC",
    "checkout_section_text_color": "#164E63",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#164E63",
    "pagination_button_hover_bg_color": "#CFFAFE",
    "pagination_button_border_color": "#A5F3FC",
    "pagination_active_bg_color": "#0891B2",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 21),
  ('stone', 'Stone', 'Neutral stone and warm gray', '{
    "primary_button_color": "#57534E",
    "secondary_button_color": "#D6D3D1",
    "add_to_cart_button_color": "#78716C",
    "view_cart_button_color": "#A8A29E",
    "checkout_button_color": "#57534E",
    "place_order_button_color": "#44403C",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#78716C",
    "breadcrumb_item_hover_color": "#57534E",
    "breadcrumb_active_item_color": "#1C1917",
    "breadcrumb_separator_color": "#A8A29E",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#57534E",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#F5F5F4",
    "product_tabs_content_color": "#1C1917",
    "product_tabs_attribute_label_color": "#78716C",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#78716C",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#57534E",
    "product_tabs_hover_bg": "#F5F5F4",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#D6D3D1",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#57534E",
    "checkout_step_indicator_inactive_color": "#D6D3D1",
    "checkout_step_indicator_completed_color": "#78716C",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#1C1917",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FAFAF9",
    "checkout_section_border_color": "#D6D3D1",
    "checkout_section_text_color": "#1C1917",
    "pagination_button_bg_color": "#FAFAF9",
    "pagination_button_text_color": "#1C1917",
    "pagination_button_hover_bg_color": "#F5F5F4",
    "pagination_button_border_color": "#D6D3D1",
    "pagination_active_bg_color": "#57534E",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 22),
  ('wine', 'Wine', 'Rich burgundy and wine red', '{
    "primary_button_color": "#881337",
    "secondary_button_color": "#FECDD3",
    "add_to_cart_button_color": "#9F1239",
    "view_cart_button_color": "#BE123C",
    "checkout_button_color": "#881337",
    "place_order_button_color": "#4C0519",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#881337",
    "breadcrumb_active_item_color": "#4C0519",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#881337",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FFE4E6",
    "product_tabs_content_color": "#4C0519",
    "product_tabs_attribute_label_color": "#9F1239",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#881337",
    "product_tabs_hover_bg": "#FFE4E6",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#FECDD3",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#881337",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#9F1239",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#4C0519",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#FECDD3",
    "checkout_section_text_color": "#4C0519",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#4C0519",
    "pagination_button_hover_bg_color": "#FFE4E6",
    "pagination_button_border_color": "#FECDD3",
    "pagination_active_bg_color": "#881337",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 23),
  ('royal', 'Royal', 'Royal purple and gold', '{
    "primary_button_color": "#5B21B6",
    "secondary_button_color": "#DDD6FE",
    "add_to_cart_button_color": "#7C3AED",
    "view_cart_button_color": "#8B5CF6",
    "checkout_button_color": "#5B21B6",
    "place_order_button_color": "#4C1D95",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#D4AF37",
    "breadcrumb_active_item_color": "#4C1D95",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#5B21B6",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#EDE9FE",
    "product_tabs_content_color": "#2E1065",
    "product_tabs_attribute_label_color": "#D4AF37",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#5B21B6",
    "product_tabs_hover_bg": "#EDE9FE",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#DDD6FE",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#5B21B6",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#D4AF37",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#2E1065",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#DDD6FE",
    "checkout_section_text_color": "#2E1065",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#2E1065",
    "pagination_button_hover_bg_color": "#EDE9FE",
    "pagination_button_border_color": "#DDD6FE",
    "pagination_active_bg_color": "#5B21B6",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 24)
ON CONFLICT (preset_name) DO NOTHING;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE users IS 'Platform users (agency/store owners only). Full user structure synced from tenant DBs where account_type = agency';
COMMENT ON TABLE stores IS 'Minimal store registry with slug for routing. Full store data (name, settings, etc.) stored in tenant databases';
COMMENT ON TABLE store_databases IS 'Encrypted tenant database connection credentials. Allows backend to connect to each store tenant DB';
COMMENT ON TABLE store_hostnames IS 'Maps hostnames/domains to stores for fast tenant resolution';
COMMENT ON TABLE subscriptions IS 'Store subscription plans and billing information';
COMMENT ON TABLE credit_transactions IS 'Credit purchase history and adjustments';
COMMENT ON TABLE service_credit_costs IS 'Pricing for all services that consume credits';
COMMENT ON TABLE job_queue IS 'Centralized job queue for processing tenant jobs';
COMMENT ON TABLE usage_metrics IS 'Daily usage metrics per store for analytics';
COMMENT ON TABLE billing_transactions IS 'Subscription payment history';
COMMENT ON TABLE theme_defaults IS 'Centralized theme presets (default, dark, professional) used for new tenant provisioning and as fallback values';

-- ============================================
-- MASTER DATABASE SCHEMA COMPLETE
-- ============================================
