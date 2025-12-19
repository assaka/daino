-- Create akeneo_mapping table for flexible Akeneo integration
-- This allows mapping between Akeneo codes and DainoStore entities (categories, products, etc.)

CREATE TABLE IF NOT EXISTS akeneo_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Akeneo side
  akeneo_code VARCHAR(255) NOT NULL,
  akeneo_type VARCHAR(50) NOT NULL, -- 'category', 'product', 'attribute', etc.
  
  -- DainoStore side
  entity_type VARCHAR(50) NOT NULL, -- 'category', 'product', 'attribute', etc.
  entity_id UUID NOT NULL,
  entity_slug VARCHAR(255), -- For human-readable reference
  
  -- Metadata
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  mapping_source VARCHAR(50) DEFAULT 'auto', -- 'auto', 'manual', 'import'
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(store_id, akeneo_code, akeneo_type, entity_type), -- Prevent duplicate mappings
  
  -- Indexes for performance
  INDEX idx_akeneo_mappings_lookup (store_id, akeneo_code, akeneo_type, is_active),
  INDEX idx_akeneo_mappings_entity (entity_type, entity_id),
  INDEX idx_akeneo_mappings_slug (entity_slug)
);

-- Add comments for documentation
COMMENT ON TABLE akeneo_mappings IS 'Maps Akeneo codes to DainoStore entities for flexible integration';
COMMENT ON COLUMN akeneo_mappings.akeneo_code IS 'The code/identifier used in Akeneo PIM';
COMMENT ON COLUMN akeneo_mappings.akeneo_type IS 'Type of Akeneo entity (category, product, attribute, etc.)';
COMMENT ON COLUMN akeneo_mappings.entity_type IS 'Type of DainoStore entity being mapped to';
COMMENT ON COLUMN akeneo_mappings.entity_id IS 'UUID of the DainoStore entity';
COMMENT ON COLUMN akeneo_mappings.entity_slug IS 'Human-readable slug for reference and fallback matching';
COMMENT ON COLUMN akeneo_mappings.mapping_source IS 'How this mapping was created (auto, manual, import)';

-- Insert some example mappings for testing
INSERT INTO akeneo_mappings (akeneo_code, akeneo_type, entity_type, entity_id, entity_slug, store_id, mapping_source, notes) VALUES
('master', 'category', 'category', '9ccc6b7f-56d4-471f-8917-5694c58d0591', 'master-catalog', '157d4590-49bf-4b0b-bd77-abe131909528', 'manual', 'Root category mapping'),
('computers_laptops', 'category', 'category', '5d1af3aa-264a-47e0-99bc-1afa622638a3', 'computers-laptops', '157d4590-49bf-4b0b-bd77-abe131909528', 'manual', 'Electronics category mapping')
ON CONFLICT (store_id, akeneo_code, akeneo_type, entity_type) DO NOTHING;