-- =====================================================
-- PLUGIN VERSION CONTROL SYSTEM
-- =====================================================
-- Implements git-like version control for plugins
-- Uses hybrid snapshot + patch strategy for efficiency
-- =====================================================

-- =====================================================
-- 1. PLUGIN VERSION HISTORY
-- =====================================================
-- Tracks all versions of a plugin over time
-- Each version is either a snapshot or patch-based
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plugin Reference
  plugin_id UUID NOT NULL,

  -- Version Metadata
  version_number VARCHAR(50) NOT NULL,  -- e.g., '1.0.0', '1.0.1'
  version_type VARCHAR(20) NOT NULL DEFAULT 'patch',  -- 'snapshot' or 'patch'
  parent_version_id UUID,  -- Points to previous version (for patch chains)

  -- Change Tracking
  commit_message TEXT,
  changelog TEXT,

  -- Author Tracking
  created_by UUID,  -- User who created this version
  created_by_name VARCHAR(255),  -- Cached username

  -- Flags
  is_current BOOLEAN DEFAULT false,  -- Current active version
  is_published BOOLEAN DEFAULT false,  -- Published/tagged version

  -- Snapshot Chain Management
  snapshot_distance INTEGER DEFAULT 0,  -- How many patches from last snapshot (0 if snapshot)

  -- Statistics
  files_changed INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT fk_plugin_version_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,

  CONSTRAINT fk_plugin_version_parent FOREIGN KEY (parent_version_id)
    REFERENCES plugin_version_history(id) ON DELETE SET NULL,

  CONSTRAINT unique_plugin_version UNIQUE (plugin_id, version_number),

  CONSTRAINT check_version_type CHECK (version_type IN ('snapshot', 'patch')),
  CONSTRAINT check_snapshot_distance CHECK (snapshot_distance >= 0 AND snapshot_distance <= 10)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_plugin_version_plugin_id ON plugin_version_history(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_version_created_at ON plugin_version_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_version_is_current ON plugin_version_history(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_plugin_version_is_published ON plugin_version_history(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_plugin_version_type ON plugin_version_history(version_type);
CREATE INDEX IF NOT EXISTS idx_plugin_version_parent ON plugin_version_history(parent_version_id);

COMMENT ON TABLE plugin_version_history IS 'Git-like version control for plugins with hybrid snapshot/patch strategy';
COMMENT ON COLUMN plugin_version_history.version_type IS 'Type: snapshot (full state) or patch (diff from parent)';
COMMENT ON COLUMN plugin_version_history.snapshot_distance IS 'Number of patches from last snapshot (0 if this is snapshot)';

-- =====================================================
-- 2. PLUGIN VERSION PATCHES
-- =====================================================
-- Stores RFC 6902 JSON Patch operations per component
-- Efficient storage for incremental changes
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_version_patches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Version Reference
  version_id UUID NOT NULL,
  plugin_id UUID NOT NULL,  -- Denormalized for faster queries

  -- Component Identification
  component_type VARCHAR(50) NOT NULL,  -- 'hook', 'event', 'script', 'widget', 'controller', 'entity', 'migration'
  component_id UUID,  -- ID in source table (hooks, events, etc.)
  component_name VARCHAR(255),  -- Human-readable name

  -- Patch Operations (RFC 6902 JSON Patch format)
  patch_operations JSONB NOT NULL,  -- Array of {op, path, value} operations

  -- Change Type
  change_type VARCHAR(20),  -- 'added', 'modified', 'deleted'

  -- Reverse Patch (for rollback)
  reverse_patch JSONB,  -- Reverse operations for undo

  -- Statistics
  operations_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_plugin_patch_version FOREIGN KEY (version_id)
    REFERENCES plugin_version_history(id) ON DELETE CASCADE,

  CONSTRAINT fk_plugin_patch_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,

  CONSTRAINT check_component_type CHECK (component_type IN (
    'hook', 'event', 'script', 'widget', 'controller', 'entity',
    'migration', 'admin_page', 'manifest', 'metadata'
  )),

  CONSTRAINT check_change_type CHECK (change_type IN ('added', 'modified', 'deleted'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_plugin_patch_version ON plugin_version_patches(version_id);
CREATE INDEX IF NOT EXISTS idx_plugin_patch_plugin ON plugin_version_patches(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_patch_component ON plugin_version_patches(component_type, component_id);
CREATE INDEX IF NOT EXISTS idx_plugin_patch_change_type ON plugin_version_patches(change_type);

-- GIN index for JSONB querying
CREATE INDEX IF NOT EXISTS idx_plugin_patch_operations ON plugin_version_patches USING GIN (patch_operations);

COMMENT ON TABLE plugin_version_patches IS 'RFC 6902 JSON Patch operations for plugin component changes';
COMMENT ON COLUMN plugin_version_patches.patch_operations IS 'Array of JSON Patch operations: [{op, path, value}, ...]';
COMMENT ON COLUMN plugin_version_patches.reverse_patch IS 'Reverse operations for rollback/undo';

-- =====================================================
-- 3. PLUGIN VERSION SNAPSHOTS
-- =====================================================
-- Full snapshots of plugin state at specific versions
-- Created every 10 patches OR when tagged/published
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_version_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Version Reference
  version_id UUID NOT NULL UNIQUE,  -- One snapshot per version
  plugin_id UUID NOT NULL,

  -- Complete Plugin State (JSONB for flexibility)
  snapshot_data JSONB NOT NULL,  -- Full plugin configuration at this version

  -- Component Snapshots (denormalized for performance)
  hooks JSONB,       -- All hooks at this version
  events JSONB,      -- All events at this version
  scripts JSONB,     -- All scripts at this version
  widgets JSONB,     -- All widgets at this version
  controllers JSONB, -- All controllers at this version
  entities JSONB,    -- All entities at this version
  migrations JSONB,  -- All migrations at this version
  admin_pages JSONB, -- All admin pages at this version

  -- Metadata
  manifest JSONB,    -- Plugin manifest at this version
  registry JSONB,    -- Plugin registry entry at this version

  -- Compression
  is_compressed BOOLEAN DEFAULT false,
  compression_type VARCHAR(20),  -- 'gzip', 'brotli', null

  -- Statistics
  total_size_bytes INTEGER,
  compressed_size_bytes INTEGER,
  component_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_plugin_snapshot_version FOREIGN KEY (version_id)
    REFERENCES plugin_version_history(id) ON DELETE CASCADE,

  CONSTRAINT fk_plugin_snapshot_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_plugin_snapshot_version ON plugin_version_snapshots(version_id);
CREATE INDEX IF NOT EXISTS idx_plugin_snapshot_plugin ON plugin_version_snapshots(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_snapshot_created_at ON plugin_version_snapshots(created_at DESC);

-- GIN indexes for JSONB querying
CREATE INDEX IF NOT EXISTS idx_plugin_snapshot_data ON plugin_version_snapshots USING GIN (snapshot_data);

COMMENT ON TABLE plugin_version_snapshots IS 'Full plugin state snapshots for fast restore (created every 10 patches)';
COMMENT ON COLUMN plugin_version_snapshots.snapshot_data IS 'Complete plugin state at this version';

-- =====================================================
-- 4. PLUGIN VERSION TAGS
-- =====================================================
-- Named tags for versions (like git tags)
-- Examples: 'stable', 'production', 'v1.0.0', 'beta'
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_version_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Version Reference
  version_id UUID NOT NULL,
  plugin_id UUID NOT NULL,

  -- Tag Details
  tag_name VARCHAR(100) NOT NULL,  -- 'stable', 'production', 'v1.0.0', etc.
  tag_type VARCHAR(50),  -- 'release', 'milestone', 'custom'
  description TEXT,

  -- Tag Metadata
  created_by UUID,
  created_by_name VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_plugin_tag_version FOREIGN KEY (version_id)
    REFERENCES plugin_version_history(id) ON DELETE CASCADE,

  CONSTRAINT fk_plugin_tag_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,

  CONSTRAINT unique_plugin_tag UNIQUE (plugin_id, tag_name)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_plugin_tag_version ON plugin_version_tags(version_id);
CREATE INDEX IF NOT EXISTS idx_plugin_tag_plugin ON plugin_version_tags(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_tag_name ON plugin_version_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_plugin_tag_type ON plugin_version_tags(tag_type);

COMMENT ON TABLE plugin_version_tags IS 'Named tags for plugin versions (like git tags)';
COMMENT ON COLUMN plugin_version_tags.tag_name IS 'Tag name: stable, production, v1.0.0, etc.';

-- =====================================================
-- 5. PLUGIN VERSION COMPARISONS (CACHE)
-- =====================================================
-- Pre-computed version comparisons for performance
-- Stores diff summaries between any two versions
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_version_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Version References
  plugin_id UUID NOT NULL,
  from_version_id UUID NOT NULL,
  to_version_id UUID NOT NULL,

  -- Comparison Statistics
  files_changed INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_deleted INTEGER DEFAULT 0,
  components_added INTEGER DEFAULT 0,
  components_modified INTEGER DEFAULT 0,
  components_deleted INTEGER DEFAULT 0,

  -- Detailed Diff Summary
  diff_summary JSONB,  -- Component-by-component diff summary

  -- Cache Metadata
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cache_ttl INTEGER DEFAULT 3600,  -- Cache TTL in seconds

  -- Constraints
  CONSTRAINT fk_plugin_comparison_from FOREIGN KEY (from_version_id)
    REFERENCES plugin_version_history(id) ON DELETE CASCADE,

  CONSTRAINT fk_plugin_comparison_to FOREIGN KEY (to_version_id)
    REFERENCES plugin_version_history(id) ON DELETE CASCADE,

  CONSTRAINT fk_plugin_comparison_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,

  CONSTRAINT unique_version_comparison UNIQUE (from_version_id, to_version_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_plugin_comparison_plugin ON plugin_version_comparisons(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_comparison_from ON plugin_version_comparisons(from_version_id);
CREATE INDEX IF NOT EXISTS idx_plugin_comparison_to ON plugin_version_comparisons(to_version_id);
CREATE INDEX IF NOT EXISTS idx_plugin_comparison_computed ON plugin_version_comparisons(computed_at DESC);

COMMENT ON TABLE plugin_version_comparisons IS 'Cached version comparisons for performance';
COMMENT ON COLUMN plugin_version_comparisons.diff_summary IS 'Detailed diff summary per component type';

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_plugin_version_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure only one current version per plugin
CREATE OR REPLACE FUNCTION ensure_single_current_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE plugin_version_history
    SET is_current = false
    WHERE plugin_id = NEW.plugin_id
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single current version
DROP TRIGGER IF EXISTS trigger_ensure_single_current_version ON plugin_version_history;
CREATE TRIGGER trigger_ensure_single_current_version
  BEFORE INSERT OR UPDATE ON plugin_version_history
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_current_version();

-- Auto-increment snapshot_distance
CREATE OR REPLACE FUNCTION auto_increment_snapshot_distance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.version_type = 'snapshot' THEN
    NEW.snapshot_distance = 0;
  ELSIF NEW.parent_version_id IS NOT NULL THEN
    SELECT COALESCE(snapshot_distance, 0) + 1
    INTO NEW.snapshot_distance
    FROM plugin_version_history
    WHERE id = NEW.parent_version_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment snapshot distance
DROP TRIGGER IF EXISTS trigger_auto_increment_snapshot_distance ON plugin_version_history;
CREATE TRIGGER trigger_auto_increment_snapshot_distance
  BEFORE INSERT ON plugin_version_history
  FOR EACH ROW
  EXECUTE FUNCTION auto_increment_snapshot_distance();

-- =====================================================
-- VIEWS FOR CONVENIENCE
-- =====================================================

-- View: Latest version per plugin
CREATE OR REPLACE VIEW plugin_latest_versions AS
SELECT DISTINCT ON (plugin_id)
  id,
  plugin_id,
  version_number,
  version_type,
  commit_message,
  is_current,
  is_published,
  created_at
FROM plugin_version_history
ORDER BY plugin_id, created_at DESC;

COMMENT ON VIEW plugin_latest_versions IS 'Latest version for each plugin';

-- View: Version history with tag names
CREATE OR REPLACE VIEW plugin_versions_with_tags AS
SELECT
  vh.id,
  vh.plugin_id,
  vh.version_number,
  vh.version_type,
  vh.commit_message,
  vh.is_current,
  vh.is_published,
  vh.files_changed,
  vh.lines_added,
  vh.lines_deleted,
  vh.created_at,
  vh.created_by_name,
  COALESCE(
    json_agg(
      json_build_object('name', vt.tag_name, 'type', vt.tag_type)
    ) FILTER (WHERE vt.id IS NOT NULL),
    '[]'::json
  ) as tags
FROM plugin_version_history vh
LEFT JOIN plugin_version_tags vt ON vh.id = vt.version_id
GROUP BY vh.id;

COMMENT ON VIEW plugin_versions_with_tags IS 'Plugin versions with their associated tags';

-- =====================================================
-- INITIAL DATA / SEED
-- =====================================================

-- Create initial snapshots for all existing plugins
-- This runs once to initialize version control for existing plugins
DO $$
DECLARE
  plugin_record RECORD;
  initial_version_id UUID;
BEGIN
  FOR plugin_record IN
    SELECT id, name, version, created_at
    FROM plugin_registry
    WHERE NOT EXISTS (
      SELECT 1 FROM plugin_version_history
      WHERE plugin_id = plugin_registry.id
    )
  LOOP
    -- Create initial snapshot version
    INSERT INTO plugin_version_history (
      plugin_id,
      version_number,
      version_type,
      commit_message,
      is_current,
      is_published,
      snapshot_distance,
      created_at
    ) VALUES (
      plugin_record.id,
      COALESCE(plugin_record.version, '1.0.0'),
      'snapshot',
      'Initial version control snapshot',
      true,
      true,
      0,
      plugin_record.created_at
    )
    RETURNING id INTO initial_version_id;

    RAISE NOTICE 'Created initial snapshot for plugin: % (version %)', plugin_record.name, COALESCE(plugin_record.version, '1.0.0');
  END LOOP;
END $$;

-- =====================================================
-- COMPLETE
-- =====================================================
