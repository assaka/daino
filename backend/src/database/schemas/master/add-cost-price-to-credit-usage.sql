-- Add cost_price column to credit_usage table
-- Tracks actual API cost separate from credits charged
-- Run in Supabase SQL Editor (Master DB)

-- Add cost_price column
ALTER TABLE credit_usage
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 6) DEFAULT 0;

-- Add model column to track which AI model was used
ALTER TABLE credit_usage
ADD COLUMN IF NOT EXISTS model VARCHAR(100);

-- Comments
COMMENT ON COLUMN credit_usage.cost_price IS 'Actual API cost in USD (e.g., 0.061 for ~19k tokens)';
COMMENT ON COLUMN credit_usage.model IS 'AI model used (e.g., claude-sonnet-4-20250514, gpt-4o)';

-- Example query to see margin:
-- SELECT
--   usage_type,
--   SUM(credits_used) as total_credits,
--   SUM(credits_used) * 0.10 as revenue,
--   SUM(cost_price) as api_cost,
--   SUM(credits_used) * 0.10 - SUM(cost_price) as profit
-- FROM credit_usage
-- WHERE usage_type LIKE 'ai_%'
-- GROUP BY usage_type;
