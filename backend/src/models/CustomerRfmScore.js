/**
 * CustomerRfmScore - Pure service class (NO SEQUELIZE)
 *
 * Manages RFM (Recency, Frequency, Monetary) scores for customers.
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const CustomerRfmScore = {};

/**
 * Create or update RFM score for a customer
 */
CustomerRfmScore.upsert = async function(storeId, customerId, scoreData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const rfmData = {
      id: uuidv4(),
      store_id: storeId,
      customer_id: customerId,
      recency_score: scoreData.recencyScore,
      frequency_score: scoreData.frequencyScore,
      monetary_score: scoreData.monetaryScore,
      rfm_score: scoreData.rfmScore || `${scoreData.recencyScore}${scoreData.frequencyScore}${scoreData.monetaryScore}`,
      rfm_segment: scoreData.rfmSegment || null,
      last_order_date: scoreData.lastOrderDate || null,
      order_count: scoreData.orderCount || 0,
      total_revenue: scoreData.totalRevenue || 0,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('customer_rfm_scores')
      .upsert(rfmData, { onConflict: 'store_id,customer_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get RFM score for a customer
 */
CustomerRfmScore.findByCustomerId = async function(storeId, customerId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('customer_rfm_scores')
      .select('*')
      .eq('store_id', storeId)
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all RFM scores for a store
 */
CustomerRfmScore.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('customer_rfm_scores')
      .select(`
        *,
        customers (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('store_id', storeId);

    if (options.segment) {
      query = query.eq('rfm_segment', options.segment);
    }

    if (options.minScore) {
      query = query.gte('rfm_score', options.minScore);
    }

    query = query.order('total_revenue', { ascending: false });

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
 * Get customers by RFM segment
 */
CustomerRfmScore.findBySegment = async function(storeId, segment) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('customer_rfm_scores')
      .select(`
        *,
        customers (
          id,
          email,
          first_name,
          last_name,
          total_spent,
          total_orders
        )
      `)
      .eq('store_id', storeId)
      .eq('rfm_segment', segment)
      .order('total_revenue', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get RFM segment distribution
 */
CustomerRfmScore.getSegmentDistribution = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('customer_rfm_scores')
      .select('rfm_segment')
      .eq('store_id', storeId);

    if (error) throw error;

    // Count by segment
    const distribution = {};
    (data || []).forEach(row => {
      const segment = row.rfm_segment || 'unclassified';
      distribution[segment] = (distribution[segment] || 0) + 1;
    });

    return distribution;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete RFM score for a customer
 */
CustomerRfmScore.delete = async function(storeId, customerId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('customer_rfm_scores')
      .delete()
      .eq('store_id', storeId)
      .eq('customer_id', customerId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Bulk upsert RFM scores
 */
CustomerRfmScore.bulkUpsert = async function(storeId, scores) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const rfmData = scores.map(score => ({
      id: uuidv4(),
      store_id: storeId,
      customer_id: score.customerId,
      recency_score: score.recencyScore,
      frequency_score: score.frequencyScore,
      monetary_score: score.monetaryScore,
      rfm_score: score.rfmScore || `${score.recencyScore}${score.frequencyScore}${score.monetaryScore}`,
      rfm_segment: score.rfmSegment || null,
      last_order_date: score.lastOrderDate || null,
      order_count: score.orderCount || 0,
      total_revenue: score.totalRevenue || 0,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await tenantDb
      .from('customer_rfm_scores')
      .upsert(rfmData, { onConflict: 'store_id,customer_id' });

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Get RFM statistics for a store
 */
CustomerRfmScore.getStatistics = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('customer_rfm_scores')
      .select('recency_score, frequency_score, monetary_score, total_revenue, order_count')
      .eq('store_id', storeId);

    if (error) throw error;

    const scores = data || [];
    if (scores.length === 0) {
      return {
        totalCustomers: 0,
        avgRecency: 0,
        avgFrequency: 0,
        avgMonetary: 0,
        totalRevenue: 0,
        avgOrderCount: 0
      };
    }

    const sum = (arr, key) => arr.reduce((acc, item) => acc + (parseFloat(item[key]) || 0), 0);
    const avg = (arr, key) => sum(arr, key) / arr.length;

    return {
      totalCustomers: scores.length,
      avgRecency: avg(scores, 'recency_score').toFixed(2),
      avgFrequency: avg(scores, 'frequency_score').toFixed(2),
      avgMonetary: avg(scores, 'monetary_score').toFixed(2),
      totalRevenue: sum(scores, 'total_revenue').toFixed(2),
      avgOrderCount: avg(scores, 'order_count').toFixed(2)
    };
  } catch (error) {
    throw error;
  }
};

module.exports = CustomerRfmScore;
