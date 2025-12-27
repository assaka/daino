import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import SupabaseIntegration from '@/components/admin/integrations/SupabaseIntegration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Database, 
  Cloud, 
  Package,
  Zap,
  Info,
  Clock,
  Lock,
  CheckCircle,
  Check,
  Star,
  Shield,
  UserX
} from 'lucide-react';
import apiClient from '@/api/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCurrentUser } from '@/utils/auth';

const MediaStorage = () => {
  const { selectedStore } = useStoreSelection();
  const [activeTab, setActiveTab] = useState('supabase');
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bucketsEnsured, setBucketsEnsured] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState(null);
  const [settingDefault, setSettingDefault] = useState(false);
  
  const storeId = selectedStore?.id || localStorage.getItem('selectedStoreId');
  const currentUser = getCurrentUser();
  const isStoreOwner = currentUser?.role === 'store_owner' || currentUser?.role === 'admin';

  useEffect(() => {
    if (storeId && storeId !== 'undefined') {
      loadConnectionStatus();
      fetchDefaultProvider();
    }
  }, [storeId]);

  const loadConnectionStatus = async () => {
    try {
      setLoading(true);
      // Use apiClient which handles authentication correctly
      const response = await apiClient.get('/supabase/status');

      // apiClient returns the response directly, not wrapped in .data
      if (response && response.success) {
        setConnectionStatus(response);
        
        // If connected and has service role key, automatically ensure buckets exist
        if (response.connected && response.hasServiceRoleKey && !bucketsEnsured) {
          await ensureBuckets();
        }
      }
    } catch (error) {
      console.error('Error loading Supabase status:', error);
      setConnectionStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const ensureBuckets = async () => {
    try {
      // Use apiClient for consistency and proper authentication
      const response = await apiClient.post('/supabase/storage/ensure-buckets');

      // apiClient returns the response directly
      if (response && response.success) {
        setBucketsEnsured(true);
      }
    } catch (error) {
      console.error('Error ensuring buckets:', error);
    }
  };

  const fetchDefaultProvider = async () => {
    try {
      const response = await apiClient.get(`/stores/${storeId}/default-mediastorage-provider`);
      // apiClient returns the response directly, not wrapped in .data
      setDefaultProvider(response?.provider);
    } catch (error) {
    }
  };

  const handleSetAsDefault = async (provider) => {
    if (!storeId) {
      toast.error('Please select a store first');
      return;
    }

    setSettingDefault(true);
    try {
      await apiClient.post(`/stores/${storeId}/default-mediastorage-provider`, {
        provider: provider
      });
      
      setDefaultProvider(provider);
      toast.success(`${provider} set as default media storage provider`);
      
      // Refresh the default provider status
      await fetchDefaultProvider();
    } catch (error) {
      console.error('Error setting default media storage provider:', error);
      toast.error('Failed to set as default media storage provider');
    } finally {
      setSettingDefault(false);
    }
  };

  // Role-based access control
  if (!isStoreOwner) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg p-8">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-orange-100 p-3 rounded-full">
                <Shield className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Store Owner Access Required</h1>
            <div className="max-w-2xl mx-auto space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Media storage configuration and management require <strong>store owner</strong> privileges. This restriction is in place to:
              </p>
              <div className="bg-white/70 rounded-lg p-4 text-left">
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <Lock className="w-4 h-4 mt-0.5 text-orange-500" />
                    <span>Protect sensitive storage credentials and API keys</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 mt-0.5 text-orange-500" />
                    <span>Ensure only authorized users can modify storage settings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Database className="w-4 h-4 mt-0.5 text-orange-500" />
                    <span>Prevent unauthorized access to stored media files</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <UserX className="w-4 h-4 mt-0.5 text-orange-500" />
                    <span>Maintain compliance with data protection regulations</span>
                  </li>
                </ul>
              </div>
              <p className="text-gray-600 text-sm">
                If you need access to media storage features, please contact your store administrator or request store owner privileges.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedStore) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Cloud className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Please select a store to manage media storage</p>
        </div>
      </div>
    );
  }

  const ComingSoonCard = ({ provider, icon: Icon, description, features }) => (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="w-5 h-5" />
            <span>{provider}</span>
          </div>
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              {provider} integration is currently under development and will be available soon.
            </AlertDescription>
          </Alert>
          
          <div>
            <h4 className="font-medium mb-3 text-gray-900">Planned Features</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Lock className="w-4 h-4" />
              <span>Enterprise-grade security and reliability</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Media Storage</h1>
          <p className="text-gray-600 mt-1">
            {activeTab === 'supabase' && connectionStatus?.connected
              ? 'View storage statistics, manage buckets, and upload media files'
              : 'Manage your store\'s media files across multiple cloud storage providers'}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="supabase" className="flex items-center space-x-2 relative">
            <Database className="w-4 h-4" />
            <span>Supabase</span>
            {defaultProvider === 'supabase' && (
              <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cloudflare" className="flex items-center space-x-2 relative">
            <Cloud className="w-4 h-4" />
            <span>Cloudflare</span>
            {defaultProvider === 'cloudflare' && (
              <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center space-x-2 relative">
            <Cloud className="w-4 h-4" />
            <span>Google Storage</span>
            {defaultProvider === 'google-storage' && (
              <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="aws" className="flex items-center space-x-2 relative">
            <Package className="w-4 h-4" />
            <span>AWS S3</span>
            {defaultProvider === 'aws-s3' && (
              <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Supabase Tab */}
        <TabsContent value="supabase" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Set as Default button at the top */}
              <div className="flex justify-end">
                <Button
                  onClick={() => handleSetAsDefault('supabase')}
                  disabled={settingDefault || defaultProvider === 'supabase'}
                  variant={defaultProvider === 'supabase' ? "secondary" : "default"}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {defaultProvider === 'supabase' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Default Media Storage</span>
                    </>
                  ) : (
                    <>
                      <Star className="h-4 w-4" />
                      <span>Set as Default</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Show connection/integration component if not connected */}
              {!connectionStatus?.connected && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Connect Supabase for Storage
                      </CardTitle>
                      <CardDescription>
                        Connect your Supabase project to enable cloud storage for your media files
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SupabaseIntegration storeId={storeId} context="storage" />
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* Show storage management if connected */}
              {connectionStatus?.connected && (
                <div className="space-y-6">
                  {/* Bucket creation notification */}
                  {bucketsEnsured && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Storage buckets have been automatically checked and ensured. The <strong>suprshop-assets</strong> bucket is ready for use.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Supabase Integration - handles storage features */}
                  <SupabaseIntegration storeId={storeId} context="storage" />
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Cloudflare Tab */}
        <TabsContent value="cloudflare" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => handleSetAsDefault('cloudflare')}
              disabled={settingDefault || defaultProvider === 'cloudflare'}
              variant={defaultProvider === 'cloudflare' ? "secondary" : "default"}
              size="sm"
              className="flex items-center gap-2"
            >
              {defaultProvider === 'cloudflare' ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Default Media Storage</span>
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" />
                  <span>Set as Default</span>
                </>
              )}
            </Button>
          </div>
          <ComingSoonCard
            provider="Cloudflare R2"
            icon={Cloud}
            description="S3-compatible object storage with zero egress fees and global distribution"
            features={[
              "Zero egress bandwidth fees",
              "S3-compatible API for easy migration",
              "Automatic global replication",
              "Built-in CDN with 300+ edge locations",
              "Automatic image optimization and resizing",
              "Direct integration with Cloudflare Workers",
              "Pay only for storage and operations",
              "GDPR compliant with EU data residency"
            ]}
          />
        </TabsContent>

        {/* Google Storage Tab */}
        <TabsContent value="google" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => handleSetAsDefault('google-storage')}
              disabled={settingDefault || defaultProvider === 'google-storage'}
              variant={defaultProvider === 'google-storage' ? "secondary" : "default"}
              size="sm"
              className="flex items-center gap-2"
            >
              {defaultProvider === 'google-storage' ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Default Media Storage</span>
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" />
                  <span>Set as Default</span>
                </>
              )}
            </Button>
          </div>
          <ComingSoonCard
            provider="Google Cloud Storage"
            icon={Cloud}
            description="Unified object storage with worldwide edge caching and advanced analytics"
            features={[
              "Multi-regional storage with automatic redundancy",
              "Integrated CDN with Cloud CDN",
              "Advanced lifecycle management policies",
              "Real-time analytics with BigQuery integration",
              "Automatic data archiving with Nearline/Coldline",
              "Fine-grained access control with IAM",
              "Server-side encryption by default",
              "Streaming transfers for large files"
            ]}
          />
        </TabsContent>

        {/* AWS S3 Tab */}
        <TabsContent value="aws" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => handleSetAsDefault('aws-s3')}
              disabled={settingDefault || defaultProvider === 'aws-s3'}
              variant={defaultProvider === 'aws-s3' ? "secondary" : "default"}
              size="sm"
              className="flex items-center gap-2"
            >
              {defaultProvider === 'aws-s3' ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Default Media Storage</span>
                </>
              ) : (
                <>
                  <Star className="h-4 w-4" />
                  <span>Set as Default</span>
                </>
              )}
            </Button>
          </div>
          <ComingSoonCard
            provider="AWS S3"
            icon={Package}
            description="Industry-leading object storage with unmatched durability and extensive features"
            features={[
              "99.999999999% (11 9's) durability",
              "Storage classes for cost optimization",
              "CloudFront CDN integration",
              "S3 Transfer Acceleration for faster uploads",
              "Event notifications with Lambda triggers",
              "Object tagging and metadata management",
              "Cross-region replication",
              "AWS ecosystem integration"
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* General Storage Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Multi-Provider Storage Benefits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Why Multiple Providers?</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                  <span>Geographic redundancy and faster regional access</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                  <span>Cost optimization based on usage patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                  <span>Compliance with data residency requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                  <span>Avoid vendor lock-in with portable architecture</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Unified Management</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  <span>Single dashboard for all storage providers</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  <span>Automatic failover and load balancing</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  <span>Consistent API across all providers</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                  <span>Centralized monitoring and analytics</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaStorage;