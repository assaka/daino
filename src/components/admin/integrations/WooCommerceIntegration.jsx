import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  ShoppingBag,
  Link,
  Unlink,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Store,
  Package,
  Clock,
  AlertCircle,
  Loader2,
  Settings,
  Key,
  Shield,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle
} from 'lucide-react';

// WooCommerce Integration Component - REST API Consumer Key/Secret Flow
const WooCommerceIntegration = () => {
  const { selectedStore } = useStoreSelection();
  const storeId = selectedStore?.id;

  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [importStats, setImportStats] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [message, setMessage] = useState(null);
  const [storeInfo, setStoreInfo] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [storageConfigured, setStorageConfigured] = useState(null);
  const [storageProvider, setStorageProvider] = useState(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (storeId && storeId !== 'undefined') {
      checkConnectionStatus();
      fetchImportStats();
      checkStorageConfiguration();
    }
  }, [storeId]);

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
    // Remove trailing slash
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
        setMessage({
          type: 'success',
          text: 'Successfully connected to WooCommerce!'
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);

        // Clear sensitive data from state
        setConsumerKey('');
        setConsumerSecret('');
        setStoreUrl('');

        // Refresh connection status
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
    if (!storeId) {
      return;
    }

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
      console.error('Error checking WooCommerce status:', error);
    }
  };

  const fetchStoreInfo = async () => {
    if (!storeId) {
      return;
    }

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
    if (!storeId) {
      return;
    }

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

  const testConnection = async () => {
    if (!storeId) {
      setMessage({ type: 'error', text: 'No store selected' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/woocommerce/test-connection', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`,
          'x-store-id': storeId
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        checkConnectionStatus();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to test connection' });
    } finally {
      setLoading(false);
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
        setMessage({ type: 'success', text: 'Successfully disconnected from WooCommerce' });
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
    setImportProgress({ type, progress: 0, message: 'Starting import...' });

    try {
      // Use direct import endpoint with SSE for real-time progress
      const endpoint = `/api/woocommerce/import/${type}-direct`;
      const token = localStorage.getItem('store_owner_auth_token');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-store-id': storeId
        },
        body: JSON.stringify(options)
      });

      // Check if SSE endpoint exists
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        // Handle SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.substring(6));

              if (data.stage === 'error') {
                setMessage({ type: 'error', text: data.message });
                setImportProgress(null);
              } else if (data.stage === 'complete') {
                setMessage({
                  type: 'success',
                  text: `Successfully imported ${type}! ${data.result?.stats?.imported || 0} items imported.`
                });
                setImportProgress(null);
                fetchImportStats();
              } else {
                // Update progress
                const progressPercent = data.current && data.total
                  ? Math.round((data.current / data.total) * 100)
                  : data.overall_progress || data.progress || 0;

                setImportProgress({
                  type,
                  progress: progressPercent,
                  message: data.message || data.item || `${data.stage}...`
                });
              }
            }
          }
        }
      } else {
        // Fallback to regular JSON response
        const data = await response.json();
        if (data.success) {
          setMessage({ type: 'success', text: `Successfully imported ${type}` });
          fetchImportStats();
        } else {
          setMessage({ type: 'error', text: data.message || `Failed to import ${type}` });
        }
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Error importing ${type}: ${error.message}`
      });
    } finally {
      setLoading(false);
      setImportProgress(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="bg-white">
      <div className="space-y-6">
        {/* Flash Message */}
        {message && (
          <Alert className={message.type === 'error' ? 'border-red-200' : message.type === 'success' ? 'border-green-200' : 'border-blue-200'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {!connectionStatus?.connected ? (
          <div className="space-y-6">
            {/* Connection Form */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Connect Your WooCommerce Store</h3>
              <p className="text-sm text-gray-600 mb-6">
                Enter your WooCommerce REST API credentials to connect your store
              </p>
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
                    Your credentials are encrypted and stored securely. They are never exposed in responses or logs.
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
                      <li>
                        Go to <strong>WooCommerce → Settings → Advanced</strong>
                      </li>
                      <li>
                        Click the <strong>"REST API"</strong> tab
                      </li>
                      <li>
                        Click <strong>"Add key"</strong> to create new API keys
                      </li>
                    </ol>

                    <div className="font-medium text-blue-900 mt-4">Step 3: Create API Keys</div>
                    <ol className="list-decimal list-inside space-y-2 text-gray-700">
                      <li>
                        Enter a <strong>Description</strong> (e.g., "Catalyst Integration")
                      </li>
                      <li>
                        Select <strong>User</strong> (admin user recommended)
                      </li>
                      <li>
                        Set <strong>Permissions</strong> to <strong>"Read"</strong> (or Read/Write if you need write access)
                      </li>
                      <li>
                        Click <strong>"Generate API key"</strong>
                      </li>
                    </ol>

                    <div className="font-medium text-blue-900 mt-4">Step 4: Copy Your Credentials</div>
                    <ul className="list-disc list-inside space-y-2 text-gray-700">
                      <li>
                        <strong>Consumer Key</strong> - starts with <code className="bg-white px-1 rounded">ck_</code>
                      </li>
                      <li>
                        <strong>Consumer Secret</strong> - starts with <code className="bg-white px-1 rounded">cs_</code>
                      </li>
                    </ul>

                    <Alert className="border-yellow-200 bg-yellow-50 mt-4">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800 text-xs">
                        <strong>Important:</strong> The Consumer Secret is only shown once! Copy it immediately and store it securely.
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
        ) : null}

        {connectionStatus?.connected && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Connected Store</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Connected
              </span>
            </div>
            {storeInfo && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4">
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

            <div className="flex space-x-2">
              <button
                onClick={testConnection}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </button>
              <button
                onClick={handleDisconnectClick}
                disabled={loading || disconnecting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4 mr-2" />
                )}
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Media Storage Info */}
        {connectionStatus?.connected && storageProvider && (
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

        {/* Import Options - Only show when connected */}
        {connectionStatus?.connected && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Import Data</h3>
            <p className="text-sm text-gray-600 mb-6">
              Import your WooCommerce data into the PIM
            </p>
            <Tabs defaultValue="quick" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quick">Quick Import</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
              </TabsList>

              <TabsContent value="quick" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => importData('categories')}
                    disabled={loading}
                    className="h-auto py-4 flex-col"
                    variant="outline"
                  >
                    <Package className="w-6 h-6 mb-2" />
                    <span>Import Categories</span>
                    {importStats?.categories && (
                      <span className="text-xs text-gray-500 mt-1">
                        Last: {importStats.categories.successful_imports || 0} imported
                      </span>
                    )}
                  </Button>

                  <Button
                    onClick={() => importData('products')}
                    disabled={loading}
                    className="h-auto py-4 flex-col"
                    variant="outline"
                  >
                    <ShoppingBag className="w-6 h-6 mb-2" />
                    <span>Import Products</span>
                    {importStats?.products && (
                      <span className="text-xs text-gray-500 mt-1">
                        Last: {importStats.products.successful_imports || 0} imported
                      </span>
                    )}
                  </Button>

                  <Button
                    onClick={() => importData('full')}
                    disabled={loading}
                    className="h-auto py-4 flex-col"
                  >
                    <Download className="w-6 h-6 mb-2" />
                    <span>Full Import</span>
                    <span className="text-xs text-gray-500 mt-1">
                      Categories + Products
                    </span>
                  </Button>
                </div>

                {importProgress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{importProgress.message}</span>
                      <span>{importProgress.progress}%</span>
                    </div>
                    <Progress value={importProgress.progress} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Advanced import options allow you to perform dry runs and limit the number of items imported.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Test Import (Dry Run)</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Preview what will be imported without making any changes.
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => importData('categories', { dry_run: true })}
                        disabled={loading}
                        variant="outline"
                      >
                        Test Categories Import
                      </Button>
                      <Button
                        onClick={() => importData('products', { dry_run: true, limit: 10 })}
                        disabled={loading}
                        variant="outline"
                      >
                        Test Products Import (10 items)
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Limited Import</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Import a limited number of products for testing.
                    </p>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => importData('products', { limit: 50 })}
                        disabled={loading}
                        variant="outline"
                      >
                        Import First 50 Products
                      </Button>
                      <Button
                        onClick={() => importData('products', { limit: 100 })}
                        disabled={loading}
                        variant="outline"
                      >
                        Import First 100 Products
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Import Statistics */}
        {importStats && (importStats.categories || importStats.products) && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Import Statistics</h3>
            <p className="text-sm text-gray-600 mb-6">
              Summary of your last import operations
            </p>
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
          </div>
        )}
      </div>

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
