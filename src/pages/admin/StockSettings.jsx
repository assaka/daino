import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Store } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { clearStorefrontCache } from '@/utils/cacheUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SaveButton from '@/components/ui/save-button';
import FlashMessage from '@/components/storefront/FlashMessage';
import { Package, ArrowRight } from 'lucide-react';
import { PageLoader } from "@/components/ui/page-loader";

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 5, baseDelay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await delay(Math.random() * 1000 + 500);
      return await apiCall();
    } catch (error) {
      const isRateLimit = error.response?.status === 429 ||
                         error.message?.includes('Rate limit') ||
                         error.message?.includes('429');

      if (isRateLimit && i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i) + Math.random() * 2000;
        console.warn(`StockSettings: Rate limit hit, retrying in ${delayTime.toFixed(0)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

export default function StockSettings() {
  const { selectedStore, getSelectedStoreId, loading: storeLoading } = useStoreSelection();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);

  useEffect(() => {
    if (selectedStore) {
      loadStore();
    }
  }, [selectedStore]);

  useEffect(() => {
    if (flashMessage) {
      const timer = setTimeout(() => {
        setFlashMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [flashMessage]);

  const loadStore = async () => {
    try {
      setLoading(true);

      if (!selectedStore) {
        setSettings(null);
        setLoading(false);
        return;
      }

      const storeSettings = selectedStore.settings || {};

      setSettings({
        id: selectedStore.id,
        name: selectedStore.name,
        enable_inventory: storeSettings.hasOwnProperty('enable_inventory') ? storeSettings.enable_inventory : true,
        display_out_of_stock: storeSettings.hasOwnProperty('display_out_of_stock') ? storeSettings.display_out_of_stock : true,
        display_out_of_stock_variants: storeSettings.hasOwnProperty('display_out_of_stock_variants') ? storeSettings.display_out_of_stock_variants : true,
        display_low_stock_threshold: storeSettings.hasOwnProperty('display_low_stock_threshold') ? storeSettings.display_low_stock_threshold : 0,
      });

    } catch (error) {
      console.error('Failed to load store:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load store settings. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    const storeId = getSelectedStoreId();
    if (!settings || !storeId) {
      setFlashMessage({ type: 'error', message: 'Store data not loaded. Cannot save.' });
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        settings: {
          enable_inventory: settings.enable_inventory,
          display_out_of_stock: settings.display_out_of_stock,
          display_out_of_stock_variants: settings.display_out_of_stock_variants,
          display_low_stock_threshold: settings.display_low_stock_threshold,
        }
      };

      await retryApiCall(() => Store.update(storeId, payload));

      // Clear all cache for instant updates
      clearStorefrontCache(storeId, ['stores', 'products']);

      try {
        localStorage.removeItem('storeProviderCache');
        sessionStorage.removeItem('storeProviderCache');
        localStorage.removeItem('productCache');
        sessionStorage.removeItem('productCache');
        localStorage.setItem('forceRefreshStore', 'true');

        if (typeof window !== 'undefined' && window.clearCache) {
          window.clearCache();
        }
      } catch (e) {
        console.warn('Failed to clear cache:', e);
      }

      setFlashMessage({ type: 'success', message: 'Inventory settings saved successfully!' });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      // Broadcast to all storefront tabs to clear their cache
      try {
        const channel = new BroadcastChannel('store_settings_update');
        channel.postMessage({ type: 'clear_cache', timestamp: Date.now() });
        channel.close();
      } catch (e) {
        console.warn('BroadcastChannel not supported:', e);
      }

    } catch (error) {
      console.error('Failed to save settings:', error);
      setFlashMessage({ type: 'error', message: `Failed to save settings: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (storeLoading || loading) {
    return <PageLoader size="lg" />;
  }

  if (!selectedStore || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-700">
        Error: Store data could not be loaded or initialized.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inventory Settings</h1>
          <p className="text-gray-600 mt-1">Manage global inventory tracking and out-of-stock behavior.</p>
        </div>

        <div className="space-y-6">
          <Card className="material-elevation-1 border-0">
            <CardHeader>
              <CardTitle>Inventory Management</CardTitle>
              <CardDescription>Configure how inventory is tracked and displayed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="enable_inventory" className="font-medium">Enable Inventory Tracking</Label>
                  <p className="text-sm text-gray-500">Track stock levels and manage inventory for products.</p>
                </div>
                <Switch
                  id="enable_inventory"
                  checked={settings.enable_inventory}
                  onCheckedChange={(checked) => handleSettingsChange('enable_inventory', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="display_out_of_stock" className="font-medium">Display Out of Stock Products</Label>
                  <p className="text-sm text-gray-500">Show products that are out of stock on category and search pages.</p>
                </div>
                <Switch
                  id="display_out_of_stock"
                  checked={settings.display_out_of_stock}
                  onCheckedChange={(checked) => handleSettingsChange('display_out_of_stock', checked)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label htmlFor="display_out_of_stock_variants" className="font-medium">Display Out-of-Stock Variants</Label>
                  <p className="text-sm text-gray-500">Show out-of-stock variant options on configurable products (displayed with strikethrough).</p>
                </div>
                <Switch
                  id="display_out_of_stock_variants"
                  checked={settings.display_out_of_stock_variants}
                  onCheckedChange={(checked) => handleSettingsChange('display_out_of_stock_variants', checked)}
                />
              </div>
              <div className="p-3 border rounded-lg">
                <Label htmlFor="display_low_stock_threshold" className="font-medium">Low Stock Threshold</Label>
                <Input
                  id="display_low_stock_threshold"
                  type="number"
                  value={settings.display_low_stock_threshold}
                  onChange={(e) => handleSettingsChange('display_low_stock_threshold', parseInt(e.target.value) || 0)}
                  min="0"
                  className="mt-2 max-w-32"
                />
                <p className="text-sm text-gray-500 mt-1">Show low stock warning when quantity falls below this number (0 to disable).</p>
              </div>
            </CardContent>
          </Card>

          {/* Link to Stock Display Settings */}
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 mb-2">Stock Display Settings</h4>
                <p className="text-blue-700 mb-3">
                  Stock label visibility, colors, and translations are configured in <strong>Theme & Layout</strong> under the "Stock Display" section.
                </p>
                <Link to={createPageUrl('ThemeLayout')}>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Go to Stock Display Settings
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-8">
          <SaveButton
            onClick={handleSave}
            loading={saving}
            success={saveSuccess}
            disabled={!getSelectedStoreId()}
            defaultText="Save Inventory Settings"
          />
        </div>
      </div>
    </div>
  );
}
