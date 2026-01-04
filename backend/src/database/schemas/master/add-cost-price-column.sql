-- ============================================
-- Add cost_price_usd column to service_credit_costs
-- Allows tracking actual provider costs for margin calculation
-- Position: AFTER cost_per_unit
-- ============================================
--
-- PRICING ASSUMPTIONS (as of Jan 2025):
--
-- ANTHROPIC (per 1M tokens):
--   Haiku 3.5:  $0.80 input, $4.00 output
--   Sonnet 3.5: $3.00 input, $15.00 output
--   Opus 3:     $15.00 input, $75.00 output
--
-- OPENAI (per 1M tokens):
--   GPT-4o mini: $0.15 input, $0.60 output
--   GPT-4o:      $2.50 input, $10.00 output
--   DALL-E 3:    $0.04-$0.12 per image
--
-- GOOGLE (per 1M tokens):
--   Gemini 2.0 Flash: $0.10 input, $0.40 output
--   Gemini 1.5 Pro:   $1.25 input, $5.00 output
--   Imagen 3:         ~$0.03 per image
--
-- GROQ (per 1M tokens):
--   Llama 3.3 70B: $0.59 input, $0.79 output
--   Mixtral 8x7B:  $0.24 input, $0.24 output
--
-- DEEPSEEK (per 1M tokens):
--   DeepSeek Chat: $0.14 input, $0.28 output
--
-- FLUX/BFL (per image):
--   Pro 1.1:  $0.05
--   Dev:      $0.025
--   Schnell:  $0.003
--
-- TOKEN USAGE ESTIMATES:
--   Chat session:    ~2,000 input + ~1,000 output
--   Translation:     ~500 input + ~300 output
--   CMS Block:       ~1,000 input + ~800 output
--   CMS Page:        ~3,000 input + ~2,500 output
--   Plugin gen:      ~5,000 input + ~3,000 output
--   Code patch:      ~10,000 input + ~5,000 output
--   Layout gen:      ~8,000 input + ~4,000 output
-- ============================================

DROP TABLE IF EXISTS service_credit_costs;

CREATE TABLE service_credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key VARCHAR(100) UNIQUE NOT NULL,
  service_name VARCHAR(255) NOT NULL,
  service_category VARCHAR(50) CHECK (service_category IN (
    'store_operations',
    'plugin_management',
    'ai_services',
    'data_migration',
    'storage',
    'akeneo_integration',
    'other'
  )),
  cost_per_unit DECIMAL(10, 4) NOT NULL,
  cost_price_usd DECIMAL(10, 6) DEFAULT NULL,
  billing_type VARCHAR(50) NOT NULL CHECK (billing_type IN (
    'per_use', 'per_day', 'per_month', 'per_hour', 'per_item', 'per_mb', 'flat_rate'
  )),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  is_visible BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Recreate indexes
CREATE INDEX idx_service_credit_costs_key ON service_credit_costs(service_key);
CREATE INDEX idx_service_credit_costs_category ON service_credit_costs(service_category);
CREATE INDEX idx_service_credit_costs_active ON service_credit_costs(is_active) WHERE is_active = true;
CREATE INDEX idx_service_credit_costs_display_order ON service_credit_costs(display_order);

-- ============================================
-- INSERT ALL 86 SERVICES WITH COST PRICES
-- cost_per_unit = credits charged (1 credit = $0.10)
-- cost_price_usd = actual cost to us in USD
-- ============================================

INSERT INTO service_credit_costs (service_key, service_name, service_category, cost_per_unit, cost_price_usd, billing_type, description, is_active, is_visible, display_order, metadata)
VALUES
  -- ==========================================
  -- STORE OPERATIONS (4)
  -- ==========================================
  ('store_daily_publishing', 'Store Daily Publishing', 'store_operations', 3.0000, 0.05, 'per_day', 'Daily hosting fee for published stores', true, true, 10, '{"note":"Charged daily at midnight UTC"}'),
  ('store_deployment', 'Store Deployment', 'store_operations', 0.0000, 0.00, 'per_use', 'One-time deployment of a new store', true, true, 11, '{"note":"Currently free"}'),
  ('store_backup', 'Store Backup', 'store_operations', 0.5000, 0.02, 'per_use', 'Manual store backup creation', true, true, 12, '{"note":"Automated backups included"}'),

  -- ==========================================
  -- PLUGIN MANAGEMENT (3)
  -- ==========================================
  ('plugin_install', 'Plugin Installation', 'plugin_management', 10.0000, 0.01, 'per_use', 'Installing a plugin to a store', true, true, 20, '{"note":"One-time charge per plugin per store"}'),
  ('plugin_monthly', 'Premium Plugin Monthly Fee', 'plugin_management', 5.0000, 0.10, 'per_month', 'Monthly subscription for premium plugins', true, true, 21, '{"applies_to":"premium_plugins_only"}'),
  ('custom_plugin_creation', 'Custom Plugin Creation', 'plugin_management', 70.0000, 0.50, 'per_use', 'Creating a custom plugin with AI', true, true, 22, '{"note":"AI-powered plugin generation"}'),

  -- ==========================================
  -- AI TRANSLATION SERVICES (14)
  -- Uses Haiku: $0.80/1M in, $4/1M out
  -- Standard: ~500 in + ~300 out = $0.002
  -- CMS Block: ~1K in + ~800 out = $0.004
  -- CMS Page: ~3K in + ~2.5K out = $0.012
  -- ==========================================
  ('ai_translation', 'AI Translation (Standard)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for products, categories, attributes, etc.', true, true, 30, '{"note":"Standard content: products, categories, attributes, labels, tabs","applies_to":["product","category","attribute","product_tab","product_label","ui_label","cookie_consent"]}'),
  ('ai_translation_cms_block', 'AI Translation (CMS Block)', 'ai_services', 0.2000, 0.004, 'per_item', 'AI translation for CMS content blocks', true, true, 31, '{"note":"CMS blocks with medium-length content","multiplier":2}'),
  ('ai_translation_cms_page', 'AI Translation (CMS Page)', 'ai_services', 4.0000, 0.012, 'per_item', 'AI translation for full CMS pages', true, true, 32, '{"note":"Full CMS pages with long-form content","multiplier":5}'),
  ('ai_translation_product', 'AI Translation (Product)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for product names and descriptions', true, true, 101, '{"note":"Product name and description translation"}'),
  ('ai_translation_category', 'AI Translation (Category)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for category names and descriptions', true, true, 102, '{"note":"Category name and description translation"}'),
  ('ai_translation_attribute', 'AI Translation (Attribute)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for product attributes', true, true, 103, '{"note":"Product attribute label translation"}'),
  ('ai_translation_product_tab', 'AI Translation (Product Tab)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for product tabs', true, true, 106, '{"note":"Product tab content translation"}'),
  ('ai_translation_product_label', 'AI Translation (Product Label)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for product labels', true, true, 107, '{"note":"Product label text translation"}'),
  ('ai_translation_cookie_consent', 'AI Translation (Cookie Consent)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for cookie consent text', true, true, 108, '{"note":"Cookie consent banner translation"}'),
  ('ai_translation_attribute_value', 'AI Translation (Attribute Value)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for attribute values', true, true, 109, '{"note":"Product attribute value translation"}'),
  ('ai_translation_email_template', 'AI Translation (Email Template)', 'ai_services', 12.0000, 0.015, 'per_item', 'AI translation for email templates', true, true, 110, '{"note":"Email template subject and content translation"}'),
  ('ai_translation_pdf_template', 'AI Translation (PDF Template)', 'ai_services', 3.0000, 0.008, 'per_item', 'AI translation for PDF templates', true, true, 111, '{"note":"PDF template content translation"}'),
  ('ai_translation_custom_option', 'AI Translation (Custom Option)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for custom product options', true, true, 112, '{"note":"Custom product option translation"}'),
  ('ai_translation_stock_label', 'AI Translation (Stock Label)', 'ai_services', 0.1000, 0.002, 'per_item', 'AI translation for stock labels', true, true, 113, '{"note":"Stock availability label translation"}'),

  -- ==========================================
  -- AI CONTENT & SEO SERVICES (4)
  -- Uses Sonnet for quality: $3/1M in, $15/1M out
  -- Product desc: ~1K in + ~500 out = $0.0105
  -- SEO: ~2K in + ~1K out = $0.021
  -- Code patch: ~10K in + ~5K out = $0.105
  -- Layout: ~8K in + ~4K out = $0.084
  -- ==========================================
  ('ai_product_description', 'AI Product Description', 'ai_services', 0.2000, 0.0105, 'per_item', 'AI-generated product descriptions', true, true, 33, '{"note":"Per product"}'),
  ('ai_seo_optimization', 'AI SEO Optimization', 'ai_services', 0.5000, 0.021, 'per_use', 'AI-powered SEO analysis and optimization', true, true, 34, '{"note":"Per page or product"}'),
  ('ai_code_patch', 'AI Code Modification', 'ai_services', 25.0000, 0.105, 'per_use', 'AI-powered code editing and patching', true, true, 35, '{"note":"Per code modification"}'),
  ('ai_layout_generation', 'AI Layout Generation', 'ai_services', 40.0000, 0.084, 'per_use', 'AI-generated page layouts and designs', true, true, 36, '{"note":"Per layout generation"}'),

  -- ==========================================
  -- AI CHAT - GENERAL (1)
  -- Default uses Haiku pricing
  -- ==========================================
  ('ai_chat', 'AI General Chat', 'ai_services', 1.0000, 0.006, 'per_use', 'General AI assistant interactions', true, true, 37, '{"note":"Per chat session"}'),

  -- ==========================================
  -- AI CHAT - CLAUDE/ANTHROPIC (3)
  -- ~2K input + ~1K output tokens per chat
  -- Haiku:  (2K×$0.80 + 1K×$4)/1M = $0.006
  -- Sonnet: (2K×$3 + 1K×$15)/1M = $0.021
  -- Opus:   (2K×$15 + 1K×$75)/1M = $0.105
  -- ==========================================
  ('ai_chat_claude_haiku', 'AI Chat - Claude Haiku', 'ai_services', 2.1000, 0.006, 'per_use', 'Claude 3 Haiku - Fast and affordable', true, true, 36, '{"note":"Fastest Claude model","model":"claude-3-5-haiku-latest","provider":"anthropic"}'),
  ('ai_chat_claude_sonnet', 'AI Chat - Claude Sonnet', 'ai_services', 8.0000, 0.021, 'per_use', 'Claude 3.5 Sonnet - Balanced performance', true, true, 37, '{"note":"Best balance of speed and quality","model":"claude-3-5-sonnet-latest","provider":"anthropic"}'),
  ('ai_chat_claude_opus', 'AI Chat - Claude Opus', 'ai_services', 25.0000, 0.105, 'per_use', 'Claude 3 Opus - Most capable', true, true, 38, '{"note":"Most powerful Claude model","model":"claude-3-opus-20240229","provider":"anthropic"}'),

  -- ==========================================
  -- AI CHAT - OPENAI (2)
  -- ~2K input + ~1K output tokens per chat
  -- GPT-4o mini: (2K×$0.15 + 1K×$0.60)/1M = $0.001
  -- GPT-4o:      (2K×$2.50 + 1K×$10)/1M = $0.015
  -- ==========================================
  ('ai_chat_gpt4o_mini', 'AI Chat - GPT-4o Mini', 'ai_services', 3.1000, 0.001, 'per_use', 'OpenAI GPT-4o Mini - Fast and efficient', true, true, 39, '{"note":"Fast and affordable OpenAI model","model":"gpt-4o-mini","provider":"openai"}'),
  ('ai_chat_gpt4o', 'AI Chat - GPT-4o', 'ai_services', 15.0000, 0.015, 'per_use', 'OpenAI GPT-4o - Latest flagship', true, true, 40, '{"note":"Most capable OpenAI model","model":"gpt-4o","provider":"openai"}'),

  -- ==========================================
  -- AI CHAT - GEMINI (2)
  -- ~2K input + ~1K output tokens per chat
  -- Flash: (2K×$0.10 + 1K×$0.40)/1M = $0.0006
  -- Pro:   (2K×$1.25 + 1K×$5)/1M = $0.0075
  -- ==========================================
  ('ai_chat_gemini_flash', 'AI Chat - Gemini Flash', 'ai_services', 1.6000, 0.0006, 'per_use', 'Google Gemini 1.5 Flash - Ultra fast', true, true, 41, '{"note":"Fastest Gemini model","model":"gemini-2.0-flash","provider":"gemini"}'),
  ('ai_chat_gemini_pro', 'AI Chat - Gemini Pro', 'ai_services', 10.0000, 0.0075, 'per_use', 'Google Gemini 1.5 Pro - Advanced reasoning', true, true, 42, '{"note":"Most capable Gemini model","model":"gemini-1.5-pro","provider":"gemini"}'),

  -- ==========================================
  -- AI CHAT - GROQ (2)
  -- ~2K input + ~1K output tokens per chat
  -- Llama:   (2K×$0.59 + 1K×$0.79)/1M = $0.002
  -- Mixtral: (2K×$0.24 + 1K×$0.24)/1M = $0.0007
  -- ==========================================
  ('ai_chat_groq_llama', 'AI Chat - Groq Llama', 'ai_services', 1.2000, 0.002, 'per_use', 'Groq Llama 3.1 70B - Lightning fast', true, true, 43, '{"note":"Ultra-fast inference with Groq","model":"llama-3.3-70b-versatile","provider":"groq"}'),
  ('ai_chat_groq_mixtral', 'AI Chat - Groq Mixtral', 'ai_services', 0.5000, 0.0007, 'per_use', 'Groq Mixtral 8x7B - Fast MoE model', true, true, 44, '{"note":"Fast mixture-of-experts model","model":"mixtral-8x7b-32768","provider":"groq"}'),

  -- ==========================================
  -- DATA MIGRATION (3)
  -- ==========================================
  ('product_import', 'Product Import', 'data_migration', 0.1000, 0.001, 'per_item', 'Bulk product import', true, true, 40, '{"note":"Per product imported","min_charge":1}'),
  ('shopify_migration', 'Shopify Store Migration', 'data_migration', 25.0000, 2.00, 'flat_rate', 'Full store migration from Shopify', true, true, 41, '{"note":"Includes products, customers, orders"}'),
  ('csv_import', 'CSV Data Import', 'data_migration', 1.0000, 0.05, 'per_use', 'Import data from CSV files', true, true, 42, '{"note":"Per CSV file, up to 10,000 rows"}'),

  -- ==========================================
  -- AKENEO INTEGRATION (3)
  -- ==========================================
  ('akeneo_schedule_run', 'Akeneo Scheduled Import', 'akeneo_integration', 0.1000, 0.01, 'per_use', 'Automated Akeneo data synchronization', true, true, 50, '{"note":"Per scheduled execution"}'),
  ('akeneo_manual_import', 'Akeneo Manual Import', 'akeneo_integration', 0.1000, 0.01, 'per_use', 'Manual Akeneo data import', true, true, 51, '{"note":"On-demand import"}'),
  ('akeneo_setup', 'Akeneo Integration Setup', 'akeneo_integration', 5.0000, 0.50, 'per_use', 'Initial Akeneo integration configuration', true, true, 52, '{"note":"One-time setup fee"}'),

  -- ==========================================
  -- STORAGE (3)
  -- ==========================================
  ('storage_per_gb', 'Additional Storage', 'storage', 0.5000, 0.02, 'per_mb', 'Additional storage beyond free tier', true, true, 60, '{"note":"Per GB per month","free_tier_gb":1}'),
  ('image_optimization', 'Image Optimization', 'storage', 0.0100, 0.002, 'per_item', 'Automatic image optimization and compression', true, true, 61, '{"note":"Per image"}'),
  ('cdn_bandwidth', 'CDN Bandwidth', 'storage', 0.0010, 0.0005, 'per_mb', 'Content delivery network bandwidth', true, true, 62, '{"note":"Per GB","free_tier_gb":10}'),

  -- ==========================================
  -- PLUGIN AI - CLAUDE/ANTHROPIC (3)
  -- ~5K input + ~3K output tokens for plugin gen
  -- Haiku:  (5K×$0.80 + 3K×$4)/1M = $0.016
  -- Sonnet: (5K×$3 + 3K×$15)/1M = $0.06
  -- Opus:   (5K×$15 + 3K×$75)/1M = $0.30
  -- ==========================================
  ('ai_plugin_claude_haiku', 'Plugin AI - Claude Haiku', 'ai_services', 5.0000, 0.016, 'per_use', 'Claude 3 Haiku - Fast plugin generation', true, true, 60, '{"note":"Fast and affordable","model":"claude-3-haiku-20240307","provider":"anthropic"}'),
  ('ai_plugin_claude_sonnet', 'Plugin AI - Claude Sonnet', 'ai_services', 10.0000, 0.06, 'per_use', 'Claude 3.5 Sonnet - Balanced plugin generation', true, true, 61, '{"note":"Best balance of speed and quality","model":"claude-3-5-sonnet-20241022","provider":"anthropic"}'),
  ('ai_plugin_claude_opus', 'Plugin AI - Claude Opus', 'ai_services', 20.0000, 0.30, 'per_use', 'Claude 3 Opus - Premium plugin generation', true, true, 62, '{"note":"Highest quality","model":"claude-3-opus-20240229","provider":"anthropic"}'),

  -- ==========================================
  -- PLUGIN AI - OPENAI (2)
  -- ~5K input + ~3K output tokens for plugin gen
  -- GPT-4o mini: (5K×$0.15 + 3K×$0.60)/1M = $0.003
  -- GPT-4o:      (5K×$2.50 + 3K×$10)/1M = $0.043
  -- ==========================================
  ('ai_plugin_openai_gpt4o_mini', 'Plugin AI - GPT-4o Mini', 'ai_services', 5.0000, 0.003, 'per_use', 'GPT-4o Mini - Fast OpenAI plugin generation', true, true, 63, '{"note":"Fast and affordable","model":"gpt-4o-mini","provider":"openai"}'),
  ('ai_plugin_openai_gpt4o', 'Plugin AI - GPT-4o', 'ai_services', 12.0000, 0.043, 'per_use', 'GPT-4o - Premium OpenAI plugin generation', true, true, 64, '{"note":"Latest GPT-4 model","model":"gpt-4o","provider":"openai"}'),

  -- ==========================================
  -- PLUGIN AI - GEMINI (2)
  -- ~5K input + ~3K output tokens for plugin gen
  -- Flash: (5K×$0.10 + 3K×$0.40)/1M = $0.0017
  -- Pro:   (5K×$1.25 + 3K×$5)/1M = $0.021
  -- ==========================================
  ('ai_plugin_gemini_flash', 'Plugin AI - Gemini Flash', 'ai_services', 3.0000, 0.0017, 'per_use', 'Gemini 2.0 Flash - Ultra fast plugin generation', true, true, 65, '{"note":"Fastest Gemini model","model":"gemini-2.0-flash","provider":"gemini"}'),
  ('ai_plugin_gemini_pro', 'Plugin AI - Gemini Pro', 'ai_services', 8.0000, 0.021, 'per_use', 'Gemini Pro - Advanced plugin generation', true, true, 66, '{"note":"Advanced reasoning","model":"gemini-pro","provider":"gemini"}'),

  -- ==========================================
  -- PLUGIN AI - GROQ (1)
  -- ~5K input + ~3K output tokens for plugin gen
  -- Llama: (5K×$0.59 + 3K×$0.79)/1M = $0.005
  -- ==========================================
  ('ai_plugin_groq_llama', 'Plugin AI - Groq Llama', 'ai_services', 2.0000, 0.005, 'per_use', 'Llama 3.3 70B on Groq - Lightning fast', true, true, 67, '{"note":"Fastest inference","model":"llama-3.3-70b-versatile","provider":"groq"}'),

  -- ==========================================
  -- PLUGIN AI - DEEPSEEK (1)
  -- ~5K input + ~3K output tokens for plugin gen
  -- DeepSeek: (5K×$0.14 + 3K×$0.28)/1M = $0.002
  -- ==========================================
  ('ai_plugin_deepseek', 'Plugin AI - DeepSeek', 'ai_services', 3.0000, 0.002, 'per_use', 'DeepSeek Chat - Cost-effective plugin generation', true, true, 68, '{"note":"Cost-effective coding model","model":"deepseek-chat","provider":"deepseek"}'),

  -- ==========================================
  -- OTHER SERVICES (3)
  -- ==========================================
  ('api_rate_boost', 'API Rate Limit Boost', 'other', 10.0000, 0.10, 'per_month', 'Increase API rate limits', true, true, 70, '{"boost_multiplier":10}'),
  ('priority_support', 'Priority Support', 'other', 15.0000, 1.00, 'per_month', 'Priority customer support', true, true, 71, '{"sla":"4 hours"}'),
  ('custom_domain', 'Custom Domain Setup', 'other', 0.3000, 0.01, 'per_day', 'Configure custom domain for store', true, true, 72, '{"note":"One-time setup fee"}'),

  -- ==========================================
  -- IMAGE AI - OPENAI (7)
  -- DALL-E 3: $0.04 (1024x1024), $0.08 (1024x1792), $0.12 (HD)
  -- Vision analysis: ~$0.01 per image
  -- ==========================================
  ('ai_image_openai_compress', 'OpenAI Image Compress', 'ai_services', 0.5000, 0.01, 'per_use', 'AI-powered image compression using OpenAI', true, true, 100, '{"icon":"🤖","provider":"openai","operation":"compress"}'),
  ('ai_image_openai_upscale', 'OpenAI Image Upscale', 'ai_services', 1.5000, 0.04, 'per_use', 'Image upscaling and enhancement using OpenAI', true, true, 101, '{"icon":"🤖","provider":"openai","operation":"upscale"}'),
  ('ai_image_openai_remove_bg', 'OpenAI Background Removal', 'ai_services', 1.5000, 0.04, 'per_use', 'AI background removal using OpenAI', true, true, 102, '{"icon":"🤖","provider":"openai","operation":"remove_bg"}'),
  ('ai_image_openai_stage', 'OpenAI Product Staging', 'ai_services', 2.5000, 0.08, 'per_use', 'Place product in realistic environment using OpenAI', true, true, 103, '{"icon":"🤖","provider":"openai","operation":"stage"}'),
  ('ai_image_openai_convert', 'OpenAI Format Convert', 'ai_services', 0.3000, 0.01, 'per_use', 'Smart format conversion using OpenAI', true, true, 104, '{"icon":"🤖","provider":"openai","operation":"convert"}'),
  ('ai_image_openai_custom', 'OpenAI Custom', 'ai_services', 2.5000, 0.08, 'per_use', 'Custom AI image modification using OpenAI', true, true, 105, '{"icon":"🤖","provider":"openai","operation":"custom"}'),
  ('ai_image_openai_generate', 'OpenAI Image Generation', 'ai_services', 4.0000, 0.04, 'per_use', 'Generate new images from text using DALL-E 3', true, true, 106, '{"icon":"🤖","provider":"openai","operation":"generate"}'),

  -- ==========================================
  -- IMAGE AI - GEMINI (7)
  -- Imagen 3: ~$0.03 per image
  -- Vision analysis: very cheap ~$0.001
  -- ==========================================
  ('ai_image_gemini_compress', 'Gemini Image Compress', 'ai_services', 0.3000, 0.001, 'per_use', 'AI-powered image compression using Gemini', true, true, 110, '{"icon":"✨","provider":"gemini","operation":"compress"}'),
  ('ai_image_gemini_upscale', 'Gemini Image Upscale', 'ai_services', 0.8000, 0.03, 'per_use', 'Image upscaling and enhancement using Gemini', true, true, 111, '{"icon":"✨","provider":"gemini","operation":"upscale"}'),
  ('ai_image_gemini_remove_bg', 'Gemini Background Removal', 'ai_services', 0.8000, 0.03, 'per_use', 'AI background removal using Gemini', true, true, 112, '{"icon":"✨","provider":"gemini","operation":"remove_bg"}'),
  ('ai_image_gemini_stage', 'Gemini Product Staging', 'ai_services', 1.5000, 0.03, 'per_use', 'Place product in realistic environment using Gemini', true, true, 113, '{"icon":"✨","provider":"gemini","operation":"stage"}'),
  ('ai_image_gemini_convert', 'Gemini Format Convert', 'ai_services', 0.2000, 0.001, 'per_use', 'Smart format conversion using Gemini', true, true, 114, '{"icon":"✨","provider":"gemini","operation":"convert"}'),
  ('ai_image_gemini_custom', 'Gemini Custom', 'ai_services', 1.5000, 0.03, 'per_use', 'Custom AI image modification using Gemini', true, true, 115, '{"icon":"✨","provider":"gemini","operation":"custom"}'),
  ('ai_image_gemini_generate', 'Gemini Image Generation', 'ai_services', 2.5000, 0.03, 'per_use', 'Generate new images from text using Gemini', true, true, 116, '{"icon":"✨","provider":"gemini","operation":"generate"}'),

  -- ==========================================
  -- IMAGE AI - FLUX (10)
  -- BFL Direct API pricing:
  -- Pro 1.1: $0.05, Dev: $0.025, Schnell: $0.003
  -- ==========================================
  ('ai_image_flux_compress', 'Flux Image Compress', 'ai_services', 0.4000, 0.003, 'per_use', 'AI-powered image compression using Flux', true, true, 120, '{"icon":"⚡","provider":"flux","operation":"compress"}'),
  ('ai_image_flux_upscale', 'Flux Image Upscale', 'ai_services', 0.6000, 0.003, 'per_use', 'Image upscaling using Flux/Real-ESRGAN', true, true, 121, '{"icon":"⚡","provider":"flux","operation":"upscale"}'),
  ('ai_image_flux_remove_bg', 'Flux Background Removal', 'ai_services', 0.5000, 0.003, 'per_use', 'AI background removal using Flux/BiRefNet', true, true, 122, '{"icon":"⚡","provider":"flux","operation":"remove_bg"}'),
  ('ai_image_flux_stage', 'Flux Product Staging', 'ai_services', 1.8000, 0.05, 'per_use', 'Place product in realistic environment using Flux', true, true, 123, '{"icon":"⚡","provider":"flux","operation":"stage"}'),
  ('ai_image_flux_convert', 'Flux Format Convert', 'ai_services', 0.2000, 0.001, 'per_use', 'Smart format conversion using Flux', true, true, 124, '{"icon":"⚡","provider":"flux","operation":"convert"}'),
  ('ai_image_flux_custom', 'Flux Custom', 'ai_services', 1.8000, 0.05, 'per_use', 'Custom AI image modification using Flux', true, true, 125, '{"icon":"⚡","provider":"flux","operation":"custom"}'),
  ('ai_image_flux_generate', 'Flux Image Generation', 'ai_services', 0.5000, 0.05, 'per_use', 'Generate new images from text using Flux Pro 1.1', true, true, 126, '{"icon":"⚡","provider":"flux","operation":"generate"}'),
  ('ai_image_flux_generate_pro', 'Flux Pro 1.1 Generation', 'ai_services', 2.0000, 0.05, 'per_use', 'Generate images using Flux Pro 1.1 - highest quality', true, true, 126, '{"icon":"⚡","model":"flux-pro-1.1","provider":"flux","operation":"generate"}'),
  ('ai_image_flux_generate_dev', 'Flux Dev Generation', 'ai_services', 1.0000, 0.025, 'per_use', 'Generate images using Flux Dev - balanced quality/cost', true, true, 127, '{"icon":"⚡","model":"flux-dev","provider":"flux","operation":"generate"}'),
  ('ai_image_flux_generate_schnell', 'Flux Schnell Generation', 'ai_services', 1.5000, 0.003, 'per_use', 'Generate images using Flux Schnell - fastest, budget option', true, true, 128, '{"icon":"⚡","model":"flux-schnell","provider":"flux","operation":"generate"}'),

  -- ==========================================
  -- IMAGE AI - QWEN (7)
  -- Very affordable, similar to Gemini pricing
  -- ==========================================
  ('ai_image_qwen_compress', 'Qwen Image Compress', 'ai_services', 0.2000, 0.001, 'per_use', 'AI-powered image compression using Qwen', true, true, 130, '{"icon":"🎨","provider":"qwen","operation":"compress"}'),
  ('ai_image_qwen_upscale', 'Qwen Image Upscale', 'ai_services', 0.5000, 0.02, 'per_use', 'Image upscaling and enhancement using Qwen', true, true, 131, '{"icon":"🎨","provider":"qwen","operation":"upscale"}'),
  ('ai_image_qwen_remove_bg', 'Qwen Background Removal', 'ai_services', 0.5000, 0.02, 'per_use', 'AI background removal using Qwen', true, true, 132, '{"icon":"🎨","provider":"qwen","operation":"remove_bg"}'),
  ('ai_image_qwen_stage', 'Qwen Product Staging', 'ai_services', 1.2000, 0.02, 'per_use', 'Place product in realistic environment using Qwen', true, true, 133, '{"icon":"🎨","provider":"qwen","operation":"stage"}'),
  ('ai_image_qwen_convert', 'Qwen Format Convert', 'ai_services', 0.1500, 0.001, 'per_use', 'Smart format conversion using Qwen', true, true, 134, '{"icon":"🎨","provider":"qwen","operation":"convert"}'),
  ('ai_image_qwen_custom', 'Qwen Custom', 'ai_services', 1.2000, 0.02, 'per_use', 'Custom AI image modification using Qwen', true, true, 135, '{"icon":"🎨","provider":"qwen","operation":"custom"}'),
  ('ai_image_qwen_generate', 'Qwen Image Generation', 'ai_services', 2.0000, 0.02, 'per_use', 'Generate new images from text using Qwen', true, true, 136, '{"icon":"🎨","provider":"qwen","operation":"generate"}');

-- Add comments
COMMENT ON COLUMN service_credit_costs.cost_price_usd IS 'Actual cost in USD to provide this service (for margin calculation)';
COMMENT ON TABLE service_credit_costs IS 'Pricing for all services that consume credits';
