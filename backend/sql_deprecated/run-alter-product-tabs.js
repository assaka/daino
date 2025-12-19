#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

async function runAlterProductTabs() {
  try {
    console.log('🚀 Starting product tabs ALTER migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'alter-product-tabs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 ALTER migration file loaded');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');
    
    // Check if we're using PostgreSQL (production) or SQLite (local)
    const dialect = sequelize.getDialect();
    console.log(`📊 Database dialect: ${dialect}`);
    
    if (dialect === 'postgres') {
      console.log('🔄 Running PostgreSQL ALTER migration...');
      
      // Run the migration using Supabase if available, otherwise use Sequelize
      if (supabase) {
        console.log('🔄 Running migration with Supabase client...');
        
        // For PostgreSQL, we can run the whole script at once
        const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
        if (error) {
          console.error('❌ Supabase migration error:', error);
          throw error;
        }
        console.log('✅ Supabase migration completed');
      } else {
        console.log('🔄 Running migration with Sequelize...');
        await sequelize.query(migrationSQL);
        console.log('✅ Sequelize migration completed');
      }
    } else {
      console.log('🔄 Running SQLite-compatible migration...');
      // For SQLite, we need to handle it differently since it doesn't support all PostgreSQL features
      const sqliteStatements = [
        `ALTER TABLE product_tabs ADD COLUMN tab_type VARCHAR(20) DEFAULT 'text'`,
        `ALTER TABLE product_tabs ADD COLUMN content TEXT`,
        `ALTER TABLE product_tabs ADD COLUMN attribute_ids TEXT DEFAULT '[]'`,
        `ALTER TABLE product_tabs ADD COLUMN attribute_set_ids TEXT DEFAULT '[]'`
      ];
      
      for (const statement of sqliteStatements) {
        try {
          await sequelize.query(statement);
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        } catch (error) {
          if (error.message.includes('duplicate column name')) {
            console.log(`ℹ️  Column already exists: ${statement.substring(0, 50)}...`);
          } else {
            console.warn(`⚠️  Statement warning: ${error.message}`);
          }
        }
      }
    }
    
    console.log('✅ Product tabs ALTER migration completed successfully!');
    
    // Verify the columns exist
    try {
      const [results] = await sequelize.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'product_tabs'
        ORDER BY column_name
      `);
      console.log('📊 Product tabs columns:', results.map(r => r.column_name).join(', '));
    } catch (e) {
      console.log('ℹ️  Could not list columns (may be using SQLite)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Product tabs ALTER migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runAlterProductTabs();
}

module.exports = runAlterProductTabs;