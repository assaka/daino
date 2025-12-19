-- Create cron_jobs table for user-defined scheduled jobs
CREATE TABLE IF NOT EXISTS cron_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scheduling
    cron_expression VARCHAR(100) NOT NULL, -- '0 0 * * *' for daily at midnight
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Job configuration
    job_type VARCHAR(100) NOT NULL, -- 'webhook', 'email', 'api_call', 'database_query', etc.
    configuration JSON NOT NULL, -- Job-specific configuration
    
    -- Ownership and access
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE, -- Optional store-specific jobs
    
    -- Status and control
    is_active BOOLEAN DEFAULT true,
    is_paused BOOLEAN DEFAULT false,
    
    -- Execution tracking
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_status VARCHAR(20), -- 'success', 'failed', 'running', 'skipped'
    last_error TEXT,
    last_result JSON,
    
    -- Limits and controls
    max_runs INTEGER, -- NULL for unlimited
    max_failures INTEGER DEFAULT 5, -- Pause after 5 consecutive failures
    consecutive_failures INTEGER DEFAULT 0,
    timeout_seconds INTEGER DEFAULT 300, -- 5 minutes default timeout
    
    -- Metadata
    tags VARCHAR(500), -- Comma-separated tags for filtering
    metadata JSON DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (timeout_seconds > 0),
    CHECK (max_failures >= 0),
    CHECK (run_count >= 0),
    CHECK (success_count >= 0),
    CHECK (failure_count >= 0),
    CHECK (consecutive_failures >= 0)
);

-- Create cron_job_executions table for execution history
CREATE TABLE IF NOT EXISTS cron_job_executions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cron_job_id UUID NOT NULL REFERENCES cron_jobs(id) ON DELETE CASCADE,
    
    -- Execution details
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL, -- 'running', 'success', 'failed', 'timeout'
    
    -- Results and errors
    result JSON,
    error_message TEXT,
    error_stack TEXT,
    
    -- Context
    triggered_by VARCHAR(50) DEFAULT 'scheduler', -- 'scheduler', 'manual', 'api'
    triggered_by_user UUID REFERENCES users(id),
    server_instance VARCHAR(100), -- For tracking which server instance ran the job
    
    -- Performance metrics
    memory_usage_mb DECIMAL(10,2),
    cpu_time_ms INTEGER,
    
    -- Metadata
    metadata JSON DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cron_jobs_user_id ON cron_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_store_id ON cron_jobs(store_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_active ON cron_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at) WHERE is_active = true AND is_paused = false;
CREATE INDEX IF NOT EXISTS idx_cron_jobs_job_type ON cron_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_tags ON cron_jobs USING gin(to_tsvector('english', tags));

CREATE INDEX IF NOT EXISTS idx_cron_job_executions_cron_job_id ON cron_job_executions(cron_job_id);
CREATE INDEX IF NOT EXISTS idx_cron_job_executions_started_at ON cron_job_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_cron_job_executions_status ON cron_job_executions(status);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cron_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cron_jobs_updated_at
    BEFORE UPDATE ON cron_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_cron_jobs_updated_at();

-- Insert sample cron job types configuration
CREATE TABLE IF NOT EXISTS cron_job_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type_name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    configuration_schema JSON NOT NULL, -- JSON Schema for validation
    default_configuration JSON DEFAULT '{}',
    is_enabled BOOLEAN DEFAULT true,
    category VARCHAR(100) DEFAULT 'general',
    icon VARCHAR(100), -- Icon identifier for UI
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default job types
INSERT INTO cron_job_types (type_name, display_name, description, configuration_schema, default_configuration, category, icon) VALUES
('webhook', 'Webhook Call', 'Make HTTP requests to external endpoints', '{
    "type": "object",
    "properties": {
        "url": {"type": "string", "format": "uri"},
        "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE", "PATCH"]},
        "headers": {"type": "object"},
        "body": {"type": "string"},
        "timeout": {"type": "integer", "minimum": 1, "maximum": 300}
    },
    "required": ["url", "method"]
}', '{"method": "GET", "timeout": 30}', 'integration', 'webhook'),

('email', 'Email Notification', 'Send scheduled email notifications', '{
    "type": "object", 
    "properties": {
        "to": {"type": "string", "format": "email"},
        "subject": {"type": "string"},
        "body": {"type": "string"},
        "template": {"type": "string"},
        "variables": {"type": "object"}
    },
    "required": ["to", "subject"]
}', '{}', 'notification', 'mail'),

('database_query', 'Database Query', 'Execute scheduled database operations', '{
    "type": "object",
    "properties": {
        "query": {"type": "string"},
        "parameters": {"type": "object"},
        "operation_type": {"type": "string", "enum": ["SELECT", "UPDATE", "DELETE", "INSERT"]}
    },
    "required": ["query", "operation_type"]
}', '{}', 'database', 'database'),

('api_call', 'API Call', 'Make calls to internal API endpoints', '{
    "type": "object",
    "properties": {
        "endpoint": {"type": "string"},
        "method": {"type": "string", "enum": ["GET", "POST", "PUT", "DELETE"]},
        "payload": {"type": "object"},
        "headers": {"type": "object"}
    },
    "required": ["endpoint", "method"]
}', '{"method": "GET"}', 'integration', 'api'),

('cleanup', 'Data Cleanup', 'Clean up old data based on rules', '{
    "type": "object",
    "properties": {
        "table": {"type": "string"},
        "condition": {"type": "string"},
        "older_than_days": {"type": "integer", "minimum": 1},
        "max_records": {"type": "integer", "minimum": 1}
    },
    "required": ["table", "older_than_days"]
}', '{"older_than_days": 30}', 'maintenance', 'trash')

ON CONFLICT (type_name) DO NOTHING;