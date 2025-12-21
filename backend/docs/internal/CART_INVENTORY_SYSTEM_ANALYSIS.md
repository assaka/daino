# Cart and Inventory System - Complete Analysis

## Overview
This document provides a comprehensive analysis of the cart and inventory management system in the DainoStore e-commerce platform.

## Cart Functionality

### Key Files

#### 1. Frontend Cart Page
**Location**: `src/pages/storefront/Cart.jsx` (1157 lines)

**Main Functions**:
- `loadCartData()` - Loads cart items from backend
- `updateQuantity()` - Updates item quantities
- `removeItem()` - Removes items from cart
- `handleApplyCoupon()` - Applies discount coupons

**Features**:
- Slot-based layout system for customization
- Hook system for extensibility
- Event-based synchronization

#### 2. Mini Cart Component
**Location**: `src/components/storefront/MiniCart.jsx`

**Features**:
- Quick cart preview in header
- Event-based sync with debouncing
- Shows item count and totals
- Real-time updates via `cartUpdated` events

#### 3. Product Item Card
**Location**: `src/components/storefront/ProductItemCard.jsx` (370 lines)

**Key Function**: `handleAddToCart()` (line 168)
- Adds items to cart via cartService
- Shows stock labels
- **CRITICAL ISSUE**: No stock validation - button never disabled for out-of-stock items

#### 4. Cart Service
**Location**: `src/services/cartService.js` (353 lines)

**Methods**:
- `getCart()` - Retrieves current cart
- `addItem(productId, quantity, selectedOptions, selectedAttributes)` - Adds item to cart
- `updateCart(items)` - Updates entire cart
- `clearCart()` - Empties cart

**Features**:
- Generates guest session IDs (pattern: `guest_[random]`)
- Stores cart in localStorage
- Syncs with backend API
- **CRITICAL ISSUE**: No stock validation before API call

#### 5. Cart Routes (Backend)
**Location**: `backend/src/routes/cart.js`

**Endpoints**:
- `GET /api/cart` - Retrieves cart by session_id or user_id
- `POST /api/cart` - Adds/updates items
- **CRITICAL ISSUE**: No stock validation in endpoints

---

## Inventory & Stock Tracking

### Stock Fields in Product Model
**Location**: `backend/src/models/Product.js`

```javascript
{
  stock_quantity: INTEGER,        // Current inventory count (default: 0)
  manage_stock: BOOLEAN,          // Controls if stock is tracked (default: true)
  infinite_stock: BOOLEAN,        // Marks unlimited stock (default: false)
  allow_backorders: BOOLEAN,      // Allows OOS purchases (default: false)
  low_stock_threshold: INTEGER    // Triggers low-stock warning (default: 5)
}
```

### Four Stock States

1. **Infinite Stock**: `infinite_stock = true`
   - Product has unlimited availability
   - No quantity restrictions

2. **Out of Stock**: `stock_quantity <= 0` AND NOT `allow_backorders`
   - Product cannot be purchased
   - **Should disable add to cart button**

3. **Low Stock**: `stock_quantity > 0` AND `stock_quantity <= low_stock_threshold`
   - Product is running low
   - Shows warning label

4. **In Stock**: `stock_quantity > low_stock_threshold`
   - Product is available
   - Normal purchasing

---

## Stock Label/Display System

### Location
`src/utils/stockLabelUtils.js` (510 lines)

### Main Function
`getStockLabel(product, settings, lang, translations)`

**Returns**:
```javascript
{
  text: string,      // Display text (e.g., "5 items left")
  textColor: string, // Text color hex code
  bgColor: string    // Background color hex code
} | null
```

**Features**:
- Template processing with placeholders: `{quantity}`, `{item}`, `{unit}`, `{piece}`
- Returns null if `show_stock_label` disabled
- Supports multiple languages
- Removes quantity blocks when quantity is null
- Handles nested braces in templates

### Helper Function
`processLabel(template, product, lang, translations)`
- Processes label templates with dynamic content
- Replaces placeholders with actual values
- Handles conditional blocks

### Admin Settings
**Location**: `src/pages/admin/StockSettings.jsx`

**Configurable Settings**:
- `show_stock_label` - Enable/disable stock labels
- Label templates for each state
- Colors for: in-stock, low-stock, out-of-stock states
- Text color and background color customization

---

## Critical Finding: Stock Validation is Missing

### What EXISTS ✓
- Stock fields in product model
- Stock display/label system (visual only)
- Stock configuration in admin panel
- Translations for stock labels
- Stock state calculations

### What's MISSING ✗
- **No validation preventing out-of-stock add-to-cart**
- **No backend stock checks before adding items**
- **No frontend button disable for out-of-stock products**
- **No inventory deduction on purchase**
- **No backorder handling**

### Where Validation Should Be Added

#### 1. Frontend - ProductItemCard.jsx
**Location**: `src/components/storefront/ProductItemCard.jsx:168`
**Function**: `handleAddToCart()`

**Implementation**:
```javascript
// Check if product is out of stock
const isOutOfStock = !product.infinite_stock &&
                     product.manage_stock &&
                     product.stock_quantity <= 0 &&
                     !product.allow_backorders;

// Disable button if out of stock
<button disabled={isOutOfStock} onClick={handleAddToCart}>
  {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
</button>
```

#### 2. Frontend - cartService.js
**Location**: `src/services/cartService.js:137`
**Function**: `addItem()`

**Implementation**:
- Validate stock before making API call
- Show error message if out of stock
- Prevent unnecessary server requests

#### 3. Backend - cart.js
**Location**: `backend/src/routes/cart.js:155`
**Endpoint**: `POST /api/cart`

**Implementation**:
- Server-side validation before storing
- Check stock_quantity against requested quantity
- Return 400 error if insufficient stock
- Consider concurrent purchases

#### 4. Frontend - Cart.jsx
**Location**: `src/pages/storefront/Cart.jsx:457`
**Hook**: `cart.validateQuantity`

**Implementation**:
- Default validation for quantity updates
- Check if requested quantity exceeds stock
- Show warning if stock depleted after cart was created

---

## Cart Item Structure

### In Memory (Frontend)
```javascript
{
  id: "item_timestamp_random",  // Unique item ID
  product_id: "uuid",            // Product UUID
  quantity: number,              // Quantity in cart
  price: decimal,                // Unit price
  selected_options: [            // Product options (size, color, etc.)
    { id, name, value, price }
  ],
  selected_attributes: {}        // Custom attributes
}
```

### Database Model
**Location**: `backend/src/models/Cart.js`

```javascript
{
  id: UUID,
  session_id: string,     // Guest session ID
  store_id: UUID,         // Store identifier
  user_id: UUID,          // User ID (null for guests)
  items: JSON,            // Array of cart items
  subtotal: decimal,      // Subtotal amount
  tax: decimal,           // Tax amount
  shipping: decimal,      // Shipping cost
  discount: decimal,      // Discount amount
  total: decimal          // Final total
}
```

---

## Hook System for Extension

### Available Hooks in Cart.jsx

#### `cart.beforeLoadItems`
- Executes before loading cart items
- Can prevent loading by returning false
- Use case: Custom validation, authentication checks

#### `cart.validateQuantity` (Priority for Stock Validation)
- **Perfect place for stock validation**
- Called when updating quantities
- Can modify quantity or show errors
- Default implementation needed

#### `cart.beforeUpdateQuantity`
- Called before quantity updates
- Can prevent update by returning false
- Use case: Business rules, limits

#### `cart.afterUpdateQuantity`
- Called after successful quantity update
- Use case: Analytics, notifications

#### `cart.beforeRemoveItem`
- Called before item removal
- Can prevent removal by returning false
- Use case: Confirmations, restrictions

#### `cart.beforeCheckout`
- Called before proceeding to checkout
- Can prevent checkout by returning false
- Use case: Validation, stock checks, minimum order

---

## Event System

### Custom Events

#### `cartUpdated`
**Dispatched**: When cart changes (add, update, remove)
**Payload**: Updated cart data
**Listeners**: MiniCart component, other cart-related UI

#### `showFlashMessage`
**Dispatched**: For user notifications
**Payload**: `{ message, type }`
**Use case**: Success/error messages

---

## Session Management

### Guest Carts
- Use `session_id` with pattern: `guest_[random]`
- Stored in localStorage as `guestSessionId`
- Persist across page refreshes
- Not tied to user accounts

### User Carts
- Use `user_id` instead of `session_id`
- Associated with logged-in user
- Persist across devices
- Merge with guest cart on login

### localStorage Keys
- `guestSessionId` - Guest session identifier
- `cart` - Cart data cache
- Synchronized with backend on operations

---

## Implementation Priority for Stock Validation

### Priority 1: Block Out-of-Stock Purchases
**Goal**: Prevent users from adding out-of-stock items

**Files to Modify**:
1. `src/components/storefront/ProductItemCard.jsx` - Disable add to cart button
2. `src/services/cartService.js` - Validate before API call
3. `backend/src/routes/cart.js` - Server-side validation

### Priority 2: Quantity Validation
**Goal**: Prevent cart quantities exceeding available stock

**Files to Modify**:
1. `src/pages/storefront/Cart.jsx` - Enhance `validateQuantity` hook
2. `backend/src/routes/cart.js` - Validate quantity updates

### Priority 3: Inventory Deduction
**Goal**: Reduce stock when orders are placed

**Files to Create/Modify**:
1. Order fulfillment logic
2. Stock deduction on successful payment
3. Stock restoration on order cancellation

---

## Stock Checking Logic

### Helper Function
```javascript
function isProductOutOfStock(product) {
  // Infinite stock products are never out of stock
  if (product.infinite_stock) return false;

  // If not managing stock, never out of stock
  if (!product.manage_stock) return false;

  // Check if stock is depleted
  if (product.stock_quantity <= 0) {
    // Allow if backorders are enabled
    return !product.allow_backorders;
  }

  return false;
}

function getAvailableQuantity(product) {
  // Infinite stock
  if (product.infinite_stock) return Infinity;

  // Not managing stock
  if (!product.manage_stock) return Infinity;

  // Allow backorders
  if (product.allow_backorders) return Infinity;

  // Return actual stock
  return Math.max(0, product.stock_quantity);
}
```

---

## Related Files Reference

### Frontend
- `src/pages/storefront/Cart.jsx` - Main cart page
- `src/components/storefront/MiniCart.jsx` - Header cart widget
- `src/components/storefront/ProductItemCard.jsx` - Product display with add to cart
- `src/services/cartService.js` - Cart API service
- `src/utils/stockLabelUtils.js` - Stock label utilities
- `src/pages/admin/StockSettings.jsx` - Stock settings admin

### Backend
- `backend/src/routes/cart.js` - Cart API endpoints
- `backend/src/models/Cart.js` - Cart database model
- `backend/src/models/Product.js` - Product database model with stock fields

---

## Best Practices

### Stock Validation
1. Always validate on both frontend and backend
2. Frontend validation for UX (instant feedback)
3. Backend validation for security (prevent manipulation)
4. Handle race conditions for concurrent purchases
5. Consider reserved/pending stock during checkout

### User Experience
1. Show clear out-of-stock messages
2. Disable add to cart button visually
3. Update cart automatically if stock changes
4. Notify users if cart items become unavailable
5. Suggest alternatives for out-of-stock items

### Performance
1. Cache product stock in frontend
2. Use optimistic updates with rollback
3. Debounce quantity updates
4. Minimize API calls during browsing

---

## Testing Checklist

### Out of Stock Scenarios
- [ ] Product with `stock_quantity = 0` and `manage_stock = true`
- [ ] Product with `infinite_stock = true` (should always be available)
- [ ] Product with `allow_backorders = true` (should allow purchase)
- [ ] Product with `manage_stock = false` (should always be available)

### Quantity Validation
- [ ] Adding more than available stock
- [ ] Updating cart quantity beyond stock
- [ ] Multiple users purchasing last item
- [ ] Stock changes while item in cart

### Edge Cases
- [ ] Guest cart with out-of-stock items
- [ ] User cart with mixed stock statuses
- [ ] Cart persistence across sessions
- [ ] Stock updates during checkout

---

## Summary

The cart and inventory system has a solid foundation with proper data models and stock fields, but **critical validation is missing**. The system can display stock status but doesn't enforce stock limits during purchases.

**Immediate Action Required**:
1. Disable add to cart button for out-of-stock products
2. Add validation in cart service before API calls
3. Implement server-side stock validation
4. Add quantity validation in cart updates

**Future Enhancements**:
1. Inventory deduction on order completion
2. Reserved stock during checkout process
3. Real-time stock updates via WebSockets
4. Low stock notifications for admins
5. Automatic backorder management
