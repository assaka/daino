#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/database/connection');

async function runIsSystemMigration() {
  try {
    console.log('🚀 Starting is_system column migration for cms_pages...');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add-is-system-to-cms-pages.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    console.log('🔄 Running migration with Sequelize...');
    await sequelize.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify the migration
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'cms_pages' AND column_name = 'is_system'
    `);

    if (results.length > 0) {
      console.log('✅ Verified: is_system column exists');
      console.log('📊 Column details:', results[0]);
    } else {
      console.warn('⚠️  Warning: is_system column not found after migration');
    }

    // Check how many pages are marked as system pages
    const [systemPages] = await sequelize.query(`
      SELECT COUNT(*) as count FROM cms_pages WHERE is_system = true
    `);
    console.log(`📊 System pages count: ${systemPages[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runIsSystemMigration();
}

module.exports = runIsSystemMigration;
