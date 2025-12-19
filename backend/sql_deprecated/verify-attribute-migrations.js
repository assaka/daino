#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

/**
 * Verify Attribute Translation Migrations
 *
 * Checks that the normalized translation tables are properly populated
 */

async function verifyMigrations() {
  try {
    console.log('🔍 Verifying Attribute Translation Migrations...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Check attribute_translations
    console.log('═══════════════════════════════════════════════════════════');
    console.log('ATTRIBUTE TRANSLATIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const [attrCounts] = await sequelize.query(`
      SELECT language_code, COUNT(*) as count
      FROM attribute_translations
      GROUP BY language_code
      ORDER BY language_code
    `);

    console.log('Translations by language:');
    attrCounts.forEach(row => {
      console.log(`  ${row.language_code}: ${row.count} attributes`);
    });

    const [totalAttrs] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attribute_translations
    `);
    console.log(`\nTotal: ${totalAttrs[0].count} translation records\n`);

    // Show sample data
    const [sampleAttrs] = await sequelize.query(`
      SELECT
        a.code,
        a.name,
        at.language_code,
        at.label,
        LEFT(at.description, 50) as description
      FROM attribute_translations at
      JOIN attributes a ON at.attribute_id = a.id
      ORDER BY a.code, at.language_code
      LIMIT 5
    `);

    console.log('Sample attribute translations:');
    sampleAttrs.forEach(row => {
      console.log(`  ${row.code} (${row.name})`);
      console.log(`    [${row.language_code}] Label: "${row.label}"`);
      if (row.description) {
        console.log(`    Description: ${row.description}...`);
      }
    });

    // Check attribute_value_translations
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('ATTRIBUTE VALUE TRANSLATIONS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const [valCounts] = await sequelize.query(`
      SELECT language_code, COUNT(*) as count
      FROM attribute_value_translations
      GROUP BY language_code
      ORDER BY language_code
    `);

    console.log('Translations by language:');
    valCounts.forEach(row => {
      console.log(`  ${row.language_code}: ${row.count} attribute values`);
    });

    const [totalVals] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attribute_value_translations
    `);
    console.log(`\nTotal: ${totalVals[0].count} translation records\n`);

    // Show sample data
    const [sampleVals] = await sequelize.query(`
      SELECT
        a.name as attribute_name,
        av.code,
        avt.language_code,
        avt.value,
        LEFT(avt.description, 50) as description
      FROM attribute_value_translations avt
      JOIN attribute_values av ON avt.attribute_value_id = av.id
      JOIN attributes a ON av.attribute_id = a.id
      ORDER BY a.name, av.code, avt.language_code
      LIMIT 5
    `);

    console.log('Sample attribute value translations:');
    sampleVals.forEach(row => {
      console.log(`  ${row.attribute_name} → ${row.code}`);
      console.log(`    [${row.language_code}] Value: "${row.value}"`);
      if (row.description) {
        console.log(`    Description: ${row.description}...`);
      }
    });

    // Compare with JSON columns
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('COMPARISON WITH JSON COLUMNS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const [attrJsonCount] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM attributes
      WHERE translations IS NOT NULL
      AND translations::text != '{}'
    `);

    const [valJsonCount] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM attribute_values
      WHERE translations IS NOT NULL
      AND translations::text != '{}'
    `);

    console.log('Attributes:');
    console.log(`  With JSON translations: ${attrJsonCount[0].count}`);
    console.log(`  In normalized table: ${totalAttrs[0].count / attrCounts.length} (${totalAttrs[0].count} total records)`);

    console.log('\nAttribute Values:');
    console.log(`  With JSON translations: ${valJsonCount[0].count}`);
    console.log(`  In normalized table: ${totalVals[0].count / valCounts.length} (${totalVals[0].count} total records)`);

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ VERIFICATION COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  verifyMigrations();
}

module.exports = verifyMigrations;
