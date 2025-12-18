# Product Images: Performance Analysis - JSONB vs Separate Table

## TL;DR Recommendation

**Use `product_images` separate table** for better performance, scalability, and flexibility.

---

## Option 1: JSONB Column (`product.images`)

### Current Implementation
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  images JSONB DEFAULT '[]'
);

-- Example data:
{
  "images": [
    {"url": "img1.jpg", "alt": "Main", "position": 1, "isPrimary": true},
    {"url": "img2.jpg", "alt": "Side", "position": 2},
    {"url": "img3.jpg", "alt": "Back", "position": 3}
  ]
}
```

### ✅ Pros
1. **Single query** - Get product + all images in one SELECT
2. **Simpler code** - No JOIN needed
3. **Atomic updates** - Update images with product in one transaction
4. **Good for small datasets** - 3-5 images per product

### ❌ Cons
1. **Poor indexing** - Can't index individual images efficiently
2. **Full column rewrite** - Adding/updating one image rewrites entire JSONB
3. **Size limits** - JSONB max ~1GB but practical limit much lower
4. **No foreign keys** - Can't reference individual images
5. **Duplicate data** - Same image URL stored multiple times if used by multiple products
6. **CDN/Storage integration** - Hard to track which images are used, for cleanup
7. **Image search** - Can't efficiently search/filter by image properties
8. **Sorting** - Complex to sort products by image count or properties
9. **Bulk operations** - Can't bulk update image properties across products

### Performance Impact
```sql
-- Finding products with >3 images (SLOW - full table scan)
SELECT * FROM products
WHERE jsonb_array_length(images) > 3;

-- Getting image count per product (SLOW - sequential scan)
SELECT id, jsonb_array_length(images) as image_count
FROM products;

-- Finding all products using specific image URL (VERY SLOW)
SELECT * FROM products
WHERE images @> '[{"url": "specific-image.jpg"}]';
```

---

## Option 2: Separate `product_images` Table

### Proposed Implementation
```sql
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) DEFAULT 'image' CHECK (file_type IN ('image', 'video', 'document', '3d_model')),
  position INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  alt_text TEXT,
  title TEXT,
  file_size INTEGER, -- bytes
  mime_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  metadata JSONB DEFAULT '{}', -- Extra data: shopify_id, color_variant, etc.
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_product_images_product ON product_images(product_id, position);
CREATE INDEX idx_product_images_primary ON product_images(product_id, is_primary);
CREATE INDEX idx_product_images_store ON product_images(store_id);
CREATE INDEX idx_product_images_url ON product_images(file_url); -- For duplicate detection
CREATE UNIQUE INDEX idx_product_images_product_position ON product_images(product_id, position);
```

### ✅ Pros
1. **Proper indexing** - Fast lookups on any column
2. **Individual updates** - Add/update/delete single images efficiently
3. **No size limits** - Unlimited images per product
4. **Foreign key integrity** - Proper referential constraints
5. **Deduplication** - Same image can be referenced multiple times
6. **Easy queries** - Find products by image properties, count, etc.
7. **CDN/Storage tracking** - Know which images are used, safe to delete unused
8. **Image-centric queries** - "Show me all products using this image"
9. **Sorting & filtering** - "Products with >5 images", "Products without primary image"
10. **Analytics** - Image usage stats, popular images, etc.
11. **Future features** - Image variants (thumbnails), lazy loading, progressive images

### ❌ Cons
1. **Extra JOIN** - Need to JOIN to get images (but indexed JOINs are fast)
2. **Two queries** - Or one query with JOIN
3. **Slightly more complex** - Need to manage relationship

### Performance Impact
```sql
-- Finding products with >3 images (FAST - index scan)
SELECT product_id, COUNT(*) as image_count
FROM product_images
GROUP BY product_id
HAVING COUNT(*) > 3;

-- Getting image count per product (FAST - index scan)
SELECT product_id, COUNT(*)
FROM product_images
GROUP BY product_id;

-- Finding all products using specific image (FAST - index lookup)
SELECT DISTINCT product_id
FROM product_images
WHERE file_url = 'specific-image.jpg';

-- Get product with images (FAST - indexed JOIN)
SELECT p.*,
       json_agg(
         json_build_object(
           'url', pi.file_url,
           'alt', pi.alt_text,
           'position', pi.position,
           'isPrimary', pi.is_primary
         ) ORDER BY pi.position
       ) as images
FROM products p
LEFT JOIN product_images pi ON pi.product_id = p.id
WHERE p.id = 'product-uuid'
GROUP BY p.id;
```

---

## Performance Benchmarks (Estimated)

| Operation | JSONB Column | Separate Table | Winner |
|-----------|-------------|----------------|---------|
| **Get product + images** | 1ms (single query) | 2ms (JOIN) | JSONB (slightly) |
| **Add image** | 5-10ms (full JSONB rewrite) | 1ms (single INSERT) | ✅ **Table** |
| **Update one image** | 5-10ms (full JSONB rewrite) | 1ms (single UPDATE) | ✅ **Table** |
| **Delete one image** | 5-10ms (full JSONB rewrite) | 1ms (single DELETE) | ✅ **Table** |
| **Find products with >N images** | 100-500ms (seq scan) | 5ms (index scan) | ✅ **Table** |
| **Find products using image** | 100-500ms (seq scan) | 2ms (index lookup) | ✅ **Table** |
| **Get image count** | 50-100ms (jsonb function) | 2ms (COUNT) | ✅ **Table** |
| **Bulk image updates** | Slow (N full rewrites) | Fast (N single UPDATEs) | ✅ **Table** |
| **Image deduplication** | Impossible | Easy (file_url index) | ✅ **Table** |

---

## Real-World Use Cases

### E-commerce Requirements
1. ✅ **Primary image selection** - Customers change primary image
2. ✅ **Image reordering** - Drag & drop image position
3. ✅ **Bulk image upload** - Upload 10+ images at once
4. ✅ **Image variants** - Same product in different colors
5. ✅ **Image analytics** - Which images get clicks
6. ✅ **CDN management** - Remove unused images
7. ✅ **Storage optimization** - Find large images
8. ✅ **Multi-format** - Images, videos, 360° views, PDFs

### API Performance
```javascript
// Option 1: JSONB (Current)
GET /api/products/:id
// Returns: { id, name, images: [...] }
// Performance: 1ms ✅ Fast

POST /api/products/:id/images
// Updates entire JSONB array
// Performance: 10ms ❌ Slow (rewrites all images)

// Option 2: Separate Table (Recommended)
GET /api/products/:id
// Returns: { id, name, images: [...] }  (with JOIN)
// Performance: 2ms ✅ Still fast

POST /api/products/:id/images
// Inserts single row
// Performance: 1ms ✅ Very fast

PUT /api/products/:id/images/:imageId/reorder
// Updates single row position
// Performance: 1ms ✅ Very fast

DELETE /api/products/:id/images/:imageId
// Deletes single row
// Performance: 1ms ✅ Very fast
```

---

## Storage Comparison

### JSONB Approach
```
10,000 products × 5 images each = 50,000 images

Storage in products table JSONB:
- Each image object: ~200 bytes
- 5 images × 200 bytes = 1KB per product
- 10,000 products × 1KB = 10MB
- ✅ Compact storage
```

### Separate Table Approach
```
10,000 products × 5 images each = 50,000 images

Storage in product_images table:
- Each image row: ~400 bytes (with indexes)
- 50,000 images × 400 bytes = 20MB
- ❌ 2x storage (but indexes provide value)
- ✅ Much faster queries
```

**Verdict:** 2x storage is worth it for 10-100x faster queries

---

## Migration Impact

### Current System (JSONB)
```javascript
// Frontend expects:
product.images = [
  {url: "...", alt: "...", isPrimary: true},
  {url: "...", alt: "...", position: 2}
]
```

### New System (product_images table)
```javascript
// Backend transforms for frontend compatibility:
SELECT p.*,
       json_agg(
         json_build_object(
           'url', pi.file_url,
           'alt', pi.alt_text,
           'isPrimary', pi.is_primary,
           'position', pi.position
         ) ORDER BY pi.position
       ) as images
FROM products p
LEFT JOIN product_images pi ON pi.product_id = p.id
GROUP BY p.id;

// Frontend gets same structure - no changes needed!
```

---

## Recommendation: Use Separate Table

### Why?
1. **Performance** - 10-100x faster for most operations
2. **Scalability** - Handles unlimited images per product
3. **Flexibility** - Supports videos, PDFs, 3D models
4. **Analytics** - Track image usage, clicks, etc.
5. **CDN management** - Know which files are safe to delete
6. **Future-proof** - Supports image variants, lazy loading, etc.

### When to Use JSONB?
- **Very simple use case** - Only 1-2 images, never updated
- **Read-heavy, write-once** - Images set during import, never changed
- **Embedded data** - Data that's truly part of the product (like dimensions)

### For E-commerce: Separate Table Wins
- ✅ Images change frequently
- ✅ Need image management UI
- ✅ Need analytics and tracking
- ✅ Need to support multiple file types
- ✅ Need good performance at scale

---

## Implementation Plan

### Phase 1: Create Table (Immediate)
```sql
CREATE TABLE product_images (...);
-- Keep product.images JSONB for backward compatibility
```

### Phase 2: Dual Write (Transition)
```javascript
// Write to both places during migration
await db.insert('product_images', imageData);
await db.update('products', {images: jsonbArray});
```

### Phase 3: Migrate Reads (Gradual)
```javascript
// Update API to read from product_images
// Transform to JSONB format for frontend
```

### Phase 4: Remove JSONB (Future)
```sql
-- Once fully migrated, remove JSONB column
ALTER TABLE products DROP COLUMN images;
```

---

## Final Verdict

**Use `product_images` separate table** ✅

The performance benefits far outweigh the minor complexity of JOINs. For an e-commerce platform handling thousands of products and images, the separate table approach is the industry standard for good reason.
