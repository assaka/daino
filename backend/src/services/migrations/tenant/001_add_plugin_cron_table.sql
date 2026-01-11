-- Migration: 001_add_plugin_cron_table
-- Description: Creates plugin_cron table for scheduled plugin tasks
-- Date: 2025-01-11

-- Create execute_sql function if not exists (needed for future migrations via REST API)
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $func$
BEGIN
  EXECUTE sql;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO anon;

-- Create plugin_cron table
CREATE TABLE IF NOT EXISTS plugin_cron (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  cron_name VARCHAR(255) NOT NULL,
  description TEXT,
  cron_schedule VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  handler_method VARCHAR(255) NOT NULL,
  handler_code TEXT,
  handler_params JSONB DEFAULT '{}'::jsonb,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_status VARCHAR(50),
  last_error TEXT,
  last_result JSONB,
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  max_runs INTEGER,
  max_failures INTEGER DEFAULT 5,
  timeout_seconds INTEGER DEFAULT 300,
  cron_job_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugin_cron_plugin_id ON plugin_cron(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_cron_enabled ON plugin_cron(is_enabled) WHERE is_enabled = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_cron_unique_name ON plugin_cron(plugin_id, cron_name);

-- Enable RLS and create policy
ALTER TABLE plugin_cron ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_plugin_cron ON plugin_cron;
CREATE POLICY tenant_isolation_plugin_cron ON plugin_cron
  FOR ALL
  USING (is_service_role())
  WITH CHECK (is_service_role());
