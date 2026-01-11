-- ============================================
-- Add WooCommerce Integration to Admin Navigation
-- Places under Import & Export section
-- ============================================

-- Add WooCommerce to Import & Export section (after Akeneo)
INSERT INTO admin_navigation_core (
  id,
  key,
  label,
  icon,
  route,
  parent_key,
  default_order_position,
  default_is_visible,
  category,
  required_permission,
  description,
  badge_config,
  type,
  created_at,
  updated_at
)
VALUES (
  'b2c3d4e5-f6a7-4890-bcde-111111111111',
  'woocommerce_integration',
  'WooCommerce',
  'ShoppingCart',
  '/admin/woocommerce-integration',
  'import_export',
  4, -- After akeneo (3)
  true,
  'import_export',
  NULL,
  'Import products and categories from WooCommerce',
  NULL,
  'standard',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  description = EXCLUDED.description,
  badge_config = EXCLUDED.badge_config,
  type = EXCLUDED.type,
  updated_at = NOW();

-- Update order of workflow_integrations (move from 4 to 5)
UPDATE admin_navigation_core
SET default_order_position = 5, updated_at = NOW()
WHERE key = 'workflow_integrations' AND parent_key = 'import_export';

-- Update order of import_export_jobs (move from 5 to 6)
UPDATE admin_navigation_core
SET default_order_position = 6, updated_at = NOW()
WHERE key = 'import_export_jobs' AND parent_key = 'import_export';
