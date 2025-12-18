# Magento-Style Upload Implementation

## Overview
Successfully implemented category, product, and file manager image/file uploads using Supabase storage with Magento-style directory structure.

## Directory Structure
The system uses Magento-style paths within Supabase Storage buckets based on the first two characters of the filename:
- `testimage.png` → `t/e/testimage.png`
- `product.jpg` → `p/r/product.jpg`
- `a.png` → `a/a/a.png`
- Files with non-alphanumeric names → `misc/filename.ext`

## Supabase Storage Configuration
- **suprshop-catalog**: Main image storage bucket
  - `/categories/` - Category images with Magento-style paths
  - `/products/` - Product images with Magento-style paths
- **suprshop-assets**: Public assets bucket
  - `/assets/` - General assets and files with Magento-style paths

All files are stored in Supabase Storage and return public URLs in the format:
`https://[project-id].supabase.co/storage/v1/object/public/[bucket]/[path]`

## Implementation Details

### 1. Core Service Updates

#### supabase-storage.js
- Added `generateMagentoPath()` function for path generation
- Updated `uploadImage()` and `uploadImageDirect()` to support `useMagentoStructure` option
- Maintains backward compatibility with legacy path structure

### 2. Route Implementations

#### category-images.js
- **POST** `/api/stores/:store_id/categories/:categoryId/image` - Upload main category image
- **POST** `/api/stores/:store_id/categories/:categoryId/banner` - Upload banner image
- **GET** `/api/stores/:store_id/categories/:categoryId/images` - Get all category images
- **DELETE** `/api/stores/:store_id/categories/:categoryId/image` - Delete main image
- **DELETE** `/api/stores/:store_id/categories/:categoryId/banners/:bannerId` - Delete banner

#### product-images.js
- **POST** `/api/stores/:store_id/products/:productId/images` - Upload product images
- **PUT** `/api/stores/:store_id/products/:productId/images/:imageId` - Update image metadata
- **DELETE** `/api/stores/:store_id/products/:productId/images/:imageId` - Delete image
- **GET** `/api/stores/:store_id/products/:productId/images` - Get all product images
- **POST** `/api/stores/:store_id/products/:productId/images/reorder` - Reorder images

#### file-manager.js (NEW)
- **POST** `/api/file-manager/upload` - Upload single file with Magento structure
- **POST** `/api/file-manager/upload-multiple` - Upload multiple files
- **GET** `/api/file-manager/list` - List files in directory
- **DELETE** `/api/file-manager/delete` - Delete file
- **GET** `/api/file-manager/stats` - Get storage statistics

### 3. Features

#### Upload Options
```javascript
{
  useMagentoStructure: true,  // Enable Magento-style paths
  type: 'category' | 'product' | 'asset',  // File type
  filename: 'custom-name.png',  // Override filename
  public: true,  // Public access
  metadata: { ... }  // Custom metadata
}
```

#### Path Examples
```
/suprshop-catalog/categories/t/e/test-category.png
/suprshop-catalogproducts/p/r/product-image.jpg
/suprshop-assets/assets/d/o/document.pdf
```

### 4. Authentication & Permissions
- All routes require authentication via `authMiddleware`
- Store ownership verification via `checkStoreOwnership`
- Service role key required for Supabase storage operations

### 5. Testing

#### Test Script
Created `backend/test-magento-uploads.js` for testing:
```bash
node backend/test-magento-uploads.js
```

#### Manual Testing with cURL
```bash
# Upload category image
curl -X POST http://localhost:5000/api/file-manager/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "x-store-id: 157d4590-49bf-4b0b-bd77-abe131909528" \
  -F "file=@test.png" \
  -F "type=category"

# Upload product image
curl -X POST http://localhost:5000/api/stores/157d4590-49bf-4b0b-bd77-abe131909528/products/PRODUCT_ID/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "images=@product.jpg"
```

## Configuration Requirements

### Supabase Setup
1. Service role key must be configured
2. Buckets will be auto-created on first use:
   - `suprshop-catalog` (public, 10MB limit)
   - `suprshop-assets` (public, 10MB limit)

### Environment Variables
```env
SUPABASE_OAUTH_CLIENT_ID=your_client_id
SUPABASE_OAUTH_CLIENT_SECRET=your_client_secret
SUPABASE_OAUTH_REDIRECT_URI=http://localhost:5000/api/supabase/callback
```

## Error Handling
- RLS policy violations: Requires service role key configuration
- Missing buckets: Auto-created on first upload
- File size limits: 10MB for images, 20MB for general files
- Supported formats: JPEG, PNG, GIF, WebP, SVG, PDF, DOC, XLS, CSV, TXT

## Migration from Legacy Structure
The system maintains backward compatibility. Existing files in legacy structure (`store-{id}/filename.ext`) will continue to work while new uploads use Magento structure.

## Next Steps
1. Test upload functionality with actual images
2. Verify Supabase bucket creation
3. Configure service role key if not already done
4. Update frontend to use new endpoints

## Troubleshooting

### "new row violates row-level security policy"
- Ensure service role key is configured in Supabase integration settings
- Check `SUPABASE_STORAGE_FIX.md` for detailed solutions

### "Storage operations require service role key"
- The OAuth token alone is insufficient for storage operations
- Configure service role key via integration settings or environment variable

### Files not appearing in expected location
- Verify `useMagentoStructure: true` is set in upload options
- Check the `type` parameter matches expected value
- Review generated path in upload response