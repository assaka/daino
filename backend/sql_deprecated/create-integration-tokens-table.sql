-- ============================================
-- INTEGRATION TOKENS TABLE (Master Database)
-- Tracks OAuth token expiry across all stores for efficient refresh scheduling
-- ============================================

CREATE TABLE IF NOT EXISTS integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Integration identification
  integration_type VARCHAR(100) NOT NULL,  -- 'supabase-oauth', 'cloudflare', etc.
  config_key VARCHAR(100) DEFAULT 'default',  -- For multiple configs of same type

  -- Token expiry tracking
  token_expires_at TIMESTAMP,  -- When the access token expires
  refresh_token_expires_at TIMESTAMP,  -- When the refresh token expires (if applicable)
  last_refresh_at TIMESTAMP,  -- Last successful token refresh
  last_refresh_error TEXT,  -- Last refresh error message (for debugging)

  -- Status tracking
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
    'active',      -- Token is valid and working
    'expiring',    -- Token will expire soon (within refresh window)
    'expired',     -- Token has expired
    'revoked',     -- Authorization was revoked by user
    'refresh_failed'  -- Refresh attempted but failed
  )),

  -- Retry tracking
  consecutive_failures INTEGER DEFAULT 0,
  max_failures INTEGER DEFAULT 5,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint: one entry per store + integration type + config key
  UNIQUE(store_id, integration_type, config_key)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_integration_tokens_store_id ON integration_tokens(store_id);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_type ON integration_tokens(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_status ON integration_tokens(status);

-- Index for finding tokens that need refresh (expiring within the next hour)
CREATE INDEX IF NOT EXISTS idx_integration_tokens_expiring ON integration_tokens(token_expires_at)
  WHERE status = 'active' AND token_expires_at IS NOT NULL;

-- Index for the cron job query: active tokens expiring soon
CREATE INDEX IF NOT EXISTS idx_integration_tokens_refresh_candidates ON integration_tokens(token_expires_at, status)
  WHERE status IN ('active', 'expiring') AND token_expires_at IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_integration_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_integration_tokens_updated_at ON integration_tokens;
CREATE TRIGGER update_integration_tokens_updated_at
  BEFORE UPDATE ON integration_tokens
  FOR EACH ROW EXECUTE FUNCTION update_integration_tokens_updated_at();

-- Comments
COMMENT ON TABLE integration_tokens IS 'Tracks OAuth token expiry across all tenant stores for efficient background refresh scheduling';
COMMENT ON COLUMN integration_tokens.token_expires_at IS 'When the access token expires - used by cron to find tokens needing refresh';
COMMENT ON COLUMN integration_tokens.refresh_token_expires_at IS 'When the refresh token itself expires (some OAuth providers have this)';
COMMENT ON COLUMN integration_tokens.consecutive_failures IS 'Number of consecutive refresh failures - pauses refresh after max_failures';
