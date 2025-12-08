/**
 * EditOverlay.jsx - Overlay-based editing controls for slots
 *
 * =====================================================================
 * PURPOSE: Provide drag, resize, and selection capabilities as an overlay
 * on top of rendered slot content, rather than wrapping the content.
 * This ensures the same DOM structure in editor and storefront.
 * =====================================================================
 *
 * ARCHITECTURE:
 *
 * Traditional approach (GridColumn wrapper):
 * <GridColumn>           <- Adds extra DOM, changes structure
 *   <SlotContent />
 * </GridColumn>
 *
 * New approach (EditOverlay):
 * <div className="relative">
 *   <SlotContent />      <- Same as storefront
 *   <EditOverlay />      <- Positioned absolutely, pointer-events-none base
 * </div>
 *
 * The overlay uses pointer-events-none on the base layer and
 * pointer-events-auto only on interactive handles.
 *
 * @module EditOverlay
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Move, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * EditOverlay - Provides editing controls as an overlay
 *
 * @param {Object} props
 * @param {string} props.slotId - Unique slot identifier
 * @param {Object} props.slot - Slot configuration
 * @param {string} props.mode - 'edit' | 'preview' | 'live'
 * @param {boolean} props.isSelected - Whether this slot is currently selected
 * @param {boolean} props.showBorders - Whether to show slot borders
 * @param {Function} props.onSelect - Callback when slot is selected
 * @param {Function} props.onDragStart - Callback when drag starts
 * @param {Function} props.onDragEnd - Callback when drag ends
 * @param {Function} props.onDrop - Callback when something is dropped
 * @param {Function} props.onResize - Callback for resize operations
 * @param {Function} props.onDelete - Callback for delete operation
 * @param {Object} props.currentDragInfo - Current drag state
 * @param {Function} props.setCurrentDragInfo - Set drag state
 */
export function EditOverlay({
  slotId,
  slot,
  mode = 'edit',
  isSelected = false,
  showBorders = true,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  onResize,
  onDelete,
  currentDragInfo,
  setCurrentDragInfo,
  children,
  // Grid layout support - pass through the colSpan class to preserve grid layout
  className = '',
  style = {},
}) {
  // =========================================================================
  // CRITICAL: All hooks must be called unconditionally before any early returns
  // to comply with React's Rules of Hooks (Error #300: "Rendered fewer hooks")
  // =========================================================================

  const [isHovered, setIsHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropZone, setDropZone] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const overlayRef = useRef(null);

  const isContainerType = ['container', 'grid', 'flex'].includes(slot?.type);

  // Handle click to select
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(slotId, slot);
    }
  }, [slotId, slot, onSelect]);

  // Drag handlers
  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', slotId);
    e.dataTransfer.effectAllowed = 'move';

    if (setCurrentDragInfo) {
      setCurrentDragInfo({
        draggedSlotId: slotId,
        slotId: slotId,
        parentId: slot?.parentId,
        startPosition: { x: e.clientX, y: e.clientY }
      });
    }

    // Custom drag image
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
      ">
        ${slotId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </div>
    `;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 60, 20);
    setTimeout(() => document.body.removeChild(dragImage), 100);

    if (onDragStart) {
      onDragStart(slotId, slot, e);
    }
  }, [slotId, slot, setCurrentDragInfo, onDragStart]);

  const handleDragEnd = useCallback((e) => {
    e.stopPropagation();
    setIsDragging(false);
    setIsDragOver(false);
    setDropZone(null);

    if (setCurrentDragInfo) {
      setCurrentDragInfo(null);
    }

    if (onDragEnd) {
      onDragEnd(slotId, slot, e);
    }
  }, [slotId, slot, setCurrentDragInfo, onDragEnd]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!isDragging) {
      setIsDragOver(true);

      // Calculate drop zone based on mouse position
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      let zone = 'inside';

      if (isContainerType) {
        // For containers, allow dropping inside
        if (y < height * 0.25) zone = 'before';
        else if (y > height * 0.75) zone = 'after';
        else zone = 'inside';
      } else {
        // For non-containers, detect left/right/before/after
        if (x < width * 0.3) zone = 'left';
        else if (x > width * 0.7) zone = 'right';
        else if (y < height * 0.5) zone = 'before';
        else zone = 'after';
      }

      setDropZone(zone);
    }
  }, [isDragging, isContainerType]);

  const handleDragLeave = useCallback((e) => {
    // Only clear if leaving the element entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
      setDropZone(null);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const draggedSlotId = e.dataTransfer.getData('text/plain');

    setIsDragOver(false);
    setDropZone(null);

    if (onDrop && draggedSlotId !== slotId) {
      onDrop(draggedSlotId, slotId, dropZone, slot);
    }
  }, [slotId, slot, dropZone, onDrop]);

  // =========================================================================
  // Early return AFTER all hooks have been called
  // In preview/live mode, render with grid classes but without editing controls
  // =========================================================================
  if (mode !== 'edit') {
    // CRITICAL: Must preserve grid column classes for proper layout
    return (
      <div
        className={className}
        style={style}
        data-slot-id={slotId}
      >
        {children}
      </div>
    );
  }

  // Determine border styling
  const getBorderClasses = () => {
    if (!showBorders) return '';

    if (isSelected) {
      return 'ring-2 ring-blue-500 ring-offset-1';
    }
    if (isDragOver) {
      return 'ring-2 ring-green-400 ring-offset-1';
    }
    if (isHovered) {
      return 'ring-1 ring-blue-300';
    }
    return 'ring-1 ring-gray-200 ring-dashed';
  };

  // Drop zone indicator styles
  const getDropZoneIndicator = () => {
    if (!isDragOver || !dropZone) return null;

    const indicatorStyles = {
      before: 'top-0 left-0 right-0 h-1 bg-blue-500',
      after: 'bottom-0 left-0 right-0 h-1 bg-blue-500',
      left: 'top-0 bottom-0 left-0 w-1 bg-blue-500',
      right: 'top-0 bottom-0 right-0 w-1 bg-blue-500',
      inside: 'inset-2 border-2 border-dashed border-blue-500 bg-blue-50/30',
    };

    return (
      <div
        className={cn('absolute pointer-events-none z-20', indicatorStyles[dropZone])}
      />
    );
  };

  return (
    <div
      ref={overlayRef}
      className={cn(
        'relative group',
        className, // Pass through grid classes (col-span-X, etc.)
        getBorderClasses(),
        isDragging && 'opacity-50'
      )}
      style={style}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-slot-id={slotId}
      data-slot-type={slot?.type}
    >
      {/* The actual slot content - rendered normally */}
      {children}

      {/* Drop zone indicator */}
      {getDropZoneIndicator()}

      {/* Edit controls - only visible on hover or selection */}
      {(isHovered || isSelected) && (
        <div className="absolute top-0 right-0 z-30 flex gap-1 p-1 bg-white/90 rounded-bl shadow-sm pointer-events-auto">
          {/* Drag handle */}
          <button
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-move"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Delete button */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(slotId, slot);
              }}
              className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete slot"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Resize handles */}
      {onResize && (isHovered || isSelected) && (
        <>
          {/* Horizontal resize handle (right edge) */}
          <ResizeHandle
            direction="horizontal"
            onResize={(delta) => onResize(slotId, 'width', delta)}
          />

          {/* Vertical resize handle (bottom edge) */}
          <ResizeHandle
            direction="vertical"
            onResize={(delta) => onResize(slotId, 'height', delta)}
          />
        </>
      )}

    </div>
  );
}

/**
 * ResizeHandle - Individual resize handle component
 */
function ResizeHandle({ direction, onResize }) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const isHorizontal = direction === 'horizontal';

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };

    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      const delta = isHorizontal
        ? e.clientX - startPosRef.current.x
        : e.clientY - startPosRef.current.y;

      if (onResize) {
        onResize(delta);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isHorizontal, onResize]);

  return (
    <div
      className={cn(
        'absolute z-30 pointer-events-auto',
        isHorizontal
          ? 'top-0 bottom-0 right-0 w-2 cursor-col-resize hover:bg-blue-400/50'
          : 'left-0 right-0 bottom-0 h-2 cursor-row-resize hover:bg-blue-400/50',
        isDragging && 'bg-blue-500/50'
      )}
      onMouseDown={handleMouseDown}
    />
  );
}

/**
 * EditOverlayProvider - Context provider for edit overlay state
 * Use this to coordinate selection and drag state across multiple overlays
 */
export function EditOverlayProvider({ children, mode = 'edit' }) {
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [currentDragInfo, setCurrentDragInfo] = useState(null);

  const contextValue = {
    selectedSlotId,
    setSelectedSlotId,
    currentDragInfo,
    setCurrentDragInfo,
    mode,
  };

  return (
    <EditOverlayContext.Provider value={contextValue}>
      {children}
    </EditOverlayContext.Provider>
  );
}

// Context for edit overlay state
export const EditOverlayContext = React.createContext({
  selectedSlotId: null,
  setSelectedSlotId: () => {},
  currentDragInfo: null,
  setCurrentDragInfo: () => {},
  mode: 'edit',
});

/**
 * useEditOverlay - Hook to access edit overlay context
 */
export function useEditOverlay() {
  return React.useContext(EditOverlayContext);
}

export default EditOverlay;
