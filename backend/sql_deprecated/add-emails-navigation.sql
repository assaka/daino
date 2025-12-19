-- Add Content menu group and Emails navigation item
-- This migration adds the Emails section under a Content parent menu

-- First, ensure Content parent exists (if not already there)
INSERT INTO admin_navigation_registry
(key, label, icon, route, parent_key, order_position, is_core, category, is_visible, created_at, updated_at)
VALUES
('content', 'Content', 'FileText', NULL, NULL, 7, true, 'content', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Add CMS Pages under Content (if not already there)
INSERT INTO admin_navigation_registry
(key, label, icon, route, parent_key, order_position, is_core, category, is_visible, created_at, updated_at)
VALUES
('cms-pages', 'CMS Pages', 'FileText', '/admin/cms-pages', 'content', 71, true, 'content', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Add CMS Blocks under Content (if not already there)
INSERT INTO admin_navigation_registry
(key, label, icon, route, parent_key, order_position, is_core, category, is_visible, created_at, updated_at)
VALUES
('cms-blocks', 'CMS Blocks', 'Square', '/admin/cms-blocks', 'content', 72, true, 'content', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;

-- Add Emails under Content (NEW)
INSERT INTO admin_navigation_registry
(key, label, icon, route, parent_key, order_position, is_core, category, is_visible, created_at, updated_at)
VALUES
('emails', 'Emails', 'Mail', '/admin/emails', 'content', 73, true, 'content', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (key)
DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  parent_key = EXCLUDED.parent_key,
  order_position = EXCLUDED.order_position,
  is_visible = EXCLUDED.is_visible,
  updated_at = CURRENT_TIMESTAMP;

-- Add comment
COMMENT ON TABLE admin_navigation_registry IS 'Master registry of all navigation items including Content > Emails';
