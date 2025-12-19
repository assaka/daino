/**
 * Run Common Plural Translations Migration
 *
 * Adds translatable plural forms (item/items, unit/units, piece/pieces)
 * to the translations table for stock labels
 */

require('dotenv').config();

const { sequelize } = require('../src/database/connection');
const migration = require('./20250127-add-common-plural-translations');

async function runMigration() {
  try {
    console.log('Starting common plural translations migration...\n');

    // Run the migration
    await migration.up(sequelize.queryInterface, sequelize.Sequelize);

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
