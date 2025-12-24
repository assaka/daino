# Product Feeds for Google Shopping

Get your products appearing in Google Shopping results. This guide covers feed setup, optimization, and troubleshooting.

---

## Overview

Google Shopping displays your products in:
- Google Search results
- Shopping tab
- Google Images
- YouTube
- Display Network

Benefits:
- High-intent shoppers
- Visual product listings
- Competitive pricing display
- Direct link to purchase

---

## Prerequisites

Before starting:

1. **Google Merchant Center account**
   - Go to [merchants.google.com](https://merchants.google.com)
   - Sign up with business Google account
   - Verify and claim your website

2. **Website requirements**
   - SSL certificate (HTTPS)
   - Clear return policy
   - Contact information
   - Terms of service

3. **Product requirements**
   - In-stock products
   - Accurate pricing
   - Quality images
   - Complete product data

---

## Setting Up Product Feeds

### Automatic Feed

DainoStore generates feeds automatically:

1. Go to **Marketing > Product Feeds**
2. Click **Google Shopping**
3. Click **Enable Feed**
4. Copy the feed URL

**Feed URL format**:
```
https://yourstore.com/feeds/google-shopping.xml
```

### Configuring Feed Settings

| Setting | Purpose |
|---------|---------|
| Currency | Price currency (USD, EUR, etc.) |
| Country | Target country |
| Language | Content language |
| Shipping | Include shipping info |
| Tax | Include tax info |

### Product Selection

Choose what to include:
- All products
- Specific categories
- In-stock only
- Exclude certain items

---

## Required Product Attributes

### Mandatory Fields

| Attribute | Description | Example |
|-----------|-------------|---------|
| id | Unique product ID | SKU-12345 |
| title | Product name | Blue Cotton T-Shirt |
| description | Product description | Soft cotton tee... |
| link | Product page URL | https://store.com/product |
| image_link | Main image URL | https://store.com/image.jpg |
| price | Current price | 29.99 USD |
| availability | Stock status | in_stock |
| brand | Manufacturer | YourBrand |

### Conditional Fields

Required for certain product types:

| Attribute | When Required |
|-----------|---------------|
| gtin | Required for known products |
| mpn | When gtin not available |
| condition | All products (new, used, refurbished) |
| size | Apparel |
| color | Apparel |
| gender | Apparel |
| age_group | Apparel |

---

## Submitting to Merchant Center

### Manual Upload

1. Download feed from DainoStore
2. Log in to Merchant Center
3. Go to Products > Feeds
4. Click Add Feed
5. Upload the file

### Automatic Fetch

Better option - Google fetches automatically:

1. In Merchant Center, go to Products > Feeds
2. Click Add Feed
3. Select "Scheduled fetch"
4. Enter your feed URL
5. Set fetch frequency (daily recommended)
6. Save

### Feed Schedule

| Setting | Recommendation |
|---------|----------------|
| Frequency | Daily |
| Time | Off-peak hours |
| Time zone | Your local timezone |

---

## Feed Optimization

### Title Optimization

Titles appear prominently in results:

**Best practices**:
- Include brand at start
- Add key attributes (color, size)
- Keep under 150 characters
- Front-load important keywords

**Examples**:
```
Bad: T-Shirt
Good: Nike Men's Dri-FIT Running T-Shirt - Blue - Medium
```

### Description Optimization

| Do | Don't |
|----|-------|
| Highlight key features | Include promotional text |
| Use natural language | Stuff keywords |
| Mention materials, uses | Add links or HTML |
| Include specifications | Be vague |

### Image Requirements

| Requirement | Specification |
|-------------|---------------|
| Format | JPEG, PNG, GIF, BMP, TIFF |
| Size | At least 100x100 (500x500+ recommended) |
| Quality | Clear, well-lit, no watermarks |
| Content | Product only (no text overlays) |

**Image tips**:
- White or neutral background
- Show product clearly
- Include multiple images
- Consistent styling

---

## Product Categories

### Google Product Taxonomy

Map your categories to Google's:

| Your Category | Google Category |
|---------------|-----------------|
| T-Shirts | Apparel & Accessories > Clothing > Shirts & Tops |
| Laptops | Electronics > Computers > Laptops |
| Dog Food | Animals & Pet Supplies > Pet Supplies > Dog Supplies > Dog Food |

### Setting Categories

1. Go to **Catalog > Categories**
2. Edit category
3. Go to **Feed Mapping** tab
4. Select Google product category
5. Save

Categories are inherited by products.

---

## Pricing and Availability

### Price Accuracy

Google checks prices against your site:
- Feed price must match page price
- Include currency
- Handle sales correctly

**Sale price format**:
```xml
<price>39.99 USD</price>
<sale_price>29.99 USD</sale_price>
<sale_price_effective_date>2024-01-01T00:00:00/2024-01-31T23:59:59</sale_price_effective_date>
```

### Availability Options

| Status | When to Use |
|--------|-------------|
| in_stock | Ready to ship |
| out_of_stock | Currently unavailable |
| preorder | Coming soon |
| backorder | Available on backorder |

---

## Shipping Information

### Shipping in Feed

Include shipping rates:

```xml
<shipping>
  <country>US</country>
  <service>Standard</service>
  <price>5.99 USD</price>
</shipping>
```

### Shipping Settings in Merchant Center

Configure in Merchant Center for more flexibility:
- Flat rates
- Weight-based
- Free shipping thresholds
- Delivery times

---

## Common Errors and Fixes

### Feed Diagnostics

Check Merchant Center for issues:

1. Go to Products > Diagnostics
2. Review errors and warnings
3. Fix issues in DainoStore
4. Re-submit feed

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Invalid price | Format issue | Check currency format |
| Missing image | Image URL broken | Fix image links |
| Missing GTIN | Required identifier | Add GTIN or request exemption |
| Mismatched price | Feed != website | Update prices |
| Invalid URL | Bad product link | Fix product URLs |

### Warning vs Error

**Errors**: Product won't show
**Warnings**: Product shows but may perform poorly

Prioritize fixing errors first.

---

## Performance Optimization

### Quality Score Factors

Google ranks products by:
- Data quality
- Click-through rate
- Conversion rate
- Price competitiveness
- Reviews and ratings

### Improving Performance

**Data quality**:
- Complete all attributes
- Accurate information
- High-quality images
- Unique descriptions

**Competitive pricing**:
- Monitor competitor prices
- Use sale prices strategically
- Show value

**Reviews and ratings**:
- Collect product reviews
- Enable review feed
- Display star ratings

---

## Multiple Countries

### International Feeds

Create feeds for each market:

1. Go to **Marketing > Product Feeds**
2. Click **Add Feed**
3. Select target country
4. Configure currency, language
5. Enable feed

### Feed per Country

| Country | Currency | Language | Feed URL |
|---------|----------|----------|----------|
| US | USD | English | /feeds/google-us.xml |
| UK | GBP | English | /feeds/google-uk.xml |
| DE | EUR | German | /feeds/google-de.xml |
| FR | EUR | French | /feeds/google-fr.xml |

---

## Feed Automation

### Automatic Updates

DainoStore updates feeds automatically:
- Price changes sync
- Stock updates reflect
- New products added
- Removed products excluded

### Update Frequency

| Data Type | Update Speed |
|-----------|--------------|
| Price | Near real-time |
| Stock | Near real-time |
| New products | Within 1 hour |
| Description changes | Within 24 hours |

### Content API

For large catalogs or complex setups:
- Direct API integration
- Real-time updates
- Inventory syncing

---

## Connecting Google Ads

### Smart Shopping Campaigns

Once feed is approved:

1. Link Merchant Center to Google Ads
2. Create Shopping campaign
3. Set budget and targets
4. Launch

### Free Listings

Products can appear for free:
- Shopping tab
- Google Images
- Google Search

Enable in Merchant Center settings.

---

## Measurement and Analytics

### Key Metrics

| Metric | What It Shows |
|--------|---------------|
| Impressions | Times products shown |
| Clicks | Clicks to your site |
| CTR | Click-through rate |
| Conversions | Purchases from Shopping |
| ROAS | Return on ad spend |

### Tracking Setup

1. Enable conversion tracking
2. Link Google Analytics
3. Set up enhanced ecommerce
4. Monitor in Merchant Center

---

## Best Practices Checklist

### Feed Quality

- [ ] All required attributes present
- [ ] Accurate pricing matches website
- [ ] High-quality images (500x500+)
- [ ] Unique, detailed descriptions
- [ ] Correct product categories
- [ ] Valid GTINs or MPNs

### Ongoing Maintenance

- [ ] Check diagnostics weekly
- [ ] Fix errors immediately
- [ ] Update seasonal products
- [ ] Review performance monthly
- [ ] Optimize underperforming products

---

## Troubleshooting

### Products Not Showing

**Check**:
- Feed successfully fetched?
- Any errors in diagnostics?
- Policy violations?
- Merchant Center approved?

### Low Performance

**Improve**:
- Title quality
- Image quality
- Price competitiveness
- Product reviews
- Landing page experience

### Disapproved Products

**Common reasons**:
- Policy violation
- Missing attributes
- Mismatched data
- Image issues

Review Merchant Center policies and fix issues.

---

## Next Steps

After setting up Google Shopping:

1. **Verify feed** - Check for errors
2. **Submit to Merchant Center** - Connect feed
3. **Wait for approval** - Usually 1-3 days
4. **Monitor performance** - Check metrics
5. **Optimize continuously** - Improve over time

See our SEO Optimization Guide for organic search strategies.
