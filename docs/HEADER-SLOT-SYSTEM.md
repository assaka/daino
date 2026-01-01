# Header Slot System - Key Technical Findings

This document captures critical implementation details and debugging knowledge for the header slot configuration system in both the storefront and editor.

## Table of Contents
1. [Viewport-Aware Responsive Behavior](#1-viewport-aware-responsive-behavior)
2. [Custom Grid Layouts & Drag-Drop](#2-custom-grid-layouts--drag-drop)
3. [Header Slot Drop Handler](#3-header-slot-drop-handler)
4. [Publish Cache Invalidation](#4-publish-cache-invalidation)
5. [Viewport Class Transformation](#5-viewport-class-transformation)
6. [Architecture Overview](#6-architecture-overview)
7. [Debugging Checklist](#7-debugging-checklist)

---

## 1. Viewport-Aware Responsive Behavior

### The Problem
CSS media queries work in the storefront but NOT in the editor preview. The editor renders at a fixed size regardless of the simulated viewport mode (desktop/tablet/mobile).

### The Solution
Components must use **JavaScript conditionals** based on `responsiveMode` prop instead of CSS media queries.

### Data Flow
```
AIWorkspaceContext (viewportMode)
    └── WorkspaceCanvas (gets viewportMode, passes to editor)
        └── Page Editors (accept viewportMode prop)
            └── UnifiedSlotsEditor (viewportMode → currentViewport)
                └── headerContext.responsiveMode
                    └── Header components (conditional rendering)
```

### Critical Implementation Points

**WorkspaceCanvas.jsx** - Get viewport from context:
```jsx
const { viewportMode } = useAIWorkspace();
const editorProps = {
  viewportMode: viewportMode || 'desktop',
  // ...
};
```

**Page Editors** (ProductSlotsEditor, CartSlotsEditor, etc.) - Use prop, not hardcoded:
```jsx
// WRONG - hardcoded viewport
headerContext: buildEditorHeaderContext({
  viewport: 'desktop',  // BAD
});

// CORRECT - use prop
headerContext: buildEditorHeaderContext({
  viewport: viewportMode,  // GOOD
});
```

**UnifiedSlotsEditor.jsx** - Always override responsiveMode:
```jsx
headerContext={{
  ...(configHeaderContext || buildEditorHeaderContext({...})),
  // Critical: Always override with current viewport from toolbar
  responsiveMode: currentViewport
}}
```

**Header Components** - JavaScript conditionals:
```jsx
// In UserAccountMenuSlot, CountrySelectorSlot, etc.
const isDesktopViewport = responsiveMode === 'desktop';

return (
  <Button className={`${isDesktopViewport ? 'px-4' : 'px-2'}`}>
    {getUserIcon()}
    {isDesktopViewport && <span>Sign In</span>}
  </Button>
);
```

---

## 2. Custom Grid Layouts & Drag-Drop

### The Problem
Header sections use custom grids like `repeat(8, auto)` instead of the standard 12-column grid. The drag-drop system was breaking because it couldn't detect these custom grids.

### The Solution
Detect custom grids by checking if gridTemplateColumns doesn't use standard `repeat(12, ...)`:

**UnifiedSlotRenderer.jsx**:
```jsx
const parentGridTemplate = parentSlot?.styles?.gridTemplateColumns;
const hasCustomGridTemplate = parentGridTemplate && (
  !parentGridTemplate.includes('repeat') ||
  (parentGridTemplate.includes('repeat') && !parentGridTemplate.includes('repeat(12'))
);

// For custom grids, use flex child mode
const isFlexChild = hasCustomGridTemplate;
```

### Why This Matters
- `isFlexChild: true` skips grid-column styles that would conflict
- Still wraps in GridColumn for drag-drop functionality
- Preserves the parent's custom grid layout

---

## 3. Header Slot Drop Handler

### The Problem
Dragging slots only updated `parentId` - slots moved between containers but didn't reorder within the same container.

### The Solution
Implement full position-based reordering by updating `position.col` values.

**UnifiedSlotsEditor.jsx** - `handleHeaderSlotDrop`:
```jsx
const handleHeaderSlotDrop = useCallback((draggedSlotId, targetSlotId, position) => {
  setHeaderLayoutConfig(prevConfig => {
    const slots = { ...prevConfig.slots };
    const draggedSlot = slots[draggedSlotId];
    const targetSlot = slots[targetSlotId];

    if (!draggedSlot || !targetSlot) return prevConfig;

    const sameParent = draggedSlot.parentId === targetSlot.parentId;

    if (position === 'inside') {
      // Move into container
      slots[draggedSlotId] = { ...draggedSlot, parentId: targetSlotId };
    } else if (sameParent && (position === 'before' || position === 'left')) {
      // Reorder within same container
      const siblings = Object.values(slots)
        .filter(s => s.parentId === draggedSlot.parentId)
        .sort((a, b) => (a.position?.col || 0) - (b.position?.col || 0));

      // Remove dragged, insert at target position
      const newOrder = siblings.filter(s => s.id !== draggedSlotId);
      const targetIndex = newOrder.findIndex(s => s.id === targetSlotId);
      newOrder.splice(targetIndex, 0, { ...draggedSlot, id: draggedSlotId });

      // Reassign position.col values
      newOrder.forEach((slot, index) => {
        slots[slot.id] = {
          ...slots[slot.id],
          position: { ...slots[slot.id].position, col: index + 1 }
        };
      });
    }
    // Similar for 'after'/'right'

    // Auto-save
    if (onHeaderSave) {
      onHeaderSave({ ...prevConfig, slots });
    }
    return { ...prevConfig, slots };
  });
}, [onHeaderSave]);
```

### Key Insight
Slot order is determined by `position.col` values. When reordering, you must:
1. Get all siblings in the same parent
2. Sort them by current position.col
3. Remove the dragged slot
4. Insert at the new position
5. Reassign sequential col values to all siblings

---

## 4. Publish Cache Invalidation

### The Problem
After publishing header changes, the storefront still showed the old layout due to a 5-minute bootstrap cache TTL.

### The Solution
Invalidate the bootstrap cache when publishing.

**backend/src/routes/slotConfigurations.js**:
```js
const { deletePattern } = require('../utils/cacheManager');

// In publishDraft function:
const { masterDbClient } = require('../database/masterConnection');
const { data: store } = await masterDbClient
  .from('stores')
  .select('slug')
  .eq('id', storeId)
  .single();

if (store?.slug) {
  const deleted = await deletePattern(`bootstrap:${store.slug}:*`);
  console.log(`[PUBLISH] Invalidated ${deleted} bootstrap cache entries for store ${store.slug}`);
}
```

### Cache Key Pattern
- Bootstrap cache uses: `bootstrap:{storeSlug}:*`
- Default TTL: 5 minutes (300000ms)
- Must invalidate on publish to show changes immediately

---

## 5. Viewport Class Transformation

### The Problem
Tailwind responsive prefixes (`lg:hidden`, `md:block`) don't work in editor preview because the viewport is simulated, not actual.

### The Solution
Transform responsive classes to non-prefixed versions based on viewport mode.

**UnifiedSlotRenderer.jsx** - `transformResponsiveClasses`:
```jsx
const transformResponsiveClasses = (classes, viewport) => {
  if (!classes || viewport === 'desktop') return classes;

  return classes.split(' ').map(cls => {
    // For tablet viewport, apply md: and lg: prefixed rules
    if (viewport === 'tablet') {
      if (cls.startsWith('lg:')) return cls.replace('lg:', '');
      if (cls.startsWith('md:')) return cls.replace('md:', '');
    }
    // For mobile viewport, apply all responsive rules
    if (viewport === 'mobile') {
      if (cls.startsWith('sm:')) return cls.replace('sm:', '');
      if (cls.startsWith('md:')) return cls.replace('md:', '');
      if (cls.startsWith('lg:')) return cls.replace('lg:', '');
    }
    return cls;
  }).join(' ');
};
```

---

## 6. Architecture Overview

### Key Files

| File | Purpose |
|------|---------|
| `src/components/editor/UnifiedSlotsEditor.jsx` | Main editor component, handles viewport sync, header integration |
| `src/components/editor/slot/UnifiedSlotRenderer.jsx` | Renders individual slots, handles grid/flex detection |
| `src/components/editor/slot/HeaderSlotComponents.jsx` | Header-specific slot renderers (UserAccount, CountrySelector, etc.) |
| `src/components/editor/editorHeaderUtils.js` | Builds header context for editor |
| `src/pages/editor/*SlotsEditor.jsx` | Page-specific editors (Product, Cart, Login, etc.) |
| `src/components/ai-workspace/WorkspaceCanvas.jsx` | Container that gets viewport mode and passes to editors |
| `backend/src/routes/slotConfigurations.js` | API endpoints including publishDraft |

### Context vs Props
- **AIWorkspaceContext**: Provides `viewportMode` at the workspace level
- **headerContext**: Contains `responsiveMode` for component rendering decisions
- Always sync these: `headerContext.responsiveMode = viewportMode`

### Editor vs Storefront
| Aspect | Editor | Storefront |
|--------|--------|------------|
| Responsive | JavaScript conditionals | CSS media queries |
| Viewport | Simulated via state | Real browser viewport |
| Cache | No caching | Bootstrap cache (5 min TTL) |
| Drag-drop | Enabled | Disabled |

---

## 7. Debugging Checklist

### Header not responding to viewport changes in editor?
1. Check `viewportMode` is passed from WorkspaceCanvas to page editor
2. Check page editor passes `viewportMode` to UnifiedSlotsEditor
3. Check UnifiedSlotsEditor overrides `responsiveMode` in headerContext
4. Check component uses JavaScript conditionals, not CSS media queries

### Drag-drop not working for header icons?
1. Check parent slot has custom gridTemplateColumns (e.g., `repeat(8, auto)`)
2. Verify `hasCustomGridTemplate` detection catches this pattern
3. Ensure `isFlexChild: true` is being applied
4. Verify GridColumn wrapper is still rendered for drag-drop

### Slots not reordering when dropped?
1. Check `handleHeaderSlotDrop` handles same-parent reordering
2. Verify `position.col` values are being updated
3. Check `onHeaderSave` is being called to persist changes

### Published changes not appearing in storefront?
1. Check bootstrap cache is being invalidated in `publishDraft`
2. Verify store slug is correctly fetched
3. Check `deletePattern` is called with correct pattern
4. Try hard refresh or wait 5 minutes for cache expiry

### Responsive classes not transforming correctly?
1. Check `transformResponsiveClasses` is called with correct viewport
2. Verify class string format matches expected pattern
3. Check viewport value is one of: 'desktop', 'tablet', 'mobile'

---

## Related Documentation
- [UnifiedSlotsEditor Implementation](../src/components/editor/UnifiedSlotsEditor.jsx)
- [Header Slot Components](../src/components/editor/slot/HeaderSlotComponents.jsx)
- [Slot Configuration API](../backend/src/routes/slotConfigurations.js)
