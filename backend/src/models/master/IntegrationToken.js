/**
 * IntegrationToken Model (Master Database)
 *
 * Tracks OAuth token expiry across all tenant stores.
 * Used by the token refresh cron job to efficiently find and refresh expiring tokens.
 */

const { DataTypes, Op } = require('sequelize');
const { masterSequelize } = require('../../database/masterConnection');

const IntegrationToken = masterSequelize.define('IntegrationToken', {
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
  integration_type: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  config_key: {
    type: DataTypes.STRING(100),
    defaultValue: 'default'
  },
  token_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refresh_token_expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_refresh_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_refresh_error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'expiring', 'expired', 'revoked', 'refresh_failed'),
    defaultValue: 'active'
  },
  consecutive_failures: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  max_failures: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  }
}, {
  tableName: 'integration_tokens',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['store_id'] },
    { fields: ['integration_type'] },
    { fields: ['status'] },
    { fields: ['token_expires_at'] }
  ]
});

// ============================================
// Class Methods
// ============================================

/**
 * Find tokens that need refresh (expiring within the specified buffer)
 * @param {number} bufferMinutes - Minutes before expiry to consider for refresh (default: 60)
 * @returns {Promise<IntegrationToken[]>}
 */
IntegrationToken.findExpiringTokens = async function(bufferMinutes = 60) {
  const bufferTime = new Date(Date.now() + bufferMinutes * 60 * 1000);

  return this.findAll({
    where: {
      status: {
        [Op.in]: ['active', 'expiring']
      },
      token_expires_at: {
        [Op.lte]: bufferTime,
        [Op.ne]: null
      },
      consecutive_failures: {
        [Op.lt]: masterSequelize.col('max_failures')
      }
    },
    order: [['token_expires_at', 'ASC']]
  });
};

/**
 * Upsert token tracking record
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type (e.g., 'supabase-oauth')
 * @param {Object} tokenData - Token data to upsert
 * @param {string} configKey - Config key (default: 'default')
 * @returns {Promise<Object>}
 */
IntegrationToken.upsertToken = async function(storeId, integrationType, tokenData, configKey = 'default') {
  // Use Supabase client directly instead of Sequelize for reliability
  const { masterDbClient } = require('../../database/masterConnection');
  const { v4: uuidv4 } = require('uuid');

  const tokenExpiresAt = tokenData.token_expires_at || tokenData.expiresAt;

  console.log('[IntegrationToken.upsertToken] Upserting token:', {
    storeId,
    integrationType,
    configKey,
    tokenExpiresAt
  });

  const { data, error } = await masterDbClient
    .from('integration_tokens')
    .upsert({
      id: uuidv4(),
      store_id: storeId,
      integration_type: integrationType,
      config_key: configKey,
      token_expires_at: tokenExpiresAt,
      refresh_token_expires_at: tokenData.refresh_token_expires_at || null,
      status: 'active',
      consecutive_failures: 0,
      last_refresh_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'store_id,integration_type,config_key',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (error) {
    console.error('[IntegrationToken.upsertToken] Error:', error.message);
    throw new Error(`Failed to upsert integration token: ${error.message}`);
  }

  console.log('[IntegrationToken.upsertToken] Success:', data?.id);
  return data;
};

/**
 * Record successful refresh
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type
 * @param {Date} newExpiresAt - New token expiry time
 * @param {string} configKey - Config key
 */
IntegrationToken.recordRefreshSuccess = async function(storeId, integrationType, newExpiresAt, configKey = 'default') {
  await this.update({
    token_expires_at: newExpiresAt,
    last_refresh_at: new Date(),
    status: 'active',
    consecutive_failures: 0,
    last_refresh_error: null
  }, {
    where: {
      store_id: storeId,
      integration_type: integrationType,
      config_key: configKey
    }
  });
};

/**
 * Record refresh failure
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type
 * @param {string} error - Error message
 * @param {string} configKey - Config key
 */
IntegrationToken.recordRefreshFailure = async function(storeId, integrationType, error, configKey = 'default') {
  const token = await this.findOne({
    where: {
      store_id: storeId,
      integration_type: integrationType,
      config_key: configKey
    }
  });

  if (token) {
    const newFailures = token.consecutive_failures + 1;
    const newStatus = newFailures >= token.max_failures ? 'refresh_failed' : token.status;

    await token.update({
      consecutive_failures: newFailures,
      last_refresh_error: error,
      status: newStatus
    });
  }
};

/**
 * Mark token as revoked
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type
 * @param {string} configKey - Config key
 */
IntegrationToken.markAsRevoked = async function(storeId, integrationType, configKey = 'default') {
  await this.update({
    status: 'revoked',
    last_refresh_error: 'Authorization was revoked'
  }, {
    where: {
      store_id: storeId,
      integration_type: integrationType,
      config_key: configKey
    }
  });
};

/**
 * Delete token tracking record
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type
 * @param {string} configKey - Config key
 */
IntegrationToken.deleteToken = async function(storeId, integrationType, configKey = 'default') {
  await this.destroy({
    where: {
      store_id: storeId,
      integration_type: integrationType,
      config_key: configKey
    }
  });
};

/**
 * Get token status summary for a store
 * @param {string} storeId - Store UUID
 * @returns {Promise<Object[]>}
 */
IntegrationToken.getStoreTokenStatus = async function(storeId) {
  return this.findAll({
    where: { store_id: storeId },
    attributes: ['integration_type', 'config_key', 'status', 'token_expires_at', 'last_refresh_at', 'consecutive_failures']
  });
};

/**
 * Get overall token health stats
 * @returns {Promise<Object>}
 */
IntegrationToken.getHealthStats = async function() {
  const stats = await this.findAll({
    attributes: [
      'status',
      [masterSequelize.fn('COUNT', masterSequelize.col('id')), 'count']
    ],
    group: ['status'],
    raw: true
  });

  return stats.reduce((acc, stat) => {
    acc[stat.status] = parseInt(stat.count);
    return acc;
  }, {});
};

module.exports = IntegrationToken;
