#!/usr/bin/env node

/**
 * Fix product_labels timestamp defaults on production database
 *
 * Usage:
 * SUPABASE_DB_URL=your_db_url JWT_SECRET=your_secret node run-product-labels-fix.js
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

async function runProductLabelsFix() {
  const requiredEnvVars = [
    'SUPABASE_DB_URL',
    'JWT_SECRET'
  ];

  // Check required environment variables
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(envVar => console.error(`  - ${envVar}`));
    console.log('\n💡 Usage:');
    console.log('SUPABASE_DB_URL=your_db_url JWT_SECRET=your_secret node run-product-labels-fix.js');
    process.exit(1);
  }

  try {
    console.log('🚀 Starting product_labels timestamp fix migration...');
    console.log('📍 Target database:', process.env.SUPABASE_DB_URL.replace(/:[^:@]+@/, ':****@'));

    // Create production Sequelize connection
    const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Production database connection verified');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'fix-product-labels-timestamps.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Product labels fix migration file loaded');

    // Split SQL into individual statements, excluding comments
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('SELECT'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    // Execute each statement with error handling
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}`);
          console.log(`📝 Statement: ${statement.substring(0, 80)}...`);

          await sequelize.query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        } catch (error) {
          console.warn(`⚠️  Statement ${i + 1} warning:`, error.message);
          if (error.message.includes('already exists') ||
              error.message.includes('duplicate key')) {
            console.log(`ℹ️  Statement ${i + 1} skipped (already applied)`);
            skipCount++;
          } else {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            throw error; // Fail on serious errors
          }
        }
      }
    }

    console.log('\n🎉 Product labels fix migration completed!');
    console.log(`📊 Results: ${successCount} executed, ${skipCount} skipped`);

    // Verify the migration by checking product_labels table structure
    console.log('\n🧪 Testing product_labels table structure...');
    try {
      const [results] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'product_labels'
        AND column_name IN ('created_at', 'updated_at')
        ORDER BY ordinal_position;
      `);

      console.log('📊 Product labels timestamp columns:');
      results.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (default: ${col.column_default})`);
      });

      // Check for defaults
      const createdHasDefault = results.some(col =>
        col.column_name === 'created_at' && col.column_default && col.column_default.includes('now()')
      );
      const updatedHasDefault = results.some(col =>
        col.column_name === 'updated_at' && col.column_default && col.column_default.includes('now()')
      );

      console.log('\n✅ Migration verification:');
      console.log(`  - created_at has DEFAULT: ${createdHasDefault ? '✅' : '❌'}`);
      console.log(`  - updated_at has DEFAULT: ${updatedHasDefault ? '✅' : '❌'}`);

      if (createdHasDefault && updatedHasDefault) {
        console.log('\n🎉 Product labels timestamp fix successful!');
      } else {
        console.log('\n⚠️  Migration may be incomplete - verify manually');
      }

    } catch (error) {
      console.error('⚠️  Could not verify migration:', error.message);
    }

    await sequelize.close();
    console.log('🔒 Database connection closed');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Product labels fix migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run migration
runProductLabelsFix();
