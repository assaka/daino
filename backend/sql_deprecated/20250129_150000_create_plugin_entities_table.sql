-- =====================================================
-- MIGRATION: Create plugin_entities table
-- =====================================================
-- Plugin: Core Platform (00000000-0000-0000-0000-000000000000)
-- Version: 20250129_150000
-- Description: Create plugin_entities table for storing database entity definitions
-- =====================================================

-- UP Migration
CREATE TABLE IF NOT EXISTS plugin_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  description TEXT,
  schema_definition JSONB NOT NULL,
  migration_status VARCHAR(50) DEFAULT 'pending',
  migration_version VARCHAR(50),
  migrated_at TIMESTAMP WITH TIME ZONE,
  create_table_sql TEXT,
  drop_table_sql TEXT,
  model_code TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_plugin_entities_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,
  CONSTRAINT unique_plugin_entity UNIQUE (plugin_id, entity_name),
  CONSTRAINT unique_plugin_table UNIQUE (plugin_id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_plugin_entities_plugin_id ON plugin_entities(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_entities_table_name ON plugin_entities(table_name);
CREATE INDEX IF NOT EXISTS idx_plugin_entities_migration_status ON plugin_entities(migration_status);

COMMENT ON TABLE plugin_entities IS 'Stores database entity/model definitions for plugins - 100% AI Studio driven';
COMMENT ON COLUMN plugin_entities.schema_definition IS 'JSON schema defining columns, indexes, and constraints';
COMMENT ON COLUMN plugin_entities.migration_status IS 'pending (not created), migrated (table exists), failed (migration error)';

-- =====================================================
-- DOWN Migration (Rollback)
-- =====================================================
-- DROP TABLE IF EXISTS plugin_entities CASCADE;
