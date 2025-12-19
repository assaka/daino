-- Add product_tabs table migration
-- This adds the missing product_tabs table with all required fields

-- 19. PRODUCT_TABS TABLE
CREATE TABLE IF NOT EXISTS product_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    tab_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (tab_type IN ('text', 'description', 'attributes', 'attribute_sets')),
    content TEXT,
    attribute_ids JSONB DEFAULT '[]',
    attribute_set_ids JSONB DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE(store_id, slug)
);

-- Create indexes for product_tabs
CREATE INDEX IF NOT EXISTS idx_product_tabs_store_id ON product_tabs(store_id);
CREATE INDEX IF NOT EXISTS idx_product_tabs_slug ON product_tabs(slug);
CREATE INDEX IF NOT EXISTS idx_product_tabs_is_active ON product_tabs(is_active);
CREATE INDEX IF NOT EXISTS idx_product_tabs_sort_order ON product_tabs(sort_order);

-- Create trigger for product_tabs
CREATE TRIGGER update_product_tabs_updated_at BEFORE UPDATE ON product_tabs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add product labels table if it doesn't exist
CREATE TABLE IF NOT EXISTS product_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    text VARCHAR(255) NOT NULL,
    background_color VARCHAR(7) DEFAULT '#3B82F6',
    text_color VARCHAR(7) DEFAULT '#FFFFFF',
    position VARCHAR(20) DEFAULT 'top-left' CHECK (position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')),
    conditions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE(store_id, slug)
);

-- Create indexes for product_labels
CREATE INDEX IF NOT EXISTS idx_product_labels_store_id ON product_labels(store_id);
CREATE INDEX IF NOT EXISTS idx_product_labels_slug ON product_labels(slug);
CREATE INDEX IF NOT EXISTS idx_product_labels_is_active ON product_labels(is_active);

-- Create trigger for product_labels
CREATE TRIGGER update_product_labels_updated_at BEFORE UPDATE ON product_labels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add payment methods table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    fee_type VARCHAR(20) DEFAULT 'none' CHECK (fee_type IN ('none', 'fixed', 'percentage')),
    fee_amount DECIMAL(10,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE(store_id, code)
);

-- Create indexes for payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_store_id ON payment_methods(store_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_code ON payment_methods(code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);

-- Create trigger for payment_methods
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT 'Product tabs, labels, and payment methods tables created successfully!' as message;