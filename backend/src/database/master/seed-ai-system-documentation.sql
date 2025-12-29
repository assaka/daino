-- ============================================
-- AI SYSTEM DOCUMENTATION CONTEXT DATA
-- ============================================
-- Deep system knowledge for AI RAG context
-- Provides detailed understanding of how DainoStore works
--
-- SAFE TO RE-RUN: Deletes and recreates entries
-- ============================================

-- Clean up existing entries for these topics
DELETE FROM ai_context_documents WHERE type IN (
  'confirmation_system',
  'slot_system',
  'ai_shopping_system',
  'product_category_system',
  'destructive_operations',
  'webshop_best_practices'
);

-- ============================================
-- DESTRUCTIVE OPERATIONS & CONFIRMATION SYSTEM
-- ============================================

INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES

('confirmation_system', 'Destructive Operations Reference',
'DESTRUCTIVE OPERATIONS - CONFIRMATION REQUIREMENTS

When users request potentially harmful operations, the AI MUST request confirmation.

=== OPERATIONS THAT ALWAYS NEED EXPLICIT CONFIRMATION ===

BULK DELETE OPERATIONS:
- "delete all products" - REQUIRES typing "CONFIRM DELETE ALL"
- "delete all categories" - Warn about navigation impact
- "delete all customers" - GDPR sensitive, suggest deactivation
- "remove all coupons" - Offer to delete only expired ones
- "clear inventory" - Suggest export first

BLOCKED OPERATIONS (Cannot be done):
- "delete all orders" - Legal/tax compliance, offer archiving instead
- "remove order history" - Must retain for accounting
- "delete payment records" - Financial compliance requirement

SETTINGS REQUIRING CONFIRMATION:
- Change store currency - Prices not auto-converted
- Disable ALL payment methods - Stops all sales
- Disable ALL shipping methods - Checkout will fail
- Change store timezone - Affects all timestamps
- Update SEO settings - Affects search rankings
- Modify tax rates - Affects all pricing

=== CONFIRMATION FLOW ===

1. User requests destructive action
2. AI explains impact:
   - What will be affected
   - Is it reversible?
   - Are there alternatives?
3. AI asks for explicit confirmation
4. For highest-risk: Require typing confirmation phrase
5. Execute only after confirmation received

=== CONFIRMATION MESSAGE TEMPLATE ===

"This is a destructive operation that will [ACTION].

**Impact:**
- [Impact 1]
- [Impact 2]
- [Impact 3]

**This action is:** [Reversible/Not easily reversible]

Do you want to proceed? [Confirmation method]"

=== ENTITY CONFIRMATION FLAGS ===

From ai_entity_definitions:
- requires_confirmation: true = Always ask before executing
- is_destructive: true = Can permanently delete/modify data

Entities with requires_confirmation=true:
- seo_settings
- payment_methods
- email_templates
- store_settings
- tax_settings

Entities with is_destructive=true:
- product_tabs
- languages
- shipping_methods
- categories
- attributes
- cms_pages
- coupons',
'core', '["confirmation", "destructive", "delete", "safety"]', 100, 'all', true),

('confirmation_system', 'Safe Operations Reference',
'SAFE OPERATIONS - NO CONFIRMATION NEEDED

These operations are safe and reversible, execute immediately:

=== READ-ONLY OPERATIONS ===
- List/show any entity
- Search products/orders/customers
- View analytics/reports
- Get entity details
- Show configuration/settings

=== SAFE CREATE OPERATIONS ===
- Create new product (can delete later)
- Create new category (can delete later)
- Create coupon (can deactivate)
- Create CMS page (can unpublish)
- Add language (can disable)
- Add shipping method (can disable)

=== SAFE UPDATE OPERATIONS ===
- Activate/deactivate products
- Enable/disable coupons
- Update product details (reversible)
- Change category names
- Update translations
- Modify slot content
- Change slot styles/layout

=== WHEN TO SKIP CONFIRMATION ===

1. Operation affects single item only
2. Operation is easily reversible
3. No data is permanently deleted
4. No financial/legal implications
5. User explicitly said "just do it" or "without asking"

=== RESPONSE FOR SAFE OPERATIONS ===

"Done! I''ve [ACTION]. [Brief confirmation of what changed]."

Examples:
- "Done! Product SKU-123 is now active."
- "Created! The ''Summer Sale'' category is ready to use."
- "Updated! The product title is now ''New Title''."',
'core', '["safe", "operations", "no-confirmation"]', 95, 'all', true),

-- ============================================
-- SLOT SYSTEM DOCUMENTATION
-- ============================================

('slot_system', 'Slot System Architecture',
'SLOT SYSTEM - COMPLETE REFERENCE

The slot system powers all page layouts in DainoStore storefronts.

=== CORE CONCEPT ===

Slots are configurable UI components arranged in a grid layout.
Each page (product, category, cart, etc.) has a slot configuration.

=== SLOT TYPES ===

CONTENT TYPES:
- text: Rendered text/HTML with variable support {{product.name}}
- html: Raw HTML content (dangerouslySetInnerHTML)
- image: Single image, optionally linked
- button: Interactive button with handlers (add-to-cart, wishlist, etc.)

LAYOUT TYPES:
- container: Groups child slots
- grid: CSS Grid container
- flex: Flexbox container

COMPONENT TYPES:
- component: React components from SlotComponentRegistry
  - ProductGallery, CategoryFilterSlot, Breadcrumbs, etc.
- cms: Loads CMS blocks by position
- plugin_widget: Plugin-provided widgets

=== SLOT CONFIGURATION STRUCTURE ===

Each slot has:
{
  "id": "unique_slot_id",
  "type": "text|button|image|component|container|grid|flex",
  "content": "Text content or {{variable}}",
  "className": "Tailwind CSS classes",
  "parentClassName": "Wrapper element classes",
  "styles": { "color": "#fff", "fontSize": "16px" },
  "parentId": "parent_container_id",
  "position": { "col": 1, "row": 1 },
  "colSpan": 12,
  "rowSpan": 1,
  "viewMode": ["default", "mobile"],
  "visibility": { "desktop": true, "mobile": true },
  "component": "ComponentName",
  "metadata": {
    "htmlTag": "h1",
    "conditionalDisplay": "product.compare_price",
    "disableResize": false
  }
}

=== SLOT HIERARCHY ===

Slots form a tree via parentId:

main_layout (root, parentId: null)
├── breadcrumbs_container
│   └── breadcrumbs
├── content_area
│   ├── product_gallery_container
│   ├── product_details
│   │   ├── product_title
│   │   ├── product_price
│   │   ├── add_to_cart_button
│   │   └── [custom slots go here]

=== GRID POSITIONING ===

- 12-column grid system
- position.col: 1-12 (column start)
- position.row: Row number (1-based)
- colSpan: How many columns to span (1-12)
- Slots in same parent sorted by row, then column

=== VARIABLE PROCESSING ===

Variables resolved at render time:
- {{product.name}} - Product data
- {{product.price}} - Formatted price
- {{settings.currency_symbol}} - Store setting
- {{category.name}} - Category data
- {{cart.total}} - Cart data
- {{t.key}} - Translation key',
'design', '["slots", "layout", "rendering", "grid"]', 100, 'all', true),

('slot_system', 'Adding Slots via AI',
'ADDING SLOTS VIA AI - COMMAND REFERENCE

=== AI SLOT OPERATIONS ===

Operations: ADD, MODIFY, REMOVE, MOVE, RESIZE, REORDER

=== ADD SLOT COMMAND FORMAT ===

When user says "add a slot below X", generate:

{
  "operation": "add",
  "pageType": "product",
  "targetSlot": {
    "parentId": "[same parent as target]"
  },
  "payload": {
    "type": "text",
    "content": "[content or empty]",
    "className": "[tailwind classes]",
    "colSpan": 12,
    "position": {
      "col": 1,
      "row": [target_row + 1]
    }
  }
}

=== ADDING BELOW A SPECIFIC SLOT ===

Example: "add review section below add to cart button"

1. Find add_to_cart_button slot
2. Get its parentId (e.g., "product_details")
3. Get its position.row (e.g., row 3)
4. Create new slot with:
   - parentId: "product_details" (same parent)
   - position.row: 4 (one after target)
   - Other slots auto-shift down

=== COMMON SLOT ADDITIONS ===

Trust Badges below buy button:
{
  "type": "html",
  "content": "<div class=\"flex gap-2 justify-center mt-4\"><img src=\"/trust-badge.png\" alt=\"Secure\"/></div>",
  "parentId": "product_details",
  "position": { "row": [after add_to_cart] }
}

Promotional Banner at top:
{
  "type": "text",
  "content": "Free shipping on orders over $50!",
  "className": "bg-yellow-100 p-4 text-center font-medium",
  "parentId": "main_layout",
  "position": { "row": 1 }
}

Reviews Section:
{
  "type": "component",
  "component": "ProductReviews",
  "parentId": "product_details",
  "position": { "row": [after add_to_cart] }
}

=== PAGE TYPES ===

- product: Product detail page
- category: Category/collection page
- cart: Shopping cart
- checkout: Checkout flow
- success: Order confirmation
- account: Customer account
- login: Login/register
- header: Site header
- homepage: Home page

=== SLOT VISIBILITY ===

Control device visibility:
{
  "visibility": {
    "desktop": true,
    "mobile": false
  }
}

User: "hide breadcrumb on mobile"
→ Update slot: visibility.mobile = false',
'design', '["slots", "add", "ai", "commands"]', 98, 'all', true),

('slot_system', 'Slot Component Registry',
'AVAILABLE SLOT COMPONENTS

Components that can be used with type: "component":

=== PRODUCT PAGE COMPONENTS ===

ProductGallery / ProductGallerySlot
- Image gallery with thumbnails
- Zoom on hover
- Lightbox view
- Props: layout (horizontal|vertical), showThumbnails

ProductReviews
- Customer reviews section
- Star ratings
- Review submission form
- Props: limit, sortBy

ProductLabel
- Sale badge, New badge, etc.
- Conditional display
- Props: labels array

AddToCartButton
- Quantity selector
- Add to cart action
- Props: showQuantity, buttonText

=== CATEGORY PAGE COMPONENTS ===

CategoryFilterSlot
- Sidebar filters
- Price range slider
- Attribute filters
- Props: collapsible, showCounts

ProductGrid
- Product card grid
- Pagination
- View mode toggle
- Props: columns, perPage

=== NAVIGATION COMPONENTS ===

Breadcrumbs
- Navigation trail
- Home icon option
- Props: showHomeIcon, separator

CategoryNavigation
- Category menu
- Hierarchical display
- Props: depth, showCounts

=== CMS COMPONENTS ===

CmsBlockRenderer
- Render CMS block by position
- Props: position, storeId

CmsBlockSlot
- Direct CMS block rendering
- Props: blockId

=== PLUGIN COMPONENTS ===

PluginWidgetRenderer
- Renders plugin widgets
- Props: pluginSlug, widgetId

=== REGISTERING CUSTOM COMPONENTS ===

Add to SlotComponentRegistry.jsx:
```javascript
const componentMap = {
  ...existingComponents,
  MyCustomComponent: lazy(() => import(''./MyCustomComponent''))
};
```',
'design', '["components", "registry", "slots"]', 95, 'all', true),

-- ============================================
-- AI SHOPPING SYSTEM DOCUMENTATION
-- ============================================

('ai_shopping_system', 'AI Shopping Data Requirements',
'AI SHOPPING - PRODUCT DATA REQUIREMENTS

For products to be discoverable by AI shopping assistants (ChatGPT, Google Shopping, Bing), they need specific data.

=== ESSENTIAL FIELDS (REQUIRED) ===

1. Product Name
   - Length: 50-150 characters
   - Format: Brand + Product + Key Attributes
   - Example: "Nike Air Max 90 Men''s Running Shoes - Black"

2. Description
   - Length: 100-500 characters
   - Include features and benefits
   - Avoid marketing fluff, use facts
   - No HTML in AI feed descriptions

3. Images
   - Minimum: 2 images
   - Recommended: 5+ images
   - Main image: White background, no text
   - Size: 800x800 minimum, prefer 1200x1200

4. Price
   - Current price (required)
   - Compare price (for sales)
   - Currency code

5. Availability
   - in_stock / out_of_stock / preorder
   - Stock quantity (optional but recommended)

6. Brand
   - Required by Google Shopping
   - Store in brand field or product_identifiers.manufacturer

=== HIGHLY RECOMMENDED ===

7. GTIN (Global Trade Item Number)
   - UPC: 12 digits (US products)
   - EAN: 13 digits (European products)
   - ISBN: 13 digits (books)
   - Required for most categories in Google

8. MPN (Manufacturer Part Number)
   - Required if no GTIN available
   - Unique manufacturer identifier

9. Product Highlights
   - Up to 5 key selling points
   - Each max 150 characters
   - Used by AI assistants in recommendations

10. Weight & Dimensions
    - Required for shipping calculations
    - Helps AI with product comparison

=== PRODUCT ATTRIBUTES ===

Store in product_identifiers JSONB:
- condition: "new" | "refurbished" | "used"
- age_group: "newborn" | "infant" | "toddler" | "kids" | "adult"
- gender: "male" | "female" | "unisex"
- color: Primary color
- size: Size value
- material: Primary material

=== DATA QUALITY SCORE ===

AI Shopping Readiness calculated as:
- Name: 10%
- Description: 15%
- Images: 15%
- Price: 10%
- SKU: 5%
- GTIN: 10%
- Brand: 10%
- MPN: 5%
- Categories: 10%
- Weight/Dimensions: 5%

Target: 80%+ for good AI visibility',
'ai_shopping', '["data", "requirements", "google", "shopping"]', 100, 'all', true),

('ai_shopping_system', 'Product Feed Generation',
'AI SHOPPING - FEED GENERATION SYSTEM

DainoStore generates product feeds for major platforms.

=== AVAILABLE FEEDS ===

1. Google Merchant Center (XML)
   URL: /api/public/{store}/feeds/google-merchant.xml
   Format: RSS 2.0 with Google namespace
   Updates: Hourly cache, on-demand refresh

2. Microsoft/Bing Merchant (XML)
   URL: /api/public/{store}/feeds/microsoft-merchant.xml
   Format: Same as Google feed
   Compatible with Bing Shopping

3. ChatGPT/OpenAI Feed (JSON)
   URL: /api/public/{store}/feeds/chatgpt-feed.json
   Format: JSON optimized for LLMs
   Includes: Natural language summaries, highlights

4. Universal Schema.org (JSON-LD)
   URL: /api/public/{store}/feeds/universal-feed.json
   Format: Schema.org Product markup
   Used by: Search engines, AI crawlers

=== FEED CONTENT ===

Each product in feeds includes:
- id, name, description
- price, sale_price, currency
- availability, stock_status
- brand, gtin, mpn
- images (main + additional)
- link (product URL)
- category mapping
- shipping weight/dimensions
- product highlights
- specifications/attributes

=== GOOGLE FEED FIELDS ===

Required:
- g:id, g:title, g:description
- g:link, g:image_link
- g:price, g:availability
- g:brand, g:gtin (conditional)

Optional but recommended:
- g:sale_price, g:sale_price_effective_date
- g:additional_image_link
- g:product_type (your categories)
- g:google_product_category (Google taxonomy)
- g:shipping_weight
- g:color, g:size, g:material

=== FEED CACHING ===

- Redis cache: 1 hour TTL
- Manual refresh: POST /api/shopping-feeds/invalidate-cache
- Auto-refresh on product updates (optional)

=== SCHEMA.ORG ON PRODUCT PAGES ===

Product pages automatically include JSON-LD:
- @type: Product
- All product data
- Offers with price/availability
- AggregateRating (if reviews exist)
- Brand organization
- Shipping details',
'ai_shopping', '["feeds", "google", "schema", "seo"]', 98, 'all', true),

('ai_shopping_system', 'AI Agent API Endpoints',
'AI SHOPPING - AGENT API REFERENCE

Endpoints for AI assistants to query your store.

=== BASE URL ===
/api/ai-agent/{store-slug}/

=== PRODUCT ENDPOINTS ===

GET /products
List products with AI-friendly formatting

Query params:
- search: Text search
- category: Category slug
- brand: Brand filter
- min_price, max_price: Price range
- in_stock: true/false
- limit, offset: Pagination

Response includes:
- AI summary for each product
- Pricing context ("30% off", "Best price")
- Availability messaging
- Direct purchase links

GET /products/:id
Single product with full context

Returns:
- Complete product data
- Related products
- Store policies
- Specifications

GET /products/search
Natural language search

Query: "blue cotton t-shirt under $30"

Parser extracts:
- Keywords: ["blue", "cotton", "t-shirt"]
- Color: "blue"
- Max price: 30
- Category hints

=== CATEGORY ENDPOINTS ===

GET /categories
Category tree for navigation

Returns:
- Hierarchical category structure
- Product counts
- URLs for browsing

=== STORE ENDPOINTS ===

GET /store-info
Store context for AI

Returns:
- Store name, URL, currency
- Return policy, shipping policy
- Contact information
- Capabilities (search, filters, etc.)

=== RESPONSE FORMAT ===

Products formatted for AI consumption:
{
  "id": "...",
  "name": "...",
  "ai_summary": "Natural language description",
  "highlights": ["Premium quality", "30-day returns"],
  "pricing": {
    "current_price": 29.99,
    "price_context": "30% off original price"
  },
  "availability": {
    "status": "in_stock",
    "message": "Ships within 2 days"
  },
  "urls": {
    "product_page": "https://...",
    "add_to_cart": "https://..."
  }
}',
'ai_shopping', '["api", "agents", "endpoints", "chatgpt"]', 95, 'all', true),

-- ============================================
-- PRODUCT-CATEGORY SYSTEM DOCUMENTATION
-- ============================================

('product_category_system', 'Product-Category Relationships',
'PRODUCT-CATEGORY SYSTEM - REFERENCE

How products and categories are linked in DainoStore.

=== DATA MODEL ===

Products table:
- category_ids: JSONB array of category UUIDs
- Primary method for product-category linking

Example:
{
  "id": "product-uuid",
  "name": "Blue T-Shirt",
  "category_ids": [
    "category-uuid-1",  // Clothing
    "category-uuid-2"   // Summer Sale
  ]
}

=== KEY PRINCIPLE ===

Products can belong to MULTIPLE categories.
Categories form a hierarchy (parent_id).

=== ADDING PRODUCT TO CATEGORY ===

Via API:
```javascript
const product = await db(''products'').where(''id'', productId).first();
const currentIds = product.category_ids || [];
const newIds = [...currentIds, categoryId];
await db(''products'').where(''id'', productId).update({ category_ids: newIds });
```

Via AI Chat:
"add SKU-123 to category Summer Sale"

=== BULK CATEGORY ASSIGNMENT ===

AI supports bulk operations:
- "add all t-shirts to Clothing category"
- "move products under $20 to Clearance"
- "add all products with color Red to Sale"

Process:
1. Query products matching criteria
2. For each product, add category to category_ids
3. Report: X added, Y already in category

=== QUERYING PRODUCTS BY CATEGORY ===

```javascript
const products = await db(''products'')
  .whereRaw(''category_ids @> ?'', JSON.stringify([categoryId]));
```

Or in application code:
```javascript
products.filter(p =>
  p.category_ids?.includes(categoryId)
);
```

=== CATEGORY HIERARCHY ===

Categories have parent_id for hierarchy:
- Root categories: parent_id = null
- Subcategories: parent_id = parent_category_id

Traversing hierarchy:
```javascript
// Get all ancestors
async function getAncestors(categoryId) {
  const ancestors = [];
  let current = await db(''categories'').where(''id'', categoryId).first();
  while (current?.parent_id) {
    current = await db(''categories'').where(''id'', current.parent_id).first();
    if (current) ancestors.push(current);
  }
  return ancestors;
}
```

=== REMOVING FROM CATEGORY ===

"remove SKU-123 from Summer Sale"

```javascript
const product = await db(''products'').where(''id'', productId).first();
const newIds = product.category_ids.filter(id => id !== categoryId);
await db(''products'').where(''id'', productId).update({ category_ids: newIds });
```',
'catalog', '["products", "categories", "relationships", "assignment"]', 100, 'all', true),

('product_category_system', 'Category Management Operations',
'CATEGORY MANAGEMENT - AI OPERATIONS

=== CREATE CATEGORY ===

"create category Summer Collection"

Creates:
- name: "Summer Collection"
- slug: "summer-collection" (auto-generated)
- parent_id: null (root category)
- is_active: true
- show_in_menu: true

"create subcategory Sandals under Footwear"

Creates with parent_id = Footwear category ID

=== UPDATE CATEGORY ===

"rename category Clothes to Apparel"
- Updates name field
- Optionally updates slug

"hide category Clearance from menu"
- Sets show_in_menu = false
- Category still accessible via direct URL

"deactivate category Test"
- Sets is_active = false
- Products remain but category hidden

=== DELETE CATEGORY ===

"delete category Old Collection"

Checks:
- If has products, warn user
- If has subcategories, warn about children
- Offer: delete only if empty, or remove products first

Deletion does NOT delete products, only unlinks them.

=== BULK OPERATIONS ===

"show empty categories"
- Categories with no products
- Based on category_ids array scanning

"delete empty categories"
- Removes categories with product_count = 0
- Confirmation required

"move all products from category A to category B"
- Removes category A from category_ids
- Adds category B to category_ids

=== CATEGORY QUERIES ===

"show products without categories"
- WHERE category_ids IS NULL OR category_ids = ''[]''

"show categories with product counts"
- Aggregates category_ids across products

"which categories is product X in"
- Returns category names for product''s category_ids',
'catalog', '["categories", "management", "operations"]', 95, 'all', true),

-- ============================================
-- WEBSHOP BEST PRACTICES DOCUMENTATION
-- ============================================

('webshop_best_practices', 'Conversion Optimization',
'WEBSHOP BEST PRACTICES - CONVERSION OPTIMIZATION

=== PRODUCT PAGE OPTIMIZATION ===

Essential elements:
1. High-quality images (multiple angles)
2. Clear, benefit-focused title
3. Visible price and availability
4. Prominent add-to-cart button
5. Trust badges and guarantees
6. Customer reviews
7. Clear return policy

Layout recommendations:
- Images on left, details on right (desktop)
- Price near add-to-cart button
- Reviews below fold
- Related products at bottom

=== CHECKOUT OPTIMIZATION ===

Reduce friction:
1. Enable guest checkout
2. Minimize form fields
3. Show progress indicator
4. Display security badges
5. Multiple payment options
6. Clear shipping costs early

Cart abandonment recovery:
- Exit intent popup (first time)
- Email reminder (1 hour, 24 hours)
- Show cart contents in email
- Offer incentive for completion

=== TRUST BUILDERS ===

Must-haves:
- SSL certificate (HTTPS)
- Clear contact information
- Return policy
- Privacy policy
- Payment security badges
- Customer reviews

Nice-to-haves:
- Trust pilot/review badges
- Money-back guarantee badge
- Secure checkout badge
- Social proof (X customers)

=== MOBILE OPTIMIZATION ===

Critical for 60%+ of traffic:
- Touch-friendly buttons (min 44x44px)
- Fast load times (<3 seconds)
- Simplified navigation
- Easy checkout flow
- Visible search

=== PAGE SPEED ===

Target: <3 seconds load time

Optimizations:
- Compress images
- Use WebP format
- Lazy load below-fold content
- Minimize JavaScript
- Use CDN for assets',
'best_practices', '["conversion", "optimization", "checkout", "trust"]', 90, 'all', true),

('webshop_best_practices', 'SEO and Marketing',
'WEBSHOP BEST PRACTICES - SEO & MARKETING

=== ON-PAGE SEO ===

Product pages:
- Unique title tags (Brand + Product + Attribute)
- Meta descriptions with call-to-action
- Alt text for all images
- Schema.org Product markup
- Clean URLs (/product-name not /p?id=123)

Category pages:
- Unique content (not just product list)
- Category description (100-300 words)
- H1 with category name
- Faceted navigation SEO considerations

Technical SEO:
- XML sitemap
- Robots.txt
- Canonical tags
- Mobile-friendly (responsive)
- HTTPS everywhere

=== CONTENT MARKETING ===

Blog topics for e-commerce:
- Product guides and comparisons
- How-to articles
- Trend roundups
- Behind the scenes
- Customer stories

Content distribution:
- Social media sharing
- Email newsletter
- Influencer outreach
- Guest posting

=== EMAIL MARKETING ===

Essential flows:
1. Welcome series (new subscribers)
2. Abandoned cart (1h, 24h, 72h)
3. Post-purchase (thank you, review request)
4. Win-back (30, 60, 90 day inactive)

Best practices:
- Personalize subject lines
- Segment your list
- A/B test send times
- Include product images
- Clear call-to-action

=== SOCIAL PROOF ===

Leverage customer content:
- Product reviews (aim for 5+ per product)
- User-generated content
- Social media mentions
- Testimonials
- Case studies

Display strategies:
- Reviews on product pages
- Rating in search results (Schema)
- Social proof popups ("X bought today")
- Instagram feed integration',
'best_practices', '["seo", "marketing", "email", "content"]', 88, 'all', true),

('webshop_best_practices', 'Customer Service Excellence',
'WEBSHOP BEST PRACTICES - CUSTOMER SERVICE

=== RETURN POLICY ===

Best practices:
- Clear, easy-to-find policy
- Reasonable return window (14-30 days)
- Free returns if margins allow
- Easy return process
- Quick refund processing (3-5 days)

Policy elements:
- Time limit for returns
- Condition requirements
- Who pays return shipping
- Refund vs exchange options
- Exceptions (sale items, etc.)

=== SHIPPING COMMUNICATION ===

Essential notifications:
1. Order confirmation (immediate)
2. Shipping confirmation (with tracking)
3. Out for delivery (if available)
4. Delivered confirmation

Best practices:
- Branded tracking page
- Proactive delay notifications
- Clear delivery estimates
- Easy order status lookup

=== CUSTOMER SUPPORT ===

Channels to offer:
- Email (required)
- Live chat (recommended)
- Phone (optional but builds trust)
- FAQ/Help center (required)
- Social media (monitor mentions)

Response time targets:
- Live chat: <2 minutes
- Email: <24 hours (business hours)
- Social: <4 hours
- Phone: <3 minute wait

=== HANDLING COMPLAINTS ===

HEARD method:
- Hear the customer fully
- Empathize with their situation
- Apologize sincerely
- Resolve the issue
- Diagnose to prevent recurrence

Resolution options:
- Full refund
- Partial refund
- Store credit
- Free replacement
- Discount on next order

=== PROACTIVE SERVICE ===

Prevent issues before they happen:
- Clear product descriptions
- Accurate sizing information
- Realistic delivery estimates
- Proactive stock notifications
- Order status updates',
'best_practices', '["customer_service", "returns", "shipping", "support"]', 85, 'all', true);

-- ============================================
-- SUMMARY
-- ============================================
-- Total context documents: 12
-- Topics: confirmation system, slot system, AI shopping,
--         product-category, best practices
-- Priority: 85-100 (high relevance)
-- Mode: all (available in all AI contexts)
-- ============================================
