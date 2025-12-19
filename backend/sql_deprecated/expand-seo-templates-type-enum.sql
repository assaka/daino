-- Expand seo_templates type constraint to support cms and brand pages
-- This allows the frontend to create templates for all page types

-- Drop the existing constraint
ALTER TABLE seo_templates DROP CONSTRAINT IF EXISTS seo_templates_type_check;

-- Add the updated constraint with all page types
ALTER TABLE seo_templates ADD CONSTRAINT seo_templates_type_check
  CHECK (type IN ('product', 'category', 'cms', 'brand'));

SELECT 'SEO templates type constraint updated to support cms and brand pages!' as message;
