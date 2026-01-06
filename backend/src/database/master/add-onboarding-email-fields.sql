-- Migration: Add email preferences to users table
-- Email send history is tracked in platform_email_logs table

-- Add general newsletter unsubscribe column (covers all marketing communications)
ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_unsubscribed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS newsletter_unsubscribed_at TIMESTAMP;

-- Create index for newsletter preferences
CREATE INDEX IF NOT EXISTS idx_users_newsletter_unsubscribed
ON users(newsletter_unsubscribed)
WHERE newsletter_unsubscribed = false;

-- Comments
COMMENT ON COLUMN users.newsletter_unsubscribed IS 'Whether user has unsubscribed from all marketing/newsletter emails';
COMMENT ON COLUMN users.newsletter_unsubscribed_at IS 'When user unsubscribed from marketing emails';
