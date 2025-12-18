# Plugin Hooks & Events Tutorial

## 🎯 What You'll Learn

This tutorial teaches you how to create **interactive plugins** using hooks and events. We'll build a real example: an **empty cart coupon modal** that auto-applies when users add items.

**What you'll build:**
- Modal that appears when cart is empty
- Shows a real coupon code (HAMID - 20% off)
- "Apply & Shop" button that auto-applies the coupon
- 100% database-driven - no code deployment needed!

---

## 📚 Events vs Hooks - What's the Difference?

### **Events** = Notifications (One-Way)
Think of events like a **loudspeaker announcement**. You broadcast that something happened, and anyone listening can react.

```javascript
// Someone announces: "Cart was viewed!"
eventSystem.emit('cart.viewed', { items: [], total: 0 });

// Your plugin listens and reacts
eventSystem.on('cart.viewed', (data) => {
  console.log('I heard the cart was viewed!', data);
  trackAnalytics(data);
});
```

**Use events when:** You want to notify or track that something happened.

### **Hooks** = Filters/Modifiers (Two-Way)
Think of hooks like a **checkpoint** where you can change or validate something before it continues.

```javascript
// Code asks: "Should I use $ or modify it?"
const symbol = hookSystem.apply('cart.getCurrencySymbol', '$', { store });

// Your plugin modifies the value
hookSystem.register('cart.getCurrencySymbol', (symbol, context) => {
  if (context.store.country === 'EU') return '€';
  return symbol;  // Return modified or original value
});
```

**Use hooks when:** You want to customize, filter, or validate data.

---

## 🛠️ Building the Empty Cart Coupon Feature

### Part 1: The Hook (Shows Modal When Cart is Empty)

**Hook Name:** `cart.processLoadedItems`

**Purpose:** Check if cart is empty and show a coupon modal.

**Step 1: Create the Hook in Database**

```javascript
// Run this script: backend/create-empty-cart-hook.js
const hookCode = `function(items, context) {
  // Check if cart is empty
  if (items.length === 0) {
    const modalShown = sessionStorage.getItem('emptyCartCouponShown');

    if (!modalShown) {
      sessionStorage.setItem('emptyCartCouponShown', 'true');

      // Create modal backdrop
      const backdrop = document.createElement('div');
      backdrop.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 999999; display: flex; align-items: center; justify-content: center;';

      // Create modal
      const modal = document.createElement('div');
      modal.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px; border-radius: 20px; max-width: 500px; text-align: center; color: white;';

      modal.innerHTML = \`
        <div style="font-size: 60px; margin-bottom: 20px;">🎁</div>
        <h2 style="font-size: 32px; margin-bottom: 16px; font-weight: 700;">Your Cart is Empty!</h2>
        <p style="font-size: 18px; margin-bottom: 30px;">We have a special gift for you.</p>
        <div id="couponCode" style="background: white; color: #667eea; padding: 20px 30px; border-radius: 10px; font-size: 28px; font-weight: bold; cursor: pointer;">HAMID</div>
        <p style="font-size: 16px; margin: 30px 0;">Get <strong>20% OFF</strong>!<br/>Click to copy.</p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="applyShopBtn" style="background: #10b981; color: white; border: none; padding: 14px 40px; border-radius: 10px; font-size: 18px; font-weight: 600; cursor: pointer;">Apply & Shop</button>
          <button id="shopNowBtn" style="background: white; color: #667eea; border: none; padding: 14px 40px; border-radius: 10px; font-size: 18px; font-weight: 600; cursor: pointer;">Just Shop</button>
          <button id="closeBtn" style="background: transparent; border: 2px solid white; color: white; padding: 14px 40px; border-radius: 10px; font-size: 18px; font-weight: 600; cursor: pointer;">Close</button>
        </div>
      \`;

      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      // Event handlers
      setTimeout(() => {
        // Copy coupon
        document.getElementById('couponCode').onclick = () => {
          navigator.clipboard.writeText('HAMID');
        };

        // Apply & Shop - stores coupon for auto-apply
        document.getElementById('applyShopBtn').onclick = () => {
          sessionStorage.setItem('pendingCoupon', 'HAMID');
          sessionStorage.setItem('autoApplyCoupon', 'true');
          document.getElementById('coupon-modal-backdrop').remove();
          window.location.href = '/products';
        };

        // Just Shop
        document.getElementById('shopNowBtn').onclick = () => {
          backdrop.remove();
          window.location.href = '/products';
        };

        // Close
        document.getElementById('closeBtn').onclick = () => {
          backdrop.remove();
        };

        backdrop.onclick = (e) => {
          if (e.target === backdrop) backdrop.remove();
        };
      }, 100);
    }
  }

  // Always return items (required for hooks)
  return items;
}`;

// Insert into database
await sequelize.query(\`
  INSERT INTO plugin_hooks (plugin_id, hook_name, handler_function, priority, is_enabled)
  VALUES ($1, 'cart.processLoadedItems', $2, 10, true)
\`, {
  bind: [YOUR_PLUGIN_ID, hookCode]
});
```

**Key Points:**
- ✅ Hook receives `(items, context)` as parameters
- ✅ Must **return** items (hooks are filters)
- ✅ Checks `items.length === 0` to detect empty cart
- ✅ Only shows once per session (sessionStorage flag)

### Part 2: The Event (Auto-Applies Coupon)

**Event Name:** `cart.viewed`

**Purpose:** When cart loads with items, check if there's a pending coupon and auto-apply it.

**Step 2: Create the Event Listener**

```javascript
// Event listener code
export default function onCartNavigated(data) {
  const shouldAutoApply = sessionStorage.getItem('autoApplyCoupon');
  const pendingCoupon = sessionStorage.getItem('pendingCoupon');

  if (shouldAutoApply === 'true' && pendingCoupon) {
    // Clear flags
    sessionStorage.removeItem('autoApplyCoupon');
    sessionStorage.removeItem('pendingCoupon');

    // Wait for cart UI to load
    setTimeout(() => {
      // Find coupon input
      const couponInput = document.querySelector('input[name="couponCode"]');

      if (couponInput) {
        // Fill input
        couponInput.value = pendingCoupon;

        // Trigger React events
        couponInput.dispatchEvent(new Event('input', { bubbles: true }));
        couponInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Click apply button
        setTimeout(() => {
          const applyBtn = couponInput.closest('div')?.querySelector('button');
          if (applyBtn) applyBtn.click();
        }, 300);
      }
    }, 2000);
  }
}

// Insert into database
await sequelize.query(\`
  INSERT INTO plugin_events (plugin_id, event_name, file_name, listener_function, priority)
  VALUES ($1, 'cart.viewed', 'auto-apply-coupon.js', $2, 5)
\`, {
  bind: [YOUR_PLUGIN_ID, eventCode]
});
```

**Key Points:**
- ✅ Events receive `(data)` as parameter
- ✅ Don't need to return anything
- ✅ Can read/write sessionStorage
- ✅ Can manipulate DOM

---

## 🔑 Available Hooks in Cart

| Hook Name | When It Fires | Parameters | Use Case |
|-----------|--------------|------------|----------|
| `cart.beforeLoadItems` | Before loading cart | `(shouldLoad, context)` | Block cart loading |
| `cart.processLoadedItems` | After items load | `(items, context)` | Modify items, show modals |
| `cart.validateQuantity` | Before updating quantity | `(quantity, context)` | Limit max quantity |
| `cart.beforeUpdateQuantity` | Before quantity update | `(shouldUpdate, context)` | Prevent updates |
| `cart.beforeRemoveItem` | Before removing item | `(shouldRemove, context)` | Confirm removal |
| `cart.beforeCheckout` | Before checkout | `(checkoutData, context)` | Add custom fields |
| `cart.getCurrencySymbol` | When displaying prices | `(symbol, context)` | Change currency |
| `cart.getCheckoutUrl` | When getting checkout URL | `(url, context)` | Custom checkout |

## 🎯 Available Events in Cart

| Event Name | When It Fires | Data Provided |
|-----------|--------------|---------------|
| `cart.viewed` | When cart page loads | `{ items, subtotal, total, store, ... }` |
| `cart.loadingStarted` | Before fetching cart | `{ store, settings, sessionId }` |
| `cart.itemAdded` | After item added | `{ item, product, quantity }` |
| `cart.itemRemoved` | After item removed | `{ item, product }` |
| `cart.quantityChanged` | After quantity updated | `{ item, oldQty, newQty }` |

---

## 💡 Step-by-Step: Create Your First Hook

### Example: Add Bulk Discount for 3+ Items

**1. Go to Admin → Plugins → Your Plugin → New File**

**2. Select "Hook (.js)"**

**3. Choose Hook:** `cart.processLoadedItems`

**4. Write Your Code:**

```javascript
function(items, context) {
  // Check if 3 or more items
  if (items.length >= 3) {
    // Apply 10% discount to each item
    return items.map(item => ({
      ...item,
      price: item.price * 0.9,
      bulkDiscountApplied: true
    }));
  }

  // No discount - return items unchanged
  return items;
}
```

**5. Save** - Hook is live immediately!

**6. Test** - Add 3+ items to cart and see prices reduced by 10%

---

## 🎨 Step-by-Step: Create Your First Event

### Example: Track Cart Abandonment

**1. Go to Admin → Plugins → Your Plugin → New File**

**2. Select "Event Listener (.js)"**

**3. Choose Event:** `cart.viewed`

**4. Write Your Code:**

```javascript
export default function onCartViewed(data) {
  const { items, total, store } = data;

  // Only track if cart has items
  if (items.length > 0) {
    // Send to your analytics
    fetch('/api/analytics/cart-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemCount: items.length,
        cartTotal: total,
        storeId: store.id,
        timestamp: new Date().toISOString()
      })
    });
  }
}
```

**5. Save** - Event is live immediately!

**6. Test** - Visit cart and check your analytics

---

## 🔍 Debugging Tips

### Check if Hook is Registered

```javascript
// In browser console
fetch('/api/plugins/active')
  .then(r => r.json())
  .then(d => {
    const plugin = d.plugins.find(p => p.id === 'YOUR_PLUGIN_ID');
    console.log('Hooks:', plugin.hooks);
    console.log('Events:', plugin.events);
  });
```

### Add Debug Logging

```javascript
function(items, context) {
  console.log('🐛 Hook fired!', items.length);

  // Your code here

  console.log('🐛 Hook complete');
  return items;
}
```

### Common Issues

**Hook not firing?**
- Check if early return skips the hook call
- Add logging before `hookSystem.apply()`
- Verify hook is registered: See "✅ Registered hook" in console

**Event not firing?**
- Check if event is emitted: `eventSystem.emit('event.name')`
- Look for syntax errors in event code
- Verify event is registered: See "✅ Registered event" in console

---

## 📦 Complete Example: Empty Cart Coupon with Auto-Apply

### Files Needed

**1. Hook:** `hooks/cart_processLoadedItems.js`
- Shows modal when cart is empty
- Three buttons: Apply & Shop, Just Shop, Close
- Stores coupon in sessionStorage

**2. Event:** `events/auto-apply-coupon.js`
- Listens to `cart.viewed`
- Checks for pending coupon
- Auto-fills and applies it

**3. Database Coupon:** Create HAMID coupon (20% off)

### Installation Steps

**Step 1: Create Your Plugin**
1. Admin → Plugins → Create Plugin
2. Name: "My Cart Alert"
3. Category: "utility"
4. Save

**Step 2: Add the Hook**
1. Edit your plugin in AI Studio
2. New File → Hook (.js)
3. Hook name: `cart.processLoadedItems`
4. Paste the hook code from Part 1 above
5. Save

**Step 3: Add the Event**
1. New File → Event Listener (.js)
2. Event: `cart.viewed`
3. Filename: `auto-apply-coupon.js`
4. Paste the event code from Part 2 above
5. Save

**Step 4: Create the Coupon**
1. Admin → Coupons → New Coupon
2. Code: `HAMID`
3. Discount: `20%` (percentage)
4. Active: ✅
5. Save

### Testing

**Test Flow:**
1. Empty your cart
2. Visit `/cart`
3. Clear session: `sessionStorage.clear()` in console
4. Refresh → Modal appears
5. Click **"Apply & Shop"** (green button)
6. Add a product to cart
7. Go to cart → HAMID coupon auto-applies!

**Debug in Console:**
```javascript
// Check if coupon is pending
sessionStorage.getItem('pendingCoupon');  // Should be 'HAMID'
sessionStorage.getItem('autoApplyCoupon'); // Should be 'true'
```

---

## 🎓 Advanced: Understanding the Flow

```
USER ACTION              SYSTEM RESPONSE              DATABASE
─────────────────────────────────────────────────────────────
Visit empty cart    →    Hook fires                  plugin_hooks
                         (cart.processLoadedItems)    └→ Shows modal
                              ↓
Click "Apply & Shop" →   sessionStorage.setItem      (Frontend only)
                         pendingCoupon = 'HAMID'
                              ↓
Redirect to /products →  window.location.href        (Frontend only)
                              ↓
Add product         →    User adds item              cart_items
                              ↓
Return to /cart     →    Event fires                 plugin_events
                         (cart.viewed listener)       └→ Checks sessionStorage
                              ↓
Auto-apply          →    Fill input + click          (Frontend)
                              ↓
Validate coupon     →    Fetch coupon data           coupons
                         Check rules                  └→ HAMID (20% off)
                              ↓
Apply discount      →    Update cart totals          (Frontend state)
```

**100% Database-Driven:**
- ✅ Hook code → `plugin_hooks` table
- ✅ Event code → `plugin_events` table
- ✅ Coupon → `coupons` table
- ✅ Editable in AI Studio CodeEditor
- ✅ No deployment needed for changes!

---

## 🚀 Next Steps

### Easy Modifications

**Change the coupon code:**
1. Edit hook in AI Studio
2. Find: `'HAMID'`
3. Replace with: `'SAVE25'` (or any code)
4. Save → Live immediately!

**Change the discount:**
1. Admin → Coupons
2. Find HAMID coupon
3. Change discount_value to `25`
4. Save

**Add expiry date:**
1. Admin → Coupons → Edit HAMID
2. Set end_date
3. Save

### More Examples

**Show different message for VIP users:**
```javascript
function(items, context) {
  if (items.length === 0) {
    const isVIP = context.user?.role === 'vip';
    const message = isVIP ? 'VIP Exclusive: 30% OFF!' : 'Special: 20% OFF!';
    const code = isVIP ? 'VIP30' : 'HAMID';

    // Show modal with dynamic message and code
  }
  return items;
}
```

**Track when users see the modal:**
```javascript
// Add to your hook
fetch('/api/plugins/YOUR_ID/track-modal-view', {
  method: 'POST',
  body: JSON.stringify({ sessionId: context.sessionId })
});
```

---

## 📖 Reference

### Hook Signature
```javascript
function hookName(value, context) {
  // value = the value being filtered
  // context = additional data (store, settings, user, etc.)

  // Modify value
  const modified = doSomething(value);

  // MUST return value (modified or original)
  return modified;
}
```

### Event Signature
```javascript
export default function eventName(data) {
  // data = event-specific data
  // No return value needed

  // Do something with the data
  console.log('Event fired:', data);
}
```

### Storage Options

| Storage | Scope | Use Case |
|---------|-------|----------|
| `sessionStorage` | Current tab session | One-time flags, pending actions |
| `localStorage` | Persistent across sessions | User preferences, saved data |
| Database | Persistent + shared | Multi-device, analytics, history |

---

## ✅ Checklist

- [ ] Understand difference between hooks and events
- [ ] Know when to use hooks vs events
- [ ] Can create a hook in AI Studio
- [ ] Can create an event listener in AI Studio
- [ ] Understand hook must return value
- [ ] Know how to debug with console.log
- [ ] Can use sessionStorage for temporary data
- [ ] Built the empty cart coupon feature!

---

## 🆘 Troubleshooting

**Modal appears but button doesn't work?**
- Check browser console for errors
- Verify button IDs match: `applyShopBtn`, `shopNowBtn`, `closeBtn`
- Check if event handlers are attached (setTimeout)

**Auto-apply doesn't work?**
- Check sessionStorage has `pendingCoupon` and `autoApplyCoupon`
- Look for `🎫 [Auto-Apply]` logs in console
- Verify coupon input selector matches your cart UI
- Increase setTimeout delay if cart loads slowly

**Hook not firing?**
- Check early returns in Cart.jsx
- Verify hook is called for empty carts
- Look for "✅ Registered hook" in console
- Check for JavaScript errors blocking execution

---

## 🎉 You Did It!

You've learned how to create interactive, database-driven plugins with hooks and events. This knowledge applies to any feature:

- Cart modifications
- Checkout customizations
- Product page enhancements
- Analytics tracking
- And much more!

Happy coding! 🚀
