#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');
const migration = require('./20250126-add-performance-indexes');

async function runMigration() {
  try {
    console.log('🚀 Starting performance indexes migration...\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Get query interface
    const queryInterface = sequelize.getQueryInterface();

    // Run the migration
    await migration.up(queryInterface, require('sequelize'));

    console.log('\n✅ Performance indexes migration completed successfully!\n');

    // Verify indexes
    console.log('🔍 Verifying indexes...\n');
    const [results] = await sequelize.query(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('products', 'categories', 'product_translations', 'category_translations', 'product_attribute_values')
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `);

    console.log('📋 Indexes created:\n');

    const grouped = {};
    results.forEach(row => {
      if (!grouped[row.tablename]) grouped[row.tablename] = [];
      grouped[row.tablename].push(row.indexname);
    });

    Object.entries(grouped).forEach(([table, indexes]) => {
      console.log(`  ${table}:`);
      indexes.forEach(idx => console.log(`    ✓ ${idx}`));
      console.log('');
    });

    console.log(`Total indexes: ${results.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
