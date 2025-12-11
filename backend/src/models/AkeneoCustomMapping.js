/**
 * AkeneoCustomMapping - Pure service class (NO SEQUELIZE)
 *
 * This class provides methods to store Akeneo custom field mappings
 * using the integration_attribute_mappings table.
 *
 * Note: Image and file type attributes (pim_catalog_image, pim_catalog_file)
 * are automatically mapped to product_files during import - no manual mapping needed.
 *
 * All methods are static and use direct Supabase queries through ConnectionManager.
 */

const { v4: uuidv4 } = require('uuid');

const AkeneoCustomMapping = {};

// Generate a deterministic UUID for field mappings that don't have a real attribute
function getFieldUuid(storeId, fieldCode) {
  const data = `${storeId}-akeneo-field-${fieldCode}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `00000000-0000-4000-8000-${hex.padStart(12, '0')}`;
}

// Static methods for common operations
AkeneoCustomMapping.getMappings = async function(storeId, mappingType = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get all akeneo manual mappings for this store
    const { data, error } = await tenantDb
      .from('integration_attribute_mappings')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_source', 'akeneo')
      .eq('mapping_source', 'manual');

    if (error) {
      console.error('Error fetching akeneo custom mappings:', error);
      return mappingType ? [] : { attributes: [], images: [], files: [] };
    }

    // Build attributes array from mappings
    const attributes = (data || []).map(mapping => ({
      id: mapping.id,
      akeneoField: mapping.external_attribute_code,
      dainoField: mapping.internal_attribute_code,
      enabled: mapping.is_active
    }));

    // Return format expected by frontend
    // Images and files are auto-mapped, so return empty arrays
    const result = {
      attributes,
      images: [],
      files: []
    };

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

  // Images and files are auto-mapped - no need to save manually
  if (mappingType === 'images' || mappingType === 'files') {
    console.log(`ℹ️ ${mappingType} mappings are handled automatically for pim_catalog_image/file types`);
    return [];
  }

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Delete existing manual akeneo attribute mappings
    await tenantDb
      .from('integration_attribute_mappings')
      .delete()
      .eq('store_id', storeId)
      .eq('integration_source', 'akeneo')
      .eq('mapping_source', 'manual');

    // Insert new mappings
    const records = [];
    for (const mapping of (mappings || [])) {
      const akeneoField = mapping.akeneoField;
      const dainoField = mapping.dainoField;

      if (!akeneoField || !dainoField) continue;

      // Try to find the actual attribute ID for the dainoField
      const { data: attr } = await tenantDb
        .from('attributes')
        .select('id')
        .eq('store_id', storeId)
        .eq('code', dainoField)
        .maybeSingle();

      const record = {
        id: uuidv4(),
        store_id: storeId,
        integration_source: 'akeneo',
        external_attribute_code: akeneoField,
        external_attribute_name: akeneoField,
        internal_attribute_id: attr?.id || getFieldUuid(storeId, dainoField),
        internal_attribute_code: dainoField,
        is_active: mapping.enabled !== false,
        mapping_direction: 'import_only',
        mapping_source: 'manual',
        confidence_score: 1.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await tenantDb
        .from('integration_attribute_mappings')
        .insert(record);

      if (error) {
        console.error('Error inserting mapping:', error);
      } else {
        records.push(record);
      }
    }

    return records;
  } catch (error) {
    console.error('AkeneoCustomMapping.saveMappings error:', error);
    throw error;
  }
};

AkeneoCustomMapping.saveAllMappings = async function(storeId, allMappings, userId = null) {
  // Only save attribute mappings - images/files are auto-handled
  if (allMappings.attributes) {
    await this.saveMappings(storeId, 'attributes', allMappings.attributes, userId);
  }

  return this.getMappings(storeId);
};

AkeneoCustomMapping.destroy = async function({ where }) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(where.store_id);

    const { error } = await tenantDb
      .from('integration_attribute_mappings')
      .delete()
      .eq('store_id', where.store_id)
      .eq('integration_source', 'akeneo')
      .eq('mapping_source', 'manual');

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
