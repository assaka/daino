-- ==========================================
-- Master Database - Business Management Tables
-- ==========================================
-- Purpose: Track subscriptions, billing, usage, and platform administration
-- These tables remain in the master/platform database

-- ==========================================
-- SUBSCRIPTIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Plan details
  plan_name VARCHAR(50) NOT NULL, -- 'free', 'starter', 'professional', 'enterprise'
  status VARCHAR(50) NOT NULL DEFAULT 'trial', -- 'active', 'trial', 'cancelled', 'expired', 'suspended'

  -- Pricing
  price_monthly DECIMAL(10,2),
  price_annual DECIMAL(10,2),
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'annual'
  currency VARCHAR(3) DEFAULT 'USD',

  -- Resource limits
  max_products INTEGER,
  max_orders_per_month INTEGER,
  max_storage_gb INTEGER,
  max_api_calls_per_month INTEGER,
  max_admin_users INTEGER DEFAULT 5,

  -- Dates
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  trial_ends_at TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancellation_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_store_id ON subscriptions(store_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ==========================================
-- USAGE METRICS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Time period
  metric_date DATE NOT NULL,
  metric_hour INTEGER, -- 0-23, NULL for daily rollup

  -- Product metrics
  products_created INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_deleted INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,

  -- Category metrics
  categories_created INTEGER DEFAULT 0,
  categories_updated INTEGER DEFAULT 0,

  -- Order metrics
  orders_created INTEGER DEFAULT 0,
  orders_completed INTEGER DEFAULT 0,
  orders_cancelled INTEGER DEFAULT 0,
  orders_total_value DECIMAL(10,2) DEFAULT 0,
  orders_avg_value DECIMAL(10,2) DEFAULT 0,

  -- Customer metrics
  customers_new INTEGER DEFAULT 0,
  customers_returning INTEGER DEFAULT 0,

  -- Storage metrics
  storage_uploaded_bytes BIGINT DEFAULT 0,
  storage_deleted_bytes BIGINT DEFAULT 0,
  storage_total_bytes BIGINT DEFAULT 0,
  storage_files_count INTEGER DEFAULT 0,

  -- API metrics
  api_calls INTEGER DEFAULT 0,
  api_errors INTEGER DEFAULT 0,
  api_avg_response_time_ms INTEGER DEFAULT 0,

  -- Page views
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, metric_date, metric_hour)
);

CREATE INDEX idx_usage_metrics_store_id ON usage_metrics(store_id);
CREATE INDEX idx_usage_metrics_date ON usage_metrics(metric_date DESC);
CREATE INDEX idx_usage_metrics_store_date ON usage_metrics(store_id, metric_date DESC);

-- ==========================================
-- UPDATE STORES TABLE
-- ==========================================
-- Add new columns to existing stores table

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS database_type VARCHAR(50) DEFAULT 'supabase-database',
ADD COLUMN IF NOT EXISTS database_status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS storage_type VARCHAR(50) DEFAULT 'supabase-storage',
ADD COLUMN IF NOT EXISTS storage_status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS api_calls_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP DEFAULT NOW();

-- Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_stores_database_status ON stores(database_status);
CREATE INDEX IF NOT EXISTS idx_stores_subscription_status ON stores(subscription_status);
CREATE INDEX IF NOT EXISTS idx_stores_last_activity ON stores(last_activity_at DESC);

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to execute SQL (needed for DatabaseProvisioningService)
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current month usage for a store
CREATE OR REPLACE FUNCTION get_monthly_usage(p_store_id UUID, p_year INTEGER, p_month INTEGER)
RETURNS TABLE (
  total_products_created INTEGER,
  total_orders INTEGER,
  total_api_calls INTEGER,
  total_storage_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(products_created), 0)::INTEGER,
    COALESCE(SUM(orders_created), 0)::INTEGER,
    COALESCE(SUM(api_calls), 0)::INTEGER,
    COALESCE(MAX(storage_total_bytes), 0)::BIGINT
  FROM usage_metrics
  WHERE store_id = p_store_id
    AND EXTRACT(YEAR FROM metric_date) = p_year
    AND EXTRACT(MONTH FROM metric_date) = p_month;
END;
$$ LANGUAGE plpgsql;

-- Function to check if usage limit exceeded
CREATE OR REPLACE FUNCTION check_usage_limit(p_store_id UUID, p_limit_type VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage INTEGER;
  v_limit INTEGER;
  v_subscription RECORD;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE store_id = p_store_id
    AND status IN ('active', 'trial')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_subscription IS NULL THEN
    RETURN false; -- No subscription, allow
  END IF;

  -- Get current month usage
  SELECT
    total_products_created,
    total_orders,
    total_api_calls
  INTO v_current_usage
  FROM get_monthly_usage(
    p_store_id,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
  );

  -- Check limit
  CASE p_limit_type
    WHEN 'api_calls' THEN
      v_limit := v_subscription.max_api_calls_per_month;
    WHEN 'products' THEN
      v_limit := v_subscription.max_products;
    WHEN 'orders' THEN
      v_limit := v_subscription.max_orders_per_month;
    ELSE
      RETURN false;
  END CASE;

  IF v_limit IS NULL THEN
    RETURN false; -- No limit set
  END IF;

  RETURN v_current_usage >= v_limit;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- TRIGGERS FOR UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_transactions_updated_at
  BEFORE UPDATE ON billing_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_metrics_updated_at
  BEFORE UPDATE ON usage_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on sensitive tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Store owners can view their subscriptions"
  ON subscriptions FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for billing_transactions
CREATE POLICY "Store owners can view their billing"
  ON billing_transactions FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for usage_metrics
CREATE POLICY "Store owners can view their usage metrics"
  ON usage_metrics FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- ==========================================
-- INITIAL DATA
-- ==========================================

-- Insert default subscription plans (templates)
-- These can be used to create subscriptions for stores
INSERT INTO subscriptions (id, store_id, plan_name, status, price_monthly, price_annual, max_products, max_orders_per_month, max_storage_gb, max_api_calls_per_month, max_admin_users)
VALUES
  ('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'free', 'active', 0, 0, 10, 100, 1, 1000, 1),
  ('00000000-0000-0000-0000-000000000002'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'starter', 'active', 29.99, 299.99, 100, 1000, 10, 10000, 3),
  ('00000000-0000-0000-0000-000000000003'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'professional', 'active', 99.99, 999.99, 1000, 10000, 50, 100000, 10),
  ('00000000-0000-0000-0000-000000000004'::UUID, '00000000-0000-0000-0000-000000000001'::UUID, 'enterprise', 'active', 299.99, 2999.99, -1, -1, 200, -1, -1)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- COMMENTS
-- ==========================================
COMMENT ON TABLE subscriptions IS 'Store subscription plans and billing cycles';
COMMENT ON TABLE billing_transactions IS 'Payment transactions and invoices';
COMMENT ON TABLE usage_metrics IS 'Resource usage tracking per store';

COMMENT ON FUNCTION exec_sql IS 'Execute arbitrary SQL - used by DatabaseProvisioningService';
COMMENT ON FUNCTION get_monthly_usage IS 'Get aggregated usage metrics for a store for a specific month';
COMMENT ON FUNCTION check_usage_limit IS 'Check if a store has exceeded a specific usage limit';

-- ==========================================
-- VERIFICATION
-- ==========================================

-- Verify all tables were created successfully
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'subscriptions',
    'billing_transactions',
    'usage_metrics'
  )
ORDER BY tablename;
