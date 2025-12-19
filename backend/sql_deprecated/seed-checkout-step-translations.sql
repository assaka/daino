-- Seed checkout step translations
-- This migration adds default English translations for checkout step names

-- Insert 2-step checkout translations
INSERT INTO translations (id, key, language_code, value, category, type, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'checkout.step_2step_1', 'en', 'Information', 'checkout', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'checkout.step_2step_2', 'en', 'Payment', 'checkout', 'system', NOW(), NOW())
ON CONFLICT (key, language_code) DO NOTHING;

-- Insert 3-step checkout translations
INSERT INTO translations (id, key, language_code, value, category, type, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'checkout.step_3step_1', 'en', 'Information', 'checkout', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'checkout.step_3step_2', 'en', 'Shipping', 'checkout', 'system', NOW(), NOW()),
  (gen_random_uuid(), 'checkout.step_3step_3', 'en', 'Payment', 'checkout', 'system', NOW(), NOW())
ON CONFLICT (key, language_code) DO NOTHING;
