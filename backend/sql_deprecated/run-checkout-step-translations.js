#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

async function runCheckoutStepTranslationsMigration() {
  try {
    console.log('🚀 Starting checkout step translations migration...');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'seed-checkout-step-translations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Checkout step translations migration file loaded');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Run the migration using Sequelize
    console.log('🔄 Running migration with Sequelize...');
    await sequelize.query(migrationSQL);

    console.log('✅ Checkout step translations migration completed successfully!');

    // Test the migration by checking if translations were inserted
    try {
      const [results] = await sequelize.query(
        "SELECT key, value FROM translations WHERE key LIKE 'checkout.step_%' AND language_code = 'en'"
      );
      if (results.length > 0) {
        console.log(`✅ Successfully inserted ${results.length} checkout step translations:`);
        results.forEach(row => {
          console.log(`   - ${row.key}: "${row.value}"`);
        });
      } else {
        console.log('⚠️  No checkout step translations found in database');
      }
    } catch (e) {
      console.log('ℹ️  Could not verify translations:', e.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Checkout step translations migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runCheckoutStepTranslationsMigration();
}

module.exports = runCheckoutStepTranslationsMigration;
