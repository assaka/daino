/**
 * Email Template Variables Service
 * Defines available variables for each email template type
 */

const Handlebars = require('handlebars');

const EMAIL_VARIABLES = {
  // Signup/Welcome Email Variables
  signup_email: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{customer_email}}', description: 'Customer email address', example: 'john@example.com' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{login_url}}', description: 'Customer login URL', example: 'https://mystore.com/login' },
    { key: '{{signup_date}}', description: 'Signup date', example: 'January 15, 2025' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Credit Purchase Email Variables
  credit_purchase_email: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{customer_email}}', description: 'Customer email address', example: 'john@example.com' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{credits_purchased}}', description: 'Number of credits purchased', example: '100' },
    { key: '{{amount_usd}}', description: 'Purchase amount in USD', example: '$10.00' },
    { key: '{{transaction_id}}', description: 'Transaction ID', example: 'TXN-12345' },
    { key: '{{balance}}', description: 'Current credit balance', example: '150' },
    { key: '{{purchase_date}}', description: 'Purchase date', example: 'January 15, 2025' },
    { key: '{{payment_method}}', description: 'Payment method used', example: 'Visa ending in 4242' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Email Verification Variables
  email_verification: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{customer_email}}', description: 'Customer email address', example: 'john@example.com' },
    { key: '{{verification_code}}', description: '6-digit verification code', example: '123456' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Order Success Email Variables
  order_success_email: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{customer_email}}', description: 'Customer email address', example: 'john@example.com' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{order_number}}', description: 'Order number', example: 'ORD-12345' },
    { key: '{{order_date}}', description: 'Order date', example: 'January 15, 2025' },
    { key: '{{order_total}}', description: 'Order total amount', example: '$125.99' },
    { key: '{{order_subtotal}}', description: 'Order subtotal (before tax/shipping)', example: '$100.00' },
    { key: '{{order_tax}}', description: 'Tax amount', example: '$10.00' },
    { key: '{{order_shipping}}', description: 'Shipping cost', example: '$15.99' },
    { key: '{{items_html}}', description: 'HTML table of order items', example: '<table>...</table>' },
    { key: '{{items_count}}', description: 'Number of items in order', example: '3' },
    { key: '{{shipping_address}}', description: 'Shipping address', example: '123 Main St, City, State 12345' },
    { key: '{{billing_address}}', description: 'Billing address', example: '123 Main St, City, State 12345' },
    { key: '{{payment_method}}', description: 'Payment method', example: 'Credit Card' },
    { key: '{{payment_status}}', description: 'Payment status (Paid, Pending Payment, Refunded)', example: 'Pending Payment' },
    { key: '{{payment_status_raw}}', description: 'Raw payment status value (paid, pending, refunded)', example: 'pending' },
    { key: '{{is_payment_pending}}', description: 'Boolean - true if payment is not yet paid', example: 'true' },
    { key: '{{tracking_url}}', description: 'Shipment tracking URL', example: 'https://track.example.com/12345' },
    { key: '{{order_status}}', description: 'Order status', example: 'Processing' },
    { key: '{{estimated_delivery}}', description: 'Estimated delivery date', example: 'January 20-22, 2025' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{order_details_url}}', description: 'Link to view order details', example: 'https://mystore.com/order/12345' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Password Reset Email Variables
  password_reset: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{reset_url}}', description: 'Password reset URL', example: 'https://mystore.com/reset-password?token=abc123' },
    { key: '{{reset_link}}', description: 'Password reset link (alias)', example: 'https://mystore.com/reset-password?token=abc123' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{expiry_hours}}', description: 'Link expiry time in hours', example: '1' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Password Reset Confirmation Email Variables
  password_reset_confirmation: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{login_url}}', description: 'Login URL', example: 'https://mystore.com/login' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Stock Issue Customer Email Variables
  stock_issue_customer: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{order_number}}', description: 'Order number', example: 'ORD-12345' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{items_list}}', description: 'List of affected items', example: 'Product A, Product B' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Stock Issue Admin Email Variables
  stock_issue_admin: [
    { key: '{{admin_name}}', description: 'Admin name', example: 'Admin' },
    { key: '{{order_number}}', description: 'Order number', example: 'ORD-12345' },
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_email}}', description: 'Customer email', example: 'john@example.com' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{items_list}}', description: 'List of affected items', example: 'Product A (qty: 2), Product B (qty: 1)' },
    { key: '{{order_url}}', description: 'Link to order in admin', example: 'https://mystore.com/admin/orders/12345' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Stock Issue Refunded Email Variables
  stock_issue_refunded: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{order_number}}', description: 'Order number', example: 'ORD-12345' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{refund_amount}}', description: 'Refund amount', example: '$25.00' },
    { key: '{{currency}}', description: 'Currency code', example: 'USD' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Invoice Email Variables
  invoice_email: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{customer_email}}', description: 'Customer email address', example: 'john@example.com' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{order_number}}', description: 'Order number', example: 'ORD-12345' },
    { key: '{{invoice_number}}', description: 'Invoice number', example: 'INV-12345' },
    { key: '{{invoice_date}}', description: 'Invoice date', example: 'January 15, 2025' },
    { key: '{{order_total}}', description: 'Order total amount', example: '$125.99' },
    { key: '{{items_html}}', description: 'HTML table of order items', example: '<table>...</table>' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ],

  // Shipment Email Variables
  shipment_email: [
    { key: '{{customer_name}}', description: 'Customer full name', example: 'John Doe' },
    { key: '{{customer_first_name}}', description: 'Customer first name', example: 'John' },
    { key: '{{customer_email}}', description: 'Customer email address', example: 'john@example.com' },
    { key: '{{store_name}}', description: 'Store name', example: 'My Awesome Store' },
    { key: '{{store_logo_url}}', description: 'Store logo URL', example: 'https://mystore.com/logo.png' },
    { key: '{{order_number}}', description: 'Order number', example: 'ORD-12345' },
    { key: '{{tracking_number}}', description: 'Tracking number', example: '1Z999AA10123456784' },
    { key: '{{tracking_url}}', description: 'Tracking URL', example: 'https://track.example.com/12345' },
    { key: '{{carrier}}', description: 'Shipping carrier', example: 'UPS' },
    { key: '{{shipping_method}}', description: 'Shipping method', example: 'Ground' },
    { key: '{{estimated_delivery_date}}', description: 'Estimated delivery date', example: 'January 20, 2025' },
    { key: '{{items_html}}', description: 'HTML table of shipped items', example: '<table>...</table>' },
    { key: '{{store_url}}', description: 'Store URL', example: 'https://mystore.com' },
    { key: '{{current_year}}', description: 'Current year', example: '2025' }
  ]
};

/**
 * Get available variables for a specific email template type
 * @param {string} templateIdentifier - Email template identifier
 * @returns {Array} Array of variable objects
 */
function getVariablesForTemplate(templateIdentifier) {
  return EMAIL_VARIABLES[templateIdentifier] || [];
}

/**
 * Get all variable keys for a template (for validation)
 * @param {string} templateIdentifier - Email template identifier
 * @returns {Array<string>} Array of variable keys
 */
function getVariableKeys(templateIdentifier) {
  const variables = EMAIL_VARIABLES[templateIdentifier] || [];
  return variables.map(v => v.key);
}

/**
 * Render template by replacing variables with actual values
 * @param {string} template - Template string with {{variables}}
 * @param {Object} values - Object with variable values
 * @returns {string} Rendered template
 */
function renderTemplate(template, values) {
  if (!template) return '';

  // Clone values and mark HTML content as SafeString to prevent escaping
  const safeValues = { ...values };

  // Variables that contain HTML should not be escaped
  const htmlVariables = ['items_html', 'email_header', 'email_footer', 'shipping_address_html', 'billing_address_html'];

  htmlVariables.forEach(key => {
    if (safeValues[key] && typeof safeValues[key] === 'string') {
      safeValues[key] = new Handlebars.SafeString(safeValues[key]);
    }
  });

  // Use Handlebars for full template support ({{#if}}, {{#each}}, etc.)
  const compiledTemplate = Handlebars.compile(template);
  return compiledTemplate(safeValues);
}

/**
 * Generate example data for testing/preview
 * @param {string} templateIdentifier - Email template identifier
 * @returns {Object} Example data object
 */
function getExampleData(templateIdentifier) {
  const variables = EMAIL_VARIABLES[templateIdentifier] || [];
  const exampleData = {};

  variables.forEach(v => {
    const key = v.key.replace(/\{\{|\}\}/g, '');
    exampleData[key] = v.example;
  });

  return exampleData;
}

/**
 * Format order items as HTML table
 * @param {Array} items - Array of order items
 * @returns {string} HTML table
 */
function formatOrderItemsHtml(items) {
  if (!items || items.length === 0) {
    return '<p>No items</p>';
  }

  let html = '<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">';
  html += '<thead><tr style="background-color: #f8f9fa;">';
  html += '<th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">Product</th>';
  html += '<th style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">Quantity</th>';
  html += '<th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">Price</th>';
  html += '<th style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">Total</th>';
  html += '</tr></thead><tbody>';

  items.forEach(item => {
    html += '<tr>';

    // Product column with image and name
    html += '<td style="padding: 10px; border: 1px solid #dee2e6;">';
    html += '<div style="display: flex; align-items: center; gap: 10px;">';

    // Add product image if available
    if (item.product_image) {
      html += `<img src="${item.product_image}" alt="${item.product_name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;" />`;
    }

    html += `<span>${item.product_name}</span>`;
    html += '</div>';
    html += '</td>';

    html += `<td style="padding: 10px; text-align: center; border: 1px solid #dee2e6;">${item.quantity}</td>`;
    html += `<td style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">$${parseFloat(item.unit_price).toFixed(2)}</td>`;
    html += `<td style="padding: 10px; text-align: right; border: 1px solid #dee2e6;">$${parseFloat(item.total_price).toFixed(2)}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

/**
 * Format address as string
 * @param {Object} address - Address object
 * @returns {string} Formatted address
 */
function formatAddress(address) {
  if (!address) return 'N/A';

  const parts = [
    address.street,
    address.street_2,
    address.city,
    address.state,
    address.postal_code,
    address.country
  ].filter(Boolean);

  return parts.join(', ');
}

module.exports = {
  EMAIL_VARIABLES,
  getVariablesForTemplate,
  getVariableKeys,
  renderTemplate,
  getExampleData,
  formatOrderItemsHtml,
  formatAddress
};
