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
  PLATFORM_NAME
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
}

// Export singleton instance
module.exports = new MasterEmailService();
