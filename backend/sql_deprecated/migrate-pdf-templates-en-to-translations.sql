-- Migrate English content from pdf_templates base fields to pdf_template_translations
-- This ensures all languages (including EN) are stored consistently in the translations table

-- Insert English translations for all PDF templates that don't already have them
INSERT INTO pdf_template_translations (id, pdf_template_id, language_code, html_template, created_at, updated_at)
SELECT
    gen_random_uuid() as id,
    pt.id as pdf_template_id,
    'en' as language_code,
    pt.html_template,
    pt.created_at,
    CURRENT_TIMESTAMP as updated_at
FROM pdf_templates pt
WHERE NOT EXISTS (
    SELECT 1
    FROM pdf_template_translations ptt
    WHERE ptt.pdf_template_id = pt.id
    AND ptt.language_code = 'en'
);

-- Verify the migration
SELECT
    pt.identifier,
    pt.name,
    LENGTH(pt.html_template) as base_html_length,
    LENGTH(ptt.html_template) as translation_html_length,
    ptt.language_code
FROM pdf_templates pt
LEFT JOIN pdf_template_translations ptt ON pt.id = ptt.pdf_template_id AND ptt.language_code = 'en'
ORDER BY pt.identifier;

COMMENT ON TABLE pdf_template_translations IS 'Stores all language translations for PDF templates, including English (en) as the base language';
