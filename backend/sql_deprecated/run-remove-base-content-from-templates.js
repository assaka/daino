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
    console.log('🗑️  Removing backward compatibility fields from template tables...\n');

    // Remove from email templates
    console.log('📧 Removing base content fields from email_templates...');
    const emailSql = fs.readFileSync(
      path.join(__dirname, 'remove-base-content-from-email-templates.sql'),
      'utf8'
    );
    await pool.query(emailSql);
    console.log('✅ Email template base fields removed\n');

    // Remove from PDF templates
    console.log('📄 Removing base content fields from pdf_templates...');
    const pdfSql = fs.readFileSync(
      path.join(__dirname, 'remove-base-content-from-pdf-templates.sql'),
      'utf8'
    );
    await pool.query(pdfSql);
    console.log('✅ PDF template base fields removed\n');

    // Verify columns were dropped
    console.log('🔍 Verifying columns were dropped...');

    const emailColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'email_templates'
      AND column_name IN ('subject', 'template_content', 'html_content')
      ORDER BY column_name;
    `);

    if (emailColumns.rows.length === 0) {
      console.log('✅ Email template columns successfully dropped');
    } else {
      console.warn('⚠️  Some email template columns still exist:', emailColumns.rows);
    }

    const pdfColumns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'pdf_templates'
      AND column_name = 'html_template';
    `);

    if (pdfColumns.rows.length === 0) {
      console.log('✅ PDF template html_template column successfully dropped');
    } else {
      console.warn('⚠️  PDF template html_template column still exists');
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('ℹ️  All content is now stored exclusively in translation tables:');
    console.log('   - email_template_translations (subject, template_content, html_content)');
    console.log('   - pdf_template_translations (html_template)');
    console.log('ℹ️  Default fields retained for system template restore functionality.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
