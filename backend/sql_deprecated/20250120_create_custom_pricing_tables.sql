-- Custom Pricing Plugin Database Tables
-- Migrates pricing logic from extensions to database storage

-- Pricing Rules Table
CREATE TABLE IF NOT EXISTS custom_pricing_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'volume', 'loyalty', 'bundle', 'coupon', 'format', 'checkout', 'validation'
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 10,
    conditions JSONB DEFAULT '{}', -- Store conditions as JSON
    actions JSONB DEFAULT '{}', -- Store actions as JSON
    store_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discount Rules Table
CREATE TABLE IF NOT EXISTS custom_pricing_discounts (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES custom_pricing_rules(id) ON DELETE CASCADE,
    discount_type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed', 'buy_x_get_y'
    discount_value DECIMAL(10,2),
    minimum_amount DECIMAL(10,2),
    minimum_quantity INTEGER,
    applies_to VARCHAR(50) DEFAULT 'item', -- 'item', 'cart', 'shipping'
    conditions JSONB DEFAULT '{}',
    stackable BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pricing Logs Table for analytics
CREATE TABLE IF NOT EXISTS custom_pricing_logs (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER REFERENCES custom_pricing_rules(id),
    event_type VARCHAR(50), -- 'applied', 'skipped', 'error'
    original_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    customer_id VARCHAR(255),
    product_id VARCHAR(255),
    context JSONB DEFAULT '{}', -- Store context data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_pricing_rules_type_enabled ON custom_pricing_rules(type, enabled);
CREATE INDEX IF NOT EXISTS idx_custom_pricing_rules_store_id ON custom_pricing_rules(store_id);
CREATE INDEX IF NOT EXISTS idx_custom_pricing_logs_event_created ON custom_pricing_logs(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_custom_pricing_logs_rule_id ON custom_pricing_logs(rule_id);

-- Insert default pricing rules based on the old extension logic
INSERT INTO custom_pricing_rules (name, type, enabled, priority, conditions, actions, store_id) VALUES
('Volume Discount', 'volume', true, 5, '{"minimum_quantity": 5}', '{"description": "10% off for 5+ items"}', null),
('Loyalty Customer Discount', 'loyalty', true, 8, '{"user_type": "loyalty"}', '{"description": "5% off for loyalty members"}', null),
('Bundle Pricing - Buy 2 Get 1 Free', 'bundle', true, 7, '{"category": "bundle", "minimum_quantity": 3}', '{"description": "Bundle pricing for specific categories"}', null),
('New Customer Coupon Validation', 'coupon', true, 10, '{"coupon_codes": ["NEWCUSTOMER"], "customer_type": "new", "allow_stacking": false}', '{"description": "New customer coupon restrictions"}', null),
('Minimum Order for Discount Coupons', 'coupon', true, 9, '{"coupon_codes": ["SAVE20"], "minimum_order_value": 100}', '{"description": "Minimum $100 order for SAVE20 coupon"}', null),
('Premium Checkout for High-Value Orders', 'checkout', true, 5, '{"minimum_total": 500}', '{"redirect_url": "/premium-checkout", "description": "Premium checkout for orders over $500"}', null),
('Cart Item Validation', 'validation', true, 1, '{"minimum_price": 1.00, "check_stock": true}', '{"description": "Basic cart item validation rules"}', null),
('EUR Currency Formatting', 'format', true, 10, '{"currency_code": "EUR"}', '{"currency_symbol": "€", "description": "Custom EUR formatting"}', null);

-- Insert corresponding discounts for the pricing rules
INSERT INTO custom_pricing_discounts (rule_id, discount_type, discount_value, minimum_quantity, applies_to, conditions, stackable) VALUES
(1, 'percentage', 10.00, 5, 'item', '{"description": "10% volume discount"}', false),
(2, 'percentage', 5.00, null, 'cart', '{"description": "5% loyalty discount"}', true),
(3, 'buy_x_get_y', 0, 3, 'item', '{"x_items": 3, "y_discount": 1, "description": "Buy 2 get 1 free"}', false);