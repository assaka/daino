-- Plugin Cron Jobs Table
-- Stores cron job definitions for plugins
-- These sync to the central cron_jobs table via the unified scheduler

CREATE TABLE IF NOT EXISTS plugin_cron (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,

  -- Cron job identification
  cron_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Schedule configuration
  cron_schedule VARCHAR(100) NOT NULL,  -- Cron expression (e.g., '0 2 * * *')
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Handler configuration
  handler_method VARCHAR(255) NOT NULL,  -- Method name on plugin class to call
  handler_code TEXT,                      -- Optional inline code
  handler_params JSONB DEFAULT '{}',      -- Parameters to pass to handler

  -- Status tracking
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,

  -- Execution tracking
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_status VARCHAR(50),  -- 'success', 'failed', 'running', 'skipped'
  last_error TEXT,
  last_result JSONB,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,

  -- Controls
  max_runs INTEGER,              -- NULL = unlimited
  max_failures INTEGER DEFAULT 5,
  timeout_seconds INTEGER DEFAULT 300,

  -- Link to central cron_jobs table
  cron_job_id UUID,  -- Reference to synced entry in cron_jobs table

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_plugin_cron_plugin_id ON plugin_cron(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_cron_enabled ON plugin_cron(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_plugin_cron_next_run ON plugin_cron(next_run_at) WHERE is_enabled = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_cron_unique_name ON plugin_cron(plugin_id, cron_name);

-- Comments
COMMENT ON TABLE plugin_cron IS 'Plugin-specific cron job definitions';
COMMENT ON COLUMN plugin_cron.cron_schedule IS 'Standard cron expression (minute hour day month weekday)';
COMMENT ON COLUMN plugin_cron.handler_method IS 'Method name on the plugin class to invoke';
COMMENT ON COLUMN plugin_cron.cron_job_id IS 'Reference to synced entry in unified cron_jobs table';
