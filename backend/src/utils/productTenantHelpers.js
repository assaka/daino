/**
 * Product Tenant Helpers for Multi-Tenant Database Architecture
 *
 * These helpers fetch product data from tenant-specific databases using ConnectionManager
 */

const ConnectionManager = require('../services/database/ConnectionManager');

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
  const { limit = 100, offset = 0 } = pagination;

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

  // Load attributes from product_attribute_values table
  product.attributes = await loadProductAttributes(tenantDb, productId);

  return product;
}

/**
 * Load product attributes from product_attribute_values table
 * Returns format: {attributeCode: value}
 *
 * @param {Object} tenantDb - Tenant database connection
 * @param {string} productId - Product UUID
 * @returns {Promise<Object>} Attributes as {code: value}
 */
async function loadProductAttributes(tenantDb, productId) {
  try {
    const { data: pavs } = await tenantDb
      .from('product_attribute_values')
      .select('*')
      .eq('product_id', productId);

    if (!pavs || pavs.length === 0) return {};

    // Get attribute info to map IDs to codes
    const attributeIds = [...new Set(pavs.map(p => p.attribute_id))];

    const { data: attrs } = await tenantDb
      .from('attributes')
      .select('id, code, type')
      .in('id', attributeIds);
    const attrMap = new Map(attrs?.map(a => [a.id, a]) || []);

    // Get attribute values for select/multiselect
    const valueIds = pavs.filter(p => p.value_id).map(p => p.value_id);
    let valMap = new Map();
    if (valueIds.length > 0) {
      const { data: vals } = await tenantDb
        .from('attribute_values')
        .select('id, code')
        .in('id', valueIds);
      valMap = new Map(vals?.map(v => [v.id, v.code]) || []);
    }

    // Build attributes object {code: value}
    const attributes = {};
    for (const pav of pavs) {
      const attr = attrMap.get(pav.attribute_id);
      if (!attr) continue;

      let value;
      if (pav.value_id) {
        // Select/multiselect - use the value code
        value = valMap.get(pav.value_id);
      } else if (pav.text_value !== null) {
        value = pav.text_value;
      } else if (pav.number_value !== null) {
        value = pav.number_value;
      } else if (pav.boolean_value !== null) {
        value = pav.boolean_value;
      } else if (pav.date_value !== null) {
        value = pav.date_value;
      }

      if (value !== undefined) {
        attributes[attr.code] = value;
      }
    }

    return attributes;
  } catch (err) {
    console.error('Error loading product attributes:', err);
    return {};
  }
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

  // Extract translation fields and images to sync separately
  const { name, description, short_description, images, ...productFields } = productData;

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
  if (productData.attributes && typeof productData.attributes === 'object') {
    await syncProductAttributeValues(tenantDb, storeId, product.id, productData.attributes);
  }

  // Sync images to product_files table
  if (images && Array.isArray(images) && images.length > 0) {
    await syncProductImages(tenantDb, storeId, product.id, images);
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
  // Also extract images to sync to product_files table
  const { name, description, short_description, attributes, images, ...productFieldsOnly } = productData;

  const updateFields = {
    ...productFieldsOnly,
    attributes, // Keep attributes in products table for admin
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
  if (attributes && typeof attributes === 'object') {
    await syncProductAttributeValues(tenantDb, storeId, productId, attributes);
  }

  // Sync images to product_files table
  if (images && Array.isArray(images)) {
    await syncProductImages(tenantDb, storeId, productId, images);
  }

  // Return updated product
  return await getProductById(storeId, productId);
}

/**
 * Sync product images to product_files table
 * Replaces all existing images with the new array
 *
 * @param {Object} tenantDb - Tenant database connection
 * @param {string} storeId - Store UUID
 * @param {string} productId - Product UUID
 * @param {Array} images - Array of image objects with url, alt, position, etc.
 */
async function syncProductImages(tenantDb, storeId, productId, images) {
  try {
    console.log(`📷 Syncing ${images.length} images for product ${productId}`);

    // Delete existing images for this product
    const { error: deleteError } = await tenantDb
      .from('product_files')
      .delete()
      .eq('product_id', productId)
      .eq('file_type', 'image');

    if (deleteError) {
      console.error('Error deleting existing product images:', deleteError);
      throw deleteError;
    }

    // Insert new images
    if (images.length > 0) {
      const insertRecords = images.map((img, index) => ({
        product_id: productId,
        store_id: storeId,
        file_url: img.url || img.file_url,
        file_type: 'image',
        position: img.position !== undefined ? img.position : index,
        is_primary: img.isPrimary !== undefined ? img.isPrimary : index === 0,
        alt_text: img.alt || img.alt_text || '',
        file_size: img.filesize || img.file_size || null,
        mime_type: img.mime_type || null,
        metadata: {
          attribute_code: img.attribute_code || null,
          filepath: img.filepath || null,
          original_data: img
        }
      }));

      const { error: insertError } = await tenantDb
        .from('product_files')
        .insert(insertRecords);

      if (insertError) {
        console.error('Error inserting product images:', insertError);
        throw insertError;
      }

      console.log(`✅ Successfully synced ${images.length} images to product_files`);
    }
  } catch (err) {
    console.error('Error in syncProductImages:', err);
    // Don't throw - let the product update succeed even if image sync fails
  }
}

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
 *
 * @param {string} storeId - Store UUID
 * @param {string} productId - Product UUID
 * @returns {Promise<void>}
 */
async function deleteProduct(storeId, productId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Delete attribute values first
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
  syncProductImages,
  syncProductTranslations
};
