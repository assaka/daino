/**
 * Migration Runner: Update Cart Slot Templates
 *
 * This script updates all cart configurations to include the proper HTML templates
 * for CartItemsSlot, CartCouponSlot, and CartOrderSummarySlot components.
 *
 * Usage: cd backend && node run-update-cart-templates.js
 */

require('dotenv').config();
const { masterDbClient } = require('./src/database/masterConnection');
const ConnectionManager = require('./src/services/database/ConnectionManager');
const { cartConfig } = require('./src/configs/slot/cart-config.js');

const SLOTS_TO_UPDATE = ['cart_items', 'coupon_section', 'order_summary'];

async function runMigration() {
  console.log('🔧 Starting migration: update-cart-slot-templates\n');

  try {
    // First, get all stores from the master database
    const { data: stores, error: storesError } = await masterDbClient
      .from('stores')
      .select('id, name, slug')
      .eq('is_active', true);

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    console.log(`Found ${stores.length} active stores to check\n`);

    let totalUpdated = 0;

    for (const store of stores) {
      try {
        console.log(`\n📦 Processing store: ${store.name} (${store.id})`);

        // Get tenant connection for this store
        const tenantDb = await ConnectionManager.getStoreConnection(store.id);

        // Get all cart configurations for this store
        const { data: cartConfigurations, error: configError } = await tenantDb
          .from('slot_configurations')
          .select('*')
          .eq('page_type', 'cart')
          .in('status', ['published', 'draft', 'init']);

        if (configError) {
          console.log(`  ⚠️ Error fetching configs: ${configError.message}`);
          continue;
        }

        if (!cartConfigurations || cartConfigurations.length === 0) {
          console.log(`  ℹ️ No cart configurations found`);
          continue;
        }

        console.log(`  Found ${cartConfigurations.length} cart configuration(s)`);

        for (const config of cartConfigurations) {
          try {
            const configuration = typeof config.configuration === 'string'
              ? JSON.parse(config.configuration)
              : config.configuration;

            if (!configuration?.slots) {
              console.log(`    ⚠️ Config ${config.id} has no slots, skipping`);
              continue;
            }

            let needsUpdate = false;
            const updatedSlots = [];

            // Check each slot that needs templates
            for (const slotId of SLOTS_TO_UPDATE) {
              const slot = configuration.slots[slotId];
              const templateSlot = cartConfig.slots[slotId];

              if (slot && templateSlot) {
                // Check if the slot needs updating (has empty content or missing content)
                if (!slot.content || slot.content === '' || slot.content.trim() === '') {
                  configuration.slots[slotId] = {
                    ...slot,
                    content: templateSlot.content
                  };
                  needsUpdate = true;
                  updatedSlots.push(slotId);
                }
              }
            }

            if (needsUpdate) {
              const { error: updateError } = await tenantDb
                .from('slot_configurations')
                .update({
                  configuration: configuration,
                  updated_at: new Date().toISOString()
                })
                .eq('id', config.id);

              if (updateError) {
                console.log(`    ❌ Error updating config ${config.id}: ${updateError.message}`);
              } else {
                totalUpdated++;
                console.log(`    ✅ Updated config ${config.id} (status: ${config.status}) - slots: ${updatedSlots.join(', ')}`);
              }
            } else {
              console.log(`    ℹ️ Config ${config.id} already has templates, skipping`);
            }
          } catch (parseError) {
            console.log(`    ❌ Error processing config ${config.id}: ${parseError.message}`);
          }
        }
      } catch (storeError) {
        console.log(`  ❌ Error processing store ${store.id}: ${storeError.message}`);
      }
    }

    console.log(`\n✅ Migration complete! Updated ${totalUpdated} configuration(s)`);
    console.log('\n💡 Clear browser cache and refresh the cart page to see the changes.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();
