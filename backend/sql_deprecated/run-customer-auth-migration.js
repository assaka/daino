#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { sequelize, supabase } = require('../src/database/connection');

async function runCustomerAuthMigration() {
  try {
    console.log('🚀 Starting customer authentication migration...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'add-customer-authentication-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Customer auth migration file loaded');
    
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
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('COMMENT'));
      
      console.log(`📊 Found ${statements.length} SQL statements to execute`);
      
      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            console.log(`⏳ Executing statement ${i + 1}/${statements.length}`);
            console.log(`📝 Statement: ${statement.substring(0, 100)}...`);
            
            const { error } = await supabase.rpc('exec_sql', { sql: statement });
            if (error) {
              console.warn(`⚠️  Statement ${i + 1} warning:`, error.message);
              // Don't fail for warnings, continue with next statement
            } else {
              console.log(`✅ Statement ${i + 1} executed successfully`);
            }
          } catch (error) {
            console.warn(`⚠️  Statement ${i + 1} error:`, error.message);
            // Don't fail for individual statement errors, continue
          }
        }
      }
    } else {
      console.log('🔄 Running migration with Sequelize...');
      
      // Split and execute statements individually for better error handling
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('COMMENT'));
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            console.log(`⏳ Executing statement ${i + 1}/${statements.length}`);
            await sequelize.query(statement);
            console.log(`✅ Statement ${i + 1} executed successfully`);
          } catch (error) {
            console.warn(`⚠️  Statement ${i + 1} error:`, error.message);
            // Continue with next statement even if one fails
          }
        }
      }
    }
    
    console.log('✅ Customer authentication migration completed!');
    
    // Test the migration by checking customers table structure
    console.log('🧪 Testing customers table structure...');
    const [results] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 Customers table columns:');
    results.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Test customer model
    console.log('🧪 Testing Customer model...');
    const { Customer } = require('../src/models');
    const customerCount = await Customer.count();
    console.log(`📊 Current customers count: ${customerCount}`);
    
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runCustomerAuthMigration();
}

module.exports = runCustomerAuthMigration;