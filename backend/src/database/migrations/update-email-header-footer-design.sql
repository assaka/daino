-- Migration: Update email header and footer templates to new Payoneer-style design
-- This updates all existing stores to use the new clean design with:
-- - Colorful rainbow top border
-- - White background instead of dark purple
-- - Centered logo
-- - Cleaner footer styling

-- Update email_header template for all stores
UPDATE email_templates
SET
  html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <!-- Colorful Top Border -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; border-radius: 8px 8px 0 0; overflow: hidden;">
                <tr>
                  <td style="height: 4px; width: 16.66%; background-color: #ef4444;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #f97316;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #eab308;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #22c55e;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #3b82f6;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #8b5cf6;"></td>
                </tr>
              </table>
              <!-- Header with white background -->
              <div style="background-color: #ffffff; padding: 32px 30px 24px; text-align: center;">
                <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 160px; max-height: 80px; object-fit: contain; margin-bottom: 8px;">
              </div>
            </div>',
  updated_at = NOW()
WHERE identifier = 'email_header';

-- Update email_footer template for all stores
UPDATE email_templates
SET
  html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #ffffff; padding: 24px 30px 32px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                  Questions? Contact us at <a href="mailto:{{contact_email}}" style="color: #6b7280; text-decoration: none;">{{contact_email}}</a>
                </p>
                <p style="color: #9ca3af; font-size: 11px; margin: 10px 0;">
                  {{store_address}}<br>
                  {{store_city}}, {{store_state}} {{store_postal_code}}
                </p>
                <div style="margin: 16px 0;">
                  <a href="{{store_url}}" style="color: #6b7280; text-decoration: none; margin: 0 10px; font-size: 13px;">Visit Store</a>
                  <span style="color: #e5e7eb;">|</span>
                  <a href="{{unsubscribe_url}}" style="color: #9ca3af; text-decoration: none; margin: 0 10px; font-size: 11px;">Unsubscribe</a>
                </div>
                <p style="color: #d1d5db; font-size: 11px; margin: 12px 0 0 0;">
                  &copy; {{current_year}} {{store_name}}. All rights reserved.
                </p>
              </div>
            </div>',
  updated_at = NOW()
WHERE identifier = 'email_footer';

-- Also update the translations table if translations exist
UPDATE email_template_translations ett
SET
  html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <!-- Colorful Top Border -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; border-radius: 8px 8px 0 0; overflow: hidden;">
                <tr>
                  <td style="height: 4px; width: 16.66%; background-color: #ef4444;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #f97316;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #eab308;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #22c55e;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #3b82f6;"></td>
                  <td style="height: 4px; width: 16.66%; background-color: #8b5cf6;"></td>
                </tr>
              </table>
              <!-- Header with white background -->
              <div style="background-color: #ffffff; padding: 32px 30px 24px; text-align: center;">
                <img src="{{store_logo_url}}" alt="{{store_name}}" style="max-width: 160px; max-height: 80px; object-fit: contain; margin-bottom: 8px;">
              </div>
            </div>',
  updated_at = NOW()
FROM email_templates et
WHERE ett.email_template_id = et.id
  AND et.identifier = 'email_header';

UPDATE email_template_translations ett
SET
  html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #ffffff; padding: 24px 30px 32px; text-align: center; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
                  Questions? Contact us at <a href="mailto:{{contact_email}}" style="color: #6b7280; text-decoration: none;">{{contact_email}}</a>
                </p>
                <p style="color: #9ca3af; font-size: 11px; margin: 10px 0;">
                  {{store_address}}<br>
                  {{store_city}}, {{store_state}} {{store_postal_code}}
                </p>
                <div style="margin: 16px 0;">
                  <a href="{{store_url}}" style="color: #6b7280; text-decoration: none; margin: 0 10px; font-size: 13px;">Visit Store</a>
                  <span style="color: #e5e7eb;">|</span>
                  <a href="{{unsubscribe_url}}" style="color: #9ca3af; text-decoration: none; margin: 0 10px; font-size: 11px;">Unsubscribe</a>
                </div>
                <p style="color: #d1d5db; font-size: 11px; margin: 12px 0 0 0;">
                  &copy; {{current_year}} {{store_name}}. All rights reserved.
                </p>
              </div>
            </div>',
  updated_at = NOW()
FROM email_templates et
WHERE ett.email_template_id = et.id
  AND et.identifier = 'email_footer';
