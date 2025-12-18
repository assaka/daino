# Unified Slot Editor - Custom Page Guide

## Overview

The Unified Slot Editor allows you to create editable layouts for any page type. You can build custom pages with drag-and-drop capabilities, micro-slot editing, and full content management.

## Architecture

```
UnifiedSlotEditor (Universal Interface)
├── Page Configurations (defines slots and behavior)
├── Smart Routing (chooses appropriate editor)
└── Content Injection (real vs sample data)
```

## Quick Start

### 1. Create a Custom Page Configuration

Create your page configuration in `src/components/editor/slot/configs/`:

```javascript
// src/components/editor/slot/configs/landing-config.js
export const landingConfig = {
  title: 'Landing Page Editor',
  defaultView: 'default',
  defaultSlots: ['hero', 'features', 'testimonials', 'cta'],
  slots: {
    hero: {
      name: 'Hero Section',
      defaultContent: '<div class="hero"><h1>Welcome</h1><p>Your message here</p></div>',
      component: null
    },
    features: {
      name: 'Features Section',
      defaultContent: '<div class="features"><h2>Our Features</h2></div>',
      component: null
    },
    testimonials: {
      name: 'Customer Testimonials',
      defaultContent: '<div class="testimonials"><h2>What Our Customers Say</h2></div>',
      component: null
    },
    cta: {
      name: 'Call to Action',
      defaultContent: '<div class="cta"><button>Get Started</button></div>',
      component: null
    }
  },
  cmsBlocks: [
    'landing_header',
    'landing_footer'
  ]
};

export default landingConfig;
```

### 2. Register Your Configuration

Add your config to the main index file:

```javascript
// src/components/editor/slot/configs/index.js
import { landingConfig } from './landing-config';

export const PAGE_CONFIGS = {
  cart: cartConfig,
  category: categoryConfig,
  product: productConfig,
  homepage: homepageConfig,
  checkout: checkoutConfig,
  landing: landingConfig, // Add your config here
};
```

### 3. Use the Editor

```javascript
// src/pages/custom/LandingPageEditor.jsx
import React from 'react';
import UnifiedSlotEditor from '@/components/editor/slot/UnifiedSlotEditor';

const LandingPageEditor = () => {
  const handleSave = (config) => {
    console.log('Saving landing page config:', config);
    // Save to your backend/localStorage
  };

  return (
    <div className="landing-editor">
      <UnifiedSlotEditor
        pageName="Landing"
        onClose={() => console.log('Editor closed')}
        onSave={handleSave}
      />
    </div>
  );
};

export default LandingPageEditor;
```

### 4. Display the Page

```javascript
// src/pages/custom/LandingPage.jsx
import React from 'react';
import UnifiedSlotEditor from '@/components/editor/slot/UnifiedSlotEditor';

const LandingPage = ({ data }) => {
  return (
    <UnifiedSlotEditor
      pageName="Landing"
      mode="display" // Read-only mode for visitors
      data={data}    // Real page data
    />
  );
};

export default LandingPage;
```

## Advanced Features

### Micro-Slots (Advanced Editing)

For complex layouts with fine-grained control, add micro-slot definitions:

```javascript
// landing-config.js with micro-slots
const MICRO_SLOT_DEFINITIONS = {
  hero: {
    id: 'hero',
    name: 'Hero Section',
    microSlots: ['hero.title', 'hero.subtitle', 'hero.button', 'hero.image'],
    gridCols: 12,
    defaultSpans: {
      'hero.title': { col: 12, row: 1 },
      'hero.subtitle': { col: 12, row: 1 },
      'hero.button': { col: 4, row: 1 },
      'hero.image': { col: 8, row: 2 }
    }
  }
};

export const landingConfig = {
  title: 'Landing Page Editor',
  defaultSlots: ['hero', 'features'],
  microSlotDefinitions: MICRO_SLOT_DEFINITIONS,
  slots: {
    hero: {
      name: 'Hero Section',
      microSlots: MICRO_SLOT_DEFINITIONS.hero.microSlots,
      gridCols: MICRO_SLOT_DEFINITIONS.hero.gridCols,
      defaultSpans: MICRO_SLOT_DEFINITIONS.hero.defaultSpans
    }
  }
};
```

### Multiple View Modes

Support different layouts for different contexts:

```javascript
export const productConfig = {
  title: 'Product Page Editor',
  defaultView: 'detailed',
  views: [
    { id: 'simple', label: 'Simple View', icon: FileText },
    { id: 'detailed', label: 'Detailed View', icon: Grid }
  ],
  slots: {
    gallery: {
      name: 'Product Gallery',
      views: ['detailed'], // Only show in detailed view
      defaultContent: '<div>Product images here</div>'
    },
    quickView: {
      name: 'Quick View',
      views: ['simple'], // Only show in simple view
      defaultContent: '<div>Quick product info</div>'
    }
  }
};
```

### Custom Components

Integrate React components for dynamic content:

```javascript
// Custom component
const PriceCalculator = ({ data }) => {
  const [price, setPrice] = useState(data.basePrice || 0);
  return (
    <div className="price-calculator">
      <h3>Price Calculator</h3>
      <div>Base Price: ${price}</div>
      {/* Your custom logic */}
    </div>
  );
};

// In your config
export const pricingConfig = {
  slots: {
    calculator: {
      name: 'Price Calculator',
      component: PriceCalculator, // Use your custom component
      defaultContent: null
    }
  }
};
```

## Content Management

### Static Content
```javascript
slots: {
  header: {
    defaultContent: '<h1 class="text-4xl font-bold">Welcome</h1>'
  }
}
```

### Dynamic Content
```javascript
slots: {
  productList: {
    component: ProductGrid,
    getData: (data) => data.products || []
  }
}
```

### CMS Integration
```javascript
cmsBlocks: [
  'page_header',
  'page_sidebar',
  'page_footer'
]
```

## Data Flow

### Editor Mode (Edit)
```javascript
<UnifiedSlotEditor
  pageName="Landing"
  mode="edit"
  data={sampleData}  // Mock data for editing
  onSave={handleSave}
/>
```

### Display Mode (Visitor)
```javascript
<UnifiedSlotEditor
  pageName="Landing"
  mode="display"
  data={realData}    // Real data from your API
/>
```

## Complete Example

Here's a full custom page implementation:

```javascript
// configs/portfolio-config.js
export const portfolioConfig = {
  title: 'Portfolio Page Editor',
  defaultView: 'grid',
  views: [
    { id: 'grid', label: 'Grid View', icon: Grid },
    { id: 'list', label: 'List View', icon: List }
  ],
  defaultSlots: ['header', 'projects', 'contact'],
  slots: {
    header: {
      name: 'Portfolio Header',
      views: ['grid', 'list'],
      defaultContent: '<div class="header"><h1>My Portfolio</h1><p>Creative works and projects</p></div>'
    },
    projects: {
      name: 'Project Gallery',
      views: ['grid', 'list'],
      defaultContent: '<div class="projects">Projects will load here</div>',
      component: ProjectGrid,
      getData: (data) => data.projects || []
    },
    contact: {
      name: 'Contact Section',
      views: ['grid', 'list'],
      defaultContent: '<div class="contact"><h2>Get In Touch</h2><p>Let\'s work together</p></div>'
    }
  },
  cmsBlocks: [
    'portfolio_hero',
    'portfolio_footer'
  ]
};

// pages/PortfolioEditor.jsx
import React from 'react';
import UnifiedSlotEditor from '@/components/editor/slot/UnifiedSlotEditor';

const PortfolioEditor = () => {
  const handleSave = (config) => {
    // Save configuration
    localStorage.setItem('portfolio_config', JSON.stringify(config));
  };

  return (
    <UnifiedSlotEditor
      pageName="Portfolio"
      onSave={handleSave}
      onClose={() => window.history.back()}
    />
  );
};

export default PortfolioEditor;

// pages/Portfolio.jsx  
import React, { useEffect, useState } from 'react';
import UnifiedSlotEditor from '@/components/editor/slot/UnifiedSlotEditor';

const Portfolio = () => {
  const [data, setData] = useState({ projects: [] });
  
  useEffect(() => {
    // Load your real data
    fetchPortfolioData().then(setData);
  }, []);

  return (
    <UnifiedSlotEditor
      pageName="Portfolio"
      mode="display"
      data={data}
    />
  );
};

export default Portfolio;
```

## Best Practices

### 1. Naming Conventions
- Use clear, descriptive slot names
- Follow camelCase for slot IDs
- Use descriptive config file names

### 2. Content Structure
- Provide meaningful default content
- Use semantic HTML classes
- Consider mobile responsiveness

### 3. Data Management
- Separate editor data from display data
- Use TypeScript for better type safety
- Implement proper error handling

### 4. Performance
- Lazy load heavy components
- Optimize images and assets
- Use React.memo for expensive renders

## Troubleshooting

### Common Issues

**Config not loading:**
```javascript
// Make sure to register your config
export const PAGE_CONFIGS = {
  yourPage: yourConfig, // Add here
};
```

**Slots not appearing:**
```javascript
// Check defaultSlots array
defaultSlots: ['header', 'content', 'footer']
```

**Editor not saving:**
```javascript
// Implement proper onSave handler
const handleSave = (config) => {
  console.log('Config:', config); // Debug first
  // Then save to your backend
};
```

### Debug Tips
1. Check browser console for errors
2. Verify config is properly exported
3. Test with simple slots first
4. Use React DevTools to inspect props

## API Reference

### UnifiedSlotEditor Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `pageName` | string | 'Cart' | Page type identifier |
| `mode` | 'edit' \| 'display' | 'edit' | Editor or display mode |
| `data` | object | {} | Page data for slots |
| `onSave` | function | () => {} | Save callback |
| `onClose` | function | () => {} | Close callback |

### Config Structure

```typescript
interface PageConfig {
  title: string;
  defaultView?: string;
  views?: Array<{id: string, label: string, icon: any}>;
  defaultSlots: string[];
  microSlotDefinitions?: Record<string, MicroSlotDef>;
  slots: Record<string, SlotConfig>;
  cmsBlocks?: string[];
}

interface SlotConfig {
  name: string;
  views?: string[];
  defaultContent?: string;
  component?: React.Component;
  microSlots?: string[];
  gridCols?: number;
  defaultSpans?: Record<string, {col: number, row: number}>;
  getData?: (data: any) => any;
}
```

## Support

For questions or issues:
1. Check the console for error messages
2. Review existing page configs for examples
3. Test with simple configurations first
4. Use browser DevTools to debug component state

Happy building! 🚀