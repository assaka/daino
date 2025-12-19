module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, update any existing 'center' positions to 'top-center' as a reasonable default
    await queryInterface.sequelize.query(`
      UPDATE product_labels
      SET position = 'top-center'
      WHERE position = 'center';
    `);

    // Drop the existing enum type and recreate it with the new values
    // This is a PostgreSQL-specific approach
    await queryInterface.sequelize.query(`
      ALTER TABLE product_labels
      ALTER COLUMN position TYPE VARCHAR(20);
    `);

    // Now recreate the enum with all position options
    await queryInterface.sequelize.query(`
      ALTER TABLE product_labels
      ALTER COLUMN position TYPE VARCHAR(20);
    `);

    // Add a check constraint to ensure only valid positions are used
    await queryInterface.sequelize.query(`
      ALTER TABLE product_labels
      ADD CONSTRAINT product_labels_position_check
      CHECK (position IN (
        'top-left', 'top-right', 'top-center',
        'center-left', 'center-right',
        'bottom-left', 'bottom-right', 'bottom-center'
      ));
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE product_labels
      DROP CONSTRAINT IF EXISTS product_labels_position_check;
    `);

    // Revert any positions that don't exist in the old enum
    await queryInterface.sequelize.query(`
      UPDATE product_labels
      SET position = 'top-left'
      WHERE position NOT IN ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center');
    `);
  }
};