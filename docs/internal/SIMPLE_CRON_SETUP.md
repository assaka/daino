

# Simple Single-Cron Architecture

## Overview

Instead of multiple cron services or a 24/7 worker, we use **one simple cron** that runs every minute and triggers an endpoint on your backend. The endpoint processes whatever jobs are pending.

**Benefits:**
- ✅ One cron service instead of 3-4 separate ones
- ✅ Easy to manage and monitor
- ✅ Backend handles all job logic (centralized)
- ✅ Can also use database-driven crons (already have CronScheduler)
- ✅ Very cost effective (~$0.82/month)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Every Minute                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Render Cron (daino-job-processor)                        │
│  ├─ Runs: node scripts/trigger-job-processor.cjs            │
│  ├─ Does: HTTP POST to backend endpoint                      │
│  └─ With: X-Cron-Secret header for security                 │
│                     ↓                                         │
│  Backend Endpoint (POST /api/jobs/process-pending)          │
│  ├─ Verifies cron secret                                     │
│  ├─ Queries database for pending jobs                        │
│  ├─ Processes up to 10 jobs (50 second limit)               │
│  ├─ Handles: translations, imports, exports, plugins        │
│  └─ Returns: { processed, failed, duration }                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Setup Steps

### 1. Add CRON_SECRET Environment Variable

**In Render Dashboard:**

1. Go to `daino-backend` service
2. Click "Environment" tab
3. Add new variable:
   - Key: `CRON_SECRET`
   - Value: Generate a strong secret (e.g., `openssl rand -hex 32`)
   - Example: `a8f5f167f44f4964e6c998dee827110c47840f33d0c0b70b7d0f6c8e3d9e3f8a`

4. Save changes

### 2. Create the Cron Service on Render

**Manual Setup:**

1. Click "New +" → "Cron Job"
2. **Name:** `daino-job-processor`
3. **Schedule:** `* * * * *` (every minute)
4. **Root Directory:** `backend`
5. **Build Command:** `npm install`
6. **Start Command:** `node scripts/trigger-job-processor.cjs`

7. **Environment Variables:**
   - `NODE_ENV` = `production`
   - `BACKEND_URL` = `https://backend.dainostore.com`
   - `CRON_SECRET` = (same value as in backend)

8. Click "Create Cron Job"

**Or via render.yaml (already configured):**

Just push the updated `render.yaml` to deploy:

```bash
git add render.yaml backend/scripts/trigger-job-processor.cjs backend/src/routes/job-processor.js backend/src/server.js
git commit -m "feat: Add single universal job processor cron"
git push
```

### 3. Verify It's Working

**Check Cron Logs:**
1. Go to `daino-job-processor` in Render dashboard
2. Click "Logs"
3. Wait for next minute
4. Should see:
   ```
   🔄 Triggering job processor endpoint...
   ✅ Job processor completed successfully
   - Processed: 0 job(s)
   - Duration: 234ms
   ```

**Check Backend Logs:**
1. Go to `daino-backend` in Render dashboard
2. Click "Logs"
3. Should see every minute:
   ```
   🔍 Processing pending jobs...
   ℹ️ No pending jobs to process
   ```

**Test with Real Job:**
1. Trigger a UI labels translation via your app
2. Check backend logs - should see:
   ```
   🔍 Processing pending jobs...
   📋 Found 1 pending job(s)
   🚀 Processing job 123: translation:ui-labels:bulk
   ✅ Job 123 completed
   📊 Summary: { processed: 1, duration: 3420ms }
   ```

## How It Works

### Job Creation Flow

```
User clicks "Translate All UI Labels"
    ↓
POST /api/translations/ui-labels/bulk
    ↓
Backend creates job in database:
    type: 'translation:ui-labels:bulk'
    status: 'pending'
    payload: { userId, storeId, fromLang, toLang }
    ↓
Response: "Translation queued. You'll receive an email."
    ↓
[Wait 0-60 seconds for next cron run]
    ↓
Cron triggers → Endpoint processes → Email sent
```

### What Gets Processed

The endpoint handles **all job types**:
- ✅ UI labels translations
- ✅ Shopify imports (collections, products)
- ✅ Amazon exports and inventory syncs
- ✅ eBay exports
- ✅ Akeneo imports (products, categories, attributes)
- ✅ Plugin installs/uninstalls/updates

### Processing Priority

Jobs are processed in this order:
1. **Priority level** (urgent → high → normal → low)
2. **Creation time** (oldest first)

```sql
ORDER BY priority ASC, created_at ASC
```

### Concurrent Jobs

- Processes **up to 10 jobs per run**
- One at a time (sequential, not parallel)
- Takes ~50 seconds max
- Remaining jobs wait for next minute

## Alternative: Database-Driven Crons

You **already have** a CronScheduler system! You can use that instead:

### Option 1: Use Existing CronScheduler

Your `CronScheduler` (backend/src/services/cron-scheduler.js) already:
- Checks database every 60 seconds for due cron jobs
- Creates jobs in the queue automatically
- Started by BackgroundJobManager

**To use it:**

1. **Create a cron job in database:**

```sql
INSERT INTO cron_jobs (
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    configuration,
    is_active,
    next_run_at,
    created_at,
    updated_at
) VALUES (
    'Process All Pending Jobs',
    'Processes all pending background jobs every minute',
    '* * * * *',  -- Every minute
    'UTC',
    'system:process_pending_jobs',
    '{}',
    true,
    NOW(),
    NOW(),
    NOW()
);
```

2. **Create a job handler** for `system:process_pending_jobs`:

```javascript
// backend/src/core/jobs/ProcessPendingJobsJob.js
class ProcessPendingJobsJob extends BaseJobHandler {
  async execute() {
    // Process pending jobs (same logic as endpoint)
    const jobs = await Job.findAll({ where: { status: 'pending' }, limit: 10 });
    // ... process each job
    return { processed: jobs.length };
  }
}
```

3. **Register it** in BackgroundJobManager:

```javascript
this.registerJobType('system:process_pending_jobs', require('./jobs/ProcessPendingJobsJob'));
```

**Benefits:**
- ✅ No Render cron needed at all!
- ✅ Managed entirely in database
- ✅ Can enable/disable/modify from admin UI
- ✅ Full history and logs in database

**Tradeoff:**
- Requires BackgroundJobManager running in backend
- Currently checks every 60 seconds (hardcoded)
- Less isolated than Render cron

### Option 2: Hybrid (Recommended)

Use **both**:

1. **Render Cron** → Processes jobs via endpoint (primary)
2. **Database Crons** → User-configurable scheduled tasks (secondary)

```
Render Cron (every minute)
  → Processes immediate jobs (translations, imports)

Database Crons (various schedules)
  → Daily reports at 9 AM
  → Weekly backups on Sunday
  → Monthly invoices on 1st
  → Custom schedules per store
```

## Monitoring

### Check Job Queue Status

**Via API:**
```bash
curl https://backend.dainostore.com/api/jobs/status
```

**Response:**
```json
{
  "queue": {
    "pending": 3,
    "running": 1,
    "completed_24h": 127,
    "failed_24h": 2
  },
  "healthy": true
}
```

### Check for Stuck Jobs

```sql
-- Jobs pending for more than 5 minutes
SELECT id, type, status, created_at, retry_count
FROM jobs
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at ASC;
```

### Monitor Failed Jobs

```sql
-- Failed jobs in last 24 hours
SELECT id, type, error_message, retry_count, updated_at
FROM jobs
WHERE status = 'failed'
  AND updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;
```

## Cost Analysis

### Current Setup
- **Render Cron:** ~84 hours/month = $0.82/mo
- **Backend:** Included (already running)
- **Redis:** $0 (free tier)
- **Total:** ~$0.82/month

### Comparison to Alternatives
- **24/7 Worker:** $7/mo (8.5x more expensive)
- **Multiple Crons:** $2-3/mo (harder to manage)
- **Database-only:** $0 extra (but less isolated)

## Security

### Cron Secret

The endpoint is protected by `X-Cron-Secret` header:

```javascript
// In cron script
headers: {
  'X-Cron-Secret': process.env.CRON_SECRET
}

// In endpoint
const cronSecret = req.headers['x-cron-secret'];
if (cronSecret !== process.env.CRON_SECRET) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

**Best practices:**
- Use a strong random secret (32+ characters)
- Store in environment variables (never in code)
- Same secret in both cron and backend
- Rotate periodically

### Generate Secret

```bash
# Linux/Mac
openssl rand -hex 32

# Or use online generator
# https://www.uuidgenerator.net/
```

## Troubleshooting

### Cron Not Triggering
**Symptom:** No logs every minute

**Solutions:**
- Check cron service is "Live" in Render
- Verify schedule is `* * * * *`
- Check build didn't fail
- Manual deploy: "Deploy latest commit"

### Endpoint Returning 403
**Symptom:** "Forbidden" error in cron logs

**Solutions:**
- Verify `CRON_SECRET` matches in both places
- Check secret has no extra spaces/newlines
- Re-save environment variables

### Jobs Not Processing
**Symptom:** Jobs stuck in "pending"

**Solutions:**
- Check backend logs for errors
- Verify job type has a registered handler
- Check database connection
- Look for errors in job execution

### Timeout Errors
**Symptom:** Cron fails after 60 seconds

**Solutions:**
- Script has 55s timeout built-in
- Endpoint has 50s processing limit
- Long jobs split across multiple runs
- Consider increasing frequency for busy periods

## Advanced: Adjust Frequency

### More Frequent (Every 30 seconds)

Render doesn't support < 1 minute, but you can:

**Option A: Two crons offset by 30s**
```yaml
- schedule: "* * * * *"  # Runs at :00
- schedule: "* * * * *"  # Can't offset, Render limitation
```

Not possible with Render crons.

**Option B: Use database cron (every 30s check)**

Modify CronScheduler.js:
```javascript
this.checkInterval = 30000; // 30 seconds instead of 60
```

### Less Frequent (Every 5 minutes)

```yaml
schedule: "*/5 * * * *"
```

Saves cost but increases latency.

## Summary

**What You Have:**
1. One Render cron (`daino-job-processor`) - runs every minute
2. One endpoint (`POST /api/jobs/process-pending`) - processes jobs
3. One secret (`CRON_SECRET`) - secures the endpoint

**How to Use:**
- Jobs automatically processed when created
- 0-60 second latency (average 30s)
- Email notifications when complete
- Monitor via `/api/jobs/status`

**Cost:** $0.82/month (vs $7/mo for worker)

**Ready to deploy!** 🚀
