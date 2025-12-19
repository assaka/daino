-- Remove base content field from pdf_templates table
-- All content is now stored exclusively in pdf_template_translations

-- Remove redundant html_template field (translations table is now the source of truth)
ALTER TABLE pdf_templates
DROP COLUMN IF EXISTS html_template;

-- Keep default_html_template field for system template restore functionality

COMMENT ON TABLE pdf_templates IS 'PDF template configuration. Content stored in pdf_template_translations table.';
