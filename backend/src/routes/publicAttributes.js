const express = require('express');
const { getLanguageFromRequest } = require('../utils/languageUtils');
const { applyCacheHeaders } = require('../utils/cacheUtils');
const ConnectionManager = require('../services/database/ConnectionManager');
const router = express.Router();

// @route   GET /api/public/attributes
// @desc    Get attributes for a store (public access)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;
    const { page = 1, limit = 100, is_filterable } = req.query;
    const offset = (page - 1) * limit;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    const lang = getLanguageFromRequest(req);

    // Query attributes from tenant DB (Supabase doesn't support joins, so query separately)
    let attributesQuery = tenantDb
      .from('attributes')
      .select('*')
      .eq('store_id', store_id)
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    // Filter by is_filterable if provided
    if (is_filterable !== undefined) {
      attributesQuery = attributesQuery.eq('is_filterable', is_filterable === 'true' || is_filterable === true);
    }

    const { data: attributes, error, count } = await attributesQuery;

    if (error) {
      console.error('Error fetching attributes:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch attributes',
        error: error.message
      });
    }

    if (!attributes || attributes.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Get attribute translations
    const attributeIds = attributes.map(a => a.id);
    const { data: translations, error: transError } = await tenantDb
      .from('attribute_translations')
      .select('*')
      .in('attribute_id', attributeIds)
      .in('language_code', [lang, 'en']); // Get requested lang + English fallback

    // Build translation map
    const translationMap = {};
    (translations || []).forEach(t => {
      if (!translationMap[t.attribute_id]) {
        translationMap[t.attribute_id] = {};
      }
      translationMap[t.attribute_id][t.language_code] = t;
    });

    // Apply translations to attributes
    // Include both `label` (for backward compatibility) and `translations` object (for frontend consistency)
    const attributesWithTranslations = attributes.map(attr => {
      const trans = translationMap[attr.id];
      const requestedLang = trans?.[lang];
      const englishLang = trans?.['en'];

      // Build translations object in the format: { en: { label: '...' }, nl: { label: '...' } }
      const translations = {};
      if (trans) {
        Object.entries(trans).forEach(([langCode, langData]) => {
          translations[langCode] = { label: langData.label };
        });
      }

      return {
        ...attr,
        // Include translations object for frontend consistency with page-bootstrap.js
        translations,
        // Use translations.label field, fallback to attr.code (attr.name is deprecated)
        label: requestedLang?.label || englishLang?.label || attr.code,
        description: requestedLang?.description || englishLang?.description || attr.description
      };
    });

    // Fetch attribute values for select/multiselect attributes
    const attributesWithValues = await Promise.all(attributesWithTranslations.map(async (attr) => {
      if (attr.type === 'select' || attr.type === 'multiselect') {
        // Get attribute values with translations
        const valueLimit = attr.is_filterable ? 1000 : 10; // Use high limit for filterable, otherwise 10

        // Query attribute values
        const { data: values, error: valuesError } = await tenantDb
          .from('attribute_values')
          .select('*')
          .eq('attribute_id', attr.id)
          .order('sort_order', { ascending: true })
          .limit(valueLimit);

        if (valuesError || !values || values.length === 0) {
          return { ...attr, values: [] };
        }

        // Get value translations
        const valueIds = values.map(v => v.id);
        const { data: valueTranslations } = await tenantDb
          .from('attribute_value_translations')
          .select('*')
          .in('attribute_value_id', valueIds)
          .in('language_code', [lang, 'en']);

        // Build value translation map
        const valueTransMap = {};
        (valueTranslations || []).forEach(vt => {
          if (!valueTransMap[vt.attribute_value_id]) {
            valueTransMap[vt.attribute_value_id] = {};
          }
          valueTransMap[vt.attribute_value_id][vt.language_code] = vt;
        });

        // Apply translations to values
        // Include translations object in same format as page-bootstrap.js: { en: { label: '...' }, nl: { label: '...' } }
        const translatedValues = values.map(val => {
          const valTrans = valueTransMap[val.id];
          const reqLang = valTrans?.[lang];
          const enLang = valTrans?.['en'];

          // Build translations object for value
          const valTranslations = {};
          if (valTrans) {
            Object.entries(valTrans).forEach(([langCode, langData]) => {
              valTranslations[langCode] = { label: langData.value }; // DB uses 'value', frontend expects 'label'
            });
          }

          return {
            ...val,
            translations: valTranslations,
            value: reqLang?.value || enLang?.value || val.value
          };
        });

        return { ...attr, values: translatedValues };
      } else {
        return { ...attr, values: [] };
      }
    }));

    // Apply cache headers based on store settings
    await applyCacheHeaders(res, store_id);

    // Return just the array for public requests (for compatibility with StorefrontBaseEntity)
    res.json(attributesWithValues);
  } catch (error) {
    console.error('Get attributes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
