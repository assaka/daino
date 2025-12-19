-- Migration: Create background jobs system tables
-- Description: Creates jobs and job_history tables for the unified background job system

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(255) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    payload JSON NOT NULL DEFAULT '{}',
    result JSON,
    scheduled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSON NOT NULL DEFAULT '{}',
    progress DECIMAL(5,2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    progress_message VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create job_history table
CREATE TABLE IF NOT EXISTS job_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'progress_update', 'completed', 'failed', 'retried', 'cancelled')),
    message TEXT,
    progress DECIMAL(5,2) CHECK (progress >= 0 AND progress <= 100),
    result JSON,
    error JSON,
    metadata JSON NOT NULL DEFAULT '{}',
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER
);

-- Create indexes for jobs table
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_store_id ON jobs(store_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs(status, priority, scheduled_at);

-- Create indexes for job_history table
CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_history_status ON job_history(status);
CREATE INDEX IF NOT EXISTS idx_job_history_executed_at ON job_history(executed_at);
CREATE INDEX IF NOT EXISTS idx_job_history_timeline ON job_history(job_id, executed_at);

-- Create trigger to update updated_at timestamp on jobs table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE jobs IS 'Unified background job queue for all async operations';
COMMENT ON COLUMN jobs.type IS 'Job type identifier (e.g., akeneo:import:products, plugin:install)';
COMMENT ON COLUMN jobs.priority IS 'Job execution priority: low, normal, high, urgent';
COMMENT ON COLUMN jobs.status IS 'Current job status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN jobs.payload IS 'Job-specific data and parameters';
COMMENT ON COLUMN jobs.result IS 'Job execution result data';
COMMENT ON COLUMN jobs.scheduled_at IS 'When the job should be executed';
COMMENT ON COLUMN jobs.started_at IS 'When the job execution started';
COMMENT ON COLUMN jobs.completed_at IS 'When the job execution completed successfully';
COMMENT ON COLUMN jobs.failed_at IS 'When the job execution failed permanently';
COMMENT ON COLUMN jobs.cancelled_at IS 'When the job was cancelled';
COMMENT ON COLUMN jobs.max_retries IS 'Maximum number of retry attempts';
COMMENT ON COLUMN jobs.retry_count IS 'Current retry attempt count';
COMMENT ON COLUMN jobs.last_error IS 'Last error message';
COMMENT ON COLUMN jobs.store_id IS 'Associated store ID';
COMMENT ON COLUMN jobs.user_id IS 'User who initiated the job';
COMMENT ON COLUMN jobs.metadata IS 'Additional metadata for tracking and monitoring';
COMMENT ON COLUMN jobs.progress IS 'Job progress percentage (0-100)';
COMMENT ON COLUMN jobs.progress_message IS 'Current progress description';

COMMENT ON TABLE job_history IS 'Historical log of job execution events and status changes';
COMMENT ON COLUMN job_history.job_id IS 'Reference to the parent job';
COMMENT ON COLUMN job_history.status IS 'History event type: started, progress_update, completed, failed, retried, cancelled';
COMMENT ON COLUMN job_history.message IS 'Status message or progress description';
COMMENT ON COLUMN job_history.progress IS 'Progress percentage at this point (0-100)';
COMMENT ON COLUMN job_history.result IS 'Result data for completed jobs or error details for failed jobs';
COMMENT ON COLUMN job_history.error IS 'Detailed error information including stack trace';
COMMENT ON COLUMN job_history.metadata IS 'Additional context data for this history entry';
COMMENT ON COLUMN job_history.executed_at IS 'When this history event occurred';
COMMENT ON COLUMN job_history.duration_ms IS 'Duration in milliseconds for completed operations';