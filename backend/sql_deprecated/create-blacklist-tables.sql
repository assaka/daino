-- Create blacklist tables for IP addresses, countries, and email addresses
-- This allows store owners to proactively block access from specific sources

-- Create blacklist_ips table
CREATE TABLE IF NOT EXISTS blacklist_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id, ip_address)
);

-- Create blacklist_countries table
CREATE TABLE IF NOT EXISTS blacklist_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  country_name VARCHAR(100),
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id, country_code)
);

-- Create blacklist_emails table
CREATE TABLE IF NOT EXISTS blacklist_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE(store_id, email)
);

-- Create blacklist_settings table to store enable/disable options
CREATE TABLE IF NOT EXISTS blacklist_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE,
  block_by_ip BOOLEAN DEFAULT false,
  block_by_email BOOLEAN DEFAULT true,
  block_by_country BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_blacklist_ips_store_ip ON blacklist_ips(store_id, ip_address);
CREATE INDEX IF NOT EXISTS idx_blacklist_countries_store_country ON blacklist_countries(store_id, country_code);
CREATE INDEX IF NOT EXISTS idx_blacklist_emails_store_email ON blacklist_emails(store_id, email);
CREATE INDEX IF NOT EXISTS idx_blacklist_settings_store ON blacklist_settings(store_id);

-- Add comments
COMMENT ON TABLE blacklist_ips IS 'Stores blacklisted IP addresses per store';
COMMENT ON TABLE blacklist_countries IS 'Stores blacklisted countries per store';
COMMENT ON TABLE blacklist_emails IS 'Stores blacklisted email addresses per store';
COMMENT ON TABLE blacklist_settings IS 'Stores blacklist enable/disable settings per store';
