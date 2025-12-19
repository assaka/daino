-- Migration: Create Extension System Tables
-- Replaces the old patch system with a hook-based extension architecture

-- Create extension_releases table (replaces patch_releases)
CREATE TABLE IF NOT EXISTS extension_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'minor', -- major, minor, patch, hotfix
  changes JSONB NOT NULL DEFAULT '[]', -- Array of change objects
  status VARCHAR(20) DEFAULT 'draft', -- draft, published, rolled_back, archived
  
  -- Creation metadata
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Publishing metadata
  published_by UUID,
  published_at TIMESTAMP,
  publish_notes TEXT,
  
  -- Rollback metadata
  rollback_version VARCHAR(50), -- Version to rollback to
  rollback_performed_by UUID,
  rollback_performed_at TIMESTAMP,
  rollback_reason TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT fk_extension_releases_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_extension_releases_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_extension_releases_published_by FOREIGN KEY (published_by) REFERENCES users(id),
  CONSTRAINT fk_extension_releases_rollback_by FOREIGN KEY (rollback_performed_by) REFERENCES users(id),
  CONSTRAINT unique_store_version UNIQUE (store_id, version)
);

-- Create version_history table for tracking all version actions
CREATE TABLE IF NOT EXISTS version_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  release_id UUID NOT NULL,
  version VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL, -- published, rolled_back, archived
  performed_by UUID NOT NULL,
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  
  CONSTRAINT fk_version_history_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_version_history_release FOREIGN KEY (release_id) REFERENCES extension_releases(id) ON DELETE CASCADE,
  CONSTRAINT fk_version_history_performed_by FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- Create extension_modules table for storing reusable extensions
CREATE TABLE IF NOT EXISTS extension_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  author_id UUID NOT NULL,
  
  -- Module definition
  module_config JSONB NOT NULL, -- Contains hooks, events, etc.
  entry_point TEXT, -- Path to main module file
  dependencies JSONB DEFAULT '[]', -- Array of required dependencies
  
  -- Publication info
  is_public BOOLEAN DEFAULT false,
  category VARCHAR(100),
  tags JSONB DEFAULT '[]',
  
  -- Lifecycle
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active', -- active, deprecated, archived
  
  CONSTRAINT fk_extension_modules_author FOREIGN KEY (author_id) REFERENCES users(id),
  CONSTRAINT unique_module_version UNIQUE (name, version)
);

-- Create store_extensions table for tracking which extensions are installed per store
CREATE TABLE IF NOT EXISTS store_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  extension_module_id UUID NOT NULL,
  installed_version VARCHAR(50) NOT NULL,
  
  -- Installation metadata
  installed_by UUID NOT NULL,
  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  configuration JSONB DEFAULT '{}', -- Store-specific configuration
  
  -- Status
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10, -- For hook execution order
  
  CONSTRAINT fk_store_extensions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_store_extensions_module FOREIGN KEY (extension_module_id) REFERENCES extension_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_store_extensions_installed_by FOREIGN KEY (installed_by) REFERENCES users(id),
  CONSTRAINT unique_store_extension UNIQUE (store_id, extension_module_id)
);

-- Create hook_registrations table for tracking active hooks
CREATE TABLE IF NOT EXISTS hook_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  hook_name VARCHAR(255) NOT NULL,
  extension_module_id UUID,
  release_id UUID,
  
  -- Hook definition
  handler_function TEXT NOT NULL, -- JavaScript function as string
  priority INTEGER DEFAULT 10,
  is_async BOOLEAN DEFAULT false,
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT fk_hook_registrations_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_hook_registrations_module FOREIGN KEY (extension_module_id) REFERENCES extension_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_hook_registrations_release FOREIGN KEY (release_id) REFERENCES extension_releases(id) ON DELETE CASCADE
);

-- Create event_listeners table for tracking event subscriptions
CREATE TABLE IF NOT EXISTS event_listeners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  extension_module_id UUID,
  release_id UUID,
  
  -- Listener definition
  handler_function TEXT NOT NULL, -- JavaScript function as string
  priority INTEGER DEFAULT 10,
  is_once BOOLEAN DEFAULT false, -- One-time listener
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT fk_event_listeners_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_listeners_module FOREIGN KEY (extension_module_id) REFERENCES extension_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_listeners_release FOREIGN KEY (release_id) REFERENCES extension_releases(id) ON DELETE CASCADE
);

-- Create extension_logs table for debugging and monitoring
CREATE TABLE IF NOT EXISTS extension_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  extension_module_id UUID,
  release_id UUID,
  
  -- Log details
  log_level VARCHAR(20) NOT NULL, -- debug, info, warn, error
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  
  -- Source information
  hook_name VARCHAR(255),
  event_name VARCHAR(255),
  source_function TEXT,
  
  -- Timing
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER,
  
  CONSTRAINT fk_extension_logs_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_extension_logs_module FOREIGN KEY (extension_module_id) REFERENCES extension_modules(id) ON DELETE CASCADE,
  CONSTRAINT fk_extension_logs_release FOREIGN KEY (release_id) REFERENCES extension_releases(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_extension_releases_store_status ON extension_releases(store_id, status);
CREATE INDEX idx_extension_releases_store_version ON extension_releases(store_id, version);
CREATE INDEX idx_extension_releases_published_at ON extension_releases(published_at DESC);

CREATE INDEX idx_version_history_store_version ON version_history(store_id, version);
CREATE INDEX idx_version_history_performed_at ON version_history(performed_at DESC);

CREATE INDEX idx_extension_modules_name_version ON extension_modules(name, version);
CREATE INDEX idx_extension_modules_public ON extension_modules(is_public, status);

CREATE INDEX idx_store_extensions_store ON store_extensions(store_id, is_enabled);
CREATE INDEX idx_store_extensions_priority ON store_extensions(store_id, priority);

CREATE INDEX idx_hook_registrations_store_hook ON hook_registrations(store_id, hook_name, is_active);
CREATE INDEX idx_hook_registrations_priority ON hook_registrations(store_id, hook_name, priority);

CREATE INDEX idx_event_listeners_store_event ON event_listeners(store_id, event_name, is_active);
CREATE INDEX idx_event_listeners_priority ON event_listeners(store_id, event_name, priority);

CREATE INDEX idx_extension_logs_store_level ON extension_logs(store_id, log_level);
CREATE INDEX idx_extension_logs_created_at ON extension_logs(created_at DESC);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_extension_modules_updated_at 
  BEFORE UPDATE ON extension_modules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert initial hook points for common extension points
INSERT INTO hook_registrations (id, store_id, hook_name, handler_function, description, is_active) VALUES
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'component.beforeRender', 'return value;', 'Called before component renders', false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'component.afterRender', 'return value;', 'Called after component renders', false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'cart.beforeAddItem', 'return value;', 'Called before adding item to cart', false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'cart.afterAddItem', 'return value;', 'Called after adding item to cart', false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'pricing.calculate', 'return value;', 'Called to calculate pricing', false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'api.beforeRequest', 'return value;', 'Called before API requests', false),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'api.afterResponse', 'return value;', 'Called after API responses', false)
ON CONFLICT DO NOTHING;