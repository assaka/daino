# StoreProvider Refactoring Plan

**Current State:** 934 lines, single file, does everything
**Target State:** Multiple focused files, clear separation of concerns

---

## Current Structure Analysis

### File Breakdown (934 lines)

```
StoreProvider.jsx (934 lines)
├── Imports & Setup (44 lines)
├── Caching System (92 lines)
│   ├── Cache configuration (CACHE_DURATION_*)
│   ├── localStorage load/save
│   ├── Cache version management
│   └── cachedApiCall function
├── Helper Functions (32 lines)
│   ├── cleanCheckoutLayout
│   └── getCurrencySymbol
├── State Management (20 lines)
│   └── 10+ useState declarations
├── Event Listeners (95 lines)
│   ├── Store selection changes
│   ├── Language changes
│   ├── Cache clear broadcasts
│   └── Translation updates
├── fetchStoreData (541 lines!) ← THE PROBLEM
│   ├── Force refresh logic (20)
│   ├── Store identifier resolution (50)
│   ├── Store fetching (30)
│   ├── Settings merging (200!) ← BIGGEST ISSUE
│   ├── Language initialization (30)
│   ├── Country selection (20)
│   ├── Cookie consent loading (100)
│   ├── UI translations loading (50)
│   └── Parallel data loading (80)
├── Provider Component (30 lines)
└── Cache Utilities (30 lines)
```

---

## Problems Identified

### 1. **Massive Settings Merging (200+ lines)**
Lines 393-586: Merges default settings with store settings

```javascript
const mergedSettings = {
  // Stock settings
  enable_inventory: selectedStore.settings?.enable_inventory !== undefined
    ? selectedStore.settings.enable_inventory
    : true,
  display_out_of_stock: selectedStore.settings?.display_out_of_stock !== undefined
    ? selectedStore.settings.display_out_of_stock
    : true,
  // ... 50+ more settings with same pattern!

  // Theme defaults (another 30+ properties)
  theme: {
    primary_button_color: '#007bff',
    // ... 30+ theme properties
  },

  // Product grid (nested object with breakpoints)
  product_grid: {
    breakpoints: { /* ... */ },
    // ...
  },

  // Checkout settings (another 50+ lines)
  checkout_steps_count: selectedStore.settings?.checkout_steps_count ?? 3,
  // ... more checkout settings
};
```

**Problem:** This should be extracted to a separate utility!

### 2. **cachedApiCall is Overused**
Used for data that should come from bootstrap:
- ❌ `categories` (line 769) - Should be in bootstrap
- ❌ `translations` (line 732) - Should be in bootstrap
- ❌ `seo-templates` (line 809) - Should be in bootstrap
- ✅ `taxes` (line 762) - Correct (not in bootstrap)
- ✅ `attributes` (line 788) - Correct (not in bootstrap)

### 3. **Multiple Responsibilities**
StoreProvider does:
- ✅ Provide store context (correct)
- ❌ Implement caching system (should be separate)
- ❌ Handle API calls (should use hooks)
- ❌ Listen to events (should be separate)
- ❌ Merge complex settings (should be utility)

---

## Proposed Refactoring

### Step 1: Extract Utilities

#### File: `src/utils/storeSettingsDefaults.js`
```javascript
/**
 * Merges store settings with defaults
 * @param {Object} storeSettings - Settings from database
 * @returns {Object} Merged settings with defaults
 */
export function mergeStoreSettings(storeSettings = {}) {
  return {
    // Stock settings
    ...getStockDefaults(storeSettings),

    // Theme settings
    theme: getThemeDefaults(storeSettings.theme),

    // Checkout settings
    ...getCheckoutDefaults(storeSettings),

    // Product grid
    product_grid: getProductGridDefaults(storeSettings.product_grid),

    // Currency
    currency_code: storeSettings.currency_code || 'USD',
    currency_symbol: getCurrencySymbol(storeSettings.currency_code || 'USD'),

    // Other settings
    ...storeSettings
  };
}

function getStockDefaults(settings) {
  return {
    enable_inventory: settings?.enable_inventory ?? true,
    display_out_of_stock: settings?.display_out_of_stock ?? true,
    hide_stock_quantity: settings?.hide_stock_quantity ?? false,
    display_low_stock_threshold: settings?.display_low_stock_threshold ?? 0,
    show_stock_label: settings?.stock_settings?.show_stock_label ?? true,
  };
}

function getThemeDefaults(themeSettings = {}) {
  return {
    primary_button_color: '#007bff',
    secondary_button_color: '#6c757d',
    add_to_cart_button_color: '#28a745',
    // ... all theme defaults
    ...themeSettings
  };
}

function getCheckoutDefaults(settings) {
  return {
    checkout_steps_count: settings?.checkout_steps_count ?? 3,
    checkout_2step_step1_name: settings?.checkout_2step_step1_name || 'Information',
    // ... all checkout defaults
  };
}

function getProductGridDefaults(gridSettings = {}) {
  return {
    breakpoints: {
      default: gridSettings?.breakpoints?.default ?? 1,
      sm: gridSettings?.breakpoints?.sm ?? 2,
      // ... all breakpoints
    },
    rows: gridSettings?.rows ?? 4
  };
}

export function getCurrencySymbol(currencyCode) {
  const currencyMap = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    // ... full map
  };
  return currencyMap[currencyCode] || 'Currency not found';
}
```

**Impact:** Reduces StoreProvider by ~200 lines

---

#### File: `src/utils/cacheUtils.js`
```javascript
/**
 * Centralized caching utilities
 */
const CACHE_DURATION_LONG = 3600000; // 1 hour
const CACHE_DURATION_MEDIUM = 300000; // 5 minutes
const CACHE_DURATION_SHORT = 60000; // 1 minute
const CACHE_VERSION = '2.2';

const apiCache = new Map();

export function loadCacheFromStorage() {
  try {
    const stored = localStorage.getItem('storeProviderCache');
    const storedVersion = localStorage.getItem('storeProviderCacheVersion');

    if (storedVersion !== CACHE_VERSION) {
      localStorage.removeItem('storeProviderCache');
      localStorage.setItem('storeProviderCacheVersion', CACHE_VERSION);
      return;
    }

    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([key, value]) => {
        apiCache.set(key, value);
      });
    }
  } catch (e) {
    console.warn('Failed to load cache from storage');
  }
}

export function saveCacheToStorage() {
  try {
    const cacheObj = {};
    apiCache.forEach((value, key) => {
      cacheObj[key] = value;
    });
    localStorage.setItem('storeProviderCache', JSON.stringify(cacheObj));
  } catch (e) {
    console.warn('Failed to save cache to storage');
  }
}

export async function cachedApiCall(key, apiCall, ttl = CACHE_DURATION_LONG) {
  const now = Date.now();

  if (apiCache.has(key)) {
    const { data, timestamp } = apiCache.get(key);
    if (now - timestamp < ttl) {
      return Promise.resolve(data);
    }

    // Return stale data, refresh in background
    setTimeout(async () => {
      try {
        const freshData = await apiCall();
        apiCache.set(key, { data: freshData, timestamp: now });
        saveCacheToStorage();
      } catch (error) {
        console.warn(`Background refresh failed for ${key}:`, error);
      }
    }, 100);

    return data;
  }

  // No cache, fetch fresh
  const result = await apiCall();
  apiCache.set(key, { data: result, timestamp: now });
  saveCacheToStorage();
  return result;
}

export function clearCache() {
  apiCache.clear();
  localStorage.removeItem('storeProviderCache');
}

export function clearCacheKeys(keys) {
  if (Array.isArray(keys)) {
    keys.forEach(key => apiCache.delete(key));
  }
  localStorage.removeItem('storeProviderCache');
}

export { CACHE_DURATION_LONG, CACHE_DURATION_MEDIUM, CACHE_DURATION_SHORT };
```

**Impact:** Reduces StoreProvider by ~150 lines

---

#### File: `src/hooks/useStoreBootstrap.js`
```javascript
import { useQuery } from '@tanstack/react-query';
import { storefrontApiClient } from '@/api/storefront-entities';

/**
 * Hook to fetch bootstrap data (Layer 1 - Global data)
 * This should be the PRIMARY data source for StoreProvider
 */
export function useStoreBootstrap(storeSlug, language) {
  return useQuery({
    queryKey: ['bootstrap', storeSlug, language],
    queryFn: async () => {
      const response = await storefrontApiClient.get('/api/public/storefront/bootstrap', {
        params: {
          slug: storeSlug,
          lang: language,
          session_id: localStorage.getItem('guestSessionId')
        }
      });

      if (!response.data.success) {
        throw new Error('Bootstrap failed');
      }

      return response.data.data;
    },
    staleTime: 900000, // 15 minutes - global data rarely changes
    gcTime: 1800000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
```

**Impact:** Provides clean bootstrap integration

---

#### File: `src/hooks/useStoreData.js`
```javascript
import { cachedApiCall, CACHE_DURATION_SHORT, CACHE_DURATION_MEDIUM } from '@/utils/cacheUtils';
import {
  StorefrontTax,
  StorefrontProductLabel,
  StorefrontAttribute,
  StorefrontAttributeSet
} from '@/api/storefront-entities';

/**
 * Hook to fetch additional store data NOT in bootstrap
 * (Layer 3 data - dynamic/frequently changing)
 */
export async function fetchAdditionalStoreData(storeId, language) {
  const dataPromises = [
    // Taxes - frequently updated
    cachedApiCall(`taxes-${storeId}`, async () => {
      const result = await StorefrontTax.filter({ store_id: storeId });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_SHORT),

    // Product labels - frequently updated
    cachedApiCall(`labels-${storeId}-${language}`, async () => {
      const result = await StorefrontProductLabel.filter({ store_id: storeId });
      return Array.isArray(result) ? result.filter(l => l.is_active !== false) : [];
    }, CACHE_DURATION_SHORT),

    // Attributes - semi-static
    cachedApiCall(`attributes-${storeId}`, async () => {
      const result = await StorefrontAttribute.filter({ store_id: storeId });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_MEDIUM),

    // Filterable attributes - semi-static
    cachedApiCall(`filterable-attributes-${storeId}`, async () => {
      const result = await StorefrontAttribute.filter({
        store_id: storeId,
        is_filterable: true
      });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_MEDIUM),

    // Attribute sets - semi-static
    cachedApiCall(`attr-sets-${storeId}`, async () => {
      const result = await StorefrontAttributeSet.filter({ store_id: storeId });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_MEDIUM),
  ];

  const results = await Promise.allSettled(dataPromises);

  return {
    taxes: results[0].status === 'fulfilled' ? results[0].value : [],
    productLabels: results[1].status === 'fulfilled' ? results[1].value : [],
    attributes: results[2].status === 'fulfilled' ? results[2].value : [],
    filterableAttributes: results[3].status === 'fulfilled' ? results[3].value : [],
    attributeSets: results[4].status === 'fulfilled' ? results[4].value : [],
  };
}
```

**Impact:** Cleaner data fetching separation

---

### Step 2: Refactored StoreProvider

#### File: `src/components/storefront/StoreProvider.jsx` (NEW - ~200 lines)
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { useStoreBootstrap } from '@/hooks/useStoreBootstrap';
import { fetchAdditionalStoreData } from '@/hooks/useStoreData';
import { mergeStoreSettings, getCurrencySymbol } from '@/utils/storeSettingsDefaults';
import { storefrontApiClient } from '@/api/storefront-entities';

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

export const StoreProvider = ({ children }) => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState(null);

  // Determine store slug from URL or localStorage
  const storeSlug = determineStoreSlug(location);
  const language = localStorage.getItem('daino_language') || 'en';

  // LAYER 1: Bootstrap data (global, cached 15min)
  const { data: bootstrap, isLoading: bootstrapLoading } = useStoreBootstrap(storeSlug, language);

  useEffect(() => {
    if (bootstrapLoading || !bootstrap) return;

    const loadData = async () => {
      try {
        const store = bootstrap.store;

        // Merge settings with defaults
        const mergedSettings = mergeStoreSettings(store.settings);

        // Set API client context
        storefrontApiClient.setStoreContext(store.slug);

        // LAYER 3: Fetch additional data NOT in bootstrap
        const additionalData = await fetchAdditionalStoreData(store.id, language);

        setStoreData({
          // Layer 1 - From bootstrap
          store: { ...store, settings: mergedSettings },
          languages: bootstrap.languages,
          translations: bootstrap.translations,
          categories: bootstrap.categories,
          seoSettings: bootstrap.seoSettings,
          seoTemplates: bootstrap.seoTemplates,
          wishlist: bootstrap.wishlist,
          user: bootstrap.user,

          // Layer 3 - Additional data
          ...additionalData
        });

        setLoading(false);
      } catch (error) {
        console.error('Failed to load store data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [bootstrap, bootstrapLoading, language]);

  // Event listeners (extracted to custom hook)
  useStoreEventListeners(() => {
    // Refetch when store/language changes
    setLoading(true);
  });

  const value = {
    store: storeData?.store,
    settings: storeData?.store?.settings || {},
    loading,

    // Layer 1 - Global data
    languages: storeData?.languages || [],
    categories: storeData?.categories || [],
    translations: storeData?.translations || {},
    seoSettings: storeData?.seoSettings || {},
    seoTemplates: storeData?.seoTemplates || [],
    wishlist: storeData?.wishlist || [],
    user: storeData?.user,

    // Layer 3 - Additional data
    taxes: storeData?.taxes || [],
    productLabels: storeData?.productLabels || [],
    attributes: storeData?.attributes || [],
    filterableAttributes: storeData?.filterableAttributes || [],
    attributeSets: storeData?.attributeSets || [],
  };

  return (
    <StoreContext.Provider value={value}>
      <TranslationProvider storeId={storeData?.store?.id}>
        {children}
      </TranslationProvider>
    </StoreContext.Provider>
  );
};

// Helper function to determine store slug
function determineStoreSlug(location) {
  const hostname = window.location.hostname;
  const publicUrlMatch = location.pathname.match(/^\/public\/([^\/]+)/);

  if (publicUrlMatch) {
    return publicUrlMatch[1];
  }

  const isCustomDomain = !hostname.includes('vercel.app') &&
                        !hostname.includes('onrender.com') &&
                        !hostname.includes('localhost');

  if (isCustomDomain) {
    return hostname;
  }

  return localStorage.getItem('selectedStoreSlug') || 'default';
}
```

**Impact:** 934 lines → ~200 lines (78% reduction!)

---

## Summary of Changes

### Files Created:
1. ✅ `src/utils/storeSettingsDefaults.js` (~150 lines) - Settings merging
2. ✅ `src/utils/cacheUtils.js` (~100 lines) - Caching system
3. ✅ `src/hooks/useStoreBootstrap.js` (~30 lines) - Bootstrap hook
4. ✅ `src/hooks/useStoreData.js` (~80 lines) - Additional data fetching
5. ✅ `src/hooks/useStoreEventListeners.js` (~50 lines) - Event handling

### Files Refactored:
1. ✅ `src/components/storefront/StoreProvider.jsx` - 934 → 200 lines

### Benefits:
- ✅ **Single Responsibility** - Each file has one job
- ✅ **Testable** - Can test utilities in isolation
- ✅ **Readable** - Clear what each piece does
- ✅ **Maintainable** - Easy to find and fix issues
- ✅ **Reusable** - Utilities can be used elsewhere

---

## Next Steps

1. Create utility files
2. Create hooks
3. Refactor StoreProvider to use new structure
4. Test thoroughly
5. Implement 3-layer architecture (bootstrap first)
6. Remove duplicate API calls

---

**Ready to implement?**
