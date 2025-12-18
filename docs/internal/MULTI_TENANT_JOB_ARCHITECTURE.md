# Multi-Tenant Job Processing Architecture
## Each Store Owner = Separate Supabase Database

## Problem

**Architecture:**
- Main DainoStore database (stores user accounts, subscriptions)
- Store Owner 1 → Supabase DB 1 (their products, orders, jobs)
- Store Owner 2 → Supabase DB 2 (their products, orders, jobs)
- Store Owner N → Supabase DB N

**Challenge:**
- Cannot query all jobs across databases in one query
- Each store's jobs are isolated
- Need to connect to N databases to process jobs
- Connection overhead multiplied by N

## Solution: Centralized Job Coordinator

### Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                   MAIN CATALYST DATABASE                       │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ job_queue (Centralized)                                  │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │ id  | store_id | db_url | type | payload | status       │  │
│  │ 1   | store_1  | supa1  | transl| {...}  | pending      │  │
│  │ 2   | store_2  | supa2  | import| {...}  | pending      │  │
│  │ 3   | store_1  | supa1  | export| {...}  | running      │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                               ↓
                    Cron triggers every minute
                               ↓
┌───────────────────────────────────────────────────────────────┐
│           POST /api/jobs/process-pending                       │
│  1. Query main DB for pending jobs                             │
│  2. Group by store_id                                          │
│  3. For each store:                                            │
│     - Connect to their Supabase DB                             │
│     - Process their jobs                                       │
│     - Update status in main DB                                 │
│     - Disconnect                                               │
└───────────────────────────────────────────────────────────────┘
                               ↓
        ┌──────────────┬─────────────┬─────────────┐
        ↓              ↓             ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Store 1 DB   │ │ Store 2 DB   │ │ Store N DB   │
│ (Supabase)   │ │ (Supabase)   │ │ (Supabase)   │
│              │ │              │ │              │
│ - products   │ │ - products   │ │ - products   │
│ - orders     │ │ - orders     │ │ - orders     │
│ - customers  │ │ - customers  │ │ - customers  │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Schema: Main DainoStore Database

```sql
-- Central job queue in main DainoStore database
CREATE TABLE job_queue (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES stores(id),
  user_id INTEGER NOT NULL REFERENCES users(id),

  -- Store's database connection info
  store_db_url TEXT NOT NULL,  -- Encrypted Supabase URL

  -- Job details
  type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,

  -- Results
  result JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Indexes for fast querying
  INDEX idx_job_queue_pending (status, priority, created_at) WHERE status = 'pending',
  INDEX idx_job_queue_store (store_id, status, created_at),
  INDEX idx_job_queue_user (user_id, status, created_at)
);

-- Store their DB connection info securely
CREATE TABLE store_databases (
  store_id INTEGER PRIMARY KEY REFERENCES stores(id),
  supabase_url TEXT NOT NULL,  -- Encrypted
  supabase_key TEXT NOT NULL,  -- Encrypted
  database_url TEXT NOT NULL,  -- Encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Optimized Job Processor

```javascript
// backend/src/routes/job-processor.js

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Connection pool per store (cache connections)
const storeConnections = new Map();
const MAX_CONNECTIONS = 50; // Limit total connections

router.post('/process-pending', verifyCronSecret, async (req, res) => {
  const startTime = Date.now();
  const MAX_RUNTIME = 50000;
  const MAX_JOBS = 20; // Process up to 20 jobs total

  try {
    // 1. Get pending jobs from MAIN database
    const pendingJobs = await mainDb.query(`
      SELECT
        jq.*,
        sd.supabase_url,
        sd.supabase_key,
        sd.database_url
      FROM job_queue jq
      JOIN store_databases sd ON jq.store_id = sd.store_id
      WHERE jq.status = 'pending'
      ORDER BY
        CASE jq.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 5
          ELSE 10
        END ASC,
        jq.created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    `, [MAX_JOBS]);

    if (pendingJobs.rows.length === 0) {
      return res.json({ processed: 0, message: 'No pending jobs' });
    }

    // 2. Group jobs by store for efficient processing
    const jobsByStore = {};
    for (const job of pendingJobs.rows) {
      if (!jobsByStore[job.store_id]) {
        jobsByStore[job.store_id] = {
          storeId: job.store_id,
          dbUrl: decrypt(job.database_url),
          supabaseUrl: decrypt(job.supabase_url),
          supabaseKey: decrypt(job.supabase_key),
          jobs: []
        };
      }
      jobsByStore[job.store_id].jobs.push(job);
    }

    // 3. Process jobs for each store
    let processed = 0;
    let failed = 0;

    for (const [storeId, storeData] of Object.entries(jobsByStore)) {
      // Check timeout
      if (Date.now() - startTime > MAX_RUNTIME) break;

      try {
        // Get or create connection for this store
        const storeDb = await getStoreConnection(storeData);

        // Process all jobs for this store
        for (const job of storeData.jobs) {
          try {
            await processJob(job, storeDb, mainDb);
            processed++;
          } catch (error) {
            console.error(`Job ${job.id} failed:`, error);
            await handleJobFailure(job, error, mainDb);
            failed++;
          }
        }

      } catch (error) {
        console.error(`Store ${storeId} processing failed:`, error);
        // Mark all store jobs as failed
        for (const job of storeData.jobs) {
          await handleJobFailure(job, error, mainDb);
          failed++;
        }
      }
    }

    // 4. Cleanup old connections
    cleanupStaleConnections();

    res.json({
      processed,
      failed,
      stores: Object.keys(jobsByStore).length,
      duration: Date.now() - startTime
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get or create cached connection for store
async function getStoreConnection(storeData) {
  const { storeId, dbUrl, supabaseUrl, supabaseKey } = storeData;

  if (storeConnections.has(storeId)) {
    const conn = storeConnections.get(storeId);
    // Check if connection is still valid
    if (conn.lastUsed > Date.now() - 60000) { // 1 minute TTL
      conn.lastUsed = Date.now();
      return conn.client;
    }
    // Connection stale, remove
    storeConnections.delete(storeId);
  }

  // Limit total connections
  if (storeConnections.size >= MAX_CONNECTIONS) {
    // Remove oldest connection
    const oldest = Array.from(storeConnections.entries())
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
    storeConnections.delete(oldest[0]);
  }

  // Create new connection
  const client = createClient(supabaseUrl, supabaseKey);

  storeConnections.set(storeId, {
    client,
    lastUsed: Date.now(),
    storeId
  });

  return client;
}

// Cleanup connections not used in 5 minutes
function cleanupStaleConnections() {
  const now = Date.now();
  const STALE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  for (const [storeId, conn] of storeConnections.entries()) {
    if (now - conn.lastUsed > STALE_TIMEOUT) {
      storeConnections.delete(storeId);
      console.log(`Cleaned up stale connection for store ${storeId}`);
    }
  }
}

// Process a single job with store's database
async function processJob(job, storeDb, mainDb) {
  // Update status to running in main DB
  await mainDb.query(
    'UPDATE job_queue SET status = $1, started_at = $2 WHERE id = $3',
    ['running', new Date(), job.id]
  );

  // Get handler and execute with store's database
  const HandlerClass = JOB_HANDLERS[job.type];
  const handler = new HandlerClass({
    ...job,
    storeDb  // Pass store's database connection
  });

  const result = await handler.execute();

  // Update status in main DB
  await mainDb.query(
    'UPDATE job_queue SET status = $1, completed_at = $2, result = $3 WHERE id = $4',
    ['completed', new Date(), JSON.stringify(result), job.id]
  );
}

// Handle job failure
async function handleJobFailure(job, error, mainDb) {
  const retryCount = (job.retry_count || 0) + 1;

  if (retryCount < job.max_retries) {
    // Retry
    await mainDb.query(
      'UPDATE job_queue SET status = $1, retry_count = $2, error_message = $3 WHERE id = $4',
      ['pending', retryCount, error.message, job.id]
    );
  } else {
    // Failed permanently
    await mainDb.query(
      'UPDATE job_queue SET status = $1, completed_at = $2, error_message = $3, retry_count = $4 WHERE id = $5',
      ['failed', new Date(), error.message, retryCount, job.id]
    );
  }
}

// Encryption helpers
function decrypt(encrypted) {
  const key = process.env.ENCRYPTION_KEY;
  const decipher = crypto.createDecipher('aes-256-cbc', key);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
```

### Job Handler Updates

```javascript
// backend/src/core/jobs/UILabelsBulkTranslationJob.js

class UILabelsBulkTranslationJob extends BaseJobHandler {
  async execute() {
    const { userId, userEmail, storeId, fromLang, toLang } = this.job.payload;

    // Use store's database connection (passed from processor)
    const storeDb = this.job.storeDb;

    // Get labels from STORE's database
    const { data: sourceLabels } = await storeDb
      .from('ui_translations')
      .select('*')
      .eq('language', fromLang)
      .eq('store_id', storeId);

    // Process translations...
    for (const label of sourceLabels) {
      const translated = await translationService.aiTranslate(
        label.text,
        fromLang,
        toLang
      );

      // Save to STORE's database
      await storeDb
        .from('ui_translations')
        .insert({
          store_id: storeId,
          language: toLang,
          key: label.key,
          text: translated
        });
    }

    // Send email notification
    await emailService.send({
      to: userEmail,
      subject: 'Translation Complete',
      body: `Your ${fromLang} → ${toLang} translation is ready!`
    });

    return {
      translated: sourceLabels.length,
      fromLang,
      toLang
    };
  }
}
```

### Creating Jobs

```javascript
// backend/src/routes/translations.js

router.post('/ui-labels/bulk', authMiddleware, async (req, res) => {
  const { from_lang, to_lang } = req.body;
  const store_id = req.user.store_id;

  // Get store's database info from main DB
  const storeDb = await Store.findOne({
    where: { id: store_id },
    include: [StoreDatabase]
  });

  // Create job in MAIN database (centralized queue)
  const job = await mainDb.query(`
    INSERT INTO job_queue (
      store_id,
      user_id,
      store_db_url,
      type,
      payload,
      priority
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    store_id,
    req.user.id,
    encrypt(storeDb.database_url),
    'translation:ui-labels:bulk',
    JSON.stringify({
      userId: req.user.id,
      userEmail: req.user.email,
      storeId: store_id,
      fromLang: from_lang,
      toLang: to_lang
    }),
    'normal'
  ]);

  res.json({
    message: 'Translation queued. You will receive an email when complete.',
    jobId: job.rows[0].id,
    estimatedTime: '1-5 minutes'
  });
});
```

## Performance Optimizations

### 1. Connection Pooling

```javascript
// Limit connections per store
const MAX_CONN_PER_STORE = 2;
const MAX_TOTAL_CONN = 50;

// LRU cache for connections
const connectionCache = new LRU({
  max: MAX_TOTAL_CONN,
  maxAge: 5 * 60 * 1000, // 5 minutes
  dispose: (key, connection) => {
    connection.close();
  }
});
```

### 2. Batch Processing by Store

```javascript
// Instead of random order, group by store
const jobsByStore = groupBy(pendingJobs, 'store_id');

// Process all jobs for one store before moving to next
// Reuses connection, reduces overhead
for (const [storeId, jobs] of Object.entries(jobsByStore)) {
  const conn = await getConnection(storeId);
  for (const job of jobs) {
    await processJob(job, conn);
  }
}
```

### 3. Parallel Store Processing

```javascript
// Process multiple stores in parallel
const storePromises = Object.entries(jobsByStore).map(
  async ([storeId, jobs]) => {
    const conn = await getConnection(storeId);
    return Promise.all(jobs.map(job => processJob(job, conn)));
  }
);

await Promise.all(storePromises);
```

### 4. Smart Connection Reuse

```javascript
// Keep connections alive for active stores
// Close connections for inactive stores

setInterval(() => {
  for (const [storeId, conn] of storeConnections) {
    if (Date.now() - conn.lastUsed > 5 * 60 * 1000) {
      conn.client.close();
      storeConnections.delete(storeId);
    }
  }
}, 60000); // Every minute
```

## Cost Analysis

### Without Optimization
```
1000 stores, 10 jobs/store/day

Every minute:
- Query main DB: 5ms
- Connect to ~10 stores: 50ms × 10 = 500ms
- Process 10 jobs: 5000ms
- Total: ~5500ms per run

Issues:
- Slow (>5 seconds)
- Many connection overhead
- Doesn't scale to 10,000 stores
```

### With Optimization
```
Same scenario:

Every minute:
- Query main DB: 5ms (indexed)
- Batch by store: Group 10 jobs for 5 stores
- Reuse connections: 5 × 10ms = 50ms
- Process in parallel: 1000ms (concurrent)
- Total: ~1055ms per run

Improvement: 5x faster
Scales to 10,000 stores
```

## Monitoring

```sql
-- Main DB: Job queue health
SELECT
  status,
  COUNT(*) as count,
  COUNT(DISTINCT store_id) as stores_affected
FROM job_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;

-- Stores with most pending jobs
SELECT
  store_id,
  COUNT(*) as pending_jobs,
  MIN(created_at) as oldest_job
FROM job_queue
WHERE status = 'pending'
GROUP BY store_id
ORDER BY pending_jobs DESC
LIMIT 10;

-- Connection pool health
SELECT
  COUNT(DISTINCT store_id) as active_stores,
  SUM(CASE WHEN last_used > NOW() - INTERVAL '5 minutes' THEN 1 ELSE 0 END) as hot_connections
FROM connection_pool_stats;
```

## Recommended Architecture

**Best approach:**
1. ✅ Centralized job queue in main DainoStore DB
2. ✅ Store database URLs encrypted in main DB
3. ✅ Connection pooling with LRU cache
4. ✅ Batch processing by store
5. ✅ Parallel store processing
6. ✅ Smart connection reuse

**Cost:** $0 additional (same infrastructure)
**Performance:** Scales to 10,000+ stores
**Complexity:** Medium (worth it for multi-tenant)

Ready to implement! 🚀
