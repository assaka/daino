-- =====================================================
-- STOREFRONTS TABLE
-- =====================================================
-- Purpose: Multiple theme/layout configurations per store
-- Supports: B2B/B2C themes, seasonal campaigns, A/B testing
-- One storefront is marked is_primary and shown to visitors

CREATE TABLE IF NOT EXISTS storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Identity
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,

  -- Primary flag (only one per store can be primary without scheduling)
  is_primary BOOLEAN DEFAULT false NOT NULL,

  -- Theme settings that override store.settings
  -- Example: { "theme_color": "#FF0000", "font_family": "Roboto", "logo_url": "..." }
  settings_override JSONB DEFAULT '{}'::jsonb NOT NULL,

  -- Scheduling for automatic activation
  publish_start_at TIMESTAMP WITH TIME ZONE,
  publish_end_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT unique_slug_per_store UNIQUE (store_id, slug)
);

-- Ensure only one primary per store (for storefronts without scheduling)
CREATE UNIQUE INDEX IF NOT EXISTS idx_storefronts_primary
  ON storefronts (store_id)
  WHERE is_primary = true AND publish_start_at IS NULL;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_storefronts_store_id ON storefronts(store_id);
CREATE INDEX IF NOT EXISTS idx_storefronts_schedule ON storefronts(store_id, publish_start_at, publish_end_at);
CREATE INDEX IF NOT EXISTS idx_storefronts_is_primary ON storefronts(store_id, is_primary);

-- Trigger for updated_at
CREATE TRIGGER update_storefronts_updated_at
  BEFORE UPDATE ON storefronts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ADD STOREFRONT_ID TO SLOT_CONFIGURATIONS
-- =====================================================
-- Allows per-storefront page layouts
-- NULL storefront_id = applies to all storefronts (fallback)

ALTER TABLE slot_configurations
ADD COLUMN IF NOT EXISTS storefront_id UUID REFERENCES storefronts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_slot_config_storefront ON slot_configurations(store_id, storefront_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get active storefront for a store
-- Priority: 1. Scheduled (within window), 2. Primary
CREATE OR REPLACE FUNCTION get_active_storefront(p_store_id UUID, p_storefront_slug VARCHAR DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  v_storefront_id UUID;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  -- If specific storefront requested, return it
  IF p_storefront_slug IS NOT NULL THEN
    SELECT id INTO v_storefront_id
    FROM storefronts
    WHERE store_id = p_store_id AND slug = p_storefront_slug
    LIMIT 1;

    IF v_storefront_id IS NOT NULL THEN
      RETURN v_storefront_id;
    END IF;
  END IF;

  -- Check for scheduled storefront (within active window)
  SELECT id INTO v_storefront_id
  FROM storefronts
  WHERE store_id = p_store_id
    AND publish_start_at IS NOT NULL
    AND publish_start_at <= v_now
    AND (publish_end_at IS NULL OR publish_end_at >= v_now)
  ORDER BY publish_start_at DESC
  LIMIT 1;

  IF v_storefront_id IS NOT NULL THEN
    RETURN v_storefront_id;
  END IF;

  -- Fall back to primary storefront
  SELECT id INTO v_storefront_id
  FROM storefronts
  WHERE store_id = p_store_id AND is_primary = true
  LIMIT 1;

  RETURN v_storefront_id;
END;
$$ LANGUAGE plpgsql;

-- Function to set a storefront as primary (unsets others)
CREATE OR REPLACE FUNCTION set_primary_storefront(p_store_id UUID, p_storefront_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Unset current primary (only for non-scheduled storefronts)
  UPDATE storefronts
  SET is_primary = false, updated_at = NOW()
  WHERE store_id = p_store_id AND is_primary = true AND publish_start_at IS NULL;

  -- Set new primary
  UPDATE storefronts
  SET is_primary = true, updated_at = NOW()
  WHERE id = p_storefront_id AND store_id = p_store_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE storefronts IS 'Multiple theme/layout configurations per store';
COMMENT ON COLUMN storefronts.slug IS 'URL slug for preview access (?storefront=slug)';
COMMENT ON COLUMN storefronts.is_primary IS 'Primary storefront shown to visitors';
COMMENT ON COLUMN storefronts.settings_override IS 'Theme settings that override store.settings';
COMMENT ON COLUMN storefronts.publish_start_at IS 'When this storefront becomes active (scheduled)';
COMMENT ON COLUMN storefronts.publish_end_at IS 'When this storefront deactivates (reverts to primary)';
COMMENT ON COLUMN slot_configurations.storefront_id IS 'Links layout to specific storefront (NULL = all storefronts)';
