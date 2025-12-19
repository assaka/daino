-- =====================================================
-- PLUGIN ENTITIES TABLE
-- =====================================================
-- Stores database entity/model definitions for plugins
-- Allows plugins to define their own database tables
-- Users can create entities in AI Studio and run migrations
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plugin Reference
  plugin_id UUID NOT NULL,

  -- Entity Identification
  entity_name VARCHAR(255) NOT NULL,  -- e.g., "HamidCart", "ProductReview"
  table_name VARCHAR(255) NOT NULL,   -- e.g., "hamid_cart", "product_reviews"
  description TEXT,

  -- Schema Definition (JSON format)
  schema_definition JSONB NOT NULL,   -- Column definitions, types, constraints

  -- Example:
  -- {
  --   "columns": [
  --     { "name": "id", "type": "UUID", "primaryKey": true, "default": "gen_random_uuid()" },
  --     { "name": "user_id", "type": "UUID", "nullable": true },
  --     { "name": "session_id", "type": "VARCHAR(255)", "nullable": true },
  --     { "name": "cart_items_count", "type": "INTEGER", "default": 0 },
  --     { "name": "visited_at", "type": "TIMESTAMP", "default": "NOW()" }
  --   ],
  --   "indexes": [
  --     { "name": "idx_hamid_cart_user", "columns": ["user_id"] },
  --     { "name": "idx_hamid_cart_session", "columns": ["session_id"] }
  --   ],
  --   "foreignKeys": [
  --     { "column": "user_id", "references": "users(id)", "onDelete": "SET NULL" }
  --   ]
  -- }

  -- Migration Status
  migration_status VARCHAR(50) DEFAULT 'pending',  -- pending, migrated, failed
  migration_version VARCHAR(50),  -- Links to plugin_migrations
  migrated_at TIMESTAMP WITH TIME ZONE,

  -- Generated SQL (for preview/execution)
  create_table_sql TEXT,  -- Auto-generated CREATE TABLE statement
  drop_table_sql TEXT,    -- Auto-generated DROP TABLE statement

  -- Sequelize Model Code (optional, for backend usage)
  model_code TEXT,  -- JavaScript code for Sequelize model

  -- Metadata
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_plugin_entities_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,

  CONSTRAINT unique_plugin_entity UNIQUE (plugin_id, entity_name),
  CONSTRAINT unique_plugin_table UNIQUE (plugin_id, table_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plugin_entities_plugin_id ON plugin_entities(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_entities_table_name ON plugin_entities(table_name);
CREATE INDEX IF NOT EXISTS idx_plugin_entities_migration_status ON plugin_entities(migration_status);

-- Comments
COMMENT ON TABLE plugin_entities IS 'Stores database entity/model definitions for plugins - 100% AI Studio driven';
COMMENT ON COLUMN plugin_entities.schema_definition IS 'JSON schema defining columns, indexes, and constraints';
COMMENT ON COLUMN plugin_entities.migration_status IS 'pending (not created), migrated (table exists), failed (migration error)';
COMMENT ON COLUMN plugin_entities.create_table_sql IS 'Auto-generated CREATE TABLE SQL from schema_definition';
COMMENT ON COLUMN plugin_entities.model_code IS 'Optional Sequelize model code for backend usage';
