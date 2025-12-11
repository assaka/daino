/**
 * AkeneoCustomMapping - Pure service class (NO SEQUELIZE)
 *
 * This class provides methods to store Akeneo custom mappings
 * using the integration_configs table with integration_type='akeneo-mappings'.
 *
 * All methods are static and use direct Supabase queries through ConnectionManager.
 */

const AkeneoCustomMapping = {};

// Static methods for common operations
AkeneoCustomMapping.getMappings = async function(storeId, mappingType = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get the akeneo-mappings config
    const { data, error } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', 'akeneo-mappings')
      .maybeSingle();

    if (error) {
      console.error('Error fetching akeneo custom mappings:', error);
      return mappingType ? [] : { attributes: [], images: [], files: [] };
    }

    if (!data || !data.config_data) {
      return mappingType ? [] : { attributes: [], images: [], files: [] };
    }

    // Parse config_data if it's a string
    let configData = data.config_data;
    if (typeof configData === 'string') {
      try {
        configData = JSON.parse(configData);
      } catch (e) {
        console.warn('Failed to parse config_data:', e.message);
        return mappingType ? [] : { attributes: [], images: [], files: [] };
      }
    }

    if (mappingType) {
      return configData[mappingType] || [];
    }

    // Return object with all mapping types
    return {
      attributes: configData.attributes || [],
      images: configData.images || [],
      files: configData.files || []
    };
  } catch (error) {
    console.error('AkeneoCustomMapping.getMappings error:', error);
    return mappingType ? [] : { attributes: [], images: [], files: [] };
  }
};

AkeneoCustomMapping.saveMappings = async function(storeId, mappingType, mappings, userId = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');
  const { v4: uuidv4 } = require('uuid');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    // Get existing config
    const { data: existing } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', 'akeneo-mappings')
      .maybeSingle();

    // Parse existing config_data
    let existingData = { attributes: [], images: [], files: [] };
    if (existing && existing.config_data) {
      if (typeof existing.config_data === 'string') {
        try {
          existingData = JSON.parse(existing.config_data);
        } catch (e) {
          console.warn('Failed to parse existing config_data:', e.message);
        }
      } else {
        existingData = existing.config_data;
      }
    }

    // Update the specific mapping type
    const updatedData = {
      ...existingData,
      [mappingType]: mappings || []
    };

    if (existing) {
      // Update existing
      const { data: updated, error: updateError } = await tenantDb
        .from('integration_configs')
        .update({
          config_data: updatedData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating akeneo custom mapping:', updateError);
        throw updateError;
      }

      return updated;
    } else {
      // Create new
      const { data: created, error: createError } = await tenantDb
        .from('integration_configs')
        .insert({
          id: uuidv4(),
          store_id: storeId,
          integration_type: 'akeneo-mappings',
          config_data: updatedData,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating akeneo custom mapping:', createError);
        throw createError;
      }

      return created;
    }
  } catch (error) {
    console.error('AkeneoCustomMapping.saveMappings error:', error);
    throw error;
  }
};

AkeneoCustomMapping.saveAllMappings = async function(storeId, allMappings, userId = null) {
  const ConnectionManager = require('../services/database/ConnectionManager');
  const { v4: uuidv4 } = require('uuid');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const configData = {
      attributes: allMappings.attributes || [],
      images: allMappings.images || [],
      files: allMappings.files || []
    };

    // Get existing config
    const { data: existing } = await tenantDb
      .from('integration_configs')
      .select('*')
      .eq('store_id', storeId)
      .eq('integration_type', 'akeneo-mappings')
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error: updateError } = await tenantDb
        .from('integration_configs')
        .update({
          config_data: configData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating akeneo custom mappings:', updateError);
        throw updateError;
      }
    } else {
      // Create new
      const { error: createError } = await tenantDb
        .from('integration_configs')
        .insert({
          id: uuidv4(),
          store_id: storeId,
          integration_type: 'akeneo-mappings',
          config_data: configData,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (createError) {
        console.error('Error creating akeneo custom mappings:', createError);
        throw createError;
      }
    }

    return this.getMappings(storeId);
  } catch (error) {
    console.error('AkeneoCustomMapping.saveAllMappings error:', error);
    throw error;
  }
};

AkeneoCustomMapping.destroy = async function({ where }) {
  const ConnectionManager = require('../services/database/ConnectionManager');

  try {
    const tenantDb = await ConnectionManager.getStoreConnection(where.store_id);

    if (where.mapping_type) {
      // Only delete specific mapping type - update the config_data
      const { data: existing } = await tenantDb
        .from('integration_configs')
        .select('*')
        .eq('store_id', where.store_id)
        .eq('integration_type', 'akeneo-mappings')
        .maybeSingle();

      if (existing) {
        let configData = existing.config_data;
        if (typeof configData === 'string') {
          configData = JSON.parse(configData);
        }

        // Clear the specific mapping type
        configData[where.mapping_type] = [];

        await tenantDb
          .from('integration_configs')
          .update({
            config_data: configData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      }
    } else {
      // Delete entire config
      const { error } = await tenantDb
        .from('integration_configs')
        .delete()
        .eq('store_id', where.store_id)
        .eq('integration_type', 'akeneo-mappings');

      if (error) {
        console.error('Error deleting akeneo custom mapping:', error);
        throw error;
      }
    }

    return true;
  } catch (error) {
    console.error('AkeneoCustomMapping.destroy error:', error);
    throw error;
  }
};

module.exports = AkeneoCustomMapping;
