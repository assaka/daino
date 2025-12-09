/**
 * Generic slot components for all page editors
 * These components are reusable across Cart, Product, Category, Checkout, and Success editors
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Image, Square, Settings, Plus, Loader2, Code, X, Check, Rocket, Trash2, Monitor, Tablet, Smartphone } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResizeWrapper } from '@/components/ui/resize-element-wrapper';
import { SlotManager } from '@/utils/slotUtils';
import FilePickerModal from '@/components/ui/FilePickerModal';
import CodeEditor from '@/components/ai-workspace/CodeEditor.jsx';
import SaveButton from '@/components/ui/save-button';
import { processVariables, generateDemoData } from '@/utils/variableProcessor';

// EditModeControls Component
export function EditModeControls({ localSaveStatus, publishStatus, saveConfiguration, onPublish, hasChanges = false }) {
  return (
    <>
      {/* Publish Status */}
      {publishStatus && (
        <div className={`flex items-center gap-2 text-sm ${
          publishStatus === 'publishing' ? 'text-blue-600' :
          publishStatus === 'published' ? 'text-green-600' :
          'text-red-600'
        }`}>
          {publishStatus === 'publishing' && <Loader2 className="w-4 h-4 animate-spin" />}
          {publishStatus === 'published' && '🚀 Published'}
          {publishStatus === 'error' && '✗ Publish Failed'}
        </div>
      )}
      <SaveButton
        onClick={() => saveConfiguration()}
        loading={localSaveStatus === 'saving'}
        success={localSaveStatus === 'saved'}
        size="sm"
        className="border"
      />
    </>
  );
}

// GridResizeHandle Component
export function GridResizeHandle({ onResize, currentValue, maxValue = 12, minValue = 1, direction = 'horizontal', parentHovered = false, onResizeStart, onResizeEnd, onHoverChange }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mouseOffset, setMouseOffset] = useState(0); // Track mouse position during drag
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startValueRef = useRef(currentValue);
  const lastValueRef = useRef(currentValue);
  const onResizeRef = useRef(onResize);
  const onResizeStartRef = useRef(onResizeStart);
  const onResizeEndRef = useRef(onResizeEnd);
  const mouseMoveHandlerRef = useRef(null);
  const mouseUpHandlerRef = useRef(null);
  const handleElementRef = useRef(null);

  // Helper to parse responsive colSpan strings like 'col-span-12 md:col-span-6'
  const parseResponsiveColSpan = (value) => {
    if (typeof value === 'number') {
      return { base: value, responsive: null };
    }
    if (typeof value === 'string') {
      // Extract base value (e.g., 'col-span-12' -> 12)
      const baseMatch = value.match(/(?:^|\s)col-span-(\d+)/);
      // Extract responsive value (e.g., 'md:col-span-6' -> 6)
      const responsiveMatch = value.match(/(sm|md|lg|xl):col-span-(\d+)/);
      const breakpoint = responsiveMatch ? responsiveMatch[1] : 'md';
      return {
        base: baseMatch ? parseInt(baseMatch[1]) : 12,
        responsive: responsiveMatch ? parseInt(responsiveMatch[2]) : null,
        breakpoint
      };
    }
    return { base: 12, responsive: null };
  };

  // Helper to build responsive colSpan string
  const buildResponsiveColSpan = (baseValue, responsiveValue, breakpoint = 'md') => {
    if (!responsiveValue) {
      return baseValue;
    }
    return `col-span-${baseValue} ${breakpoint}:col-span-${responsiveValue}`;
  };

  // IMPORTANT: Define isHorizontal BEFORE handleMouseDown so it's available in the closure
  const isHorizontal = direction === 'horizontal';

  useEffect(() => {
    onResizeRef.current = onResize;
    onResizeStartRef.current = onResizeStart;
    onResizeEndRef.current = onResizeEnd;
  }, [onResize, onResizeStart, onResizeEnd]);

  const handleMouseDown = (e) => {
    // CRITICAL: Prevent parent GridColumn drag from starting
    e.preventDefault();
    e.stopPropagation();

    // Capture pointer to ensure we receive all pointer events even if mouse leaves the element
    e.target.setPointerCapture(e.pointerId);

    // CRITICAL: Immediately notify parent that handle is active
    if (onHoverChange) {
      onHoverChange(true);
    }

    setIsDragging(true);
    isDraggingRef.current = true;
    handleElementRef.current = e.currentTarget;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;

    // Store the original value (can be number or string)
    startValueRef.current = currentValue;
    lastValueRef.current = currentValue;

    console.log('[RESIZE] Start:', { currentValue, direction, isHorizontal });

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';

    if (onResizeStartRef.current) {
      onResizeStartRef.current();
    }

    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;
      const startValue = startValueRef.current;

      // Calculate and apply resize in real-time for visual feedback
      let newValue;

      if (direction === 'horizontal') {
        const sensitivity = 20; // pixels per column change
        const colSpanDelta = Math.round(deltaX / sensitivity);

        // Parse the current value (could be number or string)
        const parsed = parseResponsiveColSpan(startValue);
        const currentNumericValue = parsed.responsive || parsed.base;
        const newNumericValue = Math.max(minValue, Math.min(maxValue, currentNumericValue + colSpanDelta));

        // Build the new colSpan value
        if (parsed.responsive) {
          newValue = buildResponsiveColSpan(parsed.base, newNumericValue, parsed.breakpoint);
        } else if (typeof startValue === 'string') {
          newValue = buildResponsiveColSpan(newNumericValue, null);
        } else {
          newValue = newNumericValue;
        }

        // Apply resize immediately for visual feedback
        if (newValue !== lastValueRef.current) {
          lastValueRef.current = newValue;
          console.log('[RESIZE] Move:', { deltaX, colSpanDelta, newValue });
          onResizeRef.current(newValue);
        }

        setMouseOffset(0);
      } else {
        const heightDelta = Math.round(deltaY / 2);
        newValue = Math.max(minValue, startValue + heightDelta);

        if (newValue !== lastValueRef.current) {
          lastValueRef.current = newValue;
          onResizeRef.current(newValue);
        }

        setMouseOffset(heightDelta);
      }
    };

    const handleMouseUp = (e) => {
      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;
      const startValue = startValueRef.current;

      // Calculate final value on release
      let finalValue;

      if (direction === 'horizontal') {
        const sensitivity = 20;
        const colSpanDelta = Math.round(deltaX / sensitivity);

        // Parse the current value (could be number or string)
        const parsed = parseResponsiveColSpan(startValue);
        const currentNumericValue = parsed.responsive || parsed.base;
        const newNumericValue = Math.max(minValue, Math.min(maxValue, currentNumericValue + colSpanDelta));

        // Build the new colSpan value
        if (parsed.responsive) {
          finalValue = buildResponsiveColSpan(parsed.base, newNumericValue, parsed.breakpoint);
        } else if (typeof startValue === 'string') {
          finalValue = buildResponsiveColSpan(newNumericValue, null);
        } else {
          finalValue = newNumericValue;
        }
      } else {
        const heightDelta = Math.round(deltaY / 2);
        finalValue = Math.max(minValue, startValue + heightDelta);
      }

      console.log('[RESIZE] End:', { startValue, finalValue });

      // Only save if value actually changed
      if (finalValue !== startValue) {
        onResizeRef.current(finalValue);
      }

      // Release pointer capture
      if (handleElementRef.current && e.pointerId !== undefined) {
        try {
          handleElementRef.current.releasePointerCapture(e.pointerId);
        } catch (err) {
          // Ignore if pointer capture was already released
        }
      }

      // Cleanup
      setIsDragging(false);
      isDraggingRef.current = false;
      setMouseOffset(0);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      // Notify parent handle is no longer active
      if (onHoverChange) {
        onHoverChange(false);
      }

      // Remove listeners from handle element
      if (handleElementRef.current) {
        handleElementRef.current.removeEventListener('pointermove', handleMouseMove);
        handleElementRef.current.removeEventListener('pointerup', handleMouseUp);
        handleElementRef.current.removeEventListener('pointercancel', handleMouseUp);
      }

      mouseMoveHandlerRef.current = null;
      mouseUpHandlerRef.current = null;

      if (onResizeEndRef.current) {
        onResizeEndRef.current();
      }
    };

    mouseMoveHandlerRef.current = handleMouseMove;
    mouseUpHandlerRef.current = handleMouseUp;

    // CRITICAL: Attach listeners to the capturing element, not document!
    // When setPointerCapture is used, events go to the capturing element
    const handleElement = e.currentTarget;
    handleElement.addEventListener('pointermove', handleMouseMove);
    handleElement.addEventListener('pointerup', handleMouseUp);
    handleElement.addEventListener('pointercancel', handleMouseUp);

  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount - remove listeners from handle element if they exist
      if (handleElementRef.current) {
        if (mouseMoveHandlerRef.current) {
          handleElementRef.current.removeEventListener('pointermove', mouseMoveHandlerRef.current);
        }
        if (mouseUpHandlerRef.current) {
          handleElementRef.current.removeEventListener('pointerup', mouseUpHandlerRef.current);
          handleElementRef.current.removeEventListener('pointercancel', mouseUpHandlerRef.current);
        }
      }
    };
  }, []);

  // isHorizontal is now defined at the top of the component (before handleMouseDown)
  const cursorClass = isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize';
  // Position classes without transform (we'll apply transform inline to combine with mouseOffset)
  const positionClass = isHorizontal
    ? '-right-1 top-1/2 w-2 h-8'
    : '-bottom-1 left-1/2 h-2 w-8';

  return (
    <div
      className={`absolute ${positionClass} ${cursorClass} transition-opacity duration-200 ${
        isHovered || isDragging || parentHovered
          ? 'opacity-100'
          : 'opacity-0 hover:opacity-100'
      }`}
      draggable={false}
      onPointerDown={handleMouseDown}
      onMouseEnter={() => {
        setIsHovered(true);
        onHoverChange?.(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverChange?.(false);
      }}
      onDragStart={(e) => {
        // Prevent any drag operations on the handle itself
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }}
      style={{
        zIndex: 9999,
        pointerEvents: 'all', // Ensure handle captures events
        touchAction: 'none', // Prevent touch scroll during drag
        transform: isDragging
          ? (isHorizontal
              ? `translate(${mouseOffset}px, -50%)`
              : `translate(-50%, ${mouseOffset}px)`)
          : undefined,
        transition: isDragging ? 'none' : 'all 0.2s ease-out'
      }}
      title={`Resize ${direction}ly ${isHorizontal ? `(${currentValue} / ${maxValue})` : `(${currentValue}px)`}`}
    >
      <div className={`w-full h-full rounded-md flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center justify-center gap-0.5 border shadow-sm transition-colors duration-150 ${
        isDragging
          ? 'bg-blue-600 border-blue-700 shadow-lg'
          : isHovered || parentHovered
            ? 'bg-blue-500 border-blue-600 shadow-md'
            : 'bg-blue-500 border-blue-600 hover:bg-blue-600'
      }`}>
        <div className="w-1 h-1 bg-white rounded-full opacity-90"></div>
        <div className="w-1 h-1 bg-white rounded-full opacity-90"></div>
        <div className="w-1 h-1 bg-white rounded-full opacity-90"></div>
      </div>

      {isDragging && (
        <div className={`absolute ${isHorizontal ? '-top-6 left-1/2 -translate-x-1/2' : '-left-10 top-1/2 -translate-y-1/2'}
          bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap`}>
          {isHorizontal ? `${currentValue} / ${maxValue}` : `${currentValue}px`}
        </div>
      )}
    </div>
  );
}

/**
 * @deprecated This component is no longer used in the codebase.
 *
 * Modern slots use GridColumn directly for editor functionality.
 * Can be safely removed in a future cleanup along with EditorInteractionWrapper.
 */
// EditableElement Component
export function EditableElement({
  slotId,
  children,
  className,
  style,
  onClick,
  canResize = false,
  draggable = false,
  mode = 'edit',
  selectedElementId = null,
  onElementResize = null
}) {
  const handleClick = useCallback((e) => {
    if (mode === 'preview') return;

    e.stopPropagation();
    if (onClick) {
      onClick(slotId, e.currentTarget);
    }
  }, [slotId, onClick, mode]);

  const content = (
    <EditorInteractionWrapper
      mode={mode}
      draggable={draggable}
      isSelected={selectedElementId === slotId}
      className={className || ''}
      style={style}
      onClick={handleClick}
      data-slot-id={slotId}
      data-editable={mode === 'edit'}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </EditorInteractionWrapper>
  );

  if (canResize && mode === 'edit') {
    return (
      <ResizeWrapper
        minWidth={50}
        minHeight={20}
        onResize={onElementResize}
      >
        {content}
      </ResizeWrapper>
    );
  }

  return content;
}

// GridColumn Component
export function GridColumn({
  colSpan = 12,
  colSpanClass = 'col-span-12',
  useTailwindClass = false,
  rowSpan = 1,
  height,
  slotId,
  slot,
  onGridResize,
  onSlotHeightResize,
  onResizeStart,
  onResizeEnd,
  onSlotDrop,
  onSlotDelete, // Add delete handler prop
  onElementClick, // Add element click handler
  mode = 'edit',
  viewMode = 'emptyCart', // Add viewMode parameter
  showBorders = true,
  currentDragInfo,
  setCurrentDragInfo,
  children,
  isNested = false,
  slots = {}, // Add slots prop for enhanced feedback
  selectedElementId = null, // Add selectedElementId prop
  productData = {} // Add productData prop for real admin settings
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropZone, setDropZone] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const dragOverTimeoutRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isOverResizeHandle, setIsOverResizeHandle] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Process parentClassName template variables for gallery positioning
  const variableContext = generateDemoData('product', productData.settings || {});
  const processedParentClassName = slot?.parentClassName ? processVariables(slot.parentClassName, variableContext) : '';

  // Calculate grid position for ghost preview
  const calculateGridPosition = useCallback((dropPosition, targetSlot) => {
    if (!targetSlot || !slots) return null;

    const parentSlots = Object.values(slots).filter(s => s.parentId === targetSlot.parentId);
    const targetIndex = parentSlots.findIndex(s => s.id === targetSlot.id);

    // Get targetSlot colSpan handling old (number), simple object, and nested breakpoint formats
    let targetColSpan = 1;
    if (typeof targetSlot.colSpan === 'number') {
      targetColSpan = targetSlot.colSpan;
    } else if (typeof targetSlot.colSpan === 'object' && targetSlot.colSpan !== null) {
      const viewModeValue = targetSlot.colSpan[viewMode];

      if (typeof viewModeValue === 'number') {
        targetColSpan = viewModeValue;
      } else if (typeof viewModeValue === 'object' && viewModeValue !== null) {
        // Nested breakpoint format: { mobile: 12, tablet: 12, desktop: 8 }
        targetColSpan = viewModeValue.desktop || viewModeValue.tablet || viewModeValue.mobile || 1;
      } else {
        targetColSpan = 1;
      }
    }

    let newRow = targetSlot.position?.row || 1;
    let newCol = targetSlot.position?.col || 1;

    if (dropPosition === 'before') {
      // Place before target slot
      newRow = targetSlot.position?.row || 1;
      newCol = Math.max(1, (targetSlot.position?.col || 1));
    } else if (dropPosition === 'after') {
      // Place after target slot
      newRow = targetSlot.position?.row || 1;
      newCol = Math.min(12, (targetSlot.position?.col || 1) + targetColSpan);
    } else if (dropPosition === 'left') {
      // Place to the left of target slot (horizontal reordering)
      newRow = targetSlot.position?.row || 1;
      newCol = Math.max(1, (targetSlot.position?.col || 1));
    } else if (dropPosition === 'right') {
      // Place to the right of target slot (horizontal reordering)
      newRow = targetSlot.position?.row || 1;
      newCol = Math.min(12, (targetSlot.position?.col || 1) + targetColSpan);
    } else if (dropPosition === 'inside') {
      // Place inside container at top-left
      newRow = 1;
      newCol = 1;
    }

    return { row: newRow, col: newCol };
  }, [slots, viewMode]);

  const [isResizingSlot, setIsResizingSlot] = useState(false);

  const isContainerType = ['container', 'grid', 'flex'].includes(slot?.type);
  const showHorizontalHandle = onGridResize && mode === 'edit' && colSpan >= 1;
  const showVerticalHandle = onSlotHeightResize && mode === 'edit';

  const handleDragStart = useCallback((e) => {
    if (mode !== 'edit') return;

    // CRITICAL: Check if drag started from resize handle by examining the target
    const target = e.target;
    const isResizeHandle = target.closest('.cursor-col-resize, .cursor-row-resize');

    if (isResizeHandle || isOverResizeHandle || isResizingSlot) {
      console.log('🚫 [GRID RESIZE DEBUG] Preventing container drag - resize handle detected', {
        isResizeHandle: !!isResizeHandle,
        isOverResizeHandle,
        isResizingSlot
      });
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', slotId);
    e.dataTransfer.effectAllowed = 'move';

    // Store drag start position in viewport coordinates for direction detection
    const startX = e.clientX;
    const startY = e.clientY;

    if (setCurrentDragInfo) {
      setCurrentDragInfo({
        draggedSlotId: slotId,
        slotId: slotId,
        parentId: slot?.parentId,
        startPosition: { x: startX, y: startY }
      });
    }

    const dragImage = document.createElement('div');
    dragImage.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        padding: 12px 20px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);
        white-space: nowrap;
        pointer-events: none;
        transform: rotate(-2deg);
        border: 2px solid rgba(255, 255, 255, 0.2);
      ">
        📦 ${slotId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </div>
    `;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.left = '-1000px';
    document.body.appendChild(dragImage);

    e.dataTransfer.setDragImage(dragImage, 60, 20);

    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 100);
  }, [slotId, mode, isOverResizeHandle, isResizingSlot, setCurrentDragInfo, slot?.parentId]);

  const handleDragEnd = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(false);
    setIsDragOver(false);
    setIsDragActive(false);
    setDropZone(null);

    if (setCurrentDragInfo) {
      setCurrentDragInfo(null);
    }
  }, [slotId, setCurrentDragInfo]);

  const handleDragOver = useCallback((e) => {
    if (mode !== 'edit') return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (['container', 'grid', 'flex'].includes(slot?.type)) {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      if (y > height * 0.25 && y < height * 0.75) {
        e.stopPropagation();
      }
    }

    if (!isDragging) {
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current);
      }

      if (!isDragOver) {
        setIsDragOver(true);
        setIsDragActive(true);
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      const isContainer = ['container', 'grid', 'flex'].includes(slot?.type);
      let newDropZone = null;

      // Get the dragged slot info to determine valid drop types
      const draggedSlotId = currentDragInfo?.draggedSlotId;
      const draggedSlot = slots[draggedSlotId];
      const draggedParent = currentDragInfo?.parentId;
      const targetParent = slot?.parentId;

      // Determine operation type for enhanced feedback
      const isReordering = draggedParent === targetParent;
      const isMoving = draggedParent !== targetParent;

      // Check if slots are on same row for horizontal reordering
      const isHorizontalReordering = isReordering &&
        slot?.position?.row === draggedSlot?.position?.row &&
        slot?.position?.row !== undefined;

      // Calculate drag direction based on movement from drag start
      let dragDirection = null;
      if (currentDragInfo?.startPosition) {
        // Convert startPosition to viewport coordinates for proper comparison
        const currentX = e.clientX;
        const currentY = e.clientY;
        const startX = currentDragInfo.startPosition.x;
        const startY = currentDragInfo.startPosition.y;

        const deltaX = currentX - startX;
        const deltaY = currentY - startY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Use a lower threshold for better detection
        if (absDeltaX > absDeltaY * 0.8) {
          dragDirection = deltaX > 0 ? 'right' : 'left';
        } else if (absDeltaY > absDeltaX * 0.8) {
          dragDirection = deltaY > 0 ? 'down' : 'up';
        }

      }

      // Use movement direction to determine drop zone
      if (dragDirection === 'left') {
        newDropZone = 'left';
        e.dataTransfer.dropEffect = 'move';
      } else if (dragDirection === 'right') {
        newDropZone = 'right';
        e.dataTransfer.dropEffect = 'move';
      } else if (dragDirection === 'up') {
        // Allow moving up within same container or to different containers
        if (draggedParent === targetParent || draggedParent !== targetParent) {
          newDropZone = 'before';
          e.dataTransfer.dropEffect = 'move';
        } else {
          newDropZone = null;
          e.dataTransfer.dropEffect = 'none';
        }
      } else if (dragDirection === 'down') {
        if (draggedParent === targetParent || draggedParent !== targetParent) {
          newDropZone = 'after';
          e.dataTransfer.dropEffect = 'move';
        }
      } else {
        // No clear direction - fall back to position-based detection
        if (isHorizontalReordering) {
          newDropZone = x < width * 0.5 ? 'left' : 'right';
          e.dataTransfer.dropEffect = 'move';
        } else {
          // Vertical positioning fallback
          if (y < height * 0.33) {
            newDropZone = 'before';
            e.dataTransfer.dropEffect = 'move';
          } else if (y > height * 0.67) {
            newDropZone = 'after';
            e.dataTransfer.dropEffect = 'move';
          } else if (isContainer && draggedSlotId && draggedSlotId !== slot?.id) {
            newDropZone = 'inside';
            e.dataTransfer.dropEffect = 'move';
          } else {
            newDropZone = null;
            e.dataTransfer.dropEffect = 'none';
          }
        }
      }

      if (newDropZone !== dropZone) {
        setDropZone(newDropZone);

        // Update global drag info with enhanced feedback
        if (setCurrentDragInfo && newDropZone) {
          const gridPosition = calculateGridPosition(newDropZone, slot);
          setCurrentDragInfo(prev => ({
            ...prev,
            targetSlotId: slot?.id,
            dropPosition: newDropZone,
            operationType: isReordering ? 'reorder' : 'move',
            gridPosition,
            targetSlot: slot,
            draggedSlot
          }));
        }
      }
    }
  }, [mode, isDragging, slot?.type, isDragOver, dropZone, slots, currentDragInfo?.draggedSlotId, currentDragInfo?.parentId, calculateGridPosition, setCurrentDragInfo]);

  const handleDragLeave = useCallback((e) => {
    const relatedTarget = e.relatedTarget;
    const currentTarget = e.currentTarget;

    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      dragOverTimeoutRef.current = setTimeout(() => {
        setIsDragOver(false);
        setDropZone(null);
        setIsDragActive(false);
      }, 200);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    if (mode !== 'edit') return;

    e.preventDefault();
    e.stopPropagation();

    if (dragOverTimeoutRef.current) {
      clearTimeout(dragOverTimeoutRef.current);
    }

    setIsDragOver(false);
    setIsDragActive(false);

    if (isDragging) {
      return;
    }

    const draggedSlotId = e.dataTransfer.getData('text/plain');
    let dropPosition = dropZone || 'after';

    // Map horizontal drop zones to appropriate positions
    if (dropPosition === 'left') {
      dropPosition = 'before'; // Left means before in horizontal context
    } else if (dropPosition === 'right') {
      dropPosition = 'after'; // Right means after in horizontal context
    }

    if (draggedSlotId && draggedSlotId !== slotId && onSlotDrop) {
      onSlotDrop(draggedSlotId, slotId, dropPosition);
    }

    setDropZone(null);
  }, [slotId, onSlotDrop, mode, isDragging, dropZone]);

  const gridStyles = {
    ...(useTailwindClass ? {} : { gridColumn: `span ${colSpan}` }),
    gridRow: rowSpan > 1 ? `span ${rowSpan}` : undefined,
    zIndex: 2,
    // Add container-specific styles when it's a container type
    ...(['container', 'grid', 'flex'].includes(slot?.type) ? {
      minHeight: mode === 'edit' ? '80px' : slot.styles?.minHeight,
    } : {}),
    // Only apply layout-related styles to grid wrapper using whitelist approach
    // All other styles (colors, fonts, etc.) should go to the actual elements
    ...Object.fromEntries(
      Object.entries(slot?.styles || {}).filter(([key]) => {
        // Whitelist of layout-only styles that are safe for grid wrapper
        // Explicitly exclude color/appearance styles so they go to the actual element
        const layoutStyles = [
          'width', 'minWidth', 'maxWidth',
          'height', 'minHeight', 'maxHeight',
          'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
          'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
          'display', 'position', 'top', 'right', 'bottom', 'left',
          'zIndex', 'overflow', 'overflowX', 'overflowY',
          'flexBasis', 'flexGrow', 'flexShrink'
        ];

        // For content slots (button, text, image, link), exclude width/height from grid wrapper
        // These should only be applied to the actual content element
        const isContentSlot = ['button', 'text', 'image', 'link'].includes(slot?.type);
        const contentExclusionStyles = isContentSlot ? ['width', 'height'] : [];

        // Exclude alignment styles from grid wrapper - these should only apply to content elements
        // When applied to GridColumn wrapper, they align against the entire grid instead of the slot
        const alignmentStyles = [
          'textAlign', 'justifyContent', 'alignItems', 'alignSelf', 'justifyItems'
        ];

        // Exclude color and appearance styles from grid wrapper
        const colorStyles = [
          'color', 'backgroundColor', 'background', 'borderColor', 'border',
          'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
          'borderRadius', 'borderStyle', 'borderWidth',
          'fontSize', 'fontWeight', 'fontFamily', 'lineHeight',
          'boxShadow', 'textShadow', 'opacity', 'transform'
        ];
        return layoutStyles.includes(key) && !colorStyles.includes(key) && !contentExclusionStyles.includes(key) && !alignmentStyles.includes(key);
      })
    )
  };


  return (
    <div
      className={`${
        mode === 'edit'
          ? `${showBorders ? (isNested ? 'border border-dashed' : 'border-2 border-dashed') : ''} rounded-lg overflow-visible transition-all duration-200 ${
                    isDragOver
                      ? 'border-blue-500 shadow-lg shadow-blue-200/60 z-10 ring-2 ring-blue-300' :
                    isDragging
                      ? 'border-blue-600 bg-blue-50/60 shadow-xl shadow-blue-200/60 ring-2 ring-blue-200 opacity-80' :
                    isHovered
                      ? `border-blue-500 ${isNested ? 'border' : 'border-2'} border-dashed shadow-md shadow-blue-200/40`
                      : showBorders
                      ? 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/20'
                      : 'hover:border-blue-400 hover:border-2 hover:border-dashed hover:bg-blue-50/10'
                  } p-2 ${isOverResizeHandle ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`
          : 'overflow-visible'
      } relative responsive-slot ${colSpanClass} ${processedParentClassName}`}
      ref={(el) => {
      }}
      data-col-span={colSpan}
      data-row-span={rowSpan}
      data-slot-id={slotId}
      draggable={mode === 'edit' && !isOverResizeHandle}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnter={(e) => {
        e.preventDefault();
      }}
      onClick={(e) => {
        if (mode === 'edit' && onElementClick && !isOverResizeHandle && !isResizingSlot) {
          e.stopPropagation();

          // Check if this slot is non-editable, if so select parent instead
          const isNonEditable = slot?.metadata?.nonEditable === true;
          const targetSlotId = isNonEditable && slot?.parentId ? slot.parentId : slotId;
          const targetElement = isNonEditable && slot?.parentId
            ? e.currentTarget.closest(`[data-slot-id="${slot.parentId}"]`) || e.currentTarget
            : e.currentTarget;

          // Ensure the element has the data-slot-id attribute
          targetElement.setAttribute('data-slot-id', targetSlotId);
          onElementClick(targetSlotId, targetElement);
        }
      }}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isDragging) {
          setIsDragOver(false);
          setIsDragActive(false);
          setDropZone(null);
        }
      }}
      style={gridStyles}
    >
      {/* Enhanced visual feedback for drag operations */}
      {mode === 'edit' && isDragActive && dropZone && currentDragInfo && (
        <>

          {/* Clear directional drop zone indicators */}
          {dropZone === 'before' && (
            <div className="absolute -top-1 left-0 right-0 z-[100] pointer-events-none">
              <div className="h-2 bg-green-500 shadow-xl border-t-4 border-green-600" />
              <div className="absolute -top-8 left-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold shadow-lg">
                ⬆️ Drop above
              </div>
            </div>
          )}
          {dropZone === 'after' && (
            <div className="absolute -bottom-1 left-0 right-0 z-[100] pointer-events-none">
              <div className="h-2 bg-green-500 shadow-xl border-b-4 border-green-600" />
              <div className="absolute -bottom-8 left-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold shadow-lg">
                ⬇️ Drop below
              </div>
            </div>
          )}
          {dropZone === 'left' && (
            <div className="absolute -left-1 top-0 bottom-0 z-[100] pointer-events-none">
              <div className="w-2 h-full bg-green-500 shadow-xl border-l-4 border-green-600" />
              <div className="absolute top-2 -left-24 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold shadow-lg">
                ⬅️ Drop left
              </div>
            </div>
          )}
          {dropZone === 'right' && (
            <div className="absolute -right-1 top-0 bottom-0 z-[100] pointer-events-none">
              <div className="w-2 h-full bg-green-500 shadow-xl border-r-4 border-green-600" />
              <div className="absolute top-2 -right-24 bg-green-600 text-white px-2 py-1 rounded text-xs font-bold shadow-lg">
                ➡️ Drop right
              </div>
            </div>
          )}
          {dropZone === 'inside' && null}
        </>
      )}

      {mode === 'edit' && isHovered && !isOverResizeHandle && (
        <>
          {/* Delete button - only show for custom slots (not default ones) */}
          {slot?.isCustom === true && onSlotDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowDeleteModal(true);
              }}
              className="absolute bottom-1 left-1 bg-red-500 hover:bg-red-600 text-white rounded p-1 z-30 transition-colors duration-200"
              title="Delete slot"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          <div
            className="absolute top-1 right-1 text-blue-500 text-sm opacity-60 pointer-events-none z-30"
            title="Drag to reposition"
          >
            ⋮⋮
          </div>
        </>
      )}

      {children}

      {/* Grid column resize handle - always show in edit mode, becomes more visible on hover */}
      {showHorizontalHandle && (
        <GridResizeHandle
          onResize={(newColSpan) => {
            console.log('[GridColumn] Calling onGridResize:', { slotId, newColSpan });
            onGridResize(slotId, newColSpan);
          }}
          currentValue={colSpan}
          maxValue={12}
          minValue={1}
          direction="horizontal"
          parentHovered={isHovered || isResizingSlot}
          onResizeStart={() => {
            setIsResizingSlot(true);
            onResizeStart?.();
          }}
          onResizeEnd={() => {
            setIsResizingSlot(false);
            onResizeEnd?.();
          }}
          onHoverChange={setIsOverResizeHandle}
        />
      )}
      {/* Vertical resize handle - always show in edit mode, becomes more visible on hover */}
      {showVerticalHandle && (
        <GridResizeHandle
          onResize={(newHeight) => onSlotHeightResize(slotId, newHeight)}
          currentValue={height || 80}
          maxValue={1000}
          minValue={40}
          direction="vertical"
          parentHovered={isHovered || isResizingSlot}
          onResizeStart={() => {
            setIsResizingSlot(true);
            onResizeStart?.();
          }}
          onResizeEnd={() => {
            setIsResizingSlot(false);
            onResizeEnd?.();
          }}
          onHoverChange={setIsOverResizeHandle}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" style={{ zIndex: 99999 }}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 relative z-[10000]" style={{ zIndex: 100000 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-red-600">Delete Slot</h3>
              <Button
                onClick={() => setShowDeleteModal(false)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
                <div className="text-red-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-red-800">This action cannot be undone</p>
                  <p className="text-sm text-red-600">
                    Are you sure you want to delete this {slot?.type || 'slot'}?
                    {slot?.content && (
                      <span className="block mt-1 font-mono text-xs bg-red-100 p-1 rounded">
                        "{slot.content.substring(0, 50)}{slot.content.length > 50 ? '...' : ''}"
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setShowDeleteModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    onSlotDelete(slotId);
                    setShowDeleteModal(false);
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// HierarchicalSlotRenderer Component
export function HierarchicalSlotRenderer({
  slots,
  parentId = null,
  mode,
  viewMode = 'emptyCart',
  showBorders = true,
  currentDragInfo,
  setCurrentDragInfo,
  onElementClick,
  onGridResize,
  onSlotHeightResize,
  onSlotDrop,
  onSlotDelete, // Add delete handler prop
  onResizeStart,
  onResizeEnd,
  selectedElementId = null,
  setPageConfig,
  saveConfiguration,
  saveTimeoutRef,
  categoryData = null, // Add category data for category-specific rendering
  customSlotRenderer = null // Add custom slot renderer function
}) {
  const childSlots = SlotManager.getChildSlots(slots, parentId);

  const filteredSlots = childSlots.filter(slot => {
    const shouldShow = !slot.viewMode || !Array.isArray(slot.viewMode) || slot.viewMode.length === 0 || slot.viewMode.includes(viewMode);
    return shouldShow;
  });

  // Sort slots by grid coordinates for proper visual ordering (same as storefront)
  const sortedSlots = filteredSlots.sort((a, b) => {
    const hasGridCoordsA = a.position && (a.position.col !== undefined && a.position.row !== undefined);
    const hasGridCoordsB = b.position && (b.position.col !== undefined && b.position.row !== undefined);

    if (hasGridCoordsA && hasGridCoordsB) {
      // Sort by row first, then by column
      const rowA = a.position.row;
      const rowB = b.position.row;

      if (rowA !== rowB) {
        return rowA - rowB;
      }

      const colA = a.position.col;
      const colB = b.position.col;

      if (colA !== colB) {
        return colA - colB;
      }
    }

    // If one has coords and other doesn't, prioritize the one with coords
    if (hasGridCoordsA && !hasGridCoordsB) return -1;
    if (!hasGridCoordsA && hasGridCoordsB) return 1;

    // Default: maintain original order for slots without coordinates
    return 0;
  });


  return sortedSlots.map(slot => {

    // Handle number, object with viewMode, and Tailwind responsive classes
    let colSpan = 12; // default value for non-Tailwind calculations
    let colSpanClass = 'col-span-12'; // default Tailwind class
    let useTailwindClass = false;

    if (typeof slot.colSpan === 'number') {
      // Old format: direct number
      colSpan = slot.colSpan;
      colSpanClass = `col-span-${slot.colSpan}`;
    } else if (typeof slot.colSpan === 'string') {
      // Direct Tailwind responsive class format: 'col-span-12 md:col-span-6'
      colSpanClass = slot.colSpan;
      useTailwindClass = true;
      colSpan = 12; // fallback for calculations
    } else if (typeof slot.colSpan === 'object' && slot.colSpan !== null) {
      // New format: object with viewMode keys
      const viewModeValue = slot.colSpan[viewMode];

      if (typeof viewModeValue === 'number') {
        // Simple viewMode: number format
        colSpan = viewModeValue;
        colSpanClass = `col-span-${viewModeValue}`;
      } else if (typeof viewModeValue === 'string') {
        // Tailwind responsive class format: 'col-span-12 lg:col-span-8'
        colSpanClass = viewModeValue;
        useTailwindClass = true;
        colSpan = 12; // fallback for calculations
      } else if (typeof viewModeValue === 'object' && viewModeValue !== null) {
        // Legacy nested breakpoint format: { mobile: 12, tablet: 12, desktop: 8 }
        colSpan = viewModeValue.desktop || viewModeValue.tablet || viewModeValue.mobile || 12;
        colSpanClass = `col-span-${colSpan}`;
      } else {
        colSpan = 12;
        colSpanClass = 'col-span-12';
      }
    }

    const rowSpan = slot.rowSpan || 1;
    const height = slot.styles?.minHeight ? parseInt(slot.styles.minHeight) : undefined;

    return (
      <GridColumn
        key={slot.id}
        colSpan={colSpan}
        colSpanClass={colSpanClass}
        useTailwindClass={useTailwindClass}
        rowSpan={rowSpan}
        height={height}
        slotId={slot.id}
        slot={slot}
        slots={slots}
        currentDragInfo={currentDragInfo}
        setCurrentDragInfo={setCurrentDragInfo}
        onGridResize={onGridResize}
        onSlotHeightResize={onSlotHeightResize}
        onSlotDrop={onSlotDrop}
        onSlotDelete={onSlotDelete}
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
        mode={mode}
        viewMode={viewMode}
        showBorders={showBorders}
        isNested={true}
        selectedElementId={selectedElementId}
      >
          {slot.type === 'text' && mode === 'edit' && !slot.metadata?.disableResize && (
            <div
              style={{ display: 'inline-block', position: 'relative' }}
            >
              <ResizeWrapper
                minWidth={20}
                minHeight={16}
                hideBorder={selectedElementId === slot.id}
                onResize={(newSize) => {
                setPageConfig(prevConfig => {
                  const updatedSlots = { ...prevConfig?.slots };
                  if (updatedSlots[slot.id]) {
                    updatedSlots[slot.id] = {
                      ...updatedSlots[slot.id],
                      styles: {
                        ...updatedSlots[slot.id].styles,
                        width: `${newSize.width}${newSize.widthUnit || 'px'}`,
                        height: newSize.height !== 'auto' ? `${newSize.height}${newSize.heightUnit || 'px'}` : 'auto'
                      }
                    };
                  }

                  const updatedConfig = { ...prevConfig, slots: updatedSlots };

                  // Debounced auto-save - clear previous timeout and set new one
                  if (saveTimeoutRef && saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                  }
                  if (saveTimeoutRef && saveConfiguration) {
                    saveTimeoutRef.current = setTimeout(() => {
                      saveConfiguration(updatedConfig);
                    }, 500); // Wait 0.5 seconds after resize stops
                  }

                  return updatedConfig;
                });
              }}
            >
              <span
                className={`${processedParentClassName} ${slot.className || ''}`}
                style={(() => {
                  const finalStyles = {
                    ...slot.styles,
                    cursor: 'pointer',
                    ...(slot.className?.includes('italic') && { fontStyle: 'italic' }),
                    display: 'inline-block',
                    // Use fit-content for w-fit elements, otherwise 100%
                    width: slot.className?.includes('w-fit') ? 'fit-content' : '100%',
                  };
                  return finalStyles;
                })()}
                ref={(el) => {
                  if (el) {
                    // Try to force apply styles if they exist
                    if (slot.styles && Object.keys(slot.styles).length > 0) {
                      Object.entries(slot.styles).forEach(([property, value]) => {
                        if (value && property !== 'lastModified') {
                          const oldValue = el.style[property];
                          el.style[property] = value;
                        }
                      });
                    }
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Don't open Editor Sidebar if we're in the middle of a drag operation
                  if (!currentDragInfo) {
                    onElementClick(slot.id, e.currentTarget);
                  }
                }}
                data-slot-id={slot.id}
                data-editable="true"
                dangerouslySetInnerHTML={{
                  __html: String(slot.content || `Text: ${slot.id}`)
                }}
              />
            </ResizeWrapper>
            </div>
          )}

          {slot.type === 'text' && mode === 'edit' && slot.metadata?.disableResize && (
            <span
              className={`${processedParentClassName} ${slot.className} resize-none select-none`}
              style={{
                ...slot.styles,
                cursor: 'pointer',
                display: 'inline-block',
                boxSizing: 'border-box',
                border: '1px dashed transparent',
                borderRadius: '4px',
                transition: 'border-color 0.2s ease-in-out',
                position: 'relative',
                ...(slot.className?.includes('italic') && { fontStyle: 'italic' })
              }}
              data-slot-id={slot.id}
              data-editable="true"
              dangerouslySetInnerHTML={{
                __html: String(slot.content || `Text: ${slot.id}`)
              }}
            />
          )}

          {slot.type === 'text' && mode !== 'edit' && (
            <span
              className={`${processedParentClassName} ${slot.className}`}
              style={{
                ...slot.styles,
                ...(slot.className?.includes('italic') && { fontStyle: 'italic' })
              }}
              dangerouslySetInnerHTML={{
                __html: String(slot.content || `Text: ${slot.id}`)
              }}
            />
          )}

          {slot.type === 'button' && mode === 'edit' && !slot.metadata?.disableResize && (
            <div
              style={{ display: 'inline-block' }}
            >
              <ResizeWrapper
              minWidth={50}
              minHeight={20}
              onResize={(newSize) => {
                setPageConfig(prevConfig => {
                  const updatedSlots = { ...prevConfig?.slots };
                  if (updatedSlots[slot.id]) {
                    updatedSlots[slot.id] = {
                      ...updatedSlots[slot.id],
                      styles: {
                        ...updatedSlots[slot.id].styles,
                        width: `${newSize.width}${newSize.widthUnit || 'px'}`,
                        height: newSize.height !== 'auto' ? `${newSize.height}${newSize.heightUnit || 'px'}` : 'auto'
                      }
                    };
                  }

                  const updatedConfig = { ...prevConfig, slots: updatedSlots };

                  // Debounced auto-save - clear previous timeout and set new one
                  if (saveTimeoutRef && saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                  }
                  if (saveTimeoutRef && saveConfiguration) {
                    saveTimeoutRef.current = setTimeout(() => {
                      saveConfiguration(updatedConfig);
                    }, 500); // Wait 0.5 seconds after resize stops
                  }

                  return updatedConfig;
                });
              }}
            >
              <button
                className={`${processedParentClassName} ${slot.className}`}
                style={(() => {
                  const finalStyles = {
                    ...slot.styles,
                    cursor: 'pointer',
                    minWidth: 'auto',
                    minHeight: 'auto',
                    display: 'inline-block'
                  };
                  return finalStyles;
                })()}
                ref={(el) => {
                  if (el) {
                    // Try to force apply styles if they exist
                    if (slot.styles && Object.keys(slot.styles).length > 0) {
                      Object.entries(slot.styles).forEach(([property, value]) => {
                        if (value && property !== 'lastModified') {
                          const oldValue = el.style[property];
                          el.style[property] = value;
                        }
                      });
                    }
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onElementClick(slot.id, e.currentTarget);
                }}
                data-slot-id={slot.id}
                data-editable="true"
              >
                {(() => {
                  // For buttons, extract text content only (no HTML wrappers)
                  const content = String(slot.content || `Button: ${slot.id}`);
                  if (content.includes('<')) {
                    // If content contains HTML, extract just the text
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = content;
                    return tempDiv.textContent || tempDiv.innerText || content;
                  }
                  return content;
                })()}
              </button>
            </ResizeWrapper>
            </div>
          )}

          {slot.type === 'button' && mode === 'edit' && slot.metadata?.disableResize && (
            <button
              className={`${processedParentClassName} ${slot.className}`}
              style={{
                ...slot.styles,
                cursor: 'pointer'
              }}
              data-slot-id={slot.id}
              data-editable="true"
            >
              {(() => {
                const content = slot.content || `Button: ${slot.id}`;
                if (content.includes('<') && content.includes('>')) {
                  const tempDiv = document.createElement('div');
                  tempDiv.innerHTML = content;
                  return tempDiv.textContent || tempDiv.innerText || content;
                }
                return content;
              })()}
            </button>
          )}

              {slot.type === 'button' && mode !== 'edit' && (
                <button
                  className={`${processedParentClassName} ${slot.className}`}
                  style={{
                    ...slot.styles,
                    minWidth: 'auto',
                    minHeight: 'auto'
                  }}
                >
                  {(() => {
                    // For buttons, extract text content only (no HTML wrappers)
                    const content = String(slot.content || `Button: ${slot.id}`);
                    if (content.includes('<')) {
                      // If content contains HTML, extract just the text
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = content;
                      return tempDiv.textContent || tempDiv.innerText || content;
                    }
                    return content;
                  })()}
                </button>
              )}

              {slot.type === 'link' && mode === 'edit' && (
                <div
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', slot.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  style={{ display: 'inline-block' }}
                >
                  <ResizeWrapper
                      minWidth={50}
                      minHeight={20}
                      onResize={(newSize) => {
                        setPageConfig(prevConfig => {
                          const updatedSlots = { ...prevConfig?.slots };
                          if (updatedSlots[slot.id]) {
                            updatedSlots[slot.id] = {
                              ...updatedSlots[slot.id],
                              styles: {
                                ...updatedSlots[slot.id].styles,
                                width: `${newSize.width}${newSize.widthUnit || 'px'}`,
                                height: newSize.height !== 'auto' ? `${newSize.height}${newSize.heightUnit || 'px'}` : 'auto'
                              }
                            };
                          }

                          const updatedConfig = { ...prevConfig, slots: updatedSlots };

                          // Debounced auto-save - clear previous timeout and set new one
                          if (saveTimeoutRef && saveTimeoutRef.current) {
                            clearTimeout(saveTimeoutRef.current);
                          }
                          if (saveTimeoutRef && saveConfiguration) {
                            saveTimeoutRef.current = setTimeout(() => {
                              saveConfiguration(updatedConfig);
                            }, 500); // Wait 0.5 seconds after resize stops
                          }

                          return updatedConfig;
                        });
                      }}
                    >
                      <div className={slot.className?.includes('w-fit') ? 'w-fit h-full' : 'w-full h-full'}>
                        <a
                          href={slot.href || '#'}
                          className={`${processedParentClassName} ${slot.className}`}
                          style={{
                            ...slot.styles,
                            cursor: 'pointer',
                            minWidth: 'auto',
                            minHeight: 'auto',
                            display: 'inline-block',
                            width: slot.className?.includes('w-fit') ? 'fit-content' : '100%'
                          }}
                          target={slot.target || '_self'}
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onElementClick(slot.id, e.currentTarget);
                          }}
                          data-slot-id={slot.id}
                          data-editable="true"
                        >
                          {(() => {
                            // For links, extract text content only (no HTML wrappers)
                            const content = String(slot.content || `Link: ${slot.id}`);
                            if (content.includes('<')) {
                              // If content contains HTML, extract just the text
                              const tempDiv = document.createElement('div');
                              tempDiv.innerHTML = content;
                              return tempDiv.textContent || tempDiv.innerText || content;
                            }
                            return content;
                          })()}
                        </a>
                      </div>
                    </ResizeWrapper>
                </div>
              )}

              {slot.type === 'link' && mode !== 'edit' && (
                <a
                  href={slot.href || '#'}
                  className={`${processedParentClassName} ${slot.className}`}
                  style={{
                    ...slot.styles,
                    minWidth: 'auto',
                    minHeight: 'auto'
                  }}
                  target={slot.target || '_self'}
                  rel="noopener noreferrer"
                >
                  {(() => {
                    // For links, extract text content only (no HTML wrappers)
                    const content = String(slot.content || `Link: ${slot.id}`);
                    if (content.includes('<')) {
                      // If content contains HTML, extract just the text
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = content;
                      return tempDiv.textContent || tempDiv.innerText || content;
                    }
                    return content;
                  })()}
                </a>
              )}

              {(slot.type === 'container' || slot.type === 'grid' || slot.type === 'flex') && (
                <HierarchicalSlotRenderer
                  slots={slots}
                  parentId={slot.id}
                  mode={mode}
                  viewMode={viewMode}
                  showBorders={showBorders}
                  currentDragInfo={currentDragInfo}
                  setCurrentDragInfo={setCurrentDragInfo}
                  onElementClick={onElementClick}
                  onGridResize={onGridResize}
                  onSlotHeightResize={onSlotHeightResize}
                  onSlotDrop={onSlotDrop}
                  onSlotDelete={onSlotDelete}
                  onResizeStart={onResizeStart}
                  onResizeEnd={onResizeEnd}
                  categoryData={categoryData}
                  customSlotRenderer={customSlotRenderer}
                  selectedElementId={selectedElementId}
                  setPageConfig={setPageConfig}
                  saveConfiguration={saveConfiguration}
                  saveTimeoutRef={saveTimeoutRef}
                />
              )}

          {slot.type === 'image' && mode === 'edit' && (
            <div
              style={{ display: 'inline-block' }}
            >
              <ResizeWrapper
              minWidth={50}
              minHeight={50}
              initialWidth={slot.styles?.width}
              initialHeight={slot.styles?.height}
              onResize={(newSize) => {
                setPageConfig(prevConfig => {
                  const updatedSlots = { ...prevConfig?.slots };
                  if (updatedSlots[slot.id]) {
                    updatedSlots[slot.id] = {
                      ...updatedSlots[slot.id],
                      styles: {
                        ...updatedSlots[slot.id].styles,
                        width: `${newSize.width}${newSize.widthUnit || 'px'}`,
                        height: newSize.height !== 'auto' ? `${newSize.height}${newSize.heightUnit || 'px'}` : 'auto'
                      }
                    };
                  }

                  const updatedConfig = { ...prevConfig, slots: updatedSlots };

                  // Debounced auto-save - clear previous timeout and set new one
                  if (saveTimeoutRef && saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                  }
                  if (saveTimeoutRef && saveConfiguration) {
                    saveTimeoutRef.current = setTimeout(() => {
                      saveConfiguration(updatedConfig);
                    }, 500); // Wait 0.5 seconds after resize stops
                  }

                  return updatedConfig;
                });
              }}
            >
              <div
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onElementClick(slot.id, e.currentTarget);
                }}
                data-slot-id={slot.id}
                data-editable="true"
                style={{
                  cursor: 'pointer',
                  display: 'inline-block',
                  width: slot.styles?.width || '100%',
                  height: slot.styles?.height || '100%'
                }}
              >
                {slot.content ? (
                  <img
                    src={slot.content}
                    alt={slot.metadata?.alt || slot.metadata?.fileName || 'Slot image'}
                    className="w-full h-full object-contain"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%'
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-gray-100 border-2 border-dashed border-gray-300 rounded w-full h-full">
                    <Image className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">No image selected</span>
                  </div>
                )}
              </div>
            </ResizeWrapper>
            </div>
          )}

          {slot.type === 'input' && mode === 'edit' && (
            <div
              style={{ display: 'inline-block' }}
            >
              <ResizeWrapper
              minWidth={100}
              minHeight={30}
              onResize={(newSize) => {
                setPageConfig(prevConfig => {
                  const updatedSlots = { ...prevConfig?.slots };
                  if (updatedSlots[slot.id]) {
                    updatedSlots[slot.id] = {
                      ...updatedSlots[slot.id],
                      styles: {
                        ...updatedSlots[slot.id].styles,
                        width: `${newSize.width}${newSize.widthUnit || 'px'}`,
                        height: newSize.height !== 'auto' ? `${newSize.height}${newSize.heightUnit || 'px'}` : 'auto'
                      }
                    };
                  }

                  const updatedConfig = { ...prevConfig, slots: updatedSlots };

                  // Debounced auto-save - clear previous timeout and set new one
                  if (saveTimeoutRef && saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                  }
                  if (saveTimeoutRef && saveConfiguration) {
                    saveTimeoutRef.current = setTimeout(() => {
                      saveConfiguration(updatedConfig);
                    }, 500); // Wait 0.5 seconds after resize stops
                  }

                  return updatedConfig;
                });
              }}
            >
              <input
                className={`w-full h-full ${slot.className}`}
                style={{
                  ...slot.styles,
                  minWidth: 'auto',
                  minHeight: 'auto',
                  cursor: 'pointer'
                }}
                placeholder={String(slot.content || '')}
                type="text"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onElementClick(slot.id, e.currentTarget);
                }}
                data-slot-id={slot.id}
                data-editable="true"
              />
            </ResizeWrapper>
            </div>
          )}

          {slot.type === 'image' && mode !== 'edit' && (
            <div
              style={{
                ...slot.styles,
                display: 'inline-block',
                width: slot.styles?.width || '100%',
                height: slot.styles?.height || '100%'
              }}
            >
              {slot.content ? (
                <img
                  src={slot.content}
                  alt={slot.metadata?.alt || slot.metadata?.fileName || 'Slot image'}
                  className="w-full h-full object-contain"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-100 border-2 border-dashed border-gray-300 rounded w-full h-full">
                  <Image className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">No image selected</span>
                </div>
              )}
            </div>
          )}

          {slot.type === 'input' && mode !== 'edit' && (
            <input
              className={`w-full h-full ${slot.className}`}
              style={{
                ...slot.styles,
                minWidth: 'auto',
                minHeight: 'auto'
              }}
              placeholder={String(slot.content || '')}
              type="text"
            />
          )}

          {slot.type !== 'button' && slot.type !== 'link' && slot.type !== 'text' && slot.type !== 'image' && slot.type !== 'input' && slot.type !== 'container' && slot.type !== 'grid' && slot.type !== 'flex' && (
                <EditableElement
                  slotId={slot.id}
                  mode={mode}
                  onClick={onElementClick}
                  className={processedParentClassName}
                  style={slot.styles || {}}
                  canResize={true}
                  draggable={true}
                  selectedElementId={selectedElementId}
                  onElementResize={(newSize) => {
                    setPageConfig(prevConfig => {
                      const updatedSlots = { ...prevConfig?.slots };
                      if (updatedSlots[slot.id]) {
                        updatedSlots[slot.id] = {
                          ...updatedSlots[slot.id],
                          styles: {
                            ...updatedSlots[slot.id].styles,
                            width: `${newSize.width}${newSize.widthUnit || 'px'}`,
                            height: newSize.height !== 'auto' ? `${newSize.height}${newSize.heightUnit || 'px'}` : 'auto'
                          }
                        };
                      }

                      const updatedConfig = { ...prevConfig, slots: updatedSlots };

                      // Debounced auto-save - clear previous timeout and set new one
                      if (saveTimeoutRef && saveTimeoutRef.current) {
                        clearTimeout(saveTimeoutRef.current);
                      }
                      if (saveTimeoutRef && saveConfiguration) {
                        saveTimeoutRef.current = setTimeout(() => {
                          saveConfiguration(updatedConfig);
                        }, 500); // Wait 0.5 seconds after resize stops
                      }

                      return updatedConfig;
                    });
                  }}
                >

                  {/* First try custom renderer for ALL slot types */}
                  {(() => {
                    if (customSlotRenderer) {
                      // Pass context to custom slot renderer
                      const customContent = customSlotRenderer(slot, {
                        layoutConfig: { slots },
                        storeSettings: categoryData?.storeSettings,
                        viewMode,
                        mode,
                        onElementClick
                      });

                      if (customContent) {
                        return customContent;
                      }
                    } else {
                    }
                    return null;
                  })()}

                  {/* Render container content using custom renderer if available */}
                  {(slot.type === 'container' || slot.type === 'grid' || slot.type === 'flex') && (() => {
                    // Fall back to default HTML content rendering if custom renderer didn't provide content
                    if (slot.content) {
                      return <div dangerouslySetInnerHTML={{ __html: slot.content }} />;
                    }

                    return null;
                  })()}

                  {/* Render child slots */}
                  {(slot.type === 'container' || slot.type === 'grid' || slot.type === 'flex') && (
                    <HierarchicalSlotRenderer
                      slots={slots}
                      parentId={slot.id}
                      mode={mode}
                      viewMode={viewMode}
                      showBorders={showBorders}
                      categoryData={categoryData}
                      customSlotRenderer={customSlotRenderer}
                      currentDragInfo={currentDragInfo}
                      setCurrentDragInfo={setCurrentDragInfo}
                      onElementClick={onElementClick}
                      onGridResize={onGridResize}
                      onSlotHeightResize={onSlotHeightResize}
                      onSlotDrop={onSlotDrop}
                      onSlotDelete={onSlotDelete}
                      onResizeStart={onResizeStart}
                      onResizeEnd={onResizeEnd}
                      selectedElementId={selectedElementId}
                      setPageConfig={setPageConfig}
                      saveConfiguration={saveConfiguration}
                      saveTimeoutRef={saveTimeoutRef}
                    />
                  )}
                </EditableElement>
              )}
      </GridColumn>
    );
  });
}

// BorderToggleButton Component
export function BorderToggleButton({ showSlotBorders, onToggle }) {
  return (
    <Button
      onClick={onToggle}
      variant={showSlotBorders ? "default" : "outline"}
      size="sm"
      title={showSlotBorders ? "Hide slot borders" : "Show slot borders"}
    >
      <Square className="w-4 h-4 mr-2" />
      Borders
    </Button>
  );
}

// EditorToolbar Component
export function EditorToolbar({ onResetLayout, onAddSlot, onShowCode, currentViewport, onViewportChange }) {
  return (
    <div className="flex mx-6 mb-3 pt-2 justify-end">
      <div className="flex gap-2 items-center">
        {/* Viewport Mode Selector */}
        {currentViewport && onViewportChange && (
          <ViewportModeSelector
            currentViewport={currentViewport}
            onViewportChange={onViewportChange}
            className="mr-2"
          />
        )}

        <Button
          onClick={onAddSlot}
          variant="outline"
          size="sm"
          className="hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors duration-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New
        </Button>

        <Button
          onClick={onShowCode}
          variant="outline"
          size="sm"
          className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors duration-200"
        >
          <Code className="w-4 h-4 mr-2" />
          Code
        </Button>

        <Button
            onClick={onResetLayout}
            variant="outline"
            size="sm"
            className="hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors duration-200"
        >
          <Settings className="w-4 h-4 mr-2" />
          Reset Layout
        </Button>



      </div>
    </div>
  );
}

// AddSlotModal Component
export function AddSlotModal({
  isOpen,
  onClose,
  onCreateSlot,
  onShowFilePicker,
  onShowWidgetSelector
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Add New Slot</h3>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => {
              onCreateSlot('container');
              onClose();
            }}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3"
          >
            <div className="flex items-center">
              <Square className="w-5 h-5 mr-3 text-blue-600" />
              <div>
                <div className="font-medium">Container</div>
                <div className="text-sm text-gray-500">A flexible container for other elements</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => {
              onCreateSlot('text', 'New text content');
              onClose();
            }}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3"
          >
            <div className="flex items-center">
              <span className="w-5 h-5 mr-3 text-green-600 font-bold">T</span>
              <div>
                <div className="font-medium">Text</div>
                <div className="text-sm text-gray-500">Add text content</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => {
              onCreateSlot('button', 'Click me');
              onClose();
            }}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3"
          >
            <div className="flex items-center">
              <span className="w-5 h-5 mr-3 text-blue-600 font-bold">B</span>
              <div>
                <div className="font-medium">Button</div>
                <div className="text-sm text-gray-500">Add a clickable button</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => {
              onCreateSlot('link', 'Link text');
              onClose();
            }}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3"
          >
            <div className="flex items-center">
              <span className="w-5 h-5 mr-3 text-indigo-600 font-bold">🔗</span>
              <div>
                <div className="font-medium">Link</div>
                <div className="text-sm text-gray-500">Add a clickable link</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => {
              onClose();
              onShowFilePicker();
            }}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3"
          >
            <div className="flex items-center">
              <span className="w-5 h-5 mr-3 text-purple-600">🖼️</span>
              <div>
                <div className="font-medium">Image</div>
                <div className="text-sm text-gray-500">Add an image from File Library</div>
              </div>
            </div>
          </Button>

          <Button
            onClick={() => {
              onClose();
              onShowWidgetSelector();
            }}
            variant="outline"
            className="w-full justify-start text-left h-auto py-3"
          >
            <div className="flex items-center">
              <span className="w-5 h-5 mr-3 text-orange-600">🧩</span>
              <div>
                <div className="font-medium">Plugin Widgets</div>
                <div className="text-sm text-gray-500">Add widgets from installed plugins</div>
              </div>
            </div>
          </Button>

          <Button
            disabled
            variant="outline"
            className="w-full justify-start text-left h-auto py-3 opacity-60 cursor-not-allowed"
          >
            <div className="flex items-center">
              <span className="w-5 h-5 mr-3 text-teal-600">📝</span>
              <div>
                <div className="font-medium flex items-center gap-2">
                  Forms
                  <Badge className="bg-teal-100 text-teal-800 text-xs">Coming Soon</Badge>
                </div>
                <div className="text-sm text-gray-500">Form inputs and submission handling</div>
              </div>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ResetLayoutModal Component
export function ResetLayoutModal({
  isOpen,
  onClose,
  onConfirm,
  isResetting = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-red-600">Reset Layout</h3>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
            <div className="text-red-600">⚠️</div>
            <div>
              <p className="font-medium text-red-800">This action cannot be undone</p>
              <p className="text-sm text-red-600">All current layout changes will be lost and replaced with the default configuration.</p>
              <p className="text-sm text-amber-600 font-medium mt-1">Only affects the current page - other pages remain unchanged.</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              variant="destructive"
              className="flex-1"
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Layout'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// DestroyLayoutModal Component
export function DestroyLayoutModal({
  isOpen,
  onClose,
  onConfirm,
  isDestroying = false
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-red-600">Destroy Layout</h3>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded">
            <div className="text-red-600">⚠️</div>
            <div>
              <p className="font-medium text-red-800">This action cannot be undone</p>
              <p className="text-sm text-red-600">All current layout changes AND all version history will be permanently deleted.</p>
              <p className="text-sm text-red-700 font-medium mt-1">A fresh default configuration will be created.</p>
              <p className="text-sm text-amber-600 font-medium mt-1">Only affects the current page - other pages remain unchanged.</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              variant="destructive"
              className="flex-1"
              disabled={isDestroying}
            >
              {isDestroying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Destroying...
                </>
              ) : (
                'Destroy Layout'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// FilePickerModalWrapper Component
export function FilePickerModalWrapper({
  isOpen,
  onClose,
  onCreateSlot,
  fileType = "image"
}) {
  return (
    <FilePickerModal
      isOpen={isOpen}
      onClose={onClose}
      onSelect={(selectedFile) => {
        // Create image slot with selected file
        onCreateSlot('image', selectedFile.url, 'main_layout', {
          src: selectedFile.url,
          alt: selectedFile.name,
          fileName: selectedFile.name,
          mimeType: selectedFile.mimeType
        });
      }}
      fileType={fileType}
    />
  );
}

// TimestampsRow Component
export function TimestampsRow({
  draftConfig,
  latestPublished,
  formatTimeAgo
}) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-2">
      <div className="flex justify-between items-center text-xs text-gray-500 pb-6">
        <div className="flex items-center">
          {draftConfig?.updated_at && (
            <span>Last modified: {formatTimeAgo(draftConfig.updated_at)}</span>
          )}
        </div>

        <div className="flex items-center">
          {latestPublished?.published_at && (
            <span>Last published: {formatTimeAgo(latestPublished.published_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// CodeModal Component - Using advanced CodeEditor with split review
export function CodeModal({
  isOpen,
  onClose,
  configuration = {},
  onSave,
  localSaveStatus
}) {
  const [editorValue, setEditorValue] = useState('');
  const [originalValue, setOriginalValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [jsonError, setJsonError] = useState(null);
  const [key, setKey] = useState(0); // Force re-render of CodeEditor
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize editor value when modal opens
  useEffect(() => {
    if (isOpen) {
      const jsonString = JSON.stringify(configuration, null, 2);
      setEditorValue(jsonString);
      setOriginalValue(jsonString);
      setHasChanges(false);
      setJsonError(null);
      setKey(prev => prev + 1); // Force CodeEditor to re-initialize
    }
  }, [isOpen, configuration]);

  if (!isOpen) return null;

  const handleEditorChange = (value) => {
    setEditorValue(value || '');
    setHasChanges(value !== originalValue);

    // Validate JSON
    try {
      if (value) JSON.parse(value);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handleSave = () => {
    setSaveSuccess(false);
    try {
      const parsedConfig = JSON.parse(editorValue);
      if (onSave) {
        onSave(parsedConfig);
        setOriginalValue(editorValue);
        setHasChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Invalid JSON:', err);
      setJsonError(err.message);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Configuration JSON Editor</h2>
            {hasChanges && (
              <Badge className="bg-yellow-100 text-yellow-800">Modified</Badge>
            )}
            {jsonError && (
              <Badge className="bg-red-100 text-red-800">Invalid JSON</Badge>
            )}
            {localSaveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {localSaveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </div>
            )}
            {localSaveStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <X className="w-4 h-4" />
                <span>Save Failed</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SaveButton
              onClick={handleSave}
              loading={localSaveStatus === 'saving'}
              success={saveSuccess}
              disabled={!!jsonError}
              size="sm"
            />
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* JSON Error Display */}
        {jsonError && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex-shrink-0">
            <p className="text-sm text-red-700">
              <span className="font-semibold">JSON Error:</span> {jsonError}
            </p>
          </div>
        )}

        {/* CodeEditor with Split Review */}
        <div className="flex-1 overflow-hidden">
          <CodeEditor
            key={key}
            value={editorValue}
            onChange={handleEditorChange}
            language="json"
            fileName="configuration.json"
            originalCode={originalValue}
            initialContent={originalValue}
            enableDiffDetection={true}
            className="h-full"
            onManualEdit={(newCode, oldCode, context) => {
              // Handle manual edits - this enables diff detection
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500 flex-shrink-0">
          <span>Use the toolbar above to switch between Editor, Split View, Diff View, and Preview modes</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ViewportModeSelector Component
export function ViewportModeSelector({
  currentViewport = 'desktop',
  onViewportChange,
  className = ''
}) {
  const viewportModes = [
    {
      key: 'mobile',
      label: 'Mobile',
      icon: Smartphone,
      width: '375px',
      description: 'Mobile view (375px)'
    },
    {
      key: 'tablet',
      label: 'Tablet',
      icon: Tablet,
      width: '768px',
      description: 'Tablet view (768px)'
    },
    {
      key: 'desktop',
      label: 'Desktop',
      icon: Monitor,
      width: '100%',
      description: 'Desktop view (100%)'
    }
  ];

  return (
    <div className={`flex bg-gray-100 rounded-lg p-1 ${className}`}>
      {viewportModes.map((mode) => {
        const Icon = mode.icon;
        return (
          <button
            key={mode.key}
            onClick={() => onViewportChange(mode.key)}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              currentViewport === mode.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
            title={mode.description}
          >
            <Icon className="w-4 h-4 mr-1.5" />
          </button>
        );
      })}
    </div>
  );
}

// ResponsiveContainer Component - Wraps content with responsive viewport sizing
export function ResponsiveContainer({
  viewport = 'desktop',
  children,
  className = ''
}) {
  const getViewportStyles = () => {
    switch (viewport) {
      case 'mobile':
        return {
          width: '375px',
          minHeight: '667px',
          margin: '0 auto',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          overflow: 'visible' // Changed from 'hidden' to allow dropdowns
        };
      case 'tablet':
        return {
          width: '768px',
          minHeight: '1024px',
          margin: '0 auto',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          overflow: 'visible' // Changed from 'hidden' to allow dropdowns
        };
      case 'desktop':
      default:
        return {
          width: '100%',
          maxWidth: 'none',
          minHeight: 'auto'
        };
    }
  };

  // For desktop, don't apply any container constraints - use full width
  if (viewport === 'desktop') {
    return (
      <div
        className={`responsive-container ${className}`}
        style={getViewportStyles()}
      >
        {children}
      </div>
    );
  }

  // For mobile and tablet, center the container
  return (
    <div className="w-full bg-gray-50 py-4">
      <div
        className={`responsive-container ${className}`}
        style={getViewportStyles()}
      >
        {children}
      </div>
    </div>
  );
}

// WidgetSelectorModal Component
export function WidgetSelectorModal({
  isOpen,
  onClose,
  onSelectWidget
}) {
  const [widgets, setWidgets] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (isOpen) {
      loadWidgets();
    }
  }, [isOpen]);

  const loadWidgets = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/plugins/widgets');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load widgets');
      }

      setWidgets(result.widgets || []);
    } catch (err) {
      console.error('Failed to load plugin widgets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWidget = (widget) => {
    onSelectWidget(widget);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[500px] max-h-[600px] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Select Plugin Widget</h3>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
          >
            ×
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading widgets...</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
            <p className="font-medium">Error loading widgets</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && widgets.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">🧩</div>
            <p className="font-medium">No Widgets Available</p>
            <p className="text-sm mt-1">Create plugin widgets to add them here</p>
          </div>
        )}

        {!loading && !error && widgets.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-2">
            {widgets.map(widget => (
              <Button
                key={widget.id}
                onClick={() => handleSelectWidget(widget)}
                variant="outline"
                className="w-full justify-start text-left h-auto py-3 hover:bg-purple-50 hover:border-purple-300"
              >
                <div className="flex items-start w-full">
                  <span className="w-8 h-8 mr-3 text-purple-600 flex items-center justify-center bg-purple-100 rounded">
                    🧩
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{widget.name}</div>
                    <div className="text-sm text-gray-500">{widget.description || 'No description'}</div>
                    <div className="text-xs text-purple-600 mt-1">
                      From: {widget.pluginName}
                    </div>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

