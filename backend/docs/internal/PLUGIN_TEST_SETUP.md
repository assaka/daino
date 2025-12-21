# Clock Plugin - Cart Popup Test

## Overview
Configured the Clock plugin to show a popup when visiting the /cart page as a test of the plugin event system.

## What Was Done

### 1. Plugin Configuration
- **Plugin ID**: `1760827872546-clock`
- **Plugin Name**: Clock
- **Status**: Active
- **Type**: AI-generated

### 2. Event Listener Added
```javascript
Event: cart.viewed
Listener Code:
(data) => {
  console.log('🕐 Clock Plugin: Cart page visited!', data);
  setTimeout(() => {
    alert('⏰ Clock Plugin Alert!\n\nYou are viewing the cart page.\n\nItems in cart: ' + (data?.items?.length || 0));
  }, 500);
}
```

### 3. Database Updates
Updated `plugin_registry` table:
- Added event listener to `config.events` array
- Set `enabled: true` and `priority: 10`

### 4. How It Works

1. **App Initialization** (`App.jsx:185`)
   - `initializeDatabasePlugins()` is called when app loads
   - Fetches all active plugins from `/api/plugins/registry?status=active`

2. **Event Registration** (`App.jsx:76-82`)
   - For each plugin, loads events from config
   - Registers event listeners via `eventSystem.on(event_name, listener_code)`

3. **Event Trigger** (`Cart.jsx:962`)
   - Cart page emits `cart.viewed` event with cart data
   - All registered listeners are called

4. **Plugin Response**
   - Clock plugin listener receives event
   - Shows popup with cart item count

## Testing

1. **Refresh the browser** to reload plugins
2. **Navigate to /cart** page
3. **Expected Result**: Popup appears after 500ms with:
   - "⏰ Clock Plugin Alert!"
   - "You are viewing the cart page."
   - "Items in cart: X"

## Console Output
You should see in browser console:
```
✅ Clock Plugin: Cart popup hook registered
🕐 Clock Plugin: Cart page visited! {items: [...], ...}
```

## Architecture Notes

### Plugin Event Flow
```
Database (plugin_registry)
  → App.jsx (initializeDatabasePlugins)
    → eventSystem.on('cart.viewed', listener)
      → Cart.jsx emits 'cart.viewed'
        → Clock plugin listener executes
          → Popup shows
```

### Event System
- **Location**: `src/core/EventSystem.js`
- **Methods**: `on()`, `emit()`, `off()`
- **Used By**: App.jsx, Cart.jsx, CodeEditor.jsx, etc.

### Database Schema
```sql
plugin_registry.config = {
  "hooks": [],
  "events": [
    {
      "event_name": "cart.viewed",
      "listener_code": "(data) => { ... }",
      "enabled": true,
      "priority": 10
    }
  ]
}
```

## Related Files
- `/api/plugins/registry/:id` - Backend API
- `src/App.jsx` - Plugin loader
- `src/pages/storefront/Cart.jsx` - Event emitter
- `src/core/EventSystem.js` - Event bus

## Next Steps
- Test with different events (cart.itemAdded, cart.itemRemoved, etc.)
- Add more sophisticated UI instead of alert()
- Create plugin admin UI for managing event listeners
