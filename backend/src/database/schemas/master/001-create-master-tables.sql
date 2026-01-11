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
  name VARCHAR(255) NOT NULL DEFAULT 'My Store',  -- Store name (needed before tenant DB exists)
  slug VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending_database' CHECK (status IN (
    'pending_database',  -- Waiting for DB connection
    'provisioning',      -- Creating tenant DB
    'provisioned',       -- DB ready, awaiting profile completion (step 3)
    'active',           -- Fully operational (no demo data)
    'demo',             -- Fully operational with demo data
    'suspended',        -- Temporarily disabled
    'inactive'          -- Permanently disabled
  )),
  is_active BOOLEAN DEFAULT false,
  theme_preset VARCHAR(50) DEFAULT 'default',  -- Reference to selected theme preset (full settings in tenant DB)
  country VARCHAR(2),                          -- ISO 2-letter country code (collected in onboarding step 1)
  phone VARCHAR(50),                           -- Store contact phone (optional)
  store_email VARCHAR(255),                    -- Store contact email (optional)
  provisioning_status VARCHAR(50) DEFAULT 'pending' CHECK (provisioning_status IN (
    'pending',           -- Not started
    'tables_creating',   -- Creating 137 tables
    'tables_completed',  -- Tables done
    'seed_running',      -- Inserting seed data
    'seed_completed',    -- Core seed done
    'demo_running',      -- Inserting demo data (if requested)
    'completed',         -- All done (with or without demo)
    'failed'             -- Something failed
  )),
  provisioning_progress JSONB DEFAULT '{}'::jsonb,  -- { step, current, total, message, error, demo_requested }
  provisioning_completed_at TIMESTAMP DEFAULT NULL,  -- Set when all provisioning completes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stores_country ON stores(country);

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

  -- Migration tracking
  schema_version INTEGER DEFAULT 0,
  has_pending_migration BOOLEAN DEFAULT true,
  last_migration_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_databases_store_id ON store_databases(store_id);
CREATE INDEX IF NOT EXISTS idx_store_databases_active ON store_databases(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_store_databases_pending_migrations ON store_databases(schema_version) WHERE is_active = true;

-- ============================================
-- 3.5. TENANT_MIGRATIONS TABLE
-- Tracks which migrations have been applied to each tenant database
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  migration_name VARCHAR(255) NOT NULL,
  migration_version INTEGER NOT NULL,
  description TEXT,
  applied_at TIMESTAMP DEFAULT NOW(),
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,

  UNIQUE(store_id, migration_name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_migrations_store_id ON tenant_migrations(store_id);
CREATE INDEX IF NOT EXISTS idx_tenant_migrations_version ON tenant_migrations(migration_version);

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
-- 6b. CREDIT_USAGE TABLE
-- Tracks individual credit usage/deductions across all stores
-- Centralized in master for cross-store reporting
-- ============================================
CREATE TABLE IF NOT EXISTS credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,  -- Nullable for user-level operations

  -- Usage details
  credits_used NUMERIC(10, 4) NOT NULL,
  usage_type VARCHAR(100) NOT NULL,  -- e.g., 'store_publishing', 'custom_domain', 'akeneo_schedule', 'ai_translation'

  -- Reference to what consumed the credits
  reference_id VARCHAR(255),         -- UUID or other ID of the related entity
  reference_type VARCHAR(100),       -- Type of entity (e.g., 'store', 'domain', 'schedule', 'product')

  -- Description and metadata
  description TEXT,
  model_used VARCHAR(100),           -- LLM model used (e.g., 'claude-sonnet', 'gpt-4')
  metadata JSONB DEFAULT '{}',       -- Additional context (balance_before, balance_after, etc.)

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user_id ON credit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_store_id ON credit_usage(store_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_store ON credit_usage(user_id, store_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_usage_type ON credit_usage(usage_type);
CREATE INDEX IF NOT EXISTS idx_credit_usage_reference ON credit_usage(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_credit_usage_created_at ON credit_usage(created_at DESC);

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
  cost_per_unit DECIMAL(10, 4) NOT NULL,    -- What we charge (in credits)
  cost_price_usd DECIMAL(10, 6) DEFAULT NULL, -- Actual cost to us in USD (for margin calculation)
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
-- 9. USAGE_METRICS TABLE - REMOVED
-- No longer tracking usage metrics in database
-- ============================================

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
-- cost_per_unit = credits charged (1 credit = $0.10)
-- cost_price_usd = actual cost to us in USD
-- ============================================
-- ============================================
-- Add cost_price_usd column to service_credit_costs
-- Allows tracking actual provider costs for margin calculation
-- Position: AFTER cost_per_unit
-- ============================================
--
-- PRICING ASSUMPTIONS (as of Jan 2025):
--
-- ANTHROPIC (per 1M tokens):
--   Haiku 3.5:  $0.80 input, $4.00 output
--   Sonnet 3.5: $3.00 input, $15.00 output
--   Opus 3:     $15.00 input, $75.00 output
--
-- OPENAI (per 1M tokens):
--   GPT-4o mini: $0.15 input, $0.60 output
--   GPT-4o:      $2.50 input, $10.00 output
--   DALL-E 3:    $0.04-$0.12 per image
--
-- GOOGLE (per 1M tokens):
--   Gemini 2.0 Flash: $0.10 input, $0.40 output
--   Gemini 1.5 Pro:   $1.25 input, $5.00 output
--   Imagen 3:         ~$0.03 per image
--
-- GROQ (per 1M tokens):
--   Llama 3.3 70B: $0.59 input, $0.79 output
--   Mixtral 8x7B:  $0.24 input, $0.24 output
--
-- DEEPSEEK (per 1M tokens):
--   DeepSeek Chat: $0.14 input, $0.28 output
--
-- FLUX/BFL (per image):
--   Pro 1.1:  $0.05
--   Dev:      $0.025
--   Schnell:  $0.003
--
-- TOKEN USAGE ESTIMATES:
--   Chat session:    ~2,000 input + ~1,000 output
--   Translation:     ~500 input + ~300 output
--   CMS Block:       ~1,000 input + ~800 output
--   CMS Page:        ~3,000 input + ~2,500 output
--   Plugin gen:      ~5,000 input + ~3,000 output
--   Code patch:      ~10,000 input + ~5,000 output
--   Layout gen:      ~8,000 input + ~4,000 output
-- ============================================

CREATE TABLE service_credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key VARCHAR(100) UNIQUE NOT NULL,
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
  cost_per_unit DECIMAL(10, 4) NOT NULL,
  cost_price_usd DECIMAL(10, 6) DEFAULT NULL,
  billing_type VARCHAR(50) NOT NULL CHECK (billing_type IN (
        'per_use', 'per_day', 'per_month', 'per_hour', 'per_item', 'per_mb', 'flat_rate'
  )),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Recreate indexes
CREATE INDEX idx_service_credit_costs_key ON service_credit_costs(service_key);
CREATE INDEX idx_service_credit_costs_category ON service_credit_costs(service_category);
CREATE INDEX idx_service_credit_costs_active ON service_credit_costs(is_active) WHERE is_active = true;
CREATE INDEX idx_service_credit_costs_display_order ON service_credit_costs(display_order);

-- ============================================
-- INSERT ALL 86 SERVICES WITH COST PRICES
-- cost_per_unit = credits charged (1 credit = $0.10)
-- cost_price_usd = actual cost to us in USD
-- ============================================

INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, cost_price_usd, billing_type, description, is_active, is_visible, display_order, metadata)
VALUES
    -- ==========================================
    -- STORE OPERATIONS (4)
    -- ==========================================
    ('store_daily_publishing', 'Store Daily Publishing', 'store_operations', 3.0000, 0.05, 'per_day', 'Daily hosting fee for published stores', true, true, 10, '{"note":"Charged daily at midnight UTC"}'),
    ('store_deployment', 'Store Deployment', 'store_operations', 0.0000, 0.00, 'per_use', 'One-time deployment of a new store', true, true, 11, '{"note":"Currently free"}'),
    ('store_backup', 'Store Backup', 'store_operations', 0.5000, 0.02, 'per_use', 'Manual store backup creation', true, true, 12, '{"note":"Automated backups included"}'),

    -- ==========================================
    -- PLUGIN MANAGEMENT (3)
    -- ==========================================
    ('plugin_install', 'Plugin Installation', 'plugin_management', 10.0000, 0.01, 'per_use', 'Installing a plugin to a store', true, true, 20, '{"note":"One-time charge per plugin per store"}'),
    ('plugin_monthly', 'Premium Plugin Monthly Fee', 'plugin_management', 5.0000, 0.10, 'per_month', 'Monthly subscription for premium plugins', true, true, 21, '{"applies_to":"premium_plugins_only"}'),
    ('custom_plugin_creation', 'Custom Plugin Creation', 'plugin_management', 70.0000, 0.50, 'per_use', 'Creating a custom plugin with AI', true, true, 22, '{"note":"AI-powered plugin generation"}'),

    -- ==========================================
    -- AI TRANSLATION SERVICES (14)
    -- Uses Haiku: $0.80/1M in, $4/1M out
    -- Standard: ~500 in + ~300 out = $0.002
    -- CMS Block: ~1K in + ~800 out = $0.004
    -- CMS Page: ~3K in + ~2.5K out = $0.012
    -- ==========================================
    ('ai_translation', 'AI Translation (Standard)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for products, categories, attributes, etc.', true, true, 30, '{"note":"Standard content: products, categories, attributes, labels, tabs","applies_to":["product","category","attribute","product_tab","product_label","ui_label","cookie_consent"]}'),
    ('ai_translation_cms_block', 'AI Translation (CMS Block)', 'ai_services', 0.2000, 0.004, 'per_item', 'AI translation for CMS content blocks', true, true, 31, '{"note":"CMS blocks with medium-length content","multiplier":2}'),
    ('ai_translation_cms_page', 'AI Translation (CMS Page)', 'ai_services', 4.0000, 0.012, 'per_item', 'AI translation for full CMS pages', true, true, 32, '{"note":"Full CMS pages with long-form content","multiplier":5}'),
    ('ai_translation_product', 'AI Translation (Product)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for product names and descriptions', true, true, 101, '{"note":"Product name and description translation"}'),
    ('ai_translation_category', 'AI Translation (Category)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for category names and descriptions', true, true, 102, '{"note":"Category name and description translation"}'),
    ('ai_translation_attribute', 'AI Translation (Attribute)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for product attributes', true, true, 103, '{"note":"Product attribute label translation"}'),
    ('ai_translation_product_tab', 'AI Translation (Product Tab)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for product tabs', true, true, 106, '{"note":"Product tab content translation"}'),
    ('ai_translation_product_label', 'AI Translation (Product Label)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for product labels', true, true, 107, '{"note":"Product label text translation"}'),
    ('ai_translation_cookie_consent', 'AI Translation (Cookie Consent)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for cookie consent text', true, true, 108, '{"note":"Cookie consent banner translation"}'),
    ('ai_translation_attribute_value', 'AI Translation (Attribute Value)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for attribute values', true, true, 109, '{"note":"Product attribute value translation"}'),
    ('ai_translation_email_template', 'AI Translation (Email Template)', 'ai_services', 12.0000, 0.015, 'per_item', 'AI translation for email templates', true, true, 110, '{"note":"Email template subject and content translation"}'),
    ('ai_translation_pdf_template', 'AI Translation (PDF Template)', 'ai_services', 3.0000, 0.008, 'per_item', 'AI translation for PDF templates', true, true, 111, '{"note":"PDF template content translation"}'),
    ('ai_translation_custom_option', 'AI Translation (Custom Option)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for custom product options', true, true, 112, '{"note":"Custom product option translation"}'),
    ('ai_translation_stock_label', 'AI Translation (Stock Label)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for stock labels', true, true, 113, '{"note":"Stock availability label translation"}'),

    -- ==========================================
    -- AI CONTENT & SEO SERVICES (4)
    -- Uses Sonnet for quality: $3/1M in, $15/1M out
    -- Product desc: ~1K in + ~500 out = $0.0105
    -- SEO: ~2K in + ~1K out = $0.021
    -- Code patch: ~10K in + ~5K out = $0.105
    -- Layout: ~8K in + ~4K out = $0.084
    -- ==========================================
    ('ai_product_description', 'AI Product Description', 'ai_services', 0.2000, 0.0105, 'per_item', 'AI-generated product descriptions', true, true, 33, '{"note":"Per product"}'),
    ('ai_seo_optimization', 'AI SEO Optimization', 'ai_services', 0.5000, 0.021, 'per_use', 'AI-powered SEO analysis and optimization', true, true, 34, '{"note":"Per page or product"}'),
    ('ai_code_patch', 'AI Code Modification', 'ai_services', 25.0000, 0.105, 'per_use', 'AI-powered code editing and patching', true, true, 35, '{"note":"Per code modification"}'),
    ('ai_layout_generation', 'AI Layout Generation', 'ai_services', 40.0000, 0.084, 'per_use', 'AI-generated page layouts and designs', true, true, 36, '{"note":"Per layout generation"}'),

    -- ==========================================
    -- AI CHAT - GENERAL (1)
    -- Default uses Haiku pricing
    -- ==========================================
    ('ai_chat', 'AI General Chat', 'ai_services', 1.0000, 0.006, 'per_use', 'General AI assistant interactions', true, true, 37, '{"note":"Per chat session"}'),

    -- ==========================================
    -- AI CHAT - CLAUDE/ANTHROPIC (3)
    -- ~2K input + ~1K output tokens per chat
    -- Haiku:  (2K×$0.80 + 1K×$4)/1M = $0.006
    -- Sonnet: (2K×$3 + 1K×$15)/1M = $0.021
    -- Opus:   (2K×$15 + 1K×$75)/1M = $0.105
    -- ==========================================
    ('ai_chat_claude_haiku', 'AI Chat - Claude Haiku', 'ai_services', 2.1000, 0.006, 'per_use', 'Claude 3 Haiku - Fast and affordable', true, true, 36, '{"note":"Fastest Claude model","model":"claude-3-5-haiku-latest","provider":"anthropic"}'),
    ('ai_chat_claude_sonnet', 'AI Chat - Claude Sonnet', 'ai_services', 8.0000, 0.021, 'per_use', 'Claude 3.5 Sonnet - Balanced performance', true, true, 37, '{"note":"Best balance of speed and quality","model":"claude-3-5-sonnet-latest","provider":"anthropic"}'),
    ('ai_chat_claude_opus', 'AI Chat - Claude Opus', 'ai_services', 25.0000, 0.105, 'per_use', 'Claude 3 Opus - Most capable', true, true, 38, '{"note":"Most powerful Claude model","model":"claude-3-opus-20240229","provider":"anthropic"}'),

    -- ==========================================
    -- AI CHAT - OPENAI (2)
    -- ~2K input + ~1K output tokens per chat
    -- GPT-4o mini: (2K×$0.15 + 1K×$0.60)/1M = $0.001
    -- GPT-4o:      (2K×$2.50 + 1K×$10)/1M = $0.015
    -- ==========================================
    ('ai_chat_gpt4o_mini', 'AI Chat - GPT-4o Mini', 'ai_services', 3.1000, 0.001, 'per_use', 'OpenAI GPT-4o Mini - Fast and efficient', true, true, 39, '{"note":"Fast and affordable OpenAI model","model":"gpt-4o-mini","provider":"openai"}'),
    ('ai_chat_gpt4o', 'AI Chat - GPT-4o', 'ai_services', 15.0000, 0.015, 'per_use', 'OpenAI GPT-4o - Latest flagship', true, true, 40, '{"note":"Most capable OpenAI model","model":"gpt-4o","provider":"openai"}'),

    -- ==========================================
    -- AI CHAT - GEMINI (2)
    -- ~2K input + ~1K output tokens per chat
    -- Flash: (2K×$0.10 + 1K×$0.40)/1M = $0.0006
    -- Pro:   (2K×$1.25 + 1K×$5)/1M = $0.0075
    -- ==========================================
    ('ai_chat_gemini_flash', 'AI Chat - Gemini Flash', 'ai_services', 1.6000, 0.0006, 'per_use', 'Google Gemini 1.5 Flash - Ultra fast', true, true, 41, '{"note":"Fastest Gemini model","model":"gemini-2.0-flash","provider":"gemini"}'),
    ('ai_chat_gemini_pro', 'AI Chat - Gemini Pro', 'ai_services', 10.0000, 0.0075, 'per_use', 'Google Gemini 1.5 Pro - Advanced reasoning', true, true, 42, '{"note":"Most capable Gemini model","model":"gemini-1.5-pro","provider":"gemini"}'),

    -- ==========================================
    -- AI CHAT - GROQ (2)
    -- ~2K input + ~1K output tokens per chat
    -- Llama:   (2K×$0.59 + 1K×$0.79)/1M = $0.002
    -- Mixtral: (2K×$0.24 + 1K×$0.24)/1M = $0.0007
    -- ==========================================
    ('ai_chat_groq_llama', 'AI Chat - Groq Llama', 'ai_services', 1.2000, 0.002, 'per_use', 'Groq Llama 3.1 70B - Lightning fast', true, true, 43, '{"note":"Ultra-fast inference with Groq","model":"llama-3.3-70b-versatile","provider":"groq"}'),
    ('ai_chat_groq_mixtral', 'AI Chat - Groq Mixtral', 'ai_services', 0.5000, 0.0007, 'per_use', 'Groq Mixtral 8x7B - Fast MoE model', true, true, 44, '{"note":"Fast mixture-of-experts model","model":"mixtral-8x7b-32768","provider":"groq"}'),

    -- ==========================================
    -- DATA MIGRATION (3)
    -- ==========================================
    ('product_import', 'Product Import', 'data_migration', 0.1000, 0.001, 'per_item', 'Bulk product import', true, true, 40, '{"note":"Per product imported","min_charge":1}'),
    ('shopify_migration', 'Shopify Store Migration', 'data_migration', 25.0000, 2.00, 'flat_rate', 'Full store migration from Shopify', true, true, 41, '{"note":"Includes products, customers, orders"}'),
    ('csv_import', 'CSV Data Import', 'data_migration', 1.0000, 0.05, 'per_use', 'Import data from CSV files', true, true, 42, '{"note":"Per CSV file, up to 10,000 rows"}'),

    -- ==========================================
    -- AKENEO INTEGRATION (3)
    -- ==========================================
    ('akeneo_schedule_run', 'Akeneo Scheduled Import', 'akeneo_integration', 0.1000, 0.01, 'per_use', 'Automated Akeneo data synchronization', true, true, 50, '{"note":"Per scheduled execution"}'),
    ('akeneo_manual_import', 'Akeneo Manual Import', 'akeneo_integration', 0.1000, 0.01, 'per_use', 'Manual Akeneo data import', true, true, 51, '{"note":"On-demand import"}'),
    ('akeneo_setup', 'Akeneo Integration Setup', 'akeneo_integration', 5.0000, 0.50, 'per_use', 'Initial Akeneo integration configuration', true, true, 52, '{"note":"One-time setup fee"}'),

    -- ==========================================
    -- STORAGE (3)
    -- ==========================================
    ('storage_per_gb', 'Additional Storage', 'storage', 0.5000, 0.02, 'per_mb', 'Additional storage beyond free tier', true, true, 60, '{"note":"Per GB per month","free_tier_gb":1}'),
    ('image_optimization', 'Image Optimization', 'storage', 0.0100, 0.002, 'per_item', 'Automatic image optimization and compression', true, true, 61, '{"note":"Per image"}'),
    ('cdn_bandwidth', 'CDN Bandwidth', 'storage', 0.0010, 0.0005, 'per_mb', 'Content delivery network bandwidth', true, true, 62, '{"note":"Per GB","free_tier_gb":10}'),

    -- ==========================================
    -- PLUGIN AI - CLAUDE/ANTHROPIC (3)
    -- ~5K input + ~3K output tokens for plugin gen
    -- Haiku:  (5K×$0.80 + 3K×$4)/1M = $0.016
    -- Sonnet: (5K×$3 + 3K×$15)/1M = $0.06
    -- Opus:   (5K×$15 + 3K×$75)/1M = $0.30
    -- ==========================================
    ('ai_plugin_claude_haiku', 'Plugin AI - Claude Haiku', 'ai_services', 5.0000, 0.016, 'per_use', 'Claude 3 Haiku - Fast plugin generation', true, true, 60, '{"note":"Fast and affordable","model":"claude-3-haiku-20240307","provider":"anthropic"}'),
    ('ai_plugin_claude_sonnet', 'Plugin AI - Claude Sonnet', 'ai_services', 10.0000, 0.06, 'per_use', 'Claude 3.5 Sonnet - Balanced plugin generation', true, true, 61, '{"note":"Best balance of speed and quality","model":"claude-3-5-sonnet-20241022","provider":"anthropic"}'),
    ('ai_plugin_claude_opus', 'Plugin AI - Claude Opus', 'ai_services', 20.0000, 0.30, 'per_use', 'Claude 3 Opus - Premium plugin generation', true, true, 62, '{"note":"Highest quality","model":"claude-3-opus-20240229","provider":"anthropic"}'),

    -- ==========================================
    -- PLUGIN AI - OPENAI (2)
    -- ~5K input + ~3K output tokens for plugin gen
    -- GPT-4o mini: (5K×$0.15 + 3K×$0.60)/1M = $0.003
    -- GPT-4o:      (5K×$2.50 + 3K×$10)/1M = $0.043
    -- ==========================================
    ('ai_plugin_openai_gpt4o_mini', 'Plugin AI - GPT-4o Mini', 'ai_services', 5.0000, 0.003, 'per_use', 'GPT-4o Mini - Fast OpenAI plugin generation', true, true, 63, '{"note":"Fast and affordable","model":"gpt-4o-mini","provider":"openai"}'),
    ('ai_plugin_openai_gpt4o', 'Plugin AI - GPT-4o', 'ai_services', 12.0000, 0.043, 'per_use', 'GPT-4o - Premium OpenAI plugin generation', true, true, 64, '{"note":"Latest GPT-4 model","model":"gpt-4o","provider":"openai"}'),

    -- ==========================================
    -- PLUGIN AI - GEMINI (2)
    -- ~5K input + ~3K output tokens for plugin gen
    -- Flash: (5K×$0.10 + 3K×$0.40)/1M = $0.0017
    -- Pro:   (5K×$1.25 + 3K×$5)/1M = $0.021
    -- ==========================================
    ('ai_plugin_gemini_flash', 'Plugin AI - Gemini Flash', 'ai_services', 3.0000, 0.0017, 'per_use', 'Gemini 2.0 Flash - Ultra fast plugin generation', true, true, 65, '{"note":"Fastest Gemini model","model":"gemini-2.0-flash","provider":"gemini"}'),
    ('ai_plugin_gemini_pro', 'Plugin AI - Gemini Pro', 'ai_services', 8.0000, 0.021, 'per_use', 'Gemini Pro - Advanced plugin generation', true, true, 66, '{"note":"Advanced reasoning","model":"gemini-pro","provider":"gemini"}'),

    -- ==========================================
    -- PLUGIN AI - GROQ (1)
    -- ~5K input + ~3K output tokens for plugin gen
    -- Llama: (5K×$0.59 + 3K×$0.79)/1M = $0.005
    -- ==========================================
    ('ai_plugin_groq_llama', 'Plugin AI - Groq Llama', 'ai_services', 2.0000, 0.005, 'per_use', 'Llama 3.3 70B on Groq - Lightning fast', true, true, 67, '{"note":"Fastest inference","model":"llama-3.3-70b-versatile","provider":"groq"}'),

    -- ==========================================
    -- PLUGIN AI - DEEPSEEK (1)
    -- ~5K input + ~3K output tokens for plugin gen
    -- DeepSeek: (5K×$0.14 + 3K×$0.28)/1M = $0.002
    -- ==========================================
    ('ai_plugin_deepseek', 'Plugin AI - DeepSeek', 'ai_services', 3.0000, 0.002, 'per_use', 'DeepSeek Chat - Cost-effective plugin generation', true, true, 68, '{"note":"Cost-effective coding model","model":"deepseek-chat","provider":"deepseek"}'),

    -- ==========================================
    -- OTHER SERVICES (3)
    -- ==========================================
    ('api_rate_boost', 'API Rate Limit Boost', 'other', 10.0000, 0.10, 'per_month', 'Increase API rate limits', true, true, 70, '{"boost_multiplier":10}'),
    ('priority_support', 'Priority Support', 'other', 15.0000, 1.00, 'per_month', 'Priority customer support', true, true, 71, '{"sla":"4 hours"}'),
    ('custom_domain', 'Custom Domain Setup', 'other', 0.3000, 0.01, 'per_day', 'Configure custom domain for store', true, true, 72, '{"note":"One-time setup fee"}'),

    -- ==========================================
    -- IMAGE AI - OPENAI (7)
    -- DALL-E 3: $0.04 (1024x1024), $0.08 (1024x1792), $0.12 (HD)
    -- Vision analysis: ~$0.01 per image
    -- ==========================================
    ('ai_image_openai_compress', 'OpenAI Image Compress', 'ai_services', 0.5000, 0.01, 'per_use', 'AI-powered image compression using OpenAI', true, true, 100, '{"icon":"🤖","provider":"openai","operation":"compress"}'),
    ('ai_image_openai_upscale', 'OpenAI Image Upscale', 'ai_services', 1.5000, 0.04, 'per_use', 'Image upscaling and enhancement using OpenAI', true, true, 101, '{"icon":"🤖","provider":"openai","operation":"upscale"}'),
    ('ai_image_openai_remove_bg', 'OpenAI Background Removal', 'ai_services', 1.5000, 0.04, 'per_use', 'AI background removal using OpenAI', true, true, 102, '{"icon":"🤖","provider":"openai","operation":"remove_bg"}'),
    ('ai_image_openai_stage', 'OpenAI Product Staging', 'ai_services', 2.5000, 0.08, 'per_use', 'Place product in realistic environment using OpenAI', true, true, 103, '{"icon":"🤖","provider":"openai","operation":"stage"}'),
    ('ai_image_openai_convert', 'OpenAI Format Convert', 'ai_services', 0.3000, 0.01, 'per_use', 'Smart format conversion using OpenAI', true, true, 104, '{"icon":"🤖","provider":"openai","operation":"convert"}'),
    ('ai_image_openai_custom', 'OpenAI Custom', 'ai_services', 2.5000, 0.08, 'per_use', 'Custom AI image modification using OpenAI', true, true, 105, '{"icon":"🤖","provider":"openai","operation":"custom"}'),
    ('ai_image_openai_generate', 'OpenAI Image Generation', 'ai_services', 4.0000, 0.04, 'per_use', 'Generate new images from text using DALL-E 3', true, true, 106, '{"icon":"🤖","provider":"openai","operation":"generate"}'),

    -- ==========================================
    -- IMAGE AI - GEMINI (7)
    -- Imagen 3: ~$0.03 per image
    -- Vision analysis: very cheap ~$0.001
    -- ==========================================
    ('ai_image_gemini_compress', 'Gemini Image Compress', 'ai_services', 0.3000, 0.001, 'per_use', 'AI-powered image compression using Gemini', true, true, 110, '{"icon":"✨","provider":"gemini","operation":"compress"}'),
    ('ai_image_gemini_upscale', 'Gemini Image Upscale', 'ai_services', 0.8000, 0.03, 'per_use', 'Image upscaling and enhancement using Gemini', true, true, 111, '{"icon":"✨","provider":"gemini","operation":"upscale"}'),
    ('ai_image_gemini_remove_bg', 'Gemini Background Removal', 'ai_services', 0.8000, 0.03, 'per_use', 'AI background removal using Gemini', true, true, 112, '{"icon":"✨","provider":"gemini","operation":"remove_bg"}'),
    ('ai_image_gemini_stage', 'Gemini Product Staging', 'ai_services', 1.5000, 0.03, 'per_use', 'Place product in realistic environment using Gemini', true, true, 113, '{"icon":"✨","provider":"gemini","operation":"stage"}'),
    ('ai_image_gemini_convert', 'Gemini Format Convert', 'ai_services', 0.2000, 0.001, 'per_use', 'Smart format conversion using Gemini', true, true, 114, '{"icon":"✨","provider":"gemini","operation":"convert"}'),
    ('ai_image_gemini_custom', 'Gemini Custom', 'ai_services', 1.5000, 0.03, 'per_use', 'Custom AI image modification using Gemini', true, true, 115, '{"icon":"✨","provider":"gemini","operation":"custom"}'),
    ('ai_image_gemini_generate', 'Gemini Image Generation', 'ai_services', 2.5000, 0.03, 'per_use', 'Generate new images from text using Gemini', true, true, 116, '{"icon":"✨","provider":"gemini","operation":"generate"}'),

    -- ==========================================
    -- IMAGE AI - FLUX (10)
    -- BFL Direct API pricing:
    -- Pro 1.1: $0.05, Dev: $0.025, Schnell: $0.003
    -- ==========================================
    ('ai_image_flux_compress', 'Flux Image Compress', 'ai_services', 0.4000, 0.003, 'per_use', 'AI-powered image compression using Flux', true, true, 120, '{"icon":"⚡","provider":"flux","operation":"compress"}'),
    ('ai_image_flux_upscale', 'Flux Image Upscale', 'ai_services', 0.6000, 0.003, 'per_use', 'Image upscaling using Flux/Real-ESRGAN', true, true, 121, '{"icon":"⚡","provider":"flux","operation":"upscale"}'),
    ('ai_image_flux_remove_bg', 'Flux Background Removal', 'ai_services', 0.5000, 0.003, 'per_use', 'AI background removal using Flux/BiRefNet', true, true, 122, '{"icon":"⚡","provider":"flux","operation":"remove_bg"}'),
    ('ai_image_flux_stage', 'Flux Product Staging', 'ai_services', 1.8000, 0.05, 'per_use', 'Place product in realistic environment using Flux', true, true, 123, '{"icon":"⚡","provider":"flux","operation":"stage"}'),
    ('ai_image_flux_convert', 'Flux Format Convert', 'ai_services', 0.2000, 0.001, 'per_use', 'Smart format conversion using Flux', true, true, 124, '{"icon":"⚡","provider":"flux","operation":"convert"}'),
    ('ai_image_flux_custom', 'Flux Custom', 'ai_services', 1.8000, 0.05, 'per_use', 'Custom AI image modification using Flux', true, true, 125, '{"icon":"⚡","provider":"flux","operation":"custom"}'),
    ('ai_image_flux_generate', 'Flux Image Generation', 'ai_services', 0.5000, 0.05, 'per_use', 'Generate new images from text using Flux Pro 1.1', true, true, 126, '{"icon":"⚡","provider":"flux","operation":"generate"}'),
    ('ai_image_flux_generate_pro', 'Flux Pro 1.1 Generation', 'ai_services', 2.0000, 0.05, 'per_use', 'Generate images using Flux Pro 1.1 - highest quality', true, true, 126, '{"icon":"⚡","model":"flux-pro-1.1","provider":"flux","operation":"generate"}'),
    ('ai_image_flux_generate_dev', 'Flux Dev Generation', 'ai_services', 1.0000, 0.025, 'per_use', 'Generate images using Flux Dev - balanced quality/cost', true, true, 127, '{"icon":"⚡","model":"flux-dev","provider":"flux","operation":"generate"}'),
    ('ai_image_flux_generate_schnell', 'Flux Schnell Generation', 'ai_services', 1.5000, 0.003, 'per_use', 'Generate images using Flux Schnell - fastest, budget option', true, true, 128, '{"icon":"⚡","model":"flux-schnell","provider":"flux","operation":"generate"}'),

    -- ==========================================
    -- IMAGE AI - QWEN (7)
    -- Very affordable, similar to Gemini pricing
    -- ==========================================
    ('ai_image_qwen_compress', 'Qwen Image Compress', 'ai_services', 0.2000, 0.001, 'per_use', 'AI-powered image compression using Qwen', true, true, 130, '{"icon":"🎨","provider":"qwen","operation":"compress"}'),
    ('ai_image_qwen_upscale', 'Qwen Image Upscale', 'ai_services', 0.5000, 0.02, 'per_use', 'Image upscaling and enhancement using Qwen', true, true, 131, '{"icon":"🎨","provider":"qwen","operation":"upscale"}'),
    ('ai_image_qwen_remove_bg', 'Qwen Background Removal', 'ai_services', 0.5000, 0.02, 'per_use', 'AI background removal using Qwen', true, true, 132, '{"icon":"🎨","provider":"qwen","operation":"remove_bg"}'),
    ('ai_image_qwen_stage', 'Qwen Product Staging', 'ai_services', 1.2000, 0.02, 'per_use', 'Place product in realistic environment using Qwen', true, true, 133, '{"icon":"🎨","provider":"qwen","operation":"stage"}'),
    ('ai_image_qwen_convert', 'Qwen Format Convert', 'ai_services', 0.1500, 0.001, 'per_use', 'Smart format conversion using Qwen', true, true, 134, '{"icon":"🎨","provider":"qwen","operation":"convert"}'),
    ('ai_image_qwen_custom', 'Qwen Custom', 'ai_services', 1.2000, 0.02, 'per_use', 'Custom AI image modification using Qwen', true, true, 135, '{"icon":"🎨","provider":"qwen","operation":"custom"}'),
    ('ai_image_qwen_generate', 'Qwen Image Generation', 'ai_services', 2.0000, 0.02, 'per_use', 'Generate new images from text using Qwen', true, true, 136, '{"icon":"🎨","provider":"qwen","operation":"generate"}');
-- Add comments
COMMENT ON COLUMN service_credit_costs.cost_price_usd IS 'Actual cost in USD to provide this service (for margin calculation)';
COMMENT ON TABLE service_credit_costs IS 'Pricing for all services that consume credits';

-- Flux      | 0.4 cr   | 0.6 cr  | 0.5 cr    | 1.8 cr| 0.2 cr  | 1.8 cr | (see below)
-- Qwen      | 0.2 cr   | 0.5 cr  | 0.5 cr    | 1.2 cr| 0.15 cr | 1.2 cr | 2.0 cr
-- ============================================
-- Flux Generation Models (BFL direct API pricing):
-- - Flux Pro 1.1:  2 cr   ($0.05 cost) - highest quality
-- - Flux Dev:      1.5 cr ($0.025 cost) - balanced
-- - Flux Schnell:  1 cr   ($0.003 cost) - fastest/cheapest
-- ============================================
-- Margin Calculation:
--   Revenue = cost_per_unit * $0.10 (1 credit = $0.10)
--   Margin  = Revenue - cost_price_usd
--   Margin% = (Revenue - cost_price_usd) / Revenue * 100
-- ============================================

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
  store_id UUID NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_defaults_preset ON theme_defaults(preset_name);
CREATE INDEX IF NOT EXISTS idx_theme_defaults_active ON theme_defaults(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_theme_defaults_type ON theme_defaults(type);
CREATE INDEX IF NOT EXISTS idx_theme_defaults_user_id ON theme_defaults(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_theme_defaults_store_id ON theme_defaults(store_id) WHERE store_id IS NOT NULL;

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
  ('eclipse', 'Eclipse', 'Dark theme with muted colors', '{
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
  ('corporate', 'Corporate', 'Clean business look', '{
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
  }'::jsonb, false, 24),
  ('glacier', 'Glacier', 'Icy cool blue and white', '{
    "primary_button_color": "#0EA5E9",
    "secondary_button_color": "#E0F2FE",
    "add_to_cart_button_color": "#38BDF8",
    "view_cart_button_color": "#7DD3FC",
    "checkout_button_color": "#0EA5E9",
    "place_order_button_color": "#0284C7",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#64748B",
    "breadcrumb_item_hover_color": "#0EA5E9",
    "breadcrumb_active_item_color": "#0C4A6E",
    "breadcrumb_separator_color": "#94A3B8",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#0EA5E9",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#F0F9FF",
    "product_tabs_content_color": "#0C4A6E",
    "product_tabs_attribute_label_color": "#38BDF8",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#64748B",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#0EA5E9",
    "product_tabs_hover_bg": "#F0F9FF",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#BAE6FD",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#0EA5E9",
    "checkout_step_indicator_inactive_color": "#E2E8F0",
    "checkout_step_indicator_completed_color": "#38BDF8",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#0C4A6E",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#BAE6FD",
    "checkout_section_text_color": "#0C4A6E",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#0C4A6E",
    "pagination_button_hover_bg_color": "#F0F9FF",
    "pagination_button_border_color": "#BAE6FD",
    "pagination_active_bg_color": "#0EA5E9",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 25),
  ('terracotta', 'Terracotta', 'Earthy terracotta and clay', '{
    "primary_button_color": "#C2410C",
    "secondary_button_color": "#FED7AA",
    "add_to_cart_button_color": "#EA580C",
    "view_cart_button_color": "#F97316",
    "checkout_button_color": "#C2410C",
    "place_order_button_color": "#9A3412",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#78716C",
    "breadcrumb_item_hover_color": "#C2410C",
    "breadcrumb_active_item_color": "#7C2D12",
    "breadcrumb_separator_color": "#A8A29E",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#C2410C",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#FFEDD5",
    "product_tabs_content_color": "#7C2D12",
    "product_tabs_attribute_label_color": "#EA580C",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#78716C",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#C2410C",
    "product_tabs_hover_bg": "#FFEDD5",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#FDBA74",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#C2410C",
    "checkout_step_indicator_inactive_color": "#D6D3D1",
    "checkout_step_indicator_completed_color": "#EA580C",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#7C2D12",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFBEB",
    "checkout_section_border_color": "#FED7AA",
    "checkout_section_text_color": "#7C2D12",
    "pagination_button_bg_color": "#FFFBEB",
    "pagination_button_text_color": "#7C2D12",
    "pagination_button_hover_bg_color": "#FFEDD5",
    "pagination_button_border_color": "#FED7AA",
    "pagination_active_bg_color": "#C2410C",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 26),
  ('orchid', 'Orchid', 'Soft orchid purple tones', '{
    "primary_button_color": "#9333EA",
    "secondary_button_color": "#E9D5FF",
    "add_to_cart_button_color": "#A855F7",
    "view_cart_button_color": "#C084FC",
    "checkout_button_color": "#9333EA",
    "place_order_button_color": "#7E22CE",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#9333EA",
    "breadcrumb_active_item_color": "#581C87",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#9333EA",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#F3E8FF",
    "product_tabs_content_color": "#581C87",
    "product_tabs_attribute_label_color": "#A855F7",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#9333EA",
    "product_tabs_hover_bg": "#F3E8FF",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#D8B4FE",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#9333EA",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#A855F7",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#581C87",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#E9D5FF",
    "checkout_section_text_color": "#581C87",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#581C87",
    "pagination_button_hover_bg_color": "#F3E8FF",
    "pagination_button_border_color": "#E9D5FF",
    "pagination_active_bg_color": "#9333EA",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 27),
  ('sapphire', 'Sapphire', 'Deep sapphire blue luxury', '{
    "primary_button_color": "#1D4ED8",
    "secondary_button_color": "#BFDBFE",
    "add_to_cart_button_color": "#2563EB",
    "view_cart_button_color": "#3B82F6",
    "checkout_button_color": "#1D4ED8",
    "place_order_button_color": "#1E40AF",
    "font_family": "Inter",
    "breadcrumb_show_home_icon": true,
    "breadcrumb_item_text_color": "#6B7280",
    "breadcrumb_item_hover_color": "#1D4ED8",
    "breadcrumb_active_item_color": "#1E3A8A",
    "breadcrumb_separator_color": "#9CA3AF",
    "breadcrumb_font_size": "0.875rem",
    "breadcrumb_mobile_font_size": "0.75rem",
    "breadcrumb_font_weight": "400",
    "product_tabs_title_color": "#1D4ED8",
    "product_tabs_title_size": "1rem",
    "product_tabs_content_bg": "#DBEAFE",
    "product_tabs_content_color": "#1E3A8A",
    "product_tabs_attribute_label_color": "#2563EB",
    "product_tabs_active_bg": "transparent",
    "product_tabs_inactive_color": "#6B7280",
    "product_tabs_inactive_bg": "transparent",
    "product_tabs_hover_color": "#1D4ED8",
    "product_tabs_hover_bg": "#DBEAFE",
    "product_tabs_font_weight": "500",
    "product_tabs_border_radius": "0.5rem",
    "product_tabs_border_color": "#93C5FD",
    "product_tabs_text_decoration": "none",
    "checkout_step_indicator_active_color": "#1D4ED8",
    "checkout_step_indicator_inactive_color": "#D1D5DB",
    "checkout_step_indicator_completed_color": "#2563EB",
    "checkout_step_indicator_style": "circles",
    "checkout_section_title_color": "#1E3A8A",
    "checkout_section_title_size": "1.25rem",
    "checkout_section_bg_color": "#FFFFFF",
    "checkout_section_border_color": "#BFDBFE",
    "checkout_section_text_color": "#1E3A8A",
    "pagination_button_bg_color": "#FFFFFF",
    "pagination_button_text_color": "#1E3A8A",
    "pagination_button_hover_bg_color": "#DBEAFE",
    "pagination_button_border_color": "#BFDBFE",
    "pagination_active_bg_color": "#1D4ED8",
    "pagination_active_text_color": "#FFFFFF"
  }'::jsonb, false, 28)
ON CONFLICT (preset_name) DO NOTHING;

-- ============================================
-- ADMIN_NAVIGATION_CORE TABLE
-- Core navigation items for admin sidebar (master source of truth)
-- Tenants can override visibility/order in admin_navigation_custom
-- ============================================
CREATE TABLE IF NOT EXISTS admin_navigation_core (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  icon VARCHAR(50),
  route VARCHAR(255),
  parent_key VARCHAR(100),
  default_order_position INTEGER DEFAULT 0,
  default_is_visible BOOLEAN DEFAULT true,
  category VARCHAR(50),
  required_permission VARCHAR(100),
  description TEXT,
  badge_config JSONB,
  type VARCHAR(50) DEFAULT 'standard',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add self-referential FK after table creation (for parent_key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_admin_nav_core_parent'
  ) THEN
    ALTER TABLE admin_navigation_core
    ADD CONSTRAINT fk_admin_nav_core_parent
    FOREIGN KEY (parent_key) REFERENCES admin_navigation_core(key) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_nav_core_key ON admin_navigation_core(key);
CREATE INDEX IF NOT EXISTS idx_admin_nav_core_parent ON admin_navigation_core(parent_key);
CREATE INDEX IF NOT EXISTS idx_admin_nav_core_order ON admin_navigation_core(default_order_position);

-- ============================================
-- ADMIN NAVIGATION CORE SEED DATA
-- Master source of truth for core admin navigation items
-- Order scheme: Top-level = 10, 20, 30... | Children = 1, 2, 3...
-- ============================================

INSERT INTO admin_navigation_core (id, key, label, icon, route, parent_key, default_order_position, default_is_visible, category, required_permission, description, badge_config, type, created_at, updated_at)
VALUES
    -- =============================================
    -- TOP-LEVEL NAVIGATION (default_order_position: 10, 20, 30...)
    -- =============================================
    ('e07959cb-4083-428a-a68f-185f845f9e2d', 'catalog', 'Catalog', 'Package', NULL, NULL, 20, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('6c05b36b-b525-4d55-81fe-b8857ed21572', 'sales', 'Sales', 'Receipt', NULL, NULL, 30, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('63e01829-d4b6-4e8e-a7f2-9578d4c7f394', 'content', 'Content', 'FileText', NULL, NULL, 40, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000002', 'analytics', 'Analytics', 'BarChart3', NULL, NULL, 45, true, NULL, NULL, 'Tracking and insights', NULL, 'standard', NOW(), NOW()),
    ('8ed2a4ed-f089-4d31-907c-4890a0fe3f93', 'marketing', 'Marketing', 'Mail', NULL, NULL, 50, false, NULL, NULL, 'Email campaigns and automations', NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000003', 'crm', 'CRM', 'Users', NULL, NULL, 55, false, NULL, NULL, 'Sales pipeline and leads', NULL, 'standard', NOW(), NOW()),
    ('245a141f-f41b-4e1c-9030-639681b0ac7d', 'import_export', 'Import & Export', 'Upload', NULL, NULL, 60, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('458e07de-a8b2-401a-91bb-bcb4bab85456', 'seo', 'SEO', 'Search', NULL, NULL, 70, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('c8478891-a228-42c7-bf48-df2543ac9536', 'layout', 'Layout', 'Megaphone', NULL, NULL, 80, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('ffb70e1a-6d90-46bd-a890-7837404ff1ab', 'store', 'Store', 'Store', NULL, NULL, 90, true, NULL, NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000001', 'advanced', 'Advanced', 'Settings', NULL, NULL, 100, false, NULL, NULL, 'Advanced settings and tools', NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- CATALOG CHILDREN (parent: catalog, order: 1, 2, 3...)
    -- =============================================
    ('be829aa4-6a01-4db3-a73d-c7d105f838f1', 'products', 'Products', 'Package', '/admin/products', 'catalog', 1, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('0e599da5-acb3-42b9-95f3-40bec8114ecf', 'categories', 'Categories', 'Tag', '/admin/categories', 'catalog', 2, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('29f2a22b-fa56-466b-80fe-5f970db59f39', 'attributes', 'Attributes', 'Box', '/admin/attributes', 'catalog', 3, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('0668a4f5-529c-4e15-b230-e3ae93f3aeb7', 'custom_option_rules', 'Custom Options', 'Settings', '/admin/custom-option-rules', 'catalog', 4, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('5025c86d-8955-4c4d-a67a-78212e0e7182', 'product_tabs', 'Product Tabs', 'FileText', '/admin/product-tabs', 'catalog', 5, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('2036d4dc-cbb7-4587-95bf-5dbfea2741dc', 'product_labels', 'Product Labels', 'Tag', '/admin/product-labels', 'catalog', 6, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('0a442ac7-a056-4da4-9f40-902c5a41bd00', 'stock_settings', 'Stock Settings', 'Package', '/admin/stock-settings', 'catalog', 7, true, 'catalog', NULL, NULL, NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- SALES CHILDREN (parent: sales, order: 1, 2, 3...)
    -- =============================================
    ('5bfea719-f62a-40e4-ba87-9259fb295e99', 'sales-settings', 'Settings', 'SettingsIcon', '/admin/sales-settings', 'sales', 1, true, 'main', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('34efb882-144a-4177-90a4-0da9312baef7', 'orders', 'Orders', 'Receipt', '/admin/orders', 'sales', 2, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('6d782a02-a782-44dd-9721-552701e55571', 'customers', 'Customers', 'Users', '/admin/customers', 'sales', 3, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('9c18f251-f391-47aa-84ba-8c155f07e808', 'tax', 'Tax', 'DollarSign', '/admin/tax', 'sales', 4, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('e8f92e5e-0e96-4b4d-bf43-25fea085035a', 'blacklist', 'Blacklist', 'Shield', '/admin/blacklist', 'sales', 5, true, 'main', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('f00b2a6d-21c6-44bb-bead-2d773a097c42', 'shipping_methods', 'Shipping Methods', 'Truck', '/admin/shipping-methods', 'sales', 6, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('f2237ccf-8449-42f3-ad6e-8ef6773e0010', 'payment_methods', 'Payment Methods', 'CreditCard', '/admin/payment-methods', 'sales', 7, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('ba916985-a696-4fbd-998c-df7cffa7ed28', 'coupons', 'Coupons', 'Ticket', '/admin/coupons', 'sales', 8, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('9e88d83f-3820-47ac-9138-7c7bc381ee41', 'delivery_settings', 'Delivery Settings', 'Calendar', '/admin/delivery-settings', 'sales', 9, true, 'sales', NULL, NULL, NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- CONTENT CHILDREN (parent: content, order: 1, 2, 3...)
    -- =============================================
    ('9deae6d2-8b79-4961-9aa7-af5c420b530a', 'cms_pages', 'CMS Pages', 'FileText', '/admin/cms-pages', 'content', 1, true, 'content', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('19abe7de-a1d1-42ff-9da2-30ffb19c1e6b', 'cms_blocks', 'CMS Blocks', 'Square', '/admin/cms-blocks', 'content', 2, true, 'content', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('3d5d200b-a385-4f40-8ab0-6c234295cddc', 'file_library', 'File Library', 'Upload', '/admin/file-library', 'content', 3, true, 'content', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('250c4f0b-bcaf-45c6-b865-0967326f623d', 'emails', 'Emails', 'Mail', '/admin/emails', 'content', 4, true, 'content', NULL, NULL, NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- ANALYTICS CHILDREN (parent: analytics, order: 1, 2, 3...)
    -- =============================================
    ('621a4cd9-84e9-420b-82f8-b3b837b45059', 'analytics_dashboard', 'Dashboard', 'BarChart3', '/admin/analytics', 'analytics', 1, true, 'analytics', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('ef7e14a8-7cde-4635-ad0a-9186b32a7361', 'heatmaps', 'Heatmaps', 'Activity', '/admin/heatmaps', 'analytics', 2, true, 'analytics', NULL, NULL, NULL, 'premium', NOW(), NOW()),
    ('6889bdcd-9849-4c7b-b26a-da08e4a9da25', 'ab_testing', 'A/B Testing', 'FlaskConical', '/admin/ab-testing', 'analytics', 3, true, 'analytics', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('bd22f10c-8b2e-4948-b306-431f2a97e7fd', 'customer_activity', 'Customer Activity', 'Users', '/admin/customer-activity', 'analytics', 4, true, 'analytics', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('8971f94f-c30c-4029-8432-2696176ca16a', 'cookie_consent', 'Cookie Consent', 'Shield', '/admin/cookie-consent', 'analytics', 5, true, 'analytics', NULL, 'GDPR compliance and consent management', NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- MARKETING CHILDREN (parent: marketing, order: 1, 2, 3...)
    -- =============================================
    ('a1b2c3d4-e5f6-7890-abcd-000000000010', 'campaigns', 'Campaigns', 'Mail', '/admin/marketing/campaigns', 'marketing', 1, false, 'marketing', NULL, 'Email broadcasts and newsletters', NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000011', 'automations', 'Automations', 'Workflow', '/admin/marketing/automations', 'marketing', 2, false, 'marketing', NULL, 'Abandoned cart, welcome series, and more', NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000012', 'segments', 'Segments', 'UsersRound', '/admin/marketing/segments', 'marketing', 3, false, 'marketing', NULL, 'Audience builder and RFM segments', NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000013', 'marketing_integrations', 'Integrations', 'Plug', '/admin/marketing/integrations', 'marketing', 4, false, 'marketing', NULL, 'Klaviyo, Mailchimp, HubSpot', NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- CRM CHILDREN (parent: crm, order: 1, 2, 3...)
    -- =============================================
    ('a1b2c3d4-e5f6-7890-abcd-000000000020', 'crm_dashboard', 'Dashboard', 'LayoutDashboard', '/admin/crm', 'crm', 1, false, 'crm', NULL, 'CRM overview and metrics', NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000021', 'crm_pipelines', 'Pipelines', 'GitBranch', '/admin/crm/pipelines', 'crm', 2, false, 'crm', NULL, 'Sales pipeline management', NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000022', 'crm_deals', 'Deals', 'Handshake', '/admin/crm/deals', 'crm', 3, false, 'crm', NULL, 'Opportunities and sales tracking', NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000023', 'crm_leads', 'Leads', 'UserPlus', '/admin/crm/leads', 'crm', 4, false, 'crm', NULL, 'Lead management and scoring', NULL, 'standard', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000024', 'crm_activities', 'Activities', 'ListTodo', '/admin/crm/activities', 'crm', 5, false, 'crm', NULL, 'Calls, meetings, and tasks', NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- IMPORT & EXPORT CHILDREN (parent: import_export, order: 1, 2, 3...)
    -- =============================================
    ('571cf04b-2b04-428a-ad55-9192a56f7976', 'marketplace_hub', 'Marketplace Hub', 'ShoppingCart', '/admin/marketplace-hub', 'import_export', 1, false, 'import_export', NULL, 'Unified marketplace management: Amazon, eBay, and more with AI optimization', '{"text":"New","color":"blue","variant":"default"}'::jsonb, 'new', NOW(), NOW()),
    ('0162fe04-d1b3-4871-a92a-be7d54afd002', 'shopify_integration', 'Shopify', 'ShoppingBag', '/admin/shopify-integration', 'import_export', 2, true, 'import_export', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('4a706191-0c65-48c4-8efa-f355454fab8e', 'akeneo_integration', 'Akeneo', 'Database', '/admin/akeneo-integration', 'import_export', 3, true, 'import_export', NULL, NULL, NULL, 'beta', NOW(), NOW()),
    ('a1b2c3d4-e5f6-7890-abcd-000000000030', 'workflow_integrations', 'Workflows', 'Webhook', '/admin/integrations/workflows', 'import_export', 4, true, 'import_export', NULL, 'n8n, Zapier, Make webhook automations', NULL, 'standard', NOW(), NOW()),
    ('5415ee5a-1276-4883-ac01-33d3dfcb1c2b', 'import_export_jobs', 'Jobs & Analytics', 'BarChart3', '/admin/import-export-jobs', 'import_export', 5, true, 'import_export', NULL, 'Monitor import/export jobs and view performance analytics', NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- SEO CHILDREN (parent: seo, order: 1, 2, 3...)
    -- =============================================
    ('067d4c9b-7823-4f64-be28-8c75450d231e', 'seo_settings', 'Global', 'Search', '/admin/seo-tools/settings', 'seo', 1, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('dd08ce7f-b4ae-40dc-ae0a-e0e8667a9a2e', 'seo_templates', 'SEO Templates', 'FileText', '/admin/seo-tools/templates', 'seo', 2, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('c4c35189-2da3-4062-a490-cab76a4cd967', 'seo_redirects', 'Redirects', 'RefreshCw', '/admin/seo-tools/redirects', 'seo', 3, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('c4c35189-2da3-4062-a490-cab76a4c3234', 'product_feeds', 'Product Feeds', 'Rss', '/admin/seo-tools/product-feeds', 'seo', 4, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('6d54e5c6-d6d8-4ea0-aa72-8eacc29f0f72', 'seo_canonical', 'Canonical URLs', 'Link', '/admin/seo-tools/canonical', 'seo', 5, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('572c97b0-a00e-4a65-8a5d-e87036325e68', 'seo_hreflang', 'Hreflang', 'Globe', '/admin/seo-tools/hreflang', 'seo', 6, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('c498373d-a513-4f78-b732-3c1933d181c9', 'seo_robots', 'Robots.txt', 'Bot', '/admin/seo-tools/robots', 'seo', 7, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('c724b28d-e3bc-48ae-8707-87d585a7fe74', 'seo_social', 'Social Media', 'Share2', '/admin/seo-tools/social', 'seo', 8, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('793535ce-1c1f-4c35-9cb0-24f05a52f047', 'xml_sitemap', 'XML Sitemap', 'FileCode', '/admin/xml-sitemap', 'seo', 9, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('7ecc37c8-13fe-45a2-bded-0172da9184de', 'html_sitemap', 'HTML Sitemap', 'FileText', '/admin/html-sitemap', 'seo', 10, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('86af5d49-7fb1-405e-a371-f627274772b5', 'seo_report', 'SEO Report', 'FileText', '/admin/seo-tools/report', 'seo', 11, true, 'seo', NULL, NULL, NULL, 'standard', NOW(), NOW()),

    -- =============================================
    -- LAYOUT CHILDREN (parent: layout, order: 1, 2, 3...)
    -- =============================================
    ('237cfcb8-0464-44ab-916a-d2425f7bad73', 'theme_layout', 'Theme & Layout', 'Palette', '/admin/theme-layout', 'layout', 1, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('90e36469-b9e5-4a2b-8d7d-5fde01f066e9', 'translations', 'Translations', 'Globe', '/admin/translations', 'layout', 2, true, 'store', NULL, NULL, NULL, 'new', NOW(), NOW()),

    -- =============================================
    -- STORE CHILDREN (parent: store, order: 1, 2, 3...)
    -- =============================================
    ('e4de6184-0894-409c-b819-58bd3a0539d5', 'settings', 'General Settings', 'Settings', '/admin/settings', 'store', 1, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('18727c04-a31b-4dc4-9b06-9d81a71beeee', 'database_integrations', 'Database', 'Database', '/admin/database-integrations', 'store', 2, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('93b2fb65-e369-4631-976a-35a764de7459', 'store_email', 'Email', 'Mail', '/admin/email', 'store', 3, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('31085f55-2a25-40ed-83ba-be0c80998b81', 'media_storage', 'Media Storage', 'Image', '/admin/media-storage', 'store', 4, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('ada124ce-e1a5-4d93-b071-0514350deda0', 'uptime-report', 'Uptime Report', 'Activity', '/admin/uptime-report', 'store', 5, true, 'store', NULL, 'Track daily charges and uptime for running stores', NULL, 'standard', NOW(), NOW()),
    ('2e6e8b58-03e9-4ad2-9ecc-8051c343a269', 'custom_domains', 'Custom Domains', 'Globe', '/admin/custom-domains', 'store', 6, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('d15c2f9e-ce66-42a2-85fa-280f8f170f62', 'cache', 'Cache', 'Database', '/admin/cache', 'store', 7, true, 'store', NULL, NULL, NULL, 'standard', NOW(), NOW()),
    ('b3f52d82-6591-4a20-9ed2-d2172c6fec54', 'background_jobs', 'Background Jobs', 'Activity', '/admin/background-jobs', 'store', 8, true, 'advanced', NULL, 'Monitor all background job processing and queue status', NULL, 'standard', NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
                             icon = EXCLUDED.icon,
                             route = EXCLUDED.route,
                             parent_key = EXCLUDED.parent_key,
                             default_order_position = EXCLUDED.default_order_position,
                             default_is_visible = EXCLUDED.default_is_visible,
                             category = EXCLUDED.category,
                             description = EXCLUDED.description,
                             badge_config = EXCLUDED.badge_config,
                             type = EXCLUDED.type,
                             updated_at = NOW();


-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE users IS 'Platform users (agency/store owners only). Full user structure synced from tenant DBs where account_type = agency';
COMMENT ON TABLE stores IS 'Minimal store registry with slug for routing. Full store data (name, settings, etc.) stored in tenant databases';
COMMENT ON TABLE store_databases IS 'Encrypted tenant database connection credentials. Allows backend to connect to each store tenant DB';
COMMENT ON TABLE store_hostnames IS 'Maps hostnames/domains to stores for fast tenant resolution';
COMMENT ON TABLE subscriptions IS 'Store subscription plans and billing information';
COMMENT ON TABLE credit_transactions IS 'Credit purchase history and adjustments';
COMMENT ON TABLE credit_usage IS 'Tracks all credit deductions/usage across the platform. Centralized in master DB for cross-store analytics';
COMMENT ON TABLE service_credit_costs IS 'Pricing for all services that consume credits';
COMMENT ON TABLE job_queue IS 'Centralized job queue for processing tenant jobs';
COMMENT ON TABLE billing_transactions IS 'Subscription payment history';
COMMENT ON TABLE theme_defaults IS 'Centralized theme presets (default, eclipse, corporate, etc.) used for new tenant provisioning and as fallback values';
COMMENT ON TABLE admin_navigation_core IS 'Core admin navigation items (source of truth). Tenants can override visibility/order via admin_navigation_custom in tenant DB';

-- ============================================
-- MASTER DATABASE SCHEMA COMPLETE
-- ============================================
