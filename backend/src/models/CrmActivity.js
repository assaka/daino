/**
 * CrmActivity - Pure service class (NO SEQUELIZE)
 *
 * Manages CRM activities (calls, emails, notes, tasks, meetings).
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const CrmActivity = {};

/**
 * Create a new activity
 */
CrmActivity.create = async function(storeId, activityData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newActivity = {
      id: uuidv4(),
      store_id: storeId,
      deal_id: activityData.dealId || null,
      lead_id: activityData.leadId || null,
      customer_id: activityData.customerId || null,
      activity_type: activityData.activityType,
      subject: activityData.subject,
      description: activityData.description || null,
      due_date: activityData.dueDate || null,
      completed_at: activityData.completedAt || null,
      is_completed: activityData.isCompleted || false,
      owner_id: activityData.ownerId || null,
      metadata: activityData.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('crm_activities')
      .insert(newActivity)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Find activity by ID
 */
CrmActivity.findById = async function(storeId, activityId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_activities')
      .select(`
        *,
        crm_deals (id, name, value),
        crm_leads (id, email, first_name, last_name),
        customers (id, email, first_name, last_name)
      `)
      .eq('id', activityId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * List all activities for a store
 */
CrmActivity.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_activities')
      .select(`
        *,
        crm_deals (id, name, value),
        crm_leads (id, email, first_name, last_name),
        customers (id, email, first_name, last_name)
      `)
      .eq('store_id', storeId);

    if (options.dealId) {
      query = query.eq('deal_id', options.dealId);
    }

    if (options.leadId) {
      query = query.eq('lead_id', options.leadId);
    }

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options.activityType) {
      query = query.eq('activity_type', options.activityType);
    }

    if (options.isCompleted !== undefined) {
      query = query.eq('is_completed', options.isCompleted);
    }

    if (options.ownerId) {
      query = query.eq('owner_id', options.ownerId);
    }

    query = query.order('created_at', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Get activities for a deal
 */
CrmActivity.findByDeal = async function(storeId, dealId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_activities')
      .select('*')
      .eq('store_id', storeId)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

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
 * Get activities for a lead
 */
CrmActivity.findByLead = async function(storeId, leadId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_activities')
      .select('*')
      .eq('store_id', storeId)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

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
 * Get activities for a customer
 */
CrmActivity.findByCustomer = async function(storeId, customerId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_activities')
      .select('*')
      .eq('store_id', storeId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

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
 * Update an activity
 */
CrmActivity.update = async function(storeId, activityId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (updateData.dealId !== undefined) updates.deal_id = updateData.dealId;
    if (updateData.leadId !== undefined) updates.lead_id = updateData.leadId;
    if (updateData.customerId !== undefined) updates.customer_id = updateData.customerId;
    if (updateData.activityType !== undefined) updates.activity_type = updateData.activityType;
    if (updateData.subject !== undefined) updates.subject = updateData.subject;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.dueDate !== undefined) updates.due_date = updateData.dueDate;
    if (updateData.isCompleted !== undefined) updates.is_completed = updateData.isCompleted;
    if (updateData.completedAt !== undefined) updates.completed_at = updateData.completedAt;
    if (updateData.ownerId !== undefined) updates.owner_id = updateData.ownerId;
    if (updateData.metadata !== undefined) updates.metadata = updateData.metadata;

    const { data, error } = await tenantDb
      .from('crm_activities')
      .update(updates)
      .eq('id', activityId)
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
 * Mark activity as completed
 */
CrmActivity.markComplete = async function(storeId, activityId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_activities')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', activityId)
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
 * Mark activity as incomplete
 */
CrmActivity.markIncomplete = async function(storeId, activityId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_activities')
      .update({
        is_completed: false,
        completed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', activityId)
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
 * Delete an activity
 */
CrmActivity.delete = async function(storeId, activityId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('crm_activities')
      .delete()
      .eq('id', activityId)
      .eq('store_id', storeId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Get upcoming activities (tasks due soon)
 */
CrmActivity.getUpcoming = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const daysAhead = options.daysAhead || 7;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    let query = tenantDb
      .from('crm_activities')
      .select(`
        *,
        crm_deals (id, name),
        crm_leads (id, email, first_name, last_name),
        customers (id, email, first_name, last_name)
      `)
      .eq('store_id', storeId)
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .lte('due_date', futureDate.toISOString())
      .order('due_date', { ascending: true });

    if (options.ownerId) {
      query = query.eq('owner_id', options.ownerId);
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

/**
 * Get overdue activities
 */
CrmActivity.getOverdue = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_activities')
      .select(`
        *,
        crm_deals (id, name),
        crm_leads (id, email, first_name, last_name),
        customers (id, email, first_name, last_name)
      `)
      .eq('store_id', storeId)
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .lt('due_date', new Date().toISOString())
      .order('due_date', { ascending: true });

    if (options.ownerId) {
      query = query.eq('owner_id', options.ownerId);
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

/**
 * Get activity statistics
 */
CrmActivity.getStatistics = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_activities')
      .select('activity_type, is_completed, due_date')
      .eq('store_id', storeId);

    if (error) throw error;

    const activities = data || [];
    const now = new Date();
    const stats = {
      total: activities.length,
      completed: 0,
      pending: 0,
      overdue: 0,
      byType: {}
    };

    activities.forEach(activity => {
      // Count by type
      const type = activity.activity_type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count completed vs pending
      if (activity.is_completed) {
        stats.completed++;
      } else {
        stats.pending++;
        // Check if overdue
        if (activity.due_date && new Date(activity.due_date) < now) {
          stats.overdue++;
        }
      }
    });

    return stats;
  } catch (error) {
    throw error;
  }
};

module.exports = CrmActivity;
