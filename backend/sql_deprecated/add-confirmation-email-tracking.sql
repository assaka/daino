-- Add confirmation_email_sent_at column to track if order confirmation email was sent
-- This prevents duplicate emails from instant finalization + backup job

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS confirmation_email_sent_at TIMESTAMP;

COMMENT ON COLUMN orders.confirmation_email_sent_at IS 'Timestamp when order confirmation email was sent (prevents duplicates)';
