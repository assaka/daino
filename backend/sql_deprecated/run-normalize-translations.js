#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

/**
 * Normalize Translations and SEO Migration Runner
 *
 * This script runs the full normalization migration:
 * 1. Creates all normalized tables
 * 2. Copies JSON data to normalized tables
 * 3. Preserves original JSON columns for rollback
 *
 * IMPORTANT: Make sure you have a database backup before running!
 *
 * Usage:
 *   node backend/src/database/migrations/run-normalize-translations.js
 */

async function runNormalizationMigrations() {
  try {
    console.log('🔄 Starting Translation & SEO Normalization...\n');
    console.log('⚠️  IMPORTANT: This migration will:');
    console.log('   - Create 15 new normalized tables');
    console.log('   - Copy all translation and SEO data');
    console.log('   - Preserve original JSON columns');
    console.log('   Make sure you have a database backup!\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Step 1: Create normalized tables
    console.log('════════════════════════════════════════════════════════════');
    console.log('STEP 1: Creating Normalized Tables');
    console.log('════════════════════════════════════════════════════════════\n');

    const createTablesMigration = require('./20251024_create_normalized_translations_and_seo');
    await createTablesMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);

    // Step 2: Migrate data from JSON to normalized tables
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('STEP 2: Migrating Data to Normalized Tables');
    console.log('════════════════════════════════════════════════════════════\n');

    const migrateDataMigration = require('./20251024_migrate_json_to_normalized_tables');
    await migrateDataMigration.up(sequelize.getQueryInterface(), sequelize.Sequelize);

    // Success summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✅ NORMALIZATION COMPLETE!');
    console.log('════════════════════════════════════════════════════════════\n');

    console.log('📊 What Changed:');
    console.log('   ✅ Created 12 entity translation tables');
    console.log('   ✅ Created 3 SEO metadata tables');
    console.log('   ✅ Migrated all JSON data to normalized tables');
    console.log('   ✅ Added full-text search indexes');
    console.log('   ✅ Original JSON columns preserved\n');

    console.log('🔍 Verification:');
    console.log('   Run these queries to verify data migration:');
    console.log('   SELECT COUNT(*) FROM product_translations;');
    console.log('   SELECT COUNT(*) FROM category_translations;');
    console.log('   SELECT COUNT(*) FROM product_seo;\n');

    console.log('⚠️  Next Steps:');
    console.log('   1. Update Sequelize models with translation associations');
    console.log('   2. Update backend routes to use JOIN queries');
    console.log('   3. Test all storefront pages thoroughly');
    console.log('   4. Once verified, drop JSON columns (separate migration)\n');

    console.log('💾 Rollback Instructions:');
    console.log('   If you need to rollback:');
    console.log('   1. The JSON columns still exist with all original data');
    console.log('   2. Simply switch backend to read from JSON columns');
    console.log('   3. Drop normalized tables when ready\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    console.error('\nStack trace:', error.stack);
    console.error('\n⚠️  Database state:');
    console.error('   - Some tables may have been created');
    console.error('   - Original JSON columns are untouched');
    console.error('   - Safe to retry after fixing the error\n');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runNormalizationMigrations();
}

module.exports = runNormalizationMigrations;
