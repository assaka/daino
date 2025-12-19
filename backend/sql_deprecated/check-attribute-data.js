#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

/**
 * Check Attribute and Attribute Value data
 * This script checks what translations exist in the JSON columns
 */

async function checkAttributeData() {
  try {
    console.log('🔍 Checking Attribute and Attribute Value data...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Check attributes
    console.log('═══════════════════════════════════════════════════════════');
    console.log('ATTRIBUTES');
    console.log('═══════════════════════════════════════════════════════════\n');

    const [attributes] = await sequelize.query(`
      SELECT id, name, code, translations
      FROM attributes
      LIMIT 5
    `);

    console.log(`Found ${attributes.length} sample attributes:\n`);
    attributes.forEach(attr => {
      console.log(`Attribute: ${attr.name} (${attr.code})`);
      console.log(`Translations:`, JSON.stringify(attr.translations, null, 2));
      console.log('---');
    });

    // Check attribute values
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('ATTRIBUTE VALUES');
    console.log('═══════════════════════════════════════════════════════════\n');

    const [values] = await sequelize.query(`
      SELECT av.id, av.attribute_id, av.code, av.translations, a.name as attribute_name
      FROM attribute_values av
      JOIN attributes a ON av.attribute_id = a.id
      LIMIT 5
    `);

    console.log(`Found ${values.length} sample attribute values:\n`);
    values.forEach(val => {
      console.log(`Value: ${val.code} (for attribute: ${val.attribute_name})`);
      console.log(`Translations:`, JSON.stringify(val.translations, null, 2));
      console.log('---');
    });

    // Check translation tables
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('NORMALIZED TRANSLATION TABLES');
    console.log('═══════════════════════════════════════════════════════════\n');

    const [attrTransCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attribute_translations
    `);
    console.log(`attribute_translations count: ${attrTransCount[0].count}`);

    const [valTransCount] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attribute_value_translations
    `);
    console.log(`attribute_value_translations count: ${valTransCount[0].count}`);

    // Check total attributes and values
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('TOTALS');
    console.log('═══════════════════════════════════════════════════════════\n');

    const [totalAttr] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attributes
    `);
    console.log(`Total attributes: ${totalAttr[0].count}`);

    const [totalVal] = await sequelize.query(`
      SELECT COUNT(*) as count FROM attribute_values
    `);
    console.log(`Total attribute values: ${totalVal[0].count}`);

    const [attrWithTrans] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM attributes
      WHERE translations IS NOT NULL
      AND translations::text != '{}'
    `);
    console.log(`Attributes with translations in JSON: ${attrWithTrans[0].count}`);

    const [valWithTrans] = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM attribute_values
      WHERE translations IS NOT NULL
      AND translations::text != '{}'
    `);
    console.log(`Attribute values with translations in JSON: ${valWithTrans[0].count}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  checkAttributeData();
}

module.exports = checkAttributeData;
