import React, { useState, useEffect } from 'react';
import { Store } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import SaveButton from '@/components/ui/save-button';
import FlashMessage from '@/components/storefront/FlashMessage';
import { Rocket } from 'lucide-react';

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
        console.warn(`Cache: Rate limit hit, retrying in ${delayTime.toFixed(0)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

export default function Cache() {
  const { selectedStore } = useStoreSelection();
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

  const loadStore = async () => {
    try {
      setLoading(true);

      if (!selectedStore) {
        setSettings(null);
        setLoading(false);
        return;
      }

      const storeSettings = selectedStore.settings || {};

      // Initialize cache settings with defaults
      const cacheSettings = {
        enabled: storeSettings.cache?.enabled !== false, // Default: true
        duration: storeSettings.cache?.duration || 60 // Default: 60 seconds
      };

      setSettings(cacheSettings);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load cache settings:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load cache settings' });
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveSuccess(false);

      if (!selectedStore?.id) {
        setFlashMessage({ type: 'error', message: 'No store selected' });
        return;
      }

      // Update store settings
      await retryApiCall(async () => {
        await Store.update(selectedStore.id, {
          settings: {
            ...selectedStore.settings,
            cache: settings
          }
        });
      });

      setSaveSuccess(true);
      setFlashMessage({ type: 'success', message: 'Cache settings saved successfully!' });

      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save cache settings:', error);
      setFlashMessage({ type: 'error', message: 'Failed to save cache settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading cache settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />

      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Rocket className="w-8 h-8" />
            Cache Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Configure HTTP caching to improve storefront performance
          </p>
        </div>
      </div>

      <Card className="material-elevation-1 border-0">
        <CardHeader>
          <CardTitle>HTTP Cache Configuration</CardTitle>
          <CardDescription>
            Control how long browsers and CDNs cache your product pages. Changes visible in 1-3 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="cache_enabled">Enable HTTP Caching</Label>
                <p className="text-sm text-muted-foreground">
                  Cache product pages to improve loading speed (recommended)
                </p>
              </div>
              <Switch
                id="cache_enabled"
                checked={settings?.enabled !== false}
                onCheckedChange={(checked) =>
                  setSettings(prev => ({ ...prev, enabled: checked }))
                }
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="cache_duration">Cache Duration</Label>
              <Select
                value={String(settings?.duration || 60)}
                onValueChange={(value) =>
                  setSettings(prev => ({ ...prev, duration: parseInt(value) }))
                }
                disabled={settings?.enabled === false}
              >
                <SelectTrigger id="cache_duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Disabled (0 seconds)</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute (recommended)</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="180">3 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                  <SelectItem value="600">10 minutes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                How long browsers and CDNs cache your product pages. Lower = updates appear faster.
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 p-4 space-y-2">
              <h4 className="font-medium text-sm">Current Settings:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Caching: <strong>{settings?.enabled === false ? 'Disabled' : 'Enabled'}</strong></li>
                <li>• Duration: <strong>{settings?.duration || 60} seconds</strong></li>
                <li>• Update visibility: <strong>{settings?.enabled === false ? 'Instant' : `~${Math.ceil((settings?.duration || 60) / 60)} minute(s)`}</strong></li>
              </ul>
            </div>

            <div className="rounded-lg bg-amber-50 p-4">
              <h4 className="font-medium text-sm mb-2">⚡ Performance Tip</h4>
              <p className="text-sm text-muted-foreground">
                We recommend <strong>60 seconds (1 minute)</strong> for the best balance between
                performance and update speed. Disable caching only if you need instant product updates.
              </p>
            </div>

            <div className="rounded-lg bg-purple-50 p-4">
              <h4 className="font-medium text-sm mb-2">📊 What Gets Cached?</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Product detail pages</li>
                <li>• Product listings</li>
                <li>• Category pages</li>
                <li>• Product tabs</li>
                <li>• Product labels</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton
              onClick={handleSave}
              loading={saving}
              success={saveSuccess}
              disabled={!selectedStore?.id}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
