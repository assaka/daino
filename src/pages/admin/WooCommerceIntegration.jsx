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
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
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
import apiClient from '@/api/client';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import SaveButton from '@/components/ui/save-button';
import FlashMessage from '@/components/storefront/FlashMessage';

const WooCommerceIntegration = () => {
  const { selectedStore } = useStoreSelection();
  const storeId = selectedStore?.id;

  const [activeTab, setActiveTab] = useState('configuration');
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [importStats, setImportStats] = useState(null);
  const [message, setMessage] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [storageConfigured, setStorageConfigured] = useState(null);
  const [storageProvider, setStorageProvider] = useState(null);
  const [dryRun, setDryRun] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Category mapping state
  const [categoryMappingKey, setCategoryMappingKey] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
    categories: 0,
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
      const response = await fetch('/api/woocommerce/import/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.stats) {
          setStats({
            categories: data.stats.categories?.successful_imports || 0,
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

  const connectWithCredentials = async () => {
    if (!storeUrl || !consumerKey || !consumerSecret) {
      setMessage({
        type: 'error',
        text: 'Please fill in all required fields'
      });
      return;
    }

    // Ensure the URL has https
    let formattedUrl = storeUrl;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    formattedUrl = formattedUrl.replace(/\/$/, '');

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

      const response = await fetch('/api/woocommerce/connect', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          store_url: formattedUrl,
          consumer_key: consumerKey,
          consumer_secret: consumerSecret
        })
      });

      const data = await response.json();

      if (data.success) {
        setFlashMessage({
          type: 'success',
          text: 'Successfully connected to WooCommerce!'
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);

        setConsumerKey('');
        setConsumerSecret('');
        setStoreUrl('');

        checkConnectionStatus();
      } else {
        setMessage({
          type: 'error',
          text: data.message || 'Failed to connect to WooCommerce'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to connect to WooCommerce'
      });
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    if (!storeId) return;

    try {
      const response = await fetch('/api/woocommerce/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });
      const data = await response.json();
      setConnectionStatus(data);

      if (data.connected) {
        fetchStoreInfo();
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  const fetchStoreInfo = async () => {
    if (!storeId) return;

    try {
      const response = await fetch('/api/woocommerce/store-info', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStoreInfo(data.store_info);
      }
    } catch (error) {
      console.error('Error fetching store info:', error);
    }
  };

  const fetchImportStats = async () => {
    if (!storeId) return;

    try {
      const response = await fetch('/api/woocommerce/import/stats', {
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
      const response = await fetch('/api/woocommerce/disconnect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      const data = await response.json();

      if (data.success) {
        setFlashMessage({ type: 'success', text: 'Successfully disconnected from WooCommerce' });
        setConnectionStatus(null);
        setStoreInfo(null);
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
      const endpoint = `/api/woocommerce/import/${type}`;
      const token = localStorage.getItem('store_owner_auth_token');

      const payload = {
        dry_run: dryRun,
        overwrite: options.overwrite || false
      };

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
          text: `Import job started! ${dryRun ? '(Dry run mode)' : ''}`
        });
        setRefreshTrigger(prev => prev + 1);
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

  const handleJobComplete = useCallback((job) => {
    fetchImportStats();
    loadStats();
    const stats = job.result?.stats || {};
    const itemCount = stats.imported || stats.created || 0;
    setFlashMessage({
      type: 'success',
      text: `Import completed! ${itemCount} items imported.`
    });
  }, []);

  const handleJobFailed = useCallback((job) => {
    setMessage({
      type: 'error',
      text: `Import failed: ${job.error || 'Unknown error'}`
    });
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  // Load schedules
  const loadSchedules = useCallback(async () => {
    if (!storeId) return;
    setLoadingSchedules(true);
    try {
      const response = await apiClient.get('/woocommerce/schedules');
      const scheduleData = response.data?.schedules || response.schedules || [];
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

      if (scheduleForm.schedule_type === 'once' && !scheduleForm.schedule_date) {
        setFlashMessage({ type: 'error', text: 'Schedule date is required for one-time schedules' });
        return;
      }
      if (scheduleForm.schedule_type !== 'once' && !scheduleForm.schedule_time) {
        setFlashMessage({ type: 'error', text: 'Schedule time is required for recurring schedules' });
        return;
      }

      const isEditing = !!editingSchedule;
      await apiClient.post('/woocommerce/schedules', scheduleForm);

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
      setFlashMessage({ type: 'success', text: isEditing ? 'Schedule updated successfully' : 'Schedule created successfully' });
    } catch (error) {
      console.error('Failed to save schedule:', error);
      setFlashMessage({ type: 'error', text: 'Failed to save schedule' });
    }
  };

  // Delete schedule
  const deleteSchedule = async (scheduleId) => {
    try {
      if (!storeId) return;

      await apiClient.delete(`/woocommerce/schedules/${scheduleId}`);
      await loadSchedules();
      setFlashMessage({ type: 'success', text: 'Schedule deleted successfully' });
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      setFlashMessage({ type: 'error', text: 'Failed to delete schedule' });
    }
  };

  // Toggle schedule active status
  const toggleSchedule = async (schedule) => {
    try {
      if (!storeId) return;

      const newStatus = !schedule.is_active;
      await apiClient.post('/woocommerce/schedules', {
        id: schedule.id,
        is_active: newStatus,
        status: newStatus ? 'scheduled' : 'paused'
      });
      await loadSchedules();
      setFlashMessage({ type: 'success', text: newStatus ? 'Schedule activated' : 'Schedule paused' });
    } catch (error) {
      console.error('Failed to toggle schedule:', error);
      setFlashMessage({ type: 'error', text: 'Failed to update schedule' });
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
          <ShoppingBag className="w-8 h-8 text-purple-600" />
          WooCommerce Integration
        </h1>
        <p className="text-gray-600 mt-1">
          Connect your WooCommerce store to import products and categories.
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
              <div className="text-2xl font-bold text-purple-600">{stats.categories}</div>
              <div className="text-sm text-purple-600">Categories</div>
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

      {/* Import Job Progress */}
      <ImportJobProgress
        source="woocommerce"
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
                  <CardTitle>WooCommerce Configuration</CardTitle>
                  <CardDescription>
                    Configure your WooCommerce store connection settings.
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
                        title="Disconnect WooCommerce"
                      >
                        <Unlink className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span className="whitespace-nowrap inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {message && (
                <Alert className={message.type === 'error' ? 'border-red-200 bg-red-50' : message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}

              {!connectionStatus?.connected ? (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="store-url" className="flex items-center">
                        WooCommerce Store URL
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="store-url"
                        type="text"
                        placeholder="https://your-store.com"
                        value={storeUrl}
                        onChange={(e) => setStoreUrl(e.target.value)}
                        disabled={loading}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        The URL of your WooCommerce store (e.g., https://myshop.com)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="consumer-key" className="flex items-center">
                        Consumer Key
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="consumer-key"
                        type="text"
                        placeholder="ck_..."
                        value={consumerKey}
                        onChange={(e) => setConsumerKey(e.target.value)}
                        disabled={loading}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your WooCommerce REST API Consumer Key (starts with ck_)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="consumer-secret" className="flex items-center">
                        Consumer Secret
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Input
                        id="consumer-secret"
                        type="password"
                        placeholder="cs_..."
                        value={consumerSecret}
                        onChange={(e) => setConsumerSecret(e.target.value)}
                        disabled={loading}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Your WooCommerce REST API Consumer Secret (starts with cs_)
                      </p>
                    </div>

                    <Alert className="border-green-200 bg-green-50">
                      <Shield className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 text-sm">
                        Your credentials are encrypted and stored securely.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-end pt-2">
                      <SaveButton
                        onClick={connectWithCredentials}
                        loading={loading}
                        success={saveSuccess}
                        disabled={!storeUrl || !consumerKey || !consumerSecret}
                        defaultText="Connect to WooCommerce"
                      />
                    </div>
                  </div>

                  {/* Instructions Card */}
                  <div className="border border-blue-200 bg-blue-50/50 rounded-lg">
                    <div className="p-4 cursor-pointer" onClick={() => setShowInstructions(!showInstructions)}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold flex items-center text-blue-900">
                          <Info className="w-5 h-5 mr-2 text-blue-600" />
                          How to Get Your WooCommerce API Credentials
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
                          <div className="font-medium text-blue-900">Step 1: Log into WordPress Admin</div>
                          <p className="text-gray-700">
                            Go to your WordPress admin dashboard at <code className="bg-white px-2 py-1 rounded">your-site.com/wp-admin</code>
                          </p>

                          <div className="font-medium text-blue-900 mt-4">Step 2: Navigate to WooCommerce REST API Settings</div>
                          <ol className="list-decimal list-inside space-y-2 text-gray-700">
                            <li>Go to <strong>WooCommerce -&gt; Settings -&gt; Advanced</strong></li>
                            <li>Click the <strong>"REST API"</strong> tab</li>
                            <li>Click <strong>"Add key"</strong> to create new API keys</li>
                          </ol>

                          <div className="font-medium text-blue-900 mt-4">Step 3: Create API Keys</div>
                          <ol className="list-decimal list-inside space-y-2 text-gray-700">
                            <li>Enter a <strong>Description</strong> (e.g., "Catalyst Integration")</li>
                            <li>Select <strong>User</strong> (admin user recommended)</li>
                            <li>Set <strong>Permissions</strong> to <strong>"Read"</strong></li>
                            <li>Click <strong>"Generate API key"</strong></li>
                          </ol>

                          <Alert className="border-yellow-200 bg-yellow-50 mt-4">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-800 text-xs">
                              <strong>Important:</strong> The Consumer Secret is only shown once! Copy it immediately.
                            </AlertDescription>
                          </Alert>

                          <div className="mt-4 pt-4 border-t border-blue-200">
                            <a
                              href="https://woocommerce.com/document/woocommerce-rest-api/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-medium"
                            >
                              Read WooCommerce REST API Documentation
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
                  {storeInfo && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Store className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{storeInfo.store_url}</span>
                      </div>
                      {storeInfo.connected_at && (
                        <div className="text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Connected: {formatDate(storeInfo.connected_at)}
                        </div>
                      )}
                    </div>
                  )}

                  {storageProvider && (
                    <Alert className={storageConfigured ? "border-blue-200 bg-blue-50" : "border-yellow-200 bg-yellow-50"}>
                      <Info className={`h-4 w-4 ${storageConfigured ? 'text-blue-600' : 'text-yellow-600'}`} />
                      <AlertDescription className={storageConfigured ? "text-blue-800" : "text-yellow-800"}>
                        <div className="flex items-center justify-between">
                          <div>
                            <strong>Media will be stored on {storageProvider.charAt(0).toUpperCase() + storageProvider.slice(1)}</strong>
                            {!storageConfigured && (
                              <p className="text-sm mt-1">
                                Images will use external WooCommerce URLs. Configure a storage provider for better performance.
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

          {/* Import Scheduler */}
          {connectionStatus?.connected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Import Scheduler
                </CardTitle>
                <CardDescription>
                  Configure automated imports for different data types.
                </CardDescription>
              </CardHeader>

              <div className="mx-6 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Credit Usage Information</h4>
                    <p className="text-sm text-blue-800">
                      Currently free. Future billing (<strong>0.1 credits per run</strong>) will only begin after advance notification.
                    </p>
                  </div>
                </div>
              </div>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Scheduled Imports</h3>
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
                              <SelectItem value="categories">Categories</SelectItem>
                              <SelectItem value="full">Full Import (Categories + Products)</SelectItem>
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
                          <Label>Time</Label>
                          <Input
                            placeholder="HH:MM"
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
                              {schedule.options?.dryRun && <span>Dry Run - </span>}
                              <span>Created: {new Date(schedule.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={schedule.is_active}
                              onCheckedChange={() => toggleSchedule(schedule)}
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
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          {!connectionStatus?.connected ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Not Connected</h3>
                <p className="text-gray-600 mb-4">
                  Please connect to your WooCommerce store first before importing products.
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
                    Import products from your WooCommerce store
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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

                  <div>
                    <Button
                      onClick={() => importData('products')}
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      {loading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShoppingBag className="h-4 w-4" />
                      )}
                      {loading ? 'Importing...' : 'Import Products'}
                    </Button>
                  </div>

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

              {importStats && (importStats.categories || importStats.products) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Import Statistics</CardTitle>
                    <CardDescription>
                      Summary of your last import operations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {importStats.categories && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2 flex items-center">
                            <Package className="w-4 h-4 mr-2" />
                            Categories
                          </h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Processed:</span>
                              <span>{importStats.categories.total_processed || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Successfully Imported:</span>
                              <span className="text-green-600">
                                {importStats.categories.successful_imports || 0}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Failed:</span>
                              <span className="text-red-600">
                                {importStats.categories.failed_imports || 0}
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
                  Please connect to your WooCommerce store first before managing category mappings.
                </p>
                <Button onClick={() => setActiveTab('configuration')}>
                  Go to Configuration
                </Button>
              </CardContent>
            </Card>
          ) : (
            <CategoryMappingPanel
              key={categoryMappingKey}
              integrationSource="woocommerce"
              title="WooCommerce Category Mapping"
              onJobScheduled={() => setRefreshTrigger(prev => prev + 1)}
            />
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
              <DialogTitle>Disconnect WooCommerce</DialogTitle>
            </div>
            <DialogDescription className="pt-2">
              Are you sure you want to disconnect from WooCommerce? This will remove your API credentials and you will need to reconnect to import data again.
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

export default WooCommerceIntegration;
