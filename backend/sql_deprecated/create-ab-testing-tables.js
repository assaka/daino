/**
 * Database Migration: Create A/B Testing Tables
 * Run with: node src/database/migrations/create-ab-testing-tables.js
 */

const sequelize = require('../../config/database');

async function runMigration() {
  try {
    console.log('Creating A/B testing tables...');

    // Create ab_tests table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ab_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        hypothesis TEXT,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')),
        variants JSONB NOT NULL DEFAULT '[]',
        traffic_allocation FLOAT DEFAULT 1.0 CHECK (traffic_allocation >= 0.0 AND traffic_allocation <= 1.0),
        targeting_rules JSONB,
        primary_metric VARCHAR(255) NOT NULL,
        secondary_metrics JSONB DEFAULT '[]',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        min_sample_size INTEGER DEFAULT 100,
        confidence_level FLOAT DEFAULT 0.95,
        winner_variant_id VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ Created ab_tests table');

    // Create indexes for ab_tests
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_ab_tests_store_id ON ab_tests(store_id);
      CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
      CREATE INDEX IF NOT EXISTS idx_ab_tests_start_date ON ab_tests(start_date);
      CREATE INDEX IF NOT EXISTS idx_ab_tests_end_date ON ab_tests(end_date);
    `);

    console.log('✓ Created ab_tests indexes');

    // Create ab_test_assignments table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS ab_test_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        session_id VARCHAR(255) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        variant_id VARCHAR(255) NOT NULL,
        variant_name VARCHAR(255) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        converted BOOLEAN DEFAULT FALSE,
        converted_at TIMESTAMP,
        conversion_value DECIMAL(10, 2),
        metrics JSONB DEFAULT '{}',
        device_type VARCHAR(50),
        user_agent TEXT,
        ip_address VARCHAR(45),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_test_session UNIQUE (test_id, session_id)
      );
    `);

    console.log('✓ Created ab_test_assignments table');

    // Create indexes for ab_test_assignments
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_ab_assignments_test_id ON ab_test_assignments(test_id);
      CREATE INDEX IF NOT EXISTS idx_ab_assignments_store_id ON ab_test_assignments(store_id);
      CREATE INDEX IF NOT EXISTS idx_ab_assignments_session_id ON ab_test_assignments(session_id);
      CREATE INDEX IF NOT EXISTS idx_ab_assignments_user_id ON ab_test_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_ab_assignments_variant_id ON ab_test_assignments(variant_id);
      CREATE INDEX IF NOT EXISTS idx_ab_assignments_converted ON ab_test_assignments(converted);
      CREATE INDEX IF NOT EXISTS idx_ab_assignments_assigned_at ON ab_test_assignments(assigned_at);
    `);

    console.log('✓ Created ab_test_assignments indexes');

    // Create trigger to update updated_at timestamp
    await sequelize.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await sequelize.query(`
      DROP TRIGGER IF EXISTS update_ab_tests_updated_at ON ab_tests;
      CREATE TRIGGER update_ab_tests_updated_at
        BEFORE UPDATE ON ab_tests
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await sequelize.query(`
      DROP TRIGGER IF EXISTS update_ab_assignments_updated_at ON ab_test_assignments;
      CREATE TRIGGER update_ab_assignments_updated_at
        BEFORE UPDATE ON ab_test_assignments
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✓ Created update triggers');

    console.log('\n✅ A/B testing tables created successfully!');

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
