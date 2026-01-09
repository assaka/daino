/**
 * Master Email Service
 *
 * Handles sending platform-level emails (credits purchase, welcome, password reset, etc.)
 * These emails use a master Brevo configuration independent of tenant stores.
 */

const SibApiV3Sdk = require('@getbrevo/brevo');
const { masterDbClient } = require('../database/masterConnection');
const {
  creditsPurchaseEmail,
  creditsLowBalanceEmail,
  welcomeEmail,
  passwordResetEmail,
  storeOwnerVerificationEmail,
  pauseAccessRequestEmail,
  pauseAccessApprovedEmail,
  pauseAccessRejectedEmail,
  onboardingEmail,
  PLATFORM_NAME,
  PLATFORM_URL
} = require('./master-email-templates');

class MasterEmailService {
  constructor() {
    this.apiKey = process.env.MASTER_BREVO_API_KEY || process.env.BREVO_API_KEY;
    this.senderEmail = process.env.MASTER_SENDER_EMAIL || process.env.BREVO_SENDER_EMAIL || 'noreply@dainostore.com';
    this.senderName = process.env.MASTER_SENDER_NAME || PLATFORM_NAME;
    this.isConfigured = !!this.apiKey;

    if (!this.isConfigured) {
      console.warn('[MASTER EMAIL SERVICE] No API key configured. Platform emails will not be sent.');
      console.warn('[MASTER EMAIL SERVICE] Set MASTER_BREVO_API_KEY or BREVO_API_KEY environment variable.');
    } else {
      console.log('[MASTER EMAIL SERVICE] Initialized with sender:', this.senderEmail);
    }
  }

  /**
   * Send email via Brevo API
   * @param {string} recipientEmail - Recipient email address
   * @param {string} subject - Email subject
   * @param {string} htmlContent - HTML content
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(recipientEmail, subject, htmlContent) {
    if (!this.isConfigured) {
      console.warn('[MASTER EMAIL SERVICE] Skipping email - not configured');
      return {
        success: false,
        message: 'Master email service not configured'
      };
    }

    try {
      console.log(`[MASTER EMAIL SERVICE] Sending email to: ${recipientEmail}`);
      console.log(`[MASTER EMAIL SERVICE] Subject: ${subject}`);

      // Initialize Brevo API client
      const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      apiInstance.authentications['apiKey'].apiKey = this.apiKey;

      // Prepare email
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.sender = {
        name: this.senderName,
        email: this.senderEmail
      };
      sendSmtpEmail.to = [{ email: recipientEmail }];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;

      // Send email
      const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

      console.log(`[MASTER EMAIL SERVICE] Email sent successfully. MessageId: ${response.messageId}`);

      // Log the email send
      await this.logEmail(recipientEmail, subject, 'sent', response.messageId);

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: response.messageId
      };
    } catch (error) {
      console.error('[MASTER EMAIL SERVICE] Send error:', error.response?.body || error.message);

      // Log the failed attempt
      await this.logEmail(recipientEmail, subject, 'failed', null, error.message);

      return {
        success: false,
        message: error.response?.body?.message || error.message
      };
    }
  }

  /**
   * Log email send attempt to master database
   * @param {string} recipientEmail - Recipient email
   * @param {string} subject - Email subject
   * @param {string} status - Send status (sent, failed)
   * @param {string} messageId - Brevo message ID
   * @param {string} errorMessage - Error message if failed
   */
  async logEmail(recipientEmail, subject, status, messageId = null, errorMessage = null) {
    try {
      if (!masterDbClient) {
        console.warn('[MASTER EMAIL SERVICE] Cannot log email - masterDbClient not available');
        return;
      }

      await masterDbClient
        .from('platform_email_logs')
        .insert({
          recipient_email: recipientEmail,
          subject: subject,
          status: status,
          message_id: messageId,
          error_message: errorMessage,
          sent_at: status === 'sent' ? new Date().toISOString() : null
        });
    } catch (error) {
      // Don't throw - logging failure shouldn't break email sending
      console.error('[MASTER EMAIL SERVICE] Failed to log email:', error.message);
    }
  }

  /**
   * Send credits purchase confirmation email
   * @param {Object} data - Purchase data
   * @returns {Promise<Object>} Send result
   */
  async sendCreditsPurchaseEmail(data) {
    const {
      recipientEmail,
      customerName,
      customerFirstName,
      creditsPurchased,
      amountPaid,
      currency = 'USD',
      transactionId,
      currentBalance,
      paymentMethod = 'Credit Card'
    } = data;

    const purchaseDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const htmlContent = creditsPurchaseEmail({
      customerName,
      customerFirstName: customerFirstName || customerName?.split(' ')[0] || 'there',
      customerEmail: recipientEmail,
      creditsPurchased,
      amountPaid: typeof amountPaid === 'number' ? `$${amountPaid.toFixed(2)}` : amountPaid,
      currency,
      transactionId,
      currentBalance,
      purchaseDate,
      paymentMethod
    });

    const subject = `Credit Purchase Confirmed - ${creditsPurchased} Credits`;

    return await this.sendEmail(recipientEmail, subject, htmlContent);
  }

  /**
   * Send low balance warning email
   * @param {Object} data - Balance data
   * @returns {Promise<Object>} Send result
   */
  async sendLowBalanceWarningEmail(data) {
    const {
      recipientEmail,
      customerName,
      customerFirstName,
      currentBalance,
      threshold = 10,
      recommendedPurchase = 100
    } = data;

    const htmlContent = creditsLowBalanceEmail({
      customerName,
      customerFirstName: customerFirstName || customerName?.split(' ')[0] || 'there',
      currentBalance,
      threshold,
      recommendedPurchase
    });

    const subject = `Low Credit Balance Warning - ${currentBalance} Credits Remaining`;

    return await this.sendEmail(recipientEmail, subject, htmlContent);
  }

  /**
   * Send welcome email to new users
   * @param {Object} data - User data
   * @returns {Promise<Object>} Send result
   */
  async sendWelcomeEmail(data) {
    const {
      recipientEmail,
      customerName,
      customerFirstName
    } = data;

    const signupDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const htmlContent = welcomeEmail({
      customerName,
      customerFirstName: customerFirstName || customerName?.split(' ')[0] || 'there',
      customerEmail: recipientEmail,
      signupDate
    });

    const subject = `Welcome to ${PLATFORM_NAME}!`;

    return await this.sendEmail(recipientEmail, subject, htmlContent);
  }

  /**
   * Send password reset email
   * @param {Object} data - Reset data
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetEmail(data) {
    const {
      recipientEmail,
      customerName,
      customerFirstName,
      resetLink,
      expiresIn = '1 hour'
    } = data;

    const htmlContent = passwordResetEmail({
      customerName,
      customerFirstName: customerFirstName || customerName?.split(' ')[0] || 'there',
      resetLink,
      expiresIn
    });

    const subject = `Reset Your ${PLATFORM_NAME} Password`;

    return await this.sendEmail(recipientEmail, subject, htmlContent);
  }

  /**
   * Send email verification code to store owner
   * @param {Object} data - Verification data
   * @returns {Promise<Object>} Send result
   */
  async sendStoreOwnerVerificationEmail(data) {
    const {
      recipientEmail,
      customerName,
      customerFirstName,
      verificationCode,
      expiresIn = '15 minutes'
    } = data;

    const htmlContent = storeOwnerVerificationEmail({
      customerName,
      customerFirstName: customerFirstName || customerName?.split(' ')[0] || 'there',
      customerEmail: recipientEmail,
      verificationCode,
      expiresIn
    });

    const subject = `Verify Your Email - ${PLATFORM_NAME}`;

    return await this.sendEmail(recipientEmail, subject, htmlContent);
  }

  /**
   * Send pause access request notification to store owner
   * @param {Object} data - Request data
   * @returns {Promise<Object>} Send result
   */
  async sendPauseAccessRequestEmail(data) {
    const {
      toEmail,
      storeName,
      requesterEmail,
      message,
      requestDate,
      manageUrl
    } = data;

    const htmlContent = pauseAccessRequestEmail({
      storeName,
      requesterEmail,
      message,
      requestDate,
      manageUrl
    });

    const subject = `Access Request for ${storeName} - ${PLATFORM_NAME}`;

    return await this.sendEmail(toEmail, subject, htmlContent);
  }

  /**
   * Send pause access approved notification to requester
   * @param {Object} data - Approval data
   * @returns {Promise<Object>} Send result
   */
  async sendPauseAccessApprovedEmail(data) {
    const {
      toEmail,
      storeName,
      storeUrl,
      expiresDate
    } = data;

    const htmlContent = pauseAccessApprovedEmail({
      storeName,
      storeUrl,
      expiresDate
    });

    const subject = `Access Approved - ${storeName}`;

    return await this.sendEmail(toEmail, subject, htmlContent);
  }

  /**
   * Send pause access rejected notification to requester
   * @param {Object} data - Rejection data
   * @returns {Promise<Object>} Send result
   */
  async sendPauseAccessRejectedEmail(data) {
    const {
      toEmail,
      storeName,
      contactEmail
    } = data;

    const htmlContent = pauseAccessRejectedEmail({
      storeName,
      contactEmail
    });

    const subject = `Access Request Update - ${storeName}`;

    return await this.sendEmail(toEmail, subject, htmlContent);
  }

  /**
   * Send a test email to verify configuration
   * @param {string} testEmail - Email to send test to
   * @returns {Promise<Object>} Send result
   */
  async sendTestEmail(testEmail) {
    return await this.sendCreditsPurchaseEmail({
      recipientEmail: testEmail,
      customerName: 'Test User',
      customerFirstName: 'Test',
      creditsPurchased: 100,
      amountPaid: 10.00,
      currency: 'USD',
      transactionId: 'TEST-' + Date.now(),
      currentBalance: 150,
      paymentMethod: 'Test Payment'
    });
  }

  /**
   * Send onboarding email to store owner (1 day after registration)
   * @param {Object} data - Onboarding data
   * @returns {Promise<Object>} Send result
   */
  async sendOnboardingEmail(data) {
    const {
      recipientEmail,
      customerName,
      customerFirstName,
      hasStore = false,
      storeName = '',
      userId
    } = data;

    // Generate unsubscribe token (uses general newsletter unsubscribe)
    const crypto = require('crypto');
    const unsubscribeToken = crypto.createHash('sha256')
      .update(`${userId}-${recipientEmail}-newsletter-unsubscribe`)
      .digest('hex');

    const unsubscribeUrl = `${PLATFORM_URL}/api/emails/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(recipientEmail)}&type=newsletter`;

    const htmlContent = onboardingEmail({
      customerName,
      customerFirstName: customerFirstName || customerName?.split(' ')[0] || 'there',
      hasStore,
      storeName,
      calendlyUrl: 'https://calendly.com/dainostore',
      unsubscribeUrl
    });

    const subject = `Quick check-in - need any help?`;

    return await this.sendEmail(recipientEmail, subject, htmlContent);
  }

  /**
   * Send store provisioning complete email
   * Called when background provisioning job completes (success or failure)
   * @param {string} recipientEmail - User email
   * @param {string} storeName - Name of the store
   * @param {string} dashboardUrl - URL to redirect user to
   * @param {boolean} success - Whether provisioning succeeded
   * @returns {Promise<Object>} Send result
   */
  async sendProvisioningCompleteEmail(recipientEmail, storeName, dashboardUrl, success = true) {
    const subject = success
      ? `Your store "${storeName}" is ready!`
      : `Issue with your store "${storeName}" setup`;

    const htmlContent = success
      ? `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 30px; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Your Store is Ready!</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        Great news! Your store <strong>"${storeName}"</strong> has been successfully set up and is ready to use.
                      </p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                        Your database has been provisioned with all the tables, configurations, and settings you need to start selling.
                      </p>
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                          Go to Dashboard →
                        </a>
                      </div>
                      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                        Need help? <a href="https://discord.gg/vvAhfdaX" style="color: #4f46e5; text-decoration: none;">Join our Discord</a> or <a href="https://calendly.com/dainostore" style="color: #4f46e5; text-decoration: none;">schedule a call</a>.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center;">
                      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        ${PLATFORM_NAME} • Building the future of e-commerce
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
      : `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 40px 30px; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Setup Issue</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        We encountered an issue while setting up your store <strong>"${storeName}"</strong>.
                      </p>
                      <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                        Don't worry - you can try again by clicking the button below. If the issue persists, our team is here to help.
                      </p>
                      <div style="text-align: center; margin: 30px 0;">
                        <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                          Retry Setup →
                        </a>
                      </div>
                      <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                        Need help? <a href="https://discord.gg/vvAhfdaX" style="color: #4f46e5; text-decoration: none;">Join our Discord</a> or <a href="https://calendly.com/dainostore" style="color: #4f46e5; text-decoration: none;">schedule a call</a>.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center;">
                      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                        ${PLATFORM_NAME} • Building the future of e-commerce
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

    return await this.sendEmail(recipientEmail, subject, htmlContent);
  }

  /**
   * Send onboarding emails to users who registered 24 hours ago
   * Called by the scheduled job
   * @returns {Promise<Object>} Results summary
   */
  async sendPendingOnboardingEmails() {
    const results = {
      total: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    try {
      // Calculate time window: users who registered between 24-25 hours ago
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twentyFiveHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);

      // Find users who:
      // 1. Registered 24-25 hours ago
      // 2. Have verified email
      // 3. Haven't unsubscribed from newsletter/marketing emails
      const { data: eligibleUsers, error } = await masterDbClient
        .from('users')
        .select('id, email, first_name, last_name, created_at, newsletter_unsubscribed')
        .eq('email_verified', true)
        .eq('role', 'store_owner')
        .gte('created_at', twentyFiveHoursAgo.toISOString())
        .lte('created_at', twentyFourHoursAgo.toISOString());

      if (error) {
        console.error('[ONBOARDING EMAIL] Error fetching eligible users:', error.message);
        return { ...results, errors: [error.message] };
      }

      results.total = eligibleUsers?.length || 0;
      console.log(`[ONBOARDING EMAIL] Found ${results.total} users in time window`);

      if (!eligibleUsers || eligibleUsers.length === 0) {
        return results;
      }

      for (const user of eligibleUsers) {
        try {
          // Skip if unsubscribed from newsletter
          if (user.newsletter_unsubscribed) {
            results.skipped++;
            console.log(`[ONBOARDING EMAIL] Skipping ${user.email} - unsubscribed from newsletter`);
            continue;
          }

          // Check if onboarding email was already sent (via platform_email_logs)
          const { data: existingLog } = await masterDbClient
            .from('platform_email_logs')
            .select('id')
            .eq('recipient_email', user.email)
            .like('subject', '%Quick check-in%')
            .limit(1);

          if (existingLog && existingLog.length > 0) {
            results.skipped++;
            console.log(`[ONBOARDING EMAIL] Skipping ${user.email} - already sent`);
            continue;
          }

          // Check if user has a store
          const { data: stores } = await masterDbClient
            .from('stores')
            .select('id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1);

          const hasStore = stores && stores.length > 0;
          const storeName = hasStore ? stores[0].name : '';

          // Send the email (logEmail is called automatically in sendEmail)
          const sendResult = await this.sendOnboardingEmail({
            recipientEmail: user.email,
            customerName: `${user.first_name} ${user.last_name}`,
            customerFirstName: user.first_name,
            hasStore,
            storeName,
            userId: user.id
          });

          if (sendResult.success) {
            results.sent++;
            console.log(`[ONBOARDING EMAIL] Sent to ${user.email} (hasStore: ${hasStore})`);
          } else {
            results.failed++;
            results.errors.push(`${user.email}: ${sendResult.message}`);
            console.error(`[ONBOARDING EMAIL] Failed to send to ${user.email}:`, sendResult.message);
          }
        } catch (userError) {
          results.failed++;
          results.errors.push(`${user.email}: ${userError.message}`);
          console.error(`[ONBOARDING EMAIL] Error processing ${user.email}:`, userError.message);
        }
      }

      console.log(`[ONBOARDING EMAIL] Summary: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);
      return results;

    } catch (error) {
      console.error('[ONBOARDING EMAIL] Fatal error:', error.message);
      return { ...results, errors: [error.message] };
    }
  }
}

// Export singleton instance
module.exports = new MasterEmailService();
