# Sales Tables Migration Guide

This guide will help you migrate your existing `orders` and `order_items` tables to the new naming convention: `sales_orders` and `sales_order_items`, and add the new `sales_invoices` and `sales_shipments` tables.

## Important Notes

⚠️ **Data Safety**: The migration uses `ALTER TABLE ... RENAME TO ...` which **preserves ALL existing data**. No data will be lost during the rename operations.

⚠️ **Transaction Wrapped**: The migration is wrapped in a transaction, so if anything fails, all changes will be rolled back automatically.

⚠️ **Backup Recommended**: Although the migration is safe, it's always recommended to backup your database before running migrations.

## What This Migration Does

1. ✅ Creates `sales_invoices` table (tracks invoice emails)
2. ✅ Creates `sales_shipments` table (tracks shipment notifications)
3. ✅ Renames `orders` → `sales_orders` (preserves all data)
4. ✅ Renames `order_items` → `sales_order_items` (preserves all data)
5. ✅ Updates all foreign key constraints
6. ✅ Creates all necessary indexes and triggers
7. ✅ Verifies the migration completed successfully

## Migration Methods

### Method 1: Using Node.js Script (Recommended)

This is the easiest method and provides detailed progress information.

```bash
# From the project root
cd backend
node src/database/run-sales-migration.js
```

### Method 2: Using psql Command Line

If you prefer to use psql directly:

```bash
# Connect to your database and run the migration
psql -U your_username -d your_database_name -f backend/src/database/migrations/20250205_complete_sales_tables_migration.sql
```

Replace:
- `your_username` with your PostgreSQL username
- `your_database_name` with your database name

### Method 3: Manual Execution

If you're using a database GUI tool (like pgAdmin, DBeaver, etc.):

1. Open the file: `backend/src/database/migrations/20250205_complete_sales_tables_migration.sql`
2. Copy the entire contents
3. Paste into your database query tool
4. Execute the query

## After Migration

### Update Your Application

The application code has already been updated to use the new table names:
- ✅ Models updated (`Order.js`, `OrderItem.js`)
- ✅ API routes updated (`orders.js`)
- ✅ Frontend components updated (`Orders.jsx`)
- ✅ New models created (`Invoice.js`, `Shipment.js`)

### Verify Migration Success

After running the migration, you can verify it succeeded by checking:

```sql
-- Check table exists and data is preserved
SELECT COUNT(*) FROM sales_orders;
SELECT COUNT(*) FROM sales_order_items;
SELECT COUNT(*) FROM sales_invoices;
SELECT COUNT(*) FROM sales_shipments;

-- Verify old tables no longer exist
SELECT tablename FROM pg_tables WHERE tablename IN ('orders', 'order_items');
-- Should return 0 rows
```

### New API Endpoints Available

After migration, these new endpoints will be available:

1. **POST** `/api/orders/:id/resend-confirmation` - Resend order confirmation
2. **POST** `/api/orders/:id/send-invoice` - Send/resend invoice email
3. **POST** `/api/orders/:id/send-shipment` - Send/resend shipment notification

### New Admin UI Features

The Orders admin page now has action buttons:
- 🔄 **Resend Order** - Always visible
- 📄 **Send Invoice** - Shown when payment is offline or auto-invoice is disabled
- 🚚 **Send Shipment** - Shown when auto-ship notifications are disabled

## Rollback (If Needed)

If you need to rollback the migration for any reason:

```sql
BEGIN;

-- Rename tables back
ALTER TABLE sales_orders RENAME TO orders;
ALTER TABLE sales_order_items RENAME TO order_items;

-- Drop new tables
DROP TABLE IF EXISTS sales_invoices CASCADE;
DROP TABLE IF EXISTS sales_shipments CASCADE;

-- Recreate old constraints
ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS sales_order_items_order_id_fkey,
    ADD CONSTRAINT order_items_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

COMMIT;
```

## Troubleshooting

### Error: "relation already exists"

This means the migration has already been run. You can safely ignore this or check if the tables were successfully migrated.

### Error: Foreign key constraint violations

This means there might be data inconsistencies. Check:
1. Are there any orphaned order_items?
2. Are all foreign key references valid?

### Error: Permission denied

Make sure your database user has the necessary permissions:
- CREATE TABLE
- ALTER TABLE
- DROP CONSTRAINT
- ADD CONSTRAINT

## Need Help?

If you encounter any issues during migration:
1. Check the error message carefully
2. Verify your database connection settings
3. Ensure you have the necessary permissions
4. Make sure no other processes are accessing the tables

## Questions?

- All data is preserved during table renames
- Foreign key relationships are maintained
- Indexes and triggers are recreated
- The migration is idempotent (safe to run multiple times)
