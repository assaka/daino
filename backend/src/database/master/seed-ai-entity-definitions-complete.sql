-- Complete AI Entity Definitions for ALL Tables
-- This provides Claude with accurate database schema information
-- Run in Supabase SQL Editor (Master DB)

-- Clear ALL existing entries
DELETE FROM ai_entity_definitions;

-- ═══════════════════════════════════════════════════════════════
-- STORE SETTINGS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('store', 'Store', 'Store configuration with settings including theme. settings JSON contains: theme, currency, timezone, etc.', 'stores', 'id', NULL,
 '["languages", "slot_configurations"]',
 '["get", "update"]',
 '[
   {"name": "id", "type": "uuid", "description": "Store ID"},
   {"name": "name", "type": "string", "description": "Store name"},
   {"name": "slug", "type": "string", "description": "URL slug"},
   {"name": "description", "type": "text", "description": "Store description"},
   {"name": "currency", "type": "string", "description": "Default currency (USD, EUR, etc.)"},
   {"name": "timezone", "type": "string", "description": "Store timezone"},
   {"name": "is_active", "type": "boolean", "description": "Store active status"},
   {"name": "settings", "type": "json", "description": "Store settings JSON including theme, logo, colors, etc."},
   {"name": "published", "type": "boolean", "description": "Is store published"},
   {"name": "deployment_status", "type": "enum", "values": ["draft", "pending", "deployed"]}
 ]',
 '["store", "shop", "settings", "theme", "configuration", "currency", "timezone"]',
 '["update store theme", "change currency to EUR", "get store settings", "update store name"]',
 'settings', 100, true);

-- ═══════════════════════════════════════════════════════════════
-- CATALOG - PRODUCTS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('product', 'Product', 'Store products with inventory, pricing, and status. Names/descriptions in product_translations table.', 'products', 'id', 'store_id',
 '["product_translations", "product_attribute_values", "product_files", "product_seo", "product_variants"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid", "description": "Product ID"},
   {"name": "sku", "type": "string", "description": "Stock Keeping Unit"},
   {"name": "slug", "type": "string", "description": "URL slug"},
   {"name": "price", "type": "decimal", "description": "Current price"},
   {"name": "compare_price", "type": "decimal", "description": "Original/compare price for sales"},
   {"name": "cost_price", "type": "decimal", "description": "Cost price for profit calculation"},
   {"name": "stock_quantity", "type": "integer", "description": "Current stock level"},
   {"name": "low_stock_threshold", "type": "integer", "description": "Alert threshold"},
   {"name": "status", "type": "enum", "values": ["active", "draft", "archived"]},
   {"name": "featured", "type": "boolean", "description": "Featured on homepage"},
   {"name": "manage_stock", "type": "boolean", "description": "Track inventory"},
   {"name": "category_ids", "type": "jsonb", "description": "Array of category UUIDs"},
   {"name": "type", "type": "enum", "values": ["simple", "configurable", "virtual", "bundle"]}
 ]',
 '["product", "item", "sku", "stock", "inventory", "price", "catalog"]',
 '["set stock of [sku] to [number]", "update price of [product]", "list low stock products", "make [product] featured"]',
 'catalog', 100, true),

('product_translation', 'Product Translation', 'Product names and descriptions by language. Join with products on product_id.', 'product_translations', 'id', NULL,
 '["products"]',
 '["list", "get", "create", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "product_id", "type": "uuid", "description": "FK to products.id"},
   {"name": "language_code", "type": "string", "description": "e.g., en, de, fr"},
   {"name": "name", "type": "string", "description": "Product name"},
   {"name": "description", "type": "text", "description": "Product description"},
   {"name": "short_description", "type": "text"}
 ]',
 '["translation", "name", "description", "language"]', '[]', 'catalog', 95, true),

('product_file', 'Product File', 'Product images, videos, and documents. References media_assets.', 'product_files', 'id', 'store_id',
 '["products", "media_assets"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "product_id", "type": "uuid"},
   {"name": "media_asset_id", "type": "uuid", "description": "FK to media_assets"},
   {"name": "file_type", "type": "enum", "values": ["image", "video", "document", "3d_model", "pdf"]},
   {"name": "position", "type": "integer", "description": "Display order"},
   {"name": "is_primary", "type": "boolean", "description": "Main product image"},
   {"name": "alt_text", "type": "text"}
 ]',
 '["image", "photo", "video", "media", "file"]', '[]', 'catalog', 85, true),

('product_variant', 'Product Variant', 'Configurable product variants (size, color combinations).', 'product_variants', 'id', NULL,
 '["products"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "parent_product_id", "type": "uuid", "description": "Parent configurable product"},
   {"name": "variant_product_id", "type": "uuid", "description": "Variant product"},
   {"name": "attribute_values", "type": "jsonb", "description": "Attribute combination"},
   {"name": "sort_order", "type": "integer"},
   {"name": "is_active", "type": "boolean"}
 ]',
 '["variant", "option", "size", "color"]', '[]', 'catalog', 80, true),

('product_seo', 'Product SEO', 'Product SEO metadata by language.', 'product_seo', 'product_id', NULL,
 '["products"]',
 '["get", "update"]',
 '[
   {"name": "product_id", "type": "uuid"},
   {"name": "language_code", "type": "string"},
   {"name": "meta_title", "type": "string"},
   {"name": "meta_description", "type": "text"},
   {"name": "meta_keywords", "type": "string"},
   {"name": "og_title", "type": "string"},
   {"name": "og_description", "type": "text"},
   {"name": "canonical_url", "type": "string"}
 ]',
 '["seo", "meta", "title", "description"]', '[]', 'catalog', 75, true),

('product_label', 'Product Label', 'Product badges/labels (Sale, New, etc.). Text in product_label_translations.', 'product_labels', 'id', 'store_id',
 '["product_label_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string", "description": "Label name"},
   {"name": "slug", "type": "string"},
   {"name": "text", "type": "string", "description": "Display text"},
   {"name": "color", "type": "string", "description": "Text color hex"},
   {"name": "background_color", "type": "string", "description": "Background color hex"},
   {"name": "position", "type": "enum", "values": ["top-left", "top-right", "bottom-left", "bottom-right"]},
   {"name": "is_active", "type": "boolean"},
   {"name": "conditions", "type": "json", "description": "Auto-apply conditions"},
   {"name": "priority", "type": "integer"}
 ]',
 '["label", "badge", "tag", "sale", "new"]',
 '["create label Sale", "list product labels", "update label color"]',
 'catalog', 70, true),

('product_tab', 'Product Tab', 'Custom product page tabs. Content in product_tab_translations.', 'product_tabs', 'id', 'store_id',
 '["product_tab_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "slug", "type": "string"},
   {"name": "content", "type": "text"},
   {"name": "sort_order", "type": "integer"},
   {"name": "is_active", "type": "boolean"},
   {"name": "tab_type", "type": "enum", "values": ["text", "attributes"]},
   {"name": "attribute_ids", "type": "jsonb"}
 ]',
 '["tab", "content", "description"]', '[]', 'catalog', 65, true);

-- ═══════════════════════════════════════════════════════════════
-- CATALOG - CATEGORIES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('category', 'Category', 'Product categories with hierarchy. Names in category_translations table.', 'categories', 'id', 'store_id',
 '["category_translations", "category_seo"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "slug", "type": "string"},
   {"name": "parent_id", "type": "uuid", "description": "Parent category for hierarchy"},
   {"name": "is_active", "type": "boolean", "description": "Category visible"},
   {"name": "hide_in_menu", "type": "boolean", "description": "Hide from navigation"},
   {"name": "sort_order", "type": "integer"},
   {"name": "product_count", "type": "integer"},
   {"name": "level", "type": "integer", "description": "Hierarchy level"},
   {"name": "path", "type": "text", "description": "Full category path"}
 ]',
 '["category", "categories", "collection", "navigation", "menu"]',
 '["set category [name] to visible", "hide category", "list categories", "create category"]',
 'catalog', 95, true),

('category_translation', 'Category Translation', 'Category names by language.', 'category_translations', 'category_id,language_code', NULL,
 '["categories"]',
 '["list", "get", "create", "update"]',
 '[
   {"name": "category_id", "type": "uuid"},
   {"name": "language_code", "type": "string"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"}
 ]',
 '["translation", "name", "language"]', '[]', 'catalog', 90, true),

('category_seo', 'Category SEO', 'Category SEO metadata.', 'category_seo', 'category_id', NULL,
 '["categories"]',
 '["get", "update"]',
 '[
   {"name": "category_id", "type": "uuid"},
   {"name": "language_code", "type": "string"},
   {"name": "meta_title", "type": "string"},
   {"name": "meta_description", "type": "text"},
   {"name": "meta_keywords", "type": "string"},
   {"name": "og_title", "type": "string"},
   {"name": "canonical_url", "type": "string"}
 ]',
 '["seo", "meta"]', '[]', 'catalog', 85, true);

-- ═══════════════════════════════════════════════════════════════
-- CATALOG - ATTRIBUTES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('attribute', 'Attribute', 'Product attributes (Color, Size). Names in attribute_translations. Values in attribute_values.', 'attributes', 'id', 'store_id',
 '["attribute_translations", "attribute_values", "attribute_value_translations", "product_attribute_values"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "code", "type": "string", "description": "Unique code like color, size"},
   {"name": "type", "type": "enum", "values": ["select", "multiselect", "text", "number", "boolean", "date", "file"]},
   {"name": "is_required", "type": "boolean"},
   {"name": "is_filterable", "type": "boolean", "description": "Show in filters"},
   {"name": "is_searchable", "type": "boolean"},
   {"name": "is_configurable", "type": "boolean", "description": "Used for variants"},
   {"name": "sort_order", "type": "integer"}
 ]',
 '["attribute", "color", "size", "variant", "option", "filter"]',
 '["create attribute Color", "list attributes", "make attribute filterable"]',
 'catalog', 80, true),

('attribute_translation', 'Attribute Translation', 'Attribute labels by language.', 'attribute_translations', 'id', NULL,
 '["attributes"]',
 '["list", "get", "create", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "attribute_id", "type": "uuid"},
   {"name": "language_code", "type": "string"},
   {"name": "label", "type": "string", "description": "Attribute display name"},
   {"name": "description", "type": "text"}
 ]',
 '["translation", "label"]', '[]', 'catalog', 75, true),

('attribute_value', 'Attribute Value', 'Predefined values for attributes (Red, Blue). Labels in attribute_value_translations.', 'attribute_values', 'id', NULL,
 '["attributes", "attribute_value_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "attribute_id", "type": "uuid"},
   {"name": "code", "type": "string", "description": "Value code"},
   {"name": "sort_order", "type": "integer"},
   {"name": "metadata", "type": "json"}
 ]',
 '["value", "option"]', '[]', 'catalog', 70, true),

('attribute_set', 'Attribute Set', 'Groups of attributes for product types.', 'attribute_sets', 'id', 'store_id',
 '["attributes"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "is_default", "type": "boolean"},
   {"name": "sort_order", "type": "integer"},
   {"name": "attribute_ids", "type": "jsonb", "description": "Array of attribute UUIDs"}
 ]',
 '["attribute set", "product type", "template"]', '[]', 'catalog', 65, true),

('product_attribute_value', 'Product Attribute Value', 'Attribute values assigned to products.', 'product_attribute_values', 'id', NULL,
 '["products", "attributes", "attribute_values"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "product_id", "type": "uuid"},
   {"name": "attribute_id", "type": "uuid"},
   {"name": "value_id", "type": "uuid", "description": "FK to attribute_values for select types"},
   {"name": "text_value", "type": "text", "description": "For text attributes"},
   {"name": "number_value", "type": "decimal", "description": "For number attributes"},
   {"name": "boolean_value", "type": "boolean"}
 ]',
 '["attribute value", "product attribute"]', '[]', 'catalog', 60, true);

-- ═══════════════════════════════════════════════════════════════
-- ORDERS & SALES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('order', 'Order', 'Customer orders with status tracking.', 'sales_orders', 'id', 'store_id',
 '["sales_order_items", "customers", "sales_invoices", "sales_shipments"]',
 '["list", "get", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "order_number", "type": "string"},
   {"name": "customer_id", "type": "uuid"},
   {"name": "customer_email", "type": "string"},
   {"name": "status", "type": "enum", "values": ["pending", "processing", "completed", "cancelled", "refunded"]},
   {"name": "payment_status", "type": "enum", "values": ["pending", "paid", "failed", "refunded"]},
   {"name": "fulfillment_status", "type": "enum", "values": ["pending", "processing", "shipped", "delivered"]},
   {"name": "subtotal", "type": "decimal"},
   {"name": "tax_amount", "type": "decimal"},
   {"name": "shipping_amount", "type": "decimal"},
   {"name": "discount_amount", "type": "decimal"},
   {"name": "total_amount", "type": "decimal"},
   {"name": "currency", "type": "string"},
   {"name": "tracking_number", "type": "string"},
   {"name": "shipping_address", "type": "json"},
   {"name": "billing_address", "type": "json"}
 ]',
 '["order", "sale", "purchase", "transaction"]',
 '["show recent orders", "list pending orders", "update order status", "how many orders today"]',
 'orders', 100, true),

('order_item', 'Order Item', 'Line items in an order.', 'sales_order_items', 'id', NULL,
 '["sales_orders", "products"]',
 '["list", "get"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "order_id", "type": "uuid"},
   {"name": "product_id", "type": "uuid"},
   {"name": "product_name", "type": "string"},
   {"name": "product_sku", "type": "string"},
   {"name": "quantity", "type": "integer"},
   {"name": "unit_price", "type": "decimal"},
   {"name": "total_price", "type": "decimal"},
   {"name": "product_attributes", "type": "json"}
 ]',
 '["item", "line item"]', '[]', 'orders', 90, true),

('invoice', 'Invoice', 'Sales invoices for orders.', 'sales_invoices', 'id', 'store_id',
 '["sales_orders"]',
 '["list", "get", "create"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "invoice_number", "type": "string"},
   {"name": "order_id", "type": "uuid"},
   {"name": "customer_email", "type": "string"},
   {"name": "pdf_url", "type": "text"},
   {"name": "email_status", "type": "enum", "values": ["pending", "sent", "failed"]},
   {"name": "sent_at", "type": "timestamp"}
 ]',
 '["invoice", "bill"]', '[]', 'orders', 80, true),

('shipment', 'Shipment', 'Shipping information for orders.', 'sales_shipments', 'id', 'store_id',
 '["sales_orders"]',
 '["list", "get", "create", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "shipment_number", "type": "string"},
   {"name": "order_id", "type": "uuid"},
   {"name": "tracking_number", "type": "string"},
   {"name": "tracking_url", "type": "text"},
   {"name": "carrier", "type": "string"},
   {"name": "shipping_method", "type": "string"},
   {"name": "estimated_delivery_date", "type": "timestamp"},
   {"name": "actual_delivery_date", "type": "timestamp"}
 ]',
 '["shipment", "shipping", "tracking", "delivery"]', '[]', 'orders', 75, true),

('cart', 'Cart', 'Shopping carts.', 'carts', 'id', 'store_id',
 '[]',
 '["list", "get", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "session_id", "type": "string"},
   {"name": "user_id", "type": "uuid"},
   {"name": "items", "type": "json"},
   {"name": "subtotal", "type": "decimal"},
   {"name": "tax", "type": "decimal"},
   {"name": "shipping", "type": "decimal"},
   {"name": "discount", "type": "decimal"},
   {"name": "total", "type": "decimal"},
   {"name": "coupon_code", "type": "string"},
   {"name": "expires_at", "type": "timestamp"}
 ]',
 '["cart", "basket"]', '[]', 'orders', 70, true);

-- ═══════════════════════════════════════════════════════════════
-- CUSTOMERS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('customer', 'Customer', 'Store customers.', 'customers', 'id', 'store_id',
 '["customer_addresses", "sales_orders", "wishlists"]',
 '["list", "get", "create", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "email", "type": "string"},
   {"name": "first_name", "type": "string"},
   {"name": "last_name", "type": "string"},
   {"name": "phone", "type": "string"},
   {"name": "total_spent", "type": "decimal"},
   {"name": "total_orders", "type": "integer"},
   {"name": "average_order_value", "type": "decimal"},
   {"name": "last_order_date", "type": "timestamp"},
   {"name": "tags", "type": "jsonb"},
   {"name": "is_active", "type": "boolean"},
   {"name": "customer_type", "type": "enum", "values": ["guest", "registered"]},
   {"name": "is_blacklisted", "type": "boolean"}
 ]',
 '["customer", "user", "buyer", "client"]',
 '["list customers", "search customer by email", "show top customers"]',
 'customers', 100, true),

('customer_address', 'Customer Address', 'Customer shipping/billing addresses.', 'customer_addresses', 'id', NULL,
 '["customers"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "customer_id", "type": "uuid"},
   {"name": "type", "type": "enum", "values": ["shipping", "billing", "both"]},
   {"name": "full_name", "type": "string"},
   {"name": "company", "type": "string"},
   {"name": "street", "type": "string"},
   {"name": "city", "type": "string"},
   {"name": "state", "type": "string"},
   {"name": "postal_code", "type": "string"},
   {"name": "country", "type": "string"},
   {"name": "phone", "type": "string"},
   {"name": "is_default", "type": "boolean"}
 ]',
 '["address", "shipping address", "billing address"]', '[]', 'customers', 90, true),

('wishlist', 'Wishlist', 'Customer wishlists.', 'wishlists', 'id', 'store_id',
 '["customers", "products"]',
 '["list", "get", "create", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "user_id", "type": "uuid"},
   {"name": "product_id", "type": "uuid"},
   {"name": "session_id", "type": "string"},
   {"name": "added_at", "type": "timestamp"}
 ]',
 '["wishlist", "favorites", "saved"]', '[]', 'customers', 80, true);

-- ═══════════════════════════════════════════════════════════════
-- CUSTOMER SEGMENTATION & CRM
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('customer_segment', 'Customer Segment', 'Customer segments for marketing.', 'customer_segments', 'id', 'store_id',
 '["customer_segment_members"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "segment_type", "type": "enum", "values": ["dynamic", "static"]},
   {"name": "filters", "type": "jsonb", "description": "Segment filter rules"},
   {"name": "rfm_config", "type": "jsonb"},
   {"name": "customer_count", "type": "integer"},
   {"name": "is_active", "type": "boolean"}
 ]',
 '["segment", "group", "audience"]', '[]', 'customers', 75, true),

('customer_rfm_score', 'Customer RFM Score', 'RFM (Recency, Frequency, Monetary) scores.', 'customer_rfm_scores', 'id', 'store_id',
 '["customers"]',
 '["list", "get"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "customer_id", "type": "uuid"},
   {"name": "recency_score", "type": "integer", "description": "1-5 score"},
   {"name": "frequency_score", "type": "integer"},
   {"name": "monetary_score", "type": "integer"},
   {"name": "rfm_score", "type": "string", "description": "Combined score like 555"},
   {"name": "rfm_segment", "type": "string", "description": "Champions, At Risk, etc."}
 ]',
 '["rfm", "score", "value"]', '[]', 'customers', 70, true),

('crm_lead', 'CRM Lead', 'Sales leads.', 'crm_leads', 'id', 'store_id',
 '["crm_deals", "crm_activities"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "email", "type": "string"},
   {"name": "first_name", "type": "string"},
   {"name": "last_name", "type": "string"},
   {"name": "company", "type": "string"},
   {"name": "phone", "type": "string"},
   {"name": "source", "type": "string"},
   {"name": "status", "type": "enum", "values": ["new", "contacted", "qualified", "converted", "lost"]},
   {"name": "score", "type": "integer"},
   {"name": "assigned_to", "type": "uuid"}
 ]',
 '["lead", "prospect"]', '[]', 'crm', 65, true),

('crm_deal', 'CRM Deal', 'Sales deals/opportunities.', 'crm_deals', 'id', 'store_id',
 '["crm_pipelines", "crm_pipeline_stages", "crm_leads", "customers"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "pipeline_id", "type": "uuid"},
   {"name": "stage_id", "type": "uuid"},
   {"name": "customer_id", "type": "uuid"},
   {"name": "lead_id", "type": "uuid"},
   {"name": "value", "type": "decimal"},
   {"name": "probability", "type": "integer"},
   {"name": "expected_close_date", "type": "date"},
   {"name": "status", "type": "enum", "values": ["open", "won", "lost"]}
 ]',
 '["deal", "opportunity", "pipeline"]', '[]', 'crm', 60, true),

('crm_pipeline', 'CRM Pipeline', 'Sales pipelines.', 'crm_pipelines', 'id', 'store_id',
 '["crm_pipeline_stages", "crm_deals"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "is_default", "type": "boolean"},
   {"name": "is_active", "type": "boolean"},
   {"name": "sort_order", "type": "integer"}
 ]',
 '["pipeline", "sales pipeline"]', '[]', 'crm', 55, true);

-- ═══════════════════════════════════════════════════════════════
-- MARKETING - COUPONS & PROMOTIONS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('coupon', 'Coupon', 'Discount codes for checkout.', 'coupons', 'id', 'store_id',
 '["coupon_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "code", "type": "string", "description": "Coupon code (uppercase)"},
   {"name": "name", "type": "string"},
   {"name": "discount_type", "type": "enum", "values": ["percentage", "fixed"]},
   {"name": "discount_value", "type": "decimal"},
   {"name": "min_purchase_amount", "type": "decimal"},
   {"name": "max_discount_amount", "type": "decimal"},
   {"name": "usage_limit", "type": "integer"},
   {"name": "usage_count", "type": "integer"},
   {"name": "is_active", "type": "boolean"},
   {"name": "start_date", "type": "date"},
   {"name": "end_date", "type": "date"},
   {"name": "applicable_products", "type": "jsonb"},
   {"name": "applicable_categories", "type": "jsonb"}
 ]',
 '["coupon", "discount", "promo", "code", "voucher"]',
 '["create coupon SAVE10 for 10% off", "list active coupons", "delete coupon"]',
 'marketing', 90, true),

('custom_option_rule', 'Custom Option Rule', 'Rules for showing optional products.', 'custom_option_rules', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "display_label", "type": "string"},
   {"name": "is_active", "type": "boolean"},
   {"name": "conditions", "type": "jsonb"},
   {"name": "optional_product_ids", "type": "jsonb"}
 ]',
 '["custom option", "upsell", "cross-sell"]', '[]', 'marketing', 70, true);

-- ═══════════════════════════════════════════════════════════════
-- EMAIL MARKETING
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('email_template', 'Email Template', 'Transactional email templates. Content in email_template_translations.', 'email_templates', 'id', 'store_id',
 '["email_template_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "identifier", "type": "string", "description": "Template identifier like order_confirmation"},
   {"name": "content_type", "type": "enum", "values": ["template", "html"]},
   {"name": "variables", "type": "json", "description": "Available template variables"},
   {"name": "is_active", "type": "boolean"},
   {"name": "is_system", "type": "boolean"},
   {"name": "default_subject", "type": "string"},
   {"name": "default_template_content", "type": "text"}
 ]',
 '["email", "template", "notification"]',
 '["list email templates", "update order confirmation email"]',
 'marketing', 85, true),

('email_campaign', 'Email Campaign', 'Marketing email campaigns.', 'email_campaigns', 'id', 'store_id',
 '["email_campaign_recipients", "customer_segments"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "subject", "type": "string"},
   {"name": "from_name", "type": "string"},
   {"name": "from_email", "type": "string"},
   {"name": "html_content", "type": "text"},
   {"name": "status", "type": "enum", "values": ["draft", "scheduled", "sending", "sent", "paused"]},
   {"name": "campaign_type", "type": "enum", "values": ["broadcast", "automated", "triggered"]},
   {"name": "segment_id", "type": "uuid"},
   {"name": "scheduled_at", "type": "timestamp"},
   {"name": "total_recipients", "type": "integer"},
   {"name": "sent_count", "type": "integer"},
   {"name": "open_count", "type": "integer"},
   {"name": "click_count", "type": "integer"}
 ]',
 '["campaign", "newsletter", "email marketing"]', '[]', 'marketing', 80, true),

('automation_workflow', 'Automation Workflow', 'Marketing automation workflows.', 'automation_workflows', 'id', 'store_id',
 '["automation_enrollments", "automation_logs"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "trigger_type", "type": "string", "description": "e.g., abandoned_cart, new_customer"},
   {"name": "trigger_config", "type": "jsonb"},
   {"name": "steps", "type": "jsonb", "description": "Workflow steps"},
   {"name": "status", "type": "enum", "values": ["draft", "active", "paused"]},
   {"name": "total_enrolled", "type": "integer"},
   {"name": "total_completed", "type": "integer"}
 ]',
 '["automation", "workflow", "drip", "sequence"]', '[]', 'marketing', 75, true);

-- ═══════════════════════════════════════════════════════════════
-- CMS - PAGES & BLOCKS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('cms_page', 'CMS Page', 'Content pages. Content in cms_page_translations.', 'cms_pages', 'id', 'store_id',
 '["cms_page_translations", "cms_page_seo"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "slug", "type": "string", "description": "URL slug"},
   {"name": "is_active", "type": "boolean"},
   {"name": "is_system", "type": "boolean", "description": "System pages cannot be deleted"},
   {"name": "meta_title", "type": "string"},
   {"name": "meta_description", "type": "text"},
   {"name": "sort_order", "type": "integer"},
   {"name": "published_at", "type": "timestamp"}
 ]',
 '["page", "cms", "content", "about", "contact", "terms", "privacy"]',
 '["list cms pages", "create page about-us", "update contact page"]',
 'cms', 90, true),

('cms_page_translation', 'CMS Page Translation', 'CMS page content by language.', 'cms_page_translations', 'cms_page_id,language_code', NULL,
 '["cms_pages"]',
 '["list", "get", "create", "update"]',
 '[
   {"name": "cms_page_id", "type": "uuid"},
   {"name": "language_code", "type": "string"},
   {"name": "title", "type": "string"},
   {"name": "content", "type": "text"},
   {"name": "excerpt", "type": "text"}
 ]',
 '["translation", "content"]', '[]', 'cms', 85, true),

('cms_block', 'CMS Block', 'Reusable content blocks. Content in cms_block_translations.', 'cms_blocks', 'id', 'store_id',
 '["cms_block_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "identifier", "type": "string", "description": "Unique identifier"},
   {"name": "is_active", "type": "boolean"},
   {"name": "is_system", "type": "boolean"},
   {"name": "sort_order", "type": "integer"},
   {"name": "placement", "type": "jsonb", "description": "Where block appears"}
 ]',
 '["block", "cms block", "widget", "banner"]',
 '["list cms blocks", "create block for homepage"]',
 'cms', 80, true),

('cms_block_translation', 'CMS Block Translation', 'CMS block content by language.', 'cms_block_translations', 'cms_block_id,language_code', NULL,
 '["cms_blocks"]',
 '["list", "get", "create", "update"]',
 '[
   {"name": "cms_block_id", "type": "uuid"},
   {"name": "language_code", "type": "string"},
   {"name": "title", "type": "string"},
   {"name": "content", "type": "text"}
 ]',
 '["translation", "content"]', '[]', 'cms', 75, true);

-- ═══════════════════════════════════════════════════════════════
-- SHIPPING & DELIVERY
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('shipping_method', 'Shipping Method', 'Shipping methods. Names in shipping_method_translations.', 'shipping_methods', 'id', 'store_id',
 '["shipping_method_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "is_active", "type": "boolean"},
   {"name": "type", "type": "enum", "values": ["flat_rate", "free", "weight_based", "price_based", "carrier"]},
   {"name": "flat_rate_cost", "type": "decimal"},
   {"name": "free_shipping_min_order", "type": "decimal"},
   {"name": "weight_ranges", "type": "jsonb"},
   {"name": "price_ranges", "type": "jsonb"},
   {"name": "availability", "type": "enum", "values": ["all", "specific"]},
   {"name": "countries", "type": "jsonb"},
   {"name": "min_delivery_days", "type": "integer"},
   {"name": "max_delivery_days", "type": "integer"},
   {"name": "sort_order", "type": "integer"}
 ]',
 '["shipping", "delivery", "carrier"]',
 '["list shipping methods", "create free shipping", "update shipping rates"]',
 'shipping', 90, true),

('delivery_settings', 'Delivery Settings', 'Store delivery date/time settings.', 'delivery_settings', 'id', 'store_id',
 '[]',
 '["get", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "enable_delivery_date", "type": "boolean"},
   {"name": "enable_comments", "type": "boolean"},
   {"name": "offset_days", "type": "integer", "description": "Days from order to first delivery slot"},
   {"name": "max_advance_days", "type": "integer"},
   {"name": "blocked_dates", "type": "jsonb"},
   {"name": "blocked_weekdays", "type": "jsonb"},
   {"name": "delivery_time_slots", "type": "jsonb"}
 ]',
 '["delivery", "time slot", "schedule"]', '[]', 'shipping', 80, true);

-- ═══════════════════════════════════════════════════════════════
-- PAYMENT
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('payment_method', 'Payment Method', 'Payment methods. Names in payment_method_translations.', 'payment_methods', 'id', 'store_id',
 '["payment_method_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "code", "type": "string"},
   {"name": "type", "type": "enum", "values": ["credit_card", "bank_transfer", "cash", "wallet", "other"]},
   {"name": "is_active", "type": "boolean"},
   {"name": "sort_order", "type": "integer"},
   {"name": "settings", "type": "jsonb"},
   {"name": "fee_type", "type": "enum", "values": ["none", "fixed", "percentage"]},
   {"name": "fee_amount", "type": "decimal"},
   {"name": "min_amount", "type": "decimal"},
   {"name": "max_amount", "type": "decimal"},
   {"name": "payment_flow", "type": "enum", "values": ["offline", "redirect", "iframe"]},
   {"name": "provider", "type": "string", "description": "e.g., stripe, paypal"}
 ]',
 '["payment", "checkout", "credit card", "bank transfer"]',
 '["list payment methods", "enable PayPal", "update payment fees"]',
 'payment', 90, true);

-- ═══════════════════════════════════════════════════════════════
-- TAXES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('tax', 'Tax', 'Tax configurations. Names in tax_translations.', 'taxes', 'id', 'store_id',
 '["tax_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "is_default", "type": "boolean"},
   {"name": "is_active", "type": "boolean"},
   {"name": "country_rates", "type": "jsonb", "description": "Tax rates by country/region"}
 ]',
 '["tax", "vat", "gst", "sales tax"]',
 '["list taxes", "create VAT 20%", "update tax rates"]',
 'taxes', 90, true);

-- ═══════════════════════════════════════════════════════════════
-- SEO & REDIRECTS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('redirect', 'Redirect', 'URL redirects (301, 302).', 'redirects', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "from_url", "type": "string"},
   {"name": "to_url", "type": "string"},
   {"name": "type", "type": "enum", "values": ["301", "302"]},
   {"name": "is_active", "type": "boolean"},
   {"name": "hit_count", "type": "integer"},
   {"name": "entity_type", "type": "string"},
   {"name": "entity_id", "type": "uuid"},
   {"name": "notes", "type": "text"}
 ]',
 '["redirect", "301", "302", "url"]',
 '["create redirect from old-url to new-url", "list redirects"]',
 'seo', 85, true),

('seo_settings', 'SEO Settings', 'Store-wide SEO settings.', 'seo_settings', 'id', 'store_id',
 '[]',
 '["get", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "robots_txt_content", "type": "text"},
   {"name": "hreflang_settings", "type": "jsonb"},
   {"name": "social_media_settings", "type": "json"},
   {"name": "xml_sitemap_settings", "type": "json"},
   {"name": "html_sitemap_settings", "type": "json"},
   {"name": "default_meta_settings", "type": "json"},
   {"name": "canonical_settings", "type": "jsonb"}
 ]',
 '["seo", "sitemap", "robots", "meta"]', '[]', 'seo', 80, true),

('seo_template', 'SEO Template', 'Dynamic SEO templates for products/categories.', 'seo_templates', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "type", "type": "enum", "values": ["product", "category", "cms_page"]},
   {"name": "meta_title", "type": "string", "description": "Template with variables like {product_name}"},
   {"name": "meta_description", "type": "text"},
   {"name": "conditions", "type": "json"},
   {"name": "is_active", "type": "boolean"},
   {"name": "sort_order", "type": "integer"}
 ]',
 '["seo template", "meta template"]', '[]', 'seo', 75, true),

('canonical_url', 'Canonical URL', 'Custom canonical URL mappings.', 'canonical_urls', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "page_url", "type": "string"},
   {"name": "canonical_url", "type": "string"},
   {"name": "is_active", "type": "boolean"},
   {"name": "notes", "type": "text"}
 ]',
 '["canonical", "duplicate content"]', '[]', 'seo', 70, true);

-- ═══════════════════════════════════════════════════════════════
-- MEDIA & ASSETS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('media_asset', 'Media Asset', 'Uploaded files (images, videos, documents).', 'media_assets', 'id', 'store_id',
 '["product_files"]',
 '["list", "get", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "file_name", "type": "string"},
   {"name": "original_name", "type": "string"},
   {"name": "file_path", "type": "text"},
   {"name": "file_url", "type": "text"},
   {"name": "mime_type", "type": "string"},
   {"name": "file_size", "type": "bigint"},
   {"name": "folder", "type": "string"},
   {"name": "tags", "type": "json"},
   {"name": "description", "type": "text"},
   {"name": "usage_count", "type": "integer"}
 ]',
 '["image", "media", "file", "upload", "asset"]',
 '["list images", "find unused media"]',
 'media', 80, true);

-- ═══════════════════════════════════════════════════════════════
-- LANGUAGES & TRANSLATIONS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('language', 'Language', 'Store languages.', 'languages', 'id', NULL,
 '[]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "code", "type": "string", "description": "e.g., en, de, fr"},
   {"name": "name", "type": "string"},
   {"name": "native_name", "type": "string"},
   {"name": "flag", "type": "string"},
   {"name": "is_rtl", "type": "boolean"},
   {"name": "is_active", "type": "boolean"},
   {"name": "is_default", "type": "boolean"}
 ]',
 '["language", "locale", "translation"]',
 '["list languages", "add German language", "set default language"]',
 'settings', 85, true),

('translation', 'Translation', 'UI/system translations.', 'translations', 'id', 'store_id',
 '["languages"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "key", "type": "string", "description": "Translation key"},
   {"name": "language_code", "type": "string"},
   {"name": "value", "type": "text"},
   {"name": "category", "type": "string"},
   {"name": "type", "type": "enum", "values": ["system", "custom"]}
 ]',
 '["translation", "i18n", "localization"]', '[]', 'settings', 80, true);

-- ═══════════════════════════════════════════════════════════════
-- PDF TEMPLATES
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('pdf_template', 'PDF Template', 'PDF templates for invoices, etc. Content in pdf_template_translations.', 'pdf_templates', 'id', 'store_id',
 '["pdf_template_translations"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "identifier", "type": "string"},
   {"name": "name", "type": "string"},
   {"name": "template_type", "type": "enum", "values": ["invoice", "packing_slip", "return_label"]},
   {"name": "default_html_template", "type": "text"},
   {"name": "is_active", "type": "boolean"},
   {"name": "is_system", "type": "boolean"},
   {"name": "variables", "type": "jsonb"},
   {"name": "settings", "type": "jsonb"}
 ]',
 '["pdf", "invoice", "template", "print"]', '[]', 'settings', 70, true);

-- ═══════════════════════════════════════════════════════════════
-- INTEGRATIONS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('integration_config', 'Integration Config', 'Third-party integration configurations (Shopify, Stripe, etc.).', 'integration_configs', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "integration_type", "type": "string", "description": "e.g., shopify, stripe, brevo, supabase"},
   {"name": "config_key", "type": "string"},
   {"name": "config_data", "type": "jsonb", "description": "Encrypted credentials and settings"},
   {"name": "is_active", "type": "boolean"},
   {"name": "is_primary", "type": "boolean"},
   {"name": "display_name", "type": "string"},
   {"name": "connection_status", "type": "enum", "values": ["untested", "connected", "error"]},
   {"name": "last_sync_at", "type": "timestamp"},
   {"name": "sync_status", "type": "enum", "values": ["idle", "syncing", "error"]}
 ]',
 '["integration", "connection", "api", "shopify", "stripe"]',
 '["list integrations", "check Shopify connection"]',
 'integrations', 85, true);

-- ═══════════════════════════════════════════════════════════════
-- BLACKLIST & SECURITY
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('blacklist_email', 'Blacklisted Email', 'Blocked email addresses.', 'blacklist_emails', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "email", "type": "string"},
   {"name": "reason", "type": "text"}
 ]',
 '["blacklist", "block", "email"]', '[]', 'security', 70, true),

('blacklist_ip', 'Blacklisted IP', 'Blocked IP addresses.', 'blacklist_ips', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "ip_address", "type": "string"},
   {"name": "reason", "type": "text"}
 ]',
 '["blacklist", "block", "ip"]', '[]', 'security', 70, true),

('blacklist_country', 'Blacklisted Country', 'Blocked countries.', 'blacklist_countries', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "country_code", "type": "string"},
   {"name": "country_name", "type": "string"},
   {"name": "reason", "type": "text"}
 ]',
 '["blacklist", "block", "country"]', '[]', 'security', 70, true);

-- ═══════════════════════════════════════════════════════════════
-- COOKIE CONSENT & GDPR
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('cookie_consent_settings', 'Cookie Consent Settings', 'GDPR cookie banner settings.', 'cookie_consent_settings', 'id', 'store_id',
 '["cookie_consent_settings_translations"]',
 '["get", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "is_enabled", "type": "boolean"},
   {"name": "banner_position", "type": "enum", "values": ["top", "bottom"]},
   {"name": "privacy_policy_url", "type": "string"},
   {"name": "necessary_cookies", "type": "boolean"},
   {"name": "analytics_cookies", "type": "boolean"},
   {"name": "marketing_cookies", "type": "boolean"},
   {"name": "functional_cookies", "type": "boolean"},
   {"name": "gdpr_mode", "type": "boolean"},
   {"name": "consent_expiry_days", "type": "integer"},
   {"name": "primary_color", "type": "string"},
   {"name": "background_color", "type": "string"}
 ]',
 '["cookie", "gdpr", "consent", "privacy"]',
 '["update cookie banner", "enable GDPR mode"]',
 'settings', 75, true);

-- ═══════════════════════════════════════════════════════════════
-- ANALYTICS & TRACKING
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('customer_activity', 'Customer Activity', 'Customer browsing/action tracking.', 'customer_activities', 'id', 'store_id',
 '["customers", "products"]',
 '["list", "get"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "session_id", "type": "string"},
   {"name": "user_id", "type": "uuid"},
   {"name": "activity_type", "type": "enum", "values": ["page_view", "product_view", "add_to_cart", "purchase", "search"]},
   {"name": "page_url", "type": "string"},
   {"name": "product_id", "type": "uuid"},
   {"name": "search_query", "type": "string"},
   {"name": "device_type", "type": "string"},
   {"name": "country", "type": "string"},
   {"name": "utm_source", "type": "string"},
   {"name": "utm_medium", "type": "string"},
   {"name": "utm_campaign", "type": "string"}
 ]',
 '["activity", "tracking", "analytics", "behavior"]', '[]', 'analytics', 70, true),

('heatmap_session', 'Heatmap Session', 'User session data for heatmaps.', 'heatmap_sessions', 'id', 'store_id',
 '["heatmap_interactions"]',
 '["list", "get"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "session_id", "type": "string"},
   {"name": "user_id", "type": "uuid"},
   {"name": "first_page_url", "type": "text"},
   {"name": "last_page_url", "type": "text"},
   {"name": "total_duration", "type": "integer"},
   {"name": "page_count", "type": "integer"},
   {"name": "interaction_count", "type": "integer"},
   {"name": "bounce_session", "type": "boolean"},
   {"name": "conversion_session", "type": "boolean"},
   {"name": "device_type", "type": "string"},
   {"name": "country", "type": "string"}
 ]',
 '["heatmap", "session", "recording"]', '[]', 'analytics', 65, true);

-- ═══════════════════════════════════════════════════════════════
-- AB TESTING
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('ab_test', 'A/B Test', 'A/B test experiments.', 'ab_tests', 'id', 'store_id',
 '["ab_test_variants", "ab_test_assignments"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "hypothesis", "type": "text"},
   {"name": "status", "type": "enum", "values": ["draft", "running", "paused", "completed"]},
   {"name": "variants", "type": "json"},
   {"name": "traffic_allocation", "type": "decimal"},
   {"name": "primary_metric", "type": "string"},
   {"name": "start_date", "type": "timestamp"},
   {"name": "end_date", "type": "timestamp"},
   {"name": "winner_variant_id", "type": "string"}
 ]',
 '["ab test", "experiment", "split test"]', '[]', 'analytics', 60, true);

-- ═══════════════════════════════════════════════════════════════
-- CRON JOBS & SCHEDULING
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('cron_job', 'Cron Job', 'Scheduled tasks.', 'cron_jobs', 'id', 'store_id',
 '["cron_job_executions"]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "cron_expression", "type": "string", "description": "e.g., 0 0 * * * for daily"},
   {"name": "timezone", "type": "string"},
   {"name": "job_type", "type": "string"},
   {"name": "configuration", "type": "jsonb"},
   {"name": "is_active", "type": "boolean"},
   {"name": "is_paused", "type": "boolean"},
   {"name": "last_run_at", "type": "timestamp"},
   {"name": "next_run_at", "type": "timestamp"},
   {"name": "last_status", "type": "enum", "values": ["success", "failed", "running"]}
 ]',
 '["cron", "schedule", "job", "task"]',
 '["list scheduled jobs", "pause cron job"]',
 'system', 70, true);

-- ═══════════════════════════════════════════════════════════════
-- PLUGINS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('plugin', 'Plugin', 'Installed plugins.', 'plugins', 'id', NULL,
 '["plugin_configurations", "plugin_hooks", "plugin_events", "plugin_widgets"]',
 '["list", "get", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "name", "type": "string"},
   {"name": "slug", "type": "string"},
   {"name": "version", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "author", "type": "string"},
   {"name": "category", "type": "string"},
   {"name": "status", "type": "enum", "values": ["available", "installing", "installed", "error"]},
   {"name": "is_installed", "type": "boolean"},
   {"name": "is_enabled", "type": "boolean"},
   {"name": "health_status", "type": "string"}
 ]',
 '["plugin", "extension", "addon"]',
 '["list plugins", "enable plugin", "disable plugin"]',
 'plugins', 80, true),

('plugin_configuration', 'Plugin Configuration', 'Per-store plugin settings.', 'plugin_configurations', 'id', 'store_id',
 '["plugins"]',
 '["list", "get", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "plugin_id", "type": "string"},
   {"name": "is_enabled", "type": "boolean"},
   {"name": "config_data", "type": "jsonb"},
   {"name": "health_status", "type": "string"},
   {"name": "error_log", "type": "text"}
 ]',
 '["plugin config", "plugin settings"]', '[]', 'plugins', 75, true);

-- ═══════════════════════════════════════════════════════════════
-- USERS & AUTH
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('user', 'User', 'Admin/staff users (not customers).', 'users', 'id', NULL,
 '["stores"]',
 '["list", "get", "update"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "email", "type": "string"},
   {"name": "first_name", "type": "string"},
   {"name": "last_name", "type": "string"},
   {"name": "phone", "type": "string"},
   {"name": "avatar_url", "type": "string"},
   {"name": "is_active", "type": "boolean"},
   {"name": "email_verified", "type": "boolean"},
   {"name": "role", "type": "enum", "values": ["admin", "manager", "staff"]},
   {"name": "last_login", "type": "timestamp"}
 ]',
 '["user", "admin", "staff", "team"]', '[]', 'users', 90, true);

-- ═══════════════════════════════════════════════════════════════
-- SLOT CONFIGURATIONS (Page Builder)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('slot_configuration', 'Slot Configuration', 'Page builder layouts.', 'slot_configurations', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "user_id", "type": "uuid"},
   {"name": "configuration", "type": "jsonb", "description": "Page layout JSON"},
   {"name": "version", "type": "string"},
   {"name": "is_active", "type": "boolean"},
   {"name": "status", "type": "enum", "values": ["init", "draft", "published"]},
   {"name": "page_type", "type": "string", "description": "e.g., home, cart, product"},
   {"name": "published_at", "type": "timestamp"},
   {"name": "has_unpublished_changes", "type": "boolean"}
 ]',
 '["layout", "page builder", "slot", "design"]', '[]', 'design', 75, true);

-- ═══════════════════════════════════════════════════════════════
-- CUSTOM DOMAINS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('custom_domain', 'Custom Domain', 'Custom domain configurations.', 'custom_domains', 'id', 'store_id',
 '[]',
 '["list", "get", "create", "update", "delete"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "domain", "type": "string"},
   {"name": "subdomain", "type": "string"},
   {"name": "is_primary", "type": "boolean"},
   {"name": "is_active", "type": "boolean"},
   {"name": "dns_configured", "type": "boolean"},
   {"name": "verification_status", "type": "enum", "values": ["pending", "verified", "failed"]},
   {"name": "ssl_status", "type": "enum", "values": ["pending", "active", "expired"]},
   {"name": "ssl_expires_at", "type": "timestamp"}
 ]',
 '["domain", "dns", "ssl", "custom domain"]',
 '["list domains", "add custom domain", "check SSL status"]',
 'settings', 80, true);

-- ═══════════════════════════════════════════════════════════════
-- AI & CREDITS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO ai_entity_definitions (entity_name, display_name, description, table_name, primary_key, tenant_column, related_tables, supported_operations, fields, intent_keywords, example_prompts, category, priority, is_active) VALUES
('credit_usage', 'Credit Usage', 'AI credit usage tracking.', 'credit_usage', 'id', 'store_id',
 '[]',
 '["list", "get"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "user_id", "type": "uuid"},
   {"name": "credits_used", "type": "decimal"},
   {"name": "usage_type", "type": "string"},
   {"name": "description", "type": "text"},
   {"name": "model_used", "type": "string"},
   {"name": "reference_id", "type": "uuid"},
   {"name": "reference_type", "type": "string"}
 ]',
 '["credits", "usage", "ai"]', '[]', 'ai', 60, true),

('ai_chat_session', 'AI Chat Session', 'AI assistant chat history.', 'ai_chat_sessions', 'id', NULL,
 '[]',
 '["list", "get"]',
 '[
   {"name": "id", "type": "uuid"},
   {"name": "user_id", "type": "uuid"},
   {"name": "session_id", "type": "string"},
   {"name": "role", "type": "enum", "values": ["user", "assistant"]},
   {"name": "content", "type": "text"},
   {"name": "intent", "type": "string"},
   {"name": "credits_used", "type": "integer"},
   {"name": "visible", "type": "boolean"}
 ]',
 '["chat", "ai", "conversation"]', '[]', 'ai', 55, true);

-- Verify count
SELECT COUNT(*) as total_entities,
       COUNT(DISTINCT category) as categories
FROM ai_entity_definitions;

-- List by category
SELECT category, COUNT(*) as count
FROM ai_entity_definitions
GROUP BY category
ORDER BY count DESC;
