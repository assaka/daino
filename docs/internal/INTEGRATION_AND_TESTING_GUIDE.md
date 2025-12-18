# Master-Tenant Architecture - Integration & Testing Guide

## 🎉 Implementation Complete! Now Let's Test

This guide will walk you through integrating and testing the master-tenant architecture step by step.

---

## Part 1: Setup Master Database (10 minutes)

### Step 1: Create Master DB in Supabase

1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Settings:
   - Name: `daino-master-db`
   - Password: Generate strong password (save it!)
   - Region: `us-east-1` (same as tenant DBs)
4. Wait ~2 minutes for provisioning

### Step 2: Get Credentials

**From Project Settings → Database:**
```
Connection Pooling String:
postgresql://postgres.xxxxxxxxxxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**From Project Settings → API:**
```
Project URL: https://xxxxxxxxxxxxx.supabase.co
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 3: Run Migration

1. Open Supabase Dashboard → **SQL Editor**
2. Click **"New Query"**
3. Open file: `backend/src/database/schemas/master/001-create-master-tables.sql`
4. **Copy entire contents** (644 lines)
5. Paste into SQL Editor
6. Click **"Run"** (green play button)
7. Verify success: "Success. No rows returned"

### Step 4: Verify Tables Created

In SQL Editor, run:
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

You should see 12 tables:
- api_usage_logs
- billing_transactions
- credit_balances
- credit_transactions
- job_queue
- service_credit_costs
- store_databases
- store_hostnames
- stores
- subscriptions
- usage_metrics
- users

---

## Part 2: Configure Environment Variables (5 minutes)

### Step 1: Generate Keys

```bash
cd backend

# Generate encryption key
node src/utils/encryption.js
# Copy the output (looks like: xK8vN2mP9qR4sT6wU7yZ1aB3cD5eF8gH9jK2lM4nO6p=)

# Generate JWT secret (if you don't have one)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Step 2: Update .env File

Create or update `backend/.env`:

```env
# ============================================
# MASTER DATABASE
# ============================================
MASTER_DB_URL=postgresql://postgres.xxxxxxxxxxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
MASTER_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
MASTER_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ============================================
# TENANT DATABASE (Your existing/development DB)
# ============================================
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=eyJ...

# ============================================
# SECURITY
# ============================================
# Use existing or new (same for whole platform)
ENCRYPTION_KEY=xK8vN2mP9qR4sT6wU7yZ1aB3cD5eF8gH9jK2lM4nO6p=
JWT_SECRET=aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3...
JWT_EXPIRES_IN=7d

# ============================================
# APPLICATION
# ============================================
NODE_ENV=development
PORT=3000
```

### Step 3: Upload to Render

1. Go to Render Dashboard → Your Service → **Environment**
2. Click **"Add from .env"**
3. Paste the environment variables
4. Click **"Save Changes"**

---

## Part 3: Integrate Routes into Your App (5 minutes)

### Update backend/src/server.js or app.js

Add the new routes:

```javascript
// Import new master-tenant routes
const authMasterTenantRoutes = require('./routes/authMasterTenant');
const storesMasterTenantRoutes = require('./routes/storesMasterTenant');
const creditsMasterTenantRoutes = require('./routes/creditsMasterTenant');

// Mount routes
app.use('/api/auth', authMasterTenantRoutes);
app.use('/api/stores', storesMasterTenantRoutes);
app.use('/api/credits', creditsMasterTenantRoutes);

// Optional: Keep old auth routes for backward compatibility
// app.use('/api/auth/legacy', oldAuthRoutes);
```

---

## Part 4: Test Step-by-Step

### Test 1: Master DB Connection ✅

```bash
cd backend

node -e "
const { testMasterConnection } = require('./src/database/masterConnection');
testMasterConnection().then(() => {
  console.log('✅ Master DB Connected!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
"
```

**Expected output:**
```
✅ Master database connection established successfully.
✅ Master DB Connected!
```

### Test 2: Encryption Works ✅

```bash
node -e "
const {encrypt, decrypt} = require('./src/utils/encryption');
const testData = JSON.stringify({ secret: 'test data' });
const encrypted = encrypt(testData);
console.log('Encrypted:', encrypted.substring(0, 50) + '...');
const decrypted = decrypt(encrypted);
console.log(testData === decrypted ? '✅ Encryption Works!' : '❌ Failed');
"
```

### Test 3: JWT Utilities ✅

```bash
node src/utils/jwt.js
```

**Expected output:**
```
🔑 JWT Utilities Test

Generating token...
Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiO...

Verifying token...
Decoded: {
  "userId": "test-user-123",
  "storeId": "test-store-456",
  ...
}

✅ JWT utilities working correctly
```

### Test 4: Models Load ✅

```bash
node -e "
const { MasterUser, MasterStore, CreditBalance } = require('./src/models/master');
console.log('✅ MasterUser:', MasterUser.name);
console.log('✅ MasterStore:', MasterStore.name);
console.log('✅ CreditBalance:', CreditBalance.name);
console.log('✅ All models loaded successfully!');
"
```

---

## Part 5: Test Registration Flow

### Step 1: Start Your Backend

```bash
cd backend
npm start
# Should start on http://localhost:3000
```

### Step 2: Register New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe",
    "storeName": "My First Store"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please connect a database to activate your store.",
  "data": {
    "user": {
      "id": "uuid-here",
      "email": "owner@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "store_owner",
      "account_type": "agency"
    },
    "store": {
      "id": "store-uuid-here",
      "status": "pending_database",
      "is_active": false
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

**✅ What Just Happened:**
1. User created in master DB `users` table
2. Store created in master DB `stores` table (status = 'pending_database')
3. Credit balance initialized (0.00)
4. JWT tokens generated

### Step 3: Verify in Supabase

1. Go to Master DB Supabase Dashboard
2. Click **Table Editor**
3. Check `users` table - should have 1 row
4. Check `stores` table - should have 1 row (status = 'pending_database')
5. Check `credit_balances` table - should have 1 row (balance = 0.00)

### Step 4: Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "password": "SecurePassword123!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "storeId": "store-uuid-here",
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

### Step 5: Get User Info (Protected Route)

```bash
# Save the access token from login
TOKEN="eyJhbGc..."

curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "stores": [
      {
        "id": "store-uuid",
        "status": "pending_database",
        "is_active": false
      }
    ],
    "currentStoreId": "store-uuid"
  }
}
```

---

## Part 6: Connect Tenant Database

### Step 1: Create Tenant Supabase Project (or use existing)

1. Create new Supabase project (or use existing development DB)
2. Get credentials from **Project Settings → API**:
   - Project URL
   - service_role key

### Step 2: Connect Database to Store

```bash
TOKEN="your-access-token-from-login"
STORE_ID="your-store-id-from-registration"

curl -X POST http://localhost:3000/api/stores/$STORE_ID/connect-database \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectUrl": "https://your-tenant-project.supabase.co",
    "serviceRoleKey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "storeName": "My Awesome Store",
    "storeSlug": "my-awesome-store"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Database connected and store activated successfully!",
  "data": {
    "store": {
      "id": "store-uuid",
      "status": "active",
      "is_active": true
    },
    "hostname": "my-awesome-store.daino.com",
    "provisioning": {
      "tablesCreated": [...],
      "dataSeeded": [...]
    }
  }
}
```

**✅ What Just Happened:**
1. Credentials encrypted and saved to master DB `store_databases`
2. Tenant DB connection tested
3. Tenant DB provisioned (tables created, data seeded)
4. Store record created in tenant DB
5. User record created in tenant DB
6. Hostname mapping created in master DB
7. Store activated (status = 'active')

### Step 3: Verify in Both Databases

**Master DB:**
- `store_databases` - should have encrypted credentials
- `store_hostnames` - should have hostname mapping
- `stores` - status should be 'active', is_active = true

**Tenant DB:**
- `stores` - should have full store data
- `users` - should have your user record

---

## Part 7: Test Credits System

### Step 1: Check Balance

```bash
curl -X GET http://localhost:3000/api/credits/balance \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "balance": 0.00,
    "reserved": 0.00,
    "available": 0.00,
    "lifetime_purchased": 0.00,
    "lifetime_spent": 0.00
  }
}
```

### Step 2: Purchase Credits

```bash
curl -X POST http://localhost:3000/api/credits/purchase \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "paymentMethod": "stripe",
    "paymentProviderId": "pi_test_123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Successfully purchased 100 credits",
  "data": {
    "transaction": {
      "id": "transaction-uuid",
      "amount": 100,
      "type": "purchase"
    },
    "balance": {
      "current": 100.00,
      "available": 100.00
    }
  }
}
```

### Step 3: Spend Credits

```bash
curl -X POST http://localhost:3000/api/credits/spend \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10,
    "serviceKey": "product_import",
    "description": "Imported 100 products"
  }'
```

### Step 4: View Transactions

```bash
curl -X GET "http://localhost:3000/api/credits/transactions?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Part 8: Test Hostname Resolution

### Prerequisites
Your store now has hostname: `my-awesome-store.daino.com`

For local testing, add to `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
```
127.0.0.1  my-awesome-store.daino.com
```

### Test Tenant Resolver

```javascript
// In your storefront routes
const { tenantResolver } = require('./middleware/tenantResolver');

app.get('/products', tenantResolver, async (req, res) => {
  // req.storeId is automatically resolved from hostname
  // req.tenantDb is connected and ready

  const { data: products } = await req.tenantDb
    .from('products')
    .select('*')
    .eq('is_active', true);

  res.json({ products });
});
```

---

## Part 9: Integration Checklist

### Update Your Main App File

```javascript
// backend/src/server.js or app.js

// 1. Import master connection (initializes on startup)
const { masterSequelize, testMasterConnection } = require('./database/masterConnection');

// 2. Test connection on startup
testMasterConnection().catch(err => {
  console.error('Master DB connection failed:', err);
  process.exit(1);
});

// 3. Import new routes
const authMasterTenant = require('./routes/authMasterTenant');
const storesMasterTenant = require('./routes/storesMasterTenant');
const creditsMasterTenant = require('./routes/creditsMasterTenant');

// 4. Mount routes
app.use('/api/auth', authMasterTenant);
app.use('/api/stores', storesMasterTenant);
app.use('/api/credits', creditsMasterTenant);

// 5. Optional: Keep old routes for backward compatibility
// app.use('/api/auth/legacy', oldAuthRoutes);
```

---

## Part 10: Troubleshooting

### Error: "ENCRYPTION_KEY must be 32 bytes"

**Fix:**
```bash
node src/utils/encryption.js
# Copy the generated key to .env
```

### Error: "JWT_SECRET is not configured"

**Fix:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
# Copy to .env as JWT_SECRET
```

### Error: "Unable to connect to master database"

**Fix:**
1. Verify `MASTER_DB_URL` is correct
2. Check Supabase project is running
3. Verify password is correct
4. Check firewall/IP restrictions in Supabase

### Error: "Store not found for this hostname"

**Fix:**
1. Verify hostname mapping exists:
```sql
SELECT * FROM store_hostnames WHERE hostname = 'your-hostname';
```
2. Add mapping if missing
3. Clear hostname cache

### Error: "No database configured for store"

**Fix:**
1. Connect database via `/api/stores/:id/connect-database`
2. Verify `store_databases` table has entry for your store

---

## Part 11: Complete Flow Test

### The Full Journey:

```bash
# 1. Register
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Pass123!","firstName":"Test","lastName":"User"}')

echo $REGISTER_RESPONSE | jq '.'

# Extract token and store ID
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.tokens.accessToken')
STORE_ID=$(echo $REGISTER_RESPONSE | jq -r '.data.store.id')

echo "Token: $TOKEN"
echo "Store ID: $STORE_ID"

# 2. Get user info
curl -s -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 3. Get stores
curl -s -X GET http://localhost:3000/api/stores \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 4. Connect database
curl -s -X POST "http://localhost:3000/api/stores/$STORE_ID/connect-database" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectUrl":"https://your-tenant.supabase.co",
    "serviceRoleKey":"eyJ...",
    "storeName":"Test Store",
    "storeSlug":"test-store"
  }' | jq '.'

# 5. Check balance
curl -s -X GET http://localhost:3000/api/credits/balance \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# 6. Purchase credits
curl -s -X POST http://localhost:3000/api/credits/purchase \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"paymentMethod":"stripe"}' | jq '.'

# 7. Check balance again
curl -s -X GET http://localhost:3000/api/credits/balance \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Part 12: Production Deployment

### Render Environment Variables

Add all these to Render:
```
MASTER_DB_URL=postgresql://...
MASTER_SUPABASE_URL=https://...
MASTER_SUPABASE_SERVICE_KEY=eyJ...
ENCRYPTION_KEY=...
JWT_SECRET=...
JWT_EXPIRES_IN=7d
NODE_ENV=production
```

### Deployment Checklist
- [ ] Master DB created in Supabase
- [ ] Migration run successfully
- [ ] All environment variables set in Render
- [ ] Routes integrated into main app
- [ ] Backend deployed and running
- [ ] Registration tested
- [ ] Login tested
- [ ] Database connection tested
- [ ] Credits system tested

---

## 🎯 Success Criteria

When complete, you should be able to:

✅ Register new agency user → Creates in master DB
✅ Login with credentials → Returns JWT token
✅ Create store → Store in master DB
✅ Connect Supabase database → Provisions tenant DB
✅ Query credit balance → Returns from master DB
✅ Purchase credits → Updates master DB
✅ Resolve hostname → Maps to correct store/tenant DB
✅ Access tenant data → Via ConnectionManager

---

## 📞 Need Help?

Check these files for reference:
- `MASTER_TENANT_SETUP_GUIDE.md` - Initial setup
- `PHASE_2_COMPLETE_SUMMARY.md` - What's built
- `backend/src/models/master/` - All models with comments
- `backend/src/routes/authMasterTenant.js` - Auth examples

---

**Ready to test! Start with Part 1 (Setup Master Database) and work through each part sequentially.** 🚀
