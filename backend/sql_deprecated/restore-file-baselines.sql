-- Restore file_baselines table for FileTreeNavigator
-- This table is needed for IDE features and development tools

CREATE TABLE IF NOT EXISTS file_baselines (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  file_size INTEGER,
  last_modified TIMESTAMP,
  content_hash VARCHAR(64),
  file_type VARCHAR(20),
  baseline_content TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_baselines_path ON file_baselines(file_path);
CREATE INDEX IF NOT EXISTS idx_file_baselines_type ON file_baselines(file_type);
CREATE INDEX IF NOT EXISTS idx_file_baselines_modified ON file_baselines(last_modified);

-- Insert some common files for development
INSERT INTO file_baselines (file_path, file_type, file_size, last_modified) VALUES
  ('src/components/ai-context/FileTreeNavigator.jsx', 'jsx', 15000, CURRENT_TIMESTAMP),
  ('src/components/ai-context/CodeEditor.jsx', 'jsx', 25000, CURRENT_TIMESTAMP),  
  ('src/components/ai-context/DiffPreviewSystem.jsx', 'jsx', 18000, CURRENT_TIMESTAMP),
  ('src/components/ai-context/PreviewSystem.jsx', 'jsx', 20000, CURRENT_TIMESTAMP),
  ('src/pages/Cart.jsx', 'jsx', 30000, CURRENT_TIMESTAMP),
  ('src/pages/Shop.jsx', 'jsx', 20000, CURRENT_TIMESTAMP),
  ('src/pages/Product.jsx', 'jsx', 25000, CURRENT_TIMESTAMP),
  ('src/core/HookSystem.js', 'js', 12000, CURRENT_TIMESTAMP),
  ('src/core/EventSystem.js', 'js', 10000, CURRENT_TIMESTAMP),
  ('src/core/ExtensionSystem.js', 'js', 15000, CURRENT_TIMESTAMP),
  ('src/core/VersionSystem.js', 'js', 18000, CURRENT_TIMESTAMP),
  ('src/extensions/custom-pricing.js', 'js', 8000, CURRENT_TIMESTAMP),
  ('src/extensions/analytics-tracker.js', 'js', 12000, CURRENT_TIMESTAMP),
  ('src/services/cartService.js', 'js', 10000, CURRENT_TIMESTAMP),
  ('src/services/taxService.js', 'js', 8000, CURRENT_TIMESTAMP),
  ('backend/src/routes/extensions.js', 'js', 15000, CURRENT_TIMESTAMP),
  ('backend/src/services/extension-service.js', 'js', 20000, CURRENT_TIMESTAMP)
ON CONFLICT (file_path) DO UPDATE SET
  last_modified = CURRENT_TIMESTAMP,
  updated_at = CURRENT_TIMESTAMP;