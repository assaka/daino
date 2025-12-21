# Frontend Migration Guide - API Response Structure Changes

## Overview

The category and product APIs now return structured responses instead of plain arrays. This guide helps you migrate your frontend code.

## Quick Reference

### API Response Changes

| Endpoint | Old Response | New Response |
|----------|-------------|--------------|
| GET /api/public/categories | `Array` | `{ success, data: Array, pagination }` |
| GET /api/public/products | `Array` | `{ success, data: Array, pagination }` |
| GET /api/public/categories/by-slug/:slug/full | `{ category, products, total }` | `{ success, data: { category, products, total } }` |
| GET /api/public/products/by-slug/:slug/full | `{ product, productTabs, ... }` | `{ success, data: { product, productTabs, ... } }` |

## Migration Patterns

### Pattern 1: List Endpoints (Categories/Products)

**Before:**
```javascript
const categories = await fetch('/api/public/categories?store_id=xxx')
  .then(r => r.json());

// categories is an array
categories.forEach(cat => console.log(cat.name));
```

**After:**
```javascript
const response = await fetch('/api/public/categories?store_id=xxx')
  .then(r => r.json());

// response is { success, data, pagination }
const { data: categories, pagination } = response;
categories.forEach(cat => console.log(cat.name));

console.log(`Page ${pagination.page} of ${pagination.totalPages}`);
console.log(`Total categories: ${pagination.total}`);
```

### Pattern 2: Detail Endpoints with Multiple Data

**Before:**
```javascript
const data = await fetch('/api/public/products/by-slug/my-product/full?store_id=xxx')
  .then(r => r.json());

const product = data.product;
const tabs = data.productTabs;
const labels = data.productLabels;
```

**After:**
```javascript
const response = await fetch('/api/public/products/by-slug/my-product/full?store_id=xxx')
  .then(r => r.json());

const { product, productTabs: tabs, productLabels: labels } = response.data;
```

### Pattern 3: React/Vue Component Usage

**React - Before:**
```jsx
const [categories, setCategories] = useState([]);

useEffect(() => {
  fetch('/api/public/categories?store_id=xxx')
    .then(r => r.json())
    .then(data => setCategories(data));
}, []);
```

**React - After:**
```jsx
const [categories, setCategories] = useState([]);
const [pagination, setPagination] = useState(null);

useEffect(() => {
  fetch('/api/public/categories?store_id=xxx')
    .then(r => r.json())
    .then(response => {
      setCategories(response.data);
      setPagination(response.pagination);
    });
}, []);

// Now you can use pagination data
{pagination && (
  <div>
    Page {pagination.page} of {pagination.totalPages}
    (Total: {pagination.total} items)
  </div>
)}
```

## Files to Update

### Search for these patterns in your frontend code:

1. **Direct .json() assignment to arrays:**
   ```javascript
   // FIND: const categories = await response.json();
   // REPLACE: const { data: categories } = await response.json();
   ```

2. **Accessing nested data:**
   ```javascript
   // FIND: const product = data.product;
   // REPLACE: const product = data.data.product;
   ```

3. **Array operations on API responses:**
   ```javascript
   // FIND: response.json().then(items => items.map(...))
   // REPLACE: response.json().then(res => res.data.map(...))
   ```

## Automated Search Commands

Run these in your frontend directory to find files that need updates:

```bash
# Find category API calls
grep -r "'/api/public/categories" src/

# Find product API calls
grep -r "'/api/public/products" src/

# Find .json() followed by array operations
grep -r "\.json()\.then.*\.map\|\.forEach\|\.filter" src/
```

## Common Locations

Check these files/directories:

- `src/pages/storefront/Category.jsx` - Category page
- `src/pages/storefront/Product.jsx` - Product detail page
- `src/components/storefront/CategoryNav.jsx` - Category navigation
- `src/services/` - API service files
- `src/hooks/` - Custom hooks that fetch data

## Testing Checklist

After migration, test:

- [ ] Category listing page loads
- [ ] Category navigation menu works
- [ ] Category detail page with products works
- [ ] Product listing page loads
- [ ] Product detail page with tabs/labels works
- [ ] Pagination controls work (if implemented)
- [ ] Search functionality works
- [ ] Filters work on category/product pages

## Example: Complete Migration

**Before (src/services/categoryService.js):**
```javascript
export const getCategories = async (storeId) => {
  const response = await fetch(`/api/public/categories?store_id=${storeId}`);
  return response.json(); // Returns array
};

export const getCategoryWithProducts = async (slug, storeId) => {
  const response = await fetch(`/api/public/categories/by-slug/${slug}/full?store_id=${storeId}`);
  return response.json(); // Returns { category, products, total }
};
```

**After:**
```javascript
export const getCategories = async (storeId, page = 1, limit = 100) => {
  const response = await fetch(
    `/api/public/categories?store_id=${storeId}&page=${page}&limit=${limit}`
  );
  const result = await response.json();

  return {
    categories: result.data,
    pagination: result.pagination
  };
};

export const getCategoryWithProducts = async (slug, storeId) => {
  const response = await fetch(
    `/api/public/categories/by-slug/${slug}/full?store_id=${storeId}`
  );
  const result = await response.json();

  return result.data; // Returns { category, products, total }
};
```

## Bonus: Pagination Helper

```javascript
// src/utils/pagination.js
export const usePagination = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const updatePagination = (pagination) => {
    setCurrentPage(pagination.page);
    setTotalPages(pagination.totalPages);
    setTotal(pagination.total);
  };

  return {
    currentPage,
    totalPages,
    total,
    updatePagination,
    nextPage: () => setCurrentPage(p => Math.min(p + 1, totalPages)),
    prevPage: () => setCurrentPage(p => Math.max(p - 1, 1)),
    goToPage: setCurrentPage
  };
};
```

## Error Handling

All responses now include a `success` field:

```javascript
const response = await fetch('/api/public/categories?store_id=xxx')
  .then(r => r.json());

if (!response.success) {
  console.error('API Error:', response.message);
  return;
}

const categories = response.data;
```

## Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Verify the API is returning the new format
3. Check that you're accessing `response.data` instead of `response` directly
4. Ensure pagination logic accounts for the new structure
