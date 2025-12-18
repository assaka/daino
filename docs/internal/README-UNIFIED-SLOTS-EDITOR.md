# Unified Slots Editor System

## Overview

The Unified Slots Editor system provides a consistent, maintainable, and AI-enhanced approach to slot-based page editing across the application. It replaces the previous individual editor implementations with a single, configurable editor component.

## Key Features

- **Unified Architecture**: Single `UnifiedSlotsEditor` component handles all page types
- **AI Enhancement Ready**: Built-in screenshot analysis and style generation
- **Consistent UI/UX**: Standardized interface across Product, Cart, and Category pages
- **Maintainable**: Centralized logic with page-specific configurations
- **Extensible**: Easy to add new page types and AI capabilities

## Architecture

### Core Components

1. **UnifiedSlotsEditor** (`/src/components/editor/UnifiedSlotsEditor.jsx`)
   - Main editor component
   - Handles all common editor functionality
   - Configurable through config objects

2. **AI Enhancement Service** (`/src/services/aiEnhancementService.js`)
   - Screenshot analysis
   - Style generation
   - Contextual suggestions

3. **Page-Specific Editors** (`/src/pages/editor/`)
   - Thin wrappers around UnifiedSlotsEditor
   - Page-specific configurations
   - AI enhancement configurations

## Usage

### Basic Implementation

```jsx
import UnifiedSlotsEditor from '@/components/editor/UnifiedSlotsEditor';

const MyPageEditor = ({ mode, onSave, viewMode }) => {
  const config = {
    pageType: 'mypage',
    pageName: 'My Page',
    slotType: 'mypage_layout',
    defaultViewMode: 'default',
    viewModes: [/* view mode configurations */],
    slotComponents: {/* slot component mapping */},
    generateContext: () => (/* page context */),
    cmsBlockPositions: [/* CMS positions */]
  };

  return (
    <UnifiedSlotsEditor
      config={config}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};
```

### Configuration Options

#### Editor Configuration (`config` prop)

```javascript
{
  pageType: string,           // Type identifier (product, cart, category)
  pageName: string,           // Display name
  slotType: string,           // Slot configuration type
  defaultViewMode: string,    // Default view mode
  viewModes: [                // Available view modes
    {
      key: string,
      label: string,
      icon: Component
    }
  ],
  slotComponents: {},         // Slot component mapping
  generateContext: function,  // Context generation function
  createDefaultSlots: function, // Default slot creation (optional)
  viewModeAdjustments: {},    // View mode specific adjustments
  customSlotRenderer: function, // Custom slot rendering logic
  cmsBlockPositions: []       // CMS block positions
}
```

#### AI Configuration (`aiConfig` prop)

```javascript
{
  enabled: boolean,           // Enable/disable AI features
  onScreenshotAnalysis: async function(file, layoutConfig, context),
  onStyleGeneration: async function(analysis, layoutConfig)
}
```

## AI Enhancement Features

### Screenshot Analysis

The system can analyze uploaded screenshots to understand design intent:

```javascript
const analysis = await aiEnhancementService.analyzeScreenshot(
  imageFile,
  currentLayout,
  pageType,
  context
);

// Returns:
// {
//   summary: "Description of detected layout",
//   suggestions: ["Array of improvements"],
//   detectedElements: ["List of detected UI elements"],
//   styleRecommendations: {},
//   confidence: 0.85
// }
```

### Style Generation

Generate CSS styles and layout modifications based on analysis:

```javascript
const styles = await aiEnhancementService.generateStyles(
  analysis,
  currentLayout,
  pageType
);

// Returns:
// {
//   slots: {}, // Updated slot configurations
//   globalStyles: {}, // Global style modifications
//   metadata: {} // AI generation metadata
// }
```

### User Workflow

1. **Upload Screenshot**: User uploads a reference image
2. **AI Analysis**: System analyzes the image and provides insights
3. **Review Suggestions**: User reviews AI suggestions and recommendations
4. **Apply Styles**: User can apply AI-generated styles with one click
5. **Fine-tune**: User can manually adjust the generated styles

## Page-Specific Implementations

### Product Editor

```javascript
// Product-specific configuration
const productEditorConfig = {
  pageType: 'product',
  pageName: 'Product Detail',
  slotType: 'product_layout',
  defaultViewMode: 'default',
  viewModes: [
    { key: 'default', label: 'Default View', icon: Package }
  ],
  slotComponents: {
    ProductGallerySlot,
    ProductInfoSlot,
    // ... other components
  },
  generateContext: () => generateMockProductContext(),
  cmsBlockPositions: ['product_above', 'product_below']
};
```

### Cart Editor

```javascript
// Cart-specific configuration with view modes
const cartEditorConfig = {
  pageType: 'cart',
  pageName: 'Cart',
  slotType: 'cart_layout',
  defaultViewMode: 'emptyCart',
  viewModes: [
    { key: 'emptyCart', label: 'Empty Cart', icon: ShoppingCart },
    { key: 'withProducts', label: 'With Products', icon: Package }
  ],
  slotComponents: {
    CartHeaderSlot,
    CartItemsSlot,
    // ... other components
  },
  generateContext: generateCartContext,
  viewModeAdjustments: {
    content_area: {
      colSpan: {
        shouldAdjust: (value) => typeof value === 'number',
        newValue: {
          emptyCart: 12,
          withProducts: 'col-span-12 sm:col-span-12 lg:col-span-8'
        }
      }
    }
  },
  customSlotRenderer: cartCustomSlotRenderer,
  cmsBlockPositions: ['cart_above_items', 'cart_below_items']
};
```

### Category Editor

```javascript
// Category-specific configuration with complex rendering
const categoryEditorConfig = {
  pageType: 'category',
  pageName: 'Category',
  slotType: 'category_layout',
  defaultViewMode: 'grid',
  viewModes: [
    { key: 'grid', label: 'Grid View', icon: Grid },
    { key: 'list', label: 'List View', icon: List }
  ],
  slotComponents: {
    CategoryHeaderSlot,
    CategoryProductsSlot,
    // ... other components
  },
  generateContext: generateMockCategoryContext,
  createDefaultSlots: createDefaultCategorySlots,
  viewModeAdjustments: categoryAdjustmentRules,
  customSlotRenderer: categoryCustomSlotRenderer,
  cmsBlockPositions: ['category_above_products', 'category_below_products']
};
```

## Migration Guide

### From Individual Editors

1. **Identify Configuration**: Extract page-specific configurations from existing editors
2. **Create Config Object**: Build configuration object following the schema
3. **Set Up AI Config**: Configure AI enhancement handlers
4. **Replace Component**: Replace existing editor with UnifiedSlotsEditor
5. **Test Functionality**: Ensure all features work as expected

### Benefits of Migration

- **Reduced Code Duplication**: ~80% reduction in editor code
- **Consistent Behavior**: Standardized UI patterns and interactions
- **Easier Maintenance**: Single source of truth for editor logic
- **AI Ready**: Built-in AI enhancement capabilities
- **Future Proof**: Easy to add new page types and features

## AI Service Configuration

### Environment Variables

```bash
# OpenAI Configuration
REACT_APP_AI_PROVIDER=openai
REACT_APP_OPENAI_API_KEY=your_openai_key

# Anthropic Configuration
REACT_APP_AI_PROVIDER=anthropic
REACT_APP_ANTHROPIC_API_KEY=your_anthropic_key
```

### Service Features

- **Multiple Providers**: Support for OpenAI and Anthropic
- **Fallback Handling**: Graceful degradation when AI services are unavailable
- **Context-Aware Analysis**: Page-type specific analysis prompts
- **Style Generation**: Tailwind CSS class generation
- **Error Recovery**: Automatic fallback to basic implementations

## Future Enhancements

### Planned Features

1. **Voice Commands**: Voice-controlled editing
2. **Collaborative Editing**: Real-time collaborative features
3. **Version Control**: Built-in versioning and rollback
4. **A/B Testing**: Integrated A/B testing capabilities
5. **Performance Optimization**: Advanced caching and optimization

### AI Roadmap

1. **Natural Language Editing**: "Make the header bigger and blue"
2. **Design System Integration**: AI-powered design system compliance
3. **Accessibility Analysis**: Automated accessibility improvements
4. **Performance Suggestions**: AI-driven performance optimization
5. **User Behavior Analysis**: AI-powered UX improvements

## Contributing

When adding new page types or AI features:

1. **Follow Patterns**: Use existing implementations as templates
2. **Test Thoroughly**: Ensure both manual and AI-assisted workflows work
3. **Document Changes**: Update this documentation
4. **Consider Accessibility**: Ensure AI features are accessible
5. **Handle Errors**: Implement proper fallback mechanisms

## Troubleshooting

### Common Issues

1. **AI Service Errors**: Check API keys and network connectivity
2. **Configuration Errors**: Verify configuration object structure
3. **Slot Rendering Issues**: Check slot component mappings
4. **View Mode Problems**: Verify view mode adjustment rules

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('DEBUG_UNIFIED_EDITOR', 'true');
```

This will provide detailed console logging for troubleshooting.

## Conclusion

The Unified Slots Editor system represents a significant improvement in maintainability, consistency, and functionality. The AI enhancement features provide a foundation for future innovation in visual website building, making the system ready for screenshot-based customization and automated design assistance.