-- Migration: Add password reset email templates
-- This adds the password_reset and password_reset_confirmation templates to existing stores

-- Password reset email template (for forgot password flow)
INSERT INTO email_templates ("id", "store_id", "identifier", "content_type", "variables", "is_active", "sort_order", "attachment_enabled", "attachment_config", "created_at", "updated_at", "is_system", "default_subject", "default_template_content", "default_html_content")
SELECT
  gen_random_uuid(),
  s.id,
  'password_reset',
  'both',
  '["customer_first_name", "customer_name", "reset_url", "reset_link", "store_name", "store_url", "current_year", "expiry_hours"]',
  true,
  28,
  false,
  '{}',
  NOW(),
  NOW(),
  true,
  'Reset your password - {{store_name}}',
  'Hi {{customer_first_name}},

We received a request to reset your password for your {{store_name}} account.

Click the link below to set a new password:
{{reset_url}}

This link will expire in {{expiry_hours}} hour(s).

If you didn''t request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
{{store_name}} Team
{{store_url}}',
  '{{email_header}}
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #4F46E5; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Reset Your Password</h1>
  </div>
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>We received a request to reset your password for your <strong>{{store_name}}</strong> account.</p>
    <p>Click the button below to set a new password:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{reset_url}}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Reset Password
      </a>
    </p>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:</p>
    <p style="word-break: break-all; background-color: #e5e7eb; padding: 12px; border-radius: 4px; font-size: 12px;">{{reset_url}}</p>
    <p style="color: #666;">This link will expire in <strong>{{expiry_hours}} hour(s)</strong>.</p>
    <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">If you didn''t request a password reset, please ignore this email. Your password will remain unchanged.</p>
    </div>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      Best regards,<br>{{store_name}} Team<br>
      <a href="{{store_url}}" style="color: #4F46E5;">{{store_url}}</a>
    </p>
  </div>
</div>
{{email_footer}}'
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates et
  WHERE et.store_id = s.id AND et.identifier = 'password_reset'
);

-- Password reset confirmation email template
INSERT INTO email_templates ("id", "store_id", "identifier", "content_type", "variables", "is_active", "sort_order", "attachment_enabled", "attachment_config", "created_at", "updated_at", "is_system", "default_subject", "default_template_content", "default_html_content")
SELECT
  gen_random_uuid(),
  s.id,
  'password_reset_confirmation',
  'both',
  '["customer_first_name", "customer_name", "store_name", "store_url", "login_url", "current_year"]',
  true,
  29,
  false,
  '{}',
  NOW(),
  NOW(),
  true,
  'Your password has been reset - {{store_name}}',
  'Hi {{customer_first_name}},

Your password for your {{store_name}} account has been successfully reset.

You can now log in with your new password:
{{login_url}}

If you did not make this change, please contact our support team immediately.

Best regards,
{{store_name}} Team
{{store_url}}',
  '{{email_header}}
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #059669; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Password Reset Successful</h1>
  </div>
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>Your password for your <strong>{{store_name}}</strong> account has been successfully reset.</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{login_url}}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Log In Now
      </a>
    </p>
    <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.</p>
    </div>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      Best regards,<br>{{store_name}} Team<br>
      <a href="{{store_url}}" style="color: #059669;">{{store_url}}</a>
    </p>
  </div>
</div>
{{email_footer}}'
FROM stores s
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates et
  WHERE et.store_id = s.id AND et.identifier = 'password_reset_confirmation'
);

-- Add English translations for password_reset template
INSERT INTO email_template_translations ("id", "email_template_id", "language_code", "subject", "template_content", "html_content", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  et.id,
  'en',
  'Reset your password - {{store_name}}',
  'Hi {{customer_first_name}},

We received a request to reset your password for your {{store_name}} account.

Click the link below to set a new password:
{{reset_url}}

This link will expire in {{expiry_hours}} hour(s).

If you didn''t request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
{{store_name}} Team
{{store_url}}',
  '{{email_header}}
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #4F46E5; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Reset Your Password</h1>
  </div>
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>We received a request to reset your password for your <strong>{{store_name}}</strong> account.</p>
    <p>Click the button below to set a new password:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{reset_url}}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Reset Password
      </a>
    </p>
    <p style="color: #666; font-size: 14px;">Or copy and paste this link in your browser:</p>
    <p style="word-break: break-all; background-color: #e5e7eb; padding: 12px; border-radius: 4px; font-size: 12px;">{{reset_url}}</p>
    <p style="color: #666;">This link will expire in <strong>{{expiry_hours}} hour(s)</strong>.</p>
    <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">If you didn''t request a password reset, please ignore this email. Your password will remain unchanged.</p>
    </div>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      Best regards,<br>{{store_name}} Team<br>
      <a href="{{store_url}}" style="color: #4F46E5;">{{store_url}}</a>
    </p>
  </div>
</div>
{{email_footer}}',
  NOW(),
  NOW()
FROM email_templates et
WHERE et.identifier = 'password_reset'
AND NOT EXISTS (
  SELECT 1 FROM email_template_translations ett
  WHERE ett.email_template_id = et.id AND ett.language_code = 'en'
);

-- Add English translations for password_reset_confirmation template
INSERT INTO email_template_translations ("id", "email_template_id", "language_code", "subject", "template_content", "html_content", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  et.id,
  'en',
  'Your password has been reset - {{store_name}}',
  'Hi {{customer_first_name}},

Your password for your {{store_name}} account has been successfully reset.

You can now log in with your new password:
{{login_url}}

If you did not make this change, please contact our support team immediately.

Best regards,
{{store_name}} Team
{{store_url}}',
  '{{email_header}}
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #059669; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">Password Reset Successful</h1>
  </div>
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi <strong>{{customer_first_name}}</strong>,</p>
    <p>Your password for your <strong>{{store_name}}</strong> account has been successfully reset.</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="{{login_url}}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Log In Now
      </a>
    </p>
    <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.</p>
    </div>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px; text-align: center;">
      Best regards,<br>{{store_name}} Team<br>
      <a href="{{store_url}}" style="color: #059669;">{{store_url}}</a>
    </p>
  </div>
</div>
{{email_footer}}',
  NOW(),
  NOW()
FROM email_templates et
WHERE et.identifier = 'password_reset_confirmation'
AND NOT EXISTS (
  SELECT 1 FROM email_template_translations ett
  WHERE ett.email_template_id = et.id AND ett.language_code = 'en'
);
