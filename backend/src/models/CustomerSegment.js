/**
 * CustomerSegment - Pure service class (NO SEQUELIZE)
 *
 * Manages customer segments for marketing and targeting.
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const CustomerSegment = {};

/**
 * Create a new customer segment
 */
CustomerSegment.create = async function(storeId, segmentData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newSegment = {
      id: uuidv4(),
      store_id: storeId,
      name: segmentData.name,
      description: segmentData.description || null,
      segment_type: segmentData.segmentType || 'dynamic',
      filters: segmentData.filters || {},
      is_active: segmentData.isActive !== false,
      member_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('customer_segments')
      .insert(newSegment)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Find segment by ID
 */
CustomerSegment.findById = async function(storeId, segmentId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('customer_segments')
      .select('*')
      .eq('id', segmentId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * List all segments for a store
 */
CustomerSegment.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('customer_segments')
      .select('*')
      .eq('store_id', storeId);

    if (options.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options.segmentType) {
      query = query.eq('segment_type', options.segmentType);
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
 * Update a segment
 */
CustomerSegment.update = async function(storeId, segmentId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (updateData.name !== undefined) updates.name = updateData.name;
    if (updateData.description !== undefined) updates.description = updateData.description;
    if (updateData.segmentType !== undefined) updates.segment_type = updateData.segmentType;
    if (updateData.filters !== undefined) updates.filters = updateData.filters;
    if (updateData.isActive !== undefined) updates.is_active = updateData.isActive;

    const { data, error } = await tenantDb
      .from('customer_segments')
      .update(updates)
      .eq('id', segmentId)
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
 * Delete a segment
 */
CustomerSegment.delete = async function(storeId, segmentId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // First delete segment members
    await tenantDb
      .from('customer_segment_members')
      .delete()
      .eq('segment_id', segmentId);

    // Then delete the segment
    const { error } = await tenantDb
      .from('customer_segments')
      .delete()
      .eq('id', segmentId)
      .eq('store_id', storeId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Update member count for a segment
 */
CustomerSegment.updateMemberCount = async function(storeId, segmentId, count) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('customer_segments')
      .update({
        member_count: count,
        last_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', segmentId)
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
 * Add customer to segment (for static segments)
 */
CustomerSegment.addMember = async function(storeId, segmentId, customerId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('customer_segment_members')
      .upsert({
        segment_id: segmentId,
        customer_id: customerId,
        added_at: new Date().toISOString()
      }, { onConflict: 'segment_id,customer_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Remove customer from segment
 */
CustomerSegment.removeMember = async function(storeId, segmentId, customerId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('customer_segment_members')
      .delete()
      .eq('segment_id', segmentId)
      .eq('customer_id', customerId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Get segment members
 */
CustomerSegment.getMembers = async function(storeId, segmentId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('customer_segment_members')
      .select(`
        customer_id,
        added_at,
        customers (
          id,
          email,
          first_name,
          last_name,
          total_spent,
          total_orders
        )
      `)
      .eq('segment_id', segmentId);

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
 * Bulk add members to segment
 */
CustomerSegment.bulkAddMembers = async function(storeId, segmentId, customerIds) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const members = customerIds.map(customerId => ({
      segment_id: segmentId,
      customer_id: customerId,
      added_at: new Date().toISOString()
    }));

    const { error } = await tenantDb
      .from('customer_segment_members')
      .upsert(members, { onConflict: 'segment_id,customer_id' });

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Clear all members from segment (for recalculation)
 */
CustomerSegment.clearMembers = async function(storeId, segmentId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('customer_segment_members')
      .delete()
      .eq('segment_id', segmentId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

module.exports = CustomerSegment;
