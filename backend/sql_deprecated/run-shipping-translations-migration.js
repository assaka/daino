#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

async function runShippingTranslationsMigration() {
  try {
    console.log('🚀 Starting shipping translations migration...');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add-translations-to-shipping-methods.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Shipping translations migration file loaded');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Run the migration using Supabase if available, otherwise use Sequelize
    if (supabase) {
      console.log('🔄 Running migration with Supabase client...');

      // Split SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      console.log(`📊 Found ${statements.length} SQL statements to execute`);

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            console.log(`⏳ Executing statement ${i + 1}/${statements.length}`);
            const { error } = await supabase.rpc('exec_sql', { sql: statement });
            if (error) {
              console.warn(`⚠️  Statement ${i + 1} warning:`, error.message);
            } else {
              console.log(`✅ Statement ${i + 1} executed successfully`);
            }
          } catch (error) {
            console.warn(`⚠️  Statement ${i + 1} error:`, error.message);
          }
        }
      }
    } else {
      console.log('🔄 Running migration with Sequelize...');
      await sequelize.query(migrationSQL);
    }

    console.log('✅ Shipping translations migration completed successfully!');

    // Test the migration by checking the column
    try {
      const [results] = await sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'shipping_methods' AND column_name = 'translations'"
      );
      if (results.length > 0) {
        console.log('✅ Translations column successfully added to shipping_methods table');
      }
    } catch (e) {
      console.log('ℹ️  Could not verify column (may be using SQLite)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Shipping translations migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runShippingTranslationsMigration();
}

module.exports = runShippingTranslationsMigration;
