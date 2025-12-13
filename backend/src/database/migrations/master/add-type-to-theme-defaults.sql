-- Add type column to theme_defaults for distinguishing system vs user-created themes
-- Types: 'system' (default), 'user' (custom created from store.settings)

-- Add the type column with default 'system'
ALTER TABLE theme_defaults
ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'system';

-- Add user_id for user-created themes (nullable for system themes)
ALTER TABLE theme_defaults
ADD COLUMN IF NOT EXISTS user_id UUID NULL;

-- Add index for type filtering
CREATE INDEX IF NOT EXISTS idx_theme_defaults_type ON theme_defaults(type);

-- Add index for user's themes lookup
CREATE INDEX IF NOT EXISTS idx_theme_defaults_user_id ON theme_defaults(user_id) WHERE user_id IS NOT NULL;

-- Update existing records to be 'system' type (already defaulted, but explicit)
UPDATE theme_defaults SET type = 'system' WHERE type IS NULL;

-- Add comment
COMMENT ON COLUMN theme_defaults.type IS 'Theme type: system (default presets), user (custom themes copied from store.settings)';
COMMENT ON COLUMN theme_defaults.user_id IS 'User ID who created this theme (NULL for system themes)';
