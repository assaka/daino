# AI Training Context: Programming Language Development Patterns

This document provides comprehensive training context for AI models focused on programming language development, covering React component architecture, drag-and-drop implementation, editor patterns, database integration, and code organization.

## Table of Contents

1. [React Component Development Patterns](#1-react-component-development-patterns)
2. [Drag and Drop Implementation](#2-drag-and-drop-implementation)
3. [Editor Architecture Patterns](#3-editor-architecture-patterns)
4. [Database Integration Patterns](#4-database-integration-patterns)
5. [Code Organization Patterns](#5-code-organization-patterns)

---

## 1. React Component Development Patterns

### 1.1 Component Architecture with TypeScript and Hooks

**Learning Objective**: Understand modern React component patterns with proper state management and lifecycle handling.

**Context Example**: Multi-mode component with state synchronization

```jsx
// Pattern: Mode-based component with state persistence
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';

const MultiModeEditor = ({ 
  initialMode = 'layout', 
  onModeChange = () => {},
  persistState = true 
}) => {
  const [mode, setMode] = useState(initialMode);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [config, setConfig] = useState(null);

  // Effect for mode synchronization
  useEffect(() => {
    onModeChange(mode);
    
    // Persist mode if required
    if (persistState) {
      localStorage.setItem('editorMode', mode);
    }
  }, [mode, onModeChange, persistState]);

  // Memoized handler to prevent unnecessary re-renders
  const handleModeSwitch = useCallback((newMode) => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Continue?');
      if (!confirm) return;
    }
    setMode(newMode);
  }, [hasUnsavedChanges]);

  return (
    <div className="editor-container">
      {/* Mode switcher with visual feedback */}
      <div className="mode-switcher flex gap-2">
        {['layout', 'preview', 'code'].map(m => (
          <Button
            key={m}
            variant={mode === m ? 'default' : 'outline'}
            onClick={() => handleModeSwitch(m)}
            className={`transition-colors ${
              mode === m ? 'bg-blue-600 text-white' : 'text-gray-600'
            }`}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </Button>
        ))}
      </div>
      
      {/* Conditional rendering based on mode */}
      <div className="editor-content">
        {mode === 'layout' && <LayoutEditor config={config} />}
        {mode === 'preview' && <PreviewRenderer config={config} />}
        {mode === 'code' && <CodeEditor config={config} />}
      </div>
    </div>
  );
};

// Pattern: Compound component with prop forwarding
const LayoutEditor = ({ config, onConfigChange }) => {
  return (
    <div className="layout-editor">
      {/* Implementation details */}
    </div>
  );
};
```

**Key Concepts Demonstrated**:
- State management with `useState` and `useEffect`
- Memoization with `useCallback` for performance
- Conditional rendering patterns
- Props forwarding and component composition
- Local storage integration for state persistence

### 1.2 Form Handling with Validation

**Context Example**: Form component with comprehensive error handling

```jsx
// Pattern: Form with validation and API integration
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ValidationForm = ({ onSubmit, initialData = {} }) => {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  // Validation rules
  const validateField = (name, value) => {
    const rules = {
      email: (v) => !v ? 'Email is required' : 
        !/\S+@\S+\.\S+/.test(v) ? 'Email is invalid' : null,
      price: (v) => !v ? 'Price is required' : 
        parseFloat(v) <= 0 ? 'Price must be positive' : null,
      targetPrice: (v, formData) => !v ? 'Target price is required' : 
        parseFloat(v) >= parseFloat(formData.currentPrice) ? 
        'Target price must be lower than current price' : null
    };
    
    return rules[name] ? rules[name](value, formData) : null;
  };

  // Handle input changes with validation
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Real-time validation
    const error = validateField(name, value);
    setErrors(prev => ({ 
      ...prev, 
      [name]: error 
    }));
  };

  // Form submission with error handling
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await onSubmit(formData);
      setSubmitStatus('success');
    } catch (error) {
      setSubmitStatus('error');
      setErrors({ submit: error.message || 'Submission failed' });
    } finally {
      setLoading(false);
    }
  };

  // Success state rendering
  if (submitStatus === 'success') {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-6 text-center">
          <CardTitle className="text-green-800">Success!</CardTitle>
          <p className="text-green-700 mt-2">Your request has been processed.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Example</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              name="email"
              type="email"
              placeholder="Email address"
              value={formData.email || ''}
              onChange={handleInputChange}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <Input
              name="targetPrice"
              type="number"
              placeholder="Target price"
              value={formData.targetPrice || ''}
              onChange={handleInputChange}
              min="0.01"
              step="0.01"
              className={errors.targetPrice ? 'border-red-500' : ''}
            />
            {errors.targetPrice && (
              <p className="text-red-500 text-sm mt-1">{errors.targetPrice}</p>
            )}
          </div>

          {errors.submit && (
            <p className="text-red-500 text-sm">{errors.submit}</p>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Submit'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
```

**Key Concepts Demonstrated**:
- Real-time form validation
- Error state management
- Loading states and user feedback
- Success/error state rendering
- Input handling patterns

---

## 2. Drag and Drop Implementation

### 2.1 @dnd-kit Integration Patterns

**Learning Objective**: Understand modern drag-and-drop implementation using @dnd-kit library.

**Context Example**: Sortable list with drag handles and overlays

```jsx
// Pattern: Sortable component with drag handles and collision detection
import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Edit } from 'lucide-react';

// Sortable Item Component
function SortableItem({ id, children, disabled = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag handle */}
      {!disabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-2 top-1/2 -translate-y-1/2 cursor-move z-10 p-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          aria-label="Drag handle"
        >
          <GripVertical className="w-4 h-4 text-gray-600" />
        </div>
      )}
      
      {/* Item content */}
      <div className={`${!disabled ? 'pl-12' : ''}`}>
        {children}
      </div>
    </div>
  );
}

// Main sortable container
const SortableList = ({ items, onItemsChange, renderItem, disabled = false }) => {
  const [activeId, setActiveId] = useState(null);

  // Configure sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum distance before drag starts
      },
    })
  );

  // Handle drag start
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  // Handle drag end with item reordering
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      onItemsChange(newItems);
    }

    setActiveId(null);
  };

  // Find active item for drag overlay
  const activeItem = items.find(item => item.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={items.map(item => item.id)} 
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.map((item) => (
            <SortableItem 
              key={item.id} 
              id={item.id} 
              disabled={disabled}
            >
              <div className={`border rounded-lg p-4 bg-white ${
                !disabled ? 'hover:border-blue-400' : ''
              }`}>
                {renderItem(item)}
              </div>
            </SortableItem>
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeItem ? (
          <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4 opacity-90 shadow-lg">
            {renderItem(activeItem)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

// Usage example
const SlotEditor = () => {
  const [slots, setSlots] = useState([
    { id: 'header', name: 'Header', content: 'Header content' },
    { id: 'main', name: 'Main Content', content: 'Main content' },
    { id: 'footer', name: 'Footer', content: 'Footer content' }
  ]);

  const renderSlot = (slot) => (
    <div className="flex justify-between items-center">
      <div>
        <h3 className="font-medium">{slot.name}</h3>
        <p className="text-sm text-gray-600">{slot.content}</p>
      </div>
      <button className="p-2 hover:bg-gray-100 rounded">
        <Edit className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Page Layout Editor</h2>
      <SortableList
        items={slots}
        onItemsChange={setSlots}
        renderItem={renderSlot}
      />
    </div>
  );
};
```

**Key Concepts Demonstrated**:
- Sensor configuration for drag activation
- Sortable context and strategy patterns
- Drag overlay implementation
- Item reordering with arrayMove
- Accessibility considerations (drag handles, ARIA labels)

### 2.2 Advanced Drag and Drop Features

**Context Example**: Multi-zone drag and drop with constraints

```jsx
// Pattern: Multi-zone drag and drop with validation
import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  rectIntersection,
} from '@dnd-kit/core';

const MultiZoneDragDrop = () => {
  const [zones, setZones] = useState({
    available: [
      { id: 'widget1', type: 'text', title: 'Text Widget' },
      { id: 'widget2', type: 'image', title: 'Image Widget' },
    ],
    layout: [],
    sidebar: []
  });
  
  const [activeItem, setActiveItem] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 }
    })
  );

  // Validation rules for zones
  const canDropInZone = (item, zoneId) => {
    const rules = {
      layout: () => true, // Layout accepts all widgets
      sidebar: (item) => item.type !== 'image', // Sidebar excludes images
      available: () => false // Can't drop back to available
    };
    
    return rules[zoneId] ? rules[zoneId](item) : false;
  };

  const handleDragStart = (event) => {
    const { active } = event;
    
    // Find the item across all zones
    const sourceZone = Object.keys(zones).find(zoneId =>
      zones[zoneId].some(item => item.id === active.id)
    );
    
    const item = zones[sourceZone].find(item => item.id === active.id);
    setActiveItem({ ...item, sourceZone });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (!over || !activeItem) {
      setActiveItem(null);
      return;
    }

    const targetZone = over.data?.current?.zoneId || over.id;
    const sourceZone = activeItem.sourceZone;

    // Validate drop
    if (!canDropInZone(activeItem, targetZone)) {
      setActiveItem(null);
      return;
    }

    // Move item between zones
    setZones(prev => {
      const newZones = { ...prev };
      
      // Remove from source zone
      newZones[sourceZone] = newZones[sourceZone].filter(
        item => item.id !== active.id
      );
      
      // Add to target zone
      newZones[targetZone] = [...newZones[targetZone], {
        ...activeItem,
        id: `${activeItem.id}_${Date.now()}` // Unique ID for copies
      }];

      return newZones;
    });

    setActiveItem(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-3 gap-4 p-4">
        {/* Available Widgets */}
        <DropZone 
          id="available" 
          title="Available Widgets"
          items={zones.available}
          accepts={() => false}
        />

        {/* Layout Zone */}
        <DropZone 
          id="layout" 
          title="Main Layout"
          items={zones.layout}
          accepts={() => true}
        />

        {/* Sidebar Zone */}
        <DropZone 
          id="sidebar" 
          title="Sidebar"
          items={zones.sidebar}
          accepts={(item) => item.type !== 'image'}
        />
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeItem ? (
          <div className="bg-white border-2 border-blue-400 rounded p-2 shadow-lg">
            {activeItem.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
```

**Key Concepts Demonstrated**:
- Multi-zone drag and drop architecture
- Drop validation and constraints
- Item transformation during drag
- Complex state management across zones
- Visual feedback with drag overlays

---

## 3. Editor Architecture Patterns

### 3.1 Mode-Based Editor Design

**Learning Objective**: Understand how to build flexible editors with multiple interaction modes.

**Context Example**: Unified editor with layout, preview, and code modes

```jsx
// Pattern: Mode-based editor architecture with state synchronization
import React, { useState, useEffect, useCallback } from 'react';
import Editor from "@monaco-editor/react";

const UnifiedEditor = ({
  initialData = {},
  onSave = () => {},
  persistMode = true
}) => {
  const [mode, setMode] = useState('layout');
  const [editorData, setEditorData] = useState(initialData);
  const [codeContent, setCodeContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync data formats between modes
  useEffect(() => {
    setCodeContent(JSON.stringify(editorData, null, 2));
  }, [editorData]);

  // Mode persistence
  useEffect(() => {
    if (persistMode) {
      const savedMode = localStorage.getItem('editorMode');
      if (savedMode) setMode(savedMode);
    }
  }, [persistMode]);

  useEffect(() => {
    if (persistMode) {
      localStorage.setItem('editorMode', mode);
    }
  }, [mode, persistMode]);

  // Handle save operations
  const handleSave = useCallback(async (data = editorData) => {
    try {
      await onSave(data);
      setHasChanges(false);
    } catch (error) {
      console.error('Save failed:', error);
    }
  }, [editorData, onSave]);

  // Handle code mode save
  const handleCodeSave = useCallback(() => {
    try {
      const parsedData = JSON.parse(codeContent);
      setEditorData(parsedData);
      handleSave(parsedData);
    } catch (error) {
      alert('Invalid JSON: ' + error.message);
    }
  }, [codeContent, handleSave]);

  // Mode switching with change detection
  const switchMode = useCallback((newMode) => {
    if (hasChanges && mode === 'code') {
      const shouldSave = window.confirm(
        'You have unsaved changes in code mode. Save before switching?'
      );
      if (shouldSave) {
        handleCodeSave();
      }
    }
    setMode(newMode);
  }, [hasChanges, mode, handleCodeSave]);

  // Render mode-specific content
  const renderModeContent = () => {
    switch (mode) {
      case 'layout':
        return (
          <LayoutMode
            data={editorData}
            onChange={(data) => {
              setEditorData(data);
              setHasChanges(true);
            }}
            onSave={handleSave}
          />
        );

      case 'preview':
        return (
          <PreviewMode
            data={editorData}
            readonly={true}
          />
        );

      case 'code':
        return (
          <div className="h-full">
            <Editor
              height="100%"
              defaultLanguage="json"
              value={codeContent}
              onChange={(value) => {
                setCodeContent(value || '');
                setHasChanges(true);
              }}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                formatOnPaste: true,
                formatOnType: true
              }}
            />
          </div>
        );

      default:
        return <div>Invalid mode</div>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Mode Header */}
      <div className="bg-white border-b p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">Editor</h1>
          
          {/* Mode Switcher */}
          <div className="flex gap-2">
            {['layout', 'preview', 'code'].map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Description */}
        <p className="text-sm text-gray-600 mt-2">
          {mode === 'layout' && 'Visual editor - drag to reorder, click to edit'}
          {mode === 'preview' && 'Preview your changes as they will appear'}
          {mode === 'code' && 'Edit configuration as JSON'}
        </p>
      </div>

      {/* Mode Content */}
      <div className="flex-1 overflow-hidden">
        {renderModeContent()}
      </div>

      {/* Footer Actions */}
      {(mode === 'code' && hasChanges) && (
        <div className="bg-white border-t p-4 flex justify-end gap-2">
          <button
            onClick={() => setHasChanges(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCodeSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};

// Layout Mode Component
const LayoutMode = ({ data, onChange, onSave }) => {
  // Implementation would include drag-and-drop layout editor
  return (
    <div className="p-4">
      <h2>Layout Editor</h2>
      {/* Layout editing interface */}
    </div>
  );
};

// Preview Mode Component  
const PreviewMode = ({ data, readonly }) => {
  return (
    <div className="p-4">
      <h2>Preview</h2>
      {/* Render preview based on data */}
    </div>
  );
};
```

**Key Concepts Demonstrated**:
- Mode-based architecture design
- State synchronization between modes
- Change detection and confirmation
- Monaco Editor integration
- Persistent user preferences

### 3.2 Slot-Based Layout System

**Context Example**: Dynamic slot configuration system

```jsx
// Pattern: Slot-based layout with dynamic configuration
const SlotBasedEditor = ({ pageType, config, onChange }) => {
  const [slots, setSlots] = useState({});
  const [slotOrder, setSlotOrder] = useState([]);
  const [activeSlot, setActiveSlot] = useState(null);

  // Load slot configuration
  useEffect(() => {
    const loadSlotConfig = async () => {
      try {
        // Load from API or local storage
        const slotConfig = await loadPageConfig(pageType);
        setSlots(slotConfig.slots || {});
        setSlotOrder(slotConfig.order || []);
      } catch (error) {
        console.error('Failed to load slot config:', error);
      }
    };

    loadSlotConfig();
  }, [pageType]);

  // Save configuration
  const saveConfiguration = useCallback(async (newConfig) => {
    try {
      await savePageConfig(pageType, newConfig);
      onChange(newConfig);
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }, [pageType, onChange]);

  // Handle slot reorder
  const handleSlotReorder = (newOrder) => {
    setSlotOrder(newOrder);
    saveConfiguration({
      ...config,
      order: newOrder,
      slots
    });
  };

  // Handle slot content change
  const handleSlotChange = (slotId, content) => {
    const newSlots = {
      ...slots,
      [slotId]: {
        ...slots[slotId],
        content
      }
    };
    
    setSlots(newSlots);
    saveConfiguration({
      ...config,
      slots: newSlots,
      order: slotOrder
    });
  };

  return (
    <div className="slot-editor">
      <SortableList
        items={slotOrder}
        onItemsChange={handleSlotReorder}
        renderItem={(slotId) => (
          <SlotEditor
            key={slotId}
            slotId={slotId}
            slot={slots[slotId]}
            onChange={(content) => handleSlotChange(slotId, content)}
            onEdit={() => setActiveSlot(slotId)}
          />
        )}
      />

      {/* Slot editing modal */}
      {activeSlot && (
        <SlotEditModal
          slot={slots[activeSlot]}
          onSave={(content) => {
            handleSlotChange(activeSlot, content);
            setActiveSlot(null);
          }}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </div>
  );
};

// Individual slot component
const SlotEditor = ({ slotId, slot, onChange, onEdit }) => {
  return (
    <div className="slot-container border rounded p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">{slot?.name || slotId}</h3>
        <button
          onClick={onEdit}
          className="text-blue-600 hover:text-blue-800"
        >
          Edit
        </button>
      </div>
      
      <div 
        dangerouslySetInnerHTML={{ __html: slot?.content || '' }}
        className="slot-content"
      />
    </div>
  );
};
```

**Key Concepts Demonstrated**:
- Slot-based architecture patterns
- Dynamic configuration loading/saving
- Component composition with slots
- Modal-based editing workflow

---

## 4. Database Integration Patterns

### 4.1 Entity-Based API Architecture

**Learning Objective**: Understand CRUD operation patterns with proper error handling and data validation.

**Context Example**: Base entity class with comprehensive error handling

```javascript
// Pattern: Base entity class for consistent API operations
class BaseEntity {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.cache = new Map();
    this.requestQueue = new Map();
  }

  // Generic find all with caching and error handling
  async findAll(params = {}) {
    const cacheKey = JSON.stringify({ endpoint: this.endpoint, params });
    
    // Return cached result if available
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 min cache
        return cached.data;
      }
    }

    try {
      // Prevent duplicate requests
      if (this.requestQueue.has(cacheKey)) {
        return await this.requestQueue.get(cacheKey);
      }

      const requestPromise = this.executeRequest('GET', this.endpoint, null, params);
      this.requestQueue.set(cacheKey, requestPromise);

      const response = await requestPromise;
      
      // Cache successful responses
      this.cache.set(cacheKey, {
        data: response,
        timestamp: Date.now()
      });

      this.requestQueue.delete(cacheKey);
      return response;

    } catch (error) {
      this.requestQueue.delete(cacheKey);
      
      // Enhanced error handling based on endpoint
      if (this.isOptionalEndpoint()) {
        console.warn(`Optional endpoint ${this.endpoint} failed:`, error.message);
        return [];
      } else {
        console.error(`Critical endpoint ${this.endpoint} failed:`, error);
        throw this.enhanceError(error);
      }
    }
  }

  // Create with validation and conflict handling
  async create(data) {
    try {
      const validatedData = await this.validateData(data);
      const response = await this.executeRequest('POST', this.endpoint, validatedData);
      
      // Clear related caches
      this.clearCache();
      
      return response;
    } catch (error) {
      if (error.status === 409) {
        throw new Error('Record already exists with these details');
      } else if (error.status === 422) {
        throw new Error('Validation failed: ' + this.extractValidationErrors(error));
      }
      throw this.enhanceError(error);
    }
  }

  // Update with optimistic updates
  async update(id, data) {
    const originalData = this.cache.get(`${this.endpoint}/${id}`);
    
    // Optimistic update
    if (originalData) {
      this.cache.set(`${this.endpoint}/${id}`, {
        ...originalData,
        ...data
      });
    }

    try {
      const validatedData = await this.validateData(data);
      const response = await this.executeRequest('PUT', `${this.endpoint}/${id}`, validatedData);
      
      // Update cache with server response
      this.cache.set(`${this.endpoint}/${id}`, response);
      this.clearListCache();
      
      return response;
    } catch (error) {
      // Revert optimistic update on error
      if (originalData) {
        this.cache.set(`${this.endpoint}/${id}`, originalData);
      }
      throw this.enhanceError(error);
    }
  }

  // Delete with cascade handling
  async delete(id) {
    try {
      await this.executeRequest('DELETE', `${this.endpoint}/${id}`);
      
      // Remove from cache
      this.cache.delete(`${this.endpoint}/${id}`);
      this.clearListCache();
      
      return { success: true };
    } catch (error) {
      if (error.status === 409) {
        throw new Error('Cannot delete: record is referenced by other data');
      }
      throw this.enhanceError(error);
    }
  }

  // Batch operations with transaction-like behavior
  async batchUpdate(updates) {
    const results = [];
    const rollbackQueue = [];

    try {
      for (const { id, data } of updates) {
        const original = await this.findById(id);
        rollbackQueue.push({ id, original });
        
        const result = await this.update(id, data);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      // Rollback all changes
      console.warn('Batch update failed, rolling back...');
      for (const { id, original } of rollbackQueue.reverse()) {
        try {
          await this.update(id, original);
        } catch (rollbackError) {
          console.error('Rollback failed for:', id, rollbackError);
        }
      }
      throw error;
    }
  }

  // Helper methods
  async validateData(data) {
    // Override in subclasses for specific validation
    if (this.validationSchema) {
      return await this.validationSchema.validate(data);
    }
    return data;
  }

  isOptionalEndpoint() {
    const optional = ['cms-blocks', 'analytics', 'recommendations'];
    return optional.includes(this.endpoint);
  }

  enhanceError(error) {
    return {
      ...error,
      endpoint: this.endpoint,
      timestamp: new Date().toISOString(),
      context: 'BaseEntity operation'
    };
  }

  extractValidationErrors(error) {
    if (error.response?.data?.errors) {
      return Object.values(error.response.data.errors).flat().join(', ');
    }
    return error.message;
  }

  clearCache() {
    this.cache.clear();
  }

  clearListCache() {
    // Clear only list-type cache entries
    for (const key of this.cache.keys()) {
      if (key.includes(this.endpoint) && !key.includes('/')) {
        this.cache.delete(key);
      }
    }
  }

  async executeRequest(method, url, data = null, params = null) {
    // Implement actual HTTP request logic here
    // This would integrate with your HTTP client (axios, fetch, etc.)
  }
}

// Specialized entity classes
class Product extends BaseEntity {
  constructor() {
    super('products');
    this.validationSchema = ProductValidationSchema;
  }

  // Product-specific methods
  async findByCategory(categoryId) {
    return this.findAll({ category_id: categoryId });
  }

  async updateStock(id, quantity) {
    return this.update(id, { stock_quantity: quantity });
  }

  async searchByName(name) {
    return this.findAll({ search: name });
  }
}

class PriceAlert extends BaseEntity {
  constructor() {
    super('price-alerts');
  }

  async createAlert(productId, email, targetPrice) {
    return this.create({
      product_id: productId,
      email: email,
      target_price: targetPrice,
      created_at: new Date().toISOString()
    });
  }

  async findByEmail(email) {
    return this.findAll({ email: email });
  }
}

// Usage examples
const productAPI = new Product();
const priceAlertAPI = new PriceAlert();

// Example usage in components
const useProducts = (categoryId = null) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadProducts = async () => {
      setLoading(true);
      try {
        const data = categoryId 
          ? await productAPI.findByCategory(categoryId)
          : await productAPI.findAll();
        setProducts(data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [categoryId]);

  return { products, loading, error };
};
```

**Key Concepts Demonstrated**:
- Base class pattern for API operations
- Caching strategies with TTL
- Request deduplication
- Optimistic updates
- Error classification and handling
- Batch operations with rollback
- Validation integration

### 4.2 Error Handling and Constraint Management

**Context Example**: Comprehensive error handling for database constraints

```javascript
// Pattern: Error handling with user-friendly messages
class DatabaseErrorHandler {
  static handleConstraintError(error) {
    const constraintMessages = {
      'unique_constraint': (field) => `A record with this ${field} already exists.`,
      'foreign_key_constraint': (field) => `Cannot delete: this record is referenced by other data.`,
      'not_null_constraint': (field) => `${field} is required and cannot be empty.`,
      'check_constraint': (field) => `Invalid value for ${field}.`
    };

    // Extract constraint type and field from error
    const constraintType = this.extractConstraintType(error);
    const field = this.extractFieldName(error);

    if (constraintMessages[constraintType]) {
      return {
        type: 'CONSTRAINT_VIOLATION',
        message: constraintMessages[constraintType](field),
        field: field,
        canRetry: constraintType !== 'foreign_key_constraint'
      };
    }

    return {
      type: 'UNKNOWN_ERROR',
      message: 'An unexpected database error occurred.',
      canRetry: true
    };
  }

  static extractConstraintType(error) {
    // PostgreSQL error code mapping
    const pgErrorCodes = {
      '23505': 'unique_constraint',
      '23503': 'foreign_key_constraint', 
      '23502': 'not_null_constraint',
      '23514': 'check_constraint'
    };

    return pgErrorCodes[error.code] || 'unknown_constraint';
  }

  static extractFieldName(error) {
    // Extract field name from error message
    const match = error.message.match(/Key \(([^)]+)\)/);
    return match ? match[1] : 'field';
  }
}

// Usage in API client
class APIClient {
  async request(method, url, data) {
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : null
      });

      if (!response.ok) {
        throw await this.createErrorFromResponse(response);
      }

      return await response.json();
    } catch (error) {
      throw this.enhanceError(error);
    }
  }

  async createErrorFromResponse(response) {
    const data = await response.json().catch(() => ({}));
    
    return {
      status: response.status,
      code: data.code,
      message: data.message || response.statusText,
      details: data.details || {},
      url: response.url
    };
  }

  enhanceError(error) {
    // Network errors
    if (!navigator.onLine) {
      return {
        ...error,
        type: 'NETWORK_ERROR',
        message: 'No internet connection available.',
        canRetry: true
      };
    }

    // Database constraint errors
    if (error.code && error.code.startsWith('23')) {
      return DatabaseErrorHandler.handleConstraintError(error);
    }

    // Rate limiting
    if (error.status === 429) {
      return {
        ...error,
        type: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
        canRetry: true
      };
    }

    // Authorization errors
    if (error.status === 401) {
      return {
        ...error,
        type: 'UNAUTHORIZED',
        message: 'Your session has expired. Please log in again.',
        canRetry: false
      };
    }

    return error;
  }
}
```

**Key Concepts Demonstrated**:
- Database constraint error classification
- User-friendly error message generation  
- Network error handling
- HTTP status code interpretation
- Error recovery strategies

---

## 5. Code Organization Patterns

### 5.1 Component Composition and Reusability

**Learning Objective**: Understand how to structure large applications with reusable components and clear separation of concerns.

**Context Example**: Compound component pattern with context

```jsx
// Pattern: Compound component with context for complex UI
import React, { createContext, useContext, useState } from 'react';

// Editor context for shared state
const EditorContext = createContext();

const useEditor = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within EditorProvider');
  }
  return context;
};

// Main editor provider component
const Editor = ({ children, initialData = {}, onSave }) => {
  const [data, setData] = useState(initialData);
  const [mode, setMode] = useState('edit');
  const [hasChanges, setHasChanges] = useState(false);

  const updateData = (path, value) => {
    setData(prevData => {
      const newData = { ...prevData };
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] = current[keys[i]] || {};
      }
      
      current[keys[keys.length - 1]] = value;
      setHasChanges(true);
      return newData;
    });
  };

  const save = async () => {
    try {
      await onSave(data);
      setHasChanges(false);
      return true;
    } catch (error) {
      console.error('Save failed:', error);
      return false;
    }
  };

  const contextValue = {
    data,
    mode,
    hasChanges,
    setMode,
    updateData,
    save
  };

  return (
    <EditorContext.Provider value={contextValue}>
      <div className="editor-container">
        {children}
      </div>
    </EditorContext.Provider>
  );
};

// Compound components
Editor.Header = ({ title, children }) => {
  const { mode, setMode, hasChanges, save } = useEditor();
  
  return (
    <div className="editor-header bg-white border-b p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        
        <div className="flex items-center gap-2">
          {children}
          
          {/* Mode switcher */}
          <div className="flex bg-gray-100 rounded">
            {['edit', 'preview'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  mode === m 
                    ? 'bg-white shadow text-gray-900' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Save indicator */}
          {hasChanges && (
            <button
              onClick={save}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

Editor.Content = ({ children }) => {
  const { mode } = useEditor();
  
  return (
    <div className="editor-content flex-1 overflow-hidden">
      {React.Children.map(children, child => 
        React.cloneElement(child, { mode })
      )}
    </div>
  );
};

Editor.Field = ({ name, label, type = 'text', children }) => {
  const { data, updateData, mode } = useEditor();
  const value = name.split('.').reduce((obj, key) => obj?.[key], data) || '';

  if (mode === 'preview') {
    return (
      <div className="field-preview">
        <strong>{label}:</strong> {value}
      </div>
    );
  }

  return (
    <div className="field-editor mb-4">
      <label className="block text-sm font-medium mb-2">
        {label}
      </label>
      
      {children ? (
        React.cloneElement(children, {
          value,
          onChange: (e) => updateData(name, e.target.value)
        })
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => updateData(name, e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      )}
    </div>
  );
};

Editor.Section = ({ title, children, collapsible = false }) => {
  const [collapsed, setCollapsed] = useState(false);
  
  return (
    <div className="editor-section border rounded mb-4">
      <div 
        className={`section-header p-3 border-b bg-gray-50 ${
          collapsible ? 'cursor-pointer' : ''
        }`}
        onClick={collapsible ? () => setCollapsed(!collapsed) : undefined}
      >
        <h3 className="font-medium flex items-center justify-between">
          {title}
          {collapsible && (
            <span className={`transform transition-transform ${
              collapsed ? 'rotate-180' : ''
            }`}>
              ▼
            </span>
          )}
        </h3>
      </div>
      
      {(!collapsible || !collapsed) && (
        <div className="section-content p-4">
          {children}
        </div>
      )}
    </div>
  );
};

// Usage example
const ProductEditor = ({ product, onSave }) => {
  return (
    <Editor initialData={product} onSave={onSave}>
      <Editor.Header title="Product Editor">
        <button className="text-gray-600 hover:text-gray-800">
          Help
        </button>
      </Editor.Header>

      <Editor.Content>
        <div className="p-6 space-y-6">
          <Editor.Section title="Basic Information">
            <Editor.Field name="name" label="Product Name" />
            <Editor.Field name="description" label="Description">
              <textarea className="w-full border rounded px-3 py-2" rows={4} />
            </Editor.Field>
            <Editor.Field name="price" label="Price" type="number" />
          </Editor.Section>

          <Editor.Section title="Advanced Settings" collapsible>
            <Editor.Field name="sku" label="SKU" />
            <Editor.Field name="stock" label="Stock Quantity" type="number" />
          </Editor.Section>
        </div>
      </Editor.Content>
    </Editor>
  );
};
```

**Key Concepts Demonstrated**:
- Compound component pattern
- Context-based state sharing
- Flexible component composition
- Mode-based rendering
- Nested data updates

### 5.2 Utility Functions and Configuration Management

**Context Example**: Configuration system with environment handling

```javascript
// Pattern: Configuration management with environment awareness
class ConfigurationManager {
  constructor() {
    this.config = {};
    this.environments = {
      development: 'dev',
      staging: 'staging', 
      production: 'prod'
    };
    this.currentEnv = this.detectEnvironment();
    this.loadConfig();
  }

  detectEnvironment() {
    // Multiple environment detection methods
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'development';
      } else if (hostname.includes('staging')) {
        return 'staging';
      } else {
        return 'production';
      }
    }
    
    return process.env.NODE_ENV || 'development';
  }

  loadConfig() {
    // Base configuration
    this.config = {
      api: {
        baseUrl: this.getApiBaseUrl(),
        timeout: 30000,
        retries: 3,
      },
      ui: {
        theme: 'light',
        animations: true,
        pageSize: 25,
      },
      features: {
        dragDrop: true,
        codeEditor: true,
        preview: true,
      },
      debug: {
        logging: this.currentEnv !== 'production',
        verbose: this.currentEnv === 'development',
      }
    };

    // Environment-specific overrides
    this.applyEnvironmentConfig();
  }

  getApiBaseUrl() {
    const urls = {
      development: 'http://localhost:3001/api',
      staging: 'https://staging-api.example.com/api',
      production: 'https://api.example.com/api'
    };
    
    return urls[this.currentEnv] || urls.development;
  }

  applyEnvironmentConfig() {
    const envConfigs = {
      development: {
        api: { timeout: 10000 },
        ui: { animations: false },
        debug: { verbose: true }
      },
      production: {
        api: { retries: 5 },
        debug: { logging: false, verbose: false }
      }
    };

    const envConfig = envConfigs[this.currentEnv];
    if (envConfig) {
      this.config = this.deepMerge(this.config, envConfig);
    }
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  get(path, defaultValue = null) {
    const keys = path.split('.');
    let current = this.config;
    
    for (const key of keys) {
      if (current === null || current === undefined || !current.hasOwnProperty(key)) {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current;
  }

  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = this.config;
    
    for (const key of keys) {
      current = current[key] = current[key] || {};
    }
    
    current[lastKey] = value;
  }

  isFeatureEnabled(feature) {
    return this.get(`features.${feature}`, false);
  }

  isDevelopment() {
    return this.currentEnv === 'development';
  }

  isProduction() {
    return this.currentEnv === 'production';
  }
}

// Utility functions for common operations
class UtilityFunctions {
  // Debounce function for search inputs
  static debounce(func, wait) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func.apply(this, args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle function for scroll events
  static throttle(func, limit) {
    let inThrottle;
    
    return function throttledFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Deep clone objects
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  }

  // Format currency
  static formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  // Generate unique IDs
  static generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Validate email
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Local storage with JSON support
  static storage = {
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    },

    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        console.error('Failed to read from localStorage:', error);
        return defaultValue;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Failed to remove from localStorage:', error);
      }
    }
  };

  // URL parameter utilities
  static urlParams = {
    get(param) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(param);
    },

    set(params) {
      const url = new URL(window.location);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      window.history.replaceState({}, '', url);
    },

    remove(param) {
      const url = new URL(window.location);
      url.searchParams.delete(param);
      window.history.replaceState({}, '', url);
    }
  };
}

// Performance monitoring utilities
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  startTimer(name) {
    this.metrics.set(name, {
      start: performance.now(),
      end: null,
      duration: null
    });
  }

  endTimer(name) {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.end = performance.now();
      metric.duration = metric.end - metric.start;
    }
  }

  getMetric(name) {
    return this.metrics.get(name);
  }

  getAllMetrics() {
    const results = {};
    for (const [name, metric] of this.metrics) {
      results[name] = {
        duration: metric.duration,
        start: metric.start,
        end: metric.end
      };
    }
    return results;
  }

  // React hook for performance monitoring
  static usePerformanceMonitor() {
    const monitor = new PerformanceMonitor();

    useEffect(() => {
      return () => {
        // Log metrics on unmount
        const metrics = monitor.getAllMetrics();
        if (Object.keys(metrics).length > 0) {
          console.log('Component Performance Metrics:', metrics);
        }
      };
    }, []);

    return monitor;
  }
}

// Export singleton instances
export const config = new ConfigurationManager();
export const utils = UtilityFunctions;
export const performance = new PerformanceMonitor();

// Usage examples
const MyComponent = () => {
  const performanceMonitor = PerformanceMonitor.usePerformanceMonitor();
  
  useEffect(() => {
    performanceMonitor.startTimer('dataLoad');
    
    // Simulate data loading
    setTimeout(() => {
      performanceMonitor.endTimer('dataLoad');
    }, 1000);
  }, []);

  const handleSearch = utils.debounce((query) => {
    // Search implementation
    console.log('Searching for:', query);
  }, 300);

  return (
    <div>
      <input 
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search..."
      />
      
      <div>API URL: {config.get('api.baseUrl')}</div>
      <div>Feature enabled: {config.isFeatureEnabled('dragDrop').toString()}</div>
    </div>
  );
};
```

**Key Concepts Demonstrated**:
- Environment-aware configuration management
- Utility function organization
- Performance monitoring patterns
- Local storage abstraction
- URL parameter management
- React hook patterns for utilities

---

## Metadata and Learning Objectives

### Difficulty Levels
- **Beginner**: Basic component structure and state management
- **Intermediate**: Drag-and-drop implementation, form validation, API integration
- **Advanced**: Multi-mode editors, complex state synchronization, performance optimization

### Prerequisites
- React fundamentals (components, hooks, state)
- JavaScript ES6+ features
- Basic understanding of TypeScript
- HTML/CSS for styling
- HTTP/REST API concepts

### Learning Progression
1. Start with basic React component patterns
2. Progress to form handling and validation
3. Implement drag-and-drop functionality
4. Build multi-mode editor interfaces
5. Integrate database operations with error handling
6. Organize code with reusable utilities and configuration

### Assessment Criteria
- Code organization and modularity
- Error handling comprehensiveness
- Performance considerations
- Accessibility compliance
- Type safety (when using TypeScript)
- Testing compatibility

This training context provides comprehensive examples of modern React development patterns that AI models can use to understand and generate similar code for programming language development assistance.