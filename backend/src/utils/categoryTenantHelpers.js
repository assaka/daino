/**
 * Category Tenant Helpers for Multi-Tenant Database Architecture
 *
 * These helpers fetch category data from tenant-specific databases using ConnectionManager
 */

const ConnectionManager = require('../services/database/ConnectionManager');

/**
 * Get categories with ALL translations from tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {Object} where - Filter conditions
 * @returns {Promise<Array>} Categories with all translations
 */
async function getCategoriesWithAllTranslations(storeId, where = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Build query for categories
  let query = tenantDb.from('categories').select('*');

  // Apply filters
  Object.entries(where).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else {
      query = query.eq(key, value);
    }
  });

  const { data: categories, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  // Load translations for each category
  for (const category of categories || []) {
    const { data: translations } = await tenantDb
      .from('category_translations')
      .select('*')
      .eq('category_id', category.id);

    category.translations = {};
    if (translations) {
      translations.forEach(t => {
        category.translations[t.language_code] = {
          name: t.name,
          description: t.description
        };
      });
    }

    // Set default name and description from en translation or first available
    if (category.translations.en) {
      category.name = category.translations.en.name;
      category.description = category.translations.en.description;
    } else {
      const firstLang = Object.keys(category.translations)[0];
      if (firstLang) {
        category.name = category.translations[firstLang].name;
        category.description = category.translations[firstLang].description;
      }
    }
  }

  return categories || [];
}

/**
 * Get category by ID with translations from tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {string} categoryId - Category UUID
 * @param {string} lang - Language code (default: 'en')
 * @returns {Promise<Object|null>} Category with translations
 */
async function getCategoryById(storeId, categoryId, lang = 'en') {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { data: category, error } = await tenantDb
    .from('categories')
    .select('*')
    .eq('id', categoryId)
    .single();

  if (error || !category) return null;

  // Get all translations
  const { data: translations } = await tenantDb
    .from('category_translations')
    .select('*')
    .eq('category_id', categoryId);

  category.translations = {};
  if (translations) {
    translations.forEach(t => {
      category.translations[t.language_code] = {
        name: t.name,
        description: t.description
      };
    });
  }

  // Set name and description from requested language or fallback to en
  const translation = category.translations[lang] || category.translations.en;
  if (translation) {
    category.name = translation.name;
    category.description = translation.description;
  }

  return category;
}

/**
 * Create category in tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {Object} categoryData - Category data
 * @param {Object} translations - Translations object
 * @returns {Promise<Object>} Created category
 */
async function createCategoryWithTranslations(storeId, categoryData, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Remove name and description from categoryData as they belong in category_translations
  const { name, description, ...validCategoryData } = categoryData;

  // Create category
  const { data: category, error } = await tenantDb
    .from('categories')
    .insert({
      ...validCategoryData,
      store_id: storeId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  // If name/description provided directly, add them as default 'en' translation
  if (name || description) {
    if (!translations.en) {
      translations.en = {};
    }
    if (name) translations.en.name = name;
    if (description) translations.en.description = description;
  }

  // Save translations
  await saveCategoryTranslations(storeId, category.id, translations);

  return category;
}

/**
 * Update category in tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {string} categoryId - Category UUID
 * @param {Object} categoryData - Category data to update
 * @param {Object} translations - Translations object
 * @returns {Promise<Object>} Updated category
 */
async function updateCategoryWithTranslations(storeId, categoryId, categoryData = {}, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  console.log('📦 updateCategoryWithTranslations - received categoryData:', {
    categoryId,
    hasMediaAssetId: !!categoryData.media_asset_id,
    media_asset_id: categoryData.media_asset_id,
    hasImageUrl: !!categoryData.image_url,
    image_url: categoryData.image_url,
    allKeys: Object.keys(categoryData)
  });

  // Remove name and description from categoryData as they belong in category_translations
  const { name, description, ...validCategoryData } = categoryData;

  // Update category if there's data to update
  if (Object.keys(validCategoryData).length > 0) {
    const updateFields = {
      ...validCategoryData,
      updated_at: new Date().toISOString()
    };

    console.log('📝 updateCategoryWithTranslations - updateFields:', {
      categoryId,
      fields: Object.keys(updateFields),
      media_asset_id: updateFields.media_asset_id,
      image_url: updateFields.image_url
    });

    const { error } = await tenantDb
      .from('categories')
      .update(updateFields)
      .eq('id', categoryId);

    if (error) throw error;
  }

  // If name/description provided directly, add them as default 'en' translation
  if (name || description) {
    if (!translations.en) {
      translations.en = {};
    }
    if (name) translations.en.name = name;
    if (description) translations.en.description = description;
  }

  // Save translations
  if (Object.keys(translations).length > 0) {
    await saveCategoryTranslations(storeId, categoryId, translations);
  }

  // Return updated category
  return await getCategoryById(storeId, categoryId);
}

/**
 * Delete category from tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {string} categoryId - Category UUID
 * @returns {Promise<void>}
 */
async function deleteCategory(storeId, categoryId) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Delete translations first
  await tenantDb
    .from('category_translations')
    .delete()
    .eq('category_id', categoryId);

  // Delete the category
  const { error } = await tenantDb
    .from('categories')
    .delete()
    .eq('id', categoryId);

  if (error) throw error;
}

/**
 * Save category translations to tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {string} categoryId - Category UUID
 * @param {Object} translations - Translations object {en: {name, description}, nl: {name, description}}
 * @returns {Promise<void>}
 */
async function saveCategoryTranslations(storeId, categoryId, translations) {
  if (!translations || typeof translations !== 'object') {
    return;
  }

  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  for (const [langCode, fields] of Object.entries(translations)) {
    if (!fields || typeof fields !== 'object') continue;

    const { name, description } = fields;

    // Skip if all fields are empty
    if (!name && !description) continue;

    // Upsert translation record
    const { error } = await tenantDb
      .from('category_translations')
      .upsert({
        category_id: categoryId,
        language_code: langCode,
        name: name || null,
        description: description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'category_id,language_code'
      });

    if (error) {
      console.error(`Error saving category translation for ${langCode}:`, error);
    }
  }
}

/**
 * Get categories with pagination and translations from tenant database
 *
 * @param {string} storeId - Store UUID
 * @param {Object} where - Filter conditions
 * @param {string} lang - Language code
 * @param {Object} options - Pagination options {limit, offset, search}
 * @returns {Promise<Object>} Categories with count
 */
async function getCategoriesWithTranslations(storeId, where = {}, lang = 'en', options = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);
  const { limit = 100, offset = 0, search } = options;

  // Build count query
  let countQuery = tenantDb.from('categories').select('*', { count: 'exact', head: true });

  // Apply filters to count query
  Object.entries(where).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      countQuery = countQuery.in(key, value);
    } else {
      countQuery = countQuery.eq(key, value);
    }
  });

  // Get total count
  const { count, error: countError } = await countQuery;

  if (countError) throw countError;

  // Build data query
  let query = tenantDb.from('categories').select('*');

  // Apply filters
  Object.entries(where).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else {
      query = query.eq(key, value);
    }
  });

  // Get paginated data
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: categories, error } = await query;

  if (error) throw error;

  // Load translations for each category
  for (const category of categories || []) {
    const { data: translation } = await tenantDb
      .from('category_translations')
      .select('*')
      .eq('category_id', category.id)
      .eq('language_code', lang)
      .single();

    if (translation) {
      category.name = translation.name;
      category.description = translation.description;
    }
  }

  // Apply search filter if needed
  let filteredCategories = categories || [];
  if (search) {
    const searchLower = search.toLowerCase();
    filteredCategories = filteredCategories.filter(cat =>
      cat.name?.toLowerCase().includes(searchLower) ||
      cat.description?.toLowerCase().includes(searchLower)
    );
  }

  return {
    rows: filteredCategories,
    count: search ? filteredCategories.length : (count || 0)
  };
}

module.exports = {
  getCategoriesWithAllTranslations,
  getCategoryById,
  createCategoryWithTranslations,
  updateCategoryWithTranslations,
  deleteCategory,
  saveCategoryTranslations,
  getCategoriesWithTranslations
};
