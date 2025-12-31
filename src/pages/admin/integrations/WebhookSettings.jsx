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
  Webhook,
  Settings,
  Plus,
  Edit,
  Trash2,
  PlayCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ExternalLink,
  History,
  Info,
  Copy,
  Check
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
  getWebhookStats,
  EVENT_TYPES
} from '@/api/webhook-integrations';

// Provider configurations
const PROVIDER_CONFIG = {
  n8n: {
    name: 'n8n',
    description: 'Self-hosted workflow automation',
    urlPlaceholder: 'https://your-n8n-instance.com/webhook/...',
    docsUrl: 'https://docs.n8n.io/integrations/builtin/trigger-nodes/n8n-nodes-base.webhook/',
    color: 'from-red-500 to-orange-500',
    icon: 'N8N',
    features: [
      'Self-hosted automation',
      'Visual workflow editor',
      'Custom nodes & integrations',
      'Full data control'
    ]
  },
  zapier: {
    name: 'Zapier',
    description: 'No-code automation platform',
    urlPlaceholder: 'https://hooks.zapier.com/hooks/catch/...',
    docsUrl: 'https://zapier.com/help/create/code-webhooks/trigger-zaps-from-webhooks',
    color: 'from-orange-500 to-amber-500',
    icon: 'ZAP',
    features: [
      '5000+ app integrations',
      'No-code automation',
      'Pre-built templates',
      'Cloud-based reliability'
    ]
  },
  make: {
    name: 'Make',
    description: 'Visual workflow builder',
    urlPlaceholder: 'https://hook.make.com/...',
    docsUrl: 'https://www.make.com/en/help/tools/webhooks',
    color: 'from-purple-500 to-indigo-500',
    icon: 'MAKE',
    features: [
      'Visual scenario builder',
      'Complex logic support',
      'Data transformations',
      'Error handling'
    ]
  }
};

// Event type labels for display
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

export default function WebhookSettings({ provider }) {
  const { selectedStore } = useStoreSelection();
  const config = PROVIDER_CONFIG[provider];

  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('webhooks');

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
    name: '',
    webhookUrl: '',
    eventTypes: [],
    isActive: true,
    customHeaders: {}
  });

  // Load webhooks
  const loadWebhooks = useCallback(async () => {
    if (!selectedStore) return;

    try {
      setLoading(true);
      const response = await getWebhooks(provider);
      setWebhooks(response.data?.webhooks || []);
    } catch (error) {
      console.error('Error loading webhooks:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load webhooks' });
    } finally {
      setLoading(false);
    }
  }, [selectedStore, provider]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!selectedStore) return;

    try {
      const response = await getWebhookStats(provider);
      setStats(response.data?.stats || null);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [selectedStore, provider]);

  useEffect(() => {
    if (selectedStore) {
      loadWebhooks();
      loadStats();
    }
  }, [selectedStore, loadWebhooks, loadStats]);

  // Handle form open for create/edit
  const handleOpenForm = (webhook = null) => {
    if (webhook) {
      setForm({
        name: webhook.name || '',
        webhookUrl: webhook.webhookUrl || '',
        eventTypes: webhook.eventTypes || [],
        isActive: webhook.isActive !== false,
        customHeaders: webhook.customHeaders || {}
      });
      setSelectedWebhook(webhook);
    } else {
      setForm({
        name: '',
        webhookUrl: '',
        eventTypes: [],
        isActive: true,
        customHeaders: {}
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
      if (selectedWebhook) {
        await updateWebhook(provider, selectedWebhook.id, form);
        setFlashMessage({ type: 'success', message: 'Webhook updated successfully' });
      } else {
        await createWebhook(provider, form);
        setFlashMessage({ type: 'success', message: 'Webhook created successfully' });
      }
      setIsFormOpen(false);
      loadWebhooks();
      loadStats();
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
      await deleteWebhook(provider, selectedWebhook.id);
      setFlashMessage({ type: 'success', message: 'Webhook deleted successfully' });
      setIsDeleteOpen(false);
      setSelectedWebhook(null);
      loadWebhooks();
      loadStats();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      setFlashMessage({ type: 'error', message: 'Failed to delete webhook' });
    } finally {
      setDeleting(false);
    }
  };

  // Handle test
  const handleTest = async (webhookId) => {
    setTesting(webhookId);
    try {
      const response = await testWebhook(provider, webhookId);
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
      const response = await getWebhookLogs(provider, webhook.id, { limit: 50 });
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

  // Select all events
  const selectAllEvents = () => {
    setForm(prev => ({
      ...prev,
      eventTypes: [...EVENT_TYPES]
    }));
  };

  // Clear all events
  const clearAllEvents = () => {
    setForm(prev => ({
      ...prev,
      eventTypes: []
    }));
  };

  // Copy webhook URL
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
          <div className={`w-10 h-10 bg-gradient-to-r ${config.color} rounded-lg flex items-center justify-center`}>
            <Webhook className="w-5 h-5 text-white" />
          </div>
          {config.name} Integration
        </h1>
        <p className="text-gray-600 mt-1">
          {config.description} - Send real-time event data to your workflows
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalWebhooks || 0}</div>
                <div className="text-sm text-gray-600">Total Webhooks</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.activeWebhooks || 0}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.totalDeliveries || 0}</div>
                <div className="text-sm text-gray-600">Total Deliveries</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.totalDeliveries > 0
                    ? `${Math.round((stats.successfulDeliveries || 0) / stats.totalDeliveries * 100)}%`
                    : 'N/A'
                  }
                </div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
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
                    Manage your {config.name} webhook endpoints
                  </CardDescription>
                </div>
                <Button onClick={() => handleOpenForm()} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Webhook
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {webhooks.length === 0 ? (
                <div className="text-center py-12">
                  <Webhook className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No webhooks configured</h3>
                  <p className="text-gray-600 mb-4">
                    Add your first {config.name} webhook to start receiving events
                  </p>
                  <Button onClick={() => handleOpenForm()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Webhook
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {webhooks.map((webhook) => (
                    <Card key={webhook.id} className="border">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
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
                              {(webhook.eventTypes || []).map((event) => (
                                <Badge key={event} variant="outline" className="text-xs">
                                  {EVENT_LABELS[event] || event}
                                </Badge>
                              ))}
                            </div>

                            <div className="text-xs text-gray-400">
                              Created: {new Date(webhook.createdAt).toLocaleDateString()}
                              {webhook.lastDeliveryAt && (
                                <> | Last delivery: {new Date(webhook.lastDeliveryAt).toLocaleString()}</>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTest(webhook.id)}
                              disabled={testing === webhook.id}
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
                            >
                              <History className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenForm(webhook)}
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
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                How to Set Up {config.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Features</h3>
                  <ul className="space-y-2">
                    {config.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Supported Events</h3>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_TYPES.map((event) => (
                      <Badge key={event} variant="outline">
                        {EVENT_LABELS[event] || event}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Quick Start:</strong> Create a webhook trigger in {config.name},
                  copy the webhook URL, and add it here. Events will be sent in real-time as they occur.
                </AlertDescription>
              </Alert>

              <div className="flex gap-4">
                <a
                  href={config.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                >
                  View {config.name} Documentation
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Example Payload</h4>
                <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto">
{`{
  "event": "order_placed",
  "provider": "${provider}",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "store_id": "your-store-id",
  "store_name": "My Store",
  "event_id": "evt_xxx",
  "data": {
    "order_id": "ord_123",
    "customer_email": "customer@example.com",
    "total_amount": 99.99,
    "currency": "USD",
    "items": [...]
  }
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
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
              Configure your {config.name} webhook endpoint
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
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
                placeholder={config.urlPlaceholder}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Events to Send *</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllEvents}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={clearAllEvents}
                    className="text-xs text-gray-600 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded">
                {EVENT_TYPES.map((event) => (
                  <label
                    key={event}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
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
                          <span className="text-xs text-gray-500">
                            HTTP {log.response_status}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Attempts: {log.attempts || 1}
                    </div>
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
