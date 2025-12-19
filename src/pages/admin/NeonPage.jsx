import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Database, Check, ExternalLink, RefreshCw, Trash2, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import apiClient from '@/api/client';

const NeonPage = () => {
  const { selectedStore } = useStoreSelection();
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDefaultDatabase, setIsDefaultDatabase] = useState(false);
  const [settingDefaultDatabase, setSettingDefaultDatabase] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // No fallbacks - only use the selected store from context
  const storeId = selectedStore?.id;

  useEffect(() => {
    if (storeId && storeId !== 'undefined') {
      loadConnectionStatus();
      checkIfDefault();
    }
  }, [storeId]);

  const loadConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/store-database/status?store_id=${storeId}`);

      if (response.success && response.database?.provider === 'neon') {
        setConnectionStatus(response.database);
      } else {
        setConnectionStatus(null);
      }
    } catch (error) {
      console.error('Error loading Neon status:', error);
      setConnectionStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const checkIfDefault = async () => {
    try {
      const response = await apiClient.get(`/stores/${storeId}/default-database-provider`);
      setIsDefaultDatabase(response?.provider === 'neon');
    } catch (error) {
      console.error('Error checking default provider:', error);
    }
  };

  const handleSetAsDefaultDatabase = async () => {
    if (!storeId) {
      toast.error('Please select a store first');
      return;
    }

    setSettingDefaultDatabase(true);
    try {
      await apiClient.post(`/stores/${storeId}/default-database-provider`, {
        provider: 'neon'
      });

      setIsDefaultDatabase(true);
      toast.success('Neon set as default database provider');
      await checkIfDefault();
    } catch (error) {
      console.error('Error setting default database provider:', error);
      toast.error('Failed to set as default database provider');
    } finally {
      setSettingDefaultDatabase(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await apiClient.get(`/database-oauth/neon/authorize?store_id=${storeId}`);
      if (response.authUrl) {
        window.location.href = response.authUrl;
      }
    } catch (error) {
      toast.error('Failed to initiate Neon connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Neon? This will remove the database connection.')) {
      return;
    }

    try {
      await apiClient.post('/database-oauth/disconnect', { store_id: storeId });
      toast.success('Neon disconnected successfully');
      await loadConnectionStatus();
    } catch (error) {
      toast.error('Failed to disconnect Neon');
    }
  };

  if (!selectedStore) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Please select a store to manage Neon integration</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isConnected = connectionStatus && connectionStatus.connection_status === 'connected';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Neon PostgreSQL</h1>
          <p className="text-gray-600 mt-1">
            {isConnected
              ? 'Serverless PostgreSQL database connected'
              : 'Connect your Neon account for serverless PostgreSQL database'}
          </p>
        </div>
        {isConnected && (
          <div className="flex gap-2">
            <Button
              onClick={handleSetAsDefaultDatabase}
              disabled={settingDefaultDatabase || isDefaultDatabase}
              variant={isDefaultDatabase ? "secondary" : "default"}
              size="sm"
              className="flex items-center gap-2"
            >
              {isDefaultDatabase ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Default Database</span>
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  <span>Set as Default Database</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {!isConnected ? (
        <Card>
          <CardHeader>
            <CardTitle>Connect to Neon</CardTitle>
            <CardDescription>
              Connect your Neon account to use serverless PostgreSQL for your store
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-sm text-blue-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                What you get with Neon
              </h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Serverless PostgreSQL with automatic scaling</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Database branching for dev/staging/production</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Free tier: 0.5 GB storage, 191 hours compute/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Automatic backups and point-in-time recovery</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Pro plan: $19/month for 3 GB storage</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-center">
              <Button
                onClick={handleConnect}
                disabled={connecting}
                size="lg"
                className="w-full md:w-auto"
              >
                {connecting ? 'Connecting...' : 'Connect with Neon'}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="text-center">
              <a
                href="https://neon.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Learn more about Neon
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>Connection Status</CardTitle>
                  <Badge variant="success" className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Database Type</p>
                  <p className="text-base font-semibold">PostgreSQL (Neon)</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="text-base font-semibold capitalize">{connectionStatus.connection_status}</p>
                </div>
                {connectionStatus.metadata?.region && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">Region</p>
                    <p className="text-base font-semibold">{connectionStatus.metadata.region}</p>
                  </div>
                )}
                {connectionStatus.metadata?.pg_version && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">PostgreSQL Version</p>
                    <p className="text-base font-semibold">v{connectionStatus.metadata.pg_version}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <a
                  href="https://console.neon.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  Manage in Neon Console
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database Information</CardTitle>
              <CardDescription>
                Your Neon PostgreSQL database is ready to use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">
                  Your store data is now stored in a dedicated Neon PostgreSQL database with automatic scaling, branching, and backups.
                </p>
                <ul className="text-xs text-gray-500 space-y-1 mt-3">
                  <li>• Automatic connection pooling</li>
                  <li>• Point-in-time recovery available</li>
                  <li>• Database branching for safe schema changes</li>
                  <li>• Serverless compute with auto-pause</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default NeonPage;
