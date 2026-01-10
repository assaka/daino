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
  Sparkles,
  HelpCircle,
  BookOpen
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import FlashMessage from '@/components/storefront/FlashMessage';
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
  const [flashMessage, setFlashMessage] = useState(null);
  const [showPluginHowTo, setShowPluginHowTo] = useState(false);

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
      setFlashMessage({ type: 'error', message: 'Please enter a plugin name' });
      return;
    }

    // Generate slug from name
    const slug = newPluginData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Close dialog
    setShowCreatePluginDialog(false);

    // Exit editor mode if active
    if (editorMode) toggleEditorMode();

    // Create plugin data
    const pluginData = {
      name: newPluginData.name,
      slug: slug,
      description: newPluginData.description || `A custom ${newPluginData.category} plugin`,
      category: newPluginData.category,
      version: '1.0.0',
      author: user?.name || 'Store Owner',
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
    };

    try {
      // Save plugin to database first to get an ID
      const response = await apiClient.post('/ai/plugin/create', { pluginData });

      if (response.success) {
        const pluginId = response.pluginId || response.plugin?.id;
        const pluginSlug = response.plugin?.slug || slug;

        if (!pluginId) {
          throw new Error('Plugin created but no ID returned');
        }

        // Open plugin editor with the saved plugin (including ID)
        openPluginEditor({
          ...pluginData,
          id: pluginId,
          slug: pluginSlug
        });

        setFlashMessage({ type: 'success', message: 'Plugin created successfully!' });
      } else {
        throw new Error(response.message || 'Failed to create plugin');
      }
    } catch (error) {
      console.error('Failed to create plugin:', error);
      setFlashMessage({ type: 'error', message: `Failed to create plugin: ${error.message}` });
    }

    // Reset form
    setNewPluginData({ name: '', description: '', category: 'integration' });
  };

  return (
    <header className="h-14 border-b bg-white dark:bg-gray-800 flex items-center px-4 gap-4 shrink-0">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
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
          // In plugin mode - show How-to and Exit Plugins buttons
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPluginHowTo(true)}
              className="h-8 gap-1.5"
              title="Plugin Development Guide"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>How-to</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={closePluginEditor}
              className="h-8 gap-1.5 bg-purple-600 hover:bg-purple-700"
            >
              <Package className="h-3.5 w-3.5" />
              <span>Exit Plugins</span>
            </Button>
          </div>
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

      {/* Plugin How-To Dialog */}
      <Dialog open={showPluginHowTo} onOpenChange={setShowPluginHowTo}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Plugin Development Guide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm">

            {/* Getting Started */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Getting Started</h3>
              <p className="text-gray-600 mb-3">
                Use the AI chat on the left to create plugin components. Tell it what you want to build:
              </p>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100">
                "Create a live chat plugin with a floating button on the storefront and an admin dashboard to manage conversations"
              </div>
              <p className="text-gray-500 text-xs mt-2">
                The AI will generate the necessary widgets, admin pages, controllers, and migrations.
              </p>
            </div>

            {/* File Types Overview */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Plugin File Types</h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-left">File Type</th>
                    <th className="border p-2 text-left">Purpose</th>
                    <th className="border p-2 text-left">Runs On</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2 font-medium text-blue-700">Widgets</td>
                    <td className="border p-2">UI components on storefront (buttons, modals, banners)</td>
                    <td className="border p-2">Browser (customer-facing)</td>
                  </tr>
                  <tr>
                    <td className="border p-2 font-medium text-purple-700">Admin Pages</td>
                    <td className="border p-2">Dashboard pages for store owners</td>
                    <td className="border p-2">Browser (admin panel)</td>
                  </tr>
                  <tr>
                    <td className="border p-2 font-medium text-green-700">Controllers</td>
                    <td className="border p-2">API endpoints that handle requests</td>
                    <td className="border p-2">Server (backend)</td>
                  </tr>
                  <tr>
                    <td className="border p-2 font-medium text-orange-700">Migrations</td>
                    <td className="border p-2">Database table creation</td>
                    <td className="border p-2">Server (on install)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* How They Work Together */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">How Components Interact</h3>
              <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-gray-700">{`STOREFRONT                    SERVER                      ADMIN PANEL
┌──────────────┐              ┌──────────────┐             ┌──────────────┐
│   Widget     │──fetch()───▶│  Controller  │◀──fetch()───│  Admin Page  │
│              │              │              │             │              │
│ Chat button  │              │ getMessages  │             │  Dashboard   │
│ Send message │              │ sendMessage  │             │  View chats  │
└──────────────┘              └──────┬───────┘             └──────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │   Database   │
                              │  (Supabase)  │
                              │              │
                              │ Tables from  │
                              │  Migrations  │
                              └──────────────┘`}</pre>
              </div>
            </div>

            {/* Widgets Section */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Widgets</h3>
              <p className="text-gray-600 mb-2">
                Widgets are React components that display on the storefront. They use <code className="bg-gray-100 px-1 rounded text-xs">React.createElement()</code> syntax (not JSX).
              </p>

              <h4 className="font-medium text-gray-800 mt-4 mb-2">Widget Categories</h4>
              <table className="w-full text-xs border-collapse mb-4">
                <tbody>
                  <tr>
                    <td className="border p-2"><code className="bg-blue-100 text-blue-700 px-1 rounded">support</code> <code className="bg-blue-100 text-blue-700 px-1 rounded">floating</code> <code className="bg-blue-100 text-blue-700 px-1 rounded">chat</code> <code className="bg-blue-100 text-blue-700 px-1 rounded">global</code></td>
                    <td className="border p-2">Shows on <strong>ALL</strong> storefront pages</td>
                  </tr>
                  <tr>
                    <td className="border p-2"><code className="bg-gray-100 text-gray-700 px-1 rounded">product</code></td>
                    <td className="border p-2">Shows on product pages only</td>
                  </tr>
                  <tr>
                    <td className="border p-2"><code className="bg-gray-100 text-gray-700 px-1 rounded">cart</code></td>
                    <td className="border p-2">Shows on cart page only</td>
                  </tr>
                </tbody>
              </table>

              <h4 className="font-medium text-gray-800 mb-2">Widget Code Example</h4>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100 overflow-x-auto">
                <pre>{`function MyWidget({ config = {} }) {
  const [open, setOpen] = React.useState(false);

  // REQUIRED: Include store ID for tenant isolation
  const getHeaders = () => {
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    return storeId ? { 'x-store-id': storeId } : {};
  };

  // Call your plugin's controller
  const sendMessage = async (text) => {
    await fetch('/api/plugins/my-plugin/exec/messages', {
      method: 'POST',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
  };

  // Use React.createElement, NOT JSX
  return React.createElement('button', {
    onClick: () => setOpen(!open),
    style: { position: 'fixed', bottom: 20, right: 20 }
  }, '💬 Chat');
}`}</pre>
              </div>
            </div>

            {/* Admin Pages Section */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Admin Pages</h3>
              <p className="text-gray-600 mb-2">
                Admin pages are dashboard UI for store owners. They <strong>can use JSX</strong> syntax and import UI components.
              </p>

              <h4 className="font-medium text-gray-800 mt-4 mb-2">Available Imports</h4>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100 overflow-x-auto mb-4">
                <pre>{`// UI Components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// Icons
import { MessageCircle, Send, Settings, Check, X } from 'lucide-react';`}</pre>
              </div>

              <h4 className="font-medium text-gray-800 mb-2">Admin Page Code Example</h4>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100 overflow-x-auto">
                <pre>{`import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  const [data, setData] = useState([]);

  const getHeaders = () => {
    const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
    return storeId ? { 'x-store-id': storeId } : {};
  };

  useEffect(() => {
    fetch('/api/plugins/my-plugin/exec/items', { headers: getHeaders() })
      .then(r => r.json())
      .then(result => setData(result.items));
  }, []);

  return (
    <div className="p-6">
      <Card>
        <CardHeader><CardTitle>Dashboard</CardTitle></CardHeader>
        <CardContent>
          {data.map(item => <div key={item.id}>{item.name}</div>)}
        </CardContent>
      </Card>
    </div>
  );
}`}</pre>
              </div>
            </div>

            {/* Controllers Section */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Controllers</h3>
              <p className="text-gray-600 mb-2">
                Controllers are API endpoints that run on the server. They receive <code className="bg-gray-100 px-1 rounded text-xs">{'{ supabase }'}</code> for database access.
              </p>

              <h4 className="font-medium text-gray-800 mt-4 mb-2">Endpoint URL Pattern</h4>
              <div className="bg-gray-100 rounded p-2 font-mono text-xs mb-4">
                /api/plugins/<span className="text-blue-600">{'{plugin-slug}'}</span>/exec/<span className="text-green-600">{'{controller-path}'}</span>
              </div>

              <h4 className="font-medium text-gray-800 mb-2">Controller Code Example</h4>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100 overflow-x-auto">
                <pre>{`async function getMessages(req, res, { supabase }) {
  // req.query  - URL query params (?status=active)
  // req.body   - POST request body
  // req.params - URL path params (:id)

  try {
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, messages });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function sendMessage(req, res, { supabase }) {
  const { message, session_id } = req.body;

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ message, session_id })
    .select()
    .single();

  if (error) return res.status(500).json({ success: false, error: error.message });
  return res.json({ success: true, message: data });
}`}</pre>
              </div>

              <h4 className="font-medium text-gray-800 mt-4 mb-2">Supabase Query Reference</h4>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100 overflow-x-auto">
                <pre>{`// SELECT all
const { data } = await supabase.from('table').select('*');

// SELECT with filter
const { data } = await supabase.from('table').select('*').eq('status', 'active');

// INSERT
const { data } = await supabase.from('table').insert({ name: 'Test' }).select().single();

// UPDATE
await supabase.from('table').update({ name: 'New' }).eq('id', 123);

// DELETE
await supabase.from('table').delete().eq('id', 123);

// COUNT
const { count } = await supabase.from('table').select('*', { count: 'exact', head: true });`}</pre>
              </div>
            </div>

            {/* Migrations Section */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Migrations</h3>
              <p className="text-gray-600 mb-2">
                Migrations create database tables for your plugin. They run automatically on plugin install, or manually via the "Run Migration" button.
              </p>

              <h4 className="font-medium text-gray-800 mt-4 mb-2">When Migrations Run</h4>
              <ul className="text-gray-700 text-xs space-y-1 mb-4">
                <li>• <strong>On Install</strong>: When a user installs your plugin</li>
                <li>• <strong>Manually</strong>: Click the database icon in the file tree, then "Run Migration"</li>
              </ul>

              <h4 className="font-medium text-gray-800 mb-2">Migration Status</h4>
              <div className="flex gap-4 text-xs mb-4">
                <span><span className="text-green-600">✅</span> Applied - Migration ran successfully</span>
                <span><span className="text-orange-500">⏳</span> Pending - Needs to be run</span>
                <span><span className="text-red-500">❌</span> Failed - Error occurred</span>
              </div>

              <h4 className="font-medium text-gray-800 mb-2">Migration Code Example</h4>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100 overflow-x-auto">
                <pre>{`-- Always use IF NOT EXISTS to prevent errors on re-run
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL UNIQUE,
  customer_email VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  from_type VARCHAR(20) NOT NULL,  -- 'customer' or 'agent'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);`}</pre>
              </div>

              <h4 className="font-medium text-gray-800 mt-4 mb-2">Common Column Types</h4>
              <table className="w-full text-xs border-collapse">
                <tbody>
                  <tr><td className="border p-1"><code>UUID</code></td><td className="border p-1">Primary keys, IDs</td></tr>
                  <tr><td className="border p-1"><code>VARCHAR(n)</code></td><td className="border p-1">Short text (names, emails)</td></tr>
                  <tr><td className="border p-1"><code>TEXT</code></td><td className="border p-1">Long text (messages)</td></tr>
                  <tr><td className="border p-1"><code>JSONB</code></td><td className="border p-1">JSON data (configs)</td></tr>
                  <tr><td className="border p-1"><code>BOOLEAN</code></td><td className="border p-1">True/false flags</td></tr>
                  <tr><td className="border p-1"><code>TIMESTAMP WITH TIME ZONE</code></td><td className="border p-1">Dates/times</td></tr>
                </tbody>
              </table>
            </div>

            {/* Store ID Header */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Store ID Header (Required)</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                <p className="text-yellow-800 text-xs">
                  <strong>Every API call must include the store ID</strong> for multi-tenant isolation. Without it, you'll get 401 errors.
                </p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100 overflow-x-auto">
                <pre>{`const getHeaders = () => {
  const storeId = localStorage.getItem('selectedStoreId') || localStorage.getItem('storeId');
  return storeId ? { 'x-store-id': storeId } : {};
};

// GET request
fetch('/api/plugins/my-plugin/exec/data', { headers: getHeaders() });

// POST request
fetch('/api/plugins/my-plugin/exec/data', {
  method: 'POST',
  headers: { ...getHeaders(), 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Test' })
});`}</pre>
              </div>
            </div>

            {/* Example AI Requests */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Example AI Requests</h3>
              <div className="space-y-2">
                <div className="bg-gray-50 rounded p-2 text-xs">
                  <span className="text-gray-500">Create a complete plugin:</span>
                  <div className="font-mono mt-1">"Create a product reviews plugin with star ratings, an admin page to moderate, and database tables"</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-xs">
                  <span className="text-gray-500">Add a widget:</span>
                  <div className="font-mono mt-1">"Add a floating notification widget that shows on all pages"</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-xs">
                  <span className="text-gray-500">Add a controller:</span>
                  <div className="font-mono mt-1">"Add a controller to save and retrieve user preferences"</div>
                </div>
                <div className="bg-gray-50 rounded p-2 text-xs">
                  <span className="text-gray-500">Fix an error:</span>
                  <div className="font-mono mt-1">"I'm getting a 401 error when calling the API from my widget"</div>
                </div>
              </div>
            </div>

            {/* Troubleshooting */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 text-base border-b pb-2">Troubleshooting</h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-left">Problem</th>
                    <th className="border p-2 text-left">Cause</th>
                    <th className="border p-2 text-left">Solution</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">Widget not showing</td>
                    <td className="border p-2">Wrong category</td>
                    <td className="border p-2">Set to <code className="bg-gray-100 px-1 rounded">support</code>, <code className="bg-gray-100 px-1 rounded">floating</code>, or <code className="bg-gray-100 px-1 rounded">chat</code></td>
                  </tr>
                  <tr>
                    <td className="border p-2">401 error on API</td>
                    <td className="border p-2">Missing store ID</td>
                    <td className="border p-2">Add <code className="bg-gray-100 px-1 rounded">x-store-id</code> header</td>
                  </tr>
                  <tr>
                    <td className="border p-2">Controller error</td>
                    <td className="border p-2">Using Sequelize</td>
                    <td className="border p-2">Use <code className="bg-gray-100 px-1 rounded">{'{ supabase }'}</code> not sequelize</td>
                  </tr>
                  <tr>
                    <td className="border p-2">Admin page 404</td>
                    <td className="border p-2">Route mismatch</td>
                    <td className="border p-2">Match adminNavigation.route to adminPages[].route</td>
                  </tr>
                  <tr>
                    <td className="border p-2">Widget JSX error</td>
                    <td className="border p-2">Using JSX syntax</td>
                    <td className="border p-2">Use <code className="bg-gray-100 px-1 rounded">React.createElement()</code> in widgets</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setShowPluginHowTo(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default WorkspaceHeader;
