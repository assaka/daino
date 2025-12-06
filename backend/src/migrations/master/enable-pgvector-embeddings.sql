-- ============================================
-- ENABLE PGVECTOR AND ADD EMBEDDING COLUMNS
-- ============================================
-- Run this migration in Supabase SQL Editor
--
-- Prerequisites:
-- 1. Enable pgvector extension first (see below)
-- 2. Run this migration
-- 3. Then run create-vector-search-functions.sql
-- ============================================

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Drop existing TEXT embedding columns (they're empty anyway)
ALTER TABLE ai_context_documents DROP COLUMN IF EXISTS embedding_vector;
ALTER TABLE ai_plugin_examples DROP COLUMN IF EXISTS embedding_vector;
ALTER TABLE ai_entity_definitions DROP COLUMN IF EXISTS embedding_vector;
ALTER TABLE ai_training_candidates DROP COLUMN IF EXISTS embedding_vector;

-- Step 3: Add proper vector columns (1536 dimensions for text-embedding-3-small)
ALTER TABLE ai_context_documents ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE ai_plugin_examples ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE ai_entity_definitions ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE ai_training_candidates ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 4: Add embedding timestamp columns
ALTER TABLE ai_context_documents ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;
ALTER TABLE ai_plugin_examples ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;
ALTER TABLE ai_entity_definitions ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;
ALTER TABLE ai_training_candidates ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ;

-- Step 5: Create indexes (run AFTER backfill is complete for better performance)
-- Note: IVFFlat indexes work best with data already in the table
-- Uncomment and run after backfill:

-- CREATE INDEX IF NOT EXISTS idx_ai_docs_embedding
--   ON ai_context_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- CREATE INDEX IF NOT EXISTS idx_ai_examples_embedding
--   ON ai_plugin_examples USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- CREATE INDEX IF NOT EXISTS idx_ai_entities_embedding
--   ON ai_entity_definitions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- CREATE INDEX IF NOT EXISTS idx_ai_training_embedding
--   ON ai_training_candidates USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify the migration worked:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'ai_context_documents'
-- AND column_name IN ('embedding', 'embedding_updated_at');
