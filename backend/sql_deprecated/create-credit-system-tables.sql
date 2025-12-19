-- Credit system tables for Akeneo billing
-- 0.1 credit per Akeneo schedule run

-- Credits table to track user/store credit balances
CREATE TABLE IF NOT EXISTS credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_purchased DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_used DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, store_id)
);

-- Credit transactions table for tracking purchases
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'bonus', 'refund')),
    amount_usd DECIMAL(10,2) NOT NULL,
    credits_purchased DECIMAL(10,2) NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Credit usage table for tracking how credits are spent
CREATE TABLE IF NOT EXISTS credit_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    credits_used DECIMAL(10,2) NOT NULL,
    usage_type VARCHAR(50) NOT NULL CHECK (usage_type IN ('akeneo_schedule', 'akeneo_manual', 'other')),
    reference_id UUID NULL, -- Foreign key to schedules or other entities
    reference_type VARCHAR(50) NULL, -- Type of reference (e.g., 'akeneo_schedule', 'manual_import')
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add credit_cost column to akeneo_schedules table
ALTER TABLE akeneo_schedules 
ADD COLUMN IF NOT EXISTS credit_cost DECIMAL(5,3) NOT NULL DEFAULT 0.1,
ADD COLUMN IF NOT EXISTS last_credit_usage UUID REFERENCES credit_usage(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credits_user_store ON credits(user_id, store_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_status ON credit_transactions(status);
CREATE INDEX IF NOT EXISTS idx_credit_usage_user_store ON credit_usage(user_id, store_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_created_at ON credit_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_usage_reference ON credit_usage(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_akeneo_schedules_credit_cost ON akeneo_schedules(credit_cost);

-- Triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_credits_updated_at
    BEFORE UPDATE ON credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_transactions_updated_at
    BEFORE UPDATE ON credit_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically update credit balance when transactions are completed
CREATE OR REPLACE FUNCTION update_credit_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process completed transactions
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Insert or update credits record
        INSERT INTO credits (user_id, store_id, balance, total_purchased)
        VALUES (NEW.user_id, NEW.store_id, NEW.credits_purchased, NEW.credits_purchased)
        ON CONFLICT (user_id, store_id)
        DO UPDATE SET
            balance = credits.balance + NEW.credits_purchased,
            total_purchased = credits.total_purchased + NEW.credits_purchased,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_credit_balance
    AFTER INSERT OR UPDATE ON credit_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_balance_on_transaction();

-- Trigger to automatically update credit balance when credits are used
CREATE OR REPLACE FUNCTION update_credit_balance_on_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update credits balance
    UPDATE credits 
    SET 
        balance = balance - NEW.credits_used,
        total_used = total_used + NEW.credits_used,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = NEW.user_id AND store_id = NEW.store_id;
    
    -- Ensure balance doesn't go negative (additional safety check)
    IF (SELECT balance FROM credits WHERE user_id = NEW.user_id AND store_id = NEW.store_id) < 0 THEN
        RAISE EXCEPTION 'Insufficient credits. Balance cannot be negative.';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_credit_balance_on_usage
    AFTER INSERT ON credit_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_credit_balance_on_usage();