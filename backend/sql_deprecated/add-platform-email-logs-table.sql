-- Migration: Add Platform Email Logs Table
-- Description: Creates table to log platform-level emails (credits purchase, welcome, etc.)
-- This table is in the MASTER database (not tenant databases)

-- Create platform_email_logs table
CREATE TABLE IF NOT EXISTS platform_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient information
  recipient_email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Email details
  email_type VARCHAR(50), -- 'credits_purchase', 'welcome', 'password_reset', 'low_balance', etc.
  subject VARCHAR(500) NOT NULL,

  -- Send status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, failed, bounced, delivered
  message_id VARCHAR(255), -- Brevo message ID
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_platform_email_logs_recipient
  ON platform_email_logs(recipient_email);

CREATE INDEX IF NOT EXISTS idx_platform_email_logs_user_id
  ON platform_email_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_platform_email_logs_status
  ON platform_email_logs(status);

CREATE INDEX IF NOT EXISTS idx_platform_email_logs_email_type
  ON platform_email_logs(email_type);

CREATE INDEX IF NOT EXISTS idx_platform_email_logs_created_at
  ON platform_email_logs(created_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_platform_email_logs_updated_at ON platform_email_logs;
CREATE TRIGGER trigger_platform_email_logs_updated_at
  BEFORE UPDATE ON platform_email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_platform_email_logs_updated_at();

-- Add comment
COMMENT ON TABLE platform_email_logs IS 'Logs for platform-level emails sent to users (credits purchase, welcome, etc.)';
