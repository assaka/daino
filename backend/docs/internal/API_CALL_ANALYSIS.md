# API Call Analysis - Current State

**Date:** 2025-11-11
**Total API Calls:** ~80 (including OPTIONS preflight)
**Actual API Calls:** ~40 (excluding OPTIONS)

---

## ✅ Progress So Far

### Refactoring Completed
1. ✅ StoreProvider refactored: 934 lines → 260 lines (72% reduction)
2. ✅ Bootstrap endpoint integration working
3. ✅ Utilities extracted (cacheUtils, storeSettingsDefaults, hooks)
4. ✅ Fixed nested TranslationProvider (eliminates 4-5 `/api/languages` calls)

### Current Bootstrap Call
- ✅ `/api/public/storefront/bootstrap` - **Called 1 time** (returns store, languages, categories, translations, SEO, wishlist, user)

---

## 🔥 Duplicate API Calls (Priority Order)

### HIGH PRIORITY (Biggest Offenders)

#### 1. `/api/auth/me` - **6+ calls** (should be 1)
**Source:** AuthMiddleware.jsx calls `User.me()` multiple times
**Solution:** Use `useUser()` hook consistently (already exists)
**Impact:** Eliminates 5 duplicate calls
**Complexity:** High (AuthMiddleware is complex)

#### 2. `/api/canonical-urls/check` - **6+ calls**
**Source:** SeoHeadManager.jsx
**Solution:** Add React Query caching OR check once per route
**Impact:** Eliminates 5 duplicate calls
**Complexity:** Medium

#### 3. `/api/languages` - **4-5 calls** (should be 0 - in bootstrap!)
**Source:** Nested TranslationProviders
**Solution:** ✅ FIXED - Removed outer TranslationProvider from App.jsx
**Impact:** Eliminates 4-5 calls
**Status:** ✅ FIXED

#### 4. `/api/cart` - **4+ calls** (should be 1)
**Source:** Multiple components fetching cart
**Solution:** Ensure all components use React Query hook
**Impact:** Eliminates 3 duplicate calls
**Complexity:** Medium

#### 5. `/api/tax` - **3+ calls**
**Source:** Different pages/components
**Solution:** Use tax data from StoreProvider (Layer 3)
**Impact:** Eliminates 2 duplicate calls
**Complexity:** Low

---

### MEDIUM PRIORITY (Already in Bootstrap)

#### 6. `/api/translations/ui-labels` - **1-2 calls** (should be 0)
**Source:** Components not using bootstrap translations
**Solution:** Use translations from StoreProvider
**Impact:** Eliminates 1-2 calls
**Status:** Should be fixed by TranslationProvider fix

#### 7. `/api/wishlist` - **1 call** (should be 0)
**Source:** WishlistDropdown
**Solution:** Use wishlist from bootstrap
**Impact:** Eliminates 1 call
**Complexity:** Low

#### 8. `/api/slot-configurations/.../header` - **1 call** (should be 0)
**Source:** HeaderSlotRenderer
**Solution:** Use headerSlotConfig from bootstrap
**Impact:** Eliminates 1 call
**Complexity:** Low

#### 9. `/api/public/seo-settings` - **1 call** (should be 0)
**Source:** SeoSettingsProvider
**Solution:** Use seoSettings from bootstrap
**Impact:** Eliminates 1 call
**Complexity:** Low

---

### LOW PRIORITY (Page-Specific / Expected)

#### 10. `/api/shipping` - **2-3 calls**
**Source:** Checkout page
**Reason:** User navigates between checkout steps
**Solution:** React Query caching (might already be cached)
**Complexity:** Low

#### 11. `/api/delivery` - **2-3 calls**
**Source:** Checkout page
**Reason:** User navigates between checkout steps
**Solution:** React Query caching
**Complexity:** Low

#### 12. `/api/public/payment-methods` - **2 calls**
**Source:** Checkout page
**Reason:** User navigates between checkout steps
**Solution:** React Query caching
**Complexity:** Low

#### 13. `/api/redirects/check` - **Multiple calls**
**Source:** Per-page redirect checking
**Reason:** Checking if page has a redirect rule
**Solution:** Can be deferred or cached
**Complexity:** Medium

#### 14. `/api/customer-activity` - **Multiple calls**
**Source:** Analytics tracking
**Reason:** Tracking user activity on each page
**Solution:** Already deferred, expected behavior
**Complexity:** N/A (working as designed)

#### 15. `/api/heatmap/track-batch` - **Multiple calls**
**Source:** Heatmap tracking
**Reason:** Tracking clicks/interactions
**Solution:** Expected behavior
**Complexity:** N/A (working as designed)

---

## 📊 Expected Reduction

### After All HIGH Priority Fixes:
```
Before: 80 total calls (40 actual + 40 OPTIONS)
After:  ~50 total calls (25 actual + 25 OPTIONS)

Reduction: ~30 calls (37% improvement)
```

### Breakdown:
- ✅ `/api/languages`: 5 calls → 0 (FIXED)
- `/api/auth/me`: 6 calls → 1 (saves 5)
- `/api/canonical-urls`: 6 calls → 1 (saves 5)
- `/api/cart`: 4 calls → 1 (saves 3)
- `/api/tax`: 3 calls → 1 (saves 2)
- `/api/translations/ui-labels`: 2 calls → 0 (saves 2)
- `/api/wishlist`: 1 call → 0 (saves 1)
- `/api/slot-configurations`: 1 call → 0 (saves 1)
- `/api/seo-settings`: 1 call → 0 (saves 1)

**Total Savings: ~20 API calls**

---

## 🎯 Next Actions

### Immediate (Low-Hanging Fruit)
1. ✅ TranslationProvider - DONE
2. Use bootstrap wishlist in WishlistDropdown
3. Use bootstrap headerSlotConfig in HeaderSlotRenderer
4. Use bootstrap seoSettings in SeoSettingsProvider

### After Testing
5. Fix canonical-urls duplicates (React Query caching)
6. Fix cart duplicates (ensure consistent hook usage)
7. Fix tax duplicates (use from StoreProvider)

### Optional (if time permits)
8. Fix auth/me duplicates (refactor AuthMiddleware)

---

## 📈 Benefits Achieved So Far

1. ✅ **Code Quality**: 934 lines → 260 lines (72% reduction)
2. ✅ **Architecture**: 3-layer design implemented
3. ✅ **Bootstrap Integration**: Working and returning all data in 1 call
4. ✅ **Languages Fix**: Eliminated 4-5 duplicate calls
5. ⏳ **Total Reduction**: ~5 calls eliminated, 15-20 more to go

---

**Status:** Bootstrap working, making good progress on duplicate elimination!
