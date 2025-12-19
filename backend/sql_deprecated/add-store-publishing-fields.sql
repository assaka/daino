-- Migration: Add store publishing and deployment fields
-- Date: 2025-01-11
-- Description: Add fields needed for the new store creation and publishing workflow

-- Add deployment status enum
CREATE TYPE deployment_status_enum AS ENUM ('draft', 'deploying', 'deployed', 'failed');

-- Add columns to stores table
ALTER TABLE stores 
ADD COLUMN deployment_status deployment_status_enum DEFAULT 'draft',
ADD COLUMN published BOOLEAN DEFAULT FALSE,
ADD COLUMN published_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN render_service_id VARCHAR(255),
ADD COLUMN render_service_url VARCHAR(500),
ADD COLUMN auto_supabase_project_id VARCHAR(255),
ADD COLUMN auto_supabase_project_url VARCHAR(500),
ADD COLUMN github_repo_url VARCHAR(500),
ADD COLUMN template_customizations JSONB DEFAULT '{}';

-- Add indexes for better performance
CREATE INDEX idx_stores_deployment_status ON stores(deployment_status);
CREATE INDEX idx_stores_published ON stores(published);
CREATE INDEX idx_stores_published_at ON stores(published_at);
CREATE INDEX idx_stores_render_service_id ON stores(render_service_id);

-- Add comments for documentation
COMMENT ON COLUMN stores.deployment_status IS 'Current deployment status of the store';
COMMENT ON COLUMN stores.published IS 'Whether the store is published and charging credits';
COMMENT ON COLUMN stores.published_at IS 'When the store was published';
COMMENT ON COLUMN stores.render_service_id IS 'ID of the auto-deployed Render service';
COMMENT ON COLUMN stores.render_service_url IS 'URL of the deployed Render service';
COMMENT ON COLUMN stores.auto_supabase_project_id IS 'ID of the auto-created Supabase project';
COMMENT ON COLUMN stores.auto_supabase_project_url IS 'URL of the auto-created Supabase project';
COMMENT ON COLUMN stores.template_customizations IS 'JSON object containing template customizations';