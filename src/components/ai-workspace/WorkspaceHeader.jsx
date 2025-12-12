import React, { useState, useEffect } from 'react';
import { useAIWorkspace } from '@/contexts/AIWorkspaceContext';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  PanelLeftClose,
  PanelLeft,
  Save,
  Pencil,
  Eye,
  Loader2,
  Plug,
  ChevronDown,
  ChevronUp,
  Package,
  Plus,
  Rocket,
  CheckCircle2,
  History,
  Clock,
  AlertCircle,
  Check,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { slotEnabledFiles } from '@/components/editor/slot/slotEnabledFiles';
import apiClient from '@/api/client';
import { User } from '@/api/entities';
import slotConfigurationService from '@/services/slotConfigurationService';
import PublishPanel from '@/components/editor/slot/PublishPanel';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * WorkspaceHeader - Header component for AI Workspace
 * Contains page selector, editor toggle, viewport controls, and save status
 */

const WorkspaceHeader = () => {
  const {
    selectedPageType,
    selectPage,
    editorMode,
    toggleEditorMode,
    hasUnsavedChanges,
    isLoading,
    aiPanelCollapsed,
    toggleAiPanel,
    showPluginEditor,
    pluginToEdit,
    openPluginEditor,
    closePluginEditor,
    showAiStudio,
    openAiStudio,
    closeAiStudio,
    chatMinimized,
    toggleChatMinimized,
    registerPublishStatusRefresh,
    triggerConfigurationRefresh,
    editorSidebarVisible
  } = useAIWorkspace();

  const { getSelectedStoreId } = useStoreSelection();
  const [plugins, setPlugins] = useState([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [unpublishedStatus, setUnpublishedStatus] = useState(null);
  const [draftConfig, setDraftConfig] = useState(null);
  const [publishPopoverOpen, setPublishPopoverOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [showCreatePluginDialog, setShowCreatePluginDialog] = useState(false);
  const [newPluginData, setNewPluginData] = useState({ name: '', description: '', category: 'integration' });
  const [creatingPlugin, setCreatingPlugin] = useState(false);

  const storeId = getSelectedStoreId();

  // Load user's plugins
  useEffect(() => {
    if (storeId) {
      loadPlugins();
    }
  }, [storeId]);

  // Check global unpublished status on mount and when storeId changes
  useEffect(() => {
    if (storeId) {
      checkUnpublishedStatus();
    }
  }, [storeId]);

  // Register the refresh callback so editors can trigger status updates
  useEffect(() => {
    registerPublishStatusRefresh(checkUnpublishedStatus);
  }, [registerPublishStatusRefresh, storeId]);

  // Listen for configuration saves to refresh publish status
  useEffect(() => {
    const handleConfigSaved = () => {
      checkUnpublishedStatus();
    };

    window.addEventListener('slot-configuration-saved', handleConfigSaved);
    return () => {
      window.removeEventListener('slot-configuration-saved', handleConfigSaved);
    };
  }, [storeId]);

  // Load draft config for selected page type
  useEffect(() => {
    loadDraftConfig();
  }, [storeId, selectedPageType]);

  const checkUnpublishedStatus = async () => {
    if (!storeId) return;

    try {
      const response = await slotConfigurationService.getUnpublishedStatus(storeId);
      if (response?.success && response?.data) {
        setUnpublishedStatus(response.data);
        setHasUnpublishedChanges(response.data.hasAnyUnpublishedChanges || false);
      }
    } catch (error) {
      console.error('Failed to check unpublished status:', error);
      setHasUnpublishedChanges(false);
    }
  };

  const loadDraftConfig = async () => {
    if (!storeId || !selectedPageType) return;

    try {
      const response = await slotConfigurationService.getDraftConfiguration(storeId, selectedPageType);
      if (response?.data) {
        setDraftConfig(response.data);
      }
    } catch (error) {
      console.error('Failed to load draft config:', error);
    }
  };

  const loadPlugins = async () => {
    try {
      setLoadingPlugins(true);

      // Fetch user and plugins in parallel
      const [userData, pluginsResponse] = await Promise.all([
        User.me(),
        apiClient.get(`stores/${storeId}/plugins`)
      ]);

      setUser(userData);

      // Get plugins from response - handle array directly or nested in data/plugins
      const allPlugins = Array.isArray(pluginsResponse)
        ? pluginsResponse
        : (pluginsResponse?.data?.plugins || pluginsResponse?.plugins || []);

      // Filter to only show user's own plugins (matching "My Plugins" tab behavior)
      // Also filter out starter templates
      const myPlugins = allPlugins.filter(plugin =>
        plugin.creator_id === userData?.id && !plugin.is_starter_template
      );

      setPlugins(myPlugins);
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoadingPlugins(false);
    }
  };

  // Handle publish complete - refresh state
  const handlePublished = () => {
    setHasUnpublishedChanges(false);
    setUnpublishedStatus(null);
    setPublishPopoverOpen(false);
    loadDraftConfig();
    // Re-check status after publish
    checkUnpublishedStatus();
  };

  // Handle revert complete - refresh state and trigger editor reload
  const handleReverted = () => {
    loadDraftConfig();
    checkUnpublishedStatus();
    triggerConfigurationRefresh(); // Signal editors to reload configuration
  };

  // Get the current page info
  const currentPage = slotEnabledFiles.find(f => f.pageType === selectedPageType);
  const PageIcon = currentPage?.icon;

  // Handle selecting a page from Editor dropdown
  const handleSelectPage = (pageType) => {
    selectPage(pageType);
    if (!editorMode) {
      toggleEditorMode();
    }
  };

  // Handle selecting a plugin from Plugins dropdown
  const handleSelectPlugin = (plugin) => {
    openPluginEditor(plugin);
  };

  // Handle creating a new plugin with AI (same as Plugins page)
  const handleCreateWithAI = async () => {
    if (!newPluginData.name.trim()) {
      toast.error('Please enter a plugin name');
      return;
    }

    // Generate slug from name
    const slug = newPluginData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Close dialog
    setShowCreatePluginDialog(false);

    // Exit editor mode if active
    if (editorMode) toggleEditorMode();

    // Open plugin editor with the new plugin data
    openPluginEditor({
      name: newPluginData.name,
      slug: slug,
      description: newPluginData.description || `A custom ${newPluginData.category} plugin`,
      category: newPluginData.category,
      version: '1.0.0',
      author: user?.name || 'Store Owner',
      isNew: true,
      manifest: {
        name: newPluginData.name,
        slug: slug,
        version: '1.0.0',
        description: newPluginData.description || `A custom ${newPluginData.category} plugin`,
        author: user?.name || 'Store Owner',
        category: newPluginData.category,
        hooks: {},
        configSchema: { properties: {} }
      }
    });

    // Reset form
    setNewPluginData({ name: '', description: '', category: 'integration' });
  };

  return (
    <header className="h-14 border-b bg-white dark:bg-gray-800 flex items-center px-4 gap-4 shrink-0">
      {/* Left section: AI Panel toggle */}
      <div className="flex items-center gap-1">
        {/* AI Panel toggle - different behavior for plugin editor vs normal mode */}
        {showPluginEditor ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleChatMinimized}
            className="h-8 w-8 p-0"
            title={chatMinimized ? 'Show AI Chat' : 'Hide AI Chat'}
          >
            {chatMinimized ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAiPanel}
            className="h-8 w-8 p-0"
            title={aiPanelCollapsed ? 'Show AI Panel' : 'Hide AI Panel'}
          >
            {aiPanelCollapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Center section: Title + Context info */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            AI Workspace
          </h1>
          {editorMode && currentPage && !showPluginEditor && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Editing: {currentPage.name}
            </p>
          )}
          {showPluginEditor && pluginToEdit && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Plugin: {pluginToEdit.name}
            </p>
          )}
          {showAiStudio && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              AI Studio - Code Editor
            </p>
          )}
          {!editorMode && !showPluginEditor && !showAiStudio && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Storefront Preview (Draft)
            </p>
          )}
        </div>
      </div>

      {/* Right section: Editor + Plugins buttons */}
      <div className={`flex items-center gap-2 transition-all duration-300 ${editorSidebarVisible ? 'mr-80' : ''}`}>
        {/* Editor Dropdown */}
        {editorMode && !showPluginEditor && !showAiStudio ? (
          // In editor mode - show Exit Editor button + page selector
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="h-8 gap-1.5">
                  {PageIcon && <PageIcon className="h-3.5 w-3.5" />}
                  <span>{currentPage?.name || 'Page'}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Select Page</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {slotEnabledFiles
                  .filter(file => !file.comingSoon)
                  .map((file) => {
                    const Icon = file.icon;
                    return (
                      <DropdownMenuItem
                        key={file.id}
                        onClick={() => selectPage(file.pageType)}
                        className={selectedPageType === file.pageType ? 'bg-gray-100' : ''}
                      >
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className={`h-4 w-4 ${file.color}`} />}
                          <span>{file.name}</span>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleEditorMode}
              className="h-8 gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Exit Editor</span>
            </Button>
          </div>
        ) : !showPluginEditor && !showAiStudio ? (
          // Not in editor mode - show Editor dropdown
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                <span>Editor</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Edit Page</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {slotEnabledFiles
                .filter(file => !file.comingSoon)
                .map((file) => {
                  const Icon = file.icon;
                  return (
                    <DropdownMenuItem
                      key={file.id}
                      onClick={() => handleSelectPage(file.pageType)}
                    >
                      <div className="flex items-center gap-2">
                        {Icon && <Icon className={`h-4 w-4 ${file.color}`} />}
                        <span>{file.name}</span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {/* Plugins Dropdown */}
        {showPluginEditor ? (
          // In plugin mode - show Exit Plugins button
          <Button
            variant="default"
            size="sm"
            onClick={closePluginEditor}
            className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700"
          >
            <Package className="h-3.5 w-3.5" />
            <span>Exit Plugins</span>
          </Button>
        ) : !showAiStudio && (
          // Not in plugin mode - show Plugins dropdown
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Plug className="h-3.5 w-3.5" />
                <span>Plugins</span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Your Plugins</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {loadingPlugins ? (
                <DropdownMenuItem disabled>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </DropdownMenuItem>
              ) : plugins.length === 0 ? (
                <DropdownMenuItem disabled>
                  <span className="text-gray-500">No plugins yet</span>
                </DropdownMenuItem>
              ) : (
                plugins.map((plugin) => (
                  <DropdownMenuItem
                    key={plugin.id}
                    onClick={() => handleSelectPlugin(plugin)}
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-purple-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{plugin.name}</div>
                        <div className="text-xs text-gray-500 truncate">v{plugin.version}</div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowCreatePluginDialog(true)}>
                <Plus className="h-4 w-4 mr-2 text-green-600" />
                <span>Create New Plugin</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Publish Button with Panel */}
        <Popover open={publishPopoverOpen} onOpenChange={setPublishPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={
                hasUnpublishedChanges
                  ? 'h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white border-green-600'
                  : 'h-8 gap-1.5 bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }
              title={hasUnpublishedChanges ? 'Publish draft changes to production' : 'View versions and history'}
            >
              <Rocket className="h-3.5 w-3.5" />
              <span>{hasUnpublishedChanges ? 'Publish' : 'Versions'}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 p-0">
            <PublishPanel
              draftConfig={draftConfig}
              storeId={storeId}
              pageType={selectedPageType}
              onPublished={handlePublished}
              onReverted={handleReverted}
              hasUnsavedChanges={hasUnpublishedChanges}
              unpublishedStatus={unpublishedStatus}
              globalPublish={true}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Create Plugin with AI Dialog */}
      <Dialog open={showCreatePluginDialog} onOpenChange={setShowCreatePluginDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Create Plugin with AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Give your plugin a name and description. AI will help you build it in the next step.
            </p>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Plugin Name *
              </label>
              <Input
                placeholder="e.g., Store Announcement"
                value={newPluginData.name}
                onChange={(e) => setNewPluginData({ ...newPluginData, name: e.target.value })}
                disabled={creatingPlugin}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Description
              </label>
              <textarea
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 rounded-md p-2 text-sm min-h-[80px]"
                placeholder="Describe what your plugin will do..."
                value={newPluginData.description}
                onChange={(e) => setNewPluginData({ ...newPluginData, description: e.target.value })}
                disabled={creatingPlugin}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Category
              </label>
              <Select
                value={newPluginData.category}
                onValueChange={(value) => setNewPluginData({ ...newPluginData, category: value })}
                disabled={creatingPlugin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="display">Display</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreatePluginDialog(false);
                  setNewPluginData({ name: '', description: '', category: 'integration' });
                }}
                disabled={creatingPlugin}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateWithAI}
                disabled={creatingPlugin || !newPluginData.name.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {creatingPlugin ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create & Open Editor
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default WorkspaceHeader;
