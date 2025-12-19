/**
 * Attribute Helpers for Normalized Translations
 *
 * Specialized helpers for fetching attributes with their values and translations
 * from normalized tables while maintaining the same JSON format the frontend expects.
 */

const { wrap, generateKey } = require('./cacheManager');

/**
 * Get attributes with translations from normalized tables
 * Returns same format as before: { id, name, code, translations: {en: {name, description}, nl: {...}} }
 *
 * @param {Object} tenantDb - Tenant database connection (Supabase client)
 * @param {object} where - WHERE clause conditions (supports simple values and arrays)
 * @returns {Promise<Array>} Attributes with translations
 */
async function getAttributesWithTranslations(tenantDb, where = {}) {
  if (!tenantDb) {
    throw new Error('tenantDb connection required');
  }

  const { Op } = require('sequelize');

  // Build WHERE clause
  const whereConditions = Object.entries(where)
    .map(([key, value]) => {
      if (value === null) return `a.${key} IS NULL`;

      // Handle Sequelize Op.in
      if (typeof value === 'object' && value[Op.in]) {
        const vals = value[Op.in].map(v => `'${v}'`).join(', ');
        return `a.${key} IN (${vals})`;
      }

      // Handle Sequelize Op.notIn
      if (typeof value === 'object' && value[Op.notIn]) {
        const vals = value[Op.notIn].map(v => `'${v}'`).join(', ');
        return `a.${key} NOT IN (${vals})`;
      }

      // Handle arrays (treat as IN)
      if (Array.isArray(value)) {
        const vals = value.map(v => `'${v}'`).join(', ');
        return `a.${key} IN (${vals})`;
      }

      // Handle simple values
      return `a.${key} = '${value}'`;
    })
    .join(' AND ');

  const whereClause = whereConditions ? `WHERE ${whereConditions}` : '';

  // Fetch attributes and translations separately using query builder
  // This works uniformly across Supabase, Knex, and other adapters
  let attributeQuery = tenantDb.from('attributes').select('*');

  // Apply where filters
  Object.entries(where).forEach(([key, value]) => {
    if (value === null) {
      attributeQuery = attributeQuery.is(key, null);
    } else if (typeof value === 'object' && value[Op.in]) {
      attributeQuery = attributeQuery.in(key, value[Op.in]);
    } else if (typeof value === 'object' && value[Op.notIn]) {
      attributeQuery = attributeQuery.not(key, 'in', value[Op.notIn]);
    } else if (Array.isArray(value)) {
      attributeQuery = attributeQuery.in(key, value);
    } else {
      attributeQuery = attributeQuery.eq(key, value);
    }
  });

  attributeQuery = attributeQuery.order('sort_order', { ascending: true });

  const { data: attributes, error: attrError } = await attributeQuery;

  if (attrError) throw attrError;
  if (!attributes || attributes.length === 0) return [];

  // Fetch translations for these attributes
  const attributeIds = attributes.map(a => a.id);
  const { data: translations, error: transError } = await tenantDb
    .from('attribute_translations')
    .select('*')
    .in('attribute_id', attributeIds);

  if (transError) {
    console.error('Error fetching attribute translations:', transError);
    return attributes.map(a => ({ ...a, translations: {} }));
  }

  // Group translations by attribute_id and language_code
  const translationsByAttribute = {};
  (translations || []).forEach(t => {
    if (!translationsByAttribute[t.attribute_id]) {
      translationsByAttribute[t.attribute_id] = {};
    }
    translationsByAttribute[t.attribute_id][t.language_code] = {
      name: t.label,
      description: t.description
    };
  });

  // Merge translations into attributes
  return attributes.map(a => ({
    ...a,
    translations: translationsByAttribute[a.id] || {}
  }));
}

/**
 * Get attribute values with translations from normalized tables
 * Returns same format: { id, attribute_id, code, translations: {en: {label}, nl: {...}} }
 *
 * @param {Object} tenantDb - Tenant database connection (Supabase client)
 * @param {object} where - WHERE clause conditions (supports simple values and Sequelize Op.in)
 * @returns {Promise<Array>} Attribute values with translations
 */
async function getAttributeValuesWithTranslations(tenantDb, where = {}) {
  if (!tenantDb) {
    throw new Error('tenantDb connection required');
  }

  const { Op } = require('sequelize');

  // Fetch attribute values
  let valuesQuery = tenantDb.from('attribute_values').select('*');

  // Apply where filters
  Object.entries(where).forEach(([key, value]) => {
    if (value === null) {
      valuesQuery = valuesQuery.is(key, null);
    } else if (typeof value === 'object' && value[Op.in]) {
      valuesQuery = valuesQuery.in(key, value[Op.in]);
    } else if (typeof value === 'object' && value[Op.notIn]) {
      valuesQuery = valuesQuery.not(key, 'in', value[Op.notIn]);
    } else if (Array.isArray(value)) {
      valuesQuery = valuesQuery.in(key, value);
    } else {
      valuesQuery = valuesQuery.eq(key, value);
    }
  });

  valuesQuery = valuesQuery.order('sort_order', { ascending: true });

  const { data: values, error: valuesError } = await valuesQuery;

  if (valuesError) throw valuesError;
  if (!values || values.length === 0) return [];

  // Fetch translations for these values
  const valueIds = values.map(v => v.id);
  const { data: translations, error: transError } = await tenantDb
    .from('attribute_value_translations')
    .select('*')
    .in('attribute_value_id', valueIds);

  if (transError) {
    console.error('Error fetching attribute value translations:', transError);
    return values.map(v => ({ ...v, translations: {} }));
  }

  // Group translations by attribute_value_id and language_code
  const translationsByValue = {};
  (translations || []).forEach(t => {
    if (!translationsByValue[t.attribute_value_id]) {
      translationsByValue[t.attribute_value_id] = {};
    }
    translationsByValue[t.attribute_value_id][t.language_code] = {
      label: t.value,
      description: t.description
    };
  });

  // Merge translations into values
  return values.map(v => ({
    ...v,
    translations: translationsByValue[v.id] || {}
  }));
}

/**
 * Get single attribute with its values and translations
 *
 * @param {Object} tenantDb - Tenant database connection (Supabase client)
 * @param {string} attributeId - Attribute ID
 * @returns {Promise<object>} Attribute with values and translations
 */
async function getAttributeWithValues(tenantDb, attributeId) {
  const attributes = await getAttributesWithTranslations(tenantDb, { id: attributeId });

  if (!attributes || attributes.length === 0) {
    return null;
  }

  const attribute = attributes[0];

  // Fetch values if this is a select/multiselect attribute
  if (attribute.type === 'select' || attribute.type === 'multiselect') {
    const values = await getAttributeValuesWithTranslations(tenantDb, { attribute_id: attributeId });
    attribute.values = values;
  } else {
    attribute.values = [];
  }

  return attribute;
}

/**
 * Get all attributes with their values for a store
 *
 * @param {Object} tenantDb - Tenant database connection (Supabase client)
 * @param {string} storeId - Store ID
 * @param {object} options - Additional options (search, is_filterable, etc.)
 * @returns {Promise<Array>} Attributes with values and translations
 */
async function getAttributesWithValuesForStore(tenantDb, storeId, options = {}) {
  if (!tenantDb) {
    throw new Error('tenantDb connection required');
  }

  const { search, is_filterable, attribute_ids } = options;

  // Build where conditions
  const where = { store_id: storeId };
  if (is_filterable !== undefined) {
    where.is_filterable = is_filterable;
  }
  if (attribute_ids && Array.isArray(attribute_ids)) {
    const { Op } = require('sequelize');
    where.id = { [Op.in]: attribute_ids };
  }

  // Get attributes with translations
  const attributes = await getAttributesWithTranslations(tenantDb, where);

  // Apply search filter in JavaScript if needed
  let filteredAttributes = attributes;
  if (search) {
    const searchLower = search.toLowerCase();
    filteredAttributes = attributes.filter(a =>
      (a.name && a.name.toLowerCase().includes(searchLower)) ||
      (a.code && a.code.toLowerCase().includes(searchLower))
    );
  }

  // For each select/multiselect attribute, fetch its values
  for (const attribute of filteredAttributes) {
    if (attribute.type === 'select' || attribute.type === 'multiselect') {
      attribute.values = await getAttributeValuesWithTranslations(tenantDb, {
        attribute_id: attribute.id
      });
    } else {
      attribute.values = [];
    }
  }

  return filteredAttributes;
}

/**
 * Save attribute translations to normalized table
 * Uses check-then-upsert pattern for compatibility with different schema versions
 *
 * @param {Object} tenantDb - Tenant database connection (Supabase client)
 * @param {string} attributeId - Attribute ID
 * @param {object} translations - Translations object {en: {name, description}, nl: {...}}
 */
async function saveAttributeTranslations(tenantDb, attributeId, translations) {
  if (!tenantDb) {
    throw new Error('tenantDb connection required');
  }

  for (const [langCode, data] of Object.entries(translations)) {
    if (!data || typeof data !== 'object') continue;

    const label = data.name || data.label || ''; // Accept 'name' (new) or 'label' (old) for backward compatibility
    const description = data.description || null;

    // Check if translation exists
    const { data: existing } = await tenantDb
      .from('attribute_translations')
      .select('id')
      .eq('attribute_id', attributeId)
      .eq('language_code', langCode)
      .maybeSingle();

    if (existing) {
      // Update existing translation
      const { error } = await tenantDb
        .from('attribute_translations')
        .update({
          label: label !== undefined ? label : null,
          description: description !== undefined ? description : null,
          updated_at: new Date().toISOString()
        })
        .eq('attribute_id', attributeId)
        .eq('language_code', langCode);

      if (error) {
        console.error('Error updating attribute translation:', error);
        throw error;
      }
    } else {
      // Insert new translation
      const { error } = await tenantDb
        .from('attribute_translations')
        .insert({
          attribute_id: attributeId,
          language_code: langCode,
          label: label !== undefined ? label : null,
          description: description !== undefined ? description : null,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error inserting attribute translation:', error);
        throw error;
      }
    }
  }
}

/**
 * Save attribute value translations to normalized table
 * Uses check-then-upsert pattern for compatibility with different schema versions
 *
 * @param {Object} tenantDb - Tenant database connection (Supabase client)
 * @param {string} valueId - Attribute value ID
 * @param {object} translations - Translations object {en: {label}, nl: {...}}
 */
async function saveAttributeValueTranslations(tenantDb, valueId, translations) {
  if (!tenantDb) {
    throw new Error('tenantDb connection required');
  }

  for (const [langCode, data] of Object.entries(translations)) {
    if (!data || typeof data !== 'object') continue;

    const value = data.label || ''; // JSON uses 'label', but table uses 'value'
    const description = data.description || null;

    // Check if translation exists
    const { data: existing } = await tenantDb
      .from('attribute_value_translations')
      .select('id')
      .eq('attribute_value_id', valueId)
      .eq('language_code', langCode)
      .maybeSingle();

    if (existing) {
      // Update existing translation
      const { error } = await tenantDb
        .from('attribute_value_translations')
        .update({
          value: value !== undefined ? value : null,
          description: description !== undefined ? description : null,
          updated_at: new Date().toISOString()
        })
        .eq('attribute_value_id', valueId)
        .eq('language_code', langCode);

      if (error) {
        console.error('Error updating attribute value translation:', error);
        throw error;
      }
    } else {
      // Insert new translation
      const { error } = await tenantDb
        .from('attribute_value_translations')
        .insert({
          attribute_value_id: valueId,
          language_code: langCode,
          value: value !== undefined ? value : null,
          description: description !== undefined ? description : null,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error inserting attribute value translation:', error);
        throw error;
      }
    }
  }
}

/**
 * Cached wrapper for getAttributesWithTranslations
 * Caches attribute data for 10 minutes to reduce database load
 *
 * @param {Object} tenantDb - Tenant database connection
 * @param {object} where - WHERE clause conditions
 * @param {string} storeId - Store ID for cache key
 * @returns {Promise<Array>} Attributes with translations (cached)
 */
async function getAttributesWithTranslationsCached(tenantDb, where = {}, storeId) {
  // Generate cache key based on attribute IDs
  const ids = where.id
    ? (Array.isArray(where.id) ? where.id.sort().join(',') : String(where.id))
    : 'all';
  const cacheKey = generateKey('attr_trans', storeId, { ids });

  return wrap(cacheKey, () => getAttributesWithTranslations(tenantDb, where), 600);
}

/**
 * Cached wrapper for getAttributeValuesWithTranslations
 * Caches attribute value data for 10 minutes to reduce database load
 *
 * @param {Object} tenantDb - Tenant database connection
 * @param {object} where - WHERE clause conditions
 * @param {string} storeId - Store ID for cache key
 * @returns {Promise<Array>} Attribute values with translations (cached)
 */
async function getAttributeValuesWithTranslationsCached(tenantDb, where = {}, storeId) {
  // Generate cache key based on value IDs
  const ids = where.id
    ? (Array.isArray(where.id) ? where.id.sort().join(',') : String(where.id))
    : 'all';
  const cacheKey = generateKey('attr_val_trans', storeId, { ids });

  return wrap(cacheKey, () => getAttributeValuesWithTranslations(tenantDb, where), 600);
}

module.exports = {
  getAttributesWithTranslations,
  getAttributeValuesWithTranslations,
  getAttributesWithTranslationsCached,
  getAttributeValuesWithTranslationsCached,
  getAttributeWithValues,
  getAttributesWithValuesForStore,
  saveAttributeTranslations,
  saveAttributeValueTranslations
};
