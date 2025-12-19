#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

async function runMigration() {
  try {
    console.log('🚀 Starting cookie and checkout translations migration...');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add-cookie-and-checkout-translations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Run the migration using Sequelize
    console.log('🔄 Running migration with Sequelize...');
    await sequelize.query(migrationSQL);

    console.log('✅ Cookie and checkout translations migration completed successfully!');

    // Verify translations were added
    const [results] = await sequelize.query(`
      SELECT key, language_code, value
      FROM translations
      WHERE key IN ('cookie.preferences', 'cookie.manage_preferences', 'checkout.login_prompt')
      ORDER BY key, language_code
    `);

    console.log('\n📊 Added translations:');
    results.forEach(row => {
      console.log(`  ${row.key} [${row.language_code}]: ${row.value}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
