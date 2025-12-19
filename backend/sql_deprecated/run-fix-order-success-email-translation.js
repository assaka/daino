require('dotenv').config();
const { Pool } = require('pg');

// Database connection string from environment
const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_DATABASE_URL or DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runFix() {
  const pool = new Pool({ connectionString });

  try {
    console.log('🔄 Connecting to database...');
    console.log('🔧 Fixing order_success_email translation email_template_id mismatch...\n');

    // First, find the correct email_template_id for order_success_email
    const templateResult = await pool.query(`
      SELECT id, identifier FROM email_templates
      WHERE identifier = 'order_success_email'
    `);

    if (templateResult.rows.length === 0) {
      console.log('❌ No order_success_email template found');
      process.exit(1);
    }

    const correctTemplateId = templateResult.rows[0].id;
    console.log(`📧 Found order_success_email template with ID: ${correctTemplateId}`);

    // Check current translation
    const currentTranslation = await pool.query(`
      SELECT id, email_template_id FROM email_template_translations
      WHERE subject LIKE '%Order Confirmation%' OR subject LIKE '%order_number%'
    `);

    console.log(`📋 Found ${currentTranslation.rows.length} potential translations to check`);

    // Update the translation to use the correct email_template_id
    const updateResult = await pool.query(`
      UPDATE email_template_translations
      SET email_template_id = $1
      WHERE email_template_id = '3bc325c1-b951-44c5-a73e-36308d8fbb6b'
      RETURNING id, email_template_id
    `, [correctTemplateId]);

    if (updateResult.rowCount > 0) {
      console.log(`✅ Updated ${updateResult.rowCount} translation(s) to use correct template ID`);
    } else {
      console.log('ℹ️  No translations found with the old incorrect template ID');

      // Check if the correct translation exists
      const checkCorrect = await pool.query(`
        SELECT id FROM email_template_translations
        WHERE email_template_id = $1 AND language_code = 'en'
      `, [correctTemplateId]);

      if (checkCorrect.rows.length > 0) {
        console.log('✅ Translation already has correct email_template_id');
      } else {
        console.log('⚠️  No EN translation found for order_success_email');
      }
    }

    // Verify the fix
    console.log('\n📊 Verification:');
    const verifyResult = await pool.query(`
      SELECT
        et.id as template_id,
        et.identifier,
        ett.id as translation_id,
        ett.email_template_id,
        ett.language_code,
        ett.subject
      FROM email_templates et
      LEFT JOIN email_template_translations ett ON ett.email_template_id = et.id AND ett.language_code = 'en'
      WHERE et.identifier = 'order_success_email'
    `);

    if (verifyResult.rows.length > 0 && verifyResult.rows[0].translation_id) {
      console.log('✅ order_success_email now has EN translation linked correctly');
      console.log(`   Template ID: ${verifyResult.rows[0].template_id}`);
      console.log(`   Translation email_template_id: ${verifyResult.rows[0].email_template_id}`);
      console.log(`   Subject: ${verifyResult.rows[0].subject}`);
    } else {
      console.log('⚠️  Still no EN translation linked to order_success_email');
    }

    console.log('\n✅ Fix completed!');

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runFix();
