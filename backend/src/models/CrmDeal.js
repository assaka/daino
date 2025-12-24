/**
 * CrmDeal - Pure service class (NO SEQUELIZE)
 *
 * Manages CRM deals (sales opportunities).
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const CrmDeal = {};

/**
 * Create a new deal
 */
CrmDeal.create = async function(storeId, dealData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newDeal = {
      id: uuidv4(),
      store_id: storeId,
      pipeline_id: dealData.pipelineId,
      stage_id: dealData.stageId,
      customer_id: dealData.customerId || null,
      lead_id: dealData.leadId || null,
      name: dealData.name,
      value: dealData.value || 0,
      currency: dealData.currency || 'EUR',
      probability: dealData.probability || 0,
      expected_close_date: dealData.expectedCloseDate || null,
      status: 'open',
      owner_id: dealData.ownerId || null,
      source: dealData.source || null,
      notes: dealData.notes || null,
      custom_fields: dealData.customFields || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('crm_deals')
      .insert(newDeal)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Find deal by ID
 */
CrmDeal.findById = async function(storeId, dealId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_deals')
      .select(`
        *,
        crm_pipelines (id, name),
        crm_pipeline_stages (id, name, color, is_won, is_lost),
        customers (id, email, first_name, last_name),
        crm_leads (id, email, first_name, last_name)
      `)
      .eq('id', dealId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * List all deals for a store
 */
CrmDeal.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_deals')
      .select(`
        *,
        crm_pipelines (id, name),
        crm_pipeline_stages (id, name, color, is_won, is_lost),
        customers (id, email, first_name, last_name),
        crm_leads (id, email, first_name, last_name)
      `)
      .eq('store_id', storeId);

    if (options.pipelineId) {
      query = query.eq('pipeline_id', options.pipelineId);
    }

    if (options.stageId) {
      query = query.eq('stage_id', options.stageId);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.ownerId) {
      query = query.eq('owner_id', options.ownerId);
    }

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    query = query.order('created_at', { ascending: false });

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
 * Get deals by pipeline (for Kanban view)
 */
CrmDeal.findByPipeline = async function(storeId, pipelineId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_deals')
      .select(`
        *,
        crm_pipeline_stages (id, name, color, order_position, is_won, is_lost),
        customers (id, email, first_name, last_name),
        crm_leads (id, email, first_name, last_name)
      `)
      .eq('store_id', storeId)
      .eq('pipeline_id', pipelineId)
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Update a deal
 */
CrmDeal.update = async function(storeId, dealId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (updateData.pipelineId !== undefined) updates.pipeline_id = updateData.pipelineId;
    if (updateData.stageId !== undefined) updates.stage_id = updateData.stageId;
    if (updateData.customerId !== undefined) updates.customer_id = updateData.customerId;
    if (updateData.leadId !== undefined) updates.lead_id = updateData.leadId;
    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.value !== undefined) updates.value = updateData.value;
    if (updateData.currency !== undefined) updates.currency = updateData.currency;
    if (updateData.probability !== undefined) updates.probability = updateData.probability;
    if (updateData.expectedCloseDate !== undefined) updates.expected_close_date = updateData.expectedCloseDate;
    if (updateData.status !== undefined) updates.status = updateData.status;
    if (updateData.ownerId !== undefined) updates.owner_id = updateData.ownerId;
    if (updateData.source !== undefined) updates.source = updateData.source;
    if (updateData.notes !== undefined) updates.notes = updateData.notes;
    if (updateData.customFields !== undefined) updates.custom_fields = updateData.customFields;

    const { data, error } = await tenantDb
      .from('crm_deals')
      .update(updates)
      .eq('id', dealId)
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
 * Move deal to a different stage
 */
CrmDeal.moveToStage = async function(storeId, dealId, stageId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get stage info to check if it's won/lost
    const { data: stage } = await tenantDb
      .from('crm_pipeline_stages')
      .select('is_won, is_lost')
      .eq('id', stageId)
      .single();

    const updates = {
      stage_id: stageId,
      updated_at: new Date().toISOString()
    };

    if (stage?.is_won) {
      updates.status = 'won';
      updates.closed_at = new Date().toISOString();
    } else if (stage?.is_lost) {
      updates.status = 'lost';
      updates.closed_at = new Date().toISOString();
    }

    const { data, error } = await tenantDb
      .from('crm_deals')
      .update(updates)
      .eq('id', dealId)
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
 * Delete a deal
 */
CrmDeal.delete = async function(storeId, dealId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('crm_deals')
      .delete()
      .eq('id', dealId)
      .eq('store_id', storeId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Get deal statistics
 */
CrmDeal.getStatistics = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_deals')
      .select('status, value')
      .eq('store_id', storeId);

    if (options.pipelineId) {
      query = query.eq('pipeline_id', options.pipelineId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const deals = data || [];
    const stats = {
      totalDeals: deals.length,
      openDeals: 0,
      wonDeals: 0,
      lostDeals: 0,
      totalValue: 0,
      wonValue: 0,
      avgDealValue: 0
    };

    deals.forEach(deal => {
      const value = parseFloat(deal.value) || 0;
      stats.totalValue += value;

      if (deal.status === 'open') {
        stats.openDeals++;
      } else if (deal.status === 'won') {
        stats.wonDeals++;
        stats.wonValue += value;
      } else if (deal.status === 'lost') {
        stats.lostDeals++;
      }
    });

    stats.avgDealValue = stats.totalDeals > 0 ? stats.totalValue / stats.totalDeals : 0;
    stats.winRate = (stats.wonDeals + stats.lostDeals) > 0
      ? (stats.wonDeals / (stats.wonDeals + stats.lostDeals) * 100)
      : 0;

    return stats;
  } catch (error) {
    throw error;
  }
};

/**
 * Get deals by stage (for pipeline view)
 */
CrmDeal.getByStages = async function(storeId, pipelineId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get all stages for the pipeline
    const { data: stages } = await tenantDb
      .from('crm_pipeline_stages')
      .select('id, name, color, order_position, is_won, is_lost')
      .eq('pipeline_id', pipelineId)
      .order('order_position', { ascending: true });

    // Get all open deals for the pipeline
    const { data: deals } = await tenantDb
      .from('crm_deals')
      .select(`
        *,
        customers (id, email, first_name, last_name),
        crm_leads (id, email, first_name, last_name)
      `)
      .eq('store_id', storeId)
      .eq('pipeline_id', pipelineId)
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    // Group deals by stage
    const dealsByStage = {};
    (stages || []).forEach(stage => {
      dealsByStage[stage.id] = {
        stage,
        deals: []
      };
    });

    (deals || []).forEach(deal => {
      if (dealsByStage[deal.stage_id]) {
        dealsByStage[deal.stage_id].deals.push(deal);
      }
    });

    return {
      stages: stages || [],
      dealsByStage
    };
  } catch (error) {
    throw error;
  }
};

module.exports = CrmDeal;
