# Creating Discount Coupons

Set up promotional codes to drive sales, reward loyalty, and attract new customers.

---

## Overview

Coupons are powerful marketing tools that can:
- Increase conversion rates
- Boost average order value
- Attract new customers
- Win back lapsed buyers
- Clear slow-moving inventory

This guide covers creating, managing, and optimizing coupons.

---

## Coupon Types

### Percentage Discount

Take a percentage off the order.

**Best for**:
- Sales promotions
- High-value orders
- Category-wide discounts

**Example**: 20% off entire order

### Fixed Amount Discount

Subtract a specific dollar amount.

**Best for**:
- First-time buyer offers
- Simple promotions
- Gift cards

**Example**: $10 off your order

### Free Shipping

Waive shipping charges.

**Best for**:
- Cart abandonment recovery
- Minimum purchase incentive
- Competitive matching

### Buy X Get Y

Purchase requirement triggers a deal.

**Best for**:
- Moving slow inventory
- Increasing order size
- Product discovery

**Example**: Buy 2, get 1 free

---

## Creating a Coupon

### Basic Setup

1. Go to **Marketing > Coupons**
2. Click **Create Coupon**
3. Fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| Code | What customers enter | SAVE20 |
| Description | Internal reference | Summer sale 20% off |
| Type | Discount type | Percentage |
| Value | Discount amount | 20 |

### Coupon Code Best Practices

**Do**:
- Keep codes short and memorable
- Use uppercase letters
- Include numbers for variety
- Make codes relevant (SUMMER20, WELCOME10)

**Don't**:
- Use confusing characters (0/O, 1/l)
- Make codes too long
- Use offensive words
- Create predictable patterns

### Example Codes

| Purpose | Code | Notes |
|---------|------|-------|
| Welcome offer | WELCOME15 | 15% first order |
| Seasonal sale | SUMMER25 | 25% summer items |
| Free shipping | FREESHIP | No threshold |
| Flash sale | FLASH30 | 30% limited time |
| Loyalty | VIP50 | 50% for VIPs |

---

## Usage Limits

Control how coupons are used.

### Overall Limits

| Setting | Purpose | Example |
|---------|---------|---------|
| Total Uses | Cap redemptions | 500 total |
| Uses Per Customer | Prevent abuse | 1 per customer |
| Minimum Order | Set threshold | $50 minimum |
| Maximum Discount | Cap savings | Up to $100 off |

### Setting Limits

1. In the coupon editor
2. Scroll to **Usage Limits**
3. Configure restrictions
4. Save

---

## Date Restrictions

### Start and End Dates

Schedule your promotions:

1. Set **Start Date**: When coupon becomes active
2. Set **End Date**: When coupon expires
3. Optionally set specific times

**Example**: Black Friday sale
- Start: November 24, 12:00 AM
- End: November 27, 11:59 PM

### Scheduling Tips

- Create coupons in advance
- Test before activation
- Plan for timezone differences
- Communicate end dates clearly

---

## Product and Category Rules

### Apply to Specific Products

1. In coupon settings
2. Find **Product Restrictions**
3. Add specific products or SKUs

**Use case**: Clear specific inventory

### Apply to Categories

1. Select **Category Restrictions**
2. Choose included categories
3. Or exclude certain categories

**Use case**: 20% off all clothing except clearance

### Exclude Sale Items

Prevent stacking with existing sales:
- Check **Exclude sale items**
- Coupon only applies to full-price items

---

## Customer Eligibility

### New Customers Only

Attract first-time buyers:

1. Check **First purchase only**
2. System verifies customer email
3. Cannot be used by repeat customers

### Specific Customer Groups

Target segments:
- VIP customers
- Newsletter subscribers
- High-value customers

### Email-Specific Coupons

Generate unique codes per email:
1. Create base coupon
2. Enable **Generate unique codes**
3. Each customer gets unique code

---

## Combining Coupons

### Allow Multiple Coupons

By default, one coupon per order. To allow stacking:

1. Create the coupon
2. Enable **Can be combined**
3. Specify which coupons can combine

### Stacking Rules

| Combination | Recommendation |
|-------------|----------------|
| % + Free Shipping | Often allowed |
| % + % | Usually not allowed |
| $ + $ | Usually not allowed |
| % + $ | Case by case |

### Priority

When multiple coupons could apply:
- Higher priority applies first
- Or in order added to cart

---

## Automatic Discounts

Discounts that apply without a code.

### Setup

1. Go to **Marketing > Automatic Discounts**
2. Click **Create Discount**
3. Configure:
   - Conditions (cart value, products)
   - Discount (amount, percentage)
   - Display message

### Examples

**Free shipping over $50**:
- Condition: Cart total >= $50
- Discount: 100% off shipping
- Message: "Free shipping applied"

**Buy 3, Save 15%**:
- Condition: 3+ of same product
- Discount: 15% on those items
- Message: "Multi-buy discount"

---

## Tracking Performance

### Coupon Analytics

View in **Marketing > Coupons > Analytics**:

| Metric | What It Shows |
|--------|---------------|
| Redemptions | Total uses |
| Revenue | Total sales with coupon |
| Average Order | AOV with coupon |
| Discount Given | Total discount value |

### Key Metrics to Watch

- **Redemption rate**: Uses / views
- **Revenue per coupon**: Total revenue generated
- **Margin impact**: Profit after discount
- **New customer %**: First-time buyers

---

## Common Coupon Campaigns

### Welcome Series

```
Code: WELCOME15
Type: 15% off
Limit: First purchase only
Validity: 7 days from signup
```

### Cart Abandonment

```
Code: COMEBACK10
Type: 10% off
Trigger: Sent via email 1 hour after abandonment
Validity: 48 hours
```

### Holiday Sale

```
Code: HOLIDAY25
Type: 25% off
Categories: All except gift cards
Validity: Holiday weekend only
Limit: 1000 total uses
```

### Loyalty Reward

```
Code: THANKYOU20
Type: 20% off
Eligibility: Customers with 5+ orders
Minimum: $75
```

### Clearance Push

```
Code: CLEAR40
Type: 40% off
Products: Clearance category only
Stacking: No other discounts
```

---

## Email Integration

### Include Coupons in Emails

1. Create coupon with code
2. In email template, add code
3. Or use dynamic unique codes

### Dynamic Coupon Insertion

Use variable `{coupon_code}` in emails:
- System generates unique code per recipient
- Tracks which email drove conversion
- Prevents code sharing

---

## Preventing Abuse

### Common Issues

| Problem | Solution |
|---------|----------|
| Code sharing | Unique per customer |
| Multiple accounts | Require verified email |
| Stacking | Disable combining |
| Bot exploitation | Rate limiting |

### Security Settings

1. **Require account**: No guest checkout for coupons
2. **Verify email**: Confirm email before applying
3. **Track IP**: Flag suspicious patterns
4. **Usage alerts**: Notify on high usage

---

## A/B Testing Coupons

### What to Test

| Element | Variations |
|---------|------------|
| Discount amount | 15% vs 20% |
| Threshold | $50 min vs no minimum |
| Format | $10 off vs 10% off |
| Urgency | 24hr vs 7 day |
| Copy | "Save now" vs "Your exclusive deal" |

### Running Tests

1. Create two similar coupons
2. Split your audience
3. Track performance separately
4. Implement winning variation

---

## Troubleshooting

### Coupon Not Working

**Check**:
- Is coupon active (dates)?
- Is code spelled correctly?
- Does order meet minimum?
- Are products eligible?
- Has limit been reached?

### Unexpected Discount

**Verify**:
- Automatic discounts active?
- Coupon stacking enabled?
- Sale price already applied?

### Abuse Detected

**Actions**:
- Disable problematic code
- Review usage logs
- Block suspicious accounts
- Implement stricter limits

---

## Best Practices

1. **Set clear end dates** - Creates urgency
2. **Limit usage** - Protects margins
3. **Track everything** - Measure ROI
4. **Test before launch** - Verify it works
5. **Document internally** - Team knows the deals

---

## Next Steps

After creating coupons:

1. **Set up email flows** - Deliver codes automatically
2. **Create segments** - Target the right customers
3. **Plan calendar** - Schedule seasonal promotions
4. **Monitor performance** - Adjust based on results

Need help? Visit **Marketing > Help** for more guides.
