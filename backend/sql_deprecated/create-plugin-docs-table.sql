-- =====================================================
-- PLUGIN DOCS TABLE
-- =====================================================
-- Stores documentation and metadata files for plugins
-- These files are for reference only, not executed
-- Examples: README.md, CHANGELOG.md, LICENSE, manifest.json
-- =====================================================

CREATE TABLE IF NOT EXISTS plugin_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plugin Reference
  plugin_id UUID NOT NULL,

  -- Document Identification
  doc_type VARCHAR(50) NOT NULL,  -- 'readme', 'manifest', 'changelog', 'license', 'contributing'
  file_name VARCHAR(255) NOT NULL,  -- 'README.md', 'manifest.json', 'CHANGELOG.md'
  title VARCHAR(255),  -- Optional display title

  -- Content
  content TEXT NOT NULL,  -- Markdown or JSON content
  format VARCHAR(20) DEFAULT 'markdown',  -- 'markdown', 'json', 'text'

  -- Metadata
  description TEXT,
  is_visible BOOLEAN DEFAULT true,  -- Show in FileTree
  display_order INTEGER DEFAULT 0,  -- Order in FileTree

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT fk_plugin_docs_plugin FOREIGN KEY (plugin_id)
    REFERENCES plugin_registry(id) ON DELETE CASCADE,

  CONSTRAINT unique_plugin_doc UNIQUE (plugin_id, doc_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plugin_docs_plugin_id ON plugin_docs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_docs_type ON plugin_docs(doc_type);
CREATE INDEX IF NOT EXISTS idx_plugin_docs_visible ON plugin_docs(is_visible);

-- Comments
COMMENT ON TABLE plugin_docs IS 'Documentation and metadata files for plugins (README, manifest, etc.) - not executed';
COMMENT ON COLUMN plugin_docs.doc_type IS 'Type: readme, manifest, changelog, license, contributing';
COMMENT ON COLUMN plugin_docs.content IS 'File content (markdown for docs, JSON for manifest)';
COMMENT ON COLUMN plugin_docs.is_visible IS 'Whether to show in FileTree';
