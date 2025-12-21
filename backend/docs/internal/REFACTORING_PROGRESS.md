# StoreProvider Refactoring Progress

## ✅ Completed Steps

### 1. Analysis & Planning
- ✅ Analyzed 934-line StoreProvider.jsx
- ✅ Identified problems and responsibilities
- ✅ Created comprehensive refactoring plan
- ✅ Documented 3-layer data architecture

### 2. Extracted Utilities (New Files Created)

#### `src/utils/storeSettingsDefaults.js` (~300 lines)
**Purpose:** Settings merging and defaults

**Functions:**
- `mergeStoreSettings(store)` - Main merging function
- `getCurrencySymbol(code)` - Currency mapping
- `cleanCheckoutLayout(layout)` - Layout cleanup
- `getStockDefaults()` - Stock settings
- `getThemeDefaults()` - Theme settings
- `getCheckoutDefaults()` - Checkout settings
- `getProductGridDefaults()` - Grid settings
- And more...

**Impact:** Removes ~200 lines from StoreProvider

---

#### `src/utils/cacheUtils.js` (~285 lines)
**Purpose:** Centralized caching system

**Functions:**
- `cachedApiCall(key, apiCall, ttl)` - Main caching function
- `loadCacheFromStorage()` - Load from localStorage
- `saveCacheToStorage()` - Save to localStorage
- `clearCache()` - Clear all cache
- `clearCacheKeys(keys)` - Clear specific keys
- `deleteCacheKey(key)` - Delete single key
- `getCacheStats()` - Get cache statistics
- `clearStorefrontCache()` - Admin cache clearing
- Plus specific clear functions for each data type

**Constants:**
- `CACHE_DURATION_LONG` - 1 hour
- `CACHE_DURATION_MEDIUM` - 5 minutes
- `CACHE_DURATION_SHORT` - 1 minute
- `CACHE_VERSION` - Version control

**Impact:** Removes ~150 lines from StoreProvider, provides reusable caching

---

### 3. Created Hooks (New Files Created)

#### `src/hooks/useStoreBootstrap.js` (~80 lines)
**Purpose:** Fetch Layer 1 (Global) data from bootstrap endpoint

**Hook:**
- `useStoreBootstrap(storeSlug, language)` - React Query hook for bootstrap

**What it fetches in ONE call:**
- Store configuration
- Languages
- Translations (UI labels)
- Categories (navigation tree)
- SEO settings
- SEO templates
- Wishlist
- User data
- Header slot configuration

**Helpers:**
- `determineStoreSlug(location)` - Smart slug detection

**Impact:** Replaces 3-4 separate API calls with 1 bootstrap call

---

#### `src/hooks/useStoreData.js` (~200 lines)
**Purpose:** Fetch Layer 3 (Dynamic) data NOT in bootstrap

**Functions:**
- `fetchAdditionalStoreData(storeId, language)` - Fetch taxes, labels, attributes
- `fetchCookieConsentSettings(storeId)` - Cookie consent configuration

**What it fetches (still using cachedApiCall):**
- Taxes (SHORT cache - 1 min)
- Product labels (SHORT cache - 1 min)
- Attributes (MEDIUM cache - 5 min)
- Filterable attributes (MEDIUM cache - 5 min)
- Attribute sets (MEDIUM cache - 5 min)
- Cookie consent settings (LONG cache - 1 hour)

**Impact:** Clean separation of data fetching logic

---

### 4. Backup Created
- ✅ Original StoreProvider backed up to `StoreProvider.jsx.backup`
- Can restore if needed

---

## 📋 Next Steps

### Step 5: Apply Refactored StoreProvider
Replace the current 934-line StoreProvider with a clean version that:
- Uses `useStoreBootstrap()` for Layer 1 data
- Uses `fetchAdditionalStoreData()` for Layer 3 data
- Uses `mergeStoreSettings()` for defaults
- Removes duplicate API calls
- Reduces from 934 lines → ~200-300 lines

**Expected Structure:**
```javascript
import { useStoreBootstrap } from '@/hooks/useStoreBootstrap';
import { fetchAdditionalStoreData, fetchCookieConsentSettings } from '@/hooks/useStoreData';
import { mergeStoreSettings } from '@/utils/storeSettingsDefaults';

export const StoreProvider = ({ children }) => {
  // Get store slug and language
  const storeSlug = determineStoreSlug(location);
  const language = localStorage.getItem('daino_language') || 'en';

  // LAYER 1: Bootstrap (global data - 1 API call)
  const { data: bootstrap, isLoading } = useStoreBootstrap(storeSlug, language);

  useEffect(() => {
    if (!bootstrap) return;

    // Merge settings
    const mergedSettings = mergeStoreSettings(bootstrap.store);

    // LAYER 3: Additional data (NOT in bootstrap)
    const additionalData = await fetchAdditionalStoreData(bootstrap.store.id, language);
    const cookieConsent = await fetchCookieConsentSettings(bootstrap.store.id);

    // Combine and set state
    setStoreData({
      // From bootstrap
      store: { ...bootstrap.store, settings: mergedSettings },
      languages: bootstrap.languages,
      translations: bootstrap.translations,
      categories: bootstrap.categories,
      seoSettings: bootstrap.seoSettings,
      seoTemplates: bootstrap.seoTemplates,
      wishlist: bootstrap.wishlist,
      user: bootstrap.user,

      // From additional data
      ...additionalData,
      cookieConsent
    });
  }, [bootstrap]);

  return <StoreContext.Provider value={storeData}>{children}</StoreContext.Provider>;
};
```

---

## 📊 Expected Results

### Code Quality
- **934 lines → ~200-300 lines** (70% reduction)
- **Single responsibility** - Each file has one job
- **Testable** - Can test utilities independently
- **Maintainable** - Easy to find and modify code
- **Reusable** - Utilities can be used elsewhere

### Performance
- **39 API calls → ~25-30 calls** (after bootstrap integration)
- **Eliminates duplicates:**
  - ❌ categories (already in bootstrap)
  - ❌ translations (already in bootstrap)
  - ❌ seoTemplates (already in bootstrap)
- **Better caching** - 15min for bootstrap vs. mixed cache times

### Architecture
- ✅ **Layer 1 (Bootstrap):** Global data loaded once
- ✅ **Layer 3 (Dynamic):** Frequently changing data
- ✅ **Clear separation:** What comes from where

---

## 🎯 Benefits of Refactoring

1. **Readability**
   - No more 541-line fetchStoreData function
   - Clear imports show what each file does
   - Easy to understand data flow

2. **Maintainability**
   - Settings defaults in one place
   - Caching logic centralized
   - Easy to add new default settings
   - Easy to adjust cache durations

3. **Performance**
   - Bootstrap reduces API calls
   - Smart caching prevents redundant requests
   - Faster initial page load

4. **Developer Experience**
   - Easy to debug (smaller files)
   - Easy to test (isolated functions)
   - Easy to extend (clear patterns)

---

## ⚠️ Risks & Mitigation

### Risks
1. Breaking existing functionality
2. Missing edge cases in settings merging
3. Cache behavior changes
4. Event listener handling

### Mitigation
1. ✅ Original backed up to `.backup` file
2. ✅ Extracted code preserves all original logic
3. ✅ Can quickly restore if issues found
4. ✅ Test thoroughly before deploying

---

## 🚀 Ready to Apply?

All utilities and hooks are ready. Next step is to apply the refactored StoreProvider.

**Would you like to:**
1. Review the new StoreProvider code before applying
2. Apply immediately and test
3. Apply to a separate file first (StoreProviderV2.jsx)
