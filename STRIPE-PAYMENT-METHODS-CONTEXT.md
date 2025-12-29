# Stripe Payment Methods Integration Context

## Summary
Implemented automatic syncing of Stripe payment methods with validation against the Stripe dashboard settings.

## What Was Done

### 1. Stripe Enabled Methods Check
- Added `GET /api/payments/stripe-enabled-methods` endpoint to check which payment methods are actually enabled in the connected Stripe account
- Uses `stripe.paymentMethodConfigurations.list()` API with connected account context
- Only checks `display_preference.preference === 'on'` (not `available` field, which just means it CAN be enabled)

### 2. Sync Functionality Updates
- Updated `insertAllStripePaymentMethods()` to:
  - Check enabled status before inserting new methods
  - **Deactivate existing methods** that are no longer enabled in Stripe dashboard
  - **Re-activate existing methods** that are now enabled in Stripe dashboard
  - Returns `inserted`, `deactivated`, and `reactivated` counts

### 3. Admin UI Updates (`src/pages/admin/PaymentMethods.jsx`)
- Added `stripeEnabledMethods` state to track enabled status from Stripe
- Fetches enabled methods when Stripe is connected (on page load)
- Shows red "Not Enabled in Stripe" badge with tooltip for methods not enabled
- **Prevents activating** methods not enabled in Stripe (shows error message)
- Sync button now shows deactivation feedback

### 4. Checkout Cache Fix (`src/hooks/usePageBootstrap.js`)
- Reduced checkout bootstrap cache from 5 minutes to **30 seconds**
- Set `refetchOnMount: true` so checkout always gets fresh data
- This ensures disabled payment methods don't appear in checkout

## Key Files Modified

| File | Changes |
|------|---------|
| `backend/src/routes/payments.js` | Added `getEnabledStripePaymentMethods()`, updated sync to deactivate methods, added `/stripe-enabled-methods` endpoint |
| `src/pages/admin/PaymentMethods.jsx` | Added enabled status check, badge display, activation prevention |
| `src/hooks/usePageBootstrap.js` | Reduced checkout cache time, added refetchOnMount |
| `src/utils/countryUtils.js` | Country-to-currency mapping utilities |

## How It Works

### Flow for Checking Enabled Methods:
1. User visits Payment Methods admin page
2. If Stripe is connected, `loadStripeEnabledMethods()` is called
3. API checks `stripe.paymentMethodConfigurations.list()` with connected account
4. Returns map of `{ code: enabled }` for each payment method
5. UI shows "Not Enabled in Stripe" badge for methods with `enabled: false`

### Flow for Sync:
1. User clicks Sync button
2. Backend fetches enabled methods from Stripe
3. **Deactivates** existing Stripe methods not enabled in dashboard
4. **Re-activates** existing Stripe methods now enabled in dashboard
5. **Inserts** new methods that are enabled and applicable to store countries
6. Returns counts of inserted, deactivated, and reactivated methods

### Flow for Checkout:
1. Checkout page fetches bootstrap data (30s cache, refetches on mount)
2. Bootstrap query filters for `is_active: true` only
3. Deactivated payment methods don't appear in checkout

## Configuration

### STRIPE_PAYMENT_METHODS array (payments.js)
```javascript
const STRIPE_PAYMENT_METHODS = [
  { code: 'stripe_card', stripeType: 'card', countries: null, currencies: null },
  { code: 'stripe_ideal', stripeType: 'ideal', countries: ['NL'], currencies: ['EUR'] },
  { code: 'stripe_bancontact', stripeType: 'bancontact', countries: ['BE'], currencies: ['EUR'] },
  // ... more methods
];
```

### Stripe API Check
```javascript
// Only checks display_preference, not available field
if (pmConfig?.display_preference?.preference === 'on') {
  enabledTypes.add(pmType);
}
```

## Testing Steps

1. **Enable/disable a payment method in Stripe Dashboard**
   - Go to dashboard.stripe.com → Settings → Payment methods
   - Enable or disable a method (e.g., iDEAL)

2. **Sync in Admin**
   - Go to Payment Methods admin page
   - Click the Sync button (refresh icon)
   - Should see message about deactivated methods

3. **Check Checkout**
   - Hard refresh checkout page (Ctrl+Shift+R)
   - Disabled methods should not appear

## Known Behaviors

- Card is always enabled (default)
- Apple Pay and Google Pay depend on card being enabled
- For Standard OAuth accounts, we check `paymentMethodConfigurations` API
- Methods are filtered by:
  1. Store's allowed countries
  2. Enabled in Stripe dashboard
  3. Billing country at checkout
  4. Currency support

## Important Notes

- **Store Allowed Countries**: Payment methods like iDEAL (NL), Bancontact (BE), Przelewy24 (PL) require the respective country to be in the store's "Allowed Countries for Shipping/Billing" settings
- **Billing Country at Checkout**: These methods only show when the customer selects the matching billing country
- **Sync Updates Settings**: Sync also updates `supported_countries` and `supported_currencies` for existing methods

## Related Commits

- "Check Stripe dashboard status before allowing payment method activation"
- "Deactivate Stripe payment methods not enabled in dashboard on sync"
- "Reduce checkout bootstrap cache time to 30 seconds"
- "Re-activate Stripe payment methods when enabled in dashboard"
- "Update existing payment method settings during sync"
- "Remove debug logging from payment methods sync and checkout"
