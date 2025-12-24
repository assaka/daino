import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import NoStoreSelected from '@/components/admin/NoStoreSelected';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Plug, Check, X, RefreshCw, Settings, ExternalLink,
  Loader2, AlertCircle, CheckCircle
} from 'lucide-react';
import { useAlertTypes } from '@/hooks/useAlert';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';

const INTEGRATIONS = {
  klaviyo: {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'Advanced email marketing and SMS automation platform',
    logo: '/integrations/klaviyo.svg',
    logoFallback: '🎯',
    color: 'from-black to-gray-800',
    features: [
      'Advanced Segmentation',
      'Predictive Analytics',
      'SMS Marketing',
      'Product Recommendations'
    ],
    docsUrl: 'https://developers.klaviyo.com/',
    available: true
  },
  mailchimp: {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Popular all-in-one marketing platform',
    logo: '/integrations/mailchimp.svg',
    logoFallback: '🐵',
    color: 'from-yellow-400 to-yellow-500',
    features: [
      'Email Campaigns',
      'Marketing Automation',
      'Landing Pages',
      'Audience Management'
    ],
    docsUrl: 'https://mailchimp.com/developer/',
    available: true
  },
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Complete CRM and marketing automation suite',
    logo: '/integrations/hubspot.svg',
    logoFallback: '🟠',
    color: 'from-orange-500 to-orange-600',
    features: [
      'CRM Integration',
      'Marketing Hub',
      'Sales Pipeline',
      'Customer Service'
    ],
    docsUrl: 'https://developers.hubspot.com/',
    available: true
  }
};

export default function Integrations() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const { showError, showConfirm, AlertComponent } = useAlertTypes();
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({});
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  const [configForm, setConfigForm] = useState({
    apiKey: '',
    apiSecret: '',
    listId: '',
    enabled: true
  });

  useEffect(() => {
    if (selectedStore) {
      loadConnectionStatus();
    }
  }, [selectedStore]);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('store_owner_auth_token')}`
  });

  const loadConnectionStatus = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Load connection status for each integration
      const statuses = {};

      for (const integrationId of Object.keys(INTEGRATIONS)) {
        try {
          const response = await fetch(
            `/api/integrations/${integrationId}/status?store_id=${storeId}`,
            { headers: getAuthHeaders() }
          );

          if (response.ok) {
            const data = await response.json();
            statuses[integrationId] = data;
          } else {
            statuses[integrationId] = { connected: false };
          }
        } catch (error) {
          statuses[integrationId] = { connected: false };
        }
      }

      setConnectionStatus(statuses);
    } catch (error) {
      console.error('Error loading integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigure = (integration) => {
    setSelectedIntegration(integration);
    const status = connectionStatus[integration.id] || {};
    setConfigForm({
      apiKey: status.apiKey || '',
      apiSecret: '',
      listId: status.listId || '',
      enabled: status.enabled !== false
    });
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();

    if (!configForm.apiKey.trim()) {
      showError('API Key is required');
      return;
    }

    setSaving(true);
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(
        `/api/integrations/${selectedIntegration.id}/configure?store_id=${storeId}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(configForm)
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(prev => ({
          ...prev,
          [selectedIntegration.id]: { connected: true, enabled: configForm.enabled }
        }));
        setIsConfigModalOpen(false);
        setFlashMessage({ type: 'success', message: `${selectedIntegration.name} connected successfully` });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      showError(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (integrationId) => {
    setTesting(integrationId);
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(
        `/api/integrations/${integrationId}/test?store_id=${storeId}`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        setFlashMessage({ type: 'success', message: 'Connection test successful!' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      showError(error.message || 'Connection test failed');
    } finally {
      setTesting(null);
    }
  };

  const handleDisconnect = async (integrationId) => {
    const integration = INTEGRATIONS[integrationId];
    const confirmed = await showConfirm(
      `Are you sure you want to disconnect ${integration.name}? This will stop all data syncing.`,
      'Disconnect Integration'
    );
    if (!confirmed) return;

    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(
        `/api/integrations/${integrationId}/disconnect?store_id=${storeId}`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        setConnectionStatus(prev => ({
          ...prev,
          [integrationId]: { connected: false }
        }));
        setFlashMessage({ type: 'success', message: `${integration.name} disconnected` });
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      showError('Failed to disconnect integration');
    }
  };

  const handleToggleSync = async (integrationId, enabled) => {
    try {
      const storeId = getSelectedStoreId();
      const response = await fetch(
        `/api/integrations/${integrationId}/toggle?store_id=${storeId}`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ enabled })
        }
      );

      if (response.ok) {
        setConnectionStatus(prev => ({
          ...prev,
          [integrationId]: { ...prev[integrationId], enabled }
        }));
        setFlashMessage({
          type: 'success',
          message: `Sync ${enabled ? 'enabled' : 'disabled'} for ${INTEGRATIONS[integrationId].name}`
        });
      }
    } catch (error) {
      console.error('Error toggling sync:', error);
      showError('Failed to update sync settings');
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Marketing Integrations</h1>
        <p className="text-gray-600 mt-1">
          Connect third-party marketing platforms to sync customers and track campaigns
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.values(INTEGRATIONS).map((integration) => {
          const status = connectionStatus[integration.id] || {};
          const isConnected = status.connected;
          const isEnabled = status.enabled !== false;

          return (
            <Card key={integration.id} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${integration.color}`} />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 bg-gradient-to-r ${integration.color} rounded-lg flex items-center justify-center text-2xl text-white`}>
                      {integration.logoFallback}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      {isConnected && (
                        <Badge
                          variant="outline"
                          className={isEnabled
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                          }
                        >
                          {isEnabled ? (
                            <><CheckCircle className="w-3 h-3 mr-1" /> Connected</>
                          ) : (
                            <><AlertCircle className="w-3 h-3 mr-1" /> Paused</>
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{integration.description}</p>

                <ul className="space-y-1 mb-4">
                  {integration.features.map((feature, idx) => (
                    <li key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                      <Check className="w-3 h-3 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">Sync Enabled</span>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggleSync(integration.id, checked)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleTestConnection(integration.id)}
                        disabled={testing === integration.id}
                      >
                        {testing === integration.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfigure(integration)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDisconnect(integration.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      onClick={() => handleConfigure(integration)}
                    >
                      <Plug className="w-4 h-4 mr-2" />
                      Connect
                    </Button>
                    <a
                      href={integration.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      View Documentation
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configuration Modal */}
      <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedIntegration && (
                <>
                  <div className={`w-8 h-8 bg-gradient-to-r ${selectedIntegration.color} rounded flex items-center justify-center text-white`}>
                    {selectedIntegration.logoFallback}
                  </div>
                  Configure {selectedIntegration.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedIntegration && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <Label htmlFor="apiKey">API Key *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={configForm.apiKey}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter your API key"
                  required
                />
              </div>

              {selectedIntegration.id === 'hubspot' && (
                <div>
                  <Label htmlFor="apiSecret">API Secret</Label>
                  <Input
                    id="apiSecret"
                    type="password"
                    value={configForm.apiSecret}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, apiSecret: e.target.value }))}
                    placeholder="Enter your API secret"
                  />
                </div>
              )}

              {(selectedIntegration.id === 'klaviyo' || selectedIntegration.id === 'mailchimp') && (
                <div>
                  <Label htmlFor="listId">Default List/Audience ID</Label>
                  <Input
                    id="listId"
                    value={configForm.listId}
                    onChange={(e) => setConfigForm(prev => ({ ...prev, listId: e.target.value }))}
                    placeholder="Optional: Default list for syncing"
                  />
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <Label htmlFor="enabled" className="font-medium">Enable Sync</Label>
                  <p className="text-xs text-gray-500">Start syncing data immediately</p>
                </div>
                <Switch
                  id="enabled"
                  checked={configForm.enabled}
                  onCheckedChange={(checked) => setConfigForm(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConfigModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Save & Connect
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertComponent />
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
    </div>
  );
}
