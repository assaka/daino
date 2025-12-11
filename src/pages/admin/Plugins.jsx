
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Store } from "@/api/entities";
import { User } from "@/api/entities";
import apiClient from "@/api/client";
import { formatPrice } from "@/utils/priceUtils";
import {
  Puzzle,
  Plus,
  Search,
  Download,
  Upload,
  Star,
  Settings,
  Eye,
  ShoppingCart,
  BarChart3,
  Truck,
  CreditCard,
  Mail,
  Filter,
  Sparkles,
  Edit3,
  Package,
  Loader2,
  Lock,
  Globe,
  Trash2,
  AlertTriangle,
  Pause,
  Play,
  HelpCircle,
  BookOpen,
  Code,
  Zap,
  Clock,
  FileCode,
  Folder,
  CheckCircle2,
  Database,
  Webhook,
  LayoutDashboard,
  Terminal,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";

import PluginForm from "@/components/admin/plugins/PluginForm";
import UninstallDialog from "@/components/admin/plugins/UninstallDialog";
import PluginSettingsDialog from "@/components/admin/plugins/PluginSettingsDialog";
import FlashMessage from "@/components/storefront/FlashMessage";
import { PageLoader } from "@/components/ui/page-loader";

export default function Plugins() {
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState([]);
  const [marketplacePlugins, setMarketplacePlugins] = useState([]);
  const [stores, setStores] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showPluginForm, setShowPluginForm] = useState(false);
  const [showGitHubInstall, setShowGitHubInstall] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showUninstallDialog, setShowUninstallDialog] = useState(false);
  const [pluginToUninstall, setPluginToUninstall] = useState(null);
  const [uninstalling, setUninstalling] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [pluginToConfig, setPluginToConfig] = useState(null);
  const [showDeprecateDialog, setShowDeprecateDialog] = useState(false);
  const [pluginToDeprecate, setPluginToDeprecate] = useState(null);
  const [deprecationReason, setDeprecationReason] = useState("");
  const [deprecating, setDeprecating] = useState(false);
  const [showPublishWarning, setShowPublishWarning] = useState(false);
  const [pluginToPublish, setPluginToPublish] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pluginToDelete, setPluginToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [showHowToDialog, setShowHowToDialog] = useState(false);
  const [showCreatePluginDialog, setShowCreatePluginDialog] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // CodeBlock component with copy functionality
  const CodeBlock = ({ code, language = 'javascript', title }) => {
    const copyToClipboard = async () => {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
      <div className="relative group">
        {title && <div className="text-xs text-gray-400 mb-1">{title}</div>}
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-100 overflow-x-auto">
          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 p-1.5 rounded bg-gray-700 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy code"
          >
            {copiedCode === code ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-300" />
            )}
          </button>
          <pre className="whitespace-pre-wrap">{code}</pre>
        </div>
      </div>
    );
  };
  const [newPluginData, setNewPluginData] = useState({
    name: '',
    description: '',
    category: 'integration'
  });
  const [creatingPlugin, setCreatingPlugin] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load stores and user first to get storeId
      const [storesData, userData] = await Promise.all([
        Store.list(),
        User.me()
      ]);

      // Use selected store from localStorage, fallback to first store
      const selectedStoreId = localStorage.getItem('selectedStoreId');
      const currentStoreId = selectedStoreId && storesData.find(s => s.id === selectedStoreId)
        ? selectedStoreId
        : storesData[0]?.id;

      // Load modern plugin system with store-specific status
      const [pluginsResponse, marketplaceResponse] = await Promise.all([
        currentStoreId
          ? apiClient.request('GET', `stores/${currentStoreId}/plugins`).catch(e => {
              console.error('❌ Store Plugin API error:', e);
              return { data: { plugins: [] } };
            })
          : apiClient.request('GET', 'plugins').catch(e => {
              console.error('❌ Plugin API error:', e);
              return { plugins: [] };
            }),
        apiClient.request('GET', 'plugins/marketplace').catch(e => {
          console.error('❌ Marketplace API error:', e);
          return { plugins: [] };
        })
      ]);

      // Unwrap the response objects
      const plugins = pluginsResponse?.data?.plugins || pluginsResponse?.plugins || pluginsResponse || [];
      const marketplacePlugins = marketplaceResponse?.plugins || marketplaceResponse || [];

      // Filter out ALL starter templates (they're ONLY for cloning, never for editing)
      // Starter templates only appear in Create Plugin flow, not in dashboard
      const editablePlugins = (plugins || []).filter(plugin => {
        if (plugin.is_starter_template) {
          return false;
        }
        return true;
      });

      // Transform all editable plugins for display
      const allPlugins = (editablePlugins || []).map(plugin => ({
        id: plugin.id, // Use actual UUID from database, not slug
        name: plugin.name,
        slug: plugin.slug || plugin.name.toLowerCase().replace(/\s+/g, '-'),
        description: plugin.manifest?.description || plugin.description || 'No description available',
        long_description: plugin.manifest?.description || plugin.description || 'No description available',
        version: plugin.manifest?.version || plugin.version || '1.0.0',
        price: 0,
        category: plugin.manifest?.category || plugin.category || 'integration',
        icon_url: plugin.source === 'marketplace'
          ? "https://via.placeholder.com/64x64/10B981/FFFFFF?text=" + plugin.name.charAt(0)
          : "https://via.placeholder.com/64x64/4285F4/FFFFFF?text=" + plugin.name.charAt(0),
        creator_id: plugin.creator_id || (plugin.source === 'marketplace' ? "marketplace" : null),
        creator_name: plugin.manifest?.author || plugin.author || "System",
        status: "approved",
        installs: plugin.downloads || 0,
        rating: plugin.rating || 0,
        reviews_count: plugin.reviews_count || 0,
        isActive: Boolean(plugin.is_active || plugin.isActive),
        isEnabled: Boolean(plugin.enabledForStore || plugin.is_enabled || plugin.isEnabled),
        isInstalled: Boolean(plugin.is_installed || plugin.isInstalled),
        isPublic: Boolean(plugin.is_public),
        isDeprecated: Boolean(plugin.deprecated_at),
        deprecationReason: plugin.deprecation_reason,
        availableMethods: plugin.manifest?.methods || plugin.methods || [],
        source: plugin.source || 'local',
        sourceType: plugin.manifest?.sourceType || plugin.sourceType || 'local',
        sourceUrl: plugin.sourceUrl
      }));

      setPlugins(allPlugins);
      setMarketplacePlugins(marketplacePlugins || []);
      setStores(storesData);
      setUser(userData);

    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallPlugin = async (plugin) => {
    try {
      await apiClient.request('POST', `plugins/${plugin.slug}/install`);
      await loadData();
      setFlashMessage({ type: 'success', message: `Plugin "${plugin.name}" installed successfully!` });
    } catch (error) {
      console.error("Error installing plugin:", error);
      setFlashMessage({ type: 'error', message: "Error installing plugin: " + error.message });
    }
  };

  const handleUninstallPlugin = (plugin) => {
    setPluginToUninstall(plugin);
    setShowUninstallDialog(true);
  };

  const handleDownloadPlugin = async (plugin) => {
    try {
      // Call export endpoint
      const response = await apiClient.get(`plugins/${plugin.id}/export`);

      // Create download
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plugin.slug || plugin.name.toLowerCase().replace(/\s+/g, '-')}-plugin-package.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading plugin:', error);
      setFlashMessage({ type: 'error', message: 'Error downloading plugin: ' + error.message });
    }
  };

  const handleImportPlugin = async (file) => {
    if (!file) return;

    setImporting(true);
    try {
      // Read file content
      const fileContent = await file.text();
      const packageData = JSON.parse(fileContent);

      // Add userId to request
      packageData.userId = user?.id;

      // Call import endpoint
      const result = await apiClient.post('plugins/import', packageData);

      setFlashMessage({ type: 'success', message: `Plugin imported successfully: ${result.plugin.name}` });
      setShowImportDialog(false);
      await loadData();
    } catch (error) {
      console.error('Error importing plugin:', error);
      setFlashMessage({ type: 'error', message: 'Error importing plugin: ' + error.message });
    } finally {
      setImporting(false);
    }
  };

  const handleConfigurePlugin = (plugin) => {
    setPluginToConfig(plugin);
    setShowSettingsDialog(true);
  };

  const handleSavePluginSettings = async () => {
    // Reload plugins to reflect the changes
    await loadData();
  };

  const handleToggleVisibility = async (plugin) => {
    // If making public, show warning first
    if (!plugin.isPublic) {
      setPluginToPublish(plugin);
      setShowPublishWarning(true);
      return;
    }

    // If already public, cannot make private
    setFlashMessage({ type: 'warning', message: "Public plugins cannot be made private again as other users may have installed them." });
  };

  const confirmPublish = async () => {
    if (!pluginToPublish) return;

    setPublishing(true);
    try {
      await apiClient.request('PATCH', `plugins/${pluginToPublish.id}/visibility`, {
        is_public: true
      });
      setShowPublishWarning(false);
      setPluginToPublish(null);
      await loadData();
      setFlashMessage({ type: 'success', message: 'Plugin published to marketplace successfully!' });
    } catch (error) {
      console.error("Error publishing plugin:", error);
      setFlashMessage({ type: 'error', message: "Error publishing plugin: " + error.message });
    } finally {
      setPublishing(false);
    }
  };

  const handleDeprecatePlugin = (plugin) => {
    setPluginToDeprecate(plugin);
    setDeprecationReason("");
    setShowDeprecateDialog(true);
  };

  const confirmDeprecate = async () => {
    if (!pluginToDeprecate) return;

    setDeprecating(true);
    try {
      await apiClient.request('POST', `plugins/${pluginToDeprecate.id}/deprecate`, {
        reason: deprecationReason
      });

      setFlashMessage({ type: 'success', message: `Plugin "${pluginToDeprecate.name}" has been deprecated. Existing users can still use it.` });
      setShowDeprecateDialog(false);
      setPluginToDeprecate(null);
      setDeprecationReason("");
      await loadData();
    } catch (error) {
      console.error("Error deprecating plugin:", error);
      setFlashMessage({ type: 'error', message: "Error deprecating plugin: " + error.message });
    } finally {
      setDeprecating(false);
    }
  };

  const handleDeletePlugin = (plugin) => {
    setPluginToDelete(plugin);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!pluginToDelete) return;

    setDeleting(true);
    try {
      await apiClient.request('DELETE', `plugins/${pluginToDelete.id}`);
      const pluginName = pluginToDelete.name;
      setShowDeleteDialog(false);
      setPluginToDelete(null);
      await loadData();
      setFlashMessage({
        type: 'success',
        message: `Plugin "${pluginName}" has been permanently deleted!`
      });
    } catch (error) {
      console.error("Error deleting plugin:", error);
      setFlashMessage({
        type: 'error',
        message: `Error deleting plugin: ${error.message}`
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePluginForStore = async (plugin, storeId) => {
    try {
      const isCurrentlyEnabled = plugin.isEnabled; // Check if enabled for current store
      const endpoint = isCurrentlyEnabled ? 'disable' : 'enable';

      await apiClient.request('POST', `stores/${storeId}/plugins/${plugin.id}/${endpoint}`);
      await loadData();
    } catch (error) {
      console.error("Error toggling plugin for store:", error);
      setFlashMessage({ type: 'error', message: "Error updating plugin status: " + error.message });
    }
  };

  const confirmUninstall = async (pluginSlug, options) => {
    setUninstalling(true);
    try {
      const result = await apiClient.request('POST', `plugins/${pluginSlug}/uninstall`, options);

      // Show success message with cleanup summary
      setFlashMessage({ type: 'success', message: `Plugin uninstalled successfully! Backup created: ${result.data.backupPath ? 'Yes' : 'No'}` });

      setShowUninstallDialog(false);
      setPluginToUninstall(null);
      await loadData();
    } catch (error) {
      console.error("Error uninstalling plugin:", error);
      setFlashMessage({ type: 'error', message: "Error uninstalling plugin: " + error.message });
    } finally {
      setUninstalling(false);
    }
  };

  const handleInstallFromGitHub = async () => {
    if (!githubUrl.trim()) {
      setFlashMessage({ type: 'error', message: "Please enter a GitHub URL" });
      return;
    }

    setInstalling(true);
    try {
      const result = await apiClient.request('POST', 'plugins/install-github', {
        githubUrl: githubUrl.trim()
      });

      setFlashMessage({ type: 'success', message: `Plugin installed successfully: ${result.message}` });

      setShowGitHubInstall(false);
      setGithubUrl("");
      await loadData();
    } catch (error) {
      console.error("Error installing from GitHub:", error);
      setFlashMessage({ type: 'error', message: "Error installing plugin: " + error.message });
    } finally {
      setInstalling(false);
    }
  };

  const handleCreatePlugin = async (pluginData) => {
    try {
      // TODO: Implement modern plugin creation API
      setFlashMessage({ type: 'warning', message: "Plugin creation will be available in the next version" });
      setShowPluginForm(false);
    } catch (error) {
      console.error("Error creating plugin:", error);
      setFlashMessage({ type: 'error', message: "Error creating plugin: " + error.message });
    }
  };

  const handleCreateWithAI = async () => {
    if (!newPluginData.name.trim()) {
      setFlashMessage({ type: 'error', message: 'Please enter a plugin name' });
      return;
    }

    // Generate slug from name
    const slug = newPluginData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Close dialog
    setShowCreatePluginDialog(false);

    // Navigate to AI workspace with the new plugin metadata
    // The AI workspace will handle creating the plugin
    navigate('/ai-workspace', {
      state: {
        newPlugin: {
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
        },
        isNewPlugin: true
      }
    });

    // Reset form
    setNewPluginData({ name: '', description: '', category: 'integration' });
  };

  // Different filtering for different contexts
  const getFilteredPlugins = (tabFilter = 'marketplace') => {
    return plugins.filter(plugin => {
      const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || plugin.category === categoryFilter;

      // Different filters per tab
      let matchesStatus = true;
      if (tabFilter === 'marketplace') {
        // Show public third-party plugins (not owned by user, not deprecated)
        matchesStatus = plugin.isPublic === true && !plugin.isDeprecated && plugin.creator_id !== user?.id;
      } else if (tabFilter === 'installed') {
        // Show third-party installed plugins (configured for my store but not created by me)
        matchesStatus = plugin.configuredForStore === true && plugin.creator_id !== user?.id;
      } else if (tabFilter === 'my-plugins') {
        // Show plugins created by current user
        matchesStatus = plugin.creator_id === user?.id;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  };

  const filteredPlugins = getFilteredPlugins('my-plugins');

  const isPluginInstalled = (plugin) => {
    return plugin.isInstalled;
  };

  const isPluginEnabled = (plugin) => {
    return plugin.isEnabled;
  };

  const categoryIcons = {
    analytics: BarChart3,
    shipping: Truck,
    payment: CreditCard,
    marketing: Mail,
    integration: Puzzle,
    other: Settings
  };

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "analytics", label: "Analytics" },
    { value: "shipping", label: "Shipping" },
    { value: "payment", label: "Payment" },
    { value: "marketing", label: "Marketing" },
    { value: "integration", label: "Integration" },
    { value: "other", label: "Other" }
  ];

  if (loading) {
    return <PageLoader size="lg" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Plugins</h1>
            <p className="text-gray-600 mt-1">Create and manage plugins for your store</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowCreatePluginDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create with AI
            </Button>
            <Button
              onClick={() => setShowImportDialog(true)}
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Plugin
            </Button>
            <Button
              onClick={() => setShowGitHubInstall(true)}
              variant="outline"
              disabled
              className="opacity-50 cursor-not-allowed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Install from GitHub
            </Button>
          </div>
        </div>
        <div className="flex justify-end mb-8">
          <Button
              onClick={() => setShowHowToDialog(true)}
              variant="default"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            How-To
          </Button>
        </div>
        <Tabs defaultValue="my-plugins" className="space-y-6">
          {/*
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="marketplace" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="installed" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Installed ({getFilteredPlugins('installed').length})
            </TabsTrigger>
            <TabsTrigger value="my-plugins" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              My Plugins ({getFilteredPlugins('my-plugins').length})
            </TabsTrigger>
          </TabsList>
          */}

          {/* Marketplace Tab */}
          <TabsContent value="marketplace">
            {/* Search and Filters */}
            <Card className="material-elevation-1 border-0 mb-6">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      placeholder="Search marketplace..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plugins Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredPlugins('marketplace').map((plugin) => {
                const CategoryIcon = categoryIcons[plugin.category] || Settings;
                const installed = isPluginInstalled(plugin);
                const enabled = isPluginEnabled(plugin);
                
                return (
                  <Card key={plugin.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300 flex flex-col h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 ${
                            plugin.source === 'marketplace'
                              ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                              : plugin.sourceType === 'github'
                              ? 'bg-gradient-to-r from-gray-700 to-gray-900'
                              : 'bg-gradient-to-r from-blue-500 to-purple-600'
                          } rounded-lg flex items-center justify-center`}>
                            <CategoryIcon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{plugin.name}</CardTitle>
                              {plugin.source === 'marketplace' && (
                                <Badge className="bg-green-100 text-green-700 text-xs">
                                  Marketplace
                                </Badge>
                              )}
                              {plugin.sourceType === 'github' && (
                                <Badge className="bg-gray-100 text-gray-700 text-xs">
                                  GitHub
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">by {plugin.creator_name}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className="bg-blue-100 text-blue-700">
                            v{plugin.version}
                          </Badge>
                          {enabled && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow">
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {plugin.description}
                      </p>

                      {plugin.availableMethods && plugin.availableMethods.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-2">Available Methods:</p>
                          <div className="flex flex-wrap gap-1">
                            {plugin.availableMethods.map(method => (
                              <Badge key={method} className="bg-gray-100 text-gray-600 text-xs">
                                {method}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          {plugin.rating > 0 && (
                            <div className="flex items-center">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="text-sm text-gray-600 ml-1">
                                {plugin.rating.toFixed(1)} ({plugin.reviews_count})
                              </span>
                            </div>
                          )}
                          <span className="text-sm text-gray-600">
                            {plugin.installs} installs
                          </span>
                        </div>
                        <Badge className={`${plugin.category === 'analytics' ? 'bg-green-100 text-green-700' :
                                          plugin.category === 'shipping' ? 'bg-blue-100 text-blue-700' :
                                          plugin.category === 'payment' ? 'bg-purple-100 text-purple-700' :
                                          'bg-gray-100 text-gray-700'}`}>
                          {plugin.category}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mt-auto">
                        <div className="text-lg font-bold text-gray-900">
                          {plugin.price === 0 ? 'Free' : formatPrice(plugin.price)}
                        </div>
                        <div className="flex items-center gap-2">
                          {installed ? (
                            <div className="flex gap-1">
                              <Badge className={enabled ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                                {enabled ? "Installed & Active" : "Installed"}
                              </Badge>
                            </div>
                          ) : (
                            <Button
                              onClick={() => handleInstallPlugin(plugin)}
                              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                              size="sm"
                            >
                              Install
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredPlugins.length === 0 && (
              <Card className="material-elevation-1 border-0">
                <CardContent className="text-center py-12">
                  <Puzzle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins found</h3>
                  <p className="text-gray-600 mb-6">
                    {searchQuery || categoryFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : "No plugins available in the marketplace yet"}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Installed Tab */}
          <TabsContent value="installed">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredPlugins('installed').map((plugin) => {
                const CategoryIcon = categoryIcons[plugin.category] || Settings;
                
                return (
                  <Card key={plugin.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300 flex flex-col h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <CategoryIcon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{plugin.name}</CardTitle>
                            <p className="text-sm text-gray-500">by {plugin.creator_name}</p>
                          </div>
                        </div>
                        <Badge className={plugin.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                          {plugin.isEnabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow">
                      <p className="text-gray-600 text-sm mb-4 flex-grow">
                        {plugin.description}
                      </p>

                      <div className="flex justify-between items-center mt-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigurePlugin(plugin)}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Configure
                        </Button>
                        <Button
                          onClick={() => handleUninstallPlugin(plugin)}
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          Uninstall
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {getFilteredPlugins('installed').length === 0 && (
              <Card className="material-elevation-1 border-0">
                <CardContent className="text-center py-12">
                  <Download className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins installed</h3>
                  <p className="text-gray-600 mb-6">
                    Browse the marketplace to find and install plugins for your store
                  </p>
                  <Button
                    onClick={() => document.querySelector('[value="marketplace"]').click()}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 material-ripple"
                  >
                    Browse Marketplace
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Plugins Tab */}
          <TabsContent value="my-plugins">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredPlugins('my-plugins').map((plugin) => {
                const CategoryIcon = categoryIcons[plugin.category] || Settings;
                const isOwner = plugin.creator_id === user?.id;

                return (
                  <Card key={plugin.id} className="material-elevation-1 border-0 hover:material-elevation-2 transition-all duration-300 flex flex-col h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <CategoryIcon className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{plugin.name}</CardTitle>
                            <div className="flex items-center flex-wrap gap-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                v{plugin.version}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {plugin.category}
                              </Badge>
                              {plugin.isPublic ? (
                                <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  Public
                                </Badge>
                              ) : (
                                <Badge
                                  className="bg-gray-100 text-gray-700 text-xs flex items-center gap-1 cursor-pointer hover:bg-gray-200 transition-colors"
                                  onClick={() => handleToggleVisibility(plugin)}
                                  title="Click to publish to marketplace"
                                >
                                  <Lock className="w-3 h-3" />
                                  Private
                                </Badge>
                              )}
                              {plugin.isDeprecated && (
                                <Badge className="bg-orange-100 text-orange-700 text-xs flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Deprecated
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col flex-grow">
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">
                        {plugin.description}
                      </p>

                      {plugin.isDeprecated && plugin.deprecationReason && (
                        <div className="mb-4 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                          <strong>Deprecation reason:</strong> {plugin.deprecationReason}
                        </div>
                      )}

                      <div className="flex justify-between items-center gap-2 mt-auto">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/ai-workspace', { state: { plugin } })}
                          >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPlugin(plugin)}
                            title="Download plugin package"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex gap-1 items-center">
                          {/* Pause/Play for store activation */}
                          {plugin.isEnabled !== undefined && stores.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTogglePluginForStore(plugin, stores[0]?.id)}
                              className="h-8 w-8 p-0"
                              title={plugin.isEnabled ? "Pause for this store" : "Run for this store"}
                            >
                              {plugin.isEnabled ? (
                                <Pause className="w-4 h-4 text-orange-600" />
                              ) : (
                                <Play className="w-4 h-4 text-green-600" />
                              )}
                            </Button>
                          )}

                          {/* Delete/Deprecate icons for owner */}
                          {isOwner && !plugin.isDeprecated && (
                            <>
                              {plugin.isPublic ? (
                                <Button
                                  onClick={() => handleDeprecatePlugin(plugin)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  title="Deprecate plugin"
                                >
                                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => handleDeletePlugin(plugin)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  title="Delete plugin"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              )}
                            </>
                          )}

                          {/* Uninstall for non-owner */}
                          {!isOwner && plugin.isInstalled && (
                            <Button
                              onClick={() => handleUninstallPlugin(plugin)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Uninstall plugin"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {getFilteredPlugins('my-plugins').length === 0 && (
              <Card className="material-elevation-1 border-0">
                <CardContent className="text-center py-12">
                  <Sparkles className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No plugins created yet</h3>
                  <p className="text-gray-600 mb-6">
                    Use AI to create your first plugin in minutes
                  </p>
                  <Button
                    onClick={() => setShowCreatePluginDialog(true)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Plugin with AI
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card className="material-elevation-1 border-0">
              <CardContent className="text-center py-16">
                <BarChart3 className="w-24 h-24 text-gray-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Plugin Analytics & Reports</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Get detailed insights into your plugin performance, usage statistics, and optimization recommendations.
                </p>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600 mb-1">📊</div>
                      <div className="text-sm font-medium text-gray-700">Usage Analytics</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600 mb-1">⚡</div>
                      <div className="text-sm font-medium text-gray-700">Performance Metrics</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600 mb-1">🎯</div>
                      <div className="text-sm font-medium text-gray-700">Optimization Tips</div>
                    </div>
                  </div>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800 px-4 py-2 text-sm font-medium">
                  🚀 Coming Soon
                </Badge>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Import Plugin Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Import Plugin Package</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Plugin Package File (.json)
                </label>
                <Input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImportPlugin(file);
                    }
                  }}
                  disabled={importing}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Upload a plugin package JSON file exported from another installation
                </p>
              </div>
              {importing && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing plugin...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* GitHub Installation Dialog */}
        <Dialog open={showGitHubInstall} onOpenChange={setShowGitHubInstall}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Install Plugin from GitHub</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  GitHub Repository URL
                </label>
                <Input
                  placeholder="https://github.com/user/plugin-name"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  disabled={installing}
                />
                <p className="text-xs text-gray-500 mt-1">
                  The repository must contain a plugin.json manifest file
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowGitHubInstall(false)}
                  disabled={installing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInstallFromGitHub}
                  disabled={installing || !githubUrl.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {installing ? "Installing..." : "Install"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Plugin Form Dialog */}
        <Dialog open={showPluginForm} onOpenChange={setShowPluginForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Plugin</DialogTitle>
            </DialogHeader>
            <PluginForm
              onSubmit={handleCreatePlugin}
              onCancel={() => setShowPluginForm(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Enhanced Uninstall Dialog */}
        <UninstallDialog
          isOpen={showUninstallDialog}
          onClose={() => {
            setShowUninstallDialog(false);
            setPluginToUninstall(null);
          }}
          plugin={pluginToUninstall}
          onConfirm={confirmUninstall}
          isUninstalling={uninstalling}
        />

        {/* Plugin Settings Dialog */}
        <PluginSettingsDialog
          plugin={pluginToConfig}
          open={showSettingsDialog}
          onOpenChange={(open) => {
            setShowSettingsDialog(open);
            if (!open) {
              setPluginToConfig(null);
            }
          }}
          onSave={handleSavePluginSettings}
        />

        {/* Deprecate Plugin Dialog */}
        <Dialog open={showDeprecateDialog} onOpenChange={setShowDeprecateDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Deprecate Plugin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  Deprecating a plugin will mark it as deprecated, but existing users can still use it.
                  This is the recommended approach for public plugins to maintain compatibility.
                </p>
              </div>

              {pluginToDeprecate && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Plugin: <strong>{pluginToDeprecate.name}</strong>
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Deprecation Reason (Optional)
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-2 text-sm"
                  rows="3"
                  placeholder="e.g., Replaced by a newer version, security issues, etc."
                  value={deprecationReason}
                  onChange={(e) => setDeprecationReason(e.target.value)}
                  disabled={deprecating}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeprecateDialog(false);
                    setPluginToDeprecate(null);
                    setDeprecationReason("");
                  }}
                  disabled={deprecating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeprecate}
                  disabled={deprecating}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {deprecating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deprecating...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Deprecate Plugin
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Publish Warning Dialog */}
        <Dialog open={showPublishWarning} onOpenChange={setShowPublishWarning}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Publish Plugin to Marketplace?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  ⚠️ Warning: This action cannot be undone!
                </p>
                <p className="text-sm text-yellow-800">
                  Once you publish a plugin to the marketplace, it <strong>cannot be made private again</strong>.
                  Other users may install and depend on it. You can only deprecate it in the future.
                </p>
              </div>

              {pluginToPublish && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Plugin: <strong>{pluginToPublish.name}</strong>
                  </p>
                  <p className="text-sm text-gray-600">
                    Version: {pluginToPublish.version}
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  After publishing, your plugin will be available to all users in the marketplace.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPublishWarning(false);
                    setPluginToPublish(null);
                  }}
                  disabled={publishing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmPublish}
                  disabled={publishing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4 mr-2" />
                      Publish to Marketplace
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Plugin Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Plugin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium mb-2">
                  ⚠️ Warning: This action cannot be undone!
                </p>
                <p className="text-sm text-red-800">
                  Permanently deleting this plugin will remove all associated data from the database, including:
                </p>
                <ul className="text-sm text-red-800 list-disc list-inside mt-2 space-y-1">
                  <li>Plugin scripts and dependencies</li>
                  <li>Documentation and migrations</li>
                  <li>Controllers and entities</li>
                  <li>All plugin configurations</li>
                </ul>
              </div>

              {pluginToDelete && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Plugin: <strong>{pluginToDelete.name}</strong>
                  </p>
                  <p className="text-sm text-gray-600">
                    Version: {pluginToDelete.version}
                  </p>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  This will permanently delete the plugin and all its data. Are you absolutely sure?
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setPluginToDelete(null);
                  }}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Permanently
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
              <p className="text-sm text-gray-600">
                Give your plugin a name and description. AI will help you build it in the next step.
              </p>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
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
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-2 text-sm min-h-[80px]"
                  placeholder="Describe what your plugin will do..."
                  value={newPluginData.description}
                  onChange={(e) => setNewPluginData({ ...newPluginData, description: e.target.value })}
                  disabled={creatingPlugin}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
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

        {/* How-To Documentation Dialog */}
        <Dialog open={showHowToDialog} onOpenChange={setShowHowToDialog}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Plugin Development Guide
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 text-sm">
              {/* What is a Plugin */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-purple-600" />
                  What is a Plugin?
                </h3>
                <p className="text-gray-600">
                  A plugin is a small package that adds new functionality to your store. For example: display custom messages, add admin pages, create scheduled tasks, or add API endpoints.
                </p>
              </div>

              {/* Plugin Structure */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-600" />
                  Plugin Structure
                </h3>
                <p className="text-gray-600 mb-2">A plugin can have these files:</p>
                <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs">
                  <div className="text-gray-500">my-plugin/</div>
                  <div className="ml-4">├── <span className="text-blue-600">manifest.json</span> <span className="text-gray-400">← Required: Plugin metadata & configuration</span></div>
                  <div className="ml-4">├── <span className="text-green-600">index.js</span> <span className="text-gray-400">← Required: Main plugin class with hook handlers</span></div>
                  <div className="ml-4">├── <span className="text-purple-600">components/</span> <span className="text-gray-400">← UI components (React/HTML)</span></div>
                  <div className="ml-4">├── <span className="text-yellow-600">services/</span> <span className="text-gray-400">← Business logic classes</span></div>
                  <div className="ml-4">├── <span className="text-cyan-600">controllers/</span> <span className="text-gray-400">← API route handlers</span></div>
                  <div className="ml-4">├── <span className="text-indigo-600">utils/</span> <span className="text-gray-400">← Helper functions</span></div>
                  <div className="ml-4">├── <span className="text-orange-600">migrations/</span> <span className="text-gray-400">← Database schema changes</span></div>
                  <div className="ml-4">├── <span className="text-pink-600">events/</span> <span className="text-gray-400">← Event listeners</span></div>
                  <div className="ml-4">└── <span className="text-rose-600">styles.css</span> <span className="text-gray-400">← Custom CSS styles</span></div>
                </div>
              </div>

              {/* File Types Explained */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">File Types Explained</h4>
                <div className="space-y-2 text-xs">
                  <div><span className="font-medium text-blue-600">manifest.json</span> - Defines your plugin's name, version, hooks, routes, cron jobs, and configuration schema. This is the "contract" of what your plugin does.</div>
                  <div><span className="font-medium text-green-600">index.js</span> - The main entry point. Exports a class with handler methods that are called by hooks defined in manifest.</div>
                  <div><span className="font-medium text-purple-600">components/</span> - Reusable UI pieces. Return HTML strings or React components. Called from hooks to render UI.</div>
                  <div><span className="font-medium text-yellow-600">services/</span> - Business logic classes (e.g., EmailService, UserService). Handles data operations, API calls, calculations.</div>
                  <div><span className="font-medium text-cyan-600">controllers/</span> - Handle HTTP requests for your plugin's API routes. Process req/res and return JSON.</div>
                  <div><span className="font-medium text-indigo-600">utils/</span> - Pure helper functions (formatDate, escapeHTML, validateEmail). No side effects, reusable everywhere.</div>
                  <div><span className="font-medium text-orange-600">migrations/</span> - Database schema changes. Run once on plugin install to create tables.</div>
                  <div><span className="font-medium text-pink-600">events/</span> - React to system events (order.completed, user.registered). Fire-and-forget, don't return values.</div>
                </div>
              </div>

              {/* manifest.json */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-orange-600" />
                  manifest.json
                </h3>
                <p className="text-gray-600 mb-2">The manifest defines everything about your plugin - metadata, hooks, routes, and configuration:</p>
                <CodeBlock code={`{
  "name": "My Plugin",
  "slug": "my-plugin",
  "version": "1.0.0",
  "description": "What it does",
  "author": "Your Name",
  "category": "display",
  "hooks": {
    "cart.processLoadedItems": "onCartLoaded",
    "app.ready": "onAppReady"
  },
  "routes": [
    { "path": "/api/plugins/my-plugin/data", "method": "GET", "handler": "getData" },
    { "path": "/api/plugins/my-plugin/save", "method": "POST", "handler": "saveData" }
  ],
  "cron": [
    { "name": "Daily Task", "schedule": "0 9 * * *", "handler": "runDaily" }
  ],
  "adminNavigation": {
    "enabled": true,
    "label": "My Plugin",
    "icon": "Settings",
    "route": "/admin/my-plugin"
  },
  "configSchema": {
    "properties": {
      "message": { "type": "string", "default": "Hello!" },
      "enabled": { "type": "boolean", "default": true }
    }
  }
}`} />
              </div>

              {/* HOOKS EXAMPLE */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Code className="w-4 h-4 text-blue-600" />
                  Hooks
                </h3>
                <p className="text-gray-600 mb-2">Hooks are <strong>filter functions</strong> that intercept and modify data. They receive data, can transform it, and <strong>must return a value</strong>.</p>

                <div className="space-y-3">
                  <CodeBlock title="cart.processLoadedItems - Modify cart items or show modals" code={`function(items, context) {
  // Show a coupon modal when cart is empty
  if (items.length === 0) {
    const modal = document.createElement('div');
    modal.innerHTML = \`
      <div class="coupon-modal">
        <h2>Your Cart is Empty!</h2>
        <p>Use code WELCOME20 for 20% off!</p>
        <button onclick="this.parentElement.remove()">Shop Now</button>
      </div>
    \`;
    document.body.appendChild(modal);
  }

  // IMPORTANT: Hooks must return a value
  return items;
}`} />

                  <CodeBlock title="app.ready - Initialize plugin when app loads" code={`function(context) {
  try {
    const TestComponent = require('./components/TestComponent');
    const TestService = require('./services/TestService');

    const testService = new TestService();
    const message = testService.getTestMessage();

    // Render component to page
    const html = TestComponent({ message });
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
  } catch (error) {
    console.error('Error in plugin:', error);
  }

  return context;
}`} />

                  <CodeBlock title="page.render - Inject content into pages" code={`async function(context) {
  const { page, user } = context;

  // Don't inject on admin pages
  if (page.path.startsWith('/admin')) {
    return context;
  }

  // Inject chat widget
  if (!context.bodyScripts) {
    context.bodyScripts = [];
  }
  context.bodyScripts.push('<div id="chat-widget"></div>');

  return context;
}`} />
                </div>

                <div className="mt-3 bg-blue-50 rounded p-3">
                  <p className="text-xs font-medium text-blue-800 mb-2">Available Hooks:</p>
                  <div className="flex flex-wrap gap-1">
                    {['app.ready', 'app.init', 'cart.processLoadedItems', 'checkout.processLoadedItems', 'page.render', 'page.onRender', 'product.processInventory', 'order.processShipment', 'frontend.render'].map(hook => (
                      <code key={hook} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{hook}</code>
                    ))}
                  </div>
                </div>
              </div>

              {/* CRON EXAMPLE */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  Cron Jobs
                </h3>
                <p className="text-gray-600 mb-2">Schedule tasks to run automatically. Define in manifest, implement handler in index.js:</p>
                <CodeBlock code={`// manifest.json
{
  "cron": [
    {
      "name": "Daily Report",
      "schedule": "0 9 * * *",
      "handler": "sendDailyReport",
      "description": "Sends report every day at 9 AM"
    },
    {
      "name": "Weekly Cleanup",
      "schedule": "0 0 * * 0",
      "handler": "weeklyCleanup"
    }
  ]
}

// index.js
class MyPlugin {
  async sendDailyReport() {
    const stats = await this.db.query('SELECT COUNT(*) FROM orders WHERE date = TODAY');
    await this.services.email.send({
      to: this.config.adminEmail,
      subject: 'Daily Sales Report',
      body: \`Today's orders: \${stats.count}\`
    });
  }

  async weeklyCleanup() {
    await this.db.query('DELETE FROM sessions WHERE expires_at < NOW()');
    console.log('Old sessions cleaned up');
  }
}`} />
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="bg-purple-50 rounded p-2">
                    <div className="font-mono text-purple-700">* * * * *</div>
                    <div className="text-purple-600">Every minute</div>
                  </div>
                  <div className="bg-purple-50 rounded p-2">
                    <div className="font-mono text-purple-700">0 * * * *</div>
                    <div className="text-purple-600">Every hour</div>
                  </div>
                  <div className="bg-purple-50 rounded p-2">
                    <div className="font-mono text-purple-700">0 9 * * *</div>
                    <div className="text-purple-600">Daily at 9 AM</div>
                  </div>
                  <div className="bg-purple-50 rounded p-2">
                    <div className="font-mono text-purple-700">0 0 * * 0</div>
                    <div className="text-purple-600">Weekly (Sunday)</div>
                  </div>
                </div>
              </div>

              {/* API ROUTES / CONTROLLERS */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-green-600" />
                  API Routes & Controllers
                </h3>
                <p className="text-gray-600 mb-2">Create REST API endpoints. Controllers handle HTTP requests and return JSON responses:</p>
                <CodeBlock title="controllers/ItemController.js" code={`class ItemController {
  constructor(db) {
    this.db = db;
  }

  async getItems(req, res) {
    const { store_id } = req.params;
    const items = await this.db.query(
      'SELECT * FROM plugin_items WHERE store_id = $1',
      [store_id]
    );
    return { success: true, items: items.rows };
  }

  async createItem(req, res) {
    const { name, description } = req.body;
    const result = await this.db.query(
      'INSERT INTO plugin_items (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    return { success: true, item: result.rows[0] };
  }

  async deleteItem(req, res) {
    const { id } = req.params;
    await this.db.query('DELETE FROM plugin_items WHERE id = $1', [id]);
    return { success: true, deleted: id };
  }
}`} />
                <CodeBlock title="manifest.json routes" code={`{
  "routes": [
    { "path": "/api/plugins/my-plugin/items", "method": "GET", "handler": "getItems" },
    { "path": "/api/plugins/my-plugin/items", "method": "POST", "handler": "createItem" },
    { "path": "/api/plugins/my-plugin/items/:id", "method": "DELETE", "handler": "deleteItem" }
  ]
}`} />
              </div>

              {/* MIGRATIONS */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-orange-600" />
                  Migrations
                </h3>
                <p className="text-gray-600 mb-2">Create database tables for your plugin. Migrations run automatically on install and can be rolled back:</p>
                <CodeBlock title="migrations/001_create_my_table.js" code={`module.exports = {
  up: async (knex) => {
    await knex.schema.createTable('my_plugin_items', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('name').notNullable();
      table.text('description');
      table.decimal('price', 10, 2);
      table.boolean('is_active').defaultTo(true);
      table.uuid('store_id').references('id').inTable('stores').onDelete('CASCADE');
      table.jsonb('metadata').defaultTo('{}');
      table.timestamps(true, true);
    });

    // Add indexes for performance
    await knex.schema.alterTable('my_plugin_items', (table) => {
      table.index(['store_id', 'is_active']);
    });
  },

  down: async (knex) => {
    await knex.schema.dropTableIfExists('my_plugin_items');
  }
};`} />
                <p className="text-gray-500 text-xs mt-2">Naming: <code className="bg-gray-100 px-1 rounded">001_description.js</code>, <code className="bg-gray-100 px-1 rounded">002_add_column.js</code> - prefix with number for order.</p>
              </div>

              {/* COMPONENTS */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-purple-600" />
                  Components
                </h3>
                <p className="text-gray-600 mb-2">Reusable UI pieces. Return HTML strings that hooks inject into pages:</p>
                <CodeBlock title="components/NewsletterSignup.js" code={`// components/NewsletterSignup.js
function NewsletterSignup(config) {
  return \`
    <div class="newsletter-signup" style="padding: 20px; background: #f0f9ff; border-radius: 8px;">
      <h3>\${config.title || 'Subscribe to our Newsletter'}</h3>
      <p>\${config.description || 'Get updates on new products and sales!'}</p>
      <form id="newsletter-form">
        <input type="email" placeholder="your@email.com" required />
        <button type="submit">Subscribe</button>
      </form>
    </div>
  \`;
}

module.exports = NewsletterSignup;`} />

                <CodeBlock title="components/UsernameAlert.js" code={`// components/UsernameAlert.js
function UsernameAlert({ username }) {
  return \`
    <div class="welcome-alert" style="
      position: fixed; top: 20px; right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; padding: 16px 24px; border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    ">
      <span style="font-size: 24px;">👋</span>
      <span>Welcome back, <strong>\${username}</strong>!</span>
    </div>
  \`;
}

module.exports = UsernameAlert;`} />
              </div>

              {/* SERVICES */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-600" />
                  Services
                </h3>
                <p className="text-gray-600 mb-2">Business logic classes. Handle data operations, API calls, and complex calculations:</p>
                <CodeBlock title="services/UserService.js" code={`// services/UserService.js
class UserService {
  constructor(context) {
    this.context = context;
    this.db = context.db;
  }

  getCurrentUser() {
    return this.context.user || null;
  }

  async getUserByEmail(email) {
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  async updateUserPreferences(userId, preferences) {
    await this.db.query(
      'UPDATE users SET preferences = $1 WHERE id = $2',
      [JSON.stringify(preferences), userId]
    );
  }
}

module.exports = UserService;`} />

                <CodeBlock title="services/EmailService.js" code={`// services/EmailService.js
class EmailService {
  constructor(config) {
    this.config = config;
  }

  async getCustomerEmail(context) {
    return context.user?.email || context.session?.email || null;
  }

  async send({ to, subject, body }) {
    // Integration with email provider
    console.log(\`Sending email to \${to}: \${subject}\`);
    // await this.provider.send({ to, subject, body });
  }
}

module.exports = EmailService;`} />
              </div>

              {/* UTILS */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Code className="w-4 h-4 text-indigo-600" />
                  Utils
                </h3>
                <p className="text-gray-600 mb-2">Pure helper functions. No side effects, can be used anywhere:</p>
                <CodeBlock title="utils/helpers.js" code={`// utils/helpers.js
const helpers = {
  formatPrice(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency
    }).format(amount);
  },

  escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  generateId() {
    return crypto.randomUUID();
  },

};

module.exports = helpers;`} />
              </div>

              {/* EVENTS / LIFECYCLE */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Webhook className="w-4 h-4 text-pink-600" />
                  Lifecycle Events
                </h3>
                <p className="text-gray-600 mb-2">React to plugin lifecycle changes. These methods are called automatically:</p>
                <CodeBlock code={`// index.js
class MyPlugin {
  // Called when plugin is installed
  async install() {
    console.log('Plugin installed - run setup tasks');
  }

  // Called when plugin is enabled
  onEnable() {
    console.log('Plugin enabled!');
  }

  // Called when plugin is disabled
  onDisable() {
    console.log('Plugin disabled - cleanup');
  }

  // Called when config changes in admin
  onConfigUpdate(newConfig, oldConfig) {
    if (newConfig.apiKey !== oldConfig.apiKey) {
      this.reconnectAPI(newConfig.apiKey);
    }
  }

  // Called when plugin is uninstalled
  async uninstall() {
    console.log('Plugin uninstalled - remove data');
  }
}
module.exports = MyPlugin;`} />
              </div>

              {/* ADMIN NAVIGATION */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-cyan-600" />
                  Admin Navigation
                </h3>
                <p className="text-gray-600 mb-2">Add a page to the admin menu:</p>
                <CodeBlock title="manifest.json" code={`{
  "adminNavigation": {
    "enabled": true,
    "label": "My Plugin Settings",
    "icon": "Settings",
    "route": "/admin/my-plugin",
    "order": 100,
    "description": "Configure my plugin"
  }
}`} />
                <p className="text-gray-500 text-xs mt-2">Available icons: Settings, BarChart3, Mail, CreditCard, Truck, Puzzle, Code2, and more from Lucide.</p>
              </div>

              {/* CONFIG SCHEMA */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-600" />
                  Configuration Schema
                </h3>
                <p className="text-gray-600 mb-2">Define settings for store owners to configure:</p>
                <CodeBlock title="manifest.json" code={`{
  "configSchema": {
    "properties": {
      "welcomeMessage": {
        "type": "string",
        "default": "Welcome!",
        "description": "Message to display"
      },
      "showBanner": {
        "type": "boolean",
        "default": true,
        "description": "Show the banner"
      },
      "position": {
        "type": "string",
        "enum": ["left", "center", "right"],
        "default": "center",
        "description": "Text alignment"
      },
      "maxItems": {
        "type": "number",
        "default": 10,
        "description": "Maximum items to show"
      }
    }
  }
}`} />
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <div className="bg-blue-50 rounded p-2">
                    <div className="font-medium text-blue-700">string</div>
                    <div className="text-blue-600">Text input</div>
                  </div>
                  <div className="bg-green-50 rounded p-2">
                    <div className="font-medium text-green-700">boolean</div>
                    <div className="text-green-600">Toggle</div>
                  </div>
                  <div className="bg-purple-50 rounded p-2">
                    <div className="font-medium text-purple-700">number</div>
                    <div className="text-purple-600">Number</div>
                  </div>
                  <div className="bg-orange-50 rounded p-2">
                    <div className="font-medium text-orange-700">enum</div>
                    <div className="text-orange-600">Dropdown</div>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="border-t pt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Tips</h3>
                  <ul className="text-blue-800 text-xs space-y-1">
                    <li>• Always escape HTML in hooks to prevent XSS attacks</li>
                    <li>• Provide sensible default values in configSchema</li>
                    <li>• Use unique slugs to avoid conflicts with other plugins</li>
                    <li>• Test migrations locally before deploying</li>
                    <li>• Use <code className="bg-blue-100 px-1 rounded">context.store</code> to access store info in hooks</li>
                    <li>• Services go in <code className="bg-blue-100 px-1 rounded">services/</code>, models in <code className="bg-blue-100 px-1 rounded">models/</code>, utils in <code className="bg-blue-100 px-1 rounded">utils/</code></li>
                    <li>• Check <code className="bg-blue-100 px-1 rounded">backend/plugins/hello-world-example/</code> for a complete example</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setShowHowToDialog(false)}>
                  Got it!
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Flash Message */}
        <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      </div>
    </div>
  );
}
