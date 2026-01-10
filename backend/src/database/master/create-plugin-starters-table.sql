-- Plugin Starters Table (Master Database)
-- Stores system plugin templates that all tenants can use as starting points
-- These are official DainoStore plugin examples that users can clone and customize

CREATE TABLE IF NOT EXISTS plugin_starters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  version VARCHAR(50) DEFAULT '1.0.0',
  description TEXT,
  category VARCHAR(50) DEFAULT 'utility',
  type VARCHAR(50) DEFAULT 'feature', -- feature, integration, marketplace, analytics
  icon VARCHAR(10) DEFAULT '🔌',
  starter_description TEXT, -- Short description for starter card
  starter_prompt TEXT, -- AI prompt to generate this plugin
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- Plugin structure (JSON containing files, entities, migrations, etc.)
  plugin_structure JSONB,
  -- Metadata
  author VARCHAR(255) DEFAULT 'DainoStore',
  tags TEXT[], -- Array of tags for filtering
  difficulty VARCHAR(20) DEFAULT 'beginner', -- beginner, intermediate, advanced
  estimated_time VARCHAR(50), -- e.g., "15 minutes", "1 hour"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plugin_starters_category ON plugin_starters(category);
CREATE INDEX IF NOT EXISTS idx_plugin_starters_type ON plugin_starters(type);
CREATE INDEX IF NOT EXISTS idx_plugin_starters_active ON plugin_starters(is_active);
CREATE INDEX IF NOT EXISTS idx_plugin_starters_order ON plugin_starters(display_order);

-- Seed default starters
INSERT INTO plugin_starters (name, slug, description, category, type, icon, starter_description, starter_prompt, display_order, tags, difficulty)
VALUES
  (
    'Bol.com Marketplace',
    'bolcom-marketplace',
    'Sell your products on Bol.com - the largest marketplace in the Netherlands and Belgium',
    'marketplace',
    'integration',
    '🛒',
    'Sync products to Bol.com, import orders, manage inventory and shipments',
    'Create a bol.com marketplace integration that syncs my products as offers, imports orders, updates stock levels, and sends shipment notifications. Include OAuth2 authentication, product mapping, order import with customer details, stock updates, and shipment confirmation.',
    1,
    ARRAY['marketplace', 'bol.com', 'netherlands', 'belgium', 'orders', 'inventory'],
    'advanced'
  ),
  (
    'Product Reviews',
    'product-reviews',
    'Let customers leave star ratings and written reviews on products',
    'commerce',
    'feature',
    '⭐',
    '5-star rating system with customer reviews and photo uploads',
    'Create a product reviews plugin with 5-star ratings, written reviews, photo uploads, verified purchase badges, and helpful vote buttons. Include a reviews widget for product pages and an admin page to moderate reviews.',
    2,
    ARRAY['reviews', 'ratings', 'social-proof', 'ugc'],
    'beginner'
  ),
  (
    'Customer Wishlist',
    'customer-wishlist',
    'Let customers save their favorite products for later',
    'commerce',
    'feature',
    '❤️',
    'Save favorite products, share wishlists, get notifications on price drops',
    'Create a wishlist plugin where customers can save products, share their wishlist with friends, and get notified when items go on sale. Include a wishlist button on product pages and a dedicated wishlist page.',
    3,
    ARRAY['wishlist', 'favorites', 'save-for-later'],
    'beginner'
  ),
  (
    'Loyalty Points',
    'loyalty-points',
    'Reward customers with points for purchases',
    'marketing',
    'feature',
    '🎁',
    'Points for purchases, referrals, and reviews. Redeem for discounts',
    'Create a loyalty points plugin that awards points for purchases (1 point per euro), referrals, and reviews. Allow customers to redeem points for discounts at checkout. Include a points balance widget and transaction history.',
    4,
    ARRAY['loyalty', 'rewards', 'points', 'retention'],
    'intermediate'
  ),
  (
    'Amazon Marketplace',
    'amazon-marketplace',
    'Sell your products on Amazon marketplace',
    'marketplace',
    'integration',
    '📦',
    'Sync products to Amazon, import orders, manage FBA inventory',
    'Create an Amazon marketplace integration using the SP-API. Sync products as listings, import orders, update inventory levels, and support both FBA and FBM fulfillment methods.',
    5,
    ARRAY['marketplace', 'amazon', 'fba', 'orders', 'inventory'],
    'advanced'
  ),
  (
    'Abandoned Cart Recovery',
    'abandoned-cart',
    'Recover lost sales with automated reminder emails',
    'marketing',
    'feature',
    '🛒',
    'Automatic emails to recover abandoned carts with discount incentives',
    'Create an abandoned cart recovery plugin that sends automated email reminders after 1 hour, 24 hours, and 3 days. Include customizable email templates, discount code generation, and conversion tracking.',
    6,
    ARRAY['abandoned-cart', 'email', 'recovery', 'marketing'],
    'intermediate'
  ),
  (
    'Product Bundles',
    'product-bundles',
    'Create product bundles with special pricing',
    'commerce',
    'feature',
    '📦',
    'Bundle products together with discount pricing',
    'Create a product bundles plugin that allows store owners to group products together with special bundle pricing. Show bundle suggestions on product pages and cart.',
    7,
    ARRAY['bundles', 'pricing', 'upsell'],
    'intermediate'
  ),
  (
    'Back in Stock Notifications',
    'back-in-stock',
    'Notify customers when out-of-stock items return',
    'commerce',
    'feature',
    '🔔',
    'Email notifications when products are back in stock',
    'Create a back-in-stock notification plugin. Show a "Notify Me" button on out-of-stock products, collect email addresses, and automatically send notifications when inventory is replenished.',
    8,
    ARRAY['notifications', 'stock', 'email', 'inventory'],
    'beginner'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  starter_description = EXCLUDED.starter_description,
  starter_prompt = EXCLUDED.starter_prompt,
  icon = EXCLUDED.icon,
  display_order = EXCLUDED.display_order,
  tags = EXCLUDED.tags,
  difficulty = EXCLUDED.difficulty,
  updated_at = NOW();
