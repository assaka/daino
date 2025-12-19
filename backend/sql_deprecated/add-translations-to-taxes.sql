-- Migration: Create tax_translations table
-- This allows tax rules to support multilingual names and descriptions
-- Following the same pattern as payment_method_translations and shipping_method_translations

CREATE TABLE IF NOT EXISTS public.tax_translations (
  tax_id UUID NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (tax_id, language_code),
  CONSTRAINT tax_translations_tax_id_fkey FOREIGN KEY (tax_id) REFERENCES taxes (id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tax_translations_tax_id ON public.tax_translations (tax_id);
CREATE INDEX IF NOT EXISTS idx_tax_translations_language_code ON public.tax_translations (language_code);
