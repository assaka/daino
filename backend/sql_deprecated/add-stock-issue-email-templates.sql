-- Migration: Add Stock Issue Email Templates
-- These templates are used for notifying customers and store owners about stock issues

-- 1. stock_issue_customer - Notify customer about potential stock issue
INSERT INTO email_templates ("id", "store_id", "identifier", "content_type", "variables", "is_active", "sort_order", "attachment_enabled", "attachment_config", "created_at", "updated_at", "is_system", "default_subject", "default_template_content", "default_html_content")
SELECT
  gen_random_uuid(),
  store_id,
  'stock_issue_customer',
  'both',
  '["customer_first_name", "order_number", "store_name", "store_url", "items_list"]',
  true,
  25,
  false,
  '{}',
  NOW(),
  NOW(),
  true,
  'Update on your order #{{order_number}} - {{store_name}}',
  'Hi {{customer_first_name}},

Thank you for your order #{{order_number}} at {{store_name}}.

We wanted to let you know that we are currently reviewing your order. We may have detected a potential availability issue with one or more items in your order, and our team is working to resolve this as quickly as possible.

Items being reviewed:
{{items_list}}

We sincerely apologize for any inconvenience this may cause. We will contact you shortly with an update on your order status.

If you have any questions in the meantime, please don''t hesitate to reach out to us.

Best regards,
{{store_name}} Team',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
    <p style="color: #666;">If you have any questions in the meantime, please don''t hesitate to reach out to us.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      Best regards,<br>{{store_name}} Team<br>
      <a href="{{store_url}}" style="color: #667eea;">{{store_url}}</a>
    </p>
  </div>
</div>'
FROM (SELECT DISTINCT store_id FROM email_templates WHERE store_id IS NOT NULL LIMIT 1) AS stores
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE identifier = 'stock_issue_customer')
ON CONFLICT DO NOTHING;

-- 2. stock_issue_admin - Notify store owner about stock issue
INSERT INTO email_templates ("id", "store_id", "identifier", "content_type", "variables", "is_active", "sort_order", "attachment_enabled", "attachment_config", "created_at", "updated_at", "is_system", "default_subject", "default_template_content", "default_html_content")
SELECT
  gen_random_uuid(),
  store_id,
  'stock_issue_admin',
  'both',
  '["order_number", "order_id", "customer_email", "customer_name", "items_list", "store_name", "admin_url"]',
  true,
  26,
  false,
  '{}',
  NOW(),
  NOW(),
  true,
  'ACTION REQUIRED: Stock issue on order #{{order_number}}',
  'Stock Issue Alert - Order #{{order_number}}

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
{{store_name}} System',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
</div>'
FROM (SELECT DISTINCT store_id FROM email_templates WHERE store_id IS NOT NULL LIMIT 1) AS stores
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE identifier = 'stock_issue_admin')
ON CONFLICT DO NOTHING;

-- 3. stock_issue_refunded - Notify customer about refund
INSERT INTO email_templates ("id", "store_id", "identifier", "content_type", "variables", "is_active", "sort_order", "attachment_enabled", "attachment_config", "created_at", "updated_at", "is_system", "default_subject", "default_template_content", "default_html_content")
SELECT
  gen_random_uuid(),
  store_id,
  'stock_issue_refunded',
  'both',
  '["customer_first_name", "order_number", "store_name", "store_url", "refund_amount", "currency"]',
  true,
  27,
  false,
  '{}',
  NOW(),
  NOW(),
  true,
  'Your order #{{order_number}} has been refunded - {{store_name}}',
  'Hi {{customer_first_name}},

We are writing to inform you that your order #{{order_number}} has been refunded.

Unfortunately, due to an inventory discrepancy, we were unable to fulfill your order. We sincerely apologize for any inconvenience this may have caused.

Refund Details:
- Order Number: #{{order_number}}
- Refund Amount: {{currency}} {{refund_amount}}

The refund has been processed and should appear in your account within 5-10 business days, depending on your payment provider.

We truly value you as a customer and hope you will give us another opportunity to serve you. Please feel free to browse our store for alternative products.

If you have any questions or concerns, please don''t hesitate to contact us.

Best regards,
{{store_name}} Team',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
</div>'
FROM (SELECT DISTINCT store_id FROM email_templates WHERE store_id IS NOT NULL LIMIT 1) AS stores
WHERE NOT EXISTS (SELECT 1 FROM email_templates WHERE identifier = 'stock_issue_refunded')
ON CONFLICT DO NOTHING;

-- Add translations for stock_issue_customer
INSERT INTO email_template_translations ("id", "email_template_id", "language_code", "subject", "template_content", "html_content", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  id,
  'en',
  'Update on your order #{{order_number}} - {{store_name}}',
  'Hi {{customer_first_name}},

Thank you for your order #{{order_number}} at {{store_name}}.

We wanted to let you know that we are currently reviewing your order. We may have detected a potential availability issue with one or more items in your order, and our team is working to resolve this as quickly as possible.

Items being reviewed:
{{items_list}}

We sincerely apologize for any inconvenience this may cause. We will contact you shortly with an update on your order status.

If you have any questions in the meantime, please don''t hesitate to reach out to us.

Best regards,
{{store_name}} Team',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
    <p style="color: #666;">If you have any questions in the meantime, please don''t hesitate to reach out to us.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      Best regards,<br>{{store_name}} Team<br>
      <a href="{{store_url}}" style="color: #667eea;">{{store_url}}</a>
    </p>
  </div>
</div>',
  NOW(),
  NOW()
FROM email_templates WHERE identifier = 'stock_issue_customer'
ON CONFLICT DO NOTHING;

-- Add translations for stock_issue_admin
INSERT INTO email_template_translations ("id", "email_template_id", "language_code", "subject", "template_content", "html_content", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  id,
  'en',
  'ACTION REQUIRED: Stock issue on order #{{order_number}}',
  'Stock Issue Alert - Order #{{order_number}}

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
{{store_name}} System',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
</div>',
  NOW(),
  NOW()
FROM email_templates WHERE identifier = 'stock_issue_admin'
ON CONFLICT DO NOTHING;

-- Add translations for stock_issue_refunded
INSERT INTO email_template_translations ("id", "email_template_id", "language_code", "subject", "template_content", "html_content", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  id,
  'en',
  'Your order #{{order_number}} has been refunded - {{store_name}}',
  'Hi {{customer_first_name}},

We are writing to inform you that your order #{{order_number}} has been refunded.

Unfortunately, due to an inventory discrepancy, we were unable to fulfill your order. We sincerely apologize for any inconvenience this may have caused.

Refund Details:
- Order Number: #{{order_number}}
- Refund Amount: {{currency}} {{refund_amount}}

The refund has been processed and should appear in your account within 5-10 business days, depending on your payment provider.

We truly value you as a customer and hope you will give us another opportunity to serve you. Please feel free to browse our store for alternative products.

If you have any questions or concerns, please don''t hesitate to contact us.

Best regards,
{{store_name}} Team',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
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
</div>',
  NOW(),
  NOW()
FROM email_templates WHERE identifier = 'stock_issue_refunded'
ON CONFLICT DO NOTHING;
