#!/usr/bin/env node

const { sequelize } = require('../src/database/connection');

async function runProductLabelPositionMigration() {
  try {
    console.log('🚀 Starting product label position migration...');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Step 1: Update any existing 'center' positions to 'top-center'
    console.log('📝 Updating old center positions...');
    await sequelize.query(`
      UPDATE product_labels
      SET position = 'top-center'
      WHERE position = 'center';
    `);

    // Step 2: Drop the existing constraint if it exists
    console.log('🗑️  Removing old position constraint...');
    try {
      await sequelize.query(`
        ALTER TABLE product_labels
        DROP CONSTRAINT IF EXISTS product_labels_position_check;
      `);
    } catch (err) {
      console.log('ℹ️  No existing constraint to remove');
    }

    // Step 3: Change column type to VARCHAR to remove enum constraint
    console.log('🔄 Converting position column to VARCHAR...');
    await sequelize.query(`
      ALTER TABLE product_labels
      ALTER COLUMN position TYPE VARCHAR(20);
    `);

    // Step 4: Add new check constraint with all valid positions
    console.log('✅ Adding new position constraint...');
    await sequelize.query(`
      ALTER TABLE product_labels
      ADD CONSTRAINT product_labels_position_check
      CHECK (position IN (
        'top-left', 'top-right', 'top-center',
        'center-left', 'center-right',
        'bottom-left', 'bottom-right', 'bottom-center'
      ));
    `);

    console.log('✅ Migration completed successfully!');

    // Verify the changes
    const [results] = await sequelize.query(`
      SELECT DISTINCT position FROM product_labels;
    `);
    console.log('📊 Current position values in database:', results.map(r => r.position));

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runProductLabelPositionMigration();
}

module.exports = runProductLabelPositionMigration;