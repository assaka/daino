-- Create PDF templates table for managing invoice and shipment PDF layouts

CREATE TABLE IF NOT EXISTS pdf_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    identifier VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('invoice', 'shipment', 'packing_slip', 'receipt')),
    html_template TEXT NOT NULL,
    default_html_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    variables JSONB DEFAULT '[]'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(identifier, store_id)
);

-- Add comments after table creation
COMMENT ON COLUMN pdf_templates.default_html_template IS 'Original default template for restore functionality';
COMMENT ON COLUMN pdf_templates.settings IS 'PDF-specific settings: page_size, margins, orientation, etc.';

CREATE INDEX idx_pdf_templates_store_id ON pdf_templates(store_id);
CREATE INDEX idx_pdf_templates_identifier ON pdf_templates(identifier);
CREATE INDEX idx_pdf_templates_type ON pdf_templates(template_type);

-- Add default PDF templates for all stores
DO $$
DECLARE
    store_record RECORD;
    invoice_html TEXT;
    shipment_html TEXT;
BEGIN
    -- Define invoice template HTML (uses email_header and email_footer for consistency)
    invoice_html := '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: ''Helvetica'', ''Arial'', sans-serif;
      color: #333;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
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
    {{email_header}}

    <!-- Invoice Details -->
    <div style="text-align: right; margin-bottom: 30px;">
      <h2 style="color: #4f46e5; margin: 0;">INVOICE</h2>
      <p style="font-size: 14px; color: #666; margin: 5px 0;">
        <strong>Invoice #:</strong> {{invoice_number}}<br>
        <strong>Date:</strong> {{invoice_date}}<br>
        <strong>Order #:</strong> {{order_number}}
      </p>
    </div>

    <!-- Addresses -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div style="width: 48%;" class="info-section">
        <h3 style="color: #4f46e5; margin-top: 0;">Bill To:</h3>
        <p style="margin: 0; font-size: 14px;">{{billing_address}}</p>
      </div>
      <div style="width: 48%;" class="info-section">
        <h3 style="color: #10b981; margin-top: 0;">Ship To:</h3>
        <p style="margin: 0; font-size: 14px;">{{shipping_address}}</p>
      </div>
    </div>

    <!-- Items Table -->
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
        {{items_table_rows}}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="total-section">
      <table>
        <tr>
          <td style="padding: 5px 0;">Subtotal:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_subtotal}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Shipping:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_shipping}}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0;">Tax:</td>
          <td style="padding: 5px 0; text-align: right;">${{order_tax}}</td>
        </tr>
        {{#if order_discount}}
        <tr>
          <td style="padding: 5px 0; color: #10b981;">Discount:</td>
          <td style="padding: 5px 0; text-align: right; color: #10b981;">-${{order_discount}}</td>
        </tr>
        {{/if}}
        <tr style="border-top: 2px solid #4f46e5;">
          <td style="padding: 10px 0 0 0; font-size: 18px; font-weight: bold;">Total:</td>
          <td style="padding: 10px 0 0 0; text-align: right; font-size: 18px; font-weight: bold; color: #4f46e5;">${{order_total}}</td>
        </tr>
      </table>
    </div>

    {{#if payment_method}}
    <div style="margin-top: 20px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
      <p style="margin: 0;">
        <strong>Payment Method:</strong> {{payment_method}}<br>
        <strong>Payment Status:</strong> {{payment_status}}
      </p>
    </div>
    {{/if}}

    {{email_footer}}
  </div>
</body>
</html>';

    -- Define shipment template HTML (uses email_header and email_footer for consistency)
    shipment_html := '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: ''Helvetica'', ''Arial'', sans-serif;
      color: #333;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; }
    .tracking-section {
      background-color: #eff6ff;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
      border: 2px solid #3b82f6;
    }
    .info-section {
      background-color: #f0fdf4;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #10b981;
    }
  </style>
</head>
<body>
  <div class="container">
    {{email_header}}

    <!-- Shipment Notice -->
    <div style="text-align: right; margin-bottom: 30px;">
      <h2 style="color: #10b981; margin: 0;">SHIPMENT NOTICE</h2>
      <p style="font-size: 14px; color: #666; margin: 5px 0;">
        <strong>Order #:</strong> {{order_number}}<br>
        <strong>Ship Date:</strong> {{ship_date}}
      </p>
    </div>

    <!-- Tracking Info -->
    {{#if tracking_number}}
    <div class="tracking-section">
      <h3 style="color: #3b82f6; margin-top: 0;">Tracking Information</h3>
      <p style="font-size: 24px; font-weight: bold; margin: 15px 0; font-family: monospace; letter-spacing: 2px;">
        {{tracking_number}}
      </p>
      <p style="font-size: 14px; color: #666;">
        <strong>Shipping Method:</strong> {{shipping_method}}
      </p>
    </div>
    {{/if}}

    <!-- Shipping Address -->
    <div class="info-section">
      <h3 style="color: #10b981; margin-top: 0;">Shipping Address</h3>
      <p style="margin: 0; font-size: 16px;">{{shipping_address}}</p>
    </div>

    {{#if delivery_instructions}}
    <div style="padding: 15px; background-color: #fef3c7; border-radius: 8px; margin: 20px 0;">
      <h4 style="margin-top: 0; color: #92400e;">Delivery Instructions</h4>
      <p style="margin: 0;">{{delivery_instructions}}</p>
    </div>
    {{/if}}

    <!-- Package Contents -->
    <h3 style="margin-top: 30px;">Package Contents</h3>
    <table>
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">SKU</th>
        </tr>
      </thead>
      <tbody>
        {{items_table_rows}}
      </tbody>
    </table>

    <div style="margin-top: 30px; padding: 20px; background-color: #f0fdf4; border-radius: 8px; text-align: center;">
      <p style="font-size: 16px; color: #065f46; margin: 0; font-weight: bold;">
        Total Items: {{items_count}}
      </p>
    </div>

    {{email_footer}}
  </div>
</body>
</html>';

    FOR store_record IN SELECT id, name FROM stores LOOP
        -- Create invoice PDF template
        INSERT INTO pdf_templates (
            id, store_id, identifier, name, template_type,
            html_template, default_html_template, is_active, is_system, sort_order,
            variables, settings,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'invoice_pdf',
            'Invoice PDF',
            'invoice',
            invoice_html,
            invoice_html,
            TRUE,
            TRUE,
            1,
            '["invoice_number", "invoice_date", "order_number", "customer_name", "billing_address", "shipping_address", "items_table_rows", "order_subtotal", "order_shipping", "order_tax", "order_discount", "order_total", "payment_method", "payment_status", "store_name", "store_logo_url", "store_address", "store_city", "store_state", "store_postal_code", "store_email", "store_phone", "store_website", "current_year"]'::jsonb,
            '{"page_size": "A4", "orientation": "portrait", "margins": {"top": "20px", "right": "20px", "bottom": "20px", "left": "20px"}}'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            name = EXCLUDED.name,
            default_html_template = EXCLUDED.default_html_template,
            is_system = TRUE;

        -- Create shipment PDF template
        INSERT INTO pdf_templates (
            id, store_id, identifier, name, template_type,
            html_template, default_html_template, is_active, is_system, sort_order,
            variables, settings,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'shipment_pdf',
            'Shipment/Packing Slip PDF',
            'shipment',
            shipment_html,
            shipment_html,
            TRUE,
            TRUE,
            2,
            '["order_number", "ship_date", "tracking_number", "tracking_url", "shipping_method", "estimated_delivery_date", "delivery_instructions", "shipping_address", "items_table_rows", "items_count", "store_name", "store_logo_url", "store_address", "store_city", "store_state", "store_postal_code", "store_email", "store_phone", "store_website", "current_year"]'::jsonb,
            '{"page_size": "A4", "orientation": "portrait", "margins": {"top": "20px", "right": "20px", "bottom": "20px", "left": "20px"}}'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            name = EXCLUDED.name,
            default_html_template = EXCLUDED.default_html_template,
            is_system = TRUE;

    END LOOP;
END $$;

-- Add comments
COMMENT ON TABLE pdf_templates IS 'PDF templates for invoices, shipments, receipts. Users can customize layouts via admin panel.';
COMMENT ON COLUMN pdf_templates.html_template IS 'Current HTML template (user-editable)';
COMMENT ON COLUMN pdf_templates.default_html_template IS 'Original default template for restore functionality';
COMMENT ON COLUMN pdf_templates.settings IS 'PDF generation settings: page_size (A4/Letter), orientation (portrait/landscape), margins';
