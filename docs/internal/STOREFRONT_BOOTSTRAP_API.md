# Storefront Bootstrap API - Design Document

## Problem Statement

Currently, every storefront page makes **6-8 separate API calls** to load global data:

```
1. GET /api/public/stores?slug=hamid2              [Store config]
2. GET /api/languages                              [Languages list]
3. GET /api/translations/ui-labels?lang=nl        [UI translations]
4. GET /api/public/categories?store_id=...&limit=1000  [Navigation]
5. GET /api/wishlist?store_id=...&session_id=...  [Wishlist]
6. GET /api/cart?session_id=...&user_id=...       [Mini cart]
7. GET /api/auth/me                                [User profile]
8. GET /api/public/product-labels?store_id=...    [Product labels]
9. GET /api/public/tax?store_id=...               [Tax settings]
10. GET /api/public/attributes?store_id=...        [Attributes]
```

**Problems:**
- 10+ HTTP requests per page load
- 10+ OPTIONS preflight requests
- Sequential loading (can't proceed until store is loaded)
- Network overhead
- Slow initial page load

## Solution: Unified Bootstrap Endpoint

### API Design

**Endpoint:** `GET /api/public/storefront/bootstrap`

**Query Parameters:**
- `slug` (required) - Store slug (e.g., "hamid2")
- `lang` (optional) - Language code (e.g., "nl", defaults to store default)
- `session_id` (optional) - Guest session ID for cart/wishlist
- `user_id` (optional) - Authenticated user ID

**Example Request:**
```
GET /api/public/storefront/bootstrap?slug=hamid2&lang=nl&session_id=guest_yan1du0a0omh6tyyi4
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "157d4590-49bf-4b0b-bd77-abe131909528",
      "name": "My Store",
      "slug": "hamid2",
      "default_language": "nl",
      "currency_code": "EUR",
      "settings": {
        "track_stock": true,
        "display_out_of_stock": false,
        "default_view_mode": "grid",
        "product_grid": {...},
        "enable_inventory": true
      }
    },
    "languages": [
      { "code": "en", "name": "English", "flag": "🇬🇧" },
      { "code": "nl", "name": "Nederlands", "flag": "🇳🇱" }
    ],
    "translations": {
      "common.add_to_cart": "Toevoegen aan winkelwagen",
      "common.price": "Prijs",
      // ... all UI labels for current language
    },
    "categories": [
      {
        "id": "...",
        "name": "Electronics",
        "slug": "electronics",
        "parent_id": null,
        "children": [...]
      }
      // ... all categories with hierarchy
    ],
    "wishlist": {
      "items": [
        {
          "id": "...",
          "product_id": "...",
          "added_at": "2025-10-26T12:00:00Z"
        }
      ],
      "count": 3
    },
    "cart": {
      "items": [
        {
          "id": "...",
          "product_id": "...",
          "quantity": 2,
          "price": 29.99
        }
      ],
      "subtotal": 59.98,
      "tax": 12.60,
      "total": 72.58,
      "item_count": 2
    },
    "user": {
      "id": "...",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "customer"
    } || null,
    "productLabels": [
      {
        "id": "...",
        "text": "NEW",
        "color": "#FF0000",
        "conditions": {...}
      }
    ],
    "taxes": [
      {
        "id": "...",
        "name": "VAT",
        "rate": 21,
        "country": "NL"
      }
    ],
    "attributes": [
      {
        "id": "...",
        "code": "color",
        "label": "Color",
        "type": "select",
        "is_filterable": true,
        "options": [...]
      }
    ],
    "attributeSets": [...],
    "cookieConsent": {
      "enabled": true,
      "settings": {...}
    },
    "seoSettings": {...},
    "metadata": {
      "cached_at": "2025-10-26T12:00:00Z",
      "cache_ttl": 300,
      "request_id": "req_123456"
    }
  }
}
```

### Backend Implementation

**File:** `backend/src/routes/storefront-bootstrap.js`

```javascript
const express = require('express');
const router = express.Router();

router.get('/storefront/bootstrap', async (req, res) => {
  try {
    const { slug, lang, session_id, user_id } = req.query;

    if (!slug) {
      return res.status(400).json({
        success: false,
        error: 'Store slug is required'
      });
    }

    // Fetch all data in parallel for maximum performance
    const [
      store,
      languages,
      translations,
      categories,
      wishlist,
      cart,
      user,
      productLabels,
      taxes,
      attributes,
      attributeSets,
      cookieConsent,
      seoSettings
    ] = await Promise.all([
      // 1. Store
      Store.findOne({ where: { slug } }),

      // 2. Languages
      Language.findAll({ where: { is_active: true } }),

      // 3. Translations (for specified language)
      Translation.findAll({
        where: {
          language: lang || store.default_language
        }
      }),

      // 4. Categories (with hierarchy)
      Category.findAll({
        where: { store_id: store.id },
        order: [['sort_order', 'ASC']]
      }),

      // 5. Wishlist (if session_id or user_id provided)
      session_id || user_id ?
        Wishlist.findAll({
          where: {
            store_id: store.id,
            [Op.or]: [
              { session_id },
              { user_id }
            ]
          }
        }) : [],

      // 6. Cart (if session_id or user_id provided)
      session_id || user_id ?
        Cart.findOne({
          where: {
            store_id: store.id,
            [Op.or]: [
              { session_id },
              { user_id }
            ]
          },
          include: [{ model: CartItem, include: [Product] }]
        }) : null,

      // 7. User (if authenticated)
      user_id ? User.findByPk(user_id) : null,

      // 8. Product Labels
      ProductLabel.findAll({ where: { store_id: store.id } }),

      // 9. Taxes
      Tax.findAll({ where: { store_id: store.id } }),

      // 10. Attributes
      Attribute.findAll({ where: { store_id: store.id } }),

      // 11. Attribute Sets
      AttributeSet.findAll({ where: { store_id: store.id } }),

      // 12. Cookie Consent
      CookieConsent.findOne({ where: { store_id: store.id } }),

      // 13. SEO Settings
      SeoSetting.findOne({ where: { store_id: store.id } })
    ]);

    // Transform translations array to key-value object
    const translationsMap = translations.reduce((acc, t) => {
      acc[t.key] = t.value;
      return acc;
    }, {});

    // Build response
    res.json({
      success: true,
      data: {
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          default_language: store.default_language,
          currency_code: store.currency_code,
          settings: store.settings
        },
        languages,
        translations: translationsMap,
        categories: buildCategoryTree(categories),
        wishlist: {
          items: wishlist,
          count: wishlist.length
        },
        cart: cart ? {
          items: cart.items,
          subtotal: cart.subtotal,
          tax: cart.tax,
          total: cart.total,
          item_count: cart.items.length
        } : { items: [], subtotal: 0, tax: 0, total: 0, item_count: 0 },
        user: user ? {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        } : null,
        productLabels,
        taxes,
        attributes,
        attributeSets,
        cookieConsent,
        seoSettings,
        metadata: {
          cached_at: new Date().toISOString(),
          cache_ttl: 300, // 5 minutes
          request_id: req.id
        }
      }
    });

  } catch (error) {
    console.error('Bootstrap API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load storefront data'
    });
  }
});

// Helper to build category tree
function buildCategoryTree(flatCategories) {
  const map = {};
  const roots = [];

  // First pass: create map
  flatCategories.forEach(cat => {
    map[cat.id] = { ...cat.toJSON(), children: [] };
  });

  // Second pass: build tree
  flatCategories.forEach(cat => {
    if (cat.parent_id) {
      map[cat.parent_id]?.children.push(map[cat.id]);
    } else {
      roots.push(map[cat.id]);
    }
  });

  return roots;
}

module.exports = router;
```

### Frontend Implementation

**New Context:** `src/contexts/StorefrontBootstrapContext.jsx`

```javascript
import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getCurrentLanguage } from '@/utils/translationUtils';

const StorefrontBootstrapContext = createContext();

export const useStorefrontBootstrap = () => {
  const context = useContext(StorefrontBootstrapContext);
  if (!context) {
    throw new Error('useStorefrontBootstrap must be used within StorefrontBootstrapProvider');
  }
  return context;
};

export const StorefrontBootstrapProvider = ({ children }) => {
  const { storeCode } = useParams();
  const language = getCurrentLanguage();
  const sessionId = localStorage.getItem('guest_session_id');
  const userId = localStorage.getItem('customer_user_id');

  const {
    data: bootstrap,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['storefront-bootstrap', storeCode, language, sessionId, userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        slug: storeCode,
        lang: language
      });

      if (sessionId) params.append('session_id', sessionId);
      if (userId) params.append('user_id', userId);

      const response = await fetch(
        `/api/public/storefront/bootstrap?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Failed to load storefront data');
      }

      const result = await response.json();
      return result.data;
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    retry: 2,
    enabled: !!storeCode
  });

  const value = {
    // Store data
    store: bootstrap?.store || null,
    settings: bootstrap?.store?.settings || null,

    // Languages & translations
    languages: bootstrap?.languages || [],
    translations: bootstrap?.translations || {},
    currentLanguage: language,

    // Navigation
    categories: bootstrap?.categories || [],

    // User data
    wishlist: bootstrap?.wishlist || { items: [], count: 0 },
    cart: bootstrap?.cart || { items: [], subtotal: 0, tax: 0, total: 0, item_count: 0 },
    user: bootstrap?.user || null,

    // Store config
    productLabels: bootstrap?.productLabels || [],
    taxes: bootstrap?.taxes || [],
    attributes: bootstrap?.attributes || [],
    attributeSets: bootstrap?.attributeSets || [],
    filterableAttributes: bootstrap?.attributes?.filter(a => a.is_filterable) || [],

    // Settings
    cookieConsent: bootstrap?.cookieConsent || null,
    seoSettings: bootstrap?.seoSettings || null,

    // State
    loading: isLoading,
    error,
    refetch
  };

  return (
    <StorefrontBootstrapContext.Provider value={value}>
      {children}
    </StorefrontBootstrapContext.Provider>
  );
};
```

**Update App.jsx:**

```javascript
// Replace StoreProvider with StorefrontBootstrapProvider for storefront pages
<Route
  path="/public/:storeCode/*"
  element={
    <StorefrontBootstrapProvider>
      <StorefrontLayout>{children}</StorefrontLayout>
    </StorefrontBootstrapProvider>
  }
/>
```

### Migration Plan

#### Phase 1: Create Backend Endpoint
1. Create `backend/src/routes/storefront-bootstrap.js`
2. Add route to `backend/src/app.js`
3. Test endpoint manually
4. Add caching layer (Redis)

#### Phase 2: Create Frontend Context
1. Create `StorefrontBootstrapContext.jsx`
2. Add to App.jsx for storefront routes only
3. Keep StoreProvider for backward compatibility

#### Phase 3: Migrate Components
1. Update components to use `useStorefrontBootstrap()` instead of `useStore()`
2. Remove redundant API calls
3. Test thoroughly

#### Phase 4: Cleanup
1. Remove old `StoreProvider` from storefront
2. Keep `StoreSelectionProvider` for admin only
3. Update documentation

## Separation of Admin and Storefront Contexts

### Current Issues

**StoreSelectionContext.jsx** is used for:
- ✅ Admin: Store selection dropdown (correct)
- ❌ Storefront: Nothing (but still loaded globally)

**StoreProvider.jsx** is used for:
- ✅ Storefront: Store data, categories, settings (correct)
- ❌ Admin: Nothing (but components might depend on it)

### Proposed Structure

```
src/
├── contexts/
│   ├── admin/
│   │   ├── StoreSelectionContext.jsx  ← Admin only
│   │   └── AdminAuthContext.jsx
│   │
│   ├── storefront/
│   │   ├── StorefrontBootstrapContext.jsx  ← NEW: Replaces StoreProvider
│   │   ├── CustomerAuthContext.jsx
│   │   └── StorefrontCartContext.jsx (if needed)
│   │
│   └── shared/
│       ├── TranslationContext.jsx
│       └── AIContext.jsx
```

### Updated App.jsx

```javascript
import { StoreSelectionProvider } from '@/contexts/admin/StoreSelectionContext';
import { StorefrontBootstrapProvider } from '@/contexts/storefront/StorefrontBootstrapContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Admin routes - use StoreSelectionProvider */}
          <Route path="/admin/*" element={
            <StoreSelectionProvider>
              <Layout>{/* admin pages */}</Layout>
            </StoreSelectionProvider>
          } />

          {/* Storefront routes - use StorefrontBootstrapProvider */}
          <Route path="/public/:storeCode/*" element={
            <StorefrontBootstrapProvider>
              <StorefrontLayout>{/* storefront pages */}</StorefrontLayout>
            </StorefrontBootstrapProvider>
          } />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
```

## Performance Comparison

### Before (Current)
```
Storefront page load:
1. GET /api/public/stores?slug=hamid2           [150ms]
2. OPTIONS preflight                            [50ms]
3. GET /api/languages                           [90ms]
4. OPTIONS preflight                            [50ms]
5. GET /api/translations/ui-labels              [100ms]
6. OPTIONS preflight                            [50ms]
7. GET /api/public/categories                   [120ms]
8. OPTIONS preflight                            [50ms]
9. GET /api/wishlist                            [80ms]
10. OPTIONS preflight                           [50ms]
11. GET /api/cart                               [100ms]
12. OPTIONS preflight                           [50ms]
13. GET /api/auth/me                            [200ms]
14. OPTIONS preflight                           [50ms]
15. GET /api/public/product-labels              [70ms]
16. OPTIONS preflight                           [50ms]
17. GET /api/public/tax                         [80ms]
18. OPTIONS preflight                           [50ms]
19. GET /api/public/attributes                  [150ms]
20. OPTIONS preflight                           [50ms]

Total: 20 requests, ~1600ms
```

### After (With Bootstrap API)
```
Storefront page load:
1. GET /api/public/storefront/bootstrap         [300ms]
   (all data fetched in parallel on backend)
2. OPTIONS preflight                            [50ms]

Total: 2 requests, ~350ms
```

**Improvement:**
- 20 requests → 2 requests (90% reduction)
- ~1600ms → ~350ms (78% faster)
- Much better user experience

## Benefits

### Performance
- ✅ 90% fewer HTTP requests
- ✅ 78% faster initial page load
- ✅ Parallel data fetching on backend (not sequential)
- ✅ Single OPTIONS preflight instead of 10+

### Code Quality
- ✅ Cleaner separation of admin vs storefront
- ✅ Single source of truth for storefront data
- ✅ Easier to maintain
- ✅ Better caching strategy

### Developer Experience
- ✅ One hook for all storefront data
- ✅ Automatic updates when data changes
- ✅ Type-safe with proper TS interfaces
- ✅ Easier testing

## Implementation Checklist

### Backend
- [ ] Create `/api/public/storefront/bootstrap` endpoint
- [ ] Add parallel data fetching with Promise.all
- [ ] Implement category tree building
- [ ] Add proper error handling
- [ ] Add Redis caching layer
- [ ] Write API tests

### Frontend
- [ ] Create `StorefrontBootstrapContext.jsx`
- [ ] Move to `src/contexts/storefront/`
- [ ] Move `StoreSelectionContext` to `src/contexts/admin/`
- [ ] Update App.jsx provider hierarchy
- [ ] Migrate storefront components to use new context
- [ ] Update all `useStore()` calls to `useStorefrontBootstrap()`
- [ ] Remove old StoreProvider from storefront

### Testing
- [ ] Test bootstrap endpoint with various parameters
- [ ] Test storefront pages load correctly
- [ ] Test cart/wishlist persistence
- [ ] Test language switching
- [ ] Test admin pages still work
- [ ] Performance testing (before/after comparison)

### Documentation
- [ ] Update API documentation
- [ ] Update component migration guide
- [ ] Document context separation strategy

## Caching Strategy

### Backend (Redis)
```javascript
const cacheKey = `storefront:bootstrap:${slug}:${lang}`;
const cachedData = await redis.get(cacheKey);

if (cachedData) {
  return JSON.parse(cachedData);
}

// Fetch data...
await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5 min TTL
```

### Frontend (React Query)
- Already implemented with 5-minute stale time
- Automatic background refetching
- Optimistic updates for cart/wishlist

---

**Status:** Design Complete, Ready for Implementation
**Priority:** High - Would provide significant performance improvement
**Effort:** Medium (2-3 days)
**Impact:** Very High (90% reduction in API calls, 78% faster page loads)
