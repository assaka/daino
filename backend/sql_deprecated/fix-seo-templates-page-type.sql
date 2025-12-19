-- Fix seo_templates table by dropping unused page_type column
-- The model and API use 'type' field instead

-- Drop the page_type column if it exists
ALTER TABLE seo_templates DROP COLUMN IF EXISTS page_type;

-- Ensure type column exists and has proper constraints
ALTER TABLE seo_templates 
  ALTER COLUMN type SET NOT NULL;

-- Update the check constraint if needed
ALTER TABLE seo_templates DROP CONSTRAINT IF EXISTS seo_templates_type_check;
ALTER TABLE seo_templates ADD CONSTRAINT seo_templates_type_check CHECK (type IN ('product', 'category'));

SELECT 'SEO templates page_type column removed successfully!' as message;