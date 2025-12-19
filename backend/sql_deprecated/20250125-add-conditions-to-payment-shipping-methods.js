/**
 * Add Conditions to Payment and Shipping Methods
 *
 * Adds a conditions JSONB field to both payment_methods and shipping_methods tables
 * to support conditional display based on categories, attribute sets, SKUs, and attribute values.
 * Similar to the Custom Options conditions system.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Adding conditions field to payment and shipping methods...');

    // 1. Add conditions to payment_methods
    await sequelize.query(`
      ALTER TABLE payment_methods
      ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::jsonb;
    `);

    await sequelize.query(`
      COMMENT ON COLUMN payment_methods.conditions IS 'Optional conditions for displaying payment method: {"categories": [], "attribute_sets": [], "skus": [], "attribute_conditions": []}';
    `);

    console.log('✅ Added conditions to payment_methods');

    // 2. Add conditions to shipping_methods
    await sequelize.query(`
      ALTER TABLE shipping_methods
      ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{}'::jsonb;
    `);

    await sequelize.query(`
      COMMENT ON COLUMN shipping_methods.conditions IS 'Optional conditions for displaying shipping method: {"categories": [], "attribute_sets": [], "skus": [], "attribute_conditions": []}';
    `);

    console.log('✅ Added conditions to shipping_methods');

    // 3. Create indexes for better query performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_methods_conditions
      ON payment_methods USING GIN (conditions);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_shipping_methods_conditions
      ON shipping_methods USING GIN (conditions);
    `);

    console.log('✅ Created GIN indexes for conditions fields');
    console.log('✅ Conditions fields added successfully!');
  },

  down: async (queryInterface) => {
    const { sequelize } = queryInterface;

    console.log('🔄 Removing conditions fields from payment and shipping methods...');

    await sequelize.query('DROP INDEX IF EXISTS idx_payment_methods_conditions;');
    await sequelize.query('DROP INDEX IF EXISTS idx_shipping_methods_conditions;');

    await sequelize.query('ALTER TABLE payment_methods DROP COLUMN IF EXISTS conditions;');
    await sequelize.query('ALTER TABLE shipping_methods DROP COLUMN IF EXISTS conditions;');

    console.log('✅ Conditions fields removed');
  }
};
