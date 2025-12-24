# 📊 Understanding Your Background Jobs & Queue

**Never lose progress again! Learn how DainoStore's smart job queue keeps your imports, exports, and translations running smoothly - even during updates.**

---

## 🤔 **What Are Background Jobs?**

Background jobs are tasks that run "behind the scenes" so you don't have to wait around.

**Examples in your store:**
- 🌐 Translating 500 UI labels to Spanish (takes 10+ minutes)
- 📦 Exporting 200 products to Amazon (takes 15+ minutes)
- 🛍️ Importing 1,000 products from Shopify (takes 20+ minutes)
- 🏭 Syncing catalog from Akeneo PIM (takes 30+ minutes)

**Without background jobs:** You'd have to keep the page open and wait!

**With background jobs:** Click start, close the page, come back later - it's done!

---

## 🚀 **What Makes DainoStore's Queue Special?**

### **The Problem with Most Systems:**

Other platforms lose progress when:
- ❌ Server restarts
- ❌ Deployments/updates
- ❌ Browser closes
- ❌ Internet disconnects

**You have to start over!** Frustrating with 1,000 product imports.

### **DainoStore's Solution: Persistent Queue**

Our queue uses **BullMQ + Redis** which means:
- ✅ **Survives server restarts** - Job resumes exactly where it left off
- ✅ **Survives deployments** - Updates don't interrupt your work
- ✅ **Real-time progress** - See exactly what's happening
- ✅ **Automatic retries** - Temporary errors? Job retries automatically
- ✅ **Priority system** - Important jobs go first

**You'll never lose progress again!**

---

## 📍 **Where to Find the Queue Dashboard**

You have **3 ways** to monitor your background jobs:

### **Option 1: Marketplace Hub (Recommended for Most Users)**

**Location:** Import & Export → Marketplace Hub

**What you see:**
```
🔄 Active Jobs (2)

Amazon Export #1234
AI optimizing: Blue Widget (15/30)
━━━━━━━━━━━━━━━░░░░░░░░░░ 50%

Shopify Import #1235
Importing products: 234/500
━━━━━━━━━░░░░░░░░░░░░░░░ 47%
```

**Best for:**
- Quick glance at running jobs
- Monitoring marketplace exports/imports
- See progress percentages
- Track recently completed jobs

---

### **Option 2: API Endpoints (For Developers/Advanced Users)**

**Get Overall Queue Status:**
```
GET /api/background-jobs/status
```

**Response:**
```json
{
  "status": {
    "is_running": true,
    "currently_processing": 2,
    "max_concurrent_jobs": 5
  },
  "statistics": {
    "total": 150,
    "completed": 142,
    "failed": 3,
    "pending": 3,
    "running": 2,
    "success_rate": "94.67%"
  }
}
```

**Get Specific Job Status:**
```
GET /api/background-jobs/{jobId}/status
```

**Response:**
```json
{
  "job": {
    "id": "1234",
    "type": "amazon:export:products",
    "status": "running",
    "progress": 45,
    "progress_message": "AI optimizing: Product Name (15/30)"
  }
}
```

**Best for:**
- Building custom dashboards
- Integration with other tools
- Automated monitoring
- Detailed analytics

---

### **Option 3: Dedicated Job Dashboard (Coming Soon!)**

We're building a full-screen job monitoring dashboard:

**Features:**
- 📊 All jobs across all stores
- 🔍 Filter by type, status, date
- 📝 Detailed logs for each job
- ⏱️ Performance metrics
- 📈 Success rate trends
- 🚨 Error alerts

**Location (when released):** Import & Export → Background Jobs

---

## 🎯 **Understanding Job Types**

Your store runs different types of background jobs:

### **Translation Jobs**
- **Type:** `translation:ui-labels:bulk`
- **What:** Translates all UI labels to another language
- **Time:** 5-15 minutes for 500+ labels
- **Why background:** Too slow for real-time

### **Marketplace Exports**
- **Types:** `amazon:export:products`, `ebay:export:products`
- **What:** Exports products to marketplaces with AI optimization
- **Time:** 1-2 minutes per product with AI
- **Why background:** Large catalogs take time

### **Shopify Imports**
- **Types:** `shopify:import:collections`, `shopify:import:products`, `shopify:import:all`
- **What:** Imports your Shopify catalog
- **Time:** 10-30 minutes depending on catalog size
- **Why background:** Downloads images, processes variants

### **Akeneo Sync**
- **Types:** `akeneo:import:products`, `akeneo:import:categories`, etc.
- **What:** Syncs catalog from Akeneo PIM
- **Time:** 15-60 minutes
- **Why background:** Large PIM catalogs

### **System Jobs**
- **Types:** `system:daily_credit_deduction`, `system:cleanup`, etc.
- **What:** Automated maintenance tasks
- **Time:** Varies
- **Why background:** Scheduled/automated

---

## 📊 **Job Status Explained**

### **Status Types:**

**🕐 Pending** (Gray)
- Job is queued, waiting to start
- Position in queue depends on priority
- Will start when worker is available

**🔄 Running** (Blue, spinning)
- Job is actively processing
- Progress bar shows completion percentage
- Message shows current step

**✅ Completed** (Green)
- Job finished successfully!
- Results available
- Check "Recent Activity" for details

**❌ Failed** (Red)
- Job encountered an error
- Will automatically retry (up to 3 times)
- Check error message for details

**🔄 Retrying** (Yellow)
- Job failed but will try again
- Automatic retry with delays: 5s, 30s, 5m
- Usually succeeds on retry

---

## ⚡ **Priority System**

Not all jobs are equal! Here's how priority works:

### **Priority Levels:**

**🔴 Urgent** (Priority 1)
- Customer-facing issues
- Payment processing
- Order finalization

**🟠 High** (Priority 2)
- Inventory syncs
- Full catalog imports
- Customer data exports

**🟡 Normal** (Priority 3)
- Standard exports
- Product imports
- Most marketplace jobs

**🟢 Low** (Priority 10)
- Cleanup tasks
- Non-urgent syncs
- Background optimizations

**Your exports are "Normal" priority** - processed fairly with other jobs.

---

## 🎮 **How to Use the Queue Effectively**

### **Best Practices:**

**1. Export During Off-Hours**
- Late night or early morning
- Less traffic = faster processing
- Jobs still run even if you sleep!

**2. Monitor First Export**
- Stay on Marketplace Hub for first export
- Watch for errors
- Verify it completes successfully

**3. Subsequent Exports**
- Just click and go!
- Check back later
- Trust the queue to finish

**4. Don't Start Duplicate Jobs**
- Check "Active Jobs" first
- Don't export same products twice
- System handles one job at a time per type

**5. Use Progress Messages**
- Messages tell you exactly what's happening
- If stuck, message shows where
- Helps troubleshoot issues

---

## 🔧 **Advanced: Understanding the Queue Architecture**

*For curious store owners or developers*

### **How It Works:**

```
Your Action (Click Export)
    ↓
Job Created in Database
    ↓
Added to BullMQ Queue (Redis)
    ↓
Worker Picks Up Job
    ↓
Processes Step by Step
    ↓
Updates Progress in Database
    ↓
Your UI Polls for Updates
    ↓
Shows Real-Time Progress
    ↓
Job Completes!
```

### **Why This Matters:**

**Database + Redis = Bulletproof**
- Database: Permanent storage (survives everything)
- Redis: Fast queue (high performance)
- Combined: Best of both worlds!

**Worker Process:**
- Dedicated server just for jobs
- Runs separately from main website
- Processes up to 5 jobs at once
- Never stops (even during deployments)

---

## 📈 **Job Performance Metrics**

Understanding your queue health:

### **What to Monitor:**

**Success Rate:**
- **95%+** = Excellent (normal to have occasional failures)
- **80-95%** = Good (some issues, investigate failures)
- **<80%** = Poor (check configuration, contact support)

**Processing Time:**
- **Amazon Export:** 1-2 min per product with AI
- **Shopify Import:** 2-3 min per product
- **UI Translation:** 2-3 sec per label
- **Akeneo Sync:** 1-2 min per product

**Queue Depth:**
- **0-2 pending:** Healthy
- **3-10 pending:** Busy but normal
- **10+ pending:** High load, jobs will process in order

---

## 🚨 **When Jobs Fail**

Don't panic! Here's what happens:

### **Automatic Recovery:**

**Retry 1:** After 5 seconds
- Usually fixes temporary network issues

**Retry 2:** After 30 seconds
- Fixes rate limit errors

**Retry 3:** After 5 minutes
- Fixes API timeouts

**If still failing:** Job marked as "Failed"
- Check error message
- Fix the issue
- Re-run the job

### **Common Errors & Fixes:**

**"Insufficient Credits"**
- You ran out of AI credits
- Solution: Purchase more credits
- Or: Disable AI optimization temporarily

**"Invalid Credentials"**
- Marketplace credentials are wrong/expired
- Solution: Re-configure in Marketplace Hub
- Check Seller Central for updated tokens

**"Product Validation Failed"**
- Product missing required fields
- Solution: Check error details
- Add missing data (SKU, title, price, etc.)
- Re-export

**"Rate Limit Exceeded"**
- Too many API calls too fast
- Solution: Job will auto-retry
- System adds delays between batches

---

## 💡 **Pro Tips**

### **1. Job Progress is Your Friend**

The progress message tells you:
- **Exactly which product** is processing
- **What stage** of the job (fetching, AI optimizing, etc.)
- **How many items** are complete vs total

Use this to estimate remaining time!

### **2. Jobs Survive Everything**

Feel free to:
- Close your browser
- Shut down your computer
- Deploy updates to your site
- Restart servers

**The job keeps running!** Come back anytime to check progress.

### **3. Multiple Jobs Run Together**

The system processes up to **5 jobs simultaneously**:
- Amazon export + Shopify import + Translation = All run at once!
- Jobs don't block each other
- Priority jobs go first

### **4. Check Recent Activity**

In Marketplace Hub, the **"Recent Activity"** section shows:
- Last 5 completed jobs
- When they ran
- Success or failure
- Quick way to verify exports worked

---

## 🎉 **Summary**

**Where to find the Queue Dashboard:**

**For Store Owners:**
→ **Import & Export → Marketplace Hub**
- Active jobs at the top
- Recent activity at the bottom
- Perfect for monitoring exports/imports

**For Developers:**
→ **API: /api/background-jobs/status**
- Complete queue statistics
- Job details
- Performance metrics

**Coming Soon:**
→ **Dedicated Job Dashboard Page**
- Full monitoring interface
- Detailed logs
- Analytics

---

## 🆘 **Need Help?**

- **Jobs stuck?** Wait 30 minutes (large jobs take time!)
- **Job failed?** Check error message in Recent Activity
- **Can't find job?** Use API with job ID from export response

---

**Your background job system is now working 24/7 to keep your business running smoothly!** 🚀

*Last Updated: November 2025*
