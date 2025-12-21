# Email Header & Footer System - How It Works

## 🎯 Overview

The email header and footer system allows you to create **reusable templates** for email branding that can be used across all your transactional emails. This ensures consistent branding and makes it easy to update your email design in one place.

## 📧 How It Works

### Step 1: Header & Footer Templates Are Created

When you run the migration, two special email templates are created:

1. **`email_header`** - The branded header with your logo and store name
2. **`email_footer`** - The footer with contact info, links, and copyright

These are stored in the `email_templates` table just like other email templates.

### Step 2: Using Placeholders in Email Templates

When creating email templates (like `invoice_email` or `shipment_email`), you use special placeholders:

```html
{{email_header}}

<div style="padding: 20px;">
  <h2>Your Invoice</h2>
  <p>Hi {{customer_first_name}},</p>
  <!-- Your email content here -->
</div>

{{email_footer}}
```

### Step 3: Email Service Processes Placeholders

When an email is sent, the `email-service.js` processes these placeholders:

**Location:** `backend/src/services/email-service.js` (line 85-88)

```javascript
// Process email_header and email_footer placeholders
if (content && (content.includes('{{email_header}}') || content.includes('{{email_footer}}'))) {
  content = await this.processHeaderFooter(storeId, content, languageCode);
}
```

The `processHeaderFooter()` method (line 318-379):

1. **Finds the header template** from database (`identifier = 'email_header'`)
2. **Gets the correct language** translation if available
3. **Replaces** `{{email_header}}` with actual HTML content
4. **Repeats** for `{{email_footer}}`

### Step 4: Variables Are Rendered

After header/footer replacement, the email service renders all remaining variables:

```javascript
const renderedContent = renderTemplate(content, variables);
```

This replaces things like `{{customer_first_name}}`, `{{order_number}}`, etc.

### Step 5: Email Is Sent

The final HTML (with header, content, footer, and all variables filled in) is sent via Brevo.

## 🔧 Example Flow

### Input (Invoice Email Template):
```html
{{email_header}}
<div style="padding: 20px;">
  <h2>Invoice #{{invoice_number}}</h2>
  <p>Hi {{customer_first_name}},</p>
  <p>Total: {{order_total}}</p>
</div>
{{email_footer}}
```

### After Header/Footer Processing:
```html
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <img src="https://mystore.com/logo.png">
  <h1>My Store</h1>
</div>

<div style="padding: 20px;">
  <h2>Invoice #{{invoice_number}}</h2>
  <p>Hi {{customer_first_name}},</p>
  <p>Total: {{order_total}}</p>
</div>

<div style="background-color: #f9fafb; padding: 30px;">
  <p>Questions? Contact us at support@mystore.com</p>
  <p>© 2025 My Store. All rights reserved.</p>
</div>
```

### After Variable Rendering:
```html
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
  <img src="https://mystore.com/logo.png">
  <h1>My Store</h1>
</div>

<div style="padding: 20px;">
  <h2>Invoice #INV-12345</h2>
  <p>Hi John,</p>
  <p>Total: $99.99</p>
</div>

<div style="background-color: #f9fafb; padding: 30px;">
  <p>Questions? Contact us at support@mystore.com</p>
  <p>© 2025 My Store. All rights reserved.</p>
</div>
```

## 🌍 Multi-Language Support

Header and footer templates support translations! When an email is sent in a specific language:

1. System looks for `email_header` translation in that language
2. If found, uses translated version
3. If not found, falls back to default (English) version

**Example:**
- English header: "Welcome to My Store"
- Dutch header: "Welkom bij Mijn Winkel"

## ✏️ Customizing Header & Footer

### Method 1: Through Admin Panel (Recommended)

1. Go to **Content → Emails**
2. Find template with identifier: `email_header`
3. Click **Edit**
4. Modify the HTML content
5. Click **Save**

Changes apply immediately to all emails using `{{email_header}}`!

### Method 2: Through Database

```sql
UPDATE email_templates
SET html_content = '<div>Your custom header HTML</div>'
WHERE identifier = 'email_header'
AND store_id = 'your-store-id';
```

### Method 3: Restore to Default

If you've customized and want to go back:

1. Open the template in admin
2. Click **"Restore to Default"** button
3. Confirm

This reverts to `default_html_content` stored in the database.

## 🔄 Variables Available in Header/Footer

### Email Header Variables:
- `{{store_name}}` - Your store name
- `{{store_logo_url}}` - URL to your logo image

### Email Footer Variables:
- `{{store_name}}` - Your store name
- `{{store_url}}` - Your store website URL
- `{{contact_email}}` - Support email
- `{{store_address}}` - Street address
- `{{store_city}}` - City
- `{{store_state}}` - State/Province
- `{{store_postal_code}}` - ZIP/Postal code
- `{{current_year}}` - Current year (2025)
- `{{unsubscribe_url}}` - Unsubscribe link

## 📝 Creating New Email Templates with Header/Footer

When creating a new email template:

```html
{{email_header}}

<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2>Your Custom Content</h2>
  <p>Hi {{customer_first_name}},</p>

  <!-- Your email body here -->

</div>

{{email_footer}}
```

**Important:** Always use `{{email_header}}` at the start and `{{email_footer}}` at the end for consistent branding!

## 🚫 What NOT to Do

### ❌ Don't Nest Variables in Header/Footer
```html
<!-- BAD: Header template should not have order-specific variables -->
<div>
  <h1>{{store_name}}</h1>
  <p>Order: {{order_number}}</p>  <!-- This won't work! -->
</div>
```

Header/footer templates should only use **store-level** variables, not order/customer-specific ones.

### ❌ Don't Include Header/Footer in Themselves
```html
<!-- BAD: email_header template should not include {{email_header}} -->
{{email_header}}
<div>My header</div>
{{email_header}}  <!-- This will cause infinite loop! -->
```

## 🔍 Troubleshooting

### Header/Footer Not Showing?

1. **Check template exists:**
   ```sql
   SELECT * FROM email_templates
   WHERE identifier IN ('email_header', 'email_footer')
   AND store_id = 'your-store-id';
   ```

2. **Check template is active:**
   ```sql
   SELECT identifier, is_active
   FROM email_templates
   WHERE identifier IN ('email_header', 'email_footer');
   ```

3. **Check for typos:**
   - Must be exactly `{{email_header}}` (not `{{header}}` or `{{emailHeader}}`)
   - Must be exactly `{{email_footer}}` (not `{{footer}}`)

### Header/Footer Variables Not Rendering?

Make sure you're passing the variables when sending emails:

```javascript
await emailService.sendEmail(storeId, 'invoice_email', recipientEmail, {
  ...otherVariables,
  store_logo_url: store.logo_url,
  store_name: store.name,
  contact_email: store.contact_email,
  store_address: store.address_line1,
  // ... etc
});
```

## 💡 Pro Tips

1. **Test header/footer changes** by sending a test email before going live
2. **Use inline CSS** for best email client compatibility
3. **Keep header/footer simple** - complex layouts may not render well in all email clients
4. **Preview in multiple clients** - Gmail, Outlook, Apple Mail, etc.
5. **Mobile responsive** - Use max-width and percentages for responsive design

## 📚 Code Reference

### Key Files:
- **Email Service:** `backend/src/services/email-service.js`
- **Process Header/Footer:** Line 318 - `processHeaderFooter()` method
- **Send Email:** Line 26 - `sendEmail()` method
- **Email Templates:** Database table `email_templates`

### How to Add New Placeholders:

If you want to add more placeholders like `{{email_banner}}`:

1. Create new template with identifier `email_banner`
2. Update `processHeaderFooter()` method:

```javascript
// In email-service.js, add after {{email_footer}} processing:
if (content.includes('{{email_banner}}')) {
  const bannerTemplate = await EmailTemplate.findOne({
    where: { store_id: storeId, identifier: 'email_banner', is_active: true }
  });

  if (bannerTemplate) {
    processedContent = processedContent.replace('{{email_banner}}', bannerTemplate.html_content);
  }
}
```

3. Use in your email templates: `{{email_banner}}`

## 🎨 Styling Examples

### Gradient Header
```html
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px;">
  <h1 style="color: white;">{{store_name}}</h1>
</div>
```

### Simple Footer
```html
<div style="text-align: center; padding: 20px; border-top: 1px solid #eee;">
  <p style="color: #999; font-size: 12px;">
    © {{current_year}} {{store_name}}
  </p>
</div>
```

### With Social Media Links
```html
<div style="text-align: center; padding: 30px;">
  <a href="{{facebook_url}}" style="margin: 0 10px;">
    <img src="facebook-icon.png" width="24" height="24">
  </a>
  <a href="{{twitter_url}}" style="margin: 0 10px;">
    <img src="twitter-icon.png" width="24" height="24">
  </a>
</div>
```

## ✅ Summary

**Email Header/Footer System:**
1. ✅ Created as special email templates (`email_header`, `email_footer`)
2. ✅ Used via placeholders (`{{email_header}}`, `{{email_footer}}`)
3. ✅ Processed by email service before sending
4. ✅ Support translations for multi-language stores
5. ✅ Editable through admin panel
6. ✅ Can be restored to default
7. ✅ Applied consistently across all emails

This ensures **professional, branded emails** with minimal effort! 🎉
