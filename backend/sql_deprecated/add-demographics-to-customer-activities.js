/**
 * Database Migration: Add Demographics to Customer Activities
 * Adds country, language, city, region, device info for comprehensive analytics
 * Run with: node src/database/migrations/add-demographics-to-customer-activities.js
 */

const { Sequelize } = require('sequelize');
const { getDatabaseConfig } = require('../../config/database');

const sequelize = new Sequelize(getDatabaseConfig());

async function runMigration() {
  try {
    console.log('Adding demographics and device columns to customer_activities table...');

    // Geographic data
    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS country VARCHAR(2);
    `).catch(err => console.log('country column may already exist:', err.message));

    console.log('✓ Added country column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
    `).catch(err => console.log('country_name column may already exist:', err.message));

    console.log('✓ Added country_name column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS city VARCHAR(100);
    `).catch(err => console.log('city column may already exist:', err.message));

    console.log('✓ Added city column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS region VARCHAR(100);
    `).catch(err => console.log('region column may already exist:', err.message));

    console.log('✓ Added region column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS language VARCHAR(10);
    `).catch(err => console.log('language column may already exist:', err.message));

    console.log('✓ Added language column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);
    `).catch(err => console.log('timezone column may already exist:', err.message));

    console.log('✓ Added timezone column');

    // Device and browser data (matching heatmap_sessions schema)
    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'tablet', 'mobile'));
    `).catch(err => console.log('device_type column may already exist:', err.message));

    console.log('✓ Added device_type column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS browser_name VARCHAR(100);
    `).catch(err => console.log('browser_name column may already exist:', err.message));

    console.log('✓ Added browser_name column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS operating_system VARCHAR(100);
    `).catch(err => console.log('operating_system column may already exist:', err.message));

    console.log('✓ Added operating_system column');

    // UTM tracking parameters
    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS utm_source VARCHAR(255);
    `).catch(err => console.log('utm_source column may already exist:', err.message));

    console.log('✓ Added utm_source column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(255);
    `).catch(err => console.log('utm_medium column may already exist:', err.message));

    console.log('✓ Added utm_medium column');

    await sequelize.query(`
      ALTER TABLE customer_activities
      ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(255);
    `).catch(err => console.log('utm_campaign column may already exist:', err.message));

    console.log('✓ Added utm_campaign column');

    // Create indexes for analytics queries
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_activities_country ON customer_activities(country);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_activities_city ON customer_activities(city);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_activities_language ON customer_activities(language);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_activities_device_type ON customer_activities(device_type);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_customer_activities_utm_source ON customer_activities(utm_source);
    `);

    console.log('✓ Created demographic and marketing indexes');

    console.log('\n✅ Demographics columns added successfully!');
    console.log('Geographic: country, country_name, city, region, language, timezone');
    console.log('Device: device_type, browser_name, operating_system');
    console.log('Marketing: utm_source, utm_medium, utm_campaign');

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
