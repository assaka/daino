# DainoStore E-commerce Platform - Architecture Documentation

## Table of Contents
- [Overview](#overview)
- [Slot-Based Page Builder System](#slot-based-page-builder-system)
- [Data Flow Architecture](#data-flow-architecture)
- [Price Display System](#price-display-system)
- [Stock Label System](#stock-label-system)
- [Template Variable Processing](#template-variable-processing)
- [Component Registry Pattern](#component-registry-pattern)
- [Key Files and Responsibilities](#key-files-and-responsibilities)
- [Critical Design Patterns](#critical-design-patterns)

---

## Overview

DainoStore is a headless e-commerce platform with a **slot-based page builder** system that allows visual customization of storefront pages through drag-and-drop editing. The architecture is designed to support:

1. **WYSIWYG Page Editing**: Visual editor with live preview
2. **Dual-Mode Rendering**: Same components work in editor and storefront
3. **Configuration-Driven UI**: Pages defined by JSON configurations stored in database
4. **Template Variables**: Handlebars-like syntax for dynamic content
5. **Centralized Data Formatting**: Single source of truth for prices, stock labels, etc.

---

## Slot-Based Page Builder System

### What is a Slot?

A **slot** is a configurable UI element that can be:
- **Basic HTML**: Text, images, buttons
- **Layout Container**: Grid, flex, or container for nested slots
- **Complex Component**: Product gallery, category filters, login forms
- **CMS Block**: Dynamic content from database

### Slot Structure

```javascript
{
  id: "product_name",              // Unique identifier
  type: "text",                    // text, button, image, component, container, grid, flex, html, cms
  content: "{{product.name}}",     // Content with template variables
  className: "text-2xl font-bold", // Tailwind CSS classes
  styles: { color: "#000" },       // Inline styles
  parentId: "product_info",        // Parent slot ID (null for root)
  colSpan: 12,                     // Grid column span (responsive object or number)
  viewModes: ["default"],          // Visibility rules (default, emptyCart, withProducts)
  metadata: {                      // Additional configuration
    htmlTag: "h1",                 // HTML tag for text slots
    component: "ProductGallerySlot", // Component name for component slots
    disableResize: false           // Editor behavior
  }
}
```

### Page Configuration

Pages are stored as JSON in the database (`page_configurations` table):

```javascript
{
  pageType: "category",
  storeId: 1,
  slots: {
    "root": { id: "root", type: "grid", ... },
    "product_grid": { id: "product_grid", type: "component", component: "ProductItemsGrid", ... },
    "product_card_name": { id: "product_card_name", type: "text", content: "{{product.name}}", ... }
  }
}
```

---

## Data Flow Architecture

### Category Page Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Category.jsx (Page Component)                               │
│    - Fetches category, products, filters from API              │
│    - Loads page configuration from database                     │
│    - Prepares categoryData object                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CategorySlotRenderer.jsx (Data Processor)                   │
│    - Receives raw products array                               │
│    - Formats each product using getPriceDisplay():             │
│      • Determines lowest/highest price                         │
│      • Creates price_formatted, compare_price_formatted        │
│      • Adds stock_label using getStockLabel()                  │
│      • Adds product_url using createProductUrl()               │
│    - Builds variableContext with formatted data                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. UnifiedSlotRenderer.jsx (Rendering Engine)                  │
│    - Receives slot tree + variableContext                      │
│    - Filters slots by viewMode                                 │
│    - For each slot:                                            │
│      • Processes variables in content/className/styles         │
│      • Renders based on type (text, button, image, component)  │
│      • Wraps with editor controls if in editor mode            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4a. Component Slots (Complex Components)                       │
│     - ProductItemsGrid: Renders product grid from variableContext│
│     - CategoryFilterSlot: Renders attribute filters            │
│     - PaginationSlot: Renders pagination controls              │
└─────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4b. Template Slots (HTML with Variables)                       │
│     - variableProcessor.js processes {{variables}}             │
│     - Replaces {{product.name}} with actual product name       │
│     - Evaluates {{#if}} conditionals                          │
│     - Expands {{#each}} loops                                  │
└─────────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Final Rendered Output                                       │
│    - Editor Mode: Wrapped with resize/drag controls           │
│    - Storefront Mode: Clean HTML/React output                 │
└─────────────────────────────────────────────────────────────────┘
```

### Product Page Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Product.jsx (Page Component)                                │
│    - Fetches product, settings, productLabels from API         │
│    - Loads page configuration                                  │
│    - Prepares productData object                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ProductSlotRenderer.jsx (Data Processor)                    │
│    - Formats product using getPriceDisplay()                   │
│    - Adds stock_label, stock_label_style                       │
│    - Processes custom options (CustomOptions.jsx)              │
│    - Builds variableContext                                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. UnifiedSlotRenderer.jsx → Component Slots                   │
│    - ProductGallerySlot: Image gallery with thumbnails         │
│    - ProductTabsSlot: Description, specifications, reviews     │
│    - RelatedProductsSlot: Related product carousel             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Price Display System

### Centralized Price Logic

**File**: `src/utils/priceUtils.js`

```javascript
export const getPriceDisplay = (product) => {
  const price = safeNumber(product.price);
  const comparePrice = safeNumber(product.compare_price);
  const hasComparePrice = comparePrice > 0 && comparePrice !== price;

  if (!hasComparePrice) {
    return {
      hasComparePrice: false,
      displayPrice: price,
      originalPrice: null,
      isSale: false
    };
  }

  return {
    hasComparePrice: true,
    displayPrice: Math.min(price, comparePrice),  // Lowest price (shown large)
    originalPrice: Math.max(price, comparePrice),  // Highest price (shown with strikethrough)
    isSale: true
  };
};
```

### Price Display Rules

1. **No Compare Price**: Show regular price only
   ```
   ¥1049.00
   ```

2. **With Compare Price**: Show lowest price prominently, highest with strikethrough
   ```
   ¥1049.00  ¥1349.00
   (large)   (strikethrough)
   ```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Raw Product Data                                                │
│ { price: 1349.00, compare_price: 1049.00 }                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ getPriceDisplay() in CategorySlotRenderer                       │
│ Returns:                                                        │
│ {                                                               │
│   hasComparePrice: true,                                        │
│   displayPrice: 1049.00,    // Min (shown large)              │
│   originalPrice: 1349.00    // Max (strikethrough)            │
│ }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Formatted Product in variableContext                            │
│ {                                                               │
│   ...product,                                                   │
│   price_formatted: "¥1049.00",          // Display price       │
│   compare_price_formatted: "¥1349.00"   // Original price      │
│ }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Template (category-config.js)                                  │
│ <span class="text-lg font-bold">{{this.price_formatted}}</span>│
│ {{#if this.compare_price_formatted}}                           │
│   <span class="line-through">{{this.compare_price_formatted}}</span>│
│ {{/if}}                                                         │
└─────────────────────────────────────────────────────────────────┘
```

### ⚠️ CRITICAL: Never Re-Format Prices

**Bad** ❌:
```javascript
// DON'T DO THIS - Re-formatting prices overrides getPriceDisplay logic
const products = variableContext.products.map(p => ({
  ...p,
  price_formatted: formatPrice(p.price),  // Wrong!
  compare_price_formatted: p.compare_price ? formatPrice(p.compare_price) : null  // Wrong!
}));
```

**Good** ✅:
```javascript
// USE PRE-FORMATTED PRICES from variableContext
const products = variableContext.products;
// Products already have correct price_formatted and compare_price_formatted
```

---

## Stock Label System

### Centralized Stock Logic

**File**: `src/utils/stockLabelUtils.js`

```javascript
export function getStockLabel(product, settings = {}) {
  // 1. Check if labels enabled
  if (!settings?.stock_settings?.show_stock_label) return null;

  // 2. Infinite stock
  if (product.infinite_stock) {
    return {
      text: settings.stock_settings.in_stock_label,
      textColor: settings.stock_settings.in_stock_text_color,
      bgColor: settings.stock_settings.in_stock_bg_color
    };
  }

  // 3. Out of stock
  if (product.stock_quantity <= 0) {
    return {
      text: settings.stock_settings.out_of_stock_label,
      textColor: settings.stock_settings.out_of_stock_text_color,
      bgColor: settings.stock_settings.out_of_stock_bg_color
    };
  }

  // 4. Low stock
  const threshold = product.low_stock_threshold || settings.display_low_stock_threshold || 0;
  if (threshold > 0 && product.stock_quantity <= threshold) {
    return {
      text: processLabel(settings.stock_settings.low_stock_label, product.stock_quantity),
      textColor: settings.stock_settings.low_stock_text_color,
      bgColor: settings.stock_settings.low_stock_bg_color
    };
  }

  // 5. In stock
  return {
    text: processLabel(settings.stock_settings.in_stock_label, product.stock_quantity),
    textColor: settings.stock_settings.in_stock_text_color,
    bgColor: settings.stock_settings.in_stock_bg_color
  };
}
```

### Quantity Placeholders

Admin can configure labels with placeholders:
- `{quantity}` → Actual quantity
- `{item}` / `{items}` → Singular/plural
- `{unit}` / `{units}` → Singular/plural
- `{piece}` / `{pieces}` → Singular/plural

Examples:
- `"In Stock, {only {quantity} {item} left}"` + qty=3 → `"In Stock, only 3 items left"`
- `"In Stock, {only {quantity} {item} left}"` + qty=1 → `"In Stock, only 1 item left"`
- `"In Stock"` + infinite_stock → `"In Stock"` (quantity blocks removed)

### Stock Label Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CategorySlotRenderer formats products                           │
│                                                                 │
│ const stockLabelInfo = getStockLabel(product, settings);        │
│ const stockLabelStyle = getStockLabelStyle(product, settings);  │
│                                                                 │
│ formattedProduct = {                                            │
│   ...product,                                                   │
│   stock_label: stockLabelInfo?.text,                           │
│   stock_label_style: stockLabelStyle                           │
│ }                                                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ CategorySlotComponents.jsx renders product card                │
│                                                                 │
│ <Badge style={product.stock_label_style}>                      │
│   {product.stock_label}                                         │
│ </Badge>                                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Template Variable Processing

### Variable Syntax

**File**: `src/utils/variableProcessor.js`

#### Simple Variables
```handlebars
{{product.name}} → "Samsung RS66A8101B1"
{{product.price_formatted}} → "¥1049.00"
{{settings.currency_symbol}} → "¥"
```

#### Conditionals
```handlebars
{{#if product.on_sale}}
  <span class="badge">SALE</span>
{{/if}}

{{#if product.compare_price_formatted}}
  <span class="line-through">{{product.compare_price_formatted}}</span>
{{/if}}

{{#if (eq product.status "active")}}Active{{/if}}
{{#if (gt product.stock_quantity 0)}}In Stock{{/if}}
{{#if product.price > 100}}Expensive{{/if}}
```

#### Loops
```handlebars
{{#each product.images}}
  <img src="{{this}}" alt="Product image" />
{{/each}}

{{#each products}}
  <div class="product-card">
    <h3>{{this.name}}</h3>
    <p>{{this.price_formatted}}</p>
  </div>
{{/each}}
```

### Processing Order

**CRITICAL**: Order matters!

```
1. Loops First ({{#each}})
   ↓
2. Conditionals Second ({{#if}})
   ↓
3. Simple Variables Last ({{variable}})
```

This ensures conditionals inside loops get the correct item context.

### Variable Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ UnifiedSlotRenderer receives slot                               │
│ content: "{{#if product.on_sale}}{{product.price_formatted}}{{/if}}" │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ processVariables(content, variableContext)                      │
│                                                                 │
│ 1. processLoops()         // No loops in this example         │
│ 2. processConditionals()  // Evaluate {{#if product.on_sale}}  │
│    → Condition true, keep inner content                        │
│    → Result: "{{product.price_formatted}}"                     │
│ 3. processSimpleVariables() // Replace {{product.price_formatted}}│
│    → getNestedValue("product.price_formatted", context)        │
│    → formatValue("¥1049.00", path, context)                    │
│    → Result: "¥1049.00"                                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Final Rendered Content: "¥1049.00"                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Registry Pattern

### Registration

**File**: `src/components/editor/slot/UnifiedSlotComponents.js`

```javascript
import { registerSlotComponent } from './SlotComponentRegistry';

registerSlotComponent('ProductGallerySlot', {
  render: ({ slot, productContext, context, className, styles }) => {
    // Unified render method for both editor and storefront
    const product = productContext?.product;

    if (context === 'editor') {
      // Editor preview with sample images
      return <div>Gallery Preview</div>;
    }

    // Storefront rendering
    return <ProductGallery product={product} />;
  }
});
```

### Lookup and Render

**File**: `src/components/editor/slot/UnifiedSlotRenderer.jsx`

```javascript
if (type === 'component') {
  const componentName = slot.component || slot.metadata?.component;

  if (ComponentRegistry.has(componentName)) {
    const component = ComponentRegistry.get(componentName);

    return component.render({
      slot,
      productContext: productData,
      categoryContext: categoryData,
      context,
      variableContext,
      // ... other props
    });
  }
}
```

### Component Registry Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. App Initialization                                           │
│    - UnifiedSlotComponents.js imports and registers all components│
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ComponentRegistry (Singleton)                                │
│    {                                                            │
│      "ProductGallerySlot": { render: fn },                     │
│      "CategoryFilterSlot": { render: fn },                     │
│      "ProductItemsGrid": { render: fn },                       │
│      ...                                                        │
│    }                                                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. UnifiedSlotRenderer encounters component slot                │
│    slot.type === 'component'                                    │
│    slot.component === 'ProductGallerySlot'                      │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ComponentRegistry.get('ProductGallerySlot')                  │
│    Returns component object with render method                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. component.render({ slot, productContext, context, ... })    │
│    Component renders in appropriate mode (editor vs storefront) │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files and Responsibilities

### Core Slot System

| File | Responsibility |
|------|---------------|
| `UnifiedSlotRenderer.jsx` | Universal rendering engine for all slot types |
| `SlotComponentRegistry.js` | Singleton registry for component slots |
| `UnifiedSlotComponents.js` | Imports and registers all slot components |
| `SlotComponents.jsx` | Editor-specific components (GridColumn, ResizeWrapper) |
| `variableProcessor.js` | Template variable processing ({{variables}}) |
| `slotUtils.js` | Utility functions for slot tree manipulation |

### Page-Specific Renderers

| File | Responsibility |
|------|---------------|
| `CategorySlotRenderer.jsx` | Pre-formats category products, builds variableContext |
| `ProductSlotRenderer.jsx` | Pre-formats product, handles custom options |
| `CategorySlotComponents.jsx` | Category-specific slot components (ProductItemsGrid, filters) |
| `ProductSlotComponents.jsx` | Product-specific slot components (gallery, tabs, related) |
| `CartSlotComponents.jsx` | Cart-specific slot components (cart items, totals) |
| `HeaderSlotComponents.jsx` | Header components (logo, nav, search, cart icon) |

### Configuration Files

| File | Responsibility |
|------|---------------|
| `category-config.js` | Default category page slot template |
| `product-config.js` | Default product page slot template |
| `cart-config.js` | Default cart page slot template |
| `header-config.js` | Default header slot template |

### Utility Files

| File | Responsibility |
|------|---------------|
| `priceUtils.js` | Centralized price formatting and display logic |
| `stockLabelUtils.js` | Centralized stock label logic |
| `urlUtils.js` | URL generation (product URLs, category URLs) |
| `scriptHandler.js` | Script execution for dynamic slot behavior |

### Page Components

| File | Responsibility |
|------|---------------|
| `Category.jsx` | Category page - loads products, filters, config |
| `Product.jsx` | Product page - loads product, custom options, config |
| `Cart.jsx` | Cart page - loads cart items, config |
| `Header.jsx` | Header component - uses header slot config |

---

## Critical Design Patterns

### 1. Single Source of Truth for Data Formatting

✅ **Good**:
```javascript
// CategorySlotRenderer.jsx
const formattedProducts = products.map(product => {
  const priceInfo = getPriceDisplay(product);  // ← Centralized
  const stockLabel = getStockLabel(product, settings);  // ← Centralized

  return {
    ...product,
    price_formatted: formatPrice(priceInfo.displayPrice),
    compare_price_formatted: priceInfo.hasComparePrice ? formatPrice(priceInfo.originalPrice) : '',
    stock_label: stockLabel?.text,
    stock_label_style: getStockLabelStyle(product, settings)
  };
});
```

❌ **Bad**:
```javascript
// Component.jsx - DON'T DO THIS
const products = data.map(p => ({
  ...p,
  price_formatted: formatPrice(p.price),  // ← Re-formatting! Wrong!
  compare_price_formatted: p.compare_price ? formatPrice(p.compare_price) : null
}));
```

### 2. Use Pre-Formatted Data

✅ **Good**:
```javascript
// Use data from variableContext - already formatted
const products = variableContext.products;
```

❌ **Bad**:
```javascript
// Re-format data that's already been formatted
const products = variableContext.products.map(p => ({
  ...p,
  price_formatted: formatPrice(p.price)  // ← Wrong!
}));
```

### 3. Dual-Mode Component Pattern

✅ **Good**:
```javascript
registerSlotComponent('MyComponent', {
  render: ({ slot, context, productContext, variableContext }) => {
    if (context === 'editor') {
      // Editor preview with demo data
      return <div>Preview</div>;
    }

    // Storefront with real data
    return <RealComponent data={productContext.product} />;
  }
});
```

❌ **Bad**:
```javascript
// Separate renderEditor and renderStorefront methods (deprecated)
registerSlotComponent('MyComponent', {
  renderEditor: () => <div>Editor</div>,
  renderStorefront: () => <div>Storefront</div>
});
```

### 4. Variable Processing Order

✅ **Good**:
```javascript
// processVariables() in variableProcessor.js
processedContent = processLoops(content, context, pageData);        // 1. Loops first
processedContent = processConditionals(processedContent, context);  // 2. Conditionals second
processedContent = processSimpleVariables(processedContent, context); // 3. Variables last
```

❌ **Bad**:
```javascript
// Processing in wrong order causes conditionals in loops to fail
processedContent = processConditionals(content, context);  // ← Wrong order!
processedContent = processLoops(processedContent, context);
```

### 5. Always Check Stock Label Return Value

✅ **Good**:
```javascript
const stockLabel = getStockLabel(product, settings);
if (stockLabel) {
  return (
    <Badge style={{ backgroundColor: stockLabel.bgColor, color: stockLabel.textColor }}>
      {stockLabel.text}
    </Badge>
  );
}
return null;  // Labels disabled or product invalid
```

❌ **Bad**:
```javascript
// Assuming getStockLabel always returns a value
const stockLabel = getStockLabel(product, settings);
return <Badge>{stockLabel.text}</Badge>;  // ← Crashes if null!
```

### 6. Use Centralized Stock Label Logic

✅ **Good**:
```javascript
import { getStockLabel, getStockLabelStyle } from '@/utils/stockLabelUtils';

const stockLabel = getStockLabel(product, settings);
const stockLabelStyle = getStockLabelStyle(product, settings);
```

❌ **Bad**:
```javascript
// Implementing stock label logic inline
const stockLabel = product.infinite_stock
  ? 'In Stock'
  : product.stock_quantity > 0
    ? `${product.stock_quantity} available`
    : 'Out of Stock';  // ← Wrong! Doesn't respect admin settings!
```

---

## Editor vs Storefront Mode

### Editor Mode (`context='editor'`)

**Purpose**: Visual page builder for admins to customize pages

**Features**:
- Drag & drop slot positioning
- Visual resizing with ResizeWrapper
- Click to select elements
- Borders and guides for layout
- Demo data for preview (generateDemoData())
- GridColumn wrapper for grid editing

**Components Used**:
- `EditorLayout.jsx` - Main editor UI
- `PropertiesPanel.jsx` - Edit slot properties
- `GridColumn` - Drag/resize wrapper
- `ResizeWrapper` - Visual resize handles

### Storefront Mode (`context='storefront'`)

**Purpose**: Customer-facing pages

**Features**:
- Clean HTML output (no wrappers)
- Real data from API/database
- Interactive functionality (add to cart, links)
- Script execution for dynamic behavior
- Full responsive layout

**Same Components, Different Rendering**:
```javascript
// UnifiedSlotRenderer checks context
if (context === 'editor') {
  return wrapWithResize(element, slot);  // Add resize handles
} else {
  return element;  // Clean output
}
```

---

## Summary

The DainoStore architecture is built around:

1. **Slot-based page builder** for visual customization
2. **Dual-mode rendering** (editor + storefront) using same components
3. **Centralized data formatting** (prices, stock labels) as single source of truth
4. **Template variables** for dynamic content with Handlebars-like syntax
5. **Component registry** for extensible complex components
6. **Configuration-driven UI** stored in database

**Key Principles**:
- ✅ Format data once, pass downstream
- ✅ Never re-format pre-formatted data
- ✅ Use centralized utilities (priceUtils, stockLabelUtils)
- ✅ Respect admin settings (stock labels, currency, colors)
- ✅ Process variables in correct order (loops → conditionals → variables)
- ✅ Check null returns from utility functions
- ✅ Same components work in editor and storefront

This architecture provides flexibility for customization while maintaining consistency and performance.
