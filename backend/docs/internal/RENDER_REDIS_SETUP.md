# Setting Up Redis/BullMQ on Render.com

## Problem Found

Your `render.yaml` was **referencing** `daino-redis` but not **defining** it. This caused:
- ❌ No Redis service created
- ❌ BullMQ initialization failing silently
- ❌ System falling back to database queue
- ❌ No logs in Redis (because it doesn't exist)

## Solution: Two Options

### Option 1: Use render.yaml (Recommended)

I've already updated your `render.yaml` to include the Redis database definition.

**What was changed:**
```yaml
# Before (lines 185-187):
# Key-Value Store (Redis) - Managed by Render
# Note: Render uses "Key-Value Store" for Redis
# This will be created automatically on deployment

# After:
# Key-Value Store (Redis) - Managed by Render
databases:
  - name: daino-redis
    plan: free
    region: oregon
```

**Next Steps:**
1. Commit and push the updated render.yaml
2. Render will automatically create the Redis instance
3. Redeploy your services to pick up the new Redis connection

```bash
git add render.yaml
git commit -m "fix: Add Redis database definition to render.yaml for BullMQ support"
git push
```

After deployment, check logs for:
- ✅ "BullMQ: Redis connection established"
- ✅ "✅ BullMQ initialized - using persistent queue"
- ✅ "🚀 Starting BullMQ workers..."

### Option 2: Manual Setup in Render Dashboard

If you prefer to set it up manually or need a different plan:

1. **Create Redis Instance:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Redis"
   - Settings:
     - Name: `daino-redis`
     - Plan: Choose (Free tier: 25MB, Paid: $10+/month)
     - Region: **Same as your backend** (important for low latency)
     - Maxmemory Policy: `allkeys-lru` (recommended)
   - Click "Create Redis"

2. **Wait for Provisioning:**
   - Redis will show "Creating..." then "Available"
   - This takes 1-2 minutes

3. **Link to Backend Service:**
   - Go to your `daino-backend` service
   - Click "Environment" tab
   - The `REDIS_URL` should already be linked (via render.yaml)
   - If not, click "Add Environment Variable":
     - Key: `REDIS_URL`
     - Value: Select "Link to Redis" → Choose `daino-redis`
   - Verify `REDIS_ENABLED=true` exists

4. **Link to Worker Service:**
   - Go to your `daino-background-worker` service
   - Repeat step 3

5. **Manual Redeploy:**
   - Click "Manual Deploy" → "Deploy latest commit" on both services

## Verification Steps

### 1. Check Redis Service
- Go to Render Dashboard
- You should now see `daino-redis` in your services list
- Status should be "Available"
- Click on it to see:
  - Connection string
  - Memory usage (should be very low initially)
  - Version (usually Redis 7.x)

### 2. Check Backend Logs
```
# Should see in daino-backend logs:
🔧 Initializing Background Job Manager...
BullMQ: Redis connection established
✅ BullMQ initialized - using persistent queue
🚀 Starting BullMQ workers...
BullMQ: Created worker for akeneo:import:products
BullMQ: Created worker for system:cleanup
[... more workers ...]
```

### 3. Check Worker Logs
```
# Should see in daino-background-worker logs:
🔧 Starting Background Job Worker...
🔧 Initializing Background Job Manager...
BullMQ: Redis connection established
✅ BullMQ initialized - using persistent queue
🚀 Starting BullMQ workers...
✅ Background Job Worker is running...
📊 Processing jobs every 5 seconds
```

### 4. Check for Errors
If you still see:
```
ℹ️ BullMQ not available - using database queue
```

**Troubleshooting:**
1. Check `REDIS_URL` is set in environment variables
2. Check `REDIS_ENABLED=true` is set
3. Check Redis service is in same region as backend
4. Check Redis service status is "Available"
5. Verify no firewall/network issues

## Redis Plans & Pricing

| Plan | Memory | Connections | Price | Use Case |
|------|--------|-------------|-------|----------|
| Free | 25 MB | 10 | $0/mo | Development, testing |
| Starter | 256 MB | 25 | $10/mo | Small production apps |
| Standard | 1 GB | 50 | $25/mo | Medium production apps |
| Pro | 4 GB | 100 | $90/mo | Large production apps |

**Recommendation:**
- Start with **Free tier** for development/staging
- Monitor memory usage in Render dashboard
- Upgrade when you see:
  - Memory usage > 80%
  - Connection limit errors
  - Performance degradation

## What BullMQ Does

With BullMQ/Redis properly configured:

1. **Persistent Job Queue:**
   - Jobs survive server restarts
   - Jobs survive deployments
   - No lost jobs during downtime

2. **Better Performance:**
   - Redis is in-memory (much faster than database)
   - Dedicated worker processes
   - Better concurrency control

3. **Advanced Features:**
   - Job prioritization
   - Delayed/scheduled jobs
   - Automatic retries with backoff
   - Progress tracking
   - Job events and monitoring

4. **Scalability:**
   - Can add multiple worker instances
   - Horizontal scaling
   - Better resource utilization

## Testing After Setup

### Test 1: Create a Test Job
```bash
# Via your backend API (if you have a job creation endpoint)
curl -X POST https://backend.dainostore.com/api/jobs/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "system:cleanup",
    "payload": {},
    "priority": "normal"
  }'
```

### Test 2: Check Job Processing
```bash
# Check backend logs
# Should see:
BullMQ: Added job 123 to queue system:cleanup
BullMQ: Processing job 123 of type system:cleanup
BullMQ: Job 123 completed successfully
```

### Test 3: Check Database
```sql
-- In your Supabase SQL editor:
SELECT id, type, status, progress, created_at, updated_at
FROM jobs
WHERE type = 'system:cleanup'
ORDER BY created_at DESC
LIMIT 5;
```

## Monitoring

### Redis Metrics in Render Dashboard:
- **Memory Usage**: Should stay under plan limit
- **Connected Clients**: Number of active connections
- **Commands/sec**: Redis operations per second
- **Hit Rate**: Cache efficiency (if using caching)

### BullMQ Metrics (via your code):
```javascript
// Add this to an admin endpoint
const bullMQManager = require('./src/core/BullMQManager');

// Get all queue statistics
const stats = await bullMQManager.getAllQueueStats();
console.log(stats);

// Output example:
{
  'akeneo:import:products': {
    waiting: 2,
    active: 1,
    completed: 150,
    failed: 3,
    delayed: 0,
    total: 156
  },
  'system:cleanup': {
    waiting: 0,
    active: 0,
    completed: 50,
    failed: 0,
    delayed: 0,
    total: 50
  }
}
```

## Common Issues & Solutions

### Issue 1: "ECONNREFUSED" errors
**Cause:** Redis service not running or wrong URL
**Solution:**
- Check Redis service status in Render dashboard
- Verify REDIS_URL environment variable
- Restart backend and worker services

### Issue 2: "Maximum number of clients reached"
**Cause:** Too many connections to Redis
**Solution:**
- Upgrade Redis plan (more connections)
- Check for connection leaks in code
- Reduce number of worker instances

### Issue 3: "OOM command not allowed"
**Cause:** Redis out of memory
**Solution:**
- Upgrade Redis plan (more memory)
- Check maxmemory policy (should be allkeys-lru)
- Review job data size

### Issue 4: Jobs not processing
**Cause:** Worker service not running or not connected
**Solution:**
- Check daino-background-worker service is running
- Check worker logs for errors
- Verify worker has REDIS_URL environment variable
- Restart worker service

## Rollback Plan

If Redis causes issues, you can temporarily disable it:

1. **In Render Dashboard:**
   - Set `REDIS_ENABLED=false` on both services
   - Redeploy

2. **System will automatically:**
   - Fall back to database queue
   - Continue processing jobs (slower)
   - No data loss (jobs are always in database)

## Next Steps After Setup

1. ✅ Verify Redis is created and available
2. ✅ Check logs show BullMQ initialization
3. ✅ Test job creation and processing
4. ✅ Monitor memory usage over time
5. ✅ Set up alerts for Redis issues
6. ✅ Plan for Redis plan upgrade if needed

## Redis is NOT Creating Logs

**Important:** Redis itself doesn't create application logs. What you should see:

- ✅ **Backend logs**: BullMQ connection messages
- ✅ **Worker logs**: Job processing messages
- ❌ **Redis logs**: Only system-level Redis errors (rare)

Redis is a data store, not an application. You won't see "job completed" logs in Redis - those appear in your backend/worker service logs.
