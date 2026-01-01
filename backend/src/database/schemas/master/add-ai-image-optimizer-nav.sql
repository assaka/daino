-- ============================================
-- Add AI Image Optimizer to Admin Navigation
-- Places under Content section, after File Library
-- ============================================

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
  'a1b2c3d4-e5f6-7890-abcd-000000000040',
  'ai_image_optimizer',
  'AI Image Optimizer',
  'Wand2',
  '/admin/ai-image-optimizer',
  'content',
  4, -- After file_library (3), before emails (4 -> now 5)
  true,
  'content',
  NULL,
  'AI-powered image enhancement, upscaling, background removal, and product staging',
  '{"text":"AI","color":"purple","variant":"default"}'::jsonb,
  'new',
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

-- Update emails order position to make room
UPDATE admin_navigation_core
SET default_order_position = 5
WHERE key = 'emails' AND parent_key = 'content';
