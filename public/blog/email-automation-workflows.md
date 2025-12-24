# Building Email Automation Workflows

Create automated email sequences that nurture leads, convert customers, and drive repeat purchases around the clock.

---

## What Are Email Automations?

Email automations are triggered sequences that send automatically based on customer behavior or events. Unlike campaigns (one-time sends), automations run continuously.

### Key Benefits

| Benefit | Impact |
|---------|--------|
| Time savings | Set up once, runs forever |
| Consistency | Every customer gets the same experience |
| Timeliness | Messages sent at perfect moment |
| Personalization | Based on actual behavior |
| Revenue | Higher conversion than batch emails |

---

## Essential Automation Flows

Every store should have these core automations:

### 1. Welcome Series

**Trigger**: New subscriber or customer signup

**Goal**: Introduce your brand and drive first purchase

**Example flow**:
```
Email 1 (Immediate): Welcome + 10% discount
Email 2 (Day 2): Your brand story
Email 3 (Day 4): Best sellers + social proof
Email 4 (Day 7): Last chance for discount
```

**Expected results**: 45-50% open rate, 8-12% conversion

### 2. Abandoned Cart

**Trigger**: Cart abandoned for 1+ hour

**Goal**: Recover lost sales

**Example flow**:
```
Email 1 (1 hour): Reminder with cart contents
Email 2 (24 hours): 5% discount offer
Email 3 (72 hours): Urgency + 10% off
```

**Expected results**: 40-45% open rate, 5-10% recovery

### 3. Post-Purchase

**Trigger**: Order placed

**Goal**: Ensure satisfaction and encourage reviews

**Example flow**:
```
Email 1 (Immediate): Thank you + what's next
Email 2 (Day 3): Shipping update + tips
Email 3 (Day 10): Review request
Email 4 (Day 30): Related products
```

**Expected results**: 50-60% open rate, 10-15% review rate

### 4. Win-Back

**Trigger**: No purchase in 60+ days

**Goal**: Reactivate lapsed customers

**Example flow**:
```
Email 1 (Day 60): We miss you + what's new
Email 2 (Day 67): Special offer (15%)
Email 3 (Day 74): Final offer expires
```

**Expected results**: 25-30% open rate, 3-5% reactivation

### 5. Browse Abandonment

**Trigger**: Viewed products but didn't purchase

**Goal**: Convert interest into purchase

**Example flow**:
```
Email 1 (2 hours): Products you viewed
Email 2 (24 hours): Similar recommendations
```

**Expected results**: 35-40% open rate, 4-6% conversion

---

## Creating Your First Automation

### Step-by-Step Setup

1. Go to **Marketing > Automations**
2. Click **Create Automation**
3. Choose a template or start from scratch

### Configure the Trigger

Select what starts the automation:

| Trigger Type | When It Fires |
|--------------|---------------|
| Newsletter signup | Form submission |
| Account created | Registration complete |
| Order placed | Checkout complete |
| Cart abandoned | Left without checkout |
| Product viewed | Page visit (no purchase) |
| Customer in segment | Joins specific segment |
| Date-based | Birthday, anniversary |

### Add Steps

Build your flow with these elements:

**Actions**:
- Send email
- Send SMS
- Add tag
- Update property
- Add to segment

**Control**:
- Wait (time delay)
- If/Then (conditions)
- Split (A/B test)
- Exit (end flow)

### Example Configuration

**Welcome Series Setup**:

```
Trigger: Newsletter Signup

Step 1: Send Email "Welcome to [Brand]"
Step 2: Wait 2 days
Step 3: Check - Has placed order?
  Yes -> Exit
  No -> Continue
Step 4: Send Email "Our Story"
Step 5: Wait 2 days
Step 6: Send Email "Best Sellers"
Step 7: Wait 3 days
Step 8: Check - Has placed order?
  Yes -> Exit
  No -> Continue
Step 9: Send Email "Your Discount Expires"
Step 10: Exit
```

---

## Automation Best Practices

### Timing Guidelines

| Automation | First Email | Frequency |
|------------|-------------|-----------|
| Welcome | Immediate | Every 2-3 days |
| Cart Abandon | 1 hour | 1 day, then 2 days |
| Post-Purchase | Immediate | 3 days, 10 days, 30 days |
| Win-Back | 60 days lapse | Weekly |
| Browse Abandon | 2 hours | Daily max |

### Email Frequency

Don't overwhelm customers:
- Maximum 1 automation email per day
- Priority system for overlapping automations
- Respect unsubscribes and preferences
- Include suppression rules

### Exit Conditions

Stop automations when goal is achieved:

| Automation | Exit When |
|------------|-----------|
| Welcome | First purchase made |
| Cart Abandon | Cart purchased |
| Win-Back | New purchase made |
| Browse Abandon | Product purchased |

---

## Personalization in Automations

### Dynamic Content

Use variables for personalization:

| Variable | Output |
|----------|--------|
| `{first_name}` | Customer's first name |
| `{cart_items}` | Cart contents |
| `{product_name}` | Viewed product |
| `{discount_code}` | Generated coupon |
| `{order_number}` | Recent order |

### Conditional Content

Show different content based on data:

```
{if customer.total_orders > 3}
  "As one of our loyal customers..."
{else}
  "Thanks for shopping with us..."
{endif}
```

### Product Recommendations

Include personalized products:
- Recently viewed
- Based on purchase history
- Best sellers in category
- Complementary products

---

## Advanced Automation Strategies

### Multi-Branch Flows

Create different paths based on behavior:

```
Trigger: Cart Abandoned

Split: Cart value
  > $100 -> High-value sequence
  < $100 -> Standard sequence

High-value:
  - Personal email from support
  - Higher discount offer
  - Phone call reminder

Standard:
  - Automated reminder
  - Standard discount
  - Urgency messaging
```

### A/B Testing in Automations

Test elements within flows:

1. Add **Split** step
2. Create variants:
   - Subject line A vs B
   - 10% off vs 15% off
   - Short vs long email
3. Set traffic split (50/50)
4. Measure results

### Cross-Sell Sequences

After purchase, recommend related products:

**Electronics example**:
- Day 3: Accessories for their purchase
- Day 14: Protection plan offer
- Day 30: Upgrade options
- Day 90: New model announcement

**Fashion example**:
- Day 3: Style tips for their purchase
- Day 7: Complete the look items
- Day 30: New arrivals in their size
- Seasonal: Wardrobe refresh

---

## Automation Metrics

### Key Performance Indicators

| Metric | Good | Great | Action if Low |
|--------|------|-------|---------------|
| Open Rate | 35%+ | 50%+ | Improve subject lines |
| Click Rate | 3%+ | 8%+ | Better CTAs, content |
| Conversion | 2%+ | 5%+ | Offer, timing, personalization |
| Unsubscribe | <0.5% | <0.2% | Reduce frequency |

### Revenue Attribution

Track automation revenue:
- Total revenue generated
- Revenue per email
- Revenue per automation
- ROI (revenue vs cost)

### Flow Health Metrics

Monitor automation health:
- Active enrollments
- Completion rate
- Drop-off points
- Error rates

---

## Automation Templates

### Welcome Series Template

**Email 1: Welcome**
```
Subject: Welcome to [Brand] - Here's 10% off
Preview: Your exclusive welcome offer inside

Hi {first_name},

Thanks for joining [Brand]!

Here's your exclusive welcome discount:
Use code WELCOME10 for 10% off your first order.

[Shop Now]

What to expect:
- New product announcements
- Exclusive offers
- Style tips and inspiration

See you soon!
[Brand Team]
```

**Email 2: Brand Story**
```
Subject: The story behind [Brand]
Preview: Why we started this journey

Hi {first_name},

We started [Brand] because [story].

Our mission is [mission].

See what makes us different [link].

[Browse Collection]
```

### Cart Abandonment Template

**Email 1: Reminder**
```
Subject: You left something behind
Preview: Your cart is waiting

Hi {first_name},

Looks like you didn't finish checking out.

{cart_items}

Your items are still available:

[Return to Cart]

Need help? Reply to this email.
```

---

## Integrations

### Marketing Platforms

Connect for enhanced capabilities:

| Platform | Integration Type | Benefits |
|----------|-----------------|----------|
| Klaviyo | Native | Advanced flows, predictive analytics |
| Mailchimp | API | Familiar interface, good templates |
| HubSpot | API | CRM integration, lead scoring |
| ActiveCampaign | API | Advanced automation, CRM |

### Setup Process

1. Go to **Settings > Integrations**
2. Select platform
3. Enter API credentials
4. Map customer fields
5. Sync data
6. Create automations in either system

---

## Troubleshooting

### Emails Not Sending

**Check**:
- Automation is active
- Trigger conditions are met
- Email content is valid
- Suppression rules
- Daily send limits

### Low Performance

**Analyze**:
- Subject line quality
- Send timing
- Content relevance
- List quality
- Technical issues (deliverability)

### Overlapping Automations

**Solutions**:
- Set priority levels
- Use suppression windows
- Exit from lower-priority flows
- Limit daily automations per person

---

## Compliance

### Legal Requirements

Ensure your automations comply with:
- CAN-SPAM (US)
- GDPR (EU)
- CASL (Canada)
- Local regulations

### Requirements Checklist

- [ ] Unsubscribe link in every email
- [ ] Physical address included
- [ ] Clear sender identification
- [ ] Prompt unsubscribe processing
- [ ] Consent documented
- [ ] Data handling transparent

---

## Getting Started Checklist

1. [ ] Set up Welcome Series (highest impact)
2. [ ] Create Cart Abandonment flow
3. [ ] Build Post-Purchase sequence
4. [ ] Implement Win-Back automation
5. [ ] Add Browse Abandonment
6. [ ] Monitor and optimize

---

## Next Steps

After setting up automations:

1. **Monitor performance** - Check metrics weekly
2. **A/B test** - Continuously improve
3. **Add advanced flows** - Birthday, VIP, cross-sell
4. **Integrate CRM** - Connect customer data

See our Email Marketing Guide for campaign strategies.
