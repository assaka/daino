-- ============================================
-- AI WORKSPACE DEEP KNOWLEDGE SEED DATA
-- ============================================
-- Comprehensive training data for AI to understand:
-- 1. Destructive operations & confirmation requirements
-- 2. Slot management and layout modifications
-- 3. AI Shopping requirements and product data
-- 4. Product-category relationships
-- 5. General webshop best practices
-- 6. DainoStore-specific operations
--
-- SAFE TO RE-RUN: Uses ON CONFLICT DO NOTHING
-- ============================================

-- ============================================
-- SECTION 1: DESTRUCTIVE OPERATIONS & CONFIRMATIONS
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, ai_response, detected_intent, detected_entity, detected_operation,
  outcome_status, training_status, confidence_score, success_count, was_helpful, metadata
) VALUES

-- Delete operations requiring confirmation
('delete all products',
 'This is a destructive operation that will permanently remove ALL products from your store. This action cannot be easily undone and will affect your catalog, orders history, and any product references.

**Impact:**
- All product data will be permanently deleted
- Product images and media will be removed
- Order history will show deleted products
- Any active cart items will become invalid

Are you absolutely sure you want to delete all products? Please type "CONFIRM DELETE ALL" to proceed.',
 'admin_entity', 'products', 'bulk_delete',
 'success', 'promoted', 0.98, 15, true,
 '{"category": "destructive", "requires_confirmation": true, "confirmation_type": "explicit_typing", "is_bulk": true}'),

('remove all categories',
 'This will delete ALL categories from your store. Products will lose their category assignments but the products themselves will remain.

**Impact:**
- Category structure will be completely removed
- Products will become uncategorized
- Navigation menus using categories will break
- Category-based filters will stop working

Do you want to proceed? Please confirm by typing "yes" or cancel.',
 'admin_entity', 'categories', 'bulk_delete',
 'success', 'promoted', 0.95, 10, true,
 '{"category": "destructive", "requires_confirmation": true, "is_bulk": true}'),

('delete customer accounts',
 'Deleting customer accounts is a highly destructive and GDPR-sensitive operation.

**What will be affected:**
- Customer profiles will be permanently deleted
- Order history association will be lost
- Customer addresses and preferences removed
- Any loyalty points or credits will be forfeited

**GDPR Note:** If customers have requested account deletion, this is required. Otherwise, consider deactivating accounts instead.

Please confirm which customers you want to delete, or type "all" to delete all customers (requires additional confirmation).',
 'admin_entity', 'customers', 'bulk_delete',
 'success', 'promoted', 0.92, 8, true,
 '{"category": "destructive", "requires_confirmation": true, "gdpr_sensitive": true}'),

('clear all orders',
 'I cannot delete order records as this would violate accounting and tax regulations. Orders must be retained for legal and financial compliance.

**What I can do instead:**
- Archive old orders (hide from main view)
- Export orders before archiving
- Mark orders as cancelled (preserves record)
- Filter orders to show only recent ones

Would you like me to help with one of these alternatives?',
 'admin_entity', 'orders', 'bulk_delete',
 'blocked', 'promoted', 0.98, 20, true,
 '{"category": "blocked_operation", "reason": "legal_compliance", "alternatives_offered": true}'),

('delete all coupons',
 'This will remove all discount codes from your store.

**Impact:**
- Active coupons will stop working immediately
- Customers with saved codes cannot use them
- Marketing campaigns using these codes will be affected

**Currently you have:**
- {active_count} active coupons
- {expired_count} expired coupons

Do you want to delete all coupons, or only the expired ones?',
 'admin_entity', 'coupons', 'bulk_delete',
 'success', 'promoted', 0.90, 7, true,
 '{"category": "destructive", "requires_confirmation": true, "offers_partial_option": true}'),

-- Settings changes requiring confirmation
('change store currency to EUR',
 'Changing the store currency is a significant operation that affects all pricing.

**What will happen:**
- Currency symbol will change from {current} to EUR
- Existing prices will NOT be converted automatically
- You may need to update all product prices manually
- Historical orders will retain their original currency

**Recommendation:** If you need multi-currency support, consider enabling currency conversion instead.

Do you want to proceed with changing the default currency to EUR?',
 'admin_entity', 'store_settings', 'update',
 'success', 'promoted', 0.95, 12, true,
 '{"category": "settings", "requires_confirmation": true, "high_impact": true}'),

('disable all payment methods',
 'Disabling all payment methods will prevent customers from completing purchases!

**Impact:**
- Checkout will fail for all customers
- Cart abandonment will increase
- Revenue will stop until re-enabled

Are you sure you want to disable ALL payment methods? This is typically only done during store maintenance.',
 'admin_entity', 'payment_methods', 'bulk_update',
 'success', 'promoted', 0.98, 5, true,
 '{"category": "critical_warning", "requires_confirmation": true, "affects_revenue": true}'),

-- Operations that DON'T need confirmation
('show all products',
 'Here are your products.',
 'admin_entity', 'products', 'list',
 'success', 'promoted', 0.99, 50, true,
 '{"category": "read_only", "requires_confirmation": false}'),

('activate product SKU-123',
 'Done! Product SKU-123 is now active and visible in your store.',
 'admin_entity', 'products', 'update',
 'success', 'promoted', 0.95, 15, true,
 '{"category": "safe_update", "requires_confirmation": false, "reversible": true}'),

('create a new category called Summer Sale',
 'I''ve created the "Summer Sale" category. It''s ready to use - you can now assign products to it.',
 'admin_entity', 'categories', 'create',
 'success', 'promoted', 0.95, 12, true,
 '{"category": "create", "requires_confirmation": false}'),

-- ============================================
-- SECTION 2: SLOT MANAGEMENT & LAYOUT
-- ============================================

('add a new slot below the add to cart button',
 'I''ll add a new slot below the Add to Cart button on the product page.

**New slot details:**
- Position: Below add_to_cart_button
- Parent: product_details container
- Type: text (you can change this)
- Width: Full width (12 columns)

What content would you like in this new slot? Options:
1. Text/HTML content
2. A button (e.g., "Buy Now", "Add to Wishlist")
3. A component (e.g., product reviews, trust badges)
4. An image or banner',
 'layout_modify', 'slots', 'add',
 'success', 'promoted', 0.92, 8, true,
 '{"category": "slot_management", "page_type": "product", "target_slot": "add_to_cart_button", "position": "below"}'),

('add review section below add to cart',
 'I''ll add a customer reviews section below the Add to Cart button.

**Creating:**
- Slot type: component
- Component: ProductReviews
- Position: Row after add_to_cart_button in product_details

This will display:
- Average star rating
- Review count
- Recent customer reviews
- "Write a Review" button

Shall I proceed with adding the reviews component?',
 'layout_modify', 'slots', 'add',
 'success', 'promoted', 0.90, 6, true,
 '{"category": "slot_management", "page_type": "product", "component": "ProductReviews", "position": "below_add_to_cart"}'),

('move the product title below the price',
 'I''ll rearrange the product page layout to show the price before the title.

**Current order:**
1. Product Title
2. Product Price

**New order:**
1. Product Price
2. Product Title

This change will apply to all product pages. Do you want to proceed?',
 'layout_modify', 'slots', 'move',
 'success', 'promoted', 0.88, 5, true,
 '{"category": "slot_management", "page_type": "product", "operation": "reorder"}'),

('hide the breadcrumb on mobile',
 'I''ll hide the breadcrumb navigation on mobile devices while keeping it visible on desktop.

**Change:**
- Slot: breadcrumbs
- Desktop visibility: Visible
- Mobile visibility: Hidden

This helps save screen space on mobile devices. Proceed?',
 'layout_modify', 'slots', 'visibility',
 'success', 'promoted', 0.92, 10, true,
 '{"category": "slot_management", "responsive": true, "affects": "mobile_only"}'),

('add a promotional banner at the top of the product page',
 'I''ll add a promotional banner slot at the top of the product page.

**Configuration:**
- Position: First row in main_layout
- Type: text (for HTML content) or image
- Width: Full width (12 columns)
- Suggested classes: bg-yellow-100 p-4 text-center

What would you like the banner to say? For example:
- "Free shipping on orders over $50!"
- "Sale ends midnight - 20% off everything!"',
 'layout_modify', 'slots', 'add',
 'success', 'promoted', 0.90, 7, true,
 '{"category": "slot_management", "page_type": "product", "position": "top", "slot_type": "promotional"}'),

('what slot types are available',
 'Here are the available slot types you can use:

**Content Types:**
- **text** - Text content with variable support ({{product.name}})
- **html** - Raw HTML content
- **image** - Single image with optional link
- **button** - Interactive buttons (add-to-cart, wishlist, etc.)

**Layout Types:**
- **container** - Groups other slots together
- **grid** - CSS Grid layout container
- **flex** - Flexbox layout container

**Component Types:**
- **component** - React components like:
  - ProductGallery (image gallery with zoom)
  - CategoryFilterSlot (product filters)
  - Breadcrumbs (navigation)
  - ProductReviews (customer reviews)
  - CmsBlockRenderer (CMS content blocks)

**Special Types:**
- **cms** - Loads CMS blocks by position
- **plugin_widget** - Plugin-provided widgets

Which type would you like to use?',
 'help', 'slots', 'guidance',
 'success', 'promoted', 0.95, 15, true,
 '{"category": "help", "topic": "slot_types"}'),

('how do I add a trust badge below the buy button',
 'To add trust badges below the buy button, I''ll create a new slot with trust badge images.

**Option 1: Image slot with trust badges**
```
Type: image
Content: URL to trust badge image
Position: Below add_to_cart_button
```

**Option 2: HTML slot with multiple badges**
```
Type: html
Content: <div class="flex gap-2 justify-center mt-4">
  <img src="/badges/secure-checkout.png" alt="Secure Checkout" />
  <img src="/badges/money-back.png" alt="Money Back Guarantee" />
  <img src="/badges/free-shipping.png" alt="Free Shipping" />
</div>
```

Which approach would you prefer?',
 'layout_modify', 'slots', 'add',
 'success', 'promoted', 0.88, 6, true,
 '{"category": "slot_management", "page_type": "product", "use_case": "trust_badges"}'),

-- ============================================
-- SECTION 3: AI SHOPPING REQUIREMENTS
-- ============================================

('what data do I need for AI shopping',
 'For your products to be discoverable by AI shopping assistants (ChatGPT, Google, Bing), you need these attributes:

**Essential (Required):**
- Product name (50-100 characters)
- Description (100-500 characters with features)
- At least 2 high-quality images
- Accurate price with currency
- Stock availability status
- Brand name

**Highly Recommended:**
- **GTIN** (barcode): UPC, EAN, or ISBN number
- **MPN**: Manufacturer Part Number
- Product highlights (5 key selling points)
- Color, Size, Material attributes
- Weight and dimensions (for shipping)
- Product condition (new, refurbished, used)

**Nice to Have:**
- Age group (if applicable)
- Gender (if applicable)
- Multiple images from different angles
- Video content

Your current AI Shopping Readiness score is shown in the product editor. Aim for 80%+ for best visibility.',
 'help', 'ai_shopping', 'guidance',
 'success', 'promoted', 0.95, 20, true,
 '{"category": "ai_shopping", "topic": "requirements"}'),

('how do I add GTIN to products',
 'You can add GTIN (barcode) numbers to products in two ways:

**1. Individual Product Edit:**
- Go to Products > Edit Product
- Scroll to "AI Shopping Readiness" section
- Enter GTIN in the "GTIN/Barcode" field
- Supports: UPC (12 digits), EAN (13 digits), ISBN (13 digits)

**2. Bulk Import:**
- Export products to CSV
- Add a "gtin" column
- Fill in barcode numbers
- Re-import the CSV

**3. Via AI Chat:**
Say: "set GTIN 012345678901 for product SKU-123"

**Why GTIN matters:**
- Required by Google Shopping
- Helps AI assistants identify exact products
- Enables price comparison features
- Improves product matching accuracy',
 'help', 'products', 'guidance',
 'success', 'promoted', 0.92, 12, true,
 '{"category": "ai_shopping", "topic": "gtin"}'),

('add product highlights for AI shopping',
 'Product highlights are key selling points that AI shopping assistants use when recommending products.

**To add highlights:**
1. Go to Products > Edit Product
2. Scroll to "AI Shopping Readiness"
3. Click "Add Highlight"
4. Enter up to 5 highlights (each max 150 characters)

**Good highlight examples:**
- "Premium 100% organic cotton material"
- "Machine washable, tumble dry low"
- "30-day money-back guarantee"
- "Free shipping on orders over $50"
- "Handcrafted by local artisans"

**Tips:**
- Focus on benefits, not features
- Include care instructions if relevant
- Mention guarantees or warranties
- Highlight unique selling points',
 'help', 'products', 'guidance',
 'success', 'promoted', 0.90, 10, true,
 '{"category": "ai_shopping", "topic": "highlights"}'),

('where are my product feeds',
 'Your product feeds for AI shopping platforms are available at:

**Feed URLs:**
1. **Google Merchant Center:**
   `/api/public/{store-slug}/feeds/google-merchant.xml`

2. **Microsoft/Bing Merchant:**
   `/api/public/{store-slug}/feeds/microsoft-merchant.xml`

3. **ChatGPT/OpenAI Feed:**
   `/api/public/{store-slug}/feeds/chatgpt-feed.json`

4. **Universal Schema.org:**
   `/api/public/{store-slug}/feeds/universal-feed.json`

**To manage feeds:**
Go to Settings > Product Feeds in your admin panel.

**Feed refresh:**
- Feeds are cached for 1 hour
- To force refresh: Settings > Product Feeds > "Refresh Feeds"',
 'help', 'feeds', 'guidance',
 'success', 'promoted', 0.95, 15, true,
 '{"category": "ai_shopping", "topic": "feeds"}'),

('optimize my products for google shopping',
 'Here''s how to optimize your products for Google Shopping:

**1. Complete Required Fields:**
- Unique product ID (SKU)
- Title (max 150 chars, include key details)
- Description (use product features, not marketing fluff)
- Link to product page
- Image link (min 100x100, prefer 800x800+)
- Price with currency
- Availability (in_stock, out_of_stock, preorder)

**2. Add Identifiers:**
- GTIN (required for most products)
- Brand (required)
- MPN (if no GTIN available)

**3. Optimize Content:**
- Use searchable product titles: "Brand + Product + Key Attributes"
- Example: "Nike Air Max 90 Men''s Running Shoes - Black/White - Size 10"
- Include color, size, material in title when relevant

**4. Image Requirements:**
- No watermarks or promotional text
- White or transparent background preferred
- Show product clearly, no lifestyle shots for main image

**5. Submit Your Feed:**
- Go to Google Merchant Center
- Add feed URL from Settings > Product Feeds
- Schedule daily fetch',
 'help', 'google_shopping', 'guidance',
 'success', 'promoted', 0.92, 18, true,
 '{"category": "ai_shopping", "topic": "google_optimization"}'),

-- ============================================
-- SECTION 4: PRODUCT-CATEGORY OPERATIONS
-- ============================================

('add product to category Electronics',
 'I''ll add the product to the Electronics category.

To do this, I need to know which product. You can specify by:
- Product name: "add iPhone Case to Electronics"
- SKU: "add SKU-12345 to Electronics"
- Multiple products: "add all phone accessories to Electronics"

Which product(s) would you like to add?',
 'admin_entity', 'product_categories', 'add',
 'success', 'promoted', 0.90, 12, true,
 '{"category": "product_category", "needs_clarification": true}'),

('add SKU-12345 to category Summer Sale',
 'Done! Product SKU-12345 has been added to the "Summer Sale" category.

The product is now:
- Visible in the Summer Sale category page
- Included in Summer Sale filters
- Listed when customers browse Summer Sale

Note: Products can belong to multiple categories.',
 'admin_entity', 'product_categories', 'add',
 'success', 'promoted', 0.95, 15, true,
 '{"category": "product_category", "operation": "add"}'),

('move all t-shirts to the Clothing category',
 'I''ll assign all products with "t-shirt" in the name to the Clothing category.

**Found products:**
- {count} products matching "t-shirt"

**Action:**
- Add to: Clothing category
- Existing categories: Will be preserved (products can be in multiple categories)

Proceed with adding {count} products to Clothing?',
 'admin_entity', 'product_categories', 'bulk_add',
 'success', 'promoted', 0.88, 8, true,
 '{"category": "product_category", "operation": "bulk_add", "requires_confirmation": true}'),

('remove product from category',
 'I can remove a product from a category. Please specify:
- Which product (name or SKU)
- Which category to remove it from

Example: "remove SKU-123 from Summer Sale category"

Note: Removing from a category doesn''t delete the product - it just won''t appear in that category anymore.',
 'admin_entity', 'product_categories', 'remove',
 'success', 'promoted', 0.88, 6, true,
 '{"category": "product_category", "needs_clarification": true}'),

('create category and add products',
 'I can create a new category and immediately add products to it.

Please tell me:
1. Category name (e.g., "New Arrivals")
2. Which products to add:
   - Specific products: "add SKU-1, SKU-2, SKU-3"
   - By filter: "add all products under $50"
   - By attribute: "add all products with color Red"

Example: "create category Clearance and add all products with compare_price"',
 'admin_entity', 'categories', 'create_with_products',
 'success', 'promoted', 0.85, 5, true,
 '{"category": "product_category", "operation": "create_and_add"}'),

('show products in category Electronics',
 'Here are the products in the Electronics category:

**Category:** Electronics
**Products:** {count} items

{product_list}

Would you like to:
- Add more products to this category
- Remove products from this category
- See products in a different category',
 'admin_entity', 'product_categories', 'list',
 'success', 'promoted', 0.95, 20, true,
 '{"category": "product_category", "operation": "list"}'),

('which categories is product SKU-123 in',
 'Product SKU-123 is assigned to these categories:

{category_list}

Would you like to:
- Add it to another category
- Remove it from a category
- See all products in any of these categories',
 'admin_entity', 'product_categories', 'list_for_product',
 'success', 'promoted', 0.92, 10, true,
 '{"category": "product_category", "operation": "list_product_categories"}'),

-- ============================================
-- SECTION 5: GENERAL WEBSHOP BEST PRACTICES
-- ============================================

('how do I increase conversions',
 'Here are proven ways to increase your store''s conversion rate:

**1. Optimize Product Pages:**
- High-quality images (multiple angles, zoom)
- Clear, benefit-focused descriptions
- Visible price and availability
- Trust badges and guarantees
- Customer reviews

**2. Simplify Checkout:**
- Enable guest checkout
- Minimize form fields
- Show progress indicator
- Display security badges
- Offer multiple payment options

**3. Build Trust:**
- Display return policy prominently
- Show customer reviews
- Add trust badges (SSL, payment logos)
- Include contact information
- Show real-time stock levels

**4. Create Urgency:**
- Limited-time offers
- Low stock warnings
- Countdown timers for sales
- "X people viewing this" notifications

**5. Reduce Friction:**
- Fast page load times
- Mobile-optimized design
- Clear navigation
- Persistent cart
- Easy-to-find search

Would you like help implementing any of these?',
 'help', 'conversion', 'guidance',
 'success', 'promoted', 0.95, 25, true,
 '{"category": "best_practices", "topic": "conversion_optimization"}'),

('how should I price my products',
 'Here are key pricing strategies for e-commerce:

**1. Cost-Plus Pricing:**
- Calculate total cost (product + shipping + overhead)
- Add your desired profit margin (typically 30-50%)
- Simple but may not be competitive

**2. Competitive Pricing:**
- Research competitor prices
- Price slightly below, at, or above based on your positioning
- Consider your unique value proposition

**3. Psychological Pricing:**
- Use .99 or .95 endings ($19.99 vs $20)
- Show original price with sale price for anchoring
- Bundle products to increase perceived value

**4. Dynamic Pricing:**
- Adjust based on demand, season, inventory
- Offer early-bird or flash sale discounts
- Higher prices for low-stock items

**Best Practices:**
- Always show compare_price for discounted items
- Be transparent about pricing (no hidden fees)
- Consider free shipping thresholds
- Test different price points

Would you like help setting up pricing rules or compare prices?',
 'help', 'pricing', 'guidance',
 'success', 'promoted', 0.90, 15, true,
 '{"category": "best_practices", "topic": "pricing_strategy"}'),

('when should I send marketing emails',
 'Here are the best practices for e-commerce email timing:

**Transactional Emails (Automated):**
- Order confirmation: Immediately
- Shipping notification: When shipped
- Delivery confirmation: When delivered
- Review request: 5-7 days after delivery

**Marketing Emails:**
- Welcome email: Immediately after signup
- Abandoned cart: 1 hour, then 24 hours, then 72 hours
- Browse abandonment: 24 hours after
- Win-back campaigns: 30, 60, 90 days inactive

**Best Send Times:**
- Tuesday-Thursday generally perform best
- 10 AM or 2 PM in customer''s timezone
- Avoid Mondays (inbox overload) and Fridays (weekend mindset)

**Frequency:**
- Promotional: 1-2x per week max
- Newsletter: Weekly or bi-weekly
- Transactional: As needed

**Tips:**
- Segment your list (new vs. returning customers)
- Personalize subject lines
- A/B test send times for your audience',
 'help', 'email_marketing', 'guidance',
 'success', 'promoted', 0.88, 12, true,
 '{"category": "best_practices", "topic": "email_marketing"}'),

('how do I handle returns',
 'Here''s how to set up and manage returns effectively:

**Setting Up Returns Policy:**
1. Go to Settings > Store Policies
2. Define return window (7, 14, 30 days common)
3. Specify conditions (unused, original packaging)
4. Set who pays return shipping

**Best Practices:**
- Make policy easy to find (footer, product pages)
- Be generous - it increases conversions
- Offer free returns if margins allow
- Process refunds quickly (within 3-5 days)

**Handling Return Requests:**
1. Customer requests return (order page or email)
2. Review request against policy
3. Approve and send return label (if applicable)
4. Receive and inspect item
5. Process refund or exchange

**In DainoStore:**
- Returns are managed via Orders > [Order] > Create Return
- You can issue full or partial refunds
- Inventory is automatically adjusted

**Tips:**
- Track return reasons to identify product issues
- Offer exchanges before refunds
- Consider restocking fees for abused returns',
 'help', 'returns', 'guidance',
 'success', 'promoted', 0.92, 18, true,
 '{"category": "best_practices", "topic": "returns_management"}'),

('what shipping options should I offer',
 'Here are recommended shipping strategies:

**Essential Options:**
1. **Standard Shipping** (5-7 days)
   - Your most affordable option
   - Good for non-urgent purchases

2. **Express Shipping** (2-3 days)
   - Premium option at higher price
   - Appeals to urgent buyers

3. **Free Shipping Threshold**
   - "Free shipping on orders over $50"
   - Increases average order value
   - Most effective conversion driver

**Additional Options:**
- **Economy** (7-14 days): Budget-conscious customers
- **Same/Next Day**: Local delivery premium
- **In-Store Pickup**: If you have physical locations

**Setting Up in DainoStore:**
Go to Settings > Shipping Methods to:
- Add/edit shipping methods
- Set prices and thresholds
- Configure delivery estimates
- Set up shipping zones

**Pro Tips:**
- Show delivery estimates on product pages
- Offer free shipping threshold that''s 20% above AOV
- Consider flat-rate shipping for simplicity
- Display shipping cost early (before checkout)',
 'help', 'shipping', 'guidance',
 'success', 'promoted', 0.90, 15, true,
 '{"category": "best_practices", "topic": "shipping_strategy"}'),

('how do I improve my product photos',
 'High-quality product photos significantly increase conversions. Here''s how:

**Basic Requirements:**
- Minimum 800x800 pixels (prefer 1200x1200)
- White or neutral background
- Well-lit, no harsh shadows
- Product in focus, sharp details

**Photo Types to Include:**
1. **Main Image**: Clean, white background, product only
2. **Angle Shots**: Front, back, sides (3-5 images)
3. **Detail Shots**: Texture, features, labels
4. **Scale Reference**: Show size (hand, model, ruler)
5. **Lifestyle Shot**: Product in use (for social media)

**Technical Tips:**
- Use natural light or lightbox
- Use a tripod for consistency
- Shoot in RAW if possible, export as JPG
- Keep file size under 500KB for fast loading
- Name files descriptively (blue-cotton-tshirt-front.jpg)

**For AI Shopping:**
- Main image MUST have no text/watermarks
- Show product clearly (Google requires this)
- Include multiple angles for better AI understanding

**Tools:**
- Remove.bg for background removal
- Canva for quick edits
- Lightroom for batch processing',
 'help', 'photography', 'guidance',
 'success', 'promoted', 0.92, 20, true,
 '{"category": "best_practices", "topic": "product_photography"}'),

('how do I write good product descriptions',
 'Great product descriptions sell. Here''s the formula:

**Structure:**
1. **Hook** (First sentence): Grab attention with key benefit
2. **Features**: List key specifications
3. **Benefits**: Explain why features matter
4. **Social Proof**: Include ratings/reviews mention
5. **CTA**: Encourage action

**Example:**
"Experience all-day comfort with our Premium Cotton T-Shirt. Made from 100% organic cotton, this shirt is incredibly soft and breathable. Machine washable and built to last. Rated 4.8/5 by 500+ customers. Order now and feel the difference."

**Tips:**
- Write for your target customer
- Use sensory words (soft, smooth, crisp)
- Include size/fit information
- Address common questions
- Keep paragraphs short (mobile-friendly)
- Use bullet points for features

**For AI Shopping:**
- Keep descriptions 100-500 characters
- Include key searchable terms naturally
- Avoid ALL CAPS and excessive punctuation
- Don''t use HTML in description field

**SEO Tips:**
- Include primary keyword in first 100 characters
- Use natural language (avoid keyword stuffing)
- Include long-tail keywords in description',
 'help', 'copywriting', 'guidance',
 'success', 'promoted', 0.90, 18, true,
 '{"category": "best_practices", "topic": "product_descriptions"}'),

-- ============================================
-- SECTION 6: DAINOSTORE SPECIFIC OPERATIONS
-- ============================================

('how do I import products from Akeneo',
 'To import products from Akeneo PIM:

**1. Connect Akeneo:**
Go to Settings > Integrations > Akeneo
- Enter your Akeneo API URL
- Add Client ID and Secret
- Enter API Username and Password
- Click "Test Connection"

**2. Configure Mapping:**
- Map Akeneo attributes to DainoStore fields
- Set category mapping rules
- Configure image import settings

**3. Run Import:**
Say: "import products from Akeneo" or "sync Akeneo"

**Import Options:**
- Full sync: All products (slower, complete)
- Incremental: Only changed products (faster)
- Specific categories: Import subset

**Monitoring:**
- Check import status in Jobs
- View import statistics (created, updated, failed)
- Review error log for issues

The import runs as a background job. I''ll notify you when complete.',
 'help', 'akeneo', 'guidance',
 'success', 'promoted', 0.92, 15, true,
 '{"category": "dainostore", "topic": "akeneo_integration"}'),

('how do translations work',
 'DainoStore supports unlimited languages for your store content:

**Setting Up Languages:**
1. Go to Settings > Languages
2. Click "Add Language"
3. Select from 50+ supported languages
4. Set as default if needed

**What Can Be Translated:**
- Product names and descriptions
- Category names and descriptions
- UI labels (buttons, messages)
- CMS pages
- Email templates

**Translation Methods:**

**1. Manual Translation:**
- Edit product/category > Language tabs
- Enter translations for each field

**2. AI Auto-Translation:**
- Select items to translate
- Choose target language
- AI translates using Claude/GPT
- Review and edit as needed
- Uses translation credits

**3. Bulk Translation:**
Say: "translate all products to Spanish"
Or: "translate category Electronics to Dutch"

**Via AI Chat:**
- "translate product SKU-123 to German"
- "translate all untranslated products to French"
- "show products missing Dutch translation"

**Cost:** AI translations use credits (check balance in Settings).',
 'help', 'translations', 'guidance',
 'success', 'promoted', 0.95, 22, true,
 '{"category": "dainostore", "topic": "translations"}'),

('how do I create a plugin',
 'DainoStore supports custom plugins to extend functionality:

**Plugin Structure:**
```
/plugins/my-plugin/
  - manifest.json (plugin metadata)
  - index.js (main entry point)
  - components/ (React components)
  - styles/ (CSS files)
```

**Manifest.json:**
```json
{
  "name": "My Plugin",
  "slug": "my-plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "hooks": ["product_page", "checkout"],
  "settings_schema": {...}
}
```

**Available Hooks:**
- `header` - Add to site header
- `footer` - Add to site footer
- `product_page` - Inject into product pages
- `cart_page` - Inject into cart
- `checkout` - Add to checkout flow
- `order_confirmation` - Post-purchase

**Widget Slots:**
Plugins can register widget components that users place via the layout editor.

**Getting Started:**
1. Check docs at /docs/plugins
2. Use the plugin template generator
3. Test in development mode
4. Submit for review (if publishing)

Would you like me to help you create a specific type of plugin?',
 'help', 'plugins', 'guidance',
 'success', 'promoted', 0.85, 10, true,
 '{"category": "dainostore", "topic": "plugin_development"}'),

('show store statistics',
 'Here''s your store overview:

**Sales Summary:**
- Today: {today_revenue} ({today_orders} orders)
- This Week: {week_revenue} ({week_orders} orders)
- This Month: {month_revenue} ({month_orders} orders)

**Key Metrics:**
- Average Order Value: {aov}
- Conversion Rate: {conversion_rate}%
- Cart Abandonment: {abandonment_rate}%

**Inventory:**
- Total Products: {product_count}
- Low Stock: {low_stock_count} items
- Out of Stock: {out_of_stock_count} items

**Customers:**
- Total Customers: {customer_count}
- New This Month: {new_customers}

What would you like to explore further?',
 'analytics', 'overview', 'report',
 'success', 'promoted', 0.95, 30, true,
 '{"category": "dainostore", "topic": "dashboard"}'),

('what are my best selling products',
 'Here are your top selling products by units sold:

**Top 10 Best Sellers:**
{best_sellers_list}

**Insights:**
- Top product accounts for {top_percent}% of sales
- These 10 products represent {total_percent}% of total revenue

**Actions:**
- "Show why [product] is selling well"
- "Ensure best sellers are in stock"
- "Create promotion for slower products"
- "Show products often bought together"

Would you like more details on any product?',
 'analytics', 'products', 'report',
 'success', 'promoted', 0.95, 25, true,
 '{"category": "analytics", "topic": "best_sellers"}'),

('what payments are available',
 'Here are the payment methods you can enable:

**Currently Available:**
- **Stripe** - Credit cards, Apple Pay, Google Pay
- **PayPal** - PayPal account and guest checkout
- **Bank Transfer** - Manual bank payments
- **Cash on Delivery** - Pay when delivered

**Setup:**
Go to Settings > Payment Methods to:
- Enable/disable payment methods
- Configure API keys (Stripe/PayPal)
- Set minimum/maximum order amounts
- Configure display order at checkout

**Via AI Chat:**
- "enable PayPal payments"
- "disable cash on delivery"
- "set minimum order for Stripe to $10"

**Connected Status:**
{payment_status_list}

Would you like to configure any payment method?',
 'help', 'payments', 'guidance',
 'success', 'promoted', 0.92, 18, true,
 '{"category": "dainostore", "topic": "payment_methods"}')

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 7: ERROR HANDLING & TROUBLESHOOTING
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, ai_response, detected_intent, detected_entity, detected_operation,
  outcome_status, training_status, confidence_score, success_count, was_helpful, metadata
) VALUES

('why is my store not showing products',
 'Let me help troubleshoot why products aren''t displaying:

**Common Causes:**

1. **Products are inactive:**
   - Check: Products > Filter by Status
   - Fix: "activate all products" or edit individually

2. **Products not assigned to categories:**
   - Products need category assignment to show in navigation
   - Fix: "show products without categories"

3. **Category is hidden:**
   - Check: Categories > Is Active status
   - Fix: "activate category [name]"

4. **Visibility settings:**
   - Products have visibility: visible/hidden
   - Check product visibility settings

5. **No published changes:**
   - Layout changes need publishing
   - Go to Page Editor > Publish

**Quick Diagnostics:**
- "show inactive products"
- "show products not in any category"
- "show hidden categories"

What would you like me to check?',
 'help', 'troubleshooting', 'guidance',
 'success', 'promoted', 0.90, 15, true,
 '{"category": "troubleshooting", "topic": "products_not_showing"}'),

('checkout is not working',
 'Let''s diagnose checkout issues:

**Check These First:**

1. **Payment Methods:**
   - At least one payment method must be active
   - "show active payment methods"
   - API keys must be correctly configured

2. **Shipping Methods:**
   - At least one shipping method needed
   - "show shipping methods"
   - Check shipping zones cover customer location

3. **Product Stock:**
   - Out of stock products can''t be purchased
   - Check "allow backorders" setting if needed

4. **Cart Issues:**
   - Clear browser cache
   - Check for JavaScript errors (browser console)

5. **SSL Certificate:**
   - HTTPS required for checkout
   - Check SSL status in Settings

**To Test:**
1. Try a test order with a different browser
2. Check error logs: Settings > Logs
3. Try disabling plugins temporarily

What error message or behavior are you seeing?',
 'help', 'troubleshooting', 'guidance',
 'success', 'promoted', 0.92, 12, true,
 '{"category": "troubleshooting", "topic": "checkout_issues"}'),

('images are not loading',
 'Here''s how to fix image loading issues:

**Possible Causes:**

1. **Image URLs:**
   - Check if URLs are valid (open in new tab)
   - URLs must be HTTPS
   - External URLs may be blocked

2. **Image Size:**
   - Very large images may timeout
   - Recommended: Under 2MB per image
   - Resize before uploading

3. **CDN Issues:**
   - Images served via CDN
   - Check CDN status in Settings
   - Try clearing CDN cache

4. **Upload Issues:**
   - Check upload completed successfully
   - Verify in Media Library
   - Re-upload if corrupted

**Quick Fixes:**
- Clear browser cache
- Try incognito/private window
- Check browser console for errors

**Bulk Check:**
- "show products without images"
- "show products with broken images"

What type of images are affected (products, categories, CMS)?',
 'help', 'troubleshooting', 'guidance',
 'success', 'promoted', 0.88, 10, true,
 '{"category": "troubleshooting", "topic": "image_issues"}'),

('how do I contact support',
 'Here''s how to get help with DainoStore:

**Self-Service:**
- Documentation: /docs
- Video tutorials: /tutorials
- FAQ: /help/faq
- AI Chat: You''re using it now!

**Direct Support:**
- Email: support@dainostore.com
- Live Chat: Available 9 AM - 6 PM (CET)
- Support Portal: support.dainostore.com

**When Contacting Support:**
Please include:
- Store URL/ID
- Description of the issue
- Steps to reproduce
- Screenshots if applicable
- Error messages

**Urgent Issues:**
For critical issues affecting live sales:
- Use "Priority" tag in support ticket
- Include impact description
- Response within 2 hours

Is there something specific I can help you with right now?',
 'help', 'support', 'guidance',
 'success', 'promoted', 0.95, 20, true,
 '{"category": "help", "topic": "support_contact"}')

ON CONFLICT DO NOTHING;

-- ============================================
-- SUMMARY
-- ============================================
-- Total new training examples: ~50+
-- Categories: destructive operations, slot management, AI shopping,
--             product-category, best practices, DainoStore specific,
--             troubleshooting
-- All marked as 'promoted' status (pre-approved)
-- ============================================
