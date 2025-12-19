-- PDF template translations table for multi-language support
-- Supports translations for invoice_pdf, shipment_pdf, and other PDF templates

-- PDF template translations table
CREATE TABLE IF NOT EXISTS pdf_template_translations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pdf_template_id UUID NOT NULL REFERENCES pdf_templates(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    html_template TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pdf_template_id, language_code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdf_template_translations_template_id ON pdf_template_translations(pdf_template_id);
CREATE INDEX IF NOT EXISTS idx_pdf_template_translations_language ON pdf_template_translations(language_code);

-- Trigger for updated_at timestamp
CREATE TRIGGER update_pdf_template_translations_updated_at
    BEFORE UPDATE ON pdf_template_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE pdf_template_translations IS 'Multi-language translations for PDF templates';
COMMENT ON COLUMN pdf_template_translations.language_code IS 'Language code (e.g., en, es, fr, nl)';
COMMENT ON COLUMN pdf_template_translations.html_template IS 'Translated HTML template content';
