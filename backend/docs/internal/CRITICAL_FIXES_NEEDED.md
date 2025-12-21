# Critical Fixes Needed to Achieve <2s Page Load

**Current State:** 39 API calls, 9.6s LCP, 5s perceived
**Target State:** <10 API calls, <2.5s LCP, <2s perceived
**Time Required:** 3-5 hours frontend refactoring

---

## 🔥 THE CORE PROBLEM

**Bootstrap endpoint already returns:**
- ✅ Store data
- ✅ Languages
- ✅ Categories
- ✅ Translations (UI labels)
- ✅ SEO settings
- ✅ SEO templates
- ✅ Wishlist
- ✅ User (if authenticated)
- ✅ Header slot config

**But the frontend STILL makes separate API calls for all of these!**

**This is pure architectural waste!**

---

## 🎯 CRITICAL FIX #1: Use Bootstrap Data (HIGHEST IMPACT)

### Current Problem:
```javascript
// Bootstrap loads everything:
const bootstrapData = await fetch('/api/public/storefront/bootstrap');
// Returns: { store, languages, categories, translations, wishlist, user, ... }

// But then components IGNORE bootstrap and fetch again:
const languages = await fetch('/api/languages'); // DUPLICATE!
const categories = await fetch('/api/categories'); // DUPLICATE!
const uiLabels = await fetch('/api/translations/ui-labels'); // DUPLICATE!
const wishlist = await fetch('/api/wishlist'); // DUPLICATE!
```

### Fix Required:

**In StoreProvider.jsx or wherever bootstrap is called:**

```javascript
const { data: bootstrapData } = useQuery({
  queryKey: ['bootstrap', storeSlug, language],
  queryFn: () => fetchBootstrap(storeSlug, language),
  staleTime: 300000, // 5 minutes
});

// Provide ALL bootstrap data via context
return (
  <StoreContext.Provider value={{
    store: bootstrapData?.store,
    languages: bootstrapData?.languages,  // Use this!
    categories: bootstrapData?.categories, // Use this!
    translations: bootstrapData?.translations, // Use this!
    wishlist: bootstrapData?.wishlist, // Use this!
    user: bootstrapData?.user, // Use this!
    seoSettings: bootstrapData?.seoSettings, // Use this!
    // ... etc
  }}>
    {children}
  </StoreContext.Provider>
);
```

**Then in TranslationContext.jsx:**
```javascript
// REMOVE this:
const loadAvailableLanguages = async () => {
  const response = await api.get('/languages'); // DELETE THIS!
};

// REPLACE with:
const { languages } = useStore(); // Get from bootstrap!
useEffect(() => {
  if (languages) {
    setAvailableLanguages(languages);
  }
}, [languages]);
```

**Expected Impact:**
- Eliminates: /api/languages (3x)
- Eliminates: /api/categories (if duplicated)
- Eliminates: /api/translations/ui-labels (2x)
- Eliminates: /api/wishlist (1 of 2)
- **Total: 39 calls → 32 calls (7 fewer)**

---

## 🎯 CRITICAL FIX #2: Batch Plugin Loading (SECOND HIGHEST)

### Current Problem:
```
8+ individual plugin API calls:
/api/plugins/active?_t=timestamp
/api/plugins/active/bf0d7a72-...
/api/plugins/active/ef537565-...
/api/plugins/active/c80b7d37-...
/api/plugins/active/4eb11832-...
/api/plugins/bf0d7a72-.../scripts
/api/plugins/ef537565-.../scripts
...etc

Total: 8+ calls, ~1.2 seconds
```

### Fix Required:

**Create batch endpoint in backend:**

`backend/src/routes/plugins.js`:
```javascript
// Add this route:
router.get('/batch-active', async (req, res) => {
  try {
    // Get all active plugins
    const plugins = await Plugin.findAll({
      where: { is_active: true },
      include: [/* all necessary data */]
    });

    // Return everything in one response
    res.json({
      success: true,
      data: {
        plugins,
        scripts: plugins.map(p => p.frontend_scripts),
        hooks: plugins.map(p => p.hooks),
        events: plugins.map(p => p.events)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Update frontend App.jsx:**
```javascript
// REPLACE multiple plugin calls with:
const { data: pluginData } = useQuery({
  queryKey: ['plugins', 'batch-active'],
  queryFn: () => fetch('/api/plugins/batch-active').then(r => r.json()),
  staleTime: 600000, // 10 minutes
});

// Process all plugins from single response
useEffect(() => {
  if (pluginData) {
    pluginData.data.plugins.forEach(plugin => {
      loadPlugin(plugin);
    });
  }
}, [pluginData]);
```

**Expected Impact:**
- **8 calls → 1 call** (7 fewer)
- **1.2s → 200ms** (1 second saved)
- **Total: 32 calls → 25 calls**

---

## 🎯 CRITICAL FIX #3: Defer Non-Critical APIs

### Current Problem:
These APIs don't affect what user sees but block rendering:

```
❌ /api/customer-activity (analytics)
❌ /api/heatmap/track-batch (analytics)
❌ /api/canonical-urls/check (SEO)
❌ /api/public/seo-settings (SEO, already in bootstrap)
❌ /api/public/seo-templates (SEO, already in bootstrap)
```

### Fix Required:

**Defer analytics until after page renders:**

```javascript
// In DataLayerManager.jsx or wherever customer-activity is called:
useEffect(() => {
  if (product && store) {
    // Defer analytics by 2 seconds (after LCP)
    const timer = setTimeout(() => {
      trackCustomerActivity({
        store_id: store.id,
        page_url: window.location.href,
        // ...
      });
    }, 2000); // After page renders

    return () => clearTimeout(timer);
  }
}, [product, store]);
```

**Remove unnecessary SEO calls:**
```javascript
// If SEO settings already in bootstrap, don't fetch again!
// Check StoreProvider - if bootstrap has seoSettings, use those
const { seoSettings } = useStore(); // From bootstrap
// Don't call /api/public/seo-settings separately!
```

**Expected Impact:**
- **5 calls deferred** (don't block rendering)
- **LCP: 9.6s → 4-5s** (major improvement)
- **Total: 25 calls initially, 5 more after render**

---

## 🎯 CRITICAL FIX #4: Fix auth/me Duplicates (3x → 1x)

### Current Problem:
```
/api/auth/me called 3 times:
- Header component checks auth
- User menu checks auth
- Protected route check
```

### Fix Required:

**Ensure useUser() hook is used consistently:**

Check file: `src/hooks/useApiQueries.js`

Verify it exists and has correct settings:
```javascript
export function useUser() {
  return useQuery({
    queryKey: ['auth', 'me'], // MUST be consistent!
    queryFn: async () => {
      const response = await api.get('/api/auth/me');
      return response.data;
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000,
    refetchOnMount: false, // Critical!
    refetchOnWindowFocus: false, // Critical!
    retry: false, // Don't retry if 401
  });
}
```

**Then ensure ALL components use THIS hook:**

```javascript
// In Header.jsx, UserMenu.jsx, anywhere checking auth:
import { useUser } from '@/hooks/useApiQueries';

// Use the hook (NOT raw fetch):
const { data: user, isLoading } = useUser();
```

**Expected Impact:**
- **3 calls → 1 call** (2 fewer)
- **1.3s → 660ms** (640ms saved)
- **Total: 25 calls → 23 calls**

---

## 🎯 CRITICAL FIX #5: Fix Remaining Duplicates

### customer-activity (2x → 1x):
**Deduplicate tracking calls** (see FIX #3 above)

### wishlist (2x → 1x):
**Use useWishlist() hook consistently**

### slot-configurations (2x → 1x):
**Load all slots in one call, cache properly**

### translations/ui-labels (2x → 1x):
**Already in bootstrap! Don't fetch separately**

**Expected Impact:**
- **6 calls → 0 duplicates**
- **23 calls → 17 calls**

---

## 📊 FINAL EXPECTED RESULT

### After ALL Fixes:

```
Before:
- 39 API calls
- 8.8s total API time
- 9.6s LCP
- ~5s perceived

After:
- 8-10 API calls initially
- ~2-3s total API time
- ~2-3s LCP
- ~2s perceived

Improvement: 60% faster, actually feels fast!
```

---

## ⏰ IMPLEMENTATION PLAN

**I'll implement these fixes in order:**

1. ✅ Use bootstrap data for languages/categories/translations (30 min)
2. ✅ Batch plugin loading (45 min)
3. ✅ Defer analytics/SEO calls (20 min)
4. ✅ Fix auth/me duplicates (15 min)
5. ✅ Fix remaining duplicates (30 min)

**Total: ~2.5 hours**

**After each fix, I'll commit and you can test incrementally.**

---

**Ready to proceed? I'll start with using bootstrap data properly (biggest impact).**
