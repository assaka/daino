-- Add is_system field to email_templates table and seed system templates

-- Add is_system column
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE NOT NULL;

-- Create system email templates for each store
-- These templates are required for the system to function and cannot be deleted

DO $$
DECLARE
    store_record RECORD;
BEGIN
    FOR store_record IN SELECT id, name FROM stores LOOP
        -- 1. Signup/Welcome Email
        INSERT INTO email_templates (
            id, store_id, identifier, subject, content_type,
            template_content, html_content, is_active, is_system, sort_order, variables,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'signup_email',
            'Welcome to {{store_name}}!',
            'html',
            NULL,
            '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Welcome to {{store_name}}!</h2>
              <p>Hi {{customer_first_name}},</p>
              <p>Thank you for creating an account with us! We''re excited to have you on board.</p>
              <p>You can now:</p>
              <ul>
                <li>Track your orders</li>
                <li>Save addresses for faster checkout</li>
                <li>View your order history</li>
              </ul>
              <p style="margin-top: 30px;">
                <a href="{{login_url}}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Go to My Account
                </a>
              </p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #999; font-size: 12px;">
                Best regards,<br>
                {{store_name}} Team<br>
                <a href="{{store_url}}">{{store_url}}</a>
              </p>
            </div>',
            TRUE,
            TRUE,
            1,
            '["customer_name", "customer_first_name", "customer_email", "store_name", "store_url", "login_url", "signup_date", "current_year"]'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            is_system = TRUE,
            subject = EXCLUDED.subject,
            html_content = EXCLUDED.html_content;

        -- 2. Email Verification Code
        INSERT INTO email_templates (
            id, store_id, identifier, subject, content_type,
            template_content, html_content, is_active, is_system, sort_order, variables,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'email_verification',
            'Verify your email - {{store_name}}',
            'html',
            NULL,
            '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Verify Your Email</h2>
              <p>Hi {{customer_first_name}},</p>
              <p>Thank you for registering at {{store_name}}! Please use the following verification code to complete your registration:</p>
              <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
                <h1 style="font-size: 36px; letter-spacing: 8px; color: #4F46E5; font-family: monospace; margin: 0;">
                  {{verification_code}}
                </h1>
              </div>
              <p>This code will expire in <strong>15 minutes</strong>.</p>
              <p style="color: #666; font-size: 14px;">If you didn''t create an account at {{store_name}}, please ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #999; font-size: 12px;">
                Best regards,<br>
                {{store_name}} Team<br>
                <a href="{{store_url}}">{{store_url}}</a>
              </p>
            </div>',
            TRUE,
            TRUE,
            2,
            '["customer_name", "customer_first_name", "verification_code", "store_name", "store_url", "current_year"]'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            is_system = TRUE,
            subject = EXCLUDED.subject,
            html_content = EXCLUDED.html_content;

        -- 3. Order Success Email
        INSERT INTO email_templates (
            id, store_id, identifier, subject, content_type,
            template_content, html_content, is_active, is_system, sort_order, variables,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            store_record.id,
            'order_success_email',
            'Order Confirmation #{{order_number}}',
            'html',
            NULL,
            '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Thank You for Your Order!</h2>
              <p>Hi {{customer_first_name}},</p>
              <p>Your order has been confirmed and is being processed.</p>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Order Number:</strong> {{order_number}}</p>
                <p style="margin: 5px 0;"><strong>Order Date:</strong> {{order_date}}</p>
              </div>
              <h3>Order Items:</h3>
              {{items_html}}
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Order Summary</h3>
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
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #999; font-size: 12px;">
                Best regards,<br>
                {{store_name}} Team<br>
                <a href="{{store_url}}">{{store_url}}</a>
              </p>
            </div>',
            TRUE,
            TRUE,
            3,
            '["customer_name", "customer_first_name", "order_number", "order_date", "order_total", "order_subtotal", "order_tax", "order_shipping", "items_html", "items_count", "shipping_address", "billing_address", "store_name", "store_url", "current_year"]'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (identifier, store_id) DO UPDATE SET
            is_system = TRUE,
            subject = EXCLUDED.subject,
            html_content = EXCLUDED.html_content;

    END LOOP;
END $$;

-- Add comment
COMMENT ON COLUMN email_templates.is_system IS 'System templates cannot be deleted and identifier cannot be changed';
