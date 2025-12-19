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
    const sqlPath = path.join(__dirname, 'create-pdf-templates-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Running migration: create-pdf-templates-table.sql');
    console.log('---');

    // Execute the SQL
    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('---');

    // Verify the table was created
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'pdf_templates'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log('✅ pdf_templates table created successfully');

      // Verify templates were added
      const result = await pool.query(`
        SELECT identifier, name, template_type, is_system
        FROM pdf_templates
        WHERE identifier IN ('invoice_pdf', 'shipment_pdf')
        ORDER BY identifier;
      `);

      console.log('✅ PDF templates added:');
      result.rows.forEach(row => {
        console.log(`   - ${row.identifier}: "${row.name}" (type: ${row.template_type}, system: ${row.is_system})`);
      });
    }

    console.log('\n✅ All done! PDF templates table is ready.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
