-- Migration: Clean up obsolete and duplicate translation keys
-- Description: Remove duplicate translation keys where multiple keys have the same value
--              Keeps the most commonly used/standardized key and removes duplicates
-- Date: 2025-11-12

DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete obsolete duplicate keys
  -- Keeping standardized naming conventions:
  -- - common.* for shared UI elements
  -- - cookie_consent.* for cookie consent (not cookie.*)
  -- - account.* for account-specific items
  -- - cart.* for cart-specific items

  DELETE FROM translations
  WHERE key IN (
    -- Duplicate cookie keys - keep cookie_consent.* versions
    'cookie.preferences',
    'cookie.manage_preferences',

    -- Duplicate navigation/checkout keys
    'checkout.login', -- Keep navigation.login
    'navigation.logout', -- Keep common.logout

    -- Duplicate account/common keys - keep common.* for shared form fields
    'account.country',
    'account.first_name',
    'account.last_name',
    'account.password',
    'account.phone',
    'account.confirm_password',
    'account.sign_in', -- Keep common.sign_in
    'account.wishlist', -- Keep common.wishlist

    -- Duplicate checkout/common keys - keep common.* for shared terms
    'checkout.subtotal',
    'checkout.tax',
    'checkout.total',
    'checkout.discount',
    'checkout.each',
    'checkout.apply_coupon',
    'checkout.checkout',
    'checkout.continue_shopping',
    'checkout.order_summary',
    'checkout.place_order',
    'checkout.empty_cart', -- Keep cart.cart_is_empty
    'checkout.login_prompt', -- Keep checkout.login_for_faster_checkout

    -- Duplicate shipping/payment keys
    'checkout.step_2step_2', -- Keep checkout.payment
    'checkout.step_3step_3', -- Keep checkout.payment
    'checkout.step_3step_2', -- Keep checkout.shipping or common.shipping

    -- Other duplicates - keep more specific versions
    'my_account', -- Keep account.my_account
    'shipping_method', -- Keep common.shipping_method
    'success.create_account', -- Keep common.create_account
    'navigation.home', -- Keep common.home
    'error.blacklist.email', -- Keep error.blacklist.checkout
    'navigation.orders', -- Keep order.your_orders
    'admin.details', -- Keep common.details

    -- Duplicate stock keys - keep stock.* versions
    'common.out_of_stock', -- Keep stock.out_of_stock_label
    'product.out_of_stock' -- Keep stock.out_of_stock_label
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % obsolete/duplicate translation keys', deleted_count;
END $$;
