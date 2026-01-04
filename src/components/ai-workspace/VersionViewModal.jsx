import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import CodeEditor from './CodeEditor';
import {
  X,
  Eye,
  FileCode,
  Loader2,
  ChevronRight,
  RotateCcw
} from 'lucide-react';

/**
 * VersionViewModal
 * View the code content of a specific plugin version
 */
const VersionViewModal = ({
  pluginId,
  versionId,
  onClose,
  onRestore,
  className = ''
}) => {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(null);
  const [versionState, setVersionState] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);

  // Component types to display
  const componentTypes = ['hooks', 'events', 'scripts', 'widgets', 'controllers', 'entities'];

  useEffect(() => {
    loadVersion();
  }, [pluginId, versionId]);

  const loadVersion = async () => {
    try {
      setLoading(true);
      const storeId = localStorage.getItem('selectedStoreId');
      const headers = {
        'Content-Type': 'application/json',
        ...(storeId && storeId !== 'undefined' ? { 'x-store-id': storeId } : {})
      };

      const response = await fetch(`/api/plugins/${pluginId}/versions/${versionId}`, { headers });

      if (!response.ok) throw new Error('Failed to load version');

      const data = await response.json();
      setVersion(data.version);

      // Extract state from version
      const state = extractStateFromVersion(data.version);
      setVersionState(state);

      // Auto-select first component with data
      const firstWithData = componentTypes.find(type => state?.[type]?.length > 0);
      if (firstWithData) {
        setSelectedComponent(firstWithData);
      }
    } catch (error) {
      console.error('Failed to load version:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractStateFromVersion = (version) => {
    if (version.reconstructed_state) {
      return version.reconstructed_state;
    }
    if (version.version_type === 'snapshot' && version.snapshot?.snapshot_data) {
      return version.snapshot.snapshot_data;
    }
    return {};
  };

  const getComponentDisplayName = (type) => {
    const names = {
      hooks: 'Hooks',
      events: 'Events',
      scripts: 'Scripts',
      widgets: 'Widgets',
      controllers: 'Controllers',
      entities: 'Entities'
    };
    return names[type] || type;
  };

  const getComponentCode = (componentType) => {
    if (!versionState) return '// No state';

    const componentData = versionState[componentType];
    if (!componentData || componentData.length === 0) {
      return `// No ${componentType} in this version`;
    }

    if (componentType === 'hooks') {
      return componentData.map((hook, i) =>
        `// Hook ${i + 1}: ${hook.hook_name || 'unnamed'}\n` +
        `// Type: ${hook.hook_type || 'filter'}\n` +
        `// Priority: ${hook.priority || 10}\n` +
        (hook.handler_function || '// No handler')
      ).join('\n\n' + '='.repeat(50) + '\n\n');
    } else if (componentType === 'events') {
      return componentData.map((event, i) =>
        `// Event ${i + 1}: ${event.event_name || 'unnamed'}\n` +
        `// File: ${event.file_name || 'default.js'}\n` +
        `// Priority: ${event.priority || 10}\n` +
        (event.listener_function || '// No listener')
      ).join('\n\n' + '='.repeat(50) + '\n\n');
    } else if (componentType === 'scripts') {
      return componentData.map((script, i) =>
        `// Script ${i + 1}: ${script.file_name || 'unnamed'}\n` +
        `// Type: ${script.script_type || 'js'}, Scope: ${script.scope || 'frontend'}\n` +
        (script.file_content || '// No content')
      ).join('\n\n' + '='.repeat(50) + '\n\n');
    } else if (componentType === 'widgets') {
      return componentData.map((widget, i) =>
        `// Widget ${i + 1}: ${widget.widget_name || 'unnamed'}\n` +
        `// ID: ${widget.widget_id || 'no-id'}\n` +
        (widget.component_code || '// No component code')
      ).join('\n\n' + '='.repeat(50) + '\n\n');
    } else if (componentType === 'controllers') {
      return componentData.map((ctrl, i) =>
        `// Controller ${i + 1}: ${ctrl.controller_name || 'unnamed'}\n` +
        `// Method: ${ctrl.method || 'GET'}, Path: ${ctrl.path || '/api/...'}\n` +
        (ctrl.handler_code || '// No handler')
      ).join('\n\n' + '='.repeat(50) + '\n\n');
    } else if (componentType === 'entities') {
      return componentData.map((entity, i) =>
        `// Entity ${i + 1}: ${entity.entity_name || 'unnamed'}\n` +
        `// Table: ${entity.table_name || 'no_table'}\n` +
        JSON.stringify(entity.schema_definition || {}, null, 2)
      ).join('\n\n' + '='.repeat(50) + '\n\n');
    }

    return JSON.stringify(componentData, null, 2);
  };

  const getComponentCount = (componentType) => {
    return versionState?.[componentType]?.length || 0;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[85vh] flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">View Version</h2>
                <p className="text-sm text-muted-foreground">
                  Viewing code content at this version
                </p>
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Version info */}
          {version && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold">{version.version_number}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {version.commit_message || 'No message'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(version.created_at)} by {version.created_by_name || 'Unknown'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={version.version_type === 'snapshot' ? 'default' : 'outline'}>
                    {version.version_type}
                  </Badge>
                  {version.is_current && (
                    <Badge className="bg-green-500 text-white">Current</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading version...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Component selector sidebar */}
              <div className="w-56 border-r bg-muted/30 overflow-y-auto">
                <div className="p-3 border-b bg-muted">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Components
                  </p>
                </div>
                <div className="p-2 space-y-1">
                  {componentTypes.map((type) => {
                    const count = getComponentCount(type);
                    const isSelected = selectedComponent === type;
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedComponent(type)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : count > 0 ? 'hover:bg-muted' : 'opacity-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {getComponentDisplayName(type)}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {count}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Code viewer */}
              <div className="flex-1 overflow-hidden">
                {selectedComponent ? (
                  <CodeEditor
                    value={getComponentCode(selectedComponent)}
                    readOnly={true}
                    language="javascript"
                    fileName={`${getComponentDisplayName(selectedComponent)}.js`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">
                      Select a component to view its code
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              This is a read-only view of the version's code content
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {version && !version.is_current && (
                <Button onClick={() => onRestore && onRestore(version.id)}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Restore to this version
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionViewModal;
