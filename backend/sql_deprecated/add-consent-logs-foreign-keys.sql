-- Migration: Add foreign key constraints to consent_logs table
-- Description: Adds foreign key constraints for store_id and user_id relationships
--              This allows PostgREST to discover the relationships and enable joins

-- Add foreign key constraint for store_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'consent_logs_store_id_fkey'
    ) THEN
        ALTER TABLE consent_logs
        ADD CONSTRAINT consent_logs_store_id_fkey
        FOREIGN KEY (store_id) REFERENCES stores(id) ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint for user_id (optional, can be NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'consent_logs_user_id_fkey'
    ) THEN
        ALTER TABLE consent_logs
        ADD CONSTRAINT consent_logs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- Refresh PostgREST schema cache to pick up the new foreign key relationships
NOTIFY pgrst, 'reload schema';
