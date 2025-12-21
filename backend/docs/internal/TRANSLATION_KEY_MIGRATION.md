# Translation Key Migration Plan

## Keys to Replace in Code

### Files to Update:

#### 1. `src/components/storefront/MiniCart.jsx`
- `t('checkout.total')` → `t('common.total')`
- `t('checkout.checkout')` → `t('common.checkout')`

#### 2. `src/pages/storefront/Checkout.jsx`
- `t('checkout.subtotal')` → `t('common.subtotal')`
- `t('checkout.tax')` → `t('common.tax')`
- `t('checkout.total')` → `t('common.total')`

#### 3. `src/components/editor/slot/configs/account-config.js`
- `'{{t "my_account"}}'` → `'{{t "account.my_account"}}'`

## Key Mapping (Obsolete → Standard)

### Cookie Keys
- `cookie.preferences` → `cookie_consent.title.preferences` ✅ (already updated in code)
- `cookie.manage_preferences` → `cookie_consent.title.manage_preferences` ✅ (already updated in code)

### Checkout/Common Keys
- `checkout.subtotal` → `common.subtotal`
- `checkout.tax` → `common.tax`
- `checkout.total` → `common.total`
- `checkout.discount` → `common.discount`
- `checkout.each` → `common.each`
- `checkout.apply_coupon` → `common.apply_coupon`
- `checkout.checkout` → `common.checkout`
- `checkout.continue_shopping` → `common.continue_shopping`
- `checkout.order_summary` → `common.order_summary`
- `checkout.place_order` → `common.place_order`

### Account/Common Keys (not used in code, safe to delete)
- `account.country` → `common.country`
- `account.first_name` → `common.first_name`
- `account.last_name` → `common.last_name`
- `account.password` → `common.password`
- `account.phone` → `common.phone`
- `account.confirm_password` → `common.confirm_password`
- `account.sign_in` → `common.sign_in`
- `account.wishlist` → `common.wishlist`

### Navigation Keys
- `my_account` → `account.my_account`
- `navigation.home` → `common.home`
- `navigation.logout` → `common.logout`
- `navigation.orders` → `order.your_orders`

### Other Keys
- `checkout.empty_cart` → `cart.cart_is_empty`
- `shipping_method` → `common.shipping_method`
- `success.create_account` → `common.create_account`
- `error.blacklist.email` → `error.blacklist.checkout`
- `admin.details` → `common.details`

### Stock Keys
- `common.out_of_stock` → `stock.out_of_stock_label`
- `product.out_of_stock` → `stock.out_of_stock_label`

### Malformed Checkout Keys (safe to delete)
- `checkout.step_2step_2` → `checkout.payment`
- `checkout.step_3step_3` → `checkout.payment`
- `checkout.step_3step_2` → `checkout.shipping`

## Files That Need Updates
1. ✅ CookieConsentBanner.jsx - Already updated
2. ✅ CustomerAuth.jsx - Already updated
3. ⚠️ MiniCart.jsx - Needs update
4. ⚠️ Checkout.jsx - Needs update
5. ⚠️ account-config.js - Needs update
