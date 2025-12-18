# Email Management System Documentation

## Overview

The DainoStore email management system provides a comprehensive solution for sending transactional emails using Brevo. It includes:

- **Multi-language email templates** with translation support
- **Brevo API key integration** for secure email sending
- **Automated transactional emails** for signup, credit purchases, and orders
- **Admin UI** for managing email templates
- **Template variables** for dynamic content
- **Attachment support** for PDFs and other files

---

## Table of Contents

1. [Architecture](#architecture)
2. [Setup & Configuration](#setup--configuration)
3. [Email Template Types](#email-template-types)
4. [Admin UI Usage](#admin-ui-usage)
5. [API Reference](#api-reference)
6. [Template Variables](#template-variables)
7. [Development & Testing](#development--testing)
8. [Troubleshooting](#troubleshooting)

---

## Architecture

### Database Schema

**email_templates**
- Stores email template definitions
- Fields: identifier, subject, content_type, template_content, html_content, variables, is_active
- Unique constraint: (identifier, store_id)

**email_template_translations**
- Multi-language translations for templates
- Fields: email_template_id, language_code, subject, template_content, html_content
- Unique constraint: (email_template_id, language_code)

**brevo_configurations**
- Brevo API keys per store
- Fields: store_id, access_token (API key), sender_name, sender_email, is_active
- API keys are validated before saving

**email_send_logs**
- Audit log of all sent emails
- Fields: email_template_id, recipient_email, status, brevo_message_id, metadata, sent_at
- Tracks: sent, failed, bounced, delivered, opened, clicked

### Services

**brevo-service.js**
- Handles Brevo API key authentication
- Validates and stores API keys per store
- Methods: saveConfiguration(), validateApiKey(), testConnection(), disconnect()

**email-service.js**
- Core email sending logic
- Template rendering with variables
- Methods: sendEmail(), sendTransactionalEmail(), sendTestEmail()

**email-template-variables.js**
- Defines available variables per email type
- Template rendering engine
- Helper functions: formatOrderItemsHtml(), formatAddress()

---

## Setup & Configuration

### 1. Brevo Account Setup

1. Create a free account at https://www.brevo.com (free tier: 300 emails/day)
2. Go to Settings > API Keys: https://app.brevo.com/settings/keys/api
3. Click "Generate a new API key"
4. Copy the API key (starts with "xkeysib-...")
5. Keep this key handy for step 6

**No environment variables needed!** API keys are configured per-store in the admin UI.

### 2. Database Migration

Run migrations to create email system tables:

```bash
cd backend
node -e "require('dotenv').config(); const { execSync } = require('child_process'); execSync('psql \"' + process.env.DATABASE_URL + '\" -f src/database/migrations/create-email-system-tables.sql', {stdio: 'inherit'});"
```

### 3. Navigation Setup

Add Emails menu item:

```bash
node -e "require('dotenv').config(); const { execSync } = require('child_process'); execSync('psql \"' + process.env.DATABASE_URL + '\" -f src/database/migrations/add-emails-navigation.sql', {stdio: 'inherit'});"
```

### 4. Seed Default Templates

Create default email templates for all stores:

```bash
cd backend
node -e "require('dotenv').config(); const { execSync } = require('child_process'); execSync('psql \"' + process.env.DATABASE_URL + '\" -f seed-email-templates-quick.sql', {stdio: 'inherit'});"
```

### 5. Configure Brevo in Admin UI

1. Log in to your admin dashboard
2. Go to **Store > Email** in the sidebar menu
3. Click on the **Brevo** provider card
4. Click **"Configure Brevo"**
5. Enter your Brevo API key (xkeysib-...)
6. Enter sender name (e.g., "Your Store Name")
7. Enter sender email (e.g., noreply@yourdomain.com)
   - **Note:** If this email is not yet verified in Brevo, Brevo will automatically send a verification email to this address. Check your inbox and click the verification link before sending emails.
8. Click **"Save Configuration"**
9. Test by clicking **"Send Test to [your-store-email]"**

**Done!** Emails will now be sent automatically on signup, credit purchases, and orders.

---

## Email Template Types

### 1. Signup/Welcome Email
**Identifier**: `signup_email`

**Purpose**: Sent when a customer creates an account

**Default Subject**: "Welcome to {{store_name}}!"

**Variables**:
- `{{customer_name}}` - Full name
- `{{customer_first_name}}` - First name only
- `{{customer_email}}` - Email address
- `{{store_name}}` - Store name
- `{{store_url}}` - Store URL
- `{{login_url}}` - Customer login URL
- `{{signup_date}}` - Formatted signup date
- `{{current_year}}` - Current year

**Triggered**:
- `POST /api/auth/customer/register` with `send_welcome_email: true`
- `POST /api/auth/register` for customers
- `POST /api/auth/upgrade-guest` (guest to registered)

---

### 2. Credit Purchase Confirmation
**Identifier**: `credit_purchase_email`

**Purpose**: Sent when a credit purchase is completed

**Default Subject**: "Credit Purchase Confirmation - {{credits_purchased}} Credits"

**Variables**:
- `{{customer_name}}` - Full name
- `{{customer_first_name}}` - First name
- `{{credits_purchased}}` - Number of credits
- `{{amount_usd}}` - Amount paid (formatted)
- `{{transaction_id}}` - Transaction ID
- `{{balance}}` - Current credit balance
- `{{purchase_date}}` - Purchase date
- `{{payment_method}}` - Payment method used
- `{{store_name}}` - Store name
- `{{current_year}}` - Current year

**Triggered**:
- `POST /api/credits/complete-purchase` (after successful payment)

---

### 3. Order Success/Confirmation
**Identifier**: `order_success_email`

**Purpose**: Sent when an order is successfully created

**Default Subject**: "Order Confirmation #{{order_number}} - Thank You!"

**Variables**:
- `{{customer_name}}` - Full name
- `{{customer_first_name}}` - First name
- `{{customer_email}}` - Email address
- `{{order_number}}` - Order number
- `{{order_date}}` - Order date (formatted)
- `{{order_total}}` - Total amount
- `{{order_subtotal}}` - Subtotal
- `{{order_tax}}` - Tax amount
- `{{order_shipping}}` - Shipping cost
- `{{items_html}}` - HTML table of items
- `{{items_count}}` - Number of items
- `{{shipping_address}}` - Formatted shipping address
- `{{billing_address}}` - Formatted billing address
- `{{payment_method}}` - Payment method
- `{{tracking_url}}` - Shipment tracking link
- `{{order_status}}` - Order status
- `{{store_name}}` - Store name
- `{{store_url}}` - Store URL
- `{{order_details_url}}` - Link to view order
- `{{current_year}}` - Current year

**Triggered**:
- `POST /api/orders` (after order creation)

---

## Admin UI Usage

### Accessing Email Management

1. Navigate to **Admin Dashboard**
2. Click **Content** in the sidebar
3. Select **Emails**

### Connecting Brevo

1. Get your API key from https://app.brevo.com/settings/keys/api
2. Go to **Store > Email** in the sidebar
3. Click on the **Brevo** provider card
4. Click **"Configure Brevo"**
5. Enter your API key (xkeysib-...)
6. Enter sender name and sender email
7. **Important:** If the sender email is unverified, Brevo will send a verification email. Check your inbox and verify before sending emails.
8. Click **"Save Configuration"**
9. Test with **"Send Test to [store-email]"** button

### Creating Email Templates

1. Go to **Content** > **Emails**
2. Click **"Add Email Template"**
3. Select email type (Signup/Credit/Order)
4. Enter subject line (use variables like `{{customer_name}}`)
5. Choose content type:
   - **Template**: Plain text with variables
   - **HTML**: Full HTML editor
   - **Both**: Use both modes
6. Enter content (click variables to copy)
7. Enable attachments if needed
8. Click **Manage Translations** for multi-language
9. Save template

### Editing Email Templates

1. In the Emails grid, click **Edit** icon
2. Modify subject, content, or settings
3. Save changes

### Testing Emails

1. Go to **Settings** > **Brevo** tab
2. Enter your email in **"Send Test Email To"**
3. Click **"Send Test"**
4. Check your inbox for the test email

### Translating Emails

**Individual Translation**:
1. Edit email template
2. Click **"Manage Translations"**
3. Add translations for each language

**Bulk Translation**:
1. In Emails page, click **"Bulk Translate"**
2. Select source language
3. Select target language(s)
4. AI will translate all templates

---

## API Reference

### Email Templates API

**GET /api/email-templates**
- Get all templates for a store
- Query: `?store_id={uuid}`
- Returns: Array of templates with translations

**GET /api/email-templates/:id**
- Get single template
- Returns: Template with translations and available variables

**POST /api/email-templates**
- Create new template
- Body: `{ store_id, identifier, subject, content_type, template_content, html_content, translations }`

**PUT /api/email-templates/:id**
- Update template
- Body: `{ subject, content_type, template_content, html_content, translations }`

**DELETE /api/email-templates/:id**
- Delete template

**POST /api/email-templates/:id/test**
- Send test email
- Body: `{ test_email, language_code }`

**POST /api/email-templates/bulk-translate**
- Bulk AI translate
- Body: `{ store_id, from_lang, to_lang }`

### Brevo API

**POST /api/brevo/configure**
- Save Brevo API key configuration
- Body: `{ store_id, api_key, sender_name, sender_email }`
- Validates API key before saving
- Returns: `{ success, message, config }`

**POST /api/brevo/disconnect**
- Disconnect Brevo
- Body: `{ store_id }`
- Returns: `{ success, message }`

**GET /api/brevo/status**
- Check connection status
- Query: `?store_id={uuid}`
- Returns: `{ isConfigured, config: { sender_name, sender_email, is_active } }`

**POST /api/brevo/test-connection**
- Test connection with email
- Body: `{ store_id, test_email }`

**GET /api/brevo/email-statistics**
- Get email stats
- Query: `?store_id={uuid}&days=30`
- Returns: `{ total, sent, failed, opened }`

---

## Template Variables

### Using Variables

Variables are placeholders replaced with actual data when emails are sent.

**Syntax**: `{{variable_name}}`

**Example**:
```
Subject: Welcome to {{store_name}}, {{customer_first_name}}!

Body:
Hi {{customer_first_name}},

Thank you for joining {{store_name}}! Your account was created on {{signup_date}}.

Login here: {{login_url}}
```

### Content Types

**Template Mode**:
- Plain text with variables
- Best for simple emails
- Variables automatically replaced

**HTML Mode**:
- Full HTML control
- Use inline CSS for styling
- Variables work in HTML too

**Both Mode** (Recommended):
- Provide both template and HTML versions
- System uses HTML if available
- Falls back to template if HTML fails

---

## Development & Testing

### Running Locally

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `npm run dev`
3. Navigate to http://localhost:5179/admin/emails

### Testing Email Sending

**Method 1: Test Button in Settings**
```javascript
// In Settings > Brevo tab
1. Enter your email
2. Click "Send Test"
3. Check inbox
```

**Method 2: API Test**
```bash
curl -X POST http://localhost:5000/api/email-templates/{template_id}/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"test_email": "test@example.com", "language_code": "en"}'
```

**Method 3: Trigger Real Flow**
```javascript
// Test signup email
POST /api/auth/customer/register
{
  "email": "test@example.com",
  "password": "Test123!@#",
  "first_name": "Test",
  "last_name": "User",
  "send_welcome_email": true,
  "store_id": "your-store-id"
}
```

### Adding Custom Email Types

1. **Add variables** to `backend/src/services/email-template-variables.js`:
```javascript
my_custom_email: [
  { key: '{{custom_variable}}', description: 'Description', example: 'Example value' }
]
```

2. **Create template** in database or via UI

3. **Send email** in your code:
```javascript
const emailService = require('../services/email-service');

await emailService.sendTransactionalEmail(storeId, 'my_custom', {
  recipientEmail: 'user@example.com',
  custom_variable: 'value',
  languageCode: 'en'
});
```

---

## Troubleshooting

### Email Not Sending

**Problem**: Emails are logged as 'failed' in database

**Solutions**:
1. Check Brevo connection in Store > Email
2. **Verify sender email**: If you entered an unverified email, Brevo sent a verification email. Check your inbox (including spam) and click the verification link.
3. Verify template is active (`is_active = true`)
4. Check server logs for detailed error messages
5. Test connection with "Send Test Email" feature
6. Ensure API key is valid and not revoked

**Common Issue - Unverified Sender Email**:
- When you save a new sender email in Brevo configuration, Brevo sends a verification email to that address
- The email subject is usually "Please confirm your email address"
- You must click the verification link before Brevo will send emails from that address
- Check spam folder if you don't see the verification email
- Verification typically takes 1-2 minutes after clicking the link

### API Key Connection Failed

**Problem**: "Failed to connect to Brevo" error

**Solutions**:
1. Verify API key is correct and starts with "xkeysib-"
2. Check that API key has not been revoked in Brevo dashboard
3. Ensure API key has email sending permissions
4. Check backend logs for detailed error messages

### Variables Not Replacing

**Problem**: Email shows `{{customer_name}}` instead of actual name

**Solutions**:
1. Verify variable name matches exactly (case-sensitive)
2. Check variable is passed in sendTransactionalEmail() call
3. Ensure template content_type is set correctly
4. Check backend logs for template rendering errors

### Translations Not Working

**Problem**: Email always sends in English

**Solutions**:
1. Verify translation exists for the language code
2. Check languageCode parameter in email sending code
3. Ensure EmailTemplateTranslation records exist in database
4. Use bulk translate feature to create translations

### Missing Templates

**Problem**: No email templates appear in admin UI

**Solutions**:
1. Run seed script: `node backend/src/database/seeds/seed-default-email-templates.js`
2. Verify store exists in database
3. Check store_id filter in API call
4. Manually create templates via API or UI

---

## Production Deployment

### Render Backend

1. **No environment variables needed** for Brevo (API keys configured per-store in admin UI)

2. Migrations run automatically on deployment via `auto-migrations.js`

3. Seed templates using SQL (one-time setup):
   ```bash
   # Run via Render shell or psql
   psql $DATABASE_URL -f backend/seed-email-templates-quick.sql
   ```

4. Configure Brevo API key in admin UI for each store (Settings > Brevo tab)

### Vercel Frontend

No additional configuration needed. Frontend uses backend API URLs.

### Per-Store Configuration

Each store owner configures their own Brevo API key:
- Go to Settings > Brevo tab
- Enter their Brevo API key
- Different stores can use different Brevo accounts
- API keys are stored securely in database

### Security Considerations

1. **API Key Storage**: Brevo API keys are stored in database `access_token` field. For enhanced security, consider:
   - Encrypting API keys at rest
   - Using environment variables for additional encryption keys
   - Rotating API keys periodically

2. **Sender Email Verification**: Always verify sender emails in Brevo to prevent spoofing

3. **Rate Limiting**: Brevo has built-in rate limits (free tier: 300/day). Monitor `email_send_logs` for throttling.

4. **Sensitive Data**: Never include passwords, credit card numbers, or sensitive customer data in email templates.

---

## Future Enhancements

### Planned Features

- [ ] Email scheduling (send at specific time)
- [ ] Email campaigns (bulk send to customer lists)
- [ ] A/B testing different email templates
- [ ] Email analytics dashboard (open rates, click tracking)
- [ ] Custom SMTP alternative to Brevo
- [ ] Email templates marketplace
- [ ] Drag-and-drop HTML email builder
- [ ] Email preview with device simulation
- [ ] Webhook for Brevo delivery events
- [ ] Auto-retry failed emails

### Adding New Email Types

1. Add variables to `email-template-variables.js`
2. Add to `emailTypes` object in `EmailTemplateForm.jsx`
3. Create template via UI or seed script
4. Call `emailService.sendTransactionalEmail()` in your code

Example:
```javascript
// In your route handler
await emailService.sendTransactionalEmail(storeId, 'password_reset', {
  recipientEmail: user.email,
  customer: user,
  store: store,
  reset_link: resetUrl,
  languageCode: 'en'
});
```

---

## Support

For issues or questions:
1. Check server logs: `backend/logs/` or Render logs
2. Check email send logs in database: `SELECT * FROM email_send_logs ORDER BY created_at DESC LIMIT 20;`
3. Test Brevo connection in Settings > Brevo tab
4. Review this documentation

---

## Changelog

### v1.0.0 (2025-10-31)
- Initial release
- Signup, credit purchase, and order success emails
- Brevo OAuth integration
- Multi-language support with AI translation
- Admin UI with grid layout
- Template and HTML content modes
- Attachment support configured
- Email send logging and statistics

---

**Last Updated**: 2025-10-31
**Version**: 1.0.0
**License**: Proprietary
