/**
 * Run Stock Settings Translations Migration
 *
 * Migrates stock label translations from stores.settings to translations table
 */

const { sequelize } = require('../src/database/connection');
const migration = require('./20250125-migrate-stock-settings-translations');

async function runMigration() {
  try {
    console.log('Starting stock settings translations migration...\n');

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
