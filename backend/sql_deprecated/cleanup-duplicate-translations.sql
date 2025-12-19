-- Migration: Clean up duplicate translations
-- Description: Remove duplicate translation entries keeping only one per (store_id, key, language_code)
-- Date: 2025-11-12

DO $$
BEGIN
  -- Delete duplicates, keeping only the oldest entry (lowest id) for each unique combination
  DELETE FROM translations a
  USING translations b
  WHERE a.id > b.id
    AND a.store_id = b.store_id
    AND a.key = b.key
    AND a.language_code = b.language_code;

  RAISE NOTICE 'Duplicate translations cleaned up successfully';
END $$;
