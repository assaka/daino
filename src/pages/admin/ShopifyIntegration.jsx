import React, { useState, useEffect, useCallback } from 'react';
import CategoryMappingPanel from '../../components/admin/CategoryMappingPanel';
import ImportJobProgress from '../../components/admin/integrations/ImportJobProgress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  ShoppingBag,
  Settings,
  Package,
  RefreshCw,
  Download,
  Store,
  Clock,
  AlertCircle,
  Loader2,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  Unlink,
  Database,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  FolderTree
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import SaveButton from '@/components/ui/save-button';
import FlashMessage from '@/components/storefront/FlashMessage';

const ShopifyIntegration = () => {
  const { selectedStore } = useStoreSelection();
  const storeId = selectedStore?.id;

  const [activeTab, setActiveTab] = useState('configuration');
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [importStats, setImportStats] = useState(null);
  const [message, setMessage] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const [shopInfo, setShopInfo] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [storageConfigured, setStorageConfigured] = useState(null);
  const [storageProvider, setStorageProvider] = useState(null);
  const [dryRun, setDryRun] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Category mapping state
  const [fetchingCategories, setFetchingCategories] = useState(false);
  const [showCollectionImportResult, setShowCollectionImportResult] = useState(true);
  const [categoryMappingKey, setCategoryMappingKey] = useState(0); // To force refresh
  const [categoryMappingStats, setCategoryMappingStats] = useState({ total: 0, mapped: 0, unmapped: 0 });
  const [importingFromMappings, setImportingFromMappings] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger to refresh ImportJobProgress

  // Scheduled imports state
  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    import_type: 'products',
    schedule_type: 'once',
    schedule_time: '',
    schedule_date: '',
    is_active: true,
    options: { dryRun: false }
  });

  // Statistics state
  const [stats, setStats] = useState({
    collections: 0,
    products: 0
  });
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (storeId && storeId !== 'undefined') {
      checkConnectionStatus();
      fetchImportStats();
      checkStorageConfiguration();
      loadStats();
    }
  }, [storeId]);

  const loadStats = async () => {
    if (!storeId) return;

    setLoadingStats(true);
    try {
      const response = await fetch('/api/shopify/import/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.stats) {
          setStats({
            collections: data.stats.collections?.successful_imports || 0,
            products: data.stats.products?.successful_imports || 0
          });
        }
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const checkStorageConfiguration = async () => {
    if (!storeId) return;

    try {
      const response = await fetch('/api/storage/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      if (response.ok) {
        const data = await response.json();
        const configured = data.configured || data.hasProvider || false;
        setStorageConfigured(configured);
        const provider = data.provider || data.integrationType || 'External URLs';
        setStorageProvider(provider);
      } else {
        setStorageConfigured(false);
        setStorageProvider('External URLs');
      }
    } catch (error) {
      setStorageConfigured(false);
      setStorageProvider('External URLs');
    }
  };

  const connectWithDirectAccess = async () => {
    if (!shopDomain || !accessToken) {
      setMessage({
        type: 'error',
        text: 'Please fill in both Shop Domain and Access Token'
      });
      return;
    }

    const formattedDomain = shopDomain.includes('.myshopify.com')
      ? shopDomain
      : `${shopDomain}.myshopify.com`;

    setLoading(true);
    setMessage(null);
    setSaveSuccess(false);

    try {
      const token = localStorage.getItem('store_owner_auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-store-id': storeId
      };

      const response = await fetch('/api/shopify/direct-access', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shop_domain: formattedDomain,
          access_token: accessToken
        })
      });

      const data = await response.json();

      if (data.success) {
        setFlashMessage({
          type: 'success',
          text: 'Successfully connected to Shopify!'
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);

        setAccessToken('');
        setShopDomain('');

        checkConnectionStatus();
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Failed to connect to Shopify'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to connect to Shopify'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    if (!storeId) return;

    try {
      const response = await fetch('/api/shopify/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });
      const data = await response.json();
      setConnectionStatus(data);

      if (data.connected) {
        fetchShopInfo();
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  const fetchShopInfo = async () => {
    if (!storeId) return;

    try {
      const response = await fetch('/api/shopify/shop-info', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      if (response.ok) {
        const data = await response.json();
        setShopInfo(data.shop_info);
      }
    } catch (error) {
      console.error('Error fetching shop info:', error);
    }
  };

  const fetchImportStats = async () => {
    if (!storeId) return;

    try {
      const response = await fetch('/api/shopify/import/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      if (response.ok) {
        const data = await response.json();
        setImportStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching import stats:', error);
    }
  };

  const handleDisconnectClick = () => {
    if (!storeId) {
      setMessage({ type: 'error', text: 'No store selected' });
      return;
    }
    setShowDisconnectModal(true);
  };

  const handleDisconnectConfirm = async () => {
    setShowDisconnectModal(false);
    setDisconnecting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/shopify/disconnect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      const data = await response.json();

      if (data.success) {
        setFlashMessage({ type: 'success', text: 'Successfully disconnected from Shopify' });
        setConnectionStatus(null);
        setShopInfo(null);
        checkConnectionStatus();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect' });
    } finally {
      setDisconnecting(false);
    }
  };

  const importData = async (type, options = {}) => {
    if (!storeId) {
      setMessage({ type: 'error', text: 'No store selected' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Use background job endpoint instead of direct SSE
      const endpoint = `/api/shopify/import/${type}`;
      const token = localStorage.getItem('store_owner_auth_token');

      // Map options for the background job endpoint
      const payload = {
        dry_run: dryRun,
        overwrite: options.overwrite || false
      };

      // Handle product limit
      if (options.limit) {
        payload.limit = options.limit;
      }
      if (type === 'full' && options.limit) {
        payload.product_limit = options.limit;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-store-id': storeId
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setFlashMessage({
          type: 'success',
          text: `Import job started! ${dryRun ? '(Dry run mode)' : ''} You can track progress below.`
        });
        // The ImportJobProgress component will handle showing the job status
      } else {
        setMessage({ type: 'error', text: data.message || `Failed to start ${type} import` });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Error starting ${type} import: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  // Callback when import job completes
  const handleJobComplete = useCallback((job) => {
    fetchImportStats();
    loadStats();
    setFlashMessage({
      type: 'success',
      text: `Import completed! ${job.result?.stats?.imported || 0} items imported.`
    });
  }, []);

  // Callback when import job fails
  const handleJobFailed = useCallback((job) => {
    setMessage({
      type: 'error',
      text: `Import failed: ${job.error || 'Unknown error'}`
    });
  }, []);

  // Fetch category mapping stats
  const fetchCategoryMappingStats = async () => {
    try {
      const response = await apiClient.get('/integrations/category-mappings/shopify');
      if (response.success) {
        setCategoryMappingStats(response.stats || { total: 0, mapped: 0, unmapped: 0 });
      }
    } catch (error) {
      console.error('Error fetching category mapping stats:', error);
    }
  };

  // Fetch mapping stats when store changes
  useEffect(() => {
    if (storeId && storeId !== 'undefined') {
      fetchCategoryMappingStats();
    }
  }, [storeId]);

  // Fetch categories from Shopify to category mappings
  const handleFetchCategories = async () => {
    setFetchingCategories(true);
    setShowCollectionImportResult(false); // Hide import result
    try {
      const response = await apiClient.post('/integrations/category-mappings/shopify/sync', {});
      if (response.success) {
        // Force refresh the CategoryMappingPanel by changing its key
        setCategoryMappingKey(prev => prev + 1);
        // Refresh mapping stats
        await fetchCategoryMappingStats();
        setFlashMessage({
          type: 'success',
          text: response.message || 'Collections fetched successfully'
        });
      } else {
        setFlashMessage({
          type: 'error',
          text: response.message || 'Failed to fetch collections'
        });
      }
    } catch (error) {
      console.error('Error fetching collections:', error);
      setFlashMessage({
        type: 'error',
        text: error.message || 'Failed to fetch collections'
      });
    } finally {
      setFetchingCategories(false);
    }
  };

  // Import categories from integration_category_mappings to categories table (via background job)
  const handleImportFromMappings = async () => {
    setImportingFromMappings(true);
    try {
      // Schedule a background job for category creation
      const response = await apiClient.post('/integrations/category-mappings/shopify/create-categories-job', {});

      if (response.success) {
        toast.success('Collection category creation job started! Track progress below.');
        // Trigger refresh of ImportJobProgress to show the new job
        setRefreshTrigger(prev => prev + 1);
        // Refresh mapping stats after job is scheduled (with delay to let job start)
        setTimeout(() => {
          fetchCategoryMappingStats();
          setCategoryMappingKey(prev => prev + 1);
        }, 2000);
      } else {
        toast.error(response.message || 'Failed to schedule category creation job');
      }
    } catch (error) {
      console.error('Error scheduling category creation job:', error);
      toast.error(error.message || 'Failed to schedule category creation job');
    } finally {
      setImportingFromMappings(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  // Load schedules
  const loadSchedules = useCallback(async () => {
    if (!storeId) return;
    setLoadingSchedules(true);
    try {
      const response = await apiClient.get('/shopify/schedules');
      console.log('[loadSchedules] Response:', response);
      // Handle both response.data.schedules and response.schedules
      const scheduleData = response.data?.schedules || response.schedules || [];
      console.log('[loadSchedules] Found schedules:', scheduleData.length);
      setSchedules(scheduleData);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    } finally {
      setLoadingSchedules(false);
    }
  }, [storeId]);

  // Load schedules when connected
  useEffect(() => {
    if (connectionStatus?.connected) {
      loadSchedules();
    }
  }, [connectionStatus?.connected, loadSchedules]);

  // Save schedule
  const saveSchedule = async () => {
    try {
      if (!storeId) return;

      // Validate form
      if (scheduleForm.schedule_type === 'once' && !scheduleForm.schedule_date) {
        toast.error('Schedule date is required for one-time schedules');
        return;
      }
      if (scheduleForm.schedule_type !== 'once' && !scheduleForm.schedule_time) {
        toast.error('Schedule time is required for recurring schedules');
        return;
      }

      const response = await apiClient.post('/shopify/schedules', scheduleForm);

      if (response.data?.success) {
        toast.success('Schedule saved successfully');
        setShowScheduleForm(false);
        setEditingSchedule(null);
        setScheduleForm({
          import_type: 'products',
          schedule_type: 'once',
          schedule_time: '',
          schedule_date: '',
          is_active: true,
          options: { dryRun: false }
        });
        await loadSchedules();
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast.error('Failed to save schedule');
    }
  };

  // Delete schedule
  const deleteSchedule = async (scheduleId) => {
    try {
      if (!storeId) return;

      const response = await apiClient.delete(`/shopify/schedules/${scheduleId}`);

      if (response.data?.success) {
        toast.success('Schedule deleted successfully');
        await loadSchedules();
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  // Toggle schedule active status
  const toggleSchedule = async (schedule) => {
    try {
      if (!storeId) return;

      const newStatus = !schedule.is_active;
      const response = await apiClient.post('/shopify/schedules', {
        id: schedule.id,
        is_active: newStatus,
        status: newStatus ? 'scheduled' : 'paused'
      });

      if (response.data?.success) {
        toast.success(newStatus ? 'Schedule activated' : 'Schedule paused');
        await loadSchedules();
      }
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      toast.error('Failed to update schedule');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ShoppingBag className="w-8 h-8 text-green-600" />
          Shopify Integration
        </h1>
        <p className="text-gray-600 mt-1">
          Connect your Shopify store to import products and collections into DainoStore.
        </p>
      </div>

      {/* Statistics Display */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Current Import Statistics
          </CardTitle>
          <CardDescription>
            Current count of imported data in your store
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.collections}</div>
              <div className="text-sm text-purple-600">Collections</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.products}</div>
              <div className="text-sm text-orange-600">Products</div>
            </div>
          </div>
          {loadingStats && (
            <div className="mt-4 text-center">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
              <span className="text-sm text-gray-500 ml-2">Updating statistics...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Job Progress - Above Tabs like Akeneo */}
      <ImportJobProgress
        source="shopify"
        onJobComplete={handleJobComplete}
        onJobFailed={handleJobFailed}
        showHistory={true}
        maxHistoryItems={5}
        className="mb-6"
        refreshTrigger={refreshTrigger}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configuration" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Categories
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Shopify Configuration</CardTitle>
                  <CardDescription>
                    Configure your Shopify store connection settings. Save your configuration first, then test the connection before importing data.
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {connectionStatus?.connected ? (
                    <>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Connected
                      </span>
                      <button
                        onClick={handleDisconnectClick}
                        disabled={disconnecting}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Disconnect Shopify"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Flash Message */}
              {message && (
                <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              {!connectionStatus?.connected ? (
                <div className="space-y-6">
                  {/* Connection Form */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="shop-domain" className="flex items-center">
                        Shopify Store Domain
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="shop-domain"
                        type="text"
                        placeholder="your-store.myshopify.com"
                        value={shopDomain}
                        onChange={(e) => setShopDomain(e.target.value)}
                        disabled={loading}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Example: my-awesome-store.myshopify.com
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="access-token" className="flex items-center">
                        Admin API Access Token
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="access-token"
                        type="password"
                        placeholder="shpat_..."
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        disabled={loading}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Get this from your custom app in Shopify (starts with shpat_)
                      </p>
                    </div>

                    <Alert className="border-green-200 bg-green-50">
                      <Shield className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 text-sm">
                        Your credentials are encrypted and stored securely. They are never exposed in responses or logs.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-end pt-2">
                      <SaveButton
                        onClick={connectWithDirectAccess}
                        loading={loading}
                        success={saveSuccess}
                        disabled={!shopDomain || !accessToken}
                        defaultText="Connect to Shopify"
                      />
                    </div>
                  </div>

                  {/* Instructions Card */}
                  <div className="border border-blue-200 bg-blue-50/50 rounded-lg">
                    <div className="p-4 cursor-pointer" onClick={() => setShowInstructions(!showInstructions)}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold flex items-center text-blue-900">
                          <Info className="w-5 h-5 mr-2 text-blue-600" />
                          How to Get Your Shopify Credentials
                        </h3>
                        {showInstructions ? (
                          <ChevronUp className="w-5 h-5 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                    {showInstructions && (
                      <div className="px-4 pb-4 space-y-4 text-sm">
                        <div className="space-y-3">
                          <div className="font-medium text-blue-900">Step 1: Get Your Shop Domain</div>
                          <p className="text-gray-700">
                            Your shop domain is the URL you use to access your Shopify admin. It looks like: <code className="bg-white px-2 py-1 rounded">your-store.myshopify.com</code>
                          </p>

                          <div className="font-medium text-blue-900 mt-4">Step 2: Create a Custom App in Shopify</div>
                          <ol className="list-decimal list-inside space-y-2 text-gray-700">
                            <li>
                              Log into your Shopify Admin and go to{' '}
                              <strong>Settings → Apps and sales channels</strong>
                            </li>
                            <li>
                              Click <strong>"Develop apps"</strong> (you may need to enable custom app development first)
                            </li>
                            <li>
                              Click <strong>"Create an app"</strong> and name it (e.g., "SuprShop Integration")
                            </li>
                            <li>
                              Click <strong>"Configure Admin API scopes"</strong>
                            </li>
                            <li>
                              Select these permissions:
                              <ul className="list-disc list-inside ml-4 mt-1">
                                <li>read_products</li>
                                <li>read_product_listings</li>
                                <li>read_inventory</li>
                                <li>read_content (for collections)</li>
                              </ul>
                            </li>
                            <li>Click <strong>"Save"</strong></li>
                            <li>
                              Click <strong>"Install app"</strong> to install it on your store
                            </li>
                            <li>
                              You'll see an <strong>Admin API access token</strong> - copy this!
                              <br />
                              <span className="text-xs text-gray-600">
                                (It starts with <code className="bg-white px-1 rounded">shpat_</code>)
                              </span>
                            </li>
                          </ol>

                          <Alert className="border-yellow-200 bg-yellow-50 mt-4">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-800 text-xs">
                              <strong>Important:</strong> The access token is only shown once! Copy it immediately and store it securely.
                            </AlertDescription>
                          </Alert>

                          <div className="mt-4 pt-4 border-t border-blue-200">
                            <a
                              href="https://help.shopify.com/en/manual/apps/custom-apps"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-medium"
                            >
                              Read Shopify's Official Guide
                              <ExternalLink className="w-4 h-4 ml-1" />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Connected Store Info */}
                  {shopInfo && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Store className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{shopInfo.shop_name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                        <div>Domain: {shopInfo.shop_domain}</div>
                        <div>Plan: {shopInfo.plan_name}</div>
                        <div>Currency: {shopInfo.shop_currency}</div>
                        <div>Country: {shopInfo.shop_country}</div>
                      </div>
                      {shopInfo.connected_at && (
                        <div className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Connected: {formatDate(shopInfo.connected_at)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Media Storage Info */}
                  {storageProvider && (
                    <Alert className={storageConfigured ? "border-blue-200 bg-blue-50" : "border-yellow-200 bg-yellow-50"}>
                      <Info className={`h-4 w-4 ${storageConfigured ? 'text-blue-600' : 'text-yellow-600'}`} />
                      <AlertDescription className={storageConfigured ? "text-blue-800" : "text-yellow-800"}>
                        <div className="flex items-center justify-between">
                          <div>
                            <strong>Media will be stored on {storageProvider.charAt(0).toUpperCase() + storageProvider.slice(1)}</strong>
                            {!storageConfigured && (
                              <p className="text-sm mt-1">
                                Images will use external Shopify URLs. Configure a storage provider for better performance.
                              </p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.location.href = '/admin/media-storage'}
                            className="ml-4 whitespace-nowrap"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            View Storage
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          {!connectionStatus?.connected ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Not Connected</h3>
                <p className="text-gray-600 mb-4">
                  Please connect to your Shopify store first before importing products.
                </p>
                <Button onClick={() => setActiveTab('configuration')}>
                  Go to Configuration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Import Products</CardTitle>
                  <CardDescription>
                    Import products from your Shopify store into DainoStore
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Dry Run Toggle */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label htmlFor="dry-run" className="font-medium">Dry Run Mode</Label>
                      <p className="text-sm text-gray-600">
                        Preview what will be imported without making any changes
                      </p>
                    </div>
                    <Switch
                      id="dry-run"
                      checked={dryRun}
                      onCheckedChange={setDryRun}
                    />
                  </div>

                  {/* Import Products Button */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button
                      onClick={() => importData('products')}
                      disabled={loading}
                      className="h-auto py-4 flex-col"
                    >
                      <ShoppingBag className="w-6 h-6 mb-2" />
                      <span>Import Products</span>
                      {importStats?.products && (
                        <span className="text-xs text-gray-300 mt-1">
                          Last: {importStats.products.successful_imports || 0} imported
                        </span>
                      )}
                    </Button>
                  </div>

                  {/* Advanced Options */}
                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-4">Advanced Options</h4>
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-sm font-medium mb-2">Limited Import</h5>
                        <p className="text-sm text-gray-600 mb-2">
                          Import a limited number of products for testing.
                        </p>
                        <div className="flex space-x-2">
                          <Button
                            onClick={() => importData('products', { limit: 50 })}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                          >
                            Import First 50 Products
                          </Button>
                          <Button
                            onClick={() => importData('products', { limit: 100 })}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                          >
                            Import First 100 Products
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Import Statistics */}
              {importStats && (importStats.collections || importStats.products) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Import Statistics</CardTitle>
                    <CardDescription>
                      Summary of your last import operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {importStats.collections && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2 flex items-center">
                            <Package className="w-4 h-4 mr-2" />
                            Collections
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Processed:</span>
                              <span>{importStats.collections.total_processed || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Successfully Imported:</span>
                              <span className="text-green-600">
                                {importStats.collections.successful_imports || 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Failed:</span>
                              <span className="text-red-600">
                                {importStats.collections.failed_imports || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {importStats.products && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2 flex items-center">
                            <ShoppingBag className="w-4 h-4 mr-2" />
                            Products
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Processed:</span>
                              <span>{importStats.products.total_processed || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Successfully Imported:</span>
                              <span className="text-green-600">
                                {importStats.products.successful_imports || 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Failed:</span>
                              <span className="text-red-600">
                                {importStats.products.failed_imports || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Scheduled Imports */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Scheduled Imports
                      </CardTitle>
                      <CardDescription>
                        Automate your Shopify imports on a schedule
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingSchedule(null);
                        setScheduleForm({
                          import_type: 'products',
                          schedule_type: 'once',
                          schedule_time: '',
                          schedule_date: '',
                          is_active: true,
                          options: { dryRun: false }
                        });
                        setShowScheduleForm(true);
                      }}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Schedule
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Schedule Form */}
                  {showScheduleForm && (
                    <Card className="mb-4 border-2 border-blue-200 bg-blue-50/30">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Import Type</Label>
                            <Select
                              value={scheduleForm.import_type}
                              onValueChange={(value) => setScheduleForm(prev => ({ ...prev, import_type: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select import type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="products">Products</SelectItem>
                                <SelectItem value="collections">Collections</SelectItem>
                                <SelectItem value="full">Full Import (Collections + Products)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Schedule Type</Label>
                            <Select
                              value={scheduleForm.schedule_type}
                              onValueChange={(value) => setScheduleForm(prev => ({ ...prev, schedule_type: value }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select schedule type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="once">Once</SelectItem>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {scheduleForm.schedule_type === 'once' ? (
                          <div className="mt-4 space-y-2">
                            <Label>Schedule Date & Time</Label>
                            <Input
                              type="datetime-local"
                              value={scheduleForm.schedule_date}
                              onChange={(e) => setScheduleForm(prev => ({ ...prev, schedule_date: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <div className="mt-4 space-y-2">
                            <Label>
                              Time
                              <span className="font-normal text-gray-600 ml-1">
                                {scheduleForm.schedule_type === 'hourly' && '(e.g., :00, :30)'}
                                {scheduleForm.schedule_type === 'daily' && '(e.g., 09:00)'}
                                {scheduleForm.schedule_type === 'weekly' && '(e.g., MON-09:00)'}
                                {scheduleForm.schedule_type === 'monthly' && '(e.g., 1-09:00)'}
                              </span>
                            </Label>
                            <Input
                              placeholder={
                                scheduleForm.schedule_type === 'hourly' ? ':MM' :
                                scheduleForm.schedule_type === 'daily' ? 'HH:MM' :
                                scheduleForm.schedule_type === 'weekly' ? 'DAY-HH:MM' :
                                'DD-HH:MM'
                              }
                              value={scheduleForm.schedule_time}
                              onChange={(e) => setScheduleForm(prev => ({ ...prev, schedule_time: e.target.value }))}
                            />
                          </div>
                        )}

                        <div className="mt-4 flex items-center space-x-2">
                          <Switch
                            id="schedule-dry-run"
                            checked={scheduleForm.options.dryRun}
                            onCheckedChange={(checked) => setScheduleForm(prev => ({
                              ...prev,
                              options: { ...prev.options, dryRun: checked }
                            }))}
                          />
                          <Label htmlFor="schedule-dry-run">Dry Run (Preview only)</Label>
                        </div>

                        <div className="mt-4 flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowScheduleForm(false);
                              setEditingSchedule(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button onClick={saveSchedule}>
                            {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Schedules List */}
                  <div className="space-y-2">
                    {loadingSchedules ? (
                      <div className="text-center py-4">
                        <RefreshCw className="h-4 w-4 animate-spin mx-auto" />
                        <span className="text-sm text-gray-500 ml-2">Loading schedules...</span>
                      </div>
                    ) : schedules.length > 0 ? (
                      schedules.map((schedule) => (
                        <Card key={schedule.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant={schedule.is_active ? "default" : "secondary"}>
                                  {schedule.import_type}
                                </Badge>
                                <span className="text-sm text-gray-600">
                                  {schedule.schedule_type === 'once'
                                    ? new Date(schedule.schedule_date).toLocaleString()
                                    : `${schedule.schedule_type} at ${schedule.schedule_time}`
                                  }
                                </span>
                                {!schedule.is_active && (
                                  <Badge variant="outline">Paused</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">
                                {schedule.options?.dryRun && <span>Dry Run • </span>}
                                <span>Created: {new Date(schedule.created_at).toLocaleDateString()}</span>
                              </div>
                              {/* Execution Status */}
                              <div className="text-xs text-gray-400 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                {schedule.last_run && (
                                  <span>Last run: {new Date(schedule.last_run).toLocaleString()}</span>
                                )}
                                {schedule.next_run && schedule.is_active && (
                                  <span>Next run: {new Date(schedule.next_run).toLocaleString()}</span>
                                )}
                                {(schedule._run_count > 0 || schedule._success_count > 0 || schedule._failure_count > 0) && (
                                  <span>
                                    Runs: {schedule._run_count || 0}
                                    {schedule._success_count > 0 && <span className="text-green-600 ml-1">({schedule._success_count} ok)</span>}
                                    {schedule._failure_count > 0 && <span className="text-red-600 ml-1">({schedule._failure_count} failed)</span>}
                                  </span>
                                )}
                                {schedule.last_result && (
                                  <span className={schedule.last_result === 'success' ? 'text-green-600' : schedule.last_result === 'failed' ? 'text-red-600' : ''}>
                                    Last result: {schedule.last_result}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={schedule.is_active}
                                onCheckedChange={() => toggleSchedule(schedule)}
                                title={schedule.is_active ? 'Pause schedule' : 'Activate schedule'}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingSchedule(schedule);
                                  setScheduleForm({
                                    id: schedule.id,
                                    import_type: schedule.import_type,
                                    schedule_type: schedule.schedule_type,
                                    schedule_time: schedule.schedule_time || '',
                                    schedule_date: schedule.schedule_date || '',
                                    is_active: schedule.is_active,
                                    options: schedule.options || { dryRun: false }
                                  });
                                  setShowScheduleForm(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteSchedule(schedule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No scheduled imports configured</p>
                        <p className="text-sm">Click "Add Schedule" to create your first automated import</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

            </>
          )}
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          {!connectionStatus?.connected ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderTree className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Not Connected</h3>
                <p className="text-gray-600 mb-4">
                  Please connect to your Shopify store first before managing category mappings.
                </p>
                <Button onClick={() => setActiveTab('configuration')}>
                  Go to Configuration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Action Buttons */}
              <Card>
                <CardHeader>
                  <CardTitle>Shopify Collections</CardTitle>
                  <CardDescription>
                    Fetch collections from Shopify and map them to store categories
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={handleFetchCategories}
                      disabled={fetchingCategories}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Download className={`w-4 h-4 ${fetchingCategories ? 'animate-pulse' : ''}`} />
                      {fetchingCategories ? 'Fetching...' : 'Fetch Collections'}
                    </Button>

                    {categoryMappingStats.unmapped > 0 && (
                      <Button
                        onClick={handleImportFromMappings}
                        disabled={importingFromMappings}
                        className="flex items-center gap-2"
                      >
                        <Package className={`w-4 h-4 ${importingFromMappings ? 'animate-spin' : ''}`} />
                        {importingFromMappings ? 'Importing...' : `Import ${categoryMappingStats.unmapped} Collections`}
                      </Button>
                    )}
                  </div>

                  {/* Import Result - Only show after import */}
                  {showCollectionImportResult && importStats?.collections && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 text-green-700">
                        <Package className="w-4 h-4" />
                        <span className="font-medium text-sm">Last Import</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        {importStats.collections.imported || importStats.collections.successful_imports || 0} imported, {importStats.collections.failed || importStats.collections.failed_imports || 0} failed
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Category Mapping Panel */}
              <CategoryMappingPanel
                key={categoryMappingKey}
                integrationSource="shopify"
                title="Shopify Collection Mapping"
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Disconnect Confirmation Modal */}
      <Dialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <DialogTitle>Disconnect Shopify</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Are you sure you want to disconnect from Shopify? This will remove your access token and you will need to reconnect to import data again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDisconnectModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnectConfirm}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShopifyIntegration;
