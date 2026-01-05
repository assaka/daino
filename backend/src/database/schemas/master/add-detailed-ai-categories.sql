-- ============================================
-- ADD DETAILED AI SERVICE CATEGORIES
-- Breaking down 'ai_services' into specific categories:
-- - ai_editor_chat: AI chat/editor features
-- - ai_plugin: AI plugin generation
-- - ai_translation: AI translation services
-- - ai_image_generation: AI image generation
-- - ai_image_editing: AI image editing/optimization
-- ============================================

-- Step 1: Drop the existing constraint and add new one with more categories
ALTER TABLE service_credit_costs
DROP CONSTRAINT IF EXISTS service_credit_costs_service_category_check;

ALTER TABLE service_credit_costs
ADD CONSTRAINT service_credit_costs_service_category_check
CHECK (service_category IN (
    'store_operations',
    'plugin_management',
    'ai_services',        -- Keep for backward compatibility
    'ai_editor_chat',     -- NEW: Chat/editor AI features
    'ai_plugin',          -- NEW: Plugin generation
    'ai_translation',     -- NEW: Translation services
    'ai_image_generation',-- NEW: Image generation
    'ai_image_editing',   -- NEW: Image editing/optimization
    'data_migration',
    'storage',
    'akeneo_integration',
    'custom_domain',
    'other'
));

-- Step 2: Update existing AI services to use more specific categories

-- AI Editor/Chat services
UPDATE service_credit_costs
SET service_category = 'ai_editor_chat'
WHERE service_key IN (
    'ai_chat_session',
    'ai_chat_message',
    'ai_cms_block_generate',
    'ai_cms_page_generate',
    'ai_seo_generate',
    'ai_product_description',
    'ai_category_description',
    'ai_code_completion',
    'ai_code_explanation',
    'ai_code_refactor',
    'ai_error_analysis'
);

-- AI Plugin generation services
UPDATE service_credit_costs
SET service_category = 'ai_plugin'
WHERE service_key IN (
    'ai_plugin_generate',
    'ai_plugin_modify',
    'ai_plugin_explain',
    'ai_plugin_debug',
    'ai_layout_generate',
    'ai_component_generate',
    'ai_code_patch'
);

-- AI Translation services
UPDATE service_credit_costs
SET service_category = 'ai_translation'
WHERE service_key LIKE 'ai_translate_%'
   OR service_key LIKE 'translation_%';

-- AI Image Generation services
UPDATE service_credit_costs
SET service_category = 'ai_image_generation'
WHERE service_key LIKE 'ai_image_%_generate%'
   OR (service_key LIKE 'ai_image_%' AND metadata->>'operation' = 'generate');

-- AI Image Editing services (all other image operations)
UPDATE service_credit_costs
SET service_category = 'ai_image_editing'
WHERE service_key LIKE 'ai_image_%'
  AND service_category = 'ai_services';

-- Verify the updates
SELECT service_category, COUNT(*) as count,
       array_agg(service_key ORDER BY service_key) as services
FROM service_credit_costs
WHERE service_category LIKE 'ai_%'
GROUP BY service_category
ORDER BY service_category;
