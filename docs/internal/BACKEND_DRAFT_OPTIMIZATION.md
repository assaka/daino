# Backend Draft Creation Optimization

## Current Implementation

The frontend now sends the full static configuration to the backend when requesting draft configurations. This allows the backend to create drafts with complete default slot configurations in a single API call instead of the previous two-call approach.

## API Changes Required

### New Endpoint: POST `/slot-configurations/draft/{storeId}/{pageType}`

**Request Body:**
```json
{
  "staticConfiguration": {
    "page_name": "Category",
    "slot_type": "category_layout",
    "slots": {
      "header": {
        "id": "header",
        "name": "Category Header",
        "component": "category-header",
        "content": "<h1>Category Name</h1>",
        "className": "category-header",
        "styles": {},
        "position": { "colStart": 1, "colSpan": 12, "rowStart": 1, "rowSpan": 1 },
        "visible": true,
        "locked": false
      },
      "breadcrumbs": { /* ... */ },
      "filters": { /* ... */ },
      "pagination": { /* ... */ }
    },
    "metadata": {
      "created": "2025-09-21T13:35:46.427Z",
      "lastModified": "2025-09-21T13:35:46.427Z",
      "version": "1.0",
      "pageType": "category"
    },
    "cmsBlocks": []
  }
}
```

**Response:** Same as existing GET endpoint

### Backend Logic

1. **Check if draft exists** for the given `storeId` and `pageType`
2. **If draft exists:** Return existing draft (same as current behavior)
3. **If no draft exists:** Create new draft using the provided `staticConfiguration` instead of empty slots

### Fallback Compatibility

The frontend includes fallback logic:
- If POST fails → Falls back to GET (current endpoint)
- If backend returns empty slots → Uses static config on frontend

This ensures the system works during the transition period.

## Page Type Configurations

Each page type gets different default slots:

- **Category**: header, breadcrumbs, filters, pagination
- **Homepage**: hero, featured, categories, products, newsletter, brands
- **Product**: breadcrumbs, gallery, info, tabs, related, reviews
- **Checkout**: header, steps, form, summary, payment
- **Cart**: No defaults (empty slots) - full customization

## Benefits

- **Single API call** instead of two
- **Complete configurations** created immediately
- **Better performance** - no empty slots → populate cycle
- **Cleaner architecture** - backend handles initial setup

## Implementation Priority

1. Update backend to handle POST endpoint with staticConfiguration
2. Test with each page type
3. Remove frontend fallback logic once backend is updated
4. Clean up debug logging

## Migration Notes

- Frontend is backward compatible with current GET endpoint
- No breaking changes during transition
- Old behavior maintained until backend is updated