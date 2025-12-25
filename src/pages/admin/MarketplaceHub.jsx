import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import FlashMessage from '@/components/storefront/FlashMessage';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Settings,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  ChevronRight,
  BarChart3,
  Instagram,
  Link2,
  Building2
} from 'lucide-react';
import { MetaCommerce } from '@/api/meta-commerce';

const MarketplaceHub = () => {
  const [flashMessage, setFlashMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('amazon');
  const [loading, setLoading] = useState(false);

  // Amazon state
  const [amazonConfig, setAmazonConfig] = useState({
    seller_id: '',
    mws_auth_token: '',
    aws_access_key_id: '',
    aws_secret_access_key: '',
    marketplace_id: 'ATVPDKIKX0DER',
    region: 'US'
  });
  const [amazonConfigured, setAmazonConfigured] = useState(false);
  const [amazonSettings, setAmazonSettings] = useState({
    use_ai_optimization: true,
    auto_translate: false,
    price_adjustment_percent: 0
  });
  const [showAmazonSecrets, setShowAmazonSecrets] = useState({});

  // eBay state
  const [ebayConfig, setEbayConfig] = useState({
    app_id: '',
    cert_id: '',
    dev_id: '',
    auth_token: ''
  });
  const [ebayConfigured, setEbayConfigured] = useState(false);
  const [ebaySettings, setEbaySettings] = useState({
    use_ai_optimization: true,
    listing_format: 'FixedPrice',
    listing_duration: '30'
  });

  // Shopify state
  const [shopifyConfigured, setShopifyConfigured] = useState(false);

  // Instagram Shopping state - extended
  const [instagramConfigured, setInstagramConfigured] = useState(false);
  const [instagramStatus, setInstagramStatus] = useState(null);
  const [instagramConfig, setInstagramConfig] = useState(null);
  const [instagramBusinesses, setInstagramBusinesses] = useState([]);
  const [instagramCatalogs, setInstagramCatalogs] = useState([]);
  const [instagramErrors, setInstagramErrors] = useState([]);
  const [instagramSettings, setInstagramSettings] = useState({
    defaultBrand: '',
    storeDomain: '',
    currency: 'USD'
  });
  const [instagramSyncing, setInstagramSyncing] = useState(false);
  const [instagramActiveSection, setInstagramActiveSection] = useState('connection');

  // Jobs state
  const [activeJobs, setActiveJobs] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);

  // Product selection
  const [selectedProducts, setSelectedProducts] = useState([]);

  useEffect(() => {
    loadConfigurations();
    loadActiveJobs();
    loadInstagramStatus();

    // Check for Instagram OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');

    if (success === 'connected') {
      setFlashMessage({ type: 'success', message: 'Connected to Instagram Shopping!' });
      setActiveTab('instagram');
      window.history.replaceState({}, document.title, window.location.pathname);
      loadInstagramStatus();
    } else if (error) {
      setFlashMessage({ type: 'error', message: `Connection failed: ${error}` });
      setActiveTab('instagram');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');

      // Load Amazon config
      const amazonRes = await fetch(`/api/amazon/config?store_id=${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const amazonData = await amazonRes.json();
      if (amazonData.configured) {
        setAmazonConfigured(true);
        setAmazonSettings(amazonData.config.export_settings || amazonSettings);
      }

      // Load eBay config
      const ebayRes = await fetch(`/api/ebay/config?store_id=${storeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const ebayData = await ebayRes.json();
      if (ebayData.configured) {
        setEbayConfigured(true);
        setEbaySettings(ebayData.config.export_settings || ebaySettings);
      }

      // Check Shopify status (from existing integration)
      // This would check if Shopify OAuth is already connected
      setShopifyConfigured(true); // Assuming already connected

      // Note: Instagram status is loaded separately via loadInstagramStatus()

    } catch (error) {
      console.error('Failed to load configurations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadActiveJobs = async () => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');
      const res = await fetch(`/api/background-jobs/store/${storeId}?status=running`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActiveJobs(data.jobs.filter(j => j.status === 'running' || j.status === 'pending'));
        setRecentJobs(data.jobs.filter(j => j.status === 'completed' || j.status === 'failed').slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  };

  // Instagram functions
  const loadInstagramStatus = async () => {
    try {
      const [statusRes, configRes] = await Promise.all([
        MetaCommerce.getStatus(),
        MetaCommerce.getConfig()
      ]);
      setInstagramStatus(statusRes);
      if (configRes.configured && configRes.config) {
        setInstagramConfig(configRes.config);
        setInstagramSettings({
          defaultBrand: configRes.config.defaultBrand || '',
          storeDomain: configRes.config.storeDomain || '',
          currency: configRes.config.currency || 'USD'
        });
      }
      if (statusRes.connected) {
        loadInstagramBusinesses();
        loadInstagramErrors();
      }
      setInstagramConfigured(statusRes?.connected || false);
    } catch (error) {
      console.error('Failed to load Instagram status:', error);
    }
  };

  const loadInstagramBusinesses = async () => {
    try {
      const result = await MetaCommerce.getBusinesses();
      setInstagramBusinesses(result.businesses || []);
    } catch (error) {
      console.error('Failed to load businesses:', error);
    }
  };

  const loadInstagramCatalogs = async () => {
    try {
      const result = await MetaCommerce.getCatalogs();
      setInstagramCatalogs(result.catalogs || []);
    } catch (error) {
      console.error('Failed to load catalogs:', error);
    }
  };

  const loadInstagramErrors = async () => {
    try {
      const result = await MetaCommerce.getProductErrors();
      setInstagramErrors(result.errors || []);
    } catch (error) {
      console.error('Failed to load errors:', error);
    }
  };

  const handleInstagramConnect = async () => {
    try {
      const result = await MetaCommerce.getAuthUrl();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to initiate connection' });
    }
  };

  const handleInstagramDisconnect = async () => {
    if (!confirm('Disconnect Instagram Shopping?')) return;
    try {
      await MetaCommerce.disconnect();
      setInstagramStatus({ connected: false });
      setInstagramConfig(null);
      setInstagramConfigured(false);
      setFlashMessage({ type: 'success', message: 'Disconnected from Instagram Shopping' });
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to disconnect' });
    }
  };

  const handleInstagramSelectBusiness = async (businessId) => {
    const business = instagramBusinesses.find(b => b.id === businessId);
    try {
      await MetaCommerce.selectBusiness(businessId, business?.name);
      setInstagramConfig(prev => ({ ...prev, businessId, businessName: business?.name, catalogId: null }));
      loadInstagramCatalogs();
      setFlashMessage({ type: 'success', message: 'Business selected' });
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to select business' });
    }
  };

  const handleInstagramSelectCatalog = async (catalogId) => {
    const catalog = instagramCatalogs.find(c => c.id === catalogId);
    try {
      await MetaCommerce.selectCatalog(catalogId, catalog?.name);
      setInstagramConfig(prev => ({ ...prev, catalogId, catalogName: catalog?.name }));
      loadInstagramStatus();
      setFlashMessage({ type: 'success', message: 'Catalog selected' });
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to select catalog' });
    }
  };

  const handleInstagramSaveSettings = async () => {
    try {
      await MetaCommerce.saveConfig(instagramSettings);
      setFlashMessage({ type: 'success', message: 'Settings saved' });
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to save settings' });
    }
  };

  const handleInstagramSync = async () => {
    setInstagramSyncing(true);
    try {
      const result = await MetaCommerce.scheduleSyncJob({});
      setFlashMessage({ type: 'success', message: `Sync started (Job ID: ${result.jobId})` });
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to start sync' });
    } finally {
      setInstagramSyncing(false);
    }
  };

  const saveAmazonConfig = async () => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');
      const res = await fetch('/api/amazon/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: storeId,
          credentials: amazonConfig,
          marketplace_id: amazonConfig.marketplace_id,
          region: amazonConfig.region,
          export_settings: amazonSettings
        })
      });

      const data = await res.json();
      if (data.success) {
        setAmazonConfigured(true);
        setFlashMessage({ type: 'success', message: 'Amazon configuration saved successfully!' });
      } else {
        setFlashMessage({ type: 'error', message: data.message || 'Failed to save configuration' });
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to save Amazon configuration' });
    }
  };

  const saveEbayConfig = async () => {
    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');
      const res = await fetch('/api/ebay/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: storeId,
          credentials: ebayConfig,
          export_settings: ebaySettings
        })
      });

      const data = await res.json();
      if (data.success) {
        setEbayConfigured(true);
        setFlashMessage({ type: 'success', message: 'eBay configuration saved successfully!' });
      } else {
        setFlashMessage({ type: 'error', message: data.message || 'Failed to save configuration' });
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to save eBay configuration' });
    }
  };

  const exportToAmazon = async () => {
    if (selectedProducts.length === 0) {
      setFlashMessage({ type: 'warning', message: 'Please select products to export' });
      return;
    }

    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');
      const res = await fetch('/api/amazon/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: storeId,
          product_ids: selectedProducts,
          options: {
            useAIOptimization: amazonSettings.use_ai_optimization,
            autoTranslate: amazonSettings.auto_translate
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setFlashMessage({
          type: 'success',
          message: `Amazon export job scheduled! Job ID: ${data.jobId}.`
        });
        loadActiveJobs(); // Refresh jobs list
      } else {
        setFlashMessage({ type: 'error', message: data.message || 'Export failed' });
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to start Amazon export' });
    }
  };

  const exportToEbay = async () => {
    if (selectedProducts.length === 0) {
      setFlashMessage({ type: 'warning', message: 'Please select products to export' });
      return;
    }

    try {
      const token = localStorage.getItem('store_owner_auth_token') || localStorage.getItem('token');
      const storeId = localStorage.getItem('selectedStoreId');
      const res = await fetch('/api/ebay/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: storeId,
          product_ids: selectedProducts,
          options: {
            useAIOptimization: ebaySettings.use_ai_optimization,
            listingFormat: ebaySettings.listing_format,
            listingDuration: ebaySettings.listing_duration
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setFlashMessage({
          type: 'success',
          message: `eBay export job scheduled! Job ID: ${data.jobId}`
        });
        loadActiveJobs();
      } else {
        setFlashMessage({ type: 'error', message: data.message || 'Export failed' });
      }
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to start eBay export' });
    }
  };

  const getJobStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (configured) => {
    if (configured) {
      return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
    }
    return <Badge variant="outline" className="text-gray-500"><AlertCircle className="w-3 h-3 mr-1" />Not Configured</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Hub</h1>
          <p className="text-gray-600 mt-1">Manage all your marketplace integrations in one place</p>
        </div>
        <Button
          variant="outline"
          onClick={loadActiveJobs}
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-500" />
                Amazon
              </CardTitle>
              {getStatusBadge(amazonConfigured)}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">
              {amazonConfigured ? 'Ready to export products' : 'Configure credentials to get started'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                eBay
              </CardTitle>
              {getStatusBadge(ebayConfigured)}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">
              {ebayConfigured ? 'Ready to create listings' : 'Configure credentials to get started'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Shopify
              </CardTitle>
              {getStatusBadge(shopifyConfigured)}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">
              {shopifyConfigured ? 'Import products from Shopify' : 'Connect your Shopify store'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-pink-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Instagram className="w-5 h-5 text-pink-500" />
                Instagram
              </CardTitle>
              {getStatusBadge(instagramConfigured)}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-600">
              {instagramConfigured ? 'Sync products to Instagram Shop' : 'Connect Meta Business account'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              Active Jobs ({activeJobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeJobs.map((job) => (
              <div key={job.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getJobStatusIcon(job.status)}
                    <span className="font-medium">{job.type}</span>
                  </div>
                  <Badge variant="outline">Job #{job.id}</Badge>
                </div>
                {job.progress !== null && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{job.progress_message || 'Processing...'}</span>
                      <span className="font-medium">{job.progress}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="amazon">Amazon</TabsTrigger>
          <TabsTrigger value="ebay">eBay</TabsTrigger>
          <TabsTrigger value="shopify">Shopify</TabsTrigger>
          <TabsTrigger value="instagram">Instagram</TabsTrigger>
        </TabsList>

        {/* Amazon Tab */}
        <TabsContent value="amazon" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-6 h-6 text-orange-500" />
                    Amazon Export
                  </CardTitle>
                  <CardDescription>Export products to Amazon with AI optimization</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configure
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Configuration Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amazon_seller_id">Seller ID</Label>
                    <Input
                      id="amazon_seller_id"
                      value={amazonConfig.seller_id}
                      onChange={(e) => setAmazonConfig({...amazonConfig, seller_id: e.target.value})}
                      placeholder="A1234567890"
                    />
                  </div>
                  <div>
                    <Label htmlFor="amazon_marketplace">Marketplace</Label>
                    <Input
                      id="amazon_marketplace"
                      value={amazonConfig.marketplace_id}
                      onChange={(e) => setAmazonConfig({...amazonConfig, marketplace_id: e.target.value})}
                      placeholder="ATVPDKIKX0DER"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="amazon_mws_token">MWS Auth Token</Label>
                    <div className="flex gap-2">
                      <Input
                        id="amazon_mws_token"
                        type={showAmazonSecrets.mws ? 'text' : 'password'}
                        value={amazonConfig.mws_auth_token}
                        onChange={(e) => setAmazonConfig({...amazonConfig, mws_auth_token: e.target.value})}
                        placeholder="amzn.mws.token..."
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setShowAmazonSecrets({...showAmazonSecrets, mws: !showAmazonSecrets.mws})}
                      >
                        {showAmazonSecrets.mws ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="amazon_access_key">AWS Access Key ID</Label>
                    <Input
                      id="amazon_access_key"
                      type={showAmazonSecrets.access ? 'text' : 'password'}
                      value={amazonConfig.aws_access_key_id}
                      onChange={(e) => setAmazonConfig({...amazonConfig, aws_access_key_id: e.target.value})}
                      placeholder="AKIA..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="amazon_secret_key">AWS Secret Access Key</Label>
                    <Input
                      id="amazon_secret_key"
                      type={showAmazonSecrets.secret ? 'text' : 'password'}
                      value={amazonConfig.aws_secret_access_key}
                      onChange={(e) => setAmazonConfig({...amazonConfig, aws_secret_access_key: e.target.value})}
                      placeholder="Secret key..."
                    />
                  </div>
                </div>
                <SaveButton onClick={saveAmazonConfig} label="Save Configuration" />
              </div>

              {/* AI Optimization Settings */}
              {amazonConfigured && (
                <>
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      AI Optimization
                    </h3>
                    <Alert>
                      <Sparkles className="w-4 h-4" />
                      <AlertDescription>
                        AI-powered features automatically optimize your product listings for better visibility and conversion rates.
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Optimize Titles & Descriptions</Label>
                          <p className="text-sm text-gray-600">AI enhances product titles and descriptions for SEO</p>
                        </div>
                        <Switch
                          checked={amazonSettings.use_ai_optimization}
                          onCheckedChange={(checked) => setAmazonSettings({...amazonSettings, use_ai_optimization: checked})}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Auto-translate</Label>
                          <p className="text-sm text-gray-600">Translate products to marketplace language</p>
                        </div>
                        <Switch
                          checked={amazonSettings.auto_translate}
                          onCheckedChange={(checked) => setAmazonSettings({...amazonSettings, auto_translate: checked})}
                        />
                      </div>
                      <div>
                        <Label>Price Adjustment (%)</Label>
                        <Input
                          type="number"
                          value={amazonSettings.price_adjustment_percent}
                          onChange={(e) => setAmazonSettings({...amazonSettings, price_adjustment_percent: parseFloat(e.target.value)})}
                          placeholder="0"
                          className="w-32"
                        />
                        <p className="text-sm text-gray-600 mt-1">Adjust prices by percentage (e.g., +10 for 10% markup)</p>
                      </div>
                    </div>
                  </div>

                  {/* Export Actions */}
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="font-semibold text-lg">Export Products</h3>
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        Select products from your catalog to export to Amazon. The export job will run in the background.
                      </AlertDescription>
                    </Alert>
                    <div className="flex gap-3">
                      <Button onClick={exportToAmazon} className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Export Selected Products
                      </Button>
                      <Button variant="outline" onClick={() => window.location.href = '/admin/products'}>
                        <Package className="w-4 h-4 mr-2" />
                        Select Products
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* eBay Tab */}
        <TabsContent value="ebay" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-6 h-6 text-blue-500" />
                    eBay Export
                  </CardTitle>
                  <CardDescription>Create eBay listings with AI-enhanced descriptions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Configuration */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ebay_app_id">App ID (Client ID)</Label>
                    <Input
                      id="ebay_app_id"
                      value={ebayConfig.app_id}
                      onChange={(e) => setEbayConfig({...ebayConfig, app_id: e.target.value})}
                      placeholder="Your eBay App ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ebay_cert_id">Cert ID (Client Secret)</Label>
                    <Input
                      id="ebay_cert_id"
                      type="password"
                      value={ebayConfig.cert_id}
                      onChange={(e) => setEbayConfig({...ebayConfig, cert_id: e.target.value})}
                      placeholder="Your Cert ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ebay_dev_id">Dev ID</Label>
                    <Input
                      id="ebay_dev_id"
                      value={ebayConfig.dev_id}
                      onChange={(e) => setEbayConfig({...ebayConfig, dev_id: e.target.value})}
                      placeholder="Your Dev ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ebay_auth_token">Auth Token</Label>
                    <Input
                      id="ebay_auth_token"
                      type="password"
                      value={ebayConfig.auth_token}
                      onChange={(e) => setEbayConfig({...ebayConfig, auth_token: e.target.value})}
                      placeholder="Your Auth Token"
                    />
                  </div>
                </div>
                <SaveButton onClick={saveEbayConfig} label="Save Configuration" />
              </div>

              {/* Settings */}
              {ebayConfigured && (
                <>
                  <div className="border-t pt-6 space-y-4">
                    <h3 className="font-semibold text-lg">Listing Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>AI Optimization</Label>
                          <p className="text-sm text-gray-600">Enhance listings with AI</p>
                        </div>
                        <Switch
                          checked={ebaySettings.use_ai_optimization}
                          onCheckedChange={(checked) => setEbaySettings({...ebaySettings, use_ai_optimization: checked})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Export */}
                  <div className="border-t pt-6 space-y-4">
                    <div className="flex gap-3">
                      <Button onClick={exportToEbay} className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Create eBay Listings
                      </Button>
                      <Button variant="outline" onClick={() => window.location.href = '/admin/products'}>
                        <Package className="w-4 h-4 mr-2" />
                        Select Products
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shopify Tab */}
        <TabsContent value="shopify" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-green-500" />
                Shopify Import
              </CardTitle>
              <CardDescription>Import products and collections from Shopify</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Shopify integration is managed separately. Visit the Shopify Integration page to configure and import.
                </AlertDescription>
              </Alert>
              <div className="mt-4">
                <Button variant="outline" onClick={() => window.location.href = '/admin/shopify-integration'}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Go to Shopify Integration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instagram Tab - Full Integration */}
        <TabsContent value="instagram" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Instagram className="w-6 h-6 text-pink-500" />
                    Instagram Shopping
                  </CardTitle>
                  <CardDescription>Sync products to Instagram Shop via Meta Commerce Manager</CardDescription>
                </div>
                {instagramStatus?.connected && (
                  <Badge className="bg-green-500 text-white">Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Section Navigation */}
              <div className="flex gap-2 mb-6 border-b pb-4">
                {['connection', 'catalog', 'settings', 'sync', 'errors'].map((section) => (
                  <Button
                    key={section}
                    variant={instagramActiveSection === section ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setInstagramActiveSection(section)}
                    disabled={section !== 'connection' && !instagramStatus?.connected}
                  >
                    {section.charAt(0).toUpperCase() + section.slice(1)}
                  </Button>
                ))}
              </div>

              {/* Connection Section */}
              {instagramActiveSection === 'connection' && (
                <>
                  {!instagramStatus?.connected ? (
                    <div className="text-center py-8">
                      <Instagram className="w-16 h-16 mx-auto mb-4 text-pink-600" />
                      <p className="text-gray-600 mb-6">
                        Connect your Meta Business account to sync products to Instagram Shopping.
                      </p>
                      <Button onClick={handleInstagramConnect} size="lg">
                        <Link2 className="w-4 h-4 mr-2" />
                        Connect with Facebook
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-6 h-6 text-green-600" />
                          <div>
                            <p className="font-medium">Connected to Meta Commerce</p>
                            <p className="text-sm text-gray-600">
                              {instagramStatus.businessName || 'No business selected'}
                              {instagramStatus.catalogName && ` | ${instagramStatus.catalogName}`}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" onClick={handleInstagramDisconnect}>
                          Disconnect
                        </Button>
                      </div>
                      {instagramStatus.lastSyncAt && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm">
                            <span className="font-medium">Last sync:</span>{' '}
                            {new Date(instagramStatus.lastSyncAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Catalog Section */}
              {instagramActiveSection === 'catalog' && instagramStatus?.connected && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Business Account</Label>
                    <select
                      className="w-full p-2 border rounded-md bg-white"
                      value={instagramConfig?.businessId || ''}
                      onChange={(e) => handleInstagramSelectBusiness(e.target.value)}
                    >
                      <option value="">Select a business...</option>
                      {instagramBusinesses.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  {instagramConfig?.businessId && (
                    <div className="space-y-2">
                      <Label>Product Catalog</Label>
                      <select
                        className="w-full p-2 border rounded-md bg-white"
                        value={instagramConfig?.catalogId || ''}
                        onChange={(e) => handleInstagramSelectCatalog(e.target.value)}
                      >
                        <option value="">Select a catalog...</option>
                        {instagramCatalogs.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <p className="text-sm text-gray-600">
                        Select an existing catalog or create one in Meta Commerce Manager
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Settings Section */}
              {instagramActiveSection === 'settings' && instagramStatus?.connected && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="ig_storeDomain">Store Domain</Label>
                    <Input
                      id="ig_storeDomain"
                      placeholder="yourstore.com"
                      value={instagramSettings.storeDomain}
                      onChange={(e) => setInstagramSettings(prev => ({ ...prev, storeDomain: e.target.value }))}
                    />
                    <p className="text-sm text-gray-600">Your store's domain for product URLs</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ig_defaultBrand">Default Brand</Label>
                    <Input
                      id="ig_defaultBrand"
                      placeholder="Your Brand Name"
                      value={instagramSettings.defaultBrand}
                      onChange={(e) => setInstagramSettings(prev => ({ ...prev, defaultBrand: e.target.value }))}
                    />
                    <p className="text-sm text-gray-600">Brand name for products without a brand attribute</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ig_currency">Currency</Label>
                    <select
                      id="ig_currency"
                      className="w-full p-2 border rounded-md bg-white"
                      value={instagramSettings.currency}
                      onChange={(e) => setInstagramSettings(prev => ({ ...prev, currency: e.target.value }))}
                    >
                      <option value="USD">USD - US Dollar</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="GBP">GBP - British Pound</option>
                      <option value="CAD">CAD - Canadian Dollar</option>
                      <option value="AUD">AUD - Australian Dollar</option>
                    </select>
                  </div>
                  <Button onClick={handleInstagramSaveSettings}>Save Settings</Button>
                </div>
              )}

              {/* Sync Section */}
              {instagramActiveSection === 'sync' && instagramStatus?.connected && (
                <div className="space-y-6">
                  {!instagramConfig?.catalogId ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please select a catalog in the Catalog tab before syncing products.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <Alert>
                        <Package className="h-4 w-4" />
                        <AlertDescription>
                          Products need SKU, title, price, and 500x500+ image to sync successfully.
                        </AlertDescription>
                      </Alert>
                      <Button onClick={handleInstagramSync} disabled={instagramSyncing} size="lg">
                        {instagramSyncing ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                        ) : (
                          <><RefreshCw className="w-4 h-4 mr-2" /> Sync All Products</>
                        )}
                      </Button>
                      {instagramStatus?.lastSyncAt && (
                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                          <p className="font-medium">Last Sync</p>
                          <p className="text-sm text-gray-600">
                            {new Date(instagramStatus.lastSyncAt).toLocaleString()}
                          </p>
                          {instagramStatus.syncStatus && (
                            <Badge variant={
                              instagramStatus.syncStatus === 'success' ? 'default' :
                              instagramStatus.syncStatus === 'error' ? 'destructive' : 'secondary'
                            }>
                              {instagramStatus.syncStatus}
                            </Badge>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Errors Section */}
              {instagramActiveSection === 'errors' && instagramStatus?.connected && (
                <div className="space-y-4">
                  {!instagramConfig?.catalogId ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please select a catalog in the Catalog tab first.
                      </AlertDescription>
                    </Alert>
                  ) : instagramErrors.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
                      <p className="text-gray-600">No errors. All products synced successfully.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-gray-600">
                          {instagramErrors.length} product(s) with errors
                        </p>
                        <Button variant="outline" size="sm" onClick={loadInstagramErrors}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh
                        </Button>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium">SKU</th>
                              <th className="px-4 py-2 text-left font-medium">Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {instagramErrors.map((err, i) => (
                              <tr key={i} className="border-t">
                                <td className="px-4 py-2 font-mono">{err.retailerId}</td>
                                <td className="px-4 py-2 text-red-600">{err.errorMessage}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Jobs History */}
      {recentJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    {getJobStatusIcon(job.status)}
                    <div>
                      <p className="font-medium text-sm">{job.type}</p>
                      <p className="text-xs text-gray-600">
                        {new Date(job.updated_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={job.status === 'completed' ? 'default' : 'destructive'}>
                    {job.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MarketplaceHub;
