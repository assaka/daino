-- ============================================
-- VECTOR SEARCH FUNCTIONS FOR RAG
-- ============================================
-- Run this AFTER enable-pgvector-embeddings.sql
-- These functions enable semantic similarity search
-- ============================================

-- ============================================
-- 1. SEARCH AI CONTEXT DOCUMENTS
-- ============================================
CREATE OR REPLACE FUNCTION search_ai_documents_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_mode text DEFAULT NULL,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id int,
  type varchar,
  title varchar,
  content text,
  category varchar,
  tags jsonb,
  priority int,
  mode varchar,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.type,
    d.title,
    d.content,
    d.category,
    d.tags,
    d.priority,
    d.mode,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM ai_context_documents d
  WHERE d.is_active = true
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
    AND (filter_mode IS NULL OR d.mode = filter_mode OR d.mode = 'all')
    AND (filter_category IS NULL OR d.category = filter_category OR d.category = 'core')
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. SEARCH AI PLUGIN EXAMPLES
-- ============================================
CREATE OR REPLACE FUNCTION search_ai_examples_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id int,
  name varchar,
  slug varchar,
  description text,
  category varchar,
  complexity varchar,
  code text,
  features jsonb,
  use_cases jsonb,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.slug,
    e.description,
    e.category,
    e.complexity,
    e.code,
    e.features,
    e.use_cases,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM ai_plugin_examples e
  WHERE e.is_active = true
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR e.category = filter_category)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. SEARCH AI ENTITY DEFINITIONS
-- ============================================
CREATE OR REPLACE FUNCTION search_ai_entities_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id int,
  entity_name varchar,
  display_name varchar,
  description text,
  table_name varchar,
  supported_operations jsonb,
  fields jsonb,
  intent_keywords jsonb,
  example_prompts jsonb,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_name,
    e.display_name,
    e.description,
    e.table_name,
    e.supported_operations,
    e.fields,
    e.intent_keywords,
    e.example_prompts,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM ai_entity_definitions e
  WHERE e.is_active = true
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. SEARCH TRAINING CANDIDATES (Approved/Promoted)
-- ============================================
CREATE OR REPLACE FUNCTION search_training_patterns_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_entity text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_prompt text,
  ai_response text,
  detected_entity varchar,
  detected_operation varchar,
  success_count int,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.user_prompt,
    t.ai_response,
    t.detected_entity,
    t.detected_operation,
    t.success_count,
    1 - (t.embedding <=> query_embedding) as similarity
  FROM ai_training_candidates t
  WHERE t.training_status IN ('approved', 'promoted')
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
    AND (filter_entity IS NULL OR t.detected_entity = filter_entity)
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. FIND SIMILAR TRAINING CANDIDATES
-- ============================================
-- Used to check for duplicates before capturing new training data
CREATE OR REPLACE FUNCTION find_similar_training_candidates(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.95,
  max_results int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  user_prompt text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.user_prompt,
    1 - (t.embedding <=> query_embedding) as similarity
  FROM ai_training_candidates t
  WHERE t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > similarity_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. COMBINED RAG SEARCH
-- ============================================
-- Search across all AI tables for the most relevant context
CREATE OR REPLACE FUNCTION search_all_ai_context(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  docs_limit int DEFAULT 3,
  examples_limit int DEFAULT 2,
  patterns_limit int DEFAULT 3
)
RETURNS TABLE (
  source_type text,
  source_id text,
  title text,
  content text,
  similarity float
) AS $$
BEGIN
  -- Documents
  RETURN QUERY
  SELECT
    'document'::text as source_type,
    d.id::text as source_id,
    d.title::text as title,
    d.content::text as content,
    1 - (d.embedding <=> query_embedding) as similarity
  FROM ai_context_documents d
  WHERE d.is_active = true
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT docs_limit;

  -- Examples
  RETURN QUERY
  SELECT
    'example'::text as source_type,
    e.id::text as source_id,
    e.name::text as title,
    e.description::text as content,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM ai_plugin_examples e
  WHERE e.is_active = true
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT examples_limit;

  -- Training patterns
  RETURN QUERY
  SELECT
    'pattern'::text as source_type,
    t.id::text as source_id,
    (t.detected_entity || ' - ' || t.detected_operation)::text as title,
    t.user_prompt::text as content,
    1 - (t.embedding <=> query_embedding) as similarity
  FROM ai_training_candidates t
  WHERE t.training_status IN ('approved', 'promoted')
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT patterns_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION search_ai_documents_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION search_ai_examples_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION search_ai_entities_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION search_training_patterns_by_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_training_candidates TO authenticated;
GRANT EXECUTE ON FUNCTION search_all_ai_context TO authenticated;

-- Also grant to service_role for backend usage
GRANT EXECUTE ON FUNCTION search_ai_documents_by_embedding TO service_role;
GRANT EXECUTE ON FUNCTION search_ai_examples_by_embedding TO service_role;
GRANT EXECUTE ON FUNCTION search_ai_entities_by_embedding TO service_role;
GRANT EXECUTE ON FUNCTION search_training_patterns_by_embedding TO service_role;
GRANT EXECUTE ON FUNCTION find_similar_training_candidates TO service_role;
GRANT EXECUTE ON FUNCTION search_all_ai_context TO service_role;
