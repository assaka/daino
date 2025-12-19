/**
 * Migration Runner: Add Stock Issue Email Templates
 *
 * This migration adds three email templates for stock issue handling:
 * - stock_issue_customer: Notify customer about potential stock issue
 * - stock_issue_admin: Notify store owner about stock issue
 * - stock_issue_refunded: Notify customer about refund
 *
 * Run with: node backend/src/database/migrations/run-add-stock-issue-email-templates.js
 */

const fs = require('fs');
const path = require('path');
const ConnectionManager = require('../src/services/database/ConnectionManager');
const { masterDbClient } = require('../src/database/masterConnection');

async function runMigration() {
  console.log('🚀 Starting stock issue email templates migration...');

  try {
    // Get all stores
    const { data: stores, error: storesError } = await masterDbClient
      .from('stores')
      .select('id, name')
      .eq('is_active', true);

    if (storesError) {
      throw new Error(`Failed to fetch stores: ${storesError.message}`);
    }

    console.log(`📦 Found ${stores.length} active stores`);

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'add-stock-issue-email-templates.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Process each store
    for (const store of stores) {
      console.log(`\n📧 Processing store: ${store.name} (${store.id})`);

      try {
        const tenantDb = await ConnectionManager.getStoreConnection(store.id);

        // Check if templates already exist
        const { data: existingTemplates } = await tenantDb
          .from('email_templates')
          .select('identifier')
          .in('identifier', ['stock_issue_customer', 'stock_issue_admin', 'stock_issue_refunded']);

        const existingIds = (existingTemplates || []).map(t => t.identifier);
        console.log(`  Existing templates: ${existingIds.length > 0 ? existingIds.join(', ') : 'none'}`);

        // Insert templates that don't exist
        const templates = [
          {
            identifier: 'stock_issue_customer',
            subject: 'Update on your order #{{order_number}} - {{store_name}}',
            variables: '["customer_first_name", "order_number", "store_name", "store_url", "items_list"]'
          },
          {
            identifier: 'stock_issue_admin',
            subject: 'ACTION REQUIRED: Stock issue on order #{{order_number}}',
            variables: '["order_number", "order_id", "customer_email", "customer_name", "items_list", "store_name", "admin_url"]'
          },
          {
            identifier: 'stock_issue_refunded',
            subject: 'Your order #{{order_number}} has been refunded - {{store_name}}',
            variables: '["customer_first_name", "order_number", "store_name", "store_url", "refund_amount", "currency"]'
          }
        ];

        for (const template of templates) {
          if (!existingIds.includes(template.identifier)) {
            console.log(`  ✅ Creating template: ${template.identifier}`);

            // Insert email template
            const { data: insertedTemplate, error: insertError } = await tenantDb
              .from('email_templates')
              .insert({
                store_id: store.id,
                identifier: template.identifier,
                content_type: 'both',
                variables: template.variables,
                is_active: true,
                sort_order: template.identifier === 'stock_issue_customer' ? 25 :
                           template.identifier === 'stock_issue_admin' ? 26 : 27,
                attachment_enabled: false,
                attachment_config: {},
                is_system: true,
                default_subject: template.subject,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single();

            if (insertError) {
              console.log(`  ❌ Failed to create ${template.identifier}: ${insertError.message}`);
              continue;
            }

            // Insert translation
            const { error: translationError } = await tenantDb
              .from('email_template_translations')
              .insert({
                email_template_id: insertedTemplate.id,
                language_code: 'en',
                subject: template.subject,
                template_content: getTemplateContent(template.identifier),
                html_content: getHtmlContent(template.identifier),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });

            if (translationError) {
              console.log(`  ⚠️ Translation insert warning for ${template.identifier}: ${translationError.message}`);
            }
          } else {
            console.log(`  ⏭️ Skipping ${template.identifier} (already exists)`);
          }
        }
      } catch (storeError) {
        console.error(`  ❌ Error processing store ${store.name}: ${storeError.message}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

function getTemplateContent(identifier) {
  const templates = {
    stock_issue_customer: `Hi {{customer_first_name}},

Thank you for your order #{{order_number}} at {{store_name}}.

We wanted to let you know that we are currently reviewing your order. We may have detected a potential availability issue with one or more items in your order, and our team is working to resolve this as quickly as possible.

Items being reviewed:
{{items_list}}

We sincerely apologize for any inconvenience this may cause. We will contact you shortly with an update on your order status.

If you have any questions in the meantime, please don't hesitate to reach out to us.

Best regards,
{{store_name}} Team`,

    stock_issue_admin: `Stock Issue Alert - Order #{{order_number}}

A stock issue has been detected for the following order:

Order Number: {{order_number}}
Customer: {{customer_name}}
Email: {{customer_email}}

Items with insufficient stock:
{{items_list}}

Please review this order and take appropriate action:
- Process a refund
- Wait for restock and contact customer
- Offer alternative products

View order in admin: {{admin_url}}

Best regards,
{{store_name}} System`,

    stock_issue_refunded: `Hi {{customer_first_name}},

We are writing to inform you that your order #{{order_number}} has been refunded.

Unfortunately, due to an inventory discrepancy, we were unable to fulfill your order. We sincerely apologize for any inconvenience this may have caused.

Refund Details:
- Order Number: #{{order_number}}
- Refund Amount: {{currency}} {{refund_amount}}

The refund has been processed and should appear in your account within 5-10 business days, depending on your payment provider.

We truly value you as a customer and hope you will give us another opportunity to serve you. Please feel free to browse our store for alternative products.

If you have any questions or concerns, please don't hesitate to contact us.

Best regards,
{{store_name}} Team`
  };

  return templates[identifier] || '';
}

function getHtmlContent(identifier) {
  const templates = {
    stock_issue_customer: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f59e0b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Order Update</h1>
  </div>
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>Thank you for your order <strong>#{{order_number}}</strong> at {{store_name}}.</p>
    <p>We wanted to let you know that we are currently reviewing your order. We may have detected a potential availability issue with one or more items, and our team is working to resolve this as quickly as possible.</p>
    <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #92400e;">Items being reviewed:</p>
      <pre style="margin: 0; white-space: pre-wrap; color: #92400e; font-family: inherit;">{{items_list}}</pre>
    </div>
    <p>We sincerely apologize for any inconvenience this may cause. We will contact you shortly with an update on your order status.</p>
    <p style="color: #666;">If you have any questions in the meantime, please don't hesitate to reach out to us.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      Best regards,<br>{{store_name}} Team<br>
      <a href="{{store_url}}" style="color: #667eea;">{{store_url}}</a>
    </p>
  </div>
</div>`,

    stock_issue_admin: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #dc2626; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Stock Issue Alert</h1>
  </div>
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
      <p style="margin: 0; font-weight: bold; color: #991b1b;">Action Required</p>
      <p style="margin: 10px 0 0 0; color: #991b1b;">A stock issue has been detected and requires your attention.</p>
    </div>
    <h3 style="color: #333; margin-bottom: 15px;">Order Details</h3>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Order Number:</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>#{{order_number}}</strong></td></tr>
      <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Customer:</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">{{customer_name}}</td></tr>
      <tr><td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #666;">Email:</td><td style="padding: 8px 0; border-bottom: 1px solid #eee;">{{customer_email}}</td></tr>
    </table>
    <h3 style="color: #333; margin-bottom: 15px;">Items with Insufficient Stock</h3>
    <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <pre style="margin: 0; white-space: pre-wrap; color: #991b1b; font-family: inherit;">{{items_list}}</pre>
    </div>
    <h3 style="color: #333; margin-bottom: 15px;">Recommended Actions</h3>
    <ul style="color: #666; padding-left: 20px;">
      <li>Process a full or partial refund</li>
      <li>Wait for restock and contact customer</li>
      <li>Offer alternative products</li>
    </ul>
    <p style="text-align: center; margin-top: 30px;">
      <a href="{{admin_url}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        View Order in Admin
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      This is an automated message from {{store_name}}.
    </p>
  </div>
</div>`,

    stock_issue_refunded: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #667eea; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Order Refunded</h1>
  </div>
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>We are writing to inform you that your order <strong>#{{order_number}}</strong> has been refunded.</p>
    <p>Unfortunately, due to an inventory discrepancy, we were unable to fulfill your order. We sincerely apologize for any inconvenience this may have caused.</p>
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 15px 0; color: #333;">Refund Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #666;">Order Number:</td><td style="padding: 8px 0; text-align: right;"><strong>#{{order_number}}</strong></td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Refund Amount:</td><td style="padding: 8px 0; text-align: right; font-size: 18px; color: #059669;"><strong>{{currency}} {{refund_amount}}</strong></td></tr>
      </table>
    </div>
    <p style="color: #666;">The refund has been processed and should appear in your account within <strong>5-10 business days</strong>, depending on your payment provider.</p>
    <p>We truly value you as a customer and hope you will give us another opportunity to serve you.</p>
    <p style="text-align: center; margin-top: 30px;">
      <a href="{{store_url}}" style="background-color: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Continue Shopping
      </a>
    </p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      Best regards,<br>{{store_name}} Team<br>
      <a href="{{store_url}}" style="color: #667eea;">{{store_url}}</a>
    </p>
  </div>
</div>`
  };

  return templates[identifier] || '';
}

runMigration();
