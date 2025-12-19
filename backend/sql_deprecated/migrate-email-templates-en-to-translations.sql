-- Migrate English content from email_templates base fields to email_template_translations
-- This ensures all languages (including EN) are stored consistently in the translations table

-- Insert English translations for all email templates that don't already have them
INSERT INTO email_template_translations (id, email_template_id, language_code, subject, template_content, html_content, created_at, updated_at)
SELECT
    gen_random_uuid() as id,
    et.id as email_template_id,
    'en' as language_code,
    et.subject,
    et.template_content,
    et.html_content,
    et.created_at,
    CURRENT_TIMESTAMP as updated_at
FROM email_templates et
WHERE NOT EXISTS (
    SELECT 1
    FROM email_template_translations ett
    WHERE ett.email_template_id = et.id
    AND ett.language_code = 'en'
);

-- Verify the migration
SELECT
    et.identifier,
    et.subject as base_subject,
    ett.subject as translation_subject,
    ett.language_code
FROM email_templates et
LEFT JOIN email_template_translations ett ON et.id = ett.email_template_id AND ett.language_code = 'en'
ORDER BY et.identifier;

COMMENT ON TABLE email_template_translations IS 'Stores all language translations for email templates, including English (en) as the base language';
