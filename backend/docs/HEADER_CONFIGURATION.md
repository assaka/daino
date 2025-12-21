# Header Configuration System

The header configuration system allows both admin users and AI to customize the storefront header and navigation using a slot-based architecture.

## Overview

The header configuration follows the same pattern as other page configurations (cart, category, product) using:
- **Slot-based layout**: Hierarchical slots with parent-child relationships
- **View modes**: Mobile and desktop responsive configurations
- **Style configurations**: Customizable colors, fonts, and spacing
- **Component slots**: Integration with existing React components
- **CMS blocks**: Custom content injection points

## Files

### Frontend
- `src/components/editor/slot/configs/header-config.js` - Header slot definitions
- `src/components/storefront/HeaderSlotRenderer.jsx` - Renders header slots
- `src/hooks/useHeaderConfig.js` - Hook for loading header configuration
- `src/components/storefront/StorefrontLayout.jsx` - Integrated header renderer

### Backend
- Uses existing `backend/src/routes/slot-configurations.js` API
- No special backend changes needed - works with `page_name: 'header'`

## Header Slot Structure

### Main Sections

1. **header_main** - Top-level header container
   - **header_inner** - Max-width wrapper
     - **header_top_row** - Main header row
       - **logo_section** - Store logo and name
       - **search_section** - Search bar (desktop)
       - **actions_section** - User actions, cart, menu
     - **mobile_search_bar** - Collapsible mobile search
     - **mobile_menu** - Collapsible mobile navigation

2. **navigation_bar** - Desktop navigation menu
   - **navigation_inner** - Max-width wrapper
     - **navigation_content** - Navigation wrapper
       - **category_navigation** - Category menu component

### Customizable Elements

#### Logo Section
```javascript
logo_styles: {
  logoHeight: '2rem',
  logoWidth: '2rem',
  storeName: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#1F2937'
  },
  iconColor: '#2563EB'
}
```

#### Search Visibility
```javascript
search_visibility: {
  hideOnCart: false,
  hideOnCheckout: false,
  showPermanentMobile: false
}
```

#### User Menu Styling
```javascript
user_menu_styles: {
  backgroundColor: '#2563EB',
  hoverBackgroundColor: '#1D4ED8',
  textColor: '#ffffff',
  borderRadius: '0.5rem',
  padding: '0.5rem 1rem'
}
```

#### Navigation Styling
```javascript
navigation_styles: {
  backgroundColor: '#F9FAFB',
  borderColor: '#E5E7EB',
  linkColor: '#374151',
  linkHoverColor: '#2563EB',
  linkFontSize: '0.875rem',
  linkFontWeight: '500',
  padding: '0.75rem 0'
}
```

#### Navigation Visibility
```javascript
navigation_visibility: {
  hideOnMobile: false,
  expandAllMenuItems: false,
  showOnHover: true
}
```

## How to Customize Header

### Using Admin Panel

1. Navigate to **Admin > Layout Editor > Header**
2. Select a slot to customize (logo, navigation, user menu, etc.)
3. Modify styles, colors, or visibility settings
4. Click **Publish** to make changes live

### Using AI

The AI can modify header configuration by updating the slot configurations:

**Example AI prompts:**

1. "Change the header background color to dark blue"
   ```
   Update header_main.styles.backgroundColor to '#1E3A8A'
   ```

2. "Make the logo bigger"
   ```
   Update logo_styles.logoHeight to '3rem' and logoWidth to '3rem'
   ```

3. "Hide search bar on checkout page"
   ```
   Update search_visibility.hideOnCheckout to true
   ```

4. "Change user menu button color to green"
   ```
   Update user_menu_styles.backgroundColor to '#10B981'
   Update user_menu_styles.hoverBackgroundColor to '#059669'
   ```

5. "Make navigation links bold and larger"
   ```
   Update navigation_styles.linkFontSize to '1rem'
   Update navigation_styles.linkFontWeight to '700'
   ```

### Programmatically

```javascript
import slotConfigurationService from '@/services/slotConfigurationService';

// Load current header config
const config = await slotConfigurationService.getPublishedConfiguration(
  storeId,
  'header'
);

// Modify specific slot
config.configuration.slots.logo_styles.styles.logoHeight = '3rem';

// Save changes
await slotConfigurationService.createConfiguration(
  storeId,
  config.configuration,
  'header'
);

// Publish
await slotConfigurationService.publishVersion(configId);
```

## Component Registry

The following components are available in header slots:

- **StoreLogo** - Store logo and name with link
- **HeaderSearch** - Search bar component
- **MobileSearchToggle** - Toggle button for mobile search
- **MobileUserMenu** - User account button (mobile)
- **WishlistDropdown** - Wishlist icon with dropdown
- **LanguageSelector** - Language selection dropdown
- **CountrySelect** - Country/region selector
- **UserAccountMenu** - User account menu (desktop)
- **MiniCart** - Shopping cart icon with count
- **MobileMenuToggle** - Hamburger menu button
- **MobileNavigation** - Mobile category navigation
- **CategoryNav** - Desktop category navigation
- **CmsBlockRenderer** - Custom CMS content blocks

## CMS Block Positions

You can inject custom content at these positions:

- `header_top` - Above the header
- `header_middle` - Inside header container
- `header_bottom` - Below navigation
- `navigation_before` - Before navigation menu
- `navigation_after` - After navigation menu

## View Modes

### Mobile View
- Collapsed navigation in hamburger menu
- Search toggle button
- Simplified user menu
- Vertical layout

### Desktop View
- Horizontal navigation bar
- Persistent search bar
- Full user account dropdown
- Language and country selectors

## Fallback Behavior

If no published header configuration exists:
- Falls back to default `header-config.js`
- Uses hardcoded header from `StorefrontLayout.jsx` (legacy)
- No errors or broken layouts

## Best Practices

1. **Test both mobile and desktop** - Always preview changes in both view modes
2. **Use theme colors** - Reference `settings.theme.*` for consistent branding
3. **Maintain hierarchy** - Keep parent-child relationships intact
4. **Preserve components** - Don't delete essential components (cart, navigation)
5. **Version control** - Use draft/publish workflow for safe testing

## Troubleshooting

### Header not updating
1. Check if configuration is published (not just saved as draft)
2. Clear browser cache
3. Verify store_id matches
4. Check console for loading errors

### Missing components
1. Ensure component is registered in `SlotComponentRegistry`
2. Verify component import in `HeaderSlotRenderer.jsx`
3. Check component name spelling in slot configuration

### Styling not applied
1. Verify styles object structure matches expected format
2. Check for CSS specificity conflicts
3. Ensure custom styles aren't being overridden by Tailwind classes
4. Use browser DevTools to inspect applied styles

## API Endpoints

### Get Published Header Configuration
```http
GET /api/slot-configurations/public?store_id={storeId}&page_name=header
```

### Save Header Configuration (Admin)
```http
POST /api/slot-configurations
{
  "store_id": 123,
  "configuration": {
    "page_name": "Header",
    "slot_type": "header_layout",
    "slots": { ... }
  }
}
```

### Publish Header Configuration
```http
POST /api/slot-configurations/{configId}/publish
```

## Examples

### Example 1: Sticky Header with Shadow
```javascript
{
  header_main: {
    styles: {
      position: 'sticky',
      top: '0',
      zIndex: '50',
      backgroundColor: '#ffffff',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }
  }
}
```

### Example 2: Dark Mode Header
```javascript
{
  header_main: {
    styles: {
      backgroundColor: '#1F2937',
      color: '#ffffff'
    }
  },
  logo_styles: {
    storeName: {
      color: '#ffffff'
    }
  },
  navigation_styles: {
    backgroundColor: '#111827',
    linkColor: '#D1D5DB',
    linkHoverColor: '#ffffff'
  }
}
```

### Example 3: Centered Logo Layout
```javascript
{
  header_top_row: {
    className: 'flex flex-col items-center py-4',
    styles: {
      flexDirection: 'column',
      alignItems: 'center'
    }
  },
  logo_section: {
    position: { col: 1, row: 1 },
    colSpan: { mobile: 12, desktop: 12 }
  },
  search_section: {
    position: { col: 1, row: 2 },
    colSpan: { mobile: 12, desktop: 12 }
  }
}
```

## Migration from Hardcoded Header

To migrate from the old hardcoded header:

1. Create initial header configuration in admin
2. Customize as needed
3. Publish configuration
4. HeaderSlotRenderer automatically takes over
5. Old header becomes fallback only

The system automatically detects if a published header configuration exists and switches rendering methods accordingly.
