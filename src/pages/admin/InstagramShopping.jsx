import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { MetaCommerce } from '@/api/meta-commerce';
import FlashMessage from '@/components/storefront/FlashMessage';
import {
  Instagram, Link2, RefreshCw, AlertCircle, CheckCircle2,
  Building2, ShoppingBag, Settings, AlertTriangle, Loader2
} from "lucide-react";

export default function InstagramShopping() {
  const { selectedStore: store } = useStoreSelection();
  const [activeTab, setActiveTab] = useState('connection');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);

  // Status and config state
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [catalogs, setCatalogs] = useState([]);
  const [errors, setErrors] = useState([]);

  // Settings state
  const [settings, setSettings] = useState({
    defaultBrand: '',
    storeDomain: '',
    currency: 'USD'
  });

  // Load status and config
  const loadStatus = useCallback(async () => {
    if (!store?.id) return;

    try {
      setLoading(true);
      const [statusRes, configRes] = await Promise.all([
        MetaCommerce.getStatus(),
        MetaCommerce.getConfig()
      ]);

      setStatus(statusRes);

      if (configRes.configured && configRes.config) {
        setConfig(configRes.config);
        setSettings({
          defaultBrand: configRes.config.defaultBrand || '',
          storeDomain: configRes.config.storeDomain || '',
          currency: configRes.config.currency || 'USD'
        });
      }

      if (statusRes.connected) {
        loadBusinesses();
        loadErrors();
      }
    } catch (error) {
      console.error('Failed to load status:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load integration status' });
    } finally {
      setLoading(false);
    }
  }, [store?.id]);

  // Load businesses
  const loadBusinesses = async () => {
    try {
      const result = await MetaCommerce.getBusinesses();
      setBusinesses(result.businesses || []);
    } catch (error) {
      console.error('Failed to load businesses:', error);
    }
  };

  // Load catalogs
  const loadCatalogs = async () => {
    try {
      const result = await MetaCommerce.getCatalogs();
      setCatalogs(result.catalogs || []);
    } catch (error) {
      console.error('Failed to load catalogs:', error);
    }
  };

  // Load errors
  const loadErrors = async () => {
    try {
      const result = await MetaCommerce.getProductErrors();
      setErrors(result.errors || []);
    } catch (error) {
      console.error('Failed to load errors:', error);
    }
  };

  useEffect(() => {
    loadStatus();

    // Check for OAuth callback params
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'connected') {
      setFlashMessage({ type: 'success', message: 'Successfully connected to Meta Commerce!' });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
      setFlashMessage({ type: 'error', message: `Connection failed: ${decodeURIComponent(error)}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [loadStatus]);

  // Handle connect
  const handleConnect = async () => {
    try {
      const result = await MetaCommerce.getAuthUrl();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error('Failed to get auth URL:', error);
      setFlashMessage({ type: 'error', message: 'Failed to initiate connection' });
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Instagram Shopping? This will remove access to your Meta catalog.')) {
      return;
    }

    try {
      await MetaCommerce.disconnect();
      setStatus({ connected: false });
      setConfig(null);
      setBusinesses([]);
      setCatalogs([]);
      setFlashMessage({ type: 'success', message: 'Successfully disconnected' });
    } catch (error) {
      console.error('Failed to disconnect:', error);
      setFlashMessage({ type: 'error', message: 'Failed to disconnect' });
    }
  };

  // Handle business selection
  const handleSelectBusiness = async (businessId) => {
    const business = businesses.find(b => b.id === businessId);
    try {
      await MetaCommerce.selectBusiness(businessId, business?.name);
      setConfig(prev => ({ ...prev, businessId, businessName: business?.name, catalogId: null, catalogName: null }));
      loadCatalogs();
      setFlashMessage({ type: 'success', message: 'Business selected' });
    } catch (error) {
      console.error('Failed to select business:', error);
      setFlashMessage({ type: 'error', message: 'Failed to select business' });
    }
  };

  // Handle catalog selection
  const handleSelectCatalog = async (catalogId) => {
    const catalog = catalogs.find(c => c.id === catalogId);
    try {
      await MetaCommerce.selectCatalog(catalogId, catalog?.name);
      setConfig(prev => ({ ...prev, catalogId, catalogName: catalog?.name }));
      loadStatus();
      setFlashMessage({ type: 'success', message: 'Catalog selected' });
    } catch (error) {
      console.error('Failed to select catalog:', error);
      setFlashMessage({ type: 'error', message: 'Failed to select catalog' });
    }
  };

  // Handle save settings
  const handleSaveSettings = async () => {
    try {
      await MetaCommerce.saveConfig(settings);
      setFlashMessage({ type: 'success', message: 'Settings saved' });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setFlashMessage({ type: 'error', message: 'Failed to save settings' });
    }
  };

  // Handle sync
  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await MetaCommerce.scheduleSyncJob({});
      setFlashMessage({
        type: 'success',
        message: `Sync job started (Job ID: ${result.jobId}). Check the Jobs page for progress.`
      });
    } catch (error) {
      console.error('Failed to start sync:', error);
      setFlashMessage({ type: 'error', message: 'Failed to start sync' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {flashMessage && (
        <div className="mb-4">
          <FlashMessage
            type={flashMessage.type}
            message={flashMessage.message}
            onClose={() => setFlashMessage(null)}
          />
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Instagram className="w-8 h-8 text-pink-600" />
          <div>
            <h1 className="text-2xl font-bold">Instagram Shopping</h1>
            <p className="text-muted-foreground">Sync products to Instagram Shopping via Meta Commerce Manager</p>
          </div>
        </div>
        {status?.connected && (
          <Badge variant="success">Connected</Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="connection">
            <Link2 className="w-4 h-4 mr-2" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="catalog" disabled={!status?.connected}>
            <Building2 className="w-4 h-4 mr-2" />
            Catalog
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={!status?.connected}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="sync" disabled={!config?.catalogId}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync
          </TabsTrigger>
          <TabsTrigger value="errors" disabled={!config?.catalogId}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Errors
          </TabsTrigger>
        </TabsList>

        {/* Connection Tab */}
        <TabsContent value="connection" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Meta Business Connection</CardTitle>
              <CardDescription>
                Connect your Meta Business account to sync products to Instagram Shopping
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!status?.connected ? (
                <div className="text-center py-8">
                  <Instagram className="w-16 h-16 mx-auto mb-4 text-pink-600" />
                  <p className="text-muted-foreground mb-6">
                    Connect your Meta Business account to start syncing products to Instagram Shopping.
                    You'll need a Meta Business account with Commerce Manager access.
                  </p>
                  <Button onClick={handleConnect} size="lg">
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect with Facebook
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium">Connected to Meta Commerce</p>
                        <p className="text-sm text-muted-foreground">
                          {status.businessName ? `Business: ${status.businessName}` : 'No business selected'}
                          {status.catalogName && ` | Catalog: ${status.catalogName}`}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleDisconnect}>
                      Disconnect
                    </Button>
                  </div>

                  {status.lastSyncAt && (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm">
                        <span className="font-medium">Last sync:</span>{' '}
                        {new Date(status.lastSyncAt).toLocaleString()}
                        {status.syncStatus && (
                          <Badge variant={status.syncStatus === 'success' ? 'success' : status.syncStatus === 'error' ? 'destructive' : 'secondary'} className="ml-2">
                            {status.syncStatus}
                          </Badge>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Catalog Tab */}
        <TabsContent value="catalog" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Product Catalog</CardTitle>
              <CardDescription>
                Choose the Meta Business account and product catalog to sync products to
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Business Account</Label>
                <Select
                  value={config?.businessId || ''}
                  onValueChange={handleSelectBusiness}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a business account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {businesses.map(business => (
                      <SelectItem key={business.id} value={business.id}>
                        {business.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {config?.businessId && (
                <div className="space-y-2">
                  <Label>Product Catalog</Label>
                  <Select
                    value={config?.catalogId || ''}
                    onValueChange={handleSelectCatalog}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a catalog..." />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogs.map(catalog => (
                        <SelectItem key={catalog.id} value={catalog.id}>
                          {catalog.name} ({catalog.product_count || 0} products)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Select an existing catalog or create one in Meta Commerce Manager
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sync Settings</CardTitle>
              <CardDescription>
                Configure how your products are synced to Instagram Shopping
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="storeDomain">Store Domain</Label>
                <Input
                  id="storeDomain"
                  placeholder="yourstore.com"
                  value={settings.storeDomain}
                  onChange={(e) => setSettings(prev => ({ ...prev, storeDomain: e.target.value }))}
                />
                <p className="text-sm text-muted-foreground">
                  Your store's domain used for product URLs
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultBrand">Default Brand</Label>
                <Input
                  id="defaultBrand"
                  placeholder="Your Brand Name"
                  value={settings.defaultBrand}
                  onChange={(e) => setSettings(prev => ({ ...prev, defaultBrand: e.target.value }))}
                />
                <p className="text-sm text-muted-foreground">
                  Brand name used for products without a brand attribute
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sync Products</CardTitle>
              <CardDescription>
                Sync your products to the Instagram Shopping catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <ShoppingBag className="h-4 w-4" />
                <AlertTitle>Product Requirements</AlertTitle>
                <AlertDescription>
                  Products must have a SKU, title, price, and at least one image (minimum 500x500 pixels) to sync successfully.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleSync}
                disabled={syncing}
                size="lg"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting Sync...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync All Products
                  </>
                )}
              </Button>

              {status?.lastSyncAt && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="font-medium">Last Sync</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(status.lastSyncAt).toLocaleString()}
                  </p>
                  <p className="text-sm">
                    Status:{' '}
                    <Badge variant={
                      status.syncStatus === 'success' ? 'success' :
                      status.syncStatus === 'error' ? 'destructive' : 'secondary'
                    }>
                      {status.syncStatus}
                    </Badge>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Errors</CardTitle>
              <CardDescription>
                Products that failed to sync to Instagram Shopping
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errors.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-600" />
                  <p className="text-muted-foreground">
                    No errors found. All products synced successfully.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {errors.length} product(s) with errors
                    </p>
                    <Button variant="outline" size="sm" onClick={loadErrors}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium">SKU</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Error</th>
                          <th className="px-4 py-2 text-left text-sm font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errors.map((error, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-2 text-sm font-mono">{error.retailerId}</td>
                            <td className="px-4 py-2 text-sm text-red-600">{error.errorMessage}</td>
                            <td className="px-4 py-2 text-sm text-muted-foreground">
                              {new Date(error.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
