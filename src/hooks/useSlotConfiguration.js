/**
 * useSlotConfiguration - Custom hook for managing slot configuration save/load
 * Reusable across all page editors (Cart, Product, Category, etc.)
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import slotConfigurationService from '@/services/slotConfigurationService';
import { usePreviewMode } from '@/contexts/PreviewModeContext';
import { SlotManager } from '@/utils/slotUtils';
// Slot configurations are loaded from database - no static defaults needed
import { processVariables, generateDemoData } from '@/utils/variableProcessor';

// ===============================
// UTILITY HOOKS FOR SLOT EDITORS
// ===============================

/**
 * Generic hook for loading layout configurations
 * @param {Object} store - The store object containing store.id
 * @param {string} pageType - The type of page (e.g., 'cart', 'category', 'product')
 * @param {Object} fallbackConfig - Fallback configuration object to use when no published config exists
 * @param {Boolean} shouldFetch - Whether to fetch from API (default true, false if bootstrap provides data)
 * @returns {Object} - { layoutConfig, configLoaded, reloadConfig }
 */
export function useLayoutConfig(store, pageType, fallbackConfig, shouldFetch = true) {
    const [layoutConfig, setLayoutConfig] = useState(null);
    const [configLoaded, setConfigLoaded] = useState(false);

    // Use context for preview mode (persists across navigation)
    const { isPublishedPreview, isWorkspaceMode } = usePreviewMode();

    // Also check URL as fallback for workspace mode only
    const urlWorkspaceMode = typeof window !== 'undefined' &&
        (new URLSearchParams(window.location.search).get('preview') === 'draft' ||
         new URLSearchParams(window.location.search).get('workspace') === 'true');

    // Only load draft when in workspace mode (NOT when viewing published version)
    // isPublishedPreview means "show published version only", NOT "load draft"
    const shouldLoadDraft = isWorkspaceMode || urlWorkspaceMode;

    const loadLayoutConfig = useCallback(async () => {
        if (!store?.id) {
            return;
        }

        // Skip fetch if not needed (bootstrap provided data)
        if (!shouldFetch) {
            setConfigLoaded(true);
            return;
        }

        try {
            let response;

            // In workspace/draft preview mode, load draft configuration
            // When viewing published version (isPublishedPreview=true), always load published
            if (shouldLoadDraft && !isPublishedPreview) {
                response = await slotConfigurationService.getDraftConfiguration(store.id, pageType);
                // Transform draft response to match published response structure
                if (response.success && response.data?.configuration) {
                    response = {
                        success: true,
                        data: {
                            configuration: response.data.configuration,
                            status: 'draft'
                        }
                    };
                }
            } else {
                // Load published configuration using the new versioning API
                response = await slotConfigurationService.getPublishedConfiguration(store.id, pageType);
            }

            // Check for various "no published config" scenarios
            if (response.success && response.data &&
                response.data.configuration &&
                response.data.configuration.slots &&
                Object.keys(response.data.configuration.slots).length > 0) {

                const publishedConfig = response.data;
                setLayoutConfig(publishedConfig.configuration);
                setConfigLoaded(true);

            } else {
                // Any scenario where we don't have a valid published configuration
                const noConfigReasons = [];
                if (!response.success) noConfigReasons.push('API response not successful');
                if (!response.data) noConfigReasons.push('No response data');
                if (response.data && !response.data.configuration) noConfigReasons.push('No configuration in response');
                if (response.data?.configuration && !response.data.configuration.slots) noConfigReasons.push('No slots in configuration');
                if (response.data?.configuration?.slots && Object.keys(response.data.configuration.slots).length === 0) noConfigReasons.push('Empty slots object');

                const finalFallbackConfig = {
                    slots: { ...fallbackConfig.slots },
                    metadata: {
                        ...fallbackConfig.metadata,
                        fallbackUsed: true,
                        fallbackReason: `No valid published configuration: ${noConfigReasons.join(', ')}`
                    }
                };

                setLayoutConfig(finalFallbackConfig);
                setConfigLoaded(true);
            }
        } catch (error) {
            console.error(`❌ Error loading published ${pageType} slot configuration:`, error);
            console.error('❌ Error type:', error.constructor.name);
            console.error('❌ Error message:', error.message);
            console.error('❌ Network status:', navigator.onLine ? 'Online' : 'Offline');

            if (error.message?.includes('NetworkError') || error.message?.includes('fetch')) {
                console.error('🔌 Backend connectivity issue detected');
            }

            console.warn(`⚠️ Falling back to fallback config due to error`);

            // Fallback to provided fallback config
            try {

                if (!fallbackConfig || !fallbackConfig.slots) {
                    console.error(`Invalid fallback config for ${pageType}:`, fallbackConfig);
                    throw new Error(`Invalid fallback configuration for ${pageType}`);
                }

                const finalFallbackConfig = {
                    slots: { ...fallbackConfig.slots },
                    metadata: {
                        ...fallbackConfig.metadata,
                        fallbackUsed: true,
                        fallbackReason: `Error loading configuration: ${error.message}`
                    }
                };

                setLayoutConfig(finalFallbackConfig);
                setConfigLoaded(true);
            } catch (importError) {
                console.error(`❌ Failed to load fallback config:`, importError);
                // Set empty config if fallback also fails
                setLayoutConfig({ slots: {}, metadata: { fallbackUsed: true, fallbackReason: 'Failed to load any configuration' } });
                setConfigLoaded(true);
            }
        }
    }, [store?.id, pageType, fallbackConfig, shouldFetch, shouldLoadDraft, isPublishedPreview]);

    useEffect(() => {
        loadLayoutConfig();

        // Listen for configuration updates from editor
        const handleStorageChange = (e) => {
            if (e.key === 'slot_config_updated' && e.newValue) {
                const updateData = JSON.parse(e.newValue);
                if (updateData.storeId === store?.id && updateData.pageType === pageType) {
                    loadLayoutConfig();
                    // Clear the notification
                    localStorage.removeItem('slot_config_updated');
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [store?.id, pageType, loadLayoutConfig]);

    return {
        layoutConfig,
        configLoaded,
        reloadConfig: loadLayoutConfig
    };
}

// Timestamp formatting utilities
export const useTimestampFormatting = () => {
  const formatDate = useCallback((dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatTimeAgo = useCallback((dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return formatDate(dateString);
  }, [formatDate]);

  return { formatDate, formatTimeAgo };
};

// Draft status management hook
export const useDraftStatusManagement = (storeId, pageType) => {
  const [draftConfig, setDraftConfig] = useState(null);
  const [latestPublished, setLatestPublished] = useState(null);
  const [configurationStatus, setConfigurationStatus] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const loadDraftStatus = useCallback(async () => {
    try {
      if (storeId) {
        // Get draft configuration
        const draftResponse = await slotConfigurationService.getDraftConfiguration(storeId, pageType);
        if (draftResponse && draftResponse.success && draftResponse.data) {
          setDraftConfig(draftResponse.data);
          setConfigurationStatus(draftResponse.data.status);
          setHasUnsavedChanges(draftResponse.data.has_unpublished_changes || false);
        }

        // Get latest published configuration for timestamp
        try {
          const publishedResponse = await slotConfigurationService.getVersionHistory(storeId, pageType, 1);
          if (publishedResponse && publishedResponse.success && publishedResponse.data && publishedResponse.data.length > 0) {
            setLatestPublished(publishedResponse.data[0]);
          }
        } catch (publishedError) {
          console.warn('Could not get latest published version:', publishedError);
        }
      }
    } catch (error) {
      setConfigurationStatus('published');
      setHasUnsavedChanges(false);
    }
  }, [storeId, pageType]);

  return {
    draftConfig, setDraftConfig,
    latestPublished, setLatestPublished,
    configurationStatus, setConfigurationStatus,
    hasUnsavedChanges, setHasUnsavedChanges,
    loadDraftStatus
  };
};

// Configuration change detection hook
export const useConfigurationChangeDetection = (configurationLoadedRef, pageConfig, setHasUnsavedChanges) => {
  const lastSavedConfigRef = useRef(null);

  useEffect(() => {
    if (configurationLoadedRef.current && pageConfig) {
      const currentConfig = JSON.stringify(pageConfig);
      if (lastSavedConfigRef.current === null) {
        // Initial load - save the initial state
        lastSavedConfigRef.current = currentConfig;
      } else if (currentConfig !== lastSavedConfigRef.current) {
        // Configuration has changed
        setHasUnsavedChanges(true);
      }
    }
  }, [pageConfig, configurationLoadedRef, setHasUnsavedChanges]);

  const updateLastSavedConfig = useCallback((config) => {
    lastSavedConfigRef.current = JSON.stringify(config);
  }, []);

  return { lastSavedConfigRef, updateLastSavedConfig };
};

// Badge refresh hook
export const useBadgeRefresh = (configurationLoadedRef, hasUnsavedChanges, pageType) => {
  useEffect(() => {
    if (configurationLoadedRef.current && hasUnsavedChanges) {
      if (window.slotFileSelectorRefresh) {
        setTimeout(() => {
          window.slotFileSelectorRefresh(pageType);
        }, 500);
      }
    }
  }, [hasUnsavedChanges, configurationLoadedRef, pageType]);
};

// Generic publish hook
export const usePublishHandler = (pageType, pageConfig, handlePublishConfiguration, setters) => {
  const [publishStatus, setPublishStatus] = useState('');

  const handlePublish = useCallback(async () => {
    setPublishStatus('publishing');

    // Close sidebar when publishing
    setters.setIsSidebarVisible(false);
    setters.setSelectedElement(null);

    try {
      await handlePublishConfiguration();
      setPublishStatus('published');
      setters.setHasUnsavedChanges(false);  // Mark as saved after successful publish
      setters.setConfigurationStatus('draft'); // Set to draft since new draft was created based on published
      setters.updateLastSavedConfig(pageConfig);

      // Refresh the SlotEnabledFileSelector badge status after a short delay
      // to ensure the new draft has been created and is queryable
      if (window.slotFileSelectorRefresh) {
        setTimeout(() => {
          window.slotFileSelectorRefresh(pageType);
        }, 500);
      }

      setTimeout(() => setPublishStatus(''), 3000);
    } catch (error) {
      console.error(`❌ Failed to publish ${pageType} configuration:`, error);
      setPublishStatus('error');
      setTimeout(() => setPublishStatus(''), 5000);
    }
  }, [handlePublishConfiguration, pageConfig, pageType, setters]);

  return { handlePublish, publishStatus };
};

// Generic reset layout hook
export const useResetLayoutHandler = (pageType, baseHandleResetLayout, pageConfig, setters) => {
  const handleResetLayout = useCallback(async () => {
    const result = await baseHandleResetLayout();
    setters.setHasUnsavedChanges(false); // Reset should clear unsaved changes flag
    setters.setConfigurationStatus('draft'); // Reset creates a draft
    setters.updateLastSavedConfig(pageConfig);

    // Refresh the SlotEnabledFileSelector badge status after reset
    if (window.slotFileSelectorRefresh) {
      window.slotFileSelectorRefresh(pageType);
    }

    return result;
  }, [baseHandleResetLayout, pageConfig, pageType, setters]);

  return { handleResetLayout };
};

// Generic save configuration hook
export const useSaveConfigurationHandler = (pageType, baseSaveConfiguration, pageConfig, setters) => {
  const saveConfiguration = useCallback(async (...args) => {
    const result = await baseSaveConfiguration(...args);
    if (result !== false) {
      // Don't clear hasUnsavedChanges when saving to draft - the draft still needs to be published
      // hasUnsavedChanges should only be cleared after successful publish, not save
      setters.setConfigurationStatus('draft'); // Saving creates a draft
      setters.updateLastSavedConfig(pageConfig);

      // Refresh the SlotEnabledFileSelector badge status after saving changes
      if (window.slotFileSelectorRefresh) {
        window.slotFileSelectorRefresh(pageType);
      }
    }
    return result;
  }, [baseSaveConfiguration, pageConfig, pageType, setters]);

  return { saveConfiguration };
};

// Generic publish panel handlers wrapper
export const usePublishPanelHandlerWrappers = (pageType, baseHandlers, setters) => {
  const handlePublishPanelPublished = useCallback(async (publishedConfig) => {
    // Close sidebar when publishing from panel
    setters.setIsSidebarVisible(false);
    setters.setSelectedElement(null);

    try {
      const result = await baseHandlers.handlePublishPanelPublished(publishedConfig);
      if (result) {
        if (result.draftConfig !== undefined) setters.setDraftConfig(result.draftConfig);
        if (result.configurationStatus) setters.setConfigurationStatus(result.configurationStatus);
        if (result.hasUnsavedChanges !== undefined) setters.setHasUnsavedChanges(result.hasUnsavedChanges);
        if (result.latestPublished) setters.setLatestPublished(result.latestPublished);
      }
    } catch (error) {
      console.error(`Failed to handle publish panel published for ${pageType}:`, error);
    }
  }, [baseHandlers.handlePublishPanelPublished, pageType, setters]);

  const handlePublishPanelReverted = useCallback(async (revertedConfig) => {
    try {
      const result = await baseHandlers.handlePublishPanelReverted(revertedConfig);
      if (result) {
        if (result.draftConfig !== undefined) setters.setDraftConfig(result.draftConfig);
        if (result.configurationStatus) setters.setConfigurationStatus(result.configurationStatus);
        if (result.hasUnsavedChanges !== undefined) setters.setHasUnsavedChanges(result.hasUnsavedChanges);
        if (result.latestPublished) setters.setLatestPublished(result.latestPublished);
        if (result.pageConfig) {
          setters.setPageConfig(result.pageConfig);
          setters.updateLastSavedConfig(result.pageConfig);
        }
      }
    } catch (error) {
      console.error(`Failed to handle publish panel reverted for ${pageType}:`, error);
    }
  }, [baseHandlers.handlePublishPanelReverted, pageType, setters]);

  return { handlePublishPanelPublished, handlePublishPanelReverted };
};

// Click outside panel handler
export const useClickOutsidePanel = (showPanel, panelRef, setShowPanel) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPanel && panelRef.current && !panelRef.current.contains(event.target)) {
        const publishButton = event.target.closest('button');
        const isPublishButton = publishButton && publishButton.textContent.includes('Publish');

        if (!isPublishButton) {
          setShowPanel(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPanel, panelRef, setShowPanel]);
};

// Preview mode handler
export const usePreviewModeHandlers = (showPreview, setIsSidebarVisible, setSelectedElement, setShowPublishPanel) => {
  useEffect(() => {
    if (showPreview) {
      setIsSidebarVisible(false);
      setSelectedElement(null);
      setShowPublishPanel(false);
    }
  }, [showPreview, setIsSidebarVisible, setSelectedElement, setShowPublishPanel]);
};

// Publish panel handlers hook
export const usePublishPanelHandlers = (pageType, getSelectedStoreId, getDraftConfiguration, setPageConfig, slotConfigurationService) => {
  const handlePublishPanelPublished = useCallback(async () => {

    try {
      const storeId = getSelectedStoreId();
      if (storeId) {
        const draftResponse = await slotConfigurationService.getDraftConfiguration(storeId, pageType);
        if (draftResponse && draftResponse.success && draftResponse.data) {
          // Return the updated draft data for the editor to handle
          return {
            draftConfig: draftResponse.data,
            configurationStatus: draftResponse.data.status,
            hasUnsavedChanges: draftResponse.data.has_unpublished_changes || false
          };
        }

        // Update latest published
        const publishedResponse = await slotConfigurationService.getVersionHistory(storeId, pageType, 1);
        if (publishedResponse && publishedResponse.success && publishedResponse.data && publishedResponse.data.length > 0) {
          return {
            latestPublished: publishedResponse.data[0]
          };
        }

        // Refresh the SlotEnabledFileSelector badge status after a short delay
        if (window.slotFileSelectorRefresh) {
          setTimeout(() => {
            window.slotFileSelectorRefresh(pageType);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Failed to reload draft after publish:', error);
      throw error;
    }
  }, [pageType, getSelectedStoreId]);

  const handlePublishPanelReverted = useCallback(async (revertedConfig) => {
    try {
      const storeId = getSelectedStoreId();
      if (storeId) {
        if (revertedConfig === null) {
          // Draft was completely deleted
          const configToUse = await getDraftConfiguration();
          if (configToUse) {
            const finalConfig = slotConfigurationService.transformFromSlotConfigFormat(configToUse);
            return {
              draftConfig: null,
              configurationStatus: 'published',
              hasUnsavedChanges: false,
              pageConfig: finalConfig
            };
          }
        } else if (revertedConfig && revertedConfig.status === 'draft' && !revertedConfig.current_edit_id) {
          // Previous draft state was restored
          const configToUse = await getDraftConfiguration();
          if (configToUse) {
            const finalConfig = slotConfigurationService.transformFromSlotConfigFormat(configToUse);
            return {
              draftConfig: revertedConfig,
              configurationStatus: revertedConfig.status,
              hasUnsavedChanges: revertedConfig.has_unpublished_changes || false,
              pageConfig: finalConfig
            };
          }
        } else {
          // Normal revert draft creation
          const draftResponse = await slotConfigurationService.getDraftConfiguration(storeId, pageType);
          if (draftResponse && draftResponse.success && draftResponse.data) {
            const configToUse = await getDraftConfiguration();
            if (configToUse) {
              const finalConfig = slotConfigurationService.transformFromSlotConfigFormat(configToUse);
              return {
                draftConfig: draftResponse.data,
                configurationStatus: draftResponse.data.status,
                hasUnsavedChanges: draftResponse.data.has_unpublished_changes || false,
                pageConfig: finalConfig
              };
            }
          }
        }

        // Update latest published after revert/undo
        const publishedResponse = await slotConfigurationService.getVersionHistory(storeId, pageType, 1);
        if (publishedResponse && publishedResponse.success && publishedResponse.data && publishedResponse.data.length > 0) {
          return {
            latestPublished: publishedResponse.data[0]
          };
        }
      }
    } catch (error) {
      console.error('Failed to reload configuration after revert/undo:', error);
      throw error;
    }
  }, [pageType, getSelectedStoreId, getDraftConfiguration]);

  return { handlePublishPanelPublished, handlePublishPanelReverted };
};

// Configuration initialization hook
export const useConfigurationInitialization = (pageType, pageName, slotType, getSelectedStoreId, getDraftConfiguration, loadDraftStatus) => {
  const configurationLoadedRef = useRef(false);

  const initializeConfig = useCallback(async () => {
    if (configurationLoadedRef.current) return null;

    try {
      // Use the hook function to get draft configuration
      const configToUse = await getDraftConfiguration();

      if (!configToUse) {
        throw new Error(`Failed to load ${pageType} configuration`);
      }

      // Load draft status
      await loadDraftStatus();

      // Transform database config if needed
      let finalConfig = configToUse;
      if (configToUse.slots && Object.keys(configToUse.slots).length > 0) {
        const dbConfig = slotConfigurationService.transformFromSlotConfigFormat(configToUse);
        if (dbConfig && dbConfig.slots && Object.keys(dbConfig.slots).length > 0) {
          finalConfig = dbConfig;
        }
      } else {
        finalConfig = {
          ...configToUse,
          slots: {}
        };
      }

      configurationLoadedRef.current = true;
      return finalConfig;

    } catch (error) {
      console.error(`❌ Failed to initialize ${pageType} configuration:`, error);

      // Set a minimal fallback configuration - let the editor handle defaults
      const fallbackConfig = {
        page_name: pageName,
        slot_type: slotType,
        slots: {},
        metadata: {
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '1.0',
          pageType: pageType,
          error: 'Failed to load configuration'
        },
        cmsBlocks: []
      };

      configurationLoadedRef.current = true;
      return fallbackConfig;
    }
  }, [pageType, pageName, slotType, getDraftConfiguration, loadDraftStatus]);

  return { initializeConfig, configurationLoadedRef };
};

// Generic editor initialization hook
export const useEditorInitialization = (initializeConfig, setPageConfig, createDefaultSlots = null) => {
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (!isMounted) return;

      let finalConfig = await initializeConfig();

      if (finalConfig && isMounted) {
        // If createDefaultSlots is provided (for CategorySlotsEditor), check if we need default slots
        if (createDefaultSlots && (!finalConfig.slots || Object.keys(finalConfig.slots).length === 0)) {
          finalConfig = {
            ...finalConfig,
            slots: createDefaultSlots()
          };
        }
        setPageConfig(finalConfig);
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [initializeConfig, setPageConfig, createDefaultSlots]);
};

// Generic view mode adjustments hook
export const useViewModeAdjustments = (pageConfig, setPageConfig, viewMode, adjustmentRules) => {
  useEffect(() => {
    if (!pageConfig || !pageConfig.slots || !adjustmentRules) return;

    let hasChanges = false;
    const updatedSlots = { ...pageConfig.slots };

    // Apply adjustment rules
    Object.entries(adjustmentRules).forEach(([slotId, rules]) => {
      if (updatedSlots[slotId]) {
        Object.entries(rules).forEach(([property, adjustmentConfig]) => {
          const currentValue = updatedSlots[slotId][property];

          // Check if adjustment is needed based on the current value type
          if (adjustmentConfig.shouldAdjust && adjustmentConfig.shouldAdjust(currentValue)) {
            updatedSlots[slotId] = {
              ...updatedSlots[slotId],
              [property]: adjustmentConfig.newValue
            };
            hasChanges = true;
          }
        });
      }
    });

    // Apply changes if any were made
    if (hasChanges) {
      setPageConfig(prevConfig => ({
        ...prevConfig,
        slots: updatedSlots
      }));
    }
  }, [viewMode, pageConfig, setPageConfig, adjustmentRules]);
};

export const filterSlotsByViewMode = (childSlots, viewMode) => {
  return childSlots.filter(slot => {
    // No viewMode specified - always show
    if (!slot.viewMode || !Array.isArray(slot.viewMode) || slot.viewMode.length === 0) {
      return true;
    }
    // 'default' in viewMode means show in all view modes
    if (slot.viewMode.includes('default')) {
      return true;
    }
    // Check if specific viewMode matches
    return slot.viewMode.includes(viewMode);
  });
};

export const sortSlotsByGridCoordinates = (filteredSlots) => {
  return filteredSlots.sort((a, b) => {
    // Use grid coordinates (col, row) - all slots should have these now
    const hasGridCoordsA = a.position && (a.position.col !== undefined && a.position.row !== undefined);
    const hasGridCoordsB = b.position && (b.position.col !== undefined && b.position.row !== undefined);

    if (hasGridCoordsA && hasGridCoordsB) {
      // Sort by row first, then by column
      const rowA = a.position.row;
      const rowB = b.position.row;

      if (rowA !== rowB) {
        return rowA - rowB;
      }

      // Same row, sort by column
      const colA = a.position.col;
      const colB = b.position.col;
      if (colA !== colB) {
        return colA - colB;
      }
    }

    // Default: maintain original order for slots without coordinates
    return 0;
  });
};


// Helper function to create clean slots from config
function createCleanSlots(config) {
  const cleanSlots = {};

  // Get demo variable context for processing template variables
  const variableContext = generateDemoData('category');

  if (config.slots) {
    Object.entries(config.slots).forEach(([key, slot]) => {
      // Process styles to replace template variables with actual values
      const processedStyles = {};
      if (slot.styles) {
        Object.entries(slot.styles).forEach(([styleKey, styleValue]) => {
          if (typeof styleValue === 'string') {
            // Process any template variables in the style value
            processedStyles[styleKey] = processVariables(styleValue, variableContext);
          } else {
            processedStyles[styleKey] = styleValue;
          }
        });
      }

      // Only copy serializable properties, ensure no undefined values
      cleanSlots[key] = {
        id: slot.id || key,
        type: slot.type || 'container',
        component: slot.component || null, // ← CRITICAL: Component name for component slots
        content: slot.content || '',
        className: slot.className || '',
        parentClassName: slot.parentClassName || '',
        styles: processedStyles,
        parentId: slot.parentId === undefined ? null : slot.parentId,
        layout: slot.layout || null,
        gridCols: slot.gridCols || null,
        colSpan: slot.colSpan || 12,
        rowSpan: slot.rowSpan || 1,
        position: slot.position ? { ...slot.position } : null,
        viewMode: slot.viewMode ? [...slot.viewMode] : [],
        metadata: slot.metadata ? { ...slot.metadata } : {}
      };
    });
  }
  return cleanSlots;
}

export function useSlotConfiguration({
  pageType,
  pageName,
  slotType,
  selectedStore
}) {

  // Generic reset layout function
  const handleResetLayout = useCallback(async () => {
    try {
      const storeId = selectedStore?.id;
      if (!storeId) {
        throw new Error('No store selected');
      }

      // First, try to get the last published configuration
      const publishedResponse = await slotConfigurationService.getPublishedConfiguration(storeId, pageType);
      let config;

      if (publishedResponse.success && publishedResponse.data?.configuration) {
        config = publishedResponse.data.configuration;
      } else {
        // No published configuration found - this should not happen if store was properly provisioned
        throw new Error(`No published configuration found for ${pageType}. Please ensure the store was properly provisioned.`);
      }

      // Verify config has slots before saving
      if (!config.slots || Object.keys(config.slots).length === 0) {
        console.error('❌ Reset layout failed: config has no slots', config);
        throw new Error('Cannot reset to empty configuration');
      }

      // Save the config to database (this will overwrite any existing draft)
      // Pass isReset=true to set has_unpublished_changes = false
      await slotConfigurationService.saveConfiguration(storeId, config, pageType, true);

      return config;
    } catch (error) {
      console.error(`❌ Failed to reset ${pageType} layout:`, error);
      throw error;
    }
  }, [selectedStore, pageType, pageName, slotType]);

  // Generic publish configuration function
  const handlePublishConfiguration = useCallback(async () => {
    try {
      const storeId = selectedStore?.id;
      if (!storeId) {
        throw new Error('No store selected');
      }

      // Get the current draft configuration
      const draftResponse = await slotConfigurationService.getDraftConfiguration(storeId, pageType);

      if (!draftResponse.success || !draftResponse.data) {
        throw new Error('No draft configuration found to publish');
      }

      const draftConfig = draftResponse.data;

      // Publish the draft configuration
      const publishResponse = await slotConfigurationService.publishDraft(draftConfig.id, storeId);

      if (publishResponse.success) {

        // Create a new draft based on the published configuration
        try {
          const publishedConfig = draftConfig.configuration; // The configuration that was just published
          await slotConfigurationService.createDraftFromPublished(storeId, publishedConfig, pageType);
        } catch (draftError) {
          console.warn(`⚠️ Failed to create new draft after publish:`, draftError);
          // Don't fail the entire publish operation if draft creation fails
        }

        return publishResponse;
      } else {
        throw new Error('Failed to publish configuration');
      }
    } catch (error) {
      console.error(`❌ Failed to publish ${pageType} configuration:`, error);

      // Handle specific case where draft was already published or doesn't exist
      if (error.message && error.message.includes('Draft not found or already published')) {
        console.warn('⚠️ Draft was already published or removed. Refreshing status...');
        // The configuration might already be published, so this isn't necessarily an error
        return { success: true, message: 'Configuration was already published' };
      }

      throw error;
    }
  }, [selectedStore, pageType]);

  // Load published configuration from database to use as base for new drafts
  const loadPublishedConfiguration = useCallback(async () => {
    const storeId = selectedStore?.id;
    if (!storeId) {
      throw new Error('No store selected');
    }

    const publishedResponse = await slotConfigurationService.getPublishedConfiguration(storeId, pageType);

    if (publishedResponse.success && publishedResponse.data?.configuration) {
      return publishedResponse.data.configuration;
    }

    throw new Error(`No published configuration found for ${pageType}. Please ensure the store was properly provisioned.`);
  }, [selectedStore, pageType]);

  // Get draft configuration for editor - populate with static config if empty
  const getDraftConfiguration = useCallback(async () => {
    const storeId = selectedStore?.id;

    if (!storeId) {
      throw new Error('No store selected - cannot load draft configuration');
    }

    try {

      // Get draft from database (may be empty on first load)
      const savedConfig = await slotConfigurationService.getDraftConfiguration(storeId, pageType, null);

      if (savedConfig && savedConfig.success && savedConfig.data && savedConfig.data.configuration) {
        const draftConfig = savedConfig.data.configuration;
        const draftStatus = savedConfig.data.status;

        // Check if draft needs initialization (status = 'init' OR empty slots)
        const needsInitialization = draftStatus === 'init' || !draftConfig.slots || Object.keys(draftConfig.slots).length === 0;

        if (needsInitialization) {
          // Load published config from database to populate draft
          const publishedConfig = await loadPublishedConfiguration();
          // Create complete configuration from published config
          const populatedConfig = {
            ...draftConfig,
            slots: publishedConfig.slots,
            cmsBlocks: publishedConfig.cmsBlocks || [],
            metadata: {
              ...draftConfig.metadata,
              populatedFromPublished: true,
              populatedAt: new Date().toISOString(),
              version: publishedConfig.metadata?.version || '1.0'
            }
          };

          // Save the populated configuration back to database
          // This should change status from 'init' to 'draft'
          try {
            await slotConfigurationService.updateDraftConfiguration(
              savedConfig.data.id,
              populatedConfig,
              storeId,
              false // not a reset
            );
          } catch (saveError) {
            console.error('❌ [getDraftConfiguration] Failed to save populated config:', saveError);
            // Continue with populated config even if save fails
          }

          return populatedConfig;
        } else if (draftStatus === 'draft') {
          return draftConfig;
        } else {
          console.warn(`⚠️ EDITOR - Unexpected draft status: ${draftStatus}`);
          return draftConfig;
        }
      } else {
        throw new Error('No valid draft configuration found - this should not happen in editor context');
      }
    } catch (error) {
      console.error('❌ EDITOR - Failed to load draft configuration:', error);
      throw error;
    }
  }, [selectedStore, pageType, loadPublishedConfiguration]);

  // Generic validation function for slot configurations
  const validateSlotConfiguration = useCallback((slots) => {
    if (!slots || typeof slots !== 'object') {
      console.error('❌ Validation failed: slots is not an object');
      return false;
    }

    // Check for required properties in each slot
    for (const [slotId, slot] of Object.entries(slots)) {
      if (!slot.id || slot.id !== slotId) {
        console.error(`❌ Slot ${slotId} has invalid or missing id`, { slotId, actualId: slot.id });
        return false;
      }

      if (!slot.type) {
        // Allow slots with only style overrides (from PATCH updates)
        // These will be merged with default template at render time
        if (slot.styles && Object.keys(slot).length <= 3) {
          // Slot has id + styles (+ maybe className/content) - this is a style override
          console.warn(`⚠️ Slot ${slotId} missing type (style override only) - will use default template`, slot);
          // Don't fail validation - this slot will get type from default config
        } else {
          console.error(`❌ Slot ${slotId} missing type`, slot);
          return false;
        }
      }

      // Ensure viewMode is always an array
      if (slot.viewMode && !Array.isArray(slot.viewMode)) {
        console.error(`❌ Slot ${slotId} has invalid viewMode (not an array)`, { viewMode: slot.viewMode });
        return false;
      }

      // Validate parentId references
      // Allow slots to reference template parents (without _N suffix) OR instance parents (with _N suffix)
      if (slot.parentId && slot.parentId !== null && !slots[slot.parentId]) {
        // Check if this references a template parent (e.g., product_card_price_0 -> product_card_price_container)
        const baseTemplateParentId = slot.parentId.replace(/_\d+$/, '');

        // Special case: product_card_N instances reference product_card_template
        const isProductCardInstance = slot.parentId.match(/^product_card_(\d+)$/);

        // Special case: Template slots can reference product_card_template or other template containers
        const isTemplateSlot = slot.metadata?.isTemplate || slot.parentId === 'product_card_template';

        if (!slots[baseTemplateParentId] && !isProductCardInstance && !isTemplateSlot) {
          console.error(`❌ Slot ${slotId} references non-existent parent ${slot.parentId} (template: ${baseTemplateParentId})`, {
            slotId,
            parentId: slot.parentId,
            parentExists: !!slots[slot.parentId],
            templateParentExists: !!slots[baseTemplateParentId],
            isProductCardInstance: !!isProductCardInstance,
            isTemplateSlot,
            availableSlots: Object.keys(slots).filter(k => k.includes('product_card'))
          });
          return false;
        }

        // Validation passed - template parent exists for instance slot or is template slot
      }
    }

    // Ensure main_layout has null parentId
    if (slots.main_layout && slots.main_layout.parentId !== null) {
      console.error('❌ main_layout must have parentId: null');
      return false;
    }

    return true;
  }, []);

  // Generic slot creation function
  const createSlot = useCallback((slotType, content = '', parentId = null, additionalProps = {}, slots) => {
    const newSlotId = `new_${slotType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Determine default viewMode based on page type
    let defaultViewMode = [];
    let defaultPosition = { col: 1, row: 1 };
    let defaultColSpan = slotType === 'container' ? 12 : 6;
    let effectiveParentId = parentId;

    switch (pageType) {
      case 'cart':
        defaultViewMode = ['emptyCart', 'withProducts'];
        break;
      case 'category':
        defaultViewMode = ['grid', 'list'];
        // For category, place new slots in page_header (row 1) to appear above products
        // Products are in products_container at row 2
        if (effectiveParentId === null) {
          defaultPosition = { col: 1, row: 1 };
          defaultColSpan = 12; // Full width in header
        }
        break;
      case 'product':
        defaultViewMode = ['default'];
        // For product, place new slots in main_layout at row 1 to appear above content_area (row 2)
        if (effectiveParentId === null) {
          effectiveParentId = 'main_layout'; // Place inside main_layout instead of root
          defaultPosition = { col: 1, row: 1 };
          defaultColSpan = 12; // Full width
        }
        break;
      case 'checkout':
        defaultViewMode = ['default'];
        break;
      case 'header':
        defaultViewMode = ['default'];
        break;
      default:
        defaultViewMode = [];
    }

    const newSlot = {
      id: newSlotId,
      type: slotType,
      content: content,
      className: slotType === 'container' ? 'p-4 border border-gray-200 rounded' :
                slotType === 'text' ? 'text-base text-gray-900' :
                slotType === 'image' ? 'w-full h-auto' : '',
      parentClassName: '',
      styles: slotType === 'container' ? { minHeight: '80px' } : {},
      parentId: effectiveParentId,
      position: defaultPosition,
      colSpan: defaultColSpan,
      rowSpan: 1,
      viewMode: defaultViewMode, // Show in all view modes for this page type
      isCustom: true, // Mark as custom slot for deletion
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        hierarchical: true,
        ...additionalProps
      }
    };

    const updatedSlots = { ...slots };
    updatedSlots[newSlotId] = newSlot;

    // No need to update order - slots use grid coordinates

    return { updatedSlots, newSlotId };
  }, [pageType]);

  // Helper function to get the parent of a parent
  const getParentOfParent = (slots, slotId) => {
    const slot = slots[slotId];
    if (!slot || !slot.parentId) return null;
    const parent = slots[slot.parentId];
    return parent?.parentId || null;
  };

  // Generic slot drop handler
  const handleSlotDrop = useCallback((draggedSlotId, targetSlotId, dropPosition, slots) => {
    if (draggedSlotId === targetSlotId) {
      return null;
    }

    let targetSlot = slots[targetSlotId];
    let actualTargetSlotId = targetSlotId;

    // If target slot not found, check if it's an instance slot and try template slot
    if (!targetSlot) {
      const targetInstanceMatch = targetSlotId.match(/^(.+)_(\d+)$/);
      if (targetInstanceMatch) {
        const templateTargetId = targetInstanceMatch[1];
        targetSlot = slots[templateTargetId];
        if (targetSlot) {
          actualTargetSlotId = templateTargetId;
        }
      }
    }

    // Special case: product_card_N is a dynamically created container, treat as product_card_template
    if (!targetSlot && targetSlotId.match(/^product_card_\d+$/)) {
      targetSlot = slots['product_card_template'];
      actualTargetSlotId = 'product_card_template';
    }

    if (!targetSlot) {
      return null;
    }

    // Prevent moving critical layout containers
    if (draggedSlotId === 'main_layout') {
      console.warn('⚠️ Cannot move main_layout');
      return null;
    }

    // Prevent circular references - a slot cannot be its own parent
    if (draggedSlotId === targetSlotId) {
      console.warn('⚠️ Cannot make a slot its own parent');
      return null;
    }

    // Prevent moving a container into one of its own children
    const isChildOf = (potentialChildId, potentialParentId, slots) => {
      let currentId = potentialChildId;
      const visited = new Set();

      while (currentId && !visited.has(currentId)) {
        if (currentId === potentialParentId) {
          return true;
        }
        visited.add(currentId);
        currentId = slots[currentId]?.parentId;
      }
      return false;
    };

    if (isChildOf(targetSlotId, draggedSlotId, slots)) {
      console.warn('⚠️ Cannot move a container into its own child:', {
        draggedSlotId,
        targetSlotId
      });
      return null;
    }

    // Also prevent moving other root containers into wrong places
    if (['header_container', 'content_area', 'sidebar_area'].includes(draggedSlotId) &&
        dropPosition !== 'after' && dropPosition !== 'before') {
      console.warn('⚠️ Cannot move root container inside another slot');
      return null;
    }

    // Create a deep clone to avoid mutations
    const updatedSlots = JSON.parse(JSON.stringify(slots));
    let draggedSlot = null;
    let actualDraggedSlotId = draggedSlotId;

    // ALWAYS check if dragged is an instance slot first (product_card_name_0, etc.)
    const draggedInstanceMatch = draggedSlotId.match(/^(.+)_(\d+)$/);
    if (draggedInstanceMatch) {
      const templateDraggedId = draggedInstanceMatch[1];
      // For instance slots, ALWAYS use template slot
      draggedSlot = updatedSlots[templateDraggedId];
      if (draggedSlot) {
        actualDraggedSlotId = templateDraggedId;
      }
    } else {
      // Not an instance slot, use as-is
      draggedSlot = updatedSlots[draggedSlotId];
    }

    const updatedTargetSlot = updatedSlots[actualTargetSlotId];

    if (!draggedSlot || !updatedTargetSlot) {
      return null;
    }

    // Prevent moving template containers (product_card_content, product_card_price_container, etc.)
    // These are structural containers that should stay within their parent template
    if (draggedSlot?.type === 'container' && draggedSlot?.metadata?.hierarchical) {
      return null;
    }

    // Store ALL original properties to preserve them
    const originalProperties = {
      id: draggedSlotId, // Use original instance ID
      type: draggedSlot.type,
      component: draggedSlot.component,  // CRITICAL: Preserve component field for component slots
      content: draggedSlot.content,
      className: draggedSlot.className,
      parentClassName: draggedSlot.parentClassName,
      parentId: draggedSlot.parentId,  // CRITICAL: Must preserve parentId!
      styles: draggedSlot.styles || {},
      layout: draggedSlot.layout,
      gridCols: draggedSlot.gridCols,
      colSpan: draggedSlot.colSpan,
      rowSpan: draggedSlot.rowSpan,
      viewMode: draggedSlot.viewMode,
      metadata: draggedSlot.metadata || {},
      position: draggedSlot.position || {}
    };

    // Calculate new position based on drop zone
    let newParentId, newPosition;

    // Helper function to find next available position in a container
    const findAvailablePosition = (parentId, preferredRow = 1, preferredCol = 1) => {
      const siblings = Object.values(updatedSlots).filter(slot =>
        slot.parentId === parentId && slot.id !== draggedSlotId
      );

      // Try the preferred position first
      let row = preferredRow;
      let col = preferredCol;

      // Find an available position by checking for conflicts
      let positionFound = false;
      for (let r = row; r <= row + 10 && !positionFound; r++) {
        for (let c = col; c <= 12 && !positionFound; c++) {
          const hasConflict = siblings.some(sibling =>
            sibling.position?.row === r && sibling.position?.col === c
          );
          if (!hasConflict) {
            row = r;
            col = c;
            positionFound = true;
          }
        }
        col = 1; // Reset column for next row
      }

      return { col, row };
    };

    // Determine if this is container-to-container or intra-container reordering
    const isContainerTarget = ['container', 'grid', 'flex'].includes(targetSlot.type);
    const currentParent = originalProperties.parentId;

    // Special handling for product_card_template - when it's the target, use it as parent
    let targetParent = targetSlot.parentId;
    if (actualTargetSlotId === 'product_card_template') {
      targetParent = 'product_card_template';
    }

    // For instance slots, also check template-level parent equality
    // This allows cross-container moves between instance containers that share the same template parent
    const currentTemplateParent = currentParent?.replace(/_\d+$/, '') || currentParent;
    const targetTemplateParent = targetParent?.replace(/_\d+$/, '') || targetParent;
    const sameTemplateParent = currentTemplateParent === targetTemplateParent;

    if (dropPosition === 'inside' && isContainerTarget) {

      // Check if trying to drop on own parent - this means move to grandparent
      // Also handle template parent matching for instance slots
      const targetTemplateId = actualTargetSlotId;
      const currentTemplateParent = originalProperties.parentId?.replace(/_\d+$/, '') || originalProperties.parentId;

      if (currentTemplateParent === targetTemplateId) {
        // Move to the parent's parent (grandparent)
        const parentSlot = updatedSlots[actualTargetSlotId];
        if (parentSlot && parentSlot.parentId) {
          newParentId = parentSlot.parentId;
          newPosition = findAvailablePosition(newParentId, 1, 1);
        } else {
          return null;
        }
      }
      // Check if this is really a cross-container move or accidental parent hit
      else if (originalProperties.parentId && targetSlotId === getParentOfParent(slots, originalProperties.parentId)) {
        // User dragged to grandparent container - likely trying to reorder within current parent
        newParentId = originalProperties.parentId;

        // Find an early position in the container (row 1)
        const siblings = Object.values(slots).filter(slot =>
          slot.parentId === originalProperties.parentId && slot.id !== draggedSlotId
        );
        const minRow = Math.min(...siblings.map(s => s.position?.row || 1));
        newPosition = { col: 1, row: Math.max(1, minRow - 1) };

      } else {
        // Genuine container-to-container move
        newParentId = targetSlotId;
        newPosition = findAvailablePosition(newParentId, 1, 1);
      }

    } else if ((dropPosition === 'before' || dropPosition === 'after') && currentParent === targetParent) {
      // Intra-container reordering - same parent, different position
      newParentId = currentParent;

      if (dropPosition === 'before') {
        // Take target's position, shift target and others down/right
        newPosition = {
          col: targetSlot.position?.col || 1,
          row: targetSlot.position?.row || 1
        };
      } else { // after
        // Place after target - use next available position
        const targetPos = targetSlot.position || { col: 1, row: 1 };

        // Try placing in next column, but ensure it's different from current position
        let newCol = targetPos.col + 1;
        let newRow = targetPos.row;

        // If at end of row or same as current position, go to next row
        if (newCol > 12 || (newCol === originalProperties.position?.col && newRow === originalProperties.position?.row)) {
          newCol = 1;
          newRow = targetPos.row + 1;
        }

        newPosition = { col: newCol, row: newRow };
      }

    } else if ((dropPosition === 'before' || dropPosition === 'after') && currentParent !== targetParent) {
      // Special case: if target is product_card_template and we're dropping before/after,
      // treat it as moving INSIDE the template, not to product_items
      if (actualTargetSlotId === 'product_card_template' && (dropPosition === 'before' || dropPosition === 'after')) {
        newParentId = 'product_card_template';

        if (dropPosition === 'before') {
          // Place at top (row 1) and shift existing slots down
          newPosition = { col: 1, row: 1 };

          // Shift all existing slots in product_card_template down by one row
          Object.keys(updatedSlots).forEach(slotId => {
            const slot = updatedSlots[slotId];
            if (slot.parentId === 'product_card_template' && slot.id !== actualDraggedSlotId && slot.position) {
              slot.position = {
                ...slot.position,
                row: (slot.position.row || 1) + 1
              };
            }
          });
        } else {
          // Place at bottom - find max row and place after it
          const childSlots = Object.values(updatedSlots).filter(s =>
            s.parentId === 'product_card_template' && s.id !== actualDraggedSlotId
          );
          const maxRow = childSlots.length > 0 ? Math.max(...childSlots.map(s => s.position?.row || 1)) : 0;
          newPosition = { col: 1, row: maxRow + 1 };
        }
      } else {
        // Different parents - move to target's parent container
        newParentId = targetParent;

        // Use position relative to target
        if (dropPosition === 'before') {
          // Place at start of target's row (col: 1) to ensure it appears before other slots
          newPosition = {
            col: 1,
            row: targetSlot.position?.row || 1
          };
        } else {
          const targetPos = targetSlot.position || { col: 1, row: 1 };
          // For cross-container moves, place after target
          // Calculate next position based on target's colSpan
          const targetColSpan = typeof targetSlot.colSpan === 'number' ? targetSlot.colSpan :
                              (targetSlot.colSpan?.grid || targetSlot.colSpan?.list || 1);
          let newCol = targetPos.col + targetColSpan;

          if (newCol > 12) {
            newPosition = { col: 1, row: targetPos.row + 1 };
          } else {
            newPosition = { col: newCol, row: targetPos.row };
          }
        }
      }

    } else {
      // Invalid drop - should only be for "inside" on non-containers
      return null;
    }

    // Position validation completed

    // Update dragged slot position while preserving ALL essential properties
    // Use actualDraggedSlotId which is the template slot ID
    updatedSlots[actualDraggedSlotId] = {
      ...originalProperties,
      id: actualDraggedSlotId, // Update to actual slot ID (template)
      parentId: newParentId,
      position: newPosition,
      metadata: {
        ...originalProperties.metadata,
        lastModified: new Date().toISOString()
      }
    };

    // Ensure we preserve viewMode array properly
    if (Array.isArray(originalProperties.viewMode)) {
      updatedSlots[actualDraggedSlotId].viewMode = [...originalProperties.viewMode];
    }

    // Note: If we used template slots (actualDraggedSlotId !== draggedSlotId),
    // the template is already updated above. No additional mapping needed.

    // Handle slot shifting for intra-container reordering
    if (currentParent === newParentId && (dropPosition === 'before' || dropPosition === 'after')) {
      // Shift other slots in the same container to make room
      Object.keys(updatedSlots).forEach(slotId => {
        if (slotId !== draggedSlotId) {
          const slot = updatedSlots[slotId];
          if (slot.parentId === newParentId && slot.position) {
            const needsShift = (
              slot.position.row > newPosition.row ||
              (slot.position.row === newPosition.row && slot.position.col >= newPosition.col)
            );

            if (needsShift) {
              // Shift this slot forward
              if (slot.position.col < 12) {
                slot.position = {
                  ...slot.position,
                  col: slot.position.col + 1
                };
              } else {
                // Move to next row if at end of columns
                slot.position = {
                  col: 1,
                  row: slot.position.row + 1
                };
              }
            }
          }
        }
      });
    }

    // Validate the updated configuration before applying
    if (!validateSlotConfiguration(updatedSlots)) {
      return null;
    }

    return updatedSlots;
  }, [validateSlotConfiguration]);

  // Generic slot delete handler
  const handleSlotDelete = useCallback((slotId, slots) => {

    // Don't allow deleting critical layout containers
    if (['main_layout', 'header_container', 'content_area', 'sidebar_area'].includes(slotId)) {
      console.warn('⚠️ Cannot delete critical layout container:', slotId);
      return null;
    }

    // Use SlotManager to delete the slot and its children
    const updatedSlots = SlotManager.deleteSlot(slots, slotId);
    return updatedSlots;
  }, []);

  // Utility function to constrain child element positions within parent slot bounds
  const constrainChildToParentBounds = useCallback((childSlot, parentSlot, slots) => {
    if (!childSlot.styles || !parentSlot) return childSlot;

    const updatedStyles = { ...childSlot.styles };

    // Constrain left positioning using percentages (responsive)
    if (updatedStyles.left && typeof updatedStyles.left === 'string') {
      // Handle percentage values
      const leftPercentMatch = updatedStyles.left.match(/^(\d+(?:\.\d+)?)%$/);
      if (leftPercentMatch) {
        const leftPercent = parseFloat(leftPercentMatch[1]);
        // Keep within 0-80% to leave some margin
        const constrainedLeft = Math.max(0, Math.min(80, leftPercent));
        updatedStyles.left = `${constrainedLeft}%`;
      }

      // Convert pixel values to percentages for responsive behavior
      const leftPxMatch = updatedStyles.left.match(/^(\d+(?:\.\d+)?)px$/);
      if (leftPxMatch) {
        const leftPx = parseFloat(leftPxMatch[1]);
        // Convert to percentage: assume parent is roughly 300-800px wide depending on colSpan
        // Use a reasonable conversion: 100px ≈ 12.5% for typical slot widths
        const leftPercent = Math.max(0, Math.min(80, (leftPx / 8))); // Rough px to % conversion
        updatedStyles.left = `${leftPercent}%`;
      }
    }

    // Keep width in pixels for text elements (they need fixed sizing)
    // but constrain to reasonable bounds
    if (updatedStyles.width && typeof updatedStyles.width === 'string') {
      const widthPxMatch = updatedStyles.width.match(/^(\d+(?:\.\d+)?)px$/);
      if (widthPxMatch) {
        const widthPx = parseFloat(widthPxMatch[1]);
        // Constrain to reasonable bounds (20px minimum, 500px maximum)
        const constrainedWidth = Math.max(20, Math.min(500, widthPx));
        updatedStyles.width = `${constrainedWidth}px`;
      }
    }

    return {
      ...childSlot,
      styles: updatedStyles
    };
  }, []);

  // Enhanced function to apply constraints to all child elements
  const applyConstraintsToChildren = useCallback((slots, parentSlotId = null) => {
    const updatedSlots = { ...slots };

    Object.keys(updatedSlots).forEach(slotId => {
      const slot = updatedSlots[slotId];

      // If we're checking a specific parent, only process its children
      if (parentSlotId && slot.parentId !== parentSlotId) return;

      // If checking all slots, only process those with parents
      if (!parentSlotId && !slot.parentId) return;

      const parentSlot = updatedSlots[slot.parentId];
      if (parentSlot) {
        updatedSlots[slotId] = constrainChildToParentBounds(slot, parentSlot, updatedSlots);
      }
    });

    return updatedSlots;
  }, [constrainChildToParentBounds]);

  // Generic grid resize handler
  const handleGridResize = useCallback((slotId, newColSpan, slots) => {
    console.log('[handleGridResize] Called with slotId:', slotId, 'newColSpan:', newColSpan);
    const updatedSlots = { ...slots };

    // Map instance slot IDs (product_card_name_0) to template IDs (product_card_name)
    const instanceMatch = slotId.match(/^(.+)_(\d+)$/);
    const templateSlotId = instanceMatch ? instanceMatch[1] : slotId;
    const isInstanceSlot = instanceMatch !== null;

    // Update the instance slot for immediate UI feedback
    if (updatedSlots[slotId]) {
      // Update hierarchical slot colSpan
      updatedSlots[slotId] = {
        ...updatedSlots[slotId],
        colSpan: newColSpan
      };
    }

    // CRITICAL: Also update the template slot so changes persist
    if (isInstanceSlot && updatedSlots[templateSlotId]) {
      updatedSlots[templateSlotId] = {
        ...updatedSlots[templateSlotId],
        colSpan: newColSpan
      };

      // When slot resizes, child positions in percentages remain proportionally correct
      // We just need to apply constraints to ensure they stay within bounds

      // Find and adjust all child elements within this slot
      Object.keys(updatedSlots).forEach(childSlotId => {
        const childSlot = updatedSlots[childSlotId];

        // Check if this is a child of the resized slot
        if (childSlot.parentId === slotId && childSlot.styles) {
          const updatedStyles = { ...childSlot.styles };

          // Convert any remaining pixel positions to percentages for responsive behavior
          if (updatedStyles.left && typeof updatedStyles.left === 'string') {
            const leftPxMatch = updatedStyles.left.match(/^(\d+(?:\.\d+)?)px$/);
            if (leftPxMatch) {
              const leftPx = parseFloat(leftPxMatch[1]);
              // Convert px to percentage based on typical slot width
              const leftPercent = Math.max(0, Math.min(80, (leftPx / 8)));
              updatedStyles.left = `${leftPercent}%`;
            }

            // Ensure percentage positions stay within reasonable bounds
            const leftPercentMatch = updatedStyles.left.match(/^(\d+(?:\.\d+)?)%$/);
            if (leftPercentMatch) {
              const leftPercent = parseFloat(leftPercentMatch[1]);
              if (leftPercent > 80) { // Too far right for smaller slot
                updatedStyles.left = '80%';
              }
            }
          }

          // Keep width in pixels but ensure it's reasonable for the new slot size
          if (updatedStyles.width && typeof updatedStyles.width === 'string') {
            const widthPxMatch = updatedStyles.width.match(/^(\d+(?:\.\d+)?)px$/);
            if (widthPxMatch) {
              const widthPx = parseFloat(widthPxMatch[1]);
              // Constrain width based on new slot size
              const maxReasonableWidth = newColSpan * 60; // ~60px per column span
              const constrainedWidth = Math.max(20, Math.min(maxReasonableWidth, widthPx));
              updatedStyles.width = `${constrainedWidth}px`;
            }
          }

          updatedSlots[childSlotId] = {
            ...childSlot,
            styles: updatedStyles
          };
        }
      });

      // Apply general constraints to ensure all children stay within bounds
      const constrainedSlots = applyConstraintsToChildren(updatedSlots, slotId);
      return constrainedSlots;
    }

    return updatedSlots;
  }, [applyConstraintsToChildren]);

  // Generic slot height resize handler
  const handleSlotHeightResize = useCallback((slotId, newHeight, slots) => {
    const updatedSlots = { ...slots };

    if (updatedSlots[slotId]) {
      // Calculate row span based on height (rough approximation: 40px per row)
      const estimatedRowSpan = Math.max(1, Math.round(newHeight / 40));

      // Update the slot's height and rowSpan
      updatedSlots[slotId] = {
        ...updatedSlots[slotId],
        rowSpan: estimatedRowSpan,
        styles: {
          ...updatedSlots[slotId].styles,
          minHeight: `${newHeight}px`
        }
      };
    }

    return updatedSlots;
  }, []);

  // Generic text change handler
  const handleTextChange = useCallback((slotId, newText, slots) => {
    const updatedSlots = { ...slots };

    if (updatedSlots[slotId]) {
      updatedSlots[slotId] = {
        ...updatedSlots[slotId],
        content: newText,
        metadata: {
          ...updatedSlots[slotId].metadata,
          lastModified: new Date().toISOString()
        }
      };
    }

    return updatedSlots;
  }, []);

  // Generic class change handler
  const handleClassChange = useCallback((slotId, className, styles, metadata = null, isAlignmentChange = false, slots) => {

    const updatedSlots = { ...slots };

    // CRITICAL: Create slot if it doesn't exist (for template slots not yet in config)
    if (!updatedSlots[slotId]) {

      // Extract base template ID (remove _0, _1, etc. suffix)
      const baseTemplateId = slotId.replace(/_\d+$/, '');
      const templateSlot = updatedSlots[baseTemplateId];

      // Copy className, styles, and other properties from template if available
      const templateClassName = templateSlot?.className || '';
      const templateStyles = templateSlot?.styles ? { ...templateSlot.styles } : {};
      const templateType = templateSlot?.type || 'text';
      const templateContent = templateSlot?.content || '';
      const templateParentClassName = templateSlot?.parentClassName || '';

      updatedSlots[slotId] = {
        id: slotId,
        type: templateType,
        content: templateContent,
        className: templateClassName, // Inherit from template
        parentClassName: templateParentClassName, // Inherit from template
        styles: templateStyles, // Inherit styles from template
        metadata: metadata || {}
      };

    }

    // Merge existing styles with new styles
    const existingStyles = updatedSlots[slotId].styles || {};
    const mergedStyles = { ...existingStyles, ...styles };

    // Define categories of classes
    const alignmentClasses = ['text-left', 'text-center', 'text-right'];
    const newClasses = className.split(' ').filter(Boolean);

    if (isAlignmentChange || newClasses.some(cls => alignmentClasses.includes(cls))) {
      // For alignment changes, preserve ALL existing classes on element, only move alignment to parent
      const existingClassName = updatedSlots[slotId].className || '';
      const existingClasses = existingClassName.split(' ').filter(Boolean);

      // Remove old alignment classes from existing classes (keep colors, fonts, etc.)
      const existingNonAlignmentClasses = existingClasses.filter(cls => !alignmentClasses.includes(cls));

      // Get new alignment classes from the change
      const newAlignmentClasses = newClasses.filter(cls => alignmentClasses.includes(cls));

      updatedSlots[slotId] = {
        ...updatedSlots[slotId],
        className: existingNonAlignmentClasses.join(' '), // Keep all existing non-alignment classes
        parentClassName: newAlignmentClasses.join(' '),   // Only alignment goes to parent
        styles: mergedStyles,
        metadata: {
          ...updatedSlots[slotId].metadata,
          ...metadata,
          lastModified: new Date().toISOString()
        }
      };

    } else {
      // For style changes (backgroundColor, color, etc.), preserve existing className
      // CRITICAL: Only update className if incoming className is non-empty and different
      const existingClassName = updatedSlots[slotId].className || '';
      const incomingClassName = className?.trim() || '';

      // If incoming className is empty or same as existing, keep existing
      // This prevents className from being wiped out during style-only changes
      const finalClassName = incomingClassName && incomingClassName !== existingClassName
        ? incomingClassName
        : existingClassName;

      updatedSlots[slotId] = {
        ...updatedSlots[slotId],
        className: finalClassName,
        styles: mergedStyles,
        metadata: {
          ...updatedSlots[slotId].metadata,
          ...metadata,
          lastModified: new Date().toISOString()
        }
      };

    }

    // MIRROR: If this is a product template instance (has _N suffix), also update the base template
    // This ensures template and instance are updated in the SAME state update
    const baseTemplateId = slotId.replace(/_\d+$/, '');
    if (baseTemplateId !== slotId && updatedSlots[baseTemplateId]) {

      // Apply the same changes to the template slot
      const templateExistingStyles = updatedSlots[baseTemplateId].styles || {};
      const templateMergedStyles = { ...templateExistingStyles, ...styles };

      if (isAlignmentChange || newClasses.some(cls => alignmentClasses.includes(cls))) {
        // For template, also preserve ALL existing classes, only move alignment to parent
        const templateExistingClassName = updatedSlots[baseTemplateId].className || '';
        const templateExistingClasses = templateExistingClassName.split(' ').filter(Boolean);
        const templateExistingNonAlignmentClasses = templateExistingClasses.filter(cls => !alignmentClasses.includes(cls));
        const templateNewAlignmentClasses = newClasses.filter(cls => alignmentClasses.includes(cls));

        updatedSlots[baseTemplateId] = {
          ...updatedSlots[baseTemplateId],
          className: templateExistingNonAlignmentClasses.join(' '),
          parentClassName: templateNewAlignmentClasses.join(' '),
          styles: templateMergedStyles,
          metadata: {
            ...updatedSlots[baseTemplateId].metadata,
            lastModified: new Date().toISOString()
          }
        };
      } else {
        updatedSlots[baseTemplateId] = {
          ...updatedSlots[baseTemplateId],
          className: className,
          styles: templateMergedStyles,
          metadata: {
            ...updatedSlots[baseTemplateId].metadata,
            lastModified: new Date().toISOString()
          }
        };
      }
    } else if (baseTemplateId !== slotId && !updatedSlots[baseTemplateId]) {
      console.warn(`[handleClassChange] ⚠️ Template ${baseTemplateId} NOT FOUND for mirroring`);
    }

    return updatedSlots;
  }, []);

  // Generic element click handler
  const createElementClickHandler = useCallback((isResizing, lastResizeEndTime, setSelectedElement, setIsSidebarVisible) => {
    return useCallback((slotId, element) => {
      // Don't open sidebar if currently resizing or within 200ms of resize end
      const timeSinceResize = Date.now() - lastResizeEndTime.current;
      if (isResizing || timeSinceResize < 200) {
        return;
      }

      // CRITICAL: Always pass the element with data-slot-id attribute!
      // For text slots, className and style are BOTH on this wrapper element.
      // See UnifiedSlotRenderer.jsx line 96: <div data-slot-id="..." className="..." style="...">
      let slotElement = element;

      // If we don't have data-slot-id, traverse up to find it
      if (!slotElement.hasAttribute('data-slot-id')) {
        slotElement = slotElement.closest('[data-slot-id]');
      }

      // If still not found, use the original element as fallback
      if (!slotElement) {
        slotElement = element;
      }

      setSelectedElement(slotElement);
      setIsSidebarVisible(true);
    }, [isResizing, lastResizeEndTime, setSelectedElement, setIsSidebarVisible]);
  }, []);

  // Generic handler factories that take page-specific dependencies
  const createSaveConfigurationHandler = useCallback((pageConfig, setPageConfig, setLocalSaveStatus, getSelectedStoreId, slotType) => {
    return useCallback(async (configToSave = pageConfig) => {
      if (!configToSave) return;

      // Validate configuration before saving
      if (!validateSlotConfiguration(configToSave.slots)) {
        console.error('❌ Cannot save invalid configuration');
        setLocalSaveStatus('error');
        setTimeout(() => setLocalSaveStatus(''), 5000);
        return;
      }

      setLocalSaveStatus('saving');

      try {
        const storeId = getSelectedStoreId();
        if (storeId) {
          // Log button template slot BEFORE filtering
          const templateButtonSlot = configToSave.slots['add_to_cart_button'];

          // Filter out instance slots (with _N suffix) before saving - only save template slots
          const filteredSlots = {};
          Object.entries(configToSave.slots).forEach(([slotId, slot]) => {
            // Check if this is an instance slot (has _N suffix like product_card_name_0)
            const instanceMatch = slotId.match(/^(.+)_(\d+)$/);
            if (instanceMatch) {
              const baseId = instanceMatch[1];
              // Check if the base is a product card child template
              if (configToSave.slots[baseId]?.parentId === 'product_card_template') {
                // Skip instance slots - they're dynamically generated
                return;
              }
            }
            // Keep this slot
            filteredSlots[slotId] = slot;
          });

          // Log button template slot AFTER filtering
          const filteredTemplateButton = filteredSlots['add_to_cart_button'];

          const configToSaveFiltered = {
            ...configToSave,
            slots: filteredSlots
          };
          await slotConfigurationService.saveConfiguration(storeId, configToSaveFiltered, slotType);
        }

        setLocalSaveStatus('saved');
        setTimeout(() => setLocalSaveStatus(''), 3000);
      } catch (error) {
        console.error('❌ Save failed:', error);
        setLocalSaveStatus('error');
        setTimeout(() => setLocalSaveStatus(''), 5000);
      }
    }, [pageConfig, setPageConfig, setLocalSaveStatus, getSelectedStoreId, slotType]);
  }, [validateSlotConfiguration]);

  const createHandlerFactory = useCallback((setPageConfig, saveConfigurationHandler) => {
    return {
      createTextChangeHandler: (textChangeHandler) =>
        useCallback((slotId, newText) => {
          setPageConfig(prevConfig => {
            const updatedSlots = textChangeHandler(slotId, newText, prevConfig?.slots || {});
            const updatedConfig = {
              ...prevConfig,
              slots: updatedSlots
            };

            // Auto-save
            saveConfigurationHandler(updatedConfig);
            return updatedConfig;
          });
        }, [textChangeHandler, saveConfigurationHandler]),

      createClassChangeHandler: (classChangeHandler) =>
        useCallback((slotId, className, styles, metadata = null, isAlignmentChange = false) => {
          setPageConfig(prevConfig => {
            const updatedSlots = classChangeHandler(slotId, className, styles, metadata, isAlignmentChange, prevConfig?.slots || {});
            const updatedConfig = {
              ...prevConfig,
              slots: updatedSlots
            };

            // Auto-save
            saveConfigurationHandler(updatedConfig);
            return updatedConfig;
          });
        }, [classChangeHandler, saveConfigurationHandler]),

      createGridResizeHandler: (gridResizeHandler, saveTimeoutRef) =>
        useCallback((slotId, newColSpan) => {
          setPageConfig(prevConfig => {
            // Map product-specific slot IDs to template IDs
            let effectiveSlotId = slotId;
            const slotMatch = slotId.match(/^(.+)_(\d+)$/);
            if (slotMatch) {
              const baseId = slotMatch[1];
              const templateSlot = prevConfig?.slots?.[baseId]; // Check template, not instance
              if (templateSlot?.parentId === 'product_card_template') {
                effectiveSlotId = baseId;
              }
            }

            const updatedSlots = gridResizeHandler(effectiveSlotId, newColSpan, prevConfig?.slots || {});
            const updatedConfig = {
              ...prevConfig,
              slots: updatedSlots
            };

            // Debounced auto-save - clear previous timeout and set new one
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
              saveConfigurationHandler(updatedConfig);
            }, 500); // Wait 0.5 seconds after resize stops for more responsive feel

            return updatedConfig;
          });
        }, [gridResizeHandler, saveConfigurationHandler]),

      createSlotHeightResizeHandler: (slotHeightResizeHandler, saveTimeoutRef) =>
        useCallback((slotId, newHeight) => {
          setPageConfig(prevConfig => {
            // Map product-specific slot IDs to template IDs
            let effectiveSlotId = slotId;
            const slotMatch = slotId.match(/^(.+)_(\d+)$/);
            if (slotMatch) {
              const baseId = slotMatch[1];
              const templateSlot = prevConfig?.slots?.[baseId]; // Check template, not instance
              if (templateSlot?.parentId === 'product_card_template') {
                effectiveSlotId = baseId;
              }
            }

            const updatedSlots = slotHeightResizeHandler(effectiveSlotId, newHeight, prevConfig?.slots || {});
            const updatedConfig = {
              ...prevConfig,
              slots: updatedSlots
            };

            // Debounced auto-save - clear previous timeout and set new one
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
              saveConfigurationHandler(updatedConfig);
            }, 500); // Wait 0.5 seconds after resize stops for more responsive feel

            return updatedConfig;
          });
        }, [slotHeightResizeHandler, saveConfigurationHandler]),

      createSlotDropHandler: (slotDropHandler, isDragOperationActiveRef) =>
        useCallback(async (draggedSlotId, targetSlotId, dropPosition) => {
          // Mark drag operation as active to prevent config reloads
          isDragOperationActiveRef.current = true;

          const updatedConfig = await new Promise((resolve) => {
            setPageConfig(prevConfig => {
              if (!prevConfig?.slots) {
                console.error('❌ No valid configuration to update');
                resolve(null);
                return prevConfig;
              }

              // Check if this is a product card child slot - if so, work with template IDs
              const draggedMatch = draggedSlotId.match(/^(.+)_(\d+)$/);
              const targetMatch = targetSlotId.match(/^(.+)_(\d+)$/);

              let effectiveDraggedId = draggedSlotId;
              let effectiveTargetId = targetSlotId;
              let isProductSlotDrag = false;

              // Check if dragged slot is a product card child by checking the TEMPLATE slot
              if (draggedMatch) {
                const baseId = draggedMatch[1];
                const templateSlot = prevConfig.slots[baseId]; // Check template, not instance

                if (templateSlot?.parentId === 'product_card_template') {
                  effectiveDraggedId = baseId;
                  isProductSlotDrag = true;
                }
              }

              // Check if target slot is a product card child
              if (targetMatch && isProductSlotDrag) {
                const baseId = targetMatch[1];
                const templateSlot = prevConfig.slots[baseId]; // Check template, not instance

                if (templateSlot?.parentId === 'product_card_template') {
                  effectiveTargetId = baseId;
                }
              }

              // Use the hook function to handle the drop logic
              const updatedSlots = slotDropHandler(effectiveDraggedId, effectiveTargetId, dropPosition, prevConfig.slots);

              if (!updatedSlots) {
                resolve(null);
                return prevConfig;
              }

              const newConfig = {
                ...prevConfig,
                slots: updatedSlots,
                metadata: {
                  ...prevConfig.metadata,
                  lastModified: new Date().toISOString()
                }
              };

              resolve(newConfig);
              return newConfig;
            });
          });

          if (updatedConfig) {
            try {
              await saveConfigurationHandler(updatedConfig);
              // Mark drag operation as complete after save
              setTimeout(() => {
                isDragOperationActiveRef.current = false;
              }, 2000); // 2 second protection after save
            } catch (error) {
              console.error('❌ Failed to save configuration:', error);
              isDragOperationActiveRef.current = false;
            }
          } else {
            console.warn('⚠️ No updated configuration to save - drag operation was cancelled');
            isDragOperationActiveRef.current = false;
          }
        }, [slotDropHandler, saveConfigurationHandler]),

      createSlotCreateHandler: (createSlot) =>
        useCallback((slotType, content = '', parentId = null, additionalProps = {}) => {

          setPageConfig(prevConfig => {
            const { updatedSlots, newSlotId } = createSlot(slotType, content, parentId, additionalProps, prevConfig?.slots || {});

            const updatedConfig = {
              ...prevConfig,
              slots: updatedSlots,
              metadata: {
                ...prevConfig.metadata,
                lastModified: new Date().toISOString()
              }
            };

            // Auto-save the new slot
            try {
              saveConfigurationHandler(updatedConfig);
            } catch (error) {
              console.error('[createSlotCreateHandler] ❌ Auto-save failed:', error);
            }

            return updatedConfig;
          });
        }, [createSlot, saveConfigurationHandler]),

      createSlotDeleteHandler: (handleSlotDelete) =>
        useCallback((slotId) => {
          setPageConfig(prevConfig => {
            const updatedSlots = handleSlotDelete(slotId, prevConfig?.slots || {});

            if (!updatedSlots) {
              console.warn('⚠️ Slot deletion was cancelled');
              return prevConfig;
            }

            const updatedConfig = {
              ...prevConfig,
              slots: updatedSlots,
              metadata: {
                ...prevConfig.metadata,
                lastModified: new Date().toISOString()
              }
            };

            // Auto-save the updated configuration
            saveConfigurationHandler(updatedConfig);
            return updatedConfig;
          });
        }, [handleSlotDelete, saveConfigurationHandler]),

      createResetLayoutHandler: (resetLayoutFromHook, setLocalSaveStatus) =>
        useCallback(async () => {
          setLocalSaveStatus('saving');

          try {
            const newConfig = await resetLayoutFromHook();
            setPageConfig(newConfig);

            setLocalSaveStatus('saved');
            setTimeout(() => setLocalSaveStatus(''), 3000);
          } catch (error) {
            console.error('❌ Failed to reset layout:', error);
            setLocalSaveStatus('error');
            setTimeout(() => setLocalSaveStatus(''), 5000);
          }
        }, [resetLayoutFromHook, setLocalSaveStatus])
    };
  }, []);

  return {
    handleResetLayout,
    handlePublishConfiguration,
    getDraftConfiguration,
    createSlot,
    handleSlotDrop,
    handleSlotDelete,
    handleGridResize,
    handleSlotHeightResize,
    handleTextChange,
    handleClassChange,
    createElementClickHandler,
    createSaveConfigurationHandler,
    createHandlerFactory
  };
}