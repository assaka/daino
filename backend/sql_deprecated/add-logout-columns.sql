-- Add user_agent and action columns to login_attempts table for logout functionality
-- This migration adds support for tracking logout events

-- Add user_agent column to store browser information
ALTER TABLE login_attempts 
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Add action column to differentiate between login and logout events
ALTER TABLE login_attempts 
ADD COLUMN IF NOT EXISTS action VARCHAR(50) DEFAULT 'login';

-- Add comment for documentation
COMMENT ON COLUMN login_attempts.user_agent IS 'Browser user agent string for security tracking';
COMMENT ON COLUMN login_attempts.action IS 'Type of authentication action: login, logout, register, etc.';

-- Optional: Add index for action column if needed for queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_action ON login_attempts(action);

-- Show the updated table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'login_attempts' 
ORDER BY ordinal_position;