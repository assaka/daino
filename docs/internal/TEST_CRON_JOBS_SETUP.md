# 🧪 Test Cron Jobs Setup Guide

Quick guide to test the job scheduler with two example cron jobs.

---

## 📋 **What Gets Created:**

### **Job 1: Hourly Shopify Product Import**
- **Schedule:** Every hour at minute 0 (e.g., 1:00, 2:00, 3:00...)
- **Action:** Imports new products from Shopify
- **Type:** API Call
- **Priority:** Normal
- **Purpose:** Keeps your catalog automatically synced with Shopify

### **Job 2: Hourly Store Status Email**
- **Schedule:** Every hour at minute 0
- **Action:** Sends status email to store owner
- **Type:** Email
- **Priority:** Low
- **Purpose:** Automated hourly updates on store performance

---

## 🚀 **Setup Instructions:**

### **Step 1: Run the SQL**

Connect to your Supabase database and run:

```bash
backend/sql/create-test-cron-jobs.sql
```

Or via psql:
```bash
psql $DATABASE_URL -f backend/sql/create-test-cron-jobs.sql
```

**What it does:**
- Gets first user and store from your database
- Creates 2 test cron jobs
- Sets next run time to next hour
- Activates the jobs immediately

---

## ✅ **Verify Jobs Were Created:**

### **Method 1: Via Job Scheduler Page**

1. Go to: **Advanced → Job Scheduler**
2. You should see:
   - ✅ "Hourly Shopify Product Import"
   - ✅ "Hourly Store Status Email"
3. Both should have green dots (active)
4. Check "Next Run" time

### **Method 2: Via API**

```bash
curl -X GET "http://localhost:3000/api/cron-jobs?store_id=YOUR_STORE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Method 3: Via Database**

```sql
SELECT name, cron_expression, is_active, next_run_at
FROM cron_jobs
WHERE name LIKE 'Hourly%'
ORDER BY name;
```

---

## 🧪 **Testing the Jobs:**

### **Test Shopify Import Job Manually:**

The cron job will call this endpoint every hour:

```bash
POST /api/shopify/import/products
{
  "store_id": "your-store-uuid",
  "dry_run": false,
  "limit": null,
  "overwrite": false
}
```

**To test immediately (don't wait for scheduled time):**

1. Go to **Marketplace Hub → Shopify** tab
2. Click "Import Products"
3. Monitor progress
4. Verify products appear in your catalog

### **Test Email Job Manually:**

The email job uses the email service. To test:

1. Ensure email service is configured (SMTP settings)
2. Check `backend/src/services/email-service.js` has `store-status-hourly` template
3. Or manually trigger via API (simulate what cron does)

**Expected email content:**
- Store name and status
- Recent orders (last hour)
- Low stock alerts
- Key metrics

---

## ⚙️ **Customizing the Test Jobs:**

### **Change Schedule:**

Update the cron expression:

```sql
UPDATE cron_jobs
SET cron_expression = '*/30 * * * *', -- Every 30 minutes
    updated_at = NOW()
WHERE name = 'Hourly Shopify Product Import';
```

Common schedules:
- `*/15 * * * *` - Every 15 minutes
- `*/30 * * * *` - Every 30 minutes
- `0 */2 * * *` - Every 2 hours
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight

### **Pause a Job:**

```sql
UPDATE cron_jobs
SET is_paused = true, updated_at = NOW()
WHERE name = 'Hourly Store Status Email';
```

### **Deactivate a Job:**

```sql
UPDATE cron_jobs
SET is_active = false, updated_at = NOW()
WHERE name = 'Hourly Store Status Email';
```

Or use the UI:
1. Go to **Advanced → Job Scheduler**
2. Click the pause button next to the job

---

## 📊 **Monitoring Job Execution:**

### **View in Job Scheduler:**

1. Go to **Advanced → Job Scheduler**
2. Look at the job row:
   - **Runs:** Total executions
   - **Success:** Successful runs
   - **Next:** Next scheduled time
3. Click on job to see execution history

### **View Job Executions (Database):**

```sql
SELECT
  cj.name,
  cje.executed_at,
  cje.status,
  cje.duration_ms,
  cje.error_message
FROM cron_job_executions cje
JOIN cron_jobs cj ON cje.cron_job_id = cj.id
WHERE cj.name LIKE 'Hourly%'
ORDER BY cje.executed_at DESC
LIMIT 20;
```

### **View in Background Jobs Page:**

1. Go to **Advanced → Background Jobs**
2. Filter by type: "shopify" or "system"
3. See all executions of scheduled jobs
4. Check success/failure rates

---

## 🔧 **How the Jobs Work:**

### **Shopify Import Job Flow:**

```
Cron Scheduler (runs every minute)
    ↓
Checks: Is it time to run? (hour mark)
    ↓
Creates Background Job: "shopify:import:products"
    ↓
Job Queue picks it up
    ↓
ShopifyImportProductsJob.execute()
    ↓
Fetches products from Shopify API
    ↓
Saves to database
    ↓
Updates progress (you can watch in UI!)
    ↓
Completes ✅
    ↓
Records execution in cron_job_executions table
    ↓
Updates next_run_at to next hour
```

### **Email Job Flow:**

```
Cron Scheduler
    ↓
Creates system:dynamic_cron job
    ↓
DynamicCronJob.execute()
    ↓
Executes email job configuration
    ↓
Email Service sends email
    ↓
Store owner receives email ✉️
    ↓
Records execution
```

---

## 🎯 **Modifying for Production:**

### **For Specific User/Store:**

Replace the automatic user/store selection:

```sql
-- Instead of:
SELECT id INTO test_user_id FROM users LIMIT 1;
SELECT id INTO test_store_id FROM stores LIMIT 1;

-- Use specific IDs:
test_user_id := 'your-user-uuid-here';
test_store_id := 'your-store-uuid-here';
```

### **Add More Import Options:**

Modify the Shopify import configuration:

```sql
'body', jsonb_build_object(
  'store_id', test_store_id::text,
  'dry_run', false,
  'limit', 100, -- Only import 100 products per run
  'overwrite', true -- Update existing products
)
```

### **Customize Email Content:**

Modify the email configuration:

```sql
'data', jsonb_build_object(
  'store_id', test_store_id::text,
  'include_metrics', true,
  'include_recent_orders', true,
  'include_low_stock', true,
  'include_revenue', true, -- Add revenue stats
  'time_period', '1hour'
)
```

---

## 🆘 **Troubleshooting:**

### **Jobs Not Running:**

**Check cron scheduler is active:**
```sql
SELECT * FROM cron_jobs WHERE is_active = true;
```

**Check next_run_at is set:**
```sql
SELECT name, next_run_at, last_run_at
FROM cron_jobs
WHERE name LIKE 'Hourly%';
```

**Verify cron-scheduler service is running:**
- Check backend logs for "Cron Scheduler started"
- Should check for due jobs every minute

### **Shopify Import Fails:**

**Check Shopify connection:**
1. Go to **Marketplace Hub → Shopify**
2. Verify status is "Connected"
3. Test connection manually

**Common issues:**
- Shopify OAuth token expired (reconnect)
- No products to import
- API rate limits (job will retry)

### **Email Not Sending:**

**Check email service configuration:**
- Verify SMTP settings in `.env`
- Check email template exists
- Test email manually first

**Email template might not exist yet:**
- Create `store-status-hourly` template in email templates
- Or change configuration to use existing template like `order-confirmation`

---

## 📈 **Expected Behavior:**

### **First Hour:**
- Jobs created but waiting for next hour mark
- `next_run_at` shows next hour (e.g., if now is 2:35 PM, shows 3:00 PM)
- Status: Active, Paused: No

### **At Hour Mark (e.g., 3:00 PM):**
- Cron scheduler detects jobs are due
- Creates background jobs for each
- Jobs appear in **Import/Export Jobs** page
- Progress shows in real-time

### **After Completion:**
- `last_run_at` updated to 3:00 PM
- `next_run_at` updated to 4:00 PM
- `run_count` incremented
- `success_count` incremented (if successful)
- Execution record created in `cron_job_executions`

---

## 🎉 **Success Indicators:**

After running the SQL, you should see:

✅ Two cron jobs in database
✅ Both marked as active
✅ `next_run_at` set to next hour
✅ Jobs visible in **Advanced → Job Scheduler**
✅ At next hour: Jobs execute automatically
✅ Progress visible in **Import/Export Jobs** (for Shopify import)
✅ Email received by store owner

---

## 🔄 **Cleaning Up Test Jobs:**

When done testing, disable or delete:

```sql
-- Disable jobs
UPDATE cron_jobs
SET is_active = false
WHERE name LIKE 'Hourly%';

-- Or delete entirely
DELETE FROM cron_jobs
WHERE name IN ('Hourly Shopify Product Import', 'Hourly Store Status Email');
```

Or via UI:
1. Go to **Advanced → Job Scheduler**
2. Click pause button (disables job)
3. Click trash button (deletes job)

---

**Your test jobs are ready to demonstrate the power of automated scheduling!** ⏰🚀

---

*Last Updated: November 2025*
