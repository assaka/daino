-- Drop all tables and functions for a fresh start
-- This script removes everything to allow a clean migration

-- Drop all triggers first
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_stores_updated_at ON stores;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_sales_orders_updated_at ON sales_orders;
DROP TRIGGER IF EXISTS update_sales_order_items_updated_at ON sales_order_items;
DROP TRIGGER IF EXISTS update_coupons_updated_at ON coupons;
DROP TRIGGER IF EXISTS update_cms_pages_updated_at ON cms_pages;
DROP TRIGGER IF EXISTS update_delivery_settings_updated_at ON delivery_settings;
DROP TRIGGER IF EXISTS update_shipping_methods_updated_at ON shipping_methods;
DROP TRIGGER IF EXISTS update_taxes_updated_at ON taxes;
DROP TRIGGER IF EXISTS update_attributes_updated_at ON attributes;
DROP TRIGGER IF EXISTS update_attribute_sets_updated_at ON attribute_sets;
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS update_login_attempts_updated_at ON login_attempts;
DROP TRIGGER IF EXISTS update_credit_transactions_updated_at ON credit_transactions;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS taxes CASCADE;
DROP TABLE IF EXISTS shipping_methods CASCADE;
DROP TABLE IF EXISTS delivery_settings CASCADE;
DROP TABLE IF EXISTS cms_pages CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS sales_order_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS attributes CASCADE;
DROP TABLE IF EXISTS attribute_sets CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop any custom types if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS account_type CASCADE;
DROP TYPE IF EXISTS product_status CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS fulfillment_status CASCADE;

-- Notify completion
DO $$ 
BEGIN 
    RAISE NOTICE 'All tables and related objects have been dropped successfully';
END $$;