# Duplicate API Call Fixes

**Identified Issues from Test Results:**
- 37 API calls (Target: <5)
- 10 duplicate endpoints
- 16.8 seconds total API time

---

## 🔴 Critical Duplicates to Fix

### 1. /api/languages (3x duplicates)

**Issue:** `loadAvailableLanguages()` called multiple times

**Location:** `src/contexts/TranslationContext.jsx:30`

**Root Cause:**
```javascript
useEffect(() => {
  if (storeId) {
    await loadAvailableLanguages();
    // ...
  }
}, [storeId, loadAvailableLanguages, loadTranslations]);
```

**Problem:** If `loadAvailableLanguages` function reference changes, effect re-runs

**Fix:** Add React Query to cache languages globally

```javascript
// In src/hooks/useApiQueries.js - ADD THIS:

export function useLanguages() {
  return useQuery({
    queryKey: queryKeys.language.list(),
    queryFn: async () => {
      const { data } = await api.get('/api/languages');
      return data;
    },
    staleTime: 3600000, // 1 hour - languages rarely change
    gcTime: 7200000, // 2 hours
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
```

**Then in TranslationContext.jsx:**
```javascript
// Replace loadAvailableLanguages with:
const { data: languagesData } = useLanguages();

useEffect(() => {
  if (languagesData) {
    setAvailableLanguages(languagesData);
  }
}, [languagesData]);
```

**Expected Result:** 3 calls → 1 call (saves ~2 seconds)

---

### 2. /api/auth/me (3x duplicates)

**Issue:** Multiple components checking auth status

**Likely locations:**
- Header component
- User menu
- Protected route checks

**Fix:** Ensure consistent React Query key

**Check file:** `src/hooks/useApiQueries.js`

**Verify useUser hook has:**
```javascript
export function useUser() {
  return useQuery({
    queryKey: queryKeys.user.me(), // Must be EXACTLY the same everywhere!
    queryFn: async () => {
      const { data } = await api.get('/api/auth/me');
      return data;
    },
    staleTime: 300000, // 5 minutes
    refetchOnMount: false,      // Don't refetch on component mount
    refetchOnWindowFocus: false, // Don't refetch on window focus
    retry: false, // Don't retry if not authenticated
  });
}
```

**Expected Result:** 3 calls → 1 call (saves ~1.5 seconds)

---

### 3. /api/customer-activity (2x duplicates)

**Issue:** Analytics tracking called twice

**Location:** Likely in `src/components/storefront/DataLayerManager.jsx`

**Problem:** Multiple page view events firing

**Fix:** Debounce or deduplicate activity tracking

```javascript
// In DataLayerManager.jsx, add debounce:

import { useRef, useEffect } from 'react';

const lastTrackedPage = useRef(null);

const trackActivity = useCallback(async (data) => {
  // Deduplicate based on page URL
  const pageKey = `${data.page_url}_${data.activity_type}`;

  if (lastTrackedPage.current === pageKey) {
    return; // Skip duplicate
  }

  lastTrackedPage.current = pageKey;

  // Track activity
  await fetch('/api/customer-activity', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}, []);
```

**Expected Result:** 2 calls → 1 call (saves ~500ms)

---

### 4. /api/wishlist (2x duplicates)

**Issue:** Wishlist fetched by multiple components

**Likely Locations:**
- Wishlist dropdown/icon
- Product page (to check if product is in wishlist)

**Fix:** Use React Query with consistent key

**Add to useApiQueries.js:**
```javascript
export function useWishlist(storeId, sessionId) {
  return useQuery({
    queryKey: queryKeys.wishlist.items(storeId, sessionId),
    queryFn: async () => {
      const { data } = await api.get('/api/wishlist', {
        params: { store_id: storeId, session_id: sessionId }
      });
      return data;
    },
    staleTime: 60000, // 1 minute
    enabled: !!storeId && !!sessionId,
    refetchOnMount: false,
  });
}
```

**Expected Result:** 2 calls → 1 call (saves ~500ms)

---

### 5. /api/translations/ui-labels (2x duplicates)

**Issue:** UI labels fetched multiple times

**Problem:** Likely loaded by:
- TranslationContext
- StoreProvider
- Or individual components

**Fix:** Ensure single source of truth

**In TranslationContext or StoreProvider - use React Query:**
```javascript
const { data: uiLabels } = useQuery({
  queryKey: queryKeys.translation.uiLabels(lang, storeId),
  queryFn: async () => {
    const { data } = await api.get('/api/translations/ui-labels', {
      params: { store_id: storeId, lang }
    });
    return data;
  },
  staleTime: 1800000, // 30 minutes
  refetchOnMount: false,
});
```

**Expected Result:** 2 calls → 1 call (saves ~300ms)

---

## 🎯 Quick Wins to Implement NOW

### Fix #1: Update queryClient.js (5 minutes)

**File:** `src/config/queryClient.js`

**Add these specific configurations:**

```javascript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 180000, // Already set ✅
      gcTime: 600000, // Already set ✅
      refetchOnWindowFocus: false, // Already set ✅
      refetchOnReconnect: false, // ADD THIS
      refetchOnMount: false, // Already set ✅
      refetchInterval: false, // ADD THIS - prevent auto-refetch
      retry: 1, // Reduce retries
    },
  },
});
```

**Impact:** Prevents unnecessary refetching (saves 2-3 seconds)

---

### Fix #2: Add Missing Query Keys (10 minutes)

**File:** `src/config/queryClient.js`

**Add to queryKeys object:**

```javascript
export const queryKeys = {
  // ... existing keys ...

  // Add these:
  language: {
    all: ['language'],
    list: () => [...queryKeys.language.all, 'list'],
  },

  auth: {
    all: ['auth'],
    me: () => [...queryKeys.auth.all, 'me'],
  },

  analytics: {
    all: ['analytics'],
    activity: (storeId) => [...queryKeys.analytics.all, 'activity', storeId],
  },

  seo: {
    all: ['seo'],
    canonical: (storeId, path) => [...queryKeys.seo.all, 'canonical', storeId, path],
    settings: (storeId) => [...queryKeys.seo.all, 'settings', storeId],
  },

  slot: {
    all: ['slot'],
    config: (storeId, pageType) => [...queryKeys.slot.all, 'config', storeId, pageType],
  },
};
```

**Impact:** Consistent keys = better deduplication (saves 3-5 seconds)

---

### Fix #3: Reduce Unnecessary API Calls (15 minutes)

**Issue:** Too many API calls that could be combined

**Current: 37 calls**
**Many could be eliminated:**

1. ✅ Bootstrap already loads: store, languages, categories, translations
   - **Remove separate calls to these if bootstrap data available**

2. Plugin API calls (8+ calls)
   - **Batch these or lazy load only when needed**

3. Slot configurations (3+ calls)
   - **Load on-demand, not on every page**

4. Canonical URLs check (2x)
   - **Not critical for page render, defer this**

5. SEO settings
   - **Already in bootstrap? Check if duplicate**

---

## 📊 Expected Results After Fixes

### API Call Reduction:

```
Before:
37 total calls
10 duplicates
16.8s total time

After Fix #1 (Eliminate duplicates):
27 calls (-27%)
0 duplicates
10.5s total time (-37%)

After Fix #2 (Consolidate):
8-10 calls (-73%)
0 duplicates
3-4s total time (-76%)

After Fix #3 (Defer non-critical):
<5 calls (-87%)
0 duplicates
<2s total time (-88%)
```

### Page Load Improvement:

```
Before: 2.56s
After:  0.8-1.2s

Improvement: 60-70% faster!
```

---

## 🚀 Implementation Order

**Immediate (30 min):**
1. ✅ Update queryClient with refetch settings
2. ✅ Add missing query keys
3. ✅ Ensure consistent usage

**Short-term (1-2 hours):**
4. ✅ Remove duplicate language/auth calls
5. ✅ Defer non-critical API calls
6. ✅ Batch plugin loading

**Medium-term (2-3 hours):**
7. ✅ Code splitting
8. ✅ Lazy load non-critical features

---

**Status:** Analysis complete, fixes documented
**Ready to implement:** YES
