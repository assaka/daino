-- Migration: Create ai_models table
-- Purpose: Master table to manage AI model configurations
-- Created: 2025-12-04

-- Create enum for AI providers
DO $$ BEGIN
  CREATE TYPE ai_provider AS ENUM ('anthropic', 'openai', 'gemini', 'groq', 'deepseek');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the master AI models table
CREATE TABLE IF NOT EXISTS ai_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Model identification
  model_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'claude-sonnet', 'gpt-4o-mini'
  name VARCHAR(100) NOT NULL, -- Human-readable name: 'Claude Sonnet'
  provider ai_provider NOT NULL, -- anthropic, openai, gemini, groq

  -- API model mapping
  api_model VARCHAR(100) NOT NULL, -- Actual API model ID: 'claude-3-5-sonnet-20241022'

  -- Display and UI
  icon VARCHAR(10), -- Emoji icon: '🎯'
  description VARCHAR(255), -- Short description: 'Balanced performance'

  -- Pricing
  credits_per_use DECIMAL(10, 4) NOT NULL DEFAULT 1.0000,
  service_key VARCHAR(100), -- Reference to service_credit_costs: 'ai_chat_claude_sonnet'

  -- Configuration
  is_provider_default BOOLEAN NOT NULL DEFAULT false, -- Default model for this provider
  is_active BOOLEAN NOT NULL DEFAULT true, -- Available for use
  is_visible BOOLEAN NOT NULL DEFAULT true, -- Show in UI dropdown

  -- Model capabilities (for filtering/display)
  max_tokens INTEGER DEFAULT 4096,
  supports_streaming BOOLEAN DEFAULT true,
  supports_vision BOOLEAN DEFAULT false,
  supports_tools BOOLEAN DEFAULT false,

  -- Ordering
  display_order INTEGER DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID
);

-- Create indexes
CREATE INDEX idx_ai_models_provider ON ai_models(provider);
CREATE INDEX idx_ai_models_active ON ai_models(is_active);
CREATE INDEX idx_ai_models_visible ON ai_models(is_visible);
CREATE INDEX idx_ai_models_default ON ai_models(is_provider_default);
CREATE INDEX idx_ai_models_display_order ON ai_models(display_order);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_models_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_models_updated_at
  BEFORE UPDATE ON ai_models
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_models_updated_at();

-- Insert initial AI model data
INSERT INTO ai_models (model_id, name, provider, api_model, icon, description, credits_per_use, service_key, is_provider_default, is_active, is_visible, max_tokens, supports_streaming, supports_vision, supports_tools, display_order) VALUES

-- Anthropic (Claude) Models
('claude-haiku', 'Claude Haiku', 'anthropic', 'claude-3-5-haiku-20241022', '⚡', 'Fast & affordable', 2.0000, 'ai_chat_claude_haiku', true, true, true, 4096, true, true, true, 10),
('claude-sonnet', 'Claude Sonnet', 'anthropic', 'claude-3-5-sonnet-20241022', '🎯', 'Balanced performance', 8.0000, 'ai_chat_claude_sonnet', false, true, true, 8192, true, true, true, 11),
('claude-opus', 'Claude Opus', 'anthropic', 'claude-3-opus-20240229', '👑', 'Most capable', 25.0000, 'ai_chat_claude_opus', false, true, true, 4096, true, true, true, 12),

-- OpenAI Models
('gpt-4o-mini', 'GPT-4o Mini', 'openai', 'gpt-4o-mini', '🚀', 'Fast & efficient', 3.0000, 'ai_chat_gpt4o_mini', true, true, true, 16384, true, true, true, 20),
('gpt-4o', 'GPT-4o', 'openai', 'gpt-4o', '🧠', 'Latest flagship', 15.0000, 'ai_chat_gpt4o', false, true, true, 16384, true, true, true, 21),

-- Google Gemini Models
('gemini-flash', 'Gemini Flash', 'gemini', 'gemini-1.5-flash', '💨', 'Ultra fast', 1.5000, 'ai_chat_gemini_flash', true, true, true, 8192, true, true, true, 30),
('gemini-pro', 'Gemini Pro', 'gemini', 'gemini-1.5-pro', '💎', 'Advanced reasoning', 10.0000, 'ai_chat_gemini_pro', false, true, true, 8192, true, true, true, 31),

-- Groq Models (ultra-fast inference)
('groq-llama', 'Groq Llama', 'groq', 'llama-3.1-70b-versatile', '🦙', 'Lightning fast', 1.0000, 'ai_chat_groq_llama', true, true, true, 8192, true, false, true, 40),
('groq-mixtral', 'Groq Mixtral', 'groq', 'mixtral-8x7b-32768', '🌀', 'Fast MoE model', 0.5000, 'ai_chat_groq_mixtral', false, true, true, 32768, true, false, true, 41);

-- Add comments
COMMENT ON TABLE ai_models IS 'Master table for AI model configurations';
COMMENT ON COLUMN ai_models.model_id IS 'Unique identifier used in code (e.g., claude-sonnet)';
COMMENT ON COLUMN ai_models.api_model IS 'Actual model ID sent to provider API';
COMMENT ON COLUMN ai_models.is_provider_default IS 'Default model shown for this provider in dropdown';
COMMENT ON COLUMN ai_models.is_active IS 'Whether model is available for use';
COMMENT ON COLUMN ai_models.is_visible IS 'Whether model appears in UI selection';
COMMENT ON COLUMN ai_models.service_key IS 'Foreign key reference to service_credit_costs table';
