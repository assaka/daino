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
  Info
} from 'lucide-react';

// Shopify Integration Component - Direct Access Token Flow
const ShopifyIntegration = () => {
  const { selectedStore } = useStoreSelection();
  const storeId = selectedStore?.id;

  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [importStats, setImportStats] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const [message, setMessage] = useState(null);
  const [shopInfo, setShopInfo] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [storageConfigured, setStorageConfigured] = useState(null);
  const [storageProvider, setStorageProvider] = useState(null);

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
        // Extract provider name (supabase, s3, gcs, local, etc.)
        const provider = data.provider || data.integrationType || 'External URLs';
        setStorageProvider(provider);
      } else {
        setStorageConfigured(false);
        setStorageProvider('External URLs');
      }
    } catch (error) {
      // Set defaults if check fails
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

    // Ensure the domain has .myshopify.com
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
        setMessage({
          type: 'success',
          text: 'Successfully connected to Shopify!'
        });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);

        // Clear sensitive data from state
        setAccessToken('');
        setShopDomain('');

        // Refresh connection status
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
    if (!storeId) {
      return;
    }

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
    }
  };

  const fetchShopInfo = async () => {
    if (!storeId) {
      return;
    }

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
    if (!storeId) {
      return;
    }

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

  const testConnection = async () => {
    if (!storeId) {
      setMessage({ type: 'error', text: 'No store selected' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/shopify/test-connection', {
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

  const disconnectShopify = async () => {
    if (!storeId) {
      setMessage({ type: 'error', text: 'No store selected' });
      return;
    }

    if (!window.confirm('Are you sure you want to disconnect from Shopify? This will remove your access token.')) {
      return;
    }

    setLoading(true);
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
        setMessage({ type: 'success', text: 'Successfully disconnected from Shopify' });
        setConnectionStatus(null);
        setShopInfo(null);
        checkConnectionStatus();
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect' });
    } finally {
      setLoading(false);
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
      const endpoint = `/api/shopify/import/${type}-direct`;
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
                  : data.progress || 0;

                setImportProgress({
                  type,
                  progress: progressPercent,
                  message: data.message || `${data.stage}...`
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Connect Your Shopify Store</h3>
              <p className="text-sm text-gray-600 mb-6">
                Enter your Shopify credentials to connect your store
              </p>
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
          </div>

          {/* Instructions Card - Moved Below */}
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
        ) : null}

        {connectionStatus?.connected && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Connected Store</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Connected
              </span>
            </div>
            {shopInfo && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 mb-4">
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
                onClick={disconnectShopify}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4 mr-2" />
                )}
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Media Storage Info - Show storage provider being used */}
        {connectionStatus?.connected && storageProvider && (
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

        {/* Import Options - Only show when connected */}
        {connectionStatus?.connected && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Import Data</h3>
            <p className="text-sm text-gray-600 mb-6">
              Import your Shopify data into DainoStore
            </p>
            <Tabs defaultValue="quick" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="quick">Quick Import</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
              </TabsList>

              <TabsContent value="quick" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={() => importData('collections')}
                    disabled={loading}
                    className="h-auto py-4 flex-col"
                    variant="outline"
                  >
                    <Package className="w-6 h-6 mb-2" />
                    <span>Import Collections</span>
                    {importStats?.collections && (
                      <span className="text-xs text-gray-500 mt-1">
                        Last: {importStats.collections.successful_imports || 0} imported
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
                      Collections + Products
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
                        onClick={() => importData('collections', { dry_run: true })}
                        disabled={loading}
                        variant="outline"
                      >
                        Test Collections Import
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
        {importStats && (importStats.collections || importStats.products) && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Import Statistics</h3>
            <p className="text-sm text-gray-600 mb-6">
              Summary of your last import operations
            </p>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopifyIntegration;