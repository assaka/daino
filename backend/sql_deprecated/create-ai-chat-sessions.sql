-- AI Chat Sessions for Tenant DB
-- Stores chat history per user for quick access and arrow navigation

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id VARCHAR(255), -- Group related messages
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  intent VARCHAR(50),
  data JSONB DEFAULT '{}', -- Response data (type, entity, etc.)
  credits_used INTEGER DEFAULT 0,
  is_error BOOLEAN DEFAULT false,
  visible BOOLEAN DEFAULT true, -- false when user clears chat
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Add visible column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'ai_chat_sessions' AND column_name = 'visible') THEN
    ALTER TABLE ai_chat_sessions ADD COLUMN visible BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user ON ai_chat_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_session ON ai_chat_sessions(session_id, created_at);

-- Input history table for arrow up/down navigation
CREATE TABLE IF NOT EXISTS ai_input_history (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  input TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_input_history_user ON ai_input_history(user_id, created_at DESC);

-- Limit input history to last 50 per user (cleanup function)
CREATE OR REPLACE FUNCTION cleanup_input_history()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM ai_input_history
  WHERE id IN (
    SELECT id FROM ai_input_history
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_input_history ON ai_input_history;
CREATE TRIGGER trigger_cleanup_input_history
  AFTER INSERT ON ai_input_history
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_input_history();

-- RLS Policies
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_input_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions" ON ai_chat_sessions
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert own chat sessions" ON ai_chat_sessions
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can view own input history" ON ai_input_history
  FOR SELECT USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert own input history" ON ai_input_history
  FOR INSERT WITH CHECK (auth.uid()::uuid = user_id);
