# Empty Cart Hook Issue - Root Cause & Solution

## Problem Statement
Empty cart coupon hook (`cart.processLoadedItems`) was registered successfully but never executed when the cart was empty.

## Root Cause

**Cart.jsx had an early return for empty carts that skipped hook execution:**

```javascript
// OLD CODE (BROKEN)
const cartItems = await cartService.getCart();

if (cartItems.length === 0) {
    setCartItems([]);
    return;  // ← EARLY RETURN - NEVER CALLS HOOK!
}

// This code was NEVER reached for empty carts:
const processedItems = hookSystem.apply('cart.processLoadedItems', cartItems, context);
```

**Result:** The hook was registered but never called for empty carts.

## Solution

**Call the hook BEFORE the early return:**

```javascript
// NEW CODE (FIXED)
const cartItems = await cartService.getCart();

if (cartItems.length === 0) {
    console.log('Cart is empty - calling hook with empty array');

    // ✅ CALL HOOK FIRST with empty array
    const processedEmptyCart = hookSystem.apply('cart.processLoadedItems', [], context);

    setCartItems([]);
    return;
}

// For non-empty carts, continue as before
const processedItems = hookSystem.apply('cart.processLoadedItems', cartItems, context);
```

## Secondary Issues Fixed

### 1. Lack of Error Handling
**Problem:** One broken hook/event would stop ALL subsequent hooks from loading.

**Solution:** Wrapped each hook/event registration in try-catch (App.jsx:97-129)

```javascript
// Before: All hooks fail if one fails
for (const hook of plugin.hooks) {
    const fn = createHandlerFromDatabaseCode(hook.handler_code); // ← If this throws, loop stops
    hookSystem.register(hook.hook_name, fn);
}

// After: Each hook isolated
for (const hook of plugin.hooks) {
    try {
        const fn = createHandlerFromDatabaseCode(hook.handler_code);
        hookSystem.register(hook.hook_name, fn);
        console.log('✅ Registered hook:', hook.hook_name);
    } catch (error) {
        console.error('❌ Failed to register hook:', hook.hook_name, error);
        // Continue with next hook
    }
}
```

### 2. Broken Plugin Data
- **customer-service-chat** had plugin_id as slug instead of UUID → Fixed
- **test event** with empty code `// test` → Deleted
- **analytics-tracker** extension failing with MIME error → Disabled

## Key Takeaways for Future

### ✅ Always call hooks for ALL scenarios
Don't skip hook calls based on conditions. Let the hook decide what to do:

```javascript
// ❌ BAD - Hook never called
if (items.length === 0) return;
hookSystem.apply('processItems', items);

// ✅ GOOD - Hook always called
const processed = hookSystem.apply('processItems', items); // Works for empty AND full
if (processed.length === 0) return;
```

### ✅ Add error handling for plugin loading
One broken plugin shouldn't break the entire system:

```javascript
for (const plugin of plugins) {
    try {
        // Load plugin
    } catch (error) {
        console.error('Plugin failed, continuing...', error);
        // Continue with next plugin
    }
}
```

### ✅ Use comprehensive logging
Debug with step-by-step logs to identify where execution stops:

```javascript
console.log('Step 1: Starting...');
console.log('Step 2: Checking...');
console.log('Step 3: Calling hook...');
```

## Files Changed

1. **src/pages/storefront/Cart.jsx:362-378** - Call hook before early return
2. **src/App.jsx:97-129** - Add try-catch for hook/event registration
3. **src/App.jsx:284-296** - Disable analytics-tracker extension

## Testing

**Plugin ID:** `4eb11832-5429-4146-af06-de86d319a0e5`

**Hook:** `cart.processLoadedItems`

**Expected Behavior:**
1. Visit `/cart` with empty cart
2. Hook fires with empty array: `items.length === 0`
3. Modal appears with SAVE20 coupon
4. Only shows once per session (sessionStorage)

**Debug Logs:**
```
✅ Registered hook: cart.processLoadedItems
🛒 [Cart] Step 5: Checking cart items... 0
🛒 [Cart] Cart is empty - calling hook with empty array
🎁 [Empty Cart Hook] Triggered!
🎁 [Empty Cart Hook] Creating modal...
```

## Final Status
✅ Hook registered successfully
✅ Hook called for empty carts
✅ Modal displays correctly
✅ All errors fixed
✅ Deployed to production
