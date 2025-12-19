-- AI Context System Tables for RAG
-- PostgreSQL / Supabase

-- 1. AI Context Documents
CREATE TABLE IF NOT EXISTS ai_context_documents (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),
  tags JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  priority INTEGER DEFAULT 0,
  mode VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  store_id INTEGER,
  embedding_vector TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_context_docs_type_active ON ai_context_documents(type, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_context_docs_category ON ai_context_documents(category);
CREATE INDEX IF NOT EXISTS idx_ai_context_docs_mode ON ai_context_documents(mode);
CREATE INDEX IF NOT EXISTS idx_ai_context_docs_store ON ai_context_documents(store_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_docs_priority ON ai_context_documents(priority);

-- 2. AI Plugin Examples
CREATE TABLE IF NOT EXISTS ai_plugin_examples (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  complexity VARCHAR(20) DEFAULT 'simple',
  code TEXT NOT NULL,
  files JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  use_cases JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  usage_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2),
  is_template BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  embedding_vector TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_plugin_examples_category ON ai_plugin_examples(category, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_plugin_examples_complexity ON ai_plugin_examples(complexity);
CREATE INDEX IF NOT EXISTS idx_ai_plugin_examples_template ON ai_plugin_examples(is_template);
CREATE INDEX IF NOT EXISTS idx_ai_plugin_examples_usage ON ai_plugin_examples(usage_count);

-- 3. AI Code Patterns
CREATE TABLE IF NOT EXISTS ai_code_patterns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  pattern_type VARCHAR(100) NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  language VARCHAR(50) DEFAULT 'javascript',
  framework VARCHAR(100),
  parameters JSONB DEFAULT '[]'::jsonb,
  example_usage TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  embedding_vector TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_code_patterns_type ON ai_code_patterns(pattern_type, is_active);
CREATE INDEX IF NOT EXISTS idx_ai_code_patterns_framework ON ai_code_patterns(framework);

-- 4. AI User Preferences
CREATE TABLE IF NOT EXISTS ai_user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  session_id VARCHAR(255),
  store_id INTEGER,
  preferred_mode VARCHAR(50),
  coding_style JSONB DEFAULT '{}'::jsonb,
  favorite_patterns JSONB DEFAULT '[]'::jsonb,
  recent_plugins JSONB DEFAULT '[]'::jsonb,
  categories_interest JSONB DEFAULT '[]'::jsonb,
  context_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_user_prefs_user ON ai_user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_prefs_session ON ai_user_preferences(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_user_prefs_store ON ai_user_preferences(store_id);

-- 5. AI Context Usage
CREATE TABLE IF NOT EXISTS ai_context_usage (
  id SERIAL PRIMARY KEY,
  document_id INTEGER,
  example_id INTEGER,
  pattern_id INTEGER,
  user_id INTEGER,
  session_id VARCHAR(255),
  query TEXT,
  was_helpful BOOLEAN,
  generated_plugin_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_context_usage_document ON ai_context_usage(document_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_usage_example ON ai_context_usage(example_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_usage_pattern ON ai_context_usage(pattern_id);
CREATE INDEX IF NOT EXISTS idx_ai_context_usage_created ON ai_context_usage(created_at);
