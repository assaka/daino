# Database Migration Guide

This directory contains the complete database migration scripts for the DainoStore E-commerce Platform.

## Files

- `create-all-tables.sql` - Complete SQL migration script
- `run-migration.js` - Node.js script to run the migration
- `README.md` - This documentation file

## Migration Script Features

### ✅ Complete Schema
The migration script creates **16 tables** with full relationships:

1. **users** - User accounts and authentication
2. **stores** - Online stores
3. **products** - Product catalog
4. **categories** - Product categories
5. **orders** - Customer orders
6. **order_items** - Order line items
7. **customers** - Store customers
8. **coupons** - Discount codes
9. **cms_pages** - Content management
10. **attributes** - Product attributes
11. **attribute_sets** - Attribute groupings
12. **taxes** - Tax configurations
13. **shipping_methods** - Shipping options
14. **delivery_settings** - Delivery preferences
15. **credit_transactions** - Credit system
16. **login_attempts** - Security logging

### ✅ Advanced Features
- **UUID Primary Keys** - Using PostgreSQL UUID extension
- **Comprehensive Indexes** - Optimized for performance
- **Automatic Timestamps** - Created/updated triggers
- **Foreign Key Constraints** - Data integrity
- **Check Constraints** - Data validation
- **JSONB Support** - Flexible data storage
- **Demo Data** - Pre-populated test data

### ✅ Supabase Optimized
- Compatible with Supabase PostgreSQL
- Uses Supabase-specific features
- Handles existing table conflicts gracefully

## How to Run Migration

### Method 1: Using Node.js Script (Recommended)
```bash
cd backend
node src/database/migrations/run-migration.js
```

### Method 2: Using API Endpoint
```bash
curl -X POST https://backend.dainostore.com/api/stores/migrate
```

### Method 3: Manual SQL Execution
1. Copy the contents of `create-all-tables.sql`
2. Open your Supabase SQL Editor
3. Paste and execute the SQL

### Method 4: Using Sequelize Sync
```bash
cd backend
npm start
# The migration will run automatically on server start
```

## Verification

After running the migration, verify success by:

1. **Check table count**:
   ```sql
   SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

2. **View summary**:
   ```sql
   SELECT * FROM database_summary;
   ```

3. **Test API endpoint**:
   ```bash
   curl https://backend.dainostore.com/api/stores/debug
   ```

## Demo Data

The migration includes demo data for testing:
- Admin user: `admin@daino.com` / `password`
- Demo user: `demo@daino.com` / `password`
- Demo store: "Demo Store" with sample products
- Basic categories, shipping, and tax settings

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure your Supabase user has proper permissions
   - Check connection string in environment variables

2. **Table Already Exists**
   - The script uses `IF NOT EXISTS` - it's safe to re-run
   - Use `ON CONFLICT DO NOTHING` for data inserts

3. **UUID Extension Missing**
   - The script automatically creates the UUID extension
   - If it fails, manually enable: `CREATE EXTENSION "uuid-ossp";`

4. **Connection Timeout**
   - Increase timeout in database configuration
   - Run migration in smaller batches

### Recovery

To completely reset the database:
1. Uncomment the DROP statements at the top of the SQL file
2. Re-run the migration
3. **⚠️ WARNING: This will delete all existing data!**

## Environment Variables Required

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_DB_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres
```

## Support

For issues or questions:
1. Check the migration logs
2. Verify environment variables
3. Test database connection
4. Review Supabase dashboard for errors

---

**Last Updated**: 2025-01-16
**Compatible With**: PostgreSQL 13+, Supabase
**Tables Created**: 16
**Demo Data**: Included