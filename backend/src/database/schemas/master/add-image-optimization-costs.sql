-- ============================================
-- AI Image Optimization Credit Costs
-- 1 credit = $0.10
-- ============================================

-- Add 'image_optimization' to valid service categories if not exists
-- Note: Using 'ai_services' category which already exists

-- ============================================
-- OpenAI Image Optimization Costs
-- (Highest quality, highest cost)
-- ============================================
INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, billing_type, description, is_active, is_visible, display_order, metadata)
VALUES
  ('ai_image_openai_compress', 'OpenAI Image Compress', 'ai_services', 0.5, 'per_use', 'AI-powered image compression using OpenAI', true, true, 100, '{"provider": "openai", "operation": "compress", "icon": "🤖"}'),
  ('ai_image_openai_upscale', 'OpenAI Image Upscale', 'ai_services', 1.5, 'per_use', 'Image upscaling and enhancement using OpenAI', true, true, 101, '{"provider": "openai", "operation": "upscale", "icon": "🤖"}'),
  ('ai_image_openai_remove_bg', 'OpenAI Background Removal', 'ai_services', 1.5, 'per_use', 'AI background removal using OpenAI', true, true, 102, '{"provider": "openai", "operation": "remove_bg", "icon": "🤖"}'),
  ('ai_image_openai_stage', 'OpenAI Product Staging', 'ai_services', 2.5, 'per_use', 'Place product in realistic environment using OpenAI', true, true, 103, '{"provider": "openai", "operation": "stage", "icon": "🤖"}'),
  ('ai_image_openai_convert', 'OpenAI Format Convert', 'ai_services', 0.3, 'per_use', 'Smart format conversion using OpenAI', true, true, 104, '{"provider": "openai", "operation": "convert", "icon": "🤖"}'),
  ('ai_image_openai_custom', 'OpenAI Custom', 'ai_services', 2.5, 'per_use', 'Custom AI image modification using OpenAI', true, true, 105, '{"provider": "openai", "operation": "custom", "icon": "🤖"}'),
  ('ai_image_openai_generate', 'OpenAI Image Generation', 'ai_services', 4.0, 'per_use', 'Generate new images from text using DALL-E 3', true, true, 106, '{"provider": "openai", "operation": "generate", "icon": "🤖"}')
ON CONFLICT (service_key) DO UPDATE SET
  cost_per_unit = EXCLUDED.cost_per_unit,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active;

-- ============================================
-- Gemini Image Optimization Costs
-- (Fast, balanced cost)
-- ============================================
INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, billing_type, description, is_active, is_visible, display_order, metadata)
VALUES
  ('ai_image_gemini_compress', 'Gemini Image Compress', 'ai_services', 0.3, 'per_use', 'AI-powered image compression using Gemini', true, true, 110, '{"provider": "gemini", "operation": "compress", "icon": "✨"}'),
  ('ai_image_gemini_upscale', 'Gemini Image Upscale', 'ai_services', 0.8, 'per_use', 'Image upscaling and enhancement using Gemini', true, true, 111, '{"provider": "gemini", "operation": "upscale", "icon": "✨"}'),
  ('ai_image_gemini_remove_bg', 'Gemini Background Removal', 'ai_services', 0.8, 'per_use', 'AI background removal using Gemini', true, true, 112, '{"provider": "gemini", "operation": "remove_bg", "icon": "✨"}'),
  ('ai_image_gemini_stage', 'Gemini Product Staging', 'ai_services', 1.5, 'per_use', 'Place product in realistic environment using Gemini', true, true, 113, '{"provider": "gemini", "operation": "stage", "icon": "✨"}'),
  ('ai_image_gemini_convert', 'Gemini Format Convert', 'ai_services', 0.2, 'per_use', 'Smart format conversion using Gemini', true, true, 114, '{"provider": "gemini", "operation": "convert", "icon": "✨"}'),
  ('ai_image_gemini_custom', 'Gemini Custom', 'ai_services', 1.5, 'per_use', 'Custom AI image modification using Gemini', true, true, 115, '{"provider": "gemini", "operation": "custom", "icon": "✨"}'),
  ('ai_image_gemini_generate', 'Gemini Image Generation', 'ai_services', 2.5, 'per_use', 'Generate new images from text using Gemini', true, true, 116, '{"provider": "gemini", "operation": "generate", "icon": "✨"}')
ON CONFLICT (service_key) DO UPDATE SET
  cost_per_unit = EXCLUDED.cost_per_unit,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active;

-- ============================================
-- Flux Image Optimization Costs
-- (High quality generation, good for staging)
-- ============================================
INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, billing_type, description, is_active, is_visible, display_order, metadata)
VALUES
  ('ai_image_flux_compress', 'Flux Image Compress', 'ai_services', 0.4, 'per_use', 'AI-powered image compression using Flux', true, true, 120, '{"provider": "flux", "operation": "compress", "icon": "⚡"}'),
  ('ai_image_flux_upscale', 'Flux Image Upscale', 'ai_services', 0.6, 'per_use', 'Image upscaling using Flux/Real-ESRGAN', true, true, 121, '{"provider": "flux", "operation": "upscale", "icon": "⚡"}'),
  ('ai_image_flux_remove_bg', 'Flux Background Removal', 'ai_services', 0.5, 'per_use', 'AI background removal using Flux/BiRefNet', true, true, 122, '{"provider": "flux", "operation": "remove_bg", "icon": "⚡"}'),
  ('ai_image_flux_stage', 'Flux Product Staging', 'ai_services', 1.8, 'per_use', 'Place product in realistic environment using Flux', true, true, 123, '{"provider": "flux", "operation": "stage", "icon": "⚡"}'),
  ('ai_image_flux_convert', 'Flux Format Convert', 'ai_services', 0.2, 'per_use', 'Smart format conversion using Flux', true, true, 124, '{"provider": "flux", "operation": "convert", "icon": "⚡"}'),
  ('ai_image_flux_custom', 'Flux Custom', 'ai_services', 1.8, 'per_use', 'Custom AI image modification using Flux', true, true, 125, '{"provider": "flux", "operation": "custom", "icon": "⚡"}'),
  ('ai_image_flux_generate', 'Flux Image Generation', 'ai_services', 3.0, 'per_use', 'Generate new images from text using Flux', true, true, 126, '{"provider": "flux", "operation": "generate", "icon": "⚡"}')
ON CONFLICT (service_key) DO UPDATE SET
  cost_per_unit = EXCLUDED.cost_per_unit,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active;

-- ============================================
-- Qwen Image Optimization Costs
-- (Budget option, lowest cost)
-- ============================================
INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, billing_type, description, is_active, is_visible, display_order, metadata)
VALUES
  ('ai_image_qwen_compress', 'Qwen Image Compress', 'ai_services', 0.2, 'per_use', 'AI-powered image compression using Qwen', true, true, 130, '{"provider": "qwen", "operation": "compress", "icon": "🎨"}'),
  ('ai_image_qwen_upscale', 'Qwen Image Upscale', 'ai_services', 0.5, 'per_use', 'Image upscaling and enhancement using Qwen', true, true, 131, '{"provider": "qwen", "operation": "upscale", "icon": "🎨"}'),
  ('ai_image_qwen_remove_bg', 'Qwen Background Removal', 'ai_services', 0.5, 'per_use', 'AI background removal using Qwen', true, true, 132, '{"provider": "qwen", "operation": "remove_bg", "icon": "🎨"}'),
  ('ai_image_qwen_stage', 'Qwen Product Staging', 'ai_services', 1.2, 'per_use', 'Place product in realistic environment using Qwen', true, true, 133, '{"provider": "qwen", "operation": "stage", "icon": "🎨"}'),
  ('ai_image_qwen_convert', 'Qwen Format Convert', 'ai_services', 0.15, 'per_use', 'Smart format conversion using Qwen', true, true, 134, '{"provider": "qwen", "operation": "convert", "icon": "🎨"}'),
  ('ai_image_qwen_custom', 'Qwen Custom', 'ai_services', 1.2, 'per_use', 'Custom AI image modification using Qwen', true, true, 135, '{"provider": "qwen", "operation": "custom", "icon": "🎨"}'),
  ('ai_image_qwen_generate', 'Qwen Image Generation', 'ai_services', 2.0, 'per_use', 'Generate new images from text using Qwen', true, true, 136, '{"provider": "qwen", "operation": "generate", "icon": "🎨"}')
ON CONFLICT (service_key) DO UPDATE SET
  cost_per_unit = EXCLUDED.cost_per_unit,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata,
  is_active = EXCLUDED.is_active;

-- ============================================
-- Summary of Credit Costs (1 credit = $0.10)
-- ============================================
-- Provider  | Compress | Upscale | Remove BG | Stage | Convert | Custom | Generate
-- ----------|----------|---------|-----------|-------|---------|--------|----------
-- OpenAI    | 0.5 cr   | 1.5 cr  | 1.5 cr    | 2.5 cr| 0.3 cr  | 2.5 cr | 4.0 cr
-- Gemini    | 0.3 cr   | 0.8 cr  | 0.8 cr    | 1.5 cr| 0.2 cr  | 1.5 cr | 2.5 cr
-- Flux      | 0.4 cr   | 0.6 cr  | 0.5 cr    | 1.8 cr| 0.2 cr  | 1.8 cr | 3.0 cr
-- Qwen      | 0.2 cr   | 0.5 cr  | 0.5 cr    | 1.2 cr| 0.15 cr | 1.2 cr | 2.0 cr
-- ============================================
