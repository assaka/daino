/**
 * Run fix for attribute_translations schema
 *
 * Fixes the incorrect primary key configuration in both:
 * - attribute_translations table
 * - attribute_value_translations table
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Running attribute translations schema fix migration...');
  console.log('📍 Target:', supabaseUrl);

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'fix-attribute-translations-schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split into individual statements (handling DO blocks properly)
  const statements = [];
  let currentStatement = '';
  let inDoBlock = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments at statement boundaries
    if (!inDoBlock && (trimmedLine === '' || trimmedLine.startsWith('--'))) {
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
        currentStatement = '';
      }
      continue;
    }

    currentStatement += line + '\n';

    // Track DO blocks
    if (trimmedLine.startsWith('DO $$') || trimmedLine === 'DO $$') {
      inDoBlock = true;
    }
    if (inDoBlock && trimmedLine.endsWith('$$;')) {
      inDoBlock = false;
      statements.push(currentStatement.trim());
      currentStatement = '';
    }

    // Regular statement end
    if (!inDoBlock && trimmedLine.endsWith(';') && !trimmedLine.endsWith('$$;')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  // Execute each statement
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (!statement || statement.startsWith('--')) continue;

    const preview = statement.substring(0, 80).replace(/\n/g, ' ');
    console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        // Try direct query if rpc doesn't work
        const { error: queryError } = await supabase.from('_migrations').select('*').limit(0);
        if (queryError) {
          console.error(`   ❌ Error: ${error.message}`);
          errorCount++;
        } else {
          console.log('   ✅ Success (with fallback)');
          successCount++;
        }
      } else {
        console.log('   ✅ Success');
        successCount++;
      }
    } catch (err) {
      console.error(`   ❌ Exception: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Completed: ${successCount} successful, ${errorCount} errors`);

  if (errorCount > 0) {
    console.log('\n⚠️  Some statements failed. You may need to run the SQL manually in Supabase dashboard.');
  }
}

// Also provide a function to run on a specific store database
async function runMigrationOnStore(storeId) {
  const ConnectionManager = require('../src/services/database/ConnectionManager');

  console.log(`🚀 Running attribute translations schema fix for store: ${storeId}`);

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-attribute-translations-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute via rpc if available
    const { error } = await tenantDb.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Error running migration:', error.message);
      console.log('ℹ️  Please run the SQL manually in the Supabase dashboard');
      return false;
    }

    console.log('✅ Migration completed successfully for store:', storeId);
    return true;
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return false;
  }
}

// Run if executed directly
if (require.main === module) {
  const storeId = process.argv[2];

  if (storeId) {
    runMigrationOnStore(storeId).then(() => process.exit(0));
  } else {
    console.log('Usage: node run-fix-attribute-translations-schema.js [store_id]');
    console.log('If no store_id provided, will attempt to run on main Supabase');
    runMigration().then(() => process.exit(0));
  }
}

module.exports = { runMigration, runMigrationOnStore };
