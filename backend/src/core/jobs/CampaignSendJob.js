const BaseJobHandler = require('./BaseJobHandler');
const ConnectionManager = require('../../database/ConnectionManager');
const EmailCampaign = require('../../models/EmailCampaign');
const EmailCampaignRecipient = require('../../models/EmailCampaignRecipient');

/**
 * Background job for sending email campaigns in batches
 *
 * Payload:
 * - storeId: Store ID
 * - campaignId: Campaign to send
 * - batchSize: Number of emails per batch (default: 50)
 */
class CampaignSendJob extends BaseJobHandler {
  async execute() {
    const payload = this.getPayload();
    const { storeId, campaignId, batchSize = 50 } = payload;

    if (!storeId || !campaignId) {
      throw new Error('storeId and campaignId are required');
    }

    this.log(`Starting campaign send job for campaign ${campaignId}`);
    await this.updateProgress(5, 'Loading campaign...');

    // Get campaign details
    const campaign = await EmailCampaign.findById(storeId, campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (campaign.status !== 'scheduled' && campaign.status !== 'sending') {
      throw new Error(`Campaign status must be 'scheduled' or 'sending', got '${campaign.status}'`);
    }

    // Update campaign status to sending
    await EmailCampaign.updateStatus(storeId, campaignId, 'sending');
    await this.updateProgress(10, 'Loading recipients...');

    // Get pending recipients
    const recipients = await EmailCampaignRecipient.getPending(storeId, campaignId);

    if (recipients.length === 0) {
      this.log('No pending recipients found');
      await EmailCampaign.updateStatus(storeId, campaignId, 'sent');
      return { success: true, sent: 0, failed: 0, message: 'No recipients to send' };
    }

    this.log(`Found ${recipients.length} pending recipients`);
    await this.updateProgress(15, `Sending to ${recipients.length} recipients...`);

    // Get email service
    const emailService = require('../../services/email-service');

    let sent = 0;
    let failed = 0;
    const errors = [];

    // Process in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
      await this.checkAbort();

      const batch = recipients.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(recipients.length / batchSize);

      this.log(`Processing batch ${batchNum}/${totalBatches}`);

      // Send emails in parallel within batch
      const results = await Promise.allSettled(
        batch.map(async (recipient) => {
          try {
            // Check if unsubscribed
            const isUnsubscribed = await this.checkUnsubscribed(storeId, recipient.email);
            if (isUnsubscribed) {
              await EmailCampaignRecipient.updateStatus(storeId, recipient.id, 'skipped', {
                reason: 'unsubscribed'
              });
              return { status: 'skipped', reason: 'unsubscribed' };
            }

            // Send email
            await emailService.sendEmail(storeId, {
              to: recipient.email,
              subject: campaign.subject,
              html: this.personalizeContent(campaign.html_content, recipient),
              text: campaign.text_content ? this.personalizeContent(campaign.text_content, recipient) : undefined,
              tags: [`campaign:${campaignId}`],
              metadata: {
                campaign_id: campaignId,
                recipient_id: recipient.id
              }
            });

            // Update recipient status
            await EmailCampaignRecipient.updateStatus(storeId, recipient.id, 'sent', {
              sent_at: new Date().toISOString()
            });

            return { status: 'sent' };
          } catch (error) {
            // Update recipient as failed
            await EmailCampaignRecipient.updateStatus(storeId, recipient.id, 'failed', {
              error: error.message
            });
            return { status: 'failed', error: error.message };
          }
        })
      );

      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.status === 'sent') {
            sent++;
          } else if (result.value.status === 'failed') {
            failed++;
            errors.push(result.value.error);
          }
        } else {
          failed++;
          errors.push(result.reason?.message || 'Unknown error');
        }
      }

      // Update progress
      const progress = 15 + Math.floor((i + batch.length) / recipients.length * 80);
      await this.updateProgress(progress, `Sent ${sent}/${recipients.length} emails`);

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update campaign status and stats
    await EmailCampaign.updateStatus(storeId, campaignId, 'sent');
    await EmailCampaign.updateStats(storeId, campaignId, {
      sent_count: sent,
      failed_count: failed,
      sent_at: new Date().toISOString()
    });

    await this.updateProgress(100, 'Campaign sent successfully');

    const result = {
      success: true,
      campaignId,
      sent,
      failed,
      total: recipients.length,
      errors: errors.slice(0, 10) // Limit error list
    };

    this.log(`Campaign send completed: ${sent} sent, ${failed} failed`);
    return result;
  }

  /**
   * Check if email is unsubscribed
   */
  async checkUnsubscribed(storeId, email) {
    try {
      const EmailUnsubscribe = require('../../models/EmailUnsubscribe');
      return await EmailUnsubscribe.isUnsubscribed(storeId, email);
    } catch (error) {
      this.log(`Error checking unsubscribe status: ${error.message}`, 'warn');
      return false;
    }
  }

  /**
   * Personalize email content with recipient data
   */
  personalizeContent(content, recipient) {
    if (!content) return content;

    return content
      .replace(/\{\{email\}\}/g, recipient.email || '')
      .replace(/\{\{first_name\}\}/g, recipient.first_name || '')
      .replace(/\{\{last_name\}\}/g, recipient.last_name || '')
      .replace(/\{\{full_name\}\}/g, `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim() || recipient.email);
  }
}

module.exports = CampaignSendJob;
