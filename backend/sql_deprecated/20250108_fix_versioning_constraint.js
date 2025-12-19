'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      // Remove the old unique constraint that prevents multiple versions
      await queryInterface.removeIndex('slot_configurations', 'unique_user_store_config').catch(err => {
        console.log('Constraint might not exist, continuing...');
      });
      
      // Add new composite unique constraint for drafts
      // Only one draft per user/store/page_type combination
      await queryInterface.addIndex('slot_configurations', 
        ['user_id', 'store_id', 'page_type', 'status'], 
        {
          unique: true,
          name: 'unique_draft_per_user_store_page',
          where: {
            status: 'draft'
          }
        }
      ).catch(err => {
        console.log('Index might already exist, continuing...');
      });
      
      console.log('✅ Fixed versioning constraints');
    } catch (error) {
      console.error('Migration error:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the new constraint
    await queryInterface.removeIndex('slot_configurations', 'unique_draft_per_user_store_page').catch(() => {});
    
    // Re-add the old constraint
    await queryInterface.addIndex('slot_configurations', ['user_id', 'store_id'], {
      unique: true,
      name: 'unique_user_store_config'
    }).catch(() => {});
  }
};