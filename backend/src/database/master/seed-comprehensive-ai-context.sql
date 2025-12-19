-- Comprehensive AI RAG Context Data
-- This provides extensive knowledge for the AI to understand the entire DainoStore platform
-- Categories: database_schema, e-commerce, analytics, jobs, settings, integrations
--
-- SAFE TO RE-RUN: This script deletes existing entries before inserting

-- ============================================
-- CLEANUP: Remove existing comprehensive context entries
-- ============================================
DELETE FROM ai_context_documents WHERE type IN ('database_schema', 'e-commerce', 'analytics', 'jobs', 'settings', 'integrations', 'plugins', 'cron', 'intent_examples');
DELETE FROM ai_entity_definitions WHERE entity_name IN ('products', 'orders', 'customers', 'attributes', 'categories', 'payment_methods', 'shipping_methods', 'coupons', 'theme_settings');

-- ============================================
-- DATABASE STRUCTURE OVERVIEW
-- ============================================

INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES

('database_schema', 'Database Architecture Overview',
'CATALYST DATABASE ARCHITECTURE:

TWO-TIER DATABASE SYSTEM:
1. MASTER DATABASE (Platform-level)
   - users (agency owners only)
   - stores (minimal registry: id, slug, status)
   - store_databases (encrypted tenant DB credentials)
   - subscriptions, credit_transactions, credit_balances
   - jobs (platform job queue)
   - ai_* tables (RAG knowledge base)

2. TENANT DATABASE (Per-store, isolated)
   - stores (FULL store data with all settings)
   - users (all types: agency, admin, staff, customers)
   - products, categories, attributes
   - orders, order_items, customers
   - inventory, pricing, taxes, shipping
   - plugins, cron_jobs
   - cms_pages, cms_blocks
   - 70+ e-commerce tables

SECURITY: Tenant DBs have ZERO knowledge of master DB.
All cross-DB communication via backend API.

QUERIES:
- Store data: ConnectionManager.getStoreConnection(storeId)
- Master data: masterDbClient (Supabase client)',
'core', '["database", "architecture", "master", "tenant", "schema"]', 100, 'all', true),

('database_schema', 'Core Tables Reference',
'CORE TABLES IN TENANT DATABASE:

STORES TABLE (stores):
- id, user_id, name, slug, description
- logo_url, banner_url, theme_color
- currency, timezone, locale
- settings (JSONB - all store settings including theme)
- contact_email, contact_phone
- address_line1/2, city, state, postal_code, country
- deployment_status, published, published_at
- configurations (JSONB - slot configurations per page)
- created_at, updated_at

USERS TABLE (users):
- id, email, password, first_name, last_name
- phone, avatar_url
- is_active, email_verified
- role (admin, staff, customer)
- account_type (agency, store_owner)
- last_login, created_at, updated_at

STORE SETTINGS (stores.settings JSONB):
- settings.theme.* - Theme colors, fonts, breadcrumb styling
- settings.show_category_in_breadcrumb - Boolean toggles
- settings.currency, settings.locale
- Access: store.settings.theme.breadcrumb_item_text_color',
'core', '["stores", "users", "settings", "schema"]', 95, 'all', true),

-- ============================================
-- E-COMMERCE ENTITIES
-- ============================================

('e-commerce', 'Products Table Structure',
'PRODUCTS TABLE (products):

COLUMNS:
- id (UUID), slug, sku, barcode
- external_id, external_source (for Shopify/Akeneo imports)
- price, compare_price, cost_price (DECIMAL)
- weight, dimensions (JSON)
- images (JSON array of image objects)
- type: simple, configurable, bundle, grouped, virtual, downloadable
- status: draft, active, inactive
- visibility: visible, hidden
- manage_stock, stock_quantity, allow_backorders
- low_stock_threshold, infinite_stock
- featured (boolean)
- tags (JSON array)
- seo (JSON - meta_title, meta_description, etc.)
- store_id, attribute_set_id, parent_id
- configurable_attributes (JSON array of attribute IDs)
- category_ids (JSON array)
- related_product_ids (JSON array)
- sort_order, view_count, purchase_count
- created_at, updated_at

RELATED TABLES:
- product_translations (name, description per language)
- product_variants (for configurable products)
- product_attribute_values (attribute assignments)
- product_labels (sale badges, etc.)

QUERIES:
"best selling products" = ORDER BY purchase_count DESC
"low stock products" = WHERE stock_quantity <= low_stock_threshold
"featured products" = WHERE featured = true',
'e-commerce', '["products", "catalog", "inventory", "sku"]', 90, 'all', true),

('e-commerce', 'Orders Table Structure',
'ORDERS TABLE (sales_orders):

COLUMNS:
- id (UUID), order_number (unique string)
- status: pending, processing, shipped, delivered, cancelled, refunded
- payment_status: pending, paid, partially_paid, refunded, failed
- fulfillment_status: pending, processing, shipped, delivered, cancelled
- customer_id, customer_email, customer_phone
- billing_address (JSON), shipping_address (JSON)
- subtotal, tax_amount, shipping_amount, discount_amount, payment_fee_amount
- total_amount, currency
- delivery_date, delivery_time_slot, delivery_instructions
- payment_method, payment_reference
- shipping_method, tracking_number
- coupon_code, notes, admin_notes
- store_id
- shipped_at, delivered_at, cancelled_at
- created_at, updated_at

RELATED TABLES:
- order_items (products in order)
- shipments (tracking info)
- invoices (billing records)

ANALYTICS QUERIES:
"total revenue" = SUM(total_amount) WHERE payment_status = ''paid''
"orders today" = WHERE DATE(created_at) = CURRENT_DATE
"average order value" = AVG(total_amount)
"pending orders" = WHERE status = ''pending''',
'e-commerce', '["orders", "sales", "revenue", "fulfillment"]', 90, 'all', true),

('e-commerce', 'Customers Table Structure',
'CUSTOMERS TABLE (customers):

COLUMNS:
- id (UUID), store_id
- email (unique per store), password (nullable for guests)
- first_name, last_name, phone
- avatar_url, date_of_birth, gender
- total_spent (DECIMAL), total_orders (INTEGER)
- last_order_date
- accepts_marketing, tax_exempt
- notes, tags (JSON array)
- status: active, inactive, blocked
- created_at, updated_at

RELATED TABLES:
- customer_addresses (billing/shipping addresses)
- customer_activities (browsing behavior)
- wishlists (saved products)

QUERIES:
"top customers" = ORDER BY total_spent DESC
"new customers this month" = WHERE created_at >= MONTH_START
"inactive customers" = WHERE last_order_date < 90_DAYS_AGO
"customer details" = SELECT * WHERE email = ''..'' OR id = ''..''',
'e-commerce', '["customers", "crm", "loyalty", "analytics"]', 85, 'all', true),

('e-commerce', 'Attributes System',
'ATTRIBUTES SYSTEM:

ATTRIBUTES TABLE (attributes):
- id, name, code (unique identifier)
- type: text, number, select, multiselect, boolean, date, file, image
- is_required, is_filterable, is_searchable
- is_usable_in_conditions (for price rules)
- is_configurable (for product variations like size/color)
- filter_type: multiselect, slider, select
- sort_order, store_id

ATTRIBUTE VALUES (attribute_values):
- id, attribute_id
- value, label, sort_order
- swatch_type: none, color, image
- swatch_value (hex color or image URL)

PRODUCT ATTRIBUTE VALUES (product_attribute_values):
- id, product_id, attribute_id, attribute_value_id
- value (for text/number types)

ATTRIBUTE SETS (attribute_sets):
- Groups of attributes for product types
- e.g., "Clothing" set has: size, color, material

COMMANDS:
"add color attribute" = Create attribute with type=select, is_configurable=true
"make attribute filterable" = UPDATE attributes SET is_filterable = true
"add attribute value" = INSERT INTO attribute_values',
'e-commerce', '["attributes", "variants", "filters", "catalog"]', 85, 'all', true),

('e-commerce', 'Categories and Navigation',
'CATEGORIES TABLE (categories):

COLUMNS:
- id (UUID), store_id
- name, slug, description
- parent_id (for hierarchy)
- image_url, banner_url
- is_active, show_in_menu
- sort_order, level (depth in tree)
- path (materialized path for queries)
- seo (JSON - meta_title, meta_description)
- created_at, updated_at

CATEGORY_PRODUCTS (junction table):
- category_id, product_id
- sort_order (position in category)

HIERARCHY:
- Root categories: parent_id IS NULL
- Subcategories: parent_id = parent_category_id
- Level 0 = root, Level 1 = subcategory, etc.

QUERIES:
"products in category" = JOIN category_products
"category tree" = WITH RECURSIVE for tree traversal
"active categories" = WHERE is_active = true AND show_in_menu = true',
'e-commerce', '["categories", "navigation", "menu", "hierarchy"]', 80, 'all', true),

-- ============================================
-- ANALYTICS & REPORTING
-- ============================================

('analytics', 'Sales Analytics Queries',
'SALES ANALYTICS - COMMON QUERIES:

BEST SELLING PRODUCTS:
SELECT p.*, pt.name, SUM(oi.quantity) as units_sold
FROM products p
JOIN product_translations pt ON p.id = pt.product_id
JOIN order_items oi ON p.id = oi.product_id
JOIN sales_orders o ON oi.order_id = o.id
WHERE o.payment_status = ''paid''
GROUP BY p.id, pt.name
ORDER BY units_sold DESC
LIMIT 10;

-- OR simpler using purchase_count:
SELECT * FROM products ORDER BY purchase_count DESC LIMIT 10;

REVENUE BY PERIOD:
SELECT DATE_TRUNC(''day'', created_at) as date,
       SUM(total_amount) as revenue,
       COUNT(*) as order_count
FROM sales_orders
WHERE payment_status = ''paid''
GROUP BY DATE_TRUNC(''day'', created_at)
ORDER BY date DESC;

AVERAGE ORDER VALUE:
SELECT AVG(total_amount) as aov
FROM sales_orders WHERE payment_status = ''paid'';

TOP CUSTOMERS:
SELECT * FROM customers ORDER BY total_spent DESC LIMIT 10;',
'analytics', '["sales", "revenue", "best-selling", "reports"]', 90, 'all', true),

('analytics', 'Customer Analytics',
'CUSTOMER ANALYTICS - COMMON QUERIES:

CUSTOMER LIFETIME VALUE:
SELECT c.*,
       c.total_spent as lifetime_value,
       c.total_orders,
       c.total_spent / NULLIF(c.total_orders, 0) as avg_order_value
FROM customers c
ORDER BY lifetime_value DESC;

NEW VS RETURNING:
-- New customers this period
SELECT COUNT(*) FROM customers
WHERE created_at >= ''start_date'';

-- Returning customers (multiple orders)
SELECT COUNT(*) FROM customers WHERE total_orders > 1;

CUSTOMER SEGMENTS:
- VIP: total_spent > $1000
- Regular: total_orders >= 3
- At Risk: last_order_date < 90 days ago
- New: created_at in last 30 days

CUSTOMER ACTIVITY (customer_activities table):
- page_view, add_to_cart, checkout, purchase events
- session_id, user_agent, country, city
- Used for real-time "users online" count',
'analytics', '["customers", "segments", "retention", "clv"]', 85, 'all', true),

('analytics', 'Inventory Analytics',
'INVENTORY ANALYTICS:

LOW STOCK ALERT:
SELECT p.*, pt.name
FROM products p
JOIN product_translations pt ON p.id = pt.product_id
WHERE p.manage_stock = true
  AND p.stock_quantity <= p.low_stock_threshold
  AND p.status = ''active'';

OUT OF STOCK:
SELECT * FROM products
WHERE manage_stock = true AND stock_quantity <= 0;

INVENTORY VALUE:
SELECT SUM(stock_quantity * cost_price) as total_inventory_value
FROM products WHERE cost_price IS NOT NULL;

STOCK MOVEMENT (via order_items):
SELECT p.sku, pt.name,
       SUM(oi.quantity) as units_sold,
       p.stock_quantity as current_stock
FROM products p
JOIN product_translations pt ON p.id = pt.product_id
JOIN order_items oi ON p.id = oi.product_id
GROUP BY p.id, p.sku, pt.name, p.stock_quantity;',
'analytics', '["inventory", "stock", "alerts", "warehouse"]', 80, 'all', true),

-- ============================================
-- JOBS & BACKGROUND TASKS
-- ============================================

('jobs', 'Job System Overview',
'JOBS SYSTEM (Master Database):

JOBS TABLE (jobs):
- id (UUID), type (job identifier)
- priority: low, normal, high, urgent
- status: pending, running, completed, failed, cancelled
- payload (JSON - job parameters)
- result (JSON - execution result)
- scheduled_at, started_at, completed_at, failed_at
- max_retries, retry_count, last_error
- store_id, user_id
- progress (0-100), progress_message
- metadata (JSON)

COMMON JOB TYPES:
- akeneo:import:products - Import from Akeneo PIM
- akeneo:import:categories - Import categories
- shopify:import:products - Import from Shopify
- plugin:install - Install a plugin
- plugin:update - Update a plugin
- email:send - Send email
- export:products - Export product data

TRIGGERING A JOB:
INSERT INTO jobs (type, priority, payload, store_id, user_id)
VALUES (''akeneo:import:products'', ''high'', ''{}'', store_id, user_id);

JOB QUEUE PROCESSING:
Jobs are processed by backend workers that poll for pending jobs
and execute them in priority order.',
'system', '["jobs", "tasks", "background", "queue", "import"]', 90, 'all', true),

('jobs', 'Import/Export Jobs',
'IMPORT/EXPORT JOBS:

AKENEO IMPORT:
Job type: ''akeneo:import:products''
Payload: { "full_sync": true/false }
- Imports products, categories, attributes from Akeneo PIM
- Tracks progress in import_statistics table

SHOPIFY IMPORT:
Job type: ''shopify:import:products''
Payload: { "since_id": "last_product_id" }
- Imports products from Shopify store

PRODUCT EXPORT:
Job type: ''export:products''
Payload: { "format": "csv", "filters": {...} }
- Exports products to CSV/JSON

IMPORT STATISTICS (import_statistics table):
- source, import_type
- total_items, processed_items, created, updated, skipped, failed
- started_at, completed_at, duration_seconds
- error_log (JSON array of errors)

TRIGGERING IMPORT:
"import products from akeneo" = Create job with type akeneo:import:products
"run shopify sync" = Create job with type shopify:import:products',
'system', '["import", "export", "akeneo", "shopify", "sync"]', 85, 'all', true),

-- ============================================
-- SETTINGS & CONFIGURATION
-- ============================================

('settings', 'Slot Configuration vs Store Settings',
'TWO TYPES OF VISUAL SETTINGS:

1. SLOT CONFIGURATIONS (slot_configurations table):
   - Per-page layout (product, category, cart, checkout, header)
   - Slot positions, order, visibility
   - Slot styling (colors, fonts, sizes)
   - Slot content (text, images, components)
   - Stored in: slot_configurations.configuration JSONB
   - Changed via: AI layout_modify or styling intents

2. STORE SETTINGS (stores.settings JSONB):
   - Global store behavior settings
   - Theme colors and fonts
   - Feature toggles (enable/disable)
   - Not slot-specific - affects entire store
   - Changed via: AI settings_update intent

WHEN USER SAYS:
- "move title below price" → SLOT CONFIG (layout_modify)
- "make title red" → SLOT CONFIG (styling)
- "hide stock label" → STORE SETTINGS (settings_update)
- "hide quantity selector" → STORE SETTINGS (settings_update)
- "hide currency symbol" → STORE SETTINGS (settings_update)

SLOT RENDERER DATA FLOW:
1. Page loads slot_configurations from database
2. Page loads stores.settings for behavior flags
3. UnifiedSlotRenderer receives both as context
4. Slots render based on configuration
5. Settings control conditional display (if show_stock_label, etc.)

VARIABLE CONTEXT IN SLOTS:
- {{product.name}} → Product data
- {{settings.show_stock_label}} → Store setting
- {{settings.currency_symbol}} → Currency from settings
- {{settings.hide_quantity_selector}} → Feature toggle',
'core', '["slots", "settings", "configuration", "rendering"]', 100, 'all', true),

('settings', 'Store Settings Reference - Feature Toggles',
'STORE SETTINGS PATH REFERENCE:

=== NESTED UNDER stock_settings.* ===
These MUST use the nested path stock_settings.X:
- stock_settings.show_stock_label (boolean) - Show/hide stock badge
- stock_settings.in_stock_label (string) - "In Stock" text
- stock_settings.out_of_stock_label (string) - "Out of Stock" text
- stock_settings.low_stock_label (string) - "Low Stock" text
- stock_settings.in_stock_text_color (hex) - In stock text color
- stock_settings.in_stock_bg_color (hex) - In stock background
- stock_settings.out_of_stock_text_color (hex) - Out of stock text
- stock_settings.out_of_stock_bg_color (hex) - Out of stock background
- stock_settings.low_stock_text_color (hex) - Low stock text
- stock_settings.low_stock_bg_color (hex) - Low stock background

=== NESTED UNDER theme.* ===
These MUST use the nested path theme.X:
- theme.primary_color, theme.add_to_cart_button_color
- theme.breadcrumb_item_text_color, theme.breadcrumb_show_home_icon
- theme.font_family, theme.product_tabs_title_color
(See Theme Settings doc for full list)

=== TOP-LEVEL SETTINGS ===
These are at the root level (just the key name):
- enable_inventory (boolean) - Track inventory
- display_out_of_stock (boolean) - Show out of stock products
- hide_stock_quantity (boolean) - Hide stock numbers
- hide_currency_category (boolean) - Hide currency on category
- hide_currency_product (boolean) - Hide currency on product
- hide_quantity_selector (boolean) - Hide qty selector
- hide_header_cart (boolean) - Hide cart icon
- show_permanent_search (boolean) - Always show search
- show_category_in_breadcrumb (boolean) - Category in breadcrumbs
- show_language_selector (boolean) - Language picker
- allow_guest_checkout (boolean) - Guest checkout
- enable_product_filters (boolean) - Show filters
- collapse_filters (boolean) - Filters collapsed
- enable_view_mode_toggle (boolean) - Grid/list toggle
- default_view_mode (string) - "grid" or "list"
- product_gallery_layout (string) - "horizontal" or "vertical"

COMMAND → PATH MAPPING (pay attention to value logic!):
"hide stock label" → stock_settings.show_stock_label = false
"show stock label" → stock_settings.show_stock_label = true
"hide currency" → hide_currency_product = true
"show currency" → hide_currency_product = false (NOT true!)
"hide quantity selector" → hide_quantity_selector = true
"show quantity selector" → hide_quantity_selector = false (NOT true!)
"change breadcrumb color" → theme.breadcrumb_item_text_color = "#hexcolor"
"change add to cart color" → theme.add_to_cart_button_color = "#hexcolor"

VALUE LOGIC RULES:
- For "show_*" settings: "show X" = true, "hide X" = false
- For "hide_*" settings: "hide X" = true, "show X" = false
The setting NAME determines the logic, not the user command!',
'settings', '["settings", "toggles", "features", "hide", "show", "paths"]', 98, 'all', true),

('settings', 'Theme and Layout Settings',
'THEME SETTINGS (stores.settings.theme JSONB):

COLORS:
- primary_color, secondary_color, accent_color
- text_color, background_color
- link_color, link_hover_color

TYPOGRAPHY:
- font_family (Google Font name)
- custom_fonts (array of uploaded fonts)
- heading_font_family, body_font_size

BREADCRUMB SETTINGS:
- breadcrumb_show_home_icon (boolean)
- breadcrumb_item_text_color (hex)
- breadcrumb_item_hover_color (hex)
- breadcrumb_active_item_color (hex)
- breadcrumb_separator_color (hex)
- breadcrumb_font_size, breadcrumb_mobile_font_size
- breadcrumb_font_weight

PRODUCT TABS:
- product_tabs_bg, product_tabs_active_bg
- product_tabs_text_color, product_tabs_active_text_color

HEADER:
- header_bg_color, header_text_color
- header_height, header_sticky

UPDATING THEME SETTINGS:
UPDATE stores SET settings = jsonb_set(
  settings,
  ''{theme,breadcrumb_item_text_color}'',
  ''"#FF0000"''
) WHERE id = store_id;',
'settings', '["theme", "colors", "fonts", "breadcrumb", "styling"]', 95, 'all', true),

('settings', 'Store Configuration Settings',
'STORE CONFIGURATION (stores.configurations JSONB):

This stores slot-based page configurations.

STRUCTURE:
{
  "product": { slots: {...}, activeTheme: "..." },
  "category": { slots: {...}, activeTheme: "..." },
  "home": { slots: {...}, activeTheme: "..." },
  "cart": { slots: {...}, activeTheme: "..." },
  "checkout": { slots: {...}, activeTheme: "..." }
}

Each page type has:
- slots: Object of slot configurations (id -> slot config)
- activeTheme: Current theme variant

SLOT CONFIGURATION:
{
  "slot_id": {
    "id": "slot_id",
    "type": "component_type",
    "parentId": "parent_slot_id",
    "position": { "row": 1, "col": 1 },
    "props": { ... component props },
    "styles": { ... inline styles },
    "tailwind": "tailwind classes",
    "visibility": { "desktop": true, "mobile": true }
  }
}

COMMON OPERATIONS:
- Hide slot: Set visibility.desktop/mobile = false
- Show slot: Set visibility = true
- Change style: Update styles or tailwind property',
'settings', '["configuration", "slots", "pages", "layout"]', 90, 'all', true),

('settings', 'Payment and Shipping Settings',
'PAYMENT METHODS (payment_methods table):
- id, store_id, name, code
- provider: stripe, paypal, manual, cod
- is_active, is_default
- configuration (JSON - API keys, settings)
- display_name, description
- sort_order

SHIPPING METHODS (shipping_methods table):
- id, store_id, name, code
- type: flat_rate, free_shipping, weight_based, price_based
- is_active, is_default
- price, free_shipping_threshold
- configuration (JSON)
- zones (JSON - country/region restrictions)

TAX RULES (taxes table):
- id, store_id, name, rate
- country, state, zip_code
- is_active, priority
- compound (boolean)

UPDATING SETTINGS:
"disable PayPal" = UPDATE payment_methods SET is_active = false WHERE code = ''paypal''
"set free shipping over $50" = UPDATE shipping_methods SET free_shipping_threshold = 50',
'settings', '["payment", "shipping", "tax", "checkout"]', 85, 'all', true),

-- ============================================
-- INTEGRATIONS
-- ============================================

('integrations', 'Akeneo PIM Integration',
'AKENEO INTEGRATION:

INTEGRATION_CONFIGS (integration_configs table):
- store_id, integration_type = ''akeneo''
- config (JSON): api_url, client_id, client_secret, username, password
- is_active, last_sync_at

AKENEO_MAPPINGS (akeneo_mappings table):
- Maps Akeneo attributes to DainoStore attributes
- source_attribute, target_attribute, mapping_type

AKENEO_SCHEDULES (akeneo_schedules table):
- Scheduled sync jobs
- schedule_type, cron_expression, is_active

IMPORT PROCESS:
1. Check integration_configs for credentials
2. Fetch data from Akeneo API
3. Map attributes using akeneo_mappings
4. Create/update products, categories, attributes
5. Log results in import_statistics

COMMANDS:
"sync akeneo" = Trigger akeneo:import:products job
"check akeneo status" = Query import_statistics for latest sync',
'integrations', '["akeneo", "pim", "import", "sync", "mapping"]', 80, 'all', true),

('integrations', 'Email System',
'EMAIL SYSTEM:

EMAIL_TEMPLATES (email_templates table):
- id, store_id, name, code
- subject, html_content, text_content
- type: order_confirmation, shipping_notification, etc.
- variables (JSON - available merge fields)
- is_active

EMAIL_SEND_LOG (email_send_logs table):
- id, store_id, template_id
- recipient_email, subject
- status: pending, sent, failed, bounced
- sent_at, error_message
- metadata (JSON)

TEMPLATE CODES:
- order_confirmation - New order
- order_shipped - Shipment notification
- order_delivered - Delivery confirmation
- password_reset - Password reset link
- welcome_email - New customer
- abandoned_cart - Cart recovery

SENDING EMAIL:
1. Load template by code
2. Replace variables with data
3. Queue email job
4. Track in email_send_log',
'integrations', '["email", "notifications", "templates", "smtp"]', 75, 'all', true),

-- ============================================
-- PLUGINS
-- ============================================

('plugins', 'Plugin System',
'PLUGIN SYSTEM:

PLUGINS (plugins table):
- id, store_id, slug (unique per store)
- name, version, description
- is_active, is_system
- entry_point, configuration (JSON)
- permissions (JSON)

PLUGIN_CONFIGURATIONS (plugin_configurations table):
- Store-specific plugin settings
- plugin_id, store_id, config (JSON)

PLUGIN LIFECYCLE:
1. Install: Download/create plugin files, register in plugins table
2. Activate: Set is_active = true, run activation hooks
3. Configure: Update plugin_configurations
4. Deactivate: Set is_active = false, run deactivation hooks
5. Uninstall: Remove files, delete from plugins table

PLUGIN HOOKS:
- before_product_save, after_product_save
- before_order_create, after_order_create
- checkout_complete
- etc.

COMMANDS:
"install plugin X" = Trigger plugin:install job
"enable plugin" = UPDATE plugins SET is_active = true
"configure plugin" = UPDATE plugin_configurations SET config = {...}',
'plugins', '["plugins", "extensions", "hooks", "customize"]', 80, 'all', true),

-- ============================================
-- CRON JOBS
-- ============================================

('cron', 'Cron Job System',
'CRON JOBS (cron_jobs table - Tenant DB):

COLUMNS:
- id, store_id, name, code
- job_type (reference to cron_job_types)
- cron_expression (standard cron format)
- is_active
- last_run_at, next_run_at
- configuration (JSON - job parameters)

CRON JOB TYPES (cron_job_types table):
- Predefined job type definitions
- code, name, handler_class
- default_cron_expression

COMMON CRON JOBS:
- cleanup_old_carts - Remove abandoned carts
- update_exchange_rates - Currency updates
- send_abandoned_cart_emails - Cart recovery
- sync_inventory - Stock updates
- generate_sitemap - SEO sitemap

CRON EXPRESSIONS:
- "0 * * * *" = Every hour
- "0 0 * * *" = Daily at midnight
- "0 0 * * 0" = Weekly on Sunday
- "*/15 * * * *" = Every 15 minutes

EXECUTION LOG (cron_job_executions):
- cron_job_id, started_at, completed_at
- status, error_message, result (JSON)',
'system', '["cron", "scheduled", "tasks", "automation"]', 75, 'all', true),

-- ============================================
-- AI INTENT EXAMPLES
-- ============================================

('intent_examples', 'Query Intent Examples',
'AI INTENT EXAMPLES - DATA QUERIES:

USER: "which product sold the most"
INTENT: analytics_query
ENTITY: products
QUERY: SELECT p.*, pt.name, p.purchase_count FROM products p
       JOIN product_translations pt ON p.id = pt.product_id
       ORDER BY purchase_count DESC LIMIT 1

USER: "show me customers from Germany"
INTENT: data_query
ENTITY: customers
QUERY: SELECT * FROM customers WHERE country = ''Germany''

USER: "how many orders today"
INTENT: analytics_query
ENTITY: orders
QUERY: SELECT COUNT(*) FROM sales_orders WHERE DATE(created_at) = CURRENT_DATE

USER: "total revenue this month"
INTENT: analytics_query
ENTITY: orders
QUERY: SELECT SUM(total_amount) FROM sales_orders
       WHERE payment_status = ''paid''
       AND created_at >= DATE_TRUNC(''month'', CURRENT_DATE)

USER: "show low stock products"
INTENT: data_query
ENTITY: products
QUERY: SELECT * FROM products WHERE stock_quantity <= low_stock_threshold

USER: "find customer john@example.com"
INTENT: data_query
ENTITY: customers
QUERY: SELECT * FROM customers WHERE email = ''john@example.com''',
'intent', '["query", "analytics", "data", "search"]', 100, 'all', true),

('intent_examples', 'Action Intent Examples',
'AI INTENT EXAMPLES - ACTIONS:

USER: "disable PayPal payments"
INTENT: admin_entity_update
ENTITY: payment_methods
ACTION: UPDATE payment_methods SET is_active = false WHERE code = ''paypal''

USER: "add a new color attribute"
INTENT: admin_entity_create
ENTITY: attributes
ACTION: INSERT INTO attributes (name, code, type, is_configurable)
        VALUES (''Color'', ''color'', ''select'', true)

USER: "run akeneo import"
INTENT: job_trigger
JOB_TYPE: akeneo:import:products
ACTION: Create job in jobs table

USER: "change breadcrumb color to blue"
INTENT: settings_update
TARGET: stores.settings.theme.breadcrumb_item_text_color
ACTION: UPDATE stores SET settings = jsonb_set(settings, ''{theme,breadcrumb_item_text_color}'', ''"#0000FF"'')

USER: "hide the quantity selector"
INTENT: layout_modify
TARGET: slot visibility
ACTION: Update slot configuration to set visibility = false

USER: "create a 20% discount coupon SUMMER20"
INTENT: admin_entity_create
ENTITY: coupons
ACTION: INSERT INTO coupons (code, discount_type, discount_value)
        VALUES (''SUMMER20'', ''percentage'', 20)',
'intent', '["actions", "update", "create", "settings"]', 100, 'all', true);

-- Add entity definitions for key tables

INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key,
  tenant_column, category, supported_operations, fields, intent_keywords,
  example_prompts, priority, is_active
) VALUES

('products', 'Products', 'Product catalog items', 'products', 'id',
 'store_id', 'catalog',
 '["list", "get", "create", "update", "delete", "bulk_update"]',
 '[{"name":"slug","type":"string"},{"name":"sku","type":"string"},{"name":"price","type":"decimal"},{"name":"compare_price","type":"decimal"},{"name":"cost_price","type":"decimal"},{"name":"status","type":"enum","values":["draft","active","inactive"]},{"name":"stock_quantity","type":"integer"},{"name":"featured","type":"boolean"},{"name":"weight","type":"decimal"},{"name":"category_ids","type":"json"},{"name":"tags","type":"json"},{"name":"images","type":"json"}]',
 '["product", "item", "sku", "catalog", "inventory", "stock", "price", "bulk", "batch", "mass update", "multiple products"]',
 '["show all products", "find product by sku", "update product price", "which product sold most", "add a new product", "create product with SKU ABC123", "delete product SKU-001", "remove product from catalog", "set price to 29.99 for SKU ABC", "change price of product X to 50", "update stock quantity to 100", "set stock to 50 for SKU-123", "mark product as featured", "unfeature product", "activate product", "deactivate product", "set product status to draft", "bulk update prices by 10%", "increase all prices by 5%", "decrease prices in category Electronics", "bulk change attribute Color to Red for all products", "set attribute Size to Large for SKU ABC", "update attribute Material to Cotton for product X", "assign category to product", "move product to category", "add tag Sale to all featured products", "bulk update stock for low inventory items", "set all out of stock products to inactive", "change SKU from OLD to NEW", "rename SKU", "update product images", "set compare price for sale items", "bulk assign attributes to products in category"]',
 100, true),

('orders', 'Orders', 'Sales orders', 'sales_orders', 'id',
 'store_id', 'sales',
 '["list", "get", "update", "cancel", "refund"]',
 '[{"name":"order_number","type":"string"},{"name":"status","type":"enum","values":["pending","processing","shipped","delivered","cancelled","refunded"]},{"name":"payment_status","type":"enum","values":["pending","paid","partially_paid","refunded","failed"]},{"name":"fulfillment_status","type":"enum"},{"name":"total_amount","type":"decimal"},{"name":"customer_email","type":"string"},{"name":"tracking_number","type":"string"},{"name":"shipping_method","type":"string"}]',
 '["order", "sale", "purchase", "transaction", "revenue", "fulfillment", "shipment", "tracking"]',
 '["show recent orders", "orders today", "pending orders", "total revenue", "find order by number", "show order ORD-12345", "update order status to shipped", "mark order as delivered", "cancel order", "refund order", "add tracking number to order", "orders from customer john@email.com", "orders this week", "orders this month", "average order value", "highest value orders", "orders pending payment", "orders ready to ship", "bulk update order status", "export orders to CSV"]',
 95, true),

('customers', 'Customers', 'Customer accounts', 'customers', 'id',
 'store_id', 'crm',
 '["list", "get", "create", "update", "delete"]',
 '[{"name":"email","type":"string"},{"name":"first_name","type":"string"},{"name":"last_name","type":"string"},{"name":"phone","type":"string"},{"name":"total_spent","type":"decimal"},{"name":"total_orders","type":"integer"},{"name":"status","type":"enum","values":["active","inactive","blocked"]},{"name":"accepts_marketing","type":"boolean"},{"name":"tags","type":"json"}]',
 '["customer", "client", "buyer", "account", "user", "contact", "subscriber"]',
 '["find customer", "top customers", "customer details", "customer orders", "find customer by email", "search customer john", "create new customer", "add customer", "update customer email", "change customer phone", "block customer", "unblock customer", "delete customer account", "customers who spent over 100", "VIP customers", "new customers this month", "inactive customers", "customers with no orders", "tag customer as VIP", "add tag to customer", "export customers", "customers who accept marketing"]',
 90, true),

('attributes', 'Attributes', 'Product attributes', 'attributes', 'id',
 'store_id', 'catalog',
 '["list", "get", "create", "update", "delete", "bulk_update"]',
 '[{"name":"name","type":"string"},{"name":"code","type":"string"},{"name":"type","type":"enum","values":["text","number","select","multiselect","boolean","date"]},{"name":"is_filterable","type":"boolean"},{"name":"is_configurable","type":"boolean"},{"name":"is_required","type":"boolean"},{"name":"is_visible","type":"boolean"},{"name":"sort_order","type":"integer"}]',
 '["attribute", "property", "filter", "option", "variant", "specification", "characteristic", "bulk attribute", "mass attribute"]',
 '["add attribute", "create color attribute", "make filterable", "list attributes", "create Size attribute with options S M L XL", "add attribute Brand", "delete attribute", "remove attribute from products", "rename attribute Material to Fabric", "add options to attribute", "add Red Blue Green to Color attribute", "make attribute required", "set attribute as configurable", "hide attribute from product page", "show attribute in filters", "bulk update attribute values", "change all Color values from Red to Crimson", "set attribute value for multiple products", "assign attribute to attribute set", "reorder attributes", "set attribute sort order"]',
 85, true),

('categories', 'Categories', 'Product categories', 'categories', 'id',
 'store_id', 'catalog',
 '["list", "get", "create", "update", "delete", "bulk_update", "reorder"]',
 '[{"name":"name","type":"string"},{"name":"slug","type":"string"},{"name":"description","type":"text"},{"name":"parent_id","type":"uuid"},{"name":"image_url","type":"string"},{"name":"is_active","type":"boolean"},{"name":"show_in_menu","type":"boolean"},{"name":"sort_order","type":"integer"},{"name":"seo","type":"json"}]',
 '["category", "collection", "department", "group", "root category", "main category", "top level category", "menu", "navigation", "catalog structure"]',
 '["show categories", "create category", "add subcategory", "hide category", "create a root category called Test Category", "add a top level category named New Arrivals", "create a main category for seasonal items", "rename category Electronics to Tech", "delete category", "remove empty category", "move category under parent", "change category parent", "reorder categories", "set category sort order", "hide category from menu", "show category in navigation", "add category image", "update category description", "set category SEO title", "bulk update category status", "activate all categories", "deactivate category and subcategories", "list root categories", "show category tree", "count products in category", "merge categories", "assign products to category", "remove products from category"]',
 85, true),

('payment_methods', 'Payment Methods', 'Payment method settings', 'payment_methods', 'id',
 'store_id', 'settings',
 '["list", "get", "create", "update", "delete"]',
 '[{"name":"name","type":"string"},{"name":"code","type":"string"},{"name":"provider","type":"enum","values":["stripe","paypal","manual","cod","bank_transfer"]},{"name":"is_active","type":"boolean"},{"name":"is_default","type":"boolean"},{"name":"min_order_amount","type":"decimal"},{"name":"max_order_amount","type":"decimal"},{"name":"sort_order","type":"integer"}]',
 '["payment", "pay", "stripe", "paypal", "checkout", "credit card", "bank transfer", "cash on delivery", "COD"]',
 '["enable PayPal", "disable payment method", "show payment methods", "add Stripe payment", "enable credit card payments", "disable cash on delivery", "set minimum order for PayPal to 50", "set maximum order amount", "make Stripe the default payment", "reorder payment methods", "configure payment gateway", "update payment settings", "list active payment methods", "enable bank transfer"]',
 80, true),

('shipping_methods', 'Shipping Methods', 'Shipping method settings', 'shipping_methods', 'id',
 'store_id', 'settings',
 '["list", "get", "create", "update", "delete"]',
 '[{"name":"name","type":"string"},{"name":"code","type":"string"},{"name":"type","type":"enum","values":["flat_rate","free_shipping","weight_based","price_based"]},{"name":"price","type":"decimal"},{"name":"free_shipping_threshold","type":"decimal"},{"name":"is_active","type":"boolean"},{"name":"estimated_days_min","type":"integer"},{"name":"estimated_days_max","type":"integer"}]',
 '["shipping", "delivery", "freight", "carrier", "express", "standard", "free shipping", "shipping rate"]',
 '["set shipping price", "enable free shipping", "show shipping methods", "add express shipping", "create standard shipping method", "set free shipping for orders over 100", "change shipping rate to 9.99", "disable international shipping", "set delivery time to 3-5 days", "add flat rate shipping", "enable weight based shipping", "update shipping zones", "set minimum order for free shipping", "bulk update shipping rates"]',
 80, true),

('coupons', 'Coupons', 'Discount coupons', 'coupons', 'id',
 'store_id', 'marketing',
 '["list", "get", "create", "update", "delete"]',
 '[{"name":"code","type":"string"},{"name":"discount_type","type":"enum","values":["percentage","fixed_amount","free_shipping"]},{"name":"discount_value","type":"decimal"},{"name":"min_order_amount","type":"decimal"},{"name":"max_uses","type":"integer"},{"name":"uses_per_customer","type":"integer"},{"name":"valid_from","type":"date"},{"name":"valid_until","type":"date"},{"name":"is_active","type":"boolean"}]',
 '["coupon", "discount", "promo", "voucher", "code", "sale", "offer", "promotion"]',
 '["create coupon", "20% discount", "free shipping coupon", "disable coupon", "create coupon SUMMER20 for 20% off", "add 10 dollar discount code", "create free shipping coupon for orders over 50", "set coupon expiry date", "limit coupon to 100 uses", "one use per customer coupon", "extend coupon validity", "deactivate expired coupons", "bulk create coupons", "delete coupon OLDCODE", "update coupon discount value", "set minimum order for coupon", "list active coupons", "show expired coupons"]',
 80, true),

('theme_settings', 'Theme Settings', 'Store theme and appearance settings', 'stores', 'id',
 NULL, 'design',
 '["get", "update"]',
 '[{"name":"primary_color","type":"color"},{"name":"secondary_color","type":"color"},{"name":"accent_color","type":"color"},{"name":"text_color","type":"color"},{"name":"background_color","type":"color"},{"name":"font_family","type":"string"},{"name":"breadcrumb_item_text_color","type":"color"},{"name":"breadcrumb_show_home_icon","type":"boolean"},{"name":"header_bg_color","type":"color"},{"name":"add_to_cart_button_color","type":"color"}]',
 '["theme", "color", "font", "breadcrumb", "style", "appearance", "design", "branding", "look and feel"]',
 '["change breadcrumb color", "set primary color", "change font", "hide breadcrumb icon", "set primary color to blue", "change background color to white", "update header color", "set add to cart button color to green", "change font to Roboto", "update accent color", "set text color to dark gray", "change secondary color", "update brand colors", "set link color", "change button hover color"]',
 90, true);

-- Update existing entries
UPDATE ai_context_documents SET is_active = true WHERE type IN ('database_schema', 'e-commerce', 'analytics', 'jobs', 'settings', 'integrations', 'plugins', 'cron', 'intent_examples');
UPDATE ai_entity_definitions SET is_active = true WHERE entity_name IN ('products', 'orders', 'customers', 'attributes', 'categories', 'payment_methods', 'shipping_methods', 'coupons', 'theme_settings');

-- ============================================
-- AI AUTOMATIC TRAINING SYSTEM DOCUMENTATION
-- ============================================
INSERT INTO ai_context_documents (type, title, content, category, tags, priority, mode, is_active) VALUES
('system', 'AI Automatic Training System',
'AI AUTOMATIC TRAINING SYSTEM:

The system automatically captures real user prompts and validates them for training data.

FLOW:
1. User sends prompt to AI chat
2. AI processes and executes action
3. System captures prompt as training candidate
4. Outcome is tracked (success/failure/reverted)
5. Auto-validation rules check the candidate
6. Approved candidates are promoted to entity definitions

TABLES:
- ai_training_candidates: Stores captured prompts awaiting validation
- ai_training_validations: Tracks validation attempts
- ai_training_rules: Configurable auto-approval rules
- ai_training_metrics: Aggregate metrics

AUTO-APPROVAL RULES:
- 3+ successes with 0 failures → Auto-approve
- Positive user feedback + 1 success → Auto-approve
- Confidence < 0.6 → Flag for manual review
- 3+ failures → Auto-reject
- Action reverted → Auto-reject

API ENDPOINTS:
- GET /api/ai/training/candidates - List candidates for review
- GET /api/ai/training/metrics - Get training statistics
- POST /api/ai/training/candidates/:id/approve - Manual approve
- POST /api/ai/training/candidates/:id/reject - Manual reject
- POST /api/ai/training/promote - Promote approved to training data
- POST /api/ai/training/candidates/:id/feedback - Record user feedback

PROMOTION PROCESS:
When a candidate is approved (auto or manual), it can be promoted to
add its prompt to the entity_definitions.example_prompts array.
This improves future intent detection for similar requests.',
'system', '["training", "learning", "auto-training", "validation"]', 85, 'all', true)
ON CONFLICT DO NOTHING;
