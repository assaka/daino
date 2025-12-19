-- Migration: Add OAuth error translations for AuthMiddleware
-- Description: Adds translation keys for OAuth error messages
-- Languages: English (en) and Dutch (nl)
-- Date: 2025-11-12

DO $$
DECLARE
  default_store_id uuid;
BEGIN
  SELECT id INTO default_store_id FROM stores LIMIT 1;

  IF default_store_id IS NULL THEN
    RAISE EXCEPTION 'No store found. Please create a store first.';
  END IF;

  -- English OAuth Error Messages
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.error.oauth_failed', 'en', 'Google authentication failed. Please try again.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.token_generation_failed', 'en', 'Failed to generate authentication token. Please try again.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.database_connection_failed', 'en', 'Database connection issue. Please try again in a few moments.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.general', 'en', 'An error occurred. Please try again.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.google_not_available_customer', 'en', 'Google authentication is not available for customers.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.google_redirect_failed', 'en', 'Google authentication redirect failed. The service may not be configured properly.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.redirect_failed', 'en', 'Failed to redirect to Google authentication.', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Dutch OAuth Error Messages
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.error.oauth_failed', 'nl', 'Google-authenticatie mislukt. Probeer het opnieuw.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.token_generation_failed', 'nl', 'Kan authenticatietoken niet genereren. Probeer het opnieuw.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.database_connection_failed', 'nl', 'Databaseverbindingsprobleem. Probeer het over enkele ogenblikken opnieuw.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.general', 'nl', 'Er is een fout opgetreden. Probeer het opnieuw.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.google_not_available_customer', 'nl', 'Google-authenticatie is niet beschikbaar voor klanten.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.google_redirect_failed', 'nl', 'Google-authenticatie-omleiding mislukt. De service is mogelijk niet correct geconfigureerd.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.redirect_failed', 'nl', 'Kan niet omleiden naar Google-authenticatie.', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  RAISE NOTICE 'OAuth error translations added successfully for store: % (EN + NL)', default_store_id;
END $$;
