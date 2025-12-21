import React from 'react';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import NoStoreSelected from '@/components/admin/NoStoreSelected';
import EmailProviderSettings from '@/components/admin/settings/EmailProviderSettings';
import { Mail } from 'lucide-react';
import { Store } from '@/api/entities';
import { useState, useEffect } from 'react';
import { PageLoader } from '@/components/ui/page-loader';

export default function EmailSettings() {
  const { selectedStore } = useStoreSelection();
  const [fullStore, setFullStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoreData();
  }, [selectedStore]);

  const loadStoreData = async () => {
    if (selectedStore?.id) {
      setLoading(true);
      try {
        const fullStoreData = await Store.findById(selectedStore.id);
        const store = Array.isArray(fullStoreData) ? fullStoreData[0] : fullStoreData;

        // Handle different API response structures
        // API returns: { success: true, data: { tenantData: {...}, store: {...} } }
        const apiData = store?.data || store;
        const storeData = apiData?.tenantData || apiData;

        setFullStore(storeData);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    }
  };

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  if (loading) {
    return <PageLoader size="lg" />;
  }

  // Extract email from settings
  const storeEmail = fullStore?.settings?.store_email || '';
  const storeName = fullStore?.name || selectedStore?.name || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Email Settings</h1>
              <p className="text-gray-600 mt-1">Configure your email service provider for transactional emails</p>
            </div>
          </div>
        </div>

        <EmailProviderSettings
          storeEmail={storeEmail}
          storeName={storeName}
        />
      </div>
    </div>
  );
}
