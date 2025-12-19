-- Migration: Add cookie consent banner UI translations
-- Description: Adds translation keys for hardcoded texts in CookieConsentBanner.jsx
-- Languages: English (en) and Dutch (nl)
-- Date: 2025-11-12
-- Note: Most cookie consent texts are already translated via cookieSettings.translations
--       This migration covers the remaining hardcoded UI elements

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

  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'cookie_consent.title.preferences', 'en', 'Cookie Preferences', 'cookie_consent', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'cookie_consent.title.manage_preferences', 'en', 'Manage Cookie Preferences', 'cookie_consent', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'common.required', 'en', 'Required', 'common', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'common.back', 'en', 'Back', 'common', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- ============================================
  -- DUTCH TRANSLATIONS (nl)
  -- ============================================

  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'cookie_consent.title.preferences', 'nl', 'Cookie Voorkeuren', 'cookie_consent', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'cookie_consent.title.manage_preferences', 'nl', 'Cookie Voorkeuren Beheren', 'cookie_consent', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'common.required', 'nl', 'Verplicht', 'common', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'common.back', 'nl', 'Terug', 'common', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  RAISE NOTICE 'Cookie consent banner UI translations added successfully for store: % (EN + NL)', default_store_id;
END $$;
