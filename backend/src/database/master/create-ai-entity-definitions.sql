-- AI Entity Definitions Table
-- Run this in Supabase SQL Editor to create the table

CREATE TABLE IF NOT EXISTS ai_entity_definitions (
  id SERIAL PRIMARY KEY,
  entity_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  table_name VARCHAR(100) NOT NULL,
  related_tables JSONB DEFAULT '[]',
  supported_operations JSONB DEFAULT '["list", "get", "create", "update", "delete"]',
  fields JSONB NOT NULL,
  primary_key VARCHAR(50) DEFAULT 'id',
  tenant_column VARCHAR(50) DEFAULT 'store_id',
  intent_keywords JSONB DEFAULT '[]',
  example_prompts JSONB DEFAULT '[]',
  example_responses JSONB DEFAULT '[]',
  api_endpoint VARCHAR(255),
  validation_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  requires_confirmation BOOLEAN DEFAULT false,
  is_destructive BOOLEAN DEFAULT false,
  category VARCHAR(100) DEFAULT 'general',
  priority INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_entity_definitions_entity_name ON ai_entity_definitions(entity_name);
CREATE INDEX IF NOT EXISTS idx_ai_entity_definitions_table_name ON ai_entity_definitions(table_name);
CREATE INDEX IF NOT EXISTS idx_ai_entity_definitions_category ON ai_entity_definitions(category);
CREATE INDEX IF NOT EXISTS idx_ai_entity_definitions_is_active ON ai_entity_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_entity_definitions_priority ON ai_entity_definitions(priority);

-- Enable RLS
ALTER TABLE ai_entity_definitions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (admin table)
CREATE POLICY "ai_entity_definitions_all_access" ON ai_entity_definitions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE ai_entity_definitions IS 'Database-driven entity schemas for dynamic AI admin operations';
