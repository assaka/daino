# API Call Optimization Summary

## Overview
This document summarizes the comprehensive API optimization implemented to reduce excessive API calls in the DainoStore application. The optimization uses React Query (TanStack Query) to provide automatic request deduplication, intelligent caching, and optimized retry logic.

## Problem Analysis

### Issues Identified

Based on the initial API call logs, the following issues were identified:

1. **Duplicate Product Calls** - `/api/public/products/by-slug/...` called 2x on same page load
2. **Multiple auth/me Calls** - `/api/auth/me` called 3+ times simultaneously
3. **Excessive Wishlist Calls** - `/api/wishlist` called 4x with aggressive retry logic (up to 5 attempts)
4. **Redundant Translation Loading** - `/api/translations/ui-labels` loaded from multiple sources
5. **No Request Deduplication** - Simultaneous identical requests weren't being merged
6. **Excessive CORS Preflight** - Every API call triggered an OPTIONS request

### Total API Calls (Before)
From a single product page load:
- **80+ total XHR requests**
- **40+ OPTIONS preflight requests**
- Many duplicate calls to the same endpoints

## Solution Implemented

### 1. React Query Installation & Configuration

**File:** `src/config/queryClient.js`

Configured React Query with optimized settings:
- **Stale Time:** 1 minute (data is fresh for this duration)
- **Cache Time:** 5 minutes (unused data stays in cache)
- **Automatic Retry:** 2 attempts with exponential backoff
- **Request Deduplication:** Enabled by default
- **No refetch on window focus:** Reduces unnecessary calls

### 2. Centralized Query Keys

Implemented a query keys factory for consistency:
```javascript
export const queryKeys = {
  user: {
    me: () => ['user', 'me']
  },
  product: {
    bySlug: (slug, storeId, lang) => ['product', 'slug', slug, storeId, lang]
  },
  wishlist: {
    items: (storeId) => ['wishlist', 'items', storeId]
  },
  // ... and more
}
```

### 3. Custom React Query Hooks

**File:** `src/hooks/useApiQueries.js`

Created optimized hooks for the most frequently called APIs:

| Hook | Purpose | Stale Time | Cache Time |
|------|---------|------------|------------|
| `useUser()` | Fetch current user (auth/me) | 5 min | 10 min |
| `useProduct()` | Fetch product by slug | 2 min | 5 min |
| `useWishlist()` | Fetch wishlist items | 30 sec | 1 min |
| `useTranslations()` | Fetch UI labels | 10 min | 30 min |
| `useCategories()` | Fetch categories | 5 min | 10 min |
| `useTaxes()` | Fetch taxes | 5 min | 10 min |

**Key Features:**
- Automatic request deduplication
- Intelligent caching with TTL
- Built-in retry logic
- Loading/error state management
- Mutation hooks for add/remove operations

### 4. Component Refactoring

#### ProductDetail.jsx

**Before:**
```javascript
// Manual loading state
const [loading, setLoading] = useState(true);
const [user, setUser] = useState(null);
const [product, setProduct] = useState(null);

// Manual user fetch
useEffect(() => {
  const loadUser = async () => {
    const userData = await User.me();
    setUser(userData);
  };
  loadUser();
}, []);

// Manual product fetch
const loadProductData = async () => {
  setLoading(true);
  const response = await fetch(`/api/public/products/by-slug/${slug}/full?...`);
  // ... handling
  setLoading(false);
};
```

**After:**
```javascript
// React Query hooks with automatic caching & deduplication
const { data: user } = useUser();
const {
  data: productData,
  isLoading: productLoading,
  error: productError
} = useProduct(slug, store?.id, {
  enabled: !storeLoading && !!store?.id && !!slug
});

// Loading state automatically managed
const loading = storeLoading || productLoading;
```

**Impact:**
- ✅ Eliminated duplicate product fetch calls
- ✅ Removed manual loading state management
- ✅ Automatic retry on failure
- ✅ Request deduplication across components

#### WishlistDropdown.jsx

**Before:**
```javascript
// Manual retry logic (up to 5 attempts)
const retryApiCall = async (apiCall, maxRetries = 5, baseDelay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      // Complex retry logic with exponential backoff
      const delayTime = baseDelay * Math.pow(2, i) + Math.random() * 500;
      await delay(delayTime);
    }
  }
};

// Manual loading and data management
const loadWishlistItems = async () => {
  setLoading(true);
  const items = await retryApiCall(() => CustomerWishlist.getItems(store?.id));
  // ... complex error handling
  setLoading(false);
};
```

**After:**
```javascript
// React Query handles everything
const { data: wishlistData = [], isLoading, refetch } = useWishlist(store?.id);
const removeFromWishlist = useRemoveFromWishlist();

// Simple mutation call
const handleRemoveFromWishlist = async (productId) => {
  await removeFromWishlist.mutateAsync({ productId, storeId: store?.id });
};
```

**Impact:**
- ✅ Removed manual retry logic (React Query handles this better)
- ✅ Reduced API calls from 4x to 1x
- ✅ Automatic cache invalidation on mutations
- ✅ Consistent error handling

### 5. App-Wide Integration

**File:** `src/App.jsx`

Added QueryClientProvider at the root level:
```javascript
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/config/queryClient';

return (
  <QueryClientProvider client={queryClient}>
    <TranslationProvider>
      {/* ... other providers */}
    </TranslationProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
);
```

## Expected Results

### API Call Reduction

| Endpoint | Before | After | Reduction |
|----------|--------|-------|-----------|
| `/api/auth/me` | 3+ calls | 1 call | 67%+ |
| `/api/public/products/by-slug/*` | 2 calls | 1 call | 50% |
| `/api/wishlist` | 4 calls | 1 call | 75% |
| `/api/translations/ui-labels` | 2+ calls | 1 call | 50%+ |

### Overall Impact

**Before:** ~80+ total XHR requests on product page load
**After (Expected):** ~30-40 total XHR requests
**Reduction:** ~50% fewer API calls

### Additional Benefits

1. **Improved Performance**
   - Faster page loads due to cached data
   - Reduced network bandwidth usage
   - Lower server load

2. **Better User Experience**
   - Faster UI response times
   - Stale-while-revalidate pattern keeps UI responsive
   - Consistent loading states

3. **Reduced OPTIONS Requests**
   - Cached responses reduce new requests
   - Fewer requests = fewer OPTIONS preflights
   - Expected 30-40% reduction in OPTIONS calls

4. **Simplified Code**
   - No manual retry logic needed
   - Automatic loading/error states
   - Centralized cache management

5. **Developer Experience**
   - React Query DevTools for debugging
   - Consistent API patterns
   - Easy to add new cached endpoints

## How Request Deduplication Works

React Query automatically deduplicates requests:

```javascript
// Multiple components calling the same hook simultaneously
function ComponentA() {
  const { data } = useUser(); // Triggers API call
}

function ComponentB() {
  const { data } = useUser(); // Uses same request, doesn't duplicate!
}

function ComponentC() {
  const { data } = useUser(); // Also uses same request!
}
```

**Result:** Only 1 API call made, all 3 components receive the data.

## Migration Guide for Other Components

To optimize other components:

1. **Identify frequent API calls**
   ```javascript
   // Before
   const [data, setData] = useState(null);
   useEffect(() => {
     const fetchData = async () => {
       const result = await api.get('/endpoint');
       setData(result);
     };
     fetchData();
   }, []);
   ```

2. **Create a custom hook** (if not exists)
   ```javascript
   // In src/hooks/useApiQueries.js
   export const useCustomData = (id, options = {}) => {
     return useQuery({
       queryKey: ['customData', id],
       queryFn: async () => {
         const result = await api.get(`/endpoint/${id}`);
         return result;
       },
       staleTime: 60000,
       ...options
     });
   };
   ```

3. **Use the hook in your component**
   ```javascript
   // After
   import { useCustomData } from '@/hooks/useApiQueries';

   const { data, isLoading, error } = useCustomData(id);
   ```

## Testing Recommendations

1. **Monitor Network Tab**
   - Open DevTools > Network
   - Filter by XHR
   - Load product page and count API calls
   - Verify ~50% reduction

2. **Check React Query DevTools**
   - Click the React Query icon in bottom corner
   - View active queries and their cache status
   - Verify queries are being cached correctly

3. **Test Cache Behavior**
   - Navigate to product page
   - Go back to category page
   - Return to same product page
   - Should load instantly from cache

4. **Test Simultaneous Requests**
   - Open multiple components that use same data
   - Verify only 1 API call is made

## CORS Optimization (Backend)

To further reduce OPTIONS preflight requests, consider backend CORS configuration:

```javascript
// Example Express.js CORS config
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true,
  maxAge: 86400, // Cache preflight for 24 hours
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Language']
}));
```

**Benefits:**
- Browsers cache preflight responses for 24 hours
- Reduces OPTIONS requests by ~80%
- Improves performance for returning users

## Monitoring & Analytics

Consider adding metrics to track:
- Total API calls per page load
- Cache hit rate
- Average response times
- Error rates by endpoint

## Next Steps

1. **Deploy and Monitor**
   - Deploy changes to staging
   - Monitor API call reduction
   - Check for any errors or issues

2. **Extend to Other Components**
   - Identify other high-traffic components
   - Apply React Query hooks
   - Measure improvement

3. **Backend Optimization**
   - Update CORS configuration
   - Add cache headers where appropriate
   - Consider backend caching layer

4. **Performance Testing**
   - Run Lighthouse audits
   - Compare before/after metrics
   - Document improvements

## Troubleshooting

### Issue: Data not updating after mutation
**Solution:** Ensure mutation hooks invalidate the correct query keys:
```javascript
const mutation = useMutation({
  mutationFn: updateData,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['dataKey'] });
  }
});
```

### Issue: Too many API calls still
**Solution:** Check staleTime configuration - increase if data changes infrequently:
```javascript
const { data } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 600000 // 10 minutes instead of default
});
```

### Issue: Stale data displayed
**Solution:** Force refetch on specific events:
```javascript
const { refetch } = useQuery({...});
// Later
refetch(); // Force fresh data
```

## Conclusion

This optimization significantly reduces API calls through:
- ✅ Automatic request deduplication
- ✅ Intelligent caching with TTL
- ✅ Optimized retry logic
- ✅ Simplified component code
- ✅ Better user experience

**Expected Outcome:** ~50% reduction in total API calls, leading to faster page loads, reduced server load, and improved user experience.

---

**Date:** 2025-10-26
**Version:** 1.0
**Status:** Implemented, Ready for Testing
