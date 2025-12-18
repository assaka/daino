# Manual Instructions: Creating Translation Cron on Render.com

## Step-by-Step: Create Translation Processor Cron

### Step 1: Access Render Dashboard

1. Go to https://dashboard.render.com
2. Log in to your account
3. Select your project/team (if applicable)
4. You should see your existing services listed

### Step 2: Create New Cron Job

1. Click the blue **"New +"** button in the top right corner
2. From the dropdown menu, select **"Cron Job"**

### Step 3: Connect Repository

1. **Connect a repository:**
   - If your repo is already connected, select it from the list
   - If not connected:
     - Click **"Connect account"**
     - Authorize GitHub/GitLab
     - Select your `daino` repository

2. **Configure repository settings:**
   - Repository: `your-username/daino`
   - Branch: `main` (or your default branch)

### Step 4: Configure Basic Settings

Fill in the following fields:

**Name:**
```
daino-translation-processor
```

**Region:**
```
Oregon (US West)
```
*Choose the same region as your other services*

**Branch:**
```
main
```

**Root Directory:**
```
backend
```

**Environment:**
```
Node
```

### Step 5: Set the Schedule

**Schedule:**
```
* * * * *
```
*This runs every minute*

**Explanation of cron syntax:**
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-6, Sunday=0)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)

* = every
*/5 = every 5
0 = at zero
```

**Examples:**
- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour (at minute 0)
- `0 0 * * *` - Every day at midnight
- `0 9 * * 1` - Every Monday at 9 AM

### Step 6: Set Build Command

**Build Command:**
```
npm install
```

### Step 7: Set Start Command

**Start Command:**
```
node scripts/process-translation-jobs.cjs
```

### Step 8: Configure Environment Variables

Click **"Add Environment Variable"** for each of the following:

#### Required Variables:

**1. NODE_ENV**
- Key: `NODE_ENV`
- Value: `production`

**2. SUPABASE_URL**
- Key: `SUPABASE_URL`
- Click **"Sync from existing service"**
- Select: `daino-backend`
- Choose: `SUPABASE_URL`

**3. SUPABASE_ANON_KEY**
- Key: `SUPABASE_ANON_KEY`
- Sync from: `daino-backend`

**4. SUPABASE_SERVICE_ROLE_KEY**
- Key: `SUPABASE_SERVICE_ROLE_KEY`
- Sync from: `daino-backend`

**5. SUPABASE_DB_URL**
- Key: `SUPABASE_DB_URL`
- Sync from: `daino-backend`

**6. DATABASE_URL**
- Key: `DATABASE_URL`
- Sync from: `daino-backend`

**7. JWT_SECRET**
- Key: `JWT_SECRET`
- Sync from: `daino-backend`

**8. ANTHROPIC_API_KEY**
- Key: `ANTHROPIC_API_KEY`
- Sync from: `daino-backend`

#### Optional (Recommended):

**9. REDIS_URL** (if using Redis)
- Key: `REDIS_URL`
- Click **"Add from Redis"**
- Select: `daino-redis`

**10. REDIS_ENABLED**
- Key: `REDIS_ENABLED`
- Value: `true`

### Step 9: Advanced Settings (Optional)

**Auto-Deploy:**
- ✅ Enable **"Auto-Deploy"**
- This will redeploy the cron when you push code changes

**Notifications:**
- Configure email notifications for failures (optional)

### Step 10: Create the Cron Job

1. Review all settings
2. Click **"Create Cron Job"** button at the bottom
3. Render will:
   - Clone your repository
   - Run `npm install`
   - Schedule the cron
   - Status will show "Live" when ready

### Step 11: Verify It's Working

1. **Check Logs:**
   - Click on `daino-translation-processor`
   - Go to **"Logs"** tab
   - Wait up to 1 minute
   - You should see:
     ```
     ==> Running scheduled job at [timestamp]
     🔍 Checking for pending translation jobs...
     ✅ Database connected
     ℹ️ No pending translation jobs found
     🔌 Database connection closed
     ✅ Script completed successfully
     ```

2. **Check Schedule:**
   - In the service details, you'll see "Next Run" timestamp
   - This should be less than 1 minute away

## How Scheduled Jobs Are Triggered

### Database-Driven Job Flow

**1. Job Creation (User Action):**
```
User clicks "Translate All UI Labels"
    ↓
Frontend sends: POST /api/translations/ui-labels/bulk
    ↓
Backend creates job in database:
    INSERT INTO jobs (
        type,
        status,
        payload,
        created_at
    ) VALUES (
        'translation:ui-labels:bulk',
        'pending',
        '{"userId":1, "fromLang":"en", "toLang":"es"}',
        NOW()
    )
    ↓
Backend responds: "Translation queued. You'll receive an email."
    ↓
User continues working (doesn't wait)
```

**2. Cron Picks Up Job (Every Minute):**
```
Render triggers cron at: XX:YY:00 (every minute)
    ↓
Container starts
    ↓
npm install runs (if needed)
    ↓
node scripts/process-translation-jobs.cjs runs
    ↓
Script queries database:
    SELECT * FROM jobs
    WHERE type = 'translation:ui-labels:bulk'
      AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
    ↓
If job found:
    - Update status to 'running'
    - Process translation (call UILabelsBulkTranslationJob)
    - Update status to 'completed'
    - Send email to user
    ↓
If no job found:
    - Log "No pending jobs"
    - Exit
    ↓
Container exits
    ↓
Wait for next minute...
```

**3. Email Notification:**
```
Job completes
    ↓
UILabelsBulkTranslationJob sends email via emailService
    ↓
User receives:
    Subject: "Your UI Labels Translation is Complete"
    Body: "245 labels translated from English to Spanish"
    Link: View translations in dashboard
```

### Timing Examples

**Scenario 1: Job created at 2:47:23 PM**
```
2:47:23 PM - User triggers translation
2:47:23 PM - Job created in database (status: pending)
2:48:00 PM - Cron runs, picks up job
2:48:05 PM - Job starts processing (status: running)
2:51:30 PM - Job completes (status: completed)
2:51:31 PM - Email sent to user
```
**Total time: ~4 minutes** (37s wait + 3m25s processing)

**Scenario 2: Job created at 2:47:55 PM**
```
2:47:55 PM - User triggers translation
2:47:55 PM - Job created in database (status: pending)
2:48:00 PM - Cron runs, picks up job (5s wait!)
2:48:05 PM - Job starts processing
2:51:30 PM - Job completes
2:51:31 PM - Email sent
```
**Total time: ~3m36s** (5s wait + 3m31s processing)

**Best case:** 5 seconds wait
**Worst case:** 60 seconds wait
**Average:** 30 seconds wait

### Multiple Jobs Handling

**If multiple jobs are queued:**
```
2:47:00 PM - User A creates translation job (en→es)
2:47:15 PM - User B creates translation job (en→fr)
2:47:30 PM - User C creates translation job (en→de)

2:48:00 PM - Cron runs
              Picks up OLDEST job (User A's job)
              Processes it (~3 minutes)
              Exits

2:49:00 PM - Cron runs again
              Picks up next job (User B's job)
              Processes it (~3 minutes)
              Exits

2:50:00 PM - Cron runs again
              Picks up last job (User C's job)
              Processes it (~3 minutes)
              Exits
```

**Each job processed sequentially, one per minute.**

### How It's Different from Worker

**Worker (24/7 Service):**
```
Worker running continuously
    ↓
Listening to Redis/BullMQ queue
    ↓
Job added → Picked up INSTANTLY (< 1 second)
    ↓
Can process MULTIPLE jobs concurrently
    ↓
Real-time progress updates
```

**Cron (Scheduled Runs):**
```
Cron sleeps until scheduled time
    ↓
Wakes up every minute
    ↓
Checks database for jobs
    ↓
Processes ONE job per run
    ↓
Exits and sleeps again
    ↓
0-60 second wait time
```

## Testing the Cron

### Test 1: Create a Test Job Manually

**Via Database (Supabase SQL Editor):**
```sql
INSERT INTO jobs (
    type,
    status,
    payload,
    priority,
    max_retries,
    created_at,
    updated_at
) VALUES (
    'translation:ui-labels:bulk',
    'pending',
    '{
        "userId": 1,
        "userEmail": "test@example.com",
        "storeId": 1,
        "fromLang": "en",
        "toLang": "es"
    }'::jsonb,
    'normal',
    3,
    NOW(),
    NOW()
);
```

**Watch it get processed:**
1. Check Render logs for `daino-translation-processor`
2. Within 1 minute, you should see:
   ```
   🔍 Checking for pending translation jobs...
   📋 Found 1 pending translation job(s)
   🚀 Processing job 123: en → es
   [... translation progress ...]
   ✅ Job 123 completed successfully
   ```

### Test 2: Via API

**Trigger translation via your API:**
```bash
curl -X POST https://backend.dainostore.com/api/translations/ui-labels/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "from_lang": "en",
    "to_lang": "es",
    "store_id": 1
  }'
```

**Expected response:**
```json
{
  "message": "Translation job queued. You will receive an email when complete.",
  "jobId": 123,
  "estimatedTime": "1-2 minutes"
}
```

**Then check:**
1. Database: `SELECT * FROM jobs WHERE id = 123;`
2. Cron logs (within 1 minute)
3. Email inbox (after 3-5 minutes)

### Test 3: Check Job Status

**Query database:**
```sql
-- Check recent jobs
SELECT
    id,
    type,
    status,
    created_at,
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds
FROM jobs
WHERE type = 'translation:ui-labels:bulk'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected statuses:**
- `pending` - Waiting for cron to pick up
- `running` - Currently being processed
- `completed` - Finished successfully
- `failed` - Error occurred (will retry)

## Monitoring & Troubleshooting

### Check Cron is Running

**In Render Dashboard:**
1. Go to `daino-translation-processor`
2. Check status badge: Should be **"Live"** (green)
3. Check "Last Run": Should be less than 1 minute ago
4. Check "Next Run": Should be coming up soon

### Common Issues

**Issue 1: Cron not running**
- **Symptom:** "Last Run" is more than 1 minute ago
- **Solution:**
  - Check service status
  - Click "Manual Deploy" → "Deploy latest commit"
  - Check for build errors in logs

**Issue 2: Jobs stuck in 'pending' status**
- **Symptom:** Jobs created but never processed
- **Solutions:**
  1. Check cron logs for errors
  2. Verify database connection (check SUPABASE_DB_URL)
  3. Check script file exists: `backend/scripts/process-translation-jobs.cjs`
  4. Verify start command is correct

**Issue 3: Environment variable errors**
- **Symptom:** Logs show "undefined" or connection errors
- **Solution:**
  - Go to cron service → Environment tab
  - Verify all required variables are set
  - Re-sync from daino-backend if needed
  - Click "Save Changes" and redeploy

**Issue 4: Script not found**
- **Symptom:** Error: "Cannot find module './scripts/process-translation-jobs.cjs'"
- **Solution:**
  - Ensure file exists in your repository
  - Check "Root Directory" is set to `backend`
  - Verify file path: `backend/scripts/process-translation-jobs.cjs`
  - Push latest code and redeploy

**Issue 5: Timeout errors**
- **Symptom:** "Job terminated" or timeout in logs
- **Solution:**
  - Render cron has 60-second limit
  - Script already has 50-second internal limit
  - If jobs take too long, reduce batch size or optimize

### Viewing Logs

**Live Logs:**
1. Go to `daino-translation-processor`
2. Click **"Logs"** tab
3. Logs update in real-time
4. Use search/filter to find specific entries

**Download Logs:**
1. In Logs tab, click **"Download"**
2. Select date range
3. Download as text file

### Alerts & Notifications

**Set up failure alerts:**
1. Go to `daino-translation-processor`
2. Click **"Notifications"** tab
3. Add email addresses
4. Enable "Notify on failure"
5. Save

You'll receive emails if the cron fails.

## Adjusting the Schedule

### To change frequency:

**Every 2 minutes:**
```
*/2 * * * *
```

**Every 5 minutes:**
```
*/5 * * * *
```

**Every 30 minutes:**
```
*/30 * * * *
```

**Every hour:**
```
0 * * * *
```

**To update:**
1. Go to cron service settings
2. Update "Schedule" field
3. Save changes
4. Takes effect immediately

## Cost Monitoring

**Check cron usage:**
1. Go to your Render dashboard
2. Click **"Account Settings"** → **"Usage"**
3. View compute hours used by cron jobs
4. Free tier: 750 hours/month total

**Current estimate:**
- Running every minute: ~84 hours/month
- Running every 5 min: ~17 hours/month
- Running every 15 min: ~6 hours/month

## Summary Checklist

After creating the cron, verify:

- [ ] Service status is "Live" (green)
- [ ] "Last Run" shows recent timestamp
- [ ] Logs show successful runs every minute
- [ ] Test job completes successfully
- [ ] Email notification received
- [ ] No error messages in logs
- [ ] Environment variables all set correctly
- [ ] Auto-deploy is enabled

If all checked, your translation cron is working! ✅

## Quick Reference

**Service Name:** `daino-translation-processor`
**Schedule:** `* * * * *` (every minute)
**Root Directory:** `backend`
**Start Command:** `node scripts/process-translation-jobs.cjs`
**Build Command:** `npm install`

**Required Env Vars:**
- NODE_ENV=production
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_DB_URL
- DATABASE_URL
- JWT_SECRET
- ANTHROPIC_API_KEY

**Check Status:**
Render Dashboard → daino-translation-processor → Logs
