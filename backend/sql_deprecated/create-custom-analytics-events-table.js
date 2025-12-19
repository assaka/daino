/**
 * Database Migration: Create Custom Analytics Events Table
 * Run with: node src/database/migrations/create-custom-analytics-events-table.js
 */

const sequelize = require('../../config/database');

async function runMigration() {
  try {
    console.log('Creating custom_analytics_events table...');

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS custom_analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        event_name VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        description TEXT,
        event_category VARCHAR(50) DEFAULT 'custom' CHECK (event_category IN ('ecommerce', 'engagement', 'conversion', 'navigation', 'custom')),
        trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('page_load', 'click', 'form_submit', 'scroll', 'timer', 'custom', 'automatic')),
        trigger_selector VARCHAR(500),
        trigger_condition JSONB,
        event_parameters JSONB NOT NULL DEFAULT '{}',
        enabled BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 10,
        is_system BOOLEAN DEFAULT FALSE,
        fire_once_per_session BOOLEAN DEFAULT FALSE,
        send_to_backend BOOLEAN DEFAULT TRUE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ Created custom_analytics_events table');

    // Create indexes
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_custom_events_store_id ON custom_analytics_events(store_id);
      CREATE INDEX IF NOT EXISTS idx_custom_events_enabled ON custom_analytics_events(enabled);
      CREATE INDEX IF NOT EXISTS idx_custom_events_trigger_type ON custom_analytics_events(trigger_type);
      CREATE INDEX IF NOT EXISTS idx_custom_events_category ON custom_analytics_events(event_category);
      CREATE INDEX IF NOT EXISTS idx_custom_events_priority ON custom_analytics_events(priority);
    `);

    console.log('✓ Created indexes');

    // Create trigger for updated_at
    await sequelize.query(`
      DROP TRIGGER IF EXISTS update_custom_events_updated_at ON custom_analytics_events;
      CREATE TRIGGER update_custom_events_updated_at
        BEFORE UPDATE ON custom_analytics_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✓ Created update trigger');

    // Insert system default events
    await sequelize.query(`
      INSERT INTO custom_analytics_events (store_id, event_name, display_name, description, event_category, trigger_type, event_parameters, is_system, enabled)
      SELECT
        id,
        'page_view',
        'Page View',
        'Tracks when a user views any page',
        'navigation',
        'page_load',
        '{"page_title": "{{page_title}}", "page_url": "{{page_url}}"}'::jsonb,
        TRUE,
        TRUE
      FROM stores
      ON CONFLICT DO NOTHING;
    `);

    console.log('✓ Inserted default page_view event for all stores');

    console.log('\n✅ Custom analytics events table created successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = runMigration;
