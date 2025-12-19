-- ============================================================================
-- ALL AI MIGRATIONS COMBINED
-- Run this file in your Supabase Master Database SQL Editor
--
-- This file combines all AI-related migrations in the correct order:
-- 1. Create AI Master Tables (core tables)
-- 2. Create AI Training System (auto-training tables)
-- 3. Seed AI Context Data (initial knowledge base)
-- 4. Seed Slot Grid Context (slot hierarchy info)
-- 5. Seed Comprehensive AI Context (entity definitions & examples)
--
-- SAFE TO RE-RUN: Uses IF NOT EXISTS and DELETE/TRUNCATE before inserts
-- ============================================================================

-- ############################################################################
-- PART 1: CREATE AI MASTER TABLES
-- ############################################################################

-- AI Context Tables for Master Database
-- Run this in your MASTER Supabase project (not tenant DBs)
-- These tables store shared AI knowledge that benefits all users

-- ============================================
-- 1. AI CONTEXT DOCUMENTS - Global Knowledge Base
-- ============================================
CREATE TABLE IF NOT EXISTS ai_context_documents (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'architecture', 'api_reference', 'best_practices', 'tutorial', 'reference'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100), -- 'core', 'products', 'settings', 'content', 'marketing', 'translations'
  tags JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  priority INTEGER DEFAULT 0, -- 0-100, higher = more important
  mode VARCHAR(50) DEFAULT 'all', -- 'nocode', 'developer', 'all'
  is_active BOOLEAN DEFAULT true,
  embedding_vector TEXT, -- For future RAG with vector search
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_docs_type_active ON ai_context_documents(type, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_docs_category ON ai_context_documents(category);
CREATE INDEX IF NOT EXISTS idx_ai_docs_priority ON ai_context_documents(priority DESC);

-- ============================================
-- 2. AI PLUGIN EXAMPLES - Working Code Examples
-- ============================================
CREATE TABLE IF NOT EXISTS ai_plugin_examples (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- 'commerce', 'marketing', 'analytics', 'integration'
  complexity VARCHAR(20) DEFAULT 'simple', -- 'simple', 'intermediate', 'advanced'
  code TEXT NOT NULL,
  files JSONB DEFAULT '[]', -- [{name, code, description}]
  features JSONB DEFAULT '[]',
  use_cases JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  is_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  embedding_vector TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_examples_category ON ai_plugin_examples(category, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_examples_usage ON ai_plugin_examples(usage_count DESC);

-- ============================================
-- 3. AI CODE PATTERNS - Reusable Snippets
-- ============================================
CREATE TABLE IF NOT EXISTS ai_code_patterns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  pattern_type VARCHAR(100) NOT NULL, -- 'database', 'api', 'validation', 'ui_component', 'successful_prompt'
  description TEXT,
  code TEXT NOT NULL,
  language VARCHAR(50) DEFAULT 'javascript',
  framework VARCHAR(100), -- 'sequelize', 'express', 'react'
  parameters JSONB DEFAULT '[]',
  example_usage TEXT,
  tags JSONB DEFAULT '[]',
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  embedding_vector TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_patterns_type ON ai_code_patterns(pattern_type, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_patterns_usage ON ai_code_patterns(usage_count DESC);

-- ============================================
-- 4. AI ENTITY DEFINITIONS - Admin Entity Schemas
-- ============================================
CREATE TABLE IF NOT EXISTS ai_entity_definitions (
  id SERIAL PRIMARY KEY,
  entity_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  table_name VARCHAR(100) NOT NULL,
  related_tables JSONB DEFAULT '[]',
  supported_operations JSONB DEFAULT '["list", "get", "create", "update", "delete"]',
  fields JSONB NOT NULL,
  primary_key VARCHAR(50) DEFAULT 'id',
  tenant_column VARCHAR(50) DEFAULT 'store_id',
  intent_keywords JSONB DEFAULT '[]',
  example_prompts JSONB DEFAULT '[]',
  example_responses JSONB DEFAULT '[]',
  api_endpoint VARCHAR(255),
  validation_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  requires_confirmation BOOLEAN DEFAULT false,
  is_destructive BOOLEAN DEFAULT false,
  category VARCHAR(100) DEFAULT 'general',
  priority INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_entities_name ON ai_entity_definitions(entity_name);
CREATE INDEX IF NOT EXISTS idx_ai_entities_active ON ai_entity_definitions(is_active, priority DESC);

-- ============================================
-- 5. AI CHAT HISTORY - Learn from Conversations
-- ============================================
CREATE TABLE IF NOT EXISTS ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- References users but no FK constraint (cross-DB)
  store_id UUID, -- References stores but no FK constraint (cross-DB)
  session_id VARCHAR(255), -- Group messages in a conversation
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  intent VARCHAR(50), -- Detected intent
  entity VARCHAR(100), -- Entity involved (if admin_entity)
  operation VARCHAR(50), -- Operation performed
  was_successful BOOLEAN, -- Did it work?
  user_feedback VARCHAR(20), -- 'helpful', 'not_helpful', null
  feedback_text TEXT, -- Optional feedback comment
  metadata JSONB DEFAULT '{}', -- Additional context
  tokens_used INTEGER,
  model_used VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_store ON ai_chat_history(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_session ON ai_chat_history(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_chat_intent ON ai_chat_history(intent, was_successful);
CREATE INDEX IF NOT EXISTS idx_ai_chat_feedback ON ai_chat_history(user_feedback) WHERE user_feedback IS NOT NULL;

-- ============================================
-- 6. AI LEARNING INSIGHTS - Aggregated Learnings
-- ============================================
CREATE TABLE IF NOT EXISTS ai_learning_insights (
  id SERIAL PRIMARY KEY,
  insight_type VARCHAR(50) NOT NULL, -- 'successful_pattern', 'common_failure', 'intent_improvement'
  entity VARCHAR(100),
  pattern_description TEXT NOT NULL,
  example_prompts JSONB DEFAULT '[]', -- Real user prompts that worked
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  suggested_keywords JSONB DEFAULT '[]', -- AI-generated keyword suggestions
  is_applied BOOLEAN DEFAULT false, -- Has this been applied to entity definitions?
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_learning_insights(insight_type, is_applied);
CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON ai_learning_insights(entity);

-- ============================================
-- 7. AI CONTEXT USAGE - Track which context was helpful
-- ============================================
CREATE TABLE IF NOT EXISTS ai_context_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id INTEGER REFERENCES ai_context_documents(id),
  example_id INTEGER REFERENCES ai_plugin_examples(id),
  pattern_id INTEGER REFERENCES ai_code_patterns(id),
  user_id UUID, -- References users but no FK constraint (cross-DB)
  store_id UUID,
  session_id VARCHAR(255),
  query TEXT,
  was_helpful BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_context_usage_user ON ai_context_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_context_usage_store ON ai_context_usage(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_context_usage_helpful ON ai_context_usage(was_helpful);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION increment_usage_count(table_name TEXT, row_id INTEGER)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET usage_count = usage_count + 1 WHERE id = $1', table_name) USING row_id;
END;
$$ LANGUAGE plpgsql;


-- ############################################################################
-- PART 2: CREATE AI TRAINING SYSTEM
-- ############################################################################

-- AI Automatic Training System
-- Captures real prompts, validates outcomes, and auto-promotes successful patterns

-- ============================================
-- AI TRAINING CANDIDATES TABLE
-- Stores actual user prompts awaiting validation/approval
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID,
  user_id UUID,
  session_id VARCHAR(255),
  user_prompt TEXT NOT NULL,
  ai_response TEXT,
  detected_intent VARCHAR(100),
  detected_entity VARCHAR(100),
  detected_operation VARCHAR(100),
  action_taken JSONB,
  outcome_status VARCHAR(50) DEFAULT 'pending',
  outcome_details JSONB,
  was_validated BOOLEAN DEFAULT FALSE,
  validated_at TIMESTAMP,
  validated_by UUID,
  validation_method VARCHAR(50),
  training_status VARCHAR(50) DEFAULT 'candidate',
  promoted_at TIMESTAMP,
  promoted_to VARCHAR(100),
  confidence_score DECIMAL(5,4),
  similarity_score DECIMAL(5,4),
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_candidates_status ON ai_training_candidates(training_status);
CREATE INDEX IF NOT EXISTS idx_training_candidates_entity ON ai_training_candidates(detected_entity);
CREATE INDEX IF NOT EXISTS idx_training_candidates_outcome ON ai_training_candidates(outcome_status);
CREATE INDEX IF NOT EXISTS idx_training_candidates_store ON ai_training_candidates(store_id);
CREATE INDEX IF NOT EXISTS idx_training_candidates_created ON ai_training_candidates(created_at DESC);

-- ============================================
-- AI TRAINING VALIDATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES ai_training_candidates(id) ON DELETE CASCADE,
  validation_type VARCHAR(50) NOT NULL,
  validation_result VARCHAR(50) NOT NULL,
  evidence JSONB,
  notes TEXT,
  validated_by UUID,
  validation_source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_validations_candidate ON ai_training_validations(candidate_id);

-- ============================================
-- AI TRAINING RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  conditions JSONB NOT NULL,
  action VARCHAR(50) NOT NULL,
  priority INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default auto-approval rules
INSERT INTO ai_training_rules (rule_name, rule_type, conditions, action, priority) VALUES
('Auto-approve high-confidence repeated success', 'auto_approve',
 '{"min_success_count": 3, "max_failure_count": 0, "min_confidence": 0.8}',
 'approve', 100),
('Auto-approve with user positive feedback', 'auto_approve',
 '{"has_positive_feedback": true, "min_success_count": 1}',
 'approve', 90),
('Flag low confidence for review', 'require_review',
 '{"max_confidence": 0.6}',
 'flag_for_review', 50),
('Auto-reject repeated failures', 'auto_reject',
 '{"min_failure_count": 3}',
 'reject', 80),
('Auto-reject reverted actions', 'auto_reject',
 '{"outcome_status": "reverted"}',
 'reject', 85)
ON CONFLICT DO NOTHING;

-- ============================================
-- AI TRAINING METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  entity_name VARCHAR(100),
  total_prompts INTEGER DEFAULT 0,
  successful_prompts INTEGER DEFAULT 0,
  failed_prompts INTEGER DEFAULT 0,
  candidates_created INTEGER DEFAULT 0,
  candidates_approved INTEGER DEFAULT 0,
  candidates_rejected INTEGER DEFAULT 0,
  candidates_promoted INTEGER DEFAULT 0,
  avg_confidence DECIMAL(5,4),
  avg_success_rate DECIMAL(5,4),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_date, entity_name)
);

CREATE INDEX IF NOT EXISTS idx_training_metrics_date ON ai_training_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_training_metrics_entity ON ai_training_metrics(entity_name);

-- ============================================
-- TRAINING SYSTEM FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION update_training_candidate_outcome(
  p_candidate_id UUID,
  p_outcome_status VARCHAR(50),
  p_outcome_details JSONB
) RETURNS VOID AS $$
BEGIN
  UPDATE ai_training_candidates
  SET
    outcome_status = p_outcome_status,
    outcome_details = p_outcome_details,
    success_count = CASE WHEN p_outcome_status = 'success' THEN success_count + 1 ELSE success_count END,
    failure_count = CASE WHEN p_outcome_status IN ('failure', 'reverted') THEN failure_count + 1 ELSE failure_count END,
    updated_at = NOW()
  WHERE id = p_candidate_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_training_rules(p_candidate_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_candidate RECORD;
  v_rule RECORD;
  v_result VARCHAR(50) := 'no_match';
BEGIN
  SELECT * INTO v_candidate FROM ai_training_candidates WHERE id = p_candidate_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  FOR v_rule IN SELECT * FROM ai_training_rules WHERE is_active = TRUE ORDER BY priority DESC
  LOOP
    IF (v_rule.conditions->>'min_success_count')::int IS NOT NULL
       AND v_candidate.success_count < (v_rule.conditions->>'min_success_count')::int THEN CONTINUE; END IF;
    IF (v_rule.conditions->>'max_failure_count')::int IS NOT NULL
       AND v_candidate.failure_count > (v_rule.conditions->>'max_failure_count')::int THEN CONTINUE; END IF;
    IF (v_rule.conditions->>'min_confidence')::decimal IS NOT NULL
       AND v_candidate.confidence_score < (v_rule.conditions->>'min_confidence')::decimal THEN CONTINUE; END IF;
    IF v_rule.conditions->>'entity' IS NOT NULL
       AND v_candidate.detected_entity != v_rule.conditions->>'entity' THEN CONTINUE; END IF;
    IF v_rule.conditions->>'outcome_status' IS NOT NULL
       AND v_candidate.outcome_status != v_rule.conditions->>'outcome_status' THEN CONTINUE; END IF;

    v_result := v_rule.action;

    IF v_rule.action = 'approve' THEN
      UPDATE ai_training_candidates SET training_status = 'approved', was_validated = TRUE, validated_at = NOW(), validation_method = 'auto', updated_at = NOW() WHERE id = p_candidate_id;
    ELSIF v_rule.action = 'reject' THEN
      UPDATE ai_training_candidates SET training_status = 'rejected', was_validated = TRUE, validated_at = NOW(), validation_method = 'auto', updated_at = NOW() WHERE id = p_candidate_id;
    ELSIF v_rule.action = 'flag_for_review' THEN
      UPDATE ai_training_candidates SET training_status = 'review_needed', updated_at = NOW() WHERE id = p_candidate_id;
    END IF;

    INSERT INTO ai_training_validations (candidate_id, validation_type, validation_result, evidence, validation_source)
    VALUES (p_candidate_id, 'rule_check', v_result, jsonb_build_object('rule_id', v_rule.id, 'rule_name', v_rule.rule_name), 'system');

    EXIT;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION promote_training_candidate(p_candidate_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_candidate RECORD;
BEGIN
  SELECT * INTO v_candidate FROM ai_training_candidates WHERE id = p_candidate_id AND training_status = 'approved';
  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE ai_entity_definitions
  SET example_prompts = example_prompts || to_jsonb(v_candidate.user_prompt), updated_at = NOW()
  WHERE entity_name = v_candidate.detected_entity AND NOT (example_prompts ? v_candidate.user_prompt);

  UPDATE ai_training_candidates
  SET training_status = 'promoted', promoted_at = NOW(), promoted_to = v_candidate.detected_entity, updated_at = NOW()
  WHERE id = p_candidate_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ############################################################################
-- PART 3: SEED AI CONTEXT DATA
-- ############################################################################

TRUNCATE TABLE ai_code_patterns CASCADE;
TRUNCATE TABLE ai_context_documents CASCADE;
TRUNCATE TABLE ai_context_usage CASCADE;
TRUNCATE TABLE ai_entity_definitions CASCADE;
TRUNCATE TABLE ai_plugin_examples CASCADE;

-- Styling Intent Documents
INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES
('intent_guide', 'Styling Intent - Colors',
'When users want to change colors, detect the STYLING intent.

KEYWORDS: color, background, text color, font color, primary, secondary, accent, dark, light, theme

EXAMPLES:
- "change the header background to blue" -> styling intent, target: header, property: background-color
- "make the button red" -> styling intent, target: button, property: background-color
- "use darker text" -> styling intent, target: body, property: color
- "change primary color to #FF5733" -> styling intent, target: :root, property: --primary-color

CSS PROPERTIES FOR COLORS:
- background-color: Element background
- color: Text color
- border-color: Border color
- --primary-color: CSS variable for primary theme color
- --secondary-color: CSS variable for secondary theme color
- --accent-color: CSS variable for accent/highlight color

RESPONSE FORMAT:
Generate CSS that targets the specific element and property.',
'styling', '["color", "background", "theme", "css"]', 90, 'all', true),

('intent_guide', 'Styling Intent - Typography',
'When users want to change fonts, text size, or typography.

KEYWORDS: font, text, size, bigger, smaller, bold, italic, heading, paragraph, typography

EXAMPLES:
- "make the title bigger" -> styling intent, target: h1/.title, property: font-size
- "use a different font" -> styling intent, target: body, property: font-family
- "bold the product name" -> styling intent, target: .product-name, property: font-weight

CSS PROPERTIES:
- font-size: Text size (use rem or px)
- font-family: Font typeface
- font-weight: Bold/normal (400, 500, 600, 700)
- line-height: Spacing between lines
- letter-spacing: Space between letters
- text-transform: uppercase, lowercase, capitalize',
'styling', '["font", "typography", "text", "size"]', 85, 'all', true),

('intent_guide', 'Styling Intent - Spacing & Layout',
'When users want to change spacing, padding, margins, or gaps.

KEYWORDS: spacing, padding, margin, gap, space, wider, narrower, tighter, looser

EXAMPLES:
- "add more space between products" -> styling intent, target: .product-grid, property: gap
- "reduce padding on cards" -> styling intent, target: .card, property: padding
- "more margin around the header" -> styling intent, target: header, property: margin

CSS PROPERTIES:
- padding: Inner spacing (padding-top, padding-bottom, etc.)
- margin: Outer spacing (margin-top, margin-bottom, etc.)
- gap: Space between grid/flex items
- row-gap, column-gap: Specific gap directions',
'styling', '["spacing", "padding", "margin", "layout"]', 85, 'all', true),

('intent_guide', 'Layout Modification Intent',
'When users want to move, reorder, swap, or remove elements.

KEYWORDS: move, swap, reorder, position, above, below, before, after, remove, hide, show

EXAMPLES:
- "move the SKU above the price" -> layout_modify intent, action: reorder
- "swap description and specifications" -> layout_modify intent, action: swap
- "remove the reviews section" -> layout_modify intent, action: remove
- "hide the stock indicator" -> layout_modify intent, action: hide

SLOT SYSTEM:
The storefront uses a slot-based layout system. Each page section has slots that can be reordered.
- product-info-main: Main product info area (title, price, sku, stock, etc.)
- product-details: Product details area (description, specs, reviews)

To reorder: Update the slot_order in page_slot_configurations table.',
'layout', '["layout", "reorder", "move", "slots"]', 90, 'all', true),

('intent_guide', 'Admin Entity Intent',
'When users want to modify admin settings, configurations, or data.

KEYWORDS: change, update, rename, create, delete, enable, disable, add, remove, set

ENTITY TYPES:
- product_tabs: Product page tabs (Description, Specifications, Reviews)
- store_settings: Store configuration (name, currency, timezone)
- seo_settings: SEO configuration (meta tags, sitemap)
- payment_methods: Payment gateway settings
- shipping_methods: Shipping options and rates
- categories: Product categories
- attributes: Product attributes
- coupons: Discount codes
- email_templates: Notification emails
- cms_pages: Static content pages
- languages: Supported languages
- translations: UI text translations

EXAMPLES:
- "rename the Specs tab to Technical Details" -> admin_entity, entity: product_tabs
- "change store currency to EUR" -> admin_entity, entity: store_settings
- "create a 20% discount code SUMMER20" -> admin_entity, entity: coupons
- "disable PayPal" -> admin_entity, entity: payment_methods',
'admin', '["admin", "settings", "entity", "configuration"]', 95, 'all', true),

('intent_guide', 'Translation Intent',
'When users want to translate or change UI text.

KEYWORDS: translate, translation, language, text, label, change text, rename label

EXAMPLES:
- "translate Add to Cart to German" -> translation intent
- "change the checkout button text" -> translation intent
- "rename Buy Now to Purchase" -> translation intent

TRANSLATION SYSTEM:
Translations are stored per language with keys like:
- product.add_to_cart
- checkout.place_order
- common.submit',
'translations', '["translation", "language", "i18n", "text"]', 80, 'all', true),

('intent_guide', 'Plugin Development Intent',
'When users want to create or modify plugins/extensions.

KEYWORDS: plugin, extension, custom, widget, component, create plugin, add feature

EXAMPLES:
- "create a countdown timer widget" -> plugin intent
- "add a newsletter popup" -> plugin intent
- "build a product comparison feature" -> plugin intent

PLUGIN STRUCTURE:
Plugins are JavaScript/JSX files that export:
- meta: Plugin metadata (name, version, description)
- slots: Where the plugin renders
- Component: React component
- hooks: Event handlers',
'plugins', '["plugin", "extension", "widget", "development"]', 75, 'developer', true),

('architecture', 'Storefront Slot System',
'The storefront uses a slot-based architecture for flexible layouts.

SLOT AREAS:
1. Header Slots: header-top, header-main, header-bottom
2. Product Page Slots:
   - product-info-main: SKU, title, price, stock, add-to-cart
   - product-info-sidebar: Related products, recently viewed
   - product-details: Description, specifications, reviews
3. Category Page Slots: category-header, product-grid, category-sidebar
4. Footer Slots: footer-top, footer-main, footer-bottom

SLOT CONFIGURATION TABLE: page_slot_configurations
- page_type: Which page (product, category, home)
- slot_area: Which slot area
- slot_name: Specific slot name
- slot_order: Display order (lower = first)
- is_visible: Show/hide slot
- custom_css: Per-slot styling

To reorder slots: UPDATE page_slot_configurations SET slot_order = X WHERE slot_name = Y',
'core', '["slots", "layout", "architecture", "pages"]', 100, 'all', true),

('architecture', 'CSS Variables System',
'The theme uses CSS variables for consistent styling.

ROOT VARIABLES (in :root):
--primary-color: Main brand color
--secondary-color: Secondary brand color
--accent-color: Highlight/accent color
--background-color: Page background
--text-color: Main text color
--heading-color: Heading text color
--border-color: Border color
--border-radius: Corner rounding
--font-family: Main font
--font-size-base: Base text size
--spacing-unit: Base spacing (usually 8px)

COMPONENT VARIABLES:
--header-bg: Header background
--header-text: Header text color
--button-bg: Button background
--button-text: Button text
--card-bg: Card background
--card-shadow: Card shadow

To change theme: Update CSS variables in the theme settings or custom CSS.',
'core', '["css", "variables", "theme", "styling"]', 95, 'all', true),

('best_practices', 'AI Response Guidelines',
'Guidelines for generating AI responses.

1. BE SPECIFIC: Always identify the exact element/selector
2. PROVIDE CSS: Include ready-to-use CSS code when styling
3. CONFIRM ACTIONS: Summarize what was changed
4. OFFER ALTERNATIVES: Suggest related improvements
5. STAY SCOPED: Only change what was requested
6. USE VARIABLES: Prefer CSS variables over hardcoded values
7. RESPONSIVE: Consider mobile when changing layouts

RESPONSE STRUCTURE:
1. Acknowledge the request
2. Explain what will be changed
3. Provide the code/changes
4. Confirm completion
5. Suggest related improvements (optional)',
'core', '["guidelines", "responses", "best-practices"]', 80, 'all', true);


-- ############################################################################
-- PART 4: SEED SLOT GRID CONTEXT
-- ############################################################################

DELETE FROM ai_context_documents WHERE type IN ('slot_grid');

INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES
('slot_grid', 'Product Page Slot Grid',
'PRODUCT PAGE SLOT HIERARCHY (info_container children - this is what users typically modify):

info_container (parent container for product info, column 7-12):
├── Row 1: product_title        - "Product Name" text (h1)
├── Row 2: cms_block_above_price - CMS content slot
├── Row 3: price_container      - Contains prices
│   ├── product_price          - Main price (e.g., $99.00)
│   └── original_price         - Strikethrough price if on sale
├── Row 3: stock_status        - "In Stock" / "Out of Stock" component
├── Row 4: product_sku         - "SKU: ABC123" text
├── Row 5: product_short_description - Short description text
├── Row 7: options_container   - Product options
│   ├── configurable_product_selector - Size/Color dropdowns
│   └── custom_options         - Custom fields
└── Row 8: actions_container   - Buy actions
    ├── quantity_selector      - Qty input with +/-
    ├── total_price_display    - Total price
    └── buttons_container
        ├── add_to_cart_button - Main CTA button
        └── wishlist_button    - Heart icon

ROOT LEVEL SLOTS (parentId: null):
├── Row 0: cms_block_product_above - Banner above product
├── Row 1: main_layout            - Main container (12 cols)
│   ├── breadcrumbs_container     - Breadcrumb nav
│   ├── content_area              - 2-column grid
│   │   ├── product_title_mobile  - Mobile-only title
│   │   ├── product_gallery_container - Images (col 1-6)
│   │   └── info_container        - Info (col 7-12) - see above
│   ├── product_tabs              - Desc/Specs/Reviews tabs
│   └── related_products_container - Related products grid
└── Row 5: cms_block_product_below - Banner below product

TO MOVE SLOTS:
- "move sku above price" = Change product_sku row from 4 to 2 (before price_container row 3)
- "move title below price" = Change product_title row from 1 to 4 (after price_container row 3)
- Lower row number = appears ABOVE/BEFORE
- Higher row number = appears BELOW/AFTER
- Slots with same parentId can be reordered by changing position.row',
'core', '["product", "slots", "grid", "hierarchy", "layout"]', 100, 'all', true),

('slot_grid', 'Category Page Slot Grid',
'CATEGORY PAGE SLOT HIERARCHY:

ROOT STRUCTURE:
├── page_header (top section)
│   ├── breadcrumbs_content    - Category breadcrumbs
│   ├── category_title         - Category name (h1)
│   └── category_description   - Category description
│
├── filters_container (left sidebar, col 1-3)
│   ├── filters_above_cms      - CMS slot above filters
│   ├── filter_heading         - "Filters" heading
│   ├── active_filters         - Active filter badges
│   ├── layered_navigation     - Filter options component
│   └── filters_below_cms      - CMS slot below filters
│
└── products_container (main content, col 4-12)
    ├── mobile_filter_toggle   - Mobile filter button
    ├── sorting_controls       - Sort/view controls
    │   ├── product_count_info - "Showing X products"
    │   ├── sort_selector      - Sort dropdown
    │   └── view_mode_toggle   - Grid/List toggle
    ├── products_above_cms     - CMS slot
    ├── product_items          - Product grid
    │   └── product_card_template (repeated per product)
    │       ├── product_card_image
    │       └── product_card_content
    │           ├── product_card_name
    │           ├── product_card_price_container
    │           ├── product_card_stock_label
    │           └── product_card_add_to_cart
    ├── products_below_cms     - CMS slot
    └── pagination_container   - Page navigation

PRODUCT CARD TEMPLATE:
Changes to product_card_template slots affect ALL product cards.
Instance IDs: product_card_name_0, product_card_name_1, etc.',
'core', '["category", "slots", "grid", "filters", "products"]', 95, 'all', true),

('slot_grid', 'Header Slot Grid',
'HEADER SLOT HIERARCHY:

header_main (main header container):
├── Row 1: header_top_bar      - Announcement bar
│   ├── top_bar_message        - Left message text
│   └── top_bar_links          - Right links
├── Row 2: header_content      - Main header row
│   ├── store_logo             - Logo image/text
│   ├── search_bar             - Search input
│   ├── navigation_bar         - Main nav links
│   └── user_account_menu      - Account/Cart icons
│       ├── account_icon       - User icon
│       ├── cart_icon          - Shopping cart
│       └── cart_badge         - Item count badge
└── Row 3: header_bottom       - Optional bottom nav

MOBILE MENU:
├── mobile_menu_toggle         - Hamburger button
└── mobile_menu_panel          - Slide-out menu
    ├── mobile_nav_links       - Navigation
    └── mobile_account_links   - Account links',
'core', '["header", "slots", "navigation", "menu"]', 90, 'all', true),

('slot_grid', 'Cart Page Slot Grid',
'CART PAGE SLOT HIERARCHY:

cart_main (main container):
├── cart_header               - "Shopping Cart" title
├── cart_items_container      - Cart items list
│   └── cart_item_template    - Per-item template
│       ├── cart_item_image   - Product thumbnail
│       ├── cart_item_details - Name, options
│       ├── cart_item_quantity - Qty selector
│       ├── cart_item_price   - Line total
│       └── cart_item_remove  - Remove button
├── cart_summary              - Order summary
│   ├── subtotal_row          - Subtotal
│   ├── shipping_row          - Shipping estimate
│   ├── discount_row          - Coupon discount
│   ├── tax_row               - Tax amount
│   └── total_row             - Grand total
├── coupon_input              - Coupon code field
├── cart_actions              - Buttons
│   ├── continue_shopping     - Back to shop
│   └── checkout_button       - Proceed to checkout
└── cart_empty_state          - Empty cart message',
'core', '["cart", "slots", "checkout", "summary"]', 85, 'all', true),

('intent_guide', 'Layout Modify - Grid Understanding',
'UNDERSTANDING SLOT POSITIONS:

POSITION OBJECT:
Each slot has position: { col: X, row: Y }
- row: Vertical position (1 = top, higher = lower)
- col: Horizontal position in grid (1-12)

MOVING SLOTS:
- "move A above B" = Set A.row to be less than B.row
- "move A below B" = Set A.row to be greater than B.row
- "move A to left of B" = Set A.col < B.col (rarely used)

SAME CONTAINER RULE:
Slots must have same parentId to reorder.
- product_title.parentId = "info_container"
- product_sku.parentId = "info_container"
- So they CAN be reordered relative to each other

CROSS-CONTAINER MOVE:
To move slot to different container:
1. Change slot.parentId to new container
2. Set appropriate position.row in new container

COMMON PRODUCT PAGE MOVES:
- "move sku above price" = product_sku.row = 2 (before price_container row 3)
- "move title below sku" = product_title.row = 5 (after product_sku row 4)
- "move description above options" = product_short_description.row = 6',
'layout', '["move", "reorder", "position", "grid", "row", "column"]', 100, 'all', true);


-- ############################################################################
-- PART 5: SEED COMPREHENSIVE AI CONTEXT
-- ############################################################################

DELETE FROM ai_context_documents WHERE type IN ('database_schema', 'e-commerce', 'analytics', 'jobs', 'settings', 'integrations', 'plugins', 'cron', 'intent_examples');
DELETE FROM ai_entity_definitions WHERE entity_name IN ('products', 'orders', 'customers', 'attributes', 'categories', 'payment_methods', 'shipping_methods', 'coupons', 'theme_settings');

INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES

('database_schema', 'Database Architecture Overview',
'CATALYST DATABASE ARCHITECTURE:

TWO-TIER DATABASE SYSTEM:
1. MASTER DATABASE (Platform-level)
   - users (agency owners only)
   - stores (minimal registry: id, slug, status)
   - store_databases (encrypted tenant DB credentials)
   - subscriptions, credit_transactions, credit_balances
   - jobs (platform job queue)
   - ai_* tables (RAG knowledge base)

2. TENANT DATABASE (Per-store, isolated)
   - stores (FULL store data with all settings)
   - users (all types: agency, admin, staff, customers)
   - products, categories, attributes
   - orders, order_items, customers
   - inventory, pricing, taxes, shipping
   - plugins, cron_jobs
   - cms_pages, cms_blocks
   - 70+ e-commerce tables

SECURITY: Tenant DBs have ZERO knowledge of master DB.
All cross-DB communication via backend API.

QUERIES:
- Store data: ConnectionManager.getStoreConnection(storeId)
- Master data: masterDbClient (Supabase client)',
'core', '["database", "architecture", "master", "tenant", "schema"]', 100, 'all', true),

('e-commerce', 'Products Table Structure',
'PRODUCTS TABLE (products):

COLUMNS:
- id (UUID), slug, sku, barcode
- external_id, external_source (for Shopify/Akeneo imports)
- price, compare_price, cost_price (DECIMAL)
- weight, dimensions (JSON)
- images (JSON array of image objects)
- type: simple, configurable, bundle, grouped, virtual, downloadable
- status: draft, active, inactive
- visibility: visible, hidden
- manage_stock, stock_quantity, allow_backorders
- low_stock_threshold, infinite_stock
- featured (boolean)
- tags (JSON array)
- seo (JSON - meta_title, meta_description, etc.)
- store_id, attribute_set_id, parent_id
- configurable_attributes (JSON array of attribute IDs)
- category_ids (JSON array)
- related_product_ids (JSON array)
- sort_order, view_count, purchase_count
- created_at, updated_at

RELATED TABLES:
- product_translations (name, description per language)
- product_variants (for configurable products)
- product_attribute_values (attribute assignments)
- product_labels (sale badges, etc.)

QUERIES:
"best selling products" = ORDER BY purchase_count DESC
"low stock products" = WHERE stock_quantity <= low_stock_threshold
"featured products" = WHERE featured = true',
'e-commerce', '["products", "catalog", "inventory", "sku"]', 90, 'all', true),

('e-commerce', 'Orders Table Structure',
'ORDERS TABLE (sales_orders):

COLUMNS:
- id (UUID), order_number (unique string)
- status: pending, processing, shipped, delivered, cancelled, refunded
- payment_status: pending, paid, partially_paid, refunded, failed
- fulfillment_status: pending, processing, shipped, delivered, cancelled
- customer_id, customer_email, customer_phone
- billing_address (JSON), shipping_address (JSON)
- subtotal, tax_amount, shipping_amount, discount_amount, payment_fee_amount
- total_amount, currency
- delivery_date, delivery_time_slot, delivery_instructions
- payment_method, payment_reference
- shipping_method, tracking_number
- coupon_code, notes, admin_notes
- store_id
- shipped_at, delivered_at, cancelled_at
- created_at, updated_at

RELATED TABLES:
- order_items (products in order)
- shipments (tracking info)
- invoices (billing records)

ANALYTICS QUERIES:
"total revenue" = SUM(total_amount) WHERE payment_status = ''paid''
"orders today" = WHERE DATE(created_at) = CURRENT_DATE
"average order value" = AVG(total_amount)
"pending orders" = WHERE status = ''pending''',
'e-commerce', '["orders", "sales", "revenue", "fulfillment"]', 90, 'all', true),

('intent_examples', 'Query Intent Examples',
'AI INTENT EXAMPLES - DATA QUERIES:

USER: "which product sold the most"
INTENT: analytics_query
ENTITY: products
QUERY: SELECT p.*, pt.name, p.purchase_count FROM products p
       JOIN product_translations pt ON p.id = pt.product_id
       ORDER BY purchase_count DESC LIMIT 1

USER: "show me customers from Germany"
INTENT: data_query
ENTITY: customers
QUERY: SELECT * FROM customers WHERE country = ''Germany''

USER: "how many orders today"
INTENT: analytics_query
ENTITY: orders
QUERY: SELECT COUNT(*) FROM sales_orders WHERE DATE(created_at) = CURRENT_DATE

USER: "total revenue this month"
INTENT: analytics_query
ENTITY: orders
QUERY: SELECT SUM(total_amount) FROM sales_orders
       WHERE payment_status = ''paid''
       AND created_at >= DATE_TRUNC(''month'', CURRENT_DATE)

USER: "show low stock products"
INTENT: data_query
ENTITY: products
QUERY: SELECT * FROM products WHERE stock_quantity <= low_stock_threshold

USER: "find customer john@example.com"
INTENT: data_query
ENTITY: customers
QUERY: SELECT * FROM customers WHERE email = ''john@example.com''',
'intent', '["query", "analytics", "data", "search"]', 100, 'all', true),

('intent_examples', 'Action Intent Examples',
'AI INTENT EXAMPLES - ACTIONS:

USER: "disable PayPal payments"
INTENT: admin_entity_update
ENTITY: payment_methods
ACTION: UPDATE payment_methods SET is_active = false WHERE code = ''paypal''

USER: "add a new color attribute"
INTENT: admin_entity_create
ENTITY: attributes
ACTION: INSERT INTO attributes (name, code, type, is_configurable)
        VALUES (''Color'', ''color'', ''select'', true)

USER: "run akeneo import"
INTENT: job_trigger
JOB_TYPE: akeneo:import:products
ACTION: Create job in jobs table

USER: "change breadcrumb color to blue"
INTENT: settings_update
TARGET: stores.settings.theme.breadcrumb_item_text_color
ACTION: UPDATE stores SET settings = jsonb_set(settings, ''{theme,breadcrumb_item_text_color}'', ''"#0000FF"'')

USER: "hide the quantity selector"
INTENT: layout_modify
TARGET: slot visibility
ACTION: Update slot configuration to set visibility = false

USER: "create a 20% discount coupon SUMMER20"
INTENT: admin_entity_create
ENTITY: coupons
ACTION: INSERT INTO coupons (code, discount_type, discount_value)
        VALUES (''SUMMER20'', ''percentage'', 20)',
'intent', '["actions", "update", "create", "settings"]', 100, 'all', true);

-- Add entity definitions for key tables
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key,
  tenant_column, category, supported_operations, fields, intent_keywords,
  example_prompts, priority, is_active
) VALUES

('products', 'Products', 'Product catalog items', 'products', 'id',
 'store_id', 'catalog',
 '["list", "get", "create", "update", "delete", "bulk_update"]',
 '[{"name":"slug","type":"string"},{"name":"sku","type":"string"},{"name":"price","type":"decimal"},{"name":"compare_price","type":"decimal"},{"name":"cost_price","type":"decimal"},{"name":"status","type":"enum","values":["draft","active","inactive"]},{"name":"stock_quantity","type":"integer"},{"name":"featured","type":"boolean"},{"name":"weight","type":"decimal"},{"name":"category_ids","type":"json"},{"name":"tags","type":"json"},{"name":"images","type":"json"}]',
 '["product", "item", "sku", "catalog", "inventory", "stock", "price", "bulk", "batch", "mass update", "multiple products"]',
 '["show all products", "find product by sku", "update product price", "which product sold most", "add a new product", "create product with SKU ABC123", "delete product SKU-001", "remove product from catalog", "set price to 29.99 for SKU ABC", "change price of product X to 50", "update stock quantity to 100", "set stock to 50 for SKU-123", "mark product as featured", "unfeature product", "activate product", "deactivate product", "set product status to draft", "bulk update prices by 10%", "increase all prices by 5%", "decrease prices in category Electronics", "bulk change attribute Color to Red for all products", "set attribute Size to Large for SKU ABC", "update attribute Material to Cotton for product X", "assign category to product", "move product to category", "add tag Sale to all featured products", "bulk update stock for low inventory items", "set all out of stock products to inactive", "change SKU from OLD to NEW", "rename SKU", "update product images", "set compare price for sale items", "bulk assign attributes to products in category"]',
 100, true),

('orders', 'Orders', 'Sales orders', 'sales_orders', 'id',
 'store_id', 'sales',
 '["list", "get", "update", "cancel", "refund"]',
 '[{"name":"order_number","type":"string"},{"name":"status","type":"enum","values":["pending","processing","shipped","delivered","cancelled","refunded"]},{"name":"payment_status","type":"enum","values":["pending","paid","partially_paid","refunded","failed"]},{"name":"fulfillment_status","type":"enum"},{"name":"total_amount","type":"decimal"},{"name":"customer_email","type":"string"},{"name":"tracking_number","type":"string"},{"name":"shipping_method","type":"string"}]',
 '["order", "sale", "purchase", "transaction", "revenue", "fulfillment", "shipment", "tracking"]',
 '["show recent orders", "orders today", "pending orders", "total revenue", "find order by number", "show order ORD-12345", "update order status to shipped", "mark order as delivered", "cancel order", "refund order", "add tracking number to order", "orders from customer john@email.com", "orders this week", "orders this month", "average order value", "highest value orders", "orders pending payment", "orders ready to ship", "bulk update order status", "export orders to CSV"]',
 95, true),

('customers', 'Customers', 'Customer accounts', 'customers', 'id',
 'store_id', 'crm',
 '["list", "get", "create", "update", "delete"]',
 '[{"name":"email","type":"string"},{"name":"first_name","type":"string"},{"name":"last_name","type":"string"},{"name":"phone","type":"string"},{"name":"total_spent","type":"decimal"},{"name":"total_orders","type":"integer"},{"name":"status","type":"enum","values":["active","inactive","blocked"]},{"name":"accepts_marketing","type":"boolean"},{"name":"tags","type":"json"}]',
 '["customer", "client", "buyer", "account", "user", "contact", "subscriber"]',
 '["find customer", "top customers", "customer details", "customer orders", "find customer by email", "search customer john", "create new customer", "add customer", "update customer email", "change customer phone", "block customer", "unblock customer", "delete customer account", "customers who spent over 100", "VIP customers", "new customers this month", "inactive customers", "customers with no orders", "tag customer as VIP", "add tag to customer", "export customers", "customers who accept marketing"]',
 90, true),

('attributes', 'Attributes', 'Product attributes', 'attributes', 'id',
 'store_id', 'catalog',
 '["list", "get", "create", "update", "delete", "bulk_update"]',
 '[{"name":"name","type":"string"},{"name":"code","type":"string"},{"name":"type","type":"enum","values":["text","number","select","multiselect","boolean","date"]},{"name":"is_filterable","type":"boolean"},{"name":"is_configurable","type":"boolean"},{"name":"is_required","type":"boolean"},{"name":"is_visible","type":"boolean"},{"name":"sort_order","type":"integer"}]',
 '["attribute", "property", "filter", "option", "variant", "specification", "characteristic", "bulk attribute", "mass attribute"]',
 '["add attribute", "create color attribute", "make filterable", "list attributes", "create Size attribute with options S M L XL", "add attribute Brand", "delete attribute", "remove attribute from products", "rename attribute Material to Fabric", "add options to attribute", "add Red Blue Green to Color attribute", "make attribute required", "set attribute as configurable", "hide attribute from product page", "show attribute in filters", "bulk update attribute values", "change all Color values from Red to Crimson", "set attribute value for multiple products", "assign attribute to attribute set", "reorder attributes", "set attribute sort order"]',
 85, true),

('categories', 'Categories', 'Product categories', 'categories', 'id',
 'store_id', 'catalog',
 '["list", "get", "create", "update", "delete", "bulk_update", "reorder"]',
 '[{"name":"name","type":"string"},{"name":"slug","type":"string"},{"name":"description","type":"text"},{"name":"parent_id","type":"uuid"},{"name":"image_url","type":"string"},{"name":"is_active","type":"boolean"},{"name":"show_in_menu","type":"boolean"},{"name":"sort_order","type":"integer"},{"name":"seo","type":"json"}]',
 '["category", "collection", "department", "group", "root category", "main category", "top level category", "menu", "navigation", "catalog structure"]',
 '["show categories", "create category", "add subcategory", "hide category", "create a root category called Test Category", "add a top level category named New Arrivals", "create a main category for seasonal items", "rename category Electronics to Tech", "delete category", "remove empty category", "move category under parent", "change category parent", "reorder categories", "set category sort order", "hide category from menu", "show category in navigation", "add category image", "update category description", "set category SEO title", "bulk update category status", "activate all categories", "deactivate category and subcategories", "list root categories", "show category tree", "count products in category", "merge categories", "assign products to category", "remove products from category"]',
 85, true),

('payment_methods', 'Payment Methods', 'Payment method settings', 'payment_methods', 'id',
 'store_id', 'settings',
 '["list", "get", "create", "update", "delete"]',
 '[{"name":"name","type":"string"},{"name":"code","type":"string"},{"name":"provider","type":"enum","values":["stripe","paypal","manual","cod","bank_transfer"]},{"name":"is_active","type":"boolean"},{"name":"is_default","type":"boolean"},{"name":"min_order_amount","type":"decimal"},{"name":"max_order_amount","type":"decimal"},{"name":"sort_order","type":"integer"}]',
 '["payment", "pay", "stripe", "paypal", "checkout", "credit card", "bank transfer", "cash on delivery", "COD"]',
 '["enable PayPal", "disable payment method", "show payment methods", "add Stripe payment", "enable credit card payments", "disable cash on delivery", "set minimum order for PayPal to 50", "set maximum order amount", "make Stripe the default payment", "reorder payment methods", "configure payment gateway", "update payment settings", "list active payment methods", "enable bank transfer"]',
 80, true),

('shipping_methods', 'Shipping Methods', 'Shipping method settings', 'shipping_methods', 'id',
 'store_id', 'settings',
 '["list", "get", "create", "update", "delete"]',
 '[{"name":"name","type":"string"},{"name":"code","type":"string"},{"name":"type","type":"enum","values":["flat_rate","free_shipping","weight_based","price_based"]},{"name":"price","type":"decimal"},{"name":"free_shipping_threshold","type":"decimal"},{"name":"is_active","type":"boolean"},{"name":"estimated_days_min","type":"integer"},{"name":"estimated_days_max","type":"integer"}]',
 '["shipping", "delivery", "freight", "carrier", "express", "standard", "free shipping", "shipping rate"]',
 '["set shipping price", "enable free shipping", "show shipping methods", "add express shipping", "create standard shipping method", "set free shipping for orders over 100", "change shipping rate to 9.99", "disable international shipping", "set delivery time to 3-5 days", "add flat rate shipping", "enable weight based shipping", "update shipping zones", "set minimum order for free shipping", "bulk update shipping rates"]',
 80, true),

('coupons', 'Coupons', 'Discount coupons', 'coupons', 'id',
 'store_id', 'marketing',
 '["list", "get", "create", "update", "delete"]',
 '[{"name":"code","type":"string"},{"name":"discount_type","type":"enum","values":["percentage","fixed_amount","free_shipping"]},{"name":"discount_value","type":"decimal"},{"name":"min_order_amount","type":"decimal"},{"name":"max_uses","type":"integer"},{"name":"uses_per_customer","type":"integer"},{"name":"valid_from","type":"date"},{"name":"valid_until","type":"date"},{"name":"is_active","type":"boolean"}]',
 '["coupon", "discount", "promo", "voucher", "code", "sale", "offer", "promotion"]',
 '["create coupon", "20% discount", "free shipping coupon", "disable coupon", "create coupon SUMMER20 for 20% off", "add 10 dollar discount code", "create free shipping coupon for orders over 50", "set coupon expiry date", "limit coupon to 100 uses", "one use per customer coupon", "extend coupon validity", "deactivate expired coupons", "bulk create coupons", "delete coupon OLDCODE", "update coupon discount value", "set minimum order for coupon", "list active coupons", "show expired coupons"]',
 80, true),

('theme_settings', 'Theme Settings', 'Store theme and appearance settings', 'stores', 'id',
 NULL, 'design',
 '["get", "update"]',
 '[{"name":"primary_color","type":"color"},{"name":"secondary_color","type":"color"},{"name":"accent_color","type":"color"},{"name":"text_color","type":"color"},{"name":"background_color","type":"color"},{"name":"font_family","type":"string"},{"name":"breadcrumb_item_text_color","type":"color"},{"name":"breadcrumb_show_home_icon","type":"boolean"},{"name":"header_bg_color","type":"color"},{"name":"add_to_cart_button_color","type":"color"}]',
 '["theme", "color", "font", "breadcrumb", "style", "appearance", "design", "branding", "look and feel"]',
 '["change breadcrumb color", "set primary color", "change font", "hide breadcrumb icon", "set primary color to blue", "change background color to white", "update header color", "set add to cart button color to green", "change font to Roboto", "update accent color", "set text color to dark gray", "change secondary color", "update brand colors", "set link color", "change button hover color"]',
 90, true);

-- Update existing entries
UPDATE ai_context_documents SET is_active = true WHERE type IN ('database_schema', 'e-commerce', 'analytics', 'jobs', 'settings', 'integrations', 'plugins', 'cron', 'intent_examples');
UPDATE ai_entity_definitions SET is_active = true WHERE entity_name IN ('products', 'orders', 'customers', 'attributes', 'categories', 'payment_methods', 'shipping_methods', 'coupons', 'theme_settings');

-- AI Training System Documentation
INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES
('system', 'AI Automatic Training System',
'AI AUTOMATIC TRAINING SYSTEM:

The system automatically captures real user prompts and validates them for training data.

FLOW:
1. User sends prompt to AI chat
2. AI processes and executes action
3. System captures prompt as training candidate
4. Outcome is tracked (success/failure/reverted)
5. Auto-validation rules check the candidate
6. Approved candidates are promoted to entity definitions

TABLES:
- ai_training_candidates: Stores captured prompts awaiting validation
- ai_training_validations: Tracks validation attempts
- ai_training_rules: Configurable auto-approval rules
- ai_training_metrics: Aggregate metrics

AUTO-APPROVAL RULES:
- 3+ successes with 0 failures -> Auto-approve
- Positive user feedback + 1 success -> Auto-approve
- Confidence < 0.6 -> Flag for manual review
- 3+ failures -> Auto-reject
- Action reverted -> Auto-reject

API ENDPOINTS:
- GET /api/ai/training/candidates - List candidates for review
- GET /api/ai/training/metrics - Get training statistics
- POST /api/ai/training/candidates/:id/approve - Manual approve
- POST /api/ai/training/candidates/:id/reject - Manual reject
- POST /api/ai/training/promote - Promote approved to training data
- POST /api/ai/training/candidates/:id/feedback - Record user feedback

PROMOTION PROCESS:
When a candidate is approved (auto or manual), it can be promoted to
add its prompt to the entity_definitions.example_prompts array.
This improves future intent detection for similar requests.',
'system', '["training", "learning", "auto-training", "validation"]', 85, 'all', true)
ON CONFLICT DO NOTHING;


-- ############################################################################
-- MIGRATION COMPLETE
-- ############################################################################
-- All AI tables, functions, and seed data have been created/inserted.
-- You can now use the AI chat and training system.
