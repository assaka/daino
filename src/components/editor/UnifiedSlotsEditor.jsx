/**
 * UnifiedSlotsEditor - Unified editor component for all slot-based pages
 *
 * Features:
 * - Common editor functionality for Product, Cart, and Category pages
 * - Consistent UI patterns and behavior
 * - Extensible through configuration objects
 *
 * Design Philosophy:
 * - Single source of truth for editor logic
 * - Page-specific behavior through configuration
 */

import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import EditorSidebar from "@/components/editor/slot/EditorSidebar";
import PublishPanel from "@/components/editor/slot/PublishPanel";
import CmsBlockRenderer from '@/components/storefront/CmsBlockRenderer';
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';
import { formatPrice } from '@/utils/priceUtils';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import AIWorkspaceContext from '@/contexts/AIWorkspaceContext';
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
import {
  HierarchicalSlotRenderer,
  EditorToolbar,
  AddSlotModal,
  WidgetSelectorModal,
  ResetLayoutModal,
  FilePickerModalWrapper,
  EditModeControls,
  CodeModal,
  TimestampsRow,
  ResponsiveContainer
} from '@/components/editor/slot/SlotComponents';
import { ResponsiveIframe } from '@/components/editor/ResponsiveIframe';
import { UnifiedSlotRenderer } from '@/components/editor/slot/UnifiedSlotRenderer';
import { HeaderSlotRenderer } from '@/components/storefront/HeaderSlotRenderer';
import '@/components/editor/slot/UnifiedSlotComponents'; // Register unified components
import '@/components/editor/slot/AccountLoginSlotComponents'; // Register account/login components
import '@/components/editor/slot/CheckoutSlotComponents'; // Register checkout components
import '@/components/editor/slot/SuccessSlotComponents'; // Register success/order confirmation components
import slotConfigurationService from '@/services/slotConfigurationService';

/**
 * UnifiedSlotsEditor - Core editor component
 *
 * @param {Object} config - Editor configuration object
 * @param {string} config.pageType - Type of page (product, cart, category)
 * @param {string} config.pageName - Display name for the page
 * @param {string} config.slotType - Type of slot configuration
 * @param {string} config.defaultViewMode - Default view mode
 * @param {Array} config.viewModes - Available view modes
 * @param {Object} config.slotComponents - Page-specific slot components
 * @param {Function} config.generateContext - Function to generate page context
 * @param {Function} config.createDefaultSlots - Function to create default slots
 * @param {Object} config.viewModeAdjustments - View mode specific adjustments
 * @param {Function} config.customSlotRenderer - Custom slot rendering logic
 * @param {Array} config.cmsBlockPositions - CMS block positions for the page
 */
// Feature flag: Set to true to use new EditOverlay system instead of GridColumn wrapper
// Use traditional GridColumn wrapper with blue resize handles
// EditOverlay was experimental but had issues with resize handles visibility
const USE_EDIT_OVERLAY = false;

const UnifiedSlotsEditor = ({
  config,
  mode = 'edit',
  onSave,
  viewMode: propViewMode
}) => {
  // Extract configuration
  const {
    pageType,
    pageName,
    slotType,
    defaultViewMode,
    viewModes,
    slotComponents,
    generateContext,
    createDefaultSlots,
    viewModeAdjustments,
    customSlotRenderer,
    cmsBlockPositions = [],
    // Category/Product selectors
    availableCategories,
    selectedCategorySlug,
    onCategoryChange,
    availableProducts,
    selectedProductSlug,
    onProductChange,
    isLoadingCategoryData,
    isLoadingProductData,
    // Header integration
    includeHeader,
    headerSlots,
    headerContext,
    onHeaderSlotChange
  } = config;

  // Store context for database operations
  const { selectedStore, getSelectedStoreId } = useStoreSelection();

  // Get configuration refresh trigger from AIWorkspace context (if available)
  // This triggers a reload when user reverts to a previous version
  const aiWorkspaceContext = useContext(AIWorkspaceContext);
  const configurationRefreshTrigger = aiWorkspaceContext?.configurationRefreshTrigger || 0;

  const [currentDragInfo, setCurrentDragInfo] = useState(null);

  // State management - Initialize with empty config
  const [layoutConfig, setLayoutConfig] = useState({
    page_name: pageName,
    slot_type: slotType,
    slots: {},
    metadata: {
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: '1.0',
      pageType: pageType
    },
    cmsBlocks: []
  });

  // Basic editor state
  const isDragOperationActiveRef = useRef(false);
  const publishPanelRef = useRef(null);
  const lastResizeEndTime = useRef(0);
  const [viewMode, setViewMode] = useState(propViewMode || defaultViewMode);
  const [selectedElement, setSelectedElement] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [showSlotBorders, setShowSlotBorders] = useState(false); // Disabled - borders cause visual differences with storefront
  const [localSaveStatus, setLocalSaveStatus] = useState('');
  const [currentViewport, setCurrentViewport] = useState('desktop');
  const [isResizing, setIsResizing] = useState(false);
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [showWidgetSelectorModal, setShowWidgetSelectorModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Page context state
  const [pageContext, setPageContext] = useState(null);

  // Generate page context
  // Also re-generate when config changes (which happens when real data loads)
  useEffect(() => {
    if (generateContext) {
      const context = generateContext(viewMode, selectedStore);
      setPageContext(context);
    }
  }, [generateContext, viewMode, selectedStore, config]);

  // Use extracted hooks
  const { formatTimeAgo } = useTimestampFormatting();
  const {
    draftConfig, setDraftConfig,
    latestPublished, setLatestPublished,
    setConfigurationStatus,
    hasUnsavedChanges, setHasUnsavedChanges,
    loadDraftStatus
  } = useDraftStatusManagement(getSelectedStoreId(), pageType);

  // Database configuration hook
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
    pageType,
    pageName,
    slotType,
    selectedStore,
    updateConfiguration: async (config) => {
      const storeId = getSelectedStoreId();
      if (storeId) {
        await slotConfigurationService.saveConfiguration(storeId, config, slotType);
      }
    },
    onSave
  });

  // Configuration initialization hook
  const { initializeConfig, configurationLoadedRef } = useConfigurationInitialization(
    pageType, pageName, slotType, getSelectedStoreId, getDraftConfiguration, loadDraftStatus
  );

  // Use generic editor initialization with createDefaultSlots if provided
  useEditorInitialization(initializeConfig, setLayoutConfig, createDefaultSlots);

  // Reload configuration when triggered (e.g., after revert to previous version)
  useEffect(() => {
    if (configurationRefreshTrigger > 0) {
      // Reset the loaded flag so initializeConfig will run
      configurationLoadedRef.current = false;
      // Re-initialize configuration
      initializeConfig().then(config => {
        if (config) {
          setLayoutConfig(config);
          loadDraftStatus();
        }
      });
    }
  }, [configurationRefreshTrigger, initializeConfig, loadDraftStatus, setLayoutConfig]);

  // Configuration change detection
  const { updateLastSavedConfig } = useConfigurationChangeDetection(
    configurationLoadedRef, layoutConfig, setHasUnsavedChanges
  );

  // Badge refresh
  useBadgeRefresh(configurationLoadedRef, hasUnsavedChanges, pageType);

  // Save configuration using the generic factory
  const baseSaveConfiguration = createSaveConfigurationHandler(
    layoutConfig,
    setLayoutConfig,
    setLocalSaveStatus,
    getSelectedStoreId,
    pageType
  );

  // Use generic save configuration handler
  const { saveConfiguration } = useSaveConfigurationHandler(
    pageType,
    baseSaveConfiguration,
    layoutConfig,
    {
      setConfigurationStatus,
      updateLastSavedConfig
    }
  );

  // Click outside and preview mode handlers
  useClickOutsidePanel(showPublishPanel, publishPanelRef, setShowPublishPanel);
  usePreviewModeHandlers(showPreview, setIsSidebarVisible, setSelectedElement, setShowPublishPanel);

  // Publish panel handlers
  const basePublishPanelHandlers = usePublishPanelHandlers(
    pageType, getSelectedStoreId, getDraftConfiguration, setLayoutConfig, slotConfigurationService
  );

  // Use generic publish panel handler wrappers
  const { handlePublishPanelPublished, handlePublishPanelReverted } = usePublishPanelHandlerWrappers(
    pageType,
    basePublishPanelHandlers,
    {
      setIsSidebarVisible,
      setSelectedElement,
      setDraftConfig,
      setConfigurationStatus,
      setHasUnsavedChanges,
      setLatestPublished,
      setPageConfig: setLayoutConfig,
      updateLastSavedConfig
    }
  );

  // Handle element selection using generic factory (kept for backward compatibility)
  const handleElementClick = createElementClickHandler(
    isResizing,
    lastResizeEndTime,
    setSelectedElement,
    setIsSidebarVisible
  );

  // Create handler factory with page-specific dependencies
  const handlerFactory = createHandlerFactory(setLayoutConfig, saveConfiguration);

  // Create all handlers using the factory
  const handleTextChange = handlerFactory.createTextChangeHandler(textChangeHandler);
  const handleClassChange = handlerFactory.createClassChangeHandler(classChangeHandler);

  // Debounced save ref
  const saveTimeoutRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Create all handlers using the factory
  const handleGridResize = handlerFactory.createGridResizeHandler(gridResizeHandler, saveTimeoutRef);
  const handleSlotHeightResize = handlerFactory.createSlotHeightResizeHandler(slotHeightResizeHandler, saveTimeoutRef);
  const handleSlotDrop = handlerFactory.createSlotDropHandler(slotDropHandler, isDragOperationActiveRef);
  const handleSlotDelete = handlerFactory.createSlotDeleteHandler(slotDeleteHandler);
  const baseHandleResetLayout = handlerFactory.createResetLayoutHandler(resetLayoutFromHook, setLocalSaveStatus);

  // Use generic reset layout handler
  const { handleResetLayout } = useResetLayoutHandler(
    pageType,
    baseHandleResetLayout,
    layoutConfig,
    {
      setHasUnsavedChanges,
      setConfigurationStatus,
      updateLastSavedConfig
    }
  );

  const handleCreateSlot = handlerFactory.createSlotCreateHandler(createSlot);

  // Use generic publish handler
  const { handlePublish, publishStatus } = usePublishHandler(
    pageType,
    layoutConfig,
    handlePublishConfiguration,
    {
      setIsSidebarVisible,
      setSelectedElement,
      setHasUnsavedChanges,
      setConfigurationStatus,
      updateLastSavedConfig
    }
  );

  // Use generic view mode adjustments (always call hook, pass null if not provided)
  useViewModeAdjustments(layoutConfig, setLayoutConfig, viewMode, viewModeAdjustments || null);

  // Clear selection handler
  const handleClearSelection = useCallback(() => {
    setSelectedElement(null);
    setIsSidebarVisible(false);
  }, []);

  // Render view mode tabs
  const renderViewModeTabs = () => {
    if (!viewModes || viewModes.length <= 1) return null;

    return (
      <div className="flex bg-gray-100 rounded-lg p-1">
        {viewModes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setViewMode(mode.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              viewMode === mode.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <mode.icon className="w-4 h-4 inline mr-1.5" />
            {mode.label}
          </button>
        ))}
      </div>
    );
  };

  // Show loading state if page context is required but not loaded
  if (generateContext && !pageContext) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-gray-600">Loading {pageName.toLowerCase()} editor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-gray-50 ${
      isSidebarVisible ? 'pr-80' : ''
    }`}>
      {/* Main Editor Area */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Editor Header */}
        <div className="bg-white border-b px-6 py-1 h-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-between gap-4">
              {/* View Mode Tabs */}
              {renderViewModeTabs()}

              {/* Edit mode controls */}
              {mode === 'edit' && (
                <EditModeControls
                  localSaveStatus={localSaveStatus}
                  publishStatus={publishStatus}
                  saveConfiguration={saveConfiguration}
                  onPublish={handlePublish}
                  hasChanges={hasUnsavedChanges}
                />
              )}
            </div>

            {/* Preview and Publish Buttons - Far Right */}
            <div className="flex items-center gap-2 ml-4">
              <Button
                onClick={() => setShowPreview(!showPreview)}
                variant={showPreview ? "default" : "outline"}
                size="sm"
                className="flex items-center gap-1.5"
                title={showPreview ? "Exit Preview" : "Preview without editing tools"}
              >
                <Eye className="w-4 h-4" />
                {showPreview ? "Exit Preview" : "Preview"}
              </Button>

            </div>
          </div>
        </div>

        {/* Page Layout - Hierarchical Structure */}
        <div
          className={`bg-gray-50 ${pageType}-page overflow-y-auto flex-1`}
          style={{ backgroundColor: '#f9fafb' }}
        >
          {/* Timestamps Row - Hidden */}
          {/* <TimestampsRow
            draftConfig={draftConfig}
            latestPublished={latestPublished}
            formatTimeAgo={formatTimeAgo}
          /> */}

          {!showPreview && (
            <EditorToolbar
              onResetLayout={() => setShowResetModal(true)}
              onShowCode={() => setShowCodeModal(true)}
              onAddSlot={() => setShowAddSlotModal(true)}
              currentViewport={currentViewport}
              onViewportChange={setCurrentViewport}
            />
          )}

          <ResponsiveIframe
            viewport={currentViewport}
            className="bg-white"
          >
            {/* Header Section - Temporarily disabled for debugging */}
            {/* TODO: Re-enable once null pointer issue is resolved */}

            <div className="px-4 sm:px-6 lg:px-8 pb-12">
              {/* Flash Messages Area */}
              <div id="flash-messages-area"></div>

              {/* CMS Blocks Above */}
              {cmsBlockPositions.map(position =>
                position.includes('above') && (
                  <CmsBlockRenderer key={position} position={position} />
                )
              )}

              {/* Page Content Label */}
              {includeHeader && (
                <div className="bg-green-50 px-2 py-1 text-xs text-green-600 font-medium mb-2 -mx-4 sm:-mx-6 lg:-mx-8">
                  Page Content ({pageName})
                </div>
              )}

              {/* Main Grid Layout */}
              <div className="grid grid-cols-12 gap-2 auto-rows-min">
                {layoutConfig && layoutConfig.slots && Object.keys(layoutConfig.slots).length > 0 ? (
                  <UnifiedSlotRenderer
                    slots={layoutConfig.slots}
                    parentId={null}
                    viewMode={viewMode}
                    viewportMode={currentViewport}
                    context="editor"
                    productData={pageType === 'product' ? pageContext : {}}
                    categoryData={pageType === 'category' ? pageContext : null}
                    cartData={pageType === 'cart' ? pageContext : null}
                    headerContext={pageType === 'header' ? pageContext : null}
                    loginData={pageType === 'login' ? pageContext : null}
                    // Pass preprocessedData for all page types - same as storefront
                    preprocessedData={pageContext || null}
                    slotConfig={config}
                    mode={showPreview ? 'view' : mode}
                    showBorders={showPreview ? false : showSlotBorders}
                    currentDragInfo={currentDragInfo}
                    setCurrentDragInfo={setCurrentDragInfo}
                    onElementClick={showPreview ? null : handleElementClick}
                    onGridResize={showPreview ? null : handleGridResize}
                    onSlotHeightResize={showPreview ? null : handleSlotHeightResize}
                    onSlotDrop={showPreview ? null : handleSlotDrop}
                    onSlotDelete={showPreview ? null : handleSlotDelete}
                    onResizeStart={showPreview ? null : () => setIsResizing(true)}
                    onResizeEnd={showPreview ? null : () => {
                      lastResizeEndTime.current = Date.now();
                      setTimeout(() => setIsResizing(false), 100);
                    }}
                    selectedElementId={showPreview ? null : (selectedElement ? selectedElement.getAttribute('data-slot-id') : null)}
                    setPageConfig={setLayoutConfig}
                    saveConfiguration={saveConfiguration}
                    useOverlay={USE_EDIT_OVERLAY}
                  />
                ) : (
                  <div className="col-span-12 text-center py-12 text-gray-500">
                    Loading configuration...
                  </div>
                )}
              </div>

              {/* CMS Blocks Below */}
              {cmsBlockPositions.map(position =>
                position.includes('below') && (
                  <CmsBlockRenderer key={position} position={position} />
                )
              )}
            </div>
          </ResponsiveIframe>
        </div>
      </div>

      {/* EditorSidebar - only show in edit mode and not in preview */}
      {mode === 'edit' && !showPreview && isSidebarVisible && selectedElement && (
        <EditorSidebar
          selectedElement={selectedElement}
          slotId={selectedElement?.getAttribute ? selectedElement.getAttribute('data-slot-id') : null}
          slotConfig={(() => {
            const slotId = selectedElement?.getAttribute ? selectedElement.getAttribute('data-slot-id') : null;
            if (!slotId) return null;

            // Get from layoutConfig (which includes both saved and default slots)
            const config = layoutConfig?.slots?.[slotId];
            return config;
          })()}
          allSlots={layoutConfig?.slots || {}}
          storeId={getSelectedStoreId()}
          onClearSelection={handleClearSelection}
          onClassChange={handleClassChange}
          onInlineClassChange={handleClassChange}
          onTextChange={handleTextChange}
          isVisible={isSidebarVisible}
        />
      )}

      {/* Floating Publish Panel */}
      {showPublishPanel && (
        <div ref={publishPanelRef} className="fixed top-20 right-6 z-50 w-80">
          <PublishPanel
            draftConfig={draftConfig}
            storeId={getSelectedStoreId()}
            pageType={pageType}
            onPublished={handlePublishPanelPublished}
            onReverted={handlePublishPanelReverted}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        </div>
      )}

      {/* Add Slot Modal */}
      <AddSlotModal
        isOpen={showAddSlotModal}
        onClose={() => setShowAddSlotModal(false)}
        onCreateSlot={handleCreateSlot}
        onShowFilePicker={() => {
          setShowAddSlotModal(false);
          // TODO: Implement file picker modal
        }}
        onShowWidgetSelector={() => {
          setShowAddSlotModal(false);
          setShowWidgetSelectorModal(true);
        }}
        pageType={pageType}
      />

      {/* Widget Selector Modal */}
      <WidgetSelectorModal
        isOpen={showWidgetSelectorModal}
        onClose={() => setShowWidgetSelectorModal(false)}
        onSelectWidget={(widget) => {
          // Create a plugin_widget type slot with widget metadata
          // Note: handleCreateSlot puts additionalProps in metadata
          // We need to manually add the slot with widgetId at top level
          setLayoutConfig(prevConfig => {
            const newSlotId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

            const newSlot = {
              id: newSlotId,
              type: 'plugin_widget',
              widgetId: widget.id, // Top level for UnifiedSlotRenderer to read
              content: '',
              className: 'w-full',
              parentClassName: '',
              styles: {},
              parentId: 'header_container', // Add to header by default
              position: { col: 1, row: 1 },
              colSpan: 12,
              rowSpan: 1,
              viewMode: ['emptyCart', 'withProducts'],
              isCustom: true,
              metadata: {
                created: new Date().toISOString(),
                lastModified: new Date().toISOString(),
                hierarchical: true,
                pluginWidget: true,
                widgetName: widget.name,
                widgetConfig: {}
              }
            };

            const updatedSlots = { ...(prevConfig?.slots || {}), [newSlotId]: newSlot };

            const updatedConfig = {
              ...prevConfig,
              slots: updatedSlots,
              metadata: {
                ...prevConfig.metadata,
                lastModified: new Date().toISOString()
              }
            };

            // Auto-save
            saveConfiguration(updatedConfig);

            return updatedConfig;
          });
        }}
      />

      {/* Reset Layout Confirmation Modal */}
      <ResetLayoutModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetLayout}
        isResetting={localSaveStatus === 'saving'}
      />

      {/* Code Modal */}
      <CodeModal
        isOpen={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        configuration={layoutConfig}
        localSaveStatus={localSaveStatus}
        onSave={async (newConfiguration) => {
          setLayoutConfig(newConfiguration);
          setHasUnsavedChanges(true);
          await saveConfiguration(newConfiguration);
          setShowCodeModal(false);
        }}
      />
    </div>
  );
};

export default UnifiedSlotsEditor;