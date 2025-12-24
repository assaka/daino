/**
 * AutomationWorkflow - Pure service class (NO SEQUELIZE)
 *
 * Manages marketing automation workflows.
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const AutomationWorkflow = {};

/**
 * Create a new automation workflow
 */
AutomationWorkflow.create = async function(storeId, workflowData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newWorkflow = {
      id: uuidv4(),
      store_id: storeId,
      name: workflowData.name,
      description: workflowData.description || null,
      trigger_type: workflowData.triggerType,
      trigger_config: workflowData.triggerConfig || {},
      steps: workflowData.steps || [],
      status: 'draft',
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('automation_workflows')
      .insert(newWorkflow)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Find workflow by ID
 */
AutomationWorkflow.findById = async function(storeId, workflowId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('automation_workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * List all workflows for a store
 */
AutomationWorkflow.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('automation_workflows')
      .select('*')
      .eq('store_id', storeId);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options.triggerType) {
      query = query.eq('trigger_type', options.triggerType);
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
 * Update a workflow
 */
AutomationWorkflow.update = async function(storeId, workflowId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.triggerType !== undefined) updates.trigger_type = updateData.triggerType;
    if (updateData.triggerConfig !== undefined) updates.trigger_config = updateData.triggerConfig;
    if (updateData.steps !== undefined) updates.steps = updateData.steps;
    if (updateData.status !== undefined) updates.status = updateData.status;
    if (updateData.isActive !== undefined) updates.is_active = updateData.isActive;

    const { data, error } = await tenantDb
      .from('automation_workflows')
      .update(updates)
      .eq('id', workflowId)
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
 * Delete a workflow
 */
AutomationWorkflow.delete = async function(storeId, workflowId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Delete related enrollments and logs first
    await tenantDb
      .from('automation_logs')
      .delete()
      .eq('workflow_id', workflowId);

    await tenantDb
      .from('automation_enrollments')
      .delete()
      .eq('workflow_id', workflowId);

    const { error } = await tenantDb
      .from('automation_workflows')
      .delete()
      .eq('id', workflowId)
      .eq('store_id', storeId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Activate a workflow
 */
AutomationWorkflow.activate = async function(storeId, workflowId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('automation_workflows')
      .update({
        status: 'active',
        is_active: true,
        activated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)
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
 * Pause a workflow
 */
AutomationWorkflow.pause = async function(storeId, workflowId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('automation_workflows')
      .update({
        status: 'paused',
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)
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
 * Update workflow stats
 */
AutomationWorkflow.updateStats = async function(storeId, workflowId, stats) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (stats.totalEnrolled !== undefined) updates.total_enrolled = stats.totalEnrolled;
    if (stats.totalCompleted !== undefined) updates.total_completed = stats.totalCompleted;
    if (stats.totalExited !== undefined) updates.total_exited = stats.totalExited;

    const { data, error } = await tenantDb
      .from('automation_workflows')
      .update(updates)
      .eq('id', workflowId)
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
 * Get active workflows by trigger type
 */
AutomationWorkflow.getActiveByTrigger = async function(storeId, triggerType) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('automation_workflows')
      .select('*')
      .eq('store_id', storeId)
      .eq('trigger_type', triggerType)
      .eq('is_active', true)
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Enroll a customer in a workflow
 */
AutomationWorkflow.enrollCustomer = async function(storeId, workflowId, customerId, triggerData = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const enrollment = {
      id: uuidv4(),
      workflow_id: workflowId,
      customer_id: customerId,
      status: 'active',
      current_step: 0,
      trigger_data: triggerData,
      enrolled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('automation_enrollments')
      .insert(enrollment)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get pending enrollments for processing
 */
AutomationWorkflow.getPendingEnrollments = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('automation_enrollments')
      .select(`
        *,
        automation_workflows (
          id,
          name,
          steps,
          trigger_type
        ),
        customers (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('status', 'active')
      .or('next_step_at.is.null,next_step_at.lte.' + new Date().toISOString());

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Update enrollment status
 */
AutomationWorkflow.updateEnrollment = async function(storeId, enrollmentId, updates) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updateData = {
      updated_at: new Date().toISOString(),
      ...updates
    };

    const { data, error } = await tenantDb
      .from('automation_enrollments')
      .update(updateData)
      .eq('id', enrollmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Log automation step execution
 */
AutomationWorkflow.logStep = async function(storeId, logData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const log = {
      id: uuidv4(),
      workflow_id: logData.workflowId,
      enrollment_id: logData.enrollmentId,
      customer_id: logData.customerId,
      step_index: logData.stepIndex,
      step_type: logData.stepType,
      status: logData.status,
      error_message: logData.errorMessage || null,
      metadata: logData.metadata || {},
      executed_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('automation_logs')
      .insert(log)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get workflow logs
 */
AutomationWorkflow.getLogs = async function(storeId, workflowId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('automation_logs')
      .select(`
        *,
        customers (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('workflow_id', workflowId)
      .order('executed_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

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

module.exports = AutomationWorkflow;
