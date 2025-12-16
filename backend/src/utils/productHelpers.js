/**
 * Product Helpers for Normalized Translations
 *
 * These helpers fetch translations from the normalized product_translations table
 * and merge them with Supabase product data.
 */

const ConnectionManager = require('../services/database/ConnectionManager');

/**
 * Get product translation from normalized table with English fallback
 *
 * @param {string} storeId - Store ID
 * @param {string} productId - Product ID
 * @param {string} lang - Language code
 * @returns {Promise<Object|null>} Translation data
 */
async function getProductTranslation(storeId, productId, lang = 'en') {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Fetch translations for both requested language and English
  const { data: translations, error } = await tenantDb
    .from('product_translations')
    .select('name, description, short_description, language_code')
    .eq('product_id', productId)
    .in('language_code', [lang, 'en']);

  if (error) {
    console.error('Error fetching product translation:', error);
    return null;
  }

  if (!translations || translations.length === 0) {
    return null;
  }

  // Prefer requested language, fallback to English
  const requestedLang = translations.find(t => t.language_code === lang);
  const englishLang = translations.find(t => t.language_code === 'en');

  return requestedLang || englishLang || null;
}

/**
 * Apply translations to product data
 * Fetches from normalized table and merges with product JSON
 *
 * @param {string} storeId - Store ID
 * @param {Object} product - Product object (from Supabase)
 * @param {string} lang - Language code
 * @returns {Promise<Object>} Product with applied translations
 */
async function applyProductTranslations(storeId, product, lang = 'en') {
  if (!product) return null;

  const productData = { ...product };

  // Fetch translation from normalized table (with English fallback)
  const translation = await getProductTranslation(storeId, productData.id, lang);

  if (translation) {
    // Use normalized translation (requested lang or English fallback)
    productData.name = translation.name || '';
    productData.description = translation.description || '';
    productData.short_description = translation.short_description || '';
  } else if (productData.translations) {
    // Fallback to JSON column
    const fallbackLang = productData.translations[lang] || productData.translations.en || {};
    productData.name = fallbackLang.name || '';
    productData.description = fallbackLang.description || '';
    productData.short_description = fallbackLang.short_description || '';
  }
  // If no translations exist, fields will be empty strings

  return productData;
}

/**
 * Apply translations to multiple products
 *
 * @param {Array} products - Array of product objects
 * @param {string} lang - Language code
 * @param {Object} tenantDb - Tenant database connection (required)
 * @returns {Promise<Array>} Products with applied translations
 */
async function applyProductTranslationsToMany(products, lang = 'en', tenantDb = null) {
  if (!products || products.length === 0) return [];

  const productIds = products.map(p => p.id).filter(Boolean);

  if (productIds.length === 0) return products;

  if (!tenantDb) {
    console.error('❌ applyProductTranslationsToMany: tenantDb connection required');
    return products;
  }

  // Fetch both requested language and English fallback in one query
  const { data: translations, error } = await tenantDb
    .from('product_translations')
    .select('product_id, language_code, name, description, short_description')
    .in('product_id', productIds)
    .in('language_code', [lang, 'en']);

  if (error) {
    console.error('Error fetching product translations:', error);
    return products;
  }

  // Create maps for quick lookup (requested language and English fallback)
  const requestedLangMap = {};
  const englishLangMap = {};

  (translations || []).forEach(t => {
    if (t.language_code === lang) {
      requestedLangMap[t.product_id] = t;
    }
    if (t.language_code === 'en') {
      englishLangMap[t.product_id] = t;
    }
  });

  // Apply translations to each product
  return products.map(product => {
    const productData = { ...product };

    // Try requested language first, then English, then keep original values
    const translation = requestedLangMap[productData.id] || englishLangMap[productData.id];

    if (translation) {
      // Use normalized translation (requested lang or English fallback)
      productData.name = translation.name || '';
      productData.description = translation.description || '';
      productData.short_description = translation.short_description || '';
    } else if (productData.translations) {
      // Fallback to JSON column
      const fallbackLang = productData.translations[lang] || productData.translations.en || {};
      productData.name = fallbackLang.name || '';
      productData.description = fallbackLang.description || '';
      productData.short_description = fallbackLang.short_description || '';
    }
    // If no translations exist, fields will be empty strings

    return productData;
  });
}

/**
 * Get products with ALL translations for admin translation management
 *
 * @param {Array} products - Array of product objects
 * @param {Object} tenantDb - Tenant database connection (Supabase client)
 * @returns {Promise<Array>} Products with all translations nested by language code
 */
async function applyAllProductTranslations(products, tenantDb) {
  if (!products || products.length === 0) return [];

  const productData = products.map(p => ({ ...p }));
  const productIds = productData.map(p => p.id).filter(Boolean);

  if (productIds.length === 0) return productData;

  if (!tenantDb) {
    console.error('❌ applyAllProductTranslations: tenantDb connection required');
    return productData;
  }

  // Fetch all translations for these products using Supabase query builder
  const { data: translations, error } = await tenantDb
    .from('product_translations')
    .select('product_id, language_code, name, description, short_description')
    .in('product_id', productIds);

  if (error) {
    console.error('Error fetching product translations:', error);
    return productData;
  }

  // Group translations by product_id and language_code
  const translationsByProduct = {};
  (translations || []).forEach(t => {
    if (!translationsByProduct[t.product_id]) {
      translationsByProduct[t.product_id] = {};
    }
    translationsByProduct[t.product_id][t.language_code] = {
      name: t.name,
      description: t.description,
      short_description: t.short_description
    };
  });

  // Attach translations to products
  const result = productData.map(product => ({
    ...product,
    translations: translationsByProduct[product.id] || {}
  }));

  return result;
}

/**
 * Update product translations in normalized table
 *
 * @param {string} storeId - Store ID
 * @param {string} productId - Product ID
 * @param {Object} translations - Translations object { en: {...}, nl: {...} }
 * @returns {Promise<void>}
 */
async function updateProductTranslations(storeId, productId, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  console.log(`   💾 updateProductTranslations called for product ${productId}`);
  console.log(`   📋 Translations to save:`, JSON.stringify(translations, null, 2));

  // Update translations
  for (const [langCode, data] of Object.entries(translations)) {
    if (data && Object.keys(data).length > 0) {
      console.log(`      💾 Saving ${langCode} translation:`, {
        name: data.name ? data.name.substring(0, 30) : null,
        description: data.description ? data.description.substring(0, 30) + '...' : null,
        short_description: data.short_description ? data.short_description.substring(0, 30) + '...' : null
      });

      const translationData = {
        product_id: productId,
        language_code: langCode,
        name: data.name !== undefined ? data.name : null,
        description: data.description !== undefined ? data.description : null,
        short_description: data.short_description !== undefined ? data.short_description : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await tenantDb
        .from('product_translations')
        .upsert(translationData, {
          onConflict: 'product_id,language_code'
        });

      if (error) {
        console.error(`      ❌ Error saving ${langCode} translation:`, error);
        throw error;
      }

      console.log(`      ✅ Saved ${langCode} translation to product_translations table`);
    } else {
      console.log(`      ⏭️  Skipping ${langCode}: No data or empty object`);
    }
  }
}

/**
 * Get products with all data (translations) in optimized queries
 * Reduces N+1 queries by fetching translations in bulk
 *
 * @param {string} storeId - Store ID
 * @param {Object} where - WHERE conditions
 * @param {string} lang - Language code
 * @param {Object} options - { limit, offset }
 * @returns {Promise<Object>} { rows, count }
 */
async function getProductsOptimized(storeId, where = {}, lang = 'en', options = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { limit, offset } = options;

  // Build products query
  let productsQuery = tenantDb.from('products').select('*', { count: 'exact' });

  // Apply where conditions
  for (const [key, value] of Object.entries(where)) {
    if (key === 'category_ids' && typeof value === 'object' && value.contains) {
      // Handle JSONB contains for categories (Supabase uses contains operator)
      productsQuery = productsQuery.contains(key, value.contains);
    } else if (key === 'stock_filter') {
      // Skip complex stock filters for now - can be handled separately
      continue;
    } else {
      productsQuery = productsQuery.eq(key, value);
    }
  }

  // Apply pagination
  productsQuery = productsQuery.order('created_at', { ascending: false });
  if (limit) productsQuery = productsQuery.limit(limit);
  if (offset) productsQuery = productsQuery.range(offset, offset + (limit || 50) - 1);

  const { data: products, error: productsError, count } = await productsQuery;

  if (productsError) {
    console.error('Error fetching products:', productsError);
    throw productsError;
  }

  if (!products || products.length === 0) {
    return { rows: [], count: 0 };
  }

  // Fetch translations
  const productIds = products.map(p => p.id);
  const { data: translations, error: transError } = await tenantDb
    .from('product_translations')
    .select('product_id, language_code, name, description, short_description')
    .in('product_id', productIds)
    .in('language_code', [lang, 'en']);

  if (transError) {
    console.error('Error fetching product translations:', transError);
  }

  // Build translation maps
  const requestedLangMap = {};
  const englishLangMap = {};

  (translations || []).forEach(t => {
    if (t.language_code === lang) {
      requestedLangMap[t.product_id] = t;
    }
    if (t.language_code === 'en') {
      englishLangMap[t.product_id] = t;
    }
  });

  // Apply translations to products
  const rows = products.map(product => {
    const translation = requestedLangMap[product.id] || englishLangMap[product.id];
    return {
      ...product,
      name: translation?.name || '',
      description: translation?.description || '',
      short_description: translation?.short_description || ''
    };
  });

  return { rows, count: count || rows.length };
}

/**
 * Fetch and format product images from product_files or product_images table
 *
 * @param {string|Array} productIds - Single product ID or array of product IDs
 * @param {Object} tenantDb - Tenant database connection
 * @returns {Promise<Object>} Map of product_id => images array
 */
async function fetchProductImages(productIds, tenantDb) {
  if (!tenantDb) {
    console.error('❌ fetchProductImages: tenantDb connection required');
    return {};
  }

  const idsArray = Array.isArray(productIds) ? productIds : [productIds];

  if (idsArray.length === 0) return {};

  try {
    // First try product_files table
    const { data: files, error: filesError } = await tenantDb
      .from('product_files')
      .select('*')
      .in('product_id', idsArray)
      .eq('file_type', 'image')
      .order('position', { ascending: true });

    // Debug logging
    console.log(`🖼️ fetchProductImages: Querying ${idsArray.length} products, found ${files?.length || 0} files`);
    if (filesError) {
      console.error('🖼️ fetchProductImages error:', filesError);
    }

    // Group images by product_id from product_files
    const imagesByProduct = {};
    if (!filesError && files && files.length > 0) {
      files.forEach(file => {
        if (!imagesByProduct[file.product_id]) {
          imagesByProduct[file.product_id] = [];
        }

        imagesByProduct[file.product_id].push({
          url: file.file_url,
          alt: file.alt_text || '',
          isPrimary: file.is_primary || file.position === 0,
          position: file.position || 0
        });
      });
    }

    // Check which product IDs still need images (fallback to product_images table)
    const idsWithoutImages = idsArray.filter(id => !imagesByProduct[id] || imagesByProduct[id].length === 0);

    if (idsWithoutImages.length > 0) {
      // Try product_images table as fallback
      const { data: images, error: imagesError } = await tenantDb
        .from('product_images')
        .select('*')
        .in('product_id', idsWithoutImages)
        .order('position', { ascending: true });

      if (!imagesError && images && images.length > 0) {
        images.forEach(img => {
          if (!imagesByProduct[img.product_id]) {
            imagesByProduct[img.product_id] = [];
          }

          imagesByProduct[img.product_id].push({
            url: img.image_url || img.url || img.file_url,
            alt: img.alt_text || img.alt || '',
            isPrimary: img.is_primary || img.position === 0,
            position: img.position || 0
          });
        });
      }
    }

    return imagesByProduct;
  } catch (error) {
    console.error('❌ fetchProductImages error:', error);
    return {};
  }
}

/**
 * Apply product images to product data from product_files table
 *
 * @param {Array} products - Array of product objects
 * @param {Object} tenantDb - Tenant database connection
 * @returns {Promise<Array>} Products with images array
 */
async function applyProductImages(products, tenantDb) {
  if (!products || products.length === 0) return products;

  const productIds = products.map(p => p.id).filter(Boolean);
  if (productIds.length === 0) return products;

  const imagesByProduct = await fetchProductImages(productIds, tenantDb);

  return products.map(product => ({
    ...product,
    images: imagesByProduct[product.id] || []
  }));
}

module.exports = {
  getProductTranslation,
  applyProductTranslations,
  applyProductTranslationsToMany,
  applyAllProductTranslations,
  updateProductTranslations,
  getProductsOptimized,
  fetchProductImages,
  applyProductImages
};
