-- Add is_system boolean column to cron_jobs table
-- System jobs cannot be edited/deleted by users, only viewed

-- Add the column
ALTER TABLE cron_jobs
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false NOT NULL;

-- Add comment
COMMENT ON COLUMN cron_jobs.is_system IS 'System jobs cannot be edited/deleted by users';

-- Mark existing system jobs as is_system = true
UPDATE cron_jobs
SET is_system = true
WHERE tags LIKE '%system%'
   OR name LIKE '%System%'
   OR name LIKE '%Daily Credit%'
   OR name LIKE '%Cleanup%'
   OR name LIKE '%Backup%'
   OR name LIKE '%Finalize%';

-- Verify the changes
SELECT
  id,
  name,
  job_type,
  is_active,
  is_system,
  tags
FROM cron_jobs
ORDER BY is_system DESC, name;

-- Expected:
-- System jobs (is_system = true) will be shown first
-- User-created jobs (is_system = false) will be shown below
