#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function dropAndRecreate() {
  // Get database URL from command line or environment
  const databaseUrl = process.argv[2] || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ Error: No database URL provided');
    console.log('Usage: node drop-and-recreate.js "postgresql://user:password@host:port/database"');
    console.log('Or set DATABASE_URL environment variable');
    process.exit(1);
  }

  console.log('🚀 Starting fresh database setup...');
  
  // Create PostgreSQL client
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // Connect to database
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully');

    // First, drop everything
    console.log('\n🗑️  Dropping all existing tables and objects...');
    const dropSqlPath = path.join(__dirname, 'drop-all-tables.sql');
    const dropSqlContent = fs.readFileSync(dropSqlPath, 'utf8');
    
    // Execute drop script as a single statement
    try {
      await client.query(dropSqlContent);
      console.log('✅ All tables and objects dropped successfully');
    } catch (error) {
      console.log('⚠️  Some drop operations failed (this is normal if objects don\'t exist)');
    }

    // Now create everything fresh
    console.log('\n📋 Creating all tables from scratch...');
    const createSqlPath = path.join(__dirname, 'create-all-tables.sql');
    const createSqlContent = fs.readFileSync(createSqlPath, 'utf8');

    // Split SQL into individual statements (handling dollar-quoted strings)
    const statements = [];
    let currentStatement = '';
    let inDollarQuote = false;
    let dollarQuoteTag = '';
    
    const lines = createSqlContent.split('\n');
    
    for (const line of lines) {
      // Skip comment-only lines
      if (line.trim().startsWith('--') && !currentStatement.trim()) {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Check for dollar quote start/end
      const dollarQuoteMatch = line.match(/\$([^$]*)\$/g);
      if (dollarQuoteMatch) {
        for (const match of dollarQuoteMatch) {
          if (!inDollarQuote) {
            inDollarQuote = true;
            dollarQuoteTag = match;
          } else if (match === dollarQuoteTag) {
            inDollarQuote = false;
            dollarQuoteTag = '';
          }
        }
      }
      
      // Only split on semicolon if not inside dollar quotes
      if (!inDollarQuote && line.trim().endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim() && !currentStatement.trim().startsWith('--')) {
      statements.push(currentStatement.trim());
    }

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

    console.log('\n✅ Fresh database setup completed!');

  } catch (error) {
    console.error('❌ Failed to execute:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Disconnected from database');
  }
}

// Run the script
dropAndRecreate();