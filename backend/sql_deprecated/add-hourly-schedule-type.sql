-- Migration to create ENUMs and update akeneo_schedules table structure

-- Create ENUMs for akeneo_schedules if they don't exist
DO $$ BEGIN
    CREATE TYPE enum_akeneo_schedules_import_type AS ENUM ('attributes', 'families', 'categories', 'products', 'all');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_akeneo_schedules_schedule_type AS ENUM ('once', 'hourly', 'daily', 'weekly', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE enum_akeneo_schedules_status AS ENUM ('scheduled', 'running', 'completed', 'failed', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Remove defaults before changing types
ALTER TABLE akeneo_schedules 
    ALTER COLUMN import_type DROP DEFAULT,
    ALTER COLUMN schedule_type DROP DEFAULT,
    ALTER COLUMN status DROP DEFAULT;

-- Update columns to use ENUMs
ALTER TABLE akeneo_schedules 
    ALTER COLUMN import_type TYPE enum_akeneo_schedules_import_type USING import_type::enum_akeneo_schedules_import_type,
    ALTER COLUMN schedule_type TYPE enum_akeneo_schedules_schedule_type USING schedule_type::enum_akeneo_schedules_schedule_type,
    ALTER COLUMN status TYPE enum_akeneo_schedules_status USING status::enum_akeneo_schedules_status;

-- Re-add defaults
ALTER TABLE akeneo_schedules 
    ALTER COLUMN schedule_type SET DEFAULT 'once',
    ALTER COLUMN status SET DEFAULT 'scheduled';

-- Update the comment on schedule_time column to include hourly format
COMMENT ON COLUMN akeneo_schedules.schedule_time IS 'Format: ":MM" for hourly, "HH:MM" for daily, "MON-09:00" for weekly, "1-09:00" for monthly';