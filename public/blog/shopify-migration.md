# Migrating Your Shopify Store to DainoStore

A complete guide to moving your Shopify store to DainoStore, including products, customers, and orders.

---

## Overview

Migrating from Shopify to DainoStore:
- Preserves your data
- Maintains SEO value
- Minimizes downtime
- Smooth customer transition

This guide covers the complete migration process.

---

## Before You Start

### What Gets Migrated

| Data | Migrated | Notes |
|------|----------|-------|
| Products | Yes | All variants, images, descriptions |
| Categories | Yes | Mapped to collections |
| Customers | Yes | Contact info, addresses |
| Orders | Yes | Historical order data |
| Images | Yes | Transferred to CDN |
| Reviews | Partial | Via third-party apps |
| Theme | No | Use DainoStore themes |
| Apps | No | Find alternatives |

### What You Need

1. **Shopify store access**
   - Admin login
   - API access (for automated migration)

2. **DainoStore account**
   - Active subscription
   - Empty store or new store

3. **Time estimate**
   - Small store (under 100 products): 1-2 hours
   - Medium store (100-1000 products): 2-4 hours
   - Large store (1000+ products): 4-8 hours

---

## Migration Options

### Option 1: Automated Migration (Recommended)

Use built-in Shopify import:

1. Go to **Import > Shopify**
2. Connect your Shopify store
3. Select data to import
4. Start migration

### Option 2: CSV Export/Import

Manual file-based migration:

1. Export from Shopify
2. Transform data
3. Import to DainoStore

### Option 3: API Migration

For developers with custom needs:

1. Use Shopify Admin API
2. Use DainoStore API
3. Custom scripts

---

## Automated Migration

### Step 1: Connect Shopify

1. Go to **Import & Export > Shopify**
2. Click **Connect Shopify Store**
3. Enter your Shopify store URL
4. Authorize the connection

### Step 2: Select Data

Choose what to import:

| Option | Description |
|--------|-------------|
| Products | All products with variants |
| Collections | Category structure |
| Customers | Customer accounts |
| Orders | Order history |
| Pages | Content pages |

### Step 3: Configure Mapping

Map Shopify data to DainoStore:

| Shopify | DainoStore |
|---------|------------|
| Product Type | Category |
| Vendor | Brand |
| Tags | Tags |
| Metafields | Custom fields |

### Step 4: Start Import

1. Review settings
2. Click **Start Import**
3. Monitor progress
4. Review results

### Import Progress

Track in real-time:
```
Products: 234/500 (47%)
Currently importing: Blue T-Shirt
Estimated time: 15 minutes
```

---

## CSV Migration

### Export from Shopify

#### Products

1. Go to **Shopify Admin > Products**
2. Click **Export**
3. Select **All products**
4. Choose **CSV for Excel**
5. Download

#### Customers

1. Go to **Shopify Admin > Customers**
2. Click **Export**
3. Select **All customers**
4. Download

#### Orders

1. Go to **Shopify Admin > Orders**
2. Click **Export**
3. Select **All orders**
4. Download

### Transform Data

Shopify and DainoStore have different formats:

**Product field mapping**:

| Shopify | DainoStore |
|---------|------------|
| Handle | slug |
| Title | name |
| Body (HTML) | description |
| Vendor | brand |
| Type | category |
| Tags | tags |
| Variant Price | price |
| Variant SKU | sku |
| Variant Inventory Qty | stock_quantity |

### Import to DainoStore

1. Go to **Import > Products**
2. Upload transformed CSV
3. Map columns
4. Preview data
5. Import

---

## Product Migration

### Handling Variants

Shopify variants become DainoStore variants:

**Shopify**:
```
Product: T-Shirt
  Option1: Size (S, M, L)
  Option2: Color (Blue, Red)
```

**DainoStore**:
```
Product: T-Shirt
  Attributes:
    - Size: S, M, L
    - Color: Blue, Red
  Variants: 6 combinations
```

### Image Transfer

Images are automatically:
- Downloaded from Shopify
- Optimized for web
- Uploaded to DainoStore CDN
- Linked to products

### SEO Data

Preserve SEO metadata:
- Meta titles
- Meta descriptions
- URL slugs
- Alt text

---

## Customer Migration

### Customer Data

Imported customer info:
- Name
- Email
- Phone
- Addresses
- Order history
- Tags

### Password Handling

Customer passwords cannot be migrated:
- Customers must reset passwords
- Send password reset emails after migration
- Or enable social login

### Customer Communication

Notify customers:

```
Subject: We've Upgraded Our Store

Dear [Customer Name],

We've moved to a new platform for a better shopping experience.

Your account has been migrated. To access your account,
please reset your password using the link below.

[Reset Password Button]

Your order history and saved information are preserved.

Thank you for your continued support!
```

---

## Order Migration

### What's Imported

| Data | Included |
|------|----------|
| Order number | Yes |
| Customer info | Yes |
| Products ordered | Yes |
| Quantities | Yes |
| Prices | Yes |
| Discounts | Yes |
| Shipping | Yes |
| Dates | Yes |
| Status | Yes |

### Order Numbering

Options for order numbers:
- Continue Shopify sequence
- Start fresh
- Prefix old orders

### Historical Orders

Old orders are imported for:
- Customer history
- Reporting
- Analytics

Not for active processing (already fulfilled).

---

## Collection to Category Mapping

### Automatic Mapping

Collections become categories:

| Shopify Collection | DainoStore Category |
|--------------------|---------------------|
| Men's | Men's |
| Men's > Shirts | Men's > Shirts |
| Women's | Women's |
| Sale | Sale (tag-based) |

### Manual Adjustments

Review and adjust:
1. Go to **Catalog > Categories**
2. Review imported structure
3. Reorganize if needed
4. Update navigation

---

## URL Redirects

### Preserve SEO

Redirect old URLs to new:

| Old URL (Shopify) | New URL (DainoStore) |
|-------------------|----------------------|
| /products/blue-shirt | /products/blue-shirt |
| /collections/mens | /categories/mens |
| /pages/about | /about |

### Setting Up Redirects

1. Go to **Settings > Redirects**
2. Import redirect list
3. Or add manually:
   - Old path
   - New path
   - Redirect type (301)

### URL Structure

DainoStore defaults:
- Products: `/products/[slug]`
- Categories: `/categories/[slug]`
- Pages: `/[slug]`

---

## Testing Your Migration

### Pre-Launch Checklist

**Products**:
- [ ] All products imported
- [ ] Images displaying
- [ ] Prices correct
- [ ] Variants working
- [ ] Inventory accurate

**Categories**:
- [ ] Structure correct
- [ ] Products assigned
- [ ] URLs working

**Customers**:
- [ ] Accounts created
- [ ] Addresses saved
- [ ] Order history visible

**Orders**:
- [ ] Historical orders imported
- [ ] Data accurate
- [ ] Status correct

**SEO**:
- [ ] Meta data preserved
- [ ] Redirects working
- [ ] Sitemap generated

---

## Post-Migration Tasks

### Immediate Actions

1. **Test checkout** - Place test order
2. **Verify payments** - Stripe connected
3. **Check emails** - Templates configured
4. **Test search** - Products findable

### Communication

1. **Notify customers** - Email announcement
2. **Update social** - New links
3. **Update ads** - Landing pages
4. **Notify affiliates** - New tracking

### DNS and Domain

1. **Update DNS** - Point to DainoStore
2. **SSL certificate** - Auto-provisioned
3. **Test domain** - Verify working
4. **Remove Shopify** - After stable

---

## Common Issues

### Products Not Importing

**Check**:
- CSV format correct?
- Required fields present?
- Special characters?
- File size limits?

### Images Missing

**Solutions**:
- Re-import images
- Check URLs accessible
- Verify CDN setup
- Manual upload

### Customer Duplicates

**Prevention**:
- Use email as unique ID
- Enable de-duplication
- Review before import

### Order Discrepancies

**Verify**:
- Currency conversion
- Tax calculations
- Discount applications
- Shipping costs

---

## Timeline Example

### Day 1: Preparation

- [ ] Export Shopify data
- [ ] Set up DainoStore account
- [ ] Configure basic settings

### Day 2: Migration

- [ ] Import products
- [ ] Import customers
- [ ] Import orders
- [ ] Review and fix issues

### Day 3: Configuration

- [ ] Set up payments
- [ ] Configure shipping
- [ ] Email templates
- [ ] Theme customization

### Day 4: Testing

- [ ] Full checkout test
- [ ] Mobile testing
- [ ] SEO verification
- [ ] Performance check

### Day 5: Launch

- [ ] Switch DNS
- [ ] Monitor for issues
- [ ] Customer communication
- [ ] Shopify cancellation

---

## Best Practices

### Before Migration

1. **Export everything** - Keep backups
2. **Document settings** - Current configuration
3. **Notify customers** - Upcoming changes
4. **Choose timing** - Low traffic period

### During Migration

1. **Don't rush** - Verify each step
2. **Test thoroughly** - Every feature
3. **Keep Shopify active** - Until verified
4. **Document issues** - For resolution

### After Migration

1. **Monitor closely** - First 48 hours
2. **Respond quickly** - Customer issues
3. **Check analytics** - Traffic and conversions
4. **Gather feedback** - Customer experience

---

## Getting Help

### Resources

- **Migration support**: Contact support team
- **Documentation**: Help center articles
- **Community**: Discord community

### Professional Migration

For complex migrations:
- Contact DainoStore team
- Migration specialists available
- Custom data handling
- Dedicated support

---

## Next Steps

After migration:

1. **Optimize store** - Improve performance
2. **Set up marketing** - Email, ads
3. **Configure analytics** - Track performance
4. **Explore features** - DainoStore capabilities

Welcome to DainoStore!
