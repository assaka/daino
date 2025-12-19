-- =====================================================
-- PLUGIN MIGRATIONS TRACKING TABLE
-- =====================================================
-- Tracks all migrations executed by plugins
-- Separate from core platform _migrations table
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plugin Reference
  plugin_id UUID NOT NULL,
  plugin_name VARCHAR(255) NOT NULL,

  -- Migration Details
  migration_name VARCHAR(255) NOT NULL,
  migration_version VARCHAR(50) NOT NULL,  -- e.g., "20250129_143000"
  migration_description TEXT,

  -- Execution Status
  status VARCHAR(50) DEFAULT 'pending',  -- pending, running, completed, failed, rolled_back
  executed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  rolled_back_at TIMESTAMP WITH TIME ZONE,

  -- Execution Details
  execution_time_ms INTEGER,
  error_message TEXT,
  checksum VARCHAR(64),

  -- SQL Content (for rollback capability)
  up_sql TEXT,
  down_sql TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_plugin_migrations_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,

  CONSTRAINT unique_plugin_migration UNIQUE (plugin_id, migration_version)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_plugin_migrations_plugin_id ON plugin_migrations(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_migrations_status ON plugin_migrations(status);
CREATE INDEX IF NOT EXISTS idx_plugin_migrations_executed_at ON plugin_migrations(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_migrations_version ON plugin_migrations(migration_version);

-- Comment for documentation
COMMENT ON TABLE plugin_migrations IS 'Tracks all database migrations executed by plugins';
COMMENT ON COLUMN plugin_migrations.status IS 'Migration status: pending, running, completed, failed, rolled_back';
COMMENT ON COLUMN plugin_migrations.up_sql IS 'SQL to run the migration (create/alter tables)';
COMMENT ON COLUMN plugin_migrations.down_sql IS 'SQL to rollback the migration (drop/revert tables)';
