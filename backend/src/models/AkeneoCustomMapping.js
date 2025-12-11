/**
 * AkeneoCustomMapping - Pure service class (NO SEQUELIZE)
 *
 * This class provides methods to store Akeneo custom mappings
 * using the integration_attribute_mappings table.
 *
 * Conventions:
 * - Regular attribute mappings: stored with actual internal_attribute_id
 * - Image mappings: stored with internal_attribute_code='__product_images__'
 * - File mappings: stored with internal_attribute_code='__product_files__'
 *
 * All methods are static and use direct Supabase queries through ConnectionManager.
 */

const { v4: uuidv4 } = require('uuid');

const AkeneoCustomMapping = {};

// Special placeholder codes for non-attribute mappings
const SPECIAL_CODES = {
  images: '__product_images__',
  files: '__product_files__'
};

// Generate a deterministic UUID for special mappings based on store and type
function getSpecialUuid(storeId, type) {
  // Use a namespace-based approach for deterministic UUIDs
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // Standard UUID namespace
  const data = `${storeId}-${type}`;

  // Simple hash to create a deterministic UUID-like string
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Format as UUID (using hex representation of hash, padded)
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `00000000-0000-4000-8000-${hex.padStart(12, '0')}`;
}

// Static methods for common operations
AkeneoCustomMapping.getMappings = async function(storeId, mappingType = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get all akeneo mappings for this store
    let query = tenantDb
      .from('integration_attribute_mappings')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_source', 'akeneo')
      .eq('mapping_source', 'manual');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching akeneo custom mappings:', error);
      return mappingType ? [] : { attributes: [], images: [], files: [] };
    }

    // Categorize mappings by type
    const result = {
      attributes: [],
      images: [],
      files: []
    };

    (data || []).forEach(mapping => {
      // Parse value_transformation to get additional mapping data
      let extraData = {};
      if (mapping.value_transformation && typeof mapping.value_transformation === 'object') {
        extraData = mapping.value_transformation;
      }

      const mappingItem = {
        id: mapping.id,
        akeneoField: mapping.external_attribute_code,
        akeneoAttribute: mapping.external_attribute_code, // Alias for compatibility
        dainoField: mapping.internal_attribute_code,
        enabled: mapping.is_active,
        priority: extraData.priority || 999,
        ...extraData
      };

      if (mapping.internal_attribute_code === SPECIAL_CODES.images) {
        // Image mapping
        mappingItem.dainoField = extraData.dainoField || 'product_images';
        result.images.push(mappingItem);
      } else if (mapping.internal_attribute_code === SPECIAL_CODES.files) {
        // File mapping
        mappingItem.dainoField = extraData.dainoField || 'product_files';
        result.files.push(mappingItem);
      } else {
        // Regular attribute mapping
        result.attributes.push(mappingItem);
      }
    });

    // Sort by priority
    result.images.sort((a, b) => (a.priority || 999) - (b.priority || 999));
    result.files.sort((a, b) => (a.priority || 999) - (b.priority || 999));

    if (mappingType) {
      return result[mappingType] || [];
    }

    return result;
  } catch (error) {
    console.error('AkeneoCustomMapping.getMappings error:', error);
    return mappingType ? [] : { attributes: [], images: [], files: [] };
  }
};

AkeneoCustomMapping.saveMappings = async function(storeId, mappingType, mappings, userId = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Determine the internal_attribute_code based on mapping type
    let internalCode;
    let internalId;

    if (mappingType === 'images') {
      internalCode = SPECIAL_CODES.images;
      internalId = getSpecialUuid(storeId, 'images');
    } else if (mappingType === 'files') {
      internalCode = SPECIAL_CODES.files;
      internalId = getSpecialUuid(storeId, 'files');
    }

    // Delete existing mappings of this type
    if (mappingType === 'images' || mappingType === 'files') {
      await tenantDb
        .from('integration_attribute_mappings')
        .delete()
        .eq('store_id', storeId)
        .eq('integration_source', 'akeneo')
        .eq('mapping_source', 'manual')
        .eq('internal_attribute_code', internalCode);
    } else {
      // For attributes, delete all manual akeneo attribute mappings that aren't images/files
      await tenantDb
        .from('integration_attribute_mappings')
        .delete()
        .eq('store_id', storeId)
        .eq('integration_source', 'akeneo')
        .eq('mapping_source', 'manual')
        .not('internal_attribute_code', 'in', `(${SPECIAL_CODES.images},${SPECIAL_CODES.files})`);
    }

    // Insert new mappings
    const insertPromises = (mappings || []).map(async (mapping, index) => {
      const akeneoField = mapping.akeneoField || mapping.akeneoAttribute;
      if (!akeneoField) return null;

      let finalInternalCode = internalCode;
      let finalInternalId = internalId;

      if (mappingType === 'attributes') {
        // For attributes, use the dainoField as internal_attribute_code
        finalInternalCode = mapping.dainoField || akeneoField;

        // Try to find the actual attribute ID
        const { data: attr } = await tenantDb
          .from('attributes')
          .select('id')
          .eq('store_id', storeId)
          .eq('code', finalInternalCode)
          .maybeSingle();

        finalInternalId = attr?.id || getSpecialUuid(storeId, `attr_${finalInternalCode}`);
      }

      const record = {
        id: uuidv4(),
        store_id: storeId,
        integration_source: 'akeneo',
        external_attribute_code: akeneoField,
        external_attribute_name: mapping.akeneoLabel || akeneoField,
        external_attribute_type: mappingType === 'images' ? 'pim_catalog_image' :
                                  mappingType === 'files' ? 'pim_catalog_file' : 'text',
        internal_attribute_id: finalInternalId,
        internal_attribute_code: finalInternalCode,
        is_active: mapping.enabled !== false,
        mapping_direction: 'import_only',
        mapping_source: 'manual',
        confidence_score: 1.0,
        value_transformation: {
          dainoField: mapping.dainoField,
          priority: mapping.priority || index + 1,
          enabled: mapping.enabled !== false
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await tenantDb
        .from('integration_attribute_mappings')
        .insert(record);

      if (error) {
        console.error('Error inserting mapping:', error);
      }

      return record;
    });

    await Promise.all(insertPromises);

    return this.getMappings(storeId, mappingType);
  } catch (error) {
    console.error('AkeneoCustomMapping.saveMappings error:', error);
    throw error;
  }
};

AkeneoCustomMapping.saveAllMappings = async function(storeId, allMappings, userId = null) {
  const promises = [];

  if (allMappings.attributes) {
    promises.push(this.saveMappings(storeId, 'attributes', allMappings.attributes, userId));
  }
  if (allMappings.images) {
    promises.push(this.saveMappings(storeId, 'images', allMappings.images, userId));
  }
  if (allMappings.files) {
    promises.push(this.saveMappings(storeId, 'files', allMappings.files, userId));
  }

  await Promise.all(promises);

  return this.getMappings(storeId);
};

AkeneoCustomMapping.destroy = async function({ where }) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(where.store_id);

    let query = tenantDb
      .from('integration_attribute_mappings')
      .delete()
      .eq('store_id', where.store_id)
      .eq('integration_source', 'akeneo')
      .eq('mapping_source', 'manual');

    if (where.mapping_type) {
      if (where.mapping_type === 'images') {
        query = query.eq('internal_attribute_code', SPECIAL_CODES.images);
      } else if (where.mapping_type === 'files') {
        query = query.eq('internal_attribute_code', SPECIAL_CODES.files);
      } else if (where.mapping_type === 'attributes') {
        query = query
          .not('internal_attribute_code', 'eq', SPECIAL_CODES.images)
          .not('internal_attribute_code', 'eq', SPECIAL_CODES.files);
      }
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting akeneo custom mapping:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('AkeneoCustomMapping.destroy error:', error);
    throw error;
  }
};

module.exports = AkeneoCustomMapping;
