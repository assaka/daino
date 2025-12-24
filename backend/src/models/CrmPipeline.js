/**
 * CrmPipeline - Pure service class (NO SEQUELIZE)
 *
 * Manages CRM sales pipelines and stages.
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const CrmPipeline = {};

/**
 * Create a new pipeline
 */
CrmPipeline.create = async function(storeId, pipelineData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newPipeline = {
      id: uuidv4(),
      store_id: storeId,
      name: pipelineData.name,
      description: pipelineData.description || null,
      is_default: pipelineData.isDefault || false,
      is_active: pipelineData.isActive !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('crm_pipelines')
      .insert(newPipeline)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Find pipeline by ID
 */
CrmPipeline.findById = async function(storeId, pipelineId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_pipelines')
      .select(`
        *,
        crm_pipeline_stages (
          id,
          name,
          color,
          order_position,
          is_won,
          is_lost
        )
      `)
      .eq('id', pipelineId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * List all pipelines for a store
 */
CrmPipeline.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_pipelines')
      .select(`
        *,
        crm_pipeline_stages (
          id,
          name,
          color,
          order_position,
          is_won,
          is_lost
        )
      `)
      .eq('store_id', storeId);

    if (options.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    query = query.order('created_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Update a pipeline
 */
CrmPipeline.update = async function(storeId, pipelineId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.isDefault !== undefined) updates.is_default = updateData.isDefault;
    if (updateData.isActive !== undefined) updates.is_active = updateData.isActive;

    const { data, error } = await tenantDb
      .from('crm_pipelines')
      .update(updates)
      .eq('id', pipelineId)
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
 * Delete a pipeline
 */
CrmPipeline.delete = async function(storeId, pipelineId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Delete stages first
    await tenantDb
      .from('crm_pipeline_stages')
      .delete()
      .eq('pipeline_id', pipelineId);

    const { error } = await tenantDb
      .from('crm_pipelines')
      .delete()
      .eq('id', pipelineId)
      .eq('store_id', storeId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Get default pipeline
 */
CrmPipeline.getDefault = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_pipelines')
      .select(`
        *,
        crm_pipeline_stages (
          id,
          name,
          color,
          order_position,
          is_won,
          is_lost
        )
      `)
      .eq('store_id', storeId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Set default pipeline
 */
CrmPipeline.setDefault = async function(storeId, pipelineId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Unset all other defaults
    await tenantDb
      .from('crm_pipelines')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('store_id', storeId);

    // Set new default
    const { data, error } = await tenantDb
      .from('crm_pipelines')
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq('id', pipelineId)
      .eq('store_id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

// ============================================
// Pipeline Stages
// ============================================

/**
 * Create a stage in a pipeline
 */
CrmPipeline.createStage = async function(storeId, pipelineId, stageData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newStage = {
      id: uuidv4(),
      pipeline_id: pipelineId,
      name: stageData.name,
      color: stageData.color || '#6366f1',
      order_position: stageData.orderPosition || 0,
      is_won: stageData.isWon || false,
      is_lost: stageData.isLost || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('crm_pipeline_stages')
      .insert(newStage)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Update a stage
 */
CrmPipeline.updateStage = async function(storeId, stageId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.color !== undefined) updates.color = updateData.color;
    if (updateData.orderPosition !== undefined) updates.order_position = updateData.orderPosition;
    if (updateData.isWon !== undefined) updates.is_won = updateData.isWon;
    if (updateData.isLost !== undefined) updates.is_lost = updateData.isLost;

    const { data, error } = await tenantDb
      .from('crm_pipeline_stages')
      .update(updates)
      .eq('id', stageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a stage
 */
CrmPipeline.deleteStage = async function(storeId, stageId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('crm_pipeline_stages')
      .delete()
      .eq('id', stageId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Reorder stages
 */
CrmPipeline.reorderStages = async function(storeId, pipelineId, stageOrder) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    for (let i = 0; i < stageOrder.length; i++) {
      await tenantDb
        .from('crm_pipeline_stages')
        .update({
          order_position: i,
          updated_at: new Date().toISOString()
        })
        .eq('id', stageOrder[i])
        .eq('pipeline_id', pipelineId);
    }

    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Create default pipeline with stages
 */
CrmPipeline.createDefaultPipeline = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Create pipeline
    const pipelineId = uuidv4();
    const { data: pipeline, error: pipelineError } = await tenantDb
      .from('crm_pipelines')
      .insert({
        id: pipelineId,
        store_id: storeId,
        name: 'Sales Pipeline',
        description: 'Default sales pipeline',
        is_default: true,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (pipelineError) throw pipelineError;

    // Create default stages
    const defaultStages = [
      { name: 'Lead', color: '#6366f1', orderPosition: 0 },
      { name: 'Qualified', color: '#8b5cf6', orderPosition: 1 },
      { name: 'Proposal', color: '#a855f7', orderPosition: 2 },
      { name: 'Negotiation', color: '#f59e0b', orderPosition: 3 },
      { name: 'Won', color: '#10b981', orderPosition: 4, isWon: true },
      { name: 'Lost', color: '#ef4444', orderPosition: 5, isLost: true }
    ];

    const stages = defaultStages.map(stage => ({
      id: uuidv4(),
      pipeline_id: pipelineId,
      name: stage.name,
      color: stage.color,
      order_position: stage.orderPosition,
      is_won: stage.isWon || false,
      is_lost: stage.isLost || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error: stagesError } = await tenantDb
      .from('crm_pipeline_stages')
      .insert(stages);

    if (stagesError) throw stagesError;

    return pipeline;
  } catch (error) {
    throw error;
  }
};

module.exports = CrmPipeline;
