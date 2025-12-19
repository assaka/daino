/**
 * Execute SQL to create normalized plugin tables
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    require: true,
    rejectUnauthorized: false
  } : false
});

async function createTables() {
  const client = await pool.connect();

  try {
    console.log('📊 Creating normalized plugin tables...\n');

    // Read SQL file
    const sqlPath = path.join(__dirname, 'create-normalized-plugin-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Execute SQL
    await client.query(sql);

    console.log('✅ Normalized plugin tables created successfully!');

    // Verify tables were created
    const tablesQuery = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('plugin_scripts', 'plugin_dependencies', 'plugin_data')
      AND table_schema = 'public'
    `);

    console.log('\nCreated tables:');
    tablesQuery.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createTables()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
