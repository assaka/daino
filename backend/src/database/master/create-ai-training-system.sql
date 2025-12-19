-- AI Automatic Training System
-- Captures real prompts, validates outcomes, and auto-promotes successful patterns
--
-- SAFE TO RE-RUN: Uses IF NOT EXISTS

-- ============================================
-- AI TRAINING CANDIDATES TABLE
-- Stores actual user prompts awaiting validation/approval
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source information
  store_id UUID,
  user_id UUID,
  session_id VARCHAR(255),

  -- The actual prompt and response
  user_prompt TEXT NOT NULL,
  ai_response TEXT,

  -- Detected intent and entity
  detected_intent VARCHAR(100),
  detected_entity VARCHAR(100),
  detected_operation VARCHAR(100),

  -- Outcome tracking
  action_taken JSONB, -- What action the AI performed
  outcome_status VARCHAR(50) DEFAULT 'pending', -- pending, success, failure, reverted
  outcome_details JSONB, -- Details about what happened

  -- Validation
  was_validated BOOLEAN DEFAULT FALSE,
  validated_at TIMESTAMP,
  validated_by UUID,
  validation_method VARCHAR(50), -- auto, manual, user_feedback

  -- Training status
  training_status VARCHAR(50) DEFAULT 'candidate', -- candidate, approved, rejected, promoted
  promoted_at TIMESTAMP,
  promoted_to VARCHAR(100), -- Which entity definition it was added to

  -- Quality metrics
  confidence_score DECIMAL(5,4), -- AI's confidence in the response
  similarity_score DECIMAL(5,4), -- How similar to existing training data
  success_count INTEGER DEFAULT 0, -- How many times this pattern succeeded
  failure_count INTEGER DEFAULT 0, -- How many times this pattern failed

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_training_candidates_status ON ai_training_candidates(training_status);
CREATE INDEX IF NOT EXISTS idx_training_candidates_entity ON ai_training_candidates(detected_entity);
CREATE INDEX IF NOT EXISTS idx_training_candidates_outcome ON ai_training_candidates(outcome_status);
CREATE INDEX IF NOT EXISTS idx_training_candidates_store ON ai_training_candidates(store_id);
CREATE INDEX IF NOT EXISTS idx_training_candidates_created ON ai_training_candidates(created_at DESC);

-- ============================================
-- AI TRAINING VALIDATIONS TABLE
-- Tracks validation attempts and results
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES ai_training_candidates(id) ON DELETE CASCADE,

  -- Validation details
  validation_type VARCHAR(50) NOT NULL, -- action_success, user_feedback, revert_check, manual_review
  validation_result VARCHAR(50) NOT NULL, -- passed, failed, inconclusive

  -- Evidence
  evidence JSONB, -- What data was checked
  notes TEXT,

  -- Who/what validated
  validated_by UUID, -- NULL for automatic validations
  validation_source VARCHAR(50), -- system, user, admin

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_validations_candidate ON ai_training_validations(candidate_id);

-- ============================================
-- AI TRAINING RULES TABLE
-- Configurable rules for auto-approval
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  rule_name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- auto_approve, auto_reject, require_review

  -- Conditions (all must match)
  conditions JSONB NOT NULL,
  -- Example: {
  --   "min_success_count": 3,
  --   "max_failure_count": 0,
  --   "min_confidence": 0.85,
  --   "entity": "products",
  --   "operation": "update"
  -- }

  -- Actions
  action VARCHAR(50) NOT NULL, -- approve, reject, flag_for_review
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
-- Aggregate metrics for monitoring
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  metric_date DATE NOT NULL,
  entity_name VARCHAR(100),

  -- Counts
  total_prompts INTEGER DEFAULT 0,
  successful_prompts INTEGER DEFAULT 0,
  failed_prompts INTEGER DEFAULT 0,

  -- Training pipeline
  candidates_created INTEGER DEFAULT 0,
  candidates_approved INTEGER DEFAULT 0,
  candidates_rejected INTEGER DEFAULT 0,
  candidates_promoted INTEGER DEFAULT 0,

  -- Quality
  avg_confidence DECIMAL(5,4),
  avg_success_rate DECIMAL(5,4),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(metric_date, entity_name)
);

CREATE INDEX IF NOT EXISTS idx_training_metrics_date ON ai_training_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_training_metrics_entity ON ai_training_metrics(entity_name);

-- ============================================
-- FUNCTION: Update training candidate on action outcome
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

-- ============================================
-- FUNCTION: Check and apply auto-training rules
-- ============================================
CREATE OR REPLACE FUNCTION check_training_rules(p_candidate_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  v_candidate RECORD;
  v_rule RECORD;
  v_result VARCHAR(50) := 'no_match';
BEGIN
  -- Get candidate details
  SELECT * INTO v_candidate FROM ai_training_candidates WHERE id = p_candidate_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  -- Check rules in priority order
  FOR v_rule IN
    SELECT * FROM ai_training_rules
    WHERE is_active = TRUE
    ORDER BY priority DESC
  LOOP
    -- Check min_success_count
    IF (v_rule.conditions->>'min_success_count')::int IS NOT NULL
       AND v_candidate.success_count < (v_rule.conditions->>'min_success_count')::int THEN
      CONTINUE;
    END IF;

    -- Check max_failure_count
    IF (v_rule.conditions->>'max_failure_count')::int IS NOT NULL
       AND v_candidate.failure_count > (v_rule.conditions->>'max_failure_count')::int THEN
      CONTINUE;
    END IF;

    -- Check min_confidence
    IF (v_rule.conditions->>'min_confidence')::decimal IS NOT NULL
       AND v_candidate.confidence_score < (v_rule.conditions->>'min_confidence')::decimal THEN
      CONTINUE;
    END IF;

    -- Check entity match
    IF v_rule.conditions->>'entity' IS NOT NULL
       AND v_candidate.detected_entity != v_rule.conditions->>'entity' THEN
      CONTINUE;
    END IF;

    -- Check outcome_status
    IF v_rule.conditions->>'outcome_status' IS NOT NULL
       AND v_candidate.outcome_status != v_rule.conditions->>'outcome_status' THEN
      CONTINUE;
    END IF;

    -- Rule matched - apply action
    v_result := v_rule.action;

    -- Update candidate status
    IF v_rule.action = 'approve' THEN
      UPDATE ai_training_candidates
      SET training_status = 'approved',
          was_validated = TRUE,
          validated_at = NOW(),
          validation_method = 'auto',
          updated_at = NOW()
      WHERE id = p_candidate_id;
    ELSIF v_rule.action = 'reject' THEN
      UPDATE ai_training_candidates
      SET training_status = 'rejected',
          was_validated = TRUE,
          validated_at = NOW(),
          validation_method = 'auto',
          updated_at = NOW()
      WHERE id = p_candidate_id;
    ELSIF v_rule.action = 'flag_for_review' THEN
      UPDATE ai_training_candidates
      SET training_status = 'review_needed',
          updated_at = NOW()
      WHERE id = p_candidate_id;
    END IF;

    -- Log validation
    INSERT INTO ai_training_validations (candidate_id, validation_type, validation_result, evidence, validation_source)
    VALUES (p_candidate_id, 'rule_check', v_result, jsonb_build_object('rule_id', v_rule.id, 'rule_name', v_rule.rule_name), 'system');

    EXIT; -- Stop after first matching rule
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Promote approved candidates to training data
-- ============================================
CREATE OR REPLACE FUNCTION promote_training_candidate(p_candidate_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_candidate RECORD;
BEGIN
  SELECT * INTO v_candidate FROM ai_training_candidates
  WHERE id = p_candidate_id AND training_status = 'approved';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update entity definition with new example prompt
  UPDATE ai_entity_definitions
  SET
    example_prompts = example_prompts || to_jsonb(v_candidate.user_prompt),
    updated_at = NOW()
  WHERE entity_name = v_candidate.detected_entity
    AND NOT (example_prompts ? v_candidate.user_prompt); -- Avoid duplicates

  -- Mark candidate as promoted
  UPDATE ai_training_candidates
  SET
    training_status = 'promoted',
    promoted_at = NOW(),
    promoted_to = v_candidate.detected_entity,
    updated_at = NOW()
  WHERE id = p_candidate_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
