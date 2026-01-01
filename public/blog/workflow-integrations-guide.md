# Workflow Integrations: Connect Your Store to n8n, Zapier & Make

Automate your e-commerce workflows by connecting your store to powerful automation platforms. This guide covers setting up webhook integrations with n8n, Zapier, and Make to streamline your operations.

## Why Workflow Automation?

Manual tasks eat up valuable time. With workflow automation, you can:

- **Automate order processing** - Send order data to fulfillment services, accounting software, or CRMs
- **Sync customer data** - Keep your email marketing lists, CRMs, and support tools in sync
- **Trigger notifications** - Alert your team via Slack, email, or SMS when important events occur
- **Build custom workflows** - Create complex automations tailored to your business needs

## Supported Platforms

### n8n (Self-Hosted)

n8n is an open-source workflow automation tool that you can self-host for complete data control.

**Best for:**
- Teams requiring data privacy and self-hosting
- Complex workflows with custom logic
- Developers who want full customization

**Key Features:**
- Visual workflow editor
- 400+ integrations
- Custom JavaScript nodes
- Self-hosted or cloud options

### Zapier

Zapier is the most popular no-code automation platform with thousands of app integrations.

**Best for:**
- Non-technical users
- Quick setup without coding
- Connecting to popular business apps

**Key Features:**
- 5,000+ app integrations
- Pre-built templates (Zaps)
- Multi-step workflows
- Conditional logic

### Make (formerly Integromat)

Make offers a visual workflow builder with advanced features for complex automations.

**Best for:**
- Visual workflow design
- Complex data transformations
- Advanced error handling

**Key Features:**
- Visual scenario builder
- Data mapping tools
- Scheduling options
- HTTP/Webhook modules

## Setting Up Your First Integration

### Step 1: Create a Webhook in Your Automation Platform

#### For n8n:

1. Open your n8n instance
2. Create a new workflow
3. Add a "Webhook" trigger node
4. Set the HTTP Method to "POST"
5. Copy the webhook URL (e.g., `https://your-n8n.com/webhook/abc123`)

#### For Zapier:

1. Create a new Zap
2. Choose "Webhooks by Zapier" as the trigger
3. Select "Catch Hook"
4. Copy the webhook URL provided

#### For Make:

1. Create a new Scenario
2. Add a "Webhooks" module
3. Select "Custom webhook"
4. Create a new webhook and copy the URL

### Step 2: Add the Webhook in Your Store

1. Navigate to **Import & Export > Workflows** in your admin panel
2. Click **Add Webhook**
3. Select your platform (n8n, Zapier, or Make)
4. Enter a descriptive name (e.g., "Order Notifications")
5. Paste your webhook URL
6. Select the events you want to trigger the webhook

### Step 3: Configure Authentication (Optional)

For added security, configure authentication:

| Auth Type | Use Case |
|-----------|----------|
| **None** | Internal/trusted networks |
| **API Key** | Simple token-based auth |
| **Basic Auth** | Username/password protection |
| **Bearer Token** | OAuth-style token auth |
| **HMAC Signature** | Payload verification |

#### HMAC Signature Verification

HMAC signatures ensure webhook payloads haven't been tampered with:

```javascript
// Example: Verify HMAC signature in n8n
const crypto = require('crypto');

const payload = JSON.stringify($input.body);
const signature = $input.headers['x-webhook-signature'];
const secret = 'your-secret-key';

const expectedSignature = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

### Step 4: Test Your Webhook

1. Click the **Test** button next to your webhook
2. Check your automation platform for the incoming test payload
3. Verify the data structure matches your expectations

## Available Events

Your store can send webhooks for these events:

| Event | Description | Example Use Case |
|-------|-------------|------------------|
| `order_placed` | New order created | Fulfillment, notifications |
| `customer_created` | New customer registered | Welcome email, CRM sync |
| `add_to_cart` | Product added to cart | Abandoned cart flows |
| `checkout_started` | Checkout initiated | Recovery campaigns |
| `abandoned_cart` | Cart abandoned | Win-back automations |
| `product_view` | Product page viewed | Personalization |
| `page_view` | Any page viewed | Analytics |
| `search` | Search performed | Product recommendations |

## Webhook Payload Structure

All webhooks send a consistent JSON payload:

```json
{
  "event": "order_placed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "store_id": "store-uuid",
  "store_name": "My Store",
  "event_id": "evt_abc123",
  "data": {
    "order_id": "ORD-12345",
    "customer_email": "customer@example.com",
    "total_amount": 99.99,
    "currency": "USD",
    "items": [
      {
        "product_id": "prod-123",
        "name": "Product Name",
        "quantity": 2,
        "price": 49.99
      }
    ]
  }
}
```

## Example Workflows

### 1. Order to Slack Notification

**Platform:** Zapier

1. Trigger: Webhook (order_placed event)
2. Action: Slack - Send Channel Message
3. Message template:
   ```
   New Order! {{data.order_id}}
   Customer: {{data.customer_email}}
   Total: ${{data.total_amount}}
   ```

### 2. Customer to Mailchimp

**Platform:** Make

1. Trigger: Custom Webhook (customer_created event)
2. Action: Mailchimp - Add/Update Subscriber
3. Map fields:
   - Email: `{{data.email}}`
   - First Name: `{{data.first_name}}`
   - Last Name: `{{data.last_name}}`

### 3. Order to Google Sheets

**Platform:** n8n

1. Webhook trigger node
2. Google Sheets node - Append Row
3. Map order data to spreadsheet columns

### 4. Abandoned Cart Recovery

**Platform:** Any

1. Trigger: Webhook (abandoned_cart event)
2. Wait: 1 hour delay
3. Condition: Check if order was placed
4. Action: Send recovery email via your email provider

## Troubleshooting

### Webhook Not Receiving Data

1. **Check the webhook URL** - Ensure it's correctly copied
2. **Verify the webhook is active** - Check the toggle in your settings
3. **Check delivery logs** - View the logs in Import & Export > Workflows
4. **Test the endpoint** - Use the Test button to send a sample payload

### Authentication Errors

1. **API Key issues** - Verify the header name matches your platform's expectations
2. **HMAC failures** - Ensure the secret key and algorithm match on both ends
3. **Basic Auth** - Check username/password are URL-encoded if they contain special characters

### Duplicate Events

If you're receiving duplicate webhooks:

1. Check your event subscriptions - you may have multiple webhooks for the same event
2. Implement idempotency using the `event_id` field
3. Add deduplication logic in your workflow

## Best Practices

1. **Use descriptive names** - Name webhooks clearly (e.g., "Slack Order Alerts" not "Webhook 1")
2. **Limit event types** - Only subscribe to events you need to reduce noise
3. **Implement error handling** - Add retry logic and error notifications in your workflows
4. **Monitor delivery logs** - Regularly check for failed deliveries
5. **Use HMAC for production** - Always verify webhook signatures in production environments
6. **Test thoroughly** - Use the test feature before going live

## Security Recommendations

- **Enable authentication** - Never use "None" for production webhooks
- **Use HTTPS** - All webhook URLs should use HTTPS
- **Rotate secrets** - Periodically rotate API keys and HMAC secrets
- **Limit IP addresses** - If your platform supports it, whitelist your store's IP
- **Validate payloads** - Always validate incoming data before processing

## Next Steps

1. **Start simple** - Begin with a single webhook for order notifications
2. **Expand gradually** - Add more automations as you identify repetitive tasks
3. **Monitor performance** - Use the delivery logs to track success rates
4. **Optimize workflows** - Refine your automations based on real-world usage

Ready to automate? Head to **Import & Export > Workflows** in your admin panel to create your first integration!
