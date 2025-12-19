-- Add default content fields to email_templates for restore functionality

ALTER TABLE email_templates
ADD COLUMN IF NOT EXISTS default_subject VARCHAR(255),
ADD COLUMN IF NOT EXISTS default_template_content TEXT,
ADD COLUMN IF NOT EXISTS default_html_content TEXT;

-- Update existing system templates with default content
UPDATE email_templates SET
    default_subject = subject,
    default_template_content = template_content,
    default_html_content = html_content
WHERE is_system = TRUE AND default_html_content IS NULL;

-- Add comments
COMMENT ON COLUMN email_templates.default_subject IS 'Original default subject for restore functionality';
COMMENT ON COLUMN email_templates.default_template_content IS 'Original default template content for restore functionality';
COMMENT ON COLUMN email_templates.default_html_content IS 'Original default HTML content for restore functionality';
