import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import CodeEditor from './CodeEditor';
import {
  X,
  GitCompare,
  ArrowLeftRight,
  Download,
  FileCode,
  AlertCircle,
  Loader2
} from 'lucide-react';

/**
 * VersionCompareModal
 * Compares two plugin versions using the existing CodeEditor component
 * Features:
 * - Side-by-side diff view (using CodeEditor's DiffEditor)
 * - File-by-file comparison
 * - Stats (files changed, lines added/deleted)
 * - Swap version order
 * - Download diff report
 */
const VersionCompareModal = ({
  pluginId,
  fromVersionId,
  toVersionId,
  onClose,
  onRestore,
  className = ''
}) => {
  const [loading, setLoading] = useState(true);
  const [comparison, setComparison] = useState(null);
  const [fromVersion, setFromVersion] = useState(null);
  const [toVersion, setToVersion] = useState(null);
  const [fromState, setFromState] = useState(null);
  const [toState, setToState] = useState(null);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [swapped, setSwapped] = useState(false);

  // Component types to compare
  const componentTypes = ['hooks', 'events', 'scripts', 'widgets', 'controllers', 'entities'];

  // Load version details and comparison
  useEffect(() => {
    loadComparison();
  }, [pluginId, fromVersionId, toVersionId]);

  const loadComparison = async () => {
    try {
      setLoading(true);
      const storeId = localStorage.getItem('selectedStoreId');
      const headers = {
        'Content-Type': 'application/json',
        ...(storeId && storeId !== 'undefined' ? { 'x-store-id': storeId } : {})
      };

      const isComparingWithCurrent = toVersionId === 'current';

      // Load from version
      const fromResponse = await fetch(`/api/plugins/${pluginId}/versions/${fromVersionId}`, { headers });
      if (!fromResponse.ok) throw new Error('Failed to load from version');
      const fromData = await fromResponse.json();

      let toData, comparisonData;

      if (isComparingWithCurrent) {
        // Load current plugin state instead of a version
        const currentResponse = await fetch(`/api/plugins/registry/${pluginId}`, { headers });
        if (!currentResponse.ok) throw new Error('Failed to load current state');
        const currentPlugin = await currentResponse.json();

        // Build a "current" version object from plugin data
        toData = {
          version: {
            version_number: 'Current',
            version_type: 'current',
            commit_message: 'Current state (unsaved changes)',
            is_current: true,
            created_at: new Date().toISOString(),
            reconstructed_state: extractCurrentPluginState(currentPlugin)
          }
        };

        // Compare with current - fetch comparison or build locally
        const compResponse = await fetch(`/api/plugins/${pluginId}/versions/compare?from=${fromVersionId}&to=current`, { headers });
        if (compResponse.ok) {
          comparisonData = await compResponse.json();
        } else {
          // Build comparison locally if API doesn't support 'current'
          comparisonData = { comparison: buildLocalComparison(fromData.version, toData.version) };
        }
      } else {
        // Normal version-to-version comparison
        const [toResponse, compResponse] = await Promise.all([
          fetch(`/api/plugins/${pluginId}/versions/${toVersionId}`, { headers }),
          fetch(`/api/plugins/${pluginId}/versions/compare?from=${fromVersionId}&to=${toVersionId}`, { headers })
        ]);

        if (!toResponse.ok || !compResponse.ok) {
          throw new Error('Failed to load comparison data');
        }

        toData = await toResponse.json();
        comparisonData = await compResponse.json();
      }

      setFromVersion(fromData.version);
      setToVersion(toData.version);
      setComparison(comparisonData.comparison);

      // Extract reconstructed states from version data
      const fromReconstructed = extractStateFromVersion(fromData.version);
      const toReconstructed = extractStateFromVersion(toData.version);

      console.log('🔍 VersionCompareModal loaded:', {
        fromVersion: fromData.version.version_number,
        toVersion: toData.version.version_number,
        isComparingWithCurrent,
        comparison_files_changed: comparisonData.comparison?.files_changed,
        comparison_summary_length: comparisonData.comparison?.summary?.length,
        fromState_keys: fromReconstructed ? Object.keys(fromReconstructed) : null,
        toState_keys: toReconstructed ? Object.keys(toReconstructed) : null
      });

      setFromState(fromReconstructed);
      setToState(toReconstructed);

      // Auto-select first changed component
      if (comparisonData.comparison?.summary?.length > 0) {
        console.log('📌 Auto-selecting first changed component:', comparisonData.comparison.summary[0]);
        setSelectedComponent(comparisonData.comparison.summary[0]);
      } else {
        // If no comparison summary, show all component types that have data
        const availableTypes = componentTypes.filter(type =>
          (fromReconstructed?.[type]?.length > 0) || (toReconstructed?.[type]?.length > 0)
        );
        if (availableTypes.length > 0) {
          setSelectedComponent({ component_type: availableTypes[0], change_type: 'modified' });
        }
      }
    } catch (error) {
      console.error('Failed to load comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract current plugin state from registry data
  const extractCurrentPluginState = (plugin) => {
    return {
      hooks: plugin.hooks || [],
      events: plugin.events || [],
      scripts: plugin.scripts || [],
      widgets: plugin.widgets || [],
      controllers: plugin.controllers || [],
      entities: plugin.entities || []
    };
  };

  // Build local comparison when API doesn't support 'current'
  const buildLocalComparison = (fromVersion, toVersion) => {
    const fromState = extractStateFromVersion(fromVersion);
    const toState = extractStateFromVersion(toVersion);

    const summary = [];
    for (const type of componentTypes) {
      const fromCount = fromState?.[type]?.length || 0;
      const toCount = toState?.[type]?.length || 0;
      if (fromCount > 0 || toCount > 0) {
        summary.push({
          component_type: type,
          change_type: fromCount === 0 ? 'added' : toCount === 0 ? 'deleted' : 'modified',
          operations_count: Math.abs(toCount - fromCount) || 1
        });
      }
    }

    return {
      files_changed: summary.length,
      lines_added: 0,
      lines_deleted: 0,
      components_modified: summary.length,
      summary
    };
  };

  // Extract state from version data
  const extractStateFromVersion = (version) => {
    // Backend now returns reconstructed_state for all versions
    if (version.reconstructed_state) {
      return version.reconstructed_state;
    }
    // Fallback to snapshot data if available
    if (version.version_type === 'snapshot' && version.snapshot?.snapshot_data) {
      return version.snapshot.snapshot_data;
    }
    // Last resort: empty state
    return {};
  };

  // Swap versions
  const handleSwap = () => {
    setSwapped(!swapped);
  };

  // Get component display name
  const getComponentDisplayName = (type) => {
    const names = {
      hooks: 'Hooks',
      events: 'Events',
      scripts: 'Scripts',
      widgets: 'Widgets',
      controllers: 'Controllers',
      entities: 'Entities',
      manifest: 'Manifest',
      metadata: 'Metadata'
    };
    return names[type] || type;
  };

  // Get actual code from component in a state
  const getComponentCodeFromState = (state, componentType) => {
    console.log(`📝 getComponentCodeFromState called:`, {
      componentType,
      hasState: !!state,
      state_keys: state ? Object.keys(state) : null,
      componentData_exists: !!(state?.[componentType]),
      componentData_length: state?.[componentType]?.length || 0
    });

    if (!state) {
      console.warn('  ⚠️  No state provided');
      return '// No state';
    }

    const componentData = state[componentType];
    if (!componentData) {
      console.warn(`  ⚠️  No ${componentType} in state`);
      return `// No ${componentType} data in this version`;
    }

    if (componentData.length === 0) {
      console.warn(`  ⚠️  ${componentType} is empty array`);
      return `// No ${componentType} in this version`;
    }

    console.log(`  ✅ Found ${componentData.length} ${componentType} items`);

    // Format component data as readable code
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

    // Fallback for other types
    return JSON.stringify(componentData, null, 2);
  };

  // Download diff report
  const handleDownload = () => {
    if (!comparison) return;

    const report = `
# Version Comparison Report

From: ${fromVersion?.version_number} (${fromVersion?.created_at})
To: ${toVersion?.version_number} (${toVersion?.created_at})

## Statistics
- Files Changed: ${comparison.files_changed || 0}
- Lines Added: ${comparison.lines_added || 0}
- Lines Deleted: ${comparison.lines_deleted || 0}
- Components Modified: ${comparison.components_modified || 0}

## Changed Components
${comparison.summary?.map(comp => `
### ${getComponentDisplayName(comp.component_type)}
- Operations: ${comp.operations_count || 0}
- Change Type: ${comp.change_type || 'modified'}
`).join('\n') || 'No changes'}
    `;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `version-comparison-${fromVersion?.version_number}-to-${toVersion?.version_number}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFromVersion = swapped ? toVersion : fromVersion;
  const activeToVersion = swapped ? fromVersion : toVersion;

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl w-[95vw] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <GitCompare className="w-6 h-6 text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Version Comparison</h2>
                <p className="text-sm text-muted-foreground">
                  Comparing plugin versions with side-by-side diff
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                Download Report
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Version info */}
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-1">From Version</p>
                  <p className="font-mono text-sm font-semibold">{activeFromVersion?.version_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeFromVersion?.commit_message || 'No message'}
                  </p>
                </div>
                <Badge variant={activeFromVersion?.version_type === 'snapshot' ? 'default' : 'outline'}>
                  {activeFromVersion?.version_type}
                </Badge>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSwap}
              className="flex-shrink-0"
              title="Swap versions"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </Button>

            <div className="flex-1 bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-600 font-medium mb-1">To Version</p>
                  <p className="font-mono text-sm font-semibold">{activeToVersion?.version_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeToVersion?.commit_message || 'No message'}
                  </p>
                </div>
                <Badge variant={activeToVersion?.version_type === 'snapshot' ? 'default' : 'outline'}>
                  {activeToVersion?.version_type}
                </Badge>
              </div>
            </div>
          </div>

          {/* Stats */}
          {comparison && (
            <div className="flex items-center gap-6 mt-3 text-sm">
              <span className="text-muted-foreground">
                {comparison.files_changed || 0} files changed
              </span>
              <span className="text-green-600">
                +{comparison.lines_added || 0} additions
              </span>
              <span className="text-red-600">
                -{comparison.lines_deleted || 0} deletions
              </span>
              <span className="text-orange-600">
                {comparison.components_modified || 0} components modified
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading comparison...</p>
              </div>
            </div>
          ) : !comparison || !comparison.summary || comparison.summary.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">No changes found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  These versions are identical
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Component selector sidebar */}
              <div className="w-64 border-r bg-muted/30 overflow-y-auto">
                <div className="p-3 border-b bg-muted">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Changed Components
                  </p>
                </div>
                <div className="p-2 space-y-1">
                  {comparison.summary.map((component, index) => {
                    const isSelected = selectedComponent?.component_type === component.component_type;
                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedComponent(component)}
                        className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {getComponentDisplayName(component.component_type)}
                            </p>
                            <p className="text-xs opacity-75">
                              {component.operations_count || 0} operations
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              component.change_type === 'added'
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : component.change_type === 'deleted'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {component.change_type || 'modified'}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Diff viewer */}
              <div className="flex-1 overflow-hidden">
                {selectedComponent ? (
                  <CodeEditor
                    originalCode={getComponentCodeFromState(
                      swapped ? toState : fromState,
                      selectedComponent.component_type
                    )}
                    value={getComponentCodeFromState(
                      swapped ? fromState : toState,
                      selectedComponent.component_type
                    )}
                    enableDiffDetection={true}
                    readOnly={true}
                    language="javascript"
                    fileName={`${getComponentDisplayName(selectedComponent.component_type)}.js`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">
                      Select a component to view changes
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
              💡 Tip: Use the CodeEditor's built-in diff features to explore changes
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {activeToVersion && !activeToVersion.is_current && (
                <Button onClick={() => onRestore(activeToVersion.id)}>
                  Restore to {activeToVersion.version_number}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionCompareModal;
