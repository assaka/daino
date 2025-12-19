const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Recreating slot_configurations table with VARCHAR status...');
      
      // Step 1: Backup existing data
      console.log('1️⃣ Creating backup of existing data...');
      await queryInterface.sequelize.query(`
        CREATE TEMP TABLE slot_configurations_backup AS 
        SELECT * FROM slot_configurations
      `, { transaction });
      
      // Step 2: Drop the existing table and enum type
      console.log('2️⃣ Dropping existing table and enum type...');
      await queryInterface.dropTable('slot_configurations', { transaction });
      
      try {
        await queryInterface.sequelize.query(`
          DROP TYPE IF EXISTS enum_slot_configurations_status CASCADE
        `, { transaction });
        console.log('✅ Old enum type dropped successfully');
      } catch (enumError) {
        console.log('⚠️ Could not drop enum type:', enumError.message);
      }
      
      // Step 3: Recreate table with VARCHAR status
      console.log('3️⃣ Creating new slot_configurations table with VARCHAR status...');
      await queryInterface.createTable('slot_configurations', {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
        },
        user_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        store_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'stores',
            key: 'id'
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE'
        },
        configuration: {
          type: DataTypes.JSON,
          allowNull: false,
          comment: 'Complete slot configuration JSON including slots, components, and metadata'
        },
        version: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: '1.0',
          comment: 'Configuration schema version'
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Whether this configuration is currently active'
        },
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'draft',
          comment: 'Status of the configuration version: draft -> acceptance -> published'
        },
        version_number: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
          comment: 'Version number for tracking configuration history'
        },
        page_type: {
          type: DataTypes.STRING,
          allowNull: true,
          defaultValue: 'cart',
          comment: 'Type of page this configuration applies to'
        },
        published_at: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'Timestamp when this version was published'
        },
        published_by: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: 'User who published this version'
        },
        acceptance_published_at: {
          type: DataTypes.DATE,
          allowNull: true,
          comment: 'Timestamp when this version was published to acceptance'
        },
        acceptance_published_by: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: 'User who published this version to acceptance'
        },
        current_edit_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'slot_configurations',
            key: 'id'
          },
          comment: 'ID of the configuration currently being edited (for revert tracking)'
        },
        parent_version_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'slot_configurations',
            key: 'id'
          },
          comment: 'Reference to the parent version this was based on'
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        }
      }, { 
        transaction,
        tableName: 'slot_configurations',
        underscored: true,
        timestamps: true
      });
      
      // Step 4: Add constraints and indexes
      console.log('4️⃣ Adding constraints and indexes...');
      
      // Check constraint for valid status values
      await queryInterface.sequelize.query(`
        ALTER TABLE slot_configurations 
        ADD CONSTRAINT chk_status_values 
        CHECK (status IN ('draft', 'acceptance', 'published', 'reverted'))
      `, { transaction });
      
      // Indexes
      await queryInterface.addIndex('slot_configurations', ['user_id', 'store_id', 'status', 'page_type'], {
        name: 'idx_user_store_status_page',
        transaction
      });
      
      await queryInterface.addIndex('slot_configurations', ['store_id', 'status', 'page_type', 'version_number'], {
        name: 'idx_store_status_page_version',
        transaction
      });
      
      await queryInterface.addIndex('slot_configurations', ['parent_version_id'], {
        name: 'idx_parent_version',
        transaction
      });
      
      await queryInterface.addIndex('slot_configurations', ['current_edit_id'], {
        name: 'idx_current_edit',
        transaction
      });
      
      await queryInterface.addIndex('slot_configurations', ['store_id'], {
        transaction
      });
      
      await queryInterface.addIndex('slot_configurations', ['is_active'], {
        transaction
      });
      
      await queryInterface.addIndex('slot_configurations', ['status'], {
        name: 'idx_slot_config_status',
        transaction
      });
      
      // Step 5: Restore data from backup
      console.log('5️⃣ Restoring data from backup...');
      await queryInterface.sequelize.query(`
        INSERT INTO slot_configurations (
          id, user_id, store_id, configuration, version, is_active, status, 
          version_number, page_type, published_at, published_by, 
          acceptance_published_at, acceptance_published_by, current_edit_id,
          parent_version_id, created_at, updated_at
        )
        SELECT 
          id, user_id, store_id, configuration, version, is_active, status::text,
          version_number, page_type, published_at, published_by,
          acceptance_published_at, acceptance_published_by, current_edit_id,
          parent_version_id, created_at, updated_at
        FROM slot_configurations_backup
      `, { transaction });
      
      console.log('✅ Table successfully recreated with VARCHAR status column');
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('⚠️  Cannot rollback table recreation - this would result in data loss');
    console.log('💡 To rollback, you would need to:');
    console.log('   1. Backup current data');
    console.log('   2. Drop table');
    console.log('   3. Recreate with ENUM status');
    console.log('   4. Restore data');
    console.log('🚫 Rollback not implemented for safety reasons');
    
    throw new Error('Rollback not implemented - would cause data loss');
  }
};