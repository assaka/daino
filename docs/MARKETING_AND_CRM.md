# Marketing & CRM Features

DainoStore includes a complete marketing suite for email campaigns, customer segmentation, and automated workflows. External integrations are optional - all core features work out of the box.

---

## Table of Contents

1. [Email Campaigns](#email-campaigns)
2. [Customer Segments](#customer-segments)
3. [Marketing Automations](#marketing-automations)
4. [RFM Customer Scoring](#rfm-customer-scoring)
5. [Marketing Integrations](#marketing-integrations)
6. [CRM (Optional)](#crm-optional)

---

## Email Campaigns

**Location:** Marketing → Campaigns

Send one-time email broadcasts to targeted customer segments.

### Creating a Campaign

1. **Create a Segment First**
   - Go to Marketing → Segments
   - Create a segment (e.g., "All Customers", "VIP Customers", "New This Month")

2. **Create the Campaign**
   - Click "Create Campaign"
   - Fill in:
     - **Campaign Name** – Internal identifier (customers don't see this)
     - **Subject Line** – What appears in the inbox
     - **Preview Text** – Shows after subject in most email clients
     - **From Name/Email** – Sender identity
     - **Select Segment** – Who receives this email
     - **Email Content** – HTML content of your email

3. **Send or Schedule**
   - **Send Now** – Immediately queues for delivery
   - **Schedule** – Pick a future date/time

### Personalization Variables

Use these in your email content:

| Variable | Description |
|----------|-------------|
| `{{customer_first_name}}` | Customer's first name |
| `{{customer_last_name}}` | Customer's last name |
| `{{customer_email}}` | Customer's email |
| `{{store_name}}` | Your store name |
| `{{store_url}}` | Your store URL |

### Campaign Statuses

| Status | Meaning |
|--------|---------|
| Draft | Not sent, can be edited |
| Scheduled | Will send at specified time |
| Sending | Currently being delivered |
| Sent | Delivery complete |
| Failed | Delivery failed |

### Tracking

After sending, view:
- **Sent count** – How many emails were delivered
- **Open count** – How many recipients opened
- **Click count** – How many clicked a link

---

## Customer Segments

**Location:** Marketing → Segments

Group customers based on behavior, purchase history, or profile data.

### Segment Types

| Type | Description |
|------|-------------|
| **Dynamic** | Automatically updates as customers match/unmatch criteria |
| **Static** | Fixed list, doesn't change unless manually updated |
| **RFM-based** | Pre-built segments based on RFM scores |

### Available Filters

| Field | Operators |
|-------|-----------|
| Email | equals, contains, starts_with, ends_with |
| First/Last Name | equals, contains |
| Total Spent | greater_than, less_than, between |
| Total Orders | greater_than, less_than, equals |
| Last Order Date | before, after, in_last_days |
| Created At | before, after, in_last_days |
| Tags | contains, not_contains |
| Customer Type | equals (guest/registered) |
| Is Active | equals (true/false) |

### Pre-built RFM Segments

These segments are automatically available based on RFM scoring:

| Segment | Description |
|---------|-------------|
| Champions | Best customers - recent, frequent, high spend |
| Loyal Customers | Consistent buyers with good spend |
| Potential Loyalists | Recent customers with growth potential |
| New Customers | Just made their first purchase |
| At Risk | Were good customers, becoming inactive |
| Can't Lose | High-value customers going dormant |
| Lost | Haven't purchased in a long time |

---

## Marketing Automations

**Location:** Marketing → Automations

Create automated workflows triggered by customer actions.

### Trigger Types

| Trigger | When it fires |
|---------|---------------|
| Customer Created | New customer registers or places first order |
| Order Placed | Customer completes a purchase |
| Order Fulfilled | Order is marked as fulfilled/shipped |
| Abandoned Cart | Cart inactive for specified time |
| Tag Added | Specific tag added to customer |
| Segment Entered | Customer matches segment criteria |
| Date-based | Specific date (e.g., birthday) |
| Manual | Triggered via API or admin action |

### Action Types

| Action | What it does |
|--------|--------------|
| Send Email | Sends an email template |
| Send SMS | Sends SMS (requires SMS provider) |
| Add Tag | Adds tag(s) to customer |
| Remove Tag | Removes tag(s) from customer |
| Update Field | Updates customer profile field |
| Add to Segment | Adds customer to static segment |
| Remove from Segment | Removes from segment |
| Webhook | Calls external URL |
| Internal Notification | Notifies store admin |

### Flow Control

| Step | Purpose |
|------|---------|
| Delay | Wait for specified time (minutes, hours, days) |
| Condition | Branch based on customer data |
| Split | A/B test different paths |
| Wait for Event | Pause until event occurs |
| Exit | End the workflow |

### Pre-built Templates

| Template | Description |
|----------|-------------|
| Welcome Series | 3-email sequence for new customers |
| Abandoned Cart Recovery | Reminder emails for abandoned carts |
| Post-Purchase Follow-up | Thank you + review request |
| Win-Back Campaign | Re-engage inactive customers |
| Complete Your Profile | Encourage customers to add birthday/preferences |

### Example: Welcome Series

```
Trigger: Customer Created
  ↓
Step 1: Send "Welcome" email
  ↓
Step 2: Wait 3 days
  ↓
Step 3: Send "Getting Started" email
  ↓
Step 4: Wait 7 days
  ↓
Step 5: Send "Special Offer" email
```

---

## RFM Customer Scoring

RFM (Recency, Frequency, Monetary) scoring automatically analyzes customer value.

### How It Works

Each customer receives scores (1-5) for:

| Dimension | What it measures |
|-----------|------------------|
| **Recency (R)** | How recently they purchased |
| **Frequency (F)** | How often they purchase |
| **Monetary (M)** | How much they spend |

Higher scores = better customers.

### Score Calculation

- Scores are calculated using percentiles across all customers
- Updated automatically when orders are placed
- Stored in `customer_rfm_scores` table

### Using RFM Data

- **Segments**: Filter by R, F, M scores or use pre-built RFM segments
- **Automations**: Trigger workflows when customers enter "At Risk" segment
- **Campaigns**: Target "Champions" with VIP offers, "Lost" with win-back campaigns

---

## Marketing Integrations

**Location:** Marketing → Integrations

**These are optional.** DainoStore works without any external integrations.

### When to Use Integrations

| Use Case | Recommendation |
|----------|----------------|
| Just starting out | Use built-in features only |
| Already using Klaviyo/Mailchimp | Connect to sync customer data |
| Need advanced email design | Consider Mailchimp's template builder |
| Want unified CRM | Connect HubSpot |

### Available Integrations

#### Klaviyo
- Syncs customer profiles hourly
- Tracks purchases as events
- Supports SMS marketing
- Best for: E-commerce focused email marketing

#### Mailchimp
- Syncs subscribers to audiences
- Merge fields for personalization
- Tag-based segmentation
- Best for: Newsletter-focused marketing

#### HubSpot
- Creates contacts from customers
- Orders become deals in pipeline
- Activity timeline tracking
- Best for: B2B or sales-focused stores

### Sync Details

When connected, the system automatically syncs:

| Data | Frequency |
|------|-----------|
| Customer profiles | Hourly (background job) |
| New customers | Immediate |
| Purchase events | Immediate |
| Order totals | With each order |

---

## CRM (Optional)

**Location:** CRM section (hidden by default)

The CRM module is designed for B2B or high-touch sales scenarios. For typical B2C webshops, you can ignore this section entirely.

### Enabling CRM

1. Click "Manage Navigation" in the sidebar
2. Enable the CRM items

### CRM Features

#### Leads
- Track potential customers before they purchase
- Lead scoring
- Source tracking (website, referral, social, etc.)
- Convert leads to deals

#### Deals
- Track sales opportunities in pipelines
- Drag-and-drop Kanban board
- Deal value and probability tracking
- Link to customers or leads

#### Pipelines
- Customizable sales stages
- Multiple pipelines for different sales processes
- Mark stages as "Won" or "Lost"

#### Activities
- Log calls, emails, meetings, tasks
- Link to deals, leads, or customers
- Due date tracking
- Activity timeline

### When CRM is Useful

| Scenario | CRM Helpful? |
|----------|--------------|
| Standard B2C webshop | No |
| Wholesale/B2B orders | Yes |
| Custom quote requests | Yes |
| High-value products with sales cycle | Yes |
| Subscription services | Maybe |

---

## Customer Data Fields

### Standard Fields

| Field | Type | Description |
|-------|------|-------------|
| email | string | Customer email (required) |
| first_name | string | First name (required) |
| last_name | string | Last name (required) |
| phone | string | Phone number |
| date_of_birth | date | Birthday (optional) |
| gender | string | Gender (optional) |
| tags | array | Customer tags |
| total_spent | decimal | Lifetime spend |
| total_orders | integer | Lifetime order count |
| last_order_date | datetime | Most recent order |
| customer_type | string | "guest" or "registered" |

### Customer Types

| Type | Description |
|------|-------------|
| Guest | Created automatically from orders, no password |
| Registered | Has account with password, can log in |

Guests can be upgraded to registered accounts after checkout.

---

## Best Practices

### Email Campaigns

1. **Always test first** - Create a segment with just your email
2. **Personalize** - Use `{{customer_first_name}}` in subject and body
3. **Timing matters** - Send between 9-11am local time
4. **Subject lines** - Keep under 50 characters
5. **Mobile-first** - Most emails are read on mobile

### Segmentation

1. **Start simple** - Begin with 3-4 segments
2. **Use RFM** - Pre-built RFM segments are powerful
3. **Combine criteria** - "High spenders" + "No order in 60 days" = win-back target
4. **Review regularly** - Check segment sizes monthly

### Automations

1. **Welcome series is essential** - Set this up first
2. **Don't over-automate** - Start with 2-3 workflows
3. **Test thoroughly** - Use test customer before going live
4. **Monitor performance** - Check enrollment and completion rates

---

## Quick Start Checklist

```
[ ] 1. Set up email provider (Settings → Email)
[ ] 2. Create your first segment (Marketing → Segments)
[ ] 3. Set up Welcome Series automation (Marketing → Automations)
[ ] 4. Create a test campaign (Marketing → Campaigns)
[ ] 5. Send test to yourself
[ ] 6. Create Abandoned Cart automation
[ ] 7. Connect external integration (optional)
```

---

## API Endpoints

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/:id/send` - Send immediately
- `POST /api/campaigns/:id/schedule` - Schedule for later

### Segments
- `GET /api/segments` - List segments
- `POST /api/segments` - Create segment
- `GET /api/segments/:id/members` - Get segment members
- `POST /api/segments/:id/refresh` - Refresh dynamic segment

### Automations
- `GET /api/automations` - List workflows
- `POST /api/automations` - Create workflow
- `POST /api/automations/:id/activate` - Activate workflow
- `POST /api/automations/:id/pause` - Pause workflow

### Marketing Integrations
- `GET /api/marketing-integrations` - List integrations
- `POST /api/marketing-integrations/:provider/connect` - Connect provider
- `POST /api/marketing-integrations/:provider/sync-contact` - Sync single contact
