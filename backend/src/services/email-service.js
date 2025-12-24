const SibApiV3Sdk = require('@getbrevo/brevo');
const ConnectionManager = require('./database/ConnectionManager');
const { masterDbClient } = require('../database/masterConnection');
const brevoService = require('./brevo-service');
const { buildStoreUrlSync } = require('../utils/domainConfig');
const {
  renderTemplate,
  formatOrderItemsHtml,
  formatAddress,
  getExampleData
} = require('./email-template-variables');

// Fallback logo URL
const FALLBACK_LOGO_URL = `${process.env.FRONTEND_URL || 'https://www.dainostore.com'}/logo_red.svg`;

/**
 * Email Service
 * Handles email sending through Brevo with template rendering
 */
class EmailService {
  /**
   * Get theme colors for a store
   * Fetches primary_button_color from theme_defaults based on store's theme_preset
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Theme colors { primary_color, secondary_color }
   */
  async getThemeColors(storeId) {
    try {
      // Get store's theme preset from master DB
      const { data: store } = await masterDbClient
        .from('stores')
        .select('theme_preset')
        .eq('id', storeId)
        .maybeSingle();

      const themePreset = store?.theme_preset || 'default';

      // Get theme settings from theme_defaults
      const { data: themeData } = await masterDbClient
        .from('theme_defaults')
        .select('theme_settings')
        .eq('preset_name', themePreset)
        .eq('is_active', true)
        .maybeSingle();

      const themeSettings = themeData?.theme_settings;

      if (themeSettings) {
        // Use primary_button_color as the main color
        const primaryColor = themeSettings.primary_button_color || '#007bff';
        // Use add_to_cart_button_color as secondary, or generate a complementary color
        const secondaryColor = themeSettings.add_to_cart_button_color || themeSettings.secondary_button_color || '#28a745';

        return {
          primary_color: primaryColor,
          secondary_color: secondaryColor
        };
      }

      // Fallback to default colors
      return {
        primary_color: '#007bff',
        secondary_color: '#28a745'
      };
    } catch (error) {
      console.warn('⚠️ [EMAIL SERVICE] Failed to fetch theme colors:', error.message);
      // Return default colors on error
      return {
        primary_color: '#007bff',
        secondary_color: '#28a745'
      };
    }
  }

  /**
   * Get full store data from tenant DB including settings and custom domain
   * @param {string} storeId - Store ID
   * @returns {Promise<Object>} Store data with logo_url and store_url
   */
  async getFullStoreData(storeId) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Get store data with settings
      const { data: store } = await tenantDb
        .from('stores')
        .select('id, name, slug, settings')
        .eq('id', storeId)
        .maybeSingle();

      // Get primary custom domain if exists
      const { data: customDomain } = await tenantDb
        .from('custom_domains')
        .select('domain')
        .eq('store_id', storeId)
        .eq('is_primary', true)
        .eq('is_active', true)
        .maybeSingle();

      const storeSlug = store?.slug || 'default';
      const storeName = store?.name || 'Our Store';
      const storeSettings = store?.settings || {};

      // Build proper store URL
      const storeUrl = buildStoreUrlSync({
        customDomain: customDomain?.domain,
        storeSlug: storeSlug
      });

      // Get logo from settings, fallback to default
      const logoUrl = storeSettings.store_logo || FALLBACK_LOGO_URL;

      return {
        name: storeName,
        slug: storeSlug,
        settings: storeSettings,
        store_url: storeUrl,
        login_url: `${storeUrl}/login`,
        logo_url: logoUrl,
        custom_domain: customDomain?.domain
      };
    } catch (error) {
      console.warn('⚠️ [EMAIL SERVICE] Failed to fetch full store data:', error.message);
      // Return defaults on error
      const fallbackUrl = process.env.CORS_ORIGIN || 'https://www.dainostore.com';
      return {
        name: 'Our Store',
        slug: 'default',
        settings: {},
        store_url: fallbackUrl,
        login_url: `${fallbackUrl}/login`,
        logo_url: FALLBACK_LOGO_URL,
        custom_domain: null
      };
    }
  }

  /**
   * Send email using template
   * @param {string} storeId - Store ID
   * @param {string} templateIdentifier - Email template identifier (signup_email, etc.)
   * @param {string} recipientEmail - Recipient email address
   * @param {Object} variables - Variables to replace in template
   * @param {string} languageCode - Language code for translation (default: 'en')
   * @param {Array} attachments - Optional attachments
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(storeId, templateIdentifier, recipientEmail, variables, languageCode = 'en', attachments = []) {
    try {
      console.log(`📧 [EMAIL SERVICE] Attempting to send email:`, {
        storeId,
        templateIdentifier,
        recipientEmail,
        languageCode
      });

      // Check if Brevo is configured
      const isConfigured = await brevoService.isConfigured(storeId);
      if (!isConfigured) {
        const errorMsg = `Brevo email service is not configured for store ${storeId}. Please configure Brevo in Settings > Email to enable email sending.`;
        console.error(`❌ [EMAIL SERVICE] ${errorMsg}`);

        // Log as failed
        await this.logEmail(storeId, null, recipientEmail, 'Email not sent', 'failed', null, errorMsg, { templateIdentifier, variables });
        return {
          success: false,
          message: 'Email service not configured. Please contact the store administrator to configure email settings.'
        };
      }

      console.log(`✅ [EMAIL SERVICE] Brevo is configured for store ${storeId}`);

      // Get tenant database connection
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Get template (query by identifier only - storeId is tenant identifier, not store UUID)
      const { data: template, error: templateError } = await tenantDb
        .from('email_templates')
        .select('*')
        .eq('identifier', templateIdentifier)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (templateError) {
        console.error(`❌ [EMAIL SERVICE] Database error:`, templateError);
        throw new Error(`Database error: ${templateError.message}`);
      }

      if (!template) {
        const errorMsg = `Email template '${templateIdentifier}' not found or not active for store ${storeId}. Please create and activate the template in Settings > Email Templates.`;
        console.error(`❌ [EMAIL SERVICE] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ [EMAIL SERVICE] Email template found`);

      // Get translation (content is now stored exclusively in translations table)
      const { data: translations, error: translationError } = await tenantDb
        .from('email_template_translations')
        .select('*')
        .eq('email_template_id', template.id)
        .eq('language_code', languageCode);

      if (translationError) {
        console.error(`❌ [EMAIL SERVICE] Translation database error:`, translationError);
        throw new Error(`Translation database error: ${translationError.message}`);
      }

      const translation = translations && translations.length > 0 ? translations[0] : null;

      if (!translation) {
        const errorMsg = `No ${languageCode} translation found for email template '${templateIdentifier}'. Please add translations in Layout > Translations.`;
        console.error(`❌ [EMAIL SERVICE] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const subject = translation.subject;
      let content;

      // Choose content based on template type
      if (template.content_type === 'html' || template.content_type === 'both') {
        content = translation.html_content;
      } else {
        content = translation.template_content;
      }

      // Process email_header and email_footer placeholders
      if (content && (content.includes('{{email_header}}') || content.includes('{{email_footer}}'))) {
        content = await this.processHeaderFooter(storeId, content, languageCode);
      }

      // Inject theme colors and store data into variables for header/footer templates
      const themeColors = await this.getThemeColors(storeId);
      const fullStoreData = await this.getFullStoreData(storeId);
      const enrichedVariables = {
        ...variables,
        ...themeColors,  // Adds primary_color and secondary_color
        store_logo_url: fullStoreData.logo_url,
        store_url: variables.store_url || fullStoreData.store_url,
        store_name: variables.store_name || fullStoreData.name
      };

      // Render template with variables
      const renderedSubject = renderTemplate(subject, enrichedVariables);
      const renderedContent = renderTemplate(content, enrichedVariables);

      // Send via Brevo
      const result = await this.sendViaBrevo(
        storeId,
        recipientEmail,
        renderedSubject,
        renderedContent,
        attachments
      );

      // Log successful send
      await this.logEmail(
        storeId,
        template.id,
        recipientEmail,
        renderedSubject,
        'sent',
        result.messageId,
        null,
        { templateIdentifier, variables, languageCode }
      );

      console.log(`✅ [EMAIL SERVICE] Email sent successfully:`, {
        messageId: result.messageId,
        recipientEmail,
        subject: renderedSubject
      });

      return {
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      };
    } catch (error) {
      console.error('❌ [EMAIL SERVICE] Email send error:', error.message);
      console.error('❌ [EMAIL SERVICE] Full error:', error);

      // Log failed send
      await this.logEmail(
        storeId,
        null,
        recipientEmail,
        'Email failed',
        'failed',
        null,
        error.message,
        { templateIdentifier, variables }
      );

      throw error;
    }
  }

  /**
   * Send email via Brevo API
   * @param {string} storeId - Store ID
   * @param {string} recipientEmail - Recipient email
   * @param {string} subject - Email subject
   * @param {string} htmlContent - HTML content
   * @param {Array} attachments - Attachments
   * @returns {Promise<Object>} Send result
   */
  async sendViaBrevo(storeId, recipientEmail, subject, htmlContent, attachments = []) {
    try {
      // Get valid API key
      const apiKey = await brevoService.getValidApiKey(storeId);
      const config = await brevoService.getConfiguration(storeId);

      // Initialize Brevo API client
      const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      apiInstance.authentications['apiKey'].apiKey = apiKey;

      // Prepare email
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.sender = {
        name: config.senderName,   // camelCase from getConfiguration()
        email: config.senderEmail  // camelCase from getConfiguration()
      };
      sendSmtpEmail.to = [{ email: recipientEmail }];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        sendSmtpEmail.attachment = attachments.map(att => ({
          name: att.filename,
          content: att.content, // Base64 encoded
          contentType: att.contentType || 'application/pdf'
        }));
      }

      // Send email
      const response = await apiInstance.sendTransacEmail(sendSmtpEmail);

      return {
        success: true,
        messageId: response.messageId
      };
    } catch (error) {
      console.error('Brevo send error:', JSON.stringify(error.response?.body, null, 2) || error.message);
      console.error('Brevo request details - sender:', JSON.stringify(sendSmtpEmail.sender), 'to:', JSON.stringify(sendSmtpEmail.to), 'subject:', subject?.substring(0, 50));
      throw new Error(`Failed to send email via Brevo: ${error.response?.body?.message || error.message}`);
    }
  }

  /**
   * Send transactional email (wrapper for common email types)
   * @param {string} storeId - Store ID
   * @param {string} templateIdentifier - Email template identifier (signup_email, credit_purchase_email, order_success_email)
   * @param {Object} data - Email data
   * @returns {Promise<Object>} Send result
   */
  async sendTransactionalEmail(storeId, templateIdentifier, data) {
    // Always fetch full store data to ensure logo and URL are correct
    const fullStoreData = await this.getFullStoreData(storeId);

    // Merge full store data into data.store
    data.store = {
      ...(data.store || {}),
      name: data.store?.name || fullStoreData.name,
      slug: fullStoreData.slug,
      settings: fullStoreData.settings,
      store_url: fullStoreData.store_url,
      login_url: fullStoreData.login_url,
      logo_url: fullStoreData.logo_url,
      custom_domain: fullStoreData.custom_domain
    };

    // Build variables based on template identifier
    let variables = {};

    switch (templateIdentifier) {
      case 'signup_email':
        variables = this.buildSignupVariables(data);
        break;
      case 'credit_purchase_email':
        variables = this.buildCreditPurchaseVariables(data);
        break;
      case 'order_success_email':
        variables = await this.buildOrderSuccessVariables(data);
        break;
      case 'invoice_email':
        variables = await this.buildOrderSuccessVariables(data);
        // Add invoice-specific variables if provided
        if (data.invoice_number) variables.invoice_number = data.invoice_number;
        if (data.invoice_date) variables.invoice_date = data.invoice_date;
        break;
      case 'shipment_email':
        variables = await this.buildOrderSuccessVariables(data);
        // Add shipment-specific variables
        if (data.tracking_number) variables.tracking_number = data.tracking_number;
        if (data.tracking_url) variables.tracking_url = data.tracking_url;
        if (data.carrier) variables.carrier = data.carrier;
        if (data.shipping_method) variables.shipping_method = data.shipping_method;
        if (data.estimated_delivery_date) variables.estimated_delivery_date = data.estimated_delivery_date;
        break;
      default:
        // If no specific builder, use data as variables directly
        variables = data;
        break;
    }

    // Ensure store_name is set from data.store.name if not already present
    if (!variables.store_name && data.store?.name) {
      variables.store_name = data.store.name;
    }

    // Include orderId in variables for email log metadata (for duplicate detection)
    if (data.orderId) {
      variables.orderId = data.orderId;
    }

    return await this.sendEmail(
      storeId,
      templateIdentifier,
      data.recipientEmail,
      variables,
      data.languageCode || 'en',
      data.attachments || []
    );
  }

  /**
   * Build variables for signup email
   * @param {Object} data - Signup data
   * @returns {Object} Variables
   */
  buildSignupVariables(data) {
    const { customer, store } = data;

    return {
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_first_name: customer.first_name,
      customer_email: customer.email,
      store_name: store?.name || 'Our Store',
      store_logo_url: store?.logo_url || FALLBACK_LOGO_URL,
      store_url: store?.store_url || process.env.CORS_ORIGIN,
      login_url: store?.login_url || `${process.env.CORS_ORIGIN}/login`,
      signup_date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      current_year: new Date().getFullYear()
    };
  }

  /**
   * Build variables for credit purchase email
   * @param {Object} data - Credit purchase data
   * @returns {Object} Variables
   */
  buildCreditPurchaseVariables(data) {
    const { customer, transaction, store } = data;

    return {
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_first_name: customer.first_name,
      customer_email: customer.email,
      store_name: store?.name || 'Our Store',
      store_logo_url: store?.logo_url || FALLBACK_LOGO_URL,
      store_url: store?.store_url || process.env.CORS_ORIGIN,
      credits_purchased: transaction.credits_purchased,
      amount_usd: `$${parseFloat(transaction.amount_usd).toFixed(2)}`,
      transaction_id: transaction.id,
      balance: transaction.balance || 'N/A',
      purchase_date: new Date(transaction.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      payment_method: transaction.metadata?.payment_method || 'Credit Card',
      current_year: new Date().getFullYear()
    };
  }

  /**
   * Build variables for order success email
   * @param {Object} data - Order data
   * @returns {Promise<Object>} Variables
   */
  async buildOrderSuccessVariables(data) {
    const { order, customer, store } = data;

    // Format order items as HTML table
    const itemsHtml = formatOrderItemsHtml(order.OrderItems || []);

    // Format addresses
    const shippingAddress = formatAddress(order.shipping_address);
    const billingAddress = formatAddress(order.billing_address);

    // Determine payment status display text
    const paymentStatusRaw = order.payment_status || 'pending';
    const paymentStatusDisplay = paymentStatusRaw === 'paid' ? 'Paid' :
                                  paymentStatusRaw === 'refunded' ? 'Refunded' :
                                  paymentStatusRaw === 'partially_refunded' ? 'Partially Refunded' :
                                  'Pending Payment';

    const storeUrl = store?.store_url || process.env.CORS_ORIGIN;

    return {
      customer_name: `${customer.first_name} ${customer.last_name}`,
      customer_first_name: customer.first_name,
      customer_email: customer.email || order.customer_email,
      store_name: store?.name || 'Our Store',
      store_logo_url: store?.logo_url || FALLBACK_LOGO_URL,
      order_number: order.order_number,
      order_date: new Date(order.createdAt || order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      order_total: `$${parseFloat(order.total_amount).toFixed(2)}`,
      order_subtotal: `$${parseFloat(order.subtotal_amount || order.total_amount).toFixed(2)}`,
      order_tax: `$${parseFloat(order.tax_amount || 0).toFixed(2)}`,
      order_shipping: `$${parseFloat(order.shipping_amount || 0).toFixed(2)}`,
      items_html: itemsHtml,
      items_count: order.OrderItems?.length || 0,
      shipping_address: shippingAddress,
      billing_address: billingAddress,
      payment_method: order.payment_method || 'Credit Card',
      payment_status: paymentStatusDisplay,
      payment_status_raw: paymentStatusRaw,
      is_payment_pending: paymentStatusRaw !== 'paid',
      tracking_url: order.tracking_url || '#',
      order_status: order.status || 'Processing',
      estimated_delivery: order.estimated_delivery || 'TBD',
      store_url: storeUrl,
      login_url: store?.login_url || `${storeUrl}/login`,
      order_details_url: `${storeUrl}/order/${order.id}`,
      current_year: new Date().getFullYear()
    };
  }

  /**
   * Process email_header and email_footer placeholders
   * Replaces {{email_header}} and {{email_footer}} with actual template content
   * @param {string} storeId - Store ID
   * @param {string} content - Email content with placeholders
   * @param {string} languageCode - Language code for translations
   * @returns {Promise<string>} Content with header/footer replaced
   */
  async processHeaderFooter(storeId, content, languageCode = 'en') {
    let processedContent = content;

    try {
      // Get tenant database connection
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Get header template if needed
      if (content.includes('{{email_header}}')) {
        // Query by identifier only (storeId is tenant identifier, not store UUID)
        const { data: headerTemplate, error: headerError } = await tenantDb
          .from('email_templates')
          .select('*')
          .eq('identifier', 'email_header')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!headerError && headerTemplate) {
          // Get header translation
          const { data: headerTranslations } = await tenantDb
            .from('email_template_translations')
            .select('*')
            .eq('email_template_id', headerTemplate.id)
            .eq('language_code', languageCode);

          const headerTranslation = headerTranslations?.[0];
          const headerHtml = headerTranslation?.html_content || headerTemplate.html_content || '';
          processedContent = processedContent.replace('{{email_header}}', headerHtml);
        } else {
          // If no header template found, just remove the placeholder
          processedContent = processedContent.replace('{{email_header}}', '');
        }
      }

      // Get footer template if needed
      if (content.includes('{{email_footer}}')) {
        // Query by identifier only (storeId is tenant identifier, not store UUID)
        const { data: footerTemplate, error: footerError } = await tenantDb
          .from('email_templates')
          .select('*')
          .eq('identifier', 'email_footer')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!footerError && footerTemplate) {
          // Get footer translation
          const { data: footerTranslations } = await tenantDb
            .from('email_template_translations')
            .select('*')
            .eq('email_template_id', footerTemplate.id)
            .eq('language_code', languageCode);

          const footerTranslation = footerTranslations?.[0];
          const footerHtml = footerTranslation?.html_content || footerTemplate.html_content || '';
          processedContent = processedContent.replace('{{email_footer}}', footerHtml);
        } else {
          // If no footer template found, just remove the placeholder
          processedContent = processedContent.replace('{{email_footer}}', '');
        }
      }

      return processedContent;
    } catch (error) {
      console.error('Error processing header/footer:', error);
      // Return content as-is if processing fails
      return content;
    }
  }

  /**
   * Log email send attempt
   * @param {string} storeId - Store ID
   * @param {string} templateId - Email template ID
   * @param {string} recipientEmail - Recipient email
   * @param {string} subject - Email subject
   * @param {string} status - Send status
   * @param {string} brevoMessageId - Brevo message ID
   * @param {string} errorMessage - Error message if failed
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Log entry
   */
  async logEmail(storeId, templateId, recipientEmail, subject, status, brevoMessageId, errorMessage, metadata) {
    try {
      // Get tenant database connection
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Get the actual store UUID (storeId is tenant identifier, not store UUID)
      const { data: store } = await tenantDb
        .from('stores')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (!store?.id) {
        console.error('Failed to log email: No active store found');
        return null;
      }

      const { data, error } = await tenantDb
        .from('email_send_logs')
        .insert({
          store_id: store.id,
          email_template_id: templateId,
          recipient_email: recipientEmail,
          subject,
          status,
          brevo_message_id: brevoMessageId,
          error_message: errorMessage,
          metadata,
          sent_at: status === 'sent' ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to log email:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to log email:', error.message);
      // Don't throw error - logging failure shouldn't break email sending
    }
  }

  /**
   * Send test email with example data
   * @param {string} storeId - Store ID
   * @param {string} templateIdentifier - Template identifier
   * @param {string} testEmail - Test email address
   * @param {string} languageCode - Language code
   * @returns {Promise<Object>} Send result
   */
  async sendTestEmail(storeId, templateIdentifier, testEmail, languageCode = 'en') {
    const exampleData = getExampleData(templateIdentifier);

    // Get full store data from tenant DB
    const fullStoreData = await this.getFullStoreData(storeId);

    exampleData.store_name = fullStoreData.name;
    exampleData.store_url = fullStoreData.store_url;
    exampleData.store_logo_url = fullStoreData.logo_url;
    exampleData.login_url = fullStoreData.login_url;

    return await this.sendEmail(
      storeId,
      templateIdentifier,
      testEmail,
      exampleData,
      languageCode
    );
  }

  /**
   * Send team invitation email
   * Uses the MASTER Brevo account (dainostore) instead of store-specific config
   * This is a platform-level email, not tied to individual store email settings
   * @param {string} storeId - Store ID (for logging purposes)
   * @param {Object} invitation - Invitation data
   * @param {Object} store - Store data
   * @param {Object} inviter - Inviter user data
   * @returns {Promise<Object>} Send result
   */
  async sendTeamInvitationEmail(storeId, invitation, store, inviter) {
    try {
      console.log(`📧 [EMAIL SERVICE] Sending team invitation email to: ${invitation.invited_email}`);

      // Use master email service for team invitations (platform-level emails)
      const masterEmailService = require('./master-email-service');

      // Check if master Brevo is configured
      if (!masterEmailService.isConfigured) {
        console.warn(`⚠️ [EMAIL SERVICE] Master Brevo not configured, skipping invitation email`);
        console.warn(`⚠️ [EMAIL SERVICE] Set MASTER_BREVO_API_KEY or BREVO_API_KEY environment variable`);
        return {
          success: false,
          message: 'Master email service not configured. Set MASTER_BREVO_API_KEY environment variable.'
        };
      }

      // Use master email template
      const { teamInvitationEmail, PLATFORM_NAME } = require('./master-email-templates');

      const inviteUrl = `${process.env.FRONTEND_URL || 'https://www.dainostore.com'}/accept-invitation/${invitation.invitation_token}`;
      const expiresDate = new Date(invitation.expires_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Clean store name - remove "store" prefix if present (case insensitive)
      const rawStoreName = store.name || 'Your Store';
      const storeName = rawStoreName.replace(/^store\s+/i, '').trim();
      const subject = `You've been invited to join ${storeName} on ${PLATFORM_NAME}`;

      const htmlContent = teamInvitationEmail({
        inviteeEmail: invitation.invited_email,
        inviterName: inviter.first_name ? `${inviter.first_name} ${inviter.last_name || ''}`.trim() : null,
        inviterEmail: inviter.email,
        storeName: storeName,
        role: invitation.role,
        message: invitation.message,
        inviteUrl,
        expiresDate
      });

      // Send via master email service (uses MASTER_BREVO_API_KEY)
      const result = await masterEmailService.sendEmail(invitation.invited_email, subject, htmlContent);

      if (result.success) {
        console.log(`✅ [EMAIL SERVICE] Team invitation email sent to ${invitation.invited_email} via master Brevo`);
      } else {
        console.warn(`⚠️ [EMAIL SERVICE] Team invitation email failed: ${result.message}`);
      }

      return result;
    } catch (error) {
      console.error('❌ [EMAIL SERVICE] Failed to send team invitation email:', error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get email statistics for a store
   * @param {string} storeId - Store ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} Statistics
   */
  async getEmailStatistics(storeId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Query all logs for this tenant (storeId is tenant identifier, not store UUID)
    const { data: logs, error } = await tenantDb
      .from('email_send_logs')
      .select('status')
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Failed to fetch email statistics:', error.message);
      return {
        total: 0,
        sent: 0,
        failed: 0,
        pending: 0,
        delivered: 0,
        opened: 0,
        clicked: 0
      };
    }

    const stats = {
      total: logs.length,
      sent: logs.filter(l => l.status === 'sent').length,
      failed: logs.filter(l => l.status === 'failed').length,
      pending: logs.filter(l => l.status === 'pending').length,
      delivered: logs.filter(l => l.status === 'delivered').length,
      opened: logs.filter(l => l.status === 'opened').length,
      clicked: logs.filter(l => l.status === 'clicked').length
    };

    return stats;
  }
}

module.exports = new EmailService();
