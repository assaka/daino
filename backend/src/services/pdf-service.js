const axios = require('axios');
const path = require('path');
const ConnectionManager = require('./database/ConnectionManager');

/**
 * PDF Generation Service
 * Generates PDFs from HTML templates for invoices, shipments, etc.
 * Supports {{email_header}} and {{email_footer}} placeholders for reusable layouts
 * (same templates used for both emails and PDFs for consistency)
 *
 * Uses separate PDF microservice (Docker + Chromium + Puppeteer)
 */

/**
 * Helper function to safely convert values to numbers for toFixed
 * Handles Sequelize Decimals, strings, and other types
 */
const safeNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
};

/**
 * Get the public store URL (custom domain or public URL)
 */
const getStoreUrl = (store) => {
  // Use custom domain if available
  if (store.custom_domain || store.primary_custom_domain) {
    return `https://${store.custom_domain || store.primary_custom_domain}`;
  }
  // Fall back to public URL
  const baseUrl = process.env.PUBLIC_STORE_BASE_URL || 'https://www.dainostore.com';
  return `${baseUrl}/public/${store.slug}`;
};

/**
 * Generate PDF from HTML using PDF microservice
 */
const generatePdfFromHtml = async (html, options = {}) => {
  const pdfServiceUrl = process.env.PDF_SERVICE_URL || 'http://localhost:3001';

  console.log(`📡 Calling PDF microservice at: ${pdfServiceUrl}`);

  try {
    const response = await axios.post(`${pdfServiceUrl}/generate-pdf`, {
      html,
      options
    }, {
      timeout: 30000 // 30 second timeout
    });

    if (!response.data.success) {
      throw new Error(response.data.error || 'PDF generation failed');
    }

    // Convert base64 back to Buffer
    const pdfBuffer = Buffer.from(response.data.pdf, 'base64');
    console.log(`✅ PDF received from microservice: ${pdfBuffer.length} bytes`);

    return pdfBuffer;
  } catch (error) {
    console.error('❌ PDF microservice error:', error.message);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

class PDFService {
  constructor() {
    this.options = {
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    };
  }

  /**
   * Process email_header and email_footer placeholders in PDF templates
   * Uses the same email header/footer templates for consistent branding
   * @param {string} storeId - Store ID
   * @param {string} content - PDF HTML content with placeholders
   * @param {string} languageCode - Language code for translation
   * @returns {Promise<string>} Content with header/footer replaced
   */
  async processHeaderFooter(storeId, content, languageCode = 'en') {
    let processedContent = content;

    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Get header template if needed (from email_templates table)
      if (content.includes('{{email_header}}')) {
        const { data: headerTemplate, error: headerError } = await tenantDb
          .from('email_templates')
          .select('id, store_id, identifier, is_active')
          .eq('store_id', storeId)
          .eq('identifier', 'email_header')
          .eq('is_active', true)
          .maybeSingle();

        if (headerError) {
          console.error('Error fetching header template:', headerError);
        }

        if (headerTemplate) {
          // Fetch translations for the header template
          const { data: headerTranslations, error: headerTransError } = await tenantDb
            .from('email_template_translations')
            .select('html_content, language_code')
            .eq('email_template_id', headerTemplate.id)
            .eq('language_code', languageCode);

          if (headerTransError) {
            console.error('Error fetching header translations:', headerTransError);
          }

          if (headerTranslations && headerTranslations.length > 0) {
            processedContent = processedContent.replace('{{email_header}}', headerTranslations[0].html_content || '');
          } else {
            // If no header template found, just remove the placeholder
            processedContent = processedContent.replace('{{email_header}}', '');
          }
        } else {
          // If no header template found, just remove the placeholder
          processedContent = processedContent.replace('{{email_header}}', '');
        }
      }

      // Get footer template if needed (from email_templates table)
      if (content.includes('{{email_footer}}')) {
        const { data: footerTemplate, error: footerError } = await tenantDb
          .from('email_templates')
          .select('id, store_id, identifier, is_active')
          .eq('store_id', storeId)
          .eq('identifier', 'email_footer')
          .eq('is_active', true)
          .maybeSingle();

        if (footerError) {
          console.error('Error fetching footer template:', footerError);
        }

        if (footerTemplate) {
          // Fetch translations for the footer template
          const { data: footerTranslations, error: footerTransError } = await tenantDb
            .from('email_template_translations')
            .select('html_content, language_code')
            .eq('email_template_id', footerTemplate.id)
            .eq('language_code', languageCode);

          if (footerTransError) {
            console.error('Error fetching footer translations:', footerTransError);
          }

          if (footerTranslations && footerTranslations.length > 0) {
            processedContent = processedContent.replace('{{email_footer}}', footerTranslations[0].html_content || '');
          } else {
            // If no footer template found, just remove the placeholder
            processedContent = processedContent.replace('{{email_footer}}', '');
          }
        } else {
          // If no footer template found, just remove the placeholder
          processedContent = processedContent.replace('{{email_footer}}', '');
        }
      }

      return processedContent;
    } catch (error) {
      console.error('Error processing header/footer in PDF:', error);
      // Return content as-is if processing fails
      return content;
    }
  }

  /**
   * Simple template rendering (replaces {{variable}} with values)
   * @param {string} template - Template string with {{placeholders}}
   * @param {Object} variables - Key-value pairs for replacement
   * @returns {string} Rendered template
   */
  renderTemplate(template, variables) {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, value || '');
    }
    return rendered;
  }

  /**
   * Prepare variables for invoice PDF
   */
  prepareInvoiceVariables(order, store, orderItems) {
    const formatAddress = (addr) => {
      if (!addr) return 'N/A';
      return `
        ${addr.full_name || addr.name || ''}<br>
        ${addr.address_line1 || addr.address || ''}<br>
        ${addr.address_line2 ? addr.address_line2 + '<br>' : ''}
        ${addr.city || ''}, ${addr.state || ''} ${addr.postal_code || addr.zip || ''}<br>
        ${addr.country || ''}
      `.trim();
    };

    const itemsRows = orderItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.product_name || 'Product'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${safeNumber(item.price).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${safeNumber(safeNumber(item.price) * (item.quantity || 1)).toFixed(2)}</td>
      </tr>
    `).join('');

    return {
      invoice_number: order.order_number || 'N/A',
      invoice_date: new Date(order.created_at).toLocaleDateString(),
      order_number: order.order_number || 'N/A',
      customer_name: `${order.billing_address?.full_name || order.billing_address?.name || 'Customer'}`,
      billing_address: formatAddress(order.billing_address),
      shipping_address: formatAddress(order.shipping_address),
      items_table_rows: itemsRows,
      order_subtotal: safeNumber(order.subtotal).toFixed(2),
      order_shipping: safeNumber(order.shipping_amount).toFixed(2),
      order_tax: safeNumber(order.tax_amount).toFixed(2),
      order_discount: safeNumber(order.discount_amount).toFixed(2),
      order_total: safeNumber(order.total_amount).toFixed(2),
      payment_method: order.payment_method || 'N/A',
      payment_status: order.payment_status ? order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1) : 'N/A',
      store_name: store.name || '',
      store_logo_url: store.logo_url || '',
      store_address: store.settings?.store_address || '',
      store_city: store.settings?.store_city || '',
      store_state: store.settings?.store_state || '',
      store_postal_code: store.settings?.store_postal_code || '',
      store_email: store.settings?.store_email || '',
      store_phone: store.settings?.store_phone || '',
      store_website: getStoreUrl(store),
      current_year: new Date().getFullYear()
    };
  }

  /**
   * Prepare variables for shipment PDF
   */
  prepareShipmentVariables(order, store, orderItems) {
    const formatAddress = (addr) => {
      if (!addr) return 'N/A';
      return `
        ${addr.full_name || addr.name || ''}<br>
        ${addr.address_line1 || addr.address || ''}<br>
        ${addr.address_line2 ? addr.address_line2 + '<br>' : ''}
        ${addr.city || ''}, ${addr.state || ''} ${addr.postal_code || addr.zip || ''}<br>
        ${addr.country || ''}
        ${addr.phone ? '<br>Phone: ' + addr.phone : ''}
      `.trim();
    };

    const itemsRows = orderItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.product_name || 'Product'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.sku || 'N/A'}</td>
      </tr>
    `).join('');

    return {
      order_number: order.order_number || 'N/A',
      ship_date: order.shipped_at ? new Date(order.shipped_at).toLocaleDateString() : new Date().toLocaleDateString(),
      tracking_number: order.tracking_number || 'N/A',
      tracking_url: order.tracking_url || '#',
      shipping_method: order.shipping_method || 'Standard Shipping',
      estimated_delivery_date: order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'TBD',
      delivery_instructions: order.delivery_instructions || '',
      shipping_address: formatAddress(order.shipping_address),
      items_table_rows: itemsRows,
      items_count: orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
      store_name: store.name || '',
      store_logo_url: store.logo_url || '',
      store_address: store.settings?.store_address || '',
      store_city: store.settings?.store_city || '',
      store_state: store.settings?.store_state || '',
      store_postal_code: store.settings?.store_postal_code || '',
      store_email: store.settings?.store_email || '',
      store_phone: store.settings?.store_phone || '',
      store_website: getStoreUrl(store),
      current_year: new Date().getFullYear()
    };
  }

  /**
   * Generate PDF header HTML
   */
  generatePDFHeader(store, type = 'invoice') {
    const logoUrl = store.logo_url || '';
    const storeName = store.name || '';

    return `
      <div style="text-align: center; padding: 20px; border-bottom: 3px solid #4f46e5; margin-bottom: 30px;">
        ${logoUrl ? `<img src="${logoUrl}" alt="${storeName}" style="max-width: 150px; max-height: 80px; margin-bottom: 10px;">` : ''}
        <h1 style="color: #333; font-size: 28px; margin: 10px 0;">${storeName}</h1>
        <p style="color: #666; font-size: 14px; margin: 5px 0;">
          ${store.settings?.store_address || ''} ${store.settings?.store_address_line2 || ''}<br>
          ${store.settings?.store_city || ''}, ${store.settings?.store_state || ''} ${store.settings?.store_postal_code || ''}<br>
          ${store.settings?.store_email || ''} | ${store.settings?.store_phone || ''}
        </p>
      </div>
    `;
  }

  /**
   * Generate PDF footer HTML
   */
  generatePDFFooter(store) {
    const currentYear = new Date().getFullYear();

    return `
      <div style="margin-top: 50px; padding-top: 20px; border-top: 2px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 5px 0;">Thank you for your business!</p>
        <p style="margin: 5px 0;">
          ${store.name || ''} | ${getStoreUrl(store)}
        </p>
        <p style="margin: 5px 0;">© ${currentYear} ${store.name || ''}. All rights reserved.</p>
      </div>
    `;
  }

  /**
   * Generate Invoice PDF from database template
   * Uses {{email_header}} and {{email_footer}} for consistent branding with emails
   */
  async generateInvoicePDF(order, store, orderItems, languageCode = 'en') {
    try {
      console.log('📋 Looking for PDF template:', {
        store_id: store.id,
        identifier: 'invoice_pdf',
        languageCode
      });

      const tenantDb = await ConnectionManager.getStoreConnection(store.id);

      // Get invoice PDF template from database
      const { data: pdfTemplate, error: templateError } = await tenantDb
        .from('pdf_templates')
        .select('id, store_id, identifier, is_active, settings')
        .eq('store_id', store.id)
        .eq('identifier', 'invoice_pdf')
        .eq('is_active', true)
        .maybeSingle();

      if (templateError) {
        console.error('Error fetching PDF template:', templateError);
        console.warn('⚠️ Database error, using legacy method');
        return this.generateInvoicePDFLegacy(order, store, orderItems);
      }

      if (!pdfTemplate) {
        console.warn('⚠️ No invoice PDF template found in database, using legacy method');
        return this.generateInvoicePDFLegacy(order, store, orderItems);
      }

      console.log('✅ PDF template found:', pdfTemplate.id);

      // Get translations for the template
      const { data: translations, error: translationError } = await tenantDb
        .from('pdf_template_translations')
        .select('html_template, language_code')
        .eq('pdf_template_id', pdfTemplate.id)
        .eq('language_code', languageCode);

      if (translationError) {
        console.error('Error fetching PDF translations:', translationError);
      }

      console.log('📋 Translations available:', translations?.length || 0);

      // Get template HTML from translation
      const translation = translations && translations.length > 0 ? translations[0] : null;

      if (!translation) {
        console.warn(`⚠️ No ${languageCode} translation found for invoice PDF template, using legacy method`);
        console.log('💡 TIP: Add translations in Content → PDF Templates → Invoice PDF → Translations');
        return this.generateInvoicePDFLegacy(order, store, orderItems);
      }

      console.log('✅ Using database PDF template with translation');
      let html = translation.html_template;

      // Process {{email_header}} and {{email_footer}} placeholders
      html = await this.processHeaderFooter(store.id, html, languageCode);

      // Prepare variables
      const variables = this.prepareInvoiceVariables(order, store, orderItems);

      // Render template with variables
      html = this.renderTemplate(html, variables);

      // Generate PDF with template settings
      const options = {
        ...this.options,
        format: pdfTemplate.settings?.page_size || 'A4',
        landscape: pdfTemplate.settings?.orientation === 'landscape',
        margin: pdfTemplate.settings?.margins || this.options.margin
      };

      return await generatePdfFromHtml(html, options);
    } catch (error) {
      console.error('Error generating invoice PDF from template:', error);
      console.warn('Falling back to legacy method');
      return this.generateInvoicePDFLegacy(order, store, orderItems);
    }
  }

  /**
   * Legacy fallback - Generate Invoice PDF without database template
   */
  async generateInvoicePDFLegacy(order, store, orderItems) {
    const header = this.generatePDFHeader(store, 'invoice');
    const footer = this.generatePDFFooter(store);

    // Format billing and shipping addresses
    const formatAddress = (addr) => {
      if (!addr) return 'N/A';
      return `
        ${addr.full_name || addr.name || ''}<br>
        ${addr.address_line1 || addr.address || ''}<br>
        ${addr.address_line2 ? addr.address_line2 + '<br>' : ''}
        ${addr.city || ''}, ${addr.state || ''} ${addr.postal_code || addr.zip || ''}<br>
        ${addr.country || ''}
      `;
    };

    // Generate items table
    const itemsHTML = orderItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.product_name || 'Product'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${safeNumber(item.price).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${safeNumber(safeNumber(item.price) * (item.quantity || 1)).toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .info-section {
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .total-section {
            background-color: #eff6ff;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${header}

          <div style="text-align: right; margin-bottom: 30px;">
            <h2 style="color: #4f46e5; margin: 0;">INVOICE</h2>
            <p style="font-size: 14px; color: #666; margin: 5px 0;">
              <strong>Invoice #:</strong> ${order.order_number || 'N/A'}<br>
              <strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}<br>
              <strong>Order #:</strong> ${order.order_number || 'N/A'}
            </p>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div style="width: 48%;" class="info-section">
              <h3 style="color: #4f46e5; margin-top: 0;">Bill To:</h3>
              <p style="margin: 0; font-size: 14px;">
                ${formatAddress(order.billing_address)}
              </p>
            </div>
            <div style="width: 48%;" class="info-section">
              <h3 style="color: #10b981; margin-top: 0;">Ship To:</h3>
              <p style="margin: 0; font-size: 14px;">
                ${formatAddress(order.shipping_address)}
              </p>
            </div>
          </div>

          <h3 style="color: #333; margin-bottom: 15px;">Order Items</h3>
          <table>
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          <div class="total-section">
            <table>
              <tr>
                <td style="padding: 5px 0; font-size: 14px;">Subtotal:</td>
                <td style="padding: 5px 0; text-align: right; font-size: 14px;">$${safeNumber(order.subtotal).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 14px;">Shipping:</td>
                <td style="padding: 5px 0; text-align: right; font-size: 14px;">$${safeNumber(order.shipping_amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 14px;">Tax:</td>
                <td style="padding: 5px 0; text-align: right; font-size: 14px;">$${safeNumber(order.tax_amount).toFixed(2)}</td>
              </tr>
              ${order.discount_amount && parseFloat(order.discount_amount) > 0 ? `
              <tr>
                <td style="padding: 5px 0; font-size: 14px; color: #10b981;">Discount:</td>
                <td style="padding: 5px 0; text-align: right; font-size: 14px; color: #10b981;">-$${safeNumber(order.discount_amount).toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr style="border-top: 2px solid #4f46e5;">
                <td style="padding: 10px 0 0 0; font-size: 18px; font-weight: bold;">Total:</td>
                <td style="padding: 10px 0 0 0; text-align: right; font-size: 18px; font-weight: bold; color: #4f46e5;">$${safeNumber(order.total_amount).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          ${order.payment_method ? `
          <div style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Payment Method:</strong> ${order.payment_method}<br>
              ${order.payment_status ? `<strong>Payment Status:</strong> ${order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}` : ''}
            </p>
          </div>
          ` : ''}

          ${order.notes ? `
          <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Order Notes:</strong><br>
              ${order.notes}
            </p>
          </div>
          ` : ''}

          ${footer}
        </div>
      </body>
      </html>
    `;

    return await generatePdfFromHtml(html, this.options);
  }

  /**
   * Generate Shipment PDF
   */
  /**
   * Generate Shipment PDF from database template
   * Uses {{email_header}} and {{email_footer}} for consistent branding with emails
   */
  async generateShipmentPDF(order, store, orderItems, languageCode = 'en') {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(store.id);

      // Get shipment PDF template from database
      const { data: pdfTemplate, error: templateError } = await tenantDb
        .from('pdf_templates')
        .select('id, store_id, identifier, is_active, settings')
        .eq('store_id', store.id)
        .eq('identifier', 'shipment_pdf')
        .eq('is_active', true)
        .maybeSingle();

      if (templateError) {
        console.error('Error fetching shipment PDF template:', templateError);
        console.warn('Database error, using legacy method');
        return this.generateShipmentPDFLegacy(order, store, orderItems);
      }

      if (!pdfTemplate) {
        console.warn('No shipment PDF template found, using legacy method');
        return this.generateShipmentPDFLegacy(order, store, orderItems);
      }

      // Get translations for the template
      const { data: translations, error: translationError } = await tenantDb
        .from('pdf_template_translations')
        .select('html_template, language_code')
        .eq('pdf_template_id', pdfTemplate.id)
        .eq('language_code', languageCode);

      if (translationError) {
        console.error('Error fetching shipment PDF translations:', translationError);
      }

      // Get template HTML from translation
      const translation = translations && translations.length > 0 ? translations[0] : null;

      if (!translation) {
        console.warn(`No ${languageCode} translation found for shipment PDF, using legacy method`);
        return this.generateShipmentPDFLegacy(order, store, orderItems);
      }

      let html = translation.html_template;

      // Process {{email_header}} and {{email_footer}} placeholders
      html = await this.processHeaderFooter(store.id, html, languageCode);

      // Prepare variables
      const variables = this.prepareShipmentVariables(order, store, orderItems);

      // Render template with variables
      html = this.renderTemplate(html, variables);

      // Generate PDF with template settings
      const options = {
        ...this.options,
        format: pdfTemplate.settings?.page_size || 'A4',
        landscape: pdfTemplate.settings?.orientation === 'landscape',
        margin: pdfTemplate.settings?.margins || this.options.margin
      };

      return await generatePdfFromHtml(html, options);
    } catch (error) {
      console.error('Error generating shipment PDF from template:', error);
      console.warn('Falling back to legacy method');
      return this.generateShipmentPDFLegacy(order, store, orderItems);
    }
  }

  /**
   * Legacy fallback - Generate Shipment PDF without database template
   */
  async generateShipmentPDFLegacy(order, store, orderItems) {
    const header = this.generatePDFHeader(store, 'shipment');
    const footer = this.generatePDFFooter(store);

    // Format shipping address
    const formatAddress = (addr) => {
      if (!addr) return 'N/A';
      return `
        ${addr.full_name || addr.name || ''}<br>
        ${addr.address_line1 || addr.address || ''}<br>
        ${addr.address_line2 ? addr.address_line2 + '<br>' : ''}
        ${addr.city || ''}, ${addr.state || ''} ${addr.postal_code || addr.zip || ''}<br>
        ${addr.country || ''}
        ${addr.phone ? '<br>Phone: ' + addr.phone : ''}
      `;
    };

    // Generate items table
    const itemsHTML = orderItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.product_name || 'Product'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.sku || 'N/A'}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          .info-section {
            background-color: #f0fdf4;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #10b981;
          }
          .tracking-section {
            background-color: #eff6ff;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
            border: 2px solid #3b82f6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${header}

          <div style="text-align: right; margin-bottom: 30px;">
            <h2 style="color: #10b981; margin: 0;">SHIPMENT NOTICE</h2>
            <p style="font-size: 14px; color: #666; margin: 5px 0;">
              <strong>Order #:</strong> ${order.order_number || 'N/A'}<br>
              <strong>Ship Date:</strong> ${order.shipped_at ? new Date(order.shipped_at).toLocaleDateString() : new Date().toLocaleDateString()}
            </p>
          </div>

          ${order.tracking_number ? `
          <div class="tracking-section">
            <h3 style="color: #3b82f6; margin-top: 0;">Tracking Information</h3>
            <p style="font-size: 24px; font-weight: bold; margin: 15px 0; font-family: monospace; letter-spacing: 2px;">
              ${order.tracking_number}
            </p>
            <p style="font-size: 14px; color: #666;">
              <strong>Shipping Method:</strong> ${order.shipping_method || 'Standard Shipping'}
            </p>
          </div>
          ` : ''}

          <div class="info-section">
            <h3 style="color: #10b981; margin-top: 0;">Shipping Address</h3>
            <p style="margin: 0; font-size: 16px;">
              ${formatAddress(order.shipping_address)}
            </p>
          </div>

          ${order.delivery_instructions ? `
          <div style="padding: 15px; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #92400e;">Delivery Instructions</h4>
            <p style="margin: 0; font-size: 14px;">
              ${order.delivery_instructions}
            </p>
          </div>
          ` : ''}

          <h3 style="color: #333; margin-bottom: 15px; margin-top: 30px;">Package Contents</h3>
          <table>
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">SKU</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>

          <div style="margin-top: 30px; padding: 20px; background-color: #f0fdf4; border-radius: 8px; text-align: center;">
            <p style="font-size: 16px; color: #065f46; margin: 0; font-weight: bold;">
              Total Items: ${orderItems.reduce((sum, item) => sum + (item.quantity || 0), 0)}
            </p>
          </div>

          ${footer}
        </div>
      </body>
      </html>
    `;

    return await generatePdfFromHtml(html, this.options);
  }

  /**
   * Get PDF filename for invoice
   */
  getInvoiceFilename(order) {
    return `invoice-${order.order_number}.pdf`;
  }

  /**
   * Get PDF filename for shipment
   */
  getShipmentFilename(order) {
    return `shipment-${order.order_number}.pdf`;
  }
}

module.exports = new PDFService();
