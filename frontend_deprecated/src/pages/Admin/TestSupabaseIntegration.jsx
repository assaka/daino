import React, { useState, useEffect } from 'react';
import SupabaseKeyConfiguration from '../../components/Admin/SupabaseKeyConfiguration';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Upload, Database, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const TestSupabaseIntegration = () => {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  
  // Get store ID from your store context or props
  const storeId = localStorage.getItem('selectedStoreId') || '157d4590-49bf-4b0b-bd77-abe131909528';

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/supabase/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-store-id': storeId
          }
        }
      );

      setConnectionStatus(response.data);
    } catch (error) {
      console.error('Error checking status:', error);
      setConnectionStatus({ 
        connected: false, 
        error: error.response?.data?.message || 'Failed to check status' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestUpload = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/supabase/storage/test-upload`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-store-id': storeId
          }
        }
      );

      if (response.data.success) {
        setTestResult({
          success: true,
          message: 'Test upload successful!',
          url: response.data.publicUrl
        });
        toast.success('Test image uploaded successfully!');
      }
    } catch (error) {
      console.error('Test upload error:', error);
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Upload failed'
      });
      toast.error('Upload failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleConfigured = () => {
    // Refresh status after configuration
    checkConnectionStatus();
    setTestResult(null);
  };

  const isStorageReady = connectionStatus?.connected && 
                        connectionStatus?.hasAnonKey && 
                        connectionStatus?.projectUrl &&
                        connectionStatus?.projectUrl !== 'pending_configuration';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center">
          <Database className="h-6 w-6 mr-2" />
          Supabase Storage Integration
        </h1>

        {/* Connection Status */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Connection Status</h2>
          {loading && !connectionStatus ? (
            <div className="flex items-center text-gray-500">
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Checking connection...
            </div>
          ) : connectionStatus ? (
            <div className={`p-4 rounded-lg border ${
              connectionStatus.connected 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {connectionStatus.connected ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mr-2" />
                  )}
                  <span className={connectionStatus.connected ? 'text-green-800' : 'text-red-800'}>
                    {connectionStatus.connected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
                <button
                  onClick={checkConnectionStatus}
                  className="text-blue-600 hover:text-blue-700"
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              {connectionStatus.projectUrl && connectionStatus.projectUrl !== 'pending_configuration' && (
                <div className="mt-2 text-sm text-gray-600">
                  Project: <code className="bg-gray-100 px-2 py-1 rounded">
                    {connectionStatus.projectUrl.replace('https://', '').replace('.supabase.co', '')}
                  </code>
                </div>
              )}
              
              <div className="mt-2 text-sm">
                <div className="flex items-center">
                  <span className="text-gray-600 mr-2">API Keys:</span>
                  <span className={`flex items-center ${connectionStatus.hasAnonKey ? 'text-green-600' : 'text-amber-600'}`}>
                    {connectionStatus.hasAnonKey ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Configured
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Configured
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* API Key Configuration */}
        {connectionStatus?.connected && !isStorageReady && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Configure Storage</h2>
            <SupabaseKeyConfiguration 
              storeId={storeId}
              onConfigured={handleConfigured}
            />
          </div>
        )}

        {/* Test Upload Section */}
        {isStorageReady && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Test Storage</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 mb-4">
                Storage is configured and ready. Test the upload functionality:
              </p>
              <button
                onClick={handleTestUpload}
                disabled={loading}
                className={`
                  px-4 py-2 rounded-lg font-medium flex items-center
                  ${loading 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'Uploading...' : 'Test Upload'}
              </button>

              {testResult && (
                <div className={`mt-4 p-3 rounded-lg ${
                  testResult.success 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  <p className="font-medium">{testResult.message}</p>
                  {testResult.url && (
                    <div className="mt-2">
                      <p className="text-sm">Uploaded to:</p>
                      <a 
                        href={testResult.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs break-all"
                      >
                        {testResult.url}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions for non-connected state */}
        {!connectionStatus?.connected && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Getting Started</h3>
            <ol className="list-decimal list-inside text-blue-800 space-y-1 text-sm">
              <li>Connect your Supabase account via OAuth</li>
              <li>Select a project to use for storage</li>
              <li>Configure API keys from your Supabase dashboard</li>
              <li>Start uploading images!</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestSupabaseIntegration;