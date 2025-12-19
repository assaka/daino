const fs = require('fs');
const path = require('path');

// Import database connection
const { sequelize } = require('../src/database/connection');

async function runSortOrderMigration() {
  try {
    console.log('🚀 Starting sort_order migration for product_labels...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add-sort-order-to-product-labels.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    console.log('SQL:', migrationSQL);
    
    // Execute the migration
    const results = await sequelize.query(migrationSQL, {
      type: sequelize.QueryTypes.RAW
    });
    
    console.log('✅ Migration completed successfully!');
    console.log('Results:', results);
    
    // Verify the column was added
    console.log('🔍 Verifying sort_order column exists...');
    const columnCheck = await sequelize.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'product_labels' 
      AND column_name = 'sort_order';
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    if (columnCheck.length > 0) {
      console.log('✅ sort_order column verified:', columnCheck[0]);
    } else {
      console.log('❌ sort_order column not found');
    }
    
    // Check current product labels data
    console.log('📊 Checking current product labels...');
    const labels = await sequelize.query(`
      SELECT id, name, priority, sort_order 
      FROM product_labels 
      ORDER BY sort_order ASC, priority DESC 
      LIMIT 10;
    `, {
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('Current product labels with sort_order:', labels);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    if (error.original) {
      console.error('Original error:', error.original);
    }
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔐 Database connection closed');
  }
}

// Run the migration
runSortOrderMigration();