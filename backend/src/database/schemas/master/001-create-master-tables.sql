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
    "product_tabs_title_color": "#DC2626",
    "product_tabs_title_size": "1.875rem",
    "product_tabs_content_bg": "#EFF6FF",
    "product_tabs_attribute_label_color": "#16A34A",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#111827",
    "product_tabs_hover_bg": "#F3F4F6",
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
    "product_tabs_title_color": "#F87171",
    "product_tabs_title_size": "1.875rem",
    "product_tabs_content_bg": "#1F2937",
    "product_tabs_attribute_label_color": "#34D399",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#9CA3AF",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#F9FAFB",
    "product_tabs_hover_bg": "#374151",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#374151",
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
    "product_tabs_title_size": "1.875rem",
    "product_tabs_content_bg": "#F8FAFC",
    "product_tabs_attribute_label_color": "#059669",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#64748B",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#0F172A",
    "product_tabs_hover_bg": "#F1F5F9",
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
  ('bold', 'Bold Red', 'Vibrant red theme for high-energy brands', '{
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
    "product_tabs_title_size": "1.875rem",
    "product_tabs_content_bg": "#FEF2F2",
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
  }'::jsonb, false, 4)
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
