-- Migration: Populate file_baselines table with source code files
-- This creates and populates the file_baselines table if it doesn't exist

-- Create the file_baselines table if it doesn't exist
CREATE TABLE IF NOT EXISTS file_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT UNIQUE NOT NULL,
  baseline_code TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  version TEXT DEFAULT 'latest',
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  last_modified TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_file_baselines_path ON file_baselines(file_path);
CREATE INDEX IF NOT EXISTS idx_file_baselines_version ON file_baselines(version);
CREATE INDEX IF NOT EXISTS idx_file_baselines_type ON file_baselines(file_type);

-- Enable RLS (Row Level Security) if using Supabase
-- ALTER TABLE file_baselines ENABLE ROW LEVEL SECURITY;

-- Create function to calculate SHA256 hash (if not exists)
CREATE OR REPLACE FUNCTION calculate_code_hash(code_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(code_text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_file_baselines_updated_at ON file_baselines;
CREATE TRIGGER update_file_baselines_updated_at 
  BEFORE UPDATE ON file_baselines 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get file type from extension
CREATE OR REPLACE FUNCTION get_file_type(file_path TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE 
    WHEN file_path LIKE '%.jsx' THEN RETURN 'jsx';
    WHEN file_path LIKE '%.js' THEN RETURN 'js';
    WHEN file_path LIKE '%.ts' THEN RETURN 'ts';
    WHEN file_path LIKE '%.tsx' THEN RETURN 'tsx';
    WHEN file_path LIKE '%.css' THEN RETURN 'css';
    WHEN file_path LIKE '%.scss' THEN RETURN 'scss';
    WHEN file_path LIKE '%.json' THEN RETURN 'json';
    WHEN file_path LIKE '%.md' THEN RETURN 'md';
    WHEN file_path LIKE '%.html' THEN RETURN 'html';
    WHEN file_path LIKE '%.sql' THEN RETURN 'sql';
    ELSE RETURN 'text';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Insert key slot editor files
INSERT INTO file_baselines (file_path, baseline_code, code_hash, file_type, file_size, last_modified) 
VALUES 
  ('src/core/slot-editor/HybridCustomizationEditor.jsx', 
   '-- Placeholder for HybridCustomizationEditor.jsx content --', 
   calculate_code_hash('-- Placeholder for HybridCustomizationEditor.jsx content --'), 
   'jsx', 
   100, 
   NOW()),
  ('src/core/slot-editor/ConfigurationEditor.jsx', 
   '-- Placeholder for ConfigurationEditor.jsx content --', 
   calculate_code_hash('-- Placeholder for ConfigurationEditor.jsx content --'), 
   'jsx', 
   100, 
   NOW()),
  ('src/core/slot-editor/ConfigurationPreview.jsx', 
   '-- Placeholder for ConfigurationPreview.jsx content --', 
   calculate_code_hash('-- Placeholder for ConfigurationPreview.jsx content --'), 
   'jsx', 
   100, 
   NOW()),
  ('src/core/slot-editor/SlotsWorkspace.jsx', 
   '-- Placeholder for SlotsWorkspace.jsx content --', 
   calculate_code_hash('-- Placeholder for SlotsWorkspace.jsx content --'), 
   'jsx', 
   100, 
   NOW()),
  ('src/core/slot-editor/types.js', 
   '-- Placeholder for types.js content --', 
   calculate_code_hash('-- Placeholder for types.js content --'), 
   'js', 
   100, 
   NOW()),
  ('src/pages/CartSlotted.jsx', 
   '-- Placeholder for CartSlotted.jsx content --', 
   calculate_code_hash('-- Placeholder for CartSlotted.jsx content --'), 
   'jsx', 
   100, 
   NOW()),
  ('src/core/slot-system/default-components/CartSlots.jsx', 
   '-- Placeholder for CartSlots.jsx content --', 
   calculate_code_hash('-- Placeholder for CartSlots.jsx content --'), 
   'jsx', 
   100, 
   NOW()),
  ('src/pages/AIContextWindow.jsx', 
   '-- Placeholder for AIContextWindow.jsx content --', 
   calculate_code_hash('-- Placeholder for AIContextWindow.jsx content --'), 
   'jsx', 
   100, 
   NOW())
ON CONFLICT (file_path) DO UPDATE SET
  baseline_code = EXCLUDED.baseline_code,
  code_hash = EXCLUDED.code_hash,
  file_size = EXCLUDED.file_size,
  last_modified = EXCLUDED.last_modified,
  updated_at = NOW();

-- Create a function to populate file baselines (can be called from backend)
CREATE OR REPLACE FUNCTION populate_file_baseline(
  p_file_path TEXT,
  p_baseline_code TEXT
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  INSERT INTO file_baselines (
    file_path, 
    baseline_code, 
    code_hash, 
    file_type, 
    file_size, 
    last_modified
  ) VALUES (
    p_file_path,
    p_baseline_code,
    calculate_code_hash(p_baseline_code),
    get_file_type(p_file_path),
    length(p_baseline_code),
    NOW()
  )
  ON CONFLICT (file_path) DO UPDATE SET
    baseline_code = EXCLUDED.baseline_code,
    code_hash = EXCLUDED.code_hash,
    file_size = EXCLUDED.file_size,
    last_modified = EXCLUDED.last_modified,
    updated_at = NOW()
  RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql;