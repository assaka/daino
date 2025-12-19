-- Migration: Add customer authentication UI translations
-- Description: Adds translation keys for all user-facing texts in CustomerAuth.jsx
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

  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'customer_auth.error.store_not_available', 'en', 'Store information not available. Please refresh the page.', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.error.passwords_no_match', 'en', 'Passwords do not match', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.success.registration', 'en', 'Registration successful! A welcome email has been sent to your email address.', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.error.login_failed', 'en', 'Login failed', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.error.registration_failed', 'en', 'Registration failed', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.title', 'en', 'Customer Authentication', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.error.config_not_available', 'en', 'Authentication configuration not available. Please contact support.', 'customer_auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- ============================================
  -- DUTCH TRANSLATIONS (nl)
  -- ============================================

  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'customer_auth.error.store_not_available', 'nl', 'Winkelinformatie niet beschikbaar. Ververs de pagina.', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.error.passwords_no_match', 'nl', 'Wachtwoorden komen niet overeen', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.success.registration', 'nl', 'Registratie succesvol! Een welkomstmail is verzonden naar uw e-mailadres.', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.error.login_failed', 'nl', 'Inloggen mislukt', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.error.registration_failed', 'nl', 'Registratie mislukt', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.title', 'nl', 'Klant Authenticatie', 'customer_auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'customer_auth.error.config_not_available', 'nl', 'Authenticatieconfiguratie niet beschikbaar. Neem contact op met support.', 'customer_auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  RAISE NOTICE 'Customer authentication UI translations added successfully for store: % (EN + NL)', default_store_id;
END $$;
