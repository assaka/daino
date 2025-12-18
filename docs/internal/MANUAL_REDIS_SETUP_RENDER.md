# How to Manually Add Redis/BullMQ to Render.com

## Quick Answer About Your Questions

### 1. BullMQ and Crons
**BullMQ handles both:**
- ✅ **Scheduled/Delayed Jobs**: Like UI label translations that are queued for background processing
- ✅ **Recurring Cron Jobs**: Database-driven cron jobs checked every 60 seconds by CronScheduler

**But NOT:**
- ❌ Render Native Cron Jobs (defined in render.yaml with `type: cron`)

### 2. UI Labels Translation Queue Flow
```
User clicks "Translate All" in UI
       ↓
POST /api/translations/ui-labels/bulk
       ↓
jobManager.scheduleJob({
  type: 'translation:ui-labels:bulk',
  payload: { fromLang, toLang, storeId, userId }
})
       ↓
Job saved to database (jobs table)
       ↓
If BullMQ available:
  → Added to Redis queue 'translation:ui-labels:bulk'
  → Background worker picks it up
  → UILabelsBulkTranslationJob.execute() runs
  → Translates labels in batches of 10
  → Updates progress in real-time
       ↓
If BullMQ NOT available:
  → Database polling every 5 seconds
  → Main server processes it (slower, not persistent)
```

---

## Manual Redis Setup on Render.com (Step-by-Step)

### Step 1: Create Redis Instance

1. **Go to Render Dashboard**
   - Navigate to https://dashboard.render.com
   - Make sure you're in the correct team/project

2. **Create New Redis**
   - Click the blue **"New +"** button (top right)
   - Select **"Redis"** from the dropdown

3. **Configure Redis**
   ```
   Name: daino-redis
   Region: Oregon (US West) ← Choose same region as your backend!
   Plan: Free (25MB, 10 connections) ← Start here
   Maxmemory Policy: allkeys-lru ← Recommended
   ```

4. **Create**
   - Click **"Create Redis"**
   - Wait 1-2 minutes for provisioning
   - Status will change from "Creating..." to "Available"

5. **Copy Connection String**
   - Once available, click on `daino-redis`
   - You'll see: **Internal Redis URL** and **External Redis URL**
   - Copy the **Internal Redis URL** (faster, more secure)
   - Format: `redis://red-xxxxxxxxxxxxx:6379`

### Step 2: Link Redis to Backend Service

1. **Go to Backend Service**
   - In Render dashboard, click on **`daino-backend`**

2. **Add Environment Variable**
   - Click **"Environment"** tab (left sidebar)
   - Scroll to bottom, click **"Add Environment Variable"**

3. **Add REDIS_URL**
   - Click **"Add from Redis"** button
   - Select **`daino-redis`** from dropdown
   - It will create:
     ```
     Key: REDIS_URL
     Value: redis://red-xxxxxxxxxxxxx:6379
     ```
   - This is automatically kept in sync with your Redis instance

4. **Verify REDIS_ENABLED**
   - Check if `REDIS_ENABLED` exists and equals `true`
   - If not, add it manually:
     ```
     Key: REDIS_ENABLED
     Value: true
     ```

5. **Save Changes**
   - Click **"Save Changes"** button
   - Service will automatically redeploy (takes 3-5 minutes)

### Step 3: Link Redis to Worker Service

1. **Go to Worker Service**
   - In Render dashboard, click on **`daino-background-worker`**

2. **Repeat Step 2**
   - Add REDIS_URL from daino-redis
   - Verify REDIS_ENABLED=true
   - Save changes

3. **Wait for Deployment**
   - Both services will redeploy automatically
   - This ensures they both connect to the same Redis

### Step 4: Verify Setup

#### A. Check Redis Service
1. Click on **`daino-redis`** in dashboard
2. You should see:
   - ✅ Status: Available
   - ✅ Memory Used: ~1-2 MB (very low initially)
   - ✅ Connected Clients: 2-4 (backend + worker)
   - ✅ Commands/sec: Should show activity when jobs run

#### B. Check Backend Logs
1. Go to **`daino-backend`** → **Logs** tab
2. Look for these lines (scroll to recent deployment):
   ```
   ==> Building...
   ==> Starting service...
   🔧 Initializing Background Job Manager...
   BullMQ: Redis connection established  ← KEY LINE
   ✅ BullMQ initialized - using persistent queue  ← KEY LINE
   🚀 Starting BullMQ workers...
   BullMQ: Created worker for akeneo:import:products
   BullMQ: Created worker for translation:ui-labels:bulk
   BullMQ: Created worker for system:cleanup
   [... more workers ...]
   ✅ Background Job Manager initialized
   🕒 Starting cron scheduler...
   ✅ Cron scheduler started
   ```

3. **If you see instead:**
   ```
   BullMQ: Redis not configured, falling back to database queue
   ℹ️ BullMQ not available - using database queue
   ```
   → Redis is NOT connected. Go back and check REDIS_URL is set correctly.

#### C. Check Worker Logs
1. Go to **`daino-background-worker`** → **Logs** tab
2. Look for:
   ```
   🔧 Starting Background Job Worker...
   🔧 Initializing Background Job Manager...
   BullMQ: Redis connection established  ← KEY LINE
   ✅ BullMQ initialized - using persistent queue
   🚀 Starting BullMQ workers...
   ✅ Background Job Worker is running...
   📊 Processing jobs every 5 seconds
   ```

#### D. Test with a Job
1. **Trigger a translation job** (via your UI or API):
   ```bash
   curl -X POST https://backend.dainostore.com/api/translations/ui-labels/bulk \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "from_lang": "en",
       "to_lang": "es",
       "store_id": 1
     }'
   ```

2. **Check logs immediately**:
   - Backend logs should show:
     ```
     🚀 Scheduling UI labels translation job: en → es
     BullMQ: Added job 123 to queue translation:ui-labels:bulk
     ```
   - Worker logs should show:
     ```
     BullMQ: Processing job 123 of type translation:ui-labels:bulk
     Starting UI labels bulk translation: en → es for store 1
     [... translation progress ...]
     BullMQ: Job 123 completed successfully
     ```

### Step 5: Monitor and Maintain

#### Redis Metrics
- Go to **`daino-redis`** in dashboard
- Monitor:
  - **Memory Usage**: Should stay well under 25MB on free tier
  - **Connected Clients**: Should be 2-4 normally (backend + worker)
  - **Commands/sec**: Increases when jobs are active

#### Set Up Alerts (Optional)
1. In `daino-redis` settings
2. Click **"Notifications"**
3. Add email alerts for:
   - Memory usage > 80%
   - Service unavailable
   - High error rate

#### When to Upgrade Redis
Upgrade from Free → Starter ($10/mo) when:
- Memory usage consistently > 20MB (80%)
- You see "OOM command not allowed" errors
- More than 10 concurrent connections needed
- Job processing becomes slow

---

## Troubleshooting

### Problem 1: "ECONNREFUSED" Error
**Logs show:**
```
Error: connect ECONNREFUSED
BullMQ: Failed to initialize: connect ECONNREFUSED
```

**Solutions:**
1. Check Redis service status is "Available"
2. Verify REDIS_URL is set correctly (no typos)
3. Check Redis is in same region as backend
4. Try using External Redis URL instead of Internal
5. Restart both backend and worker services

### Problem 2: Still Using Database Queue
**Logs show:**
```
ℹ️ BullMQ not available - using database queue
```

**Solutions:**
1. Check `REDIS_ENABLED=true` (not "false" or missing)
2. Check REDIS_URL exists and is not empty
3. Check Redis service is running (not stopped)
4. Check for typos in environment variable names
5. Check logs for connection errors earlier in startup

### Problem 3: Jobs Not Processing
**Symptoms:**
- Jobs created but stuck in "pending"
- No worker log activity

**Solutions:**
1. Check `daino-background-worker` service is running
2. Check worker service has REDIS_URL set
3. Check worker logs for startup errors
4. Verify job type is registered (check BackgroundJobManager.js:76-110)
5. Manually trigger redeploy of worker service

### Problem 4: High Memory Usage
**Redis dashboard shows memory near limit**

**Solutions:**
1. Check for stuck/failed jobs piling up
2. Clean up old completed jobs:
   ```sql
   DELETE FROM jobs WHERE status = 'completed' AND updated_at < NOW() - INTERVAL '7 days';
   ```
3. Review job data size (keep payloads small)
4. Upgrade to larger Redis plan

### Problem 5: Connection Limit Reached
**Logs show:**
```
Error: Maximum number of clients reached
```

**Solutions:**
1. Check for connection leaks (connections not closing)
2. Reduce number of worker instances
3. Check SERVICE_TYPE is set correctly (main vs worker)
4. Upgrade Redis plan for more connections

---

## Alternative: Using render.yaml (Recommended for Teams)

Instead of manual setup, I already updated your `render.yaml` to include Redis:

```yaml
databases:
  - name: daino-redis
    plan: free
    region: oregon
```

**Benefits:**
- ✅ Redis created automatically on deployment
- ✅ Automatically linked to services
- ✅ Version controlled (in git)
- ✅ Easy to replicate across environments

**To use:**
```bash
git add render.yaml
git commit -m "fix: Add Redis database definition for BullMQ"
git push
```

Render will automatically:
1. Create `daino-redis` instance
2. Link it to `daino-backend` and `daino-background-worker`
3. Set REDIS_URL environment variables
4. Redeploy services with Redis connection

---

## What Happens After Redis is Connected

### Before (Database Queue):
```
User action → API → Database job record → Poll every 5s → Process in main server
❌ Jobs lost on restart
❌ Slow polling
❌ No persistence across deployments
```

### After (BullMQ/Redis):
```
User action → API → Database + Redis queue → Worker picks up instantly → Process
✅ Jobs survive restarts
✅ Instant processing
✅ Persistent across deployments
✅ Better concurrency
✅ Progress tracking
✅ Advanced features (priority, delays, retries)
```

---

## Summary Checklist

After completing manual setup, verify:

- [ ] Redis service `daino-redis` exists and is "Available"
- [ ] `daino-backend` has REDIS_URL and REDIS_ENABLED=true
- [ ] `daino-background-worker` has REDIS_URL and REDIS_ENABLED=true
- [ ] Backend logs show "BullMQ: Redis connection established"
- [ ] Worker logs show "BullMQ: Redis connection established"
- [ ] Backend logs show multiple "BullMQ: Created worker for..." messages
- [ ] Test job processes successfully (check logs)
- [ ] Redis shows 2-4 connected clients
- [ ] No ECONNREFUSED or connection errors in logs

If all checked, BullMQ is properly configured and running! 🎉

---

## Cost Summary

| Setup | Cost | Best For |
|-------|------|----------|
| Free Redis | $0/mo | Development, testing, small apps |
| Starter Redis | $10/mo | Production apps with moderate traffic |
| render.yaml method | $0/mo (same plans) | Teams, version control, multiple environments |
| Manual method | $0/mo (same plans) | Quick setup, learning, one-off projects |

**Recommendation:** Use render.yaml method (already done) for production. Use manual for quick testing.
