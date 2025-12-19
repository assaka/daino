-- Add icon_url column to payment_methods table
-- This allows storing a URL to an icon/logo for each payment method

ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS icon_url TEXT;

COMMENT ON COLUMN payment_methods.icon_url IS 'URL to the icon/logo for this payment method';
