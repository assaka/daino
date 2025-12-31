import React, { useState, useEffect, useCallback } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import NoStoreSelected from '@/components/admin/NoStoreSelected';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Webhook,
  Plus,
  Edit,
  Trash2,
  PlayCircle,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  History,
  Info,
  Copy,
  Check,
  Filter,
  X
} from 'lucide-react';
import { PageLoader } from '@/components/ui/page-loader';
import FlashMessage from '@/components/storefront/FlashMessage';
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookLogs,
  EVENT_TYPES
} from '@/api/webhook-integrations';

// Provider configurations
const PROVIDERS = {
  n8n: {
    id: 'n8n',
    name: 'n8n',
    description: 'Self-hosted workflow automation',
    urlPlaceholder: 'https://your-n8n-instance.com/webhook/...',
    docsUrl: 'https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.webhook/',
    color: 'bg-amber-500',
    badgeColor: 'bg-amber-100 text-black border-amber-300',
    features: ['Self-hosted automation', 'Visual workflow editor', 'Custom nodes', 'Full data control']
  },
  zapier: {
    id: 'zapier',
    name: 'Zapier',
    description: 'No-code automation platform',
    urlPlaceholder: 'https://hooks.zapier.com/hooks/catch/...',
    docsUrl: 'https://zapier.com/help/create/code-webhooks/trigger-zaps-from-webhooks',
    color: 'bg-amber-500',
    badgeColor: 'bg-amber-100 text-black border-amber-300',
    features: ['5000+ app integrations', 'No-code automation', 'Pre-built templates', 'Cloud-based']
  },
  make: {
    id: 'make',
    name: 'Make',
    description: 'Visual workflow builder',
    urlPlaceholder: 'https://hook.make.com/...',
    docsUrl: 'https://www.make.com/en/help/tools/webhooks',
    color: 'bg-amber-500',
    badgeColor: 'bg-amber-100 text-black border-amber-300',
    features: ['Visual scenario builder', 'Complex logic support', 'Data transformations', 'Error handling']
  }
};

// Event type labels
const EVENT_LABELS = {
  page_view: 'Page View',
  product_view: 'Product View',
  add_to_cart: 'Add to Cart',
  remove_from_cart: 'Remove from Cart',
  checkout_started: 'Checkout Started',
  order_placed: 'Order Placed',
  customer_created: 'Customer Created',
  abandoned_cart: 'Abandoned Cart',
  search: 'Search'
};

// Authentication types
const AUTH_TYPES = {
  none: { id: 'none', name: 'None', description: 'No authentication' },
  api_key: { id: 'api_key', name: 'API Key', description: 'API key in custom header' },
  basic: { id: 'basic', name: 'Basic Auth', description: 'Username and password' },
  bearer: { id: 'bearer', name: 'Bearer Token', description: 'Bearer token in Authorization header' },
  hmac: { id: 'hmac', name: 'HMAC Signature', description: 'Sign payload with secret key' }
};

export default function WorkflowIntegrations() {
  const { selectedStore } = useStoreSelection();

  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState([]);
  const [flashMessage, setFlashMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('webhooks');

  // Filter state
  const [selectedProviders, setSelectedProviders] = useState(['n8n', 'zapier', 'make']);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Logs state
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({
    provider: 'n8n',
    name: '',
    webhookUrl: '',
    eventTypes: [],
    isActive: true,
    auth: {
      type: 'none',
      headerName: 'X-API-Key',
      apiKey: '',
      username: '',
      password: '',
      token: '',
      secret: '',
      algorithm: 'sha256',
      signatureHeader: 'X-Webhook-Signature'
    }
  });

  // Load webhooks from all providers
  const loadWebhooks = useCallback(async () => {
    if (!selectedStore) return;

    try {
      setLoading(true);
      const allWebhooks = [];

      for (const providerId of Object.keys(PROVIDERS)) {
        try {
          const response = await getWebhooks(providerId);
          const providerWebhooks = (response.data?.webhooks || []).map(w => ({
            ...w,
            provider: providerId
          }));
          allWebhooks.push(...providerWebhooks);
        } catch (error) {
          console.error(`Error loading ${providerId} webhooks:`, error);
        }
      }

      setWebhooks(allWebhooks);
    } catch (error) {
      console.error('Error loading webhooks:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load webhooks' });
    } finally {
      setLoading(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedStore) {
      loadWebhooks();
    }
  }, [selectedStore, loadWebhooks]);

  // Filter webhooks by selected providers
  const filteredWebhooks = webhooks.filter(w => selectedProviders.includes(w.provider));

  // Toggle provider filter
  const toggleProvider = (providerId) => {
    setSelectedProviders(prev => {
      if (prev.includes(providerId)) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter(p => p !== providerId);
      }
      return [...prev, providerId];
    });
  };

  // Default auth state
  const defaultAuth = {
    type: 'none',
    headerName: 'X-API-Key',
    apiKey: '',
    username: '',
    password: '',
    token: '',
    secret: '',
    algorithm: 'sha256',
    signatureHeader: 'X-Webhook-Signature'
  };

  // Handle form open for create/edit
  const handleOpenForm = (webhook = null) => {
    if (webhook) {
      setForm({
        provider: webhook.provider || 'n8n',
        name: webhook.name || '',
        webhookUrl: webhook.webhookUrl || '',
        eventTypes: webhook.eventTypes || [],
        isActive: webhook.isActive !== false,
        auth: { ...defaultAuth, type: webhook.authType || 'none' }
      });
      setSelectedWebhook(webhook);
    } else {
      setForm({
        provider: selectedProviders[0] || 'n8n',
        name: '',
        webhookUrl: '',
        eventTypes: [],
        isActive: true,
        auth: { ...defaultAuth }
      });
      setSelectedWebhook(null);
    }
    setIsFormOpen(true);
  };

  // Handle save webhook
  const handleSave = async (e) => {
    e.preventDefault();

    if (!form.webhookUrl.trim()) {
      setFlashMessage({ type: 'error', message: 'Webhook URL is required' });
      return;
    }

    if (form.eventTypes.length === 0) {
      setFlashMessage({ type: 'error', message: 'Select at least one event type' });
      return;
    }

    setSaving(true);
    try {
      const { provider, ...webhookData } = form;

      if (selectedWebhook) {
        await updateWebhook(selectedWebhook.provider, selectedWebhook.id, webhookData);
        setFlashMessage({ type: 'success', message: 'Webhook updated successfully' });
      } else {
        await createWebhook(provider, webhookData);
        setFlashMessage({ type: 'success', message: 'Webhook created successfully' });
      }
      setIsFormOpen(false);
      loadWebhooks();
    } catch (error) {
      console.error('Error saving webhook:', error);
      setFlashMessage({ type: 'error', message: error.message || 'Failed to save webhook' });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedWebhook) return;

    setDeleting(true);
    try {
      await deleteWebhook(selectedWebhook.provider, selectedWebhook.id);
      setFlashMessage({ type: 'success', message: 'Webhook deleted successfully' });
      setIsDeleteOpen(false);
      setSelectedWebhook(null);
      loadWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      setFlashMessage({ type: 'error', message: 'Failed to delete webhook' });
    } finally {
      setDeleting(false);
    }
  };

  // Handle test
  const handleTest = async (webhook) => {
    setTesting(webhook.id);
    try {
      const response = await testWebhook(webhook.provider, webhook.id);
      if (response.success) {
        setFlashMessage({ type: 'success', message: 'Test webhook sent successfully!' });
      } else {
        throw new Error(response.message || 'Test failed');
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      setFlashMessage({ type: 'error', message: error.message || 'Failed to send test webhook' });
    } finally {
      setTesting(null);
    }
  };

  // Handle view logs
  const handleViewLogs = async (webhook) => {
    setSelectedWebhook(webhook);
    setLogsLoading(true);
    setIsLogsOpen(true);

    try {
      const response = await getWebhookLogs(webhook.provider, webhook.id, { limit: 50 });
      setLogs(response.data?.logs || []);
    } catch (error) {
      console.error('Error loading logs:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load delivery logs' });
    } finally {
      setLogsLoading(false);
    }
  };

  // Toggle event type
  const toggleEventType = (eventType) => {
    setForm(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter(e => e !== eventType)
        : [...prev.eventTypes, eventType]
    }));
  };

  // Select/clear all events
  const selectAllEvents = () => setForm(prev => ({ ...prev, eventTypes: [...EVENT_TYPES] }));
  const clearAllEvents = () => setForm(prev => ({ ...prev, eventTypes: [] }));

  // Copy to clipboard
  const [copied, setCopied] = useState(null);
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Count webhooks per provider
  const getProviderCount = (providerId) => webhooks.filter(w => w.provider === providerId).length;

  if (loading) {
    return <PageLoader size="lg" />;
  }

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Webhook className="w-8 h-8 text-blue-600" />
          Workflow Integrations
        </h1>
        <p className="text-gray-600 mt-1">
          Connect your store to n8n, Zapier, and Make for workflow automation
        </p>
      </div>

      {/* Provider Filter Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-sm text-gray-500 flex items-center gap-1">
          <Filter className="w-4 h-4" />
          Filter:
        </span>
        {Object.values(PROVIDERS).map((provider) => {
          const isSelected = selectedProviders.includes(provider.id);
          const count = getProviderCount(provider.id);
          return (
            <button
              key={provider.id}
              onClick={() => toggleProvider(provider.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                isSelected
                  ? provider.badgeColor
                  : 'bg-gray-100 text-gray-500 border-gray-200 opacity-60 hover:opacity-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${provider.color}`} />
              {provider.name}
              {count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  isSelected ? 'bg-white/50' : 'bg-gray-200'
                }`}>
                  {count}
                </span>
              )}
              {isSelected && selectedProviders.length > 1 && (
                <X className="w-3 h-3 ml-0.5 opacity-60" />
              )}
            </button>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks ({filteredWebhooks.length})
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Setup Guide
          </TabsTrigger>
        </TabsList>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configured Webhooks</CardTitle>
                  <CardDescription>
                    Manage webhook endpoints for workflow automation
                  </CardDescription>
                </div>
                <Button onClick={() => handleOpenForm()} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredWebhooks.length === 0 ? (
                <div className="text-center py-12">
                  <Webhook className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No webhooks configured</h3>
                  <p className="text-gray-600 mb-4">
                    Add your first webhook to start receiving events
                  </p>
                  <Button onClick={() => handleOpenForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Webhook
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredWebhooks.map((webhook) => {
                    const provider = PROVIDERS[webhook.provider];
                    return (
                      <Card key={webhook.id} className="border">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline" className={provider.badgeColor}>
                                  <span className={`w-2 h-2 rounded-full ${provider.color} mr-1.5`} />
                                  {provider.name}
                                </Badge>
                                <h3 className="font-medium">{webhook.name || 'Unnamed Webhook'}</h3>
                                <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                                  {webhook.isActive ? (
                                    <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                                  ) : (
                                    <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                                  )}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                <code className="bg-gray-100 px-2 py-1 rounded text-xs max-w-md truncate">
                                  {webhook.webhookUrl}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(webhook.webhookUrl, webhook.id)}
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  {copied === webhook.id ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <Copy className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                {(webhook.eventTypes || []).slice(0, 4).map((event) => (
                                  <Badge key={event} variant="outline" className="text-xs">
                                    {EVENT_LABELS[event] || event}
                                  </Badge>
                                ))}
                                {(webhook.eventTypes || []).length > 4 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{webhook.eventTypes.length - 4} more
                                  </Badge>
                                )}
                              </div>

                              <div className="text-xs text-gray-400">
                                Created: {new Date(webhook.createdAt).toLocaleDateString()}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTest(webhook)}
                                disabled={testing === webhook.id}
                                title="Send test webhook"
                              >
                                {testing === webhook.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <PlayCircle className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewLogs(webhook)}
                                title="View logs"
                              >
                                <History className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenForm(webhook)}
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedWebhook(webhook);
                                  setIsDeleteOpen(true);
                                }}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {Object.values(PROVIDERS).map((provider) => (
              <Card key={provider.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${provider.color}`} />
                    {provider.name}
                  </CardTitle>
                  <CardDescription>{provider.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {provider.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    View Documentation
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Supported Events</CardTitle>
              <CardDescription>Events that can trigger your workflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((event) => (
                  <Badge key={event} variant="outline" className="text-sm py-1 px-3">
                    {EVENT_LABELS[event] || event}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Quick Start:</strong> Create a webhook trigger in your automation platform,
              copy the webhook URL, and add it here. Events will be sent in real-time.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedWebhook ? 'Edit Webhook' : 'Add Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure your webhook endpoint
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {!selectedWebhook && (
              <div>
                <Label htmlFor="provider">Platform *</Label>
                <Select
                  value={form.provider}
                  onValueChange={(value) => setForm(prev => ({ ...prev, provider: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(PROVIDERS).map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${provider.color}`} />
                          {provider.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Order Notifications"
              />
            </div>

            <div>
              <Label htmlFor="webhookUrl">Webhook URL *</Label>
              <Input
                id="webhookUrl"
                value={form.webhookUrl}
                onChange={(e) => setForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                placeholder={PROVIDERS[form.provider]?.urlPlaceholder || 'https://...'}
                required
              />
            </div>

            {/* Authentication Section */}
            <div className="space-y-3 p-3 border rounded bg-gray-50">
              <div>
                <Label htmlFor="authType">Authentication</Label>
                <Select
                  value={form.auth.type}
                  onValueChange={(value) => setForm(prev => ({
                    ...prev,
                    auth: { ...prev.auth, type: value }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select authentication type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AUTH_TYPES).map((authType) => (
                      <SelectItem key={authType.id} value={authType.id}>
                        <span className="flex flex-col">
                          <span>{authType.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  {AUTH_TYPES[form.auth.type]?.description}
                </p>
              </div>

              {/* API Key Auth Fields */}
              {form.auth.type === 'api_key' && (
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="headerName">Header Name</Label>
                    <Input
                      id="headerName"
                      value={form.auth.headerName}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        auth: { ...prev.auth, headerName: e.target.value }
                      }))}
                      placeholder="X-API-Key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="apiKey">API Key *</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={form.auth.apiKey}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        auth: { ...prev.auth, apiKey: e.target.value }
                      }))}
                      placeholder="Your API key"
                    />
                  </div>
                </div>
              )}

              {/* Basic Auth Fields */}
              {form.auth.type === 'basic' && (
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={form.auth.username}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        auth: { ...prev.auth, username: e.target.value }
                      }))}
                      placeholder="Username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.auth.password}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        auth: { ...prev.auth, password: e.target.value }
                      }))}
                      placeholder="Password"
                    />
                  </div>
                </div>
              )}

              {/* Bearer Token Field */}
              {form.auth.type === 'bearer' && (
                <div>
                  <Label htmlFor="token">Bearer Token *</Label>
                  <Input
                    id="token"
                    type="password"
                    value={form.auth.token}
                    onChange={(e) => setForm(prev => ({
                      ...prev,
                      auth: { ...prev.auth, token: e.target.value }
                    }))}
                    placeholder="Your bearer token"
                  />
                </div>
              )}

              {/* HMAC Signature Fields */}
              {form.auth.type === 'hmac' && (
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="secret">Secret Key *</Label>
                    <Input
                      id="secret"
                      type="password"
                      value={form.auth.secret}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        auth: { ...prev.auth, secret: e.target.value }
                      }))}
                      placeholder="HMAC secret key"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="algorithm">Algorithm</Label>
                      <Select
                        value={form.auth.algorithm}
                        onValueChange={(value) => setForm(prev => ({
                          ...prev,
                          auth: { ...prev.auth, algorithm: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sha256">SHA-256</SelectItem>
                          <SelectItem value="sha512">SHA-512</SelectItem>
                          <SelectItem value="sha1">SHA-1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="signatureHeader">Signature Header</Label>
                      <Input
                        id="signatureHeader"
                        value={form.auth.signatureHeader}
                        onChange={(e) => setForm(prev => ({
                          ...prev,
                          auth: { ...prev.auth, signatureHeader: e.target.value }
                        }))}
                        placeholder="X-Webhook-Signature"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Events to Send *</Label>
                <div className="flex gap-2">
                  <button type="button" onClick={selectAllEvents} className="text-xs text-blue-600 hover:underline">
                    Select All
                  </button>
                  <button type="button" onClick={clearAllEvents} className="text-xs text-gray-600 hover:underline">
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded">
                {EVENT_TYPES.map((event) => (
                  <label key={event} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <Checkbox
                      checked={form.eventTypes.includes(event)}
                      onCheckedChange={() => toggleEventType(event)}
                    />
                    <span className="text-sm">{EVENT_LABELS[event] || event}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <Label htmlFor="isActive" className="font-medium">Active</Label>
                <p className="text-xs text-gray-500">Enable or disable this webhook</p>
              </div>
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, isActive: checked }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  selectedWebhook ? 'Update Webhook' : 'Create Webhook'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this webhook? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Delivery Logs
            </DialogTitle>
            <DialogDescription>
              {selectedWebhook?.name || 'Webhook'} delivery history
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No delivery logs yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded border ${
                      log.delivery_status === 'success'
                        ? 'bg-green-50 border-green-200'
                        : log.delivery_status === 'failed'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {log.delivery_status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : log.delivery_status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-600" />
                        )}
                        <Badge variant="outline">{log.event_type}</Badge>
                        {log.response_status && (
                          <span className="text-xs text-gray-500">HTTP {log.response_status}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
