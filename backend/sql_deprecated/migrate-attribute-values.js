#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

/**
 * Migrate Attribute Value Translations
 *
 * This script specifically migrates attribute value translations from JSON
 * to the normalized attribute_value_translations table.
 *
 * IMPORTANT: This handles the field name mapping:
 * - JSON uses 'label' field
 * - Table uses 'value' column
 */

async function migrateAttributeValueTranslations() {
  try {
    console.log('🔄 Migrating Attribute Value Translations...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Get all attribute values with translations
    console.log('📦 Fetching attribute values from database...');
    const [attributeValues] = await sequelize.query(`
      SELECT id, attribute_id, code, translations
      FROM attribute_values
      WHERE translations IS NOT NULL
    `);

    console.log(`Found ${attributeValues.length} attribute values to process\n`);

    if (attributeValues.length === 0) {
      console.log('⚠️  No attribute values with translations found.');
      console.log('   This might mean:');
      console.log('   1. Attribute values don\'t have translations yet');
      console.log('   2. They use a different structure');
      console.log('\nLet me check the first few attribute values...\n');

      const [sampleValues] = await sequelize.query(`
        SELECT id, code, translations
        FROM attribute_values
        LIMIT 3
      `);

      sampleValues.forEach((val, idx) => {
        console.log(`Sample ${idx + 1}:`);
        console.log(`  Code: ${val.code}`);
        console.log(`  Translations:`, val.translations);
        console.log('');
      });

      process.exit(0);
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each attribute value
    for (const value of attributeValues) {
      try {
        // Handle both JSON object and stringified JSON
        const translations = typeof value.translations === 'string'
          ? JSON.parse(value.translations)
          : value.translations;

        if (!translations || Object.keys(translations).length === 0) {
          skippedCount++;
          continue;
        }

        // Insert translation for each language
        for (const [langCode, data] of Object.entries(translations)) {
          if (!data || typeof data !== 'object') continue;

          // The JSON structure uses 'label', but the table uses 'value'
          const labelValue = data.label || data.value || '';
          const description = data.description || null;

          if (!labelValue) {
            continue;
          }

          // Escape single quotes for SQL
          const escapedValue = labelValue.replace(/'/g, "''");
          const escapedDescription = description ? description.replace(/'/g, "''") : null;

          await sequelize.query(`
            INSERT INTO attribute_value_translations
            (attribute_value_id, language_code, value, description, created_at, updated_at)
            VALUES (
              '${value.id}',
              '${langCode}',
              '${escapedValue}',
              ${escapedDescription ? `'${escapedDescription}'` : 'NULL'},
              NOW(),
              NOW()
            )
            ON CONFLICT (attribute_value_id, language_code)
            DO UPDATE SET
              value = EXCLUDED.value,
              description = EXCLUDED.description,
              updated_at = NOW()
          `);

          migratedCount++;
        }

        // Log progress every 10 values
        if ((migratedCount + skippedCount) % 10 === 0) {
          console.log(`Processed ${migratedCount + skippedCount} values...`);
        }
      } catch (error) {
        console.error(`Error processing value ${value.code}:`, error.message);
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
      SELECT COUNT(*) as count FROM attribute_value_translations
    `);
    console.log(`Total translations in table: ${result[0].count}\n`);

    // Show some sample data
    console.log('Sample migrated data:');
    const [samples] = await sequelize.query(`
      SELECT
        av.code,
        avt.language_code,
        avt.value,
        a.name as attribute_name
      FROM attribute_value_translations avt
      JOIN attribute_values av ON avt.attribute_value_id = av.id
      JOIN attributes a ON av.attribute_id = a.id
      LIMIT 5
    `);

    samples.forEach(sample => {
      console.log(`  ${sample.attribute_name} → ${sample.code} [${sample.language_code}]: "${sample.value}"`);
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
  migrateAttributeValueTranslations();
}

module.exports = migrateAttributeValueTranslations;
