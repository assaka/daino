# Master-Tenant Database Architecture - Setup Guide

## Phase 1 Implementation Complete! 🎉

This guide will help you set up the master-tenant database architecture for DainoStore.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   MASTER DATABASE                        │
│  (Platform Management - Single Supabase Project)        │
├─────────────────────────────────────────────────────────┤
│ • users (agencies only)                                 │
│ • stores (minimal registry: id, user_id, status)        │
│ • subscriptions                                          │
│ • credit_balances (source of truth)                     │
│ • credit_transactions                                    │
│ • store_databases (encrypted tenant credentials)        │
│ • store_hostnames (hostname → store mapping)            │
│ • job_queue (centralized)                               │
│ • Monitoring tables                                     │
└─────────────────────────────────────────────────────────┘
                          ↕️
            Your Backend (Render) - Acts as Bridge
                          ↕️
┌─────────────────────────────────────────────────────────┐
│               TENANT DATABASES (One per store)          │
│  (Store Operations - Separate Supabase Projects)       │
├─────────────────────────────────────────────────────────┤
│ • stores (FULL data: name, slug, settings, etc.)       │
│ • users (ALL types: agency, admin, staff, customers)   │
│ • products, orders, customers (all e-commerce)         │
│ • plugins (all 15+ plugin tables)                      │
│ • cron_jobs (tenant-managed)                            │
│ • credit_balance_cache (cached from master)            │
│ • credit_spending_log                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1: Create Master Database (Supabase)

### 1.1 Create New Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Settings:
   - **Name**: `daino-master-db`
   - **Database Password**: Generate strong password
   - **Region**: Same as tenant DBs (e.g., `us-east-1`)
4. Wait for provisioning (~2 minutes)

### 1.2 Get Connection Details

After project is created:

1. Go to **Project Settings → Database**
2. Copy these values:

```
Connection Pooling (Use this for production):
Host: aws-0-us-east-1.pooler.supabase.com
Port: 6543
User: postgres.[PROJECT_REF]
Password: [your-password]
Database: postgres

Connection String:
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

3. Also get from **Project Settings → API**:
```
Project URL: https://[PROJECT_REF].supabase.co
anon/public key: eyJhbGc...
service_role key: eyJhbGc...
```

### 1.3 Run Master DB Migration

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **"New Query"**
3. Open `backend/src/database/schemas/master/001-create-master-tables.sql`
4. **Copy entire contents** and paste into SQL Editor
5. Click **"Run"**
6. Verify tables created: Check **Database → Tables**

You should see:
- users
- stores
- store_databases
- store_hostnames
- subscriptions
- credit_balances
- credit_transactions
- service_credit_costs
- job_queue
- usage_metrics
- api_usage_logs
- billing_transactions

---

## Step 2: Generate Encryption Key

### 2.1 Generate Key

Run in terminal:

```bash
node backend/src/utils/encryption.js
```

Or:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

This generates something like:
```
xK8vN2mP9qR4sT6wU7yZ1aB3cD5eF8gH9jK2lM4nO6p=
```

**⚠️ IMPORTANT**:
- Save this key securely
- Never commit to Git
- Different key for dev/prod

---

## Step 3: Generate JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

Generates:
```
aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6=
```

---

## Step 4: Configure Environment Variables

### 4.1 Local Development (.env)

Create `backend/.env`:

```env
# ============================================
# MASTER DATABASE
# ============================================
MASTER_DB_URL=postgresql://postgres.xxxxxxxxxxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
MASTER_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
MASTER_SUPABASE_SERVICE_KEY=eyJhbGc...

# ============================================
# TENANT DATABASE (Default for Development)
# ============================================
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

# ============================================
# SECURITY
# ============================================
ENCRYPTION_KEY=xK8vN2mP9qR4sT6wU7yZ1aB3cD5eF8gH9jK2lM4nO6p=
JWT_SECRET=aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6gH7iJ8kL9mN0oP1qR2sT3uV4wX5yZ6=
JWT_EXPIRES_IN=7d

# ============================================
# APPLICATION
# ============================================
NODE_ENV=development
PORT=3000
```

### 4.2 Production (Render)

1. Go to Render Dashboard → Your Service → **Environment**
2. Click **"Add from .env"**
3. Paste your production .env (with production values)
4. Or add individually:

```
MASTER_DB_URL=postgresql://...
MASTER_SUPABASE_URL=https://...
MASTER_SUPABASE_SERVICE_KEY=eyJ...
ENCRYPTION_KEY=xK8...
JWT_SECRET=aB1...
JWT_EXPIRES_IN=7d
NODE_ENV=production
```

5. Click **"Save Changes"**

---

## Step 5: Test Master DB Connection

### 5.1 Test Locally

```bash
cd backend
node -e "
const { masterSequelize, testMasterConnection } = require('./src/database/masterConnection');
testMasterConnection().then(() => {
  console.log('✅ Master DB connected!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Connection failed:', err.message);
  process.exit(1);
});
"
```

Expected output:
```
✅ Master database connection established successfully.
✅ Master DB connected!
```

### 5.2 Verify Tables

```bash
node -e "
const { masterSequelize } = require('./src/database/masterConnection');
masterSequelize.query('SELECT tablename FROM pg_tables WHERE schemaname = \\'public\\' ORDER BY tablename').then(([results]) => {
  console.log('Master DB Tables:');
  results.forEach(r => console.log('  -', r.tablename));
  process.exit(0);
});
"
```

---

## Step 6: Next Steps (Phase 2)

Phase 1 is complete! Master DB is set up. Next phases:

### Phase 2: Create Models & Services
- [ ] Create MasterStore model
- [ ] Create CreditBalance, CreditTransaction models
- [ ] Create StoreDatabase, StoreHostname models
- [ ] Create ConnectionManager service
- [ ] Create JWT auth utilities

### Phase 3: Authentication & Routes
- [ ] Create auth middleware (JWT)
- [ ] Create login/register routes
- [ ] Create TenantResolver middleware
- [ ] Create credits API routes

### Phase 4: Plugin Code Protection
- [ ] Move plugin marketplace to master DB
- [ ] Implement cached plugin execution
- [ ] Add license verification

---

## Troubleshooting

### Connection Refused Error

```
Error: connect ECONNREFUSED
```

**Fix**: Check firewall/IP restrictions in Supabase:
1. Go to Project Settings → Database → Connection Pooling
2. Add your IP to allowed list

### Invalid Encryption Key

```
Error: ENCRYPTION_KEY must be 32 bytes
```

**Fix**: Generate new key with correct length:
```bash
node backend/src/utils/encryption.js
```

### Tables Already Exist

```
Error: relation "users" already exists
```

**Fix**: Migration already run. Skip or drop tables:
```sql
DROP TABLE IF EXISTS users CASCADE;
-- Then re-run migration
```

---

## Security Checklist

- [ ] `.env` added to `.gitignore`
- [ ] Different encryption keys for dev/prod
- [ ] Different JWT secrets for dev/prod
- [ ] Master DB credentials not committed to Git
- [ ] Supabase IP restrictions enabled (optional)
- [ ] SSL enabled for production connections
- [ ] Service role keys kept secret (never exposed to frontend)

---

## File Structure

```
backend/
├── src/
│   ├── database/
│   │   ├── connection.js (tenant DB - existing)
│   │   ├── masterConnection.js (NEW - master DB)
│   │   └── schemas/
│   │       ├── master/
│   │       │   └── 001-create-master-tables.sql (NEW)
│   │       └── tenant/
│   │           └── TENANT_TABLES_REFERENCE.md (NEW)
│   ├── config/
│   │   └── database.js (UPDATED - dual DB config)
│   └── utils/
│       └── encryption.js (NEW - AES-256-GCM)
├── .env (NOT in Git)
└── .env.example (Template)
```

---

## Support

If you encounter issues:

1. Check this guide first
2. Verify all environment variables are set
3. Test connection with scripts above
4. Check Supabase logs in Dashboard → Logs

---

## What's Next?

Ready to continue with Phase 2? Let me know and I'll implement:
1. Database models for master DB
2. ConnectionManager service
3. JWT authentication system
4. Credit system routes

🎉 **Phase 1 Complete! Master DB is ready.**
