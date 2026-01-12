-- Affiliate Program Tables for Master Database
-- Run this migration on Supabase Master DB

-- 1. Affiliate Tiers - Commission tier definitions
CREATE TABLE IF NOT EXISTS affiliate_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_rate DECIMAL(10, 4) NOT NULL,
  recurring_enabled BOOLEAN DEFAULT false,
  recurring_commission_rate DECIMAL(10, 4),
  recurring_months INTEGER DEFAULT 0,
  min_payout_amount DECIMAL(10, 2) DEFAULT 50.00,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_tiers_code ON affiliate_tiers(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_tiers_active ON affiliate_tiers(is_active) WHERE is_active = true;

-- 2. Affiliates - Affiliate profiles
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires TIMESTAMP,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(50),
  website_url TEXT,
  affiliate_type VARCHAR(50) NOT NULL DEFAULT 'individual' CHECK (affiliate_type IN ('individual', 'business', 'influencer', 'agency')),
  tier_id UUID REFERENCES affiliate_tiers(id),
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended', 'rejected', 'inactive')),
  stripe_connect_account_id VARCHAR(255),
  stripe_onboarding_complete BOOLEAN DEFAULT false,
  stripe_payouts_enabled BOOLEAN DEFAULT false,
  custom_commission_type VARCHAR(20) CHECK (custom_commission_type IS NULL OR custom_commission_type IN ('percentage', 'fixed')),
  custom_commission_value DECIMAL(10, 4),
  total_referrals INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_earnings DECIMAL(12, 2) DEFAULT 0.00,
  total_paid_out DECIMAL(12, 2) DEFAULT 0.00,
  pending_balance DECIMAL(12, 2) DEFAULT 0.00,
  application_notes TEXT,
  admin_notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_email ON affiliates(email);
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_tier ON affiliates(tier_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_stripe ON affiliates(stripe_connect_account_id);

-- 3. Affiliate Referrals - Referral tracking
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  referred_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  referred_email VARCHAR(255) NOT NULL,
  referral_code_used VARCHAR(50) NOT NULL,
  tracking_source VARCHAR(100),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  utm_campaign VARCHAR(255),
  landing_page TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked', 'signed_up', 'converted', 'qualified', 'churned')),
  first_purchase_at TIMESTAMP,
  first_purchase_amount DECIMAL(10, 2),
  total_purchases DECIMAL(12, 2) DEFAULT 0.00,
  cookie_set_at TIMESTAMP,
  cookie_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user ON affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_store ON affiliate_referrals(referred_store_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON affiliate_referrals(referral_code_used);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON affiliate_referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_email ON affiliate_referrals(referred_email);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON affiliate_referrals(created_at DESC);

-- 4. Affiliate Payouts - Payout history (create before commissions due to FK)
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  stripe_transfer_id VARCHAR(255),
  stripe_payout_id VARCHAR(255),
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id),
  failure_reason TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON affiliate_payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_stripe ON affiliate_payouts(stripe_transfer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_created ON affiliate_payouts(created_at DESC);

-- 5. Affiliate Commissions - Commission records
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('credit_purchase', 'subscription_initial', 'subscription_recurring')),
  source_transaction_id UUID,
  purchase_amount DECIMAL(10, 2) NOT NULL,
  commission_type VARCHAR(20) NOT NULL CHECK (commission_type IN ('percentage', 'fixed')),
  commission_rate DECIMAL(10, 4) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'refunded', 'cancelled')),
  hold_until TIMESTAMP,
  payout_id UUID REFERENCES affiliate_payouts(id),
  paid_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referral_id ON affiliate_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_source ON affiliate_commissions(source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_commissions_payout ON affiliate_commissions(payout_id);
CREATE INDEX IF NOT EXISTS idx_commissions_created ON affiliate_commissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_hold ON affiliate_commissions(hold_until) WHERE status = 'pending';

-- Seed default affiliate tiers
INSERT INTO affiliate_tiers (name, code, description, commission_type, commission_rate, min_payout_amount, is_default, display_order)
VALUES
  ('Bronze', 'bronze', 'Entry level affiliate tier with 10% commission', 'percentage', 0.10, 50.00, true, 1),
  ('Silver', 'silver', 'Mid-level affiliate tier with 15% commission', 'percentage', 0.15, 50.00, false, 2),
  ('Gold', 'gold', 'Premium affiliate tier with 20% commission', 'percentage', 0.20, 25.00, false, 3)
ON CONFLICT (code) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_affiliate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_affiliate_tiers_updated_at ON affiliate_tiers;
CREATE TRIGGER update_affiliate_tiers_updated_at
  BEFORE UPDATE ON affiliate_tiers
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();

DROP TRIGGER IF EXISTS update_affiliates_updated_at ON affiliates;
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();

DROP TRIGGER IF EXISTS update_affiliate_referrals_updated_at ON affiliate_referrals;
CREATE TRIGGER update_affiliate_referrals_updated_at
  BEFORE UPDATE ON affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();

DROP TRIGGER IF EXISTS update_affiliate_commissions_updated_at ON affiliate_commissions;
CREATE TRIGGER update_affiliate_commissions_updated_at
  BEFORE UPDATE ON affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();

DROP TRIGGER IF EXISTS update_affiliate_payouts_updated_at ON affiliate_payouts;
CREATE TRIGGER update_affiliate_payouts_updated_at
  BEFORE UPDATE ON affiliate_payouts
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();
