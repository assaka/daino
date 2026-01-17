/**
 * Product Tenant Helpers for Multi-Tenant Database Architecture
 *
 * These helpers fetch product data from tenant-specific databases using ConnectionManager
 */

const ConnectionManager = require('../services/database/ConnectionManager');
const { v4: uuidv4 } = require('uuid');

/**
 * Get products from tenant database with pagination
 *
 * @param {string} storeId - Store UUID
 * @param {Object} filters - Filter options {category_id, status, search, slug, sku, id}
 * @param {Object} pagination - Pagination options {limit, offset}
 * @returns {Promise<Object>} Products with count
 */
async function getProducts(storeId, filters = {}, pagination = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  // Supabase has a default max of 1000 rows per query - enforce this limit
  const SUPABASE_MAX_ROWS = 1000;
  const requestedLimit = pagination.limit || 100;
  const limit = Math.min(requestedLimit, SUPABASE_MAX_ROWS);
  const offset = pagination.offset || 0;

  // Build query with count option
  let query = tenantDb.from('products').select('*', { count: 'exact' });

  // Apply filters
  if (filters.category_id) {
    // category_ids is stored as JSON array
    query = query.contains('category_ids', [filters.category_id]);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.slug) {
    query = query.eq('slug', filters.slug);
  }
  if (filters.sku) {
    query = query.eq('sku', filters.sku);
  }
  if (filters.id) {
    query = query.eq('id', filters.id);
  }
  if (filters.search) {
    // Search in SKU only for now
    query = query.ilike('sku', `%${filters.search}%`);
  }
  if (filters.is_custom_option === true) {
    query = query.eq('is_custom_option', true);
  }

  // Get paginated data with count
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: products, error, count } = await query;

  if (error) throw error;

  return {
    rows: products || [],
    count: count || 0
  };
}

/**
 * Get product by ID from tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {string} productId - Product UUID
 * @returns {Promise<Object|null>} Product or null
 */
async function getProductById(storeId, productId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { data: product, error } = await tenantDb
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error) return null;

  return product;
}

/**
 * Create product in tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {Object} productData - Product data
 * @param {string} locale - Locale code (e.g., 'en_US') for translations
 * @returns {Promise<Object>} Created product
 */
async function createProduct(storeId, productData, locale = 'en_US') {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Extract translation fields, images, and attributes to sync separately
  // Note: attributes column was removed from products table - now stored in product_attribute_values
  const { name, description, short_description, images, attributes, ...productFields } = productData;

  const { data: product, error } = await tenantDb
    .from('products')
    .insert({
      ...productFields,
      store_id: storeId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // Sync translations to product_translations table
  if (name || description || short_description) {
    await syncProductTranslations(tenantDb, product.id, { name, description, short_description }, locale);
  }

  // Sync attributes to product_attribute_values table for storefront filtering
  if (attributes && typeof attributes === 'object') {
    await syncProductAttributeValues(tenantDb, storeId, product.id, attributes);
  }

  // Sync files (images, PDFs, documents) to product_files table
  if (images && Array.isArray(images) && images.length > 0) {
    await syncProductFiles(tenantDb, storeId, product.id, images);
  }

  return product;
}

/**
 * Update product in tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {string} productId - Product UUID
 * @param {Object} productData - Product data to update
 * @param {string} locale - Locale code (e.g., 'en_US') for translations
 * @returns {Promise<Object>} Updated product
 */
async function updateProduct(storeId, productId, productData, locale = 'en_US') {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Exclude translation fields (name, description, short_description) - these go in product_translations table
  // Also extract images to sync to product_files table, attributes sync to product_attribute_values
  const { name, description, short_description, attributes, images, ...productFieldsOnly } = productData;

  const updateFields = {
    ...productFieldsOnly,
    updated_at: new Date().toISOString()
  };

  const { error } = await tenantDb
    .from('products')
    .update(updateFields)
    .eq('id', productId);

  if (error) throw error;

  // Sync translations to product_translations table
  if (name !== undefined || description !== undefined || short_description !== undefined) {
    await syncProductTranslations(tenantDb, productId, { name, description, short_description }, locale);
  }

  // Sync attributes to product_attribute_values table for storefront filtering
  if (attributes && typeof attributes === 'object' && Object.keys(attributes).length > 0) {
    await syncProductAttributeValues(tenantDb, storeId, productId, attributes);
  }

  // Sync files (images, PDFs, documents) to product_files table
  if (images && Array.isArray(images) && images.length > 0) {
    await syncProductFiles(tenantDb, storeId, productId, images);
  }

  // Return updated product
  return await getProductById(storeId, productId);
}

/**
 * Determine file_type from contentType/mimeType or URL extension
 * Valid types: 'image', 'video', 'document', '3d_model', 'pdf'
 */
function getFileTypeFromContentType(contentType, url = null) {
  // If we have a valid contentType, use it
  if (contentType) {
    const ct = contentType.toLowerCase();

    if (ct === 'application/pdf') return 'pdf';
    if (ct.startsWith('image/')) return 'image';
    if (ct.startsWith('video/')) return 'video';
    if (ct.includes('gltf') || ct.includes('glb') || ct.includes('3d')) return '3d_model';

    // Common document types
    if (ct.includes('word') || ct.includes('document') ||
        ct.includes('spreadsheet') || ct.includes('excel') ||
        ct.includes('powerpoint') || ct.includes('presentation') ||
        ct.includes('text/') || ct.includes('application/rtf')) {
      return 'document';
    }
  }

  // Fallback: detect from URL extension
  if (url) {
    try {
      const urlPath = new URL(url).pathname.toLowerCase();
      const ext = urlPath.split('.').pop();

      // Image extensions
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) {
        return 'image';
      }
      // Video extensions
      if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv'].includes(ext)) {
        return 'video';
      }
      // PDF
      if (ext === 'pdf') {
        return 'pdf';
      }
      // 3D model extensions
      if (['gltf', 'glb', 'obj', 'fbx', 'stl'].includes(ext)) {
        return '3d_model';
      }
    } catch (e) {
      // Invalid URL, ignore
    }
  }

  // Default to document if we can't determine
  if (!contentType) return 'document';

  return 'document';
}

/**
 * Sync product files (images, PDFs, documents) to product_files table
 * Expects media_asset_id from StorageManager upload response
 *
 * @param {Object} tenantDb - Tenant database connection
 * @param {string} storeId - Store UUID
 * @param {string} productId - Product UUID
 * @param {Array} files - Array of file objects with media_asset_id, contentType, alt, position
 */
async function syncProductFiles(tenantDb, storeId, productId, files) {
  try {
    console.log(`📁 Syncing ${files.length} files for product ${productId}`);

    // Delete all existing product_files for this product (images, PDFs, documents, etc.)
    const { error: deleteError } = await tenantDb
      .from('product_files')
      .delete()
      .eq('product_id', productId);

    if (deleteError) {
      console.error('Error deleting existing product files:', deleteError);
      throw deleteError;
    }

    // Filter files that have media_asset_id from upload
    let validFiles = files.filter(file => file.media_asset_id);

    if (validFiles.length > 0) {
      // Verify media_asset_ids exist in media_assets table
      const mediaAssetIds = validFiles.map(f => f.media_asset_id);
      const { data: existingAssets } = await tenantDb
        .from('media_assets')
        .select('id')
        .in('id', mediaAssetIds);

      const existingIds = new Set((existingAssets || []).map(a => a.id));

      // For files with missing media_assets, try to create them from URL
      for (const file of validFiles) {
        if (!existingIds.has(file.media_asset_id) && (file.url || file.metadata?.original_url)) {
          const fileUrl = file.url || file.metadata?.original_url;

          // Check if media_asset already exists by URL
          const { data: existingByUrl } = await tenantDb
            .from('media_assets')
            .select('id')
            .eq('store_id', storeId)
            .eq('file_url', fileUrl)
            .maybeSingle();

          if (existingByUrl) {
            // Use existing media_asset_id
            console.log(`📦 Found existing media_asset by URL, using id: ${existingByUrl.id}`);
            file.media_asset_id = existingByUrl.id;
            existingIds.add(existingByUrl.id);
          } else {
            // Create new media_asset from file data
            const newId = uuidv4();
            const fileName = file.metadata?.upload_result?.filename || file.filename || fileUrl.split('/').pop();

            const assetData = {
              id: newId,
              store_id: storeId,
              file_name: fileName,
              original_name: fileName,
              file_path: file.metadata?.upload_result?.relativePath || fileName,
              file_url: fileUrl,
              mime_type: file.contentType || 'image/jpeg',
              folder: 'product',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            const { error: insertError } = await tenantDb
              .from('media_assets')
              .insert(assetData);

            if (insertError) {
              console.error(`❌ Failed to create media_asset for ${fileName}:`, insertError.message);
            } else {
              console.log(`✅ Created missing media_asset: ${newId} for ${fileName}`);
              file.media_asset_id = newId;
              existingIds.add(newId);
            }
          }
        }
      }

      const originalCount = validFiles.length;
      // Filter to only files with valid media_asset_id
      validFiles = validFiles.filter(file => existingIds.has(file.media_asset_id));

      if (validFiles.length < originalCount) {
        console.warn(`⚠️ Filtered out ${originalCount - validFiles.length} files with non-existent media_asset_id`);
      }
    }

    if (validFiles.length === 0) {
      console.log(`📁 No files with media_asset_id to sync`);
      return;
    }

    // Track primary image separately
    let hasPrimaryImage = false;

    const insertRecords = validFiles.map((file, index) => {
      const fileUrl = file.url || file.metadata?.original_url;
      const fileType = getFileTypeFromContentType(file.contentType, fileUrl);
      const isImage = fileType === 'image';

      // First image becomes primary
      const isPrimary = isImage && !hasPrimaryImage;
      if (isPrimary) hasPrimaryImage = true;

      // Extract attribute_code from metadata
      const attributeCode = file.metadata?.attribute || file.attribute_code || null;

      console.log(`  📄 File ${index + 1}: ${file.contentType || 'unknown'} -> ${fileType}, attribute: ${attributeCode || 'none'}, url: ${fileUrl?.substring(0, 50) || 'none'}`);

      return {
        product_id: productId,
        store_id: storeId,
        media_asset_id: file.media_asset_id,
        file_type: fileType,
        position: file.position !== undefined ? file.position : index,
        is_primary: file.isPrimary !== undefined ? file.isPrimary : isPrimary,
        alt_text: file.alt || file.alt_text || '',
        metadata: {
          attribute_code: attributeCode,
          original_filename: file.metadata?.upload_result?.filename || file.filename || null,
          original_url: file.metadata?.original_url || file.url || null
        }
      };
    });

    const { error: insertError } = await tenantDb
      .from('product_files')
      .insert(insertRecords);

    if (insertError) {
      console.error('Error inserting product files:', insertError);
      throw insertError;
    }

    const fileCounts = insertRecords.reduce((acc, r) => {
      acc[r.file_type] = (acc[r.file_type] || 0) + 1;
      return acc;
    }, {});
    console.log(`✅ Synced ${validFiles.length} files to product_files:`, fileCounts);
  } catch (err) {
    console.error('Error in syncProductFiles:', err);
  }
}

// Backward compatibility alias
const syncProductImages = syncProductFiles;

/**
 * Sync product translations to product_translations table
 * Upserts translation for the given locale
 *
 * @param {Object} tenantDb - Tenant database connection
 * @param {string} productId - Product UUID
 * @param {Object} translations - { name, description, short_description }
 * @param {string} locale - Locale code (e.g., 'en_US')
 */
async function syncProductTranslations(tenantDb, productId, translations, locale = 'en_US') {
  try {
    // Convert Akeneo locale format (en_US) to simple language code (en)
    const languageCode = locale.split('_')[0];

    // Extract string values, handling object values like {label, value}
    const extractStringValue = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        // Handle {label, value} format from select attributes
        if (val.label !== undefined) return val.label;
        if (val.value !== undefined) return String(val.value);
        return JSON.stringify(val);
      }
      return String(val);
    };

    const name = extractStringValue(translations.name);
    const description = extractStringValue(translations.description);
    const short_description = extractStringValue(translations.short_description);

    // Skip if no translation values
    if (!name && !description && !short_description) {
      return;
    }

    console.log(`📝 Syncing translations for product ${productId} (${languageCode}): name="${name?.substring(0, 50)}..."`);

    // Check if translation exists for this product/language
    const { data: existing } = await tenantDb
      .from('product_translations')
      .select('id')
      .eq('product_id', productId)
      .eq('language_code', languageCode)
      .maybeSingle();

    if (existing) {
      // Update existing translation
      const { error: updateError } = await tenantDb
        .from('product_translations')
        .update({
          name: name || existing.name,
          description: description !== undefined ? description : existing.description,
          short_description: short_description !== undefined ? short_description : existing.short_description,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating product translation:', updateError);
        throw updateError;
      }
      console.log(`✅ Updated translation for product ${productId} (${languageCode})`);
    } else {
      // Insert new translation
      const { error: insertError } = await tenantDb
        .from('product_translations')
        .insert({
          product_id: productId,
          language_code: languageCode,
          name: name || '',
          description: description || null,
          short_description: short_description || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting product translation:', insertError);
        throw insertError;
      }
      console.log(`✅ Created translation for product ${productId} (${languageCode})`);
    }
  } catch (err) {
    console.error('Error in syncProductTranslations:', err);
    // Don't throw - let the product update succeed even if translation sync fails
  }
}

/**
 * Sync product attributes to product_attribute_values table
 * This enables layered navigation filtering on the storefront
 *
 * @param {Object} tenantDb - Tenant database connection
 * @param {string} storeId - Store UUID
 * @param {string} productId - Product UUID
 * @param {Object} attributes - Attributes object {attributeCode: value}
 */
async function syncProductAttributeValues(tenantDb, storeId, productId, attributes) {
  try {
    // Delete existing attribute values for this product
    await tenantDb
      .from('product_attribute_values')
      .delete()
      .eq('product_id', productId);

    // Get all attributes for this store to map codes to IDs
    const { data: storeAttributes } = await tenantDb
      .from('attributes')
      .select('id, code, type')
      .eq('store_id', storeId);

    if (!storeAttributes || storeAttributes.length === 0) {
      return;
    }

    const attrCodeToId = new Map(storeAttributes.map(a => [a.code, { id: a.id, type: a.type }]));

    // Get all attribute values for select/multiselect attributes
    const { data: allAttrValues } = await tenantDb
      .from('attribute_values')
      .select('id, code, attribute_id');

    const attrValueCodeToId = new Map();
    if (allAttrValues) {
      allAttrValues.forEach(v => {
        const key = `${v.attribute_id}:${v.code}`;
        attrValueCodeToId.set(key, v.id);
      });
    }

    // Build insert records
    const insertRecords = [];

    for (const [attrCode, rawValue] of Object.entries(attributes)) {
      if (rawValue === null || rawValue === undefined || rawValue === '') continue;

      const attrInfo = attrCodeToId.get(attrCode);
      if (!attrInfo) continue; // Skip unknown attributes

      const record = {
        product_id: productId,
        attribute_id: attrInfo.id
      };

      // Extract actual value from {label, value} objects (common from Akeneo pim_catalog_select)
      let value = rawValue;
      let label = null;
      if (typeof rawValue === 'object' && rawValue !== null && !Array.isArray(rawValue)) {
        if (rawValue.value !== undefined) {
          value = rawValue.value;
          label = rawValue.label || value;
        }
      }

      // Handle different attribute types
      if (attrInfo.type === 'select' || attrInfo.type === 'multiselect') {
        // For select types, value is the code of the attribute_value
        const lookupValue = typeof value === 'string' ? value : String(value);
        const valueKey = `${attrInfo.id}:${lookupValue}`;
        const valueId = attrValueCodeToId.get(valueKey);
        if (valueId) {
          record.value_id = valueId;
        } else {
          // Store as text if value_id not found - use label if available for display
          record.text_value = label || lookupValue;
        }
      } else if (attrInfo.type === 'number') {
        const numValue = typeof value === 'object' ? (value.amount || value.value || 0) : value;
        record.number_value = parseFloat(numValue) || 0;
      } else if (attrInfo.type === 'boolean') {
        record.boolean_value = Boolean(value);
      } else if (attrInfo.type === 'date') {
        record.date_value = value;
      } else {
        // text, file, image, etc.
        // For objects with label/value, store the label (human readable)
        if (typeof rawValue === 'object' && rawValue !== null && rawValue.label) {
          record.text_value = rawValue.label;
        } else if (typeof value === 'object') {
          record.text_value = JSON.stringify(value);
        } else {
          record.text_value = String(value);
        }
      }

      insertRecords.push(record);
    }

    // Insert new attribute values
    if (insertRecords.length > 0) {
      await tenantDb
        .from('product_attribute_values')
        .insert(insertRecords);
    }
  } catch (err) {
    console.error('Error in syncProductAttributeValues:', err);
  }
}

/**
 * Delete product from tenant database
 * Also deletes associated images from storage and media_assets
 *
 * @param {string} storeId - Store UUID
 * @param {string} productId - Product UUID
 * @returns {Promise<void>}
 */
async function deleteProduct(storeId, productId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Get product files to find associated media assets
  const { data: productFiles } = await tenantDb
    .from('product_files')
    .select('media_asset_id')
    .eq('product_id', productId);

  // Get media assets for these product files
  const mediaAssetIds = (productFiles || [])
    .map(f => f.media_asset_id)
    .filter(id => id);

  // Delete product_files FIRST (has FK to media_assets)
  const { error: productFilesError } = await tenantDb
    .from('product_files')
    .delete()
    .eq('product_id', productId);

  if (productFilesError) {
    console.error(`Failed to delete product_files for product ${productId}:`, productFilesError.message);
  } else {
    console.log(`🗑️ Deleted product_files for product ${productId}`);
  }

  // Now delete media_assets (after product_files FK is removed)
  if (mediaAssetIds.length > 0) {
    // Get media asset details for storage deletion
    const { data: mediaAssets } = await tenantDb
      .from('media_assets')
      .select('id, file_path, metadata')
      .in('id', mediaAssetIds);

    // Delete files from storage
    if (mediaAssets && mediaAssets.length > 0) {
      const storageManager = require('../services/storage-manager');
      for (const asset of mediaAssets) {
        if (asset.file_path) {
          try {
            await storageManager.deleteFile(storeId, asset.file_path);
            console.log(`🗑️ Deleted product image from storage: ${asset.file_path}`);
          } catch (storageError) {
            console.error(`Failed to delete product image from storage: ${asset.file_path}`, storageError.message);
          }
        }
      }
    }

    // Delete media_assets records
    const { error: mediaAssetsError } = await tenantDb
      .from('media_assets')
      .delete()
      .in('id', mediaAssetIds);

    if (mediaAssetsError) {
      console.error(`Failed to delete media_assets for product ${productId}:`, mediaAssetsError.message);
    } else {
      console.log(`🗑️ Deleted ${mediaAssetIds.length} media_assets for product ${productId}`);
    }
  }

  // Delete attribute values
  await tenantDb
    .from('product_attribute_values')
    .delete()
    .eq('product_id', productId);

  // Delete translations
  await tenantDb
    .from('product_translations')
    .delete()
    .eq('product_id', productId);

  // Delete the product
  const { error } = await tenantDb
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) throw error;
}

/**
 * Get all products for a store from tenant database (for bulk operations)
 *
 * @param {string} storeId - Store UUID
 * @returns {Promise<Array>} Products
 */
async function getAllProducts(storeId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { data: products, error } = await tenantDb
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return products || [];
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  syncProductAttributeValues,
  syncProductFiles,
  syncProductImages, // Backward compatibility alias
  syncProductTranslations
};
