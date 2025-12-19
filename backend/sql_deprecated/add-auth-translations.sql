-- Migration: Add authentication translations
-- Description: Adds translation keys for all user-facing texts in routes/auth.js
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

  -- Password Validation Error Messages (EN)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.error.password.min_length', 'en', 'Password must be at least {minLength} characters long', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.uppercase', 'en', 'Password must contain at least one uppercase letter', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.lowercase', 'en', 'Password must contain at least one lowercase letter', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.number', 'en', 'Password must contain at least one number', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.special_char', 'en', 'Password must contain at least one special character', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Validation Error Messages (EN)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.error.email.invalid', 'en', 'Please enter a valid email', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.first_name.required', 'en', 'First name is required', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.last_name.required', 'en', 'Last name is required', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.required', 'en', 'Password is required', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.role.invalid', 'en', 'Invalid role', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.store_id.required', 'en', 'Store ID is required', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.verification_code.required', 'en', 'Verification code is required', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Success Messages (EN)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.success.user_created', 'en', 'User created successfully', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.account_upgraded', 'en', 'Account upgraded successfully', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.login', 'en', 'Login successful', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.logout', 'en', 'Logged out successfully', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.registration', 'en', 'Registration successful! Please check your email for a verification code.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.email_verified', 'en', 'Email verified successfully!', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.verification_sent', 'en', 'Verification code sent! Please check your email.', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Error Messages (EN)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.error.server', 'en', 'Server error', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.user_exists', 'en', 'User with this email already exists in the {tableName} table', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.guest_not_found', 'en', 'No guest account found with this email, or account is already registered', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.account_inactive', 'en', 'Account is inactive', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.rate_limit', 'en', 'Too many login attempts. Please try again later.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.invalid_credentials', 'en', 'Invalid credentials', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.invalid_credentials_store', 'en', 'Invalid credentials or you don''t have an account for this store', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.logout_failed', 'en', 'Logout failed', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.customer_exists', 'en', 'Customer with this email already exists', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.customer_exists_alt', 'en', 'A customer with this email already exists', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.registration_failed', 'en', 'Server error during registration. Please try again.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.account_not_activated', 'en', 'This account has not been activated yet. Please create a password first.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.no_store_assigned', 'en', 'Customer account is not assigned to a store. Please contact support.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.customer_not_found', 'en', 'Customer not found', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.email_already_verified', 'en', 'Email is already verified', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.verification_code_invalid', 'en', 'Invalid verification code', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.verification_code_expired', 'en', 'Verification code has expired. Please request a new one.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.verification_failed', 'en', 'Server error during verification', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- ============================================
  -- DUTCH TRANSLATIONS (nl)
  -- ============================================

  -- Password Validation Error Messages (NL)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.error.password.min_length', 'nl', 'Wachtwoord moet minimaal {minLength} tekens lang zijn', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.uppercase', 'nl', 'Wachtwoord moet minimaal één hoofdletter bevatten', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.lowercase', 'nl', 'Wachtwoord moet minimaal één kleine letter bevatten', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.number', 'nl', 'Wachtwoord moet minimaal één cijfer bevatten', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.special_char', 'nl', 'Wachtwoord moet minimaal één speciaal teken bevatten', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Validation Error Messages (NL)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.error.email.invalid', 'nl', 'Voer een geldig e-mailadres in', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.first_name.required', 'nl', 'Voornaam is verplicht', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.last_name.required', 'nl', 'Achternaam is verplicht', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.password.required', 'nl', 'Wachtwoord is verplicht', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.role.invalid', 'nl', 'Ongeldige rol', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.store_id.required', 'nl', 'Winkel-ID is verplicht', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.verification_code.required', 'nl', 'Verificatiecode is verplicht', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Success Messages (NL)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.success.user_created', 'nl', 'Gebruiker succesvol aangemaakt', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.account_upgraded', 'nl', 'Account succesvol geüpgraded', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.login', 'nl', 'Succesvol ingelogd', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.logout', 'nl', 'Succesvol uitgelogd', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.registration', 'nl', 'Registratie succesvol! Controleer uw e-mail voor een verificatiecode.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.email_verified', 'nl', 'E-mail succesvol geverifieerd!', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.success.verification_sent', 'nl', 'Verificatiecode verzonden! Controleer uw e-mail.', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  -- Error Messages (NL)
  INSERT INTO translations (id, store_id, key, language_code, value, category, type, created_at, updated_at)
  VALUES
    (gen_random_uuid(), default_store_id, 'auth.error.server', 'nl', 'Serverfout', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.user_exists', 'nl', 'Gebruiker met dit e-mailadres bestaat al in de {tableName} tabel', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.guest_not_found', 'nl', 'Geen gastaccount gevonden met dit e-mailadres, of account is al geregistreerd', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.account_inactive', 'nl', 'Account is inactief', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.rate_limit', 'nl', 'Te veel inlogpogingen. Probeer het later opnieuw.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.invalid_credentials', 'nl', 'Ongeldige inloggegevens', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.invalid_credentials_store', 'nl', 'Ongeldige inloggegevens of u heeft geen account voor deze winkel', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.logout_failed', 'nl', 'Uitloggen mislukt', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.customer_exists', 'nl', 'Klant met dit e-mailadres bestaat al', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.customer_exists_alt', 'nl', 'Een klant met dit e-mailadres bestaat al', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.registration_failed', 'nl', 'Serverfout tijdens registratie. Probeer het opnieuw.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.account_not_activated', 'nl', 'Dit account is nog niet geactiveerd. Maak eerst een wachtwoord aan.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.no_store_assigned', 'nl', 'Klantaccount is niet toegewezen aan een winkel. Neem contact op met support.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.customer_not_found', 'nl', 'Klant niet gevonden', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.email_already_verified', 'nl', 'E-mail is al geverifieerd', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.verification_code_invalid', 'nl', 'Ongeldige verificatiecode', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.verification_code_expired', 'nl', 'Verificatiecode is verlopen. Vraag een nieuwe aan.', 'auth', 'system', NOW(), NOW()),
    (gen_random_uuid(), default_store_id, 'auth.error.verification_failed', 'nl', 'Serverfout tijdens verificatie', 'auth', 'system', NOW(), NOW())
  ON CONFLICT (store_id, key, language_code) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();

  RAISE NOTICE 'Authentication translations added successfully for store: % (EN + NL)', default_store_id;
END $$;
