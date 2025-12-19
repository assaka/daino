-- =====================================================
-- CUSTOM DOMAINS TABLE
-- =====================================================
-- Purpose: Manage custom domains for stores
-- Supports: Domain verification, SSL certificates, DNS configuration

CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Domain details
  domain VARCHAR(255) NOT NULL UNIQUE,
  subdomain VARCHAR(255), -- Optional subdomain (e.g., 'shop' for shop.example.com)
  is_primary BOOLEAN DEFAULT false, -- Primary domain for the store
  is_active BOOLEAN DEFAULT false,

  -- DNS Configuration
  dns_configured BOOLEAN DEFAULT false,
  dns_provider VARCHAR(100), -- 'cloudflare', 'route53', 'manual', etc.

  -- Verification
  verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'failed'
  verification_method VARCHAR(50) DEFAULT 'txt', -- 'txt', 'cname', 'http'
  verification_token VARCHAR(255),
  verification_record_name VARCHAR(255),
  verification_record_value VARCHAR(500),
  verified_at TIMESTAMP,

  -- SSL/TLS Certificate
  ssl_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'failed', 'expired'
  ssl_provider VARCHAR(50) DEFAULT 'letsencrypt', -- 'letsencrypt', 'cloudflare', 'custom'
  ssl_certificate_id VARCHAR(255),
  ssl_issued_at TIMESTAMP,
  ssl_expires_at TIMESTAMP,
  ssl_auto_renew BOOLEAN DEFAULT true,

  -- DNS Records
  dns_records JSONB DEFAULT '[]', -- Array of {type, name, value, ttl}
  cname_target VARCHAR(255), -- The CNAME target for this domain

  -- Redirect configuration
  redirect_to_https BOOLEAN DEFAULT true,
  redirect_to_primary BOOLEAN DEFAULT false, -- Redirect to primary domain if not primary

  -- Custom configuration
  custom_headers JSONB DEFAULT '{}',
  custom_rewrites JSONB DEFAULT '[]',

  -- CDN Configuration
  cdn_enabled BOOLEAN DEFAULT false,
  cdn_provider VARCHAR(50), -- 'cloudflare', 'cloudfront', 'fastly'
  cdn_config JSONB DEFAULT '{}',

  -- Analytics
  last_accessed_at TIMESTAMP,
  access_count INTEGER DEFAULT 0,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_domains_store_id ON custom_domains(store_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);
CREATE INDEX IF NOT EXISTS idx_custom_domains_verification_status ON custom_domains(verification_status);
CREATE INDEX IF NOT EXISTS idx_custom_domains_ssl_status ON custom_domains(ssl_status);
CREATE INDEX IF NOT EXISTS idx_custom_domains_is_active ON custom_domains(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_domains_is_primary ON custom_domains(is_primary);

-- Ensure only one primary domain per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_domains_store_primary
  ON custom_domains(store_id)
  WHERE is_primary = true;

-- Trigger for updated_at
CREATE TRIGGER update_custom_domains_updated_at
  BEFORE UPDATE ON custom_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DOMAIN VERIFICATION LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS domain_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES custom_domains(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Verification attempt
  verification_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'pending'

  -- Details
  dns_records_found JSONB,
  expected_records JSONB,
  error_message TEXT,

  -- Metadata
  checked_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_domain_verification_logs_domain_id ON domain_verification_logs(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_verification_logs_checked_at ON domain_verification_logs(checked_at DESC);

-- =====================================================
-- SSL CERTIFICATE RENEWALS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS ssl_certificate_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES custom_domains(id) ON DELETE CASCADE,

  -- Certificate details
  certificate_id VARCHAR(255),
  provider VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'pending', 'completed', 'failed'

  -- Renewal details
  issued_at TIMESTAMP,
  expires_at TIMESTAMP,
  renewed_at TIMESTAMP,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssl_renewals_domain_id ON ssl_certificate_renewals(domain_id);
CREATE INDEX IF NOT EXISTS idx_ssl_renewals_status ON ssl_certificate_renewals(status);
CREATE INDEX IF NOT EXISTS idx_ssl_renewals_expires_at ON ssl_certificate_renewals(expires_at);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to generate verification token
CREATE OR REPLACE FUNCTION generate_domain_verification_token()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'daino-verify-' || substr(md5(random()::text || clock_timestamp()::text), 1, 32);
END;
$$ LANGUAGE plpgsql;

-- Function to check if domain is verified
CREATE OR REPLACE FUNCTION is_domain_verified(p_domain_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status VARCHAR;
BEGIN
  SELECT verification_status INTO v_status
  FROM custom_domains
  WHERE id = p_domain_id;

  RETURN v_status = 'verified';
END;
$$ LANGUAGE plpgsql;

-- Function to get primary domain for store
CREATE OR REPLACE FUNCTION get_primary_domain(p_store_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_domain VARCHAR;
BEGIN
  SELECT domain INTO v_domain
  FROM custom_domains
  WHERE store_id = p_store_id
    AND is_primary = true
    AND is_active = true
  LIMIT 1;

  RETURN v_domain;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE custom_domains IS 'Custom domains configured for stores';
COMMENT ON TABLE domain_verification_logs IS 'Logs of domain verification attempts';
COMMENT ON TABLE ssl_certificate_renewals IS 'SSL certificate renewal history';

COMMENT ON COLUMN custom_domains.verification_token IS 'Unique token for domain verification';
COMMENT ON COLUMN custom_domains.cname_target IS 'The CNAME target (e.g., stores.daino.app)';
COMMENT ON COLUMN custom_domains.dns_records IS 'Required DNS records for this domain';

-- =====================================================
-- ADD DOMAIN SUPPORT TO STORES TABLE
-- =====================================================

ALTER TABLE stores
ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS primary_domain VARCHAR(255),
ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores(custom_domain);
CREATE INDEX IF NOT EXISTS idx_stores_primary_domain ON stores(primary_domain);

COMMENT ON COLUMN stores.custom_domain IS 'Current custom domain (may not be primary)';
COMMENT ON COLUMN stores.primary_domain IS 'Primary verified domain for this store';
