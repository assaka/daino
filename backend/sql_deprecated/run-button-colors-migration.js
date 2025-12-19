#!/usr/bin/env node

/**
 * Run Button Colors Migration
 * Adds button color columns to cookie_consent_settings table
 */

const { sequelize } = require('../src/database/connection');

async function runButtonColorsMigration() {
  try {
    console.log('🚀 Starting button colors migration...');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Load and run migration
    const migration = require('./20251025-add-button-colors');
    await migration.up(sequelize.getQueryInterface(), require('sequelize'));

    console.log('✅ Migration completed successfully!');

    // Verify columns were added
    const [columns] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'cookie_consent_settings'
      AND column_name LIKE '%button%color%'
      ORDER BY column_name
    `);

    console.log(`\n📊 Color columns added: ${columns.length}`);
    console.log('📋 Columns:', columns.map(c => c.column_name).join(', '));

    console.log('\n✨ Button colors are ready to use!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    if (error.original) {
      console.error('SQL Error:', error.original.message);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runButtonColorsMigration();
}

module.exports = runButtonColorsMigration;
