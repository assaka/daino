-- Migration: Add Cookie Preferences and Checkout Login translations
-- Description: Adds translation keys for Cookie Preferences, Manage Cookie Preferences, and Already have an account checkout message
-- Languages: English (en) and Dutch (nl)
-- Date: 2025-11-12

-- Ensure we have a default store_id
DO $$
DECLARE
  default_store_id uuid;
BEGIN
  SELECT id INTO default_store_id FROM stores LIMIT 1;

  IF default_store_id IS NULL THEN
    RAISE EXCEPTION 'No store found. Please create a store first.';
  END IF;

  -- ============================================
  -- ENGLISH TRANSLATIONS (en)
  -- ============================================

  -- Cookie Preferences Translations (EN)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'cookie.preferences', 'en', 'Cookie Preferences', 'cookie', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'cookie.manage_preferences', 'en', 'Manage Cookie Preferences', 'cookie', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Checkout Login Message (EN)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'checkout.login_prompt', 'en', 'Already have an account? Login for faster checkout', 'checkout', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- ============================================
  -- DUTCH TRANSLATIONS (nl)
  -- ============================================

  -- Cookie Preferences Translations (NL)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'cookie.preferences', 'nl', 'Cookie-voorkeuren', 'cookie', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'cookie.manage_preferences', 'nl', 'Cookie-voorkeuren beheren', 'cookie', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Checkout Login Message (NL)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'checkout.login_prompt', 'nl', 'Heeft u al een account? Log in voor een snellere afrekening', 'checkout', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  RAISE NOTICE 'Cookie and checkout translations added successfully for store: % (EN + NL)', default_store_id;
END $$;
