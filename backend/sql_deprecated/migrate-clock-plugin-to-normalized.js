/**
 * Migrate Clock Plugin from JSON format to Normalized Tables
 * This script converts existing JSON-based plugins to use the new normalized structure
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    require: true,
    rejectUnauthorized: false
  } : false
});

async function migrateClockPlugin() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Clock Plugin migration to normalized tables...\n');

    // 1. Find the Clock plugin in plugin_registry
    const pluginQuery = await client.query(`
      SELECT * FROM plugin_registry
      WHERE name ILIKE '%clock%' OR id ILIKE '%clock%'
      LIMIT 1
    `);

    if (pluginQuery.rows.length === 0) {
      console.log('❌ Clock plugin not found in plugin_registry');
      console.log('Creating a new Clock plugin...\n');

      // Create Clock plugin from scratch
      await createClockPlugin(client);
      return;
    }

    const plugin = pluginQuery.rows[0];
    console.log(`✅ Found plugin: ${plugin.name} (${plugin.id})\n`);

    // 2. Parse source_code if it's JSON
    let sourceFiles = [];
    if (plugin.source_code) {
      try {
        if (typeof plugin.source_code === 'string') {
          sourceFiles = JSON.parse(plugin.source_code);
        } else if (Array.isArray(plugin.source_code)) {
          sourceFiles = plugin.source_code;
        }
      } catch (e) {
        console.log('Warning: Could not parse source_code as JSON');
      }
    }

    // 3. Parse config for hooks and events
    let config = {};
    if (plugin.config) {
      try {
        if (typeof plugin.config === 'string') {
          config = JSON.parse(plugin.config);
        } else {
          config = plugin.config;
        }
      } catch (e) {
        console.log('Warning: Could not parse config as JSON');
      }
    }

    // 4. Migrate source_code to plugin_scripts
    console.log('📄 Migrating source files to plugin_scripts...');
    if (sourceFiles.length > 0) {
      for (let i = 0; i < sourceFiles.length; i++) {
        const file = sourceFiles[i];
        const fileName = file.name || file.filename || `file_${i}`;
        const code = file.code || file.content || '';

        await client.query(`
          INSERT INTO plugin_scripts (plugin_id, file_name, file_content, script_type, load_priority, scope, is_enabled)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT ON CONSTRAINT plugin_scripts_pkey
          DO NOTHING
        `, [plugin.id, fileName, code, 'js', i, 'frontend', true]);

        console.log(`  ✅ Migrated script: ${fileName}`);
      }
    }

    // 5. Migrate hooks to plugin_hooks
    console.log('\n🪝 Migrating hooks to plugin_hooks...');
    const hooks = config.hooks || [];
    if (hooks.length > 0) {
      for (const hook of hooks) {
        await client.query(`
          INSERT INTO plugin_hooks (plugin_id, hook_name, handler_function, priority, is_enabled)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT ON CONSTRAINT plugin_hooks_pkey
          DO NOTHING
        `, [
          plugin.id,
          hook.hook_name || hook.name,
          hook.handler_code || hook.code || hook.handler,
          hook.priority || 10,
          hook.enabled !== false
        ]);

        console.log(`  ✅ Migrated hook: ${hook.hook_name || hook.name}`);
      }
    }

    // 6. Migrate events to plugin_events
    console.log('\n📡 Migrating events to plugin_events...');
    const events = config.events || [];
    if (events.length > 0) {
      for (const event of events) {
        await client.query(`
          INSERT INTO plugin_events (plugin_id, event_name, listener_function, priority, is_enabled)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT ON CONSTRAINT plugin_events_pkey
          DO NOTHING
        `, [
          plugin.id,
          event.event_name || event.name,
          event.listener_code || event.code || event.handler,
          event.priority || 10,
          event.enabled !== false
        ]);

        console.log(`  ✅ Migrated event: ${event.event_name || event.name}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Plugin: ${plugin.name}`);
    console.log(`  - Scripts migrated: ${sourceFiles.length}`);
    console.log(`  - Hooks migrated: ${hooks.length}`);
    console.log(`  - Events migrated: ${events.length}`);

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Create a new Clock plugin with normalized structure
 */
async function createClockPlugin(client) {
  const pluginId = 'clock-widget';

  console.log('📦 Creating Clock Widget plugin...\n');

  // 1. Create plugin entry
  await client.query(`
    INSERT INTO plugin_registry (
      id, name, version, description, type, category, author, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO NOTHING
  `, [
    pluginId,
    'Clock Widget',
    '1.0.0',
    'A simple clock widget that displays current time',
    'widget',
    'utility',
    'System',
    'active'
  ]);

  console.log('✅ Created plugin entry');

  // 2. Create main widget script
  const widgetCode = `
export default function ClockWidget() {
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="clock-widget" style={{
      padding: '20px',
      background: '#f0f0f0',
      borderRadius: '8px',
      textAlign: 'center',
      fontFamily: 'monospace'
    }}>
      <h3>Current Time</h3>
      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
        {time.toLocaleTimeString()}
      </div>
      <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
        {time.toLocaleDateString()}
      </div>
    </div>
  );
}
  `.trim();

  await client.query(`
    INSERT INTO plugin_scripts (plugin_id, file_name, file_content, script_type, load_priority, scope, is_enabled)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT ON CONSTRAINT plugin_scripts_pkey DO NOTHING
  `, [
    pluginId,
    'components/ClockWidget',
    widgetCode,
    'js',
    0,
    'frontend',
    true
  ]);

  console.log('✅ Created widget component');

  // 3. Create cart.viewed event listener
  const cartViewedCode = `
export default async function onCartViewed(data) {
  console.log('Cart viewed at:', new Date().toLocaleTimeString());
  console.log('Cart data:', data);

  // Show alert when cart is viewed
  if (typeof window !== 'undefined') {
    window.alert('Cart was viewed at ' + new Date().toLocaleTimeString());
  }
}
  `.trim();

  await client.query(`
    INSERT INTO plugin_events (plugin_id, event_name, listener_function, priority, is_enabled)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT ON CONSTRAINT plugin_events_pkey DO NOTHING
  `, [
    pluginId,
    'cart.viewed',
    cartViewedCode,
    10,
    true
  ]);

  console.log('✅ Created cart.viewed event listener');

  console.log('\n✅ Clock Widget plugin created successfully!');
}

// Run migration
migrateClockPlugin()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
