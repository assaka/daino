-- Complete Database Migration Script for DainoStore E-commerce Platform
-- This script creates all tables based on the Sequelize models
-- Updated: 2025-01-16
-- Compatible with: Supabase PostgreSQL

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean migration)
-- Tables are dropped in reverse dependency order to avoid foreign key constraint violations
-- IMPORTANT: Comment out these DROP statements for fresh installations
-- DROP TABLE IF EXISTS login_attempts CASCADE;
-- DROP TABLE IF EXISTS taxes CASCADE;
-- DROP TABLE IF EXISTS shipping_methods CASCADE;
-- DROP TABLE IF EXISTS delivery_settings CASCADE;
-- DROP TABLE IF EXISTS cms_pages CASCADE;
-- DROP TABLE IF EXISTS coupons CASCADE;
-- DROP TABLE IF EXISTS sales_order_items CASCADE;
-- DROP TABLE IF EXISTS sales_orders CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS attributes CASCADE;
-- DROP TABLE IF EXISTS attribute_sets CASCADE;
-- DROP TABLE IF EXISTS stores CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login TIMESTAMP,
    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('admin', 'store_owner', 'customer')),
    account_type VARCHAR(20) DEFAULT 'individual' CHECK (account_type IN ('individual', 'agency')),
    credits INTEGER DEFAULT 0,
    last_credit_deduction_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. STORES TABLE
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    owner_email VARCHAR(255) NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    theme_color VARCHAR(7) DEFAULT '#3B82F6',
    currency VARCHAR(3) DEFAULT 'USD',
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    website_url TEXT,
    facebook_url TEXT,
    twitter_url TEXT,
    instagram_url TEXT,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_email) REFERENCES users(email)
);

-- 3. ATTRIBUTE_SETS TABLE
CREATE TABLE IF NOT EXISTS attribute_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    store_id UUID NOT NULL,
    attribute_ids JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 4. ATTRIBUTES TABLE
CREATE TABLE IF NOT EXISTS attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'number', 'select', 'multiselect', 'boolean', 'date', 'file')),
    is_required BOOLEAN DEFAULT false,
    is_filterable BOOLEAN DEFAULT false,
    is_searchable BOOLEAN DEFAULT false,
    is_usable_in_conditions BOOLEAN DEFAULT false,
    filter_type VARCHAR(20) CHECK (filter_type IN ('multiselect', 'slider', 'select')),
    options JSONB DEFAULT '[]',
    file_settings JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    store_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 5. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    hide_in_menu BOOLEAN DEFAULT false,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(255),
    meta_robots_tag VARCHAR(50) DEFAULT 'index, follow',
    store_id UUID NOT NULL,
    parent_id UUID,
    level INTEGER DEFAULT 0,
    path VARCHAR(255),
    product_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 6. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    sku VARCHAR(255) UNIQUE NOT NULL,
    barcode VARCHAR(255),
    description TEXT,
    short_description TEXT,
    price DECIMAL(10,2) NOT NULL,
    compare_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    weight DECIMAL(8,2),
    dimensions JSONB,
    images JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
    visibility VARCHAR(20) DEFAULT 'visible' CHECK (visibility IN ('visible', 'hidden')),
    manage_stock BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT 0,
    allow_backorders BOOLEAN DEFAULT false,
    low_stock_threshold INTEGER DEFAULT 5,
    infinite_stock BOOLEAN DEFAULT false,
    is_custom_option BOOLEAN DEFAULT false,
    is_coupon_eligible BOOLEAN DEFAULT false,
    featured BOOLEAN DEFAULT false,
    tags JSONB DEFAULT '[]',
    attributes JSONB DEFAULT '{}',
    seo JSONB DEFAULT '{}',
    store_id UUID NOT NULL,
    attribute_set_id UUID,
    category_ids JSONB DEFAULT '[]',
    related_product_ids JSONB DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (attribute_set_id) REFERENCES attribute_sets(id) ON DELETE SET NULL
);

-- 7. ORDERS TABLE
CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'failed')),
    fulfillment_status VARCHAR(20) DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    customer_id UUID,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    billing_address JSONB NOT NULL,
    shipping_address JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    delivery_date DATE,
    delivery_time_slot VARCHAR(50),
    delivery_instructions TEXT,
    payment_method VARCHAR(100),
    payment_reference VARCHAR(255),
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(255),
    coupon_code VARCHAR(100),
    notes TEXT,
    admin_notes TEXT,
    store_id UUID NOT NULL,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 8. SALES_ORDER_ITEMS TABLE
CREATE TABLE IF NOT EXISTS sales_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(255) NOT NULL,
    product_image TEXT,
    product_attributes JSONB DEFAULT '{}',
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 9. COUPONS TABLE
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage', 'buy_x_get_y', 'free_shipping')),
    discount_value DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    usage_limit INTEGER DEFAULT 100,
    usage_count INTEGER DEFAULT 0,
    min_purchase_amount DECIMAL(10,2),
    max_discount_amount DECIMAL(10,2),
    start_date DATE,
    end_date DATE,
    buy_quantity INTEGER DEFAULT 1,
    get_quantity INTEGER DEFAULT 1,
    store_id UUID NOT NULL,
    applicable_products JSONB DEFAULT '[]',
    applicable_categories JSONB DEFAULT '[]',
    applicable_skus JSONB DEFAULT '[]',
    applicable_attribute_sets JSONB DEFAULT '[]',
    applicable_attributes JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 10. CMS_PAGES TABLE
CREATE TABLE IF NOT EXISTS cms_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords VARCHAR(255),
    meta_robots_tag VARCHAR(50) DEFAULT 'index, follow',
    store_id UUID NOT NULL,
    related_product_ids JSONB DEFAULT '[]',
    published_at TIMESTAMP,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 11. DELIVERY_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS delivery_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enable_delivery_date BOOLEAN DEFAULT true,
    enable_comments BOOLEAN DEFAULT true,
    offset_days INTEGER DEFAULT 1,
    max_advance_days INTEGER DEFAULT 30,
    blocked_dates JSONB DEFAULT '[]',
    blocked_weekdays JSONB DEFAULT '[]',
    out_of_office_start DATE,
    out_of_office_end DATE,
    delivery_time_slots JSONB DEFAULT '[{"start_time": "09:00", "end_time": "12:00", "is_active": true}, {"start_time": "13:00", "end_time": "17:00", "is_active": true}]',
    store_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 12. SHIPPING_METHODS TABLE
CREATE TABLE IF NOT EXISTS shipping_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    type VARCHAR(20) NOT NULL DEFAULT 'flat_rate' CHECK (type IN ('flat_rate', 'free_shipping', 'weight_based', 'price_based')),
    flat_rate_cost DECIMAL(10,2) DEFAULT 0,
    free_shipping_min_order DECIMAL(10,2) DEFAULT 0,
    weight_ranges JSONB DEFAULT '[]',
    price_ranges JSONB DEFAULT '[]',
    availability VARCHAR(20) DEFAULT 'all' CHECK (availability IN ('all', 'specific_countries')),
    countries JSONB DEFAULT '[]',
    min_delivery_days INTEGER DEFAULT 1,
    max_delivery_days INTEGER DEFAULT 7,
    store_id UUID NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 13. TAXES TABLE
CREATE TABLE IF NOT EXISTS taxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    country_rates JSONB DEFAULT '[]',
    store_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 14. LOGIN_ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    action VARCHAR(50) DEFAULT 'login',
    success BOOLEAN DEFAULT false,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. CUSTOMERS TABLE (for store customers)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10),
    notes TEXT,
    total_spent DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_order_value DECIMAL(10,2) DEFAULT 0,
    last_order_date TIMESTAMP,
    tags JSONB DEFAULT '[]',
    addresses JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE(store_id, email)
);

-- 16. STORE_PLUGINS TABLE
CREATE TABLE IF NOT EXISTS store_plugins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    plugin_name VARCHAR(255) NOT NULL,
    plugin_slug VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    configuration JSONB DEFAULT '{}',
    version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE(store_id, plugin_slug)
);

-- 17. CREDIT_TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
    description TEXT,
    reference_id VARCHAR(255),
    reference_type VARCHAR(50),
    balance_before INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CREATE INDEXES FOR BETTER PERFORMANCE

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);

-- Stores indexes
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_owner_email ON stores(owner_email);
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON stores(is_active);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_store_id ON categories(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_sales_orders_order_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_id ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_store_id ON sales_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_at ON sales_orders(created_at);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order_id ON sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product_id ON sales_order_items(product_id);

-- Coupons indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_store_id ON coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);

-- CMS pages indexes
CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON cms_pages(slug);
CREATE INDEX IF NOT EXISTS idx_cms_pages_store_id ON cms_pages(store_id);
CREATE INDEX IF NOT EXISTS idx_cms_pages_is_active ON cms_pages(is_active);

-- Login attempts indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempted_at);

-- Attributes indexes
CREATE INDEX IF NOT EXISTS idx_attributes_code ON attributes(code);
CREATE INDEX IF NOT EXISTS idx_attributes_store_id ON attributes(store_id);

-- Attribute sets indexes
CREATE INDEX IF NOT EXISTS idx_attribute_sets_store_id ON attribute_sets(store_id);

-- Shipping methods indexes
CREATE INDEX IF NOT EXISTS idx_shipping_methods_store_id ON shipping_methods(store_id);
CREATE INDEX IF NOT EXISTS idx_shipping_methods_is_active ON shipping_methods(is_active);

-- Taxes indexes
CREATE INDEX IF NOT EXISTS idx_taxes_store_id ON taxes(store_id);
CREATE INDEX IF NOT EXISTS idx_taxes_is_active ON taxes(is_active);

-- Delivery settings indexes
CREATE INDEX IF NOT EXISTS idx_delivery_settings_store_id ON delivery_settings(store_id);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_store_email ON customers(store_id, email);

-- Store plugins indexes
CREATE INDEX IF NOT EXISTS idx_store_plugins_store_id ON store_plugins(store_id);
CREATE INDEX IF NOT EXISTS idx_store_plugins_slug ON store_plugins(plugin_slug);
CREATE INDEX IF NOT EXISTS idx_store_plugins_is_active ON store_plugins(is_active);
CREATE INDEX IF NOT EXISTS idx_store_plugins_store_slug ON store_plugins(store_id, plugin_slug);

-- Credit transactions indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference ON credit_transactions(reference_id, reference_type);

-- CREATE TRIGGERS FOR UPDATED_AT COLUMNS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables that have updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_order_items_updated_at BEFORE UPDATE ON sales_order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cms_pages_updated_at BEFORE UPDATE ON cms_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_settings_updated_at BEFORE UPDATE ON delivery_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shipping_methods_updated_at BEFORE UPDATE ON shipping_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_taxes_updated_at BEFORE UPDATE ON taxes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attributes_updated_at BEFORE UPDATE ON attributes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attribute_sets_updated_at BEFORE UPDATE ON attribute_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_store_plugins_updated_at BEFORE UPDATE ON store_plugins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 18. CUSTOM OPTION RULES TABLE
CREATE TABLE IF NOT EXISTS custom_option_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    display_label VARCHAR(255) DEFAULT 'Custom Options',
    is_active BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '{}',
    optional_product_ids JSONB DEFAULT '[]',
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for custom option rules
CREATE INDEX IF NOT EXISTS idx_custom_option_rules_store_id ON custom_option_rules(store_id);
CREATE INDEX IF NOT EXISTS idx_custom_option_rules_is_active ON custom_option_rules(is_active);

-- Create trigger for custom option rules
CREATE TRIGGER update_custom_option_rules_updated_at BEFORE UPDATE ON custom_option_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default data
INSERT INTO users (email, password, first_name, last_name, role, account_type, is_active, email_verified, credits) 
VALUES 
    ('admin@dainostore.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', 'agency', true, true, 1000),
    ('demo@dainostore.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo', 'User', 'store_owner', 'individual', true, true, 100)
ON CONFLICT (email) DO NOTHING;

-- Insert a demo store for testing
INSERT INTO stores (name, slug, description, owner_email, is_active, theme_color, currency, timezone)
VALUES ('Demo Store', 'demo-store', 'A demo store for testing purposes', 'demo@dainostore.com', true, '#3B82F6', 'USD', 'UTC')
ON CONFLICT (slug) DO NOTHING;

-- Insert demo categories
INSERT INTO categories (name, slug, description, is_active, sort_order, store_id)
SELECT 'Electronics', 'electronics', 'Electronic devices and gadgets', true, 1, s.id
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, description, is_active, sort_order, store_id)
SELECT 'Clothing', 'clothing', 'Fashion and apparel', true, 2, s.id
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT (slug) DO NOTHING;

-- Insert demo products
INSERT INTO products (name, slug, sku, description, price, status, visibility, stock_quantity, store_id)
SELECT 'Sample Product', 'sample-product', 'SKU-001', 'A sample product for testing', 29.99, 'active', 'visible', 100, s.id
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT (slug) DO NOTHING;

-- Insert demo shipping method
INSERT INTO shipping_methods (name, description, is_active, type, flat_rate_cost, store_id)
SELECT 'Standard Shipping', 'Standard shipping method', true, 'flat_rate', 9.99, s.id
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT DO NOTHING;

-- Insert demo tax settings
INSERT INTO taxes (name, description, is_default, is_active, country_rates, store_id)
SELECT 'Standard Tax', 'Standard tax rate', true, true, '[{"country": "US", "rate": 8.5}]'::jsonb, s.id
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT DO NOTHING;

-- Insert demo delivery settings
INSERT INTO delivery_settings (store_id, enable_delivery_date, enable_comments, offset_days, max_advance_days)
SELECT s.id, true, true, 1, 30
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT DO NOTHING;

-- Create database summary view
CREATE OR REPLACE VIEW database_summary AS
SELECT 
    'users' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM users
UNION ALL
SELECT 
    'stores' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM stores
UNION ALL
SELECT 
    'products' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM products
UNION ALL
SELECT 
    'categories' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM categories
UNION ALL
SELECT 
    'orders' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM orders
UNION ALL
SELECT 
    'customers' as table_name,
    COUNT(*) as row_count,
    MAX(created_at) as last_created
FROM customers;

-- Migration completed successfully
SELECT 'Database migration completed successfully!' as message;
SELECT 'Total tables created: 18' as info;
SELECT 'Demo data inserted for testing' as note;