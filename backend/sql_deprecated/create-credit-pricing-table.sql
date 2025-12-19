-- Credit pricing table to store Stripe Price IDs and credit packages
-- This allows flexible multi-currency pricing with actual Stripe Price objects

CREATE TABLE IF NOT EXISTS credit_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    credits INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    stripe_price_id VARCHAR(255), -- Stripe Price ID (e.g., 'price_1ABC123...')
    popular BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(credits, currency)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_credit_pricing_currency ON credit_pricing(currency);
CREATE INDEX IF NOT EXISTS idx_credit_pricing_stripe_price_id ON credit_pricing(stripe_price_id);
CREATE INDEX IF NOT EXISTS idx_credit_pricing_active ON credit_pricing(active);

-- Insert default pricing (without Stripe Price IDs - to be configured later)
INSERT INTO credit_pricing (credits, amount, currency, popular, display_order) VALUES
(100, 10.00, 'usd', false, 1),
(550, 50.00, 'usd', true, 2),
(1200, 100.00, 'usd', false, 3),
(100, 9.00, 'eur', false, 1),
(550, 46.00, 'eur', true, 2),
(1200, 92.00, 'eur', false, 3)
ON CONFLICT (credits, currency) DO NOTHING;

-- Trigger to update updated_at
CREATE TRIGGER update_credit_pricing_updated_at
    BEFORE UPDATE ON credit_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE credit_pricing IS 'Credit package pricing with Stripe Price IDs for multi-currency support';
COMMENT ON COLUMN credit_pricing.stripe_price_id IS 'Stripe Price ID - create these in Stripe Dashboard under Products > Prices';
COMMENT ON COLUMN credit_pricing.amount IS 'Price amount in the specified currency';
COMMENT ON COLUMN credit_pricing.currency IS 'ISO 4217 currency code (usd, eur, gbp, etc.)';
COMMENT ON COLUMN credit_pricing.credits IS 'Number of credits included in this package';
