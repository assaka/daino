import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { useAIWorkspace, PAGE_TYPES, DEFAULT_VIEW_MODES } from '@/contexts/AIWorkspaceContext';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import slotConfigurationService from '@/services/slotConfigurationService';

// Import page-specific editors
import HeaderSlotsEditor from '@/pages/editor/HeaderSlotsEditor';
import CartSlotsEditor from '@/pages/editor/CartSlotsEditor';
import CategorySlotsEditor from '@/pages/editor/CategorySlotsEditor';
import ProductSlotsEditor from '@/pages/editor/ProductSlotsEditor';
import AccountSlotsEditor from '@/pages/editor/AccountSlotsEditor';
import LoginSlotsEditor from '@/pages/editor/LoginSlotsEditor';
import CheckoutSlotsEditor from '@/pages/editor/CheckoutSlotsEditor';
import SuccessSlotsEditor from '@/pages/editor/SuccessSlotsEditor';

import { slotEnabledFiles } from '@/components/editor/slot/slotEnabledFiles';
import { Package } from 'lucide-react';

// Simple ID generator
const generateSlotId = () => `slot_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;

/**
 * WorkspaceCanvas - Editor canvas component for AI Workspace
 * Renders the appropriate slot editor based on selected page type
 */
const WorkspaceCanvas = () => {
  const {
    selectedPageType,
    editorMode,
    viewMode,
    selectedItemSlug,
    markAsSaved,
    setIsLoading,
    currentConfiguration,
    registerSlotHandlers,
    triggerPublishStatusRefresh
  } = useAIWorkspace();

  const { getSelectedStoreId } = useStoreSelection();
  const slotsRef = useRef(currentConfiguration?.slots || {});

  // Keep slotsRef in sync with current configuration
  useEffect(() => {
    slotsRef.current = currentConfiguration?.slots || {};
  }, [currentConfiguration]);

  // Get current page info for display
  const currentPage = useMemo(() => {
    return slotEnabledFiles.find(f => f.pageType === selectedPageType);
  }, [selectedPageType]);

  /**
   * Create a new slot with given properties
   */
  const createSlot = useCallback((type, content, parentId, options = {}, currentSlots) => {
    const slots = currentSlots || slotsRef.current;
    const newId = generateSlotId();

    const newSlot = {
      id: newId,
      type,
      content: content || '',
      parentId: parentId || null,
      className: options.className || '',
      styles: options.styles || {},
      colSpan: options.colSpan || 12,
      rowSpan: options.rowSpan || 1,
      position: options.position || { col: 1, row: 1 },
      metadata: options.metadata || {}
    };

    return {
      ...slots,
      [newId]: newSlot
    };
  }, []);

  /**
   * Delete a slot by ID
   */
  const handleSlotDelete = useCallback((slotId, currentSlots) => {
    const slots = currentSlots || slotsRef.current;
    const newSlots = { ...slots };
    delete newSlots[slotId];
    return newSlots;
  }, []);

  /**
   * Update slot classes and styles
   */
  const handleClassChange = useCallback((slotId, className, styles, metadata, merge = false, currentSlots) => {
    const slots = currentSlots || slotsRef.current;
    const slot = slots[slotId];
    if (!slot) return slots;

    return {
      ...slots,
      [slotId]: {
        ...slot,
        className: merge ? `${slot.className} ${className}`.trim() : className,
        styles: merge ? { ...slot.styles, ...styles } : styles,
        ...(metadata && { metadata: { ...slot.metadata, ...metadata } })
      }
    };
  }, []);

  /**
   * Update slot text content
   */
  const handleTextChange = useCallback((slotId, newText, currentSlots) => {
    const slots = currentSlots || slotsRef.current;
    const slot = slots[slotId];
    if (!slot) return slots;

    return {
      ...slots,
      [slotId]: {
        ...slot,
        content: newText
      }
    };
  }, []);

  /**
   * Handle slot drag and drop
   */
  const handleSlotDrop = useCallback((slotId, targetId, position, currentSlots) => {
    const slots = currentSlots || slotsRef.current;
    const slot = slots[slotId];
    if (!slot) return slots;

    const targetSlot = slots[targetId];

    let newParentId;
    if (position === 'inside') {
      newParentId = targetId;
    } else {
      newParentId = targetSlot?.parentId || null;
    }

    return {
      ...slots,
      [slotId]: {
        ...slot,
        parentId: newParentId
      }
    };
  }, []);

  /**
   * Update slot configuration properties
   */
  const updateSlotConfig = useCallback((slotId, updates, currentSlots) => {
    const slots = currentSlots || slotsRef.current;
    const slot = slots[slotId];
    if (!slot) return slots;

    return {
      ...slots,
      [slotId]: {
        ...slot,
        ...updates
      }
    };
  }, []);

  // Register slot handlers with context for AI access
  useEffect(() => {
    const handlers = {
      createSlot,
      handleSlotDelete,
      handleClassChange,
      handleTextChange,
      handleSlotDrop,
      updateSlotConfig
    };
    registerSlotHandlers(handlers);
  }, [createSlot, handleSlotDelete, handleClassChange, handleTextChange, handleSlotDrop, updateSlotConfig, registerSlotHandlers]);

  // Handle save from editor
  const handleSave = async (configToSave) => {
    try {
      setIsLoading(true);
      const storeId = getSelectedStoreId();
      const response = await slotConfigurationService.saveConfiguration(
        storeId,
        configToSave,
        selectedPageType
      );
      console.log('AI Workspace: Configuration saved successfully:', response);
      markAsSaved();
      // Refresh publish status to update the Publish button
      triggerPublishStatusRefresh();
      return response;
    } catch (error) {
      console.error(`AI Workspace: Failed to save ${selectedPageType} configuration:`, error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Render the appropriate editor based on page type
  const renderEditor = () => {
    const mode = editorMode ? 'edit' : 'preview';
    const currentViewMode = viewMode || DEFAULT_VIEW_MODES[selectedPageType];

    const editorProps = {
      mode,
      viewMode: currentViewMode,
      onSave: handleSave,
      initialItemSlug: selectedItemSlug
    };

    switch (selectedPageType) {
      case PAGE_TYPES.HEADER:
        return <HeaderSlotsEditor {...editorProps} />;

      case PAGE_TYPES.PRODUCT:
        return <ProductSlotsEditor {...editorProps} />;

      case PAGE_TYPES.CATEGORY:
        return <CategorySlotsEditor {...editorProps} />;

      case PAGE_TYPES.CART:
        return <CartSlotsEditor {...editorProps} slotType={selectedPageType} />;

      case PAGE_TYPES.ACCOUNT:
        return <AccountSlotsEditor {...editorProps} />;

      case PAGE_TYPES.LOGIN:
        return <LoginSlotsEditor {...editorProps} />;

      case PAGE_TYPES.CHECKOUT:
        return <CheckoutSlotsEditor {...editorProps} />;

      case PAGE_TYPES.SUCCESS:
        return <SuccessSlotsEditor {...editorProps} />;

      default:
        return <ProductSlotsEditor {...editorProps} />;
    }
  };

  // Empty state when no editor mode and showing preview
  if (!editorMode && !currentPage) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <div className="text-center text-gray-500 dark:text-gray-400 max-w-md px-4">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg mb-2">Click "Editor" to start editing</p>
          <p className="text-sm">
            Toggle editor mode to select a page and start customizing your layout.
            Use the AI assistant to describe changes you want to make.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 overflow-hidden">
        {renderEditor()}
      </div>
    </div>
  );
};

export default WorkspaceCanvas;
