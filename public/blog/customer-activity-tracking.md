# Using Customer Activity Tracking

Understand customer behavior through detailed activity tracking. See what customers view, click, and do on your store.

---

## Overview

Customer activity tracking captures:
- Page views and navigation
- Product interactions
- Cart behavior
- Search queries
- Click patterns
- Session data

This data helps you personalize experiences and optimize conversions.

---

## What Gets Tracked

### Automatic Tracking

DainoStore tracks these events automatically:

| Event | Data Captured |
|-------|---------------|
| Page View | URL, timestamp, referrer |
| Product View | Product ID, category, price |
| Add to Cart | Product, quantity, cart value |
| Remove from Cart | Product, quantity |
| Checkout Start | Cart contents, customer |
| Purchase | Order details, items, total |
| Search | Query, results count |
| Account Action | Login, signup, password reset |

### Session Information

For each visit:
- Device type
- Browser
- Location (country/city)
- Traffic source
- Pages visited
- Time on site

---

## Viewing Activity

### Customer Timeline

See individual customer activity:

1. Go to **Customers**
2. Select a customer
3. Click **Activity** tab

**Timeline shows**:
```
Today 3:45 PM - Viewed Product: Blue T-Shirt
Today 3:42 PM - Searched: cotton t-shirts
Today 3:40 PM - Visited: Homepage
Yesterday 5:20 PM - Completed Purchase #1234
Yesterday 5:15 PM - Added to Cart: Blue T-Shirt
```

### Activity Reports

View aggregated activity:

1. Go to **Analytics > Activity**
2. See overview of all activity
3. Filter by:
   - Event type
   - Date range
   - Customer segment
   - Product category

---

## Understanding Sessions

### What Is a Session?

A session is a single visit to your store:
- Starts when customer arrives
- Ends after 30 minutes of inactivity
- Tracks all actions during visit

### Session Details

For each session:

| Data | Example |
|------|---------|
| Duration | 8 minutes 32 seconds |
| Pages Viewed | 7 |
| Products Viewed | 4 |
| Cart Actions | 2 adds, 1 remove |
| Outcome | Purchased / Abandoned |

### Session Flow

Visualize the customer journey:

```
Homepage
    |
Category: T-Shirts
    |
Product: Blue T-Shirt --> Add to Cart
    |
Product: Red T-Shirt
    |
Cart --> Checkout --> Purchase
```

---

## Key Activity Metrics

### Engagement Metrics

| Metric | Definition | Good Value |
|--------|------------|------------|
| Avg Session Duration | Time on site | 3+ minutes |
| Pages per Session | Pages viewed | 4+ pages |
| Bounce Rate | Single-page visits | Under 50% |
| Return Rate | Repeat visitors | 25%+ |

### Conversion Metrics

| Metric | Definition | Benchmark |
|--------|------------|-----------|
| Product View Rate | Views / Sessions | 60%+ |
| Add to Cart Rate | Carts / Product Views | 15%+ |
| Checkout Rate | Checkouts / Carts | 50%+ |
| Purchase Rate | Purchases / Checkouts | 70%+ |

### Search Metrics

| Metric | What It Shows |
|--------|---------------|
| Search Usage | % of visitors who search |
| Searches per Session | Avg searches |
| Search Exit Rate | Leave after searching |
| Null Search Rate | No results found |

---

## Behavior Analysis

### Popular Pages

See most visited pages:

| Page | Views | Avg Time | Exit Rate |
|------|-------|----------|-----------|
| Homepage | 25,000 | 0:45 | 25% |
| Product: Blue Tee | 3,200 | 2:30 | 35% |
| Category: T-Shirts | 8,500 | 1:15 | 40% |

### Entry Points

Where customers start:

| Entry Page | Sessions | Bounce Rate |
|------------|----------|-------------|
| Homepage | 12,000 | 28% |
| Product Pages | 8,500 | 45% |
| Category Pages | 5,200 | 38% |
| Blog | 2,100 | 52% |

### Exit Points

Where customers leave:

| Exit Page | Exits | % of Total |
|-----------|-------|------------|
| Cart | 3,200 | 18% |
| Checkout Payment | 1,800 | 10% |
| Product Pages | 4,500 | 25% |
| Homepage | 2,100 | 12% |

---

## Product Interactions

### View to Cart Conversion

Track product page effectiveness:

| Product | Views | Add to Cart | Rate |
|---------|-------|-------------|------|
| Blue T-Shirt | 3,200 | 640 | 20% |
| Red Hoodie | 2,100 | 315 | 15% |
| Black Jeans | 1,800 | 360 | 20% |

### Product Engagement

Beyond views:
- Time on page
- Image views
- Variant selections
- Size chart views
- Review reads

### Related Behavior

What customers view together:

```
Customers who viewed Blue T-Shirt also viewed:
- Red T-Shirt (45%)
- Blue Hoodie (32%)
- Black Jeans (28%)
```

---

## Search Behavior

### Top Searches

| Query | Searches | Results | CTR |
|-------|----------|---------|-----|
| t-shirt | 1,250 | 45 | 65% |
| blue | 890 | 32 | 48% |
| size guide | 456 | 1 | 89% |

### Failed Searches

Queries with no results:

| Query | Searches | Action |
|-------|----------|--------|
| joggers | 125 | Add products |
| gift card | 89 | Enable feature |
| xxl | 67 | Add size |

### Search Refinement

How customers modify searches:

```
"shirt" -> "blue shirt" -> "blue cotton shirt"
```

Shows what customers are really looking for.

---

## Using Activity Data

### Personalization

Use activity for:
- Recommended products
- Personalized emails
- Dynamic content
- Retargeting ads

**Example**: Customer viewed blue products -> Show blue items first

### Email Triggers

Send based on activity:

| Trigger | Activity | Email |
|---------|----------|-------|
| Browse Abandon | Viewed, didn't buy | Product reminder |
| Cart Abandon | Added, didn't checkout | Cart recovery |
| Post-Purchase | Bought product | Related items |

### Customer Segments

Create segments from activity:

**High intent**:
- Viewed 5+ products
- Added to cart
- Returned within 7 days

**Research mode**:
- Long session time
- Many page views
- No purchases

---

## Privacy and Compliance

### What's Collected

Transparency about tracking:
- Anonymous until identified
- No personal data without consent
- Activity linked to email on signup/login

### Customer Rights

Support GDPR and privacy laws:
- View collected data
- Export activity history
- Request deletion
- Opt-out options

### Cookie Consent

Configure consent settings:

1. Go to **Settings > Privacy**
2. Enable cookie banner
3. Configure consent levels:
   - Essential (always)
   - Analytics (optional)
   - Marketing (optional)

---

## Technical Setup

### Built-In Tracking

DainoStore includes tracking automatically:
- No code required
- Works on all pages
- Respects consent settings

### Enhanced Tracking

For additional data:

1. Go to **Settings > Tracking**
2. Enable enhanced features:
   - Scroll depth
   - Video engagement
   - Form interactions
   - Click maps

### Third-Party Integration

Send activity to external tools:

| Platform | Data Sent |
|----------|-----------|
| Google Analytics | Page views, events |
| Facebook Pixel | Conversions, behavior |
| Klaviyo | All events, properties |
| Custom webhooks | Event data |

---

## Reports and Insights

### Activity Dashboard

Overview of all activity:
- Sessions today/week/month
- Event counts by type
- Trending products
- Search trends

### Behavioral Reports

Pre-built reports:

| Report | Shows |
|--------|-------|
| Customer Journey | Path to purchase |
| Product Discovery | How products found |
| Search Performance | Search effectiveness |
| Cart Analysis | Cart behavior patterns |

### Custom Analysis

Build custom views:

1. Go to **Analytics > Activity**
2. Click **Custom Report**
3. Select dimensions and metrics
4. Add filters
5. Save for reuse

---

## Optimization Opportunities

### Identify Issues

Use activity to find problems:

| Problem | Activity Signal |
|---------|-----------------|
| Poor product page | Low time on page |
| Confusing checkout | High exit at step |
| Wrong products | High bounce on category |
| Missing products | Failed searches |

### Test Improvements

Use activity to measure changes:

**Before/After**:
- Time on page
- Scroll depth
- Cart add rate
- Conversion rate

### A/B Testing

Connect activity to experiments:
- Track variant exposure
- Measure engagement difference
- Calculate conversion impact

---

## Best Practices

### Do

1. **Review regularly** - Weekly activity review
2. **Segment data** - Different customers, different behavior
3. **Act on insights** - Data should drive changes
4. **Respect privacy** - Clear consent, no overreach
5. **Test changes** - Verify improvements with data

### Don't

1. **Track everything** - Focus on meaningful events
2. **Ignore context** - Seasonality affects patterns
3. **Creepy personalization** - Balance relevance and privacy
4. **Delay action** - Insights expire

---

## Common Questions

**Q: How long is activity stored?**
A: Activity is stored for 12 months by default. Configurable in settings.

**Q: Can I export activity data?**
A: Yes, export from customer profiles or via API.

**Q: Does tracking slow down my store?**
A: No, tracking is asynchronous and lightweight.

**Q: How do I comply with GDPR?**
A: Enable consent banner, honor data requests, document processing.

---

## Next Steps

After setting up activity tracking:

1. **Review current data** - Understand baseline
2. **Identify opportunities** - Find improvement areas
3. **Set up alerts** - Notifications for key events
4. **Create segments** - Behavior-based groups
5. **Personalize** - Use data for better experiences

See our Analytics Dashboard guide for broader metrics.
