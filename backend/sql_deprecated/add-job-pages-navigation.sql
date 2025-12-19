-- Add all job-related pages to navigation
-- Uses existing parent IDs from Shopify and other items

-- ============================================
-- IMPORT & EXPORT SECTION
-- ============================================

-- 1. Marketplace Hub (copy parent from Shopify)
INSERT INTO admin_navigation_registry (
  id, key, label, icon, route, parent_key, order_position,
  is_core, is_visible, plugin_id, category, required_permission,
  description, badge_config, type, created_at, updated_at
)
SELECT
  gen_random_uuid(), 'marketplace_hub', 'Marketplace Hub', 'ShoppingCart',
  '/admin/marketplace-hub', parent_key, 310,
  true, true, NULL, 'import_export', NULL,
  'Unified marketplace management with AI optimization',
  jsonb_build_object('text', 'New', 'variant', 'default', 'color', 'blue'),
  'new', NOW(), NOW()
FROM admin_navigation_registry
WHERE key = 'shopify_integration'
LIMIT 1
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  order_position = EXCLUDED.order_position,
  badge_config = EXCLUDED.badge_config,
  updated_at = NOW();

-- 2. Import/Export Jobs & Analytics (same parent as Shopify)
INSERT INTO admin_navigation_registry (
  id, key, label, icon, route, parent_key, order_position,
  is_core, is_visible, plugin_id, category, required_permission,
  description, badge_config, type, created_at, updated_at
)
SELECT
  gen_random_uuid(), 'import_export_jobs', 'Jobs & Analytics', 'BarChart3',
  '/admin/import-export-jobs', parent_key, 350,
  true, true, NULL, 'import_export', NULL,
  'Monitor import/export jobs and view performance analytics',
  NULL, NULL, NOW(), NOW()
FROM admin_navigation_registry
WHERE key = 'shopify_integration'
LIMIT 1
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  order_position = EXCLUDED.order_position,
  updated_at = NOW();

-- Remove "coming_soon" from Shopify
UPDATE admin_navigation_registry
SET type = NULL, updated_at = NOW()
WHERE key = 'shopify_integration' AND type = 'coming_soon';

-- ============================================
-- ADVANCED SECTION
-- ============================================

-- 3. Background Jobs (copy parent from an existing Advanced item like "cache")
INSERT INTO admin_navigation_registry (
  id, key, label, icon, route, parent_key, order_position,
  is_core, is_visible, plugin_id, category, required_permission,
  description, badge_config, type, created_at, updated_at
)
SELECT
  gen_random_uuid(), 'background_jobs', 'Background Jobs', 'Activity',
  '/admin/background-jobs', parent_key, 910,
  true, true, NULL, 'advanced', NULL,
  'Monitor all background job processing and queue status',
  NULL, NULL, NOW(), NOW()
FROM admin_navigation_registry
WHERE key IN ('cache', 'monitoring', 'settings')
  AND parent_key IS NOT NULL
LIMIT 1
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  order_position = EXCLUDED.order_position,
  updated_at = NOW();

-- 4. Job Scheduler (same parent as Background Jobs)
INSERT INTO admin_navigation_registry (
  id, key, label, icon, route, parent_key, order_position,
  is_core, is_visible, plugin_id, category, required_permission,
  description, badge_config, type, created_at, updated_at
)
SELECT
  gen_random_uuid(), 'job_scheduler', 'Job Scheduler', 'Clock',
  '/admin/job-scheduler', parent_key, 920,
  true, true, NULL, 'advanced', NULL,
  'Schedule recurring tasks and cron jobs (plugin support)',
  jsonb_build_object('text', 'New', 'variant', 'outline', 'color', 'purple'),
  'new', NOW(), NOW()
FROM admin_navigation_registry
WHERE key IN ('cache', 'monitoring', 'settings')
  AND parent_key IS NOT NULL
LIMIT 1
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  route = EXCLUDED.route,
  order_position = EXCLUDED.order_position,
  badge_config = EXCLUDED.badge_config,
  updated_at = NOW();

-- Verify Import & Export section
SELECT
  key,
  label,
  route,
  order_position,
  type,
  badge_config->>'text' as badge
FROM admin_navigation_registry
WHERE category = 'import_export'
ORDER BY order_position;

-- Verify Advanced section
SELECT
  key,
  label,
  route,
  order_position,
  badge_config->>'text' as badge
FROM admin_navigation_registry
WHERE category = 'advanced'
ORDER BY order_position;
