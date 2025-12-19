-- =====================================================
-- HAMID CART VISITS TRACKING TABLE
-- =====================================================
-- Tracks every visit to the cart page
-- Used by Cart Hamid plugin for analytics
-- =====================================================

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT fk_hamid_cart_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_hamid_cart_user ON hamid_cart(user_id);
CREATE INDEX IF NOT EXISTS idx_hamid_cart_session ON hamid_cart(session_id);
CREATE INDEX IF NOT EXISTS idx_hamid_cart_visited_at ON hamid_cart(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_hamid_cart_created_at ON hamid_cart(created_at DESC);

-- Comment for documentation
COMMENT ON TABLE hamid_cart IS 'Tracks cart page visits for analytics (Cart Hamid Plugin)';
