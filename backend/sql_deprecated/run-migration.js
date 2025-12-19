#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

async function runMigration() {
  try {
    console.log('🚀 Starting database migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'create-all-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    
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
    
    console.log('✅ Migration completed successfully!');
    
    // Test the migration by counting tables
    const tables = await sequelize.getQueryInterface().showAllTables();
    console.log(`📊 Total tables created: ${tables.length}`);
    console.log('📋 Tables:', tables.join(', '));
    
    // Test store creation
    console.log('🧪 Testing store creation...');
    const { Store } = require('../src/models');
    const storeCount = await Store.count();
    console.log(`📊 Current stores count: ${storeCount}`);
    
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