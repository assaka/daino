/**
 * Navigation Manager
 * Manage admin sidebar navigation order and visibility
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  GripVertical,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import apiClient from '@/api/client';
import { PageLoader } from '@/components/ui/page-loader';
import FlashMessage from '@/components/storefront/FlashMessage';

// Sortable Item Component
const SortableItem = ({ item, index, isChild, onMoveUp, onMoveDown, onToggleVisibility, onUpdateOrder, onUpdateParent, onToggleCollapse, isCollapsed, hasChildren, canMoveUp, canMoveDown, availableParents }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 rounded-lg border ${
        item.is_visible ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'
      } ${isChild ? 'ml-8' : ''}`}
    >
      {/* Drag Handle */}
      <div {...attributes} {...listeners} className="flex items-center text-gray-400 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Collapse Toggle (only for parent items) */}
      {hasChildren ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleCollapse}
          className="p-0 h-6 w-6"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      ) : (
        <div className="w-6" />
      )}

      {/* Order Position Input */}
      <Input
        type="number"
        min="1"
        value={item.order_position}
        onChange={(e) => onUpdateOrder(e.target.value)}
        className="w-20 text-center"
      />

      {/* Parent Selector */}
      <Select
        value={item.parent_key || 'none'}
        onValueChange={(value) => onUpdateParent(value === 'none' ? null : value)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Parent" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Top Level</SelectItem>
          {availableParents.map(parent => (
            <SelectItem key={parent.key} value={parent.key}>
              {parent.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Item Details */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{item.label}</span>
          {item.is_core && (
            <Badge variant="secondary" className="text-xs">Core</Badge>
          )}
          {item.plugin_id && (
            <Badge variant="outline" className="text-xs">Plugin</Badge>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {item.route} • {item.icon}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={onMoveUp}
          disabled={!canMoveUp}
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onMoveDown}
          disabled={!canMoveDown}
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleVisibility}
        >
          {item.is_visible ? (
            <Eye className="w-4 h-4 text-green-600" />
          ) : (
            <EyeOff className="w-4 h-4 text-gray-400" />
          )}
        </Button>
      </div>
    </div>
  );
};

const NavigationManager = () => {
  const [navItems, setNavItems] = useState([]);
  const [originalItems, setOriginalItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [collapsedItems, setCollapsedItems] = useState(new Set());
  const [flashMessage, setFlashMessage] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadNavigationItems();
  }, []);

  const loadNavigationItems = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('admin/navigation');

      // Flatten the tree into a flat array for editing, preserving parent info
      // This flattens hierarchically: parent first, then its children, then next parent
      const flattenTree = (items, parent_key = null, result = []) => {
        items.forEach(item => {
          const { children, ...itemWithoutChildren } = item;
          result.push({
            ...itemWithoutChildren,
            parent_key: item.parent_key || parent_key,
            children: children || []
          });
          if (children && children.length > 0) {
            flattenTree(children, item.key, result);
          }
        });
        return result;
      };

      // Sort items hierarchically: top-level by position, children grouped under parent
      const sortHierarchically = (items) => {
        // Separate top-level and children
        const topLevel = items.filter(item => !item.parent_key);
        const children = items.filter(item => item.parent_key);

        // Sort top-level by order_position
        topLevel.sort((a, b) => a.order_position - b.order_position);

        // Group children by parent
        const childrenByParent = {};
        children.forEach(child => {
          if (!childrenByParent[child.parent_key]) {
            childrenByParent[child.parent_key] = [];
          }
          childrenByParent[child.parent_key].push(child);
        });

        // Sort each group of children
        Object.values(childrenByParent).forEach(group => {
          group.sort((a, b) => a.order_position - b.order_position);
        });

        // Build final sorted array: parent, then its children, then next parent
        const sorted = [];
        topLevel.forEach(parent => {
          sorted.push(parent);
          if (childrenByParent[parent.key]) {
            sorted.push(...childrenByParent[parent.key]);
          }
        });

        // Add any orphaned children at the end (children without valid parent)
        children.forEach(child => {
          if (!topLevel.find(p => p.key === child.parent_key)) {
            if (!sorted.includes(child)) {
              sorted.push(child);
            }
          }
        });

        return sorted;
      };

      // Handle both hierarchical (from backend) and flat array responses
      let items;

      // Check if response has data property (axios wraps responses)
      const data = response.data || response;

      if (data.navigation && Array.isArray(data.navigation)) {
        // Backend returns {success: true, navigation: [...]}
        items = flattenTree(data.navigation);
      } else if (Array.isArray(data)) {
        // Fallback: direct array
        items = data;
      } else {
        console.error('Unexpected response structure:', response);
        throw new Error('Invalid response format');
      }

      const sortedItems = sortHierarchically(items);
      setNavItems(sortedItems);
      setOriginalItems(JSON.parse(JSON.stringify(sortedItems)));
    } catch (error) {
      console.error('Error loading navigation:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load navigation items: ' + (error.message || 'Unknown error') });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to recalculate all order positions correctly
  // Top-level items: 10, 20, 30...
  // Children: 1, 2, 3... within each parent
  // IMPORTANT: Uses array order (not order_position) to determine new positions
  const recalculateOrderPositions = (items) => {
    const newItems = items.map(item => ({ ...item }));

    // Get top-level items in ARRAY order (the order they appear in the list)
    const topLevelKeys = [];
    newItems.forEach(item => {
      if (!item.parent_key && !topLevelKeys.includes(item.key)) {
        topLevelKeys.push(item.key);
      }
    });

    // Assign top-level positions: 10, 20, 30... based on array order
    topLevelKeys.forEach((key, idx) => {
      const itemIndex = newItems.findIndex(i => i.key === key);
      if (itemIndex !== -1) {
        newItems[itemIndex].order_position = (idx + 1) * 10;
      }
    });

    // Group children by parent, preserving ARRAY order within each group
    const childrenByParent = {};
    newItems.forEach(item => {
      if (item.parent_key) {
        if (!childrenByParent[item.parent_key]) {
          childrenByParent[item.parent_key] = [];
        }
        // Only add if not already in the list (preserve first occurrence order)
        if (!childrenByParent[item.parent_key].find(c => c.key === item.key)) {
          childrenByParent[item.parent_key].push(item);
        }
      }
    });

    // Assign positions for each parent's children: 1, 2, 3... based on array order
    Object.keys(childrenByParent).forEach(parentKey => {
      const children = childrenByParent[parentKey];
      // DON'T sort - use the array order as-is
      children.forEach((child, idx) => {
        const itemIndex = newItems.findIndex(i => i.key === child.key);
        if (itemIndex !== -1) {
          newItems[itemIndex].order_position = idx + 1;
        }
      });
    });

    return newItems;
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setNavItems((items) => {
      const draggedItem = items.find(item => item.key === active.id);
      const targetItem = items.find(item => item.key === over.id);

      if (!draggedItem || !targetItem) {
        return items;
      }

      let newItems = [...items];
      const draggedIndex = newItems.findIndex(item => item.key === active.id);
      const targetIndex = newItems.findIndex(item => item.key === over.id);

      // Determine if dragged item and target are in the same group (same parent)
      const sameParent = draggedItem.parent_key === targetItem.parent_key;

      if (sameParent) {
        // Moving within the same group - just reorder, keep parent_key
        newItems = arrayMove(newItems, draggedIndex, targetIndex);
      } else {
        // Moving to a different group - update parent_key to match target's parent
        // This means the item will join the same group as the target
        newItems[draggedIndex] = {
          ...newItems[draggedIndex],
          parent_key: targetItem.parent_key
        };
        // Move the item in the array
        newItems = arrayMove(newItems, draggedIndex, targetIndex);
      }

      // Recalculate all positions correctly
      return recalculateOrderPositions(newItems);
    });

    setHasChanges(true);
  };

  const toggleCollapse = (key) => {
    setCollapsedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const moveUp = (index) => {
    if (index === 0) return;

    const currentItem = navItems[index];
    const prevItem = navItems[index - 1];

    // Only allow moving within the same parent group
    if (currentItem.parent_key !== prevItem.parent_key) {
      return;
    }

    const newItems = [...navItems];
    newItems[index] = prevItem;
    newItems[index - 1] = currentItem;

    // Recalculate all positions correctly
    setNavItems(recalculateOrderPositions(newItems));
    setHasChanges(true);
  };

  const moveDown = (index) => {
    if (index === navItems.length - 1) return;

    const currentItem = navItems[index];
    const nextItem = navItems[index + 1];

    // Only allow moving within the same parent group
    if (currentItem.parent_key !== nextItem.parent_key) {
      return;
    }

    const newItems = [...navItems];
    newItems[index] = nextItem;
    newItems[index + 1] = currentItem;

    // Recalculate all positions correctly
    setNavItems(recalculateOrderPositions(newItems));
    setHasChanges(true);
  };

  const toggleVisibility = (index) => {
    const newItems = [...navItems];
    newItems[index].is_visible = !newItems[index].is_visible;
    setNavItems(newItems);
    setHasChanges(true);
  };

  const updateOrderPosition = (index, value) => {
    const newPosition = parseInt(value);
    if (isNaN(newPosition) || newPosition < 1) return;

    const newItems = [...navItems];
    newItems[index].order_position = newPosition;

    // Re-sort by order position
    newItems.sort((a, b) => a.order_position - b.order_position);

    setNavItems(newItems);
    setHasChanges(true);
  };

  const updateParent = (index, newParentKey) => {
    const newItems = [...navItems];
    const item = newItems[index];

    // Set new parent
    item.parent_key = newParentKey;

    // Temporarily set a high position so it appears at the end of its new group
    // The recalculate function will assign the correct position
    item.order_position = 9999;

    // Recalculate all positions correctly
    setNavItems(recalculateOrderPositions(newItems));
    setHasChanges(true);
  };

  // Get available parent options for an item (only top-level items)
  const getAvailableParents = (itemKey) => {
    // Only return top-level items (parent_key = null) that are not the item itself
    return navItems.filter(item =>
      item.parent_key === null && item.key !== itemKey
    );
  };

  const saveChanges = async () => {
    try {
      setSaving(true);

      // Send updates to backend - include parent_key to preserve hierarchy
      await apiClient.post('admin/navigation/reorder', {
        items: navItems.map(item => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
          route: item.route,
          parent_key: item.parent_key,
          order_position: item.order_position,
          is_visible: item.is_visible
        }))
      });

      setOriginalItems(JSON.parse(JSON.stringify(navItems)));
      setHasChanges(false);

      // Reload to confirm and get recalculated positions from backend
      await loadNavigationItems();

      // Dispatch event to notify sidebar to refresh navigation
      window.dispatchEvent(new CustomEvent('navigation-updated'));

      setFlashMessage({ type: 'success', message: 'Navigation order saved! Sidebar will update automatically.' });
    } catch (error) {
      console.error('Error saving navigation order:', error);
      setFlashMessage({ type: 'error', message: 'Failed to save changes: ' + (error.response?.data?.error || error.message) });
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setNavItems(JSON.parse(JSON.stringify(originalItems)));
    setHasChanges(false);
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  // Build preview hierarchy for sidebar display
  const buildPreviewHierarchy = () => {
    const topLevel = navItems.filter(item => !item.parent_key && item.is_visible);
    const children = navItems.filter(item => item.parent_key && item.is_visible);

    // Sort top-level by order_position
    topLevel.sort((a, b) => a.order_position - b.order_position);

    // Group children by parent
    const childrenByParent = {};
    children.forEach(child => {
      if (!childrenByParent[child.parent_key]) {
        childrenByParent[child.parent_key] = [];
      }
      childrenByParent[child.parent_key].push(child);
    });

    // Sort children within each parent
    Object.values(childrenByParent).forEach(group => {
      group.sort((a, b) => a.order_position - b.order_position);
    });

    return { topLevel, childrenByParent };
  };

  const { topLevel: previewTopLevel, childrenByParent: previewChildren } = buildPreviewHierarchy();

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Navigation Manager</h1>
        <p className="text-gray-600">Manage the order and visibility of admin sidebar items</p>
      </div>

      {hasChanges && (
        <Card className="mb-6 border-l-4 border-l-blue-600 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-800 font-medium">You have unsaved changes</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetChanges} disabled={saving}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={saveChanges} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Navigation Items</CardTitle>
            </CardHeader>
            <CardContent>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={navItems.map(item => item.key)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {navItems.map((item, index) => {
                      // Check if this is a child item
                      const isChild = !!item.parent_key;

                      // Check if parent is collapsed
                      const parentCollapsed = item.parent_key && collapsedItems.has(item.parent_key);

                      // Check if this item has children
                      const hasChildren = navItems.some(child => child.parent_key === item.key);

                      // Check if this item is collapsed
                      const isCollapsed = collapsedItems.has(item.key);

                      // Don't render child items if their parent is collapsed
                      if (parentCollapsed) {
                        return null;
                      }

                      return (
                        <SortableItem
                          key={item.key}
                          item={item}
                          index={index}
                          isChild={isChild}
                          hasChildren={hasChildren}
                          isCollapsed={isCollapsed}
                          canMoveUp={index > 0}
                          canMoveDown={index < navItems.length - 1}
                          onMoveUp={() => moveUp(index)}
                          onMoveDown={() => moveDown(index)}
                          onToggleVisibility={() => toggleVisibility(index)}
                          onUpdateOrder={(value) => updateOrderPosition(index, value)}
                          onUpdateParent={(value) => updateParent(index, value)}
                          onToggleCollapse={() => toggleCollapse(item.key)}
                          availableParents={getAvailableParents(item.key)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </CardContent>
          </Card>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Tips:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Drag items by the grip handle to reorder them</li>
              <li>• Use the up/down arrows for precise positioning</li>
              <li>• Use the parent dropdown to change an item's hierarchy level</li>
              <li>• Click chevron icons to expand/collapse parent items with children</li>
              <li>• Click the eye icon to show/hide items from the sidebar</li>
              <li>• Enter a specific number to jump to that position</li>
              <li>• Core items are built-in, Plugin items are added by plugins</li>
              <li>• Changes are not saved until you click "Save Changes"</li>
            </ul>
          </div>
        </div>

        {/* Sidebar Preview Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Sidebar Preview
              </CardTitle>
              <p className="text-sm text-gray-500">Live preview of how navigation will appear</p>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 rounded-lg p-4 text-white max-h-[600px] overflow-y-auto">
                {/* Dashboard - always first */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white mb-4">
                  <span className="text-sm font-medium">Dashboard</span>
                </div>

                {/* Navigation Groups */}
                {previewTopLevel.map((category) => {
                  const categoryChildren = previewChildren[category.key] || [];

                  // Skip if this is a standalone item with a route (not a category)
                  if (category.route && categoryChildren.length === 0) {
                    return (
                      <div key={category.key} className="mb-1">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300">
                          <span className="text-sm">{category.label}</span>
                          <span className="text-xs text-gray-500 ml-auto">({category.order_position})</span>
                        </div>
                      </div>
                    );
                  }

                  // This is a category with children
                  if (categoryChildren.length === 0) return null;

                  return (
                    <div key={category.key} className="mb-4">
                      <div className="flex items-center justify-between px-3 py-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          {category.label}
                        </span>
                        <span className="text-xs text-gray-600">({category.order_position})</span>
                      </div>
                      <div className="mt-1 space-y-1">
                        {categoryChildren.map((item) => (
                          <div
                            key={item.key}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300"
                          >
                            <span className="text-sm">{item.label}</span>
                            <span className="text-xs text-gray-500 ml-auto">({item.order_position})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Hidden items indicator */}
                {navItems.filter(item => !item.is_visible).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center gap-2 px-3 py-2 text-gray-500">
                      <EyeOff className="w-4 h-4" />
                      <span className="text-xs">
                        {navItems.filter(item => !item.is_visible).length} hidden items
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NavigationManager;
