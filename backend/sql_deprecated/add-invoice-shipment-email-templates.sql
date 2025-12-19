-- Add invoice and shipment email templates and header/footer templates for all stores

DO $$
DECLARE
    store_record RECORD;
BEGIN
    FOR store_record IN SELECT id, name FROM stores LOOP

        -- 1. Invoice Email Template
        INSERT INTO email_templates (
            id, store_id, identifier, subject, content_type,
            template_content, html_content,
            default_subject, default_template_content, default_html_content,
            is_active, is_system, sort_order, variables,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'invoice_email',
            'Invoice #{{invoice_number}} from {{store_name}}',
            'html',
            NULL,
            '{{email_header}}
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; margin-bottom: 10px;">Invoice #{{invoice_number}}</h2>
              <p>Hi {{customer_first_name}},</p>
              <p>Thank you for your order! Please find your invoice details below.</p>

              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 5px 0;"><strong>Invoice Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{invoice_number}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Invoice Date:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{invoice_date}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Order Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{order_number}}</td>
                  </tr>
                </table>
              </div>

              <h3 style="margin-top: 30px;">Order Items:</h3>
              {{items_html}}

              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Invoice Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Subtotal</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_subtotal}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Shipping</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_shipping}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tax</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_tax}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold;">Total</td>
                    <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; text-align: right;">{{order_total}}</td>
                  </tr>
                </table>
              </div>

              <div style="margin-top: 30px; padding: 15px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af;">
                  <strong>Billing Address:</strong><br>
                  {{billing_address}}
                </p>
              </div>

              <div style="margin-top: 15px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; color: #065f46;">
                  <strong>Shipping Address:</strong><br>
                  {{shipping_address}}
                </p>
              </div>
            </div>
            {{email_footer}}',
            'Invoice #{{invoice_number}} from {{store_name}}',
            NULL,
            '{{email_header}}
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; margin-bottom: 10px;">Invoice #{{invoice_number}}</h2>
              <p>Hi {{customer_first_name}},</p>
              <p>Thank you for your order! Please find your invoice details below.</p>

              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 5px 0;"><strong>Invoice Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{invoice_number}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Invoice Date:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{invoice_date}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Order Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{order_number}}</td>
                  </tr>
                </table>
              </div>

              <h3 style="margin-top: 30px;">Order Items:</h3>
              {{items_html}}

              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Invoice Summary</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Subtotal</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_subtotal}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Shipping</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_shipping}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Tax</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{order_tax}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold;">Total</td>
                    <td style="padding: 12px 0 0 0; font-size: 18px; font-weight: bold; text-align: right;">{{order_total}}</td>
                  </tr>
                </table>
              </div>

              <div style="margin-top: 30px; padding: 15px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0; color: #1e40af;">
                  <strong>Billing Address:</strong><br>
                  {{billing_address}}
                </p>
              </div>

              <div style="margin-top: 15px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; color: #065f46;">
                  <strong>Shipping Address:</strong><br>
                  {{shipping_address}}
                </p>
              </div>
            </div>
            {{email_footer}}',
            TRUE,
            TRUE,
            10,
            '["invoice_number", "invoice_date", "order_number", "customer_name", "customer_first_name", "customer_email", "order_date", "order_total", "order_subtotal", "order_tax", "order_shipping", "items_html", "items_count", "billing_address", "shipping_address", "store_name", "store_url", "current_year", "email_header", "email_footer"]'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            is_system = TRUE,
            subject = EXCLUDED.subject,
            html_content = EXCLUDED.html_content,
            default_subject = EXCLUDED.default_subject,
            default_html_content = EXCLUDED.default_html_content,
            variables = EXCLUDED.variables;

        -- 2. Shipment Notification Email Template
        INSERT INTO email_templates (
            id, store_id, identifier, subject, content_type,
            template_content, html_content,
            default_subject, default_template_content, default_html_content,
            is_active, is_system, sort_order, variables,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'shipment_email',
            'Your order #{{order_number}} has been shipped!',
            'html',
            NULL,
            '{{email_header}}
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; margin-bottom: 10px;">Your Order Has Been Shipped!</h2>
              <p>Hi {{customer_first_name}},</p>
              <p>Great news! Your order has been shipped and is on its way to you.</p>

              <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 5px 0;"><strong>Order Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{order_number}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Tracking Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;"><strong>{{tracking_number}}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Shipping Method:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{shipping_method}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Estimated Delivery:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{estimated_delivery_date}}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="{{tracking_url}}" style="background-color: #10b981; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Track Your Package
                </a>
              </div>

              <h3 style="margin-top: 30px;">Shipped Items:</h3>
              {{items_html}}

              <div style="margin-top: 30px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; color: #065f46;">
                  <strong>Shipping Address:</strong><br>
                  {{shipping_address}}
                </p>
              </div>

              <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>📦 Delivery Instructions:</strong><br>
                  {{delivery_instructions}}
                </p>
              </div>
            </div>
            {{email_footer}}',
            'Your order #{{order_number}} has been shipped!',
            NULL,
            '{{email_header}}
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; margin-bottom: 10px;">Your Order Has Been Shipped!</h2>
              <p>Hi {{customer_first_name}},</p>
              <p>Great news! Your order has been shipped and is on its way to you.</p>

              <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 5px 0;"><strong>Order Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{order_number}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Tracking Number:</strong></td>
                    <td style="padding: 5px 0; text-align: right;"><strong>{{tracking_number}}</strong></td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Shipping Method:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{shipping_method}}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Estimated Delivery:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">{{estimated_delivery_date}}</td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="{{tracking_url}}" style="background-color: #10b981; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Track Your Package
                </a>
              </div>

              <h3 style="margin-top: 30px;">Shipped Items:</h3>
              {{items_html}}

              <div style="margin-top: 30px; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                <p style="margin: 0; color: #065f46;">
                  <strong>Shipping Address:</strong><br>
                  {{shipping_address}}
                </p>
              </div>

              <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">
                  <strong>📦 Delivery Instructions:</strong><br>
                  {{delivery_instructions}}
                </p>
              </div>
            </div>
            {{email_footer}}',
            TRUE,
            TRUE,
            11,
            '["order_number", "tracking_number", "tracking_url", "shipping_method", "estimated_delivery_date", "delivery_instructions", "customer_name", "customer_first_name", "customer_email", "items_html", "items_count", "shipping_address", "store_name", "store_url", "current_year", "email_header", "email_footer"]'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            is_system = TRUE,
            subject = EXCLUDED.subject,
            html_content = EXCLUDED.html_content,
            default_subject = EXCLUDED.default_subject,
            default_html_content = EXCLUDED.default_html_content,
            variables = EXCLUDED.variables;

        -- 3. Email Header Template
        INSERT INTO email_templates (
            id, store_id, identifier, subject, content_type,
            template_content, html_content,
            default_subject, default_template_content, default_html_content,
            is_active, is_system, sort_order, variables,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'email_header',
            'Email Header Template',
            'html',
            NULL,
            '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <div style="background-color: white; width: 120px; height: 120px; margin: 0 auto 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 10px;">
                  <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 100px; max-height: 100px; object-fit: contain;">
                </div>
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">{{store_name}}</h1>
              </div>
            </div>',
            'Email Header Template',
            NULL,
            '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <div style="background-color: white; width: 120px; height: 120px; margin: 0 auto 15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 10px;">
                  <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 100px; max-height: 100px; object-fit: contain;">
                </div>
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">{{store_name}}</h1>
              </div>
            </div>',
            TRUE,
            TRUE,
            100,
            '["store_name", "store_logo_url"]'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            is_system = TRUE,
            html_content = EXCLUDED.html_content,
            default_subject = EXCLUDED.default_subject,
            default_html_content = EXCLUDED.default_html_content;

        -- 4. Email Footer Template
        INSERT INTO email_templates (
            id, store_id, identifier, subject, content_type,
            template_content, html_content,
            default_subject, default_template_content, default_html_content,
            is_active, is_system, sort_order, variables,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'email_footer',
            'Email Footer Template',
            'html',
            NULL,
            '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                  Questions? Contact us at <a href="mailto:{{contact_email}}" style="color: #4f46e5; text-decoration: none;">{{contact_email}}</a>
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 10px 0;">
                  {{store_address}}<br>
                  {{store_city}}, {{store_state}} {{store_postal_code}}
                </p>
                <div style="margin: 20px 0;">
                  <a href="{{store_url}}" style="color: #4f46e5; text-decoration: none; margin: 0 10px; font-size: 14px;">Visit Store</a>
                  <span style="color: #e5e7eb;">|</span>
                  <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: none; margin: 0 10px; font-size: 12px;">Unsubscribe</a>
                </div>
                <p style="color: #9ca3af; font-size: 11px; margin: 15px 0 0 0;">
                  © {{current_year}} {{store_name}}. All rights reserved.
                </p>
              </div>
            </div>',
            'Email Footer Template',
            NULL,
            '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                  Questions? Contact us at <a href="mailto:{{contact_email}}" style="color: #4f46e5; text-decoration: none;">{{contact_email}}</a>
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 10px 0;">
                  {{store_address}}<br>
                  {{store_city}}, {{store_state}} {{store_postal_code}}
                </p>
                <div style="margin: 20px 0;">
                  <a href="{{store_url}}" style="color: #4f46e5; text-decoration: none; margin: 0 10px; font-size: 14px;">Visit Store</a>
                  <span style="color: #e5e7eb;">|</span>
                  <a href="{{unsubscribe_url}}" style="color: #6b7280; text-decoration: none; margin: 0 10px; font-size: 12px;">Unsubscribe</a>
                </div>
                <p style="color: #9ca3af; font-size: 11px; margin: 15px 0 0 0;">
                  © {{current_year}} {{store_name}}. All rights reserved.
                </p>
              </div>
            </div>',
            TRUE,
            TRUE,
            101,
            '["store_name", "store_url", "contact_email", "store_address", "store_city", "store_state", "store_postal_code", "current_year", "unsubscribe_url"]'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            is_system = TRUE,
            html_content = EXCLUDED.html_content,
            default_subject = EXCLUDED.default_subject,
            default_html_content = EXCLUDED.default_html_content;

    END LOOP;
END $$;

-- Add helpful comments
COMMENT ON TABLE email_templates IS 'Email templates for transactional emails. Use {{email_header}} and {{email_footer}} for branded header/footer.';

