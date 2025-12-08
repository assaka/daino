/**
 * Product Tab Helpers for Normalized Translations
 *
 * Translations are stored in the product_tab_translations table
 * with columns: product_tab_id, language_code, name, content
 */

const ConnectionManager = require('../services/database/ConnectionManager');

/**
 * Get product tabs with translations from normalized tables
 *
 * @param {string} storeId - Store ID
 * @param {Object} where - WHERE clause conditions
 * @param {string} lang - Language code (default: 'en') - ignored if allTranslations is true
 * @param {boolean} allTranslations - If true, returns all translations for all languages
 * @returns {Promise<Array>} Product tabs with translated fields
 */
async function getProductTabsWithTranslations(storeId, where = {}, lang = 'en', allTranslations = false) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  // Fetch product tabs
  let query = tenantDb.from('product_tabs').select('*');

  // Apply where conditions
  for (const [key, value] of Object.entries(where)) {
    query = query.eq(key, value);
  }

  query = query.order('sort_order', { ascending: true }).order('name', { ascending: true });

  const { data: tabs, error } = await query;

  if (error) {
    console.error('Error fetching product tabs:', error);
    throw error;
  }

  if (!tabs || tabs.length === 0) {
    return [];
  }

  // Fetch translations for these tabs
  const tabIds = tabs.map(t => t.id);
  const { data: translations, error: transError } = await tenantDb
    .from('product_tab_translations')
    .select('product_tab_id, language_code, name, content')
    .in('product_tab_id', tabIds);

  if (transError) {
    console.error('Error fetching product tab translations:', transError);
  }

  // Group translations by tab_id and language_code
  const translationsByTab = {};
  (translations || []).forEach(t => {
    if (!translationsByTab[t.product_tab_id]) {
      translationsByTab[t.product_tab_id] = {};
    }
    translationsByTab[t.product_tab_id][t.language_code] = {
      name: t.name,
      content: t.content
    };
  });

  // If allTranslations is true, return tabs with translations object
  if (allTranslations) {
    const results = tabs.map(tab => {
      const tabTranslations = translationsByTab[tab.id] || {};
      const englishName = tabTranslations.en?.name || tab.name || '';

      return {
        ...tab,
        name: englishName,
        translations: tabTranslations
      };
    });

    console.log('✅ Query returned', results.length, 'tabs with all translations');
    return results;
  }

  // Single language mode - merge translation into tab fields
  const results = tabs.map(tab => {
    const tabTranslations = translationsByTab[tab.id] || {};
    const reqLang = tabTranslations[lang];
    const enLang = tabTranslations['en'];

    return {
      ...tab,
      name: reqLang?.name || enLang?.name || tab.name,
      content: reqLang?.content || enLang?.content || tab.content
    };
  });

  console.log('✅ Query returned', results.length, 'tabs for language:', lang);
  return results;
}

/**
 * Get single product tab with translations
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Product tab ID
 * @param {string} lang - Language code (default: 'en')
 * @returns {Promise<Object|null>} Product tab with translated fields
 */
async function getProductTabById(storeId, id, lang = 'en') {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { data: tab, error } = await tenantDb
    .from('product_tabs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !tab) {
    return null;
  }

  // Fetch translations
  const { data: translations, error: transError } = await tenantDb
    .from('product_tab_translations')
    .select('language_code, name, content')
    .eq('product_tab_id', id)
    .in('language_code', [lang, 'en']);

  if (transError) {
    console.error('Error fetching product tab translations:', transError);
  }

  // Apply translation with fallback
  const requestedLang = translations?.find(t => t.language_code === lang);
  const englishLang = translations?.find(t => t.language_code === 'en');
  const translation = requestedLang || englishLang;

  return {
    ...tab,
    name: translation?.name || tab.name,
    content: translation?.content || tab.content
  };
}

/**
 * Get single product tab with ALL translations
 * Returns format: { id, name, ..., translations: {en: {name, content}, nl: {...}} }
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Product tab ID
 * @returns {Promise<Object|null>} Product tab with all translations
 */
async function getProductTabWithAllTranslations(storeId, id) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { data: tab, error } = await tenantDb
    .from('product_tabs')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !tab) {
    return null;
  }

  // Fetch all translations
  const { data: translations, error: transError } = await tenantDb
    .from('product_tab_translations')
    .select('language_code, name, content')
    .eq('product_tab_id', id);

  if (transError) {
    console.error('Error fetching product tab translations:', transError);
  }

  // Group translations by language_code
  const translationsObj = {};
  (translations || []).forEach(t => {
    translationsObj[t.language_code] = {
      name: t.name,
      content: t.content
    };
  });

  const englishName = translationsObj.en?.name || tab.name || '';

  const result = {
    ...tab,
    name: englishName,
    translations: translationsObj
  };

  console.log('🔍 Backend: Query result:', {
    hasResults: true,
    translations: result.translations,
    translationType: typeof result.translations,
    translationKeys: Object.keys(result.translations || {})
  });

  return result;
}

/**
 * Create product tab with translations
 *
 * @param {Object} tabData - Product tab data (without translations)
 * @param {Object} translations - Translations object { en: {name, content}, nl: {name, content} }
 * @returns {Promise<Object>} Created product tab with translations
 */
async function createProductTabWithTranslations(tabData, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(tabData.store_id);

  try {
    // Insert product tab (without translations column)
    const now = new Date().toISOString();
    const { data: tab, error } = await tenantDb
      .from('product_tabs')
      .insert({
        store_id: tabData.store_id,
        name: tabData.name || '',
        slug: tabData.slug,
        tab_type: tabData.tab_type || 'text',
        content: tabData.content || '',
        attribute_ids: tabData.attribute_ids || [],
        attribute_set_ids: tabData.attribute_set_ids || [],
        sort_order: tabData.sort_order || 0,
        is_active: tabData.is_active !== false,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating product tab:', error);
      throw error;
    }

    // Insert translations
    for (const [langCode, data] of Object.entries(translations)) {
      if (data && (data.name || data.content)) {
        const { error: transError } = await tenantDb
          .from('product_tab_translations')
          .upsert({
            product_tab_id: tab.id,
            language_code: langCode,
            name: data.name || null,
            content: data.content || null,
            created_at: now,
            updated_at: now
          }, {
            onConflict: 'product_tab_id,language_code'
          });

        if (transError) {
          console.error(`Error inserting translation for ${langCode}:`, transError);
        }
      }
    }

    // Return the created tab with translations
    return await getProductTabWithAllTranslations(tabData.store_id, tab.id);
  } catch (error) {
    console.error('Error creating product tab:', error);
    throw error;
  }
}

/**
 * Update product tab with translations
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Product tab ID
 * @param {Object} tabData - Product tab data (without translations)
 * @param {Object} translations - Translations object { en: {name, content}, nl: {name, content} }
 * @returns {Promise<Object>} Updated product tab with translations
 */
async function updateProductTabWithTranslations(storeId, id, tabData, translations = {}) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  try {
    // Build update object
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (tabData.name !== undefined) updateData.name = tabData.name;
    if (tabData.slug !== undefined) updateData.slug = tabData.slug;
    if (tabData.tab_type !== undefined) updateData.tab_type = tabData.tab_type;
    if (tabData.content !== undefined) updateData.content = tabData.content;
    if (tabData.attribute_ids !== undefined) updateData.attribute_ids = tabData.attribute_ids;
    if (tabData.attribute_set_ids !== undefined) updateData.attribute_set_ids = tabData.attribute_set_ids;
    if (tabData.sort_order !== undefined) updateData.sort_order = tabData.sort_order;
    if (tabData.is_active !== undefined) updateData.is_active = tabData.is_active;

    const { data: tab, error } = await tenantDb
      .from('product_tabs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product tab:', error);
      throw error;
    }

    // Update translations
    for (const [langCode, data] of Object.entries(translations)) {
      if (data && (data.name !== undefined || data.content !== undefined)) {
        console.log(`   💾 Updating translation for language ${langCode}:`, data);

        const { error: transError } = await tenantDb
          .from('product_tab_translations')
          .upsert({
            product_tab_id: id,
            language_code: langCode,
            name: data.name !== undefined ? data.name : null,
            content: data.content !== undefined ? data.content : null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'product_tab_id,language_code'
          });

        if (transError) {
          console.error(`Error updating translation for ${langCode}:`, transError);
        }
      }
    }

    console.log(`   ✅ Product tab updated with translations`);

    // Return the updated tab with all translations
    return await getProductTabWithAllTranslations(storeId, id);
  } catch (error) {
    console.error('Error updating product tab:', error);
    throw error;
  }
}

/**
 * Delete product tab (translations are CASCADE deleted)
 *
 * @param {string} storeId - Store ID
 * @param {string} id - Product tab ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteProductTab(storeId, id) {
  const tenantDb = await ConnectionManager.getStoreConnection(storeId);

  const { error } = await tenantDb
    .from('product_tabs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product tab:', error);
    throw error;
  }

  return true;
}

module.exports = {
  getProductTabsWithTranslations,
  getProductTabById,
  getProductTabWithAllTranslations,
  createProductTabWithTranslations,
  updateProductTabWithTranslations,
  deleteProductTab
};
