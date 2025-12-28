import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import apiClient from '@/api/client';
import { ExternalLink, Trash2, Cloud, Image, BarChart3, Key, AlertCircle, Info, Copy, ArrowRight, RefreshCw, FileText, Database, HardDrive, Upload, X, Folder, FolderOpen, Package, Unlink } from 'lucide-react';
import FlashMessage from '@/components/storefront/FlashMessage';

const SupabaseIntegration = ({ storeId, context = 'full' }) => {
  // All state declarations first
  const [flashMessage, setFlashMessage] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [storageStats, setStorageStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [testingUpload, setTestingUpload] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [changingProject, setChangingProject] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [buckets, setBuckets] = useState([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [forceResetting, setForceResetting] = useState(false);

  // Check for flash message after reload
  useEffect(() => {
    const successMessage = sessionStorage.getItem('supabase_connection_success');
    if (successMessage) {
      setFlashMessage({
        type: 'success',
        message: successMessage
      });
      sessionStorage.removeItem('supabase_connection_success');
    }
  }, []);

  // Watch connecting state - reload when OAuth completes (connecting becomes false)
  useEffect(() => {
    if (!connecting && sessionStorage.getItem('supabase_connection_success')) {
      window.location.reload();
    }
  }, [connecting]);

  // Helper function to format storage sizes (handles both string and number values)
  const formatStorageSize = (sizeValue, unit = 'MB') => {
    if (!sizeValue) return `0 ${unit}`;
    if (typeof sizeValue === 'number') {
      return `${sizeValue.toFixed(2)} ${unit}`;
    }
    // Already formatted string
    return `${sizeValue} ${unit}`;
  };

  // Check for and clear logout flags on component mount
  useEffect(() => {
    if (localStorage.getItem('user_logged_out') === 'true') {
      localStorage.removeItem('user_logged_out');
      apiClient.isLoggedOut = false;
    }
  }, []);

  useEffect(() => {
    if (storeId && storeId !== 'undefined') {
      loadStatus();
    }
  }, [storeId]);

  const loadStatus = async (showRefreshToast = false) => {
    if (!storeId || storeId === 'undefined') {
      console.error('Invalid storeId:', storeId);
      setStatus({ connected: false });
      setLoading(false);
      return;
    }
    
    try {
      if (!showRefreshToast) {
        setLoading(true);
      }
      const response = await apiClient.get('/supabase/status');

      if (response.success) {
        setStatus(response);
        if (showRefreshToast) {
          if (response.authorizationRevoked && response.autoDisconnected) {
            toast.info('Invalid connection was automatically removed', {
              description: 'You can now reconnect with a valid authorization.'
            });
          } else if (response.authorizationRevoked) {
            toast.warning('Authorization revoked - removing connection...', {
              description: 'The invalid connection is being removed automatically.'
            });
            // Refresh again in 1 second to show the auto-disconnected state
            setTimeout(() => {
              loadStatus(false);
            }, 1000);
          } else if (response.connected) {
            toast.success('Connection status updated');
          }
        } else if (response.authorizationRevoked && !response.autoDisconnected) {
          // If we detect revoked authorization without toast, still refresh to show auto-disconnect
          setTimeout(() => {
            loadStatus(false);
          }, 500);
        }
      } else {
        setStatus({ connected: false });
      }
    } catch (error) {
      console.error('Error loading Supabase status:', error);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefreshStatus = async () => {
    setRefreshing(true);
    await loadStatus(true);
  };

  const loadStorageStats = async () => {
    if (!status?.connected) return;
    
    try {
      setLoadingStats(true);
      const response = await apiClient.get('/supabase/storage/stats');

      if (response.success) {
        setStorageStats(response.summary);
      }
    } catch (error) {
      console.error('Error loading storage stats:', error);
      // Don't show error toast for limited scope connections
      if (!status?.limitedScope && !error.message?.includes('Service role key')) {
        toast.error('Could not load storage statistics', {
          description: 'Storage access may be limited without full permissions.'
        });
      }
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (status?.connected) {
      // Only load storage stats and buckets if context allows it
      if (context === 'full' || context === 'storage') {
        loadStorageStats();
        // Auto-create buckets if we have service role key
        if (status.hasServiceRoleKey) {
          ensureBucketsExist();
        }
      }
      // Load projects if we have proper permissions
      if (!status.limitedScope && status.projectUrl !== 'https://pending-configuration.supabase.co') {
        loadProjects();
      }
    }
  }, [status?.connected, status?.hasServiceRoleKey, context]);

  const loadProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await apiClient.get('/supabase/projects');

      if (response.success) {
        setProjects(response.projects || []);
        // Set the selected project ID based on current project
        const currentProject = response.projects?.find(p => p.isCurrent);
        if (currentProject) {
          setSelectedProjectId(currentProject.id);
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      // Don't show error for limited scope connections
      if (!status?.limitedScope) {
        toast.error('Could not load projects list');
      }
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleProjectChange = async (projectId) => {
    if (!projectId || projectId === selectedProjectId) return;
    
    try {
      setChangingProject(true);
      const response = await apiClient.post('/supabase/select-project', 
        { projectId }
      );

      if (response.success) {
        toast.success(response.message || 'Project changed successfully');
        setSelectedProjectId(projectId);
        // Reload status and storage stats
        loadStatus();
        loadStorageStats();
      } else {
        throw new Error(response.message || 'Failed to change project');
      }
    } catch (error) {
      console.error('Error changing project:', error);
      toast.error(error.message || 'Failed to change project');
    } finally {
      setChangingProject(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      
      // Check for and clear any logout flags that might interfere
      if (localStorage.getItem('user_logged_out') === 'true') {
        localStorage.removeItem('user_logged_out');
        apiClient.isLoggedOut = false;
      }
      
      const response = await apiClient.post(`/supabase/connect?storeId=${storeId}`);

      if (response.success) {
        // Open OAuth URL in new window
        const authWindow = window.open(
          response.authUrl,
          'supabase-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        // Simple approach: Just wait for popup to close, then reload
        // User will click button or it auto-closes after 5s

        // Check if window is closed - when it closes, stop loading
        const checkClosed = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(checkClosed);

            // Store success message for flash notification
            sessionStorage.setItem('supabase_connection_success', 'Successfully connected to Supabase!');

            // Stop loading - this will trigger reload via useEffect
            setConnecting(false);
          }
        }, 500);

        // Clean up after 5 minutes (timeout)
        setTimeout(() => {
          clearInterval(checkClosed);
          if (connecting) {
            setConnecting(false);
            toast.error('Connection timeout. Please try again.');
          }
        }, 300000); // 5 minutes

        toast.success('Please complete the authorization in the popup window');
      } else {
        throw new Error(response.message || 'Failed to initiate connection');
      }
    } catch (error) {
      console.error('Error connecting to Supabase:', error);
      
      // Handle specific error types
      if (error.message?.includes('Session has been terminated')) {
        toast.error('Your session has expired. Please refresh the page and try again.', {
          duration: 8000,
          action: {
            label: 'Refresh Page',
            onClick: () => window.location.reload()
          }
        });
      } else {
        toast.error(error.message || 'Failed to connect to Supabase');
      }
      
      setConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const response = await apiClient.post('/supabase/test');

      if (response.success) {
        // Check if connection has limited scope
        if (response.limitedScope) {
          toast.warning('Connection successful but with limited scope. Please reconnect for full features.', {
            duration: 8000
          });
        } else {
          toast.success('Connection test successful!');
        }
        loadStatus(); // Reload status
      } else {
        throw new Error(response.message || 'Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      
      // Check for scope-related errors
      if (error.message?.includes('OAuth token requires') || error.message?.includes('scope')) {
        toast.error('Your connection needs to be updated with new permissions.', {
          duration: 10000,
          description: 'Please disconnect and reconnect to Supabase to enable all features.',
          action: {
            label: 'Disconnect Now',
            onClick: () => handleDisconnectClick()
          }
        });
      } else if (error.message?.includes('revoked') || error.message?.includes('Authorization has been revoked')) {
        toast.error('Authorization was revoked in Supabase.', {
          duration: 10000,
          description: 'You need to disconnect the invalid connection first.',
          action: {
            label: 'Disconnect Now',
            onClick: () => handleDisconnectClick()
          }
        });
        // Reload status to show revoked authorization UI
        setTimeout(() => {
          loadStatus();
        }, 500);
      } else {
        toast.error(error.message || 'Connection test failed');
      }
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnectClick = () => {
    setShowDisconnectModal(true);
  };

  const handleDisconnectConfirm = async () => {
    try {
      setDisconnecting(true);
      const response = await apiClient.post('/supabase/disconnect');

      if (response.success) {
        toast.success('Supabase disconnected successfully', {
          description: response.note || 'You may need to revoke access in your Supabase account settings.',
          duration: 8000
        });
        // Reload status to show orphaned authorization warning if applicable
        loadStatus();
        setStorageStats(null);
        setShowDisconnectModal(false);
      } else {
        throw new Error(response.message || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error(error.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDisconnectCancel = () => {
    setShowDisconnectModal(false);
  };

  const handleForceReset = async () => {
    try {
      setForceResetting(true);
      const response = await apiClient.post('/supabase/force-reset');

      if (response.success) {
        toast.success('Connection reset successfully', {
          description: 'You can now reconnect to Supabase.'
        });
        // Reload status to show disconnected state
        await loadStatus();
        setStorageStats(null);
      } else {
        throw new Error(response.message || 'Failed to reset connection');
      }
    } catch (error) {
      console.error('Error force resetting:', error);
      toast.error(error.message || 'Failed to reset connection');
    } finally {
      setForceResetting(false);
    }
  };

  const handleTestUpload = async () => {
    try {
      setTestingUpload(true);
      setUploadResult(null);
      
      const response = await apiClient.post('/supabase/storage/test-upload');

      if (response.success) {
        toast.success('Test image uploaded successfully!');
        setUploadResult(response);
        // Refresh storage stats
        loadStorageStats();
      } else {
        throw new Error(response.message || 'Failed to upload test image');
      }
    } catch (error) {
      console.error('Error testing upload:', error);
      toast.error(error.message || 'Failed to upload test image');
    } finally {
      setTestingUpload(false);
    }
  };

  const handleSaveKeys = async () => {
    if (!serviceRoleKey) {
      toast.error('Please provide the service role key');
      return;
    }

    setSavingKeys(true);
    try {
      const response = await apiClient.post('/supabase/update-config', {
        projectId: selectedProjectId,
        serviceRoleKey: serviceRoleKey || undefined
      });

      if (response.success) {
        toast.success('Service role key configured successfully!');
        setServiceRoleKey('');
        setShowKeyConfig(false);
        // Refresh status
        await loadStatus();
      } else {
        throw new Error(response.message || 'Failed to save API keys');
      }
    } catch (error) {
      console.error('Error saving keys:', error);
      toast.error(error.message || 'Failed to save API keys');
    } finally {
      setSavingKeys(false);
    }
  };

  const ensureBucketsExist = async () => {
    if (!status?.connected || !status?.hasServiceRoleKey) return;
    
    try {
      const response = await apiClient.post('/supabase/storage/ensure-buckets', {});

      if (response.success) {
        if (response.bucketsCreated && response.bucketsCreated.length > 0) {
          toast.success(`Created storage buckets: ${response.bucketsCreated.join(', ')}`);
          // Reload buckets list after creation
          await loadBuckets();
        }
      }
    } catch (error) {
      console.error('Error ensuring buckets exist:', error);
      // Silent fail - buckets will be created on first use
    }
  };

  const loadBuckets = async () => {
    if (!status?.connected) return;
    
    setLoadingBuckets(true);
    try {
      const response = await apiClient.get('/supabase/storage/buckets');

      if (response.success) {
        setBuckets(response.buckets || []);
        if (response.limited) {
          toast.info('Showing default buckets. Service role key required for full bucket management.');
        }
      } else {
        throw new Error(response.message || 'Failed to load buckets');
      }
    } catch (error) {
      console.error('Error loading buckets:', error);
      toast.error('Failed to load storage buckets');
    } finally {
      setLoadingBuckets(false);
    }
  };

  // Removed handleCreateBucket - buckets are auto-generated

  // Removed handleDeleteBucket - buckets are auto-generated

  // Load buckets when component is connected and context allows storage features
  useEffect(() => {
    if (status?.connected && !status.authorizationRevoked && (context === 'full' || context === 'storage')) {
      loadBuckets();
    }
  }, [status?.connected, status?.authorizationRevoked, context]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded w-32"></div>
          </div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Flash Message */}
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 sm:p-6">
        <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="hidden sm:block p-2 bg-green-100 rounded-lg">
            <Cloud className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Supabase Integration</h3>
            <p className="text-sm text-gray-600">
              Connect your Supabase account for database and storage management
            </p>
          </div>
        </div>
        
        <div className="sm:flex items-center space-x-2">
          {status?.connected ? (
            <>
              <button
                onClick={handleRefreshStatus}
                disabled={refreshing}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                title="Refresh connection status"
              >
                <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Connected
              </span>
              <button
                onClick={handleDisconnectClick}
                disabled={disconnecting}
                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                title="Disconnect Supabase"
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

      {status?.source === 'store_databases' && status?.oauthConfigured ? (
        /* Connected via service role key, OAuth available - show reconnect option */
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Cloud className="hidden sm:block w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-amber-900 mb-1">
                  OAuth Token Expired
                </h4>
                <p className="text-sm text-amber-700 mb-2">
                  Connected via service role key. Your OAuth token has expired.
                </p>
                <p className="text-sm text-amber-700 mb-3">
                  Reconnect with OAuth to enable automatic token refresh.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reconnect
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Show current connection info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Cloud className="hidden sm:block w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-green-900 mb-1">
                  Storage Access Available
                </h4>
                <p className="text-sm text-green-700">
                  Project: {status.projectUrl}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Service role key is configured - storage operations will work.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : status?.oauthConfigured === false ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <Cloud className="hidden sm:block w-6 h-6 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-lg font-medium text-yellow-900 mb-2">
                Supabase OAuth Not Configured
              </h3>
              <p className="text-yellow-700 mb-4">
                The Supabase OAuth integration is not yet configured on the server.
                Please contact your administrator to set up the following:
              </p>
              <div className="bg-yellow-100 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-yellow-900 mb-2">Required Environment Variables:</h4>
                <ul className="space-y-1 text-sm text-yellow-800 font-mono">
                  <li>• SUPABASE_OAUTH_CLIENT_ID</li>
                  <li>• SUPABASE_OAUTH_CLIENT_SECRET</li>
                  <li>• SUPABASE_OAUTH_REDIRECT_URI</li>
                </ul>
              </div>
              <div className="text-sm text-yellow-700">
                <p className="mb-2">To set up Supabase OAuth:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://supabase.com/dashboard/account/apps" target="_blank" rel="noopener noreferrer" className="underline">Supabase OAuth Apps</a></li>
                  <li>Create a new OAuth application</li>
                  <li>Set redirect URL to: <code className="bg-yellow-100 px-1">https://backend.dainostore.com/api/supabase/callback</code></li>
                  <li>Add the credentials to your server environment</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      ) : status?.authorizationRevoked && status?.autoDisconnected ? (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Cloud className="hidden sm:block w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Connection Automatically Removed
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                  Your authorization was revoked in Supabase, so we've automatically disconnected the invalid connection.
                </p>
                {status.lastKnownProjectUrl && (
                  <p className="text-xs text-blue-600 mb-3">
                    Last known project: {status.lastKnownProjectUrl}
                  </p>
                )}
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <Cloud className="mr-2 h-4 w-4" />
                      Reconnect to Supabase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : status?.authorizationRevoked ? (
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Cloud className="hidden sm:block w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-red-900 mb-1">
                      Authorization Revoked - Disconnecting...
                    </h4>
                    <p className="text-sm text-red-700 mb-3">
                      Detected revoked authorization. Automatically removing invalid connection...
                    </p>
                  </div>
                  <div className="animate-spin h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
                </div>
                {status.projectUrl && (
                  <p className="text-xs text-red-600 mb-3">
                    Last known project: {status.projectUrl}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : status?.wasAutoDisconnected ? (
        <div className="space-y-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Cloud className="hidden sm:block w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900 mb-1">
                  Ready to Reconnect
                </h4>
                <p className="text-sm text-gray-700 mb-3">
                  The previous connection was removed after authorization was revoked. You can now connect with a new authorization.
                </p>
                {status.lastKnownProjectUrl && (
                  <p className="text-xs text-gray-600 mb-3">
                    Previous project: {status.lastKnownProjectUrl}
                  </p>
                )}
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Cloud className="mr-2 h-4 w-4" />
                      Connect Supabase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : status?.hasOrphanedAuthorization ? (
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Cloud className="hidden sm:block w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-orange-900 mb-1">
                  Authorization May Still Be Active
                </h4>
                <p className="text-sm text-orange-700 mb-3">
                  You disconnected DainoStore from Supabase, but the app may still be authorized in your Supabase account.
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-orange-700">
                    To completely revoke access:
                  </p>
                  <ol className="text-sm text-orange-700 list-decimal list-inside space-y-1">
                    <li>Go to <a href="https://supabase.com/dashboard/account/apps" target="_blank" rel="noopener noreferrer" className="underline">Supabase Authorized Apps</a></li>
                    <li>Find "DainoStore" in the list</li>
                    <li>Click "Revoke Access"</li>
                  </ol>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {connecting ? (
                      <>
                        <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Cloud className="mr-2 h-4 w-4" />
                        Reconnect Supabase
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : status?.tokenExpired ? (
        /* Token expired - show reconnect option */
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Cloud className="hidden sm:block w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-amber-900 mb-1">
                  Connection Expired
                </h4>
                <p className="text-sm text-amber-700 mb-3">
                  Your Supabase OAuth token has expired. Please reconnect to restore access.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reconnect to Supabase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : status?.connectionError ? (
        /* Connection error - show reset option */
        <div className="space-y-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-900 mb-1">
                  Connection Error
                </h4>
                <p className="text-sm text-red-700 mb-2">
                  {status.message || 'Unable to connect to Supabase. The connection may be corrupted.'}
                </p>
                {status.error && (
                  <p className="text-xs text-red-600 mb-3 font-mono bg-red-100 p-2 rounded">
                    {status.error}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleForceReset}
                    disabled={forceResetting}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                  >
                    {forceResetting ? (
                      <>
                        <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Resetting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset Connection
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleRefreshStatus}
                    disabled={refreshing}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {refreshing ? (
                      <>
                        <div className="animate-spin -ml-1 mr-3 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry Connection
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-red-600 mt-3">
                  Reset will clear all stored credentials. You'll need to reconnect to Supabase after resetting.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : status?.connected ? (
        <div className="space-y-6">
          {/* Scope Warning */}
          {(status.projectUrl === 'https://pending-configuration.supabase.co' || 
            status.projectUrl === 'pending_configuration' ||
            status.limitedScope) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <Cloud className="hidden sm:block w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-yellow-900 mb-1">
                    Connection Needs Update
                  </h4>
                  <p className="text-sm text-yellow-700 mb-2">
                    Your OAuth app doesn't have the required permissions. To fix this:
                  </p>
                  <ol className="text-sm text-yellow-700 mb-3 list-decimal list-inside space-y-1">
                    <li>Go to your Supabase OAuth app settings</li>
                    <li>Add these scopes: projects:read, projects:write, secrets:read</li>
                    <li>Save the OAuth app changes</li>
                    <li>Click the button below to reconnect</li>
                  </ol>
                  <button
                    onClick={handleDisconnectClick}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium"
                  >
                    Disconnect and Reconnect
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Connection Details */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Cloud className="hidden sm:block w-5 h-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-green-900 mb-1">
                  Connected to Supabase Project
                </h4>
                
                {/* Project Selector Dropdown */}
                {projects.length > 1 && !status.limitedScope && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-green-700">
                        Select Project:
                      </label>
                      <button
                        onClick={loadProjects}
                        disabled={loadingProjects}
                        className="text-green-600 hover:text-green-800 disabled:opacity-50"
                        title="Refresh projects list"
                      >
                        <svg className={`w-3 h-3 ${loadingProjects ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                    <select
                      value={selectedProjectId || ''}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      disabled={changingProject || loadingProjects}
                      className="block w-full px-3 py-2 text-sm border border-green-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                    >
                      {loadingProjects ? (
                        <option>Loading projects...</option>
                      ) : (
                        <>
                          {projects.map(project => (
                            <option key={project.id} value={project.id}>
                              {project.name} {project.isCurrent ? '(current)' : ''}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {changingProject && (
                      <p className="text-xs text-green-600 mt-1">Switching project...</p>
                    )}
                  </div>
                )}
                
                {/* Show message if projects couldn't be loaded but we're connected */}
                {!status.limitedScope && status.projectUrl && status.projectUrl !== 'https://pending-configuration.supabase.co' && (
                  <div className="mb-2">
                    <p className="text-sm text-green-700">
                      Project URL: {status.projectUrl}
                    </p>
                  </div>
                )}
                
                {/* Single Project */}
                {projects.length === 1 && !status.limitedScope && (
                  <div className="mb-2">
                    <p className="text-sm text-green-700">
                      Project: <span className="font-medium">{projects[0].name}</span>
                    </p>
                    <p className="text-xs text-green-600">
                      {status.projectUrl}
                    </p>
                  </div>
                )}
                
                {/* Limited scope - no project selection */}
                {status.limitedScope && (
                  <p className="text-sm text-green-700 mb-2">
                    Project URL: {status.projectUrl}
                  </p>
                )}
                
                <div className="text-xs text-green-600">
                  <p>Connection Status: {status.connectionStatus || 'Unknown'}</p>
                  {status.lastTestedAt && (
                    <p>Last Tested: {new Date(status.lastTestedAt).toLocaleString()}</p>
                  )}
                  {status.expiresAt && (
                    <p className={status.isExpired ? 'text-red-600' : ''}>
                      Token Expires: {new Date(status.expiresAt).toLocaleString()}
                      {status.isExpired && ' (Expired)'}
                    </p>
                  )}
                </div>

                {/* Reconnect button for expired tokens */}
                {status.isExpired && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <p className="text-sm text-amber-700 mb-2">
                      Your token has expired. Click below to re-authenticate.
                    </p>
                    <button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md disabled:opacity-50"
                    >
                      {connecting ? (
                        <>
                          <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Reconnecting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Reconnect
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* API Key Configuration */}
          {(!status.hasServiceRoleKey || showKeyConfig) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Key className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-amber-900">
                      Configure Service Role Key
                    </h4>
                    {showKeyConfig && status.hasServiceRoleKey && (
                      <button
                        onClick={() => setShowKeyConfig(false)}
                        className="text-amber-600 hover:text-amber-700"
                        title="Close"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-amber-700 mb-4">
                    Supabase Storage requires the service role key for full access. Copy it from your Supabase dashboard.
                  </p>
                  
                  {/* Instructions */}
                  <div className="bg-white rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-700 font-medium mb-2">How to get your service role key:</p>
                    <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                      <li>Go to your <a href={`https://supabase.com/dashboard/project/${selectedProjectId || 'your-project'}/settings/api`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Supabase API Settings</a></li>
                      <li>Copy the "service_role" key (secret key with full access)</li>
                      <li>Paste it below and save</li>
                    </ol>
                  </div>

                  {/* Key Input Field */}
                  <div className="space-y-3">
                    {/* Service Role Key */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Service Role Key (Required)
                      </label>
                      <input
                        type="password"
                        value={serviceRoleKey}
                        onChange={(e) => setServiceRoleKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={savingKeys}
                      />
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                        <p className="text-xs text-yellow-800 flex items-start">
                          <Info className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                          Keep this key secret! It has admin privileges and provides full access to storage operations.
                        </p>
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={handleSaveKeys}
                      disabled={savingKeys || !serviceRoleKey}
                      className={`w-full py-2 px-4 rounded-md font-medium flex items-center justify-center ${
                        savingKeys || !serviceRoleKey
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {savingKeys ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Save Service Role Key
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Show success message if keys are configured */}
          {status.hasServiceRoleKey && !showKeyConfig && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Key className="w-5 h-5 text-green-600 mr-2" />
                  <div>
                    <p className="text-green-800 font-medium">Service Role Key Configured</p>
                    <p className="text-green-600 text-sm">
                      Full storage access enabled with service role key
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKeyConfig(true)}
                  className="text-sm text-green-600 hover:text-green-700 underline"
                >
                  Reconfigure Keys
                </button>
              </div>
            </div>
          )}



          {/* Storage Management - Show if connected and in storage context */}
          {(context === 'full' || context === 'storage') && status.hasServiceRoleKey && (
            <div className="border-t pt-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">Storage Management</h4>
                    <p className="text-sm text-gray-600">Manage your Supabase storage buckets and files</p>
                  </div>
                  <button
                    onClick={loadStorageStats}
                    disabled={loadingStats}
                    className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {loadingStats ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh Stats
                      </>
                    )}
                  </button>
                </div>

                {/* Folder Structure Info */}
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Folder className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <h5 className="text-sm font-medium text-gray-900 mb-2">Storage Folder Structure</h5>
                      <p className="text-xs text-gray-600 mb-3">
                        Files are organized in the following directories within the <code className="bg-white px-1 py-0.5 rounded">suprshop-assets</code> bucket:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="bg-white rounded p-2 border border-blue-100">
                          <div className="flex items-center space-x-2">
                            <FolderOpen className="w-4 h-4 text-blue-500" />
                            <code className="text-xs font-mono">library/</code>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-6">General media files</p>
                        </div>
                        <div className="bg-white rounded p-2 border border-blue-100">
                          <div className="flex items-center space-x-2">
                            <FolderOpen className="w-4 h-4 text-green-500" />
                            <code className="text-xs font-mono">product/images/</code>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-6">Product images</p>
                        </div>
                        <div className="bg-white rounded p-2 border border-blue-100">
                          <div className="flex items-center space-x-2">
                            <FolderOpen className="w-4 h-4 text-green-500" />
                            <code className="text-xs font-mono">product/files/</code>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-6">Product documents</p>
                        </div>
                        <div className="bg-white rounded p-2 border border-blue-100">
                          <div className="flex items-center space-x-2">
                            <FolderOpen className="w-4 h-4 text-purple-500" />
                            <code className="text-xs font-mono">category/images/</code>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-6">Category images</p>
                        </div>
                        <div className="bg-white rounded p-2 border border-blue-100">
                          <div className="flex items-center space-x-2">
                            <FolderOpen className="w-4 h-4 text-orange-500" />
                            <code className="text-xs font-mono">test-products/</code>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-6">Test uploads</p>
                        </div>
                      </div>
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                        <div className="flex items-start space-x-2">
                          <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                          <p className="text-xs text-amber-800">
                            <strong>Note:</strong> Files are further organized into subdirectories (a/, b/, c/...) based on filename for optimal performance.
                            Only files in these specific folders will be counted in statistics.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {loadingStats && !storageStats ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : storageStats ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Storage Overview */}
                      <div className="space-y-4">
                        <h5 className="font-medium text-gray-900">Storage Overview</h5>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                            <div className="flex items-center">
                              <FileText className="w-5 h-5 text-blue-500 mr-2" />
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Files</p>
                                <p className="text-2xl font-bold text-gray-900">{storageStats.totalFiles || 0}</p>
                              </div>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                            <div className="flex items-center">
                              <HardDrive className="w-5 h-5 text-green-500 mr-2" />
                              <div>
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Size</p>
                                <p className="text-2xl font-bold text-gray-900">{storageStats.totalSizeMB || '0.00'} MB</p>
                              </div>
                            </div>
                          </div>
                        </div>

                      {/* Storage Usage Bar */}
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700">Storage Usage</span>
                          <span className="text-sm font-semibold text-gray-900">{storageStats.storageUsedPercentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(storageStats.storageUsedPercentage || 0, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Buckets */}
                      {storageStats.buckets && storageStats.buckets.length > 0 && (
                        <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                          <h6 className="text-sm font-medium text-gray-700 mb-3">Storage Buckets</h6>
                          <div className="space-y-2">
                            {storageStats.buckets.map((bucket, index) => (
                              <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center">
                                  <Cloud className="w-4 h-4 text-gray-400 mr-2" />
                                  <span className="text-sm font-medium text-gray-900">{bucket.bucket}</span>
                                </div>
                                <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                                  {bucket.fileCount} files • {bucket.totalSizeMB} MB
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Test Upload Section */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-gray-900">Test Storage</h5>
                      <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                        <p className="text-sm text-gray-600 mb-4">Upload a test image to verify your storage configuration</p>
                        <button
                          onClick={handleTestUpload}
                          disabled={testingUpload}
                          className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                        >
                          {testingUpload ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                              Uploading Test Image...
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 mr-2" />
                              Upload Test Image
                            </>
                          )}
                        </button>

                        {uploadResult && uploadResult.success && (
                          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center mb-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-2">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <p className="text-sm font-semibold text-green-800">Upload successful!</p>
                            </div>
                            {uploadResult.fileUrl && (
                              <div className="space-y-3">
                                <div className="relative">
                                  <img
                                    src={uploadResult.fileUrl}
                                    alt="Test upload"
                                    className="w-full h-40 object-cover rounded-lg border border-green-300"
                                  />
                                  <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded px-2 py-1">
                                    <span className="text-xs text-gray-600">Test Image</span>
                                  </div>
                                </div>
                                <div className="bg-white rounded p-3 border border-green-200">
                                  <p className="text-xs text-gray-600 mb-1">Filename:</p>
                                  <p className="text-sm font-mono text-green-700 break-all">{uploadResult.fileName}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">No storage statistics available</p>
                    <button
                      onClick={loadStorageStats}
                      className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-lg text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Load Storage Stats
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <Cloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Connect to Supabase
          </h3>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">
            Connect your Supabase account to enable database management and image storage for your store.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-5 w-5" />
                  Connect Supabase Account
                </>
              )}
            </button>

            <div className="text-xs text-gray-500 max-w-md mx-auto">
              <p>
                By connecting, you authorize DainoStore to access your Supabase project for
                database operations and file storage management.
              </p>
            </div>
          </div>

          {/* Features Preview */}
          <div className="mt-8 border-t pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">What you'll get:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <Image className="w-4 h-4 text-gray-400" />
                <span>Automatic image uploads to Supabase Storage</span>
              </div>
              <div className="flex items-center space-x-2">
                <Cloud className="w-4 h-4 text-gray-400" />
                <span>Database management for your store data</span>
              </div>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                <span>Storage usage analytics</span>
              </div>
              <div className="flex items-center space-x-2">
                <ExternalLink className="w-4 h-4 text-gray-400" />
                <span>Access to Supabase dashboard</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Disconnect Supabase</h3>
              <button
                onClick={handleDisconnectCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={disconnecting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start space-x-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-medium text-gray-900 mb-2">
                    Are you sure you want to disconnect?
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    This action will permanently remove all Supabase connection details including:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 mb-4">
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <span>OAuth access tokens and refresh tokens</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <span>Service role and anonymous API keys</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <span>Project URLs and configuration data</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                      <span>Storage access and file management capabilities</span>
                    </li>
                  </ul>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      <strong>Note:</strong> You may also need to revoke access in your{' '}
                      <a
                        href="https://supabase.com/dashboard/account/apps"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-amber-900"
                      >
                        Supabase account settings
                      </a>{' '}
                      to completely remove authorization.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={handleDisconnectCancel}
                disabled={disconnecting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnectConfirm}
                disabled={disconnecting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {disconnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Disconnect Supabase
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default SupabaseIntegration;