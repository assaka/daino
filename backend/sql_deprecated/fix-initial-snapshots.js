#!/usr/bin/env node

/**
 * Fix Initial Snapshots - Populate with Real Plugin Data
 * The initial migration created empty snapshots
 * This script populates them with actual plugin state
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const { Sequelize } = require('sequelize');
const { QueryTypes } = require('sequelize');

async function fixInitialSnapshots() {
  try {
    const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

    if (!databaseUrl) {
      console.error('❌ No DATABASE_URL found in environment');
      process.exit(1);
    }

    console.log('🔧 Fixing Initial Snapshots with Real Plugin Data');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const sequelize = new Sequelize(databaseUrl, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    });

    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Get all initial snapshots
    const initialVersions = await sequelize.query(`
      SELECT vh.id, vh.plugin_id, vh.version_number, vh.version_type
      FROM plugin_version_history vh
      WHERE vh.version_type = 'snapshot'
      ORDER BY vh.created_at ASC
    `, { type: QueryTypes.SELECT });

    console.log(`📊 Found ${initialVersions.length} snapshot versions to fix\n`);

    for (const version of initialVersions) {
      console.log(`🔧 Processing: ${version.version_number} (${version.plugin_id})`);

      // Get current plugin state
      const [registry] = await sequelize.query(
        'SELECT * FROM plugin_registry WHERE id = $1',
        { bind: [version.plugin_id], type: QueryTypes.SELECT }
      );

      if (!registry) {
        console.log(`  ⚠️  Plugin not found, skipping`);
        continue;
      }

      const hooks = await sequelize.query(
        'SELECT * FROM plugin_hooks WHERE plugin_id = $1',
        { bind: [version.plugin_id], type: QueryTypes.SELECT }
      );

      const events = await sequelize.query(
        'SELECT * FROM plugin_events WHERE plugin_id = $1',
        { bind: [version.plugin_id], type: QueryTypes.SELECT }
      );

      const scripts = await sequelize.query(
        'SELECT * FROM plugin_scripts WHERE plugin_id = $1',
        { bind: [version.plugin_id], type: QueryTypes.SELECT }
      );

      const widgets = await sequelize.query(
        'SELECT * FROM plugin_widgets WHERE plugin_id = $1',
        { bind: [version.plugin_id], type: QueryTypes.SELECT }
      );

      const controllers = await sequelize.query(
        'SELECT * FROM plugin_controllers WHERE plugin_id = $1',
        { bind: [version.plugin_id], type: QueryTypes.SELECT }
      );

      const entities = await sequelize.query(
        'SELECT * FROM plugin_entities WHERE plugin_id = $1',
        { bind: [version.plugin_id], type: QueryTypes.SELECT }
      );

      const pluginState = {
        registry,
        hooks,
        events,
        scripts,
        widgets,
        controllers,
        entities
      };

      console.log(`  📦 Plugin state:`, {
        hooks: hooks.length,
        events: events.length,
        scripts: scripts.length,
        widgets: widgets.length,
        controllers: controllers.length,
        entities: entities.length
      });

      // Update or insert snapshot
      const [existingSnapshot] = await sequelize.query(
        'SELECT id FROM plugin_version_snapshots WHERE version_id = $1',
        { bind: [version.id], type: QueryTypes.SELECT }
      );

      if (existingSnapshot) {
        // Update existing snapshot
        await sequelize.query(`
          UPDATE plugin_version_snapshots
          SET
            snapshot_data = $1,
            hooks = $2,
            events = $3,
            scripts = $4,
            widgets = $5,
            controllers = $6,
            entities = $7,
            manifest = $8,
            registry = $9
          WHERE version_id = $10
        `, {
          bind: [
            JSON.stringify(pluginState),
            JSON.stringify(hooks),
            JSON.stringify(events),
            JSON.stringify(scripts),
            JSON.stringify(widgets),
            JSON.stringify(controllers),
            JSON.stringify(entities),
            JSON.stringify(registry.manifest),
            JSON.stringify(registry)
          ,
            version.id
          ],
          type: QueryTypes.UPDATE
        });
        console.log(`  ✅ Updated existing snapshot`);
      } else {
        // Create new snapshot
        await sequelize.query(`
          INSERT INTO plugin_version_snapshots (
            version_id, plugin_id, snapshot_data, hooks, events, scripts, widgets, controllers, entities, manifest, registry
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, {
          bind: [
            version.id,
            version.plugin_id,
            JSON.stringify(pluginState),
            JSON.stringify(hooks),
            JSON.stringify(events),
            JSON.stringify(scripts),
            JSON.stringify(widgets),
            JSON.stringify(controllers),
            JSON.stringify(entities),
            JSON.stringify(registry.manifest),
            JSON.stringify(registry)
          ],
          type: QueryTypes.INSERT
        });
        console.log(`  ✅ Created new snapshot`);
      }

      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ All initial snapshots fixed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to fix snapshots:', error);
    process.exit(1);
  }
}

fixInitialSnapshots();
