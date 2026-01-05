-- ============================================
-- MODEL-SPECIFIC IMAGE GENERATION CREDIT COSTS
-- Different AI models have different quality/speed/cost tradeoffs
-- 1 credit = $0.10
-- ============================================

-- ============================================
-- OpenAI DALL-E Model-Specific Costs
-- ============================================
INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, cost_price_usd, billing_type, description, is_active, is_visible, display_order, metadata)
VALUES
  -- DALL-E 3: Best quality, most creative (~$0.04-0.08/image)
  ('ai_image_openai_generate_dalle3', 'OpenAI DALL-E 3 Generation', 'ai_image_generation', 4.0, 0.06, 'per_use',
   'Generate images using DALL-E 3 - best quality, most creative, supports HD',
   true, true, 140,
   '{"provider": "openai", "operation": "generate", "model": "dall-e-3", "icon": "🎨", "quality": 5, "speed": 3, "creativity": 5}'),

  -- DALL-E 2: Faster, cheaper (~$0.02/image)
  ('ai_image_openai_generate_dalle2', 'OpenAI DALL-E 2 Generation', 'ai_image_generation', 2.0, 0.02, 'per_use',
   'Generate images using DALL-E 2 - faster, budget-friendly, good for iterations',
   true, true, 141,
   '{"provider": "openai", "operation": "generate", "model": "dall-e-2", "icon": "⚡", "quality": 3, "speed": 5, "creativity": 3}')
ON CONFLICT (service_key) DO UPDATE SET
  cost_per_unit = EXCLUDED.cost_per_unit,
  cost_price_usd = EXCLUDED.cost_price_usd,
  service_category = EXCLUDED.service_category,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active;

-- ============================================
-- Flux Model-Specific Costs (update existing + add flux-pro)
-- BFL Direct API Pricing
-- ============================================
INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, cost_price_usd, billing_type, description, is_active, is_visible, display_order, metadata)
VALUES
  -- Flux Pro 1.1: Highest quality (~$0.05/image)
  ('ai_image_flux_generate_pro11', 'Flux Pro 1.1 Generation', 'ai_image_generation', 5.0, 0.05, 'per_use',
   'Generate images using Flux Pro 1.1 - highest quality, best photorealism',
   true, true, 150,
   '{"provider": "flux", "operation": "generate", "model": "flux-pro-1.1", "icon": "🌟", "quality": 5, "speed": 2, "creativity": 4}'),

  -- Flux Pro: Good quality/speed balance (~$0.04/image)
  ('ai_image_flux_generate_pro', 'Flux Pro Generation', 'ai_image_generation', 4.0, 0.04, 'per_use',
   'Generate images using Flux Pro - great quality/speed balance',
   true, true, 151,
   '{"provider": "flux", "operation": "generate", "model": "flux-pro", "icon": "✨", "quality": 4, "speed": 3, "creativity": 4}'),

  -- Flux Dev: Fast & affordable (~$0.025/image)
  ('ai_image_flux_generate_dev', 'Flux Dev Generation', 'ai_image_generation', 2.0, 0.025, 'per_use',
   'Generate images using Flux Dev - fast prototyping, budget-friendly',
   true, true, 152,
   '{"provider": "flux", "operation": "generate", "model": "flux-dev", "icon": "⚡", "quality": 3, "speed": 5, "creativity": 3}')
ON CONFLICT (service_key) DO UPDATE SET
  cost_per_unit = EXCLUDED.cost_per_unit,
  cost_price_usd = EXCLUDED.cost_price_usd,
  service_category = EXCLUDED.service_category,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active;

-- ============================================
-- Update legacy generic entries to use new category
-- ============================================
UPDATE service_credit_costs
SET service_category = 'ai_image_generation'
WHERE service_key IN ('ai_image_openai_generate', 'ai_image_flux_generate', 'ai_image_gemini_generate', 'ai_image_qwen_generate');

-- Update other AI image operations to use ai_image_editing category
UPDATE service_credit_costs
SET service_category = 'ai_image_editing'
WHERE service_key LIKE 'ai_image_%'
  AND service_key NOT LIKE '%_generate%'
  AND service_category = 'ai_services';

-- ============================================
-- Summary of Model-Specific Generation Costs
-- ============================================
-- Provider | Model         | Credits | Cost    | Quality | Speed | Best For
-- ---------|---------------|---------|---------|---------|-------|------------------
-- OpenAI   | DALL-E 3      | 4 cr    | $0.06   | ★★★★★  | ★★★☆☆ | Creative, artistic
-- OpenAI   | DALL-E 2      | 2 cr    | $0.02   | ★★★☆☆  | ★★★★★ | Quick iterations
-- Flux     | Pro 1.1       | 5 cr    | $0.05   | ★★★★★  | ★★☆☆☆ | Photorealistic
-- Flux     | Pro           | 4 cr    | $0.04   | ★★★★☆  | ★★★☆☆ | Balanced
-- Flux     | Dev           | 2 cr    | $0.025  | ★★★☆☆  | ★★★★★ | Fast prototyping
-- ============================================

-- Verify the new entries
SELECT service_key, service_name, service_category, cost_per_unit, cost_price_usd,
       metadata->>'model' as model, metadata->>'quality' as quality
FROM service_credit_costs
WHERE service_key LIKE 'ai_image_%generate%'
ORDER BY service_key;
