/**
 * StoreHostname Model (Master Database)
 *
 * Maps hostnames/domains to stores for fast tenant resolution
 * Enables hostname-based routing: myshop.daino.com → store_id
 */

const { DataTypes } = require('sequelize');
const { masterSequelize } = require('../../database/masterConnection');

const StoreHostname = masterSequelize.define('StoreHostname', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  store_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'stores',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  hostname: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    comment: 'Full hostname: myshop.dainostore.com or custom.dainostore.com',
    validate: {
      isValidHostname(value) {
        // Basic hostname validation
        const hostnameRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
        if (!hostnameRegex.test(value)) {
          throw new Error('Invalid hostname format');
        }
      }
    }
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'Store slug extracted from hostname',
    validate: {
      is: /^[a-z0-9-]+$/i
    }
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Primary hostname for the store'
  },
  is_custom_domain: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'True if custom domain, false if daino subdomain'
  },
  ssl_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'store_hostnames',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['hostname']
    },
    {
      fields: ['store_id']
    },
    {
      fields: ['slug']
    },
    {
      fields: ['store_id', 'is_primary'],
      where: {
        is_primary: true
      }
    }
  ]
});

// Instance Methods

/**
 * Set as primary hostname
 * @returns {Promise<void>}
 */
StoreHostname.prototype.setPrimary = async function() {
  // Unset other primary hostnames for this store
  await StoreHostname.update(
    { is_primary: false },
    { where: { store_id: this.store_id, id: { [require('sequelize').Op.ne]: this.id } } }
  );

  this.is_primary = true;
  await this.save();
};

/**
 * Enable SSL
 * @returns {Promise<void>}
 */
StoreHostname.prototype.enableSSL = async function() {
  this.ssl_enabled = true;
  await this.save();
};

/**
 * Disable SSL
 * @returns {Promise<void>}
 */
StoreHostname.prototype.disableSSL = async function() {
  this.ssl_enabled = false;
  await this.save();
};

// Class Methods

/**
 * Find store by hostname
 * @param {string} hostname - Full hostname
 * @returns {Promise<StoreHostname|null>}
 */
StoreHostname.findByHostname = async function(hostname) {
  return this.findOne({
    where: { hostname: hostname.toLowerCase() }
  });
};

/**
 * Find all hostnames for a store
 * @param {string} storeId - Store UUID
 * @returns {Promise<StoreHostname[]>}
 */
StoreHostname.findByStore = async function(storeId) {
  return this.findAll({
    where: { store_id: storeId },
    order: [
      ['is_primary', 'DESC'],
      ['created_at', 'ASC']
    ]
  });
};

/**
 * Find primary hostname for store
 * @param {string} storeId - Store UUID
 * @returns {Promise<StoreHostname|null>}
 */
StoreHostname.findPrimaryByStore = async function(storeId) {
  return this.findOne({
    where: {
      store_id: storeId,
      is_primary: true
    }
  });
};

/**
 * Create hostname mapping
 * @param {string} storeId - Store UUID
 * @param {string} hostname - Full hostname
 * @param {string} slug - Store slug
 * @param {Object} options - Additional options
 * @returns {Promise<StoreHostname>}
 */
StoreHostname.createMapping = async function(storeId, hostname, slug, options = {}) {
  return this.create({
    store_id: storeId,
    hostname: hostname.toLowerCase(),
    slug: slug.toLowerCase(),
    is_primary: options.isPrimary !== undefined ? options.isPrimary : true,
    is_custom_domain: options.isCustomDomain || false,
    ssl_enabled: options.sslEnabled !== undefined ? options.sslEnabled : true
  });
};

/**
 * Extract slug from hostname
 * @param {string} hostname - Full hostname
 * @returns {string} Extracted slug
 */
StoreHostname.extractSlug = function(hostname) {
  // Extract subdomain from hostname
  // myshop.dainostore.com → myshop
  // www.custom.com → custom
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts[0] === 'www' ? parts[1] : parts[0];
  }
  return hostname;
};

module.exports = StoreHostname;
