/**
 * Migration: Update Cart Slot Templates
 *
 * This migration updates all cart configurations to include the proper HTML templates
 * for CartItemsSlot, CartCouponSlot, and CartOrderSummarySlot components.
 *
 * Previously these slots had empty content (''), which caused the cart page
 * to not render items, summary, and coupon sections.
 */

const { cartConfig } = require('../src/configs/slot/cart-config.js');

const MIGRATION_NAME = '20250107_update_cart_slot_templates';

// The slots that need to be updated with their templates
const SLOTS_TO_UPDATE = ['cart_items', 'coupon_section', 'order_summary'];

async function up(knex) {
  console.log(`\n🔧 Running migration: ${MIGRATION_NAME}`);

  // Get all slot_configurations for cart pages
  const cartConfigurations = await knex('slot_configurations')
    .where('page_type', 'cart')
    .whereIn('status', ['published', 'draft', 'init']);

  console.log(`Found ${cartConfigurations.length} cart configurations to check`);

  let updatedCount = 0;

  for (const config of cartConfigurations) {
    try {
      const configuration = typeof config.configuration === 'string'
        ? JSON.parse(config.configuration)
        : config.configuration;

      if (!configuration?.slots) {
        console.log(`  ⚠️ Config ${config.id} has no slots, skipping`);
        continue;
      }

      let needsUpdate = false;

      // Check each slot that needs templates
      for (const slotId of SLOTS_TO_UPDATE) {
        const slot = configuration.slots[slotId];
        const templateSlot = cartConfig.slots[slotId];

        if (slot && templateSlot) {
          // Check if the slot needs updating (has empty content or missing content)
          if (!slot.content || slot.content === '' || slot.content.trim() === '') {
            console.log(`  📝 Updating ${slotId} in config ${config.id}`);
            configuration.slots[slotId] = {
              ...slot,
              content: templateSlot.content
            };
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await knex('slot_configurations')
          .where('id', config.id)
          .update({
            configuration: JSON.stringify(configuration),
            updated_at: new Date()
          });
        updatedCount++;
        console.log(`  ✅ Updated config ${config.id} (store: ${config.store_id})`);
      }
    } catch (error) {
      console.error(`  ❌ Error updating config ${config.id}:`, error.message);
    }
  }

  console.log(`\n✅ Migration complete: Updated ${updatedCount} configurations`);
}

async function down(knex) {
  // Revert by setting content back to empty string
  console.log(`\n🔧 Reverting migration: ${MIGRATION_NAME}`);

  const cartConfigurations = await knex('slot_configurations')
    .where('page_type', 'cart')
    .whereIn('status', ['published', 'draft', 'init']);

  let revertedCount = 0;

  for (const config of cartConfigurations) {
    try {
      const configuration = typeof config.configuration === 'string'
        ? JSON.parse(config.configuration)
        : config.configuration;

      if (!configuration?.slots) continue;

      let needsRevert = false;

      for (const slotId of SLOTS_TO_UPDATE) {
        const slot = configuration.slots[slotId];
        if (slot && slot.content && slot.content !== '') {
          configuration.slots[slotId].content = '';
          needsRevert = true;
        }
      }

      if (needsRevert) {
        await knex('slot_configurations')
          .where('id', config.id)
          .update({
            configuration: JSON.stringify(configuration),
            updated_at: new Date()
          });
        revertedCount++;
      }
    } catch (error) {
      console.error(`  ❌ Error reverting config ${config.id}:`, error.message);
    }
  }

  console.log(`\n✅ Revert complete: Reverted ${revertedCount} configurations`);
}

module.exports = { up, down };
