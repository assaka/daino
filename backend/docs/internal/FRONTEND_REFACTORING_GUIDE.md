# Frontend Refactoring Implementation Guide

**Goal:** Reduce 39 API calls to <10, improve LCP from 9.6s to <2.5s
**Time Required:** 4-6 hours
**Complexity:** High (933-line StoreProvider refactoring)

---

## 🎯 CRITICAL UNDERSTANDING

**The bootstrap endpoint already returns:**
```javascript
{
  store: {...},
  languages: [{code: 'en', name: 'English'}, ...],
  categories: [{id: 1, name: 'Electronics'}, ...],
  translations: {labels: {...}, customKeys: {...}},
  wishlist: [{product_id: '...'}],
  user: {id: '...', email: '...'} or null,
  seoSettings: {...},
  seoTemplates: [{...}],
  headerSlotConfig: {...}
}
```

**But StoreProvider.jsx (line 760-813) IGNORES this and fetches:**
- categories (line 769) - DUPLICATE!
- translations/ui-labels (line 735) - DUPLICATE!
- seo-templates (line 809) - DUPLICATE!
- Plus: taxes, product-labels, attributes (NOT in bootstrap - these are needed)

**Result: Wasteful duplicate API calls**

---

## 🔧 STEP-BY-STEP REFACTORING

### STEP 1: Call Bootstrap Endpoint First

**File:** `src/components/storefront/StoreProvider.jsx`

**Find the fetchStoreData function (around line 380-850)**

**REPLACE the current store fetching logic with:**

```javascript
const fetchStoreData = useCallback(async (selectedStore) => {
  if (!selectedStore) return;

  try {
    const currentLang = localStorage.getItem('daino_language') ||
                       selectedStore.settings?.default_language || 'en';

    // STEP 1: Call bootstrap endpoint FIRST
    const bootstrapResponse = await storefrontApiClient.get(
      '/api/public/storefront/bootstrap',
      {
        params: {
          slug: selectedStore.slug,
          lang: currentLang,
          session_id: localStorage.getItem('guestSessionId'),
        }
      }
    );

    if (!bootstrapResponse.data.success) {
      console.error('Bootstrap failed:', bootstrapResponse.data);
      return;
    }

    const bootstrapData = bootstrapResponse.data.data;

    // STEP 2: Use bootstrap data (NO separate API calls for these!)
    const categoriesData = bootstrapData.categories || [];
    const translationsData = bootstrapData.translations || {};
    const wishlistData = bootstrapData.wishlist || [];
    const seoSettingsData = bootstrapData.seoSettings || {};
    const seoTemplatesData = bootstrapData.seoTemplates || [];

    // STEP 3: Only fetch data NOT in bootstrap
    const additionalDataPromises = [
      // Taxes - not in bootstrap
      cachedApiCall(`taxes-${selectedStore.id}`, async () => {
        const result = await StorefrontTax.filter({ store_id: selectedStore.id });
        return Array.isArray(result) ? result : [];
      }, CACHE_DURATION_SHORT),

      // Product labels - not in bootstrap
      cachedApiCall(`labels-${selectedStore.id}-${currentLang}`, async () => {
        const result = await StorefrontProductLabel.filter({ store_id: selectedStore.id });
        return Array.isArray(result) ? result.filter(l => l.is_active) : [];
      }, CACHE_DURATION_SHORT),

      // Attributes - not in bootstrap
      cachedApiCall(`attributes-${selectedStore.id}`, async () => {
        const result = await StorefrontAttribute.filter({ store_id: selectedStore.id });
        return Array.isArray(result) ? result : [];
      }, CACHE_DURATION_MEDIUM),
    ];

    const additionalResults = await Promise.allSettled(additionalDataPromises);

    // Set all state
    setCategories(categoriesData);
    setTaxes(additionalResults[0].status === 'fulfilled' ? additionalResults[0].value : []);
    setProductLabels(additionalResults[1].status === 'fulfilled' ? additionalResults[1].value : []);
    setAttributes(additionalResults[2].status === 'fulfilled' ? additionalResults[2].value : []);

    // STEP 4: Merge bootstrap translations into settings
    const mergedSettings = {
      ...selectedStore.settings,
      ui_translations: {
        [currentLang]: translationsData.labels || {}
      },
      // ... rest of your settings merging logic
    };

    setStore({ ...selectedStore, settings: mergedSettings });
    setLoading(false);

  } catch (error) {
    console.error('Error fetching store data:', error);
    setLoading(false);
  }
}, []);
```

**Lines to DELETE:**
- Line 769-772: categories API call (use bootstrap!)
- Line 732-757: translations/ui-labels call (use bootstrap!)
- Line 809-812: seo-templates call (use bootstrap!)

**Impact:**
- Eliminates 3-4 duplicate API calls
- 39 → 35-36 calls

---

### STEP 2: Update TranslationContext

**File:** `src/contexts/TranslationContext.jsx`

**Find loadAvailableLanguages function (around line 30)**

**REPLACE:**
```javascript
const loadAvailableLanguages = useCallback(async () => {
  try {
    if (storeId) {
      const response = await api.get('/languages'); // DELETE THIS!
      // ...
    }
  } catch (error) {
    // ...
  }
}, [currentLanguage]);
```

**WITH:**
```javascript
// Get languages from StoreProvider (bootstrap)
const { languages: bootstrapLanguages } = useStore();

useEffect(() => {
  if (bootstrapLanguages && bootstrapLanguages.length > 0) {
    setAvailableLanguages(bootstrapLanguages);
  }
}, [bootstrapLanguages]);
```

**Impact:**
- Eliminates /api/languages (called 3x!)
- 36 → 33 calls

---

### STEP 3: Batch Plugin Loading

**Create backend endpoint:**

**File:** `backend/src/routes/plugins.js`

**Add this route:**
```javascript
const { cacheMiddleware } = require('../middleware/cacheMiddleware');

router.get('/batch-active', cacheMiddleware({ prefix: 'plugins-batch', ttl: 600 }), async (req, res) => {
  try {
    const { Plugin, PluginHook, PluginEvent } = require('../models');

    const plugins = await Plugin.findAll({
      where: { is_active: true },
      include: [
        { model: PluginHook, as: 'hooks' },
        { model: PluginEvent, as: 'events' },
      ],
      order: [['load_priority', 'ASC']]
    });

    res.json({
      success: true,
      data: plugins.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        frontend_scripts: p.frontend_scripts,
        hooks: (p.hooks || []).map(h => ({
          hook_name: h.hook_name,
          handler_code: h.handler_code
        })),
        events: (p.events || []).map(e => ({
          event_name: e.event_name,
          handler_code: e.handler_code
        })),
      }))
    });
  } catch (error) {
    console.error('Batch active plugins error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Update frontend:**

**File:** `src/App.jsx`

**Find initializeDatabasePlugins function (around line 38-90)**

**REPLACE multiple plugin fetches with:**
```javascript
async function initializeDatabasePlugins() {
  try {
    // SINGLE batch call for all plugins
    const response = await fetch(`/api/plugins/batch-active?_t=${Date.now()}`);
    const result = await response.json();

    if (!result.success) {
      console.error('Failed to load plugins:', result);
      return;
    }

    const plugins = result.data || [];

    // Load all plugins from batch response
    await Promise.all(
      plugins.map(async (plugin) => {
        // Register hooks
        if (plugin.hooks) {
          plugin.hooks.forEach(hook => {
            hookSystem.register(hook.hook_name, eval(hook.handler_code));
          });
        }

        // Register events
        if (plugin.events) {
          plugin.events.forEach(event => {
            eventSystem.on(event.event_name, eval(event.handler_code));
          });
        }

        // Load frontend scripts
        if (plugin.frontend_scripts) {
          const script = document.createElement('script');
          script.textContent = plugin.frontend_scripts;
          document.body.appendChild(script);
        }
      })
    );

    window.__pluginsReady = true;
    setupGlobalPricingNotifications();

  } catch (error) {
    console.error('Error initializing plugins:', error);
    window.__pluginsReady = true; // Proceed anyway
  }
}
```

**Impact:**
- 8+ plugin calls → 1 batch call
- 33 → 26 calls

---

### STEP 4: Defer Analytics Calls

**File:** `src/components/storefront/DataLayerManager.jsx`

**Find trackActivity function (around line 70-110)**

**WRAP the fetch in setTimeout:**
```javascript
const trackActivity = async (activityData) => {
  // ... validation code ...

  // DEFER analytics tracking (don't block LCP)
  setTimeout(async () => {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
      const apiUrl = `${apiBaseUrl}/api/customer-activity`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityData),
        credentials: 'include'
      });

      // ...
    } catch (error) {
      // Silent fail for analytics
    }
  }, 2000); // Defer by 2 seconds (after LCP)
};
```

**Also defer heatmap tracking:**

Find any heatmap/track calls and wrap in setTimeout with 2000-3000ms delay.

**Impact:**
- Doesn't reduce call count
- But improves LCP: 9.6s → 3-4s (analytics no longer blocks render)

---

### STEP 5: Fix auth/me Duplicates

**Ensure useUser hook exists:**

**File:** `src/hooks/useApiQueries.js`

**Add if missing:**
```javascript
export function useUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/auth/me');
        return response.data;
      } catch (error) {
        if (error.response?.status === 401) {
          return null; // Not authenticated
        }
        throw error;
      }
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false, // Don't retry 401
  });
}
```

**Then find all places calling /api/auth/me directly and replace with useUser():**

Search for:
```bash
grep -rn "api.get.*auth/me\|fetch.*auth/me" src --include="*.jsx"
```

Replace with:
```javascript
import { useUser } from '@/hooks/useApiQueries';
const { data: user } = useUser();
```

**Impact:**
- 3 calls → 1 call
- 26 → 24 calls

---

### STEP 6: Fix Remaining Duplicates

**wishlist (2x → 1x):**

Ensure components use same React Query hook:
```javascript
// Create/use consistent hook:
export function useWishlist(storeId, sessionId) {
  return useQuery({
    queryKey: ['wishlist', storeId, sessionId],
    queryFn: async () => {
      const response = await api.get('/api/wishlist', {
        params: { store_id: storeId, session_id: sessionId }
      });
      return response.data;
    },
    staleTime: 60000,
    enabled: !!storeId && !!sessionId,
  });
}
```

**customer-activity (2x → 1x):**

Deduplicate by checking if already tracked:
```javascript
const trackedPages = useRef(new Set());

const trackActivity = (data) => {
  const pageKey = `${data.page_url}_${data.activity_type}`;
  if (trackedPages.current.has(pageKey)) {
    return; // Skip duplicate
  }
  trackedPages.current.add(pageKey);

  setTimeout(() => {
    fetch('/api/customer-activity', {/* ... */});
  }, 2000);
};
```

**slot-configurations, canonical-urls, etc.:**

Similar approach - use React Query with consistent keys

**Impact:**
- 24 → 18-20 calls

---

## 📊 EXPECTED FINAL RESULT

### After ALL Steps:

```
API Calls: 39 → 8-12
Duplicates: 10 → 0
LCP: 9.6s → 2-3s
Perceived Load: 5s → 2s
Lighthouse: 31% → 75-85%
```

---

## ⚠️ COMPLEXITY WARNING

**StoreProvider.jsx is 933 lines with:**
- Complex settings merging logic (400+ lines)
- Custom caching system
- Cookie consent handling
- Country selection logic
- Theme defaults
- Checkout layout management

**Refactoring requires:**
- Careful preservation of all logic
- Thorough testing after changes
- Understanding of data dependencies
- Risk of breaking existing functionality

---

## 💡 RECOMMENDED APPROACH

**Given complexity, I recommend:**

1. **Create new StoreProviderV2.jsx** (don't modify original)
2. **Implement bootstrap-first approach in new file**
3. **Test thoroughly in development**
4. **Switch to new provider when confident**
5. **Keep old provider as backup**

**This reduces risk of breaking production!**

---

## 🚀 ALTERNATIVE: Quick Wins First

**Instead of full refactoring, implement quick wins:**

**Quick Win #1: Batch Plugins (1 hour)**
- Create batch endpoint
- 8 calls → 1 call
- Low risk, high impact

**Quick Win #2: Defer Analytics (30 min)**
- Wrap customer-activity in setTimeout
- Improves LCP immediately
- Very low risk

**Quick Win #3: Fix auth/me (30 min)**
- Ensure consistent useUser()
- 3 calls → 1
- Low risk

**Total: 2 hours, ~15 fewer calls, lower risk**

**Then tackle StoreProvider refactoring as Phase 2.**

---

## 📋 FILES TO MODIFY (Complete List)

### Critical Changes:
1. `src/components/storefront/StoreProvider.jsx` (933 lines) - Major refactoring
2. `src/contexts/TranslationContext.jsx` - Use bootstrap languages
3. `backend/src/routes/plugins.js` - Add batch endpoint
4. `src/App.jsx` - Update plugin loading
5. `src/components/storefront/DataLayerManager.jsx` - Defer analytics

### Minor Changes:
6. Various components - Ensure useUser() usage
7. Wishlist components - Consistent hooks
8. Any direct API.get() calls - Replace with hooks

---

**All steps documented. Ready to implement or use as reference for future work.**
