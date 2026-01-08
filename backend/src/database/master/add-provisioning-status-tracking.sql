-- Migration: Add provisioning status tracking columns to stores table
-- Run this on existing master databases to add provisioning progress tracking

-- Add provisioning_status column (tracks current step)
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS provisioning_status VARCHAR(50) DEFAULT 'pending'
CHECK (provisioning_status IN (
  'pending',           -- Not started
  'tables_creating',   -- Creating tables
  'tables_completed',  -- Tables done
  'seed_running',      -- Inserting seed data
  'seed_completed',    -- Core seed done
  'demo_running',      -- Inserting demo data (if requested)
  'completed',         -- All done
  'failed'             -- Something failed
));

-- Add provisioning_progress column (detailed progress info as JSONB)
ALTER TABLE stores
ADD COLUMN IF NOT EXISTS provisioning_progress JSONB DEFAULT '{}'::jsonb;

-- Update existing active stores with completed provisioning to have correct status
UPDATE stores
SET provisioning_status = 'completed',
    provisioning_progress = '{"step": "completed", "message": "Migrated from legacy provisioning"}'::jsonb
WHERE status = 'active'
  AND provisioning_completed_at IS NOT NULL
  AND (provisioning_status IS NULL OR provisioning_status = 'pending');

-- Update stores that are active but missing provisioning_completed_at (incomplete)
UPDATE stores
SET provisioning_status = 'failed',
    provisioning_progress = '{"step": "unknown", "message": "Provisioning was interrupted - please retry", "error": "Incomplete provisioning detected during migration"}'::jsonb
WHERE status = 'active'
  AND provisioning_completed_at IS NULL
  AND (provisioning_status IS NULL OR provisioning_status = 'pending');

-- Index for faster status queries
CREATE INDEX IF NOT EXISTS idx_stores_provisioning_status ON stores(provisioning_status);
