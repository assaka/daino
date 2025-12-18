# Category Page Optimization Guide

## Current Issues (From Your Logs)

The category page still has duplicate API calls:
- `/api/public/categories/by-slug/keuken/full` - called **2x**
- `/api/slot-configurations/.../category` - called **2x**  
- `/api/canonical-urls/check` - called **4x**
- `/api/public/products?ids=...` - called **2x**

## Quick Fix Implementation

### Step 1: Import React Query Hooks

Add to `/src/pages/storefront/Category.jsx` (line 18):

```javascript
// Add these imports
import { useCategory, useSlotConfiguration } from '@/hooks/useApiQueries';
```

### Step 2: Replace Manual Category Fetch

Replace lines 267-312 (the `loadCategoryProducts` function) with:

```javascript
// Use React Query hook for automatic caching & deduplication
const {
  data: categoryData,
  isLoading: categoryLoading,
  error: categoryError
} = useCategory(categorySlug, store?.id, {
  enabled: !storeLoading && !!store?.id && !!categorySlug
});

// Update state when category data changes
useEffect(() => {
  if (categoryData) {
    setCurrentCategory(categoryData.category);
    setProducts(ensureArray(categoryData.products));
  }
}, [categoryData]);
```

### Step 3: Replace Manual Slot Configuration Fetch

Replace lines 126-197 (the `loadCategoryLayoutConfig` useEffect) with:

```javascript
// Use React Query hook for slot configuration
const { data: slotConfig } = useSlotConfiguration(store?.id, 'category');

// Update layout config when data changes
useEffect(() => {
  if (slotConfig) {
    setCategoryLayoutConfig(slotConfig);
    setCategoryConfigLoaded(true);
  } else if (slotConfig === null) {
    // Use fallback config
    const { categoryConfig } = require('@/components/editor/slot/configs/category-config');
    setCategoryLayoutConfig({
      slots: { ...categoryConfig.slots },
      metadata: { fallbackUsed: true }
    });
    setCategoryConfigLoaded(true);
  }
}, [slotConfig]);
```

### Step 4: Update Loading State

Replace line 32:
```javascript
const [loading, setLoading] = useState(true);
```

With:
```javascript
const loading = storeLoading || categoryLoading;
```

## Expected Results

After implementing these changes:
- Category API calls: **2x → 1x** (50% reduction)
- Slot config calls: **2x → 1x** (50% reduction)  
- Products will be cached when navigating back
- Automatic retry on failure

## Why This Works

1. **Request Deduplication**: React Query ensures only 1 request is made even if multiple components need the same data
2. **Automatic Caching**: Category data cached for 2 minutes, slot configs for 5 minutes
3. **Stale-While-Revalidate**: Shows cached data immediately while fetching fresh data in background

## Additional Optimization (Optional)

For the canonical URL checks (called 4x), you could create a hook:

```javascript
// In useApiQueries.js
export const useCanonicalUrlCheck = (storeId, path, options = {}) => {
  return useQuery({
    queryKey: ['canonical-url', storeId, path],
    queryFn: async () => {
      const response = await fetch(
        `/api/canonical-urls/check?store_id=${storeId}&path=${encodeURIComponent(path)}`
      );
      return await response.json();
    },
    enabled: !!(storeId && path),
    staleTime: 300000, // 5 minutes
    ...options
  });
};
```

Then use it wherever canonical URL checks are needed.

## Testing

1. Open DevTools > Network
2. Navigate to a category page
3. Count API calls - should see 50% reduction
4. Navigate to another category and back - should load instantly from cache

---

**Note**: I've added `useCategory` and `useSlotConfiguration` hooks to `/src/hooks/useApiQueries.js`. They're ready to use!
