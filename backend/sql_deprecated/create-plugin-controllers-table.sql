-- =====================================================
-- PLUGIN CONTROLLERS TABLE
-- =====================================================
-- Stores API endpoint/controller definitions for plugins
-- Allows plugins to define custom API routes
-- Users can create controllers in AI Studio
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_controllers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plugin Reference
  plugin_id UUID NOT NULL,

  -- Controller Identification
  controller_name VARCHAR(255) NOT NULL,  -- e.g., "CartVisitsController"
  description TEXT,

  -- Endpoint Configuration
  method VARCHAR(10) NOT NULL,  -- GET, POST, PUT, DELETE, PATCH
  path VARCHAR(500) NOT NULL,   -- e.g., "/cart-hamid/track-visit"

  -- Full path will be: /api/plugins/{plugin-slug}/{path}
  -- Example: /api/plugins/cart-hamid/track-visit

  -- Handler Implementation
  handler_code TEXT NOT NULL,  -- JavaScript function code

  -- Example:
  -- async function trackVisit(req, res, { sequelize, models }) {
  --   const { user_id, session_id, cart_items_count } = req.body;
  --   const result = await sequelize.query(`
  --     INSERT INTO hamid_cart (user_id, session_id, cart_items_count)
  --     VALUES ($1, $2, $3) RETURNING *
  --   `, { bind: [user_id, session_id, cart_items_count] });
  --   return res.json({ success: true, visit: result[0][0] });
  -- }

  -- Request/Response Schema (optional, for validation)
  request_schema JSONB,   -- JSON schema for request body validation
  response_schema JSONB,  -- JSON schema for response format

  -- Security & Access
  requires_auth BOOLEAN DEFAULT false,  -- Require authenticated user
  allowed_roles JSONB,  -- Array of roles: ["admin", "user"]
  rate_limit INTEGER DEFAULT 100,  -- Requests per minute

  -- Metadata
  is_enabled BOOLEAN DEFAULT true,
  execution_count INTEGER DEFAULT 0,  -- Track usage
  last_executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_plugin_controllers_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,

  CONSTRAINT unique_plugin_controller UNIQUE (plugin_id, method, path),
  CONSTRAINT valid_http_method CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plugin_controllers_plugin_id ON plugin_controllers(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_controllers_method_path ON plugin_controllers(method, path);
CREATE INDEX IF NOT EXISTS idx_plugin_controllers_enabled ON plugin_controllers(is_enabled);

-- Comments
COMMENT ON TABLE plugin_controllers IS 'Stores API endpoint/controller definitions for plugins - 100% AI Studio driven';
COMMENT ON COLUMN plugin_controllers.path IS 'Endpoint path relative to /api/plugins/{plugin-slug}/';
COMMENT ON COLUMN plugin_controllers.handler_code IS 'JavaScript function with signature: async (req, res, context) => {}';
COMMENT ON COLUMN plugin_controllers.requires_auth IS 'Whether this endpoint requires authentication';
COMMENT ON COLUMN plugin_controllers.rate_limit IS 'Maximum requests per minute per user';
