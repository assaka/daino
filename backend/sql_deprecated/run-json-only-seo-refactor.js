#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

/**
 * JSON-Only SEO Refactor Migration Runner
 *
 * This script consolidates all SEO fields into JSON columns for cleaner schema.
 *
 * IMPORTANT: This migration is DESTRUCTIVE
 * - Backs up data from individual columns to JSON
 * - Drops 33 individual columns across all tables
 * - Results in 4 clean JSON columns
 *
 * Make sure you have a database backup before running!
 */

async function runJsonOnlySeoRefactor() {
  try {
    console.log('🔄 Starting JSON-Only SEO Refactor...\n');
    console.log('⚠️  WARNING: This migration will drop 33 columns!');
    console.log('   Make sure you have a database backup.\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Import and run the migration
    const migration = require('./20251024_refactor_to_json_only_seo');

    console.log('🚀 Running migration...\n');
    await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Result:');
    console.log('   - Products table: Now using seo JSON only');
    console.log('   - Categories table: Now using seo JSON only');
    console.log('   - CMS Pages table: Now using seo JSON only');
    console.log('   - SEO Templates table: Now using template JSON only');
    console.log('\n💡 Benefits:');
    console.log('   ✅ Cleaner schema (33 columns → 4 JSON columns)');
    console.log('   ✅ More flexible (add new SEO fields without migrations)');
    console.log('   ✅ Easier to understand (all SEO data in one place)');
    console.log('   ✅ All existing data preserved');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    console.error('\nStack trace:', error.stack);
    console.error('\n⚠️  If migration partially completed, restore from backup!');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runJsonOnlySeoRefactor();
}

module.exports = runJsonOnlySeoRefactor;
