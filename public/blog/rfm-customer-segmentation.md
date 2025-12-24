# Customer Segmentation with RFM Analysis

Use Recency, Frequency, and Monetary value to identify your best customers and create targeted marketing campaigns.

---

## What is RFM Analysis?

RFM is a customer segmentation technique that scores customers based on:

- **Recency** (R): How recently did they purchase?
- **Frequency** (F): How often do they buy?
- **Monetary** (M): How much do they spend?

Customers who bought recently, buy frequently, and spend more are your best customers.

---

## Why Use RFM?

### Benefits

| Benefit | How It Helps |
|---------|--------------|
| Identify VIPs | Focus on top customers |
| Reduce churn | Catch at-risk customers early |
| Personalize marketing | Right message to right segment |
| Improve ROI | Target high-value opportunities |
| Allocate resources | Prioritize effort effectively |

### RFM vs Other Methods

| Method | Pros | Cons |
|--------|------|------|
| RFM | Simple, actionable, proven | Limited to purchase behavior |
| Demographics | Rich context | May not predict behavior |
| Behavioral | Detailed patterns | Complex to implement |
| Predictive | Forward-looking | Requires advanced analytics |

---

## Understanding RFM Scores

### Recency Score (1-5)

How long since last purchase:

| Score | Recency | Description |
|-------|---------|-------------|
| 5 | 0-30 days | Just bought |
| 4 | 31-60 days | Recent |
| 3 | 61-90 days | Moderate |
| 2 | 91-180 days | Lapsed |
| 1 | 180+ days | Dormant |

### Frequency Score (1-5)

Number of purchases:

| Score | Orders | Description |
|-------|--------|-------------|
| 5 | 10+ | Loyal buyer |
| 4 | 6-9 | Regular |
| 3 | 3-5 | Occasional |
| 2 | 2 | Repeat |
| 1 | 1 | One-time |

### Monetary Score (1-5)

Total spending:

| Score | Spend | Description |
|-------|-------|-------------|
| 5 | $1000+ | Big spender |
| 4 | $500-999 | High value |
| 3 | $200-499 | Medium value |
| 2 | $50-199 | Low value |
| 1 | Under $50 | Minimal |

---

## RFM Customer Segments

### Segment Definitions

| Segment | RFM Score | Description |
|---------|-----------|-------------|
| Champions | 555, 554, 545 | Best customers |
| Loyal | 453, 444, 535 | Consistent buyers |
| Promising | 531, 413, 414 | Recent + potential |
| New Customers | 512, 511, 411 | First-time buyers |
| At Risk | 255, 244, 145 | Haven't bought lately |
| Hibernating | 155, 144, 133 | Long lapse, low value |
| Lost | 111, 112, 121 | Gone dormant |

### Visual Representation

```
                    High Monetary
                         |
    Loyal Customers      |      Champions
    (444, 435)           |      (555, 545)
                         |
  ------------------- FREQUENCY -------------------
                         |
    At Risk              |      Promising
    (244, 145)           |      (531, 413)
                         |
                    Low Monetary
```

---

## Setting Up RFM in DainoStore

### Accessing RFM Segments

1. Go to **Marketing > Segments**
2. Click **RFM Segments**
3. View auto-calculated segments
4. Click any segment to see customers

### Customizing Thresholds

Adjust scoring to your business:

1. Go to **Marketing > RFM Settings**
2. Modify thresholds:

**Example for fashion retailer:**
```
Recency:
  Score 5: 0-14 days
  Score 4: 15-30 days
  Score 3: 31-60 days
  Score 2: 61-120 days
  Score 1: 120+ days

Frequency:
  Score 5: 8+ orders
  Score 4: 5-7 orders
  Score 3: 3-4 orders
  Score 2: 2 orders
  Score 1: 1 order

Monetary:
  Score 5: $500+
  Score 4: $300-499
  Score 3: $150-299
  Score 2: $50-149
  Score 1: Under $50
```

---

## Marketing by RFM Segment

### Champions (555)

**Profile**: Buy often, recently, spend a lot

**Strategy**:
- Early access to new products
- Exclusive VIP offers
- Referral program invitation
- Loyalty rewards
- Personal thank-you notes

**Email example**:
> "You're one of our top customers! Enjoy exclusive early access to our new collection before anyone else."

### Loyal Customers (444, 435)

**Profile**: Consistent buyers, good spending

**Strategy**:
- Loyalty program rewards
- Upsell premium products
- Cross-sell related items
- Ask for reviews
- Birthday rewards

**Email example**:
> "Thanks for being a loyal customer! Here's 15% off to show our appreciation."

### Promising (531, 413)

**Profile**: Bought recently but not often yet

**Strategy**:
- Welcome series
- Product recommendations
- Educational content
- Second purchase incentive
- Collect preferences

**Email example**:
> "Loved what you bought? Here are more items you might like, plus 10% off your next order."

### New Customers (512, 411)

**Profile**: Just made first purchase

**Strategy**:
- Welcome email series
- Product care tips
- Encourage second purchase
- Request feedback
- Introduce loyalty program

**Email example**:
> "Welcome to [Brand]! Here's a quick guide to get the most from your purchase."

### At Risk (255, 244)

**Profile**: Were good customers, buying less

**Strategy**:
- Win-back campaigns
- Special discount offers
- Ask what's wrong
- New product announcements
- Personalized recommendations

**Email example**:
> "We miss you! It's been a while since your last visit. Here's 20% off to welcome you back."

### Hibernating (155, 144)

**Profile**: Long time no purchase, lower value

**Strategy**:
- Aggressive win-back
- Survey to understand needs
- Major discount offers
- New collection highlights
- Consider reducing frequency

**Email example**:
> "A lot has changed since you last visited! Check out what's new with this special 25% discount."

### Lost (111, 112)

**Profile**: Inactive, low value

**Strategy**:
- Last-ditch reactivation
- Reduce email frequency
- Survey for feedback
- Consider suppression
- Focus resources elsewhere

**Email example**:
> "We'd love to have you back. Here's our biggest discount of the year."

---

## Creating RFM-Based Campaigns

### Step 1: Select Segment

1. Go to **Marketing > Campaigns**
2. Click **Create Campaign**
3. In **Audience**, select RFM segment

### Step 2: Craft Message

Match message to segment:

| Segment | Subject Line | Offer |
|---------|--------------|-------|
| Champions | Exclusive VIP access | Early access |
| Loyal | Thank you + reward | 15% off |
| Promising | We think you'll love... | 10% off |
| At Risk | We miss you | 20% off |
| Lost | Don't miss this | 30% off |

### Step 3: Track Results

Monitor by segment:
- Open rates
- Click rates
- Conversion rates
- Revenue generated
- ROI per segment

---

## Automation with RFM

### Set Up Triggers

Create automatic campaigns:

**Champion retention**:
- Trigger: Customer enters Champion segment
- Action: Send VIP welcome email

**At-risk intervention**:
- Trigger: Customer enters At Risk segment
- Action: Begin win-back sequence

**New customer nurture**:
- Trigger: Customer enters New segment
- Action: Start welcome series

### Example Automation Flow

```
Customer moves to "At Risk" segment
        |
        v
Wait 1 day
        |
        v
Send "We miss you" email (10% offer)
        |
        v
Wait 7 days
        |
        v
Check: Did they purchase?
   |           |
  Yes          No
   |           |
 Exit    Send follow-up (15% offer)
               |
               v
         Wait 14 days
               |
               v
         Send final offer (20% + free shipping)
```

---

## Measuring RFM Success

### Key Metrics

| Metric | What to Track |
|--------|---------------|
| Segment movement | Customers moving up/down |
| Retention rate | % staying in good segments |
| Win-back rate | % reactivated from At Risk |
| Revenue by segment | Contribution by tier |
| Campaign ROI | Return per segment |

### Segment Distribution

Track segment sizes monthly:

```
Month    Champions  Loyal  Promising  At Risk  Lost
Jan      8%         15%    20%        30%      27%
Feb      9%         16%    22%        28%      25%
Mar      10%        17%    21%        27%      25%
```

Goal: Grow top segments, shrink bottom.

---

## Advanced RFM Strategies

### Combined Scoring

Create composite scores:

**Simple**: R + F + M = Total score (3-15)

**Weighted**: Emphasize what matters most
```
Fashion: (R × 2) + (F × 1.5) + (M × 1)
Subscription: (F × 2) + (R × 1.5) + (M × 1)
Luxury: (M × 2) + (R × 1) + (F × 1)
```

### Predictive Extensions

Combine RFM with:
- Purchase probability
- Lifetime value prediction
- Churn probability
- Product affinity

### Industry Benchmarks

| Industry | Champion % | Lost % |
|----------|------------|--------|
| Fashion | 5-10% | 20-30% |
| Electronics | 3-5% | 30-40% |
| Food/Beverage | 10-15% | 15-25% |
| Subscription | 15-20% | 10-15% |

---

## Common Mistakes

### What to Avoid

| Mistake | Why It's Bad | Fix |
|---------|--------------|-----|
| Same message to all | Wastes good segments | Personalize by tier |
| Ignoring At Risk | They leave silently | Proactive intervention |
| Over-discounting VIPs | Erodes value | Offer access, not discounts |
| One-time analysis | Segments change | Regular recalculation |
| Wrong thresholds | Misclassification | Calibrate to your data |

### Best Practices

1. **Recalculate regularly** - Weekly or monthly
2. **Test and learn** - A/B test messages per segment
3. **Focus on movement** - Help customers move up
4. **Combine with context** - Add product preferences
5. **Allocate proportionally** - More effort on high potential

---

## RFM Reporting

### Dashboard Metrics

Set up a dashboard showing:
- Segment size trends
- Revenue by segment
- Average order value by segment
- Campaign performance by segment
- Segment migration patterns

### Export Options

Export for analysis:
1. Go to **Marketing > RFM Segments**
2. Select segment or all
3. Click **Export**
4. Download CSV with RFM scores

---

## Next Steps

After implementing RFM:

1. **Create segment-specific campaigns** - Start with Champions and At Risk
2. **Set up automations** - Trigger on segment changes
3. **Review monthly** - Track segment movement
4. **Refine thresholds** - Adjust based on results

Learn more about email automation in our Email Automation Workflows guide.
