import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Code, Database } from 'lucide-react';

const AkeneoAttributeDebugger = () => {
  const [debugResult, setDebugResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  
  // Get store ID from your store context or props
  const storeId = localStorage.getItem('selectedStoreId') || '157d4590-49bf-4b0b-bd77-abe131909528';

  useEffect(() => {
    checkAkeneoConnection();
  }, []);

  const checkAkeneoConnection = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/integrations/akeneo/status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-store-id': storeId
          }
        }
      );
      setConnectionStatus(response.data);
    } catch (error) {
      console.error('Error checking Akeneo status:', error);
      setConnectionStatus({ 
        connected: false, 
        error: error.response?.data?.message || 'Failed to check Akeneo connection' 
      });
    }
  };

  const runAttributeDebug = async () => {
    setLoading(true);
    setDebugResult(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/integrations/akeneo/debug-attributes`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-store-id': storeId
          }
        }
      );

      if (response.data.success) {
        setDebugResult(response.data);
        if (response.data.problematicProducts?.length > 0) {
          toast.error(`Found ${response.data.problematicProducts.length} products with attribute issues`);
        } else {
          toast.success('No attribute conversion issues found!');
        }
      }
    } catch (error) {
      console.error('Debug error:', error);
      const errorMessage = error.response?.data?.message || error.message;
      setDebugResult({
        success: false,
        error: errorMessage
      });
      toast.error('Debug failed: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isAkeneoReady = connectionStatus?.connected;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center">
          <Database className="h-6 w-6 mr-2" />
          Akeneo Attribute Debugger
        </h1>

        {/* Connection Status */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Akeneo Connection Status</h2>
          {connectionStatus ? (
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
                    {connectionStatus.connected ? 'Connected to Akeneo' : 'Not Connected'}
                  </span>
                </div>
                <button
                  onClick={checkAkeneoConnection}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              
              {connectionStatus.error && (
                <div className="mt-2 text-sm text-red-600">
                  Error: {connectionStatus.error}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center text-gray-500">
              <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              Checking connection...
            </div>
          )}
        </div>

        {/* Debug Section */}
        {isAkeneoReady && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Debug Attribute Conversion</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700 mb-4">
                This tool analyzes Akeneo products for attributes that might cause the numeric type error:
                <code className="bg-red-100 text-red-800 px-2 py-1 rounded ml-2">
                  invalid input syntax for type numeric: '[object Object],[object Object]'
                </code>
              </p>
              
              <button
                onClick={runAttributeDebug}
                disabled={loading}
                className={`
                  px-4 py-2 rounded-lg font-medium flex items-center
                  ${loading 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                  }
                `}
              >
                <Code className="h-4 w-4 mr-2" />
                {loading ? 'Analyzing...' : 'Debug Attributes'}
              </button>
            </div>
          </div>
        )}

        {/* Debug Results */}
        {debugResult && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Debug Results</h2>
            
            {debugResult.success ? (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Analysis Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Products Analyzed:</span>
                      <span className="font-medium ml-2">{debugResult.totalProducts || 0}</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Problematic Products:</span>
                      <span className="font-medium ml-2 text-red-600">
                        {debugResult.problematicProducts?.length || 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-blue-700">Conversion Errors:</span>
                      <span className="font-medium ml-2 text-amber-600">
                        {debugResult.conversionErrors?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Problematic Products */}
                {debugResult.problematicProducts?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-3 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Products with Attribute Issues ({debugResult.problematicProducts.length})
                    </h3>
                    
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {debugResult.problematicProducts.map((product, index) => (
                        <div key={index} className="bg-white rounded border p-3">
                          <div className="font-medium text-gray-900 mb-2">
                            {product.identifier} - {product.name}
                          </div>
                          
                          {product.problematicAttributes?.map((attr, attrIndex) => (
                            <div key={attrIndex} className="ml-4 mb-2 last:mb-0">
                              <div className="text-sm font-medium text-red-700">
                                Attribute: <code className="bg-gray-100 px-1 rounded">{attr.attributeCode}</code>
                              </div>
                              <div className="text-sm text-red-600 mt-1">
                                Issue: {attr.issue}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                Data: <code className="bg-gray-100 px-1 rounded break-all">
                                  {attr.rawData ? JSON.stringify(attr.rawData).substring(0, 100) + '...' : 'N/A'}
                                </code>
                              </div>
                              <div className="text-xs text-red-500 mt-1">
                                String Result: "{attr.stringValue}"
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversion Errors */}
                {debugResult.conversionErrors?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-900 mb-3">
                      Conversion Errors ({debugResult.conversionErrors.length})
                    </h3>
                    
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {debugResult.conversionErrors.map((error, index) => (
                        <div key={index} className="text-sm text-amber-700">
                          <code className="bg-amber-100 px-1 rounded">{error}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Success State */}
                {(!debugResult.problematicProducts?.length && !debugResult.conversionErrors?.length) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                      <span className="text-green-800 font-medium">
                        No attribute conversion issues found!
                      </span>
                    </div>
                    <p className="text-green-700 text-sm mt-2">
                      All analyzed products have properly formatted numeric attributes.
                    </p>
                  </div>
                )}

                {/* Recommendations */}
                {debugResult.problematicProducts?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Recommendations</h3>
                    <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
                      <li>Review the problematic attributes listed above</li>
                      <li>Check Akeneo attribute configuration for complex objects in numeric fields</li>
                      <li>Consider using custom attribute mappings to handle complex data structures</li>
                      <li>The numeric conversion fix should handle most issues automatically</li>
                      <li>Contact support if issues persist after running a new import</li>
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-red-800 font-medium">Debug Failed</span>
                </div>
                <p className="text-red-700 text-sm mt-2">
                  {debugResult.error || 'Unknown error occurred during attribute analysis'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Instructions for non-connected state */}
        {!isAkeneoReady && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Setup Required</h3>
            <ol className="list-decimal list-inside text-blue-800 space-y-1 text-sm">
              <li>Configure your Akeneo PIM connection in the integrations settings</li>
              <li>Ensure your Akeneo API credentials are valid</li>
              <li>Verify network connectivity to your Akeneo instance</li>
              <li>Return here to debug attribute conversion issues</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default AkeneoAttributeDebugger;