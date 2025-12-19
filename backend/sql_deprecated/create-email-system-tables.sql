-- Email system tables for managing transactional emails with Brevo integration
-- Supports signup, credit purchase, and order success emails with multi-language support

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    identifier VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    content_type VARCHAR(20) NOT NULL DEFAULT 'template' CHECK (content_type IN ('template', 'html', 'both')),
    template_content TEXT,
    html_content TEXT,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    attachment_enabled BOOLEAN DEFAULT false,
    attachment_config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(identifier, store_id)
);

-- Email template translations table
CREATE TABLE IF NOT EXISTS email_template_translations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    template_content TEXT,
    html_content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email_template_id, language_code)
);

-- Brevo configuration table
CREATE TABLE IF NOT EXISTS brevo_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    sender_name VARCHAR(255) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email send logs table
CREATE TABLE IF NOT EXISTS email_send_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'delivered', 'opened', 'clicked')),
    brevo_message_id VARCHAR(255),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_templates_store_id ON email_templates(store_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_identifier ON email_templates(identifier);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_email_template_translations_template_id ON email_template_translations(email_template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_translations_language ON email_template_translations(language_code);

CREATE INDEX IF NOT EXISTS idx_brevo_configurations_store_id ON brevo_configurations(store_id);
CREATE INDEX IF NOT EXISTS idx_brevo_configurations_active ON brevo_configurations(is_active);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_store_id ON email_send_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_template_id ON email_send_logs(email_template_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_status ON email_send_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_recipient ON email_send_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_created_at ON email_send_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_brevo_id ON email_send_logs(brevo_message_id);

-- Triggers for updated_at timestamps
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_template_translations_updated_at
    BEFORE UPDATE ON email_template_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brevo_configurations_updated_at
    BEFORE UPDATE ON brevo_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_send_logs_updated_at
    BEFORE UPDATE ON email_send_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE email_templates IS 'Stores email templates for transactional emails (signup, credit purchase, order success)';
COMMENT ON TABLE email_template_translations IS 'Multi-language translations for email templates';
COMMENT ON TABLE brevo_configurations IS 'Brevo API OAuth tokens and sender configuration per store';
COMMENT ON TABLE email_send_logs IS 'Logs of all emails sent through the system with delivery status';

COMMENT ON COLUMN email_templates.identifier IS 'Unique identifier for template type (signup_email, credit_purchase_email, order_success_email)';
COMMENT ON COLUMN email_templates.content_type IS 'Whether template uses variables (template), full HTML (html), or both modes';
COMMENT ON COLUMN email_templates.template_content IS 'Content with variables like {{customer_name}}, {{order_number}}';
COMMENT ON COLUMN email_templates.html_content IS 'Full HTML content for advanced users';
COMMENT ON COLUMN email_templates.variables IS 'JSON array of available variables for this template type';
COMMENT ON COLUMN email_templates.attachment_config IS 'Configuration for attachments (e.g., invoice PDF generation)';

COMMENT ON COLUMN brevo_configurations.access_token IS 'Encrypted OAuth access token from Brevo';
COMMENT ON COLUMN brevo_configurations.refresh_token IS 'Encrypted OAuth refresh token for token renewal';

COMMENT ON COLUMN email_send_logs.metadata IS 'Additional data like order_id, customer_id, transaction_id for tracking';
COMMENT ON COLUMN email_send_logs.brevo_message_id IS 'Brevo API message ID for tracking delivery status';
