# Connecting to Klaviyo, Mailchimp, and HubSpot

Integrate your store with popular marketing platforms to unlock advanced email capabilities and customer insights.

---

## Overview

DainoStore connects with leading marketing platforms:

| Platform | Best For | Pricing |
|----------|----------|---------|
| Klaviyo | E-commerce focused, advanced segmentation | Pay per contact |
| Mailchimp | Getting started, simple automations | Free tier available |
| HubSpot | Full CRM + marketing suite | Free CRM + paid marketing |

---

## Klaviyo Integration

### Why Klaviyo?

- Built specifically for e-commerce
- Advanced predictive analytics
- Deep product catalog integration
- Pre-built e-commerce flows
- Revenue attribution

### Setting Up Klaviyo

#### Step 1: Create Klaviyo Account

1. Go to [klaviyo.com](https://klaviyo.com)
2. Sign up for a free account
3. Complete initial setup

#### Step 2: Get API Keys

1. In Klaviyo, go to **Account > Settings > API Keys**
2. Copy your **Public API Key**
3. Click **Create Private API Key**
4. Name it "DainoStore Integration"
5. Select required scopes:
   - Profiles (read/write)
   - Events (read/write)
   - Lists (read/write)
   - Campaigns (read/write)
6. Copy the private key (shown once)

#### Step 3: Connect in DainoStore

1. Go to **Settings > Integrations**
2. Click **Klaviyo**
3. Enter:
   - Public API Key
   - Private API Key
4. Click **Connect**
5. Verify connection status

### Data Synced to Klaviyo

| Data Type | What's Included |
|-----------|-----------------|
| Customers | Name, email, phone, address |
| Orders | Products, totals, dates |
| Products | Catalog for recommendations |
| Events | Viewed, added to cart, purchased |
| Segments | RFM and custom segments |

### Klaviyo Best Practices

**Use Klaviyo Flows for**:
- Welcome series
- Abandoned cart
- Post-purchase
- Win-back
- Browse abandonment

**Keep in DainoStore**:
- Transactional emails (order confirmations)
- Basic segments
- Simple automations

---

## Mailchimp Integration

### Why Mailchimp?

- Easy to use interface
- Good template library
- Free tier for small lists
- Familiar to many users
- Basic automation included

### Setting Up Mailchimp

#### Step 1: Create Mailchimp Account

1. Go to [mailchimp.com](https://mailchimp.com)
2. Sign up for an account
3. Complete setup wizard

#### Step 2: Get API Key

1. Click your profile icon
2. Go to **Account & Billing > Extras > API Keys**
3. Click **Create A Key**
4. Name it "DainoStore"
5. Copy the API key

#### Step 3: Find Your Server Prefix

Your server prefix is in your API key:
- Example key: `abc123def456-us21`
- Server prefix: `us21`

#### Step 4: Connect in DainoStore

1. Go to **Settings > Integrations**
2. Click **Mailchimp**
3. Enter:
   - API Key
   - Server Prefix
4. Click **Connect**
5. Select default audience (list)

### Data Synced to Mailchimp

| Data Type | What's Included |
|-----------|-----------------|
| Subscribers | Name, email |
| Merge fields | Custom properties |
| Tags | Based on behavior |
| E-commerce | Orders, products |

### Audience Mapping

Map DainoStore segments to Mailchimp tags:

| DainoStore Segment | Mailchimp Tag |
|--------------------|---------------|
| VIP Customers | vip |
| New Subscribers | new_subscriber |
| Repeat Buyers | repeat_buyer |
| At Risk | at_risk |

### Mailchimp Limitations

Be aware of limitations:
- Less advanced segmentation than Klaviyo
- E-commerce features require paid plans
- Automation capabilities more basic
- Product feeds may need manual setup

---

## HubSpot Integration

### Why HubSpot?

- Complete CRM platform
- Sales and marketing alignment
- Lead scoring and nurturing
- Detailed contact timelines
- Robust reporting

### Setting Up HubSpot

#### Step 1: Create HubSpot Account

1. Go to [hubspot.com](https://hubspot.com)
2. Sign up for free CRM
3. Upgrade to Marketing Hub if needed

#### Step 2: Create Private App

1. In HubSpot, go to **Settings > Integrations > Private Apps**
2. Click **Create a private app**
3. Name it "DainoStore"
4. Set scopes:
   - contacts (read/write)
   - e-commerce (read/write)
   - forms (read/write)
5. Create and copy access token

#### Step 3: Connect in DainoStore

1. Go to **Settings > Integrations**
2. Click **HubSpot**
3. Enter Access Token
4. Click **Connect**
5. Map properties

### Data Synced to HubSpot

| Data Type | HubSpot Object |
|-----------|----------------|
| Customers | Contacts |
| Orders | Deals |
| Products | Line Items |
| Companies | Companies (if B2B) |

### HubSpot for E-commerce

Use HubSpot's e-commerce bridge:
- Order creates deal
- Products become line items
- Revenue tracked in deal pipeline
- Customer journey visible in timeline

### Property Mapping

Map DainoStore fields to HubSpot properties:

| DainoStore | HubSpot Property |
|------------|------------------|
| Total Orders | Number of purchases |
| Total Spent | Lifetime value |
| Last Order | Last purchase date |
| Customer Status | Customer type |

---

## Choosing the Right Platform

### Decision Matrix

| Factor | Klaviyo | Mailchimp | HubSpot |
|--------|---------|-----------|---------|
| E-commerce focus | Best | Good | Moderate |
| Ease of use | Good | Best | Good |
| Price (small list) | $$ | Free/$ | Free/$$$ |
| Price (large list) | $$$ | $$ | $$$$ |
| Automation | Advanced | Basic | Advanced |
| Segmentation | Advanced | Basic | Advanced |
| CRM features | Basic | None | Best |
| Predictive analytics | Yes | Limited | Yes |

### Recommendations

**Choose Klaviyo if**:
- E-commerce is your focus
- You want advanced segmentation
- Revenue attribution is important
- You need predictive analytics

**Choose Mailchimp if**:
- You're just starting out
- Budget is limited
- You need simple emails
- Your list is small

**Choose HubSpot if**:
- You need full CRM
- Sales team needs visibility
- B2B or high-touch sales
- You want all tools in one place

---

## Sync Settings

### Sync Frequency

Configure how often data syncs:

| Setting | Options |
|---------|---------|
| Real-time | Instant sync (events) |
| Hourly | Regular updates |
| Daily | Batch updates |
| Manual | On-demand only |

### Sync Direction

| Direction | What Syncs |
|-----------|------------|
| To platform | Customers, orders, events |
| From platform | Email engagement, unsubscribes |
| Bi-directional | Full two-way sync |

### Field Mapping

Map custom fields between systems:

1. Go to integration settings
2. Click **Field Mapping**
3. Match DainoStore fields to platform fields
4. Set default values for missing data
5. Save mapping

---

## Event Tracking

### Events Sent to Platforms

| Event | Description | Trigger |
|-------|-------------|---------|
| Viewed Product | Customer viewed item | Page view |
| Added to Cart | Item added to cart | Add action |
| Started Checkout | Began checkout | Checkout start |
| Placed Order | Completed purchase | Order complete |
| Fulfilled Order | Order shipped | Fulfillment |

### Using Events

**Klaviyo flows**:
- Trigger on "Added to Cart" for cart abandonment
- Use "Viewed Product" for browse abandonment
- "Placed Order" starts post-purchase

**HubSpot workflows**:
- Create deals on "Placed Order"
- Update contact on events
- Trigger tasks for sales team

---

## Troubleshooting

### Connection Issues

**"Invalid API Key"**:
- Verify key is copied correctly
- Check for extra spaces
- Regenerate if needed

**"Permission Denied"**:
- Verify required scopes
- Check API key permissions
- Ensure account tier allows integration

**"Sync Failed"**:
- Check API rate limits
- Verify field mapping
- Review error logs

### Data Not Appearing

**Customers missing**:
- Check sync settings
- Verify customer has email
- Allow time for sync

**Orders not syncing**:
- Confirm order status
- Check field requirements
- Review mapping

### Duplicate Contacts

**Prevention**:
- Use email as unique identifier
- Enable de-duplication
- Set merge rules

**Resolution**:
- Merge duplicates in platform
- Audit sync settings
- Clean up before syncing

---

## Best Practices

### General

1. **Start with one platform** - Master it before adding others
2. **Clean data first** - Remove duplicates and invalid emails
3. **Test thoroughly** - Verify sync with test customers
4. **Document mapping** - Record field mappings for reference
5. **Monitor regularly** - Check sync status weekly

### For Each Platform

**Klaviyo**:
- Use their pre-built e-commerce flows
- Leverage predictive analytics
- Set up product recommendations

**Mailchimp**:
- Use audience segments for targeting
- Take advantage of template library
- Set up basic automations first

**HubSpot**:
- Align with sales process
- Use deals pipeline
- Leverage CRM features

---

## Migrating Between Platforms

### Before Migrating

1. Export all subscribers
2. Document current automations
3. Save email templates
4. Record segment definitions
5. Note any custom fields

### Migration Steps

1. Set up new platform
2. Import contact list
3. Recreate segments
4. Rebuild automations
5. Test everything
6. Switch integrations
7. Verify data flow
8. Disable old platform

### Post-Migration

- Monitor for issues
- Compare metrics
- Adjust as needed
- Fully disconnect old platform

---

## Next Steps

After connecting your platform:

1. **Verify data sync** - Check customer and order data
2. **Build segments** - Create key audience groups
3. **Set up automations** - Start with welcome and cart abandonment
4. **Create campaigns** - Send first targeted campaign
5. **Monitor results** - Track performance metrics

See our Email Automation Workflows guide for automation setup.
