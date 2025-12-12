import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import slotConfigurationService from '@/services/slotConfigurationService';
import apiClient from '@/api/client';

/**
 * AIWorkspaceContext - Shared state management for the AI Workspace
 * Bridges AI chat panel and visual editor, enabling seamless integration
 */

const AIWorkspaceContext = createContext();

// Available page types that can be edited
export const PAGE_TYPES = {
  PRODUCT: 'product',
  CATEGORY: 'category',
  CART: 'cart',
  HEADER: 'header',
  CHECKOUT: 'checkout',
  SUCCESS: 'success',
  ACCOUNT: 'account',
  LOGIN: 'login',
  HOMEPAGE: 'homepage'
};

// Default view modes for each page type
export const DEFAULT_VIEW_MODES = {
  product: 'default',
  category: 'grid',
  cart: 'emptyCart',
  header: 'desktop',
  checkout: 'default',
  success: 'empty',
  account: 'overview',
  login: 'login',
  homepage: 'default'
};

// Viewport modes for responsive editing
export const VIEWPORT_MODES = {
  DESKTOP: 'desktop',
  TABLET: 'tablet',
  MOBILE: 'mobile'
};

// AI command operations
export const AI_OPERATIONS = {
  ADD: 'add',
  MODIFY: 'modify',
  REMOVE: 'remove',
  MOVE: 'move',
  RESIZE: 'resize',
  REORDER: 'reorder'
};

export const AIWorkspaceProvider = ({ children }) => {
  const location = useLocation();
  const { getSelectedStoreId } = useStoreSelection();
  const draftsProvisionedRef = useRef(false);

  // Page/Editor State
  const [selectedPageType, setSelectedPageType] = useState(PAGE_TYPES.PRODUCT);
  const [editorMode, setEditorMode] = useState(false);
  const [viewportMode, setViewportMode] = useState(VIEWPORT_MODES.DESKTOP);
  const [viewMode, setViewMode] = useState(DEFAULT_VIEW_MODES.product);

  // Configuration State
  const [currentConfiguration, setCurrentConfiguration] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // AI Integration State
  const [aiCommandQueue, setAiCommandQueue] = useState([]);
  const [lastAiOperation, setLastAiOperation] = useState(null);
  const [aiPanelCollapsed, setAiPanelCollapsed] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [isProcessingAi, setIsProcessingAi] = useState(false);

  // Plugin editing state
  const [pluginToEdit, setPluginToEdit] = useState(null);
  const [showPluginEditor, setShowPluginEditor] = useState(false);

  // AI Studio state (ChatInterface for creating plugins)
  const [showAiStudio, setShowAiStudio] = useState(false);

  // Chat panel minimize/maximize state (for plugin editor mode)
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatMaximized, setChatMaximized] = useState(false);

  // Slot handlers (registered by editor components)
  const [slotHandlers, setSlotHandlers] = useState(null);

  // Editor type toggle (legacy vs new stable editor)
  // Default to false to use the legacy editors with full component rendering
  const [useStableEditor, setUseStableEditor] = useState(false);

  // Publish status refresh callback (registered by WorkspaceHeader)
  const [onPublishStatusRefresh, setOnPublishStatusRefresh] = useState(null);

  // Configuration refresh trigger (increments to signal editors to reload)
  const [configurationRefreshTrigger, setConfigurationRefreshTrigger] = useState(0);

  // Preview refresh trigger (increments to signal storefront preview to reload)
  const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(0);

  // Editor sidebar visibility (shared between UnifiedSlotsEditor and WorkspaceHeader)
  const [editorSidebarVisible, setEditorSidebarVisible] = useState(false);

  // Selected item slug (for category/product pages opened via Edit button)
  const [selectedItemSlug, setSelectedItemSlug] = useState(null);

  // Read URL params on mount to handle Edit button navigation
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pageParam = params.get('page');
    const itemParam = params.get('item');
    const editParam = params.get('edit');

    if (pageParam && PAGE_TYPES[pageParam.toUpperCase()]) {
      setSelectedPageType(PAGE_TYPES[pageParam.toUpperCase()]);
      setViewMode(DEFAULT_VIEW_MODES[pageParam] || 'default');
    }

    if (itemParam) {
      setSelectedItemSlug(itemParam);
    }

    if (editParam === 'true') {
      setEditorMode(true);
    }
  }, []); // Only run on mount

  // Provision all slot configuration drafts when entering AI Workspace
  useEffect(() => {
    const provisionDrafts = async () => {
      const storeId = getSelectedStoreId();
      if (!storeId || draftsProvisionedRef.current) return;

      draftsProvisionedRef.current = true;

      // Provision drafts for all page types in parallel
      const pageTypes = ['product', 'category', 'cart', 'checkout', 'success'];
      try {
        await Promise.all(
          pageTypes.map(pageType =>
            slotConfigurationService.getDraftConfiguration(storeId, pageType)
              .catch(err => console.warn(`[AIWorkspace] Failed to provision ${pageType} draft:`, err))
          )
        );
      } catch (error) {
      }
    };

    provisionDrafts();
  }, [getSelectedStoreId]);

  // Check for plugin passed via location state (from Plugins page Edit button)
  useEffect(() => {
    if (location.state?.plugin) {
      setPluginToEdit(location.state.plugin);
      setShowPluginEditor(true);
      // Clear the state to prevent re-opening on navigation
      window.history.replaceState({}, document.title);
    }
    // Handle new plugin creation (from Plugins page Create with AI button)
    if (location.state?.newPlugin) {
      setPluginToEdit({
        ...location.state.newPlugin,
        isNew: true // Flag to indicate this is a new plugin
      });
      setShowPluginEditor(true);
      // Clear the state to prevent re-opening on navigation
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /**
   * Select a page type and update view mode accordingly
   */
  const selectPage = useCallback((pageType) => {
    setSelectedPageType(pageType);
    setViewMode(DEFAULT_VIEW_MODES[pageType] || 'default');
    setSelectedSlotId(null);
  }, []);

  /**
   * Toggle editor mode on/off
   */
  const toggleEditorMode = useCallback(() => {
    setEditorMode(prev => !prev);
    if (editorMode) {
      // Exiting editor mode - clear selection
      setSelectedSlotId(null);
    }
  }, [editorMode]);

  /**
   * Apply an AI-generated slot change
   * @param {object} updatedSlots - The updated slots object after applying the command
   * @param {object} command - The original command that was executed
   */
  const applyAiSlotChange = useCallback((updatedSlots, command) => {
    // Store the command for undo
    setLastAiOperation({ command, previousSlots: currentConfiguration?.slots });
    setAiCommandQueue(prev => [...prev, command]);

    // Update the configuration with the new slots
    setCurrentConfiguration(prev => ({
      ...prev,
      slots: updatedSlots
    }));
    setHasUnsavedChanges(true);
  }, [currentConfiguration]);

  /**
   * Register slot handlers from editor component
   * These handlers are used by AI to manipulate slots
   */
  const registerSlotHandlers = useCallback((handlers) => {
    setSlotHandlers(handlers);
  }, []);

  /**
   * Clear the AI command queue after processing
   */
  const clearAiCommandQueue = useCallback(() => {
    setAiCommandQueue([]);
  }, []);

  /**
   * Undo the last AI operation
   */
  const undoLastAiOperation = useCallback(() => {
    if (lastAiOperation?.previousSlots) {
      // Restore the previous slots
      setCurrentConfiguration(prev => ({
        ...prev,
        slots: lastAiOperation.previousSlots
      }));
      setLastAiOperation(null);
      return true;
    }
    return false;
  }, [lastAiOperation]);

  /**
   * Update configuration (called by editor)
   */
  const updateConfiguration = useCallback((config) => {
    setCurrentConfiguration(config);
    setHasUnsavedChanges(true);
  }, []);

  /**
   * Mark configuration as saved
   */
  const markAsSaved = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  /**
   * Toggle AI panel collapsed state
   */
  const toggleAiPanel = useCallback(() => {
    setAiPanelCollapsed(prev => !prev);
  }, []);

  /**
   * Add a chat message
   */
  const addChatMessage = useCallback((message) => {
    setChatMessages(prev => [...prev, {
      ...message,
      id: Date.now(),
      timestamp: new Date().toISOString()
    }]);
  }, []);

  /**
   * Clear chat history (both local state and backend)
   */
  const clearChatHistory = useCallback(async () => {
    setChatMessages([]);
    const storeId = getSelectedStoreId();
    if (storeId) {
      try {
        await apiClient.delete('/ai/chat/history', {
          params: { store_id: storeId }
        });
      } catch (error) {
        console.error('[AIWorkspace] Failed to clear chat history:', error);
      }
    }
  }, [getSelectedStoreId]);

  /**
   * Open plugin for editing
   */
  const openPluginEditor = useCallback((plugin) => {
    setPluginToEdit(plugin);
    setShowPluginEditor(true);
  }, []);

  /**
   * Close plugin editor
   */
  const closePluginEditor = useCallback(() => {
    setPluginToEdit(null);
    setShowPluginEditor(false);
  }, []);

  /**
   * Open AI Studio mode
   */
  const openAiStudio = useCallback(() => {
    setShowAiStudio(true);
    setShowPluginEditor(false);
    setEditorMode(false);
  }, []);

  /**
   * Close AI Studio mode
   */
  const closeAiStudio = useCallback(() => {
    setShowAiStudio(false);
  }, []);

  /**
   * Toggle chat panel minimized state
   */
  const toggleChatMinimized = useCallback(() => {
    setChatMinimized(prev => !prev);
    // If minimizing, also un-maximize
    if (!chatMinimized) {
      setChatMaximized(false);
    }
  }, [chatMinimized]);

  /**
   * Toggle chat panel maximized state
   */
  const toggleChatMaximized = useCallback(() => {
    setChatMaximized(prev => !prev);
    // If maximizing, also un-minimize
    if (!chatMaximized) {
      setChatMinimized(false);
    }
  }, [chatMaximized]);

  /**
   * Register publish status refresh callback (called by WorkspaceHeader)
   */
  const registerPublishStatusRefresh = useCallback((callback) => {
    setOnPublishStatusRefresh(() => callback);
  }, []);

  /**
   * Trigger publish status refresh (called after saves)
   */
  const triggerPublishStatusRefresh = useCallback(() => {
    if (onPublishStatusRefresh) {
      onPublishStatusRefresh();
    }
  }, [onPublishStatusRefresh]);

  /**
   * Trigger configuration refresh (called after revert to reload editor content)
   */
  const triggerConfigurationRefresh = useCallback(() => {
    setConfigurationRefreshTrigger(prev => prev + 1);
  }, []);

  /**
   * Trigger preview refresh (called after AI styling changes to reload storefront preview)
   */
  const refreshPreview = useCallback(() => {
    setPreviewRefreshTrigger(prev => prev + 1);
  }, []);

  // Memoized value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // Page/Editor State
    selectedPageType,
    editorMode,
    viewportMode,
    viewMode,
    selectedItemSlug,
    setSelectedItemSlug,
    setViewportMode,
    setViewMode,

    // Configuration State
    currentConfiguration,
    hasUnsavedChanges,
    selectedSlotId,
    isLoading,
    setSelectedSlotId,
    setIsLoading,

    // AI Integration
    aiCommandQueue,
    lastAiOperation,
    aiPanelCollapsed,
    chatMessages,
    isProcessingAi,
    setIsProcessingAi,
    slotHandlers,
    useStableEditor,
    setUseStableEditor,

    // Editor sidebar visibility
    editorSidebarVisible,
    setEditorSidebarVisible,

    // Plugin Editing
    pluginToEdit,
    showPluginEditor,
    openPluginEditor,
    closePluginEditor,

    // AI Studio
    showAiStudio,
    openAiStudio,
    closeAiStudio,

    // Chat panel minimize/maximize
    chatMinimized,
    toggleChatMinimized,
    chatMaximized,
    toggleChatMaximized,

    // Actions
    selectPage,
    toggleEditorMode,
    applyAiSlotChange,
    clearAiCommandQueue,
    undoLastAiOperation,
    updateConfiguration,
    markAsSaved,
    toggleAiPanel,
    addChatMessage,
    clearChatHistory,
    registerSlotHandlers,
    registerPublishStatusRefresh,
    triggerPublishStatusRefresh,
    configurationRefreshTrigger,
    triggerConfigurationRefresh,
    previewRefreshTrigger,
    refreshPreview,

    // Constants
    pageTypes: PAGE_TYPES,
    viewportModes: VIEWPORT_MODES,
    defaultViewModes: DEFAULT_VIEW_MODES,
    aiOperations: AI_OPERATIONS
  }), [
    selectedPageType,
    editorMode,
    viewportMode,
    viewMode,
    selectedItemSlug,
    currentConfiguration,
    hasUnsavedChanges,
    selectedSlotId,
    isLoading,
    aiCommandQueue,
    lastAiOperation,
    aiPanelCollapsed,
    chatMessages,
    isProcessingAi,
    slotHandlers,
    useStableEditor,
    editorSidebarVisible,
    pluginToEdit,
    showPluginEditor,
    selectPage,
    toggleEditorMode,
    applyAiSlotChange,
    clearAiCommandQueue,
    undoLastAiOperation,
    updateConfiguration,
    markAsSaved,
    toggleAiPanel,
    addChatMessage,
    clearChatHistory,
    registerSlotHandlers,
    openPluginEditor,
    closePluginEditor,
    showAiStudio,
    openAiStudio,
    closeAiStudio,
    chatMinimized,
    toggleChatMinimized,
    chatMaximized,
    toggleChatMaximized,
    registerPublishStatusRefresh,
    triggerPublishStatusRefresh,
    configurationRefreshTrigger,
    triggerConfigurationRefresh,
    previewRefreshTrigger,
    refreshPreview
  ]);

  return (
    <AIWorkspaceContext.Provider value={value}>
      {children}
    </AIWorkspaceContext.Provider>
  );
};

/**
 * Hook to access AI Workspace context
 */
export const useAIWorkspace = () => {
  const context = useContext(AIWorkspaceContext);
  if (!context) {
    throw new Error('useAIWorkspace must be used within AIWorkspaceProvider');
  }
  return context;
};

export default AIWorkspaceContext;
