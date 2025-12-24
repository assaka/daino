/**
 * CrmLead - Pure service class (NO SEQUELIZE)
 *
 * Manages CRM leads (potential customers).
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const CrmLead = {};

/**
 * Create a new lead
 */
CrmLead.create = async function(storeId, leadData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newLead = {
      id: uuidv4(),
      store_id: storeId,
      email: leadData.email,
      first_name: leadData.firstName || null,
      last_name: leadData.lastName || null,
      company: leadData.company || null,
      phone: leadData.phone || null,
      website: leadData.website || null,
      source: leadData.source || null,
      status: leadData.status || 'new',
      score: leadData.score || 0,
      owner_id: leadData.ownerId || null,
      notes: leadData.notes || null,
      custom_fields: leadData.customFields || {},
      tags: leadData.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('crm_leads')
      .insert(newLead)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Find lead by ID
 */
CrmLead.findById = async function(storeId, leadId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Find lead by email
 */
CrmLead.findByEmail = async function(storeId, email) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_leads')
      .select('*')
      .eq('store_id', storeId)
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * List all leads for a store
 */
CrmLead.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('crm_leads')
      .select('*')
      .eq('store_id', storeId);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.ownerId) {
      query = query.eq('owner_id', options.ownerId);
    }

    if (options.source) {
      query = query.eq('source', options.source);
    }

    if (options.minScore !== undefined) {
      query = query.gte('score', options.minScore);
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
 * Update a lead
 */
CrmLead.update = async function(storeId, leadId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (updateData.email !== undefined) updates.email = updateData.email;
    if (updateData.firstName !== undefined) updates.first_name = updateData.firstName;
    if (updateData.lastName !== undefined) updates.last_name = updateData.lastName;
    if (updateData.company !== undefined) updates.company = updateData.company;
    if (updateData.phone !== undefined) updates.phone = updateData.phone;
    if (updateData.website !== undefined) updates.website = updateData.website;
    if (updateData.source !== undefined) updates.source = updateData.source;
    if (updateData.status !== undefined) updates.status = updateData.status;
    if (updateData.score !== undefined) updates.score = updateData.score;
    if (updateData.ownerId !== undefined) updates.owner_id = updateData.ownerId;
    if (updateData.notes !== undefined) updates.notes = updateData.notes;
    if (updateData.customFields !== undefined) updates.custom_fields = updateData.customFields;
    if (updateData.tags !== undefined) updates.tags = updateData.tags;

    const { data, error } = await tenantDb
      .from('crm_leads')
      .update(updates)
      .eq('id', leadId)
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
 * Delete a lead
 */
CrmLead.delete = async function(storeId, leadId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('crm_leads')
      .delete()
      .eq('id', leadId)
      .eq('store_id', storeId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Update lead status
 */
CrmLead.updateStatus = async function(storeId, leadId, status) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'qualified') {
      updates.qualified_at = new Date().toISOString();
    } else if (status === 'converted') {
      updates.converted_at = new Date().toISOString();
    }

    const { data, error } = await tenantDb
      .from('crm_leads')
      .update(updates)
      .eq('id', leadId)
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
 * Update lead score
 */
CrmLead.updateScore = async function(storeId, leadId, score) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_leads')
      .update({
        score,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
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
 * Increment lead score
 */
CrmLead.incrementScore = async function(storeId, leadId, amount) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get current score
    const { data: lead } = await tenantDb
      .from('crm_leads')
      .select('score')
      .eq('id', leadId)
      .eq('store_id', storeId)
      .single();

    const newScore = (lead?.score || 0) + amount;

    const { data, error } = await tenantDb
      .from('crm_leads')
      .update({
        score: newScore,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
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
 * Convert lead to customer
 */
CrmLead.convertToCustomer = async function(storeId, leadId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get lead data
    const { data: lead, error: leadError } = await tenantDb
      .from('crm_leads')
      .select('*')
      .eq('id', leadId)
      .eq('store_id', storeId)
      .single();

    if (leadError) throw leadError;
    if (!lead) throw new Error('Lead not found');

    // Check if customer already exists
    const { data: existingCustomer } = await tenantDb
      .from('customers')
      .select('id')
      .eq('store_id', storeId)
      .eq('email', lead.email)
      .maybeSingle();

    let customerId;

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await tenantDb
        .from('customers')
        .insert({
          id: uuidv4(),
          store_id: storeId,
          email: lead.email,
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone: lead.phone,
          customer_type: 'registered',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (customerError) throw customerError;
      customerId = newCustomer.id;
    }

    // Update lead status
    await tenantDb
      .from('crm_leads')
      .update({
        status: 'converted',
        converted_at: new Date().toISOString(),
        customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId)
      .eq('store_id', storeId);

    return { leadId, customerId };
  } catch (error) {
    throw error;
  }
};

/**
 * Get lead statistics
 */
CrmLead.getStatistics = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('crm_leads')
      .select('status, source, score')
      .eq('store_id', storeId);

    if (error) throw error;

    const leads = data || [];
    const stats = {
      total: leads.length,
      byStatus: {},
      bySource: {},
      avgScore: 0
    };

    let totalScore = 0;
    leads.forEach(lead => {
      // Count by status
      const status = lead.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Count by source
      const source = lead.source || 'unknown';
      stats.bySource[source] = (stats.bySource[source] || 0) + 1;

      // Sum scores
      totalScore += lead.score || 0;
    });

    stats.avgScore = leads.length > 0 ? totalScore / leads.length : 0;

    return stats;
  } catch (error) {
    throw error;
  }
};

/**
 * Bulk import leads
 */
CrmLead.bulkCreate = async function(storeId, leadsData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const leads = leadsData.map(lead => ({
      id: uuidv4(),
      store_id: storeId,
      email: lead.email,
      first_name: lead.firstName || null,
      last_name: lead.lastName || null,
      company: lead.company || null,
      phone: lead.phone || null,
      website: lead.website || null,
      source: lead.source || 'import',
      status: lead.status || 'new',
      score: lead.score || 0,
      notes: lead.notes || null,
      custom_fields: lead.customFields || {},
      tags: lead.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await tenantDb
      .from('crm_leads')
      .insert(leads)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

module.exports = CrmLead;
