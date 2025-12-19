-- Example queries to mark navigation items with different types
-- Run these in Supabase SQL Editor to test the premium/coming soon/beta/new badges

-- Mark some items as premium
UPDATE admin_navigation_registry
SET type = 'premium'
WHERE key IN ('ai-studio', 'heatmaps', 'ab-testing');

-- Mark some items as coming soon
UPDATE admin_navigation_registry
SET type = 'coming_soon'
WHERE key IN ('customer-activity');

-- Mark some items as beta
UPDATE admin_navigation_registry
SET type = 'beta'
WHERE key IN ('plugin-builder');

-- Mark some items as new
UPDATE admin_navigation_registry
SET type = 'new'
WHERE key IN ('navigation-manager');

-- View all items with their types
SELECT key, label, type, parent_key, route
FROM admin_navigation_registry
ORDER BY type, order_position;

-- Reset all to standard if needed
-- UPDATE admin_navigation_registry SET type = 'standard';
