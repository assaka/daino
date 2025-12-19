-- Create integration_attribute_mappings table for cross-platform attribute mapping
-- This maps external platform attributes (Shopify, Magento, Akeneo, etc.) to DainoStore attributes
-- Prevents duplicate attributes and enables consistent mapping across platforms

CREATE TABLE IF NOT EXISTS integration_attribute_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- External Platform Side
  integration_source VARCHAR(50) NOT NULL, -- 'shopify', 'magento', 'akeneo', 'woocommerce', 'bigcommerce', etc.
  external_attribute_code VARCHAR(255) NOT NULL, -- The attribute code/key from external platform
  external_attribute_name VARCHAR(255), -- Human-readable name from external platform
  external_attribute_type VARCHAR(50), -- Type in external system ('text', 'select', etc.)

  -- DainoStore Side (Internal)
  internal_attribute_id UUID NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  internal_attribute_code VARCHAR(255) NOT NULL, -- Denormalized for quick lookups

  -- Mapping Configuration
  is_active BOOLEAN DEFAULT true,
  mapping_direction VARCHAR(20) DEFAULT 'bidirectional' CHECK (mapping_direction IN ('import_only', 'export_only', 'bidirectional')),
  mapping_source VARCHAR(50) DEFAULT 'auto', -- 'auto' (system-detected), 'manual' (user-configured), 'ai' (AI-suggested)
  confidence_score DECIMAL(3,2) DEFAULT 1.00, -- For auto-mapped attributes (0.00-1.00)

  -- Value Transformation Rules (Optional)
  value_transformation JSONB DEFAULT '{}', -- Rules for transforming values between platforms
  -- Example: {"unit_conversion": "inches_to_cm", "format": "uppercase"}

  -- Metadata
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  notes TEXT,
  last_used_at TIMESTAMP, -- Track when mapping was last used in import/export
  usage_count INTEGER DEFAULT 0, -- How many times this mapping has been used

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID, -- User who created the mapping

  -- Constraints
  UNIQUE(store_id, integration_source, external_attribute_code), -- One mapping per external attribute per source

  -- Indexes for performance
  INDEX idx_integration_attr_lookup (store_id, integration_source, external_attribute_code, is_active),
  INDEX idx_integration_attr_internal (internal_attribute_id),
  INDEX idx_integration_attr_source (integration_source, is_active)
);

-- Add comments for documentation
COMMENT ON TABLE integration_attribute_mappings IS 'Maps external platform attributes to internal DainoStore attributes for multi-platform integration';
COMMENT ON COLUMN integration_attribute_mappings.integration_source IS 'External platform: shopify, magento, akeneo, woocommerce, etc.';
COMMENT ON COLUMN integration_attribute_mappings.external_attribute_code IS 'Attribute identifier in external system (e.g., "vendor", "pa_color", "brand")';
COMMENT ON COLUMN integration_attribute_mappings.internal_attribute_id IS 'Reference to DainoStore attributes table';
COMMENT ON COLUMN integration_attribute_mappings.mapping_source IS 'How mapping was created: auto (system), manual (user), ai (suggested)';
COMMENT ON COLUMN integration_attribute_mappings.confidence_score IS 'Confidence in auto-mapping (1.00 = certain, <0.80 = needs review)';
COMMENT ON COLUMN integration_attribute_mappings.value_transformation IS 'JSON rules for value transformation (unit conversion, format, etc.)';
COMMENT ON COLUMN integration_attribute_mappings.mapping_direction IS 'Which operations use this mapping: import, export, or both';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_attribute_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_integration_attribute_mappings_updated_at
  BEFORE UPDATE ON integration_attribute_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_attribute_mappings_updated_at();

-- Example mappings (these would be created during first import or configured by user)
COMMENT ON TABLE integration_attribute_mappings IS
'Example mappings:
1. Shopify "vendor" → DainoStore "brand"
2. Magento "manufacturer" → DainoStore "brand"
3. WooCommerce "pa_color" → DainoStore "color"
4. Akeneo "tv_screen_size" → DainoStore "screen_size"
5. BigCommerce "product_type" → DainoStore "product_type"

This allows consistent attribute management across all platforms.';
