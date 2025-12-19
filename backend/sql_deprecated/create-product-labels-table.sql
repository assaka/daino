-- Create product_labels table migration
-- This creates the missing product_labels table

-- Create product_labels table
CREATE TABLE IF NOT EXISTS product_labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    text VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#000000',
    background_color VARCHAR(7) DEFAULT '#FFFFFF',
    position VARCHAR(20) DEFAULT 'top-left' CHECK (position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right', 'center')),
    is_active BOOLEAN DEFAULT true,
    conditions JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- Create unique index for store_id + slug combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_labels_store_slug ON product_labels(store_id, slug);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_labels_store_id ON product_labels(store_id);
CREATE INDEX IF NOT EXISTS idx_product_labels_is_active ON product_labels(is_active);
CREATE INDEX IF NOT EXISTS idx_product_labels_priority ON product_labels(priority);

-- Create trigger for updated_at column
CREATE TRIGGER update_product_labels_updated_at 
    BEFORE UPDATE ON product_labels 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some demo product labels for the demo store
INSERT INTO product_labels (store_id, name, slug, text, background_color, color, position, is_active, priority)
SELECT 
    s.id,
    'Sale',
    'sale',
    'SALE',
    '#FF0000',
    '#FFFFFF',
    'top-left',
    true,
    1
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT (store_id, slug) DO NOTHING;

INSERT INTO product_labels (store_id, name, slug, text, background_color, color, position, is_active, priority)
SELECT 
    s.id,
    'New',
    'new',
    'NEW',
    '#00FF00',
    '#FFFFFF',
    'top-right',
    true,
    2
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT (store_id, slug) DO NOTHING;

INSERT INTO product_labels (store_id, name, slug, text, background_color, color, position, is_active, priority)
SELECT 
    s.id,
    'Best Seller',
    'best-seller',
    'BEST SELLER',
    '#FFD700',
    '#000000',
    'bottom-left',
    true,
    3
FROM stores s WHERE s.slug = 'demo-store'
ON CONFLICT (store_id, slug) DO NOTHING;

SELECT 'Product labels table created successfully with demo data!' as message;