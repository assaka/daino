-- Migration: Consolidate duplicate value keys
-- Description: Removes duplicate translation keys that have the same value
--              Keeps the most commonly used canonical key
-- Date: 2025-11-12
-- Source: TRANSLATION_AUDIT_REPORT.json

DO $$
BEGIN
  -- Duplicate: "My Account" - Keep account.my_account, delete others
  DELETE FROM translations WHERE key IN ('common.my_account', 'navigation.account');

  -- Duplicate: "Payment" - Keep checkout.payment, delete order.payment
  DELETE FROM translations WHERE key = 'order.payment';

  -- Duplicate: "Shipping" - Keep common.shipping (more general), delete checkout.shipping
  DELETE FROM translations WHERE key = 'checkout.shipping';

  -- Duplicate: "Price" - Keep common.price (more general), delete product.price
  DELETE FROM translations WHERE key = 'product.price';

  -- Duplicate: "SKU" - Keep common.sku (more general), delete product.sku
  DELETE FROM translations WHERE key = 'product.sku';

  RAISE NOTICE '✅ Consolidated duplicate value keys - kept canonical versions';
END $$;
