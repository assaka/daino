-- Add hybrid patch support with validation rules and fallback strategies
-- Enhances existing patch_diffs table to support hybrid patches with metadata

-- Add new columns to patch_diffs table for hybrid patch support
ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS patch_type VARCHAR(50) DEFAULT 'unified_diff' CHECK (patch_type IN ('unified_diff', 'hybrid', 'json_patch', 'ast_transform', 'modify', 'override', 'insert', 'delete'));

ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS fallback_strategy VARCHAR(50) DEFAULT 'skip_on_conflict' CHECK (fallback_strategy IN ('skip_on_conflict', 'force_apply', 'merge_conflict', 'revert_and_retry', 'abort_transaction'));

ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS validation_rules JSONB DEFAULT '{}';

ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS safety_checks JSONB DEFAULT '{}';

ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS application_metadata JSONB DEFAULT '{}';

-- Add pre_conditions and post_conditions for advanced validation
ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS pre_conditions JSONB DEFAULT '[]';

ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS post_conditions JSONB DEFAULT '[]';

-- Add conflict resolution metadata
ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS conflict_resolution JSONB DEFAULT '{}';

-- Add URL pattern support for route-specific patches
ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS url_pattern VARCHAR(512);

-- Add experiment configuration for A/B testing
ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS experiment_config JSONB DEFAULT '{}';

-- Add patch operation details (for modify, override types)
ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS patch_operation JSONB DEFAULT '{}';

-- Add target selectors (CSS selectors, function names, component names)
ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS target_selectors JSONB DEFAULT '[]';

-- Add traffic configuration for gradual rollouts
ALTER TABLE patch_diffs 
ADD COLUMN IF NOT EXISTS traffic_config JSONB DEFAULT '{}';

-- Create hybrid_patch_validations table for reusable validation rules
CREATE TABLE IF NOT EXISTS hybrid_patch_validations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('must_contain', 'cannot_contain', 'must_not_modify', 'syntax_valid', 'security_check', 'custom')),
    rule_config JSONB NOT NULL,
    file_patterns TEXT[], -- Which files this rule applies to
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(store_id, rule_name)
);

-- Create patch_application_results table for tracking hybrid patch applications
CREATE TABLE IF NOT EXISTS patch_application_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patch_id UUID NOT NULL REFERENCES patch_diffs(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    application_id UUID, -- Links to patch_applications if exists
    
    -- Application attempt details
    attempt_number INTEGER DEFAULT 1,
    application_status VARCHAR(50) NOT NULL CHECK (application_status IN ('success', 'validation_failed', 'conflict', 'fallback_applied', 'failed', 'skipped')),
    fallback_strategy_used VARCHAR(50),
    
    -- Validation results
    validation_results JSONB DEFAULT '{}',
    failed_validations TEXT[],
    conflict_details JSONB DEFAULT '{}',
    
    -- Code states
    original_code_snippet TEXT,
    modified_code_snippet TEXT,
    final_code_snippet TEXT,
    
    -- Performance and safety
    application_duration_ms INTEGER,
    memory_usage_mb NUMERIC(10,2),
    safety_warnings TEXT[],
    
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_patch_diffs_patch_type ON patch_diffs (patch_type);
CREATE INDEX IF NOT EXISTS idx_patch_diffs_fallback_strategy ON patch_diffs (fallback_strategy);
CREATE INDEX IF NOT EXISTS idx_patch_diffs_validation_rules ON patch_diffs USING GIN (validation_rules);

CREATE INDEX IF NOT EXISTS idx_hybrid_validations_store_id ON hybrid_patch_validations (store_id);
CREATE INDEX IF NOT EXISTS idx_hybrid_validations_rule_type ON hybrid_patch_validations (rule_type);
CREATE INDEX IF NOT EXISTS idx_hybrid_validations_active ON hybrid_patch_validations (is_active);

CREATE INDEX IF NOT EXISTS idx_application_results_patch_id ON patch_application_results (patch_id);
CREATE INDEX IF NOT EXISTS idx_application_results_status ON patch_application_results (application_status);
CREATE INDEX IF NOT EXISTS idx_application_results_applied_at ON patch_application_results (applied_at);

-- Add trigger for updated_at on hybrid_patch_validations
DROP TRIGGER IF EXISTS update_hybrid_patch_validations_updated_at ON hybrid_patch_validations;
CREATE TRIGGER update_hybrid_patch_validations_updated_at
    BEFORE UPDATE ON hybrid_patch_validations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some default validation rules for common safety checks
INSERT INTO hybrid_patch_validations (store_id, rule_name, rule_type, rule_config, file_patterns, description, created_by)
SELECT 
    s.id as store_id,
    'no_process_exit' as rule_name,
    'cannot_contain' as rule_type,
    '{"patterns": ["process.exit", "System.exit", "os.exit"], "case_sensitive": true}' as rule_config,
    ARRAY['*.js', '*.jsx', '*.ts', '*.tsx'] as file_patterns,
    'Prevents patches from adding dangerous exit calls' as description,
    u.id as created_by
FROM stores s, users u 
WHERE u.role = 'store_owner' 
AND s.id = '8cc01a01-3a78-4f20-beb8-a566a07834e5'
ON CONFLICT (store_id, rule_name) DO NOTHING;

INSERT INTO hybrid_patch_validations (store_id, rule_name, rule_type, rule_config, file_patterns, description, created_by)
SELECT 
    s.id as store_id,
    'maintain_function_signatures' as rule_name,
    'must_contain' as rule_type,
    '{"required_functions": ["calculateTotal", "render"], "preserve_signatures": true}' as rule_config,
    ARRAY['*.js', '*.jsx', '*.ts', '*.tsx'] as file_patterns,
    'Ensures critical functions are not removed or modified incorrectly' as description,
    u.id as created_by
FROM stores s, users u 
WHERE u.role = 'store_owner' 
AND s.id = '8cc01a01-3a78-4f20-beb8-a566a07834e5'
ON CONFLICT (store_id, rule_name) DO NOTHING;

INSERT INTO hybrid_patch_validations (store_id, rule_name, rule_type, rule_config, file_patterns, description, created_by)
SELECT 
    s.id as store_id,
    'syntax_validation' as rule_name,
    'syntax_valid' as rule_type,
    '{"parsers": ["babel", "typescript"], "strict_mode": true}' as rule_config,
    ARRAY['*.js', '*.jsx', '*.ts', '*.tsx'] as file_patterns,
    'Validates that patches result in syntactically correct code' as description,
    u.id as created_by
FROM stores s, users u 
WHERE u.role = 'store_owner' 
AND s.id = '8cc01a01-3a78-4f20-beb8-a566a07834e5'
ON CONFLICT (store_id, rule_name) DO NOTHING;

-- Grant permissions
GRANT ALL ON hybrid_patch_validations TO PUBLIC;
GRANT ALL ON patch_application_results TO PUBLIC;

-- Add comment for documentation
COMMENT ON TABLE hybrid_patch_validations IS 'Stores reusable validation rules for hybrid patches with safety and conflict resolution';
COMMENT ON TABLE patch_application_results IS 'Tracks detailed results of hybrid patch applications including validation outcomes';

COMMENT ON COLUMN patch_diffs.patch_type IS 'Type of patch: unified_diff, hybrid, json_patch, or ast_transform';
COMMENT ON COLUMN patch_diffs.fallback_strategy IS 'Strategy to use when patch application encounters conflicts';
COMMENT ON COLUMN patch_diffs.validation_rules IS 'JSON object containing validation rules specific to this patch';
COMMENT ON COLUMN patch_diffs.safety_checks IS 'JSON object containing safety check configurations';
COMMENT ON COLUMN patch_diffs.application_metadata IS 'Additional metadata about how this patch should be applied';