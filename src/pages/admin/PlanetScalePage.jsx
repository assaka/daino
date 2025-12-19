import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Database, Check, ExternalLink, RefreshCw, Trash2, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import apiClient from '@/api/client';

const PlanetScalePage = () => {
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

      if (response.success && response.database?.provider === 'planetscale') {
        setConnectionStatus(response.database);
      } else {
        setConnectionStatus(null);
      }
    } catch (error) {
      console.error('Error loading PlanetScale status:', error);
      setConnectionStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const checkIfDefault = async () => {
    try {
      const response = await apiClient.get(`/stores/${storeId}/default-database-provider`);
      setIsDefaultDatabase(response?.provider === 'planetscale');
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
        provider: 'planetscale'
      });

      setIsDefaultDatabase(true);
      toast.success('PlanetScale set as default database provider');
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
      const response = await apiClient.get(`/database-oauth/planetscale/authorize?store_id=${storeId}`);
      if (response.authUrl) {
        window.location.href = response.authUrl;
      }
    } catch (error) {
      toast.error('Failed to initiate PlanetScale connection');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect PlanetScale? This will remove the database connection.')) {
      return;
    }

    try {
      await apiClient.post('/database-oauth/disconnect', { store_id: storeId });
      toast.success('PlanetScale disconnected successfully');
      await loadConnectionStatus();
    } catch (error) {
      toast.error('Failed to disconnect PlanetScale');
    }
  };

  if (!selectedStore) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Please select a store to manage PlanetScale integration</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const isConnected = connectionStatus && connectionStatus.connection_status === 'connected';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PlanetScale MySQL</h1>
          <p className="text-gray-600 mt-1">
            {isConnected
              ? 'Serverless MySQL database connected'
              : 'Connect your PlanetScale account for serverless MySQL database'}
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
            <CardTitle>Connect to PlanetScale</CardTitle>
            <CardDescription>
              Connect your PlanetScale account to use serverless MySQL for your store
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-sm text-green-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                What you get with PlanetScale
              </h3>
              <ul className="text-sm text-green-800 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Serverless MySQL with automatic horizontal scaling</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Database branching and safe schema migrations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Free tier: 5 GB storage, 1 billion row reads/month</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Query insights and performance monitoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Scaler plan: $29/month for 10 GB storage</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-center">
              <Button
                onClick={handleConnect}
                disabled={connecting}
                size="lg"
                className="w-full md:w-auto bg-green-600 hover:bg-green-700"
              >
                {connecting ? 'Connecting...' : 'Connect with PlanetScale'}
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="text-center">
              <a
                href="https://planetscale.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1"
              >
                Learn more about PlanetScale
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
                  <p className="text-base font-semibold">MySQL (PlanetScale)</p>
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
                {connectionStatus.provider_project_id && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-500">Database Name</p>
                    <p className="text-base font-semibold">{connectionStatus.provider_project_id}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <a
                  href="https://app.planetscale.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  Manage in PlanetScale Console
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database Information</CardTitle>
              <CardDescription>
                Your PlanetScale MySQL database is ready to use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">
                  Your store data is now stored in a dedicated PlanetScale MySQL database with automatic scaling, branching, and performance insights.
                </p>
                <ul className="text-xs text-gray-500 space-y-1 mt-3">
                  <li>• Non-blocking schema changes via branching</li>
                  <li>• Horizontal sharding for massive scale</li>
                  <li>• Query insights and performance analytics</li>
                  <li>• Automatic connection pooling (no limits)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PlanetScalePage;
