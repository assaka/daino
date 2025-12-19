/**
 * Run the complete sales tables migration
 * This script renames orders -> sales_orders and order_items -> sales_order_items
 * and creates the new sales_invoices and sales_shipments tables
 *
 * All existing data will be preserved during the rename operations
 */

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../database/connection');

async function runMigration() {
  console.log('🚀 Starting sales tables migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '20250205_complete_sales_tables_migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📖 Reading migration file...');
    console.log('📁 File:', migrationPath);
    console.log('');

    // Execute the migration
    console.log('⚙️  Executing migration...');
    console.log('');

    await sequelize.query(migrationSQL);

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log('  ✓ Created sales_invoices table');
    console.log('  ✓ Created sales_shipments table');
    console.log('  ✓ Renamed orders → sales_orders (all data preserved)');
    console.log('  ✓ Renamed order_items → sales_order_items (all data preserved)');
    console.log('  ✓ Updated all foreign key constraints');
    console.log('  ✓ Created indexes and triggers');
    console.log('');

    // Verify the migration
    const [ordersCount] = await sequelize.query('SELECT COUNT(*) as count FROM sales_orders');
    const [itemsCount] = await sequelize.query('SELECT COUNT(*) as count FROM sales_order_items');
    const [invoicesCount] = await sequelize.query('SELECT COUNT(*) as count FROM sales_invoices');
    const [shipmentsCount] = await sequelize.query('SELECT COUNT(*) as count FROM sales_shipments');

    console.log('📈 Current data:');
    console.log(`  • sales_orders: ${ordersCount[0].count} records`);
    console.log(`  • sales_order_items: ${itemsCount[0].count} records`);
    console.log(`  • sales_invoices: ${invoicesCount[0].count} records`);
    console.log(`  • sales_shipments: ${shipmentsCount[0].count} records`);
    console.log('');

    console.log('🎉 All done! Your database has been successfully migrated.');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    console.error('');
    console.error('💡 The migration is wrapped in a transaction, so no changes should have been committed.');
    console.error('');

    process.exit(1);
  }
}

// Run the migration
runMigration();
