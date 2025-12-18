# Daily Credit Deduction System

## Overview

Automatically deducts 1 credit per day from every published store's owner.

## Architecture

### Single Source of Truth
- **Balance:** `users.credits` column
- **Purchases:** `credit_transactions` table (adds to `users.credits`)
- **Usage:** `credit_usage` table (deducts from `users.credits`)

### How It Works

**Daily Process:**
1. Find all stores where `published = true`
2. For each store:
   - Get owner's balance from `users.credits`
   - If balance ≥ 1:
     - Deduct 1 credit: `UPDATE users SET credits = credits - 1`
     - Log usage: `INSERT INTO credit_usage (description: 'Store publishing - daily charge')`
   - If balance < 1:
     - Skip (store stays published, logged as insufficient)

## Deployment Options

### Option 1: Background Worker (Current)

**File:** `backend/worker.cjs`

**How it works:**
- Runs 24/7 on Render
- Polls database every 5 seconds
- Automatically schedules daily job on startup
- Runs every 24 hours

**Pros:**
- ✅ Handles multiple job types (Akeneo, plugins, credits)
- ✅ Runs jobs on-demand when users trigger them
- ✅ Already configured and working

**Cons:**
- ❌ Uses resources 24/7 (costs more)
- ❌ If worker crashes, job might be delayed

**Render Config:**
```yaml
- type: worker
  name: daino-background-worker
  startCommand: node worker.cjs
```

### Option 2: Render Cron Job (NEW - Recommended)

**File:** `backend/scripts/run-daily-credit-deduction.js`

**How it works:**
- Runs only at scheduled time (midnight UTC)
- Spins up container → runs script → shuts down
- Independent of worker
- Guaranteed execution by Render

**Pros:**
- ✅ Guaranteed execution time
- ✅ Only pays for minutes used (~2 min/day = FREE tier!)
- ✅ Independent of worker uptime
- ✅ Isolated billing operations

**Cons:**
- ❌ Only handles this specific task

**Render Config:**
```yaml
- type: cron
  name: daino-daily-credit-deduction
  schedule: "0 0 * * *"  # Midnight UTC daily
  startCommand: node scripts/run-daily-credit-deduction.js
```

### Option 3: Hybrid (BEST - Current Setup)

**Keep both!** Worker handles on-demand jobs, cron handles critical billing.

```yaml
# Worker for Akeneo imports, plugins, etc.
- type: worker
  name: daino-background-worker
  startCommand: node worker.cjs

# Cron for guaranteed daily billing
- type: cron
  name: daino-daily-credit-deduction
  schedule: "0 0 * * *"
  startCommand: node scripts/run-daily-credit-deduction.js
```

**Benefits:**
- ✅ Worker handles user-triggered jobs
- ✅ Cron handles critical billing (guaranteed)
- ✅ If worker fails, billing still runs
- ✅ Cron execution is FREE (within 100 hours/month limit)

## Testing

### Local Test (Safe - Doesn't Deduct)
```bash
cd backend
node test-daily-credit-deduction.js
```

**Output:**
```
📊 Found 2 published stores:
   - My Store (Owner: info@itomoti.com)
   - Test Store (Owner: test@example.com)

✅ Daily job is scheduled
   Next run: 2025-01-31 00:00:00

💰 Testing manual credit deduction...
   Testing: My Store
      Current balance: 170 credits
      ✅ Successfully deducted 1 credit
      New balance: 169 credits
```

### Manual Trigger (Production)

**Via API (Admin only):**
```bash
POST https://backend.dainostore.com/api/credits/trigger-daily-deduction
Authorization: Bearer <admin-token>
```

**Via Render Dashboard:**
1. Go to `daino-daily-credit-deduction` service
2. Click **"Trigger Job"** button
3. View logs to see results

## Monitoring

### View Cron Job Logs

1. Go to https://dashboard.render.com
2. Click `daino-daily-credit-deduction`
3. Click **"Logs"** tab

**Expected output:**
```
💰 Running Daily Credit Deduction...
Started at: 2025-01-30T00:00:00.000Z

📊 Found 3 published stores
✅ Successfully charged 1 credit for store: My Store
✅ Successfully charged 1 credit for store: Test Store
⚠️  Insufficient credits for store: Demo Store

📈 Summary:
   Stores processed: 3
   Successful: 2
   Failed: 1

Completed at: 2025-01-30T00:00:32.000Z
```

### Check Credit Usage History

```sql
-- View recent credit deductions
SELECT
  cu.created_at,
  s.name as store_name,
  u.email as owner_email,
  cu.credits_used,
  cu.description
FROM credit_usage cu
JOIN stores s ON cu.store_id = s.id
JOIN users u ON cu.user_id = u.id
WHERE cu.description LIKE '%daily charge%'
ORDER BY cu.created_at DESC
LIMIT 20;
```

## Cost Comparison

### Background Worker (24/7)
- **Runtime:** 720 hours/month
- **Cost:** ~$7/month (Render Starter)
- **Use case:** Multiple background jobs

### Cron Job (Daily)
- **Runtime:** ~2 minutes/day = 1 hour/month
- **Cost:** $0 (within free 100 hours/month)
- **Use case:** Scheduled daily tasks only

### Hybrid (Recommended)
- **Worker:** $7/month (handles Akeneo, plugins)
- **Cron:** $0/month (handles billing)
- **Total:** $7/month for full background job system

## Schedule Options

**Change run time by editing `render.yaml`:**

```yaml
# Midnight UTC (default)
schedule: "0 0 * * *"

# 2:30 AM UTC
schedule: "30 2 * * *"

# Every 6 hours
schedule: "0 */6 * * *"

# Twice daily (noon and midnight)
schedule: "0 0,12 * * *"
```

## Troubleshooting

### Job Not Running

**Check 1: Is the cron job deployed?**
```bash
# Render Dashboard > Services
# You should see "daino-daily-credit-deduction"
```

**Check 2: View logs**
```bash
# Render Dashboard > daino-daily-credit-deduction > Logs
```

**Check 3: Check environment variables**
```bash
# Ensure SUPABASE_URL, DATABASE_URL, etc. are set
```

### Insufficient Credits

**Behavior:** Job logs warning but doesn't stop store

```
⚠️  Insufficient credits for store: Demo Store
   Required: 1, Available: 0
```

**Solution:** User needs to purchase more credits

### Store Still Published Despite No Credits

**This is intentional!** We log the issue but don't unpublish stores automatically.

To auto-unpublish, add this to `credit-service.js`:
```javascript
if (!hasCredits) {
  await Store.update(
    { published: false },
    { where: { id: storeId } }
  );
}
```

## Files

```
backend/
├── scripts/
│   └── run-daily-credit-deduction.js    # Standalone script for cron
├── test-daily-credit-deduction.js       # Local test script
├── worker.cjs                            # Background worker (24/7)
├── src/
│   ├── core/
│   │   ├── BackgroundJobManager.js      # Job scheduling system
│   │   └── jobs/
│   │       └── DailyCreditDeductionJob.js  # Job implementation
│   ├── services/
│   │   └── credit-service.js            # Credit operations
│   └── routes/
│       └── credits.js                    # API endpoints
└── render.yaml                           # Deployment config
```

## Summary

✅ **Cron job added to `render.yaml`**
✅ **Runs daily at midnight UTC**
✅ **Deducts 1 credit per published store**
✅ **Logs all activity to Render dashboard**
✅ **Free tier covers execution (~1 hour/month)**
✅ **Independent of worker uptime**

**Next deployment will automatically create the cron job on Render!**
