-- Versioned Patch System Migration
-- Removes overlay system and implements patches-only approach with A/B testing and rollback support

-- Drop overlay-related tables if they exist
DROP TABLE IF EXISTS customization_overlays CASCADE;

-- Create patch releases table for versioning
CREATE TABLE IF NOT EXISTS patch_releases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    version_name VARCHAR(255) NOT NULL, -- e.g., "v1.0.0", "feature-cart-update"
    version_number INTEGER NOT NULL DEFAULT 1,
    release_type VARCHAR(50) NOT NULL DEFAULT 'minor', -- major, minor, patch, hotfix, feature
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- draft, published, rolled_back, archived
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    published_at TIMESTAMP,
    rolled_back_at TIMESTAMP,
    rollback_reason TEXT,
    ab_test_config JSONB, -- A/B testing configuration
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique version names per store
    UNIQUE(store_id, version_name),
    -- Ensure unique version numbers per store
    UNIQUE(store_id, version_number)
);

-- Create patches table for individual code changes
CREATE TABLE IF NOT EXISTS code_patches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    release_id UUID REFERENCES patch_releases(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    file_path VARCHAR(512) NOT NULL, -- e.g., "src/pages/Cart.jsx"
    patch_name VARCHAR(255) NOT NULL, -- descriptive name for the patch
    change_type VARCHAR(100) NOT NULL, -- text_change, style_change, component_add, etc.
    
    -- Patch content
    unified_diff TEXT NOT NULL, -- diff-match-patch format
    ast_diff JSONB, -- AST changes for JS/JSX files
    change_summary TEXT NOT NULL, -- "Changed Cart to Shopping Cart"
    change_description TEXT,
    
    -- Patch metadata
    baseline_version VARCHAR(255), -- which version this patch is based on
    applies_to_lines JSONB, -- line numbers this patch affects
    dependencies JSONB DEFAULT '[]', -- other patches this depends on
    conflicts_with JSONB DEFAULT '[]', -- patches that conflict with this one
    
    -- Status and tracking
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, published, rolled_back
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- for patch ordering
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create A/B test variants table
CREATE TABLE IF NOT EXISTS ab_test_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    variant_name VARCHAR(255) NOT NULL, -- "control", "variant_a", "cart_update_test"
    patch_release_id UUID REFERENCES patch_releases(id) ON DELETE CASCADE,
    
    -- A/B test configuration
    traffic_percentage INTEGER NOT NULL DEFAULT 50, -- percentage of users to show this variant
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    
    -- Results tracking
    conversion_goals JSONB DEFAULT '[]', -- what we're measuring
    metrics JSONB DEFAULT '{}', -- collected metrics
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique variant names per test
    UNIQUE(store_id, test_name, variant_name)
);

-- Create patch application log for rollback support
CREATE TABLE IF NOT EXISTS patch_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    patch_id UUID NOT NULL REFERENCES code_patches(id) ON DELETE CASCADE,
    release_id UUID REFERENCES patch_releases(id) ON DELETE CASCADE,
    
    -- Application context
    applied_by VARCHAR(100) NOT NULL, -- 'user', 'system', 'ab_test', 'preview'
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    ab_variant VARCHAR(255),
    
    -- Application details
    file_path VARCHAR(512) NOT NULL,
    baseline_code_hash VARCHAR(64), -- SHA256 of baseline code
    result_code_hash VARCHAR(64), -- SHA256 of code after patch application
    application_status VARCHAR(50) NOT NULL, -- success, failed, partial
    error_message TEXT,
    
    -- Timing
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER -- how long patch application took
);

-- Create baseline code storage for diff generation
CREATE TABLE IF NOT EXISTS file_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    file_path VARCHAR(512) NOT NULL,
    baseline_code TEXT NOT NULL,
    code_hash VARCHAR(64) NOT NULL, -- SHA256 hash for integrity
    version VARCHAR(255) NOT NULL DEFAULT 'latest',
    
    -- Metadata
    file_type VARCHAR(50), -- jsx, js, css, etc.
    file_size INTEGER,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one baseline per file per store
    UNIQUE(store_id, file_path, version)
);

-- Create user patch preferences for personalization
CREATE TABLE IF NOT EXISTS user_patch_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- Preference settings
    preferred_patch_version VARCHAR(255), -- which version user prefers
    excluded_patches JSONB DEFAULT '[]', -- patches user has disabled
    ab_test_overrides JSONB DEFAULT '{}', -- manual A/B test assignments
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, store_id)
);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_patch_releases_updated_at ON patch_releases;
CREATE TRIGGER update_patch_releases_updated_at
    BEFORE UPDATE ON patch_releases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_code_patches_updated_at ON code_patches;
CREATE TRIGGER update_code_patches_updated_at
    BEFORE UPDATE ON code_patches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ab_test_variants_updated_at ON ab_test_variants;
CREATE TRIGGER update_ab_test_variants_updated_at
    BEFORE UPDATE ON ab_test_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO patch_releases (store_id, version_name, version_number, release_type, status, description, created_by)
SELECT 
    id as store_id,
    'v1.0.0-initial' as version_name,
    1 as version_number,
    'major' as release_type,
    'draft' as status,
    'Initial patch release for versioned system' as description,
    (SELECT id FROM users WHERE role = 'store_owner' LIMIT 1) as created_by
FROM stores 
WHERE id = '157d4590-49bf-4b0b-bd77-abe131909528'
ON CONFLICT (store_id, version_name) DO NOTHING;

-- Create initial baseline for Cart.jsx
INSERT INTO file_baselines (store_id, file_path, baseline_code, code_hash, file_type)
SELECT 
    '157d4590-49bf-4b0b-bd77-abe131909528' as store_id,
    'src/pages/Cart.jsx' as file_path,
    'function Cart() { return <div>Original Cart</div>; }' as baseline_code,
    encode(sha256('function Cart() { return <div>Original Cart</div>; }'::bytea), 'hex') as code_hash,
    'jsx' as file_type
ON CONFLICT (store_id, file_path, version) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patches_file_path ON code_patches (file_path);
CREATE INDEX IF NOT EXISTS idx_patches_store_id ON code_patches (store_id);
CREATE INDEX IF NOT EXISTS idx_patches_release_id ON code_patches (release_id);
CREATE INDEX IF NOT EXISTS idx_patches_status ON code_patches (status);
CREATE INDEX IF NOT EXISTS idx_applications_store_file ON patch_applications (store_id, file_path);
CREATE INDEX IF NOT EXISTS idx_applications_release ON patch_applications (release_id);
CREATE INDEX IF NOT EXISTS idx_applications_session ON patch_applications (session_id);
CREATE INDEX IF NOT EXISTS idx_baselines_store_path ON file_baselines (store_id, file_path);

-- Grant permissions
GRANT ALL ON patch_releases TO PUBLIC;
GRANT ALL ON code_patches TO PUBLIC;
GRANT ALL ON ab_test_variants TO PUBLIC;
GRANT ALL ON patch_applications TO PUBLIC;
GRANT ALL ON file_baselines TO PUBLIC;
GRANT ALL ON user_patch_preferences TO PUBLIC;