/**
 * Developer Plugin Editor
 * Full code editor with file tree viewer and AI assistance
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FolderTree,
  FileText,
  Code,
  Code2,
  Play,
  Bug,
  GitBranch,
  Terminal,
  Settings,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  File,
  Folder,
  Search,
  Download,
  Upload,
  Zap,
  Sparkles,
  Wand2,
  Bot,
  Database,
  Trash2,
  Clock
} from 'lucide-react';
import SaveButton from '@/components/ui/save-button';
import CodeEditor from '@/components/ai-workspace/CodeEditor.jsx';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import apiClient from '@/api/client';
import EventSelector from '@/components/plugins/EventSelector';
import VersionHistoryPanel from '@/components/ai-workspace/VersionHistoryPanel';
import VersionCompareModal from '@/components/ai-workspace/VersionCompareModal';
import VersionRestoreModal from '@/components/ai-workspace/VersionRestoreModal';

const DeveloperPluginEditor = ({
  plugin,
  onSave,
  onClose,
  onSwitchMode,
  initialContext,
  chatMinimized = false,
  fileTreeTargetSize = 20, // Absolute % of total viewport
  editorTargetSize = 50 // Absolute % of total viewport
}) => {
  const [fileTree, setFileTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root']));
  const [searchQuery, setSearchQuery] = useState('');
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState('controller');
  const [selectedEventName, setSelectedEventName] = useState('');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [showEventMappingDialog, setShowEventMappingDialog] = useState(false);
  const [editingEventName, setEditingEventName] = useState('');
  const [editingFileName, setEditingFileName] = useState('');
  // Controller-specific state
  const [controllerPath, setControllerPath] = useState('');
  const [controllerMethod, setControllerMethod] = useState('POST');
  const [showControllerMappingDialog, setShowControllerMappingDialog] = useState(false);
  const [editingControllerPath, setEditingControllerPath] = useState('');
  // Cron-specific state
  const [cronSchedule, setCronSchedule] = useState('0 2 * * *');
  const [cronHandlerMethod, setCronHandlerMethod] = useState('');
  const [cronDescription, setCronDescription] = useState('');
  const [showCronMappingDialog, setShowCronMappingDialog] = useState(false);
  const [editingCronSchedule, setEditingCronSchedule] = useState('');
  const [editingCronHandlerMethod, setEditingCronHandlerMethod] = useState('');
  const [editingControllerMethod, setEditingControllerMethod] = useState('POST');
  const [isRunningMigration, setIsRunningMigration] = useState(false);
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [showMigrationsPanel, setShowMigrationsPanel] = useState(false);
  const [allMigrations, setAllMigrations] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [migrationWarnings, setMigrationWarnings] = useState([]);

  // Version control state
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [showVersionRestore, setShowVersionRestore] = useState(false);
  const [compareVersions, setCompareVersions] = useState({ from: null, to: null });
  const [restoreVersionId, setRestoreVersionId] = useState(null);
  const [currentVersionId, setCurrentVersionId] = useState(null);

  // Convert absolute viewport percentages to relative percentages within this component
  // This component gets (fileTreeTargetSize + editorTargetSize) of the viewport
  const totalSpace = fileTreeTargetSize + editorTargetSize;

  const calculateFileTreeRelativeSize = () => {
    // File tree target as % of our space
    return (fileTreeTargetSize / totalSpace) * 100;
  };

  const calculateEditorRelativeSize = () => {
    // Editor target as % of our space
    return (editorTargetSize / totalSpace) * 100;
  };

  useEffect(() => {
    loadPluginFiles();
  }, [plugin]);

  const loadPluginFiles = async () => {
    try {
      const response = await apiClient.get(`plugins/registry/${plugin.id}`);

      // Extract migrations for status panel
      const migrationsFromFiles = (response.data.source_code || [])
        .filter(f => f.name?.startsWith('migrations/'))
        .map(m => ({
          version: m.migration_version,
          description: m.migration_description,
          status: m.migration_status,
          executed_at: m.executed_at,
          name: m.name
        }));

      const entitiesFromFiles = (response.data.source_code || [])
        .filter(f => f.name?.startsWith('entities/'))
        .map(e => ({
          entity_name: e.entity_name,
          table_name: e.table_name,
          migration_status: e.migration_status
        }));

      setAllMigrations(migrationsFromFiles);

      // Build file tree structure
      const files = buildFileTree(response.data);
      setFileTree(files);

      // Expand only root folder, keep subdirectories collapsed
      setExpandedFolders(new Set(['root', '/']));
    } catch (error) {
      console.error('Error loading plugin files:', error);
    }
  };

  const buildFileTree = (pluginData) => {
    // Helper function to build dynamic tree from file paths
    const buildDynamicTree = (files) => {
      const root = {
        name: pluginData.name || 'plugin',
        type: 'folder',
        path: '/',
        children: []
      };

      // Create a map to track folder nodes
      const folderMap = { '/': root };

      files.forEach(file => {
        const fileName = file.name || '';
        const fileCode = file.code || '';

        // Normalize path - remove leading 'src/' if present, we'll add it back in structure
        let normalizedPath = fileName.replace(/^src\//, '');

        // Ensure path starts with /
        if (!normalizedPath.startsWith('/')) {
          normalizedPath = '/' + normalizedPath;
        }

        // Split path into parts
        const parts = normalizedPath.split('/').filter(p => p);

        // Build folder structure
        let currentPath = '';
        let currentFolder = root;

        // Process all parts except the last one (which is the file)
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath += '/' + parts[i];

          if (!folderMap[currentPath]) {
            const newFolder = {
              name: parts[i],
              type: 'folder',
              path: currentPath,
              children: []
            };
            currentFolder.children.push(newFolder);
            folderMap[currentPath] = newFolder;
          }

          currentFolder = folderMap[currentPath];
        }

        // Add the file to its parent folder
        if (parts.length > 0) {
          const fileNode = {
            name: parts[parts.length - 1],
            type: 'file',
            path: normalizedPath,
            content: fileCode,
            // Preserve metadata from source file (eventName, priority, etc.)
            ...(file.eventName && { eventName: file.eventName }),
            ...(file.priority && { priority: file.priority }),
            ...(file.description && { description: file.description })
          };
          currentFolder.children.push(fileNode);
        }
      });

      return root;
    };

    // Get all files from source_code or generatedFiles
    const allFiles = pluginData.source_code || pluginData.manifest?.generatedFiles || [];

    // Build dynamic tree from files
    // For event files from plugin_events table, preserve event_name metadata
    const tree = buildDynamicTree(allFiles.map(file => ({
      ...file,
      eventName: file.event_name || file.eventName, // Normalize event_name → eventName
      priority: file.priority
    })));

    // Add special categorized files with metadata (event listeners, hooks, admin pages)
    // These need special handling because they have extra metadata

    // Add event listeners with metadata
    if (pluginData.eventListeners && pluginData.eventListeners.length > 0) {
      let eventsFolder = tree.children.find(f => f.name === 'events');
      if (!eventsFolder) {
        eventsFolder = {
          name: 'events',
          type: 'folder',
          path: '/events',
          children: []
        };
        tree.children.push(eventsFolder);
      }

      // Replace or add event listener files with metadata
      pluginData.eventListeners.forEach(listener => {
        const existingIndex = eventsFolder.children.findIndex(f => f.path === listener.file_path);
        const eventFile = {
          name: listener.file_name,
          type: 'file',
          path: listener.file_path,
          content: listener.listener_code,
          eventName: listener.event_name,
          description: listener.description,
          priority: listener.priority
        };

        if (existingIndex >= 0) {
          eventsFolder.children[existingIndex] = eventFile;
        } else {
          eventsFolder.children.push(eventFile);
        }
      });
    }

    // Add admin pages with metadata
    if (pluginData.adminPages && pluginData.adminPages.length > 0) {
      let adminFolder = tree.children.find(f => f.name === 'admin');
      if (!adminFolder) {
        adminFolder = {
          name: 'admin',
          type: 'folder',
          path: '/admin',
          children: []
        };
        tree.children.push(adminFolder);
      }

      // Replace or add admin page files with metadata
      pluginData.adminPages.forEach(page => {
        const pagePath = `/admin/${page.page_key}.jsx`;
        const existingIndex = adminFolder.children.findIndex(f => f.path === pagePath);
        const pageFile = {
          name: `${page.page_key}.jsx`,
          type: 'file',
          path: pagePath,
          content: page.component_code,
          pageName: page.page_name,
          route: page.route,
          description: page.description,
          icon: page.icon,
          category: page.category
        };

        if (existingIndex >= 0) {
          adminFolder.children[existingIndex] = pageFile;
        } else {
          adminFolder.children.push(pageFile);
        }
      });
    }

    // Add hooks with metadata
    if (pluginData.hooks && pluginData.hooks.length > 0) {
      let hooksFolder = tree.children.find(f => f.name === 'hooks');
      if (!hooksFolder) {
        hooksFolder = {
          name: 'hooks',
          type: 'folder',
          path: '/hooks',
          children: []
        };
        tree.children.push(hooksFolder);
      }

      // Replace or add hook files with metadata
      pluginData.hooks.forEach(hook => {
        const hookPath = `/hooks/${hook.hook_name}.js`;
        const existingIndex = hooksFolder.children.findIndex(f => f.path === hookPath);
        const hookFile = {
          name: `${hook.hook_name}.js`,
          type: 'file',
          path: hookPath,
          content: hook.handler_code
        };

        if (existingIndex >= 0) {
          hooksFolder.children[existingIndex] = hookFile;
        } else {
          hooksFolder.children.push(hookFile);
        }
      });
    }

    // Add entities folder and ensure it's visible
    const entityFiles = allFiles.filter(f => f.name && f.name.startsWith('entities/'));

    if (entityFiles.length > 0) {
      let entitiesFolder = tree.children.find(f => f.name === 'entities');
      if (!entitiesFolder) {
        entitiesFolder = {
          name: 'entities',
          type: 'folder',
          path: '/entities',
          children: []
        };
        tree.children.push(entitiesFolder);
      }

      // Ensure entity files are in the folder with metadata
      entityFiles.forEach(entity => {
        const entityName = entity.name.replace('entities/', '');
        const entityPath = `/entities/${entityName}`;
        const existingIndex = entitiesFolder.children.findIndex(f => f.name === entityName);

        const entityFile = {
          name: entityName,
          type: 'file',
          path: entityPath,
          content: entity.code,
          entity_name: entity.entity_name,
          table_name: entity.table_name,
          migration_status: entity.migration_status
        };

        if (existingIndex >= 0) {
          entitiesFolder.children[existingIndex] = entityFile;
        } else {
          entitiesFolder.children.push(entityFile);
        }
      });
    }

    // Add controllers folder and ensure it's visible
    const controllerFiles = allFiles.filter(f => f.name && f.name.startsWith('controllers/'));

    if (controllerFiles.length > 0) {
      let controllersFolder = tree.children.find(f => f.name === 'controllers');
      if (!controllersFolder) {
        controllersFolder = {
          name: 'controllers',
          type: 'folder',
          path: '/controllers',
          children: []
        };
        tree.children.push(controllersFolder);
      }

      // Ensure controller files are in the folder with metadata
      controllerFiles.forEach(controller => {
        const controllerName = controller.name.replace('controllers/', '');
        const controllerPath = `/controllers/${controllerName}`;
        const existingIndex = controllersFolder.children.findIndex(f => f.name === controllerName);

        const controllerFile = {
          name: controllerName,
          type: 'file',
          path: controllerPath,
          content: controller.code,
          controller_name: controller.controller_name,
          method: controller.method,
          api_path: controller.path,
          description: controller.description,
          requires_auth: controller.requires_auth
        };

        if (existingIndex >= 0) {
          controllersFolder.children[existingIndex] = controllerFile;
        } else {
          controllersFolder.children.push(controllerFile);
        }
      });
    }

    // Add migrations folder and ensure it's visible
    const migrationFiles = allFiles.filter(f => f.name && f.name.startsWith('migrations/'));

    if (migrationFiles.length > 0) {
      let migrationsFolder = tree.children.find(f => f.name === 'migrations');
      if (!migrationsFolder) {
        migrationsFolder = {
          name: 'migrations',
          type: 'folder',
          path: '/migrations',
          children: []
        };
        tree.children.push(migrationsFolder);
      }

      // Ensure migration files are in the folder with metadata
      migrationFiles.forEach(migration => {
        const migrationName = migration.name.replace('migrations/', '');
        const migrationPath = `/migrations/${migrationName}`;
        const existingIndex = migrationsFolder.children.findIndex(f => f.name === migrationName);

        const migrationFile = {
          name: migrationName,
          type: 'file',
          path: migrationPath,
          content: migration.code,
          migration_version: migration.migration_version,
          migration_description: migration.migration_description,
          migration_status: migration.migration_status,
          executed_at: migration.executed_at
        };

        if (existingIndex >= 0) {
          migrationsFolder.children[existingIndex] = migrationFile;
        } else {
          migrationsFolder.children.push(migrationFile);
        }
      });
    }

    // Add cron folder and ensure it's visible
    const cronFiles = allFiles.filter(f => f.name && f.name.startsWith('cron/'));

    if (cronFiles.length > 0 || pluginData.cronJobs?.length > 0) {
      let cronFolder = tree.children.find(f => f.name === 'cron');
      if (!cronFolder) {
        cronFolder = {
          name: 'cron',
          type: 'folder',
          path: '/cron',
          children: []
        };
        tree.children.push(cronFolder);
      }

      // Add cron files from source_code array
      cronFiles.forEach(cron => {
        const cronName = cron.name.replace('cron/', '');
        const cronPath = `/cron/${cronName}`;
        const existingIndex = cronFolder.children.findIndex(f => f.name === cronName);

        const cronFile = {
          name: cronName,
          type: 'file',
          path: cronPath,
          content: cron.code,
          cron_name: cron.cron_name,
          cron_schedule: cron.cron_schedule,
          handler_method: cron.handler_method,
          description: cron.description,
          is_enabled: cron.is_enabled,
          last_run_at: cron.last_run_at,
          last_status: cron.last_status
        };

        if (existingIndex >= 0) {
          cronFolder.children[existingIndex] = cronFile;
        } else {
          cronFolder.children.push(cronFile);
        }
      });

      // Add cron jobs from plugin_cron table (if available)
      if (pluginData.cronJobs && pluginData.cronJobs.length > 0) {
        pluginData.cronJobs.forEach(cronJob => {
          const cronFileName = `${cronJob.cron_name}.json`;
          const cronPath = `/cron/${cronFileName}`;
          const existingIndex = cronFolder.children.findIndex(f => f.name === cronFileName);

          // Build content: show config + handler_code for editing
          const cronConfig = {
            cron_name: cronJob.cron_name,
            cron_schedule: cronJob.cron_schedule,
            handler_method: cronJob.handler_method,
            description: cronJob.description,
            handler_params: cronJob.handler_params || {},
            timezone: cronJob.timezone || 'UTC',
            is_enabled: cronJob.is_enabled,
            timeout_seconds: cronJob.timeout_seconds || 300,
            max_failures: cronJob.max_failures || 5
          };

          // If handler_code exists, show it in a code-friendly format
          let content;
          if (cronJob.handler_code) {
            // Use array join to avoid template literal issues
            content = [
              '// ═══════════════════════════════════════════════════════════════════════════',
              '// CRON CONFIG (stored in database)',
              '// ═══════════════════════════════════════════════════════════════════════════',
              '// Schedule: ' + cronJob.cron_schedule,
              '// Handler: ' + cronJob.handler_method,
              '// Enabled: ' + cronJob.is_enabled,
              '// ═══════════════════════════════════════════════════════════════════════════',
              '',
              '// To edit config, modify the values below and save:',
              'const config = ' + JSON.stringify(cronConfig, null, 2) + ';',
              '',
              '// ═══════════════════════════════════════════════════════════════════════════',
              '// HANDLER CODE (executed when cron runs)',
              '// Available: db, storeId, params, fetch, apiBaseUrl',
              '// ═══════════════════════════════════════════════════════════════════════════',
              '',
              cronJob.handler_code
            ].join('\n');
          } else {
            content = JSON.stringify(cronConfig, null, 2);
          }

          const cronFile = {
            name: cronFileName,
            type: 'file',
            path: cronPath,
            content,
            cron_name: cronJob.cron_name,
            cron_schedule: cronJob.cron_schedule,
            handler_method: cronJob.handler_method,
            handler_code: cronJob.handler_code,
            description: cronJob.description,
            is_enabled: cronJob.is_enabled,
            last_run_at: cronJob.last_run_at,
            last_status: cronJob.last_status,
            run_count: cronJob.run_count,
            success_count: cronJob.success_count
          };

          if (existingIndex >= 0) {
            cronFolder.children[existingIndex] = cronFile;
          } else {
            cronFolder.children.push(cronFile);
          }
        });
      }
    }

    // NO hardcoding - manifest.json and README.md come from backend via source_code array
    // - manifest.json: Backend adds from plugin_registry.manifest column
    // - README.md: Backend loads from plugin_docs table (doc_type='readme')

    return [tree];
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    setFileContent(file.content || '');
    setOriginalContent(file.content || '');
  };

  // Memoize handleCodeChange to prevent unnecessary re-renders
  const handleCodeChange = useCallback((newCode) => {
    setFileContent(newCode);
  }, []);

  // Render CodeEditor directly - no useMemo needed
  // CodeEditor manages its own internal state, parent re-renders won't cause remounting
  // Use key to force remount only when switching files
  const renderCodeEditor = () => {
    if (!selectedFile) return null;

    return (
      <CodeEditor
        key={selectedFile.path}
        value={fileContent}
        onChange={handleCodeChange}
        fileName={selectedFile.name}
        originalCode={originalContent}
        enableDiffDetection={true}
        enableTabs={false}
        className="h-full"
      />
    );
  };

  const handleSave = async () => {
    if (!selectedFile) {
      addTerminalOutput('✗ No file selected', 'error');
      setShowTerminal(true);
      return;
    }

    try {
      setIsSaving(true);
      setSaveSuccess(false);

      // Show terminal to display progress
      setShowTerminal(true);
      addTerminalOutput(`⏳ Saving ${selectedFile.name}...`, 'info');

      // Save file changes to backend
      await apiClient.put(`plugins/registry/${plugin.id}/files`, {
        path: selectedFile.path,
        content: fileContent
      });

      setOriginalContent(fileContent);

      // Auto-create version after successful save
      try {
        addTerminalOutput(`📝 Creating version snapshot...`, 'info');
        const versionResponse = await apiClient.post(`plugins/${plugin.id}/versions`, {
          commit_message: `Updated ${selectedFile.name}`,
          created_by: null, // TODO: Add user ID from context
          created_by_name: 'Developer'
        });

        if (versionResponse.success) {
          addTerminalOutput(`✓ Version ${versionResponse.version.version_number} created`, 'success');
          setCurrentVersionId(versionResponse.version.id);
        }
      } catch (versionError) {
        console.warn('Failed to create version:', versionError);
        addTerminalOutput(`⚠ Warning: Version not created`, 'warning');
      }

      setIsSaving(false);
      setSaveSuccess(true);

      // Auto-clear success state after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);

      addTerminalOutput(`✓ Saved ${selectedFile.name} successfully`, 'success');

      // Reload file tree to reflect changes
      await loadPluginFiles();
    } catch (error) {
      console.error('Error saving file:', error);
      setIsSaving(false);
      setSaveSuccess(false);
      addTerminalOutput(`✗ Error saving ${selectedFile.name}: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  // Version control handlers
  const handleOpenVersionHistory = () => {
    setShowVersionHistory(true);
  };

  const handleCompareVersions = (fromVersionId, toVersionId) => {
    setCompareVersions({ from: fromVersionId, to: toVersionId });
    setShowVersionCompare(true);
    setShowVersionHistory(false);
  };

  const handleRestoreVersion = (versionId) => {
    setRestoreVersionId(versionId);
    setShowVersionRestore(true);
    setShowVersionHistory(false);
  };

  const handleRestoreSuccess = async () => {
    // Reload plugin files after restore
    await loadPluginFiles();
    addTerminalOutput(`✓ Plugin restored to previous version`, 'success');
    setShowTerminal(true);
  };

  const handleDeleteFile = async () => {
    if (!selectedFile) {
      return;
    }

    setShowDeleteConfirm(false);
    setIsDeleting(true);
    setShowTerminal(true);

    try {
      addTerminalOutput(`⏳ Deleting ${selectedFile.name}...`, 'info');

      const deletePayload = {
        data: { path: selectedFile.path }
      };

      // Delete file from backend
      const response = await apiClient.delete(`plugins/registry/${plugin.id}/files`, deletePayload);

      // Check if deletion was successful
      if (response && response.success === false) {
        throw new Error(response.error || 'Delete failed');
      }

      addTerminalOutput(`✓ Deleted ${selectedFile.name} successfully`, 'success');
      addTerminalOutput(`  Reloading file tree...`, 'info');

      // Clear selection and reload
      setSelectedFile(null);
      setFileContent('');
      setOriginalContent('');
      await loadPluginFiles();

      addTerminalOutput(`✓ File tree reloaded`, 'success');
      setIsDeleting(false);

    } catch (error) {
      console.error('❌ Error deleting file:', error);
      console.error('   Error type:', error.constructor.name);
      console.error('   Error message:', error.message);
      console.error('   Error response:', error.response);
      console.error('   Error response data:', error.response?.data);
      console.error('   Error stack:', error.stack);

      setIsDeleting(false);
      addTerminalOutput(`✗ Error deleting ${selectedFile.name}: ${error.response?.data?.error || error.message}`, 'error');
      addTerminalOutput(`  Check console for details`, 'error');
    }
  };

  const handleRunMigration = async () => {
    if (!selectedFile) return;

    setShowMigrationConfirm(false);
    setIsRunningMigration(true);
    setShowTerminal(true);

    const isMigrationFile = selectedFile.path.startsWith('/migrations/');
    const isEntityFile = selectedFile.path.startsWith('/entities/');

    try {
      if (isMigrationFile) {
        // Run existing migration
        addTerminalOutput(`⏳ Running migration: ${selectedFile.migration_version || selectedFile.name}...`, 'info');

        const response = await apiClient.post(`plugins/${plugin.id}/run-migration`, {
          migration_version: selectedFile.migration_version,
          migration_name: selectedFile.name
        });

        const result = response.data || response;
        setMigrationResult(result);
        const executionTime = result.executionTime;
        addTerminalOutput(`✓ Migration completed successfully${executionTime ? ` in ${executionTime}ms` : ''}`, 'success');

        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach(w => addTerminalOutput(`  ${w}`, 'warning'));
        }

      } else if (isEntityFile) {
        // Generate pending migration for entity (don't execute yet)
        const entityData = JSON.parse(fileContent);

        // Extract names from entity data (more reliable than selectedFile metadata)
        const entityName = entityData.entity_name || selectedFile.entity_name;
        const tableName = entityData.table_name || selectedFile.table_name;

        if (!entityName || !tableName) {
          throw new Error('Entity must have entity_name and table_name defined');
        }

        // Generate migration FIRST (before saving, so old schema is still in database)
        addTerminalOutput(`⏳ Generating migration for entity: ${entityName} (${tableName})...`, 'info');

        const response = await apiClient.post(`plugins/${plugin.id}/generate-entity-migration`, {
          entity_name: entityName,
          table_name: tableName,
          schema_definition: entityData.schema_definition
        });

        // Save entity AFTER migration is generated (so next time we can compare)
        addTerminalOutput(`⏳ Saving updated entity schema: ${entityName}...`, 'info');
        await apiClient.put(`plugins/registry/${plugin.id}/files`, {
          path: selectedFile.path,
          content: fileContent
        });
        setOriginalContent(fileContent);

        const result = response.data || response;
        setMigrationResult(result);
        const migrationVersion = result.migrationVersion;
        addTerminalOutput(`✓ Migration generated: ${migrationVersion}`, 'success');
        addTerminalOutput(`  Status: pending (run from migrations folder)`, 'info');

        if (result.warnings && result.warnings.length > 0) {
          addTerminalOutput(`  ⚠️ Warnings:`, 'warning');
          result.warnings.forEach(w => addTerminalOutput(`    ${w}`, 'warning'));
        }

        // Reload file tree to show new migration
        await loadPluginFiles();
      }

      setIsRunningMigration(false);

    } catch (error) {
      console.error('Error running migration:', error);
      setIsRunningMigration(false);
      setMigrationResult({
        success: false,
        error: error.response?.data?.error || error.message
      });
      addTerminalOutput(`✗ Migration failed: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const handleAICodeGenerated = (code, files) => {
    if (selectedFile) {
      // Replace current file content with AI-generated code
      setFileContent(code);
      addTerminalOutput('✓ AI generated code applied', 'success');
    } else if (files && files.length > 0) {
      // AI generated new files
      addTerminalOutput(`✓ AI generated ${files.length} new files`, 'success');
      loadPluginFiles(); // Reload file tree
    }
  };

  const addTerminalOutput = (message, type = 'info') => {
    setTerminalOutput(prev => [
      ...prev,
      {
        message,
        type,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const runTests = async () => {
    addTerminalOutput('⚠️ Test endpoint not implemented yet', 'error');
    setShowTerminal(true);

    // TODO: Backend needs to implement POST /api/plugins/registry/:id/test endpoint
    // This should run plugin validation, linting, or other tests
  };

  const handleCreateNewFile = async () => {
    if (!newFileName.trim()) {
      addTerminalOutput('✗ File name cannot be empty', 'error');
      setShowTerminal(true);
      return;
    }

    // Validate event selection for event files
    if (newFileType === 'event' && !selectedEventName) {
      addTerminalOutput('✗ Please select an event for this file to listen to', 'error');
      setShowTerminal(true);
      return;
    }

    // Validate controller path and method for controller files
    if (newFileType === 'controller') {
      if (!controllerPath.trim()) {
        addTerminalOutput('✗ Controller path cannot be empty', 'error');
        setShowTerminal(true);
        return;
      }
      if (!controllerMethod) {
        addTerminalOutput('✗ Please select an HTTP method', 'error');
        setShowTerminal(true);
        return;
      }
    }

    try {
      // Determine file path based on type
      let filePath = '';
      let fileExtension = '.js';

      switch (newFileType) {
        case 'controller':
          filePath = `/controllers/${newFileName}`;
          fileExtension = '.js';
          break;
        case 'component':
          filePath = `/components/${newFileName}`;
          fileExtension = '.jsx';
          break;
        case 'util':
          filePath = `/utils/${newFileName}`;
          fileExtension = '.js';
          break;
        case 'service':
          filePath = `/services/${newFileName}`;
          fileExtension = '.js';
          break;
        case 'hook':
          filePath = `/hooks/${newFileName}`;
          fileExtension = '.js';
          break;
        case 'event':
          filePath = `/events/${newFileName}`;
          fileExtension = '.js';
          break;
        case 'cron':
          filePath = `/cron/${newFileName}`;
          fileExtension = '.json';
          break;
        default:
          filePath = `/${newFileName}`;
      }

      // Add extension if not present
      if (!filePath.endsWith(fileExtension) && !filePath.includes('.')) {
        filePath += fileExtension;
      }

      addTerminalOutput(`⏳ Creating ${filePath}...`, 'info');
      setShowTerminal(true);

      // Create default content based on file type
      let defaultContent = `// ${newFileName}\n// Created: ${new Date().toISOString()}\n\n`;

      if (newFileType === 'event') {
        // Convert event name to camelCase function name (e.g., cart.viewed -> onCartViewed)
        const functionName = 'on' + selectedEventName
          .split('.')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');

        defaultContent = `// Event listener for: ${selectedEventName}\n// Created: ${new Date().toISOString()}\n\nexport default function ${functionName}(data) {\n  // Your code here\n  console.log('${selectedEventName} fired:', data);\n}\n`;
      } else if (newFileType === 'controller') {
        // Create default controller function
        const functionName = newFileName.replace(/[^a-zA-Z0-9]/g, '');
        defaultContent = `// Controller: ${newFileName}\n// ${controllerMethod} ${controllerPath}\n// Created: ${new Date().toISOString()}\n\nasync function ${functionName}(req, res, { sequelize }) {\n  try {\n    // Your code here\n    res.json({\n      success: true,\n      message: 'Controller response',\n      data: {}\n    });\n  } catch (error) {\n    console.error('Controller error:', error);\n    res.status(500).json({\n      success: false,\n      error: error.message\n    });\n  }\n}\n`;
      } else if (newFileType === 'component') {
        // Create default React component
        const componentName = newFileName.replace(/[^a-zA-Z0-9]/g, '');
        defaultContent = `// Component: ${componentName}\n// Created: ${new Date().toISOString()}\n\nimport React from 'react';\n\nexport default function ${componentName}() {\n  return (\n    <div className="p-4">\n      <h3 className="font-semibold">Hello from ${componentName}!</h3>\n      <p>Your component content goes here.</p>\n    </div>\n  );\n}\n`;
      } else if (newFileType === 'util') {
        // Create default utility functions
        defaultContent = `// Utility: ${newFileName}\n// Created: ${new Date().toISOString()}\n\n/**\n * Example utility function\n * @param {any} value - The value to process\n * @returns {any} The processed value\n */\nexport function exampleUtil(value) {\n  return value;\n}\n\n// Add more utility functions here\n`;
      } else if (newFileType === 'service') {
        // Create default service
        defaultContent = `// Service: ${newFileName}\n// Created: ${new Date().toISOString()}\n\nclass ${newFileName.replace(/[^a-zA-Z0-9]/g, '')}Service {\n  constructor() {\n    // Initialize service\n  }\n\n  /**\n   * Example service method\n   */\n  async fetchData() {\n    try {\n      // Your API calls or data operations here\n      return { success: true, data: [] };\n    } catch (error) {\n      console.error('Service error:', error);\n      throw error;\n    }\n  }\n}\n\nexport default new ${newFileName.replace(/[^a-zA-Z0-9]/g, '')}Service();\n`;
      } else if (newFileType === 'cron') {
        // Create default cron job configuration (JSON)
        defaultContent = JSON.stringify({
          cron_name: newFileName.replace(/\.json$/, ''),
          cron_schedule: cronSchedule,
          handler_method: cronHandlerMethod,
          description: cronDescription || `Scheduled task: ${newFileName}`,
          handler_params: {},
          timezone: 'UTC',
          is_enabled: true,
          timeout_seconds: 300,
          max_failures: 5
        }, null, 2);
      }

      // For event files, create the event listener mapping in junction table
      if (newFileType === 'event') {
        await apiClient.post(`plugins/${plugin.id}/event-listeners`, {
          file_name: newFileName.endsWith('.js') ? newFileName : `${newFileName}.js`,
          file_path: filePath,
          event_name: selectedEventName,
          listener_function: defaultContent,
          priority: 10,
          description: `Listens to ${selectedEventName}`
        });

        addTerminalOutput(`✓ Created ${filePath} and mapped to ${selectedEventName}`, 'success');
      } else if (newFileType === 'controller') {
        // For controller files, create in plugin_controllers table
        await apiClient.post(`plugins/${plugin.id}/controllers`, {
          controller_name: newFileName.replace(/\.js$/, ''),
          method: controllerMethod,
          path: controllerPath,
          handler_code: defaultContent,
          description: `${controllerMethod} ${controllerPath}`,
          requires_auth: false
        });

        addTerminalOutput(`✓ Created controller ${newFileName} (${controllerMethod} ${controllerPath})`, 'success');
      } else if (newFileType === 'cron') {
        // For cron files, create in plugin_cron table AND auto-generate handler file
        const cronName = newFileName.replace(/\.json$/, '');

        // 1. Create cron config in plugin_cron table
        await apiClient.post(`plugins/${plugin.id}/cron`, {
          cron_name: cronName,
          cron_schedule: cronSchedule,
          handler_method: cronHandlerMethod,
          description: cronDescription || `Scheduled task: ${cronName}`,
          handler_params: {},
          timezone: 'UTC',
          is_enabled: true,
          timeout_seconds: 300,
          max_failures: 5
        });

        addTerminalOutput(``, 'info');
        addTerminalOutput(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        addTerminalOutput(`🕐 CREATING CRON JOB...`, 'info');
        addTerminalOutput(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        addTerminalOutput(``, 'info');
        addTerminalOutput(`📋 Step 1: Generating handler code...`, 'info');

        // Generate handler code (stored in database, not as file)
        // Using array join to avoid nested template literal issues
        const handlerCode = [
          '/**',
          ` * CRON HANDLER: ${cronHandlerMethod}`,
          ` * Schedule: ${cronSchedule}`,
          ` * ${cronDescription || 'Scheduled task for ' + cronName}`,
          ' *',
          ' * AVAILABLE VARIABLES:',
          ' *   - db        → Database connection (Supabase client)',
          ' *   - storeId   → Your store ID',
          ' *   - params    → Custom parameters from handler_params',
          ' *   - fetch     → Make HTTP requests',
          ' *   - apiBaseUrl → Backend API URL',
          ' */',
          '',
          '// ══════════════════════════════════════════════════════════════',
          '// STEP 1: Get store information',
          '// ══════════════════════════════════════════════════════════════',
          'const { data: store } = await db',
          "  .from('stores')",
          "  .select('id, name, email, settings')",
          "  .eq('id', storeId)",
          '  .single();',
          '',
          'if (!store) {',
          "  throw new Error('Store not found: ' + storeId);",
          '}',
          '',
          "console.log('🏪 Store:', store.name);",
          "console.log('📧 Email:', store.email);",
          '',
          '// ══════════════════════════════════════════════════════════════',
          '// STEP 2: Your custom logic here',
          '// ══════════════════════════════════════════════════════════════',
          '// Example: Query data from your tables',
          '// const { data: items } = await db',
          "//   .from('your_table')",
          "//   .select('*')",
          "//   .eq('store_id', storeId);",
          '//',
          "// console.log('Found', items?.length, 'items');",
          '',
          '// ══════════════════════════════════════════════════════════════',
          '// STEP 3: Send notification email to store owner',
          '// ══════════════════════════════════════════════════════════════',
          "const emailResponse = await fetch(apiBaseUrl + '/api/email/send', {",
          "  method: 'POST',",
          "  headers: { 'Content-Type': 'application/json' },",
          '  body: JSON.stringify({',
          '    to: store.email,',
          `    subject: '🕐 Scheduled Task: ${cronHandlerMethod}',`,
          "    html: '<div style=\"font-family: Arial, sans-serif;\">' +",
          "      '<h2>✅ Scheduled Task Completed</h2>' +",
          `      '<p>Your task <strong>${cronHandlerMethod}</strong> ran successfully.</p>' +`,
          "      '<p><strong>Store:</strong> ' + store.name + '</p>' +",
          `      '<p><strong>Schedule:</strong> ${cronSchedule}</p>' +`,
          "      '<p><strong>Executed:</strong> ' + new Date().toLocaleString() + '</p>' +",
          "      '</div>'",
          '  })',
          '});',
          '',
          "console.log('📧 Email sent to:', store.email);",
          '',
          '// ══════════════════════════════════════════════════════════════',
          '// STEP 4: Return result (saved to plugin_cron.last_result)',
          '// ══════════════════════════════════════════════════════════════',
          'return {',
          '  success: true,',
          '  storeName: store.name,',
          '  storeEmail: store.email,',
          '  emailSent: true,',
          '  executedAt: new Date().toISOString()',
          '};'
        ].join('\n');

        addTerminalOutput(`   ✓ Handler code generated (${handlerCode.length} bytes)`, 'success');
        addTerminalOutput(``, 'info');
        addTerminalOutput(`📋 Step 2: Saving to database...`, 'info');

        // Update cron job with handler_code (100% DB driven)
        await apiClient.put(`plugins/${plugin.id}/cron/${cronName}`, {
          handler_code: handlerCode
        });

        addTerminalOutput(`   ✓ Saved to plugin_cron table`, 'success');
        addTerminalOutput(``, 'info');
        addTerminalOutput(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        addTerminalOutput(`✅ CRON JOB CREATED SUCCESSFULLY!`, 'success');
        addTerminalOutput(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        addTerminalOutput(``, 'info');
        addTerminalOutput(`📁 Location: /cron/${cronName}.json`, 'info');
        addTerminalOutput(`📅 Schedule: ${cronSchedule}`, 'info');
        addTerminalOutput(`🔧 Handler:  ${cronHandlerMethod}`, 'info');
        addTerminalOutput(`💾 Storage:  100% Database (plugin_cron table)`, 'info');
        addTerminalOutput(``, 'info');
        addTerminalOutput(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        addTerminalOutput(`💡 WHAT HAPPENS NEXT:`, 'info');
        addTerminalOutput(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'info');
        addTerminalOutput(`   1. Scheduler checks plugin_cron every 60 seconds`, 'info');
        addTerminalOutput(`   2. When schedule matches, handler_code is executed`, 'info');
        addTerminalOutput(`   3. Result is saved to last_result column`, 'info');
        addTerminalOutput(`   4. Demo: Sends email to your store's email address`, 'info');
        addTerminalOutput(``, 'info');
        addTerminalOutput(`📝 Edit /cron/${cronName}.json to customize the handler code.`, 'info');
      } else {
        // For component, util, service, hook, and other files, use the file save endpoint
        // These will be saved to plugin_scripts table (for components/utils/services) or plugin_hooks table (for hooks)
        await apiClient.put(`plugins/registry/${plugin.id}/files`, {
          path: filePath,
          content: defaultContent
        });

        const fileTypeLabels = {
          component: 'Component',
          util: 'Utility',
          service: 'Service',
          hook: 'Hook'
        };
        const fileTypeLabel = fileTypeLabels[newFileType] || 'File';
        addTerminalOutput(`✓ Created ${fileTypeLabel}: ${filePath}`, 'success');
      }

      // Close dialog and reset
      setShowNewFileDialog(false);
      setNewFileName('');
      setNewFileType('controller');
      setSelectedEventName('');
      setEventSearchQuery('');
      setControllerPath('');
      setControllerMethod('POST');
      setCronSchedule('0 2 * * *');
      setCronHandlerMethod('');
      setCronDescription('');

      // Reload file tree
      await loadPluginFiles();

    } catch (error) {
      console.error('Error creating file:', error);
      addTerminalOutput(`✗ Error creating file: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const handleUpdateEventMapping = async () => {
    if (!editingEventName.trim()) {
      addTerminalOutput('✗ Event name cannot be empty', 'error');
      setShowTerminal(true);
      return;
    }

    if (!editingFileName.trim()) {
      addTerminalOutput('✗ File name cannot be empty', 'error');
      setShowTerminal(true);
      return;
    }

    if (!selectedFile || !selectedFile.eventName) {
      addTerminalOutput('✗ No event file selected', 'error');
      setShowTerminal(true);
      return;
    }

    try {
      const filenameChanged = editingFileName !== selectedFile.name;
      const eventChanged = editingEventName !== selectedFile.eventName;

      if (filenameChanged && eventChanged) {
        addTerminalOutput(`⏳ Updating filename to ${editingFileName} and event to ${editingEventName}...`, 'info');
      } else if (filenameChanged) {
        addTerminalOutput(`⏳ Renaming file to ${editingFileName}...`, 'info');
      } else {
        addTerminalOutput(`⏳ Updating event mapping to ${editingEventName}...`, 'info');
      }

      setShowTerminal(true);

      // Create or update event listener mapping
      await apiClient.post(`plugins/${plugin.id}/event-listeners`, {
        file_name: editingFileName,  // New filename
        old_file_name: selectedFile.name,  // Old filename for lookup
        event_name: editingEventName,
        old_event_name: selectedFile.eventName,  // Send old event name for remapping
        listener_function: fileContent,
        priority: selectedFile.priority || 10,
        description: `Listens to ${editingEventName}`
      });

      if (filenameChanged && eventChanged) {
        addTerminalOutput(`✓ Updated filename and event mapping`, 'success');
      } else if (filenameChanged) {
        addTerminalOutput(`✓ File renamed to ${editingFileName}`, 'success');
      } else {
        addTerminalOutput(`✓ Event mapping updated to ${editingEventName}`, 'success');
      }

      // Close dialog and reset
      setShowEventMappingDialog(false);
      setEditingEventName('');
      setEditingFileName('');
      setEventSearchQuery('');

      // Reload file tree
      await loadPluginFiles();

    } catch (error) {
      console.error('Error updating event mapping:', error);
      addTerminalOutput(`✗ Error updating event mapping: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const handleUpdateControllerMapping = async () => {
    if (!editingControllerPath.trim()) {
      addTerminalOutput('✗ Controller path cannot be empty', 'error');
      setShowTerminal(true);
      return;
    }

    if (!editingControllerMethod) {
      addTerminalOutput('✗ HTTP method cannot be empty', 'error');
      setShowTerminal(true);
      return;
    }

    if (!editingFileName.trim()) {
      addTerminalOutput('✗ Controller name cannot be empty', 'error');
      setShowTerminal(true);
      return;
    }

    if (!selectedFile || !selectedFile.controller_name) {
      addTerminalOutput('✗ No controller file selected', 'error');
      setShowTerminal(true);
      return;
    }

    try {
      const nameChanged = editingFileName !== selectedFile.name;
      const pathChanged = editingControllerPath !== selectedFile.api_path;
      const methodChanged = editingControllerMethod !== selectedFile.method;

      let changeMessages = [];
      if (nameChanged) changeMessages.push(`name to ${editingFileName}`);
      if (pathChanged) changeMessages.push(`path to ${editingControllerPath}`);
      if (methodChanged) changeMessages.push(`method to ${editingControllerMethod}`);

      if (changeMessages.length > 0) {
        addTerminalOutput(`⏳ Updating controller ${changeMessages.join(', ')}...`, 'info');
      } else {
        addTerminalOutput(`⏳ No changes detected`, 'info');
      }

      setShowTerminal(true);

      // Update controller metadata
      await apiClient.put(`plugins/${plugin.id}/controllers/${selectedFile.controller_name}`, {
        controller_name: editingFileName.replace(/\.js$/, ''),
        old_controller_name: selectedFile.controller_name,
        method: editingControllerMethod,
        path: editingControllerPath,
        handler_code: fileContent,
        description: `${editingControllerMethod} ${editingControllerPath}`,
        requires_auth: selectedFile.requires_auth || false
      });

      addTerminalOutput(`✓ Controller updated successfully`, 'success');

      // Close dialog and reset
      setShowControllerMappingDialog(false);
      setEditingFileName('');
      setEditingControllerPath('');
      setEditingControllerMethod('POST');

      // Reload file tree
      await loadPluginFiles();

    } catch (error) {
      console.error('Error updating controller:', error);
      addTerminalOutput(`✗ Error updating controller: ${error.response?.data?.error || error.message}`, 'error');
    }
  };

  const renderFileTree = (nodes, depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const Icon = node.type === 'folder'
        ? (isExpanded ? ChevronDown : ChevronRight)
        : FileText;

      return (
        <div key={node.path}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 cursor-pointer rounded ${
              selectedFile?.path === node.path ? 'bg-blue-100 text-blue-900' : ''
            }`}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => {
              if (node.type === 'folder') {
                toggleFolder(node.path);
              } else {
                handleFileSelect(node);
              }
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm truncate">{node.name}</span>

            {/* Show event name badge for event files */}
            {node.eventName && (
              <Badge className="ml-auto bg-purple-100 text-purple-700 text-xs" title={node.description || `Listens to ${node.eventName}`}>
                {node.eventName}
              </Badge>
            )}

            {/* Show cron schedule badge for cron files */}
            {node.cron_schedule && (
              <Badge
                className={`ml-auto text-xs flex items-center gap-1 ${node.is_enabled !== false ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                title={`${node.description || node.cron_name} - Handler: ${node.handler_method}${node.last_run_at ? ` | Last run: ${new Date(node.last_run_at).toLocaleString()}` : ''}`}
              >
                <Clock className="w-3 h-3" />
                {node.cron_schedule}
              </Badge>
            )}

            {/* Show modified badge */}
            {node.type === 'file' && fileContent !== originalContent && selectedFile?.path === node.path && !node.eventName && !node.cron_schedule && (
              <Badge className="ml-auto bg-orange-100 text-orange-700 text-xs">M</Badge>
            )}
          </div>
          {node.type === 'folder' && isExpanded && node.children && (
            renderFileTree(node.children, depth + 1)
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Tree Sidebar */}
        <ResizablePanel
          defaultSize={calculateFileTreeRelativeSize()}
          minSize={10}
          maxSize={50}
          collapsible={false}
        >
          <div className="h-full bg-white border-r overflow-hidden flex flex-col">
            <div className="h-12 px-3 border-b bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
              <div className="flex-1 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Files
                </h3>
                <Badge className="bg-blue-100 text-blue-700 text-xs">
                  v{plugin.version}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMigrationsPanel(!showMigrationsPanel)}
                  title="View migration status"
                  className="h-6 w-6 p-0 relative"
                >
                  <Database className={`w-4 h-4 ${
                    allMigrations.some(m => m.status === 'pending')
                      ? 'text-orange-500'
                      : 'text-gray-700'
                  }`} />
                  {allMigrations.some(m => m.status === 'pending') && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
                  )}
                </Button>
              </div>
            </div>
                {/* Migrations Status Panel */}
                {showMigrationsPanel && (
                  <div className="border-b bg-blue-50 p-3">
                    {/* Run All Pending Migrations Button */}
                    {allMigrations.some(m => m.status === 'pending') && (
                      <div className="mb-3">
                        <Button
                          size="sm"
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => {
                            // TODO: Implement run all pending migrations
                            addTerminalOutput('⏳ Running all pending migrations...', 'info');
                            setShowTerminal(true);
                          }}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Run All Pending Migrations
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                        <Database className="w-4 h-4" />
                        Migrations Status
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMigrationsPanel(false)}
                        className="h-5 w-5 p-0"
                      >
                        ×
                      </Button>
                    </div>

                    {allMigrations.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No migrations found</p>
                    ) : (
                      <div className="space-y-1">
                        {allMigrations.map((migration, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2 rounded border text-xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-medium">{migration.version}</span>
                              <Badge className={
                                migration.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : migration.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                              }>
                                {migration.status === 'completed' ? '✓' :
                                 migration.status === 'pending' ? '⏳' : '✗'}
                              </Badge>
                            </div>
                            {migration.description && (
                              <p className="text-gray-600 text-xs truncate">
                                {migration.description}
                              </p>
                            )}
                            {migration.executed_at && (
                              <p className="text-gray-400 text-xs mt-1">
                                {new Date(migration.executed_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Plugin Version:</span> {plugin.version}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-2">
                  {renderFileTree(fileTree)}
                </div>
                <div className="p-2 border-t bg-gray-50">
                  <Button
                    size="sm"
                    className="w-full"
                    variant="outline"
                    onClick={() => setShowNewFileDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New File
                  </Button>
                </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Editor Area */}
        <ResizablePanel
          defaultSize={calculateEditorRelativeSize()}
          minSize={20}
          maxSize={100}
          collapsible={false}
        >
          <div className="h-full flex flex-col bg-white rounded-lg overflow-hidden">
                {/* Editor Header */}
                <div className="h-12 px-3 border-b bg-gray-50 flex items-center justify-between">
                    {selectedFile ? (
                      <>
                        <div className="flex items-center gap-3">
                          <Code2 className="w-4 h-4 text-blue-600" />
                          <FileText className="w-4 h-4 text-gray-600" />
                          <span className="font-medium" title={selectedFile.name}>
                            {selectedFile.name.length > 20
                              ? selectedFile.name.substring(0, 20) + '...'
                              : selectedFile.name}
                          </span>

                          {/* Migration Status Badge - only show for migrated entities */}
                          {selectedFile?.path?.startsWith('/entities/') && selectedFile?.migration_status === 'migrated' && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              ✓ Migrated
                            </Badge>
                          )}

                          {/* Modified Badge */}
                          {fileContent !== originalContent && (
                            <Badge className="bg-orange-100 text-orange-700 text-xs">
                              Modified
                            </Badge>
                          )}
                          {selectedFile.eventName && (
                            <Badge className="bg-purple-100 text-purple-700 text-xs">
                              {selectedFile.eventName}
                            </Badge>
                          )}
                        </div>
                      </>
                    ) : (
                        <div className="flex items-center gap-3">
                          <Code2 className="w-4 h-4 text-blue-600" />
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            Code
                          </h3>
                        </div>
                    )}

                  <div className="flex items-center justify-between w-full">
                    {/* Left side: Context-specific action buttons */}
                    <div className="flex items-center gap-2">
                      {/* Edit Event Mapping button - only for event files */}
                      {selectedFile?.eventName && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingEventName(selectedFile.eventName);
                            setEditingFileName(selectedFile.name); // Set current filename
                            setEventSearchQuery(''); // Reset search when opening
                            setShowEventMappingDialog(true);
                          }}
                          title="Edit filename and event mapping"
                        >
                          <Zap className="w-4 h-4 mr-1" />
                          Edit Event
                        </Button>
                      )}

                      {/* Edit Controller button - only for controller files */}
                      {selectedFile?.controller_name && selectedFile?.method && selectedFile?.api_path && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingFileName(selectedFile.name || selectedFile.controller_name);
                            setEditingControllerPath(selectedFile.api_path);
                            setEditingControllerMethod(selectedFile.method);
                            setShowControllerMappingDialog(true);
                          }}
                          title="Edit controller name, path, and method"
                        >
                          <Code className="w-4 h-4 mr-1" />
                          Edit Controller
                        </Button>
                      )}

                      {/* Run Migration button - for migration files */}
                      {selectedFile?.path?.startsWith('/migrations/') && (
                        selectedFile?.migration_status === 'completed' ? (
                          <span className="text-sm text-green-600 font-medium">
                            Already Executed
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
                            onClick={() => setShowMigrationConfirm(true)}
                            disabled={isRunningMigration}
                            title="Execute this migration"
                          >
                            <Play className="w-4 h-4 mr-1" />
                            {isRunningMigration ? 'Running...' : 'Run Migration'}
                          </Button>
                        )
                      )}

                      {/* Generate Migration button - only show when entity file is modified */}
                      {selectedFile?.path?.startsWith('/entities/') && fileContent !== originalContent && (
                        <Button
                          size="sm"
                          variant="outline"
                          className={
                            selectedFile?.migration_status === 'migrated'
                              ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-300'
                              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-300'
                          }
                          onClick={() => setShowMigrationConfirm(true)}
                          disabled={isRunningMigration}
                          title={
                            selectedFile?.migration_status === 'migrated'
                              ? 'Generate ALTER TABLE migration for updated schema'
                              : 'Generate CREATE TABLE migration for this entity'
                          }
                        >
                          <Wand2 className="w-4 h-4 mr-1" />
                          {isRunningMigration ? 'Generating...' :
                           selectedFile?.migration_status === 'migrated' ? 'Generate Update' : 'Generate Migration'}
                        </Button>
                      )}
                    </div>

                    {/* Right side: Utility buttons */}
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={runTests}
                        title="Run tests"
                      >
                        <Bug className="w-4 h-4 mr-1" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowTerminal(!showTerminal)}
                        title="Toggle terminal"
                      >
                        <Terminal className="w-4 h-4 mr-1" />
                      </Button>
                      <SaveButton
                          size="sm"
                          onClick={handleSave}
                          loading={isSaving}
                          success={saveSuccess}
                          disabled={!selectedFile || fileContent === originalContent}
                          defaultText="Save"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleOpenVersionHistory}
                        title="Version History (Local History)"
                        className="gap-1"
                      >
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">History</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={!selectedFile || isDeleting}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete this file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Code Editor */}
                <div className="flex-1 overflow-hidden">
                  {selectedFile ? (
                    renderCodeEditor()
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Code className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          Select a file to edit
                        </h3>
                        <p className="text-sm">
                          Choose a file from the tree on the left to start coding
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Terminal */}
                {showTerminal && (
                  <div className="h-48 border-t bg-gray-900 text-green-400 font-mono text-sm overflow-y-auto p-4">
                    {terminalOutput.map((output, index) => (
                      <div
                        key={index}
                        className={`mb-1 ${
                          output.type === 'error' ? 'text-red-400' :
                          output.type === 'success' ? 'text-green-400' :
                          'text-gray-400'
                        }`}
                      >
                        <span className="text-gray-600">[{output.timestamp}]</span> {output.message}
                      </div>
                    ))}
                  </div>
                )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* New File Dialog */}
      {showNewFileDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Create New File</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Name
                </label>
                <Input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder={
                    newFileType === 'event' ? 'e.g., analytics_tracker' :
                    newFileType === 'controller' ? 'e.g., trackVisit' :
                    newFileType === 'component' ? 'e.g., UserWidget' :
                    newFileType === 'util' ? 'e.g., formatters' :
                    newFileType === 'service' ? 'e.g., analytics' :
                    newFileType === 'hook' ? 'e.g., useCartData' :
                    'e.g., myFile'
                  }
                  className="w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFileType !== 'event' && newFileType !== 'controller') {
                      handleCreateNewFile();
                    } else if (e.key === 'Escape') {
                      setShowNewFileDialog(false);
                    }
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Type
                </label>
                <select
                  value={newFileType}
                  onChange={(e) => {
                    setNewFileType(e.target.value);
                    setSelectedEventName('');
                    setEventSearchQuery('');
                    setControllerPath('');
                    setControllerMethod('POST');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="controller">Controller - API Endpoint (.js)</option>
                  <option value="component">Component - React Widget (.jsx)</option>
                  <option value="util">Utility - Helper Functions (.js)</option>
                  <option value="service">Service - API/Data Layer (.js)</option>
                  <option value="hook">Hook - React Hook (.js)</option>
                  <option value="event">Event Listener (.js)</option>
                  <option value="cron">Cron Job - Scheduled Task (.json)</option>
                </select>
              </div>

              {/* Event Selection - Only for Event type */}
              {newFileType === 'event' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Event to Listen To *
                  </label>
                  <EventSelector
                    searchQuery={eventSearchQuery}
                    onSearchChange={setEventSearchQuery}
                    selectedEvent={selectedEventName}
                    onSelectEvent={setSelectedEventName}
                    showConfirmation={true}
                  />
                </div>
              )}

              {/* Controller Path and Method - Only for Controller type */}
              {newFileType === 'controller' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      HTTP Method *
                    </label>
                    <select
                      value={controllerMethod}
                      onChange={(e) => setControllerMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Path *
                    </label>
                    <Input
                      value={controllerPath}
                      onChange={(e) => setControllerPath(e.target.value)}
                      placeholder="e.g., /track-visit or /api/users/:id"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The endpoint path (can include route parameters like :id)
                    </p>
                  </div>
                </>
              )}

              {/* Cron Schedule and Handler - Only for Cron type */}
              {newFileType === 'cron' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cron Schedule *
                    </label>
                    <Input
                      value={cronSchedule}
                      onChange={(e) => setCronSchedule(e.target.value)}
                      placeholder="e.g., 0 2 * * * (daily at 2 AM)"
                      className="w-full font-mono"
                    />
                    <div className="text-xs text-gray-500 mt-1 space-y-1">
                      <p>Standard cron format: minute hour day month weekday</p>
                      <p className="font-mono">
                        Examples: <span className="text-blue-600">0 2 * * *</span> (daily 2AM),{' '}
                        <span className="text-blue-600">0 */6 * * *</span> (every 6h),{' '}
                        <span className="text-blue-600">0 9 * * 1</span> (Mon 9AM)
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Handler Method *
                    </label>
                    <Input
                      value={cronHandlerMethod}
                      onChange={(e) => setCronHandlerMethod(e.target.value)}
                      placeholder="e.g., sendCartReminders"
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The method name in your plugin class to call when the cron runs
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <Input
                      value={cronDescription}
                      onChange={(e) => setCronDescription(e.target.value)}
                      placeholder="e.g., Send abandoned cart reminder emails"
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleCreateNewFile}
                className="flex-1"
                disabled={(newFileType === 'event' && !selectedEventName) || (newFileType === 'controller' && (!controllerPath.trim() || !controllerMethod)) || (newFileType === 'cron' && (!cronSchedule.trim() || !cronHandlerMethod.trim()))}
              >
                Create
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewFileDialog(false);
                  setNewFileName('');
                  setNewFileType('controller');
                  setSelectedEventName('');
                  setEventSearchQuery('');
                  setControllerPath('');
                  setControllerMethod('POST');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Mapping Dialog */}
      {showEventMappingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Event File</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File Name
                </label>
                <Input
                  value={editingFileName}
                  onChange={(e) => setEditingFileName(e.target.value)}
                  placeholder="e.g., my-tracker.js"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Custom filename for this event listener
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event to Listen To *
                </label>
                <EventSelector
                  searchQuery={eventSearchQuery}
                  onSearchChange={setEventSearchQuery}
                  selectedEvent={editingEventName}
                  onSelectEvent={setEditingEventName}
                  showConfirmation={true}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleUpdateEventMapping}
                className="flex-1"
              >
                Update
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEventMappingDialog(false);
                  setEditingEventName('');
                  setEditingFileName('');
                  setEventSearchQuery(''); // Reset search
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Controller Mapping Dialog */}
      {showControllerMappingDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Controller</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Controller Name
                </label>
                <Input
                  value={editingFileName}
                  onChange={(e) => setEditingFileName(e.target.value)}
                  placeholder="e.g., trackVisit"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Name of the controller (without .js extension)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTTP Method *
                </label>
                <select
                  value={editingControllerMethod}
                  onChange={(e) => setEditingControllerMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Path *
                </label>
                <Input
                  value={editingControllerPath}
                  onChange={(e) => setEditingControllerPath(e.target.value)}
                  placeholder="e.g., /track-visit or /api/users/:id"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The endpoint path (can include route parameters)
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={handleUpdateControllerMapping}
                className="flex-1"
              >
                Update
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowControllerMappingDialog(false);
                  setEditingFileName('');
                  setEditingControllerPath('');
                  setEditingControllerMethod('POST');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete File Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete File
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete this file?
              </p>

              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-xs font-medium text-gray-700 mb-1">File:</p>
                <p className="text-sm font-mono break-all">{selectedFile?.name}</p>
                {selectedFile?.path && (
                  <>
                    <p className="text-xs font-medium text-gray-700 mt-2 mb-1">Path:</p>
                    <p className="text-xs font-mono text-gray-600 break-all">{selectedFile.path}</p>
                  </>
                )}
              </div>

              {/* Special warning for protected files */}
              {(selectedFile?.name === 'README.md' || selectedFile?.name === 'manifest.json') ? (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                  <p className="text-xs text-yellow-800 font-medium">
                    ⚠️ Protected File
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    This file cannot be deleted as it's required for the plugin to function.
                  </p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 p-3 rounded">
                  <p className="text-xs text-red-800 font-medium">
                    ⚠️ This action cannot be undone!
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    The file will be permanently deleted from the plugin.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => setShowDeleteConfirm(false)}
                variant="outline"
                className="flex-1"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteFile}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={isDeleting || selectedFile?.name === 'README.md' || selectedFile?.name === 'manifest.json'}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {isDeleting ? 'Deleting...' : (selectedFile?.name === 'README.md' || selectedFile?.name === 'manifest.json') ? 'Cannot Delete' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Run Migration Confirmation Dialog */}
      {showMigrationConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {selectedFile?.path?.startsWith('/migrations/') ? (
                <>
                  <Play className="w-5 h-5 text-blue-600" />
                  Run Migration
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 text-purple-600" />
                  Generate Migration
                </>
              )}
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {selectedFile?.path?.startsWith('/migrations/')
                  ? `Are you sure you want to execute this migration? This will modify your database schema.`
                  : `This will generate a pending migration file. You can review and run it from the migrations folder.`}
              </p>

              <div className="bg-gray-50 p-3 rounded border">
                <p className="text-xs font-medium text-gray-700 mb-1">
                  {selectedFile?.path?.startsWith('/migrations/') ? 'Migration:' : 'Entity:'}
                </p>
                <p className="text-sm font-mono">
                  {selectedFile?.path?.startsWith('/migrations/')
                    ? selectedFile.migration_version || selectedFile.name
                    : selectedFile.entity_name || selectedFile.name}
                </p>
                {selectedFile?.table_name && (
                  <>
                    <p className="text-xs font-medium text-gray-700 mt-2 mb-1">Table:</p>
                    <p className="text-sm font-mono">{selectedFile.table_name}</p>
                  </>
                )}
              </div>

              {selectedFile?.path?.startsWith('/migrations/') && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                  <p className="text-xs text-yellow-800 font-medium mb-2">
                    ⚠️ This will modify your database schema immediately.
                  </p>
                  <p className="text-xs text-yellow-700">
                    Make sure you have a backup before proceeding.
                  </p>
                </div>
              )}

              {!selectedFile?.path?.startsWith('/migrations/') && (
                <div className="bg-purple-50 border border-purple-200 p-3 rounded">
                  <p className="text-xs text-purple-800">
                    📝 This will create a pending migration file that you can review before executing.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => setShowMigrationConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRunMigration}
                className={`flex-1 ${
                  selectedFile?.path?.startsWith('/migrations/')
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-purple-600 hover:bg-purple-700'
                } text-white`}
              >
                {selectedFile?.path?.startsWith('/migrations/') ? (
                  <>
                    <Play className="w-4 h-4 mr-1" />
                    Run Now
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-1" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Migration Result Dialog */}
      {migrationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${migrationResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {migrationResult.success ? '✓' : '✗'} {migrationResult.status === 'pending' ? 'Migration Generated' : 'Migration Completed'}
            </h3>

            <div className="space-y-4">
              {migrationResult.success ? (
                <>
                  <div className="bg-green-50 border border-green-200 p-3 rounded">
                    <p className="text-sm text-green-800">
                      {migrationResult.status === 'pending'
                        ? 'Migration file created successfully!'
                        : 'Migration executed successfully!'}
                    </p>
                  </div>

                  {migrationResult.executionTime && (
                    <p className="text-xs text-gray-600">
                      Execution time: {migrationResult.executionTime}ms
                    </p>
                  )}

                  {migrationResult.migrationVersion && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-xs font-medium text-gray-700 mb-1">Migration Version:</p>
                      <p className="text-sm font-mono">{migrationResult.migrationVersion}</p>
                      {migrationResult.status === 'pending' && (
                        <p className="text-xs text-gray-600 mt-2">
                          📁 Find this migration in the migrations folder to review and execute it.
                        </p>
                      )}
                    </div>
                  )}

                  {migrationResult.warnings && migrationResult.warnings.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded">
                      <p className="text-xs font-medium text-orange-800 mb-2">⚠️ Warnings:</p>
                      {migrationResult.warnings.map((warning, idx) => (
                        <p key={idx} className="text-xs text-orange-700 mb-1">
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-red-50 border border-red-200 p-3 rounded">
                  <p className="text-sm text-red-800 font-medium mb-2">Error:</p>
                  <p className="text-xs text-red-700 font-mono">
                    {migrationResult.error}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => setMigrationResult(null)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Version Control Modals */}
      {showVersionHistory && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 border-l">
          <VersionHistoryPanel
            pluginId={plugin.id}
            onClose={() => setShowVersionHistory(false)}
            onCompare={handleCompareVersions}
            onRestore={handleRestoreVersion}
          />
        </div>
      )}

      {showVersionCompare && (
        <VersionCompareModal
          pluginId={plugin.id}
          fromVersionId={compareVersions.from}
          toVersionId={compareVersions.to}
          onClose={() => setShowVersionCompare(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {showVersionRestore && (
        <VersionRestoreModal
          pluginId={plugin.id}
          versionId={restoreVersionId}
          currentVersionId={currentVersionId}
          onClose={() => setShowVersionRestore(false)}
          onSuccess={handleRestoreSuccess}
        />
      )}
    </div>
  );
};

export default DeveloperPluginEditor;
