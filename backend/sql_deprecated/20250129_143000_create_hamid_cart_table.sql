-- =====================================================
-- MIGRATION: Create hamid_cart table
-- =====================================================
-- Plugin: Cart Hamid (109c940f-5d33-472c-b7df-c48e68c35696)
-- Version: 20250129_143000
-- Description: Create hamid_cart table for tracking cart page visits
-- =====================================================

-- UP Migration
CREATE TABLE IF NOT EXISTS hamid_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Visit Information
  user_id UUID,  -- Reference to user if logged in
  session_id VARCHAR(255),  -- Session identifier for anonymous users

  -- Cart Details at Time of Visit
  cart_items_count INTEGER DEFAULT 0,
  cart_subtotal DECIMAL(10, 2) DEFAULT 0.00,
  cart_total DECIMAL(10, 2) DEFAULT 0.00,

  -- Additional Context
  user_agent TEXT,  -- Browser/device information
  ip_address VARCHAR(45),  -- IPv4 or IPv6 address
  referrer_url TEXT,  -- Where the user came from

  -- Timestamps
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hamid_cart_user ON hamid_cart(user_id);
CREATE INDEX IF NOT EXISTS idx_hamid_cart_session ON hamid_cart(session_id);
CREATE INDEX IF NOT EXISTS idx_hamid_cart_visited_at ON hamid_cart(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_hamid_cart_created_at ON hamid_cart(created_at DESC);

-- Add table comment
COMMENT ON TABLE hamid_cart IS 'Tracks cart page visits for analytics (Cart Hamid Plugin)';

-- Add column comments
COMMENT ON COLUMN hamid_cart.user_id IS 'Reference to authenticated user (nullable)';
COMMENT ON COLUMN hamid_cart.session_id IS 'Session identifier for anonymous users';
COMMENT ON COLUMN hamid_cart.cart_items_count IS 'Number of items in cart at visit time';
COMMENT ON COLUMN hamid_cart.cart_subtotal IS 'Cart subtotal at visit time';
COMMENT ON COLUMN hamid_cart.cart_total IS 'Cart total at visit time';
COMMENT ON COLUMN hamid_cart.user_agent IS 'Browser/device information';
COMMENT ON COLUMN hamid_cart.ip_address IS 'IPv4 or IPv6 address';
COMMENT ON COLUMN hamid_cart.referrer_url IS 'URL the user came from';

-- =====================================================
-- DOWN Migration (Rollback)
-- =====================================================
-- DROP TABLE IF EXISTS hamid_cart CASCADE;
