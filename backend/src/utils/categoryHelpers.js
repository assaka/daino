/**
 * Category Settings Helpers for Normalized Translations
 *
 * These helpers construct the same format that the frontend expects
 * from normalized translation tables using Supabase.
 */

const ConnectionManager = require('../services/database/ConnectionManager');

/**
 * Get categories with translations from normalized tables
 *
 * @param {string} storeId - Store ID
 * @param {Object} where - WHERE clause conditions
 * @param {string} lang - Language code (default: 'en')
 * @param {Object} options - Query options { limit, offset, search }
 * @returns {Promise<Object>} { rows, count } - Categories with translated fields and total count
 */
async function getCategoriesWithTranslations(storeId, where = {}, lang = 'en', options = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { limit, offset, search } = options;

  // Build categories query
  let categoriesQuery = tenantDb.from('categories').select('*', { count: 'exact' });

  // Apply where conditions
  for (const [key, value] of Object.entries(where)) {
    if (Array.isArray(value)) {
      categoriesQuery = categoriesQuery.in(key, value);
    } else {
      categoriesQuery = categoriesQuery.eq(key, value);
    }
  }

  // Apply sorting
  categoriesQuery = categoriesQuery.order('sort_order', { ascending: true }).order('created_at', { ascending: false });

  // Apply pagination
  if (limit && offset) {
    categoriesQuery = categoriesQuery.range(offset, offset + limit - 1);
  } else if (limit) {
    categoriesQuery = categoriesQuery.limit(limit);
  }

  const { data: categories, error: categoriesError, count } = await categoriesQuery;

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError);
    throw categoriesError;
  }

  if (!categories || categories.length === 0) {
    return { rows: [], count: 0 };
  }

  // Fetch translations for these categories
  const categoryIds = categories.map(c => c.id);
  const { data: translations, error: transError } = await tenantDb
    .from('category_translations')
    .select('category_id, language_code, name, description')
    .in('category_id', categoryIds)
    .in('language_code', [lang, 'en']);

  if (transError) {
    console.error('Error fetching category translations:', transError);
  }

  // Build translation maps
  const requestedLangMap = {};
  const englishLangMap = {};

  (translations || []).forEach(t => {
    if (t.language_code === lang) {
      requestedLangMap[t.category_id] = t;
    }
    if (t.language_code === 'en') {
      englishLangMap[t.category_id] = t;
    }
  });

  // Apply translations and search filter
  let rows = categories.map(category => {
    const translation = requestedLangMap[category.id] || englishLangMap[category.id];
    return {
      ...category,
      name: translation?.name || category.slug || '',
      description: translation?.description || ''
    };
  });

  // Apply search filter in JavaScript if provided
  if (search) {
    const searchLower = search.toLowerCase();
    rows = rows.filter(category =>
      category.name.toLowerCase().includes(searchLower) ||
      (category.description && category.description.toLowerCase().includes(searchLower))
    );
  }

  return { rows, count: count || rows.length };
}

/**
 * Get single category with translations
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Category ID
 * @param {string} lang - Language code (default: 'en')
 * @returns {Promise<Object|null>} Category with translated fields
 */
async function getCategoryById(storeId, id, lang = 'en') {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Fetch the category
  const { data: category, error: categoryError } = await tenantDb
    .from('categories')
    .select('*')
    .eq('id', id)
    .single();

  if (categoryError || !category) {
    return null;
  }

  // Fetch translations
  const { data: translations, error: transError } = await tenantDb
    .from('category_translations')
    .select('language_code, name, description')
    .eq('category_id', id)
    .in('language_code', [lang, 'en']);

  if (transError) {
    console.error('Error fetching category translations:', transError);
  }

  // Apply translation with fallback
  const requestedLang = translations?.find(t => t.language_code === lang);
  const englishLang = translations?.find(t => t.language_code === 'en');
  const translation = requestedLang || englishLang;

  return {
    ...category,
    name: translation?.name || category.slug || '',
    description: translation?.description || ''
  };
}

/**
 * Create category with translations
 *
 * @param {string} storeId - Store ID
 * @param {Object} categoryData - Category data (without translations)
 * @param {Object} translations - Translations object { en: {...}, nl: {...} }
 * @returns {Promise<Object>} Created category with translations
 */
async function createCategoryWithTranslations(storeId, categoryData, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  try {
    // Insert category
    const { data: category, error: categoryError } = await tenantDb
      .from('categories')
      .insert({
        slug: categoryData.slug,
        image_url: categoryData.image_url || null,
        media_asset_id: categoryData.media_asset_id || null,
        sort_order: categoryData.sort_order || 0,
        is_active: categoryData.is_active !== false,
        hide_in_menu: categoryData.hide_in_menu || false,
        seo: categoryData.seo || {},
        store_id: categoryData.store_id,
        parent_id: categoryData.parent_id || null,
        level: categoryData.level || 0,
        path: categoryData.path || null,
        product_count: categoryData.product_count || 0
      })
      .select()
      .single();

    if (categoryError) {
      console.error('Error inserting category:', categoryError);
      throw categoryError;
    }

    // Insert translations
    for (const [langCode, data] of Object.entries(translations)) {
      if (data && Object.keys(data).length > 0) {
        const { error: transError } = await tenantDb
          .from('category_translations')
          .upsert({
            category_id: category.id,
            language_code: langCode,
            name: data.name || null,
            description: data.description || null
          }, {
            onConflict: 'category_id,language_code'
          });

        if (transError) {
          console.error('Error upserting category translation:', transError);
          // Continue with other translations
        }
      }
    }

    // Return the created category with translations
    return await getCategoryById(storeId, category.id);
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
}

/**
 * Update category with translations
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Category ID
 * @param {Object} categoryData - Category data (without translations)
 * @param {Object} translations - Translations object { en: {...}, nl: {...} }
 * @returns {Promise<Object>} Updated category with translations
 */
async function updateCategoryWithTranslations(storeId, id, categoryData, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  try {
    // Build update object
    const updateData = {};

    const fields = [
      'slug', 'image_url', 'media_asset_id', 'sort_order', 'is_active', 'hide_in_menu',
      'parent_id', 'level', 'path', 'product_count', 'seo'
    ];

    fields.forEach(field => {
      if (categoryData[field] !== undefined) {
        updateData[field] = categoryData[field];
      }
    });

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error: updateError } = await tenantDb
        .from('categories')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating category:', updateError);
        throw updateError;
      }
    }

    // Update translations
    console.log(`   💾 updateCategoryWithTranslations: Saving translations for category ${id}`);
    console.log(`   📋 Translations to save:`, JSON.stringify(translations, null, 2));

    for (const [langCode, data] of Object.entries(translations)) {
      if (data && Object.keys(data).length > 0) {
        console.log(`      💾 Saving ${langCode}:`, {
          name: data.name ? data.name.substring(0, 30) : null,
          description: data.description ? data.description.substring(0, 50) + '...' : null
        });

        const { error: transError } = await tenantDb
          .from('category_translations')
          .upsert({
            category_id: id,
            language_code: langCode,
            name: data.name !== undefined ? data.name : null,
            description: data.description !== undefined ? data.description : null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'category_id,language_code'
          });

        if (transError) {
          console.error(`      ❌ Error saving ${langCode} translation:`, transError);
          throw transError;
        }

        console.log(`      ✅ Saved ${langCode} translation to category_translations table`);
      }
    }

    // Return the updated category with translations
    return await getCategoryById(storeId, id);
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
}

/**
 * Get categories with ALL translations for admin translation management
 *
 * @param {string} storeId - Store ID
 * @param {Object} where - WHERE clause conditions
 * @returns {Promise<Array>} Categories with all translations nested by language code
 */
async function getCategoriesWithAllTranslations(storeId, where = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Fetch categories
  let categoriesQuery = tenantDb.from('categories').select('*');

  // Apply where conditions
  for (const [key, value] of Object.entries(where)) {
    if (Array.isArray(value)) {
      categoriesQuery = categoriesQuery.in(key, value);
    } else {
      categoriesQuery = categoriesQuery.eq(key, value);
    }
  }

  categoriesQuery = categoriesQuery.order('sort_order', { ascending: true }).order('created_at', { ascending: false });

  const { data: categories, error: categoriesError } = await categoriesQuery;

  if (categoriesError) {
    console.error('Error fetching categories:', categoriesError);
    throw categoriesError;
  }

  if (!categories || categories.length === 0) {
    return [];
  }

  // Get all translations for these categories
  const categoryIds = categories.map(c => c.id);
  const { data: translations, error: transError } = await tenantDb
    .from('category_translations')
    .select('category_id, language_code, name, description')
    .in('category_id', categoryIds);

  if (transError) {
    console.error('Error fetching category translations:', transError);
  }

  // Group translations by category_id and language_code
  const translationsByCategory = {};
  (translations || []).forEach(t => {
    if (!translationsByCategory[t.category_id]) {
      translationsByCategory[t.category_id] = {};
    }
    translationsByCategory[t.category_id][t.language_code] = {
      name: t.name,
      description: t.description
    };
  });

  // Get English name for display
  const result = categories.map(category => {
    const translations = translationsByCategory[category.id] || {};
    const englishName = translations.en?.name || category.slug || '';

    return {
      ...category,
      name: englishName,
      translations: translations
    };
  });

  return result;
}

/**
 * Delete category (translations are CASCADE deleted)
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Category ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteCategory(storeId, id) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { error } = await tenantDb
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting category:', error);
    throw error;
  }

  return true;
}

module.exports = {
  getCategoriesWithTranslations,
  getCategoriesWithAllTranslations,
  getCategoryById,
  createCategoryWithTranslations,
  updateCategoryWithTranslations,
  deleteCategory
};
