/**
 * Product Attribute Batcher
 *
 * Optimizes product attribute loading by batching multiple queries into parallel operations.
 * Reduces N+1 query patterns by fetching all attribute data for multiple products in 2-3 queries
 * instead of 6-8 sequential queries.
 */

/**
 * Build translation map with language fallback to English
 * @param {Array} translations - Array of translation records
 * @param {string} foreignKey - The foreign key field name (e.g., 'attribute_id')
 * @param {string} lang - Requested language code
 * @returns {Map} Map of entityId -> { [lang]: data, en: data }
 */
function buildTranslationMap(translations, foreignKey, lang) {
  const map = new Map();

  (translations || []).forEach(t => {
    const entityId = t[foreignKey];
    if (!map.has(entityId)) {
      map.set(entityId, {});
    }
    map.get(entityId)[t.language_code] = t;
  });

  return map;
}

/**
 * Batch fetch all product attributes, values, and translations for multiple products
 *
 * @param {Array<string>} productIds - Array of product IDs
 * @param {string} lang - Language code for translations
 * @param {Object} tenantDb - Tenant database connection (Supabase client)
 * @returns {Promise<Object>} Object containing:
 *   - pavByProduct: { productId: [pav, ...] }
 *   - attrMap: Map of attributeId -> attribute
 *   - valMap: Map of valueId -> attributeValue
 *   - attrTransMap: Map of attributeId -> { lang: translation }
 *   - valTransMap: Map of valueId -> { lang: translation }
 */
async function batchFetchProductAttributes(productIds, lang, tenantDb) {
  // Return empty data if no products
  if (!productIds || productIds.length === 0) {
    return {
      pavByProduct: {},
      attrMap: new Map(),
      valMap: new Map(),
      attrTransMap: new Map(),
      valTransMap: new Map()
    };
  }

  // 1. Fetch all product attribute values in a single query
  const { data: attributeValuesData, error: pavError } = await tenantDb
    .from('product_attribute_values')
    .select('*')
    .in('product_id', productIds);

  if (pavError) {
    console.error('Error fetching product attribute values:', pavError.message);
    return {
      pavByProduct: {},
      attrMap: new Map(),
      valMap: new Map(),
      attrTransMap: new Map(),
      valTransMap: new Map()
    };
  }

  const pavs = attributeValuesData || [];

  // If no attribute values, return early
  if (pavs.length === 0) {
    return {
      pavByProduct: {},
      attrMap: new Map(),
      valMap: new Map(),
      attrTransMap: new Map(),
      valTransMap: new Map()
    };
  }

  // Extract unique IDs for batch queries
  const attributeIds = [...new Set(pavs.map(pav => pav.attribute_id))];
  const attributeValueIds = [...new Set(pavs.filter(pav => pav.value_id).map(pav => pav.value_id))];

  // 2. Run all data fetching queries in parallel
  const [
    attributesResult,
    valuesResult,
    attrTransResult,
    valTransResult
  ] = await Promise.all([
    // Fetch attributes
    attributeIds.length > 0
      ? tenantDb
          .from('attributes')
          .select('id, code, type, is_filterable')
          .in('id', attributeIds)
      : Promise.resolve({ data: [] }),

    // Fetch attribute values
    attributeValueIds.length > 0
      ? tenantDb
          .from('attribute_values')
          .select('id, code, metadata')
          .in('id', attributeValueIds)
      : Promise.resolve({ data: [] }),

    // Fetch attribute translations (requested language + English fallback)
    attributeIds.length > 0
      ? tenantDb
          .from('attribute_translations')
          .select('*')
          .in('attribute_id', attributeIds)
          .in('language_code', [lang, 'en'])
      : Promise.resolve({ data: [] }),

    // Fetch attribute value translations (requested language + English fallback)
    attributeValueIds.length > 0
      ? tenantDb
          .from('attribute_value_translations')
          .select('*')
          .in('attribute_value_id', attributeValueIds)
          .in('language_code', [lang, 'en'])
      : Promise.resolve({ data: [] })
  ]);

  // Build lookup maps
  const attrMap = new Map((attributesResult.data || []).map(a => [a.id, a]));
  const valMap = new Map((valuesResult.data || []).map(v => [v.id, v]));

  // Build translation maps with language fallback
  const attrTransMap = buildTranslationMap(attrTransResult.data, 'attribute_id', lang);
  const valTransMap = buildTranslationMap(valTransResult.data, 'attribute_value_id', lang);

  // Group product attribute values by product ID
  const pavByProduct = {};
  pavs.forEach(pav => {
    if (!pavByProduct[pav.product_id]) {
      pavByProduct[pav.product_id] = [];
    }
    pavByProduct[pav.product_id].push(pav);
  });

  return {
    pavByProduct,
    attrMap,
    valMap,
    attrTransMap,
    valTransMap
  };
}

/**
 * Format product attributes using pre-fetched batch data
 *
 * @param {string} productId - Product ID
 * @param {string} lang - Language code
 * @param {Object} batchData - Data from batchFetchProductAttributes
 * @returns {Array} Formatted attributes array
 */
function formatProductAttributes(productId, lang, batchData) {
  const { pavByProduct, attrMap, valMap, attrTransMap, valTransMap } = batchData;
  const productPavs = pavByProduct[productId] || [];

  return productPavs.map(pav => {
    const attr = attrMap.get(pav.attribute_id);
    if (!attr) return null;

    // Get attribute label from translations
    const attrTrans = attrTransMap.get(attr.id) || {};
    const attrLabel = attrTrans[lang]?.label || attrTrans.en?.label || attr.code;

    let value, valueLabel, metadata = null;

    if (pav.value_id) {
      // Select/multiselect attribute - get value from lookup
      const val = valMap.get(pav.value_id);
      if (val) {
        value = val.code;
        const valTrans = valTransMap.get(val.id) || {};
        // Note: attribute_value_translations uses 'value' column, not 'label'
        valueLabel = valTrans[lang]?.value || valTrans.en?.value || val.code;
        metadata = val.metadata;
      }
    } else {
      // Text/number/date/boolean attribute
      value = pav.text_value || pav.number_value || pav.date_value || pav.boolean_value;
      valueLabel = String(value);
    }

    return {
      id: attr.id,
      code: attr.code,
      label: attrLabel,
      value: valueLabel,
      rawValue: value,
      type: attr.type,
      metadata
    };
  }).filter(Boolean);
}

/**
 * Enrich products with attributes using batch data
 *
 * @param {Array} products - Array of product objects
 * @param {string} lang - Language code
 * @param {Object} batchData - Data from batchFetchProductAttributes
 * @returns {Array} Products with attributes array added
 */
function enrichProductsWithAttributes(products, lang, batchData) {
  return products.map(product => ({
    ...product,
    attributes: formatProductAttributes(product.id, lang, batchData)
  }));
}

module.exports = {
  batchFetchProductAttributes,
  formatProductAttributes,
  enrichProductsWithAttributes
};
