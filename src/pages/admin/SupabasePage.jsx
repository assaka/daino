import React, { useState, useEffect } from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import SupabaseIntegration from '@/components/admin/integrations/SupabaseIntegration';
import { Database, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import apiClient from '@/api/client';

const SupabasePage = () => {
  const { selectedStore } = useStoreSelection();
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDefaultDatabase, setIsDefaultDatabase] = useState(false);
  const [settingDefaultDatabase, setSettingDefaultDatabase] = useState(false);
  
  // No fallbacks - only use the selected store from context
  const storeId = selectedStore?.id;

  useEffect(() => {
    if (storeId && storeId !== 'undefined') {
      loadConnectionStatus();
      checkDefaults();
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
      }
    } catch (error) {
      console.error('Error loading Supabase status:', error);
      setConnectionStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const checkDefaults = async () => {
    try {
      // Check default database provider
      const dbResponse = await apiClient.get(`/stores/${storeId}/default-database-provider`);
      setIsDefaultDatabase(dbResponse?.provider === 'supabase');
    } catch (error) {
      console.error('Error checking default providers:', error);
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
        provider: 'supabase'
      });
      
      setIsDefaultDatabase(true);
      toast.success('Supabase set as default database provider');
      
      // Refresh the default status
      await checkDefaults();
    } catch (error) {
      console.error('Error setting default database provider:', error);
      toast.error('Failed to set as default database provider');
    } finally {
      setSettingDefaultDatabase(false);
    }
  };

  if (!selectedStore) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Please select a store to manage Supabase integration</p>
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

  // Show the main Supabase integration page with both database and storage features
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="sm:flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Supabase Integration</h1>
          <p className="text-gray-600 mt-1">
            {connectionStatus?.connected 
              ? 'Manage your Supabase database and storage services'
              : 'Connect your Supabase account for database and storage management'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSetAsDefaultDatabase}
            disabled={settingDefaultDatabase || isDefaultDatabase || !connectionStatus?.connected}
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
      </div>

      {/* Show SupabaseIntegration component in database context */}
      <SupabaseIntegration storeId={storeId} context="database" />
    </div>
  );
};

export default SupabasePage;