/**
 * MarketingSyncLog - Pure service class (NO SEQUELIZE)
 *
 * Tracks sync operations with third-party marketing platforms.
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const MarketingSyncLog = {};

/**
 * Create a sync log entry
 */
MarketingSyncLog.create = async function(storeId, logData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newLog = {
      id: uuidv4(),
      store_id: storeId,
      integration_type: logData.integrationType,
      sync_type: logData.syncType,
      status: logData.status || 'started',
      records_synced: logData.recordsSynced || 0,
      records_failed: logData.recordsFailed || 0,
      error_message: logData.errorMessage || null,
      metadata: logData.metadata || {},
      started_at: new Date().toISOString(),
      completed_at: null
    };

    const { data, error } = await tenantDb
      .from('marketing_sync_logs')
      .insert(newLog)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Update sync log status
 */
MarketingSyncLog.update = async function(storeId, logId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {};

    if (updateData.status !== undefined) updates.status = updateData.status;
    if (updateData.recordsSynced !== undefined) updates.records_synced = updateData.recordsSynced;
    if (updateData.recordsFailed !== undefined) updates.records_failed = updateData.recordsFailed;
    if (updateData.errorMessage !== undefined) updates.error_message = updateData.errorMessage;
    if (updateData.metadata !== undefined) updates.metadata = updateData.metadata;

    if (updateData.status === 'completed' || updateData.status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    const { data, error } = await tenantDb
      .from('marketing_sync_logs')
      .update(updates)
      .eq('id', logId)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Complete a sync log
 */
MarketingSyncLog.complete = async function(storeId, logId, stats = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('marketing_sync_logs')
      .update({
        status: 'completed',
        records_synced: stats.recordsSynced || 0,
        records_failed: stats.recordsFailed || 0,
        completed_at: new Date().toISOString()
      })
      .eq('id', logId)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Mark sync as failed
 */
MarketingSyncLog.fail = async function(storeId, logId, errorMessage) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('marketing_sync_logs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', logId)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get sync logs for a store
 */
MarketingSyncLog.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('marketing_sync_logs')
      .select('*')
      .eq('store_id', storeId);

    if (options.integrationType) {
      query = query.eq('integration_type', options.integrationType);
    }

    if (options.syncType) {
      query = query.eq('sync_type', options.syncType);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    query = query.order('started_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get the last sync for an integration type
 */
MarketingSyncLog.getLastSync = async function(storeId, integrationType, syncType = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('marketing_sync_logs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', integrationType)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);

    if (syncType) {
      query = query.eq('sync_type', syncType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Get sync statistics
 */
MarketingSyncLog.getStatistics = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('marketing_sync_logs')
      .select('status, integration_type, records_synced, records_failed')
      .eq('store_id', storeId);

    if (options.integrationType) {
      query = query.eq('integration_type', options.integrationType);
    }

    // Filter by date range if provided
    if (options.startDate) {
      query = query.gte('started_at', options.startDate);
    }
    if (options.endDate) {
      query = query.lte('started_at', options.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    const logs = data || [];
    const stats = {
      totalSyncs: logs.length,
      completed: 0,
      failed: 0,
      inProgress: 0,
      totalRecordsSynced: 0,
      totalRecordsFailed: 0,
      byIntegration: {}
    };

    logs.forEach(log => {
      // Count by status
      if (log.status === 'completed') stats.completed++;
      else if (log.status === 'failed') stats.failed++;
      else if (log.status === 'started' || log.status === 'in_progress') stats.inProgress++;

      // Sum records
      stats.totalRecordsSynced += log.records_synced || 0;
      stats.totalRecordsFailed += log.records_failed || 0;

      // Group by integration
      const integration = log.integration_type;
      if (!stats.byIntegration[integration]) {
        stats.byIntegration[integration] = { syncs: 0, recordsSynced: 0, recordsFailed: 0 };
      }
      stats.byIntegration[integration].syncs++;
      stats.byIntegration[integration].recordsSynced += log.records_synced || 0;
      stats.byIntegration[integration].recordsFailed += log.records_failed || 0;
    });

    return stats;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete old sync logs
 */
MarketingSyncLog.deleteOld = async function(storeId, daysToKeep = 30) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { error } = await tenantDb
      .from('marketing_sync_logs')
      .delete()
      .eq('store_id', storeId)
      .lt('started_at', cutoffDate.toISOString());

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

module.exports = MarketingSyncLog;
