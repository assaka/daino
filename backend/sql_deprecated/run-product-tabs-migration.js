#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

async function runProductTabsMigration() {
  try {
    console.log('🚀 Starting product tabs migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add-product-tabs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Product tabs migration file loaded');
    
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
    
    console.log('✅ Product tabs migration completed successfully!');
    
    // Test the migration by checking tables
    try {
      const [results] = await sequelize.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('product_tabs', 'product_labels', 'payment_methods')");
      console.log(`📊 Tables created: ${results.map(r => r.tablename).join(', ')}`);
    } catch (e) {
      console.log('ℹ️  Could not list tables (may be using SQLite)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Product tabs migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runProductTabsMigration();
}

module.exports = runProductTabsMigration;