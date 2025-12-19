-- Migration: Update custom domain cost to daily billing
-- Purpose: Change custom_domain from one-time to daily billing for active custom domains
-- Created: 2025-11-03

-- Update existing custom_domain service cost entry to daily billing
UPDATE service_credit_costs
SET
  service_name = 'Custom Domain Daily Hosting',
  description = 'Daily hosting fee for active custom domains (e.g., www.myshop.com)',
  cost_per_unit = 0.5000,
  billing_type = 'per_day',
  metadata = '{"note": "Charged daily at midnight UTC for each active verified custom domain", "deactivates_on_insufficient_credits": true}'::jsonb,
  updated_at = CURRENT_TIMESTAMP
WHERE service_key = 'custom_domain';

-- Add comment
COMMENT ON TABLE service_credit_costs IS 'Includes daily custom domain hosting fees';
