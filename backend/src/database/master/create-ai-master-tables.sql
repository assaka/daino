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
-- TABLES STORED IN TENANT DB (not master)
-- ============================================
-- ai_user_preferences - stays in tenant DBs (user prefs are tenant-specific)
-- ai_usage_logs - stays in tenant DBs (usage tracking is per-store)
-- See: backend/src/database/schemas/tenant/001-create-tenant-tables.sql

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- Enable RLS on tables that need it
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- Chat history: users can only see their own chats
CREATE POLICY "Users can view own chat history" ON ai_chat_history
  FOR SELECT USING (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can insert own chat history" ON ai_chat_history
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text OR user_id IS NULL);

-- Global AI context tables are read-only for users, admin can modify
ALTER TABLE ai_context_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active documents" ON ai_context_documents
  FOR SELECT USING (is_active = true);

ALTER TABLE ai_plugin_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active examples" ON ai_plugin_examples
  FOR SELECT USING (is_active = true);

ALTER TABLE ai_code_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active patterns" ON ai_code_patterns
  FOR SELECT USING (is_active = true);

ALTER TABLE ai_entity_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active entities" ON ai_entity_definitions
  FOR SELECT USING (is_active = true);

-- Context usage tracking: users can see their own usage
ALTER TABLE ai_context_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own context usage" ON ai_context_usage
  FOR SELECT USING (auth.uid()::text = user_id::text OR user_id IS NULL);
CREATE POLICY "Users can insert context usage" ON ai_context_usage
  FOR INSERT WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
-- Function to increment usage counts
CREATE OR REPLACE FUNCTION increment_usage_count(table_name TEXT, row_id INTEGER)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET usage_count = usage_count + 1 WHERE id = $1', table_name) USING row_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE ai_context_documents IS 'Global AI knowledge base - documentation, tutorials, best practices';
COMMENT ON TABLE ai_plugin_examples IS 'Working plugin code examples for AI to reference';
COMMENT ON TABLE ai_code_patterns IS 'Reusable code snippets and successful prompt patterns';
COMMENT ON TABLE ai_entity_definitions IS 'Admin entity schemas for dynamic AI operations';
COMMENT ON TABLE ai_chat_history IS 'All AI conversations for learning and improvement';
COMMENT ON TABLE ai_learning_insights IS 'Aggregated learnings from successful/failed interactions';
COMMENT ON TABLE ai_context_usage IS 'Tracks which AI context was helpful for learning';
-- Note: ai_user_preferences and ai_usage_logs are in TENANT DBs, not master
