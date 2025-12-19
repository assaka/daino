-- Ensure 'en' language exists for product translations
-- This is required for Shopify imports to save product names and descriptions

INSERT INTO languages (code, name, is_active)
VALUES ('en', 'English', true)
ON CONFLICT (code) DO NOTHING;
