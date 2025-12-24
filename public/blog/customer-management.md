# Customer Management and Blacklisting

Build strong customer relationships and protect your store from fraud with effective customer management strategies.

---

## Overview

Good customer management helps you:
- Build loyalty and repeat business
- Personalize marketing messages
- Identify your best customers
- Handle issues efficiently
- Protect against fraud

This guide covers customer data, segmentation, and fraud prevention.

---

## Customer Profiles

### Viewing Customers

1. Go to **Customers** in the admin panel
2. See all registered customers
3. Search by name, email, or phone
4. Filter by status, orders, or date

### Customer Information

Each profile includes:

| Section | Data |
|---------|------|
| Contact | Name, email, phone |
| Addresses | Billing and shipping |
| Orders | Purchase history |
| Activity | Browse and interaction data |
| Notes | Internal comments |
| Tags | Custom labels |

### Editing Profiles

1. Click on a customer
2. Edit any field
3. Add notes or tags
4. Save changes

---

## Customer Tags

### Using Tags

Tags help organize customers:
- VIP
- Wholesale
- Influencer
- Problem customer
- Newsletter subscriber

### Adding Tags

**Individual**:
1. Open customer profile
2. Click **Add Tag**
3. Select or create tag

**Bulk**:
1. Select multiple customers
2. Click **Bulk Actions**
3. Choose **Add Tag**
4. Select tags to apply

### Tag-Based Actions

Use tags for:
- Email campaigns
- Discount eligibility
- Customer segmentation
- Internal filtering

---

## Customer Groups

### Creating Groups

Organize customers by type:

1. Go to **Customers > Groups**
2. Click **Create Group**
3. Configure:

| Setting | Example |
|---------|---------|
| Name | Wholesale Customers |
| Discount | 15% off all items |
| Access | Hidden products |
| Tax | Tax exempt |

### Assigning Customers

1. Open customer profile
2. Select **Customer Group**
3. Choose the group
4. Save

### Group Pricing

Set special pricing per group:
- Wholesale gets 30% off
- VIP gets early access pricing
- Staff gets cost price

---

## Customer Notes

### Internal Notes

Add notes visible only to your team:

1. Open customer profile
2. Scroll to **Notes**
3. Add note with timestamp
4. Save

**Use for**:
- Special requirements
- Past issues
- Preferences
- Conversation history

### Note Best Practices

- Be factual and professional
- Include dates and context
- Reference order numbers
- Note who added the comment

---

## Customer Activity

### Tracking Behavior

View customer interactions:

| Activity | Data |
|----------|------|
| Page views | Products viewed |
| Add to cart | Items added/removed |
| Searches | What they searched for |
| Sessions | When they visited |

### Using Activity Data

**Personalization**:
- Recommend viewed products
- Remind about cart items
- Follow up on interests

**Analysis**:
- Identify browsing patterns
- Find products of interest
- Understand buying journey

---

## Customer Segments

### Automatic Segments

DainoStore creates segments based on behavior:

| Segment | Definition |
|---------|------------|
| New Customers | First purchase in last 30 days |
| Repeat Buyers | 2+ orders total |
| At Risk | No purchase in 60+ days |
| Lapsed | No purchase in 90+ days |
| VIP | Top 10% by spend |

### Custom Segments

Create your own:

1. Go to **Marketing > Segments**
2. Click **Create Segment**
3. Define conditions:

**Example: High-Value New Customers**
```
Order count: 1
Order total: greater than $100
Order date: last 30 days
```

---

## Customer Communication

### Email Preferences

Manage what customers receive:

| Type | Description | Opt-out |
|------|-------------|---------|
| Transactional | Order updates | Cannot opt out |
| Marketing | Promotions | Customer choice |
| Newsletter | Regular content | Customer choice |
| Product updates | New arrivals | Customer choice |

### Contact History

Track all communications:
- Emails sent
- Support tickets
- Phone calls logged
- Chat transcripts

---

## Handling Customer Issues

### Support Workflow

1. Customer contacts support
2. Create ticket or note
3. Investigate issue
4. Resolve and document
5. Follow up if needed

### Common Issues

| Issue | Resolution | Prevention |
|-------|------------|------------|
| Wrong item | Reship correct item | Verify before shipping |
| Damaged | Replace or refund | Better packaging |
| Late delivery | Apologize + credit | Set realistic expectations |
| Never arrived | Reship or refund | Use tracking, signature |

### Escalation Path

1. Support team handles
2. Manager reviews if needed
3. Store owner final decision
4. Document everything

---

## Blacklisting Customers

### When to Blacklist

Consider blacklisting for:
- Confirmed fraud attempts
- Repeated chargebacks
- Abuse of return policy
- Harassment of staff
- Counterfeit payment methods

### Adding to Blacklist

1. Go to **Customers > Blacklist**
2. Click **Add Entry**
3. Enter:

| Field | Value |
|-------|-------|
| Type | Email, IP, Phone, Address |
| Value | The specific identifier |
| Reason | Why blacklisted |
| Duration | Permanent or expiry date |

### Blacklist Types

| Type | Blocks |
|------|--------|
| Email | Specific email address |
| Domain | Entire email domain |
| IP Address | Specific IP |
| IP Range | Range of IPs |
| Phone | Phone number |
| Address | Shipping/billing address |

---

## Fraud Prevention

### Warning Signs

| Red Flag | Risk Level |
|----------|------------|
| Different billing/shipping | Medium |
| Rush shipping on big order | Medium |
| Multiple declined cards | High |
| Unusual email domain | Low |
| First order very large | Medium |
| Multiple orders same day | High |

### Fraud Rules

Set up automatic blocks:

1. Go to **Settings > Fraud Prevention**
2. Enable rules:
   - Block orders from high-risk countries
   - Require verification for large orders
   - Flag mismatched billing/shipping
   - Block known proxy/VPN IPs

### Manual Review

For suspicious orders:

1. Place order on hold
2. Verify customer identity
3. Confirm shipping address
4. Check payment details
5. Release or cancel

---

## Customer Verification

### Verification Methods

| Method | When to Use |
|--------|-------------|
| Email confirmation | All new accounts |
| Phone verification | High-value orders |
| ID check | Suspicious orders |
| Address verification | Mismatched addresses |

### Requiring Verification

1. Go to **Settings > Customers**
2. Enable verification options
3. Set thresholds for additional checks

---

## Data Management

### Customer Data

What you store:
- Contact information
- Order history
- Payment methods (tokenized)
- Preferences
- Communication history

### Privacy Compliance

For GDPR and similar:
- Allow data download
- Enable account deletion
- Document data processing
- Get consent for marketing

### Data Requests

Handle customer requests:

1. **Data export**: Go to profile > Export Data
2. **Data deletion**: Go to profile > Delete Account
3. **Unsubscribe**: Profile > Email Preferences

---

## Exporting Customers

### Export Options

1. Go to **Customers**
2. Filter if needed
3. Click **Export**
4. Choose format:
   - CSV for spreadsheets
   - JSON for integrations

### Export Fields

| Field | Included |
|-------|----------|
| Name | Yes |
| Email | Yes |
| Phone | Yes |
| Orders | Count, total |
| Tags | Yes |
| Addresses | Optional |

---

## Customer Metrics

### Key Metrics

Track in **Analytics > Customers**:

| Metric | Meaning |
|--------|---------|
| Total customers | All registered |
| New this month | Recent signups |
| Repeat rate | % who order again |
| Average LTV | Lifetime value |
| Churn rate | % who stop buying |

### RFM Analysis

Segment by:
- **R**ecency: When last purchase
- **F**requency: How often
- **M**onetary: How much spent

Learn more in our RFM segmentation guide.

---

## Best Practices

1. **Keep data clean** - Remove duplicates, fix errors
2. **Use tags consistently** - Standard naming conventions
3. **Document issues** - Notes help team members
4. **Segment thoughtfully** - Don't over-complicate
5. **Protect privacy** - Only collect what you need
6. **Act on red flags** - Prevent fraud proactively

---

## Troubleshooting

### Duplicate Customers

**Issue**: Same person, multiple accounts

**Solution**:
1. Identify duplicates
2. Merge accounts (keeps order history)
3. Prevent with email verification

### Blacklist Not Working

**Check**:
- Entry is active
- Correct type (email vs domain)
- No typos in value
- Rule hasn't expired

### Customer Can't Log In

**Solutions**:
1. Verify account exists
2. Send password reset
3. Check if blacklisted
4. Clear browser cookies

---

## Next Steps

After setting up customer management:

1. **Create segments** - Group customers strategically
2. **Set up automation** - Email workflows for each segment
3. **Configure fraud rules** - Protect your store
4. **Plan loyalty program** - Reward best customers

Need help? Visit **Settings > Help** for support options.
