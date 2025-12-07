import apiClient from '@/api/client';

const API_BASE = 'slot-configurations';

class SlotConfigurationService {
  // Get or create draft configuration for editing
  async getDraftConfiguration(storeId, pageType = 'cart', staticConfig = null) {
    try {
      // Debug what we're sending to the API
      const payload = {
        staticConfiguration: staticConfig
      };

      const response = await apiClient.post(`${API_BASE}/draft/${storeId}/${pageType}`, payload)

      return response;
    } catch (error) {
      console.error('Error getting draft configuration:', error);
      throw error;
    }
  }

  // Get published configuration for display (used by storefront)
  async getPublishedConfiguration(storeId, pageType = 'cart') {
    try {
      const url = `${API_BASE}/published/${storeId}/${pageType}?status=published&latest=true`;
      const response = await apiClient.get(url);

      // Additional verification: ensure we got a published record
      if (response.data && response.data.status !== 'published') {
        console.warn('⚠️ WARNING: API returned non-published record:', response.data.status);
        console.warn('⚠️ This may indicate a backend issue with the /published endpoint');
      }

      return response;
    } catch (error) {
      console.error('Error getting published configuration:', error);
      throw error;
    }
  }

  // Update draft configuration
  async updateDraftConfiguration(configId, configuration, storeId, isReset = false) {
    try {
      const response = await apiClient.put(`${API_BASE}/draft/${configId}`, {
        configuration,
        storeId,
        isReset
      });
      return response;
    } catch (error) {
      console.error('Error updating draft configuration:', error);
      throw error;
    }
  }

  // Get acceptance configuration for preview
  async getAcceptanceConfiguration(storeId, pageType = 'cart') {
    try {
      const response = await apiClient.get(`${API_BASE}/acceptance/${storeId}/${pageType}`);
      return response;
    } catch (error) {
      console.error('Error getting acceptance configuration:', error);
      throw error;
    }
  }

  // Publish a draft to acceptance (preview environment)
  async publishToAcceptance(configId, storeId) {
    try {
      const response = await apiClient.post(`${API_BASE}/publish-to-acceptance/${configId}`, {
        storeId
      });
      return response;
    } catch (error) {
      console.error('Error publishing to acceptance:', error);
      throw error;
    }
  }

  // Publish acceptance to production
  async publishToProduction(configId, storeId) {
    try {
      const response = await apiClient.post(`${API_BASE}/publish-to-production/${configId}`, {
        storeId
      });
      return response;
    } catch (error) {
      console.error('Error publishing to production:', error);
      throw error;
    }
  }

  // Publish a draft configuration directly to production (legacy method)
  async publishDraft(configId, storeId) {
    try {
      const response = await apiClient.post(`${API_BASE}/publish/${configId}`, {
        storeId
      });
      return response;
    } catch (error) {
      console.error('Error publishing draft:', error);
      throw error;
    }
  }

  // Get unpublished changes status for all page types (read-only, no draft creation)
  async getUnpublishedStatus(storeId) {
    try {
      const response = await apiClient.get(`${API_BASE}/unpublished-status/${storeId}`);
      return response;
    } catch (error) {
      console.error('Error getting unpublished status:', error);
      throw error;
    }
  }

  // Publish all drafts with unpublished changes
  async publishAll(storeId) {
    try {
      const response = await apiClient.post(`${API_BASE}/publish-all/${storeId}`);
      return response;
    } catch (error) {
      console.error('Error publishing all drafts:', error);
      throw error;
    }
  }

  // Get version history
  async getVersionHistory(storeId, pageType = 'cart', limit = 20) {
    try {
      const response = await apiClient.get(`${API_BASE}/history/${storeId}/${pageType}?limit=${limit}`);
      return response;
    } catch (error) {
      console.error('Error getting version history:', error);
      throw error;
    }
  }

  // Create a revert draft (new approach - creates draft instead of publishing)
  async createRevertDraft(versionId, storeId) {
    try {
      const response = await apiClient.post(`${API_BASE}/revert-draft/${versionId}`, {
        storeId
      });
      return response;
    } catch (error) {
      console.error('Error creating revert draft:', error);
      throw error;
    }
  }

  // Revert to a specific version (DEPRECATED - use createRevertDraft instead)
  async revertToVersion(versionId, storeId) {
    try {
      const response = await apiClient.post(`${API_BASE}/revert/${versionId}`, {
        storeId
      });
      return response;
    } catch (error) {
      console.error('Error reverting to version:', error);
      throw error;
    }
  }

  // Undo revert with smart restoration of previous draft state
  async undoRevert(draftId, storeId) {
    try {
      const response = await apiClient.post(`${API_BASE}/undo-revert/${draftId}`, {
        storeId
      });
      return response;
    } catch (error) {
      console.error('Error undoing revert:', error);
      throw error;
    }
  }

  // Delete a draft
  async deleteDraft(configId, storeId) {
    try {
      const response = await apiClient.delete(`${API_BASE}/draft/${configId}?store_id=${storeId}`);
      return response;
    } catch (error) {
      console.error('Error deleting draft:', error);
      throw error;
    }
  }

  // Set current editing configuration
  async setCurrentEdit(configId, storeId, pageType = 'cart') {
    try {
      const response = await apiClient.post(`${API_BASE}/set-current-edit/${configId}`, {
        storeId,
        pageType
      });
      return response;
    } catch (error) {
      console.error('Error setting current edit:', error);
      throw error;
    }
  }

  // Get current editing configuration
  async getCurrentEdit(storeId, pageType = 'cart') {
    try {
      const response = await apiClient.get(`${API_BASE}/current-edit/${storeId}/${pageType}`);
      return response;
    } catch (error) {
      console.error('Error getting current edit:', error);
      throw error;
    }
  }

  // Check if a draft configuration exists for a store/page type
  async hasDraftConfiguration(storeId, pageType = 'cart') {
    try {
      const response = await this.getDraftConfiguration(storeId, pageType);
      return response.success && response.data;
    } catch (error) {
      console.warn('No draft configuration found:', error);
      return false;
    }
  }

  // Helper method to save configuration with auto-draft creation
  async saveConfiguration(storeId, configuration, pageType = 'cart', isReset = false) {
    try {
      // First get or create a draft
      const draftResponse = await this.getDraftConfiguration(storeId, pageType);
      const draftConfig = draftResponse.data;

      // Transform CartSlotsEditor format to SlotConfiguration API format
      const apiConfiguration = this.transformToSlotConfigFormat(configuration);

      // Update the draft with new configuration (now includes storeId)
      const updateResponse = await this.updateDraftConfiguration(draftConfig.id, apiConfiguration, storeId, isReset);

      // Dispatch event to notify that configuration was saved (for Publish button update)
      window.dispatchEvent(new CustomEvent('slot-configuration-saved', {
        detail: { storeId, pageType }
      }));

      return updateResponse;
    } catch (error) {
      console.error('❌ Error saving configuration:', error);
      throw error;
    }
  }

  // Create a new draft based on published configuration (after publish)
  async createDraftFromPublished(storeId, configuration, pageType = 'cart') {
    try {
      const response = await apiClient.post(`${API_BASE}/create-draft-from-published`, {
        storeId,
        pageType,
        configuration
      });
      return response;
    } catch (error) {
      console.error('Error creating draft from published:', error);
      throw error;
    }
  }

  // Check if draft exists, create from initial values if not
  async ensureDraftExists(storeId, pageType = 'cart', fileName = null) {
    try {
      
      // Try to get existing draft
      try {
        const draftResponse = await this.getDraftConfiguration(storeId, pageType);
        if (draftResponse.success && draftResponse.data) {
          return {
            exists: true,
            draft: draftResponse.data,
            created: false
          };
        }
      } catch (error) {
        // Draft doesn't exist, we'll create it
        console.log(`📝 No draft found for ${storeId}/${pageType}, will create new one`);
      }

      // Create new draft from cart-config.js initial values
      const initialConfiguration = await this.getInitialConfiguration(pageType, fileName);
      
      // Create draft using the API
      const createResponse = await apiClient.post(`${API_BASE}/draft`, {
        storeId,
        pageType,
        configuration: initialConfiguration
      });

      if (createResponse.success) {
        return {
          exists: false,
          draft: createResponse.data,
          created: true
        };
      } else {
        throw new Error('Failed to create draft configuration');
      }

    } catch (error) {
      console.error('Error ensuring draft exists:', error);
      throw error;
    }
  }

  // Get initial configuration - DEPRECATED
  // Slot configurations should be fetched from the database via getPublishedConfiguration or getDraftConfiguration
  // Config files are only used during store provisioning on the backend
  async getInitialConfiguration(pageType = 'cart', fileName = null) {
    throw new Error(
      `getInitialConfiguration is deprecated. Slot configurations should be fetched from the database. ` +
      `Use getPublishedConfiguration(storeId, '${pageType}') or getDraftConfiguration(storeId, '${pageType}') instead.`
    );
  }

  // Transform CartSlotsEditor configuration to SlotConfiguration API format
  transformToSlotConfigFormat(cartConfig) {
    // Helper function to remove editor-only temporary classes
    const removeEditorClasses = (className) => {
      if (!className) return '';

      // Split into individual classes
      const classes = className.split(/\s+/).filter(Boolean);

      // List of editor-only classes and patterns to remove
      const editorClasses = [
        'border-2',
        'border-blue-500',
        'border-blue-600',
        'border-blue-400',
        'border-dashed',
        'bg-blue-50/10',
        'bg-blue-50/20',
        'bg-blue-50/60',
        'shadow-lg',
        'shadow-xl',
        'shadow-md',
        'ring-2',
        'ring-blue-200',
        'ring-blue-300'
      ];

      // Filter out editor classes and hover variants
      const cleanClasses = classes.filter(cls => {
        // Remove if it's an editor class
        if (editorClasses.includes(cls)) return false;

        // Remove if it starts with hover: and is editor-related
        if (cls.startsWith('hover:')) {
          const baseClass = cls.replace('hover:', '');
          if (editorClasses.includes(baseClass)) return false;
        }

        // Remove shadow classes with blue color
        if (cls.startsWith('shadow-') && cls.includes('blue')) return false;

        return true;
      });

      return cleanClasses.join(' ');
    };

    // Clean editor classes from slots
    const cleanSlots = (slots) => {
      if (!slots) return {};
      const cleaned = {};
      Object.entries(slots).forEach(([key, slot]) => {
        cleaned[key] = {
          ...slot,
          className: removeEditorClasses(slot.className || '')
        };
      });
      return cleaned;
    };

    // Check if it's already in the correct format
    if (cartConfig.slots && cartConfig.metadata) {
      return {
        ...cartConfig,
        slots: cleanSlots(cartConfig.slots)
      };
    }

    // Transform from hierarchical CartSlotsEditor format to API format
    const transformed = {
      slots: cleanSlots(cartConfig.slots || {}),
      metadata: {
        created: cartConfig.timestamp || new Date().toISOString(),
        lastModified: new Date().toISOString(),
        page_name: cartConfig.page_name || 'Cart',
        page_type: cartConfig.page_type || 'cart',
        slot_type: cartConfig.slot_type || 'cart_layout'
      }
    };

    // If slots are already properly structured, use them as-is
    if (!transformed.slots || Object.keys(transformed.slots).length === 0) {
      // Handle legacy slotContent format if it exists
      const { slotContent } = cartConfig;
      if (slotContent) {
        Object.keys(slotContent).forEach(slotId => {
          transformed.slots[slotId] = {
            id: slotId,
            type: 'text',
            content: slotContent[slotId],
            parentId: null,
            metadata: {
              lastModified: new Date().toISOString()
            }
          };
        });
      }
    }

    return transformed;
  }

  // Keep hierarchical structure - no more legacy transformations
  transformFromSlotConfigFormat(apiConfig) {

    // Return the hierarchical structure as-is (no transformation needed)
    // All configs should now use the standard hierarchical format
    return {
      page_name: apiConfig.page_name || apiConfig.metadata?.page_name || 'Unknown Page',
      slot_type: apiConfig.slot_type || apiConfig.metadata?.slot_type || 'unknown_layout',
      slots: apiConfig.slots || {},
      metadata: apiConfig.metadata || {}
    };
  }

  // Determine parent slot for a micro slot (can be enhanced)
  determineParentSlot(slotId) {
    // Simple logic - can be improved based on actual slot hierarchy
    if (slotId.includes('.')) {
      return slotId.split('.')[0];
    }
    return 'default';
  }

  // Destroy layout - reset to default and delete all versions
  async destroyLayout(storeId, pageType = 'cart') {
    try {
      const response = await apiClient.post(`${API_BASE}/destroy/${storeId}/${pageType}`);
      return response;
    } catch (error) {
      console.error('Error destroying layout:', error);
      throw error;
    }
  }
}

export default new SlotConfigurationService();