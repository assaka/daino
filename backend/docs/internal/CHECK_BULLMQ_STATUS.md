# How to Check if BullMQ is Running on Render.com

## 1. Check Render.com Dashboard

### A. Check Redis Service Status
1. Go to https://dashboard.render.com
2. Navigate to your project
3. Look for `daino-redis` (Key-Value Store)
4. Status should be "Available"
5. Note the connection string

### B. Check Backend Service Logs
1. Click on `daino-backend` service
2. Go to "Logs" tab
3. Look for these startup messages:
   ```
   ✅ BullMQ initialized - using persistent queue
   🔧 Initializing Background Job Manager...
   🚀 Starting BullMQ workers...
   ```
4. If you see "BullMQ not available - using database queue", Redis connection failed

### C. Check Background Worker Service
1. Click on `daino-background-worker` service
2. Check logs for:
   ```
   BullMQ: Created worker for [job-type]
   BullMQ: Job [id] completed
   ```

## 2. Check via Backend API

### Check Redis Connection
```bash
# Check if Redis is enabled
curl https://backend.dainostore.com/api/health

# Or if you have a jobs status endpoint:
curl https://backend.dainostore.com/api/jobs/status
```

### Check Database for Jobs
```bash
# Query your jobs table to see if jobs are being processed
# Connect to your Supabase database and run:
SELECT * FROM jobs ORDER BY created_at DESC LIMIT 10;
SELECT * FROM cron_jobs WHERE is_active = true;
```

## 3. Check Environment Variables

### In Render Dashboard:
1. Go to `daino-backend` service
2. Click "Environment" tab
3. Verify:
   - ✅ `REDIS_ENABLED=true`
   - ✅ `REDIS_URL` is set (should be auto-populated from daino-redis)
   - ✅ `SERVICE_TYPE=main`

4. Go to `daino-background-worker` service
5. Verify:
   - ✅ `REDIS_ENABLED=true`
   - ✅ `REDIS_URL` is set
   - ✅ `SERVICE_TYPE=worker`

## 4. Test BullMQ Locally

### Local Testing (development):
```bash
cd backend

# Check if BullMQ can connect
node -e "
const bullMQManager = require('./src/core/BullMQManager');
bullMQManager.initialize().then(result => {
  console.log('BullMQ initialized:', result);
  if (result) {
    console.log('✅ BullMQ is working!');
  } else {
    console.log('❌ BullMQ failed to initialize');
  }
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
"
```

## 5. Common Issues

### Issue: Redis not connecting
**Symptoms:**
- Logs show "BullMQ not available - using database queue"
- No worker messages in logs

**Solutions:**
1. Check Redis service is running in Render dashboard
2. Verify `REDIS_URL` environment variable is set
3. Check Redis service hasn't been paused or deleted
4. Verify network connectivity between services

### Issue: Jobs not being processed
**Symptoms:**
- Jobs stuck in "pending" status
- No "Job completed" messages in logs

**Solutions:**
1. Check `daino-background-worker` service is running
2. Check worker logs for errors
3. Verify job types are registered (see BackgroundJobManager.js:76-110)
4. Check database connection in worker service

### Issue: Cron jobs not triggering
**Symptoms:**
- Database-driven cron jobs not executing at scheduled time
- No cron job execution records

**Solutions:**
1. Check CronScheduler is started (look for "🕒 Starting cron scheduler..." in logs)
2. Verify cron jobs exist in database: `SELECT * FROM cron_jobs WHERE is_active = true`
3. Check `next_run_at` field is in the future
4. Verify `is_paused = false`

## 6. How to Install/Configure Redis on Render.com

### Option A: Using render.yaml (Recommended)
Your `render.yaml` already includes Redis configuration. When you deploy:

1. Push your code with render.yaml
2. Render will automatically:
   - Create a Redis instance named `daino-redis`
   - Link it to your services via `REDIS_URL`

### Option B: Manual Setup in Dashboard

1. **Create Redis Instance:**
   - Go to Render dashboard
   - Click "New +" → "Redis"
   - Name: `daino-redis`
   - Plan: Choose based on needs (Free tier available)
   - Region: Same as your backend service
   - Click "Create Redis"

2. **Link to Backend Service:**
   - Go to `daino-backend` service
   - Click "Environment" tab
   - Add new environment variable:
     - Key: `REDIS_URL`
     - Value: Click "Add from Redis" → Select `daino-redis`
   - Add: `REDIS_ENABLED=true`

3. **Link to Worker Service:**
   - Go to `daino-background-worker` service
   - Repeat step 2 above

4. **Redeploy Services:**
   - Both services will restart with new Redis connection

## 7. Verify BullMQ is Working

### Create a test job:
```bash
# Via API (if you have an endpoint)
curl -X POST https://backend.dainostore.com/api/jobs/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "type": "system:cleanup",
    "payload": {},
    "priority": "normal"
  }'
```

### Check job status:
1. Look for job in logs
2. Check database:
   ```sql
   SELECT id, type, status, progress, created_at, updated_at
   FROM jobs
   ORDER BY created_at DESC
   LIMIT 5;
   ```

## 8. BullMQ Queue Statistics

If BullMQ is running, you can check queue stats programmatically:

```javascript
// In your backend code or via admin endpoint
const bullMQManager = require('./src/core/BullMQManager');
const stats = await bullMQManager.getAllQueueStats();
console.log(stats);
// Output:
// {
//   'akeneo:import:products': { waiting: 0, active: 1, completed: 45, failed: 2, delayed: 0 },
//   'system:cleanup': { waiting: 0, active: 0, completed: 10, failed: 0, delayed: 0 }
// }
```

## 9. Monitoring Checklist

✅ Redis service is "Available" in Render dashboard
✅ Backend logs show "BullMQ initialized"
✅ Worker service is running and processing jobs
✅ Cron scheduler is started ("🕒 Starting cron scheduler...")
✅ Test job completes successfully
✅ No repeated connection errors in logs

## 10. Cost Considerations

- **Redis Free Tier**: 25MB storage, 10 connections
- **Paid Tiers**: Start at $10/month for 256MB
- **Recommendation**: Start with free tier, upgrade if you see:
  - Memory usage warnings
  - Connection limit errors
  - Performance degradation
