module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add is_system column to cron_jobs table
    await queryInterface.addColumn('cron_jobs', 'is_system', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'System jobs cannot be edited/deleted by users'
    });

    // Mark existing system jobs as is_system = true
    // You can identify system jobs by their tags or names
    await queryInterface.sequelize.query(`
      UPDATE cron_jobs
      SET is_system = true
      WHERE tags LIKE '%system%'
         OR name LIKE '%System%'
         OR name LIKE '%Daily Credit%'
         OR name LIKE '%Cleanup%';
    `);

    console.log('✅ Added is_system column to cron_jobs table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('cron_jobs', 'is_system');
    console.log('✅ Removed is_system column from cron_jobs table');
  }
};
