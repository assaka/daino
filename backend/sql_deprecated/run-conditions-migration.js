#!/usr/bin/env node

require('dotenv').config();
const { sequelize } = require('../src/database/connection');
const Sequelize = require('sequelize');

async function runConditionsMigration() {
  try {
    console.log('🚀 Starting conditions migration for payment and shipping methods...');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection verified');

    // Load the migration module
    const migration = require('./20250125-add-conditions-to-payment-shipping-methods.js');

    console.log('📄 Conditions migration module loaded');

    // Create queryInterface
    const queryInterface = sequelize.getQueryInterface();

    // Run the migration's up function
    console.log('🔄 Running migration...');
    await migration.up(queryInterface, Sequelize);

    console.log('✅ Conditions migration completed successfully!');

    // Test the migration by checking the columns
    try {
      const [paymentResults] = await sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'payment_methods' AND column_name = 'conditions'"
      );
      if (paymentResults.length > 0) {
        console.log('✅ Conditions column successfully added to payment_methods table');
      }

      const [shippingResults] = await sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'shipping_methods' AND column_name = 'conditions'"
      );
      if (shippingResults.length > 0) {
        console.log('✅ Conditions column successfully added to shipping_methods table');
      }
    } catch (e) {
      console.log('ℹ️  Could not verify columns (may be using SQLite)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Conditions migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runConditionsMigration();
}

module.exports = runConditionsMigration;
