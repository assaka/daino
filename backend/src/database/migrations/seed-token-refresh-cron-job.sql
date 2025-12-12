-- Seed token refresh cron job
-- This job runs hourly to refresh OAuth tokens before they expire

-- First, ensure the cron_job_types table has the token_refresh type
INSERT INTO cron_job_types (type_name, display_name, description, configuration_schema, default_configuration, category, icon, is_enabled)
VALUES (
  'token_refresh',
  'OAuth Token Refresh',
  'Automatically refresh OAuth tokens before they expire',
  '{
    "type": "object",
    "properties": {
      "bufferMinutes": {
        "type": "integer",
        "minimum": 10,
        "maximum": 120,
        "description": "Refresh tokens expiring within this many minutes"
      },
      "batchSize": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50,
        "description": "Number of tokens to process at a time"
      }
    }
  }',
  '{"bufferMinutes": 60, "batchSize": 10}',
  'maintenance',
  'refresh',
  true
)
ON CONFLICT (type_name) DO NOTHING;

-- Insert the hourly token refresh cron job
-- Note: This is a system-level job (store_id is NULL, is_system = true)
INSERT INTO cron_jobs (
  id,
  name,
  description,
  cron_expression,
  timezone,
  job_type,
  configuration,
  user_id,
  store_id,
  is_active,
  is_paused,
  is_system,
  next_run_at,
  max_failures,
  timeout_seconds,
  tags
)
SELECT
  gen_random_uuid(),
  'System: OAuth Token Refresh',
  'Automatically refresh OAuth tokens for all stores before they expire. Runs every hour to ensure tokens are always valid.',
  '0 * * * *',  -- Every hour at minute 0
  'UTC',
  'token_refresh',
  '{"bufferMinutes": 60, "batchSize": 10}',
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),  -- System user
  NULL,  -- System-level job, no specific store
  true,
  false,
  true,  -- is_system = true
  NOW() + INTERVAL '1 hour',  -- Next run in 1 hour
  10,  -- More retries for critical job
  600,  -- 10 minute timeout
  'system,oauth,token,refresh'
WHERE NOT EXISTS (
  SELECT 1 FROM cron_jobs WHERE name = 'System: OAuth Token Refresh'
);
