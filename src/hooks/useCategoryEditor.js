import { useState, useEffect, useRef, useMemo } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import {
  useSlotConfiguration,
  useTimestampFormatting,
  useDraftStatusManagement,
  useConfigurationChangeDetection,
  useBadgeRefresh,
  useClickOutsidePanel,
  usePreviewModeHandlers,
  usePublishPanelHandlers,
  useConfigurationInitialization,
  usePublishHandler,
  useResetLayoutHandler,
  useSaveConfigurationHandler,
  usePublishPanelHandlerWrappers,
  useEditorInitialization,
  useViewModeAdjustments
} from '@/hooks/useSlotConfiguration';
// Slot configurations come from database - no static config import
import { generateMockCategoryContext } from '@/utils/mockCategoryData';
import slotConfigurationService from '@/services/slotConfigurationService';

export const useCategoryEditor = ({ mode, onSave, viewMode: propViewMode }) => {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();

  // Initialize with minimal defaults - actual config comes from database
  const [categoryLayoutConfig, setCategoryLayoutConfig] = useState({
    page_name: 'Category',
    slot_type: 'category_layout',
    slots: {},
    metadata: {
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: '1.0',
      pageType: 'category'
    },
    cmsBlocks: [],
    views: [{ id: 'grid', label: 'Grid' }, { id: 'list', label: 'List' }],
    microslots: {}
  });

  // Editor state
  const [viewMode, setViewMode] = useState(propViewMode);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showSlotBorders, setShowSlotBorders] = useState(true);
  const [localSaveStatus, setLocalSaveStatus] = useState('');
  const [currentViewport, setCurrentViewport] = useState('desktop');
  const [isResizing, setIsResizing] = useState(false);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showFilePickerModal, setShowFilePickerModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentDragInfo, setCurrentDragInfo] = useState(null);

  // Refs
  const isDragOperationActiveRef = useRef(false);
  const lastResizeEndTime = useRef(0);
  const saveTimeoutRef = useRef(null);
  const publishPanelRef = useRef(null);

  // Mock context for preview
  const mockCategoryContext = useMemo(() => generateMockCategoryContext(), []);

  // Draft status management
  const { formatTimeAgo } = useTimestampFormatting();
  const {
    draftConfig, setDraftConfig,
    latestPublished, setLatestPublished,
    setConfigurationStatus,
    hasUnsavedChanges, setHasUnsavedChanges,
    loadDraftStatus
  } = useDraftStatusManagement(getSelectedStoreId(), 'category');

  // Main slot configuration hook
  const {
    handleResetLayout: resetLayoutFromHook,
    handlePublishConfiguration,
    getDraftConfiguration,
    createSlot,
    handleSlotDrop: slotDropHandler,
    handleSlotDelete: slotDeleteHandler,
    handleGridResize: gridResizeHandler,
    handleSlotHeightResize: slotHeightResizeHandler,
    handleTextChange: textChangeHandler,
    handleClassChange: classChangeHandler,
    createElementClickHandler,
    createSaveConfigurationHandler,
    createHandlerFactory
  } = useSlotConfiguration({
    pageType: 'category',
    pageName: 'Category',
    slotType: 'category_layout',
    selectedStore,
    updateConfiguration: async (config) => {
      const storeId = getSelectedStoreId();
      if (storeId) {
        await slotConfigurationService.saveConfiguration(storeId, config, 'category_layout');
      }
    },
    onSave
  });

  // Configuration initialization - no static fallback, config comes from DB
  const { initializeConfig, configurationLoadedRef } = useConfigurationInitialization(
    'category', 'Category', 'category_layout', getSelectedStoreId, getDraftConfiguration, loadDraftStatus, null
  );

  // Editor initialization
  useEditorInitialization(initializeConfig, setCategoryLayoutConfig);

  // Configuration change detection
  const { updateLastSavedConfig } = useConfigurationChangeDetection(
    configurationLoadedRef, categoryLayoutConfig, setHasUnsavedChanges
  );

  // Badge refresh
  useBadgeRefresh(configurationLoadedRef, hasUnsavedChanges, 'category');

  // Save configuration
  const baseSaveConfiguration = createSaveConfigurationHandler(
    categoryLayoutConfig,
    setCategoryLayoutConfig,
    setLocalSaveStatus,
    getSelectedStoreId,
    'category'
  );

  const { saveConfiguration } = useSaveConfigurationHandler(
    'category',
    baseSaveConfiguration,
    categoryLayoutConfig,
    {
      setConfigurationStatus,
      updateLastSavedConfig
    }
  );

  // Handler factory
  const handlerFactory = createHandlerFactory(setCategoryLayoutConfig, saveConfiguration);

  // Element click handler
  const handleElementClick = createElementClickHandler(
    isResizing,
    lastResizeEndTime,
    setSelectedElement,
    setIsSidebarVisible
  );

  // Generate view mode adjustment rules from loaded config
  const categoryAdjustmentRules = useMemo(() => {
    if (!categoryLayoutConfig?.slots) return {};

    return Object.keys(categoryLayoutConfig.slots).reduce((rules, slotId) => {
      const slotConfig = categoryLayoutConfig.slots[slotId];
      const slotName = slotId.replace(/_container$/, '').replace(/_/g, '');

      if (slotConfig?.colSpan && typeof slotConfig.colSpan === 'object') {
        rules[slotName] = {
          colSpan: {
            shouldAdjust: (currentValue) => typeof currentValue === 'number',
            newValue: slotConfig.colSpan
          }
        };
      }

      return rules;
    }, {});
  }, [categoryLayoutConfig?.slots]);

  // View mode adjustments
  useViewModeAdjustments(categoryLayoutConfig, setCategoryLayoutConfig, viewMode, categoryAdjustmentRules);

  // Product mirroring function
  const mirrorProductChanges = (slotId, updatedConfig) => {
    const productMatch = slotId.match(/^product_(\d+)_(.+)$/);
    if (!productMatch) return updatedConfig;

    const [, productNumber, elementType] = productMatch;
    const updatedSlot = updatedConfig.slots[slotId];
    const newConfig = { ...updatedConfig };

    Object.keys(newConfig.slots).forEach(otherSlotId => {
      const otherProductMatch = otherSlotId.match(/^product_(\d+)_(.+)$/);
      if (otherProductMatch && otherProductMatch[2] === elementType && otherProductMatch[1] !== productNumber) {
        newConfig.slots[otherSlotId] = {
          ...newConfig.slots[otherSlotId],
          className: updatedSlot.className,
          styles: updatedSlot.styles,
          colSpan: updatedSlot.colSpan,
          viewMode: updatedSlot.viewMode,
          content: newConfig.slots[otherSlotId].content,
          parentId: newConfig.slots[otherSlotId].parentId,
          id: otherSlotId
        };
      }
    });

    return newConfig;
  };

  // Slot drop handler with mirroring
  const handleSlotDropWithMirroring = (dropResult) => {
    const result = handlerFactory.createSlotDropHandler(slotDropHandler, isDragOperationActiveRef)(dropResult);
    if (dropResult.slotId) {
      setCategoryLayoutConfig(prevConfig => mirrorProductChanges(dropResult.slotId, prevConfig));
    }
    return result;
  };

  // Create all handlers
  const handlers = {
    handleTextChange: handlerFactory.createTextChangeHandler(textChangeHandler),
    handleClassChange: handlerFactory.createClassChangeHandler(classChangeHandler),
    handleGridResize: handlerFactory.createGridResizeHandler(gridResizeHandler, saveTimeoutRef),
    handleSlotHeightResize: handlerFactory.createSlotHeightResizeHandler(slotHeightResizeHandler, saveTimeoutRef),
    handleSlotDrop: handleSlotDropWithMirroring,
    handleSlotDelete: handlerFactory.createSlotDeleteHandler(slotDeleteHandler),
    handleCreateSlot: handlerFactory.createSlotCreateHandler(createSlot)
  };

  // Reset layout handler - no static fallback, reset fetches from DB
  const baseHandleResetLayout = handlerFactory.createResetLayoutHandler(resetLayoutFromHook, setLocalSaveStatus);
  const { handleResetLayout } = useResetLayoutHandler(
    'category',
    baseHandleResetLayout,
    categoryLayoutConfig,
    {
      setHasUnsavedChanges,
      setConfigurationStatus,
      updateLastSavedConfig
    },
    null
  );

  // Publish handler
  const { handlePublish, publishStatus } = usePublishHandler(
    'category',
    categoryLayoutConfig,
    handlePublishConfiguration,
    {
      setIsSidebarVisible,
      setSelectedElement,
      setHasUnsavedChanges,
      setConfigurationStatus,
      updateLastSavedConfig
    }
  );

  // Click outside and preview handlers
  useClickOutsidePanel(showPublishPanel, publishPanelRef, setShowPublishPanel);
  usePreviewModeHandlers(showPreview, setIsSidebarVisible, setSelectedElement, setShowPublishPanel);

  // Publish panel handlers
  const basePublishPanelHandlers = usePublishPanelHandlers(
    'category', getSelectedStoreId, getDraftConfiguration, setCategoryLayoutConfig, slotConfigurationService
  );

  const { handlePublishPanelPublished, handlePublishPanelReverted } = usePublishPanelHandlerWrappers(
    'category',
    basePublishPanelHandlers,
    {
      setIsSidebarVisible,
      setSelectedElement,
      setDraftConfig,
      setConfigurationStatus,
      setHasUnsavedChanges,
      setLatestPublished,
      setPageConfig: setCategoryLayoutConfig,
      updateLastSavedConfig
    }
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    const timeoutId = saveTimeoutRef.current;
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return {
    // State
    categoryLayoutConfig,
    setCategoryLayoutConfig,
    viewMode,
    setViewMode,
    selectedElement,
    setSelectedElement,
    isSidebarVisible,
    setIsSidebarVisible,
    showSlotBorders,
    setShowSlotBorders,
    localSaveStatus,
    currentViewport,
    setCurrentViewport,
    isResizing,
    setIsResizing,
    showAddSlotModal,
    setShowAddSlotModal,
    showFilePickerModal,
    setShowFilePickerModal,
    showResetModal,
    setShowResetModal,
    showCodeModal,
    setShowCodeModal,
    showPublishPanel,
    setShowPublishPanel,
    showPreview,
    setShowPreview,
    currentDragInfo,
    setCurrentDragInfo,

    // Refs
    isDragOperationActiveRef,
    lastResizeEndTime,
    saveTimeoutRef,
    publishPanelRef,

    // Data
    mockCategoryContext,
    draftConfig,
    latestPublished,
    hasUnsavedChanges,
    publishStatus,
    formatTimeAgo,
    getSelectedStoreId,

    // Handlers
    ...handlers,
    handleElementClick,
    handleResetLayout,
    handlePublish,
    handlePublishPanelPublished,
    handlePublishPanelReverted,
    saveConfiguration,

    // Computed
    canPublish: hasUnsavedChanges
  };
};