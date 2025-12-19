#!/usr/bin/env node

/**
 * Migration Runner: Make credit_usage.store_id nullable
 *
 * This script runs the migration to allow null values for store_id
 * in the credit_usage table, enabling tracking of global features
 * like UI labels translation.
 */

const path = require('path');
const { sequelize } = require('../src/database/connection');

async function runMigration() {
  try {
    console.log('🚀 Starting migration: Make credit_usage.store_id nullable');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Load and run the migration
    const migrationFile = require('./20251107_make_credit_usage_store_id_nullable');

    console.log('🔄 Running migration UP...');
    await migrationFile.up(sequelize.queryInterface, sequelize.Sequelize);

    console.log('✅ Migration completed successfully!');
    console.log('📊 The credit_usage.store_id column now allows NULL values');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the migration
runMigration();
