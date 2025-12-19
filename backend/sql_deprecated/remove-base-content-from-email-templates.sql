-- Remove base content fields from email_templates table
-- All content is now stored exclusively in email_template_translations

-- Remove redundant content fields (translations table is now the source of truth)
ALTER TABLE email_templates
DROP COLUMN IF EXISTS subject,
DROP COLUMN IF EXISTS template_content,
DROP COLUMN IF EXISTS html_content;

-- Keep default_ fields for system template restore functionality
-- (default_subject, default_template_content, default_html_content remain)

COMMENT ON TABLE email_templates IS 'Email template configuration. Content stored in email_template_translations table.';
