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
    console.log('📦 Migrating English content to translation tables...\n');

    // Migrate email templates
    console.log('📧 Migrating email templates...');
    const emailSql = fs.readFileSync(
      path.join(__dirname, 'migrate-email-templates-en-to-translations.sql'),
      'utf8'
    );
    await pool.query(emailSql);
    console.log('✅ Email templates migrated\n');

    // Migrate PDF templates
    console.log('📄 Migrating PDF templates...');
    const pdfSql = fs.readFileSync(
      path.join(__dirname, 'migrate-pdf-templates-en-to-translations.sql'),
      'utf8'
    );
    await pool.query(pdfSql);
    console.log('✅ PDF templates migrated\n');

    // Show final counts
    console.log('📊 Final counts:');

    const emailCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM email_template_translations
      WHERE language_code = 'en';
    `);
    console.log(`   📧 Email template EN translations: ${emailCount.rows[0].count}`);

    const pdfCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM pdf_template_translations
      WHERE language_code = 'en';
    `);
    console.log(`   📄 PDF template EN translations: ${pdfCount.rows[0].count}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('ℹ️  Note: Base table fields (subject, template_content, html_content, html_template)');
    console.log('   are kept for backward compatibility but EN is now also in translation tables.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
