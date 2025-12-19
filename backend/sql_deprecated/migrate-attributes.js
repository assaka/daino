#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

/**
 * Migrate Attribute Translations
 *
 * This script specifically migrates attribute translations from JSON
 * to the normalized attribute_translations table.
 */

async function migrateAttributeTranslations() {
  try {
    console.log('🔄 Migrating Attribute Translations...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Get all attributes with translations
    console.log('📦 Fetching attributes from database...');
    const [attributes] = await sequelize.query(`
      SELECT id, name, code, translations
      FROM attributes
      WHERE translations IS NOT NULL
    `);

    console.log(`Found ${attributes.length} attributes to process\n`);

    if (attributes.length === 0) {
      console.log('⚠️  No attributes with translations found.');
      console.log('   This might mean attributes don\'t have translations yet.\n');

      const [sampleAttrs] = await sequelize.query(`
        SELECT id, name, code, translations
        FROM attributes
        LIMIT 3
      `);

      sampleAttrs.forEach((attr, idx) => {
        console.log(`Sample ${idx + 1}:`);
        console.log(`  Name: ${attr.name}`);
        console.log(`  Code: ${attr.code}`);
        console.log(`  Translations:`, attr.translations);
        console.log('');
      });

      process.exit(0);
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each attribute
    for (const attribute of attributes) {
      try {
        // Handle both JSON object and stringified JSON
        const translations = typeof attribute.translations === 'string'
          ? JSON.parse(attribute.translations)
          : attribute.translations;

        if (!translations || Object.keys(translations).length === 0) {
          skippedCount++;
          continue;
        }

        // Insert translation for each language
        for (const [langCode, data] of Object.entries(translations)) {
          if (!data || typeof data !== 'object') continue;

          const label = data.label || data.name || '';
          const description = data.description || null;

          if (!label) {
            continue;
          }

          // Escape single quotes for SQL
          const escapedLabel = label.replace(/'/g, "''");
          const escapedDescription = description ? description.replace(/'/g, "''") : null;

          await sequelize.query(`
            INSERT INTO attribute_translations
            (attribute_id, language_code, label, description, created_at, updated_at)
            VALUES (
              '${attribute.id}',
              '${langCode}',
              '${escapedLabel}',
              ${escapedDescription ? `'${escapedDescription}'` : 'NULL'},
              NOW(),
              NOW()
            )
            ON CONFLICT (attribute_id, language_code)
            DO UPDATE SET
              label = EXCLUDED.label,
              description = EXCLUDED.description,
              updated_at = NOW()
          `);

          migratedCount++;
        }

        // Log progress every 10 attributes
        if ((migratedCount + skippedCount) % 10 === 0) {
          console.log(`Processed ${migratedCount + skippedCount} attributes...`);
        }
      } catch (error) {
        console.error(`Error processing attribute ${attribute.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ MIGRATION COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`✅ Migrated: ${migratedCount} translations`);
    console.log(`⏭️  Skipped: ${skippedCount} (empty translations)`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount}`);
    }

    // Verify the results
    console.log('\n🔍 Verifying migration...');
    const [result] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attribute_translations
    `);
    console.log(`Total translations in table: ${result[0].count}\n`);

    // Show some sample data
    console.log('Sample migrated data:');
    const [samples] = await sequelize.query(`
      SELECT
        a.code,
        at.language_code,
        at.label,
        at.description
      FROM attribute_translations at
      JOIN attributes a ON at.attribute_id = a.id
      LIMIT 5
    `);

    samples.forEach(sample => {
      console.log(`  ${sample.code} [${sample.language_code}]: "${sample.label}"`);
      if (sample.description) {
        console.log(`    Description: ${sample.description.substring(0, 50)}...`);
      }
    });

    console.log('\n✅ Migration successful!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  migrateAttributeTranslations();
}

module.exports = migrateAttributeTranslations;
