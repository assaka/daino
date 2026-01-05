-- ============================================
-- CREDIT_USAGE TABLE
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
  metadata JSONB DEFAULT '{}',       -- Additional context (balance_before, balance_after, etc.)

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_id ON credit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_store_id ON credit_usage(store_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_store ON credit_usage(user_id, store_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_usage_type ON credit_usage(usage_type);
CREATE INDEX IF NOT EXISTS idx_credit_usage_reference ON credit_usage(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_credit_usage_created_at ON credit_usage(created_at DESC);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_credit_usage_updated_at ON credit_usage;
CREATE TRIGGER update_credit_usage_updated_at BEFORE UPDATE ON credit_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE credit_usage IS 'Tracks all credit deductions/usage across the platform. Centralized in master DB for cross-store analytics.';
COMMENT ON COLUMN credit_usage.user_id IS 'User who was charged';
COMMENT ON COLUMN credit_usage.store_id IS 'Store context (nullable for user-level operations)';
COMMENT ON COLUMN credit_usage.credits_used IS 'Amount of credits deducted';
COMMENT ON COLUMN credit_usage.usage_type IS 'Category of usage (store_publishing, custom_domain, ai_translation, etc.)';
COMMENT ON COLUMN credit_usage.reference_id IS 'ID of the entity that consumed credits';
COMMENT ON COLUMN credit_usage.reference_type IS 'Type of the referenced entity';
COMMENT ON COLUMN credit_usage.metadata IS 'Additional context including balance_before, balance_after, charge details';
