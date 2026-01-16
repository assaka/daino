-- Seed AI Entity Definitions with Related Tables
-- This provides Claude with accurate database schema information
-- Run in Supabase SQL Editor (Master DB)

-- Clear existing entries for these entities
DELETE FROM ai_entity_definitions WHERE entity_name IN (
  'product', 'category', 'order', 'customer', 'attribute', 'coupon'
);

-- PRODUCTS
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key, tenant_column,
  related_tables, supported_operations, fields, intent_keywords, example_prompts,
  category, priority, is_active
) VALUES (
  'product',
  'Product',
  'Store products with inventory, pricing, and status. Names/descriptions are in product_translations table.',
  'products',
  'id',
  'store_id',
  '["product_translations", "product_attribute_values", "product_images"]',
  '["list", "get", "create", "update", "delete"]',
  '[
    {"name": "id", "type": "uuid", "description": "Product ID"},
    {"name": "sku", "type": "string", "description": "Stock Keeping Unit - unique identifier"},
    {"name": "price", "type": "decimal", "description": "Current price"},
    {"name": "compare_price", "type": "decimal", "description": "Original/compare price for sales"},
    {"name": "stock_quantity", "type": "integer", "description": "Current stock level"},
    {"name": "low_stock_threshold", "type": "integer", "description": "Alert threshold"},
    {"name": "status", "type": "enum", "values": ["active", "draft", "archived"], "description": "Product status"},
    {"name": "featured", "type": "boolean", "description": "Featured on homepage"},
    {"name": "manage_stock", "type": "boolean", "description": "Track inventory"},
    {"name": "category_ids", "type": "jsonb", "description": "Array of category UUIDs"}
  ]',
  '["product", "item", "sku", "stock", "inventory", "price", "catalog"]',
  '[
    "set stock of [sku] to [number]",
    "update price of [product] to [amount]",
    "list products with low stock",
    "show out of stock products",
    "make [product] featured"
  ]',
  'catalog',
  100,
  true
);

-- PRODUCT_TRANSLATIONS (related table)
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key, tenant_column,
  related_tables, supported_operations, fields, intent_keywords, example_prompts,
  category, priority, is_active
) VALUES (
  'product_translation',
  'Product Translation',
  'Product names and descriptions by language. Join with products table on product_id.',
  'product_translations',
  'id',
  NULL,
  '["products"]',
  '["list", "get", "create", "update"]',
  '[
    {"name": "id", "type": "uuid", "description": "Translation ID"},
    {"name": "product_id", "type": "uuid", "description": "FK to products.id"},
    {"name": "language_code", "type": "string", "description": "e.g., en, de, fr"},
    {"name": "name", "type": "string", "description": "Product name in this language"},
    {"name": "description", "type": "text", "description": "Product description"}
  ]',
  '["translation", "name", "description", "language"]',
  '[]',
  'catalog',
  90,
  true
);

-- CATEGORIES
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key, tenant_column,
  related_tables, supported_operations, fields, intent_keywords, example_prompts,
  category, priority, is_active
) VALUES (
  'category',
  'Category',
  'Product categories with hierarchy support. Names are in category_translations table.',
  'categories',
  'id',
  'store_id',
  '["category_translations"]',
  '["list", "get", "create", "update", "delete"]',
  '[
    {"name": "id", "type": "uuid", "description": "Category ID"},
    {"name": "slug", "type": "string", "description": "URL-friendly identifier"},
    {"name": "parent_id", "type": "uuid", "description": "Parent category for hierarchy"},
    {"name": "is_active", "type": "boolean", "description": "Category visible/active"},
    {"name": "hide_in_menu", "type": "boolean", "description": "Hide from navigation"},
    {"name": "sort_order", "type": "integer", "description": "Display order"},
    {"name": "product_count", "type": "integer", "description": "Number of products"}
  ]',
  '["category", "categories", "collection", "navigation", "menu"]',
  '[
    "set category [name] to visible",
    "hide category [name]",
    "list all categories",
    "show hidden categories"
  ]',
  'catalog',
  95,
  true
);

-- CATEGORY_TRANSLATIONS (related table)
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key, tenant_column,
  related_tables, supported_operations, fields, intent_keywords, example_prompts,
  category, priority, is_active
) VALUES (
  'category_translation',
  'Category Translation',
  'Category names and descriptions by language. Join with categories on category_id.',
  'category_translations',
  'id',
  NULL,
  '["categories"]',
  '["list", "get", "create", "update"]',
  '[
    {"name": "id", "type": "uuid", "description": "Translation ID"},
    {"name": "category_id", "type": "uuid", "description": "FK to categories.id"},
    {"name": "language_code", "type": "string", "description": "e.g., en, de, fr"},
    {"name": "name", "type": "string", "description": "Category name"}
  ]',
  '["translation", "name", "language"]',
  '[]',
  'catalog',
  85,
  true
);

-- ORDERS
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key, tenant_column,
  related_tables, supported_operations, fields, intent_keywords, example_prompts,
  category, priority, is_active
) VALUES (
  'order',
  'Order',
  'Customer orders with status tracking and payment info.',
  'orders',
  'id',
  'store_id',
  '["order_items", "customers"]',
  '["list", "get", "update"]',
  '[
    {"name": "id", "type": "uuid", "description": "Order ID"},
    {"name": "order_number", "type": "string", "description": "Human-readable order number"},
    {"name": "customer_id", "type": "uuid", "description": "FK to customers"},
    {"name": "total", "type": "decimal", "description": "Order total"},
    {"name": "status", "type": "enum", "values": ["pending", "processing", "completed", "cancelled", "refunded"]},
    {"name": "payment_status", "type": "enum", "values": ["pending", "paid", "failed", "refunded"]},
    {"name": "fulfillment_status", "type": "enum", "values": ["unfulfilled", "partial", "fulfilled", "shipped", "delivered"]},
    {"name": "tracking_number", "type": "string", "description": "Shipping tracking"},
    {"name": "created_at", "type": "timestamp", "description": "Order date"}
  ]',
  '["order", "orders", "sale", "purchase", "transaction"]',
  '[
    "show recent orders",
    "list pending orders",
    "update order [number] status to shipped",
    "how many orders today"
  ]',
  'orders',
  90,
  true
);

-- CUSTOMERS
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key, tenant_column,
  related_tables, supported_operations, fields, intent_keywords, example_prompts,
  category, priority, is_active
) VALUES (
  'customer',
  'Customer',
  'Store customers with contact information.',
  'customers',
  'id',
  'store_id',
  '["orders", "addresses"]',
  '["list", "get", "update"]',
  '[
    {"name": "id", "type": "uuid", "description": "Customer ID"},
    {"name": "email", "type": "string", "description": "Email address"},
    {"name": "first_name", "type": "string", "description": "First name"},
    {"name": "last_name", "type": "string", "description": "Last name"},
    {"name": "phone", "type": "string", "description": "Phone number"},
    {"name": "created_at", "type": "timestamp", "description": "Registration date"}
  ]',
  '["customer", "customers", "user", "buyer", "client"]',
  '[
    "list customers",
    "search customer by email",
    "show customer [email]"
  ]',
  'customers',
  80,
  true
);

-- ATTRIBUTES
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key, tenant_column,
  related_tables, supported_operations, fields, intent_keywords, example_prompts,
  category, priority, is_active
) VALUES (
  'attribute',
  'Attribute',
  'Product attributes like Color, Size. Has translations JSONB for name. Values stored in values JSONB array.',
  'attributes',
  'id',
  'store_id',
  '["product_attribute_values"]',
  '["list", "get", "create", "update", "delete"]',
  '[
    {"name": "id", "type": "uuid", "description": "Attribute ID"},
    {"name": "code", "type": "string", "description": "Unique code like color, size"},
    {"name": "type", "type": "enum", "values": ["select", "multiselect", "text", "number", "boolean"]},
    {"name": "translations", "type": "jsonb", "description": "Name translations: {en: {name: \"Color\"}}"},
    {"name": "values", "type": "jsonb", "description": "Predefined values array"},
    {"name": "is_filterable", "type": "boolean", "description": "Show in filters"},
    {"name": "is_visible", "type": "boolean", "description": "Show on product page"}
  ]',
  '["attribute", "attributes", "color", "size", "variant", "option"]',
  '[
    "create attribute Color with values Red, Blue, Green",
    "list all attributes",
    "delete attribute [code]"
  ]',
  'catalog',
  75,
  true
);

-- COUPONS
INSERT INTO ai_entity_definitions (
  entity_name, display_name, description, table_name, primary_key, tenant_column,
  related_tables, supported_operations, fields, intent_keywords, example_prompts,
  category, priority, is_active
) VALUES (
  'coupon',
  'Coupon',
  'Discount codes for checkout.',
  'coupons',
  'id',
  'store_id',
  '[]',
  '["list", "get", "create", "update", "delete"]',
  '[
    {"name": "id", "type": "uuid", "description": "Coupon ID"},
    {"name": "code", "type": "string", "description": "Coupon code (uppercase)"},
    {"name": "discount_type", "type": "enum", "values": ["percentage", "fixed"]},
    {"name": "discount_value", "type": "decimal", "description": "Discount amount or percentage"},
    {"name": "min_order_amount", "type": "decimal", "description": "Minimum order for coupon"},
    {"name": "max_uses", "type": "integer", "description": "Maximum total uses"},
    {"name": "uses_count", "type": "integer", "description": "Times used"},
    {"name": "is_active", "type": "boolean", "description": "Coupon enabled"},
    {"name": "expires_at", "type": "timestamp", "description": "Expiration date"}
  ]',
  '["coupon", "discount", "promo", "code", "voucher"]',
  '[
    "create coupon SAVE10 for 10% off",
    "list active coupons",
    "delete coupon [code]"
  ]',
  'marketing',
  70,
  true
);

-- Verify
SELECT entity_name, table_name, related_tables FROM ai_entity_definitions
WHERE entity_name IN ('product', 'product_translation', 'category', 'category_translation', 'order', 'customer', 'attribute', 'coupon')
ORDER BY priority DESC;
