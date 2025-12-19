-- Add 'image' type to attributes enum
-- This migration adds the new 'image' type to the existing attribute type enum

-- Add 'image' to the enum
ALTER TYPE "enum_attributes_type" ADD VALUE 'image';

-- Create a default base image attribute for existing stores that don't have one
INSERT INTO attributes (id, name, code, type, is_required, is_filterable, is_searchable, is_usable_in_conditions, file_settings, sort_order, store_id, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'Base Image',
    'base_image',
    'image',
    false,
    false,
    false,
    false,
    '{"allowed_extensions": ["jpg", "jpeg", "png", "gif", "webp", "svg"], "max_file_size": 10}',
    0,
    s.id,
    NOW(),
    NOW()
FROM stores s
WHERE NOT EXISTS (
    SELECT 1 FROM attributes a 
    WHERE a.store_id = s.id 
    AND a.code = 'base_image'
    AND a.type IN ('image', 'file')
);