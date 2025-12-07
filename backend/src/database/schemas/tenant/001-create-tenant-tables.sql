-- ============================================
-- TENANT DATABASE COMPLETE SCHEMA
-- Reorganized to fix foreign key dependencies
-- ============================================

-- ============================================
-- SECTION 1: CREATE TYPE ENUMS
-- ============================================

DO $$ BEGIN
    CREATE TYPE enum_ab_tests_status AS ENUM (
    'draft',
    'running',
    'paused',
    'completed',
    'archived'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_addresses_type AS ENUM (
    'billing',
    'shipping',
    'both'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_akeneo_custom_mappings_mapping_type AS ENUM (
    'attributes',
    'images',
    'files'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_akeneo_schedules_import_type AS ENUM (
    'attributes',
    'families',
    'categories',
    'products',
    'all'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_akeneo_schedules_schedule_type AS ENUM (
    'once',
    'hourly',
    'daily',
    'weekly',
    'monthly'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_akeneo_schedules_status AS ENUM (
    'scheduled',
    'running',
    'completed',
    'failed',
    'paused'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_ast_diffs_change_type AS ENUM (
    'addition',
    'modification',
    'deletion',
    'refactor',
    'style'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_ast_diffs_status AS ENUM (
    'draft',
    'applied',
    'rejected',
    'reverted'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_attributes_filter_type AS ENUM (
    'multiselect',
    'slider',
    'select'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_attributes_type AS ENUM (
    'text',
    'number',
    'select',
    'multiselect',
    'boolean',
    'date',
    'file',
    'image'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_consent_logs_consent_method AS ENUM (
    'accept_all',
    'reject_all',
    'custom'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_cookie_consent_settings_banner_position AS ENUM (
    'top',
    'bottom',
    'center'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_cookie_consent_settings_theme AS ENUM (
    'light',
    'dark',
    'custom'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_coupons_discount_type AS ENUM (
    'fixed',
    'percentage',
    'buy_x_get_y',
    'free_shipping'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_credit_transactions_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_credit_transactions_transaction_type AS ENUM (
    'purchase',
    'bonus',
    'refund'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_credit_usage_usage_type AS ENUM (
    'akeneo_schedule',
    'akeneo_manual',
    'other'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_custom_analytics_events_event_category AS ENUM (
    'ecommerce',
    'engagement',
    'conversion',
    'navigation',
    'custom'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_custom_analytics_events_trigger_type AS ENUM (
    'page_load',
    'click',
    'form_submit',
    'scroll',
    'timer',
    'custom',
    'automatic'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_custom_domains_ssl_status AS ENUM (
    'pending',
    'active',
    'failed',
    'expired',
    'renewing'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_custom_domains_verification_method AS ENUM (
    'txt',
    'cname',
    'http'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_custom_domains_verification_status AS ENUM (
    'pending',
    'verifying',
    'verified',
    'failed'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_customer_activities_activity_type AS ENUM (
    'page_view',
    'product_view',
    'add_to_cart',
    'remove_from_cart',
    'checkout_started',
    'order_completed',
    'search'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_customer_activities_device_type AS ENUM (
    'desktop',
    'tablet',
    'mobile'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_customer_addresses_type AS ENUM (
    'billing',
    'shipping',
    'both'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_customization_rollbacks_rollback_type AS ENUM (
    'full_rollback',
    'selective_rollback',
    'cherry_pick'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_customization_snapshots_change_type AS ENUM (
    'initial',
    'ai_modification',
    'manual_edit',
    'rollback',
    'merge'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_customization_snapshots_status AS ENUM (
    'open',
    'finalized'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_heatmap_interactions_device_type AS ENUM (
    'desktop',
    'tablet',
    'mobile'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_heatmap_interactions_interaction_type AS ENUM (
    'click',
    'hover',
    'scroll',
    'mouse_move',
    'touch',
    'focus',
    'key_press'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_heatmap_sessions_device_type AS ENUM (
    'desktop',
    'tablet',
    'mobile'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_hybrid_customizations_deployment_status AS ENUM (
    'draft',
    'deployed',
    'failed',
    'pending',
    'rolled_back'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_hybrid_customizations_status AS ENUM (
    'active',
    'archived',
    'rolled_back'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_integration_configs_connection_status AS ENUM (
    'untested',
    'success',
    'failed'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_integration_configs_sync_status AS ENUM (
    'idle',
    'syncing',
    'success',
    'error'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_job_history_status AS ENUM (
    'started',
    'progress_update',
    'completed',
    'failed',
    'retried',
    'cancelled'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_jobs_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_jobs_status AS ENUM (
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_marketplace_credentials_marketplace AS ENUM (
    'amazon',
    'ebay',
    'google_shopping',
    'facebook',
    'instagram'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_marketplace_credentials_status AS ENUM (
    'active',
    'inactive',
    'error',
    'testing'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_orders_fulfillment_status AS ENUM (
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_orders_payment_status AS ENUM (
    'pending',
    'paid',
    'partially_paid',
    'refunded',
    'failed'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_orders_status AS ENUM (
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_payment_methods_availability AS ENUM (
    'all',
    'specific_countries'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_payment_methods_fee_type AS ENUM (
    'fixed',
    'percentage',
    'none'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_payment_methods_payment_flow AS ENUM (
    'online',
    'offline'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_payment_methods_type AS ENUM (
    'credit_card',
    'debit_card',
    'paypal',
    'stripe',
    'bank_transfer',
    'cash_on_delivery',
    'other'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_product_labels_position AS ENUM (
    'top-left',
    'top-right',
    'top-center',
    'center-left',
    'center-right',
    'bottom-left',
    'bottom-right',
    'center',
    'bottom-center'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_product_tabs_tab_type AS ENUM (
    'text',
    'description',
    'attributes',
    'attribute_sets'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_products_status AS ENUM (
    'draft',
    'active',
    'inactive'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_products_type AS ENUM (
    'simple',
    'configurable',
    'bundle',
    'grouped',
    'virtual',
    'downloadable'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_products_visibility AS ENUM (
    'visible',
    'hidden'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_redirects_entity_type AS ENUM (
    'category',
    'product',
    'cms_page'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_redirects_type AS ENUM (
    '301',
    '302',
    '307',
    '308'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_sales_invoices_email_status AS ENUM (
    'sent',
    'failed',
    'bounced',
    'delivered'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_sales_orders_fulfillment_status AS ENUM (
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_sales_orders_payment_status AS ENUM (
    'pending',
    'paid',
    'partially_paid',
    'refunded',
    'failed'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_sales_orders_status AS ENUM (
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_sales_shipments_email_status AS ENUM (
    'sent',
    'failed',
    'bounced',
    'delivered'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_seo_templates_page_type AS ENUM (
    'home',
    'product',
    'category',
    'cms',
    'search',
    'cart',
    'checkout'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_seo_templates_type AS ENUM (
    'product',
    'category',
    'cms',
    'cms_page',
    'homepage',
    'brand',
    'blog_post'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_shipping_methods_availability AS ENUM (
    'all',
    'specific_countries'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_shipping_methods_type AS ENUM (
    'flat_rate',
    'free_shipping',
    'weight_based',
    'price_based'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_slot_configurations_status AS ENUM (
    'draft',
    'acceptance',
    'published',
    'reverted'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_snapshot_status AS ENUM (
    'open',
    'finalized'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_store_data_migrations_migration_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'paused'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_store_routes_route_type AS ENUM (
    'core',
    'custom',
    'cms_page',
    'product_detail',
    'category'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_store_routes_target_type AS ENUM (
    'component',
    'cms_page',
    'external_url',
    'redirect'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_store_supabase_connections_connection_status AS ENUM (
    'active',
    'inactive',
    'error'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- NOTE: store_teams is now in MASTER database (not tenant)

DO $$ BEGIN
    CREATE TYPE enum_store_templates_type AS ENUM (
    'category',
    'product',
    'checkout',
    'homepage',
    'custom'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_stores_deployment_status AS ENUM (
    'draft',
    'deployed',
    'published',
    'failed'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_deployment_status AS ENUM (
    'draft',
    'deploying'
    'deployed',
    'published',
    'failed'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_template_assets_asset_type AS ENUM (
    'javascript',
    'css',
    'image',
    'font',
    'other'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_users_account_type AS ENUM (
    'agency',
    'individual',
    'customer'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_users_role AS ENUM (
    'admin',
    'store_owner',
    'customer'
);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- SECTION 2: FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_heatmap_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_cms_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_cron_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- update_shopify_oauth_tokens_updated_at function REMOVED - table no longer exists

CREATE OR REPLACE FUNCTION update_plugin_admin_pages_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_plugin_admin_scripts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_increment_snapshot_distance()
RETURNS TRIGGER AS $$
BEGIN
  -- Set snapshot_distance to previous max + 1 if not provided
  IF NEW.snapshot_distance IS NULL THEN
    SELECT COALESCE(MAX(snapshot_distance), 0) + 1
    INTO NEW.snapshot_distance
    FROM plugin_version_history
    WHERE plugin_id = NEW.plugin_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ensure_single_current_version()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this version as current, unset all other current versions for this plugin
  IF NEW.is_current = true THEN
    UPDATE plugin_version_history
    SET is_current = false
    WHERE plugin_id = NEW.plugin_id
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_integration_attribute_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_product_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECTION 3: CREATE TABLES
-- All tables without foreign key constraints
-- ============================================

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url VARCHAR(255),
  banner_url VARCHAR(255),
  theme_color VARCHAR(255) DEFAULT '#3B82F6'::character varying,
  currency VARCHAR(255) DEFAULT 'USD'::character varying,
  timezone VARCHAR(255) DEFAULT 'UTC'::character varying,
  is_active BOOLEAN DEFAULT true,
  settings JSON DEFAULT '{}'::json,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(255),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(255),
  state VARCHAR(255),
  postal_code VARCHAR(255),
  country VARCHAR(255),
  website_url VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stripe_account_id VARCHAR(255),
  user_id UUID NOT NULL,
  deployment_status enum_deployment_status DEFAULT 'draft'::enum_deployment_status,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS _migrations (
  name VARCHAR(255) PRIMARY KEY,
  run_at TIMESTAMP DEFAULT NOW(),
  filename VARCHAR(255),
  executed_at TIMESTAMP DEFAULT NOW(),
  checksum VARCHAR(64),
  execution_time_ms INTEGER
);

CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID NOT NULL,
  store_id UUID NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  user_id UUID,
  variant_id VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255) NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  converted BOOLEAN DEFAULT false,
  converted_at TIMESTAMP WITH TIME ZONE,
  conversion_value NUMERIC,
  metrics JSON DEFAULT '{}'::json,
  device_type VARCHAR(255),
  user_agent TEXT,
  ip_address VARCHAR(255),
  metadata JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_test_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255) NOT NULL,
  patch_release_id UUID,
  traffic_percentage INTEGER DEFAULT 50 NOT NULL,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  conversion_goals JSONB DEFAULT '[]'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  hypothesis TEXT,
  status enum_ab_tests_status DEFAULT 'draft'::enum_ab_tests_status,
  variants JSON DEFAULT '[]'::json NOT NULL,
  traffic_allocation DOUBLE PRECISION DEFAULT '1'::double precision,
  targeting_rules JSON,
  primary_metric VARCHAR(255) NOT NULL,
  secondary_metrics JSON DEFAULT '[]'::json,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  min_sample_size INTEGER DEFAULT 100,
  confidence_level DOUBLE PRECISION DEFAULT '0.95'::double precision,
  winner_variant_id VARCHAR(255),
  metadata JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_navigation_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  icon VARCHAR(50),
  route VARCHAR(255),
  parent_key VARCHAR(100),
  order_position INTEGER DEFAULT 0,
  is_core BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  plugin_id UUID,
  category VARCHAR(50),
  required_permission VARCHAR(100),
  description TEXT,
  badge_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type VARCHAR(50) DEFAULT 'standard'::character varying
);

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    intent VARCHAR(50),
    data JSONB DEFAULT '{}',
    credits_used INTEGER DEFAULT 0,
    is_error BOOLEAN DEFAULT false,
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  model_used VARCHAR(100),
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_store_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE,

  -- Store classification
  detected_branch VARCHAR(100),
  branch_confidence NUMERIC(3,2),
  branch_tags JSONB DEFAULT '[]'::jsonb,

  -- Conversion insights
  conversion_insights JSONB DEFAULT '{}'::jsonb,

  -- Geographic insights
  geographic_insights JSONB DEFAULT '{}'::jsonb,

  -- Marketing insights
  marketing_insights JSONB DEFAULT '{}'::jsonb,

  -- Product insights
  product_insights JSONB DEFAULT '{}'::jsonb,

  -- Customer insights
  customer_insights JSONB DEFAULT '{}'::jsonb,

  last_analyzed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS akeneo_custom_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  mapping_type VARCHAR(50) NOT NULL,
  mappings JSON DEFAULT '[]'::json NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE TABLE IF NOT EXISTS import_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  import_type VARCHAR(50) NOT NULL, -- 'attributes', 'products', 'categories', 'customers', 'orders', etc.
  import_date TIMESTAMP DEFAULT NOW() NOT NULL,
  total_processed INTEGER DEFAULT 0 NOT NULL,
  successful_imports INTEGER DEFAULT 0 NOT NULL,
  failed_imports INTEGER DEFAULT 0 NOT NULL,
  skipped_imports INTEGER DEFAULT 0 NOT NULL,
  import_source VARCHAR(100) DEFAULT 'shopify'::character varying,
  import_method VARCHAR(50) DEFAULT 'manual'::character varying,
  error_details TEXT,
  processing_time_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS akeneo_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  akeneo_code VARCHAR(255) NOT NULL,
  akeneo_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  entity_slug VARCHAR(255),
  store_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  mapping_source VARCHAR(50) DEFAULT 'auto'::character varying,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS akeneo_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  import_type enum_akeneo_schedules_import_type NOT NULL,
  schedule_type enum_akeneo_schedules_schedule_type DEFAULT 'once'::enum_akeneo_schedules_schedule_type NOT NULL,
  schedule_time VARCHAR(50),
  schedule_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  filters JSONB DEFAULT '{}'::jsonb NOT NULL,
  options JSONB DEFAULT '{}'::jsonb NOT NULL,
  status enum_akeneo_schedules_status DEFAULT 'scheduled'::enum_akeneo_schedules_status NOT NULL,
  last_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  credit_cost NUMERIC DEFAULT 0.1 NOT NULL,
  last_credit_usage UUID
);

CREATE TABLE IF NOT EXISTS attribute_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  store_id UUID NOT NULL,
  attribute_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attribute_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  label VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(attribute_id, language_code)
);

CREATE TABLE IF NOT EXISTS attribute_value_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_value_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  value VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(attribute_value_id, language_code)
);

CREATE TABLE IF NOT EXISTS attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL,
  code VARCHAR(255) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  metadata JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL,
  type VARCHAR(20) DEFAULT 'text'::character varying,
  is_required BOOLEAN DEFAULT false,
  is_filterable BOOLEAN DEFAULT false,
  is_searchable BOOLEAN DEFAULT false,
  is_usable_in_conditions BOOLEAN DEFAULT false,
  filter_type VARCHAR(20),
  file_settings JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  store_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_configurable BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS integration_attribute_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External Platform Side
  integration_source VARCHAR(50) NOT NULL, -- 'shopify', 'magento', 'akeneo', 'woocommerce', 'bigcommerce', etc.
  external_attribute_code VARCHAR(255) NOT NULL, -- The attribute code/key from external platform
  external_attribute_name VARCHAR(255), -- Human-readable name from external platform
  external_attribute_type VARCHAR(50), -- Type in external system ('text', 'select', etc.)

  -- DainoStore Side (Internal)
  internal_attribute_id UUID NOT NULL,
  internal_attribute_code VARCHAR(255) NOT NULL, -- Denormalized for quick lookups

  -- Mapping Configuration
  is_active BOOLEAN DEFAULT true,
  mapping_direction VARCHAR(20) DEFAULT 'bidirectional' CHECK (mapping_direction IN ('import_only', 'export_only', 'bidirectional')),
  mapping_source VARCHAR(50) DEFAULT 'auto', -- 'auto' (system-detected), 'manual' (user-configured), 'ai' (AI-suggested)
  confidence_score DECIMAL(3,2) DEFAULT 1.00, -- For auto-mapped attributes (0.00-1.00)

  -- Value Transformation Rules (Optional)
  value_transformation JSONB DEFAULT '{}', -- Rules for transforming values between platforms

  -- Metadata
  store_id UUID NOT NULL,
  notes TEXT,
  last_used_at TIMESTAMP, -- Track when mapping was last used in import/export
  usage_count INTEGER DEFAULT 0, -- How many times this mapping has been used

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID, -- User who created the mapping

  -- Constraints
  UNIQUE(store_id, integration_source, external_attribute_code) -- One mapping per external attribute per source
);

CREATE TABLE IF NOT EXISTS blacklist_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  country_name VARCHAR(100),
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blacklist_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blacklist_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blacklist_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  block_by_ip BOOLEAN DEFAULT false,
  block_by_email BOOLEAN DEFAULT true,
  block_by_country BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- brevo_configurations table REMOVED - use integration_configs with integration_type='brevo'

CREATE TABLE IF NOT EXISTS canonical_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  page_url VARCHAR(255) NOT NULL,
  canonical_url VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255),
  store_id UUID NOT NULL,
  user_id UUID,
  items JSON DEFAULT '[]'::json,
  subtotal NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  shipping NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  coupon_code VARCHAR(255),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  slug VARCHAR(255) NOT NULL,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  hide_in_menu BOOLEAN DEFAULT false,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  meta_robots_tag VARCHAR(100) DEFAULT 'index, follow'::character varying,
  parent_id UUID,
  level INTEGER DEFAULT 0,
  path TEXT,
  product_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  akeneo_code VARCHAR(255),
  seo JSON DEFAULT '{}'::json
);

CREATE TABLE IF NOT EXISTS category_seo (
  category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10),
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords VARCHAR(500),
  meta_robots_tag VARCHAR(100) DEFAULT 'index, follow'::character varying,
  og_title VARCHAR(255),
  og_description TEXT,
  og_image_url VARCHAR(500),
  twitter_title VARCHAR(255),
  twitter_description TEXT,
  twitter_image_url VARCHAR(500),
  canonical_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS category_translations (
  category_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (category_id, language_code)
);

CREATE TABLE IF NOT EXISTS chat_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'offline'::character varying,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open'::character varying,
  assigned_agent_id UUID,
  started_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP,
  closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  message_text TEXT NOT NULL,
  sender_type VARCHAR(50) NOT NULL,
  sender_id UUID,
  sender_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID,
  user_type VARCHAR(50) NOT NULL,
  user_id UUID,
  is_typing BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_block_translations (
  cms_block_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  title VARCHAR(255),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (cms_block_id, language_code)
);

CREATE TABLE IF NOT EXISTS cms_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords VARCHAR(255),
  store_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  placement JSONB DEFAULT '["content"]'::jsonb
);

CREATE TABLE IF NOT EXISTS cms_page_seo (
  cms_page_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10),
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords VARCHAR(500),
  meta_robots_tag VARCHAR(100) DEFAULT 'index, follow'::character varying,
  og_title VARCHAR(255),
  og_description TEXT,
  og_image_url VARCHAR(500),
  twitter_title VARCHAR(255),
  twitter_description TEXT,
  twitter_image_url VARCHAR(500),
  canonical_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS cms_page_translations (
  cms_page_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  excerpt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (cms_page_id, language_code)
);

CREATE TABLE IF NOT EXISTS cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords VARCHAR(255),
  meta_robots_tag VARCHAR(50) DEFAULT 'index, follow'::character varying,
  store_id UUID NOT NULL,
  related_product_ids JSONB DEFAULT '[]'::jsonb,
  published_at TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_system BOOLEAN DEFAULT false,
  seo JSON DEFAULT '{}'::json
);

CREATE TABLE IF NOT EXISTS consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  user_id UUID,
  store_id UUID NOT NULL,
  ip_address VARCHAR(255),
  user_agent TEXT,
  consent_given BOOLEAN NOT NULL,
  categories_accepted JSON DEFAULT '[]'::json NOT NULL,
  country_code VARCHAR(2),
  consent_method enum_consent_logs_consent_method NOT NULL,
  page_url TEXT,
  created_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS cookie_consent_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN DEFAULT true,
  banner_position enum_cookie_consent_settings_banner_position DEFAULT 'bottom'::enum_cookie_consent_settings_banner_position,
  banner_text TEXT,
  privacy_policy_url VARCHAR(255),
  accept_button_text VARCHAR(255) DEFAULT 'Accept All'::character varying,
  reject_button_text VARCHAR(255) DEFAULT 'Reject All'::character varying,
  settings_button_text VARCHAR(255) DEFAULT 'Cookie Settings'::character varying,
  necessary_cookies BOOLEAN DEFAULT true,
  analytics_cookies BOOLEAN DEFAULT false,
  marketing_cookies BOOLEAN DEFAULT false,
  functional_cookies BOOLEAN DEFAULT false,
  theme enum_cookie_consent_settings_theme DEFAULT 'light'::enum_cookie_consent_settings_theme,
  primary_color VARCHAR(255) DEFAULT '#007bff'::character varying,
  background_color VARCHAR(255) DEFAULT '#ffffff'::character varying,
  text_color VARCHAR(255) DEFAULT '#333333'::character varying,
  gdpr_mode BOOLEAN DEFAULT true,
  auto_detect_country BOOLEAN DEFAULT true,
  audit_enabled BOOLEAN DEFAULT true,
  consent_expiry_days INTEGER DEFAULT 365,
  show_close_button BOOLEAN DEFAULT true,
  privacy_policy_text VARCHAR(255) DEFAULT 'Privacy Policy'::character varying,
  categories JSON,
  gdpr_countries JSON,
  google_analytics_id VARCHAR(255),
  google_tag_manager_id VARCHAR(255),
  custom_css TEXT,
  store_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  translations JSONB DEFAULT '{}'::jsonb,
  accept_button_bg_color VARCHAR(255) DEFAULT '#2563eb'::character varying,
  accept_button_text_color VARCHAR(255) DEFAULT '#ffffff'::character varying,
  reject_button_bg_color VARCHAR(255) DEFAULT '#ffffff'::character varying,
  reject_button_text_color VARCHAR(255) DEFAULT '#374151'::character varying,
  save_preferences_button_bg_color VARCHAR(255) DEFAULT '#16a34a'::character varying,
  save_preferences_button_text_color VARCHAR(255) DEFAULT '#ffffff'::character varying
);

CREATE TABLE IF NOT EXISTS cookie_consent_settings_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cookie_consent_settings_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  banner_text TEXT,
  accept_button_text VARCHAR(255),
  reject_button_text VARCHAR(255),
  settings_button_text VARCHAR(255),
  privacy_policy_text VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  necessary_name VARCHAR(255),
  necessary_description TEXT,
  analytics_name VARCHAR(255),
  analytics_description TEXT,
  marketing_name VARCHAR(255),
  marketing_description TEXT,
  functional_name VARCHAR(255),
  functional_description TEXT,
  save_preferences_button_text VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS coupon_translations (
  coupon_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10),
  name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) DEFAULT 'fixed'::character varying NOT NULL,
  discount_value NUMERIC NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER DEFAULT 100,
  usage_count INTEGER DEFAULT 0,
  min_purchase_amount NUMERIC,
  max_discount_amount NUMERIC,
  start_date DATE,
  end_date DATE,
  buy_quantity INTEGER DEFAULT 1,
  get_quantity INTEGER DEFAULT 1,
  store_id UUID NOT NULL,
  applicable_products JSONB DEFAULT '[]'::jsonb,
  applicable_categories JSONB DEFAULT '[]'::jsonb,
  applicable_skus JSONB DEFAULT '[]'::jsonb,
  applicable_attribute_sets JSONB DEFAULT '[]'::jsonb,
  applicable_attributes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  translations JSON DEFAULT '{}'::json
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  amount_usd NUMERIC NOT NULL,
  credits_purchased NUMERIC NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending'::character varying NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL,
  credits_used NUMERIC NOT NULL,
  usage_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cron_job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_job_id UUID NOT NULL,
  started_at TIMESTAMP DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  status VARCHAR(20) NOT NULL,
  result JSON,
  error_message TEXT,
  error_stack TEXT,
  triggered_by VARCHAR(50) DEFAULT 'scheduler'::character varying,
  triggered_by_user UUID,
  server_instance VARCHAR(100),
  memory_usage_mb NUMERIC,
  cpu_time_ms INTEGER,
  metadata JSON DEFAULT '{}'::json
);

CREATE TABLE IF NOT EXISTS cron_job_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  configuration_schema JSON NOT NULL,
  default_configuration JSON DEFAULT '{}'::json,
  is_enabled BOOLEAN DEFAULT true,
  category VARCHAR(100) DEFAULT 'general'::character varying,
  icon VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cron_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Scheduling
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Job configuration
  job_type VARCHAR(100) NOT NULL, -- 'webhook', 'email', 'plugin_job', 'akeneo_import', 'shopify_sync', 'system_job'
  configuration JSONB NOT NULL DEFAULT '{}',

  -- Source tracking (for unified scheduler)
  source_type VARCHAR(20) DEFAULT 'user', -- 'user', 'plugin', 'integration', 'system'
  source_id UUID, -- Reference to plugin_id, akeneo_schedule_id, etc.
  source_name VARCHAR(100), -- Human-readable source name
  handler VARCHAR(255), -- Handler method name for plugin/integration jobs

  -- Ownership (nullable for plugin/system jobs)
  user_id UUID, -- NULL for plugin/system jobs
  store_id UUID,

  -- Status and control
  is_active BOOLEAN DEFAULT true,
  is_paused BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,

  -- Execution tracking
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_status VARCHAR(20), -- 'success', 'failed', 'running', 'skipped'
  last_error TEXT,
  last_result JSONB,

  -- Limits and controls
  max_runs INTEGER, -- NULL for unlimited
  max_failures INTEGER DEFAULT 5,
  consecutive_failures INTEGER DEFAULT 0,
  timeout_seconds INTEGER DEFAULT 300,

  -- Metadata
  tags VARCHAR(500),
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  event_category enum_custom_analytics_events_event_category DEFAULT 'custom'::enum_custom_analytics_events_event_category,
  trigger_type enum_custom_analytics_events_trigger_type NOT NULL,
  trigger_selector VARCHAR(255),
  trigger_condition JSON,
  event_parameters JSON DEFAULT '{}'::json NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,
  is_system BOOLEAN DEFAULT false,
  fire_once_per_session BOOLEAN DEFAULT false,
  send_to_backend BOOLEAN DEFAULT true,
  metadata JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  domain VARCHAR(255) NOT NULL,
  subdomain VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  dns_configured BOOLEAN DEFAULT false,
  dns_provider VARCHAR(100),
  verification_status enum_custom_domains_verification_status DEFAULT 'pending'::enum_custom_domains_verification_status,
  verification_method enum_custom_domains_verification_method DEFAULT 'txt'::enum_custom_domains_verification_method,
  verification_token VARCHAR(255),
  verification_record_name VARCHAR(255),
  verification_record_value VARCHAR(500),
  verified_at TIMESTAMP WITH TIME ZONE,
  ssl_status enum_custom_domains_ssl_status DEFAULT 'pending'::enum_custom_domains_ssl_status,
  ssl_provider VARCHAR(50) DEFAULT 'letsencrypt'::character varying,
  ssl_certificate_id VARCHAR(255),
  ssl_issued_at TIMESTAMP WITH TIME ZONE,
  ssl_expires_at TIMESTAMP WITH TIME ZONE,
  ssl_auto_renew BOOLEAN DEFAULT true,
  dns_records JSONB DEFAULT '[]'::jsonb,
  cname_target VARCHAR(255),
  redirect_to_https BOOLEAN DEFAULT true,
  redirect_to_primary BOOLEAN DEFAULT false,
  is_redirect BOOLEAN DEFAULT false,
  redirect_to VARCHAR(255),
  custom_headers JSONB DEFAULT '{}'::jsonb,
  custom_rewrites JSONB DEFAULT '[]'::jsonb,
  cdn_enabled BOOLEAN DEFAULT false,
  cdn_provider VARCHAR(50),
  cdn_config JSONB DEFAULT '{}'::jsonb,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_option_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  display_label VARCHAR(255) DEFAULT 'Custom Options'::character varying,
  is_active BOOLEAN DEFAULT true,
  conditions JSONB DEFAULT '{}'::jsonb,
  optional_product_ids JSONB DEFAULT '[]'::jsonb,
  store_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  translations JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS custom_pricing_discounts (
  id INTEGER PRIMARY KEY,
  rule_id INTEGER,
  discount_type VARCHAR(50) NOT NULL,
  discount_value NUMERIC,
  minimum_amount NUMERIC,
  minimum_quantity INTEGER,
  applies_to VARCHAR(50) DEFAULT 'item'::character varying,
  conditions JSONB DEFAULT '{}'::jsonb,
  stackable BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_pricing_logs (
  id INTEGER PRIMARY KEY,
  rule_id INTEGER,
  event_type VARCHAR(50),
  original_price NUMERIC,
  final_price NUMERIC,
  discount_amount NUMERIC DEFAULT 0,
  customer_id VARCHAR(255),
  product_id VARCHAR(255),
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_pricing_rules (
  id INTEGER PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,
  conditions JSONB DEFAULT '{}'::jsonb,
  actions JSONB DEFAULT '{}'::jsonb,
  store_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  store_id UUID NOT NULL,
  user_id UUID,
  activity_type enum_customer_activities_activity_type NOT NULL,
  page_url VARCHAR(255),
  referrer VARCHAR(255),
  product_id UUID,
  search_query VARCHAR(255),
  user_agent TEXT,
  ip_address VARCHAR(255),
  metadata JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  country VARCHAR(2),
  country_name VARCHAR(100),
  city VARCHAR(100),
  region VARCHAR(100),
  language VARCHAR(10),
  timezone VARCHAR(50),
  device_type VARCHAR(20),
  browser_name VARCHAR(100),
  operating_system VARCHAR(100),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type enum_customer_addresses_type DEFAULT 'both'::enum_customer_addresses_type NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  street VARCHAR(255) NOT NULL,
  street_2 VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  postal_code VARCHAR(255) NOT NULL,
  country VARCHAR(255) DEFAULT 'US'::character varying NOT NULL,
  phone VARCHAR(255),
  email VARCHAR(255),
  is_default BOOLEAN DEFAULT false NOT NULL,
  user_id UUID,
  customer_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE,
  gender VARCHAR(10),
  notes TEXT,
  total_spent NUMERIC DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  average_order_value NUMERIC DEFAULT 0,
  last_order_date TIMESTAMP,
  tags JSONB DEFAULT '[]'::jsonb,
  addresses JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  password VARCHAR(255),
  avatar_url VARCHAR(255),
  last_login TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  role VARCHAR(50) DEFAULT 'customer'::character varying,
  account_type VARCHAR(50) DEFAULT 'individual'::character varying,
  customer_type VARCHAR(20) DEFAULT 'guest'::character varying NOT NULL,
  is_blacklisted BOOLEAN DEFAULT false,
  blacklist_reason TEXT,
  blacklisted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enable_delivery_date BOOLEAN DEFAULT true,
  enable_comments BOOLEAN DEFAULT true,
  offset_days INTEGER DEFAULT 1,
  max_advance_days INTEGER DEFAULT 30,
  blocked_dates JSONB DEFAULT '[]'::jsonb,
  blocked_weekdays JSONB DEFAULT '[]'::jsonb,
  out_of_office_start DATE,
  out_of_office_end DATE,
  delivery_time_slots JSONB DEFAULT '[{"end_time": "12:00", "is_active": true, "start_time": "09:00"}, {"end_time": "17:00", "is_active": true, "start_time": "13:00"}]'::jsonb,
  store_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  email_template_id UUID,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending'::character varying NOT NULL,
  brevo_message_id VARCHAR(255),
  error_message TEXT,
  metadata JSON DEFAULT '{}'::json,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_template_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_template_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  template_content TEXT,
  html_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  identifier VARCHAR(100) NOT NULL,
  content_type VARCHAR(20) DEFAULT 'template'::character varying NOT NULL,
  variables JSON DEFAULT '[]'::json,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  attachment_enabled BOOLEAN DEFAULT false,
  attachment_config JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_system BOOLEAN DEFAULT false NOT NULL,
  default_subject VARCHAR(255),
  default_template_content TEXT,
  default_html_content TEXT
);

CREATE TABLE IF NOT EXISTS heatmap_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  page_url TEXT NOT NULL,
  aggregation_period VARCHAR(20) NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  viewport_width INTEGER NOT NULL,
  viewport_height INTEGER NOT NULL,
  interaction_type VARCHAR(50) NOT NULL,
  x_coordinate INTEGER NOT NULL,
  y_coordinate INTEGER NOT NULL,
  interaction_count INTEGER DEFAULT 1 NOT NULL,
  unique_sessions INTEGER DEFAULT 1 NOT NULL,
  avg_time_on_element NUMERIC,
  device_breakdown JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heatmap_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  store_id UUID NOT NULL,
  user_id UUID,
  page_url TEXT NOT NULL,
  page_title VARCHAR(500),
  viewport_width INTEGER NOT NULL,
  viewport_height INTEGER NOT NULL,
  interaction_type VARCHAR(50) NOT NULL,
  x_coordinate INTEGER,
  y_coordinate INTEGER,
  element_selector TEXT,
  element_tag VARCHAR(50),
  element_id VARCHAR(255),
  element_class VARCHAR(500),
  element_text TEXT,
  scroll_position INTEGER,
  scroll_depth_percent NUMERIC,
  time_on_element INTEGER,
  device_type VARCHAR(20),
  user_agent TEXT,
  ip_address INET,
  timestamp_utc TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS heatmap_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  store_id UUID NOT NULL,
  user_id UUID,
  first_page_url TEXT,
  last_page_url TEXT,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  total_duration INTEGER,
  page_count INTEGER DEFAULT 1,
  interaction_count INTEGER DEFAULT 0,
  bounce_session BOOLEAN DEFAULT false,
  conversion_session BOOLEAN DEFAULT false,
  device_type VARCHAR(20),
  browser_name VARCHAR(100),
  operating_system VARCHAR(100),
  referrer_url TEXT,
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  country VARCHAR(100),
  region VARCHAR(100),
  city VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  integration_type VARCHAR(50) NOT NULL,
  config_key VARCHAR(100) DEFAULT 'default',
  config_data JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  display_name VARCHAR(255),
  -- OAuth token management
  token_expires_at TIMESTAMP WITH TIME ZONE,
  last_token_refresh_at TIMESTAMP WITH TIME ZONE,
  oauth_scopes TEXT,
  -- Sync tracking
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status enum_integration_configs_sync_status DEFAULT 'idle'::enum_integration_configs_sync_status,
  sync_error TEXT,
  -- Connection tracking
  connection_status VARCHAR(20) DEFAULT 'untested'::character varying,
  connection_tested_at TIMESTAMP WITH TIME ZONE,
  connection_error TEXT,
  -- Usage tracking (for storage integrations)
  total_files INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL,
  message TEXT,
  progress NUMERIC,
  result JSON,
  error JSON,
  metadata JSON DEFAULT '{}'::json NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(255) NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal'::character varying NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'::character varying NOT NULL,
  payload JSON DEFAULT '{}'::json NOT NULL,
  result JSON,
  scheduled_at TIMESTAMP DEFAULT NOW() NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  max_retries INTEGER DEFAULT 3 NOT NULL,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  last_error TEXT,
  store_id UUID,
  user_id UUID,
  metadata JSON DEFAULT '{}'::json NOT NULL,
  progress NUMERIC DEFAULT 0,
  progress_message VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  native_name VARCHAR(255),
  flag VARCHAR(255),
  is_rtl BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  translations JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  action VARCHAR(50) DEFAULT 'login'::character varying,
  success BOOLEAN DEFAULT false,
  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  folder VARCHAR(100) DEFAULT 'library'::character varying,
  tags JSON DEFAULT '{}'::json,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_by UUID,
  usage_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_method_translations (
  payment_method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(255) NOT NULL,
  type enum_payment_methods_type DEFAULT 'credit_card'::enum_payment_methods_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  description TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  fee_type enum_payment_methods_fee_type DEFAULT 'none'::enum_payment_methods_fee_type,
  fee_amount NUMERIC DEFAULT 0,
  min_amount NUMERIC,
  max_amount NUMERIC,
  availability enum_payment_methods_availability DEFAULT 'all'::enum_payment_methods_availability,
  countries JSONB DEFAULT '[]'::jsonb,
  store_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  conditions JSONB DEFAULT '{}'::jsonb,
  payment_flow VARCHAR(20) DEFAULT 'offline'::character varying,
  icon_url TEXT
);

CREATE TABLE IF NOT EXISTS pdf_template_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_template_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  html_template TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  identifier VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  template_type VARCHAR(50) NOT NULL,
  default_html_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  variables JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_admin_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255) NOT NULL,
  page_key VARCHAR(255) NOT NULL,
  page_name VARCHAR(255) NOT NULL,
  route VARCHAR(500) NOT NULL,
  component_code TEXT NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  category VARCHAR(100),
  order_position INTEGER DEFAULT 100,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_admin_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255) NOT NULL,
  script_name VARCHAR(255) NOT NULL,
  script_code TEXT NOT NULL,
  description TEXT,
  load_order INTEGER DEFAULT 100,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255),
  store_id UUID,
  is_enabled BOOLEAN DEFAULT false,
  config_data JSONB DEFAULT '{}'::jsonb,
  last_configured_by UUID,
  last_configured_at TIMESTAMP WITH TIME ZONE,
  enabled_at TIMESTAMP WITH TIME ZONE,
  disabled_at TIMESTAMP WITH TIME ZONE,
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_status VARCHAR(50),
  error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255) NOT NULL,
  data_key VARCHAR(255) NOT NULL,
  data_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_dependencies (
  id INTEGER PRIMARY KEY,
  plugin_id VARCHAR(255),
  package_name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  bundled_code TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  doc_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  content TEXT NOT NULL,
  format VARCHAR(20) DEFAULT 'markdown'::character varying,
  description TEXT,
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  description TEXT,
  schema_definition JSONB NOT NULL,
  migration_status VARCHAR(50) DEFAULT 'pending'::character varying,
  migration_version VARCHAR(50),
  migrated_at TIMESTAMP WITH TIME ZONE,
  create_table_sql TEXT,
  drop_table_sql TEXT,
  model_code TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  listener_function TEXT NOT NULL,
  priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS plugin_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255) NOT NULL,
  hook_name VARCHAR(255) NOT NULL,
  hook_type VARCHAR(20) DEFAULT 'filter'::character varying NOT NULL,
  handler_function TEXT NOT NULL,
  priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_cron (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  cron_name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_schedule VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  handler_method VARCHAR(255) NOT NULL,
  handler_code TEXT,
  handler_params JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_status VARCHAR(50),
  last_error TEXT,
  last_result JSONB,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  max_runs INTEGER,
  max_failures INTEGER DEFAULT 5,
  timeout_seconds INTEGER DEFAULT 300,
  cron_job_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  long_description TEXT,
  author_id UUID,
  author_name VARCHAR(255),
  category VARCHAR(100),
  pricing_model VARCHAR(50) DEFAULT 'free'::character varying NOT NULL,
  base_price NUMERIC DEFAULT 0.00,
  monthly_price NUMERIC,
  yearly_price NUMERIC,
  currency VARCHAR(3) DEFAULT 'USD'::character varying,
  license_type VARCHAR(50) DEFAULT 'per_store'::character varying,
  trial_days INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending'::character varying,
  downloads INTEGER DEFAULT 0,
  active_installations INTEGER DEFAULT 0,
  rating NUMERIC DEFAULT 0.00,
  reviews_count INTEGER DEFAULT 0,
  icon_url TEXT,
  screenshots JSONB DEFAULT '[]'::jsonb,
  plugin_structure JSONB,
  dependencies JSONB DEFAULT '[]'::jsonb,
  requirements JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS plugin_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  plugin_name VARCHAR(255) NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  migration_version VARCHAR(50) NOT NULL,
  migration_description TEXT,
  status VARCHAR(50) DEFAULT 'pending'::character varying,
  executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  execution_time_ms INTEGER,
  error_message TEXT,
  checksum VARCHAR(64),
  up_sql TEXT,
  down_sql TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_registry (
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'custom'::character varying,
  category VARCHAR(50) DEFAULT 'utility'::character varying,
  author VARCHAR(255),
  status VARCHAR(50) DEFAULT 'inactive'::character varying,
  security_level VARCHAR(50) DEFAULT 'sandboxed'::character varying,
  framework VARCHAR(50) DEFAULT 'react'::character varying,
  manifest JSONB DEFAULT '{}'::jsonb,
  permissions JSONB DEFAULT '[]'::jsonb,
  dependencies JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  installed_at TIMESTAMP DEFAULT NOW(),
  last_activated TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID,
  is_installed BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT false,
  slug VARCHAR(255),
  is_starter_template BOOLEAN DEFAULT false,
  starter_icon VARCHAR(10),
  starter_description TEXT,
  starter_prompt TEXT,
  starter_order INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  deprecated_at TIMESTAMP,
  deprecation_reason TEXT
);

CREATE TABLE IF NOT EXISTS plugin_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id VARCHAR(255) NOT NULL,
  script_type VARCHAR(20) NOT NULL,
  scope VARCHAR(20) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_content TEXT NOT NULL,
  load_priority INTEGER DEFAULT 10,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_version_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  from_version_id UUID NOT NULL,
  to_version_id UUID NOT NULL,
  files_changed INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,
  components_added INTEGER DEFAULT 0,
  components_modified INTEGER DEFAULT 0,
  components_deleted INTEGER DEFAULT 0,
  diff_summary JSONB,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cache_ttl INTEGER DEFAULT 3600
);

CREATE TABLE IF NOT EXISTS plugin_version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  version_number VARCHAR(50) NOT NULL,
  version_type VARCHAR(20) DEFAULT 'patch'::character varying NOT NULL,
  parent_version_id UUID,
  commit_message TEXT,
  changelog TEXT,
  created_by UUID,
  created_by_name VARCHAR(255),
  is_current BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  snapshot_distance INTEGER DEFAULT 0,
  files_changed INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS plugin_version_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL,
  plugin_id UUID NOT NULL,
  component_type VARCHAR(50) NOT NULL,
  component_id UUID,
  component_name VARCHAR(255),
  patch_operations JSONB NOT NULL,
  change_type VARCHAR(20),
  reverse_patch JSONB,
  operations_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_version_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL,
  plugin_id UUID NOT NULL,
  snapshot_data JSONB NOT NULL,
  hooks JSONB,
  events JSONB,
  scripts JSONB,
  widgets JSONB,
  controllers JSONB,
  entities JSONB,
  migrations JSONB,
  admin_pages JSONB,
  manifest JSONB,
  registry JSONB,
  is_compressed BOOLEAN DEFAULT false,
  compression_type VARCHAR(20),
  total_size_bytes INTEGER,
  compressed_size_bytes INTEGER,
  component_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_version_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL,
  plugin_id UUID NOT NULL,
  tag_name VARCHAR(100) NOT NULL,
  tag_type VARCHAR(50),
  description TEXT,
  created_by UUID,
  created_by_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  widget_id VARCHAR(255) NOT NULL,
  widget_name VARCHAR(255) NOT NULL,
  description TEXT,
  component_code TEXT NOT NULL,
  default_config JSONB DEFAULT '{}'::jsonb,
  category VARCHAR(100),
  icon VARCHAR(50),
  preview_image TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  author VARCHAR(255),
  category VARCHAR(100),
  type VARCHAR(50) DEFAULT 'plugin'::character varying,
  source_type VARCHAR(50) DEFAULT 'local'::character varying,
  source_url TEXT,
  install_path VARCHAR(500),
  status VARCHAR(50) DEFAULT 'available'::character varying,
  is_installed BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT false,
  config_schema JSONB,
  config_data JSONB DEFAULT '{}'::jsonb,
  dependencies JSONB DEFAULT '[]'::jsonb,
  permissions JSONB DEFAULT '[]'::jsonb,
  manifest JSONB,
  installation_log TEXT,
  last_health_check TIMESTAMP WITH TIME ZONE,
  health_status VARCHAR(50),
  installed_at TIMESTAMP WITH TIME ZONE,
  enabled_at TIMESTAMP WITH TIME ZONE,
  disabled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  attribute_id UUID NOT NULL,
  value_id UUID,
  text_value TEXT,
  number_value NUMERIC,
  date_value TIMESTAMP WITH TIME ZONE,
  boolean_value BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_label_translations (
  product_label_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10),
  name VARCHAR(255),
  text VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS product_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  text VARCHAR(255) NOT NULL,
  color VARCHAR(255) DEFAULT '#000000'::character varying,
  background_color VARCHAR(255) DEFAULT '#FFFFFF'::character varying,
  position enum_product_labels_position DEFAULT 'top-left'::enum_product_labels_position,
  is_active BOOLEAN DEFAULT true,
  conditions JSON DEFAULT '{}'::json,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sort_order INTEGER DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS product_seo (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10),
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords VARCHAR(500),
  meta_robots_tag VARCHAR(100) DEFAULT 'index, follow'::character varying,
  og_title VARCHAR(255),
  og_description TEXT,
  og_image_url VARCHAR(500),
  twitter_title VARCHAR(255),
  twitter_description TEXT,
  twitter_image_url VARCHAR(500),
  canonical_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS product_tab_translations (
  product_tab_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10),
  name VARCHAR(255) NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS product_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  content TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tab_type VARCHAR(20) DEFAULT 'text'::character varying NOT NULL,
  attribute_ids JSONB DEFAULT '[]'::jsonb,
  attribute_set_ids JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS product_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  short_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(product_id, language_code)
);

CREATE TABLE IF NOT EXISTS product_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) DEFAULT 'image' CHECK (file_type IN ('image', 'video', 'document', '3d_model', 'pdf')),
  position INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  alt_text TEXT,
  title TEXT,
  file_size INTEGER, -- bytes
  mime_type VARCHAR(100),
  metadata JSONB DEFAULT '{}', -- Extra data: width, height, duration, shopify_id, akeneo_code, thumbnail_url, etc.
  store_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id UUID NOT NULL,
  variant_product_id UUID NOT NULL,
  attribute_values JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(255) NOT NULL,
  sku VARCHAR(255) NOT NULL,
  barcode VARCHAR(255),
  short_description TEXT,
  price NUMERIC,
  compare_price NUMERIC,
  cost_price NUMERIC,
  weight NUMERIC,
  dimensions JSONB,
  images JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) DEFAULT 'draft'::character varying,
  visibility VARCHAR(20) DEFAULT 'visible'::character varying,
  manage_stock BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  allow_backorders BOOLEAN DEFAULT false,
  low_stock_threshold INTEGER DEFAULT 5,
  infinite_stock BOOLEAN DEFAULT false,
  is_custom_option BOOLEAN DEFAULT false,
  is_coupon_eligible BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  tags JSONB DEFAULT '[]'::jsonb,
  attributes JSONB DEFAULT '{}'::jsonb,
  seo JSONB DEFAULT '{}'::jsonb,
  store_id UUID NOT NULL,
  attribute_set_id UUID,
  category_ids JSONB DEFAULT '[]'::jsonb,
  related_product_ids JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  purchase_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type VARCHAR(50) DEFAULT 'simple'::character varying,
  parent_id UUID,
  configurable_attributes JSONB DEFAULT '[]'::jsonb,
  external_id VARCHAR(255),
  external_source VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  from_url VARCHAR(500) NOT NULL,
  to_url VARCHAR(500) NOT NULL,
  type VARCHAR(3) DEFAULT '301'::character varying NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  entity_type VARCHAR(50),
  entity_id UUID,
  created_by UUID,
  notes TEXT,
  hit_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(255) NOT NULL,
  order_id UUID NOT NULL,
  store_id UUID NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  pdf_generated BOOLEAN DEFAULT false,
  pdf_url TEXT,
  email_status enum_sales_invoices_email_status DEFAULT 'sent'::enum_sales_invoices_email_status,
  error_message TEXT,
  metadata JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quantity INTEGER DEFAULT 1 NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(255) NOT NULL,
  product_image VARCHAR(255),
  product_attributes JSON DEFAULT '{}'::json,
  selected_options JSON DEFAULT '[]'::json,
  original_price NUMERIC,
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(255) NOT NULL,
  status enum_sales_orders_status DEFAULT 'pending'::enum_sales_orders_status,
  payment_status enum_sales_orders_payment_status DEFAULT 'pending'::enum_sales_orders_payment_status,
  fulfillment_status enum_sales_orders_fulfillment_status DEFAULT 'pending'::enum_sales_orders_fulfillment_status,
  customer_id UUID,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(255),
  billing_address JSON NOT NULL,
  shipping_address JSON NOT NULL,
  subtotal NUMERIC DEFAULT 0 NOT NULL,
  tax_amount NUMERIC DEFAULT 0 NOT NULL,
  shipping_amount NUMERIC DEFAULT 0 NOT NULL,
  discount_amount NUMERIC DEFAULT 0 NOT NULL,
  payment_fee_amount NUMERIC DEFAULT 0 NOT NULL,
  total_amount NUMERIC NOT NULL,
  currency VARCHAR(255) DEFAULT 'USD'::character varying NOT NULL,
  delivery_date TIMESTAMP WITH TIME ZONE,
  delivery_time_slot VARCHAR(255),
  delivery_instructions TEXT,
  payment_method VARCHAR(255),
  payment_reference VARCHAR(255),
  shipping_method VARCHAR(255),
  tracking_number VARCHAR(255),
  coupon_code VARCHAR(255),
  notes TEXT,
  admin_notes TEXT,
  confirmation_email_sent_at TIMESTAMP WITH TIME ZONE,
  store_id UUID NOT NULL,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number VARCHAR(255) NOT NULL,
  order_id UUID NOT NULL,
  store_id UUID NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  tracking_number VARCHAR(255),
  tracking_url TEXT,
  carrier VARCHAR(255),
  shipping_method VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE,
  estimated_delivery_date TIMESTAMP WITH TIME ZONE,
  actual_delivery_date TIMESTAMP WITH TIME ZONE,
  email_status enum_sales_shipments_email_status DEFAULT 'sent'::enum_sales_shipments_email_status,
  error_message TEXT,
  metadata JSON DEFAULT '{}'::json,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  robots_txt_content TEXT,
  hreflang_settings JSONB DEFAULT '[]'::jsonb,
  social_media_settings JSON DEFAULT '{"open_graph":{"enabled":true,"default_title":"","default_description":"","default_image_url":"","facebook_app_id":"","facebook_page_url":""},"twitter":{"enabled":true,"card_type":"summary_large_image","site_username":"","creator_username":""},"social_profiles":{"facebook":"","twitter":"","instagram":"","linkedin":"","youtube":"","pinterest":"","tiktok":"","other":[]},"schema":{"enable_product_schema":true,"enable_organization_schema":true,"enable_breadcrumb_schema":true,"organization_name":"","organization_logo_url":"","organization_description":"","contact_type":"customer service","contact_telephone":"","contact_email":"","price_range":"","founded_year":"","founder_name":""}}'::json,
  xml_sitemap_settings JSON DEFAULT '{"enabled":true,"include_products":true,"include_categories":true,"include_pages":true,"include_images":false,"include_videos":false,"enable_news":false,"enable_index":false,"max_urls":50000,"google_search_console_api_key":"","auto_submit":false,"category_priority":"0.8","category_changefreq":"weekly","product_priority":"0.7","product_changefreq":"daily","page_priority":"0.6","page_changefreq":"monthly"}'::json,
  html_sitemap_settings JSON DEFAULT '{"enabled":true,"include_products":true,"include_categories":true,"include_pages":true,"max_products":20,"product_sort":"-updated_date"}'::json,
  default_meta_settings JSON DEFAULT '{"meta_title":"","meta_description":"","meta_keywords":"","meta_robots":"index, follow"}'::json,
  canonical_settings JSONB DEFAULT '{"base_url": "", "auto_canonical_filtered_pages": true}'::jsonb,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS seo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type enum_seo_templates_type NOT NULL,
  meta_title VARCHAR(255),
  meta_description TEXT,
  meta_keywords TEXT,
  og_title VARCHAR(255),
  og_description TEXT,
  sort_order INTEGER DEFAULT 0,
  conditions JSON DEFAULT '{"categories":[],"attribute_sets":[]}'::json,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  template JSON DEFAULT '{}'::json
);

CREATE TABLE IF NOT EXISTS shipping_method_translations (
  shipping_method_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code VARCHAR(10),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  type VARCHAR(20) DEFAULT 'flat_rate'::character varying NOT NULL,
  flat_rate_cost NUMERIC DEFAULT 0,
  free_shipping_min_order NUMERIC DEFAULT 0,
  weight_ranges JSONB DEFAULT '[]'::jsonb,
  price_ranges JSONB DEFAULT '[]'::jsonb,
  availability VARCHAR(20) DEFAULT 'all'::character varying,
  countries JSONB DEFAULT '[]'::jsonb,
  min_delivery_days INTEGER DEFAULT 1,
  max_delivery_days INTEGER DEFAULT 7,
  store_id UUID NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  translations JSON DEFAULT '{}'::json,
  conditions JSONB DEFAULT '{}'::jsonb
);

-- shopify_oauth_tokens table REMOVED - use integration_configs with integration_type='shopify'

CREATE TABLE IF NOT EXISTS slot_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL,
  configuration JSONB NOT NULL,
  version VARCHAR(255) DEFAULT '1.0'::character varying NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  status VARCHAR(20) DEFAULT 'init'::character varying NOT NULL,
  version_number INTEGER DEFAULT 1 NOT NULL,
  page_type VARCHAR(255) DEFAULT 'cart'::character varying,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID,
  acceptance_published_at TIMESTAMP WITH TIME ZONE,
  acceptance_published_by UUID,
  current_edit_id UUID,
  parent_version_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  has_unpublished_changes BOOLEAN DEFAULT false NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- NOTE: store_teams table moved to MASTER database

CREATE TABLE IF NOT EXISTS store_uptime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  user_id UUID NOT NULL,
  charged_date DATE DEFAULT CURRENT_DATE NOT NULL,
  credits_charged NUMERIC DEFAULT 1.00 NOT NULL,
  user_balance_before NUMERIC,
  user_balance_after NUMERIC,
  store_name VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, charged_date)
);

-- CREATE TABLE IF NOT EXISTS subscriptions (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   store_id UUID NOT NULL,
--   plan_name VARCHAR(50) NOT NULL,
--   status VARCHAR(50) DEFAULT 'trial'::character varying NOT NULL,
--   price_monthly NUMERIC,
--   price_annual NUMERIC,
--   billing_cycle VARCHAR(20) DEFAULT 'monthly'::character varying,
--   currency VARCHAR(3) DEFAULT 'USD'::character varying,
--   max_products INTEGER,
--   max_orders_per_month INTEGER,
--   max_storage_gb INTEGER,
--   max_api_calls_per_month INTEGER,
--   max_admin_users INTEGER DEFAULT 5,
--   started_at TIMESTAMP WITH TIME ZONE NOT NULL,
--   trial_ends_at TIMESTAMP WITH TIME ZONE,
--   current_period_start TIMESTAMP WITH TIME ZONE,
--   current_period_end TIMESTAMP WITH TIME ZONE,
--   cancelled_at TIMESTAMP WITH TIME ZONE,
--   cancellation_reason TEXT,
--   metadata JSONB DEFAULT '{}'::jsonb,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   updated_at TIMESTAMP WITH TIME ZONE NOT NULL
-- );

-- ============================================
-- REMOVED: supabase_oauth_tokens, supabase_project_keys, and store_media_storages tables
-- All integration configs (including storage) now use integration_configs table
-- Use integration_type: 'supabase-oauth', 'supabase-keys', 'supabase-storage', 'aws-s3', etc.
-- ============================================

CREATE TABLE IF NOT EXISTS taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  country_rates JSONB DEFAULT '[]'::jsonb,
  store_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tax_translations (
  tax_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (tax_id, language_code)
);

CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  value TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'common'::character varying,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type VARCHAR(20) DEFAULT 'system'::character varying NOT NULL,
  store_id UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  metric_hour INTEGER,
  products_created INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_deleted INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  categories_created INTEGER DEFAULT 0,
  categories_updated INTEGER DEFAULT 0,
  orders_created INTEGER DEFAULT 0,
  orders_completed INTEGER DEFAULT 0,
  orders_cancelled INTEGER DEFAULT 0,
  orders_total_value NUMERIC DEFAULT 0,
  orders_avg_value NUMERIC DEFAULT 0,
  customers_new INTEGER DEFAULT 0,
  customers_returning INTEGER DEFAULT 0,
  storage_uploaded_bytes BIGINT DEFAULT 0,
  storage_deleted_bytes BIGINT DEFAULT 0,
  storage_total_bytes BIGINT DEFAULT 0,
  storage_files_count INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  api_errors INTEGER DEFAULT 0,
  api_avg_response_time_ms INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  phone VARCHAR(255),
  avatar_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP WITH TIME ZONE,
  last_login TIMESTAMP WITH TIME ZONE,
  role VARCHAR(20) DEFAULT 'customer'::character varying,
  account_type VARCHAR(20) DEFAULT 'individual'::character varying,
--   credits NUMERIC DEFAULT 0.00,
  last_credit_deduction_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255),
  store_id UUID NOT NULL,
  user_id UUID,
  product_id UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SECTION 4: CREATE INDEXES
-- ============================================

-- Languages unique constraint (required for FK references)
CREATE UNIQUE INDEX IF NOT EXISTS idx_languages_code ON languages(code);

-- Admin navigation registry key constraint (required for self-referencing FK)
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_nav_key ON admin_navigation_registry(key);

CREATE INDEX IF NOT EXISTS idx_integration_attr_lookup ON integration_attribute_mappings(store_id, integration_source, external_attribute_code, is_active);

CREATE INDEX IF NOT EXISTS idx_integration_attr_internal ON integration_attribute_mappings(internal_attribute_id);

CREATE INDEX IF NOT EXISTS idx_integration_attr_source ON integration_attribute_mappings(integration_source, is_active);

CREATE INDEX IF NOT EXISTS idx_product_translations_product_id ON product_translations(product_id);

CREATE INDEX IF NOT EXISTS idx_product_translations_language ON product_translations(language_code);

CREATE INDEX IF NOT EXISTS idx_product_files_product ON product_files(product_id, position);

CREATE INDEX IF NOT EXISTS idx_product_files_primary ON product_files(product_id, is_primary) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_product_files_store ON product_files(store_id);

CREATE INDEX IF NOT EXISTS idx_product_files_type ON product_files(product_id, file_type);

CREATE INDEX IF NOT EXISTS idx_product_files_url ON product_files(file_url);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_files_unique_primary
  ON product_files(product_id, file_type)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS ab_test_assignments_assigned_at ON ab_test_assignments USING btree (assigned_at);

CREATE INDEX IF NOT EXISTS ab_test_assignments_converted ON ab_test_assignments USING btree (converted);

CREATE INDEX IF NOT EXISTS ab_test_assignments_session_id ON ab_test_assignments USING btree (session_id);

CREATE INDEX IF NOT EXISTS ab_test_assignments_store_id ON ab_test_assignments USING btree (store_id);

CREATE INDEX IF NOT EXISTS ab_test_assignments_test_id ON ab_test_assignments USING btree (test_id);

CREATE INDEX IF NOT EXISTS ab_test_assignments_user_id ON ab_test_assignments USING btree (user_id);

CREATE INDEX IF NOT EXISTS ab_test_assignments_variant_id ON ab_test_assignments USING btree (variant_id);

CREATE INDEX IF NOT EXISTS ab_tests_end_date ON ab_tests USING btree (end_date);

CREATE INDEX IF NOT EXISTS ab_tests_start_date ON ab_tests USING btree (start_date);

CREATE INDEX IF NOT EXISTS ab_tests_status ON ab_tests USING btree (status);

CREATE INDEX IF NOT EXISTS ab_tests_store_id ON ab_tests USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_session ON ai_chat_sessions(session_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS akeneo_custom_mappings_store_id_mapping_type ON akeneo_custom_mappings USING btree (store_id, mapping_type);

CREATE INDEX IF NOT EXISTS akeneo_schedules_is_active ON akeneo_schedules USING btree (is_active);

CREATE INDEX IF NOT EXISTS akeneo_schedules_next_run ON akeneo_schedules USING btree (next_run);

CREATE INDEX IF NOT EXISTS akeneo_schedules_store_id ON akeneo_schedules USING btree (store_id);

CREATE INDEX IF NOT EXISTS attribute_values_attribute_id ON attribute_values USING btree (attribute_id);

CREATE UNIQUE INDEX IF NOT EXISTS attribute_values_attribute_id_code ON attribute_values USING btree (attribute_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS canonical_urls_store_id_page_url ON canonical_urls USING btree (store_id, page_url);

CREATE UNIQUE INDEX IF NOT EXISTS cms_blocks_identifier_store_id ON cms_blocks USING btree (identifier, store_id);

CREATE INDEX IF NOT EXISTS credit_transactions_status ON credit_transactions USING btree (status);

CREATE INDEX IF NOT EXISTS credit_transactions_stripe_payment_intent_id ON credit_transactions USING btree (stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id ON credit_transactions USING btree (user_id);

CREATE INDEX IF NOT EXISTS credit_usage_created_at ON credit_usage USING btree (created_at);

CREATE INDEX IF NOT EXISTS credit_usage_reference_id_reference_type ON credit_usage USING btree (reference_id, reference_type);

CREATE INDEX IF NOT EXISTS credit_usage_usage_type ON credit_usage USING btree (usage_type);

CREATE INDEX IF NOT EXISTS credit_usage_user_id_store_id ON credit_usage USING btree (user_id, store_id);

CREATE INDEX IF NOT EXISTS custom_analytics_events_enabled ON custom_analytics_events USING btree (enabled);

CREATE INDEX IF NOT EXISTS custom_analytics_events_event_category ON custom_analytics_events USING btree (event_category);

CREATE INDEX IF NOT EXISTS custom_analytics_events_priority ON custom_analytics_events USING btree (priority);

CREATE INDEX IF NOT EXISTS custom_analytics_events_store_id ON custom_analytics_events USING btree (store_id);

CREATE INDEX IF NOT EXISTS custom_analytics_events_trigger_type ON custom_analytics_events USING btree (trigger_type);

CREATE INDEX IF NOT EXISTS customer_activities_city ON customer_activities USING btree (city);

CREATE INDEX IF NOT EXISTS customer_activities_country ON customer_activities USING btree (country);

CREATE INDEX IF NOT EXISTS customer_activities_created_at ON customer_activities USING btree (created_at);

CREATE INDEX IF NOT EXISTS customer_activities_device_type ON customer_activities USING btree (device_type);

CREATE INDEX IF NOT EXISTS customer_activities_language ON customer_activities USING btree (language);

CREATE INDEX IF NOT EXISTS customer_activities_session_id ON customer_activities USING btree (session_id);

CREATE INDEX IF NOT EXISTS customer_activities_store_id ON customer_activities USING btree (store_id);

CREATE INDEX IF NOT EXISTS customer_activities_utm_source ON customer_activities USING btree (utm_source);

CREATE UNIQUE INDEX IF NOT EXISTS customers_store_id_email ON customers USING btree (store_id, email);

CREATE INDEX IF NOT EXISTS email_send_logs_brevo_message_id ON email_send_logs USING btree (brevo_message_id);

CREATE INDEX IF NOT EXISTS email_send_logs_created_at ON email_send_logs USING btree (created_at);

CREATE INDEX IF NOT EXISTS email_send_logs_email_template_id ON email_send_logs USING btree (email_template_id);

CREATE INDEX IF NOT EXISTS email_send_logs_recipient_email ON email_send_logs USING btree (recipient_email);

CREATE INDEX IF NOT EXISTS email_send_logs_status ON email_send_logs USING btree (status);

CREATE INDEX IF NOT EXISTS email_send_logs_store_id ON email_send_logs USING btree (store_id);

CREATE INDEX IF NOT EXISTS email_template_translations_email_template_id ON email_template_translations USING btree (email_template_id);

CREATE UNIQUE INDEX IF NOT EXISTS email_template_translations_email_template_id_language_code ON email_template_translations USING btree (email_template_id, language_code);

CREATE INDEX IF NOT EXISTS email_template_translations_language_code ON email_template_translations USING btree (language_code);

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_identifier_store_id ON email_templates USING btree (identifier, store_id);

CREATE INDEX IF NOT EXISTS email_templates_is_active ON email_templates USING btree (is_active);

CREATE INDEX IF NOT EXISTS email_templates_store_id ON email_templates USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs USING btree (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_store_intelligence_store ON ai_store_intelligence USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_ai_store_intelligence_branch ON ai_store_intelligence USING btree (detected_branch);

CREATE INDEX IF NOT EXISTS idx_akeneo_custom_mappings_store_id ON akeneo_custom_mappings USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_import_statistics_date ON import_statistics USING btree (import_date DESC);

CREATE INDEX IF NOT EXISTS idx_import_statistics_store_id ON import_statistics USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_import_statistics_store_type ON import_statistics USING btree (store_id, import_type);

CREATE INDEX IF NOT EXISTS idx_import_statistics_type ON import_statistics USING btree (import_type);

CREATE INDEX IF NOT EXISTS idx_import_statistics_source ON import_statistics USING btree (import_source);

CREATE INDEX IF NOT EXISTS idx_import_statistics_unique ON import_statistics USING btree (store_id, import_type, import_source, import_date);

CREATE INDEX IF NOT EXISTS idx_akeneo_mappings_entity ON akeneo_mappings USING btree (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_akeneo_mappings_lookup ON akeneo_mappings USING btree (store_id, akeneo_code, akeneo_type, is_active);

CREATE INDEX IF NOT EXISTS idx_akeneo_mappings_sort_order ON akeneo_mappings USING btree (sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_akeneo_mappings_unique ON akeneo_mappings USING btree (store_id, akeneo_code, akeneo_type, entity_type);

CREATE INDEX IF NOT EXISTS idx_akeneo_schedules_credit_cost ON akeneo_schedules USING btree (credit_cost);

CREATE INDEX IF NOT EXISTS idx_akeneo_schedules_is_active ON akeneo_schedules USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_akeneo_schedules_next_run ON akeneo_schedules USING btree (next_run);

CREATE INDEX IF NOT EXISTS idx_akeneo_schedules_status ON akeneo_schedules USING btree (status);

CREATE INDEX IF NOT EXISTS idx_akeneo_schedules_store_id ON akeneo_schedules USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_attribute_sets_store_id ON attribute_sets USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_attributes_code ON attributes USING btree (code);

CREATE INDEX IF NOT EXISTS idx_attributes_is_configurable ON attributes USING btree (is_configurable) WHERE (is_configurable = true);

CREATE INDEX IF NOT EXISTS idx_attributes_store_id ON attributes USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_blacklist_countries_store_country ON blacklist_countries USING btree (store_id, country_code);

CREATE INDEX IF NOT EXISTS idx_blacklist_emails_store_email ON blacklist_emails USING btree (store_id, email);

CREATE INDEX IF NOT EXISTS idx_blacklist_ips_store_ip ON blacklist_ips USING btree (store_id, ip_address);

CREATE INDEX IF NOT EXISTS idx_blacklist_settings_store ON blacklist_settings USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_categories_active_menu ON categories USING btree (store_id, is_active, hide_in_menu, sort_order) WHERE ((is_active = true) AND (hide_in_menu = false));

CREATE INDEX IF NOT EXISTS idx_categories_akeneo_code ON categories USING btree (akeneo_code);

CREATE INDEX IF NOT EXISTS idx_categories_hide_in_menu ON categories USING btree (hide_in_menu);

CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_categories_level ON categories USING btree (level);

CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories USING btree (parent_id);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories USING btree (slug);

CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_category_translations_name ON category_translations USING btree (name);

CREATE INDEX IF NOT EXISTS idx_cms_block_translations_block_id ON cms_block_translations USING btree (cms_block_id);

CREATE INDEX IF NOT EXISTS idx_cms_blocks_store_active ON cms_blocks USING btree (store_id, is_active);

CREATE INDEX IF NOT EXISTS idx_cms_page_translations_page_id ON cms_page_translations USING btree (cms_page_id);

CREATE INDEX IF NOT EXISTS idx_cms_pages_is_active ON cms_pages USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_cms_pages_is_system ON cms_pages USING btree (is_system);

CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON cms_pages USING btree (slug);

CREATE INDEX IF NOT EXISTS idx_cms_pages_store_id ON cms_pages USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_conversations_agent ON chat_conversations USING btree (assigned_agent_id);

CREATE INDEX IF NOT EXISTS idx_conversations_status ON chat_conversations USING btree (status);

CREATE INDEX IF NOT EXISTS idx_cookie_consent_translations_language ON cookie_consent_settings_translations USING btree (language_code);

CREATE INDEX IF NOT EXISTS idx_cookie_consent_translations_settings_id ON cookie_consent_settings_translations USING btree (cookie_consent_settings_id);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons USING btree (code);

CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_coupons_store_id ON coupons USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_status ON credit_transactions USING btree (status);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_credit_usage_created_at ON credit_usage USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_credit_usage_reference ON credit_usage USING btree (reference_id, reference_type);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user_store ON credit_usage USING btree (user_id, store_id);

CREATE INDEX IF NOT EXISTS idx_cron_job_executions_cron_job_id ON cron_job_executions USING btree (cron_job_id);

CREATE INDEX IF NOT EXISTS idx_cron_job_executions_started_at ON cron_job_executions USING btree (started_at);

CREATE INDEX IF NOT EXISTS idx_cron_job_executions_status ON cron_job_executions USING btree (status);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_active ON cron_jobs USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_job_type ON cron_jobs USING btree (job_type);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs USING btree (next_run_at) WHERE ((is_active = true) AND (is_paused = false));

CREATE INDEX IF NOT EXISTS idx_cron_jobs_store_id ON cron_jobs USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_cron_jobs_user_id ON cron_jobs USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_current_edit ON slot_configurations USING btree (current_edit_id);

CREATE INDEX IF NOT EXISTS idx_custom_domains_active_lookup ON custom_domains USING btree (domain, store_id) WHERE ((is_active = true) AND (verification_status = 'verified'::enum_custom_domains_verification_status));

CREATE INDEX IF NOT EXISTS idx_custom_option_rules_is_active ON custom_option_rules USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_custom_option_rules_store_id ON custom_option_rules USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_custom_pricing_logs_event_created ON custom_pricing_logs USING btree (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_custom_pricing_logs_rule_id ON custom_pricing_logs USING btree (rule_id);

CREATE INDEX IF NOT EXISTS idx_custom_pricing_rules_store_id ON custom_pricing_rules USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_custom_pricing_rules_type_enabled ON custom_pricing_rules USING btree (type, enabled);

CREATE INDEX IF NOT EXISTS idx_customer_activities_city ON customer_activities USING btree (city);

CREATE INDEX IF NOT EXISTS idx_customer_activities_country ON customer_activities USING btree (country);

CREATE INDEX IF NOT EXISTS idx_customer_activities_device_type ON customer_activities USING btree (device_type);

CREATE INDEX IF NOT EXISTS idx_customer_activities_language ON customer_activities USING btree (language);

CREATE INDEX IF NOT EXISTS idx_customer_activities_utm_source ON customer_activities USING btree (utm_source);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers USING btree (email);

CREATE INDEX IF NOT EXISTS idx_customers_email_active ON customers USING btree (email, is_active);

CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_customers_is_blacklisted ON customers USING btree (is_blacklisted);

CREATE INDEX IF NOT EXISTS idx_customers_store_email ON customers USING btree (store_id, email);

CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_delivery_settings_store_id ON delivery_settings USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_brevo_id ON email_send_logs USING btree (brevo_message_id);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_created_at ON email_send_logs USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_recipient ON email_send_logs USING btree (recipient_email);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_status ON email_send_logs USING btree (status);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_store_id ON email_send_logs USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_template_id ON email_send_logs USING btree (email_template_id);

CREATE INDEX IF NOT EXISTS idx_email_template_translations_language ON email_template_translations USING btree (language_code);

CREATE INDEX IF NOT EXISTS idx_email_template_translations_template_id ON email_template_translations USING btree (email_template_id);

CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_email_templates_identifier ON email_templates USING btree (identifier);

CREATE INDEX IF NOT EXISTS idx_email_templates_store_id ON email_templates USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_heatmap_aggregations_lookup ON heatmap_aggregations USING btree (store_id, page_url, aggregation_period, period_start);

CREATE INDEX IF NOT EXISTS idx_heatmap_coordinates ON heatmap_interactions USING btree (store_id, page_url, interaction_type, x_coordinate, y_coordinate);

CREATE INDEX IF NOT EXISTS idx_heatmap_interactions_coordinates ON heatmap_interactions USING btree (store_id, page_url, interaction_type, x_coordinate, y_coordinate);

CREATE INDEX IF NOT EXISTS idx_heatmap_interactions_session ON heatmap_interactions USING btree (session_id);

CREATE INDEX IF NOT EXISTS idx_heatmap_interactions_store_page_time ON heatmap_interactions USING btree (store_id, page_url, timestamp_utc DESC);

CREATE INDEX IF NOT EXISTS idx_heatmap_interactions_viewport ON heatmap_interactions USING btree (viewport_width, viewport_height);

CREATE INDEX IF NOT EXISTS idx_heatmap_session ON heatmap_interactions USING btree (session_id);

CREATE INDEX IF NOT EXISTS idx_heatmap_sessions_session_id ON heatmap_sessions USING btree (session_id);

CREATE INDEX IF NOT EXISTS idx_heatmap_sessions_store_time ON heatmap_sessions USING btree (store_id, session_start DESC);

CREATE INDEX IF NOT EXISTS idx_heatmap_store_page_time ON heatmap_interactions USING btree (store_id, page_url, timestamp_utc);

CREATE INDEX IF NOT EXISTS idx_heatmap_viewport ON heatmap_interactions USING btree (viewport_width, viewport_height);

CREATE INDEX IF NOT EXISTS idx_integration_configs_connection_status ON integration_configs USING btree (store_id, integration_type, connection_status);

CREATE INDEX IF NOT EXISTS idx_job_history_executed_at ON job_history USING btree (executed_at);

CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history USING btree (job_id);

CREATE INDEX IF NOT EXISTS idx_job_history_status ON job_history USING btree (status);

CREATE INDEX IF NOT EXISTS idx_job_history_timeline ON job_history USING btree (job_id, executed_at);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs USING btree (priority);

CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs USING btree (status, priority, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs USING btree (scheduled_at);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs USING btree (status);

CREATE INDEX IF NOT EXISTS idx_jobs_store_id ON jobs USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs USING btree (type);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts USING btree (email, attempted_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts USING btree (ip_address, attempted_at);

CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_assets_folder ON media_assets USING btree (folder);

CREATE INDEX IF NOT EXISTS idx_media_assets_store_id ON media_assets USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages USING btree (conversation_id);

CREATE INDEX IF NOT EXISTS idx_migrations_executed_at ON _migrations USING btree (executed_at);

CREATE INDEX IF NOT EXISTS idx_migrations_filename ON _migrations USING btree (filename);

CREATE INDEX IF NOT EXISTS idx_navigation_registry_core ON admin_navigation_registry USING btree (is_core);

CREATE INDEX IF NOT EXISTS idx_navigation_registry_key ON admin_navigation_registry USING btree (key);

CREATE INDEX IF NOT EXISTS idx_navigation_registry_parent ON admin_navigation_registry USING btree (parent_key);

CREATE INDEX IF NOT EXISTS idx_navigation_registry_plugin ON admin_navigation_registry USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_parent_version ON slot_configurations USING btree (parent_version_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_payment_flow ON payment_methods USING btree (payment_flow);

CREATE INDEX IF NOT EXISTS idx_pdf_template_translations_language ON pdf_template_translations USING btree (language_code);

CREATE INDEX IF NOT EXISTS idx_pdf_template_translations_template_id ON pdf_template_translations USING btree (pdf_template_id);

CREATE INDEX IF NOT EXISTS idx_pdf_templates_identifier ON pdf_templates USING btree (identifier);

CREATE INDEX IF NOT EXISTS idx_pdf_templates_store_id ON pdf_templates USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_pdf_templates_type ON pdf_templates USING btree (template_type);

CREATE INDEX IF NOT EXISTS idx_plugin_admin_pages_enabled ON plugin_admin_pages USING btree (is_enabled);

CREATE INDEX IF NOT EXISTS idx_plugin_admin_pages_plugin ON plugin_admin_pages USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_admin_pages_route ON plugin_admin_pages USING btree (route);

CREATE INDEX IF NOT EXISTS idx_plugin_admin_scripts_enabled ON plugin_admin_scripts USING btree (is_enabled);

CREATE INDEX IF NOT EXISTS idx_plugin_admin_scripts_order ON plugin_admin_scripts USING btree (load_order);

CREATE INDEX IF NOT EXISTS idx_plugin_admin_scripts_plugin ON plugin_admin_scripts USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_comparison_computed ON plugin_version_comparisons USING btree (computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_plugin_comparison_from ON plugin_version_comparisons USING btree (from_version_id);

CREATE INDEX IF NOT EXISTS idx_plugin_comparison_plugin ON plugin_version_comparisons USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_comparison_to ON plugin_version_comparisons USING btree (to_version_id);

CREATE INDEX IF NOT EXISTS idx_plugin_controllers_enabled ON plugin_controllers USING btree (is_enabled);

CREATE INDEX IF NOT EXISTS idx_plugin_controllers_method_path ON plugin_controllers USING btree (method, path);

CREATE INDEX IF NOT EXISTS idx_plugin_controllers_plugin_id ON plugin_controllers USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_cron_plugin_id ON plugin_cron(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_cron_enabled ON plugin_cron(is_enabled) WHERE is_enabled = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_cron_unique_name ON plugin_cron(plugin_id, cron_name);

CREATE INDEX IF NOT EXISTS idx_plugin_data_key ON plugin_data USING btree (data_key);

CREATE INDEX IF NOT EXISTS idx_plugin_data_plugin ON plugin_data USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_data_plugin_key ON plugin_data USING btree (plugin_id, data_key);

CREATE INDEX IF NOT EXISTS idx_plugin_dependencies_plugin_id ON plugin_dependencies USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_docs_plugin_id ON plugin_docs USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_docs_type ON plugin_docs USING btree (doc_type);

CREATE INDEX IF NOT EXISTS idx_plugin_docs_visible ON plugin_docs USING btree (is_visible);

CREATE INDEX IF NOT EXISTS idx_plugin_entities_migration_status ON plugin_entities USING btree (migration_status);

CREATE INDEX IF NOT EXISTS idx_plugin_entities_plugin_id ON plugin_entities USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_entities_table_name ON plugin_entities USING btree (table_name);

CREATE INDEX IF NOT EXISTS idx_plugin_events_enabled ON plugin_events USING btree (is_enabled) WHERE (is_enabled = true);

CREATE INDEX IF NOT EXISTS idx_plugin_events_name ON plugin_events USING btree (event_name);

CREATE INDEX IF NOT EXISTS idx_plugin_events_plugin ON plugin_events USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_events_plugin_name ON plugin_events USING btree (plugin_id, event_name);

CREATE INDEX IF NOT EXISTS idx_plugin_hooks_enabled ON plugin_hooks USING btree (is_enabled) WHERE (is_enabled = true);

CREATE INDEX IF NOT EXISTS idx_plugin_hooks_name ON plugin_hooks USING btree (hook_name);

CREATE INDEX IF NOT EXISTS idx_plugin_hooks_plugin ON plugin_hooks USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_hooks_plugin_name ON plugin_hooks USING btree (plugin_id, hook_name);

CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_slug ON plugin_marketplace USING btree (slug);

CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_status ON plugin_marketplace USING btree (status);

CREATE INDEX IF NOT EXISTS idx_plugin_migrations_executed_at ON plugin_migrations USING btree (executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_plugin_migrations_plugin_id ON plugin_migrations USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_migrations_status ON plugin_migrations USING btree (status);

CREATE INDEX IF NOT EXISTS idx_plugin_migrations_version ON plugin_migrations USING btree (migration_version);

CREATE INDEX IF NOT EXISTS idx_plugin_patch_change_type ON plugin_version_patches USING btree (change_type);

CREATE INDEX IF NOT EXISTS idx_plugin_patch_component ON plugin_version_patches USING btree (component_type, component_id);

CREATE INDEX IF NOT EXISTS idx_plugin_patch_plugin ON plugin_version_patches USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_patch_version ON plugin_version_patches USING btree (version_id);

CREATE INDEX IF NOT EXISTS idx_plugin_registry_category ON plugin_registry USING btree (category);

CREATE INDEX IF NOT EXISTS idx_plugin_registry_creator ON plugin_registry USING btree (creator_id);

CREATE INDEX IF NOT EXISTS idx_plugin_registry_deprecated ON plugin_registry USING btree (deprecated_at);

CREATE INDEX IF NOT EXISTS idx_plugin_registry_is_public ON plugin_registry USING btree (is_public);

CREATE INDEX IF NOT EXISTS idx_plugin_registry_status ON plugin_registry USING btree (status);

CREATE INDEX IF NOT EXISTS idx_plugin_scripts_enabled ON plugin_scripts USING btree (is_enabled) WHERE (is_enabled = true);

CREATE INDEX IF NOT EXISTS idx_plugin_scripts_plugin ON plugin_scripts USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_scripts_plugin_id ON plugin_scripts USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_scripts_type_scope ON plugin_scripts USING btree (script_type, scope);

CREATE INDEX IF NOT EXISTS idx_plugin_snapshot_created_at ON plugin_version_snapshots USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plugin_snapshot_plugin ON plugin_version_snapshots USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_snapshot_version ON plugin_version_snapshots USING btree (version_id);

CREATE INDEX IF NOT EXISTS idx_plugin_tag_name ON plugin_version_tags USING btree (tag_name);

CREATE INDEX IF NOT EXISTS idx_plugin_tag_plugin ON plugin_version_tags USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_tag_type ON plugin_version_tags USING btree (tag_type);

CREATE INDEX IF NOT EXISTS idx_plugin_tag_version ON plugin_version_tags USING btree (version_id);

CREATE INDEX IF NOT EXISTS idx_plugin_version_created_at ON plugin_version_history USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plugin_version_is_current ON plugin_version_history USING btree (is_current) WHERE (is_current = true);

CREATE INDEX IF NOT EXISTS idx_plugin_version_is_published ON plugin_version_history USING btree (is_published) WHERE (is_published = true);

CREATE INDEX IF NOT EXISTS idx_plugin_version_parent ON plugin_version_history USING btree (parent_version_id);

CREATE INDEX IF NOT EXISTS idx_plugin_version_plugin_id ON plugin_version_history USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_version_type ON plugin_version_history USING btree (version_type);

CREATE INDEX IF NOT EXISTS idx_plugin_widgets_plugin ON plugin_widgets USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS idx_plugin_widgets_widget_id ON plugin_widgets USING btree (widget_id);

CREATE INDEX IF NOT EXISTS idx_product_attribute_values_product ON product_attribute_values USING btree (product_id, attribute_id);

CREATE INDEX IF NOT EXISTS idx_product_attribute_values_value ON product_attribute_values USING btree (attribute_id, value_id);

CREATE INDEX IF NOT EXISTS idx_product_labels_sort_order ON product_labels USING btree (sort_order);

CREATE INDEX IF NOT EXISTS idx_product_tabs_tab_type ON product_tabs USING btree (tab_type);

CREATE INDEX IF NOT EXISTS idx_product_translations_name ON product_translations USING btree (name);

CREATE INDEX IF NOT EXISTS idx_product_variants_parent ON product_variants USING btree (parent_product_id);

CREATE INDEX IF NOT EXISTS idx_product_variants_variant ON product_variants USING btree (variant_product_id);

CREATE INDEX IF NOT EXISTS idx_products_active_visible ON products USING btree (store_id, status, visibility) WHERE (((status)::text = 'active'::text) AND ((visibility)::text = 'visible'::text));

CREATE INDEX IF NOT EXISTS idx_products_external_id ON products USING btree (external_id);

CREATE INDEX IF NOT EXISTS idx_products_external_source ON products USING btree (external_source);

CREATE INDEX IF NOT EXISTS idx_products_featured ON products USING btree (featured);

CREATE INDEX IF NOT EXISTS idx_products_parent_id ON products USING btree (parent_id);

CREATE INDEX IF NOT EXISTS idx_products_price ON products USING btree (price);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products USING btree (sku);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products USING btree (slug);

CREATE INDEX IF NOT EXISTS idx_products_status ON products USING btree (status);

CREATE INDEX IF NOT EXISTS idx_products_stock ON products USING btree (manage_stock, stock_quantity, infinite_stock) WHERE (manage_stock = true);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_products_type ON products USING btree (type);

CREATE INDEX IF NOT EXISTS idx_redirects_from_url ON redirects USING btree (from_url);

CREATE INDEX IF NOT EXISTS idx_redirects_is_active ON redirects USING btree (is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_redirects_store_from_unique ON redirects USING btree (store_id, from_url);

CREATE INDEX IF NOT EXISTS idx_redirects_store_id ON redirects USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_shipping_methods_is_active ON shipping_methods USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_shipping_methods_store_id ON shipping_methods USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_slot_configurations_is_active ON slot_configurations USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_slot_configurations_store_id ON slot_configurations USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_store_status_page_version ON slot_configurations USING btree (store_id, status, page_type, version_number);

CREATE INDEX IF NOT EXISTS idx_store_uptime_charged_date ON store_uptime USING btree (charged_date);

CREATE INDEX IF NOT EXISTS idx_store_uptime_created_at ON store_uptime USING btree (created_at);

CREATE INDEX IF NOT EXISTS idx_store_uptime_store_id ON store_uptime USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_store_uptime_user_id ON store_uptime USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_store_uptime_user_store ON store_uptime USING btree (user_id, store_id);

CREATE INDEX IF NOT EXISTS idx_stores_deployment_status ON stores USING btree (deployment_status);

CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_stores_published ON stores USING btree (published);

CREATE INDEX IF NOT EXISTS idx_stores_published_at ON stores USING btree (published_at);

CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores USING btree (slug);

CREATE INDEX IF NOT EXISTS idx_taxes_is_active ON taxes USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_taxes_store_id ON taxes USING btree (store_id);

CREATE INDEX IF NOT EXISTS idx_translations_type ON translations USING btree (type);

CREATE INDEX IF NOT EXISTS idx_typing_conversation ON chat_typing_indicators USING btree (conversation_id);

CREATE INDEX IF NOT EXISTS idx_user_store_status_page ON slot_configurations USING btree (user_id, store_id, status, page_type);

CREATE INDEX IF NOT EXISTS idx_users_account_type ON users USING btree (account_type);

CREATE INDEX IF NOT EXISTS idx_users_email ON users USING btree (email);

CREATE INDEX IF NOT EXISTS idx_users_is_active ON users USING btree (is_active);

CREATE INDEX IF NOT EXISTS idx_users_role ON users USING btree (role);

CREATE UNIQUE INDEX IF NOT EXISTS integration_configs_store_id_integration_type_key ON integration_configs USING btree (store_id, integration_type, config_key);
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_integration_per_store_type ON integration_configs (store_id, integration_type) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_integration_configs_store_id ON integration_configs (store_id);
CREATE INDEX IF NOT EXISTS idx_integration_configs_type ON integration_configs (integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_configs_active ON integration_configs (is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS job_history_executed_at ON job_history USING btree (executed_at);

CREATE INDEX IF NOT EXISTS job_history_job_id ON job_history USING btree (job_id);

CREATE INDEX IF NOT EXISTS job_history_job_id_executed_at ON job_history USING btree (job_id, executed_at);

CREATE INDEX IF NOT EXISTS job_history_status ON job_history USING btree (status);

CREATE INDEX IF NOT EXISTS jobs_created_at ON jobs USING btree (created_at);

CREATE INDEX IF NOT EXISTS jobs_priority ON jobs USING btree (priority);

CREATE INDEX IF NOT EXISTS jobs_scheduled_at ON jobs USING btree (scheduled_at);

CREATE INDEX IF NOT EXISTS jobs_status ON jobs USING btree (status);

CREATE INDEX IF NOT EXISTS jobs_status_priority_scheduled_at ON jobs USING btree (status, priority, scheduled_at);

CREATE INDEX IF NOT EXISTS jobs_store_id ON jobs USING btree (store_id);

CREATE INDEX IF NOT EXISTS jobs_type ON jobs USING btree (type);

CREATE INDEX IF NOT EXISTS jobs_user_id ON jobs USING btree (user_id);

CREATE INDEX IF NOT EXISTS login_attempts_email_attempted_at ON login_attempts USING btree (email, attempted_at);

CREATE INDEX IF NOT EXISTS login_attempts_ip_address_attempted_at ON login_attempts USING btree (ip_address, attempted_at);

CREATE INDEX IF NOT EXISTS media_assets_created_at ON media_assets USING btree (created_at);

CREATE INDEX IF NOT EXISTS media_assets_folder ON media_assets USING btree (folder);

CREATE INDEX IF NOT EXISTS media_assets_store_id ON media_assets USING btree (store_id);

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_store_id_file_path ON media_assets USING btree (store_id, file_path);

CREATE INDEX IF NOT EXISTS pdf_template_translations_language_code ON pdf_template_translations USING btree (language_code);

CREATE INDEX IF NOT EXISTS pdf_template_translations_pdf_template_id ON pdf_template_translations USING btree (pdf_template_id);

CREATE UNIQUE INDEX IF NOT EXISTS pdf_template_translations_pdf_template_id_language_code ON pdf_template_translations USING btree (pdf_template_id, language_code);

CREATE UNIQUE INDEX IF NOT EXISTS pdf_templates_identifier_store_id ON pdf_templates USING btree (identifier, store_id);

CREATE INDEX IF NOT EXISTS pdf_templates_store_id ON pdf_templates USING btree (store_id);

CREATE INDEX IF NOT EXISTS pdf_templates_template_type ON pdf_templates USING btree (template_type);

CREATE INDEX IF NOT EXISTS plugin_configurations_health_status ON plugin_configurations USING btree (health_status);

CREATE INDEX IF NOT EXISTS plugin_configurations_is_enabled ON plugin_configurations USING btree (is_enabled);

CREATE INDEX IF NOT EXISTS plugin_configurations_plugin_id ON plugin_configurations USING btree (plugin_id);

CREATE INDEX IF NOT EXISTS plugin_configurations_store_id ON plugin_configurations USING btree (store_id);

CREATE INDEX IF NOT EXISTS plugins_category ON plugins USING btree (category);

CREATE INDEX IF NOT EXISTS plugins_is_enabled ON plugins USING btree (is_enabled);

CREATE INDEX IF NOT EXISTS plugins_is_installed ON plugins USING btree (is_installed);

CREATE UNIQUE INDEX IF NOT EXISTS plugins_slug ON plugins USING btree (slug);

CREATE INDEX IF NOT EXISTS plugins_source_type ON plugins USING btree (source_type);

CREATE INDEX IF NOT EXISTS plugins_status ON plugins USING btree (status);

CREATE INDEX IF NOT EXISTS product_attribute_values_attribute_id ON product_attribute_values USING btree (attribute_id);

CREATE INDEX IF NOT EXISTS product_attribute_values_product_id ON product_attribute_values USING btree (product_id);

CREATE INDEX IF NOT EXISTS product_attribute_values_value_id ON product_attribute_values USING btree (value_id);

CREATE UNIQUE INDEX IF NOT EXISTS product_labels_store_id_slug ON product_labels USING btree (store_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS product_tabs_store_id_slug ON product_tabs USING btree (store_id, slug);

CREATE INDEX IF NOT EXISTS product_variants_parent_product_id ON product_variants USING btree (parent_product_id);

CREATE UNIQUE INDEX IF NOT EXISTS product_variants_parent_product_id_variant_product_id ON product_variants USING btree (parent_product_id, variant_product_id);

CREATE INDEX IF NOT EXISTS product_variants_variant_product_id ON product_variants USING btree (variant_product_id);

CREATE INDEX IF NOT EXISTS redirects_entity_type_entity_id ON redirects USING btree (entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS redirects_store_id_from_url ON redirects USING btree (store_id, from_url);

CREATE UNIQUE INDEX IF NOT EXISTS seo_templates_store_id_name ON seo_templates USING btree (store_id, name);

CREATE INDEX IF NOT EXISTS slot_configurations_is_active ON slot_configurations USING btree (is_active);

CREATE INDEX IF NOT EXISTS slot_configurations_store_id ON slot_configurations USING btree (store_id);

CREATE INDEX IF NOT EXISTS translations_category_index ON translations USING btree (category);

CREATE INDEX IF NOT EXISTS translations_language_code_index ON translations USING btree (language_code);

CREATE INDEX IF NOT EXISTS translations_store_id_index ON translations USING btree (store_id);

CREATE UNIQUE INDEX IF NOT EXISTS translations_store_key_language_unique ON translations USING btree (store_id, key, language_code);

CREATE UNIQUE INDEX IF NOT EXISTS unique_customer_email ON customers USING btree (email);

CREATE UNIQUE INDEX IF NOT EXISTS unique_email_role ON users USING btree (email, role);

CREATE UNIQUE INDEX IF NOT EXISTS unique_plugin_store_config ON plugin_configurations USING btree (plugin_id, store_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_session_store_cart ON carts USING btree (session_id, store_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_store_session ON heatmap_sessions USING btree (store_id, session_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_test_session ON ab_test_assignments USING btree (test_id, session_id);

CREATE INDEX IF NOT EXISTS usage_metrics_metric_date ON usage_metrics USING btree (metric_date);

CREATE INDEX IF NOT EXISTS usage_metrics_store_id ON usage_metrics USING btree (store_id);

CREATE UNIQUE INDEX IF NOT EXISTS usage_metrics_store_id_metric_date_metric_hour ON usage_metrics USING btree (store_id, metric_date, metric_hour);

CREATE UNIQUE INDEX IF NOT EXISTS wishlists_session_id_product_id ON wishlists USING btree (session_id, product_id);

-- ============================================
-- SECTION 5: CREATE TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS trigger_integration_attribute_mappings_updated_at ON integration_attribute_mappings;
CREATE TRIGGER trigger_integration_attribute_mappings_updated_at
  BEFORE UPDATE ON integration_attribute_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_attribute_mappings_updated_at();

DROP TRIGGER IF EXISTS trigger_product_files_updated_at ON product_files;
CREATE TRIGGER trigger_product_files_updated_at
  BEFORE UPDATE ON product_files
  FOR EACH ROW
  EXECUTE FUNCTION update_product_files_updated_at();

DROP TRIGGER IF EXISTS plugin_admin_pages_updated_at ON plugin_admin_pages;
CREATE TRIGGER plugin_admin_pages_updated_at
  BEFORE UPDATE ON plugin_admin_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_plugin_admin_pages_timestamp();

DROP TRIGGER IF EXISTS plugin_admin_scripts_updated_at ON plugin_admin_scripts;
CREATE TRIGGER plugin_admin_scripts_updated_at
  BEFORE UPDATE ON plugin_admin_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_plugin_admin_scripts_timestamp();

DROP TRIGGER IF EXISTS trigger_auto_increment_snapshot_distance ON plugin_version_history;
CREATE TRIGGER trigger_auto_increment_snapshot_distance
  BEFORE INSERT ON plugin_version_history
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_snapshot_distance();

DROP TRIGGER IF EXISTS trigger_ensure_single_current_version ON plugin_version_history;
CREATE TRIGGER trigger_ensure_single_current_version
  BEFORE INSERT OR UPDATE ON plugin_version_history
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_current_version();

DROP TRIGGER IF EXISTS trigger_update_cms_blocks_updated_at ON cms_blocks;
CREATE TRIGGER trigger_update_cms_blocks_updated_at
  BEFORE UPDATE ON cms_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_cms_blocks_updated_at();

DROP TRIGGER IF EXISTS update_ab_test_variants_updated_at ON ab_test_variants;
CREATE TRIGGER update_ab_test_variants_updated_at
  BEFORE UPDATE ON ab_test_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attribute_sets_updated_at ON attribute_sets;
CREATE TRIGGER update_attribute_sets_updated_at
  BEFORE UPDATE ON attribute_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_attributes_updated_at ON attributes;
CREATE TRIGGER update_attributes_updated_at
  BEFORE UPDATE ON attributes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cms_pages_updated_at ON cms_pages;
CREATE TRIGGER update_cms_pages_updated_at
  BEFORE UPDATE ON cms_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_coupons_updated_at ON coupons;
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_credit_transactions_updated_at ON credit_transactions;
CREATE TRIGGER update_credit_transactions_updated_at
  BEFORE UPDATE ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cron_jobs_updated_at ON cron_jobs;
CREATE TRIGGER update_cron_jobs_updated_at
  BEFORE UPDATE ON cron_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_cron_jobs_updated_at();

DROP TRIGGER IF EXISTS update_custom_option_rules_updated_at ON custom_option_rules;
CREATE TRIGGER update_custom_option_rules_updated_at
  BEFORE UPDATE ON custom_option_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_settings_updated_at ON delivery_settings;
CREATE TRIGGER update_delivery_settings_updated_at
  BEFORE UPDATE ON delivery_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_send_logs_updated_at ON email_send_logs;
CREATE TRIGGER update_email_send_logs_updated_at
  BEFORE UPDATE ON email_send_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_template_translations_updated_at ON email_template_translations;
CREATE TRIGGER update_email_template_translations_updated_at
  BEFORE UPDATE ON email_template_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_heatmap_aggregations_timestamp ON heatmap_aggregations;
CREATE TRIGGER update_heatmap_aggregations_timestamp
  BEFORE UPDATE ON heatmap_aggregations
  FOR EACH ROW
  EXECUTE FUNCTION update_heatmap_timestamp();

DROP TRIGGER IF EXISTS update_heatmap_interactions_timestamp ON heatmap_interactions;
CREATE TRIGGER update_heatmap_interactions_timestamp
  BEFORE UPDATE ON heatmap_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_heatmap_timestamp();

DROP TRIGGER IF EXISTS update_heatmap_sessions_timestamp ON heatmap_sessions;
CREATE TRIGGER update_heatmap_sessions_timestamp
  BEFORE UPDATE ON heatmap_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_heatmap_timestamp();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pdf_template_translations_updated_at ON pdf_template_translations;
CREATE TRIGGER update_pdf_template_translations_updated_at
  BEFORE UPDATE ON pdf_template_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plugin_data_updated_at ON plugin_data;
CREATE TRIGGER update_plugin_data_updated_at
  BEFORE UPDATE ON plugin_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plugin_events_updated_at ON plugin_events;
CREATE TRIGGER update_plugin_events_updated_at
  BEFORE UPDATE ON plugin_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plugin_hooks_updated_at ON plugin_hooks;
CREATE TRIGGER update_plugin_hooks_updated_at
  BEFORE UPDATE ON plugin_hooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_plugin_scripts_updated_at ON plugin_scripts;
CREATE TRIGGER update_plugin_scripts_updated_at
  BEFORE UPDATE ON plugin_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_redirects_updated_at ON redirects;
CREATE TRIGGER update_redirects_updated_at
  BEFORE UPDATE ON redirects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipping_methods_updated_at ON shipping_methods;
CREATE TRIGGER update_shipping_methods_updated_at
  BEFORE UPDATE ON shipping_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_taxes_updated_at ON taxes;
CREATE TRIGGER update_taxes_updated_at
  BEFORE UPDATE ON taxes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SECTION 6: FOREIGN KEY CONSTRAINTS
-- All foreign keys added after tables are created
-- ============================================

ALTER TABLE ab_test_assignments ADD CONSTRAINT ab_test_assignments_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE ab_test_assignments ADD CONSTRAINT ab_test_assignments_test_id_fkey FOREIGN KEY (test_id) REFERENCES ab_tests(id) ON UPDATE CASCADE;

ALTER TABLE ab_test_assignments ADD CONSTRAINT ab_test_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ab_test_variants ADD CONSTRAINT ab_test_variants_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE ab_tests ADD CONSTRAINT ab_tests_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE ai_usage_logs ADD CONSTRAINT ai_usage_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE akeneo_custom_mappings ADD CONSTRAINT akeneo_custom_mappings_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE akeneo_custom_mappings ADD CONSTRAINT akeneo_custom_mappings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE akeneo_custom_mappings ADD CONSTRAINT akeneo_custom_mappings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE import_statistics ADD CONSTRAINT import_statistics_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE akeneo_mappings ADD CONSTRAINT akeneo_mappings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE akeneo_schedules ADD CONSTRAINT akeneo_schedules_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attribute_sets ADD CONSTRAINT attribute_sets_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE attribute_translations ADD CONSTRAINT attribute_translations_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attribute_translations ADD CONSTRAINT attribute_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attribute_value_translations ADD CONSTRAINT attribute_value_translations_attribute_value_id_fkey FOREIGN KEY (attribute_value_id) REFERENCES attribute_values(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attribute_value_translations ADD CONSTRAINT attribute_value_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attribute_values ADD CONSTRAINT attribute_values_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE attributes ADD CONSTRAINT attributes_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE blacklist_countries ADD CONSTRAINT blacklist_countries_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE blacklist_emails ADD CONSTRAINT blacklist_emails_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE blacklist_ips ADD CONSTRAINT blacklist_ips_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE blacklist_settings ADD CONSTRAINT blacklist_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE canonical_urls ADD CONSTRAINT canonical_urls_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE canonical_urls ADD CONSTRAINT canonical_urls_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE carts ADD CONSTRAINT carts_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE carts ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE categories ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE;

ALTER TABLE categories ADD CONSTRAINT categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE category_seo ADD CONSTRAINT category_seo_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE category_seo ADD CONSTRAINT category_seo_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE category_translations ADD CONSTRAINT category_translations_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE category_translations ADD CONSTRAINT category_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE chat_typing_indicators ADD CONSTRAINT chat_typing_indicators_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE;

ALTER TABLE cms_block_translations ADD CONSTRAINT cms_block_translations_cms_block_id_fkey FOREIGN KEY (cms_block_id) REFERENCES cms_blocks(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cms_block_translations ADD CONSTRAINT cms_block_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cms_blocks ADD CONSTRAINT cms_blocks_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cms_page_seo ADD CONSTRAINT cms_page_seo_cms_page_id_fkey FOREIGN KEY (cms_page_id) REFERENCES cms_pages(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cms_page_seo ADD CONSTRAINT cms_page_seo_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cms_page_translations ADD CONSTRAINT cms_page_translations_cms_page_id_fkey FOREIGN KEY (cms_page_id) REFERENCES cms_pages(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cms_page_translations ADD CONSTRAINT cms_page_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE cms_pages ADD CONSTRAINT cms_pages_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE consent_logs ADD CONSTRAINT consent_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE cookie_consent_settings ADD CONSTRAINT cookie_consent_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE coupon_translations ADD CONSTRAINT coupon_translations_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE coupon_translations ADD CONSTRAINT coupon_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE coupons ADD CONSTRAINT coupons_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE credit_usage ADD CONSTRAINT credit_usage_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE credit_usage ADD CONSTRAINT credit_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE cron_job_executions ADD CONSTRAINT cron_job_executions_cron_job_id_fkey FOREIGN KEY (cron_job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE;

ALTER TABLE cron_job_executions ADD CONSTRAINT cron_job_executions_triggered_by_user_fkey FOREIGN KEY (triggered_by_user) REFERENCES users(id);

ALTER TABLE cron_jobs ADD CONSTRAINT cron_jobs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE cron_jobs ADD CONSTRAINT cron_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE custom_analytics_events ADD CONSTRAINT custom_analytics_events_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE custom_domains ADD CONSTRAINT custom_domains_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE custom_option_rules ADD CONSTRAINT custom_option_rules_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE custom_pricing_discounts ADD CONSTRAINT custom_pricing_discounts_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES custom_pricing_rules(id) ON DELETE CASCADE;

ALTER TABLE custom_pricing_logs ADD CONSTRAINT custom_pricing_logs_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES custom_pricing_rules(id);

ALTER TABLE customer_activities ADD CONSTRAINT customer_activities_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE customer_activities ADD CONSTRAINT customer_activities_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE customer_activities ADD CONSTRAINT customer_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE customer_addresses ADD CONSTRAINT customer_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE customers ADD CONSTRAINT customers_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE delivery_settings ADD CONSTRAINT delivery_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE email_send_logs ADD CONSTRAINT email_send_logs_email_template_id_fkey FOREIGN KEY (email_template_id) REFERENCES email_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE email_send_logs ADD CONSTRAINT email_send_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE email_template_translations ADD CONSTRAINT email_template_translations_email_template_id_fkey FOREIGN KEY (email_template_id) REFERENCES email_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE email_templates ADD CONSTRAINT email_templates_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE cookie_consent_settings_translations ADD CONSTRAINT fk_cookie_consent_settings FOREIGN KEY (cookie_consent_settings_id) REFERENCES cookie_consent_settings(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE admin_navigation_registry ADD CONSTRAINT fk_navigation_parent FOREIGN KEY (parent_key) REFERENCES admin_navigation_registry(key) ON DELETE CASCADE;

ALTER TABLE plugin_version_comparisons ADD CONSTRAINT fk_plugin_comparison_from FOREIGN KEY (from_version_id) REFERENCES plugin_version_history(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_comparisons ADD CONSTRAINT fk_plugin_comparison_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_comparisons ADD CONSTRAINT fk_plugin_comparison_to FOREIGN KEY (to_version_id) REFERENCES plugin_version_history(id) ON DELETE CASCADE;

ALTER TABLE plugin_controllers ADD CONSTRAINT fk_plugin_controllers_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE plugin_docs ADD CONSTRAINT fk_plugin_docs_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE plugin_entities ADD CONSTRAINT fk_plugin_entities_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE plugin_migrations ADD CONSTRAINT fk_plugin_migrations_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_patches ADD CONSTRAINT fk_plugin_patch_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_patches ADD CONSTRAINT fk_plugin_patch_version FOREIGN KEY (version_id) REFERENCES plugin_version_history(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_snapshots ADD CONSTRAINT fk_plugin_snapshot_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_snapshots ADD CONSTRAINT fk_plugin_snapshot_version FOREIGN KEY (version_id) REFERENCES plugin_version_history(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_tags ADD CONSTRAINT fk_plugin_tag_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_tags ADD CONSTRAINT fk_plugin_tag_version FOREIGN KEY (version_id) REFERENCES plugin_version_history(id) ON DELETE CASCADE;

ALTER TABLE plugin_version_history ADD CONSTRAINT fk_plugin_version_parent FOREIGN KEY (parent_version_id) REFERENCES plugin_version_history(id) ON DELETE SET NULL;

ALTER TABLE plugin_version_history ADD CONSTRAINT fk_plugin_version_plugin FOREIGN KEY (plugin_id) REFERENCES plugin_registry(id) ON DELETE CASCADE;

ALTER TABLE heatmap_aggregations ADD CONSTRAINT heatmap_aggregations_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE heatmap_interactions ADD CONSTRAINT heatmap_interactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE heatmap_interactions ADD CONSTRAINT heatmap_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE heatmap_sessions ADD CONSTRAINT heatmap_sessions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE heatmap_sessions ADD CONSTRAINT heatmap_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE integration_configs ADD CONSTRAINT integration_configs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE job_history ADD CONSTRAINT job_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE jobs ADD CONSTRAINT jobs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE media_assets ADD CONSTRAINT media_assets_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE media_assets ADD CONSTRAINT media_assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);

ALTER TABLE payment_method_translations ADD CONSTRAINT payment_method_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE payment_method_translations ADD CONSTRAINT payment_method_translations_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE pdf_template_translations ADD CONSTRAINT pdf_template_translations_pdf_template_id_fkey FOREIGN KEY (pdf_template_id) REFERENCES pdf_templates(id) ON DELETE CASCADE;

ALTER TABLE pdf_templates ADD CONSTRAINT pdf_templates_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE plugin_configurations ADD CONSTRAINT plugin_configurations_last_configured_by_fkey FOREIGN KEY (last_configured_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE plugin_configurations ADD CONSTRAINT plugin_configurations_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE plugin_marketplace ADD CONSTRAINT plugin_marketplace_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id);

ALTER TABLE plugin_registry ADD CONSTRAINT plugin_registry_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES users(id);

ALTER TABLE product_attribute_values ADD CONSTRAINT product_attribute_values_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES attributes(id) ON UPDATE CASCADE;

ALTER TABLE product_attribute_values ADD CONSTRAINT product_attribute_values_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE;

ALTER TABLE product_attribute_values ADD CONSTRAINT product_attribute_values_value_id_fkey FOREIGN KEY (value_id) REFERENCES attribute_values(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE product_label_translations ADD CONSTRAINT product_label_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE product_label_translations ADD CONSTRAINT product_label_translations_product_label_id_fkey FOREIGN KEY (product_label_id) REFERENCES product_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE product_labels ADD CONSTRAINT product_labels_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE product_seo ADD CONSTRAINT product_seo_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE product_seo ADD CONSTRAINT product_seo_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE product_tab_translations ADD CONSTRAINT product_tab_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE product_tab_translations ADD CONSTRAINT product_tab_translations_product_tab_id_fkey FOREIGN KEY (product_tab_id) REFERENCES product_tabs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE product_tabs ADD CONSTRAINT product_tabs_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE product_translations ADD CONSTRAINT product_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE product_translations ADD CONSTRAINT product_translations_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE product_variants ADD CONSTRAINT product_variants_parent_product_id_fkey FOREIGN KEY (parent_product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE product_variants ADD CONSTRAINT product_variants_variant_product_id_fkey FOREIGN KEY (variant_product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE products ADD CONSTRAINT products_attribute_set_id_fkey FOREIGN KEY (attribute_set_id) REFERENCES attribute_sets(id) ON DELETE SET NULL;

ALTER TABLE products ADD CONSTRAINT products_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE products ADD CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE redirects ADD CONSTRAINT redirects_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE sales_invoices ADD CONSTRAINT sales_invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES sales_orders(id);

ALTER TABLE sales_invoices ADD CONSTRAINT sales_invoices_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE sales_order_items ADD CONSTRAINT sales_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE sales_order_items ADD CONSTRAINT sales_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE sales_shipments ADD CONSTRAINT sales_shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES sales_orders(id);

ALTER TABLE sales_shipments ADD CONSTRAINT sales_shipments_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE seo_settings ADD CONSTRAINT seo_settings_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE seo_templates ADD CONSTRAINT seo_templates_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE shipping_method_translations ADD CONSTRAINT shipping_method_translations_language_code_fkey FOREIGN KEY (language_code) REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE shipping_method_translations ADD CONSTRAINT shipping_method_translations_shipping_method_id_fkey FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE shipping_methods ADD CONSTRAINT shipping_methods_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE slot_configurations ADD CONSTRAINT slot_configurations_acceptance_published_by_fkey FOREIGN KEY (acceptance_published_by) REFERENCES users(id);

ALTER TABLE slot_configurations ADD CONSTRAINT slot_configurations_current_edit_id_fkey FOREIGN KEY (current_edit_id) REFERENCES slot_configurations(id);

ALTER TABLE slot_configurations ADD CONSTRAINT slot_configurations_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES slot_configurations(id);

ALTER TABLE slot_configurations ADD CONSTRAINT slot_configurations_published_by_fkey FOREIGN KEY (published_by) REFERENCES users(id);

ALTER TABLE slot_configurations ADD CONSTRAINT slot_configurations_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE slot_configurations ADD CONSTRAINT slot_configurations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE store_uptime ADD CONSTRAINT store_uptime_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE store_uptime ADD CONSTRAINT store_uptime_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE stores ADD CONSTRAINT stores_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE taxes ADD CONSTRAINT taxes_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE;

ALTER TABLE translations ADD CONSTRAINT translations_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id);

ALTER TABLE usage_metrics ADD CONSTRAINT usage_metrics_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE wishlists ADD CONSTRAINT wishlists_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE CASCADE;

ALTER TABLE wishlists ADD CONSTRAINT wishlists_store_id_fkey FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;

ALTER TABLE wishlists ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- ALTER TABLE storage.objects ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);
--
-- ALTER TABLE storage.prefixes ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);
--
-- ALTER TABLE storage.s3_multipart_uploads ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);
--
-- ALTER TABLE storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);
--
-- ALTER TABLE storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;

-- ============================================
-- SECTION 7: PERMISSIONS
-- Grant full access to postgres role and disable RLS
-- ============================================

-- Disable RLS on all tables (tenant isolation handled at application level)
ALTER TABLE IF EXISTS stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS attribute_sets DISABLE ROW LEVEL SECURITY;

-- Grant all privileges to postgres role on all tables in public schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO postgres;

-- Grant to service_role as well (used by Supabase backend)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;


