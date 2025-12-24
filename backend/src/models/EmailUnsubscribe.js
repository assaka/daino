/**
 * EmailUnsubscribe - Pure service class (NO SEQUELIZE)
 *
 * Manages email unsubscribe list for marketing compliance.
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const EmailUnsubscribe = {};

/**
 * Add email to unsubscribe list
 */
EmailUnsubscribe.create = async function(storeId, email, reason = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const unsubscribe = {
      id: uuidv4(),
      store_id: storeId,
      email: email.toLowerCase(),
      reason,
      unsubscribed_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('email_unsubscribes')
      .upsert(unsubscribe, { onConflict: 'store_id,email' })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Check if email is unsubscribed
 */
EmailUnsubscribe.isUnsubscribed = async function(storeId, email) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_unsubscribes')
      .select('id')
      .eq('store_id', storeId)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    throw error;
  }
};

/**
 * Check multiple emails for unsubscribes
 */
EmailUnsubscribe.filterUnsubscribed = async function(storeId, emails) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const normalizedEmails = emails.map(e => e.toLowerCase());

    const { data, error } = await tenantDb
      .from('email_unsubscribes')
      .select('email')
      .eq('store_id', storeId)
      .in('email', normalizedEmails);

    if (error) throw error;

    const unsubscribedSet = new Set((data || []).map(d => d.email));
    return emails.filter(email => !unsubscribedSet.has(email.toLowerCase()));
  } catch (error) {
    throw error;
  }
};

/**
 * Remove email from unsubscribe list (resubscribe)
 */
EmailUnsubscribe.remove = async function(storeId, email) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('email_unsubscribes')
      .delete()
      .eq('store_id', storeId)
      .eq('email', email.toLowerCase());

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all unsubscribed emails for a store
 */
EmailUnsubscribe.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('email_unsubscribes')
      .select('*')
      .eq('store_id', storeId)
      .order('unsubscribed_at', { ascending: false });

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
 * Get count of unsubscribed emails
 */
EmailUnsubscribe.count = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { count, error } = await tenantDb
      .from('email_unsubscribes')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    throw error;
  }
};

/**
 * Bulk add unsubscribes
 */
EmailUnsubscribe.bulkCreate = async function(storeId, emails, reason = 'bulk_import') {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const unsubscribes = emails.map(email => ({
      id: uuidv4(),
      store_id: storeId,
      email: email.toLowerCase(),
      reason,
      unsubscribed_at: new Date().toISOString()
    }));

    const { error } = await tenantDb
      .from('email_unsubscribes')
      .upsert(unsubscribes, { onConflict: 'store_id,email' });

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

module.exports = EmailUnsubscribe;
