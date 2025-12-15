/**
 * IntegrationToken Model (Master Database)
 *
 * Tracks OAuth token expiry across all tenant stores.
 * Used by the token refresh cron job to efficiently find and refresh expiring tokens.
 *
 * Uses Supabase client directly for all operations (not Sequelize).
 */

const { masterDbClient } = require('../../database/masterConnection');
const { v4: uuidv4 } = require('uuid');

// Create a simple object to hold static methods
const IntegrationToken = {};

// ============================================
// Class Methods
// ============================================

/**
 * Find tokens that need refresh (expiring within the specified buffer)
 * @param {number} bufferMinutes - Minutes before expiry to consider for refresh (default: 60)
 * @returns {Promise<Object[]>}
 */
IntegrationToken.findExpiringTokens = async function(bufferMinutes = 60) {
  const bufferTime = new Date(Date.now() + bufferMinutes * 60 * 1000);

  console.log('[IntegrationToken.findExpiringTokens] Looking for tokens expiring before:', bufferTime.toISOString());

  const { data, error } = await masterDbClient
    .from('integration_tokens')
    .select('*')
    .in('status', ['active', 'expiring'])
    .not('token_expires_at', 'is', null)
    .lte('token_expires_at', bufferTime.toISOString())
    .order('token_expires_at', { ascending: true });

  if (error) {
    console.error('[IntegrationToken.findExpiringTokens] Error:', error.message);
    throw new Error(`Failed to find expiring tokens: ${error.message}`);
  }

  // Filter by consecutive_failures < max_failures in JS since Supabase doesn't support column comparison
  const filtered = (data || []).filter(token => token.consecutive_failures < token.max_failures);

  console.log('[IntegrationToken.findExpiringTokens] Found:', filtered.length, 'tokens needing refresh');
  return filtered;
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
  console.log('[IntegrationToken.recordRefreshSuccess] Recording success for:', storeId, integrationType);

  const { error } = await masterDbClient
    .from('integration_tokens')
    .update({
      token_expires_at: newExpiresAt instanceof Date ? newExpiresAt.toISOString() : newExpiresAt,
      last_refresh_at: new Date().toISOString(),
      status: 'active',
      consecutive_failures: 0,
      last_refresh_error: null,
      updated_at: new Date().toISOString()
    })
    .eq('store_id', storeId)
    .eq('integration_type', integrationType)
    .eq('config_key', configKey);

  if (error) {
    console.error('[IntegrationToken.recordRefreshSuccess] Error:', error.message);
    throw new Error(`Failed to record refresh success: ${error.message}`);
  }

  console.log('[IntegrationToken.recordRefreshSuccess] Success');
};

/**
 * Record refresh failure
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type
 * @param {string} errorMsg - Error message
 * @param {string} configKey - Config key
 */
IntegrationToken.recordRefreshFailure = async function(storeId, integrationType, errorMsg, configKey = 'default') {
  console.log('[IntegrationToken.recordRefreshFailure] Recording failure for:', storeId, integrationType);

  // First get current token to check failures
  const { data: token, error: fetchError } = await masterDbClient
    .from('integration_tokens')
    .select('*')
    .eq('store_id', storeId)
    .eq('integration_type', integrationType)
    .eq('config_key', configKey)
    .single();

  if (fetchError) {
    console.error('[IntegrationToken.recordRefreshFailure] Fetch error:', fetchError.message);
    return;
  }

  if (token) {
    const newFailures = (token.consecutive_failures || 0) + 1;
    const newStatus = newFailures >= (token.max_failures || 5) ? 'refresh_failed' : token.status;

    const { error: updateError } = await masterDbClient
      .from('integration_tokens')
      .update({
        consecutive_failures: newFailures,
        last_refresh_error: errorMsg,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', token.id);

    if (updateError) {
      console.error('[IntegrationToken.recordRefreshFailure] Update error:', updateError.message);
    }
  }
};

/**
 * Mark token as revoked
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type
 * @param {string} configKey - Config key
 */
IntegrationToken.markAsRevoked = async function(storeId, integrationType, configKey = 'default') {
  console.log('[IntegrationToken.markAsRevoked] Marking as revoked:', storeId, integrationType);

  const { error } = await masterDbClient
    .from('integration_tokens')
    .update({
      status: 'revoked',
      last_refresh_error: 'Authorization was revoked',
      updated_at: new Date().toISOString()
    })
    .eq('store_id', storeId)
    .eq('integration_type', integrationType)
    .eq('config_key', configKey);

  if (error) {
    console.error('[IntegrationToken.markAsRevoked] Error:', error.message);
    throw new Error(`Failed to mark token as revoked: ${error.message}`);
  }
};

/**
 * Delete token tracking record
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type
 * @param {string} configKey - Config key
 */
IntegrationToken.deleteToken = async function(storeId, integrationType, configKey = 'default') {
  console.log('[IntegrationToken.deleteToken] Deleting token:', storeId, integrationType);

  const { error } = await masterDbClient
    .from('integration_tokens')
    .delete()
    .eq('store_id', storeId)
    .eq('integration_type', integrationType)
    .eq('config_key', configKey);

  if (error) {
    console.error('[IntegrationToken.deleteToken] Error:', error.message);
    throw new Error(`Failed to delete token: ${error.message}`);
  }
};

/**
 * Get token status summary for a store
 * @param {string} storeId - Store UUID
 * @returns {Promise<Object[]>}
 */
IntegrationToken.getStoreTokenStatus = async function(storeId) {
  const { data, error } = await masterDbClient
    .from('integration_tokens')
    .select('integration_type, config_key, status, token_expires_at, last_refresh_at, consecutive_failures')
    .eq('store_id', storeId);

  if (error) {
    console.error('[IntegrationToken.getStoreTokenStatus] Error:', error.message);
    throw new Error(`Failed to get store token status: ${error.message}`);
  }

  return data || [];
};

/**
 * Get overall token health stats
 * @returns {Promise<Object>}
 */
IntegrationToken.getHealthStats = async function() {
  const { data, error } = await masterDbClient
    .from('integration_tokens')
    .select('status');

  if (error) {
    console.error('[IntegrationToken.getHealthStats] Error:', error.message);
    throw new Error(`Failed to get health stats: ${error.message}`);
  }

  // Count by status in JS
  const stats = (data || []).reduce((acc, token) => {
    acc[token.status] = (acc[token.status] || 0) + 1;
    return acc;
  }, {});

  return stats;
};

/**
 * Find token by store and integration type
 * @param {string} storeId - Store UUID
 * @param {string} integrationType - Integration type
 * @param {string} configKey - Config key
 * @returns {Promise<Object|null>}
 */
IntegrationToken.findByStoreAndType = async function(storeId, integrationType, configKey = 'default') {
  const { data, error } = await masterDbClient
    .from('integration_tokens')
    .select('*')
    .eq('store_id', storeId)
    .eq('integration_type', integrationType)
    .eq('config_key', configKey)
    .maybeSingle();

  if (error) {
    console.error('[IntegrationToken.findByStoreAndType] Error:', error.message);
    return null;
  }

  return data;
};

module.exports = IntegrationToken;
