# Unified Scheduler Implementation Plan

## Current State - Table Inventory

### Master DB Tables (Job/Schedule Related)
| Table | Purpose | Status |
|-------|---------|--------|
| `job_queue` | BG jobs (Supabase fallback) | **REMOVE** - duplicate |
| `akeneo_schedules` | Akeneo schedule config | **REMOVE** - migrate to cron_jobs |

### Tenant DB Tables (Job/Schedule Related)
| Table | Purpose | Status |
|-------|---------|--------|
| `cron_jobs` | Unified scheduler | **KEEP** - single source of truth |
| `cron_job_executions` | Execution history | **KEEP** |
| `cron_job_types` | Job type metadata | **REMOVE** - use code constants |
| `jobs` | Background job queue | **KEEP** |
| `job_history` | Job execution history | **REMOVE** - use cron_job_executions |
| `plugin_cron` | Plugin schedules | **REMOVE** - migrate to cron_jobs |

---

## Final Architecture

```
                    SINGLE RENDER CRON (hourly)
                            |
                            v
            ┌───────────────────────────────┐
            │  unified-scheduler.js          │
            │  - Queries cron_jobs table     │
            │  - Executes due jobs           │
            │  - Runs system tasks           │
            └───────────────────────────────┘
                            |
            ┌───────────────┼───────────────┐
            v               v               v
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ Akeneo      │ │ Token       │ │ Credit      │
    │ Imports     │ │ Refresh     │ │ Deduction   │
    └─────────────┘ └─────────────┘ └─────────────┘
            |               |               |
            v               v               v
        cron_jobs       cron_jobs       cron_jobs
        (tenant)        (tenant)        (tenant)
```

---

## Migration SQL Queries

### Step 1: Migrate akeneo_schedules to cron_jobs (Run BEFORE removing table)

```sql
-- Run this on TENANT databases to migrate existing Akeneo schedules
-- This should be run via a migration script that iterates over all tenants

INSERT INTO cron_jobs (
    id,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    configuration,
    source_type,
    source_id,
    source_name,
    handler,
    store_id,
    is_active,
    is_paused,
    is_system,
    last_run_at,
    next_run_at,
    metadata,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    'Akeneo ' || import_type || ' Import',
    'Scheduled ' || import_type || ' import from Akeneo PIM',
    -- Convert schedule_type to cron expression
    CASE schedule_type
        WHEN 'daily' THEN
            COALESCE(SPLIT_PART(schedule_time, ':', 2), '0') || ' ' ||
            COALESCE(SPLIT_PART(schedule_time, ':', 1), '0') || ' * * *'
        WHEN 'weekly' THEN
            COALESCE(SPLIT_PART(schedule_time, ':', 2), '0') || ' ' ||
            COALESCE(SPLIT_PART(schedule_time, ':', 1), '0') || ' * * 1'
        WHEN 'monthly' THEN
            COALESCE(SPLIT_PART(schedule_time, ':', 2), '0') || ' ' ||
            COALESCE(SPLIT_PART(schedule_time, ':', 1), '0') || ' 1 * *'
        WHEN 'once' THEN
            COALESCE(SPLIT_PART(schedule_time, ':', 2), '0') || ' ' ||
            COALESCE(SPLIT_PART(schedule_time, ':', 1), '0') || ' * * *'
        ELSE '0 0 * * *'
    END,
    'UTC',
    'akeneo_import',
    jsonb_build_object(
        'import_type', import_type,
        'filters', COALESCE(filters, '{}'::jsonb),
        'options', COALESCE(options, '{}'::jsonb),
        'credit_cost', COALESCE(credit_cost, 0.1),
        'legacy_schedule_id', id
    ),
    'integration',
    id,
    'akeneo',
    'executeAkeneoImport',
    store_id,
    is_active,
    CASE WHEN status = 'paused' THEN true ELSE false END,
    false,
    last_run,
    next_run,
    jsonb_build_object(
        'schedule_type', schedule_type,
        'migrated_at', NOW(),
        'original_table', 'akeneo_schedules'
    ),
    created_at,
    updated_at
FROM akeneo_schedules
WHERE NOT EXISTS (
    SELECT 1 FROM cron_jobs
    WHERE source_type = 'integration'
    AND source_id = akeneo_schedules.id
);
```

### Step 2: Add system cron jobs (daily credit deduction, token refresh)

```sql
-- Add Daily Credit Deduction job (system job)
INSERT INTO cron_jobs (
    id,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    configuration,
    source_type,
    source_name,
    handler,
    is_active,
    is_system,
    next_run_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'Daily Credit Deduction',
    'Deducts daily credits for active stores and custom domains',
    '0 0 * * *',  -- Daily at midnight UTC
    'UTC',
    'system_job',
    '{"job_class": "DailyCreditDeductionJob"}'::jsonb,
    'system',
    'billing',
    'executeDailyCreditDeduction',
    true,
    true,
    (CURRENT_DATE + INTERVAL '1 day')::timestamp,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;

-- Add Token Refresh job (system job - runs hourly)
INSERT INTO cron_jobs (
    id,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    configuration,
    source_type,
    source_name,
    handler,
    is_active,
    is_system,
    next_run_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'OAuth Token Refresh',
    'Refreshes OAuth tokens expiring within the next hour',
    '0 * * * *',  -- Every hour
    'UTC',
    'token_refresh',
    '{"bufferMinutes": 60, "batchSize": 10}'::jsonb,
    'system',
    'oauth',
    'executeTokenRefresh',
    true,
    true,
    (DATE_TRUNC('hour', NOW()) + INTERVAL '1 hour')::timestamp,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;
```

### Step 3: Migrate plugin_cron to cron_jobs

```sql
-- Migrate plugin_cron entries to cron_jobs
INSERT INTO cron_jobs (
    id,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    configuration,
    source_type,
    source_id,
    source_name,
    handler,
    is_active,
    is_system,
    last_run_at,
    next_run_at,
    run_count,
    success_count,
    failure_count,
    consecutive_failures,
    last_status,
    last_error,
    metadata,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    cron_name,
    description,
    cron_schedule,
    timezone,
    'plugin_job',
    jsonb_build_object(
        'handler_method', handler_method,
        'handler_code', handler_code,
        'handler_params', COALESCE(handler_params, '{}'::jsonb),
        'priority', priority
    ),
    'plugin',
    plugin_id,
    'plugin',
    handler_method,
    is_enabled,
    false,
    last_run_at,
    next_run_at,
    run_count,
    success_count,
    failure_count,
    consecutive_failures,
    last_status,
    last_error,
    jsonb_build_object(
        'migrated_at', NOW(),
        'original_table', 'plugin_cron'
    ),
    NOW(),
    NOW()
FROM plugin_cron
WHERE NOT EXISTS (
    SELECT 1 FROM cron_jobs
    WHERE source_type = 'plugin'
    AND source_id = plugin_cron.plugin_id
    AND name = plugin_cron.cron_name
);
```

---

## Table Removal Queries

### MASTER DB - Tables to Remove

```sql
-- ============================================
-- MASTER DATABASE CLEANUP
-- Run these AFTER migration is complete
-- ============================================

-- 1. Remove job_queue (duplicate of jobs table)
-- First, verify no pending jobs
SELECT COUNT(*) as pending_jobs FROM job_queue WHERE status = 'pending';

-- If no pending jobs, drop the table
DROP TABLE IF EXISTS job_queue CASCADE;

-- 2. Remove akeneo_schedules (migrated to tenant cron_jobs)
-- First, verify migration was successful
SELECT
    (SELECT COUNT(*) FROM akeneo_schedules) as original_count,
    (SELECT COUNT(*) FROM cron_jobs WHERE source_name = 'akeneo') as migrated_count;

-- If counts match, drop the table
DROP TABLE IF EXISTS akeneo_schedules CASCADE;

-- Also drop the enum types if they exist
DROP TYPE IF EXISTS enum_akeneo_schedules_import_type CASCADE;
DROP TYPE IF EXISTS enum_akeneo_schedules_schedule_type CASCADE;
DROP TYPE IF EXISTS enum_akeneo_schedules_status CASCADE;
```

### TENANT DB - Tables to Remove

```sql
-- ============================================
-- TENANT DATABASE CLEANUP
-- Run on EACH tenant database AFTER migration
-- ============================================

-- 1. Remove cron_job_types (use code constants instead)
DROP TABLE IF EXISTS cron_job_types CASCADE;

-- 2. Remove job_history (use cron_job_executions instead)
-- First, migrate any important history if needed
-- Then drop
DROP TABLE IF EXISTS job_history CASCADE;

-- 3. Remove plugin_cron (migrated to cron_jobs)
-- Verify migration first
SELECT
    (SELECT COUNT(*) FROM plugin_cron) as original_count,
    (SELECT COUNT(*) FROM cron_jobs WHERE source_type = 'plugin') as migrated_count;

-- If counts match, drop the table
DROP TABLE IF EXISTS plugin_cron CASCADE;

-- 4. Remove akeneo_schedules from tenant (if it exists there too)
DROP TABLE IF EXISTS akeneo_schedules CASCADE;
```

---

## Updated render.yaml

```yaml
services:
  # ... existing services ...

  # SINGLE Unified Cron Job (replaces multiple crons)
  - type: cron
    name: daino-unified-scheduler
    env: node
    rootDir: backend
    schedule: "0 * * * *"  # Every hour at minute 0
    buildCommand: npm install
    startCommand: node scripts/unified-scheduler.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: SUPABASE_DB_URL
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: INTEGRATION_ENCRYPTION_KEY
        sync: false
    autoDeploy: true

# REMOVE these separate crons:
# - daino-daily-credit-deduction (now handled by unified scheduler)
# - daino-token-refresh (now handled by unified scheduler)
```

---

## Summary of Changes

### Tables REMOVED from Master DB
| Table | Reason |
|-------|--------|
| `job_queue` | Duplicate of `jobs`, standardize on Sequelize model |
| `akeneo_schedules` | Migrated to tenant `cron_jobs` table |

### Tables REMOVED from Tenant DB
| Table | Reason |
|-------|--------|
| `cron_job_types` | Low value, use code constants |
| `job_history` | Duplicate of `cron_job_executions` |
| `plugin_cron` | Migrated to `cron_jobs` table |

### Tables KEPT
| Table | Location | Purpose |
|-------|----------|---------|
| `jobs` | Master DB | Background job queue |
| `cron_jobs` | Tenant DB | **Single source of truth for ALL schedules** |
| `cron_job_executions` | Tenant DB | Execution history |

### Cost Savings
- **Before:** 2 Render crons = ~$2/month minimum
- **After:** 1 Render cron = ~$1/month minimum
- **Savings:** 50% on cron costs

### Reliability Improvement
- External trigger (Render cron) guarantees execution
- No missed jobs during server restarts
- Single entry point for all scheduled tasks
