-- ============================================
-- AI TABLES CONSOLIDATION MIGRATION
-- ============================================
-- Purpose: Clean up obsolete AI tables and consolidate into ai_training_candidates
--
-- Tables being DROPPED:
--   - ai_learning_insights (never implemented)
--   - ai_training_metrics (never implemented)
--   - ai_context_usage (merged into ai_training_candidates)
--   - ai_code_patterns (empty, overlaps with training system)
--   - ai_user_preferences (should only exist in tenant DB)
--
-- Tables being MODIFIED:
--   - ai_training_candidates (adding context tracking columns)
--
-- SAFE TO RE-RUN: Uses IF EXISTS for drops, IF NOT EXISTS for adds
-- ============================================

-- ============================================
-- STEP 1: Add context tracking columns to ai_training_candidates
-- (Merging ai_context_usage functionality)
-- ============================================

-- Context references (which docs/examples were used)
ALTER TABLE ai_training_candidates
ADD COLUMN IF NOT EXISTS context_document_ids JSONB DEFAULT '[]';

ALTER TABLE ai_training_candidates
ADD COLUMN IF NOT EXISTS context_example_ids JSONB DEFAULT '[]';

ALTER TABLE ai_training_candidates
ADD COLUMN IF NOT EXISTS context_pattern_ids JSONB DEFAULT '[]';

-- User feedback (was the response helpful?)
ALTER TABLE ai_training_candidates
ADD COLUMN IF NOT EXISTS was_helpful BOOLEAN;

ALTER TABLE ai_training_candidates
ADD COLUMN IF NOT EXISTS feedback_text TEXT;

ALTER TABLE ai_training_candidates
ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMP;

-- Add index for feedback queries
CREATE INDEX IF NOT EXISTS idx_training_candidates_helpful
ON ai_training_candidates(was_helpful) WHERE was_helpful IS NOT NULL;

-- ============================================
-- STEP 2: Migrate data from ai_context_usage (if any exists)
-- ============================================

-- Note: This creates training candidates from context usage records
-- Only run if ai_context_usage exists and has data
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ai_context_usage') THEN
    INSERT INTO ai_training_candidates (
      store_id,
      user_id,
      session_id,
      user_prompt,
      context_document_ids,
      context_example_ids,
      context_pattern_ids,
      was_helpful,
      training_status,
      outcome_status,
      created_at
    )
    SELECT
      store_id,
      user_id,
      session_id,
      query as user_prompt,
      CASE WHEN document_id IS NOT NULL THEN jsonb_build_array(document_id) ELSE '[]'::jsonb END,
      CASE WHEN example_id IS NOT NULL THEN jsonb_build_array(example_id) ELSE '[]'::jsonb END,
      CASE WHEN pattern_id IS NOT NULL THEN jsonb_build_array(pattern_id) ELSE '[]'::jsonb END,
      was_helpful,
      'candidate',
      CASE WHEN was_helpful = true THEN 'success' ELSE 'pending' END,
      created_at
    FROM ai_context_usage
    WHERE query IS NOT NULL AND query != ''
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Migrated data from ai_context_usage to ai_training_candidates';
  END IF;
END $$;

-- ============================================
-- STEP 3: Drop obsolete tables
-- ============================================

-- Drop ai_learning_insights (never implemented)
DROP TABLE IF EXISTS ai_learning_insights CASCADE;

-- Drop ai_training_metrics (never implemented)
DROP TABLE IF EXISTS ai_training_metrics CASCADE;

-- Drop ai_context_usage (merged into ai_training_candidates)
DROP TABLE IF EXISTS ai_context_usage CASCADE;

-- Drop ai_code_patterns (empty, overlaps with training system)
DROP TABLE IF EXISTS ai_code_patterns CASCADE;

-- Drop ai_user_preferences from master (should only be in tenant DB)
DROP TABLE IF EXISTS ai_user_preferences CASCADE;

-- Drop ai_chat_history - chat history belongs in tenant DB (ai_chat_sessions)
-- Learning/training data goes to ai_training_candidates instead
DROP TABLE IF EXISTS ai_chat_history CASCADE;

-- ============================================
-- STEP 4: Clean up orphaned functions
-- ============================================

-- Drop function that referenced ai_code_patterns
DROP FUNCTION IF EXISTS increment_usage_count(TEXT, INTEGER);

-- ============================================
-- STEP 5: Update comments
-- ============================================

COMMENT ON TABLE ai_training_candidates IS
'Consolidated AI training table - captures prompts, context used, outcomes, and user feedback.
Replaces: ai_context_usage, ai_code_patterns, ai_learning_insights';

COMMENT ON COLUMN ai_training_candidates.context_document_ids IS
'Array of ai_context_documents IDs that were used for this prompt';

COMMENT ON COLUMN ai_training_candidates.context_example_ids IS
'Array of ai_plugin_examples IDs that were used for this prompt';

COMMENT ON COLUMN ai_training_candidates.was_helpful IS
'User feedback: was the AI response helpful? (merged from ai_context_usage)';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the migration:
-- SELECT
--   (SELECT COUNT(*) FROM ai_training_candidates) as training_candidates,
--   (SELECT COUNT(*) FROM ai_context_documents) as context_documents,
--   (SELECT COUNT(*) FROM ai_plugin_examples) as plugin_examples,
--   (SELECT COUNT(*) FROM ai_entity_definitions) as entity_definitions,
--   (SELECT COUNT(*) FROM ai_training_validations) as training_validations,
--   (SELECT COUNT(*) FROM ai_training_rules) as training_rules;
