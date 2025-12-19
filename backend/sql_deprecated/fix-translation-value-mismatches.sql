-- Migration: Fix translation value mismatches
-- Description: Updates database translation values to match code fallback values
--              This ensures code fallbacks and database values are synchronized
-- Date: 2025-11-12
-- Source: TRANSLATION_AUDIT_REPORT.json

DO $$
BEGIN
  -- Update all value mismatches where database value differs from code fallback
  -- Using code fallback as source of truth for better UX consistency

  -- Fix common category mismatches
  UPDATE translations SET value = 'Store information not available. Please refresh.', updated_at = NOW()
  WHERE key = 'common.store_info_not_available' AND language_code = 'en';

  UPDATE translations SET value = 'Login failed. Please check your credentials.', updated_at = NOW()
  WHERE key = 'common.login_failed' AND language_code = 'en';

  UPDATE translations SET value = 'Create My Account', updated_at = NOW()
  WHERE key = 'common.create_account' AND language_code = 'en';

  UPDATE translations SET value = 'Please enter a coupon code', updated_at = NOW()
  WHERE key = 'common.enter_coupon_code' AND language_code = 'en';

  UPDATE translations SET value = 'This coupon has expired', updated_at = NOW()
  WHERE key = 'common.coupon_expired' AND language_code = 'en';

  UPDATE translations SET value = 'This coupon is not yet active', updated_at = NOW()
  WHERE key = 'common.coupon_not_active' AND language_code = 'en';

  UPDATE translations SET value = 'This coupon has reached its usage limit', updated_at = NOW()
  WHERE key = 'common.coupon_usage_limit' AND language_code = 'en';

  UPDATE translations SET value = 'Minimum order amount of {amount} required', updated_at = NOW()
  WHERE key = 'common.minimum_order_required' AND language_code = 'en';

  UPDATE translations SET value = 'Invalid or expired coupon code', updated_at = NOW()
  WHERE key = 'common.invalid_coupon' AND language_code = 'en';

  UPDATE translations SET value = 'Add products before checkout', updated_at = NOW()
  WHERE key = 'common.add_products_checkout' AND language_code = 'en';

  UPDATE translations SET value = 'Email', updated_at = NOW()
  WHERE key = 'common.email' AND language_code = 'en';

  UPDATE translations SET value = 'Full Name', updated_at = NOW()
  WHERE key = 'common.full_name' AND language_code = 'en';

  UPDATE translations SET value = 'Street Address', updated_at = NOW()
  WHERE key = 'common.street_address' AND language_code = 'en';

  UPDATE translations SET value = 'City', updated_at = NOW()
  WHERE key = 'common.city' AND language_code = 'en';

  UPDATE translations SET value = 'State / Province', updated_at = NOW()
  WHERE key = 'common.state_province' AND language_code = 'en';

  UPDATE translations SET value = 'Postal Code', updated_at = NOW()
  WHERE key = 'common.postal_code' AND language_code = 'en';

  UPDATE translations SET value = 'Select Country', updated_at = NOW()
  WHERE key = 'common.country' AND language_code = 'en';

  -- Fix checkout category mismatches
  UPDATE translations SET value = 'Information', updated_at = NOW()
  WHERE key = 'checkout.step_3step_1' AND language_code = 'en';

  UPDATE translations SET value = 'Guest Checkout', updated_at = NOW()
  WHERE key = 'checkout.guest_checkout' AND language_code = 'en';

  UPDATE translations SET value = 'Add New Shipping Address', updated_at = NOW()
  WHERE key = 'checkout.add_new_shipping_address' AND language_code = 'en';

  UPDATE translations SET value = 'No saved addresses', updated_at = NOW()
  WHERE key = 'checkout.no_saved_addresses' AND language_code = 'en';

  UPDATE translations SET value = 'Enter shipping address', updated_at = NOW()
  WHERE key = 'checkout.enter_shipping_address' AND language_code = 'en';

  UPDATE translations SET value = 'Valid email required', updated_at = NOW()
  WHERE key = 'checkout.valid_email_required' AND language_code = 'en';

  UPDATE translations SET value = 'Save address for future use', updated_at = NOW()
  WHERE key = 'checkout.save_address_future' AND language_code = 'en';

  UPDATE translations SET value = 'Add New Billing Address', updated_at = NOW()
  WHERE key = 'checkout.add_new_billing_address' AND language_code = 'en';

  UPDATE translations SET value = 'Save billing address for future use', updated_at = NOW()
  WHERE key = 'checkout.save_billing_future' AND language_code = 'en';

  UPDATE translations SET value = 'Select delivery date', updated_at = NOW()
  WHERE key = 'checkout.select_delivery_date' AND language_code = 'en';

  UPDATE translations SET value = 'Select time slot', updated_at = NOW()
  WHERE key = 'checkout.select_time_slot' AND language_code = 'en';

  UPDATE translations SET value = 'Special Delivery Instructions', updated_at = NOW()
  WHERE key = 'checkout.special_delivery_instructions' AND language_code = 'en';

  UPDATE translations SET value = 'Enter any special instructions', updated_at = NOW()
  WHERE key = 'checkout.special_instructions_placeholder' AND language_code = 'en';

  UPDATE translations SET value = 'Fee', updated_at = NOW()
  WHERE key = 'checkout.fee' AND language_code = 'en';

  UPDATE translations SET value = 'Qty', updated_at = NOW()
  WHERE key = 'checkout.qty' AND language_code = 'en';

  -- Fix discount category mismatch
  UPDATE translations SET value = 'View eligible products', updated_at = NOW()
  WHERE key = 'discount.view_eligible_products' AND language_code = 'en';

  -- Fix account category mismatch
  UPDATE translations SET value = 'Forgot password?', updated_at = NOW()
  WHERE key = 'account.forgot_password' AND language_code = 'en';

  RAISE NOTICE '✅ Fixed 34 translation value mismatches to match code fallbacks';
END $$;
