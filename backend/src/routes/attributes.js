const express = require('express');
const { body, validationResult } = require('express-validator');
const ConnectionManager = require('../services/database/ConnectionManager');
const translationService = require('../services/translation-service');
const { authMiddleware } = require('../middleware/authMiddleware');
const { authorize, storeOwnerOnly } = require('../middleware/auth');
const creditService = require('../services/credit-service');
const {
  getAttributesWithTranslations,
  getAttributeValuesWithTranslations,
  getAttributeWithValues,
  saveAttributeTranslations,
  saveAttributeValueTranslations
} = require('../utils/attributeHelpers');
const router = express.Router();

// Import auth middleware

// Basic CRUD operations for attributes
router.get('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const { page = 1, limit = 100, search, attribute_set_id, exclude_assigned, is_filterable } = req.query;
    const offset = (page - 1) * limit;

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Build Supabase query
    let query = tenantDb.from('attributes').select('*', { count: 'exact' }).eq('store_id', store_id);

    // Filter by is_filterable
    if (is_filterable !== undefined) {
      query = query.eq('is_filterable', is_filterable === 'true' || is_filterable === true);
    }

    // Search functionality (simplified - searches name and code)
    if (search) {
      query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
    }

    // TODO: Implement attribute_set_id and exclude_assigned filters
    // These require additional queries to attribute_sets table

    // Apply pagination and ordering
    query = query
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true })
      .range(offset, offset + parseInt(limit) - 1);

    const { data: rows, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Load translations for attributes
    const attributeIds = (rows || []).map(a => a.id);
    let attrTranslations = [];

    if (attributeIds.length > 0) {
      const { data: trans } = await tenantDb
        .from('attribute_translations')
        .select('*')
        .in('attribute_id', attributeIds)
        .in('language_code', [req.query.lang || 'en', 'en']);

      attrTranslations = trans || [];
    }

    // Build translation map - use 'label' field directly
    const attrTransMap = {};
    attrTranslations.forEach(t => {
      if (!attrTransMap[t.attribute_id]) attrTransMap[t.attribute_id] = {};
      attrTransMap[t.attribute_id][t.language_code] = {
        label: t.label,
        description: t.description
      };
    });

    // Load attribute values for select/multiselect attributes
    const attributesWithValues = await Promise.all((rows || []).map(async (attr) => {
      const lang = req.query.lang || 'en';
      const trans = attrTransMap[attr.id];
      const reqLang = trans?.[lang];
      const enLang = trans?.['en'];

      const attrWithTrans = {
        ...attr,
        translations: trans || {},
        label: reqLang?.label || enLang?.label || attr.code
      };

      // Load values for select/multiselect types
      if (attr.type === 'select' || attr.type === 'multiselect') {
        const { data: values } = await tenantDb
          .from('attribute_values')
          .select('*')
          .eq('attribute_id', attr.id)
          .order('sort_order', { ascending: true });

        // Load value translations
        const valueIds = (values || []).map(v => v.id);
        let valueTrans = [];

        if (valueIds.length > 0) {
          const { data: vt } = await tenantDb
            .from('attribute_value_translations')
            .select('*')
            .in('attribute_value_id', valueIds)
            .in('language_code', [lang, 'en']);

          valueTrans = vt || [];
        }

        // Build value translation map (transform to { lang: { label: '...' } } format)
        const valTransMap = {};
        valueTrans.forEach(t => {
          if (!valTransMap[t.attribute_value_id]) valTransMap[t.attribute_value_id] = {};
          valTransMap[t.attribute_value_id][t.language_code] = {
            label: t.value,  // DB uses 'value', frontend expects 'label'
            description: t.description
          };
        });

        // Apply translations to values
        attrWithTrans.values = (values || []).map(v => {
          const vTrans = valTransMap[v.id] || {};
          const vReqLang = vTrans[lang];
          const vEnLang = vTrans['en'];

          return {
            ...v,
            translations: vTrans,
            label: vReqLang?.label || vEnLang?.label || v.code
          };
        });
      }

      return attrWithTrans;
    }));

    res.json({
      success: true,
      data: {
        attributes: attributesWithValues,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Attributes API error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.get('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    const { data: attribute, error } = await tenantDb
      .from('attributes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error || !attribute) {
      return res.status(404).json({ success: false, message: 'Attribute not found' });
    }

    const lang = req.query.lang || 'en';

    // Load translations
    const { data: attrTrans } = await tenantDb
      .from('attribute_translations')
      .select('*')
      .eq('attribute_id', attribute.id)
      .in('language_code', [lang, 'en']);

    // Build translation map - use 'label' field directly
    const transMap = {};
    (attrTrans || []).forEach(t => {
      transMap[t.language_code] = {
        label: t.label,
        description: t.description
      };
    });

    const reqLang = transMap[lang];
    const enLang = transMap['en'];

    const attributeData = {
      ...attribute,
      translations: transMap,
      label: reqLang?.label || enLang?.label || attribute.code
    };

    // Load values if select/multiselect
    if (attribute.type === 'select' || attribute.type === 'multiselect') {
      const { data: values } = await tenantDb
        .from('attribute_values')
        .select('*')
        .eq('attribute_id', attribute.id)
        .order('sort_order', { ascending: true });

      // Load value translations
      const valueIds = (values || []).map(v => v.id);

      if (valueIds.length > 0) {
        const { data: valTrans } = await tenantDb
          .from('attribute_value_translations')
          .select('*')
          .in('attribute_value_id', valueIds)
          .in('language_code', [lang, 'en']);

        // Build value translation map (transform to { lang: { label: '...' } } format)
        const valTransMap = {};
        (valTrans || []).forEach(t => {
          if (!valTransMap[t.attribute_value_id]) valTransMap[t.attribute_value_id] = {};
          valTransMap[t.attribute_value_id][t.language_code] = {
            label: t.value,  // DB uses 'value', frontend expects 'label'
            description: t.description
          };
        });

        attributeData.values = (values || []).map(v => {
          const vTrans = valTransMap[v.id] || {};
          const vReqLang = vTrans[lang];
          const vEnLang = vTrans['en'];

          return {
            ...v,
            translations: vTrans,
            label: vReqLang?.label || vEnLang?.label || v.code
          };
        });
      }
    }

    console.log('📝 Backend: Loaded attribute with translations:', {
      id: attributeData.id,
      code: attributeData.code,
      translations: attributeData.translations,
      translationKeys: Object.keys(attributeData.translations || {})
    });

    res.json({ success: true, data: attributeData });
  } catch (error) {
    console.error('❌ Get attribute error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Prepare attribute data
    const { translations, ...attributeData } = req.body;

    // Ensure store_id is set
    attributeData.store_id = store_id;

    // Insert attribute into tenant database
    const { data: attribute, error } = await tenantDb
      .from('attributes')
      .insert(attributeData)
      .select()
      .single();

    if (error) {
      console.error('❌ Create attribute error:', error);
      throw new Error(error.message);
    }

    // Save translations if provided
    if (translations && typeof translations === 'object') {
      await saveAttributeTranslations(tenantDb, attribute.id, translations);
    }

    // Fetch complete attribute with translations
    const completeAttribute = await getAttributeWithValues(tenantDb, attribute.id);

    res.status(201).json({
      success: true,
      message: 'Attribute created successfully',
      data: completeAttribute
    });
  } catch (error) {
    console.error('❌ Create attribute error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.put('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get attribute from tenant DB
    const { data: attribute, error: fetchError } = await tenantDb
      .from('attributes')
      .select('*')
      .eq('id', req.params.id)
      .eq('store_id', store_id)
      .single();

    if (fetchError || !attribute) {
      return res.status(404).json({ success: false, message: 'Attribute not found' });
    }

    // Extract translations and non-table fields from request body
    // values = attribute_values array (stored in separate table)
    // name, label = legacy fields (now in translations)
    // store_id = should not be updated
    const { translations, name, label, values, store_id: _, ...attributeData } = req.body;

    // Only update if there are attribute fields to update
    if (Object.keys(attributeData).length > 0) {
      const { error: updateError } = await tenantDb
        .from('attributes')
        .update(attributeData)
        .eq('id', req.params.id)
        .eq('store_id', store_id);

      if (updateError) {
        throw updateError;
      }
    }

    // Save translations to normalized table if provided
    if (translations && typeof translations === 'object') {
      await saveAttributeTranslations(tenantDb, req.params.id, translations);
    }

    // Fetch updated attribute with translations
    const updatedAttribute = await getAttributeWithValues(tenantDb, req.params.id);

    res.json({ success: true, message: 'Attribute updated successfully', data: updatedAttribute });
  } catch (error) {
    console.error('❌ Update attribute error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

router.delete('/:id', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({ success: false, message: 'store_id is required' });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if attribute exists
    const { data: attribute, error: fetchError } = await tenantDb
      .from('attributes')
      .select('id')
      .eq('id', req.params.id)
      .eq('store_id', store_id)
      .single();

    if (fetchError || !attribute) {
      return res.status(404).json({ success: false, message: 'Attribute not found' });
    }

    // Delete attribute
    const { error: deleteError } = await tenantDb
      .from('attributes')
      .delete()
      .eq('id', req.params.id)
      .eq('store_id', store_id);

    if (deleteError) {
      throw deleteError;
    }

    res.json({ success: true, message: 'Attribute deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========== ATTRIBUTE VALUES ROUTES ==========

// Get all values for an attribute
router.get('/:attributeId/values', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if attribute exists and belongs to store
    const { data: attribute, error: attrError } = await tenantDb
      .from('attributes')
      .select('id, store_id')
      .eq('id', req.params.attributeId)
      .eq('store_id', store_id)
      .maybeSingle();

    if (attrError || !attribute) {
      return res.status(404).json({ success: false, error: 'Attribute not found' });
    }

    // Check access if authenticated request
    if (req.user && req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Get attribute values
    const { data: values, error: valuesError } = await tenantDb
      .from('attribute_values')
      .select('*')
      .eq('attribute_id', req.params.attributeId)
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true });

    if (valuesError) {
      throw valuesError;
    }

    res.json({ success: true, data: values || [] });
  } catch (error) {
    console.error('❌ Get attribute values error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create attribute value
router.post('/:attributeId/values', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if attribute exists and belongs to store
    const { data: attribute, error: attrError } = await tenantDb
      .from('attributes')
      .select('id, store_id')
      .eq('id', req.params.attributeId)
      .eq('store_id', store_id)
      .maybeSingle();

    if (attrError || !attribute) {
      return res.status(404).json({ success: false, error: 'Attribute not found' });
    }

    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const { code, translations, metadata, sort_order } = req.body;

    console.log('📝 Creating attribute value:', { code, translations, sort_order });

    // Insert attribute value
    const { data: value, error: insertError } = await tenantDb
      .from('attribute_values')
      .insert({
        attribute_id: req.params.attributeId,
        code,
        sort_order: sort_order || 0
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log('✅ Attribute value created:', value.id);

    // Save translations if provided
    if (translations && typeof translations === 'object' && Object.keys(translations).length > 0) {
      console.log('📝 Saving translations for value:', value.id, translations);
      await saveAttributeValueTranslations(tenantDb, value.id, translations);
      console.log('✅ Translations saved for value:', value.id);
    } else {
      console.log('⚠️ No translations provided for value:', value.id);
    }

    res.json({ success: true, data: value });
  } catch (error) {
    console.error('❌ Create attribute value error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update attribute value
router.put('/:attributeId/values/:valueId', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if attribute exists and belongs to store
    const { data: attribute, error: attrError } = await tenantDb
      .from('attributes')
      .select('id, store_id')
      .eq('id', req.params.attributeId)
      .eq('store_id', store_id)
      .maybeSingle();

    if (attrError || !attribute) {
      return res.status(404).json({ success: false, error: 'Attribute not found' });
    }

    // Check if value exists
    const { data: value, error: valueError } = await tenantDb
      .from('attribute_values')
      .select('*')
      .eq('id', req.params.valueId)
      .eq('attribute_id', req.params.attributeId)
      .maybeSingle();

    if (valueError || !value) {
      return res.status(404).json({ success: false, error: 'Value not found' });
    }

    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Extract translations from request body
    const { translations, ...valueData } = req.body;

    console.log('📝 Updating attribute value:', req.params.valueId, { translations, valueData });

    // Update value fields (excluding translations)
    if (Object.keys(valueData).length > 0) {
      const { error: updateError } = await tenantDb
        .from('attribute_values')
        .update(valueData)
        .eq('id', req.params.valueId)
        .eq('attribute_id', req.params.attributeId);

      if (updateError) {
        throw updateError;
      }
    }

    // Save translations to normalized table if provided
    if (translations && typeof translations === 'object' && Object.keys(translations).length > 0) {
      console.log('📝 Saving translations for value:', req.params.valueId, translations);
      await saveAttributeValueTranslations(tenantDb, req.params.valueId, translations);
      console.log('✅ Translations saved for value:', req.params.valueId);
    } else {
      console.log('⚠️ No translations provided for value:', req.params.valueId);
    }

    // Fetch updated value with translations
    const updatedValues = await getAttributeValuesWithTranslations(tenantDb, { id: req.params.valueId });
    const updatedValue = updatedValues[0] || value;

    res.json({ success: true, data: updatedValue });
  } catch (error) {
    console.error('❌ Update attribute value error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete attribute value
router.delete('/:attributeId/values/:valueId', authMiddleware, authorize(['admin', 'store_owner']), async (req, res) => {
  try {
    const store_id = req.headers['x-store-id'] || req.query.store_id;

    if (!store_id) {
      return res.status(400).json({ success: false, error: 'store_id is required' });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if attribute exists and belongs to store
    const { data: attribute, error: attrError } = await tenantDb
      .from('attributes')
      .select('id, store_id')
      .eq('id', req.params.attributeId)
      .eq('store_id', store_id)
      .maybeSingle();

    if (attrError || !attribute) {
      return res.status(404).json({ success: false, error: 'Attribute not found' });
    }

    // Check if value exists
    const { data: value, error: valueError } = await tenantDb
      .from('attribute_values')
      .select('id')
      .eq('id', req.params.valueId)
      .eq('attribute_id', req.params.attributeId)
      .maybeSingle();

    if (valueError || !value) {
      return res.status(404).json({ success: false, error: 'Value not found' });
    }

    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Delete the value
    const { error: deleteError } = await tenantDb
      .from('attribute_values')
      .delete()
      .eq('id', req.params.valueId)
      .eq('attribute_id', req.params.attributeId);

    if (deleteError) {
      throw deleteError;
    }

    res.json({ success: true, message: 'Value deleted' });
  } catch (error) {
    console.error('❌ Delete attribute value error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   POST /api/attributes/:id/translate
// @desc    AI translate a single attribute to target language
// @access  Private
router.post('/:id/translate', authMiddleware, authorize(['admin', 'store_owner']), [
  body('fromLang').notEmpty().withMessage('Source language is required'),
  body('toLang').notEmpty().withMessage('Target language is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { fromLang, toLang } = req.body;
    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Check if attribute exists and belongs to store
    const { data: attribute, error: attrError } = await tenantDb
      .from('attributes')
      .select('id, store_id, code')
      .eq('id', req.params.id)
      .eq('store_id', store_id)
      .maybeSingle();

    if (attrError || !attribute) {
      return res.status(404).json({
        success: false,
        message: 'Attribute not found'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if source translation exists
    const { data: sourceTrans } = await tenantDb
      .from('attribute_translations')
      .select('*')
      .eq('attribute_id', req.params.id)
      .eq('language_code', fromLang)
      .maybeSingle();

    if (!sourceTrans || !sourceTrans.label) {
      return res.status(400).json({
        success: false,
        message: `No ${fromLang} translation found for this attribute`
      });
    }

    // Translate the attribute
    const updatedAttribute = await translationService.aiTranslateEntity('attribute', req.params.id, fromLang, toLang);

    res.json({
      success: true,
      message: `Attribute translated to ${toLang} successfully`,
      data: updatedAttribute
    });
  } catch (error) {
    console.error('Translate attribute error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   POST /api/attributes/bulk-translate
// @desc    AI translate all attributes in a store to target language
// @access  Private
router.post('/bulk-translate', authMiddleware, authorize(['admin', 'store_owner']), [
  body('store_id').isUUID().withMessage('Store ID must be a valid UUID'),
  body('fromLang').notEmpty().withMessage('Source language is required'),
  body('toLang').notEmpty().withMessage('Target language is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id, fromLang, toLang } = req.body;

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Get all attributes for this store with all translations
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);
    const attributes = await getAttributesWithTranslations(tenantDb, { store_id });

    if (attributes.length === 0) {
      return res.json({
        success: true,
        message: 'No attributes found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Translate each attribute
    const results = {
      total: attributes.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      skippedDetails: []
    };

    console.log(`🌐 Starting attribute translation: ${fromLang} → ${toLang} (${attributes.length} attributes)`);

    for (const attribute of attributes) {
      try {
        const attributeName = attribute.translations?.[fromLang]?.label || attribute.code || `Attribute ${attribute.id}`;

        // Check if source translation exists
        if (!attribute.translations || !attribute.translations[fromLang]) {
          console.log(`⏭️  Skipping attribute "${attributeName}": No ${fromLang} translation`);
          results.skipped++;
          results.skippedDetails.push({
            attributeId: attribute.id,
            attributeName,
            reason: `No ${fromLang} translation found`
          });
          continue;
        }

        // Check if ALL target fields have content (field-level check)
        const sourceFields = Object.entries(attribute.translations[fromLang] || {});
        const targetTranslation = attribute.translations[toLang] || {};

        const allFieldsTranslated = sourceFields.every(([key, value]) => {
          if (!value || typeof value !== 'string' || !value.trim()) return true; // Ignore empty source fields
          const targetValue = targetTranslation[key];
          return targetValue && typeof targetValue === 'string' && targetValue.trim().length > 0;
        });

        if (allFieldsTranslated && sourceFields.length > 0) {
          console.log(`⏭️  Skipping attribute "${attributeName}": All fields already translated`);
          results.skipped++;
          results.skippedDetails.push({
            attributeId: attribute.id,
            attributeName,
            reason: `All fields already translated`
          });
          continue;
        }

        // Translate the attribute
        console.log(`🔄 Translating attribute "${attributeName}"...`);
        await translationService.aiTranslateEntity('attribute', attribute.id, fromLang, toLang);
        console.log(`✅ Successfully translated attribute "${attributeName}"`);
        results.translated++;
      } catch (error) {
        const attributeName = attribute.translations?.[fromLang]?.label || attribute.code || `Attribute ${attribute.id}`;
        console.error(`❌ Error translating attribute "${attributeName}":`, error);
        results.failed++;
        results.errors.push({
          attributeId: attribute.id,
          attributeName,
          error: error.message
        });
      }
    }

    console.log(`✅ Attribute translation complete: ${results.translated} translated, ${results.skipped} skipped, ${results.failed} failed`);

    // Deduct credits for ALL items (including skipped)
    const totalItems = attributes.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('attribute');
      actualCost = totalItems * costPerItem;

      console.log(`💰 Attribute bulk translate - charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk Attribute Translation (${fromLang} → ${toLang})`,
          {
            fromLang,
            toLang,
            totalItems,
            translated: results.translated,
            skipped: results.skipped,
            failed: results.failed,
            note: 'Charged for all items including skipped'
          },
          null,
          'ai_translation'
        );
        console.log(`✅ Deducted ${actualCost} credits for ${totalItems} attributes`);
      } catch (deductError) {
        console.error(`❌ CREDIT DEDUCTION FAILED (attribute-bulk-translate):`, deductError);
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    console.error('Bulk translate attributes error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// ========== ATTRIBUTE VALUE TRANSLATION ROUTES ==========

// @route   POST /api/attributes/values/:valueId/translate
// @desc    AI translate a single attribute value to target language
// @access  Private
router.post('/values/:valueId/translate', authMiddleware, authorize(['admin', 'store_owner']), [
  body('fromLang').notEmpty().withMessage('Source language is required'),
  body('toLang').notEmpty().withMessage('Target language is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { fromLang, toLang } = req.body;
    const store_id = req.headers['x-store-id'] || req.query.store_id || req.body.store_id;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get attribute value and check if it exists
    const { data: value, error: valueError } = await tenantDb
      .from('attribute_values')
      .select('id, attribute_id, code')
      .eq('id', req.params.valueId)
      .maybeSingle();

    if (valueError || !value) {
      return res.status(404).json({
        success: false,
        message: 'Attribute value not found'
      });
    }

    // Get the attribute to verify store ownership
    const { data: attribute, error: attrError } = await tenantDb
      .from('attributes')
      .select('id, store_id')
      .eq('id', value.attribute_id)
      .eq('store_id', store_id)
      .maybeSingle();

    if (attrError || !attribute) {
      return res.status(404).json({
        success: false,
        message: 'Attribute not found or access denied'
      });
    }

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Check if source translation exists
    const { data: sourceTrans } = await tenantDb
      .from('attribute_value_translations')
      .select('*')
      .eq('attribute_value_id', req.params.valueId)
      .eq('language_code', fromLang)
      .maybeSingle();

    if (!sourceTrans || !sourceTrans.label) {
      return res.status(400).json({
        success: false,
        message: `No ${fromLang} translation found for this attribute value`
      });
    }

    // Translate the attribute value
    const updatedValue = await translationService.aiTranslateEntity('attribute_value', req.params.valueId, fromLang, toLang);

    res.json({
      success: true,
      message: `Attribute value translated to ${toLang} successfully`,
      data: updatedValue
    });
  } catch (error) {
    console.error('Translate attribute value error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// @route   POST /api/attributes/values/bulk-translate
// @desc    AI translate all attribute values in a store to target language
// @access  Private
router.post('/values/bulk-translate', authMiddleware, authorize(['admin', 'store_owner']), [
  body('store_id').isUUID().withMessage('Store ID must be a valid UUID'),
  body('fromLang').notEmpty().withMessage('Source language is required'),
  body('toLang').notEmpty().withMessage('Target language is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { store_id, fromLang, toLang } = req.body;

    // Check store access
    if (req.user.role !== 'admin') {
      const { checkUserStoreAccess } = require('../utils/storeAccess');
      const access = await checkUserStoreAccess(req.user.id, store_id);

      if (!access) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Get all attribute values for attributes belonging to this store
    const { data: attributes, error: attrError } = await tenantDb
      .from('attributes')
      .select('id')
      .eq('store_id', store_id);

    if (attrError) {
      throw attrError;
    }

    if (!attributes || attributes.length === 0) {
      return res.json({
        success: true,
        message: 'No attributes found for this store',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    const attributeIds = attributes.map(attr => attr.id);
    const { data: values, error: valuesError } = await tenantDb
      .from('attribute_values')
      .select('*')
      .in('attribute_id', attributeIds)
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true });

    if (valuesError) {
      throw valuesError;
    }

    if (!values || values.length === 0) {
      return res.json({
        success: true,
        message: 'No attribute values found to translate',
        data: {
          total: 0,
          translated: 0,
          skipped: 0,
          failed: 0
        }
      });
    }

    // Load translations for all values
    const valueIds = values.map(v => v.id);
    const { data: translations } = await tenantDb
      .from('attribute_value_translations')
      .select('*')
      .in('attribute_value_id', valueIds)
      .in('language_code', [fromLang, toLang]);

    // Build translation map: valueId -> { fromLang: {...}, toLang: {...} }
    const transMap = {};
    (translations || []).forEach(t => {
      if (!transMap[t.attribute_value_id]) transMap[t.attribute_value_id] = {};
      transMap[t.attribute_value_id][t.language_code] = t;
    });

    // Translate each value
    const results = {
      total: values.length,
      translated: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    for (const value of values) {
      try {
        const valueTrans = transMap[value.id] || {};
        const sourceTranslation = valueTrans[fromLang];
        const targetTranslation = valueTrans[toLang];

        // Check if source translation exists
        if (!sourceTranslation || !sourceTranslation.label) {
          results.skipped++;
          continue;
        }

        // Check if target translation already exists
        if (targetTranslation && targetTranslation.label && targetTranslation.label.trim().length > 0) {
          results.skipped++;
          continue;
        }

        // Translate the value
        await translationService.aiTranslateEntity('attribute_value', value.id, fromLang, toLang);
        results.translated++;
      } catch (error) {
        console.error(`Error translating attribute value ${value.id}:`, error);
        results.failed++;
        results.errors.push({
          valueId: value.id,
          valueCode: value.code,
          error: error.message
        });
      }
    }

    // Deduct credits for ALL items (including skipped)
    const totalItems = values.length;
    let actualCost = 0;

    if (totalItems > 0) {
      const costPerItem = await translationService.getTranslationCost('attribute_value');
      actualCost = totalItems * costPerItem;

      console.log(`💰 Attribute Value bulk translate - charging for ${totalItems} items × ${costPerItem} credits = ${actualCost} credits`);

      try {
        await creditService.deduct(
          req.user.id,
          store_id,
          actualCost,
          `Bulk Attribute Value Translation (${fromLang} → ${toLang})`,
          {
            fromLang,
            toLang,
            totalItems,
            translated: results.translated,
            skipped: results.skipped,
            failed: results.failed,
            note: 'Charged for all items including skipped'
          },
          null,
          'ai_translation'
        );
        console.log(`✅ Deducted ${actualCost} credits for ${totalItems} attribute values`);
      } catch (deductError) {
        console.error(`❌ CREDIT DEDUCTION FAILED (attribute-value-bulk-translate):`, deductError);
        actualCost = 0;
      }
    }

    res.json({
      success: true,
      message: `Bulk translation completed. Translated: ${results.translated}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: { ...results, creditsDeducted: actualCost }
    });
  } catch (error) {
    console.error('Bulk translate attribute values error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

module.exports = router;