-- AI Unresolved Questions Table
-- Logs questions/requests that the AI couldn't resolve for training purposes
-- SAFE TO RE-RUN: Uses IF NOT EXISTS

-- ============================================
-- AI UNRESOLVED QUESTIONS TABLE
-- Captures failed AI interactions for training improvement
-- ============================================
CREATE TABLE IF NOT EXISTS ai_unresolved_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source context
  store_id UUID,
  user_id UUID,
  session_id VARCHAR(255),

  -- The question/request
  user_message TEXT NOT NULL,
  conversation_context JSONB DEFAULT '[]', -- Last few messages for context

  -- Failure classification
  failure_type VARCHAR(100) NOT NULL,
  -- Types:
  --   'knowledge_gap' - No docs found in knowledge base
  --   'unknown_tool' - AI tried to use unknown tool
  --   'tool_error' - Tool execution failed
  --   'entity_not_supported' - Entity type not implemented
  --   'missing_context' - Required context (store_id, etc.) missing
  --   'api_error' - Anthropic API or other external error
  --   'unknown_intent' - AI couldn't determine what user wanted
  --   'partial_response' - AI responded but couldn't fully help
  --   'other' - Uncategorized failures

  failure_subtype VARCHAR(100), -- More specific categorization

  -- Failure details
  error_message TEXT,
  tool_name VARCHAR(100), -- If tool-related
  tool_input JSONB, -- If tool-related
  ai_response TEXT, -- What the AI responded (if anything)

  -- For training
  suggested_solution TEXT, -- Admin can add how this should be handled
  required_tool VARCHAR(100), -- What tool would be needed
  required_knowledge JSONB, -- What knowledge base entries are needed
  training_notes TEXT, -- Notes for creating training data

  -- Resolution tracking
  resolution_status VARCHAR(50) DEFAULT 'unresolved',
  -- Statuses: 'unresolved', 'in_progress', 'resolved', 'wont_fix', 'duplicate'
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_details TEXT,

  -- Priority for training
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  occurrence_count INTEGER DEFAULT 1, -- How many times similar question asked

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_unresolved_failure_type ON ai_unresolved_questions(failure_type);
CREATE INDEX IF NOT EXISTS idx_unresolved_status ON ai_unresolved_questions(resolution_status);
CREATE INDEX IF NOT EXISTS idx_unresolved_priority ON ai_unresolved_questions(priority);
CREATE INDEX IF NOT EXISTS idx_unresolved_store ON ai_unresolved_questions(store_id);
CREATE INDEX IF NOT EXISTS idx_unresolved_created ON ai_unresolved_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unresolved_tool ON ai_unresolved_questions(tool_name) WHERE tool_name IS NOT NULL;

-- Full text search on user messages for finding similar questions
CREATE INDEX IF NOT EXISTS idx_unresolved_message_search ON ai_unresolved_questions USING gin(to_tsvector('english', user_message));

-- ============================================
-- VIEW: Unresolved questions summary by type
-- ============================================
CREATE OR REPLACE VIEW ai_unresolved_summary AS
SELECT
  failure_type,
  failure_subtype,
  tool_name,
  COUNT(*) as count,
  SUM(occurrence_count) as total_occurrences,
  MAX(created_at) as last_occurrence,
  COUNT(*) FILTER (WHERE resolution_status = 'unresolved') as still_unresolved
FROM ai_unresolved_questions
GROUP BY failure_type, failure_subtype, tool_name
ORDER BY count DESC;

-- ============================================
-- FUNCTION: Log unresolved question with deduplication
-- ============================================
CREATE OR REPLACE FUNCTION log_unresolved_question(
  p_store_id UUID,
  p_user_id UUID,
  p_session_id VARCHAR(255),
  p_user_message TEXT,
  p_failure_type VARCHAR(100),
  p_failure_subtype VARCHAR(100) DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_tool_name VARCHAR(100) DEFAULT NULL,
  p_tool_input JSONB DEFAULT NULL,
  p_ai_response TEXT DEFAULT NULL,
  p_conversation_context JSONB DEFAULT '[]',
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_existing_id UUID;
  v_new_id UUID;
  v_similarity_threshold FLOAT := 0.8;
BEGIN
  -- Check for similar existing question (simple text similarity)
  -- Uses trigram similarity if available, otherwise exact match
  SELECT id INTO v_existing_id
  FROM ai_unresolved_questions
  WHERE failure_type = p_failure_type
    AND resolution_status = 'unresolved'
    AND (
      user_message = p_user_message
      OR (p_tool_name IS NOT NULL AND tool_name = p_tool_name AND p_error_message IS NOT NULL AND error_message = p_error_message)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Increment occurrence count for existing similar question
    UPDATE ai_unresolved_questions
    SET
      occurrence_count = occurrence_count + 1,
      updated_at = NOW(),
      metadata = metadata || jsonb_build_object(
        'last_occurrence', NOW(),
        'last_store_id', p_store_id::text,
        'last_user_id', p_user_id::text
      )
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  ELSE
    -- Insert new unresolved question
    INSERT INTO ai_unresolved_questions (
      store_id, user_id, session_id, user_message,
      failure_type, failure_subtype, error_message,
      tool_name, tool_input, ai_response,
      conversation_context, metadata
    ) VALUES (
      p_store_id, p_user_id, p_session_id, p_user_message,
      p_failure_type, p_failure_subtype, p_error_message,
      p_tool_name, p_tool_input, p_ai_response,
      p_conversation_context, p_metadata
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Get training priorities
-- Returns most common unresolved issues for prioritization
-- ============================================
CREATE OR REPLACE FUNCTION get_training_priorities(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  failure_type VARCHAR(100),
  failure_subtype VARCHAR(100),
  tool_name VARCHAR(100),
  total_count BIGINT,
  total_occurrences BIGINT,
  sample_messages TEXT[],
  priority_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uq.failure_type,
    uq.failure_subtype,
    uq.tool_name,
    COUNT(*)::BIGINT as total_count,
    SUM(uq.occurrence_count)::BIGINT as total_occurrences,
    (ARRAY_AGG(DISTINCT LEFT(uq.user_message, 200)) FILTER (WHERE uq.user_message IS NOT NULL))[1:5] as sample_messages,
    (COUNT(*) * 0.4 + SUM(uq.occurrence_count) * 0.6)::FLOAT as priority_score
  FROM ai_unresolved_questions uq
  WHERE uq.resolution_status = 'unresolved'
  GROUP BY uq.failure_type, uq.failure_subtype, uq.tool_name
  ORDER BY priority_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE ai_unresolved_questions IS 'Logs AI chat questions/requests that could not be resolved for training improvement';
COMMENT ON COLUMN ai_unresolved_questions.failure_type IS 'Classification of why the AI failed: knowledge_gap, unknown_tool, tool_error, entity_not_supported, missing_context, api_error, unknown_intent, partial_response, other';
COMMENT ON COLUMN ai_unresolved_questions.occurrence_count IS 'Number of times this or similar question has been asked';
COMMENT ON FUNCTION log_unresolved_question IS 'Logs an unresolved question with deduplication - increments count if similar question exists';
