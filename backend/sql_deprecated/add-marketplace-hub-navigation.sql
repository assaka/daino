-- Add Marketplace Hub to Import & Export
-- Uses the exact parent_key from Shopify Integration (which already works)

-- Step 1: Add Marketplace Hub using Shopify's parent_key
INSERT INTO admin_navigation_registry (
  id,
  key,
  label,
  icon,
  route,
  parent_key,
  order_position,
  is_core,
  is_visible,
  plugin_id,
  category,
  required_permission,
  description,
  badge_config,
  type,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'marketplace_hub',
  'Marketplace Hub',
  'ShoppingCart',
  '/admin/marketplace-hub',
  parent_key, -- Copy parent_key from Shopify
  310, -- Order before Shopify (330)
  true,
  true,
  NULL,
  'import_export',
  NULL,
  'Unified marketplace management: Amazon, eBay, and more with AI optimization',
  jsonb_build_object(
    'text', 'New',
    'variant', 'default',
    'color', 'blue'
  ),
  'new',
  NOW(),
  NOW()
FROM admin_navigation_registry
WHERE key = 'shopify_integration'
LIMIT 1
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  parent_key = EXCLUDED.parent_key,
  order_position = EXCLUDED.order_position,
  is_visible = EXCLUDED.is_visible,
  description = EXCLUDED.description,
  badge_config = EXCLUDED.badge_config,
  type = EXCLUDED.type,
  updated_at = NOW();

-- Step 2: Remove "coming_soon" from Shopify (it's fully functional)
UPDATE admin_navigation_registry
SET
  type = NULL,
  updated_at = NOW()
WHERE key = 'shopify_integration' AND type = 'coming_soon';

-- Verify the result
SELECT
  key,
  label,
  route,
  icon,
  order_position,
  type,
  badge_config->>'text' as badge,
  is_visible,
  parent_key
FROM admin_navigation_registry
WHERE category = 'import_export'
ORDER BY order_position;
