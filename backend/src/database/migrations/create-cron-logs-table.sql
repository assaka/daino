-- ==========================================
-- Master Database - Cron Logs Table
-- ==========================================
-- Purpose: Centralized logging for platform-level cron job executions
-- This table tracks all cron job runs (daily credit deduction, cleanups, etc.)

-- ==========================================
-- CRON_LOGS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job identification
  job_name VARCHAR(100) NOT NULL,           -- e.g., 'daily_credit_deduction', 'cleanup_expired_sessions'
  job_type VARCHAR(50) NOT NULL DEFAULT 'system', -- 'system', 'scheduled', 'manual'

  -- Execution details
  status VARCHAR(20) NOT NULL DEFAULT 'started', -- 'started', 'running', 'completed', 'failed', 'timeout'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,                      -- Execution duration in milliseconds

  -- Results
  result JSONB DEFAULT '{}',                -- Success result data (counts, summaries)
  error_message TEXT,                       -- Error message if failed
  error_stack TEXT,                         -- Full stack trace for debugging

  -- Execution context
  server_instance VARCHAR(100),             -- Server/container that ran the job
  trigger_source VARCHAR(50) DEFAULT 'cron', -- 'cron', 'manual', 'api', 'retry'
  triggered_by VARCHAR(255),                -- User or system that triggered (for manual runs)

  -- Metrics
  stores_processed INTEGER DEFAULT 0,       -- Number of stores processed
  stores_affected INTEGER DEFAULT 0,        -- Number of stores actually affected
  items_processed INTEGER DEFAULT 0,        -- Generic counter for items processed

  -- Metadata
  metadata JSONB DEFAULT '{}',              -- Additional context-specific data

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_name ON cron_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_logs_status ON cron_logs(status);
CREATE INDEX IF NOT EXISTS idx_cron_logs_started_at ON cron_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_started ON cron_logs(job_name, started_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_status_started ON cron_logs(job_name, status, started_at DESC);

-- ==========================================
-- HELPER FUNCTIONS
-- ==========================================

-- Function to get recent cron logs for a specific job
CREATE OR REPLACE FUNCTION get_recent_cron_logs(p_job_name VARCHAR, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  job_name VARCHAR,
  status VARCHAR,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  stores_processed INTEGER,
  stores_affected INTEGER,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.id,
    cl.job_name,
    cl.status,
    cl.started_at,
    cl.completed_at,
    cl.duration_ms,
    cl.stores_processed,
    cl.stores_affected,
    cl.error_message
  FROM cron_logs cl
  WHERE cl.job_name = p_job_name
  ORDER BY cl.started_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get cron job statistics
CREATE OR REPLACE FUNCTION get_cron_job_stats(p_job_name VARCHAR, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_runs BIGINT,
  successful_runs BIGINT,
  failed_runs BIGINT,
  success_rate DECIMAL,
  avg_duration_ms DECIMAL,
  max_duration_ms INTEGER,
  min_duration_ms INTEGER,
  total_stores_processed BIGINT,
  total_stores_affected BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_runs,
    COUNT(*) FILTER (WHERE cl.status = 'completed')::BIGINT as successful_runs,
    COUNT(*) FILTER (WHERE cl.status = 'failed')::BIGINT as failed_runs,
    ROUND(
      (COUNT(*) FILTER (WHERE cl.status = 'completed')::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as success_rate,
    ROUND(AVG(cl.duration_ms)::DECIMAL, 2) as avg_duration_ms,
    MAX(cl.duration_ms) as max_duration_ms,
    MIN(cl.duration_ms) as min_duration_ms,
    COALESCE(SUM(cl.stores_processed), 0)::BIGINT as total_stores_processed,
    COALESCE(SUM(cl.stores_affected), 0)::BIGINT as total_stores_affected
  FROM cron_logs cl
  WHERE cl.job_name = p_job_name
    AND cl.started_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old cron logs (keep last N days)
CREATE OR REPLACE FUNCTION cleanup_old_cron_logs(p_days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM cron_logs
  WHERE started_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- COMMENTS
-- ==========================================
COMMENT ON TABLE cron_logs IS 'Centralized log of all platform-level cron job executions';
COMMENT ON COLUMN cron_logs.job_name IS 'Unique identifier for the cron job type';
COMMENT ON COLUMN cron_logs.job_type IS 'Category: system (platform jobs), scheduled (user-defined), manual (one-off runs)';
COMMENT ON COLUMN cron_logs.status IS 'Execution status: started, running, completed, failed, timeout';
COMMENT ON COLUMN cron_logs.result IS 'JSON object containing success details and counts';
COMMENT ON COLUMN cron_logs.stores_processed IS 'Total number of stores examined during execution';
COMMENT ON COLUMN cron_logs.stores_affected IS 'Number of stores that had changes applied';
COMMENT ON COLUMN cron_logs.metadata IS 'Additional context-specific data in JSON format';

COMMENT ON FUNCTION get_recent_cron_logs IS 'Get the most recent execution logs for a specific cron job';
COMMENT ON FUNCTION get_cron_job_stats IS 'Get aggregated statistics for a cron job over a time period';
COMMENT ON FUNCTION cleanup_old_cron_logs IS 'Remove cron logs older than specified days';

-- ==========================================
-- VERIFICATION
-- ==========================================
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'cron_logs';
