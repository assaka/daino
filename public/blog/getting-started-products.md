# Getting Started: Setting Up Your First Products

Learn how to add products, organize them into categories, and configure attributes to create a professional product catalog.

---

## Overview

Your product catalog is the foundation of your online store. A well-organized catalog helps customers find what they need and makes your store look professional.

This guide covers:
- Adding your first products
- Creating categories
- Setting up attributes and variants
- Best practices for product data

---

## Adding Your First Product

### Step 1: Navigate to Products

1. Go to **Catalog > Products**
2. Click **Add Product**

### Step 2: Fill in Basic Information

**Required fields:**

| Field | Description | Example |
|-------|-------------|---------|
| Product Name | Clear, descriptive title | Blue Cotton T-Shirt |
| SKU | Unique identifier | TSHIRT-BLUE-M |
| Price | Selling price | $29.99 |
| Status | Active or Draft | Active |

**Optional but recommended:**

- **Description**: Detailed product information
- **Short Description**: Summary for listings
- **Meta Title/Description**: For SEO

### Step 3: Add Product Images

Images are crucial for conversions:

1. Click **Media** tab
2. Upload main product image
3. Add gallery images (3-8 recommended)
4. Set alt text for accessibility and SEO

**Image best practices:**
- Use high-resolution images (1200x1200px minimum)
- Show product from multiple angles
- Include lifestyle shots if possible
- Maintain consistent backgrounds

### Step 4: Set Pricing

**Standard pricing:**
- Regular Price: Your normal selling price
- Sale Price: Discounted price (optional)
- Cost Price: Your cost (for profit tracking)

**Example:**
```
Regular Price: $49.99
Sale Price: $39.99 (20% off)
Cost Price: $15.00
Profit Margin: 60%
```

### Step 5: Configure Inventory

In the **Inventory** section:

| Setting | Description |
|---------|-------------|
| Track Inventory | Enable/disable stock tracking |
| Stock Quantity | Current available units |
| Low Stock Threshold | Alert level (e.g., 10 units) |
| Allow Backorders | Sell when out of stock |

---

## Creating Categories

Categories help customers browse your store and improve SEO.

### Setting Up Categories

1. Go to **Catalog > Categories**
2. Click **Add Category**
3. Fill in:
   - **Name**: Category title
   - **Slug**: URL-friendly version (auto-generated)
   - **Description**: For SEO and category pages
   - **Parent**: For subcategories

### Category Structure Example

```
Men's Clothing
  - T-Shirts
  - Pants
  - Jackets
Women's Clothing
  - Dresses
  - Tops
  - Accessories
```

### Best Practices

- Keep category names short and clear
- Limit depth to 2-3 levels
- Use descriptive names (not "Category 1")
- Add category images for visual navigation

---

## Attributes and Variants

Attributes let you offer product variations like size, color, or material.

### Creating Attributes

1. Go to **Catalog > Attributes**
2. Click **Add Attribute**
3. Configure:
   - **Name**: Size, Color, Material
   - **Type**: Select, Radio, Swatch
   - **Values**: S, M, L, XL (for Size)

### Common Attribute Types

| Type | Use Case | Example |
|------|----------|---------|
| Select | Multiple options | Size dropdown |
| Color Swatch | Visual selection | Color picker |
| Text | Custom input | Engraving text |
| Radio | Single selection | Gift wrapping yes/no |

### Adding Variants to Products

1. Edit your product
2. Go to **Variants** tab
3. Select attributes (Size, Color)
4. Click **Generate Variants**
5. Set price/stock for each variant

**Example variant matrix:**

| Variant | SKU | Price | Stock |
|---------|-----|-------|-------|
| Blue / S | TSHIRT-BLUE-S | $29.99 | 15 |
| Blue / M | TSHIRT-BLUE-M | $29.99 | 20 |
| Blue / L | TSHIRT-BLUE-L | $29.99 | 12 |
| Red / S | TSHIRT-RED-S | $29.99 | 10 |
| Red / M | TSHIRT-RED-M | $29.99 | 18 |
| Red / L | TSHIRT-RED-L | $29.99 | 8 |

---

## Product Organization Tips

### Use Collections

Collections group products beyond categories:
- "Summer Sale" - seasonal promotion
- "Best Sellers" - popular items
- "New Arrivals" - recent additions

### Add Tags

Tags provide flexible organization:
- `organic`, `sustainable`, `premium`
- `gift-idea`, `limited-edition`
- Useful for filtering and search

### Set Product Status

| Status | When to Use |
|--------|-------------|
| Active | Ready for sale |
| Draft | Work in progress |
| Archived | Discontinued |
| Scheduled | Future release |

---

## Bulk Import Products

For large catalogs, use CSV import:

### Prepare Your CSV

Required columns:
```
name,sku,price,stock,category
Blue T-Shirt,TSHIRT-BLUE-M,29.99,50,T-Shirts
Red T-Shirt,TSHIRT-RED-M,29.99,30,T-Shirts
```

### Import Process

1. Go to **Import/Export > Import Products**
2. Download the template CSV
3. Fill in your product data
4. Upload and map columns
5. Review and import

---

## SEO for Products

Optimize products for search engines:

### Meta Information

- **Meta Title**: Product name + brand + key feature
- **Meta Description**: Compelling 150-160 character summary
- **URL Slug**: Clean, keyword-rich URL

### Example

```
Product: Blue Cotton T-Shirt
Meta Title: Blue Cotton T-Shirt | Comfortable Casual Wear | YourBrand
Meta Description: Classic blue cotton t-shirt made from 100% organic cotton. Soft, breathable, and perfect for everyday wear. Available in sizes S-XXL.
URL: /products/blue-cotton-t-shirt
```

---

## Common Questions

**Q: How many products can I add?**
A: There's no limit. DainoStore handles catalogs of any size efficiently.

**Q: Can I duplicate products?**
A: Yes. Click the menu icon on any product and select "Duplicate."

**Q: How do I bulk edit products?**
A: Select multiple products in the list view, then click "Bulk Edit."

**Q: Can I import from Shopify?**
A: Yes. See our Shopify migration guide for step-by-step instructions.

---

## Next Steps

Now that you've set up products:

1. **Configure shipping** - Set up delivery methods
2. **Add payment methods** - Connect Stripe
3. **Test your checkout** - Place a test order
4. **Launch your store** - Make it live

Need help? Visit **Settings > Help** for more guides and support options.
