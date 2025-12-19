#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

/**
 * Run Attribute Translation Migrations
 *
 * This script runs both attribute and attribute value translation migrations.
 * Run this to populate the normalized translation tables.
 *
 * Usage:
 *   node backend/src/database/migrations/run-attribute-migrations.js
 */

async function runAttributeMigrations() {
  try {
    console.log('════════════════════════════════════════════════════════════');
    console.log('  ATTRIBUTE TRANSLATION MIGRATION');
    console.log('════════════════════════════════════════════════════════════\n');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Step 1: Migrate attributes
    console.log('════════════════════════════════════════════════════════════');
    console.log('STEP 1: Migrating Attribute Translations');
    console.log('════════════════════════════════════════════════════════════\n');

    const migrateAttributes = require('./migrate-attributes');
    await migrateAttributes();

    // Step 2: Migrate attribute values
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('STEP 2: Migrating Attribute Value Translations');
    console.log('════════════════════════════════════════════════════════════\n');

    const migrateAttributeValues = require('./migrate-attribute-values');
    await migrateAttributeValues();

    // Final summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✅ ALL MIGRATIONS COMPLETE!');
    console.log('════════════════════════════════════════════════════════════\n');

    const [attrCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attribute_translations
    `);
    const [valCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attribute_value_translations
    `);

    console.log('📊 Summary:');
    console.log(`   Attribute translations: ${attrCount[0].count}`);
    console.log(`   Attribute value translations: ${valCount[0].count}\n`);

    console.log('🎯 Next Steps:');
    console.log('   1. Test in admin panel - create/edit attributes');
    console.log('   2. Test in storefront - verify translated labels');
    console.log('   3. Check language switching works correctly');
    console.log('   4. Verify filtering by attributes works\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAttributeMigrations();
}

module.exports = runAttributeMigrations;
