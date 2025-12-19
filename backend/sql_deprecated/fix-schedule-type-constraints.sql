-- Migration to remove old check constraints that conflict with the new enums

-- Drop the old check constraints that are now redundant with the ENUMs
ALTER TABLE akeneo_schedules DROP CONSTRAINT IF EXISTS akeneo_schedules_import_type_check;
ALTER TABLE akeneo_schedules DROP CONSTRAINT IF EXISTS akeneo_schedules_schedule_type_check;
ALTER TABLE akeneo_schedules DROP CONSTRAINT IF EXISTS akeneo_schedules_status_check;