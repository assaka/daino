-- Create ast_diffs table for detailed AST difference tracking
CREATE TABLE IF NOT EXISTS ast_diffs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES customization_snapshots(id) ON DELETE CASCADE,
    diff_type VARCHAR(20) NOT NULL CHECK (diff_type IN ('addition', 'deletion', 'modification', 'move', 'rename')),
    node_path VARCHAR(1024) NOT NULL,
    node_type VARCHAR(128) NOT NULL,
    old_value JSON,
    new_value JSON,
    impact_level VARCHAR(20) DEFAULT 'low' CHECK (impact_level IN ('low', 'medium', 'high', 'breaking')),
    line_start INTEGER,
    line_end INTEGER,
    column_start INTEGER,
    column_end INTEGER,
    description TEXT,
    metadata JSON DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ast_diffs_snapshot_id ON ast_diffs(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_ast_diffs_diff_type ON ast_diffs(diff_type);
CREATE INDEX IF NOT EXISTS idx_ast_diffs_node_type ON ast_diffs(node_type);
CREATE INDEX IF NOT EXISTS idx_ast_diffs_impact_level ON ast_diffs(impact_level);
CREATE INDEX IF NOT EXISTS idx_ast_diffs_snapshot_node_path ON ast_diffs(snapshot_id, node_path);
CREATE INDEX IF NOT EXISTS idx_ast_diffs_lines ON ast_diffs(line_start, line_end);

-- Create a compound index for efficient querying by snapshot and various filters
CREATE INDEX IF NOT EXISTS idx_ast_diffs_compound ON ast_diffs(snapshot_id, diff_type, impact_level);