-- ============================================
-- AI WORKSPACE COMPREHENSIVE TRAINING DATA
-- ============================================
-- ~340 additional training examples covering:
-- Products, Orders, Customers, Categories, Coupons,
-- Shipping, Inventory, Analytics, Settings, SEO,
-- Translations, CMS, Layout, Integrations, Email,
-- Troubleshooting
--
-- SAFE TO RE-RUN: Uses ON CONFLICT DO NOTHING
-- ============================================

-- ============================================
-- SECTION 1: PRODUCTS (30 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

-- Product creation and management
('how do I create a new product', 'suggestion', 'admin_ai', 'To create a new product, go to Products > Add New Product. Fill in the essential fields: product name, SKU (unique identifier), price, and description. Add at least one product image. Set the stock quantity if you track inventory. Assign it to one or more categories so customers can find it. Click Save to publish.', 'product', 'create', NULL, NULL),
('add a new product called Blue T-Shirt', 'suggestion', 'admin_ai', 'I''ll create a new product called "Blue T-Shirt". I''ll need a few more details: What''s the price? What SKU should I use? Would you like to add it to any category?', 'product', 'create', NULL, NULL),
('create product with SKU BT-001 price 29.99', 'suggestion', 'admin_ai', 'Done! I''ve created the product with SKU BT-001 priced at $29.99. The product is now in draft status. Would you like me to: 1) Add it to a category, 2) Upload images, 3) Set stock quantity, 4) Publish it now?', 'product', 'create', NULL, NULL),
('duplicate product SKU-123', 'suggestion', 'admin_ai', 'I''ve duplicated product SKU-123. The new product has SKU "SKU-123-copy" and is in draft status. All details, images, and attributes have been copied except for: stock quantity (set to 0) and sales data. Would you like me to update the SKU or any other details?', 'product', 'create', NULL, NULL),
('show all products under $50', 'suggestion', 'admin_ai', 'Here are all products priced under $50. Found {count} products. Showing price, stock status, and category for each. Would you like to filter further or export this list?', 'product', 'read', NULL, NULL),
('show products without images', 'suggestion', 'admin_ai', 'Found {count} products without images. Products without images perform poorly in search results and have lower conversion rates. Would you like me to: 1) List them all so you can add images, 2) Hide them from the storefront until images are added, 3) Show products with only one image (also needs improvement)?', 'product', 'read', NULL, NULL),
('update price of SKU-456 to 39.99', 'suggestion', 'admin_ai', 'Done! Updated the price of SKU-456 from ${old_price} to $39.99. The new price is now live on your store. Would you like to: 1) Also update the compare_at price for sale display, 2) Update prices for related products, 3) Schedule a price change instead?', 'product', 'update', NULL, NULL),
('set all shoes to 20% off', 'needs_confirmation', 'admin_ai', 'I''ll apply a 20% discount to all products in the Shoes category. This will affect {count} products. The original price will be kept as compare_at_price to show the discount. Current prices will be reduced by 20%. Do you want to proceed?', 'product', 'bulk_update', NULL, NULL),
('mark product SKU-789 as out of stock', 'suggestion', 'admin_ai', 'Done! SKU-789 is now marked as out of stock. Customers can no longer add it to cart. Would you like to: 1) Enable "Notify me when available" for this product, 2) Suggest alternative products to show instead, 3) Hide the product completely until restocked?', 'product', 'update', NULL, NULL),
('archive all products not sold in 6 months', 'needs_confirmation', 'admin_ai', 'I found {count} products with no sales in the last 6 months. Archiving will: 1) Remove them from storefront (not delete), 2) Keep order history intact, 3) Allow you to restore them later. This is a bulk operation. Do you want to proceed?', 'product', 'bulk_update', NULL, NULL),

-- Product attributes and variants
('how do I add product variants', 'suggestion', 'admin_ai', 'To add variants (sizes, colors, etc.): 1) Edit the product, 2) Go to Variants tab, 3) Add variant options (e.g., Size: S, M, L), 4) Generate variant combinations, 5) Set price and stock for each variant. You can have up to 3 variant dimensions (e.g., Size + Color + Material).', 'product', 'update', NULL, NULL),
('add size options S M L XL to product', 'suggestion', 'admin_ai', 'I''ll add Size variants to this product with options S, M, L, XL. This will create 4 variant combinations. Do you want me to: 1) Copy the main product price to all variants, 2) Set different prices per size, 3) Set stock levels now or leave at 0?', 'product', 'update', NULL, NULL),
('add color Red Blue Green to product SKU-123', 'suggestion', 'admin_ai', 'Added Color variants (Red, Blue, Green) to SKU-123. Three new variant SKUs have been created: SKU-123-RED, SKU-123-BLUE, SKU-123-GREEN. Each variant can have its own image, price, and stock level.', 'product', 'update', NULL, NULL),
('show products missing GTIN', 'suggestion', 'admin_ai', 'Found {count} products without GTIN (barcode). GTIN is required for Google Shopping and AI shopping feeds. Products missing GTIN won''t appear in AI shopping results. Would you like me to: 1) List all products to add GTIN manually, 2) Export a CSV for bulk GTIN update, 3) Show only products that ARE in shopping feeds?', 'product', 'read', NULL, NULL),
('set GTIN 012345678901 for SKU-123', 'suggestion', 'admin_ai', 'Done! Set GTIN 012345678901 for product SKU-123. The product is now eligible for Google Shopping and AI shopping feeds. The GTIN validates as a valid UPC code.', 'product', 'update', NULL, NULL),
('add brand Nike to all shoes', 'needs_confirmation', 'admin_ai', 'I''ll set the brand attribute to "Nike" for all products in the Shoes category. This will update {count} products. Brand is required for shopping feeds. Proceed?', 'product', 'bulk_update', NULL, NULL),
('show products with low AI shopping score', 'suggestion', 'admin_ai', 'Found {count} products with AI Shopping Readiness score below 60%. These products are missing key attributes for AI discovery. Common issues: missing GTIN ({x}), no brand ({y}), short description ({z}), missing images ({w}). Would you like a detailed report?', 'product', 'read', NULL, NULL),

-- Product images
('upload image for product SKU-456', 'suggestion', 'admin_ai', 'I can help you add images to SKU-456. You can: 1) Drag and drop images into the product editor, 2) Upload from URL - paste an image URL, 3) Select from Media Library. For best results: use at least 800x800px, white background for main image.', 'product', 'update', NULL, NULL),
('set featured image for product', 'suggestion', 'admin_ai', 'To set the featured (main) image: edit the product, go to Images section, drag the desired image to the first position. The first image becomes the featured image shown in listings and thumbnails.', 'product', 'update', NULL, NULL),
('delete all images from product SKU-789', 'needs_confirmation', 'admin_ai', 'This will remove all images from product SKU-789. The product will show a placeholder image. Are you sure? Consider keeping at least one image for better customer experience.', 'product', 'update', NULL, NULL),

-- Product pricing
('set compare price for sale items', 'suggestion', 'admin_ai', 'To show a sale price: set compare_at_price to the original price and price to the sale price. The strikethrough original price will display automatically. Example: compare_at_price: $50, price: $35 shows "$35 (was $50, save 30%)".', 'product', 'update', NULL, NULL),
('remove all sale prices', 'needs_confirmation', 'admin_ai', 'I''ll clear the compare_at_price from all products, removing the sale indication. This affects {count} products currently showing as on sale. The regular price will remain unchanged. Proceed?', 'product', 'bulk_update', NULL, NULL),
('increase all prices by 10%', 'needs_confirmation', 'admin_ai', 'I''ll increase all product prices by 10%. This will affect {count} products. Current total catalog value: ${total}. New total will be: ${new_total}. This change cannot be easily undone. Proceed?', 'product', 'bulk_update', NULL, NULL),
('show products with no price', 'suggestion', 'admin_ai', 'Found {count} products with price of $0 or no price set. These products may display incorrectly at checkout. Would you like to: 1) Set a minimum price for all, 2) Hide these products until priced, 3) See the full list to update manually?', 'product', 'read', NULL, NULL),

-- Product status
('publish all draft products', 'needs_confirmation', 'admin_ai', 'Found {count} products in draft status. Publishing will make them visible to customers. Before publishing, I recommend checking: all have images, prices are set, descriptions are complete. Proceed with publishing all?', 'product', 'bulk_update', NULL, NULL),
('unpublish product SKU-OLD', 'suggestion', 'admin_ai', 'Done! Product SKU-OLD is now unpublished and hidden from the storefront. It won''t appear in search or categories. Order history is preserved. You can republish anytime.', 'product', 'update', NULL, NULL),
('delete product SKU-DELETE', 'needs_confirmation', 'admin_ai', 'Deleting product SKU-DELETE is permanent. This will: remove the product completely, keep it in existing order history, remove from all categories. Consider archiving instead if you might need it later. Confirm deletion?', 'product', 'delete', NULL, NULL),
('show all inactive products', 'suggestion', 'admin_ai', 'Found {count} inactive products. These are hidden from customers. Reasons may include: manually deactivated, out of stock (if configured), scheduled end date passed. Would you like to see details or reactivate any?', 'product', 'read', NULL, NULL),
('activate all products in Summer Sale category', 'needs_confirmation', 'admin_ai', 'I''ll activate all {count} products in the Summer Sale category. They''ll become visible on the storefront immediately. Proceed?', 'product', 'bulk_update', NULL, NULL),
('how many products do I have', 'suggestion', 'admin_ai', 'You have {total} products in your store. Breakdown: {active} active (visible), {draft} draft (hidden), {archived} archived, {out_of_stock} out of stock. Would you like more details on any category?', 'product', 'read', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 2: ORDERS (25 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('show recent orders', 'suggestion', 'admin_ai', 'Here are your recent orders from the last 7 days. Showing order number, customer, total, status, and date. You have {count} orders totaling ${total}. Would you like to filter by status or date range?', 'order', 'read', NULL, NULL),
('show pending orders', 'suggestion', 'admin_ai', 'Found {count} orders with pending status. These orders are awaiting processing. You can: 1) Update status to processing, 2) Filter by payment status, 3) Export for fulfillment. Would you like details on any specific order?', 'order', 'read', NULL, NULL),
('show order #1234', 'suggestion', 'admin_ai', 'Order #1234: Customer: {name}, Email: {email}, Total: ${total}, Status: {status}, Date: {date}. Items: {items_list}. Shipping: {shipping_address}. Payment: {payment_method} ({payment_status}).', 'order', 'read', NULL, NULL),
('update order status to shipped', 'suggestion', 'admin_ai', 'Which order would you like to mark as shipped? Please provide the order number. When I update it, the customer will receive a shipping notification email automatically.', 'order', 'update', NULL, NULL),
('mark order #1234 as shipped', 'suggestion', 'admin_ai', 'Done! Order #1234 is now marked as Shipped. The customer has been sent a shipping notification email. Would you like to add a tracking number?', 'order', 'update', NULL, NULL),
('add tracking number to order #1234', 'suggestion', 'admin_ai', 'Please provide the tracking number and carrier (e.g., "UPS 1Z999AA10123456784"). I''ll add it to the order and update the customer via email.', 'order', 'update', NULL, NULL),
('cancel order #5678', 'needs_confirmation', 'admin_ai', 'Canceling order #5678 will: 1) Mark the order as cancelled, 2) Restock the items if configured, 3) NOT automatically refund payment. You may need to refund separately if payment was taken. Proceed with cancellation?', 'order', 'update', NULL, NULL),
('refund order #5678', 'needs_confirmation', 'admin_ai', 'Order #5678 total was ${total}. Do you want to: 1) Full refund - ${total}, 2) Partial refund - specify amount, 3) Refund shipping only - ${shipping}. The refund will be processed through the original payment method.', 'order', 'update', NULL, NULL),
('show orders from last month', 'suggestion', 'admin_ai', 'Orders from last month: {count} orders, ${total} revenue, {avg_order} average order value. Breakdown by status: {completed} completed, {cancelled} cancelled, {refunded} refunded. Want to compare to the previous month?', 'order', 'read', NULL, NULL),
('export orders to CSV', 'suggestion', 'admin_ai', 'I''ll export your orders to CSV. Options: 1) All orders (may be large), 2) Date range (specify start/end), 3) By status (pending, completed, etc.). The export will include order ID, customer, items, totals, and status.', 'order', 'read', NULL, NULL),
('show orders with failed payment', 'suggestion', 'admin_ai', 'Found {count} orders with failed payment status. These customers attempted checkout but payment was declined. Common actions: 1) Contact customer to retry, 2) Send payment retry link, 3) Archive if abandoned.', 'order', 'read', NULL, NULL),
('resend order confirmation to customer', 'suggestion', 'admin_ai', 'Which order should I resend the confirmation for? I''ll send a copy of the order confirmation email to the customer''s email address on file.', 'order', 'update', NULL, NULL),
('resend confirmation for order #1234', 'suggestion', 'admin_ai', 'Done! Order confirmation email has been resent to {customer_email} for order #1234. They should receive it within a few minutes.', 'order', 'update', NULL, NULL),
('add note to order #1234', 'suggestion', 'admin_ai', 'What note would you like to add to order #1234? Notes are visible to admin only, not the customer. Use for internal tracking like "Customer requested gift wrap" or "Verified by phone".', 'order', 'update', NULL, NULL),
('show high value orders', 'suggestion', 'admin_ai', 'Found {count} orders over ${threshold}. These are your highest-value transactions. Consider: priority shipping, personal thank-you note, extra care in packing. Would you like to see orders above a different amount?', 'order', 'read', NULL, NULL),
('show orders by customer john@email.com', 'suggestion', 'admin_ai', 'Customer john@email.com has placed {count} orders totaling ${total}. Customer since: {date}. Average order: ${avg}. Last order: {last_order}. Would you like to see all their orders or contact them?', 'order', 'read', NULL, NULL),
('how many orders today', 'suggestion', 'admin_ai', 'Today you have received {count} orders totaling ${total}. Compared to yesterday: {comparison}. Pending: {pending}, Processing: {processing}, Shipped: {shipped}.', 'order', 'read', NULL, NULL),
('show unpaid orders', 'suggestion', 'admin_ai', 'Found {count} orders awaiting payment. These are orders where payment wasn''t completed or is pending (bank transfer, etc.). Total pending: ${total}. Would you like to send payment reminders?', 'order', 'read', NULL, NULL),
('print packing slip for order #1234', 'suggestion', 'admin_ai', 'I''ve generated a packing slip for order #1234. It includes: order items, quantities, customer shipping address, and any special instructions. You can print it from your browser.', 'order', 'read', NULL, NULL),
('print invoice for order #1234', 'suggestion', 'admin_ai', 'Generated invoice for order #1234. Includes: your business details, customer billing info, itemized products with prices, tax breakdown, and total. Ready for printing or PDF download.', 'order', 'read', NULL, NULL),
('update shipping address for order #1234', 'suggestion', 'admin_ai', 'Please provide the new shipping address. Note: Changing the address after shipping won''t redirect the package. If already shipped, you may need to contact the carrier directly.', 'order', 'update', NULL, NULL),
('split order #1234', 'suggestion', 'admin_ai', 'Order splitting creates multiple shipments from one order. Which items should go in each shipment? This is useful when: items ship from different locations, some items are backordered, customer requested partial delivery.', 'order', 'update', NULL, NULL),
('merge orders #1234 and #1235', 'needs_confirmation', 'admin_ai', 'Merging orders #1234 and #1235 into one shipment. Both orders must be: same customer, same shipping address, unpaid or same payment status. Items will be combined. Proceed?', 'order', 'update', NULL, NULL),
('show orders with discount codes', 'suggestion', 'admin_ai', 'Found {count} orders that used discount codes. Top codes used: {code_list}. Total discount given: ${total_discount}. Average discount per order: ${avg_discount}. Would you like to see performance by specific code?', 'order', 'read', NULL, NULL),
('flag order #1234 for review', 'suggestion', 'admin_ai', 'Done! Order #1234 has been flagged for review. It''s marked with a review indicator and won''t auto-process. Add a note explaining why it needs review?', 'order', 'update', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 3: CUSTOMERS (25 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('show all customers', 'suggestion', 'admin_ai', 'You have {count} registered customers. Showing: name, email, orders count, total spent. Can filter by: registration date, order count, total spent, customer group. What would you like to see?', 'customer', 'read', NULL, NULL),
('show customer john@email.com', 'suggestion', 'admin_ai', 'Customer: John Doe, Email: john@email.com. Member since: {date}. Total orders: {count}. Total spent: ${total}. Average order: ${avg}. Last order: {last_date}. Saved addresses: {address_count}. Would you like to view their order history?', 'customer', 'read', NULL, NULL),
('find customers who spent over $500', 'suggestion', 'admin_ai', 'Found {count} customers who have spent over $500 total. These are your VIP customers! Top spender: {name} (${total}). Consider: loyalty rewards, exclusive offers, priority support. Export list?', 'customer', 'read', NULL, NULL),
('show new customers this month', 'suggestion', 'admin_ai', '{count} new customers registered this month. Compared to last month: {comparison}. Breakdown: {with_orders} have placed orders, {no_orders} haven''t ordered yet. Would you like to send a welcome offer to new customers?', 'customer', 'read', NULL, NULL),
('create customer account', 'suggestion', 'admin_ai', 'I''ll create a new customer account. I need: email address (required), first name, last name. Optional: phone number, default address. The customer will receive a welcome email with login credentials.', 'customer', 'create', NULL, NULL),
('add customer john@email.com John Doe', 'suggestion', 'admin_ai', 'Created customer account for John Doe (john@email.com). They can now: log into the store, save addresses, view order history, get personalized recommendations. Send welcome email?', 'customer', 'create', NULL, NULL),
('update customer email from old@email.com to new@email.com', 'needs_confirmation', 'admin_ai', 'I''ll update the customer email from old@email.com to new@email.com. This changes their login email. The customer should be notified of this change. Proceed?', 'customer', 'update', NULL, NULL),
('reset password for customer john@email.com', 'suggestion', 'admin_ai', 'Sent password reset email to john@email.com. The link expires in 24 hours. Customer can set a new password through the link.', 'customer', 'update', NULL, NULL),
('deactivate customer account', 'needs_confirmation', 'admin_ai', 'Which customer account should I deactivate? This will: prevent login, hide from customer list, preserve order history. The account can be reactivated later. (Note: For GDPR deletion requests, use full deletion instead.)', 'customer', 'update', NULL, NULL),
('delete customer account john@email.com', 'needs_confirmation', 'admin_ai', 'Deleting john@email.com is permanent and GDPR-related. This will: remove personal data, anonymize order history, delete saved addresses and preferences. Order records kept with anonymized data. Confirm deletion?', 'customer', 'delete', NULL, NULL),
('add customer to VIP group', 'suggestion', 'admin_ai', 'Which customer should I add to the VIP group? VIP group members get: special pricing (if configured), exclusive access, priority support badge. Provide customer email or name.', 'customer', 'update', NULL, NULL),
('show customers without orders', 'suggestion', 'admin_ai', 'Found {count} registered customers who haven''t placed an order. These may need: welcome discount, abandoned cart recovery, re-engagement email. Average account age: {avg_days} days. Send promotional email?', 'customer', 'read', NULL, NULL),
('export customer list', 'suggestion', 'admin_ai', 'I''ll export your customer list. Choose what to include: 1) Basic info (name, email), 2) Full details (with addresses, phone), 3) With order statistics. Note: Handle this data according to privacy regulations.', 'customer', 'read', NULL, NULL),
('show customer order history', 'suggestion', 'admin_ai', 'Which customer? Provide email or name. I''ll show their complete order history: dates, items, totals, and status.', 'customer', 'read', NULL, NULL),
('add address for customer john@email.com', 'suggestion', 'admin_ai', 'I''ll add a shipping/billing address for john@email.com. Please provide: Street address, City, State/Province, Postal code, Country. Set as default for shipping and/or billing?', 'customer', 'update', NULL, NULL),
('show customer groups', 'suggestion', 'admin_ai', 'Your customer groups: {group_list}. Groups allow: special pricing, restricted access, targeted marketing. Customers can be in multiple groups. Would you like to create a new group or manage existing ones?', 'customer', 'read', NULL, NULL),
('create customer group Wholesale', 'suggestion', 'admin_ai', 'Created customer group "Wholesale". Now you can: assign customers to this group, set wholesale pricing rules, restrict certain products to this group. Add members to the group?', 'customer', 'create', NULL, NULL),
('show inactive customers', 'suggestion', 'admin_ai', 'Found {count} customers with no orders in the last {days} days. These are at risk of churning. Win-back strategies: personalized offers, "We miss you" emails, exclusive comeback discounts. Export for campaign?', 'customer', 'read', NULL, NULL),
('merge duplicate customers', 'needs_confirmation', 'admin_ai', 'Found potential duplicate customers. This usually happens when customers checkout as guest and later register. Merging combines: order history, addresses, preferences. Cannot be undone. Show potential duplicates?', 'customer', 'update', NULL, NULL),
('show customer lifetime value ranking', 'suggestion', 'admin_ai', 'Top 20 customers by lifetime value: {ranked_list}. Total LTV from top 20: ${total}. This represents {percent}% of all revenue. Your top customers are crucial - consider personal outreach!', 'customer', 'read', NULL, NULL),
('add tags to customer', 'suggestion', 'admin_ai', 'Which customer and what tags? Tags help organize customers for marketing. Examples: "vip", "wholesale", "influencer", "returning-issue". Multiple tags can be added.', 'customer', 'update', NULL, NULL),
('show customers from Germany', 'suggestion', 'admin_ai', 'Found {count} customers from Germany. Breakdown by city: {city_list}. This is {percent}% of your customer base. Would you like to: create a Germany-specific campaign, see buying patterns, export list?', 'customer', 'read', NULL, NULL),
('send email to customer group VIP', 'suggestion', 'admin_ai', 'I can help prepare an email to your VIP customer group ({count} members). What would you like to communicate? Options: new product announcement, exclusive offer, loyalty reward, survey request.', 'customer', 'update', NULL, NULL),
('show customers subscribed to newsletter', 'suggestion', 'admin_ai', 'Found {count} customers subscribed to your newsletter. This is {percent}% of customers. Last campaign: {date}, {open_rate}% open rate. Would you like to: send a newsletter, view unsubscribes, export list?', 'customer', 'read', NULL, NULL),
('how many customers do I have', 'suggestion', 'admin_ai', 'You have {total} total customers. Active (ordered in 90 days): {active}. New this month: {new}. At risk (no order in 90+ days): {at_risk}. Newsletter subscribers: {subscribers}.', 'customer', 'read', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 4: CATEGORIES (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('show all categories', 'suggestion', 'admin_ai', 'Your category structure: {category_tree}. Total: {count} categories. {active} active, {hidden} hidden. Categories help customers browse and improve SEO. Would you like to reorganize or add new categories?', 'category', 'read', NULL, NULL),
('create category Summer Collection', 'suggestion', 'admin_ai', 'Created category "Summer Collection". It''s now active and ready for products. Next steps: 1) Add products to this category, 2) Add to navigation menu, 3) Set a category image, 4) Write SEO description.', 'category', 'create', NULL, NULL),
('create subcategory T-Shirts under Clothing', 'suggestion', 'admin_ai', 'Created "T-Shirts" as a subcategory of "Clothing". URL structure: /clothing/t-shirts. Products in T-Shirts will also show in parent category Clothing listings.', 'category', 'create', NULL, NULL),
('rename category Electronics to Tech & Gadgets', 'suggestion', 'admin_ai', 'Done! Renamed "Electronics" to "Tech & Gadgets". The URL slug has been updated and a redirect from the old URL is in place. All products remain assigned.', 'category', 'update', NULL, NULL),
('delete category Old Stock', 'needs_confirmation', 'admin_ai', 'Deleting category "Old Stock" will: remove the category, unassign {count} products from it (products not deleted), remove from navigation. Products will still exist but won''t be in this category. Proceed?', 'category', 'delete', NULL, NULL),
('hide category Seasonal', 'suggestion', 'admin_ai', 'Done! Category "Seasonal" is now hidden from the storefront. Products in it won''t show in this category but may still appear in other categories they''re assigned to. Unhide anytime.', 'category', 'update', NULL, NULL),
('move category Sale under Promotions', 'suggestion', 'admin_ai', 'Moved "Sale" to be a subcategory of "Promotions". New URL: /promotions/sale. Redirects from old URL are set up. Navigation menu updated automatically.', 'category', 'update', NULL, NULL),
('show empty categories', 'suggestion', 'admin_ai', 'Found {count} categories with no products: {list}. Empty categories should be hidden or populated. Would you like me to: hide them, delete them, or suggest products to add?', 'category', 'read', NULL, NULL),
('add image to category Electronics', 'suggestion', 'admin_ai', 'To add an image to Electronics category: edit the category and upload in the Image section. Recommended: 800x600px minimum, lifestyle image showing category theme. This image shows on category pages and can be used in marketing.', 'category', 'update', NULL, NULL),
('reorder categories in navigation', 'suggestion', 'admin_ai', 'To reorder categories in navigation: go to Layout > Navigation > Main Menu. Drag categories to desired order. Alternatively, set Display Order number for each category (lower numbers appear first).', 'category', 'update', NULL, NULL),
('set category description for SEO', 'suggestion', 'admin_ai', 'Which category needs an SEO description? A good category description: 150-300 words, includes keywords, describes what customers will find. Shown on category page and used by search engines.', 'category', 'update', NULL, NULL),
('show products in category Shoes', 'suggestion', 'admin_ai', 'Category "Shoes" has {count} products. Showing: product name, price, stock status. Would you like to: add more products, remove products, see sales performance for this category?', 'category', 'read', NULL, NULL),
('bulk add products to category Sale', 'suggestion', 'admin_ai', 'I can add multiple products to "Sale" category. Options: 1) By price range (e.g., all under $30), 2) By current category (e.g., all from Shoes), 3) By tag (e.g., all with "clearance" tag), 4) By list (provide SKUs).', 'category', 'update', NULL, NULL),
('create smart category for new arrivals', 'suggestion', 'admin_ai', 'I''ll create a smart category "New Arrivals" that auto-populates with products added in the last 30 days. Rules: include products created within 30 days, sort by date newest first, auto-remove when older. Proceed?', 'category', 'create', NULL, NULL),
('duplicate category structure', 'suggestion', 'admin_ai', 'I can duplicate a category including its subcategories. This creates: same hierarchy, same settings, no products (those need to be assigned). Useful for seasonal variations. Which category to duplicate?', 'category', 'create', NULL, NULL),
('how many products in each category', 'suggestion', 'admin_ai', 'Product count by category: {category_counts}. Categories with most products: {top_categories}. Categories needing more products: {low_categories}. Would you like to balance the distribution?', 'category', 'read', NULL, NULL),
('set featured products for category', 'suggestion', 'admin_ai', 'Which category? Featured products appear first in category listings. You can: manually select products to feature, or let it auto-feature based on: best sellers, newest, highest rated.', 'category', 'update', NULL, NULL),
('create category from filter', 'suggestion', 'admin_ai', 'I can create a category populated by product attributes. Example: category "Red Items" with all products where color=red. The category updates automatically when products match. What filter criteria?', 'category', 'create', NULL, NULL),
('merge two categories', 'needs_confirmation', 'admin_ai', 'Merging categories combines products into one. Products from the deleted category move to the kept category. Which category to keep and which to merge into it? This cannot be undone.', 'category', 'update', NULL, NULL),
('show category tree depth', 'suggestion', 'admin_ai', 'Your deepest category path has {depth} levels. Recommended maximum: 3 levels for good UX. Deep paths: {deep_paths}. Consider flattening if too deep.', 'category', 'read', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 5: COUPONS (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('show all coupons', 'suggestion', 'admin_ai', 'Your coupons: {count} total. {active} active, {expired} expired, {scheduled} scheduled. Top performers: {top_codes}. Total discounts given: ${total_discount}. Would you like to create a new coupon?', 'coupon', 'read', NULL, NULL),
('create coupon SAVE20 for 20% off', 'suggestion', 'admin_ai', 'Created coupon SAVE20 for 20% off. Default settings: applies to entire order, unlimited uses, no expiry. Would you like to set: minimum order amount, usage limit, expiry date, or restrict to specific products?', 'coupon', 'create', NULL, NULL),
('create $10 off coupon TENOFF', 'suggestion', 'admin_ai', 'Created fixed discount coupon TENOFF for $10 off. Would you like to set a minimum order requirement? (Recommended: at least $10 more than discount to prevent free orders)', 'coupon', 'create', NULL, NULL),
('set coupon SUMMER to expire on August 31', 'suggestion', 'admin_ai', 'Done! Coupon SUMMER will expire on August 31, 2024 at 11:59 PM. After this date, customers will see "Coupon expired" if they try to use it.', 'coupon', 'update', NULL, NULL),
('limit coupon FLASH50 to 100 uses', 'suggestion', 'admin_ai', 'Done! Coupon FLASH50 is now limited to 100 total uses. Current usage: {current}/100. Once limit is reached, it auto-deactivates. Great for flash sales!', 'coupon', 'update', NULL, NULL),
('make coupon one use per customer', 'suggestion', 'admin_ai', 'Which coupon? Setting "one use per customer" prevents the same customer from using the code multiple times. We track by email address and account.', 'coupon', 'update', NULL, NULL),
('deactivate coupon OLDCODE', 'suggestion', 'admin_ai', 'Done! Coupon OLDCODE is now inactive. Customers trying to use it will see "Invalid coupon code". You can reactivate it anytime. Usage before deactivation: {usage_count} uses.', 'coupon', 'update', NULL, NULL),
('delete coupon OLDCODE', 'needs_confirmation', 'admin_ai', 'Deleting coupon OLDCODE is permanent. Usage history: {usage_count} uses, ${total_discount} in discounts given. Consider deactivating instead to preserve history. Proceed with deletion?', 'coupon', 'delete', NULL, NULL),
('show coupon usage for SAVE20', 'suggestion', 'admin_ai', 'Coupon SAVE20 statistics: {usage_count} uses, ${total_discount} total discounts, ${avg_order} average order with coupon, {conversion_rate}% conversion from coupon entry. Top users: {top_users}.', 'coupon', 'read', NULL, NULL),
('create free shipping coupon', 'suggestion', 'admin_ai', 'Created free shipping coupon. Code: FREESHIP. What conditions? Options: 1) No minimum (free shipping always), 2) Minimum order (e.g., $50+), 3) Specific products/categories only.', 'coupon', 'create', NULL, NULL),
('set minimum order $50 for coupon SAVE20', 'suggestion', 'admin_ai', 'Done! Coupon SAVE20 now requires minimum order of $50. Customers with smaller carts will see "Add ${remaining} more to use this code".', 'coupon', 'update', NULL, NULL),
('restrict coupon to first-time customers', 'suggestion', 'admin_ai', 'Which coupon? First-time customer restriction checks: customer has no previous orders. Great for: welcome discounts, acquisition campaigns. Note: only works for registered customers.', 'coupon', 'update', NULL, NULL),
('apply coupon only to Electronics category', 'suggestion', 'admin_ai', 'Which coupon should apply only to Electronics? I''ll restrict it so the discount only applies to products in the Electronics category. Other cart items won''t be discounted.', 'coupon', 'update', NULL, NULL),
('exclude sale items from coupon', 'suggestion', 'admin_ai', 'Which coupon? Setting "exclude sale items" prevents the coupon from applying to products with a compare_at_price (already on sale). Prevents double-discounting.', 'coupon', 'update', NULL, NULL),
('create bulk discount codes', 'suggestion', 'admin_ai', 'I can generate multiple unique codes. Options: 1) Random codes (e.g., XFGT-4829), 2) Prefixed codes (e.g., VIP-001, VIP-002), 3) Custom pattern. How many codes and what discount?', 'coupon', 'create', NULL, NULL),
('generate 50 unique 15% off codes', 'suggestion', 'admin_ai', 'Generated 50 unique coupon codes with 15% discount. Format: {prefix}-XXXXX. Each code is single-use. Download CSV with all codes for distribution. Valid until: {expiry}.', 'coupon', 'create', NULL, NULL),
('show expired coupons', 'suggestion', 'admin_ai', 'Found {count} expired coupons. These are no longer usable. Options: 1) Delete expired coupons, 2) Reactivate with new dates, 3) Keep for historical reference.', 'coupon', 'read', NULL, NULL),
('create buy one get one coupon', 'suggestion', 'admin_ai', 'Created BOGO coupon. Configuration: buy 1, get 1 free (or % off). Applies to: cheapest item free, or specific products. What products should this apply to?', 'coupon', 'create', NULL, NULL),
('copy coupon settings to new coupon', 'suggestion', 'admin_ai', 'Which coupon to copy? I''ll duplicate all settings (discount, conditions, restrictions) with a new code. Useful for: new campaigns with same rules, A/B testing codes.', 'coupon', 'create', NULL, NULL),
('show coupons expiring soon', 'suggestion', 'admin_ai', 'Coupons expiring in the next 7 days: {list}. Would you like to: extend their expiry, send reminder to customers, or let them expire?', 'coupon', 'read', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 6: SHIPPING (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('show shipping methods', 'suggestion', 'admin_ai', 'Your shipping methods: {list}. Active: {active}, Inactive: {inactive}. Zones configured: {zones}. Would you like to add a new method, adjust rates, or modify zones?', 'shipping', 'read', NULL, NULL),
('add free shipping for orders over $50', 'suggestion', 'admin_ai', 'Created "Free Shipping" method for orders $50+. Configuration: rate $0, minimum order $50, all zones. Customers see: "Free shipping on orders over $50". Display priority set high so it shows first when eligible.', 'shipping', 'create', NULL, NULL),
('create flat rate shipping $5.99', 'suggestion', 'admin_ai', 'Created flat rate shipping at $5.99. Applies to: all products, all zones. Name: "Standard Shipping". Estimated delivery: 5-7 business days (configurable). Would you like to limit this to certain zones?', 'shipping', 'create', NULL, NULL),
('add express shipping option', 'suggestion', 'admin_ai', 'Created "Express Shipping" method. Recommended rate: $14.99-19.99. Estimated delivery: 1-2 business days. Should I: set a specific rate, use carrier-calculated rates, or make it zone-based?', 'shipping', 'create', NULL, NULL),
('set up shipping zones', 'suggestion', 'admin_ai', 'Shipping zones group regions with similar rates. Common setup: 1) Domestic (your country), 2) EU/Europe, 3) International. Each zone can have different methods and rates. What zones do you need?', 'shipping', 'create', NULL, NULL),
('create shipping zone for Europe', 'suggestion', 'admin_ai', 'Created shipping zone "Europe" including all EU countries plus UK, Switzerland, Norway. Now add shipping methods to this zone with European rates.', 'shipping', 'create', NULL, NULL),
('disable shipping to country', 'suggestion', 'admin_ai', 'Which country should I disable shipping to? This will: prevent checkout for that country, show "We don''t ship to [country]" message. Order history unaffected.', 'shipping', 'update', NULL, NULL),
('update shipping rate to $7.99', 'suggestion', 'admin_ai', 'Which shipping method should I update to $7.99? I''ll change the rate immediately. Pending orders keep their original shipping cost.', 'shipping', 'update', NULL, NULL),
('set weight-based shipping', 'suggestion', 'admin_ai', 'Setting up weight-based shipping. I need: 1) Weight brackets (e.g., 0-1kg, 1-5kg, 5kg+), 2) Rates for each bracket, 3) Which zones. Make sure products have weights set for accurate calculation.', 'shipping', 'update', NULL, NULL),
('add handling fee to shipping', 'suggestion', 'admin_ai', 'Handling fee options: 1) Fixed fee (e.g., +$2 per order), 2) Percentage (e.g., +5% of shipping), 3) Per item (e.g., +$0.50 per item). Which type and amount?', 'shipping', 'update', NULL, NULL),
('enable local pickup', 'suggestion', 'admin_ai', 'Enabled "Local Pickup" option. Rate: Free. Customers select this at checkout and pick up at your location. Add your pickup address and hours in the description for customers.', 'shipping', 'create', NULL, NULL),
('show shipping statistics', 'suggestion', 'admin_ai', 'Shipping stats last 30 days: {orders} orders shipped, average shipping cost: ${avg}, most used method: {top_method}. Zones: {zone_breakdown}. Free shipping used: {free_percent}%.', 'shipping', 'read', NULL, NULL),
('mark product as no shipping required', 'suggestion', 'admin_ai', 'Which product is digital/virtual and needs no shipping? I''ll mark it as "no shipping" and it won''t add shipping costs at checkout. Good for: digital downloads, gift cards, services.', 'product', 'update', NULL, NULL),
('set delivery time estimate', 'suggestion', 'admin_ai', 'Which shipping method? Delivery estimates show at checkout (e.g., "Delivery in 3-5 business days"). Accurate estimates improve customer satisfaction. What''s the typical delivery time?', 'shipping', 'update', NULL, NULL),
('add shipping insurance option', 'suggestion', 'admin_ai', 'Created optional shipping insurance. Customers can add at checkout. Rate options: 1) Fixed (e.g., $2.99), 2) Percentage of order (e.g., 2%). What rate and coverage description?', 'shipping', 'create', NULL, NULL),
('connect to carrier API for real rates', 'suggestion', 'admin_ai', 'We can connect to carrier APIs for real-time rates. Supported: UPS, FedEx, DHL, USPS, and local carriers. You''ll need API credentials from the carrier. Which carrier to set up?', 'shipping', 'update', NULL, NULL),
('set dimensional weight for shipping', 'suggestion', 'admin_ai', 'Dimensional weight calculation uses package dimensions when they result in higher shipping than actual weight. Set your dimensional factor (typically 139 for imperial, 5000 for metric). Products need length, width, height set.', 'shipping', 'update', NULL, NULL),
('exclude products from free shipping', 'suggestion', 'admin_ai', 'Which products should be excluded from free shipping? Common exclusions: oversized items, heavy products, special handling required. These products will always charge shipping.', 'product', 'update', NULL, NULL),
('set up table rate shipping', 'suggestion', 'admin_ai', 'Table rate shipping uses conditions for different rates. Conditions: weight, cart total, item count, destination. Example: <$50: $5.99, $50-100: $3.99, >$100: free. What conditions should I set up?', 'shipping', 'create', NULL, NULL),
('duplicate shipping method for new zone', 'suggestion', 'admin_ai', 'Which shipping method to duplicate and for which zone? I''ll copy the settings (name, rate type) and you can adjust the rate for the new zone.', 'shipping', 'create', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 7: INVENTORY (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('show low stock products', 'suggestion', 'admin_ai', 'Found {count} products below low stock threshold ({threshold} units): {product_list}. These need restocking soon. Actions: 1) Export for reorder, 2) Hide from store, 3) Increase threshold for earlier alerts.', 'inventory', 'read', NULL, NULL),
('show out of stock products', 'suggestion', 'admin_ai', 'Found {count} products out of stock. {hidden_count} are hidden from store. {backorder_count} allow backorders. Missing sales estimate: ${estimate}. Would you like to: update stock, enable backorders, or hide these products?', 'inventory', 'read', NULL, NULL),
('update stock for SKU-123 to 50', 'suggestion', 'admin_ai', 'Done! Updated SKU-123 stock from {old} to 50 units. Product is now {status}. Inventory log updated with this adjustment.', 'inventory', 'update', NULL, NULL),
('add 100 units to product SKU-456', 'suggestion', 'admin_ai', 'Added 100 units to SKU-456. New stock level: {new_total} (was {old}). Product status: In Stock. Would you like to add a note for this stock receipt (e.g., "Shipment from supplier X")?', 'inventory', 'update', NULL, NULL),
('reduce stock by 10 for damaged items', 'suggestion', 'admin_ai', 'Which product/SKU? I''ll reduce stock by 10 and log it as "Damaged goods adjustment". This creates an audit trail for inventory discrepancies.', 'inventory', 'update', NULL, NULL),
('set low stock threshold to 10', 'suggestion', 'admin_ai', 'Done! Low stock alerts will now trigger when products fall below 10 units. Currently {count} products below new threshold. Would you like to: apply to all products, or specific categories only?', 'inventory', 'update', NULL, NULL),
('enable backorders for product', 'suggestion', 'admin_ai', 'Which product? Enabling backorders allows customers to purchase even when stock is 0. They''ll see "Ships in X days" message. What lead time should I display?', 'inventory', 'update', NULL, NULL),
('hide products when out of stock', 'suggestion', 'admin_ai', 'Setting: hide products when stock reaches 0. Options: 1) All products, 2) Specific categories, 3) Only non-backorder products. Products auto-show when restocked.', 'inventory', 'update', NULL, NULL),
('import stock from CSV', 'suggestion', 'admin_ai', 'I can update stock levels from a CSV file. Required columns: SKU, stock_quantity. Optional: add/set mode, notes. Upload your CSV and I''ll preview the changes before applying.', 'inventory', 'update', NULL, NULL),
('export current stock levels', 'suggestion', 'admin_ai', 'Exporting inventory report. Includes: SKU, product name, current stock, low stock threshold, status. Options: all products, low stock only, or by category. Which export do you need?', 'inventory', 'read', NULL, NULL),
('show inventory history for SKU-123', 'suggestion', 'admin_ai', 'Stock history for SKU-123: {history_list}. Shows all adjustments: sales, returns, manual changes, imports. Useful for: auditing, understanding patterns, identifying issues.', 'inventory', 'read', NULL, NULL),
('set stock for all variants', 'suggestion', 'admin_ai', 'Which product? I''ll set the same stock level for all variants (all sizes, colors, etc.). Current variants: {variant_count}. What stock level for each?', 'inventory', 'update', NULL, NULL),
('reserve stock for order', 'suggestion', 'admin_ai', 'Stock reservation settings: 1) Reserve on add-to-cart (holds stock while shopping), 2) Reserve on checkout start, 3) Reserve on payment confirmation. Currently: {current_setting}. Change to?', 'inventory', 'update', NULL, NULL),
('show inventory value', 'suggestion', 'admin_ai', 'Total inventory value: ${total} based on cost prices. By category: {breakdown}. Units in stock: {units}. Value at risk (low stock): ${low_stock_value}. Export for financial reporting?', 'inventory', 'read', NULL, NULL),
('sync inventory from external system', 'suggestion', 'admin_ai', 'Inventory sync options: 1) Manual CSV import, 2) API integration (connect your system), 3) Scheduled sync from Akeneo/ERP. Currently configured: {current}. What would you like to set up?', 'inventory', 'update', NULL, NULL),
('adjust inventory for stocktake', 'suggestion', 'admin_ai', 'Starting stocktake mode. I''ll help reconcile physical counts with system. Options: 1) Full stocktake (all products), 2) Partial (specific location/category), 3) Cycle count (random sample).', 'inventory', 'update', NULL, NULL),
('transfer stock between locations', 'suggestion', 'admin_ai', 'Stock transfer: From which location to which? Enter: SKU, quantity, source location, destination. Transfer will be logged and both locations'' stock updated.', 'inventory', 'update', NULL, NULL),
('set reorder point for products', 'suggestion', 'admin_ai', 'Reorder points trigger alerts when stock falls below a level. Set individually or by formula (e.g., average daily sales × lead time + safety stock). Which approach?', 'inventory', 'update', NULL, NULL),
('show dead stock', 'suggestion', 'admin_ai', 'Dead stock: products with inventory but no sales in {period}. Found {count} products totaling ${value}. Consider: clearance sale, bundle offers, donation, write-off. Export list?', 'inventory', 'read', NULL, NULL),
('bulk update stock levels', 'suggestion', 'admin_ai', 'Bulk stock update options: 1) Set all to specific number, 2) Increase/decrease by amount, 3) Set by formula (e.g., +20%), 4) Import from file. What would you like to do?', 'inventory', 'update', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 8: ANALYTICS (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('what are my top selling products', 'suggestion', 'admin_ai', 'Your top selling products can be viewed in Dashboard > Analytics > Products. This shows products ranked by units sold, revenue generated, and conversion rate. You can filter by date range to see trends.', 'analytics', 'read', NULL, NULL),
('show me sales report for last month', 'suggestion', 'admin_ai', 'Navigate to Dashboard > Analytics > Sales. Select "Last Month" from the date picker. You''ll see total revenue, order count, average order value, and daily breakdown chart.', 'analytics', 'read', NULL, NULL),
('how do I track conversion rates', 'suggestion', 'admin_ai', 'Conversion tracking is in Dashboard > Analytics > Conversion. It shows visitor-to-cart rate, cart-to-checkout rate, and checkout-to-purchase rate. Enable enhanced tracking in Settings > Analytics for detailed funnel analysis.', 'analytics', 'read', NULL, NULL),
('where can I see customer acquisition data', 'suggestion', 'admin_ai', 'Customer acquisition metrics are in Dashboard > Analytics > Customers. See new vs returning customers, acquisition channels, and customer lifetime value. Connect Google Analytics for detailed traffic source attribution.', 'analytics', 'read', NULL, NULL),
('export sales data to csv', 'suggestion', 'admin_ai', 'Go to Dashboard > Analytics > Sales, select your date range, then click the "Export" button in the top right. Choose CSV format. The export includes order ID, date, customer, products, and totals.', 'analytics', 'read', NULL, NULL),
('what is my average order value', 'suggestion', 'admin_ai', 'Your Average Order Value (AOV) is displayed on the main Dashboard and in Analytics > Sales. AOV = Total Revenue / Number of Orders. Track this metric to measure upselling and cross-selling effectiveness.', 'analytics', 'read', NULL, NULL),
('show abandoned cart analytics', 'suggestion', 'admin_ai', 'Abandoned cart data is in Dashboard > Analytics > Carts. See abandonment rate, cart value distribution, and common exit points. Use this data to optimize checkout and set up recovery emails.', 'analytics', 'read', NULL, NULL),
('how do I compare sales between periods', 'suggestion', 'admin_ai', 'In Analytics > Sales, enable "Compare" mode and select two date ranges. You''ll see side-by-side metrics with percentage change indicators for revenue, orders, and AOV.', 'analytics', 'read', NULL, NULL),
('track product performance by category', 'suggestion', 'admin_ai', 'Go to Analytics > Products and group by category using the dropdown filter. See which categories drive the most revenue, have highest margins, and best conversion rates.', 'analytics', 'read', NULL, NULL),
('where do I see refund statistics', 'suggestion', 'admin_ai', 'Refund data is in Analytics > Orders > Refunds tab. View refund rate, total refunded amount, and common refund reasons. High refund rates may indicate product quality or description issues.', 'analytics', 'read', NULL, NULL),
('show revenue by traffic source', 'suggestion', 'admin_ai', 'Revenue by traffic source requires Google Analytics integration. Go to Settings > Integrations > Analytics, connect your GA4 property, then view in Analytics > Attribution.', 'analytics', 'read', NULL, NULL),
('what products have the highest margin', 'suggestion', 'admin_ai', 'Product margins are calculated from cost price vs selling price. View in Analytics > Products, sort by "Margin %" column. Ensure you''ve set cost prices in product settings for accurate data.', 'analytics', 'read', NULL, NULL),
('how do I track inventory turnover', 'suggestion', 'admin_ai', 'Inventory turnover is in Analytics > Inventory. It shows how quickly stock sells (turnover rate = units sold / average inventory). High turnover means efficient inventory; low may indicate overstocking.', 'analytics', 'read', NULL, NULL),
('see customer lifetime value report', 'suggestion', 'admin_ai', 'CLV data is in Analytics > Customers > Lifetime Value. See average CLV, CLV by acquisition channel, and CLV trends over time. Use this to determine how much to spend on customer acquisition.', 'analytics', 'read', NULL, NULL),
('show me hourly sales patterns', 'suggestion', 'admin_ai', 'Hourly patterns are in Analytics > Sales > Time Analysis. See which hours generate most orders. Use this data to time promotions, flash sales, and marketing campaigns for maximum impact.', 'analytics', 'read', NULL, NULL),
('track search terms customers use', 'suggestion', 'admin_ai', 'Search analytics are in Analytics > Search. See what customers search for, which searches return no results, and search-to-purchase conversion. Add products or synonyms for popular no-result searches.', 'analytics', 'read', NULL, NULL),
('how do I set up custom reports', 'suggestion', 'admin_ai', 'Custom reports are in Analytics > Custom Reports > Create New. Select metrics, dimensions, filters, and visualization type. Save reports for quick access and schedule email delivery.', 'analytics', 'read', NULL, NULL),
('export all analytics data', 'suggestion', 'admin_ai', 'For bulk export, go to Analytics > Export Center. Select data types (sales, products, customers), date range, and format (CSV, Excel, JSON). Large exports are processed in background and emailed when ready.', 'analytics', 'read', NULL, NULL),
('show product views vs purchases', 'suggestion', 'admin_ai', 'Product conversion funnel is in Analytics > Products > Conversion. See views, add-to-carts, and purchases for each product. Low view-to-cart rate may indicate pricing or description issues.', 'analytics', 'read', NULL, NULL),
('track coupon usage analytics', 'suggestion', 'admin_ai', 'Coupon performance is in Analytics > Marketing > Coupons. See usage count, revenue generated, average discount given, and ROI for each coupon code.', 'analytics', 'read', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 9: SETTINGS (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('how do I change store currency', 'needs_confirmation', 'admin_ai', 'Changing store currency is in Settings > General > Currency. WARNING: This affects all prices and should only be done for new stores. For existing stores with orders, consider using multi-currency instead. This action requires confirmation.', 'settings', 'update', NULL, NULL),
('update store contact information', 'suggestion', 'admin_ai', 'Go to Settings > Store Info > Contact. Update email, phone, address. This information appears in emails, invoices, and the contact page. Changes take effect immediately.', 'settings', 'update', NULL, NULL),
('change store timezone', 'suggestion', 'admin_ai', 'Timezone settings are in Settings > General > Localization. This affects order timestamps, scheduled content, and analytics date grouping. Existing data isn''t modified, only new entries use the new timezone.', 'settings', 'update', NULL, NULL),
('enable maintenance mode', 'suggestion', 'admin_ai', 'Maintenance mode is in Settings > General > Store Status. Enable it to show a "We''ll be back soon" page to visitors while you make changes. Admin users can still access the store normally.', 'settings', 'update', NULL, NULL),
('configure tax settings', 'suggestion', 'admin_ai', 'Tax configuration is in Settings > Taxes. Set up tax rates by country/region, enable tax-inclusive pricing, and configure tax exemptions. For EU stores, enable automatic VAT rates for each country.', 'settings', 'update', NULL, NULL),
('set up multi-language store', 'suggestion', 'admin_ai', 'Multi-language setup is in Settings > Languages. Add languages, set default language, and configure language switcher display. Then use Translations section to translate content for each language.', 'settings', 'update', NULL, NULL),
('change default country for checkout', 'suggestion', 'admin_ai', 'Default checkout country is in Settings > Checkout > Address. This pre-selects the country in checkout forms. Set to your primary market for better UX.', 'settings', 'update', NULL, NULL),
('configure order number format', 'suggestion', 'admin_ai', 'Order number format is in Settings > Orders > Numbering. Customize prefix (e.g., "ORD-"), starting number, and include date. Example: ORD-2024-00001. Changes only affect new orders.', 'settings', 'update', NULL, NULL),
('update legal pages', 'suggestion', 'admin_ai', 'Legal pages (Terms, Privacy, Returns) are in CMS > Pages. Select the page and edit content. Ensure these are linked in your footer and checkout for compliance.', 'settings', 'update', NULL, NULL),
('set up email notifications', 'suggestion', 'admin_ai', 'Email settings are in Settings > Notifications. Configure which events trigger emails (new order, shipping, etc.), customize templates, and set sender name/email. Test emails before going live.', 'settings', 'update', NULL, NULL),
('configure inventory settings', 'suggestion', 'admin_ai', 'Inventory behavior is in Settings > Inventory. Options include: allow backorders, low stock threshold, hide out-of-stock products, reserve stock on add-to-cart vs checkout.', 'settings', 'update', NULL, NULL),
('change store logo', 'suggestion', 'admin_ai', 'Logo settings are in Settings > Branding > Logo. Upload your logo in PNG or SVG format. Recommended sizes: header logo 200x50px, favicon 32x32px. The logo appears in header and emails.', 'settings', 'update', NULL, NULL),
('configure checkout fields', 'suggestion', 'admin_ai', 'Checkout customization is in Settings > Checkout > Fields. Enable/disable fields like company name, phone, add custom fields. Mark fields as required or optional based on your needs.', 'settings', 'update', NULL, NULL),
('set minimum order amount', 'suggestion', 'admin_ai', 'Minimum order is in Settings > Checkout > Restrictions. Set minimum cart value required to checkout. Useful for wholesale stores or to ensure profitability with shipping costs.', 'settings', 'update', NULL, NULL),
('enable guest checkout', 'suggestion', 'admin_ai', 'Guest checkout toggle is in Settings > Checkout > Account. When enabled, customers can checkout without creating an account. Reduces friction but limits customer data collection.', 'settings', 'update', NULL, NULL),
('configure product review settings', 'suggestion', 'admin_ai', 'Review settings are in Settings > Products > Reviews. Options: enable/disable reviews, require moderation, allow only verified buyers, enable star ratings, set minimum review length.', 'settings', 'update', NULL, NULL),
('set up social media links', 'suggestion', 'admin_ai', 'Social links are in Settings > Store Info > Social. Add URLs for Facebook, Instagram, Twitter, etc. These appear in the footer and can be used in email templates.', 'settings', 'update', NULL, NULL),
('configure password requirements', 'suggestion', 'admin_ai', 'Password policy is in Settings > Security > Passwords. Set minimum length, require special characters, numbers, uppercase. Stronger requirements improve security but may increase registration friction.', 'settings', 'update', NULL, NULL),
('enable two-factor authentication', 'suggestion', 'admin_ai', 'Admin 2FA is in Settings > Security > Two-Factor. When enabled, admin users must verify with authenticator app when logging in. Highly recommended for security.', 'settings', 'update', NULL, NULL),
('reset store to default settings', 'needs_confirmation', 'admin_ai', 'To reset store settings, go to Settings > Advanced > Reset. This will restore all settings to default values. WARNING: This cannot be undone. Products and orders are NOT affected, only configuration settings.', 'settings', 'update', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 10: SEO (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('how do I improve product SEO', 'suggestion', 'admin_ai', 'For product SEO: 1) Write unique meta titles (50-60 chars) including product name and key attribute. 2) Write compelling meta descriptions (150-160 chars). 3) Use descriptive URLs. 4) Add alt text to images. 5) Write detailed product descriptions with relevant keywords.', 'seo', 'update', NULL, NULL),
('set meta title for product', 'suggestion', 'admin_ai', 'Edit the product, scroll to SEO section. Enter a custom meta title (50-60 characters). Include product name, key feature, and brand. Example: "Blue Cotton T-Shirt | Premium Quality | YourBrand"', 'seo', 'update', NULL, NULL),
('write meta description for category', 'suggestion', 'admin_ai', 'Edit the category, go to SEO tab. Write 150-160 character description that includes the category name and entices clicks. Example: "Shop our collection of premium cotton t-shirts. Free shipping over $50. New arrivals weekly."', 'seo', 'update', NULL, NULL),
('customize product URL slug', 'suggestion', 'admin_ai', 'In product edit, scroll to SEO section, find URL/Slug field. Use lowercase, hyphens between words, include key terms. Example: "blue-premium-cotton-tshirt" instead of "product-12345"', 'seo', 'update', NULL, NULL),
('add image alt text', 'suggestion', 'admin_ai', 'When uploading product images, fill in the Alt Text field. Describe the image including product name and key details. Example: "Blue cotton t-shirt front view with logo" - helps SEO and accessibility.', 'seo', 'update', NULL, NULL),
('set up 301 redirects', 'suggestion', 'admin_ai', 'Redirects are in Settings > SEO > Redirects. Add old URL and new URL to create 301 redirect. Essential when changing product URLs or removing products to avoid 404 errors and preserve SEO value.', 'seo', 'update', NULL, NULL),
('configure robots.txt', 'suggestion', 'admin_ai', 'Robots.txt settings are in Settings > SEO > Robots. Default settings block admin, cart, and checkout from crawling. Customize if needed but be careful not to block important pages.', 'seo', 'update', NULL, NULL),
('generate sitemap', 'suggestion', 'admin_ai', 'Your sitemap auto-generates at /sitemap.xml. Configure in Settings > SEO > Sitemap. Choose which content types to include, update frequency hints, and priority values. Submit to Google Search Console.', 'seo', 'update', NULL, NULL),
('add structured data to products', 'suggestion', 'admin_ai', 'Product structured data (Schema.org) is automatic when you fill in all product details: name, description, price, SKU, availability, images, brand, reviews. Check with Google Rich Results Test tool.', 'seo', 'update', NULL, NULL),
('set canonical URLs', 'suggestion', 'admin_ai', 'Canonical URLs are auto-generated. For products in multiple categories, the canonical points to the primary URL. Override in product SEO settings if needed. Prevents duplicate content issues.', 'seo', 'update', NULL, NULL),
('optimize page load speed', 'suggestion', 'admin_ai', 'For speed: 1) Compress images before upload or enable auto-optimization. 2) Enable lazy loading in Settings > Performance. 3) Minimize custom code. 4) Use system fonts when possible. Check with PageSpeed Insights.', 'seo', 'update', NULL, NULL),
('fix duplicate content issues', 'suggestion', 'admin_ai', 'Duplicate content usually comes from: products in multiple categories (use canonicals), filter/sort URL parameters (configure in SEO settings to add noindex), similar product descriptions (make unique).', 'seo', 'update', NULL, NULL),
('set homepage meta tags', 'suggestion', 'admin_ai', 'Homepage SEO is in Settings > SEO > Homepage. Set meta title (your store name + tagline), meta description (what you sell, USP, call to action). This is critical as it''s often your most visited page.', 'seo', 'update', NULL, NULL),
('add hreflang for multi-language', 'suggestion', 'admin_ai', 'Hreflang tags auto-generate when you have multiple languages enabled. Verify in page source that each language version links to others. This tells search engines which language version to show users.', 'seo', 'update', NULL, NULL),
('optimize category pages for SEO', 'suggestion', 'admin_ai', 'Category SEO tips: 1) Write unique category descriptions (not just product lists). 2) Use H1 with category name. 3) Add relevant long-tail keywords. 4) Include internal links to related categories. 5) Optimize images.', 'seo', 'update', NULL, NULL),
('check for broken links', 'suggestion', 'admin_ai', 'Use the Link Checker tool in Settings > SEO > Tools. It scans all pages for broken internal and external links. Fix broken links promptly as they hurt UX and SEO.', 'seo', 'update', NULL, NULL),
('set up Google Search Console', 'suggestion', 'admin_ai', 'Go to Settings > Integrations > Search Console. Add your property verification code (HTML tag method recommended). Once verified, submit your sitemap and monitor search performance.', 'seo', 'update', NULL, NULL),
('configure Open Graph tags', 'suggestion', 'admin_ai', 'Open Graph (social sharing) tags are in product/page SEO sections. Set og:title, og:description, og:image for how content appears when shared on Facebook, LinkedIn. Twitter uses these too.', 'seo', 'update', NULL, NULL),
('optimize for local SEO', 'suggestion', 'admin_ai', 'For local SEO: 1) Add complete address in Settings > Store Info. 2) Create Google Business Profile. 3) Add LocalBusiness structured data. 4) Get listed in local directories. 5) Encourage customer reviews.', 'seo', 'update', NULL, NULL),
('remove outdated pages from Google', 'suggestion', 'admin_ai', 'To remove pages from Google: 1) Delete or 301 redirect the page. 2) Use Google Search Console Removals tool for urgent cases. 3) Add noindex tag if page should exist but not be indexed. Allow time for crawling.', 'seo', 'update', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 11: TRANSLATIONS (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('how do I translate product names', 'suggestion', 'admin_ai', 'Go to Products > select product > Translations tab. You''ll see each enabled language. Click a language to enter translated name, description, and SEO fields. Save changes for each language.', 'translation', 'update', NULL, NULL),
('add a new language to store', 'suggestion', 'admin_ai', 'Go to Settings > Languages > Add Language. Select from available languages, set as active, configure URL format (/en/, /de/ or subdomain). Then translate content via Translations section.', 'translation', 'create', NULL, NULL),
('translate category descriptions', 'suggestion', 'admin_ai', 'Categories > select category > Translations tab. Enter translated name and description for each language. Don''t forget to translate SEO meta title and description too for search visibility.', 'translation', 'update', NULL, NULL),
('bulk translate products', 'suggestion', 'admin_ai', 'For bulk translation: 1) Export products to CSV with translation columns. 2) Translate content (use professional service or AI). 3) Import back with language-specific columns. Much faster than one-by-one.', 'translation', 'update', NULL, NULL),
('set default language', 'suggestion', 'admin_ai', 'Settings > Languages > drag to reorder or click "Set as Default". The default language is shown when no language is detected from browser or URL. Also used as fallback when translation is missing.', 'translation', 'update', NULL, NULL),
('translate checkout page', 'suggestion', 'admin_ai', 'Checkout translations are in Translations > System > Checkout. Translate button text, form labels, error messages, and order summary labels. Test the full checkout flow in each language.', 'translation', 'update', NULL, NULL),
('translate email templates', 'suggestion', 'admin_ai', 'Email translations are in Settings > Notifications > select template > Translations tab. Translate subject line and body content. Use the same variables (like {{order_number}}) in all languages.', 'translation', 'update', NULL, NULL),
('missing translations showing', 'suggestion', 'admin_ai', 'When translations are missing, the default language text shows. To find missing translations: Translations > Filter by "Missing" status. This lists all content needing translation for each language.', 'translation', 'read', NULL, NULL),
('translate navigation menu', 'suggestion', 'admin_ai', 'Navigation translations are in Layout > Navigation > select menu > Translations. Translate each menu item label. Link targets (URLs) may also need language-specific versions.', 'translation', 'update', NULL, NULL),
('configure language switcher', 'suggestion', 'admin_ai', 'Language switcher settings are in Settings > Languages > Display. Options: show as dropdown, flags, text codes. Position in header via Layout settings. Enable/disable on mobile separately.', 'translation', 'update', NULL, NULL),
('translate static pages', 'suggestion', 'admin_ai', 'CMS > Pages > select page > Translations tab. Translate title, content, and SEO fields. For complex pages with slots, each slot content needs translation in its own settings.', 'translation', 'update', NULL, NULL),
('auto-detect customer language', 'suggestion', 'admin_ai', 'Language detection is in Settings > Languages > Detection. Options: browser preference, geo-IP, URL path, or cookie. Browser preference is recommended as it respects user settings.', 'translation', 'update', NULL, NULL),
('translate product attributes', 'suggestion', 'admin_ai', 'Attributes like size, color labels need translation. Go to Products > Attributes > select attribute > Translations. Translate attribute name and all option values for each language.', 'translation', 'update', NULL, NULL),
('export translations for review', 'suggestion', 'admin_ai', 'Translations > Export. Select languages and content types. Downloads as XLIFF or CSV. Send to translator, then import back. XLIFF format preserves context and is translator-friendly.', 'translation', 'read', NULL, NULL),
('translate footer content', 'suggestion', 'admin_ai', 'Footer translations depend on content type: Links are in Layout > Footer > Translations. Text blocks in CMS. Contact info in Settings > Store Info has language versions.', 'translation', 'update', NULL, NULL),
('rtl language support', 'suggestion', 'admin_ai', 'RTL languages (Arabic, Hebrew) are auto-detected. The theme flips layout automatically. Test thoroughly as some custom CSS may need RTL adjustments. Enable in Settings > Languages > RTL Support.', 'translation', 'update', NULL, NULL),
('translate error messages', 'suggestion', 'admin_ai', 'System error messages are in Translations > System > Errors. Translate validation messages, 404 text, cart errors, checkout errors. Use friendly language that helps customers resolve issues.', 'translation', 'update', NULL, NULL),
('translate search placeholder', 'suggestion', 'admin_ai', 'Search box text is in Translations > System > Search. Translate placeholder text, "No results" message, and search suggestions. Good UX to use language-appropriate placeholder like "Zoeken..." for Dutch.', 'translation', 'update', NULL, NULL),
('remove a language', 'needs_confirmation', 'admin_ai', 'Settings > Languages > select language > Delete. WARNING: This removes all translations for that language permanently. Content isn''t deleted but translations are lost. Export translations first as backup.', 'translation', 'delete', NULL, NULL),
('translate coupon messages', 'suggestion', 'admin_ai', 'Coupon-related text is in Translations > System > Cart. Translate "Coupon applied", "Invalid coupon", "Coupon expired" and similar messages for each active language.', 'translation', 'update', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 12: CMS PAGES (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('create a new cms page', 'suggestion', 'admin_ai', 'Go to CMS > Pages > Create New. Enter page title, URL slug, and content. Choose template (standard, full-width, sidebar). Set visibility and add to navigation if needed.', 'cms_page', 'create', NULL, NULL),
('edit homepage content', 'suggestion', 'admin_ai', 'The homepage is in CMS > Pages > Homepage (or marked with home icon). Edit content blocks, reorder sections using drag-and-drop, update hero images and text. Preview before publishing.', 'cms_page', 'update', NULL, NULL),
('add faq page', 'suggestion', 'admin_ai', 'CMS > Pages > Create. Name it "FAQ", use the FAQ template if available, or add accordion slot for expandable Q&A sections. Structure with categories for easy navigation.', 'cms_page', 'create', NULL, NULL),
('delete a cms page', 'needs_confirmation', 'admin_ai', 'CMS > Pages > select page > Delete. This permanently removes the page. Check that no navigation menus link to it first. Consider unpublishing instead if you might need it later.', 'cms_page', 'delete', NULL, NULL),
('duplicate a page', 'suggestion', 'admin_ai', 'CMS > Pages > select page > Actions > Duplicate. Creates a copy with "(Copy)" suffix. Edit the duplicate to customize. Useful for creating similar landing pages or seasonal variants.', 'cms_page', 'create', NULL, NULL),
('schedule page publication', 'suggestion', 'admin_ai', 'When editing a page, go to Settings tab > Schedule. Set publish date/time and optional unpublish date. Great for seasonal content, promotions, or coordinated launches.', 'cms_page', 'update', NULL, NULL),
('add page to navigation', 'suggestion', 'admin_ai', 'Two options: 1) In page settings, toggle "Add to Navigation" and select menu. 2) Go to Layout > Navigation > edit menu > Add Item > select the CMS page. Second option gives more control over position.', 'cms_page', 'update', NULL, NULL),
('set page as 404 error page', 'suggestion', 'admin_ai', 'CMS > Pages > create or edit page > Settings > Set as 404 Page. Design a helpful 404 that includes search, popular links, and a way to contact support. Make it on-brand.', 'cms_page', 'update', NULL, NULL),
('password protect a page', 'suggestion', 'admin_ai', 'CMS > Pages > edit page > Settings > Access Control > Password Protected. Set a password. Visitors must enter password to view. Good for wholesale pricing or member content.', 'cms_page', 'update', NULL, NULL),
('create landing page for campaign', 'suggestion', 'admin_ai', 'CMS > Pages > Create. Use full-width template, design with hero section, product highlights, testimonials, and CTA. Set custom URL slug for easy sharing in campaigns.', 'cms_page', 'create', NULL, NULL),
('add contact form to page', 'suggestion', 'admin_ai', 'Edit the page, add a Form slot. Select "Contact Form" template or build custom with fields (name, email, message). Configure email notification for submissions.', 'cms_page', 'update', NULL, NULL),
('embed video on page', 'suggestion', 'admin_ai', 'Edit the page, add a Video slot. Paste YouTube or Vimeo URL - it auto-embeds. For self-hosted, upload via Media library. Set autoplay, loop, and mute options as needed.', 'cms_page', 'update', NULL, NULL),
('show products on cms page', 'suggestion', 'admin_ai', 'Add a Product Grid slot to the page. Configure: select specific products, show category, or use filters (bestsellers, new arrivals). Set grid columns and products per page.', 'cms_page', 'update', NULL, NULL),
('create about us page', 'suggestion', 'admin_ai', 'CMS > Pages > Create "About Us". Include: company story, team photos, mission/values, achievements/trust badges. Add image slot for team photos, text slots for narrative. Link in footer.', 'cms_page', 'create', NULL, NULL),
('add banner to page', 'suggestion', 'admin_ai', 'Edit page, add Image slot or Banner slot. Upload banner image, set alt text, optional link. For promotional banners, include start/end dates for automatic visibility control.', 'cms_page', 'update', NULL, NULL),
('create size guide page', 'suggestion', 'admin_ai', 'CMS > Pages > Create "Size Guide". Add table slot with measurements, image slot for how-to-measure diagram. Link from product pages via custom field or slot.', 'cms_page', 'create', NULL, NULL),
('set page meta description', 'suggestion', 'admin_ai', 'Edit page > SEO tab. Write meta description (150-160 chars) that describes page content and entices clicks from search results. Include relevant keywords naturally.', 'cms_page', 'update', NULL, NULL),
('make page only visible to logged in', 'suggestion', 'admin_ai', 'CMS > Pages > edit page > Settings > Access Control > Logged In Users Only. Redirects guests to login page. Good for member-only content or wholesale catalogs.', 'cms_page', 'update', NULL, NULL),
('clone page for different language', 'suggestion', 'admin_ai', 'Duplicate the page, then edit translations. Alternatively, edit original page > Translations tab to translate content directly. Both approaches work; first is good for different layouts per language.', 'cms_page', 'create', NULL, NULL),
('revert page to previous version', 'suggestion', 'admin_ai', 'CMS > Pages > edit page > History tab. See all saved versions with timestamps. Click a version to preview, then "Restore" to revert. Current version is auto-saved as new history entry.', 'cms_page', 'update', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 13: LAYOUT & SLOTS (20 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('add slot below add to cart button', 'suggestion', 'admin_ai', 'Go to Layout > Product Page > find "Add to Cart" section. Click "Add Slot Below". Choose slot type (text, image, component). Common additions: trust badges, delivery info, review widget.', 'slot', 'create', NULL, NULL),
('create a new slot on product page', 'suggestion', 'admin_ai', 'Layout > Product Page editor. Click "+" between existing sections to add slot. Select type: text (rich content), image, button, component (custom widget), or container (group of slots).', 'slot', 'create', NULL, NULL),
('move slot to different position', 'suggestion', 'admin_ai', 'In Layout editor, drag the slot handle (six dots icon) to new position. Drop between other slots or sections. Changes preview immediately; save to apply. Mobile positions can be set separately.', 'slot', 'update', NULL, NULL),
('hide slot on mobile', 'suggestion', 'admin_ai', 'Select the slot in Layout editor > Settings (gear icon) > Visibility tab. Toggle "Hide on Mobile". Useful for complex elements that don''t work on small screens.', 'slot', 'update', NULL, NULL),
('add product reviews section', 'suggestion', 'admin_ai', 'Layout > Product Page > Add Slot > Component type > select "Product Reviews" component. Position below product description or in tabs. Displays reviews and review form.', 'slot', 'create', NULL, NULL),
('add trust badges to footer', 'suggestion', 'admin_ai', 'Layout > Footer > Add Image Slot. Upload payment icons, security badges, or trust seals. Set as row layout for horizontal display. Link badges to relevant verification pages.', 'slot', 'create', NULL, NULL),
('create custom header announcement', 'suggestion', 'admin_ai', 'Layout > Header > Add Slot above main header. Create text slot for announcement bar (free shipping, sale, etc). Style with background color. Set auto-dismiss or closeable option.', 'slot', 'create', NULL, NULL),
('add related products section', 'suggestion', 'admin_ai', 'Layout > Product Page > Add Slot > Component > "Related Products". Configure: show manual selections, same category, or AI-recommended. Set number of products and grid layout.', 'slot', 'create', NULL, NULL),
('delete a slot', 'needs_confirmation', 'admin_ai', 'Select the slot in Layout editor > click delete icon (trash). Confirm deletion. The slot and its content are removed. Consider hiding instead if you might need it later.', 'slot', 'delete', NULL, NULL),
('duplicate a slot', 'suggestion', 'admin_ai', 'Select slot > Actions menu > Duplicate. Creates copy with same settings and content. Useful for creating variations or reusing complex configurations.', 'slot', 'create', NULL, NULL),
('add countdown timer slot', 'suggestion', 'admin_ai', 'Add Slot > Component > "Countdown Timer". Set end date/time, action when expired (hide, show message). Use for sales, launches, or limited offers to create urgency.', 'slot', 'create', NULL, NULL),
('configure slot spacing', 'suggestion', 'admin_ai', 'Select slot > Settings > Spacing tab. Set margin (outside space) and padding (inside space) for top, right, bottom, left. Use consistent spacing for professional look.', 'slot', 'update', NULL, NULL),
('add custom html slot', 'suggestion', 'admin_ai', 'Add Slot > HTML type. Enter custom HTML code. Use for: embed codes, custom widgets, third-party integrations. JavaScript is sanitized for security; use Component type for complex scripts.', 'slot', 'create', NULL, NULL),
('create container for grouped slots', 'suggestion', 'admin_ai', 'Add Slot > Container type. Set layout (columns, rows, grid). Add child slots inside container. Containers help organize related elements and control their collective positioning/styling.', 'slot', 'create', NULL, NULL),
('set slot background color', 'suggestion', 'admin_ai', 'Select slot > Settings > Style tab > Background. Choose color from palette, enter hex code, or set image background. Can set different backgrounds for desktop/mobile.', 'slot', 'update', NULL, NULL),
('add newsletter signup to footer', 'suggestion', 'admin_ai', 'Layout > Footer > Add Slot > Component > "Newsletter Signup". Configure: placeholder text, button label, success message. Submissions go to your email list or connected marketing tool.', 'slot', 'create', NULL, NULL),
('reorder product page sections', 'suggestion', 'admin_ai', 'Layout > Product Page. Drag entire sections (images, details, tabs, related) to reorder. Save to apply. Consider mobile-first: key info (price, buy button) should be near top on mobile.', 'slot', 'update', NULL, NULL),
('add breadcrumb to pages', 'suggestion', 'admin_ai', 'Layout > Page Template > Add Slot at top > Component > "Breadcrumb". Auto-generates navigation path. Style in slot settings. Important for UX and SEO on deep page structures.', 'slot', 'create', NULL, NULL),
('configure slot conditions', 'suggestion', 'admin_ai', 'Select slot > Settings > Conditions tab. Show/hide based on: customer group, date range, cart value, product category. Example: show "Free shipping" only when cart > $50.', 'slot', 'update', NULL, NULL),
('add social share buttons', 'suggestion', 'admin_ai', 'Layout > Product Page > Add Slot > Component > "Social Share". Select networks (Facebook, Twitter, Pinterest, Email). Position near product images or below description.', 'slot', 'create', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 14: INTEGRATIONS (25 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('how do I connect Shopify', 'suggestion', 'admin_ai', 'Settings > Integrations > Shopify. Enter your Shopify store URL and create a private app for API credentials. Configure sync settings: products, inventory, orders. Initial sync may take time for large catalogs.', 'integration', 'create', NULL, NULL),
('sync products from Akeneo', 'suggestion', 'admin_ai', 'Settings > Integrations > Akeneo (PIM). Connect with API credentials from your Akeneo instance. Map Akeneo attributes to DainoStore fields. Enable automatic sync or trigger manually. Changes flow from Akeneo to store.', 'integration', 'create', NULL, NULL),
('connect Google Analytics', 'suggestion', 'admin_ai', 'Settings > Integrations > Google Analytics. Add your GA4 Measurement ID (starts with G-). Enable enhanced ecommerce tracking for detailed purchase data. Verify tracking with GA Real-time reports.', 'integration', 'create', NULL, NULL),
('set up payment gateway', 'suggestion', 'admin_ai', 'Settings > Payments > Add Payment Method. Choose provider (Stripe, PayPal, Mollie, etc). Enter API keys from your payment account. Test in sandbox mode before enabling live payments.', 'integration', 'create', NULL, NULL),
('configure Stripe payments', 'suggestion', 'admin_ai', 'Settings > Payments > Stripe. Enter Publishable Key and Secret Key from Stripe Dashboard. Enable card payments, Apple Pay, Google Pay. Configure webhook endpoint for reliable payment status updates.', 'integration', 'update', NULL, NULL),
('connect Mailchimp', 'suggestion', 'admin_ai', 'Settings > Integrations > Mailchimp. Enter API key from Mailchimp account. Select audience/list to sync. Configure: sync customers, sync order history, add to automation triggers.', 'integration', 'create', NULL, NULL),
('integrate with ERP system', 'suggestion', 'admin_ai', 'Settings > Integrations > ERP or use API. Configure sync for inventory levels, orders, and customer data. Set sync frequency. Use webhook events for real-time updates. Test thoroughly before go-live.', 'integration', 'create', NULL, NULL),
('set up Supabase connection', 'suggestion', 'admin_ai', 'DainoStore uses Supabase as its database. Connection is configured via environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY. Each store has its own tenant database for data isolation.', 'integration', 'read', NULL, NULL),
('connect Facebook Pixel', 'suggestion', 'admin_ai', 'Settings > Integrations > Facebook Pixel. Enter your Pixel ID from Facebook Events Manager. Enable standard events: ViewContent, AddToCart, Purchase. Used for ad targeting and conversion tracking.', 'integration', 'create', NULL, NULL),
('configure shipping carrier API', 'suggestion', 'admin_ai', 'Settings > Shipping > Carriers > Add Carrier. Choose carrier (UPS, FedEx, DHL, etc). Enter API credentials. Enable real-time rates, tracking number import, and label printing if available.', 'integration', 'create', NULL, NULL),
('disconnect an integration', 'needs_confirmation', 'admin_ai', 'Settings > Integrations > select integration > Disconnect. This stops sync and removes credentials. Data already synced remains in store. Confirm to proceed. You can reconnect later with same or new credentials.', 'integration', 'delete', NULL, NULL),
('test integration connection', 'suggestion', 'admin_ai', 'Settings > Integrations > select integration > Test Connection. This verifies API credentials work and shows connection status. Fix any errors shown before enabling sync.', 'integration', 'read', NULL, NULL),
('view integration sync logs', 'suggestion', 'admin_ai', 'Settings > Integrations > select integration > Logs tab. See sync history, items processed, errors encountered. Use for troubleshooting sync issues. Logs retained for 30 days.', 'integration', 'read', NULL, NULL),
('configure API webhooks', 'suggestion', 'admin_ai', 'Settings > API > Webhooks. Add endpoint URL and select events (order.created, product.updated, etc). Webhooks send real-time notifications to your external systems when events occur.', 'integration', 'create', NULL, NULL),
('generate API keys', 'suggestion', 'admin_ai', 'Settings > API > Keys > Create New Key. Set name for identification, select permissions (read-only, write, admin). Copy the key immediately - it won''t be shown again. Use for external integrations.', 'integration', 'create', NULL, NULL),
('connect accounting software', 'suggestion', 'admin_ai', 'Settings > Integrations > Accounting (Xero, QuickBooks, etc). Authenticate with your accounting account. Configure invoice sync, payment matching, and tax mapping. Orders auto-post as invoices.', 'integration', 'create', NULL, NULL),
('set up product feed for Google Shopping', 'suggestion', 'admin_ai', 'Settings > Integrations > Google Merchant Center. Connect your Merchant account. Products auto-generate feed in required format. Ensure products have GTIN, brand, and proper categorization.', 'integration', 'create', NULL, NULL),
('configure ChatGPT Shopping feed', 'suggestion', 'admin_ai', 'Settings > AI Shopping > ChatGPT. Enable the ChatGPT shopping feed. Products must have: GTIN/MPN, brand, detailed descriptions, key highlights. Feed URL is provided to ChatGPT for shopping queries.', 'integration', 'create', NULL, NULL),
('sync inventory with warehouse', 'suggestion', 'admin_ai', 'Settings > Integrations > Warehouse/WMS. Connect via API. Enable two-way sync: stock levels from warehouse to store, orders from store to warehouse for fulfillment. Set sync frequency.', 'integration', 'update', NULL, NULL),
('configure search with Algolia', 'suggestion', 'admin_ai', 'Settings > Integrations > Search > Algolia. Enter App ID and API keys. Index products and categories. Configure searchable attributes, ranking, and facets. Provides fast, typo-tolerant search.', 'integration', 'create', NULL, NULL),
('set up social login', 'suggestion', 'admin_ai', 'Settings > Integrations > Social Login. Configure OAuth for Google, Facebook, Apple. Enter App IDs and secrets from each provider. Reduces checkout friction by enabling one-click sign-in.', 'integration', 'create', NULL, NULL),
('connect reviews platform', 'suggestion', 'admin_ai', 'Settings > Integrations > Reviews (Trustpilot, Yotpo, etc). Enter API credentials. Configure review request timing, display widget, and import existing reviews. Syncs review counts and ratings.', 'integration', 'create', NULL, NULL),
('integrate live chat', 'suggestion', 'admin_ai', 'Settings > Integrations > Live Chat (Intercom, Drift, Zendesk). Add the widget code or connect via API. Configure position, trigger rules, and hours. Chat history syncs with customer profiles.', 'integration', 'create', NULL, NULL),
('configure CDN for images', 'suggestion', 'admin_ai', 'Settings > Performance > CDN. Enter CDN URL (Cloudflare, Fastly, etc). Images automatically serve from CDN with caching. Improves load times especially for international customers.', 'integration', 'update', NULL, NULL),
('set up backup integration', 'suggestion', 'admin_ai', 'Settings > Integrations > Backup. Configure automated backups to external storage (S3, Google Cloud, etc). Set frequency (daily recommended), retention period, and enable encryption.', 'integration', 'create', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 15: EMAIL TEMPLATES (25 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('edit order confirmation email', 'suggestion', 'admin_ai', 'Settings > Notifications > Order Confirmation > Edit. Customize subject line, header, and content. Use variables like {{customer_name}}, {{order_number}}, {{order_items}}. Preview and send test before saving.', 'email', 'update', NULL, NULL),
('customize shipping notification', 'suggestion', 'admin_ai', 'Settings > Notifications > Shipping Confirmation. Edit template to include tracking number ({{tracking_number}}), carrier name, and estimated delivery. Add tracking link for customer convenience.', 'email', 'update', NULL, NULL),
('create abandoned cart email', 'suggestion', 'admin_ai', 'Settings > Notifications > Abandoned Cart > Enable. Set delay (1 hour recommended for first email). Include cart items with images, direct link back to cart, and optional discount code to incentivize completion.', 'email', 'create', NULL, NULL),
('set up welcome email', 'suggestion', 'admin_ai', 'Settings > Notifications > Customer Welcome. Triggered on account creation. Include brand introduction, first purchase discount code, useful links. Make a great first impression.', 'email', 'create', NULL, NULL),
('configure password reset email', 'suggestion', 'admin_ai', 'Settings > Notifications > Password Reset. Keep this simple and secure. Include reset link (expires in 24h), explain they didn''t request it if unexpected, and support contact.', 'email', 'update', NULL, NULL),
('add logo to email templates', 'suggestion', 'admin_ai', 'Settings > Notifications > Email Branding. Upload logo (recommended: 200px wide, PNG). Set header background color, text colors, and footer content. Applied to all email templates.', 'email', 'update', NULL, NULL),
('create order refund email', 'suggestion', 'admin_ai', 'Settings > Notifications > Refund Confirmation. Sent when refund is processed. Include refund amount, reason, timeline for credit to appear. Apologize for inconvenience if applicable.', 'email', 'update', NULL, NULL),
('set sender email address', 'suggestion', 'admin_ai', 'Settings > Notifications > Sender Settings. Set From Name (e.g., "YourStore") and From Email. Email must be from verified domain. Reply-To can be different for customer service routing.', 'email', 'update', NULL, NULL),
('test email template', 'suggestion', 'admin_ai', 'When editing any email template, click "Send Test Email". Enter your email address to receive preview with sample data. Check formatting, links, and mobile rendering.', 'email', 'read', NULL, NULL),
('create back in stock email', 'suggestion', 'admin_ai', 'Settings > Notifications > Back in Stock. Enable the "Notify Me" button on out-of-stock products. Email automatically sends when product is restocked. Include product image and direct link to buy.', 'email', 'create', NULL, NULL),
('customize order invoice email', 'suggestion', 'admin_ai', 'Settings > Notifications > Invoice. Sent with orders or separately on request. Includes order details in invoice format with tax breakdown. Attach PDF invoice option available.', 'email', 'update', NULL, NULL),
('set up review request email', 'suggestion', 'admin_ai', 'Settings > Notifications > Review Request. Triggered X days after delivery (7-14 days recommended). Include product images, direct link to review form. Offer incentive for honest feedback.', 'email', 'create', NULL, NULL),
('configure low stock alert', 'suggestion', 'admin_ai', 'Settings > Notifications > Admin Alerts > Low Stock. Set threshold (e.g., 5 units). Email sent to admin when products fall below level. Include reorder links and supplier info.', 'email', 'create', NULL, NULL),
('create birthday email', 'suggestion', 'admin_ai', 'Settings > Notifications > Birthday Email. Collect birth dates during registration. Send automated birthday greeting with exclusive discount. Personal touch that drives loyalty and sales.', 'email', 'create', NULL, NULL),
('set up new order admin notification', 'suggestion', 'admin_ai', 'Settings > Notifications > Admin Alerts > New Order. Instant notification when order placed. Include order summary, customer info, payment status. Enable mobile push for urgent awareness.', 'email', 'update', NULL, NULL),
('customize subscription renewal email', 'suggestion', 'admin_ai', 'Settings > Notifications > Subscription Renewal. Sent before subscription renews. Include next charge date, amount, how to cancel/modify. Required for subscription compliance.', 'email', 'update', NULL, NULL),
('create win-back email campaign', 'suggestion', 'admin_ai', 'Settings > Notifications > Win-back. Trigger for customers inactive X days (60-90 days). Include "We miss you" message, personalized product recommendations, comeback discount. Re-engage lapsed customers.', 'email', 'create', NULL, NULL),
('disable an email notification', 'suggestion', 'admin_ai', 'Settings > Notifications > select email > toggle "Enabled" off. Email stops sending but template is preserved. Useful for seasonal or temporary disabling without losing customization.', 'email', 'update', NULL, NULL),
('add dynamic product recommendations to email', 'suggestion', 'admin_ai', 'When editing email template, add Product Recommendations block. Configure: recently viewed, related to purchase, bestsellers, personalized AI picks. Increases email engagement and cross-sells.', 'email', 'update', NULL, NULL),
('configure email delivery provider', 'suggestion', 'admin_ai', 'Settings > Email > Provider. Default uses built-in delivery. For high volume, connect SendGrid, Mailgun, or Amazon SES. Enter API keys and verify domain for better deliverability.', 'email', 'update', NULL, NULL),
('set up delivery confirmation email', 'suggestion', 'admin_ai', 'Settings > Notifications > Delivery Confirmation. Triggered when carrier marks delivered. Ask about experience, include review request, share care instructions for products. Good for closing the loop.', 'email', 'create', NULL, NULL),
('create payment failed email', 'suggestion', 'admin_ai', 'Settings > Notifications > Payment Failed. For subscriptions or retry scenarios. Explain what happened, how to update payment, deadline before cancellation. Keep tone helpful, not threatening.', 'email', 'create', NULL, NULL),
('add unsubscribe link to emails', 'suggestion', 'admin_ai', 'Unsubscribe links are auto-added to marketing emails (required by law). Customize text in Settings > Notifications > Footer. One-click unsubscribe preferred. Honor immediately.', 'email', 'update', NULL, NULL),
('localize email templates', 'suggestion', 'admin_ai', 'Settings > Notifications > select template > Translations tab. Write email content for each language. Subject lines, body, and footer need translation. Variables work the same in all languages.', 'email', 'update', NULL, NULL),
('configure email sending schedule', 'suggestion', 'admin_ai', 'Some emails (abandoned cart, win-back) have timing settings. Configure delay and optimal send time. Consider timezone - send when customers are likely to engage (not 3am their time).', 'email', 'update', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SECTION 16: TROUBLESHOOTING (30 examples)
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, training_status, detected_intent, ai_response, detected_entity, detected_operation, confidence_score, metadata
) VALUES

('products not showing on frontend', 'suggestion', 'admin_ai', 'Check: 1) Product status is "Active/Published". 2) Product has stock or allow backorders is enabled. 3) Product is assigned to a visible category. 4) Clear cache in Settings > Cache. 5) Check visibility settings.', 'troubleshooting', 'read', NULL, NULL),
('checkout not working', 'suggestion', 'admin_ai', 'Verify: 1) Payment methods are enabled and configured. 2) Shipping zones cover customer location. 3) No JavaScript errors (check browser console). 4) Test in incognito mode. 5) Check shipping/payment requirements (minimum order).', 'troubleshooting', 'read', NULL, NULL),
('images not loading', 'suggestion', 'admin_ai', 'Check: 1) Images uploaded correctly in Media library. 2) CDN configured properly if using. 3) Image URLs not blocked by security settings. 4) File sizes within limits. 5) Clear browser cache and try again.', 'troubleshooting', 'read', NULL, NULL),
('slow website performance', 'suggestion', 'admin_ai', 'Improve speed: 1) Enable caching in Settings > Performance. 2) Optimize images (compress, proper dimensions). 3) Reduce custom JavaScript. 4) Enable lazy loading. 5) Check server resources. 6) Use CDN for assets.', 'troubleshooting', 'read', NULL, NULL),
('orders not syncing to external system', 'suggestion', 'admin_ai', 'Troubleshoot: 1) Check integration connection status. 2) View sync logs for errors. 3) Verify API credentials still valid. 4) Check if order meets sync criteria. 5) Manual sync to test. 6) Contact integration support.', 'troubleshooting', 'read', NULL, NULL),
('payment declined at checkout', 'suggestion', 'admin_ai', 'Common causes: 1) Incorrect card details. 2) Insufficient funds. 3) Bank blocking transaction. 4) Payment gateway settings. 5) Currency mismatch. Check payment provider dashboard for detailed decline reason.', 'troubleshooting', 'read', NULL, NULL),
('emails not being received', 'suggestion', 'admin_ai', 'Check: 1) Sender email verified/authenticated. 2) Check spam folders. 3) Email provider status (if using external). 4) Test email works in Settings > Notifications. 5) Check email logs. 6) Verify SPF/DKIM records.', 'troubleshooting', 'read', NULL, NULL),
('search not returning results', 'suggestion', 'admin_ai', 'Verify: 1) Products are indexed (reindex in Settings > Search). 2) Search is looking at correct fields (name, SKU, description). 3) No filters blocking results. 4) Search index not corrupted - rebuild if needed.', 'troubleshooting', 'read', NULL, NULL),
('inventory showing wrong numbers', 'suggestion', 'admin_ai', 'Investigate: 1) Check pending orders reserving stock. 2) Verify no duplicate sync from integrations. 3) Review inventory log for unexpected changes. 4) Check for manual adjustments. 5) Reconcile with physical count.', 'troubleshooting', 'read', NULL, NULL),
('coupon code not applying', 'suggestion', 'admin_ai', 'Check coupon settings: 1) Code entered correctly (case-sensitive). 2) Coupon is active (start/end dates). 3) Usage limit not reached. 4) Minimum order met. 5) Products eligible (not excluded). 6) One coupon per order rule.', 'troubleshooting', 'read', NULL, NULL),
('category page showing 404', 'suggestion', 'admin_ai', 'Reasons: 1) Category unpublished or deleted. 2) URL changed and no redirect set. 3) Cache showing old URL. 4) Parent category inactive. Clear cache and check category status in admin.', 'troubleshooting', 'read', NULL, NULL),
('mobile layout broken', 'suggestion', 'admin_ai', 'Debug: 1) Test in browser mobile emulator. 2) Check responsive CSS in Layout settings. 3) Look for fixed-width elements. 4) Verify viewport meta tag present. 5) Test slots mobile visibility settings.', 'troubleshooting', 'read', NULL, NULL),
('login not working for customers', 'suggestion', 'admin_ai', 'Check: 1) Customer account exists and active. 2) Password correct (offer reset). 3) No account lockout from too many attempts. 4) Session cookies not blocked. 5) Third-party login (Google/Facebook) configured correctly.', 'troubleshooting', 'read', NULL, NULL),
('translations not showing', 'suggestion', 'admin_ai', 'Verify: 1) Language is active in Settings. 2) Content translated for that language (check for missing). 3) Language detection working. 4) Cache cleared. 5) Browser language matches expected.', 'troubleshooting', 'read', NULL, NULL),
('shipping rates not calculating', 'suggestion', 'admin_ai', 'Check: 1) Shipping zone covers customer address. 2) Product weights entered if using weight-based. 3) Carrier API connected if using real-time. 4) No products marked as no-shipping. 5) Shipping method enabled.', 'troubleshooting', 'read', NULL, NULL),
('taxes not applying correctly', 'suggestion', 'admin_ai', 'Review: 1) Tax settings for customer location. 2) Product tax class assigned. 3) Tax-inclusive vs exclusive setting. 4) Tax exemptions not applied incorrectly. 5) EU VAT rules if applicable.', 'troubleshooting', 'read', NULL, NULL),
('admin access denied', 'suggestion', 'admin_ai', 'Possible causes: 1) Session expired - log in again. 2) Role/permissions changed. 3) Account deactivated. 4) IP blocking active. Contact another admin or check database user record.', 'troubleshooting', 'read', NULL, NULL),
('product import failing', 'suggestion', 'admin_ai', 'Common issues: 1) CSV format incorrect. 2) Required fields missing (name, price). 3) SKU duplicates. 4) Invalid category IDs. 5) Special characters encoding. Check import log for specific row errors.', 'troubleshooting', 'read', NULL, NULL),
('webhook not firing', 'suggestion', 'admin_ai', 'Troubleshoot: 1) Webhook enabled and URL correct. 2) Endpoint accessible (not behind firewall). 3) Correct events selected. 4) Check webhook logs for delivery attempts. 5) Endpoint returning 200 status.', 'troubleshooting', 'read', NULL, NULL),
('currency conversion not working', 'suggestion', 'admin_ai', 'Check: 1) Multi-currency enabled. 2) Exchange rates set and updated. 3) Currency enabled for display. 4) Geolocation detecting customer country. 5) Currency switcher visible in frontend.', 'troubleshooting', 'read', NULL, NULL),
('order status not updating', 'suggestion', 'admin_ai', 'Investigate: 1) Automation rules configured correctly. 2) Payment webhook received (check logs). 3) Manual status update working. 4) No conflicting rules. 5) Order not locked by integration.', 'troubleshooting', 'read', NULL, NULL),
('product variants not showing', 'suggestion', 'admin_ai', 'Verify: 1) Variants enabled for product. 2) At least one variant option created. 3) Variant combinations generated. 4) Variants not all out of stock. 5) Variant prices set. 6) Cache cleared.', 'troubleshooting', 'read', NULL, NULL),
('slow admin dashboard', 'suggestion', 'admin_ai', 'Improve: 1) Reduce date range on analytics widgets. 2) Limit items per page in lists. 3) Check browser extensions not interfering. 4) Close unused tabs. 5) Clear browser cache. 6) Check network speed.', 'troubleshooting', 'read', NULL, NULL),
('customer sees old prices', 'suggestion', 'admin_ai', 'Price cache issue: 1) Clear site cache. 2) Customer clears browser cache. 3) Check CDN cache if using. 4) Price changes may take minutes to propagate. 5) No customer-specific pricing active.', 'troubleshooting', 'read', NULL, NULL),
('GTIN validation error on save', 'suggestion', 'admin_ai', 'GTIN/EAN/UPC must be valid: 1) Check correct length (8, 12, 13, or 14 digits). 2) Verify check digit is correct. 3) No letters or special characters. 4) Use official barcode from manufacturer.', 'troubleshooting', 'read', NULL, NULL),
('AI shopping feed products missing', 'suggestion', 'admin_ai', 'Products excluded from AI feeds when: 1) No GTIN or MPN. 2) Missing brand. 3) Description too short. 4) No primary image. 5) Product not published. 6) Category not mapped to Google taxonomy.', 'troubleshooting', 'read', NULL, NULL),
('slot not appearing on page', 'suggestion', 'admin_ai', 'Check slot: 1) Visibility enabled (not hidden). 2) Not set to hide on this device (mobile/desktop). 3) Conditions not excluding current view. 4) Parent container visible. 5) Not in draft state.', 'troubleshooting', 'read', NULL, NULL),
('confirmation dialog not showing', 'suggestion', 'admin_ai', 'For destructive operations, confirmation should appear. If not: 1) JavaScript errors blocking it. 2) Browser popup blocker. 3) Custom theme overriding dialogs. 4) Check operation is marked as requiring confirmation.', 'troubleshooting', 'read', NULL, NULL),
('export taking too long', 'suggestion', 'admin_ai', 'Large exports run in background: 1) Check export status in Jobs. 2) Reduce date range or filters. 3) Export in batches. 4) Download link emailed when ready. 5) Check server resources if consistently slow.', 'troubleshooting', 'read', NULL, NULL),
('SSL certificate errors', 'suggestion', 'admin_ai', 'SSL issues: 1) Certificate valid and not expired. 2) Covers correct domain. 3) Full chain installed. 4) Mixed content (HTTP resources on HTTPS page). 5) Force HTTPS redirect enabled. 6) Contact host for certificate renewal.', 'troubleshooting', 'read', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================
-- SUMMARY
-- ============================================
-- Total new training examples: ~340
-- Categories:
--   Products: 30
--   Orders: 25
--   Customers: 25
--   Categories: 20
--   Coupons: 20
--   Shipping: 20
--   Inventory: 20
--   Analytics: 20
--   Settings: 20
--   SEO: 20
--   Translations: 20
--   CMS Pages: 20
--   Layout/Slots: 20
--   Integrations: 25
--   Email: 25
--   Troubleshooting: 30
--
-- All using 'suggestion' or 'needs_confirmation' training status
-- SAFE TO RE-RUN: Uses ON CONFLICT DO NOTHING
-- ============================================
