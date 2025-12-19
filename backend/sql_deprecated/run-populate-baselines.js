#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

async function runPopulateBaselines() {
  let client;
  
  try {
    if (!databaseUrl) {
      console.error('❌ Error: No database URL found');
      console.log('Set DATABASE_URL or SUPABASE_DB_URL environment variable');
      process.exit(1);
    }

    console.log('🚀 Starting file_baselines population migration...');
    
    // Create PostgreSQL client
    client = new Client({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false
    });

    // Connect to database
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Read migration SQL file
    const migrationPath = path.join(__dirname, 'populate-file-baselines.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Migration SQL loaded');

    // Split SQL into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          await client.query(statement + ';');
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`❌ Statement ${i + 1} failed:`, error.message);
          // Continue with other statements for non-critical errors
          if (error.message.includes('relation') && error.message.includes('already exists')) {
            console.log('  ℹ️  This is likely a non-critical "already exists" error');
          }
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);

    // Check if file_baselines table exists and has data
    console.log('\n🔍 Verifying file_baselines table...');
    const tableCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'file_baselines' AND table_schema = 'public';
    `);

    if (tableCheck.rows[0].count > 0) {
      console.log('✅ file_baselines table exists');
      
      // Count records
      const recordCount = await client.query('SELECT COUNT(*) as count FROM file_baselines');
      console.log(`📊 Records in file_baselines: ${recordCount.rows[0].count}`);
      
      // Show some sample records
      const sampleRecords = await client.query('SELECT file_path, file_type, created_at FROM file_baselines ORDER BY created_at DESC LIMIT 5');
      console.log('\n📋 Sample records:');
      sampleRecords.rows.forEach(record => {
        console.log(`   - ${record.file_path} (${record.file_type}) - ${record.created_at}`);
      });
    } else {
      console.log('❌ file_baselines table was not created successfully');
    }

    console.log('\n✅ Migration completed!');

    // Now populate with actual file content
    console.log('\n📁 Starting file content population...');
    await populateActualFileContent(client);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Disconnected from database');
    }
  }
}

async function populateActualFileContent(client) {
  try {
    // List of key files to populate with actual content
    const keyFiles = [
      'src/core/slot-editor/HybridCustomizationEditor.jsx',
      'src/core/slot-editor/ConfigurationEditor.jsx',
      'src/core/slot-editor/ConfigurationPreview.jsx',
      'src/core/slot-editor/SlotsWorkspace.jsx',
      'src/core/slot-editor/types.js',
      'src/pages/CartSlotted.jsx',
      'src/core/slot-system/default-components/CartSlots.jsx',
      'src/pages/AIContextWindow.jsx'
    ];

    let updated = 0;
    let errors = 0;

    // Go up from backend/src/database/migrations to project root
    const projectRoot = path.resolve(__dirname, '../../../../');
    console.log('🔍 Project root:', projectRoot);

    for (const filePath of keyFiles) {
      try {
        const absolutePath = path.join(projectRoot, filePath);
        
        if (fs.existsSync(absolutePath)) {
          const content = fs.readFileSync(absolutePath, 'utf8');
          const stat = fs.statSync(absolutePath);
          
          // Call the populate_file_baseline function
          await client.query(
            'SELECT populate_file_baseline($1, $2)',
            [filePath, content]
          );
          
          console.log(`✅ Updated ${filePath} (${content.length} chars)`);
          updated++;
        } else {
          console.log(`⚠️  File not found: ${absolutePath}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error.message);
        errors++;
      }
    }

    console.log(`\n📊 File Content Update Summary:`);
    console.log(`✅ Files updated: ${updated}`);
    console.log(`❌ Errors: ${errors}`);

  } catch (error) {
    console.error('❌ Error populating file content:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  runPopulateBaselines();
}

module.exports = runPopulateBaselines;