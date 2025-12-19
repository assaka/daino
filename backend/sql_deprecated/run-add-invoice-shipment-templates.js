require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection string from environment
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_DATABASE_URL or DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigration() {
  const pool = new Pool({ connectionString });

  try {
    console.log('🔄 Connecting to database...');

    // Read the SQL migration file
    const sqlPath = path.join(__dirname, 'add-invoice-shipment-email-templates.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Running migration: add-invoice-shipment-email-templates.sql');
    console.log('---');

    // Execute the SQL
    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('---');

    // Verify the templates were added
    const result = await pool.query(`
      SELECT identifier, subject, is_system
      FROM email_templates
      WHERE identifier IN ('invoice_email', 'shipment_email', 'email_header', 'email_footer')
      ORDER BY identifier;
    `);

    console.log('✅ Email templates added:');
    result.rows.forEach(row => {
      console.log(`   - ${row.identifier}: "${row.subject}" (system: ${row.is_system})`);
    });

    console.log('\n✅ All done! Invoice and shipment email templates are ready.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
