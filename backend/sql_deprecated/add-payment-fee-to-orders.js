const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Check if column already exists
    const tableInfo = await queryInterface.describeTable('orders');
    
    if (!tableInfo.payment_fee_amount) {
      await queryInterface.addColumn('orders', 'payment_fee_amount', {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
        after: 'discount_amount' // Position it after discount_amount
      });
      
      console.log('✅ Added payment_fee_amount column to orders table');
    } else {
      console.log('ℹ️ payment_fee_amount column already exists in orders table');
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('orders', 'payment_fee_amount');
    console.log('✅ Removed payment_fee_amount column from orders table');
  }
};