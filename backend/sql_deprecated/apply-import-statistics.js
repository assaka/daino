#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function applyMigration() {
  try {
    console.log('🚀 Applying import_statistics table migration...');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'create-general-import-statistics-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      if (statement.trim().length > 1) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}`);
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.error(`❌ Statement ${i + 1} error:`, error);
            throw error;
          }
          console.log(`✅ Statement ${i + 1} completed`);
        } catch (error) {
          console.error(`❌ Statement ${i + 1} failed:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ Migration completed successfully!');

    // Verify table was created
    const { data, error } = await supabase
      .from('import_statistics')
      .select('count')
      .limit(0);

    if (error) {
      console.error('⚠️  Warning: Could not verify table creation:', error.message);
    } else {
      console.log('✅ Table verification successful!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  applyMigration();
}

module.exports = applyMigration;
