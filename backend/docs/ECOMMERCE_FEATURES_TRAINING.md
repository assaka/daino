# E-Commerce Features Training Guide

This document trains the AI on how to help users with common e-commerce tasks.

## Category Page Sorting

**User Question:** "How can I sort the category page results?"

**Answer:** Category page sorting can be configured in multiple ways:

1. **Default Sort Order** (Admin Settings)
   - Go to Admin → Categories → Select a category
   - Under "Display Settings", set the default sort order:
     - `position` - Manual sort order
     - `name` - Alphabetical
     - `price` - Price low to high
     - `price_desc` - Price high to low
     - `created_at` - Newest first
     - `bestseller` - By purchase count

2. **Store-wide Default** (Settings)
   - Go to Admin → Settings → Catalog
   - Set "Default Product Sort" for all categories

3. **Customer-facing Sort** (Storefront)
   - The category page shows a sort dropdown
   - Customers can choose their preferred sorting
   - This is stored in their session

**Database:** The sort is controlled by the `sort_order` field in category settings and the `ORDER BY` clause in product queries.

---

## Product Filtering

**User Question:** "How do I set up product filters on category pages?"

**Answer:** Product filters are based on attributes:

1. **Make Attributes Filterable**
   - Go to Admin → Attributes
   - Edit an attribute (e.g., "Color", "Size")
   - Enable "Is Filterable" checkbox
   - Set "Filter Type": `multiselect`, `slider`, or `select`

2. **Assign Attributes to Products**
   - Products must have values for filterable attributes
   - Go to Admin → Products → Edit product
   - Fill in attribute values

3. **Filter Display**
   - Filters appear in the category sidebar
   - Price slider is automatic if products have prices
   - Color swatches show if attribute has swatch_type set

---

## Product Search

**User Question:** "How do I improve product search results?"

**Answer:** Search is powered by the products table with these searchable fields:

1. **Searchable Fields**
   - Product name (translations)
   - SKU
   - Description
   - Tags
   - Attribute values (if `is_searchable = true`)

2. **Improve Search Results**
   - Add relevant tags to products
   - Use descriptive product names
   - Fill in meta_keywords in SEO settings
   - Make key attributes searchable

3. **Search Configuration**
   - Admin → Settings → Catalog → Search Settings
   - Minimum search length
   - Enable/disable fuzzy matching

---

## Stock Management

**User Question:** "How do I manage product stock/inventory?"

**Answer:** Stock is managed per product or variant:

1. **Simple Products**
   - Edit product → Inventory section
   - Enable "Manage Stock"
   - Set "Stock Quantity"
   - Set "Low Stock Threshold" for alerts
   - Enable/disable "Allow Backorders"

2. **Configurable Products**
   - Stock is tracked per variant (size/color combination)
   - Go to Variants tab → set stock per variant

3. **Stock Alerts**
   - Products below threshold show in Dashboard
   - Email notifications can be configured

4. **Infinite Stock**
   - Enable "Infinite Stock" for digital/virtual products
   - Stock quantity is ignored

---

## Order Management

**User Question:** "How do I process orders?"

**Answer:** Order workflow:

1. **View Orders**
   - Admin → Orders
   - Filter by status, date, customer

2. **Order Statuses**
   - `pending` - New order, payment pending
   - `processing` - Payment received, preparing
   - `shipped` - Sent to customer
   - `delivered` - Received by customer
   - `cancelled` - Order cancelled
   - `refunded` - Money returned

3. **Process an Order**
   - Click order to view details
   - Update status as order progresses
   - Add tracking number when shipped
   - Print invoice/packing slip

4. **Fulfillment**
   - Mark items as shipped
   - Send shipping notification email
   - Track delivery status

---

## Customer Management

**User Question:** "How do I view customer information?"

**Answer:** Customer data is in Admin → Customers:

1. **Customer List**
   - View all registered customers
   - Search by name, email, phone
   - Filter by status, order count

2. **Customer Details**
   - Order history
   - Total spent
   - Addresses
   - Wishlist
   - Activity log

3. **Customer Actions**
   - Reset password
   - Block/unblock
   - Add notes
   - View as customer

---

## Shipping Configuration

**User Question:** "How do I set up shipping methods?"

**Answer:** Shipping is in Admin → Shipping Methods:

1. **Create Shipping Method**
   - Name (e.g., "Standard Shipping")
   - Carrier (optional)
   - Price calculation: flat rate, weight-based, price-based

2. **Shipping Zones**
   - Define regions (countries, states)
   - Different rates per zone

3. **Free Shipping**
   - Enable free shipping above order total
   - Or create a free shipping method with conditions

4. **Shipping Rules**
   - Minimum order for shipping
   - Maximum weight per shipment
   - Excluded products

---

## Payment Configuration

**User Question:** "How do I set up payment methods?"

**Answer:** Payment is in Admin → Payment Methods:

1. **Available Payment Methods**
   - Stripe (credit cards)
   - PayPal
   - Bank transfer
   - Cash on delivery

2. **Stripe Setup**
   - Click "Connect with Stripe"
   - Complete OAuth flow
   - Test with test mode first

3. **Payment Settings**
   - Minimum order amount
   - Allowed currencies
   - Payment instructions

---

## Coupon/Discount Codes

**User Question:** "How do I create discount codes?"

**Answer:** Coupons are in Admin → Coupons:

1. **Create Coupon**
   - Code (e.g., "SAVE20")
   - Discount type: percentage, fixed amount, free shipping
   - Discount value

2. **Coupon Conditions**
   - Minimum order amount
   - Maximum uses (total and per customer)
   - Valid date range
   - Specific products/categories only

3. **Automatic Discounts**
   - Cart rules without codes
   - Apply automatically when conditions met

---

## Theme/Design Customization

**User Question:** "How do I customize the store design?"

**Answer:** Design settings are in Admin → Settings → Theme:

1. **Theme Settings**
   - Primary/secondary colors
   - Font family
   - Logo and favicon
   - Header/footer layout

2. **Slot Editor**
   - Visual drag-and-drop editor
   - Customize homepage, category, product pages
   - Add widgets, banners, custom content

3. **CSS Customization**
   - Custom CSS field in theme settings
   - Override default styles

---

## Multi-language Setup

**User Question:** "How do I add multiple languages?"

**Answer:** Translations are in Admin → Translations:

1. **Add Languages**
   - Admin → Settings → Localization
   - Add language codes (en, nl, de, etc.)

2. **Translate Content**
   - Products, categories, CMS pages have translation tabs
   - Or use Admin → Translations for bulk editing

3. **Auto-Translation**
   - AI-powered translation available
   - Click translate button on any entity

4. **Storefront Language**
   - Language switcher in header
   - URLs can include language code (/nl/, /de/)

---

## SEO Configuration

**User Question:** "How do I improve SEO?"

**Answer:** SEO settings are in Admin → SEO Tools:

1. **Meta Tags**
   - Each product/category has SEO section
   - Meta title, description, keywords
   - Open Graph for social sharing

2. **URL Slugs**
   - Clean URLs for products/categories
   - Automatic slug generation
   - Custom slug override

3. **Sitemap**
   - Auto-generated XML sitemap
   - Submit to Google Search Console

4. **Robots.txt**
   - Configure in Admin → SEO → Robots
   - Block/allow specific paths

---

## Analytics & Reports

**User Question:** "How do I see sales reports?"

**Answer:** Analytics are in Admin → Dashboard and Analytics:

1. **Dashboard**
   - Today's sales
   - Orders count
   - Revenue chart
   - Top products

2. **Detailed Reports**
   - Sales by period
   - Products by revenue
   - Customer acquisition
   - Conversion rates

3. **Export**
   - Export orders to CSV
   - Export customer data
   - Export product catalog

---

## Import/Export

**User Question:** "How do I import products?"

**Answer:** Import is in Admin → Import/Export:

1. **CSV Import**
   - Download template
   - Fill in product data
   - Upload CSV file
   - Map columns to fields

2. **Shopify Import**
   - Connect Shopify store
   - Select products to import
   - Automatic mapping

3. **Akeneo Import**
   - Connect Akeneo PIM
   - Sync product data

---

## CMS Pages

**User Question:** "How do I create content pages?"

**Answer:** CMS is in Admin → CMS Pages:

1. **Create Page**
   - Title and URL slug
   - Content (rich text editor)
   - Template selection

2. **CMS Blocks**
   - Reusable content blocks
   - Insert into pages or slots

3. **Navigation**
   - Add pages to header/footer menus
   - Admin → Navigation Manager
