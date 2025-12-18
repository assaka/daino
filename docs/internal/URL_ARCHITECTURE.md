# URL Architecture Documentation

## Overview

This document describes the new URL architecture implemented for the DainoStore e-commerce platform. The new structure provides better SEO, cleaner separation between admin and public areas, and supports advanced features like layered navigation and UTM tracking.

## URL Structure

### Admin URLs (Store Management)
All admin/management URLs are prefixed with `/admin/`:

```
/admin/login                   - Admin login page
/admin/dashboard               - Main dashboard
/admin/products                - Product management
/admin/categories              - Category management
/admin/orders                  - Order management
/admin/customers               - Customer management
/admin/settings                - Store settings
/admin/analytics               - Analytics dashboard
/admin/attributes              - Product attributes
/admin/plugins                 - Plugin management
/admin/cms-blocks              - CMS block management
/admin/tax                     - Tax settings
/admin/coupons                 - Coupon management
/admin/cms-pages               - CMS page management
/admin/product-tabs            - Product tab configuration
/admin/product-labels          - Product label management
/admin/custom-option-rules     - Custom option rules
/admin/shipping-methods        - Shipping configuration
/admin/google-tag-manager      - GTM settings
/admin/delivery-settings       - Delivery configuration
/admin/theme-layout            - Theme customization
/admin/image-manager           - Image management
/admin/stock-settings          - Inventory settings
/admin/payment-methods         - Payment configuration
/admin/seo-tools               - SEO utilities
/admin/stores                  - Multi-store management
/admin/customer-activity       - Customer analytics
```

### Public URLs (Storefront)
All public storefront URLs are prefixed with `/public/{storeCode}/` and are SEO-friendly:

#### Core Storefront
```
/public/{storeCode}                         - Store homepage (root)
/public/{storeCode}/shop                    - Main storefront with filters
```

#### Categories (Hierarchical & SEO-friendly)
```
/public/{storeCode}/category/electronics    - Electronics category
/public/{storeCode}/category/electronics/headphones - Nested category
/public/{storeCode}/c/electronics           - Short category URL
/public/{storeCode}/c/electronics/headphones - Short nested category
```

#### Products (SEO-friendly with slugs)
```
/public/{storeCode}/product/wireless-headphones-sony-123  - Full product URL
/public/{storeCode}/p/wireless-headphones-sony-123       - Short product URL
```

#### Brands & Collections
```
/public/{storeCode}/brand/nike              - Brand page
/public/{storeCode}/brand/nike/shoes        - Brand with subcategory
/public/{storeCode}/collection/summer-2024  - Collection page
```

#### Search (SEO-friendly search URLs)
```
/public/{storeCode}/search/wireless-headphones - Search results page
```

#### Shopping & Checkout
```
/public/{storeCode}/cart                    - Shopping cart
/public/{storeCode}/checkout                - Checkout process
/public/{storeCode}/checkout/shipping       - Checkout steps
/public/{storeCode}/order-success           - Order confirmation
/public/{storeCode}/order-success/12345     - Order confirmation with number
/public/{storeCode}/thank-you               - Alternative order confirmation
/public/{storeCode}/thank-you/12345         - Alternative with order number
```

#### Customer Authentication
```
/public/{storeCode}/login                   - Customer login
/public/{storeCode}/register                - Customer registration
/public/{storeCode}/forgot-password         - Password reset
```

#### Customer Account
```
/public/{storeCode}/account                 - Customer dashboard
/public/{storeCode}/account/profile         - Account profile
/public/{storeCode}/my-account              - Alternative account URL
/public/{storeCode}/orders                  - Customer order history
/public/{storeCode}/orders/12345            - Specific order details
/public/{storeCode}/my-orders               - Alternative orders URL
```

#### Content & SEO Pages
```
/public/{storeCode}/cms-page/{slug}         - CMS content pages
/public/{storeCode}/sitemap                 - HTML sitemap
/public/{storeCode}/sitemap.xml             - XML sitemap
/public/{storeCode}/robots.txt              - Robots.txt file
/public/{storeCode}/order-cancel            - Order cancellation
/public/{storeCode}/cookie-consent          - Cookie consent page
```

### Special Routes (No Prefix)
Some routes don't require prefixes as they're system-level:

```
/landing                 - Marketing landing page
/onboarding             - System onboarding
/billing                - Billing management
```

## SEO-Friendly Features

### Product URLs
Product URLs include SEO-friendly slugs with the product ID:
```
/public/storename/product/wireless-headphones-sony-wh1000xm4-123
/public/storename/p/gaming-mouse-logitech-456                    (short URL)
```

### Category URLs with Layered Navigation
Category URLs support hierarchical navigation and filters:
```
/public/storename/category/electronics/headphones?brand=sony,apple&price=100-500&color=black&sort=price-asc&page=2
/public/storename/c/home-garden/outdoor?brand=weber&price=200-800 (short URL)
```

### Brand & Collection Pages
Brand and collection pages with filters:
```
/public/storename/brand/nike?category=shoes&size=10,11&color=black
/public/storename/collection/summer-2024?price=50-200&sort=newest
```

### Search Results
SEO-friendly search URLs:
```
/public/storename/search/wireless-headphones?brand=sony&price=100-300
/public/storename/search/home-garden-tools?sort=rating&page=2
```

### Filter Parameters
- **brand**: `brand=sony,apple` (multiple values separated by comma)
- **price**: `price=100-500` (range values separated by dash)
- **color**: `color=black` (single value)
- **rating**: `rating=4-5` (rating range)
- **availability**: `stock=in-stock` (availability filter)
- **sort**: `sort=price-asc` (sorting option)
- **page**: `page=2` (pagination)

## UTM and Tracking Parameters

The system preserves all tracking parameters across navigation:

### Supported Tracking Parameters
- `utm_source` - Traffic source
- `utm_medium` - Marketing medium
- `utm_campaign` - Campaign name
- `utm_term` - Keywords
- `utm_content` - Content variation
- `gclid` - Google Ads click ID
- `fbclid` - Facebook click ID
- `ref` - Referrer parameter
- `referrer` - Custom referrer
- `affiliate_id` - Affiliate tracking

### Example with Tracking
```
/public/storename/shop?utm_source=google&utm_medium=cpc&utm_campaign=summer2024&gclid=abc123
```

## Clean URL Architecture

This system uses a clean, modern URL architecture exclusively. No legacy URL support is provided - all URLs follow the new SEO-friendly structure with `/public` and `/admin` prefixes.

## Implementation Files

### Core Utilities
- `src/utils/urlUtils.js` - Main URL utility functions
- `src/hooks/useUrlUtils.js` - React hooks for URL management

### Updated Components
- `src/pages/index.jsx` - Updated routing configuration
- `src/components/AuthMiddleware.jsx` - Updated authentication flows
- `src/components/RoleProtectedRoute.jsx` - Updated route protection
- `src/api/client.js` - Updated token context detection
- `src/utils/auth.js` - Updated logout and navigation logic

## Usage Examples

### Creating URLs in Components
```javascript
import { 
  createAdminUrl, 
  createPublicUrl, 
  createProductUrl, 
  createCategoryUrl,
  createBrandUrl,
  createCollectionUrl,
  createSearchUrl
} from '@/utils/urlUtils';

// Admin URLs
const dashboardUrl = createAdminUrl('DASHBOARD');
const productsUrl = createAdminUrl('PRODUCTS');

// Basic public URLs
const storefrontUrl = createPublicUrl('storename', 'STOREFRONT');
const cartUrl = createPublicUrl('storename', 'CART');

// SEO-friendly product URLs
const productUrl = createProductUrl('storename', 'wireless-headphones-sony', 123);
const shortProductUrl = createProductUrl('storename', 'gaming-mouse', 456, {}, true);

// Category URLs with filters and short URLs
const categoryUrl = createCategoryUrl('storename', 'electronics/headphones', {
  brand: ['sony', 'apple'],
  price: { min: 100, max: 500 },
  color: 'black'
});
const shortCategoryUrl = createCategoryUrl('storename', 'home-garden', {}, {}, true);

// Brand pages with filters
const brandUrl = createBrandUrl('storename', 'nike', {
  category: 'shoes',
  size: ['10', '11'],
  color: 'black'
});

// Collection pages
const collectionUrl = createCollectionUrl('storename', 'summer-2024', {
  price: { min: 50, max: 200 }
});

// Search URLs
const searchUrl = createSearchUrl('storename', 'wireless headphones', {
  brand: 'sony',
  price: { min: 100, max: 300 }
});
```

### Using React Hooks
```javascript
import { useUrlContext, useFilters, useBreadcrumbs } from '@/hooks/useUrlUtils';

function ProductListPage() {
  const { 
    storeSlug, 
    pageType, 
    categoryData, 
    brandData, 
    collectionData, 
    searchData 
  } = useUrlContext();
  const { filters, updateFilter, clearAllFilters } = useFilters();
  const breadcrumbs = useBreadcrumbs();
  
  // Update brand filter
  const handleBrandChange = (brands) => {
    updateFilter('brand', brands);
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    clearAllFilters();
  };
  
  // Get page title based on context
  const getPageTitle = () => {
    switch (pageType) {
      case 'category':
        return `Category: ${categoryData.categoryPath.join(' > ')}`;
      case 'brand':
        return `Brand: ${brandData.brandSlug}`;
      case 'collection':
        return `Collection: ${collectionData.collectionSlug}`;
      case 'search':
        return `Search: "${searchData.searchQuery}"`;
      case 'product':
        return 'Product Details';
      default:
        return 'Store';
    }
  };
  
  return (
    <div>
      {/* Page title */}
      <h1>{getPageTitle()}</h1>
      
      {/* Breadcrumbs */}
      <nav>
        {breadcrumbs.map(crumb => (
          <a key={crumb.url} href={crumb.url}>{crumb.label}</a>
        ))}
      </nav>
      
      {/* Filter UI */}
      <aside>
        <button onClick={handleClearFilters}>Clear Filters</button>
        {/* Filter components */}
      </aside>
      
      {/* Product list */}
      <main>
        {/* Products filtered by current filters */}
      </main>
    </div>
  );
}
```

### URL Creation
Use the utility functions to create URLs in the new structure:

```javascript
import { createAdminUrl, createPublicUrl } from '@/utils/urlUtils';

const dashboardUrl = createAdminUrl('DASHBOARD'); // Returns '/admin/dashboard'
const storefrontUrl = createPublicUrl('storename', 'STOREFRONT'); // Returns '/public/storename/shop'
```

## SEO Benefits

1. **Clear URL Structure**: Admin and public areas are clearly separated
2. **Descriptive URLs**: Product and category URLs include meaningful slugs
3. **Canonical URLs**: Automatic canonical URL generation for filtered pages
4. **Breadcrumb Support**: Automatic breadcrumb generation from URL structure
5. **UTM Preservation**: Marketing parameters are preserved across navigation
6. **Clean Architecture**: Direct implementation of new URL structure without legacy overhead

## Performance Considerations

- URL parsing is memoized in React hooks to prevent unnecessary re-renders
- Filter state is managed through URL parameters to maintain browser history
- Tracking parameters are preserved to maintain attribution accuracy
- Clean URL structure with no legacy redirects provides optimal performance
- Direct routing implementation eliminates unnecessary complexity

## Browser Compatibility

The new URL architecture uses modern JavaScript features but includes fallbacks:
- URL constructor with polyfill support
- URLSearchParams with fallback for older browsers
- React Router v6 compatible routing structure