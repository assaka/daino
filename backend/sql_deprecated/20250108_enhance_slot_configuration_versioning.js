const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Check if the status column exists and get its current type
      const tableDescription = await queryInterface.describeTable('slot_configurations');
      
      if (tableDescription.status) {
        console.log('Updating status ENUM to include acceptance...');
        
        // Update the ENUM type to include 'acceptance'
        await queryInterface.sequelize.query(`
          ALTER TYPE "enum_slot_configurations_status" 
          ADD VALUE 'acceptance' AFTER 'draft';
        `, { transaction });
        
        console.log('✅ Added acceptance status to ENUM');
      } else {
        // Create status column if it doesn't exist
        await queryInterface.addColumn('slot_configurations', 'status', {
          type: DataTypes.ENUM('draft', 'acceptance', 'published', 'reverted'),
          allowNull: false,
          defaultValue: 'draft',
          comment: 'Status of the configuration version: draft -> acceptance -> published'
        }, { transaction });
        
        console.log('✅ Added status column with acceptance');
      }
      
      // Add current_edit_id column to track which configuration is being edited
      if (!tableDescription.current_edit_id) {
        await queryInterface.addColumn('slot_configurations', 'current_edit_id', {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'slot_configurations',
            key: 'id'
          },
          comment: 'ID of the configuration currently being edited (for revert tracking)'
        }, { transaction });
        
        console.log('✅ Added current_edit_id column');
      }
      
      // Add acceptance_published_at column
      if (!tableDescription.acceptance_published_at) {
        await queryInterface.addColumn('slot_configurations', 'acceptance_published_at', {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'Timestamp when this version was published to acceptance'
        }, { transaction });
        
        console.log('✅ Added acceptance_published_at column');
      }
      
      // Add acceptance_published_by column
      if (!tableDescription.acceptance_published_by) {
        await queryInterface.addColumn('slot_configurations', 'acceptance_published_by', {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: 'User who published this version to acceptance'
        }, { transaction });
        
        console.log('✅ Added acceptance_published_by column');
      }
      
      // Create index for current_edit_id
      await queryInterface.addIndex('slot_configurations', ['current_edit_id'], {
        name: 'idx_slot_config_current_edit',
        transaction
      });
      
      console.log('✅ Enhanced slot configuration versioning schema completed');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Remove added columns
      await queryInterface.removeColumn('slot_configurations', 'current_edit_id', { transaction });
      await queryInterface.removeColumn('slot_configurations', 'acceptance_published_at', { transaction });
      await queryInterface.removeColumn('slot_configurations', 'acceptance_published_by', { transaction });
      
      // Note: Cannot easily remove ENUM values in PostgreSQL, would require recreating the type
      console.log('⚠️  Note: ENUM value "acceptance" not removed - requires manual intervention');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};