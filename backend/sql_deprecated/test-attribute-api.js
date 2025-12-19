#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');
const { getAttributesWithTranslations, getAttributeValuesWithTranslations } = require('../src/utils/attributeHelpers');

/**
 * Test Attribute API Response
 *
 * This simulates what the admin API returns to verify translations are correct
 */

async function testAttributeAPI() {
  try {
    console.log('🧪 Testing Attribute API Response...\n');

    await sequelize.authenticate();
    console.log('✅ Database connection verified\n');

    // Get first attribute with translations
    console.log('═══════════════════════════════════════════════════════════');
    console.log('TEST 1: Getting Attributes with Translations');
    console.log('═══════════════════════════════════════════════════════════\n');

    const attributes = await getAttributesWithTranslations({});

    if (attributes.length === 0) {
      console.log('❌ No attributes found!');
      process.exit(1);
    }

    console.log(`Found ${attributes.length} attributes\n`);

    // Show first 3 attributes
    console.log('Sample attributes:');
    attributes.slice(0, 3).forEach(attr => {
      console.log(`\n📌 Attribute: ${attr.code}`);
      console.log(`   ID: ${attr.id}`);
      console.log(`   Name: ${attr.name}`);
      console.log(`   Type: ${attr.type}`);
      console.log(`   Translations:`, JSON.stringify(attr.translations, null, 2));
    });

    // Get attribute values with translations
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('TEST 2: Getting Attribute Values with Translations');
    console.log('═══════════════════════════════════════════════════════════\n');

    const values = await getAttributeValuesWithTranslations({});

    console.log(`Found ${values.length} attribute values\n`);

    // Show first 3 values
    console.log('Sample attribute values:');
    values.slice(0, 3).forEach(val => {
      console.log(`\n📌 Value: ${val.code}`);
      console.log(`   ID: ${val.id}`);
      console.log(`   Attribute ID: ${val.attribute_id}`);
      console.log(`   Translations:`, JSON.stringify(val.translations, null, 2));
    });

    // Simulate full API response for a select attribute
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('TEST 3: Simulating Full Admin API Response');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Find a select/multiselect attribute
    const selectAttr = attributes.find(a => a.type === 'select' || a.type === 'multiselect');

    if (!selectAttr) {
      console.log('⚠️  No select/multiselect attributes found');
    } else {
      console.log(`Testing with attribute: ${selectAttr.code} (${selectAttr.type})`);

      // Get its values
      const attrValues = await getAttributeValuesWithTranslations({
        attribute_id: selectAttr.id
      });

      console.log(`\nAttribute has ${attrValues.length} values\n`);

      // Construct what the API would return
      const apiResponse = {
        ...selectAttr,
        values: attrValues.map(v => ({
          id: v.id,
          code: v.code,
          attribute_id: v.attribute_id,
          sort_order: v.sort_order,
          metadata: v.metadata,
          translations: v.translations
        }))
      };

      console.log('Full API Response Structure:');
      console.log(JSON.stringify(apiResponse, null, 2));
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ ALL TESTS COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  testAttributeAPI();
}

module.exports = testAttributeAPI;
