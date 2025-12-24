/**
 * EmailCampaign - Pure service class (NO SEQUELIZE)
 *
 * Manages email campaigns for marketing.
 * Uses ConnectionManager for tenant database isolation.
 */

const { v4: uuidv4 } = require('uuid');

const EmailCampaign = {};

/**
 * Create a new email campaign
 */
EmailCampaign.create = async function(storeId, campaignData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const newCampaign = {
      id: uuidv4(),
      store_id: storeId,
      name: campaignData.name,
      subject: campaignData.subject,
      preview_text: campaignData.previewText || null,
      from_name: campaignData.fromName || null,
      from_email: campaignData.fromEmail || null,
      reply_to: campaignData.replyTo || null,
      content_html: campaignData.contentHtml || null,
      content_json: campaignData.contentJson || null,
      template_id: campaignData.templateId || null,
      segment_id: campaignData.segmentId || null,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await tenantDb
      .from('email_campaigns')
      .insert(newCampaign)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Find campaign by ID
 */
EmailCampaign.findById = async function(storeId, campaignId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('store_id', storeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * List all campaigns for a store
 */
EmailCampaign.findAll = async function(storeId, options = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    let query = tenantDb
      .from('email_campaigns')
      .select('*')
      .eq('store_id', storeId);

    if (options.status) {
      query = query.eq('status', options.status);
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
 * Update a campaign
 */
EmailCampaign.update = async function(storeId, campaignId, updateData) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    // Convert camelCase to snake_case
    if (updates.previewText !== undefined) {
      updates.preview_text = updates.previewText;
      delete updates.previewText;
    }
    if (updates.fromName !== undefined) {
      updates.from_name = updates.fromName;
      delete updates.fromName;
    }
    if (updates.fromEmail !== undefined) {
      updates.from_email = updates.fromEmail;
      delete updates.fromEmail;
    }
    if (updates.replyTo !== undefined) {
      updates.reply_to = updates.replyTo;
      delete updates.replyTo;
    }
    if (updates.contentHtml !== undefined) {
      updates.content_html = updates.contentHtml;
      delete updates.contentHtml;
    }
    if (updates.contentJson !== undefined) {
      updates.content_json = updates.contentJson;
      delete updates.contentJson;
    }
    if (updates.templateId !== undefined) {
      updates.template_id = updates.templateId;
      delete updates.templateId;
    }
    if (updates.segmentId !== undefined) {
      updates.segment_id = updates.segmentId;
      delete updates.segmentId;
    }

    const { data, error } = await tenantDb
      .from('email_campaigns')
      .update(updates)
      .eq('id', campaignId)
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
 * Delete a campaign
 */
EmailCampaign.delete = async function(storeId, campaignId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { error } = await tenantDb
      .from('email_campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('store_id', storeId);

    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Schedule a campaign
 */
EmailCampaign.schedule = async function(storeId, campaignId, scheduledAt) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_campaigns')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledAt,
        updated_at: new Date().toISOString()
      })
      .eq('id', campaignId)
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
 * Update campaign status
 */
EmailCampaign.updateStatus = async function(storeId, campaignId, status, additionalFields = {}) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      status,
      updated_at: new Date().toISOString(),
      ...additionalFields
    };

    if (status === 'sending') {
      updates.sent_at = new Date().toISOString();
    }

    const { data, error } = await tenantDb
      .from('email_campaigns')
      .update(updates)
      .eq('id', campaignId)
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
 * Update campaign stats
 */
EmailCampaign.updateStats = async function(storeId, campaignId, stats) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const updates = {
      updated_at: new Date().toISOString()
    };

    if (stats.totalSent !== undefined) updates.total_sent = stats.totalSent;
    if (stats.totalOpened !== undefined) updates.total_opened = stats.totalOpened;
    if (stats.totalClicked !== undefined) updates.total_clicked = stats.totalClicked;
    if (stats.totalBounced !== undefined) updates.total_bounced = stats.totalBounced;
    if (stats.totalUnsubscribed !== undefined) updates.total_unsubscribed = stats.totalUnsubscribed;

    const { data, error } = await tenantDb
      .from('email_campaigns')
      .update(updates)
      .eq('id', campaignId)
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
 * Get campaigns due for sending
 */
EmailCampaign.getDueForSending = async function(storeId) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data, error } = await tenantDb
      .from('email_campaigns')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (error) throw error;
    return data || [];
  } catch (error) {
    throw error;
  }
};

module.exports = EmailCampaign;
