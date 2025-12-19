-- Seed cron job for Cart Alert plugin (ef537565-3db0-466e-8b56-1694499f6a03)
-- This creates a daily abandoned cart reminder cron job

INSERT INTO plugin_cron (
  plugin_id,
  cron_name,
  description,
  cron_schedule,
  timezone,
  handler_method,
  handler_params,
  is_enabled,
  priority,
  timeout_seconds,
  max_failures
) VALUES (
  'ef537565-3db0-466e-8b56-1694499f6a03',
  'send-cart-reminders',
  'Send abandoned cart reminder emails to customers who left items in their cart',
  '0 9 * * *',  -- Daily at 9 AM
  'UTC',
  'sendCartReminders',
  '{"reminderDelayHours": 24, "maxReminders": 3, "emailTemplate": "cart-reminder"}'::jsonb,
  true,
  10,
  300,
  5
) ON CONFLICT (plugin_id, cron_name) DO UPDATE SET
  description = EXCLUDED.description,
  cron_schedule = EXCLUDED.cron_schedule,
  handler_params = EXCLUDED.handler_params,
  updated_at = NOW();

-- Also add a weekly cleanup cron job
INSERT INTO plugin_cron (
  plugin_id,
  cron_name,
  description,
  cron_schedule,
  timezone,
  handler_method,
  handler_params,
  is_enabled,
  priority,
  timeout_seconds,
  max_failures
) VALUES (
  'ef537565-3db0-466e-8b56-1694499f6a03',
  'cleanup-old-carts',
  'Clean up abandoned carts older than 30 days',
  '0 3 * * 0',  -- Weekly on Sunday at 3 AM
  'UTC',
  'cleanupOldCarts',
  '{"olderThanDays": 30}'::jsonb,
  true,
  5,
  600,
  3
) ON CONFLICT (plugin_id, cron_name) DO UPDATE SET
  description = EXCLUDED.description,
  cron_schedule = EXCLUDED.cron_schedule,
  handler_params = EXCLUDED.handler_params,
  updated_at = NOW();
