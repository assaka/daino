# Extension System Implementation Guide

## Overview

The new extension system replaces the fragile diff-patching model with a stable hook-based architecture. This provides a robust, maintainable system that can evolve without breaking existing customizations.

## 🔧 Core Architecture

### Hook System (`src/core/HookSystem.js`)
- **Purpose**: Provides extensible hook points throughout the application
- **Methods**: `register()`, `apply()`, `do()`, `applyAsync()`, `doAsync()`
- **Features**: Priority-based execution, error handling, debugging support

### Event System (`src/core/EventSystem.js`)
- **Purpose**: Event-driven architecture for loose coupling
- **Methods**: `on()`, `once()`, `emit()`, `emitAsync()`, `off()`
- **Features**: Priority-based listeners, event history, async support

### Extension System (`src/core/ExtensionSystem.js`)
- **Purpose**: Manages loading and lifecycle of extension modules
- **Methods**: `register()`, `load()`, `unload()`, `loadFromConfig()`
- **Features**: Dependency management, validation, cleanup

### Version System (`src/core/VersionSystem.js`)
- **Purpose**: Manages releases and version history
- **Methods**: `createRelease()`, `publishRelease()`, `rollbackToVersion()`
- **Features**: Semantic versioning, rollback support, change tracking

## 🎯 Key Benefits

### 1. **Stability**
- Core updates don't break customizations
- Hook interfaces remain consistent
- Graceful error handling

### 2. **Isolation**
- Extensions are self-contained modules  
- No cross-contamination between customizations
- Clear dependency management

### 3. **Versioning**
- Full release management with rollback capability
- Semantic version numbering
- Change tracking and comparison

### 4. **Testability**
- Extensions can be tested independently
- Mock hook systems for testing
- Clear separation of concerns

## 📦 Extension Module Format

```javascript
export default {
  name: 'extension-name',
  version: '1.0.0',
  description: 'Extension description',
  
  // Hook handlers
  hooks: {
    'hook.name': function(value, context) {
      // Transform value and return
      return processedValue;
    }
  },
  
  // Event listeners
  events: {
    'event.name': function(data) {
      // Handle event
    }
  },
  
  // Lifecycle methods
  async init() { /* initialization */ },
  async cleanup() { /* cleanup */ },
  
  // Configuration
  config: { /* default config */ },
  dependencies: ['other-extension@1.0.0']
};
```

## 🔌 Available Hook Points

### Component Hooks
- `component.beforeRender` - Modify component props before render
- `component.afterRender` - Post-processing after render

### Cart Hooks
- `cart.beforeAddItem` - Validate/transform items before adding
- `cart.afterAddItem` - Post-processing after item added
- `cart.calculateItemPrice` - Custom pricing logic
- `cart.validateCoupon` - Coupon validation
- `cart.beforeCheckout` - Pre-checkout validation

### Pricing Hooks
- `pricing.calculate` - Core pricing calculation
- `pricing.format` - Price display formatting

### API Hooks
- `api.beforeRequest` - Transform API requests
- `api.afterResponse` - Process API responses

## 📡 Event System

### Cart Events
- `cart.itemsLoaded` - Cart data loaded
- `cart.itemAdded` - Item added to cart
- `cart.itemRemoved` - Item removed from cart
- `cart.checkoutStarted` - Checkout process initiated

### User Events
- `user.login` - User logged in
- `user.register` - User registered

### System Events
- `extension.loaded` - Extension loaded
- `extension.unloaded` - Extension unloaded

## 🛠 Implementation Examples

### 1. Custom Pricing Extension

```javascript
// src/extensions/custom-pricing.js
export default {
  name: 'custom-pricing',
  version: '1.0.0',
  
  hooks: {
    'pricing.calculate': function(basePrice, context) {
      if (context.quantity >= 5) {
        return basePrice * 0.9; // 10% bulk discount
      }
      return basePrice;
    }
  },
  
  events: {
    'cart.itemAdded': function(data) {
      console.log('Custom pricing: Item added', data.item.name);
    }
  }
};
```

### 2. Analytics Tracking Extension

```javascript
// src/extensions/analytics-tracker.js
export default {
  name: 'analytics-tracker',
  version: '1.0.0',
  
  events: {
    'cart.checkoutStarted': function(data) {
      gtag('event', 'begin_checkout', {
        currency: 'USD',
        value: data.totals.total
      });
    }
  }
};
```

## 🎨 Enhanced Code Editor Features

### Split View
- Side-by-side comparison of original vs modified code
- Real-time diff highlighting
- Independent scrolling

### Version History
- Track all code changes
- Restore to any previous version
- Change statistics and timestamps

### Revert Functionality
- Line-by-line revert capability
- Undo/redo with hook integration
- Preview changes before applying

## 📊 Preview System

### Features
- Generate live previews before publishing
- Validation and error checking
- Change impact analysis
- Preview URL generation

### Usage
```javascript
import PreviewSystem from '@/components/editor/ai-context/PreviewSystem.jsx';

<PreviewSystem
  changes={changesArray}
  storeId={storeId}
  onPreview={handlePreview}
  onPublish={handlePublish}
/>
```

## 🗄 Database Schema

### Extension Releases
```sql
CREATE TABLE extension_releases (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  changes JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',
  -- ... additional fields
);
```

### Hook Registrations
```sql
CREATE TABLE hook_registrations (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  hook_name VARCHAR(255) NOT NULL,
  handler_function TEXT NOT NULL,
  priority INTEGER DEFAULT 10,
  -- ... additional fields
);
```

## 🚀 Migration Path

### 1. Phase 1: Core System Setup
- ✅ Implement hook/event systems
- ✅ Create extension architecture
- ✅ Add version management
- ✅ Enhance code editor

### 2. Phase 2: Extension Development
- ✅ Create example extensions
- ✅ Build extension manager UI
- ✅ Add preview system
- ✅ Implement release workflow

### 3. Phase 3: Migration & Cleanup
- ✅ Remove obsolete patch files
- ✅ Clean up database tables
- ✅ Update components to use hooks
- ✅ Deploy new system

## 📈 Performance Benefits

### Before (Patch System)
- Sequential patch application
- String-based diff matching
- Complex state management
- Brittle file dependencies

### After (Extension System)
- Parallel hook execution
- Stable API interfaces  
- Clean separation of concerns
- Version-controlled releases

## 🔐 Security Improvements

### Validation
- Extension code validation
- Hook parameter sanitization
- Event payload verification

### Isolation
- Sandboxed extension execution
- Clear permission boundaries
- Dependency tracking

## 📚 Usage Instructions

### Loading Extensions
```javascript
import extensionSystem from '@/core/ExtensionSystem.js';

// Load single extension
await extensionSystem.loadFromConfig([{
  module: '@/extensions/custom-pricing.js',
  enabled: true,
  config: { volumeDiscountEnabled: true }
}]);
```

### Creating Releases
```javascript
import versionSystem from '@/core/VersionSystem.js';

const release = await versionSystem.createRelease({
  name: 'Custom Pricing Update',
  version: '1.1.0',
  changes: changesArray,
  storeId: 'store-id',
  createdBy: 'user-id'
});

await versionSystem.publishRelease(release.id);
```

### Managing Extensions
```javascript
import ExtensionManager from '@/components/admin/ExtensionManager.jsx';

<ExtensionManager storeId={storeId} />
```

## 🎯 Next Steps

1. **Test Extensions**: Create and test custom extensions for your specific needs
2. **Configure Hooks**: Set up hooks in components where customization is needed  
3. **Monitor Performance**: Use the analytics to track system performance
4. **Create Releases**: Use the new release system for deployment
5. **Feedback Loop**: Gather feedback and iterate on the extension API

## 🆘 Troubleshooting

### Common Issues
- **Extension won't load**: Check console for validation errors
- **Hooks not firing**: Verify hook names match exactly
- **Events not received**: Check event listener registration

### Debug Tools
- Set `NODE_ENV=development` for debug logging
- Use Extension Manager to monitor hook/event activity
- Check browser console for detailed error messages

## 📞 Support

- **Documentation**: `/docs/extensions/`
- **Examples**: `/src/extensions/`
- **API Reference**: Hook and Event system documentation
- **Community**: Extension development community

---

This new system provides a **stable, scalable foundation** for customizations that will grow with your application without the fragility of the old patch system.