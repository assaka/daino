/**
 * MasterStore Model (Master Database)
 *
 * Minimal store registry in master database
 * Contains ONLY: id, user_id, status, is_active, timestamps
 *
 * Full store data (name, slug, settings, etc.) is in tenant database
 */

const { DataTypes } = require('sequelize');
const { masterSequelize } = require('../../database/masterConnection');

const MasterStore = masterSequelize.define('Store', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.ENUM(
      'pending_database',  // Waiting for database connection
      'provisioning',      // Creating tenant database
      'active',           // Fully operational
      'suspended',        // Temporarily disabled
      'inactive'          // Permanently disabled
    ),
    defaultValue: 'pending_database',
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  theme_preset: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'default'
  }
}, {
  tableName: 'stores',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['is_active'],
      where: {
        is_active: true
      }
    }
  ]
});

// Instance Methods

/**
 * Activate store
 * @returns {Promise<void>}
 */
MasterStore.prototype.activate = async function() {
  this.status = 'active';
  this.is_active = true;
  await this.save();
};

/**
 * Suspend store
 * @param {string} reason - Reason for suspension
 * @returns {Promise<void>}
 */
MasterStore.prototype.suspend = async function(reason) {
  this.status = 'suspended';
  this.is_active = false;
  // TODO: Log suspension reason
  await this.save();
};

/**
 * Check if store is operational
 * @returns {boolean}
 */
MasterStore.prototype.isOperational = function() {
  return this.status === 'active' && this.is_active === true;
};

/**
 * Start provisioning
 * @returns {Promise<void>}
 */
MasterStore.prototype.startProvisioning = async function() {
  this.status = 'provisioning';
  await this.save();
};

/**
 * Complete provisioning and activate
 * @returns {Promise<void>}
 */
MasterStore.prototype.completeProvisioning = async function() {
  this.status = 'active';
  this.is_active = true;
  await this.save();
};

// Class Methods

/**
 * Find all stores by user
 * @param {string} userId - User UUID
 * @returns {Promise<MasterStore[]>}
 */
MasterStore.findByUser = async function(userId) {
  return this.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']]
  });
};

/**
 * Find active stores
 * @returns {Promise<MasterStore[]>}
 */
MasterStore.findActiveStores = async function() {
  return this.findAll({
    where: {
      status: 'active',
      is_active: true
    },
    order: [['created_at', 'DESC']]
  });
};

/**
 * Find stores by status
 * @param {string} status - Store status
 * @returns {Promise<MasterStore[]>}
 */
MasterStore.findByStatus = async function(status) {
  return this.findAll({
    where: { status },
    order: [['updated_at', 'DESC']]
  });
};

/**
 * Count stores by user
 * @param {string} userId - User UUID
 * @returns {Promise<number>}
 */
MasterStore.countByUser = async function(userId) {
  return this.count({ where: { user_id: userId } });
};

module.exports = MasterStore;
