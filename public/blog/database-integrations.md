# Database Integrations Guide

Connect and manage databases for your DainoStore. Learn about supported providers, configuration, and best practices.

---

## Overview

DainoStore supports multiple database providers:
- Supabase (PostgreSQL)
- Neon (Serverless PostgreSQL)
- PlanetScale (MySQL)
- Custom PostgreSQL
- Custom MySQL

Each store gets its own isolated database.

---

## Supported Providers

### Supabase

**Best for**: Full-featured PostgreSQL with extras

Features:
- PostgreSQL 15+
- Real-time subscriptions
- Built-in auth (optional)
- Storage (optional)
- Edge functions

**Pricing**: Free tier available, pay-as-you-grow

### Neon

**Best for**: Serverless, auto-scaling

Features:
- Serverless PostgreSQL
- Auto-scaling
- Branching for development
- Point-in-time recovery

**Pricing**: Free tier, usage-based pricing

### PlanetScale

**Best for**: MySQL at scale

Features:
- Serverless MySQL
- Horizontal scaling
- Branching workflow
- Non-blocking schema changes

**Pricing**: Free tier, usage-based

### Self-Hosted

**Best for**: Full control

Options:
- Your own PostgreSQL
- Your own MySQL
- Cloud provider managed (RDS, Cloud SQL)

---

## Setup Process

### Automatic Provisioning

For Supabase and Neon:

1. Go to **Settings > Database**
2. Click **Provision Database**
3. Select provider
4. Database created automatically
5. Credentials stored securely

### Manual Connection

For existing databases:

1. Go to **Settings > Database**
2. Click **Connect Existing**
3. Enter connection details:

| Field | Description |
|-------|-------------|
| Host | Database hostname |
| Port | Connection port |
| Database | Database name |
| Username | DB user |
| Password | DB password |
| SSL | Enable/disable |

4. Test connection
5. Save

---

## Connection Configuration

### Connection String

Format varies by provider:

**PostgreSQL**:
```
postgresql://user:password@host:5432/database?sslmode=require
```

**MySQL**:
```
mysql://user:password@host:3306/database?ssl=true
```

### Connection Pooling

DainoStore uses connection pooling:

| Setting | Default | Range |
|---------|---------|-------|
| Min connections | 2 | 1-10 |
| Max connections | 10 | 5-50 |
| Idle timeout | 30s | 10-300s |

Configure in **Settings > Database > Advanced**.

### SSL Configuration

For secure connections:

```javascript
{
  ssl: {
    rejectUnauthorized: true,
    ca: "certificate content"
  }
}
```

---

## Database Schema

### Core Tables

DainoStore creates these tables:

| Table | Purpose |
|-------|---------|
| products | Product catalog |
| categories | Product categories |
| orders | Customer orders |
| order_items | Order line items |
| customers | Customer data |
| settings | Store settings |
| users | Admin users |

### Schema Management

Migrations run automatically:
- On store creation
- On platform updates
- Via manual trigger

View migration status:
1. Go to **Settings > Database**
2. Click **Migrations**
3. See applied/pending

---

## Multi-Tenant Architecture

### Store Isolation

Each store has:
- Separate database
- Independent data
- Isolated connections

### How It Works

```
Request -> Identify Store -> Get Connection -> Query Database

Store A -> Database A
Store B -> Database B
Store C -> Database C
```

### Benefits

- Data security
- Performance isolation
- Independent scaling
- Easy backup/restore

---

## Backup and Recovery

### Automatic Backups

Depending on provider:

| Provider | Backup Frequency | Retention |
|----------|-----------------|-----------|
| Supabase | Daily | 7 days |
| Neon | Continuous | 7 days |
| PlanetScale | Continuous | 7 days |

### Manual Backup

Export your data:

1. Go to **Settings > Database**
2. Click **Backup Now**
3. Download backup file

### Restore

To restore from backup:

1. Go to **Settings > Database**
2. Click **Restore**
3. Upload backup file
4. Confirm restore

---

## Performance Optimization

### Indexing

DainoStore creates optimal indexes:
- Primary keys
- Foreign keys
- Common query patterns

### Query Optimization

Built-in optimizations:
- Query caching
- Prepared statements
- Batch operations

### Monitoring

View performance metrics:

1. Go to **Analytics > Database**
2. See:
   - Query count
   - Average latency
   - Slow queries
   - Connection usage

---

## Direct Database Access

### Query Interface

For advanced users:

1. Go to **Settings > Database**
2. Click **Query Console**
3. Run SQL queries
4. View results

### API Access

Query via API:

```javascript
// Using DainoStore SDK
const result = await store.db.query(
  'SELECT * FROM products WHERE category_id = $1',
  [categoryId]
);
```

### Security

Direct access requires:
- Admin permissions
- Audit logging enabled
- Query validation

---

## Data Migration

### Import Data

From other platforms:

1. Go to **Import > Database**
2. Select source format
3. Map fields
4. Import

### Export Data

To other systems:

1. Go to **Export > Database**
2. Select tables
3. Choose format (CSV, JSON, SQL)
4. Download

### ETL Tools

Connect with:
- Airbyte
- Fivetran
- Custom scripts

---

## Connection Management

### Viewing Connections

Monitor active connections:

1. Go to **Settings > Database**
2. Click **Connections**
3. See active connections
4. Terminate if needed

### Connection Issues

Common problems:

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused | Wrong credentials | Check connection string |
| Too many connections | Pool exhausted | Increase pool size |
| Timeout | Network/server issue | Check provider status |
| SSL error | Certificate issue | Verify SSL settings |

---

## Environment Variables

### Database Variables

Configure via environment:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
DATABASE_SSL=true
```

### Secure Storage

Credentials stored:
- Encrypted at rest
- Accessed via secure vault
- Not exposed in logs

---

## Provider-Specific Setup

### Supabase Setup

1. Create Supabase project
2. Get connection string from Settings > Database
3. Copy connection string
4. Paste in DainoStore

**Connection pooler recommended for serverless**

### Neon Setup

1. Create Neon project
2. Get connection string
3. Use pooled connection for production
4. Configure in DainoStore

**Use branching for development**

### PlanetScale Setup

1. Create PlanetScale database
2. Create branch for production
3. Get connection credentials
4. Configure with SSL

**Use safe migrations workflow**

---

## Troubleshooting

### Connection Errors

**"Connection refused"**:
- Check host/port
- Verify firewall rules
- Test from your network

**"Authentication failed"**:
- Verify username/password
- Check user permissions
- Reset credentials if needed

**"SSL certificate error"**:
- Enable SSL in settings
- Provide CA certificate
- Check SSL mode

### Performance Issues

**Slow queries**:
- Check query explain plan
- Add missing indexes
- Optimize query

**High connection count**:
- Increase pool size
- Check for connection leaks
- Reduce concurrent requests

---

## Best Practices

### Security

1. **Use SSL** - Always encrypt connections
2. **Strong passwords** - Complex credentials
3. **Least privilege** - Minimal permissions
4. **Regular rotation** - Change credentials
5. **Audit access** - Log queries

### Performance

1. **Connection pooling** - Reuse connections
2. **Index properly** - For query patterns
3. **Batch operations** - Reduce round trips
4. **Monitor metrics** - Catch issues early
5. **Scale appropriately** - Right-size resources

### Reliability

1. **Enable backups** - Automatic and manual
2. **Test recovery** - Verify backups work
3. **Monitor health** - Uptime checks
4. **Plan for failure** - Have runbooks
5. **Document setup** - For your team

---

## Next Steps

After configuring database:

1. **Test connection** - Verify connectivity
2. **Review schema** - Understand structure
3. **Set up backups** - Configure retention
4. **Monitor performance** - Set up alerts
5. **Document access** - For team members

See our Media and CDN Configuration guide for asset storage.
