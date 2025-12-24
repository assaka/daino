/**
 * EmailCampaignRecipient - Pure service class (NO SEQUELIZE)
 *
 * Manages email campaign recipients and tracking.
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const EmailCampaignRecipient = {};

/**
 * Create a recipient record
 */
EmailCampaignRecipient.create = async function(storeId, recipientData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newRecipient = {
      id: uuidv4(),
      campaign_id: recipientData.campaignId,
      customer_id: recipientData.customerId || null,
      email: recipientData.email,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .insert(newRecipient)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Bulk create recipients
 */
EmailCampaignRecipient.bulkCreate = async function(storeId, campaignId, recipients) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const recipientRecords = recipients.map(r => ({
      id: uuidv4(),
      campaign_id: campaignId,
      customer_id: r.customerId || null,
      email: r.email,
      status: 'pending',
      created_at: new Date().toISOString()
    }));

    const { error } = await tenantDb
      .from('email_campaign_recipients')
      .insert(recipientRecords);

    if (error) throw error;
    return recipientRecords.length;
  } catch (error) {
    throw error;
  }
};

/**
 * Get recipients for a campaign
 */
EmailCampaignRecipient.findByCampaign = async function(storeId, campaignId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('email_campaign_recipients')
      .select(`
        *,
        customers (id, email, first_name, last_name)
      `)
      .eq('campaign_id', campaignId);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    query = query.order('created_at', { ascending: true });

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
 * Get pending recipients for sending
 */
EmailCampaignRecipient.getPendingForCampaign = async function(storeId, campaignId, limit = 100) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

/**
 * Update recipient status
 */
EmailCampaignRecipient.updateStatus = async function(storeId, recipientId, status, additionalFields = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      status,
      ...additionalFields
    };

    if (status === 'sent') {
      updates.sent_at = new Date().toISOString();
    }

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .update(updates)
      .eq('id', recipientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Record email open
 */
EmailCampaignRecipient.recordOpen = async function(storeId, recipientId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get current recipient
    const { data: recipient } = await tenantDb
      .from('email_campaign_recipients')
      .select('opens')
      .eq('id', recipientId)
      .single();

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .update({
        opened_at: recipient?.opens === 0 ? new Date().toISOString() : undefined,
        opens: (recipient?.opens || 0) + 1
      })
      .eq('id', recipientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Record email click
 */
EmailCampaignRecipient.recordClick = async function(storeId, recipientId, url = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get current recipient
    const { data: recipient } = await tenantDb
      .from('email_campaign_recipients')
      .select('clicks, click_urls')
      .eq('id', recipientId)
      .single();

    const clickUrls = recipient?.click_urls || [];
    if (url && !clickUrls.includes(url)) {
      clickUrls.push(url);
    }

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .update({
        clicked_at: recipient?.clicks === 0 ? new Date().toISOString() : undefined,
        clicks: (recipient?.clicks || 0) + 1,
        click_urls: clickUrls
      })
      .eq('id', recipientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Record bounce
 */
EmailCampaignRecipient.recordBounce = async function(storeId, recipientId, bounceType = 'hard') {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .update({
        status: 'bounced',
        bounced_at: new Date().toISOString(),
        bounce_type: bounceType
      })
      .eq('id', recipientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Record unsubscribe
 */
EmailCampaignRecipient.recordUnsubscribe = async function(storeId, recipientId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .update({
        unsubscribed_at: new Date().toISOString()
      })
      .eq('id', recipientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Get campaign statistics
 */
EmailCampaignRecipient.getCampaignStats = async function(storeId, campaignId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .select('status, opens, clicks, bounced_at, unsubscribed_at')
      .eq('campaign_id', campaignId);

    if (error) throw error;

    const recipients = data || [];
    const stats = {
      total: recipients.length,
      pending: 0,
      sent: 0,
      failed: 0,
      bounced: 0,
      totalOpens: 0,
      uniqueOpens: 0,
      totalClicks: 0,
      uniqueClicks: 0,
      unsubscribed: 0
    };

    recipients.forEach(r => {
      if (r.status === 'pending') stats.pending++;
      if (r.status === 'sent') stats.sent++;
      if (r.status === 'failed') stats.failed++;
      if (r.status === 'bounced') stats.bounced++;
      if (r.opens > 0) {
        stats.uniqueOpens++;
        stats.totalOpens += r.opens;
      }
      if (r.clicks > 0) {
        stats.uniqueClicks++;
        stats.totalClicks += r.clicks;
      }
      if (r.unsubscribed_at) stats.unsubscribed++;
    });

    // Calculate rates
    stats.openRate = stats.sent > 0 ? ((stats.uniqueOpens / stats.sent) * 100).toFixed(2) : 0;
    stats.clickRate = stats.sent > 0 ? ((stats.uniqueClicks / stats.sent) * 100).toFixed(2) : 0;
    stats.bounceRate = stats.total > 0 ? ((stats.bounced / stats.total) * 100).toFixed(2) : 0;
    stats.unsubscribeRate = stats.sent > 0 ? ((stats.unsubscribed / stats.sent) * 100).toFixed(2) : 0;

    return stats;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete all recipients for a campaign
 */
EmailCampaignRecipient.deleteByCampaign = async function(storeId, campaignId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('email_campaign_recipients')
      .delete()
      .eq('campaign_id', campaignId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Find recipient by email and campaign
 */
EmailCampaignRecipient.findByEmailAndCampaign = async function(storeId, campaignId, email) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

module.exports = EmailCampaignRecipient;
