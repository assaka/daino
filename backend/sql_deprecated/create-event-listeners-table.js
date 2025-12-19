// Create plugin_event_listeners junction table
// This table maps files to events they listen to (M:N relationship)

const { sequelize } = require('./connection');

async function createEventListenersTable() {
  try {
    console.log('🔄 Creating plugin_event_listeners junction table...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS plugin_event_listeners (
        id SERIAL PRIMARY KEY,
        plugin_id VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        event_name VARCHAR(255) NOT NULL,
        listener_function TEXT NOT NULL,
        priority INT DEFAULT 10,
        is_enabled BOOLEAN DEFAULT true,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        -- Prevent duplicate mappings
        UNIQUE(plugin_id, file_name, event_name),

        -- Foreign key to plugin_registry
        CONSTRAINT fk_plugin_event_listener_plugin
          FOREIGN KEY (plugin_id)
          REFERENCES plugin_registry(id)
          ON DELETE CASCADE
      );
    `);

    console.log('✅ Created plugin_event_listeners table');

    // Create indexes for performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_event_listeners_plugin
        ON plugin_event_listeners(plugin_id);

      CREATE INDEX IF NOT EXISTS idx_event_listeners_event
        ON plugin_event_listeners(event_name);

      CREATE INDEX IF NOT EXISTS idx_event_listeners_enabled
        ON plugin_event_listeners(is_enabled);
    `);

    console.log('✅ Created indexes');

    // Add comments for documentation
    await sequelize.query(`
      COMMENT ON TABLE plugin_event_listeners IS
        'Junction table mapping plugin files to events they listen to';

      COMMENT ON COLUMN plugin_event_listeners.file_name IS
        'Descriptive filename like analytics_tracker.js';

      COMMENT ON COLUMN plugin_event_listeners.event_name IS
        'Event to listen to like cart.viewed, product.view';
    `);

    console.log('✅ plugin_event_listeners table ready');

  } catch (error) {
    console.error('❌ Error creating plugin_event_listeners table:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createEventListenersTable()
    .then(() => {
      console.log('✅ Setup complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { createEventListenersTable };
