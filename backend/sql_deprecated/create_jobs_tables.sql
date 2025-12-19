-- ============================================
-- MASTER DATABASE - Job Queue Tables Migration
-- ============================================
-- Run this on your MASTER Supabase database
-- This creates the job_queue and job_history tables for background job processing

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Job Queue Table (centralized for all tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type VARCHAR(255) NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    payload JSONB DEFAULT '{}'::jsonb,
    result JSONB,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    progress_message TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    max_retries INTEGER DEFAULT 3,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT,
    store_id UUID,
    user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_queue_status ON public.job_queue(status);
CREATE INDEX IF NOT EXISTS idx_job_queue_job_type ON public.job_queue(job_type);
CREATE INDEX IF NOT EXISTS idx_job_queue_scheduled_at ON public.job_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_store_id ON public.job_queue(store_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_user_id ON public.job_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_status_scheduled ON public.job_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_status_priority ON public.job_queue(status, priority, scheduled_at);

-- Add comment
COMMENT ON TABLE public.job_queue IS 'Centralized background job queue for all tenants';

-- ============================================
-- Job History Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.job_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.job_queue(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'progress_update', 'completed', 'failed', 'retried', 'cancelled')),
    result JSONB,
    error JSONB,
    message TEXT,
    progress INTEGER CHECK (progress >= 0 AND progress <= 100),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON public.job_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_history_executed_at ON public.job_history(executed_at);
CREATE INDEX IF NOT EXISTS idx_job_history_status ON public.job_history(status);

-- Add comment
COMMENT ON TABLE public.job_history IS 'History of job executions and status changes';

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_history ENABLE ROW LEVEL SECURITY;

-- Create policies to allow service role full access
CREATE POLICY "Service role can manage job_queue" ON public.job_queue
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role can manage job_history" ON public.job_history
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL ON public.job_queue TO postgres;
GRANT ALL ON public.job_history TO postgres;
GRANT ALL ON public.job_queue TO service_role;
GRANT ALL ON public.job_history TO service_role;

-- ============================================
-- Success message
-- ============================================
SELECT 'job_queue and job_history tables created successfully!' as message;
