# Setting Up Shipping and Delivery

Configure shipping methods, rates, and delivery zones to give customers accurate shipping options at checkout.

---

## Overview

A well-configured shipping setup:
- Provides accurate delivery estimates
- Offers the right options for your customers
- Prevents shipping cost surprises
- Automates tracking and notifications

This guide covers everything from basic flat rates to zone-based pricing.

---

## Shipping Methods

### Types of Shipping Methods

| Method | Best For | Complexity |
|--------|----------|------------|
| Flat Rate | Simple pricing | Easy |
| Weight-Based | Varied product weights | Medium |
| Zone-Based | Different regions | Medium |
| Free Shipping | Customer incentive | Easy |
| Calculated Rates | Carrier integration | Advanced |

---

## Setting Up Flat Rate Shipping

The simplest option for getting started.

### Create Flat Rate Method

1. Go to **Settings > Shipping**
2. Click **Add Shipping Method**
3. Select **Flat Rate**
4. Configure:

| Field | Example |
|-------|---------|
| Name | Standard Shipping |
| Cost | $5.99 |
| Description | 5-7 business days |
| Zones | United States |

5. Save

### Multiple Flat Rates

Create different speed options:

```
Standard Shipping: $5.99 (5-7 days)
Express Shipping: $12.99 (2-3 days)
Overnight: $24.99 (Next day)
```

---

## Weight-Based Shipping

Charge based on order weight.

### Setup

1. Go to **Settings > Shipping**
2. Click **Add Shipping Method**
3. Select **Weight-Based**
4. Add weight tiers:

| Weight Range | Cost |
|--------------|------|
| 0 - 1 lb | $4.99 |
| 1 - 5 lb | $7.99 |
| 5 - 10 lb | $12.99 |
| 10+ lb | $19.99 |

### Product Weights

For accurate calculations:
1. Edit each product
2. Go to **Shipping** tab
3. Enter weight in your unit (oz, lb, kg)
4. Save

---

## Shipping Zones

Charge different rates by location.

### Creating Zones

1. Go to **Settings > Shipping > Zones**
2. Click **Add Zone**
3. Name the zone (e.g., "Domestic", "International")
4. Add countries/regions

### Example Zone Structure

**Zone: Continental US**
- Countries: United States
- Exclude: Alaska, Hawaii, Puerto Rico

**Zone: US Extended**
- Regions: Alaska, Hawaii, Puerto Rico

**Zone: Canada**
- Countries: Canada

**Zone: International**
- Countries: Rest of World

### Zone-Based Rates

Assign different rates per zone:

| Zone | Standard | Express |
|------|----------|---------|
| Continental US | $5.99 | $12.99 |
| US Extended | $9.99 | $19.99 |
| Canada | $12.99 | $24.99 |
| International | $19.99 | $39.99 |

---

## Free Shipping

### Free Shipping Threshold

Encourage larger orders:

1. Go to **Settings > Shipping**
2. Click **Add Shipping Method**
3. Select **Free Shipping**
4. Set conditions:

| Setting | Value |
|---------|-------|
| Minimum Order | $50.00 |
| Applies to Zones | All |
| Exclude Categories | None |

### Free Shipping Promotions

Create temporary free shipping:
1. Use coupon system
2. Create code: FREESHIP
3. Set discount type: Free Shipping
4. Add date restrictions

---

## Calculated Rates

Integrate with carriers for real-time rates.

### Supported Carriers

- UPS
- FedEx
- USPS
- DHL
- Canada Post
- Australia Post

### Setup Example (UPS)

1. Go to **Settings > Shipping > Carriers**
2. Click **Add Carrier**
3. Select **UPS**
4. Enter credentials:
   - Account Number
   - Access Key
   - User ID
   - Password
5. Select services to offer:
   - UPS Ground
   - UPS 3 Day Select
   - UPS 2nd Day Air
   - UPS Next Day Air

### Rate Display

At checkout, customers see real-time rates:

```
UPS Ground: $8.45 (5-7 business days)
UPS 3 Day Select: $14.32 (3 business days)
UPS 2nd Day Air: $22.18 (2 business days)
```

---

## Handling Time

Set processing time before shipping:

### Configure Handling Time

1. Go to **Settings > Shipping**
2. Find **Handling Time**
3. Options:
   - Same day (if ordered before cutoff)
   - 1 business day
   - 2-3 business days
   - Custom

### Cutoff Time

Set daily shipping cutoff:
- Orders before 2 PM ship same day
- Orders after 2 PM ship next day

---

## Local Pickup

Offer in-store pickup:

### Setup

1. Go to **Settings > Shipping**
2. Click **Add Shipping Method**
3. Select **Local Pickup**
4. Configure:

| Setting | Value |
|---------|-------|
| Name | Store Pickup |
| Cost | Free |
| Location | 123 Main St, City |
| Instructions | Ready in 2 hours |

### Multiple Locations

For multiple stores:
- Create pickup method per location
- Assign to specific zones
- Show only relevant options

---

## Delivery Options

Beyond standard shipping:

### Scheduled Delivery

Let customers choose delivery date:
1. Enable in **Settings > Shipping**
2. Set available days
3. Set lead time (e.g., 3+ days out)

### Delivery Windows

Offer time slots:
- Morning (9 AM - 12 PM)
- Afternoon (12 PM - 5 PM)
- Evening (5 PM - 9 PM)

### Special Instructions

Allow delivery notes:
- Leave at door
- Ring doorbell
- Gate code
- Call on arrival

---

## Shipping Restrictions

### Product-Level Restrictions

For items that can't ship everywhere:

1. Edit product
2. Go to **Shipping** tab
3. Set **Shipping Restrictions**:
   - Exclude zones
   - Require specific method
   - Add surcharge

### Example Restrictions

| Product Type | Restriction |
|--------------|-------------|
| Hazardous | No air shipping |
| Perishable | Express only |
| Oversized | Ground only |
| Fragile | Insured shipping |

---

## Display Settings

### Shipping Calculator

Show shipping estimate on product page:
1. Go to **Settings > Shipping**
2. Enable **Product Page Calculator**
3. Customer enters ZIP to see rates

### Cart Page

Show shipping options in cart:
- Estimate based on address
- Update with actual rates at checkout

### Checkout

Configure checkout shipping display:
- Group methods by speed
- Show delivery estimates
- Highlight free shipping progress

---

## Tracking and Notifications

### Automatic Tracking

1. Go to **Settings > Shipping > Tracking**
2. Enable auto-detection
3. Add tracking when fulfilling orders

### Notification Emails

Configure shipping emails:

| Email | Trigger | Content |
|-------|---------|---------|
| Shipped | Tracking added | Tracking link |
| In Transit | Status update | Location update |
| Delivered | Delivery confirmed | Review request |

---

## International Shipping

### Customs Information

For international orders:

1. Add customs data to products:
   - HS Code
   - Country of origin
   - Value for customs

2. Configure duties/taxes:
   - Calculate at checkout (DDP)
   - Customer pays (DDU)

### Required Fields

International orders need:
- Phone number
- Complete address
- ZIP/Postal code

### Prohibited Items

List items that can't ship internationally:
- Batteries
- Liquids
- Certain electronics
- Food items

---

## Shipping Cost Strategies

### Pricing Approaches

| Strategy | Pros | Cons |
|----------|------|------|
| Free over threshold | Increases AOV | Reduces margin on small orders |
| Flat rate | Simple, predictable | May over/under charge |
| Actual cost | Accurate | Complex setup |
| Built into price | "Free shipping" appeal | Less price competitive |

### Finding the Balance

Consider:
- Average order value
- Shipping costs (use average)
- Competitor pricing
- Customer expectations

---

## Troubleshooting

### No Shipping Options

**Issue**: Checkout shows no shipping methods

**Check**:
- Zone includes customer's country
- Products not restricted
- Shipping method is active
- Weight/dimensions are set

### Wrong Rates

**Issue**: Calculated rates seem wrong

**Check**:
- Product weights accurate
- Package dimensions set
- Carrier credentials valid
- Address format correct

### High Abandonment

**Issue**: Customers leave at shipping step

**Solutions**:
- Show estimated shipping earlier
- Offer free shipping threshold
- Add budget shipping option
- Consider built-in shipping pricing

---

## Best Practices

1. **Offer multiple options** - Budget and express choices
2. **Be transparent** - Show costs early in the process
3. **Use free shipping** - Threshold encourages larger orders
4. **Update regularly** - Carrier rates change
5. **Test checkout** - Verify all zones work correctly

---

## Next Steps

After configuring shipping:

1. **Test all zones** - Place test orders to each
2. **Configure tracking** - Set up carrier integrations
3. **Create emails** - Shipping notification templates
4. **Monitor costs** - Track shipping expenses vs revenue

Need help? Check our support resources in **Settings > Help**.
