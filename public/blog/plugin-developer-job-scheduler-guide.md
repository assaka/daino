# 🔌 Plugin Developer Guide: Job Scheduler & Background Jobs

**Learn how to create scheduled tasks and background jobs from your plugins.**

---

## 🎯 **What You Can Do**

As a plugin developer, you can:
- ✅ Schedule recurring tasks (cron jobs)
- ✅ Create background jobs that survive deployments
- ✅ Monitor job execution from your plugin
- ✅ Handle long-running tasks properly

---

## 📅 **Creating Scheduled Jobs (Cron Jobs)**

### **Use Case Examples:**

- Daily data sync at 2 AM
- Hourly inventory updates
- Weekly report generation
- Monthly cleanup tasks

### **API Endpoint:**

```javascript
POST /api/cron-jobs
```

### **Example: Daily Sync Task**

```javascript
const response = await fetch('/api/cron-jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    name: 'Daily Product Sync',
    description: 'Syncs product data every day at 2 AM',
    cron_expression: '0 2 * * *', // 2 AM daily
    job_type: 'api_call',
    configuration: {
      url: '/api/my-plugin/sync',
      method: 'POST',
      headers: {
        'X-Plugin-Key': 'your-plugin-key'
      }
    },
    plugin_id: 'your-plugin-uuid',
    store_id: 'store-uuid',
    is_active: true,
    timezone: 'UTC'
  })
});

const data = await response.json();
console.log('Cron job created:', data.job.id);
```

### **Cron Expression Examples:**

| Expression | Meaning | Use Case |
|------------|---------|----------|
| `*/5 * * * *` | Every 5 minutes | Real-time syncs |
| `0 * * * *` | Every hour | Frequent updates |
| `0 */6 * * *` | Every 6 hours | Regular syncs |
| `0 2 * * *` | Daily at 2 AM | Daily maintenance |
| `0 0 * * 0` | Sunday midnight | Weekly reports |
| `0 0 1 * *` | 1st of month | Monthly tasks |

**Cron format:** `minute hour day month weekday`

---

## 🚀 **Creating Background Jobs**

### **Use Case Examples:**

- Importing large datasets
- Exporting to external APIs
- Processing bulk operations
- Generating reports

### **API Endpoint:**

```javascript
POST /api/background-jobs/schedule
```

### **Example: Bulk Data Import**

```javascript
const response = await fetch('/api/background-jobs/schedule', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    type: 'plugin:my-plugin:import', // Your custom job type
    payload: {
      source: 'external-api',
      importType: 'products',
      filters: { category: 'electronics' }
    },
    priority: 'normal', // low, normal, high, urgent
    maxRetries: 3,
    storeId: 'store-uuid',
    metadata: {
      pluginId: 'your-plugin-uuid',
      description: 'Importing electronics from API'
    }
  })
});

const data = await response.json();
const jobId = data.job.id;

// Poll for progress
const checkProgress = setInterval(async () => {
  const statusRes = await fetch(`/api/background-jobs/${jobId}/status`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });

  const status = await statusRes.json();
  console.log('Progress:', status.job.progress, '%');

  if (status.job.status === 'completed' || status.job.status === 'failed') {
    clearInterval(checkProgress);
    console.log('Job finished:', status.job);
  }
}, 2000);
```

---

## 🛠️ **Creating Custom Job Handlers**

### **Step 1: Create Your Job Handler**

Create a file in your plugin:

```javascript
// plugins/my-plugin/jobs/MyImportJob.js

const BaseJobHandler = require('@/core/jobs/BaseJobHandler');

class MyImportJob extends BaseJobHandler {
  async execute() {
    const { source, importType, filters } = this.job.payload;

    this.log(`Starting import from ${source}`);
    await this.updateProgress(10, 'Fetching data...');

    // Your import logic here
    const items = await this.fetchDataFromAPI(source, filters);

    await this.updateProgress(50, `Processing ${items.length} items...`);

    const results = {
      total: items.length,
      successful: 0,
      failed: 0
    };

    for (let i = 0; i < items.length; i++) {
      try {
        await this.importItem(items[i]);
        results.successful++;

        const progress = 50 + ((i / items.length) * 45);
        await this.updateProgress(
          Math.round(progress),
          `Importing: ${items[i].name} (${i + 1}/${items.length})`
        );
      } catch (error) {
        results.failed++;
        this.log(`Failed to import ${items[i].name}: ${error.message}`);
      }
    }

    await this.updateProgress(100, 'Import completed');
    return results;
  }

  async fetchDataFromAPI(source, filters) {
    // Your API call logic
    return [];
  }

  async importItem(item) {
    // Your import logic
  }

  log(message) {
    console.log(`[MyImportJob ${this.job.id}] ${message}`);
  }
}

module.exports = MyImportJob;
```

### **Step 2: Register Your Job Type**

In your plugin's initialization:

```javascript
// plugins/my-plugin/index.js

const jobManager = require('@/core/BackgroundJobManager');
const MyImportJob = require('./jobs/MyImportJob');

function initializePlugin() {
  // Register your custom job type
  jobManager.registerJobType('plugin:my-plugin:import', MyImportJob);

  console.log('✅ My Plugin job types registered');
}

module.exports = { initializePlugin };
```

### **Step 3: Trigger Jobs from Your Plugin**

```javascript
// From your plugin code
const jobManager = require('@/core/BackgroundJobManager');

async function triggerImport(storeId, userId, config) {
  const job = await jobManager.scheduleJob({
    type: 'plugin:my-plugin:import',
    payload: config,
    priority: 'normal',
    maxRetries: 3,
    storeId,
    userId,
    metadata: {
      pluginId: 'your-plugin-uuid',
      pluginName: 'My Amazing Plugin'
    }
  });

  return job.id;
}
```

---

## 📊 **Job Types Available**

### **Standard Job Types:**

All plugins can use these built-in types:

| Type | Purpose | Example |
|------|---------|---------|
| `webhook` | Call external HTTP endpoint | Notify external system |
| `api_call` | Call internal API route | Trigger plugin endpoint |
| `database_query` | Execute SQL query | Cleanup old data |
| `email` | Send scheduled email | Daily reports |
| `cleanup` | Maintenance task | Delete temp files |

### **Custom Job Types:**

Name your types with pattern: `plugin:{plugin-name}:{action}`

Examples:
- `plugin:analytics:daily-report`
- `plugin:inventory:sync-supplier`
- `plugin:marketing:send-campaign`

---

## ⚙️ **Job Configuration Examples**

### **Webhook Job:**

```javascript
{
  job_type: 'webhook',
  configuration: {
    url: 'https://external-api.com/webhook',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-token',
      'Content-Type': 'application/json'
    },
    body: {
      event: 'daily_sync',
      timestamp: '{{current_time}}'
    }
  }
}
```

### **API Call Job:**

```javascript
{
  job_type: 'api_call',
  configuration: {
    url: '/api/my-plugin/process',
    method: 'POST',
    headers: {
      'X-Plugin-Key': 'secret-key'
    }
  }
}
```

### **Database Query Job:**

```javascript
{
  job_type: 'database_query',
  configuration: {
    query: 'DELETE FROM temp_data WHERE created_at < NOW() - INTERVAL \'30 days\'',
    timeout: 30000 // 30 seconds
  }
}
```

### **Email Job:**

```javascript
{
  job_type: 'email',
  configuration: {
    to: 'admin@example.com',
    subject: 'Daily Report',
    template: 'daily-report',
    data: {
      reportDate: '{{current_date}}'
    }
  }
}
```

---

## 🔐 **Security Best Practices**

### **1. Validate Plugin Ownership**

When creating jobs, always pass your `plugin_id`:

```javascript
{
  plugin_id: 'your-plugin-uuid',
  // ... other fields
}
```

The system will:
- Associate the job with your plugin
- Show it's a plugin job in the UI
- Allow users to see which plugin created it

### **2. Use Secure Credentials**

Don't hardcode secrets in configuration:

```javascript
// ❌ Bad
configuration: {
  api_key: 'hardcoded-key-123'
}

// ✅ Good
configuration: {
  api_key: process.env.MY_PLUGIN_API_KEY
}
```

### **3. Handle Failures Gracefully**

Use `maxRetries` appropriately:

```javascript
{
  maxRetries: 3, // Will retry 3 times with exponential backoff
  // Retries happen at: 5s, 30s, 5m
}
```

---

## 📈 **Progress Tracking**

Always update progress in your job handler:

```javascript
async execute() {
  await this.updateProgress(0, 'Starting...');

  // Do work
  await this.updateProgress(25, 'Fetching data...');

  // More work
  await this.updateProgress(50, 'Processing items...');

  // Final work
  await this.updateProgress(75, 'Finalizing...');

  await this.updateProgress(100, 'Completed!');

  return results;
}
```

**Users see this in real-time!**

---

## 🎯 **Advanced: Job Priorities**

Choose priority based on urgency:

| Priority | Use For | Processing |
|----------|---------|------------|
| `urgent` | Customer-facing issues | Immediate |
| `high` | Time-sensitive tasks | Within minutes |
| `normal` | Standard operations | Within hours |
| `low` | Maintenance, cleanup | When queue is idle |

---

## 📖 **Full Example: Complete Plugin with Jobs**

```javascript
// plugins/inventory-sync/index.js

const jobManager = require('@/core/BackgroundJobManager');
const InventorySyncJob = require('./jobs/InventorySyncJob');

class InventorySyncPlugin {
  constructor(pluginId) {
    this.pluginId = pluginId;
  }

  async initialize() {
    // Register custom job type
    jobManager.registerJobType('plugin:inventory-sync:full', InventorySyncJob);

    // Create a daily cron job
    await this.createDailySyncJob();

    console.log('✅ Inventory Sync Plugin initialized');
  }

  async createDailySyncJob() {
    const res = await fetch('/api/cron-jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getAdminToken()}`
      },
      body: JSON.stringify({
        name: 'Daily Inventory Sync',
        description: 'Syncs inventory with supplier API every day at 3 AM',
        cron_expression: '0 3 * * *',
        job_type: 'api_call',
        configuration: {
          url: '/api/inventory-sync/run',
          method: 'POST'
        },
        plugin_id: this.pluginId,
        is_active: true
      })
    });

    const data = await res.json();
    console.log('✅ Daily sync job created:', data.job.id);
  }

  async runSync(storeId, userId) {
    const job = await jobManager.scheduleJob({
      type: 'plugin:inventory-sync:full',
      payload: {
        storeId,
        syncType: 'full'
      },
      priority: 'normal',
      storeId,
      userId,
      metadata: {
        pluginId: this.pluginId,
        pluginName: 'Inventory Sync'
      }
    });

    return job.id;
  }
}

module.exports = InventorySyncPlugin;
```

---

## 🆘 **Troubleshooting**

### **Job Not Running**

Check:
- Is cron expression valid? Use [crontab.guru](https://crontab.guru)
- Is `is_active` set to `true`?
- Is the cron scheduler service running?

### **Job Failing**

Check:
- Job execution history: `GET /api/cron-jobs/:id/executions`
- Error messages in logs
- Endpoint is accessible
- Credentials are valid

### **Progress Not Updating**

Ensure you call `updateProgress()` in your job handler:

```javascript
await this.updateProgress(50, 'Halfway done');
```

---

## 📚 **Resources**

- **Cron Expression Tester:** https://crontab.guru
- **Base Job Handler:** `backend/src/core/jobs/BaseJobHandler.js`
- **Example Jobs:** `backend/src/core/jobs/` directory
- **Queue System Docs:** `QUEUE_SYSTEM_IMPLEMENTATION.md`

---

## 🎉 **Summary**

With DainoStore's job system, your plugins can:
- ✅ Schedule recurring tasks
- ✅ Run background jobs
- ✅ Track progress in real-time
- ✅ Survive deployments
- ✅ Retry on failures automatically

**Build powerful plugins with confidence!** 🚀

---

*Last Updated: November 2025*
*DainoStore Version: 2.0+*
