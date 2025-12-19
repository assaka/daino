// Migrate data from plugin_events to plugin_event_listeners
// This converts old filename-based events to flexible junction table

const { sequelize } = require('./connection');

async function migrateEventsToListeners() {
  try {
    console.log('🔄 Migrating events from plugin_events to plugin_event_listeners...');

    // Get all events from old table
    const oldEvents = await sequelize.query(`
      SELECT
        plugin_id,
        event_name,
        listener_function,
        priority,
        is_enabled,
        created_at,
        updated_at
      FROM plugin_events
      WHERE is_enabled = true
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`📦 Found ${oldEvents.length} events to migrate`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const event of oldEvents) {
      try {
        // Convert event_name to filename (reverse of old system)
        // cart.viewed → cart_viewed.js
        const fileName = event.event_name.replace(/\./g, '_') + '.js';
        const filePath = `/events/${fileName}`;

        // Check if already exists in new table
        const existing = await sequelize.query(`
          SELECT id FROM plugin_event_listeners
          WHERE plugin_id = $1 AND file_name = $2 AND event_name = $3
        `, {
          bind: [event.plugin_id, fileName, event.event_name],
          type: sequelize.QueryTypes.SELECT
        });

        if (existing.length > 0) {
          console.log(`  ⏭️  Skipping ${event.plugin_id} / ${fileName} → ${event.event_name} (already exists)`);
          skipped++;
          continue;
        }

        // Insert into new table
        await sequelize.query(`
          INSERT INTO plugin_event_listeners (
            plugin_id,
            file_name,
            file_path,
            event_name,
            listener_function,
            priority,
            is_enabled,
            description,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, {
          bind: [
            event.plugin_id,
            fileName,
            filePath,
            event.event_name,
            event.listener_function,
            event.priority || 10,
            event.is_enabled,
            `Migrated from old system: Listens to ${event.event_name}`,
            event.created_at,
            event.updated_at
          ],
          type: sequelize.QueryTypes.INSERT
        });

        console.log(`  ✅ Migrated ${event.plugin_id} / ${fileName} → ${event.event_name}`);
        migrated++;

      } catch (error) {
        console.error(`  ❌ Error migrating ${event.plugin_id} / ${event.event_name}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migrated}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📦 Total: ${oldEvents.length}`);

    if (errors === 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('⚠️  Note: Old plugin_events table is still intact.');
      console.log('   You can drop it manually once you verify everything works:');
      console.log('   DROP TABLE plugin_events;');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  migrateEventsToListeners()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateEventsToListeners };
