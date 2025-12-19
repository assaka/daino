/**
 * Create a sample A/B test directly in the database
 * This test changes the product title to "Hamid Title"
 */

const { sequelize } = require('../../database/connection');

async function createSampleTest() {
  try {
    console.log('🧪 Creating sample A/B test for product title...\n');

    // Get the first store from database
    const [stores] = await sequelize.query(`
      SELECT id, name FROM stores LIMIT 1
    `);

    if (stores.length === 0) {
      console.error('❌ No stores found in database. Please create a store first.');
      process.exit(1);
    }

    const storeId = stores[0].id;
    const storeName = stores[0].name;

    console.log(`✓ Using store: ${storeName} (${storeId})\n`);

    // Create the test with proper variant configuration
    const testId = require('crypto').randomUUID();
    const controlId = `control_${Date.now()}`;
    const variantId = `variant_a_${Date.now()}`;

    const testData = {
      id: testId,
      store_id: storeId,
      name: 'Product Title Test - Hamid',
      description: 'Testing product title change to "Hamid Title"',
      hypothesis: 'Changing the product title will improve engagement',
      status: 'running', // Start it immediately
      variants: JSON.stringify([
        {
          id: controlId,
          name: 'Control',
          description: 'Original product title',
          is_control: true,
          weight: 1,
          config: {}
        },
        {
          id: variantId,
          name: 'Variant A - Hamid Title',
          description: 'Product title changed to "Hamid Title"',
          is_control: false,
          weight: 1,
          config: {
            slot_overrides: {
              product_title: {
                content: 'Hamid Title'
              },
              product_name: {
                content: 'Hamid Title'
              },
              product_heading: {
                content: 'Hamid Title'
              }
            }
          }
        }
      ]),
      traffic_allocation: 1.0,
      targeting_rules: JSON.stringify({
        pages: ['product'],
        devices: [],
        countries: []
      }),
      primary_metric: 'add_to_cart_rate',
      secondary_metrics: JSON.stringify(['page_views', 'time_on_page']),
      start_date: new Date(),
      end_date: null,
      min_sample_size: 100,
      confidence_level: 0.95,
      winner_variant_id: null,
      metadata: JSON.stringify({
        created_by: 'migration_script',
        note: 'Sample test for debugging'
      })
    };

    await sequelize.query(`
      INSERT INTO ab_tests (
        id, store_id, name, description, hypothesis, status,
        variants, traffic_allocation, targeting_rules,
        primary_metric, secondary_metrics, start_date, end_date,
        min_sample_size, confidence_level, winner_variant_id, metadata,
        created_at, updated_at
      ) VALUES (
        :id, :store_id, :name, :description, :hypothesis, :status,
        :variants, :traffic_allocation, :targeting_rules,
        :primary_metric, :secondary_metrics, :start_date, :end_date,
        :min_sample_size, :confidence_level, :winner_variant_id, :metadata,
        NOW(), NOW()
      )
    `, {
      replacements: testData
    });

    console.log('✅ Test created successfully!\n');
    console.log('Test Details:');
    console.log(`  ID: ${testId}`);
    console.log(`  Name: ${testData.name}`);
    console.log(`  Status: ${testData.status}`);
    console.log(`  Store: ${storeName}`);
    console.log('\nVariants:');
    console.log('  1. Control - Original title');
    console.log('  2. Variant A - "Hamid Title"\n');

    console.log('Slot Overrides Applied:');
    console.log('  - product_title');
    console.log('  - product_name');
    console.log('  - product_heading\n');

    console.log('✅ Test is RUNNING and will apply to all product pages!');
    console.log('\nTo test:');
    console.log('  1. Visit any product page');
    console.log('  2. Check Render logs for: [Slot Config API]');
    console.log('  3. Product title should show "Hamid Title" for some visitors\n');

  } catch (error) {
    console.error('❌ Error creating test:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
if (require.main === module) {
  createSampleTest()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = createSampleTest;
