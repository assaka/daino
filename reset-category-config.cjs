// Quick script to reset category configuration
// This will delete and re-insert the category slot config with product_card_template

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { categoryConfig } = require('./backend/src/configs/slot/category-config');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Store ID for dainostore (you can change this or pass as arg)
const STORE_ID = '38bada26-49f4-4c88-96c0-27800ddcf974';

async function resetCategoryConfig() {
  try {
    console.log('Starting category config reset...');

    // Get store info to find user_id
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, user_id, name')
      .eq('id', STORE_ID)
      .single();

    if (storeError || !store) {
      console.error('Could not find store:', storeError?.message);
      return;
    }

    console.log(`Found store: ${store.name} (${store.id})`);

    // Delete existing category slot configurations for this store
    const { data: deleted, error: deleteError } = await supabase
      .from('slot_configurations')
      .delete()
      .eq('store_id', STORE_ID)
      .eq('page_type', 'category')
      .select();

    if (deleteError) {
      console.error('Delete error:', deleteError);
    } else {
      console.log(`Deleted ${deleted?.length || 0} existing category configs`);
    }

    // Prepare the configuration
    const configuration = {
      page_name: categoryConfig.page_name,
      slot_type: categoryConfig.slot_type,
      slots: categoryConfig.slots,
      views: categoryConfig.views,
      cmsBlocks: categoryConfig.cmsBlocks,
      microslots: categoryConfig.microslots
    };

    const publishedId = uuidv4();
    const draftId = uuidv4();

    // Insert published version
    const { data: published, error: pubError } = await supabase
      .from('slot_configurations')
      .insert({
        id: publishedId,
        user_id: store.user_id,
        store_id: STORE_ID,
        configuration: configuration,
        page_type: 'category',
        is_active: true,
        status: 'published',
        version: '1.0',
        version_number: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (pubError) {
      console.error('Error inserting published config:', pubError);
      return;
    }

    console.log('Created published config:', publishedId);

    // Insert draft version
    const { data: draft, error: draftError } = await supabase
      .from('slot_configurations')
      .insert({
        id: draftId,
        user_id: store.user_id,
        store_id: STORE_ID,
        configuration: configuration,
        page_type: 'category',
        is_active: false,
        status: 'draft',
        version: '2.0',
        version_number: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (draftError) {
      console.error('Error inserting draft config:', draftError);
      return;
    }

    console.log('Created draft config:', draftId);

    // Verify the slots were created
    const slotCount = Object.keys(configuration.slots).length;
    const hasProductCardTemplate = !!configuration.slots.product_card_template;

    console.log('\n=== Summary ===');
    console.log(`Total slots: ${slotCount}`);
    console.log(`Has product_card_template: ${hasProductCardTemplate}`);
    console.log(`Product card child slots:`);

    Object.keys(configuration.slots).forEach(slotId => {
      if (slotId.startsWith('product_card_')) {
        console.log(`  - ${slotId}`);
      }
    });

    console.log('\n✅ Category config reset complete!');
    console.log('✅ Refresh the category page to see the products');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

resetCategoryConfig();
