-- Store Owner Affiliate Rewards Migration
-- Allows store owners to choose between commission (20%) or free credits per active referred store

-- 1. Add reward_type column to affiliates table
-- Store owners can choose 'commission' (20% of purchases) or 'credits' (30 credits per qualifying store)
ALTER TABLE affiliates
ADD COLUMN IF NOT EXISTS reward_type VARCHAR(20) DEFAULT 'commission'
CHECK (reward_type IN ('commission', 'credits'));

-- 2. Add is_store_owner_affiliate flag
-- Identifies affiliates who are also store owners (special program)
ALTER TABLE affiliates
ADD COLUMN IF NOT EXISTS is_store_owner_affiliate BOOLEAN DEFAULT false;

-- 3. Create table to track one-time credit awards for qualifying stores
-- A store qualifies when: published = true AND created_at >= 30 days ago
CREATE TABLE IF NOT EXISTS affiliate_store_credit_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
  referred_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  credits_awarded DECIMAL(10, 2) NOT NULL DEFAULT 30.00,
  store_qualified_at TIMESTAMP NOT NULL, -- When store met the 30-day + published criteria
  awarded_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_store_credits_affiliate ON affiliate_store_credit_awards(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_store_credits_store ON affiliate_store_credit_awards(referred_store_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_store_credits_referral ON affiliate_store_credit_awards(referral_id);

-- Unique constraint: only one credit award per store per affiliate
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_store_credits_unique
ON affiliate_store_credit_awards(affiliate_id, referred_store_id);

-- Add index for reward_type lookups
CREATE INDEX IF NOT EXISTS idx_affiliates_reward_type ON affiliates(reward_type);
CREATE INDEX IF NOT EXISTS idx_affiliates_store_owner ON affiliates(is_store_owner_affiliate) WHERE is_store_owner_affiliate = true;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_affiliate_store_credit_awards_updated_at ON affiliate_store_credit_awards;
CREATE TRIGGER update_affiliate_store_credit_awards_updated_at
  BEFORE UPDATE ON affiliate_store_credit_awards
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();

-- Create a "Store Owner" tier with 20% commission (if not exists)
INSERT INTO affiliate_tiers (name, code, description, commission_type, commission_rate, min_payout_amount, is_default, display_order)
VALUES
  ('Store Owner', 'store_owner', 'Special tier for store owners with 20% commission or 30 credits per active store', 'percentage', 0.20, 25.00, false, 4)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  commission_rate = EXCLUDED.commission_rate;
