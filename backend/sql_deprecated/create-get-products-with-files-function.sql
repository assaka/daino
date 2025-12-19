-- Create RPC function to get products with their files (images, videos, etc.)
-- This function aggregates product_files into a JSONB array for backward compatibility

CREATE OR REPLACE FUNCTION get_products_with_files(
  p_store_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_status VARCHAR DEFAULT NULL,
  p_limit INTEGER DEFAULT NULL,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  slug VARCHAR,
  sku VARCHAR,
  barcode VARCHAR,
  short_description TEXT,
  price NUMERIC,
  compare_price NUMERIC,
  cost_price NUMERIC,
  weight NUMERIC,
  dimensions JSONB,
  images JSONB,  -- Aggregated from product_files
  status VARCHAR,
  visibility VARCHAR,
  manage_stock BOOLEAN,
  stock_quantity INTEGER,
  allow_backorders BOOLEAN,
  low_stock_threshold INTEGER,
  infinite_stock BOOLEAN,
  is_custom_option BOOLEAN,
  is_coupon_eligible BOOLEAN,
  featured BOOLEAN,
  tags JSONB,
  attributes JSONB,
  seo JSONB,
  store_id UUID,
  attribute_set_id UUID,
  category_ids JSONB,
  related_product_ids JSONB,
  sort_order INTEGER,
  view_count INTEGER,
  purchase_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  external_id VARCHAR,
  external_source VARCHAR,
  meta_title VARCHAR,
  meta_description TEXT,
  url_key VARCHAR,
  seo_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.slug,
    p.sku,
    p.barcode,
    p.short_description,
    p.price,
    p.compare_price,
    p.cost_price,
    p.weight,
    p.dimensions,
    -- Aggregate images from product_files table
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', pf.id,
          'url', pf.file_url,
          'alt', pf.alt_text,
          'title', pf.title,
          'position', pf.position,
          'isPrimary', pf.is_primary,
          'fileType', pf.file_type,
          'fileSize', pf.file_size,
          'mimeType', pf.mime_type,
          'width', (pf.metadata->>'width')::INTEGER,
          'height', (pf.metadata->>'height')::INTEGER,
          'duration', (pf.metadata->>'duration')::INTEGER,
          'metadata', pf.metadata
        ) ORDER BY pf.position
      )
      FROM product_files pf
      WHERE pf.product_id = p.id
        AND pf.file_type = 'image'),
      '[]'::json
    )::jsonb as images,
    p.status,
    p.visibility,
    p.manage_stock,
    p.stock_quantity,
    p.allow_backorders,
    p.low_stock_threshold,
    p.infinite_stock,
    p.is_custom_option,
    p.is_coupon_eligible,
    p.featured,
    p.tags,
    p.attributes,
    p.seo,
    p.store_id,
    p.attribute_set_id,
    p.category_ids,
    p.related_product_ids,
    p.sort_order,
    p.view_count,
    p.purchase_count,
    p.created_at,
    p.updated_at,
    p.external_id,
    p.external_source,
    p.meta_title,
    p.meta_description,
    p.url_key,
    p.seo_data
  FROM products p
  WHERE (p_store_id IS NULL OR p.store_id = p_store_id)
    AND (p_product_id IS NULL OR p.id = p_product_id)
    AND (p_status IS NULL OR p.status = p_status)
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comment on function
COMMENT ON FUNCTION get_products_with_files IS 'Get products with their files (images, videos, etc.) aggregated from product_files table. Returns products with images in JSONB format for frontend compatibility.';

-- Example usage:
-- SELECT * FROM get_products_with_files(p_store_id := 'your-store-uuid');
-- SELECT * FROM get_products_with_files(p_product_id := 'product-uuid');
-- SELECT * FROM get_products_with_files(p_store_id := 'store-uuid', p_status := 'active', p_limit := 10);
