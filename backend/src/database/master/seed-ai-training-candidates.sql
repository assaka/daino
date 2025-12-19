-- ============================================
-- AI TRAINING CANDIDATES SEED DATA
-- ============================================
-- Pre-approved training examples for common AI operations
-- These serve as examples for the AI to learn from
--
-- SAFE TO RE-RUN: Uses ON CONFLICT DO NOTHING
-- ============================================

-- ============================================
-- PRODUCTS - Common operations
-- ============================================

INSERT INTO ai_training_candidates (
  user_prompt, ai_response, detected_intent, detected_entity, detected_operation,
  outcome_status, training_status, confidence_score, success_count, was_helpful, metadata
) VALUES

-- Product queries
('show me all products',
 'Here are your products. I found {count} products in your store.',
 'admin_entity', 'products', 'list',
 'success', 'promoted', 0.95, 10, true,
 '{"category": "products", "complexity": "simple"}'),

('list products that are out of stock',
 'Here are the out of stock products. Found {count} items with 0 inventory.',
 'admin_entity', 'products', 'list',
 'success', 'promoted', 0.92, 8, true,
 '{"category": "products", "filter": "stock_quantity = 0"}'),

('show products under $50',
 'Here are products priced under $50.',
 'admin_entity', 'products', 'list',
 'success', 'promoted', 0.90, 7, true,
 '{"category": "products", "filter": "price < 50"}'),

('find products without images',
 'Here are products that don''t have images yet.',
 'admin_entity', 'products', 'list',
 'success', 'promoted', 0.88, 5, true,
 '{"category": "products", "filter": "image IS NULL"}'),

-- Product updates
('set all products to active',
 'I''ve activated all products in your store.',
 'admin_entity', 'products', 'bulk_update',
 'success', 'promoted', 0.85, 6, true,
 '{"category": "products", "bulk": true}'),

('increase all prices by 10%',
 'I''ve increased all product prices by 10%.',
 'admin_entity', 'products', 'bulk_update',
 'success', 'promoted', 0.82, 4, true,
 '{"category": "products", "bulk": true, "calculation": "price * 1.1"}'),

-- ============================================
-- CATEGORIES - Common operations
-- ============================================

('show all categories',
 'Here are your product categories.',
 'admin_entity', 'categories', 'list',
 'success', 'promoted', 0.95, 12, true,
 '{"category": "categories"}'),

('create a new category called Electronics',
 'I''ve created the "Electronics" category.',
 'admin_entity', 'categories', 'create',
 'success', 'promoted', 0.90, 8, true,
 '{"category": "categories", "name": "Electronics"}'),

('rename category Clothes to Apparel',
 'I''ve renamed the category from "Clothes" to "Apparel".',
 'admin_entity', 'categories', 'update',
 'success', 'promoted', 0.88, 6, true,
 '{"category": "categories", "old_name": "Clothes", "new_name": "Apparel"}'),

('delete the empty categories',
 'I''ve deleted categories that have no products.',
 'admin_entity', 'categories', 'delete',
 'success', 'promoted', 0.80, 3, true,
 '{"category": "categories", "filter": "product_count = 0"}'),

-- ============================================
-- ORDERS - Common operations
-- ============================================

('show recent orders',
 'Here are your recent orders from the last 7 days.',
 'admin_entity', 'orders', 'list',
 'success', 'promoted', 0.95, 15, true,
 '{"category": "orders", "filter": "last_7_days"}'),

('list pending orders',
 'Here are orders with pending status.',
 'admin_entity', 'orders', 'list',
 'success', 'promoted', 0.93, 12, true,
 '{"category": "orders", "filter": "status = pending"}'),

('show orders over $100',
 'Here are orders with total over $100.',
 'admin_entity', 'orders', 'list',
 'success', 'promoted', 0.90, 8, true,
 '{"category": "orders", "filter": "total > 100"}'),

('find orders from last month',
 'Here are orders from the previous month.',
 'admin_entity', 'orders', 'list',
 'success', 'promoted', 0.88, 7, true,
 '{"category": "orders", "filter": "last_month"}'),

-- ============================================
-- CUSTOMERS - Common operations
-- ============================================

('list all customers',
 'Here are your customers.',
 'admin_entity', 'customers', 'list',
 'success', 'promoted', 0.95, 10, true,
 '{"category": "customers"}'),

('show customers who ordered this month',
 'Here are customers who placed orders this month.',
 'admin_entity', 'customers', 'list',
 'success', 'promoted', 0.88, 6, true,
 '{"category": "customers", "filter": "has_recent_order"}'),

('find repeat customers',
 'Here are customers with more than one order.',
 'admin_entity', 'customers', 'list',
 'success', 'promoted', 0.85, 5, true,
 '{"category": "customers", "filter": "order_count > 1"}'),

-- ============================================
-- COUPONS - Common operations
-- ============================================

('show all coupons',
 'Here are your discount codes.',
 'admin_entity', 'coupons', 'list',
 'success', 'promoted', 0.95, 10, true,
 '{"category": "coupons"}'),

('create a 20% off coupon code SAVE20',
 'I''ve created the coupon code SAVE20 for 20% off.',
 'admin_entity', 'coupons', 'create',
 'success', 'promoted', 0.92, 8, true,
 '{"category": "coupons", "code": "SAVE20", "discount_type": "percentage", "discount_value": 20}'),

('create a free shipping coupon',
 'I''ve created a free shipping coupon.',
 'admin_entity', 'coupons', 'create',
 'success', 'promoted', 0.90, 7, true,
 '{"category": "coupons", "discount_type": "free_shipping"}'),

('disable expired coupons',
 'I''ve disabled all coupons that have expired.',
 'admin_entity', 'coupons', 'bulk_update',
 'success', 'promoted', 0.85, 5, true,
 '{"category": "coupons", "filter": "expires_at < NOW()"}'),

('create coupon WELCOME10 for 10% off first order',
 'I''ve created the welcome coupon WELCOME10 for 10% off, limited to first-time customers.',
 'admin_entity', 'coupons', 'create',
 'success', 'promoted', 0.88, 6, true,
 '{"category": "coupons", "code": "WELCOME10", "first_order_only": true}'),

-- ============================================
-- STORE SETTINGS - Common operations
-- ============================================

('change store name to My Awesome Store',
 'I''ve updated your store name to "My Awesome Store".',
 'admin_entity', 'store_settings', 'update',
 'success', 'promoted', 0.95, 9, true,
 '{"category": "settings", "field": "store_name"}'),

('update currency to EUR',
 'I''ve changed your store currency to EUR (Euro).',
 'admin_entity', 'store_settings', 'update',
 'success', 'promoted', 0.92, 7, true,
 '{"category": "settings", "field": "currency", "value": "EUR"}'),

('set timezone to Europe/London',
 'I''ve updated your timezone to Europe/London.',
 'admin_entity', 'store_settings', 'update',
 'success', 'promoted', 0.90, 5, true,
 '{"category": "settings", "field": "timezone"}'),

-- ============================================
-- CMS PAGES - Common operations
-- ============================================

('show all pages',
 'Here are your CMS pages.',
 'admin_entity', 'cms_pages', 'list',
 'success', 'promoted', 0.95, 8, true,
 '{"category": "cms"}'),

('create an About Us page',
 'I''ve created an About Us page. You can now edit its content.',
 'admin_entity', 'cms_pages', 'create',
 'success', 'promoted', 0.90, 6, true,
 '{"category": "cms", "page_type": "about"}'),

('update the contact page',
 'I''ve opened the Contact page for editing.',
 'admin_entity', 'cms_pages', 'update',
 'success', 'promoted', 0.88, 5, true,
 '{"category": "cms", "page_type": "contact"}'),

-- ============================================
-- SHIPPING METHODS - Common operations
-- ============================================

('show shipping methods',
 'Here are your shipping options.',
 'admin_entity', 'shipping_methods', 'list',
 'success', 'promoted', 0.95, 7, true,
 '{"category": "shipping"}'),

('add free shipping for orders over $50',
 'I''ve created a free shipping option for orders over $50.',
 'admin_entity', 'shipping_methods', 'create',
 'success', 'promoted', 0.88, 5, true,
 '{"category": "shipping", "type": "free", "min_order": 50}'),

('create express shipping for $15',
 'I''ve added Express Shipping at $15.',
 'admin_entity', 'shipping_methods', 'create',
 'success', 'promoted', 0.85, 4, true,
 '{"category": "shipping", "name": "Express", "price": 15}'),

-- ============================================
-- TRANSLATIONS - Common operations
-- ============================================

('translate products to Spanish',
 'I''ll translate your product content to Spanish. This will use AI translation credits.',
 'admin_entity', 'translations', 'translate',
 'success', 'promoted', 0.85, 4, true,
 '{"category": "translations", "target_lang": "es"}'),

('show available languages',
 'Here are the languages configured for your store.',
 'admin_entity', 'languages', 'list',
 'success', 'promoted', 0.92, 6, true,
 '{"category": "languages"}'),

-- ============================================
-- ANALYTICS / REPORTING - Common queries
-- ============================================

('show sales this month',
 'Here''s your sales summary for this month.',
 'analytics', 'sales', 'report',
 'success', 'promoted', 0.90, 8, true,
 '{"category": "analytics", "period": "this_month"}'),

('what are my best selling products',
 'Here are your top selling products by quantity sold.',
 'analytics', 'products', 'report',
 'success', 'promoted', 0.88, 7, true,
 '{"category": "analytics", "metric": "top_sellers"}'),

('show revenue by category',
 'Here''s the revenue breakdown by product category.',
 'analytics', 'categories', 'report',
 'success', 'promoted', 0.85, 5, true,
 '{"category": "analytics", "metric": "revenue_by_category"}'),

-- ============================================
-- HELP / GENERAL - Common queries
-- ============================================

('what can you do',
 'I can help you manage your store! I can list, create, update, and delete products, categories, orders, customers, coupons, and more. Just ask me what you need.',
 'help', null, null,
 'success', 'promoted', 0.98, 20, true,
 '{"category": "help"}'),

('how do I add a product',
 'To add a product, you can say "create a new product called [name]" or go to Products > Add Product in the admin panel.',
 'help', 'products', 'guidance',
 'success', 'promoted', 0.95, 12, true,
 '{"category": "help", "topic": "products"}'),

('help with coupons',
 'I can help you create and manage coupons. Try saying "create a 20% off coupon" or "show all active coupons".',
 'help', 'coupons', 'guidance',
 'success', 'promoted', 0.92, 8, true,
 '{"category": "help", "topic": "coupons"}')

ON CONFLICT DO NOTHING;

-- ============================================
-- SUMMARY
-- ============================================
-- Total seed records: ~45 training examples
-- Categories covered: products, categories, orders, customers, coupons,
--                     store_settings, cms_pages, shipping_methods,
--                     translations, analytics, help
-- All marked as 'promoted' status (pre-approved)
