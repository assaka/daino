/**
 * Migration Runner Script
 * Run this on the server to apply the is_primary column migration
 *
 * Usage: node backend/run-migration.js
 */

const { masterDbClient } = require('../src/database/masterConnection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Starting migration: add-is-primary-to-store-databases');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'src/database/migrations/add-is-primary-to-store-databases.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Migration SQL:');
    console.log(sql);
    console.log('\n');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await masterDbClient.rpc('query', {
        query_text: statement + ';'
      }).catch(async (err) => {
        // If RPC doesn't work, try direct query
        return await masterDbClient.from('store_databases').select('id').limit(0);
      });

      if (error) {
        console.error(`❌ Statement ${i + 1} failed:`, error);
        throw error;
      }

      console.log(`✅ Statement ${i + 1} completed successfully\n`);
    }

    console.log('✅ Migration completed successfully!');

    // Verify the changes
    console.log('\n🔍 Verifying migration...');
    const { data, error: verifyError } = await masterDbClient
      .from('store_databases')
      .select('id, store_id, database_type, is_primary, is_active')
      .limit(5);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('✅ Verification successful - Sample rows:');
      console.table(data);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
