/**
 * STUB CONNECTION - For model definitions only
 *
 * This connection exists to allow Sequelize models to be defined for:
 * - Type definitions and schema structure
 * - Association setup between models
 *
 * DO NOT USE FOR ACTUAL DATABASE QUERIES.
 * All database queries MUST go through:
 * - Master DB: use masterDbClient from masterConnection.js
 * - Tenant DB: use ConnectionManager.getStoreConnection(storeId)
 *
 * See MASTER_TENANT_DATABASE_ARCHITECTURE.md for guidance.
 */

const { Sequelize } = require('sequelize');

// Create a functional in-memory SQLite database for model definitions
// This allows models to be defined and associations to be set up
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: ':memory:',
  logging: false,
  define: {
    timestamps: true,
    underscored: false
  }
});

// Wrap query methods to warn but not throw
// This prevents crashes while making it clear this shouldn't be used
const wrapWithWarning = (methodName, originalMethod) => {
  return function(...args) {
    console.warn(
      `⚠️ WARNING: sequelize.${methodName}() called on stub connection.\n` +
      '   This should NOT be used for production queries.\n' +
      '   Use masterDbClient (master DB) or ConnectionManager.getStoreConnection() (tenant DB)'
    );
    // Return empty/no-op results instead of throwing
    if (methodName === 'query') {
      return Promise.resolve([[], { rowCount: 0 }]);
    }
    if (methodName === 'authenticate') {
      return Promise.resolve();
    }
    if (methodName === 'sync') {
      return Promise.resolve();
    }
    // For other methods, try to call original if it exists
    if (originalMethod) {
      return originalMethod.apply(this, args);
    }
    return Promise.resolve();
  };
};

// Store original methods and wrap them
const originalQuery = sequelize.query.bind(sequelize);
const originalAuthenticate = sequelize.authenticate.bind(sequelize);
const originalSync = sequelize.sync.bind(sequelize);

sequelize.query = wrapWithWarning('query', originalQuery);
sequelize.authenticate = wrapWithWarning('authenticate', originalAuthenticate);
sequelize.sync = wrapWithWarning('sync', originalSync);

// Deprecated supabase export (should not be used)
const supabase = null;

module.exports = { sequelize, supabase };
