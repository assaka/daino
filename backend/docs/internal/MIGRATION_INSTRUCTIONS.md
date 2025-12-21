# CRITICAL: Run This Migration in Supabase NOW

## Step 1: Go to Supabase SQL Editor
1. Open https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left sidebar
4. Click "New Query"

## Step 2: Copy and Run This EXACT SQL

```sql
-- STEP 1: Drop foreign key constraints temporarily
ALTER TABLE plugin_configurations
DROP CONSTRAINT IF EXISTS plugin_configurations_plugin_id_fkey;

-- STEP 2: Change plugin_id column type from UUID to VARCHAR
ALTER TABLE plugin_configurations
ALTER COLUMN plugin_id TYPE VARCHAR(255);

-- STEP 3: Add new columns to plugin_registry
ALTER TABLE plugin_registry
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deprecation_reason TEXT,
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- STEP 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_plugin_registry_is_public ON plugin_registry(is_public);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_deprecated ON plugin_registry(deprecated_at);
CREATE INDEX IF NOT EXISTS idx_plugin_registry_creator ON plugin_registry(creator_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_plugin_id ON plugin_configurations(plugin_id);

-- STEP 5: Add comments
COMMENT ON COLUMN plugin_registry.is_public IS 'Whether the plugin is publicly available in the marketplace';
COMMENT ON COLUMN plugin_registry.deprecated_at IS 'Timestamp when deprecated';
COMMENT ON COLUMN plugin_registry.deprecation_reason IS 'Reason for deprecation';
COMMENT ON COLUMN plugin_registry.creator_id IS 'User who created this plugin';
COMMENT ON COLUMN plugin_configurations.plugin_id IS 'VARCHAR reference to plugin_registry.id';

-- STEP 6: Verify changes
SELECT
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'plugin_configurations'
  AND column_name = 'plugin_id';

SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'plugin_registry'
  AND column_name IN ('is_public', 'deprecated_at', 'deprecation_reason', 'creator_id');
```

## Step 3: Verify Success
You should see:
- plugin_configurations.plugin_id → `character varying` with length 255
- plugin_registry.is_public → `boolean`
- plugin_registry.deprecated_at → `timestamp without time zone`
- plugin_registry.deprecation_reason → `text`
- plugin_registry.creator_id → `uuid`

## Step 4: Wait for Render Deployment
Wait 2-5 minutes for commit `42f2ff36` to deploy on Render.

## Step 5: Test Features
After both steps complete, test:
- ✅ Make Public/Private toggle
- ✅ Deprecate (public plugins)
- ✅ Delete (private plugins)
- ✅ Activate/Deactivate for store
