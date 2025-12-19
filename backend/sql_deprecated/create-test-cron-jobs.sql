-- Create test cron jobs for demonstration
-- 1. Shopify hourly product import
-- 2. Hourly email to store owner

DO $$
DECLARE
  test_user_id UUID;
  test_store_id UUID;
  shopify_job_id UUID;
  email_job_id UUID;
BEGIN
  -- Get first user and store for testing
  -- Replace these with actual IDs in production
  SELECT id INTO test_user_id FROM users WHERE id = 'cbca0a20-973d-4a33-85fc-d84d461d1372';
  SELECT id INTO test_store_id FROM stores WHERE id = '157d4590-49bf-4b0b-bd77-abe131909528';

  IF test_user_id IS NULL OR test_store_id IS NULL THEN
    RAISE EXCEPTION 'No user or store found. Create a user and store first.';
  END IF;

  RAISE NOTICE 'Using user: % and store: %', test_user_id, test_store_id;

  -- ============================================
  -- JOB 1: Shopify Hourly Product Import
  -- ============================================

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
    max_failures,
    timeout_seconds,
    tags,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    'Hourly Shopify Product Import',
    'Automatically imports new products from Shopify every hour. Keeps your catalog in sync with your Shopify store.',
    '0 * * * *', -- Every hour at minute 0
    'UTC',
    'api_call',
    jsonb_build_object(
      'url', '/api/shopify/import/products',
      'method', 'POST',
      'headers', jsonb_build_object(
        'Content-Type', 'application/json',
        'x-store-id', test_store_id::text
      ),
      'body', jsonb_build_object(
        'store_id', test_store_id::text,
        'dry_run', false,
        'limit', null,
        'overwrite', false
      ),
      'description', 'Scheduled Shopify product import'
    ),
    test_user_id,
    test_store_id,
    true, -- is_active
    false, -- is_paused
    3, -- max_failures
    3600, -- 1 hour timeout
    'shopify,import,automated',
    NOW(),
    NOW()
  )
  RETURNING id INTO shopify_job_id;

  RAISE NOTICE '✅ Created Shopify hourly import job: %', shopify_job_id;

  -- Calculate next run time (next hour)
  UPDATE cron_jobs
  SET next_run_at = date_trunc('hour', NOW()) + INTERVAL '1 hour'
  WHERE id = shopify_job_id;

  -- ============================================
  -- JOB 2: Hourly Email to Store Owner
  -- ============================================

  -- First, get the store owner's email
  DECLARE
    store_owner_email TEXT;
  BEGIN
    SELECT email INTO store_owner_email
    FROM users
    WHERE id = test_user_id;

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
      max_failures,
      timeout_seconds,
      tags,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      'Hourly Store Status Email',
      'Sends an hourly status update email to the store owner with key metrics and recent activity.',
      '0 * * * *', -- Every hour at minute 0
      'UTC',
      'email',
      jsonb_build_object(
        'to', store_owner_email,
        'subject', 'Hourly Store Status Update',
        'template', 'store-status-hourly',
        'data', jsonb_build_object(
          'store_id', test_store_id::text,
          'include_metrics', true,
          'include_recent_orders', true,
          'include_low_stock', true,
          'time_period', '1hour'
        ),
        'description', 'Automated hourly status email'
      ),
      test_user_id,
      test_store_id,
      true, -- is_active
      false, -- is_paused
      2, -- max_failures
      300, -- 5 minute timeout
      'email,automated,status',
      NOW(),
      NOW()
    )
    RETURNING id INTO email_job_id;

    RAISE NOTICE '✅ Created hourly email job: %', email_job_id;

    -- Calculate next run time
    UPDATE cron_jobs
    SET next_run_at = date_trunc('hour', NOW()) + INTERVAL '1 hour'
    WHERE id = email_job_id;

  END;

  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ All test cron jobs created successfully!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

END $$;

-- Verify the created jobs
SELECT
  id,
  name,
  description,
  cron_expression,
  job_type,
  is_active,
  next_run_at,
  created_at
FROM cron_jobs
WHERE name IN ('Hourly Shopify Product Import', 'Hourly Store Status Email')
ORDER BY name;

-- Expected output:
-- name                           | cron_expression | job_type | is_active | next_run_at
-- -------------------------------|-----------------|----------|-----------|-------------------
-- Hourly Shopify Product Import  | 0 * * * *       | api_call | true      | (next hour)
-- Hourly Store Status Email      | 0 * * * *       | email    | true      | (next hour)
