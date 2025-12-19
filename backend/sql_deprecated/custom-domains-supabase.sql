-- =====================================================
-- CUSTOM DOMAINS TABLE FOR SUPABASE
-- =====================================================
-- Run this SQL in your Supabase SQL Editor
-- This creates the custom_domains table and related structures

-- Create custom_domains table
CREATE TABLE IF NOT EXISTS custom_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,

  -- Domain details
  domain VARCHAR(255) NOT NULL,
  subdomain VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,

  -- DNS Configuration
  dns_configured BOOLEAN DEFAULT false,
  dns_provider VARCHAR(100),

  -- Verification
  verification_status VARCHAR(50) DEFAULT 'pending',
  verification_method VARCHAR(50) DEFAULT 'txt',
  verification_token VARCHAR(255),
  verification_record_name VARCHAR(255),
  verification_record_value VARCHAR(500),
  verified_at TIMESTAMP WITH TIME ZONE,

  -- SSL/TLS Certificate
  ssl_status VARCHAR(50) DEFAULT 'pending',
  ssl_provider VARCHAR(50) DEFAULT 'letsencrypt',
  ssl_certificate_id VARCHAR(255),
  ssl_issued_at TIMESTAMP WITH TIME ZONE,
  ssl_expires_at TIMESTAMP WITH TIME ZONE,
  ssl_auto_renew BOOLEAN DEFAULT true,

  -- DNS Records
  dns_records JSONB DEFAULT '[]',
  cname_target VARCHAR(255),

  -- Redirect configuration
  redirect_to_https BOOLEAN DEFAULT true,
  redirect_to_primary BOOLEAN DEFAULT false,

  -- Custom configuration
  custom_headers JSONB DEFAULT '{}',
  custom_rewrites JSONB DEFAULT '[]',

  -- CDN Configuration
  cdn_enabled BOOLEAN DEFAULT false,
  cdn_provider VARCHAR(50),
  cdn_config JSONB DEFAULT '{}',

  -- Analytics
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE OR REPLACE FUNCTION update_custom_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_domains_updated_at
  BEFORE UPDATE ON custom_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_domains_updated_at();

-- Domain verification logs table
CREATE TABLE IF NOT EXISTS domain_verification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,
  store_id UUID NOT NULL,

  -- Verification attempt
  verification_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,

  -- Details
  dns_records_found JSONB,
  expected_records JSONB,
  error_message TEXT,

  -- Metadata
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_domain_verification_logs_domain_id ON domain_verification_logs(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_verification_logs_checked_at ON domain_verification_logs(checked_at DESC);

-- SSL certificate renewals table
CREATE TABLE IF NOT EXISTS ssl_certificate_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL,

  -- Certificate details
  certificate_id VARCHAR(255),
  provider VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,

  -- Renewal details
  issued_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  renewed_at TIMESTAMP WITH TIME ZONE,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssl_renewals_domain_id ON ssl_certificate_renewals(domain_id);
CREATE INDEX IF NOT EXISTS idx_ssl_renewals_status ON ssl_certificate_renewals(status);
CREATE INDEX IF NOT EXISTS idx_ssl_renewals_expires_at ON ssl_certificate_renewals(expires_at);

-- Helper functions
CREATE OR REPLACE FUNCTION generate_domain_verification_token()
RETURNS VARCHAR AS $$
BEGIN
  RETURN 'daino-verify-' || substr(md5(random()::text || clock_timestamp()::text), 1, 32);
END;
$$ LANGUAGE plpgsql;

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

-- Comments
COMMENT ON TABLE custom_domains IS 'Custom domains configured for stores';
COMMENT ON TABLE domain_verification_logs IS 'Logs of domain verification attempts';
COMMENT ON TABLE ssl_certificate_renewals IS 'SSL certificate renewal history';

COMMENT ON COLUMN custom_domains.verification_token IS 'Unique token for domain verification';
COMMENT ON COLUMN custom_domains.cname_target IS 'The CNAME target (e.g., stores.daino.app)';
COMMENT ON COLUMN custom_domains.dns_records IS 'Required DNS records for this domain';
