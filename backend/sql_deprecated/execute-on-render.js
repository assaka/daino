#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function executeOnRender() {
  // Get database URL from command line or environment
  const databaseUrl = process.argv[2] || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ Error: No database URL provided');
    console.log('Usage: node execute-on-render.js "postgresql://user:password@host:port/database"');
    console.log('Or set DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🚀 Starting database setup on Render PostgreSQL...');
  
  // Create PostgreSQL client
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Connect to database
    console.log('🔌 Connecting to Render PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'create-all-tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    console.log('📄 SQL file loaded');

    // Split SQL into individual statements
    const statements = sqlContent
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
          await client.query(statement);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`❌ Statement ${i + 1} failed:`, error.message);
          // Continue with other statements
        }
      }
    }

    console.log('\n📊 Execution Summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);

    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    
    console.log(`\n📋 Tables created (${tablesResult.rows.length}):`);
    tablesResult.rows.forEach(row => {
      console.log(`   - ${row.tablename}`);
    });

    console.log('\n✅ Database setup completed!');

  } catch (error) {
    console.error('❌ Failed to execute SQL:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script
executeOnRender();