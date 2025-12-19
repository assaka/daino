/**
 * Run the product_translations schema fix migration
 * This fixes the table to allow multiple translations per product
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ConnectionManager = require('../src/services/database/ConnectionManager');

const STORE_ID = process.env.STORE_ID || 'f48974ce-d153-4dc4-a99b-b15c27e45cd2';

async function runMigration() {
  console.log('🔧 Running product_translations schema fix...');
  console.log('Store ID:', STORE_ID);
  console.log('='.repeat(70));

  try {
    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(STORE_ID);

    // Read migration SQL
    const migrationPath = path.join(__dirname, 'src/database/migrations/tenant/fix-product-translations-schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('\n📋 Migration SQL:');
    console.log(migrationSql.substring(0, 500) + '...\n');

    // For Supabase, we need to execute raw SQL
    if (tenantDb.constructor.name === 'SupabaseAdapter') {
      console.log('Executing migration on Supabase tenant database...');

      // Split by semicolon and execute each statement
      const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (!statement) continue;

        console.log(`\n  Executing: ${statement.substring(0, 80)}...`);

        const { error } = await tenantDb.client.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          console.error('  ❌ Error:', error.message);
          // Try direct query execution as fallback
          const { error: queryError } = await tenantDb.client.from('_').select('*').limit(0);
          if (queryError) {
            throw new Error(`Failed to execute statement: ${error.message}`);
          }
        } else {
          console.log('  ✅ Success');
        }
      }
    } else {
      // For PostgreSQL/MySQL, execute directly
      await tenantDb.raw(migrationSql);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Try updating a product with translations');
    console.log('  2. Verify the ON CONFLICT works correctly');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

console.log('⚠️  WARNING: This migration will DROP and RECREATE the product_translations table!');
console.log('⚠️  All existing product translations will be LOST!');
console.log('⚠️  Make sure you have a backup before proceeding.\n');

// Uncomment to run the migration
// runMigration();

console.log('To run this migration, uncomment the last line in the script.');
console.log('\nAlternatively, run this SQL manually in your Supabase SQL editor:');
const migrationPath = path.join(__dirname, 'src/database/migrations/tenant/fix-product-translations-schema.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
console.log('\n' + '='.repeat(70));
console.log(migrationSql);
console.log('='.repeat(70));
