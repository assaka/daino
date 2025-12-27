import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SaveButton from '@/components/ui/save-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SeoSetting } from "@/api/entities";
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import FlashMessage from "@/components/storefront/FlashMessage";
import NoStoreSelected from "@/components/admin/NoStoreSelected";
import { PageLoader } from "@/components/ui/page-loader";

export default function SeoHreflang() {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHreflangFields, setShowHreflangFields] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);

  const [seoSettings, setSeoSettings] = useState({
    hreflang_settings: [],
    canonical_settings: {
      base_url: '',
      auto_canonical_filtered_pages: true
    },
    store_id: ''
  });

  useEffect(() => {
    // Only load data if store is selected
    if (selectedStore?.id) {
      loadData();
    }
  }, [selectedStore?.id]);

  const loadData = async () => {
    const storeId = getSelectedStoreId();
    if (!storeId) {
      return;
    }

    setLoading(true);
    try {
      const settingsData = await SeoSetting.filter({ store_id: storeId });

      if (settingsData && settingsData.length > 0) {
        const loadedSettings = settingsData[0];

        setSeoSettings({
          ...loadedSettings,
          hreflang_settings: Array.isArray(loadedSettings.hreflang_settings) ? loadedSettings.hreflang_settings : [],
          canonical_settings: loadedSettings.canonical_settings || {
            base_url: '',
            auto_canonical_filtered_pages: true
          },
          store_id: storeId
        });

        // Auto-enable hreflang fields if there are existing settings
        if (loadedSettings.hreflang_settings && loadedSettings.hreflang_settings.length > 0) {
          setShowHreflangFields(true);
        }
      } else {
        setSeoSettings(prev => ({
          ...prev,
          store_id: storeId
        }));
      }
    } catch (error) {
      console.error("Error loading SEO settings:", error);
      // Don't show error flash message on initial load
      // Just log it and continue
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      if (seoSettings.id) {
        await SeoSetting.update(seoSettings.id, seoSettings);
      } else {
        await SeoSetting.create(seoSettings);
      }

      setSaveSuccess(true);
      setFlashMessage({
        type: 'success',
        message: 'Hreflang settings saved successfully!'
      });

      // Reload to get the updated data
      await loadData();
    } catch (error) {
      console.error('Error saving hreflang settings:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to save hreflang settings.'
      });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const addHreflangSetting = () => {
    setSeoSettings(prev => ({
      ...prev,
      hreflang_settings: [
        ...prev.hreflang_settings,
        {
          language_code: '',
          country_code: '',
          url_pattern: '{{base_url}}/{{language_code}}{{relative_path}}',
          is_active: true
        }
      ]
    }));
  };

  const updateHreflangSetting = (index, field, value) => {
    setSeoSettings(prev => ({
      ...prev,
      hreflang_settings: prev.hreflang_settings.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeHreflangSetting = (index) => {
    setSeoSettings(prev => ({
      ...prev,
      hreflang_settings: prev.hreflang_settings.filter((_, i) => i !== index)
    }));
  };

  if (!selectedStore) {
    return <NoStoreSelected />;
  }

  if (loading) {
    return <PageLoader size="lg" />;
  }

  const activeLanguages = selectedStore?.settings?.active_languages || [];
  const hasActiveLanguages = activeLanguages.length > 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Hreflang Tags</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              Hreflang Settings
              <div className="flex items-center gap-2">
                <Switch
                  checked={showHreflangFields}
                  onCheckedChange={setShowHreflangFields}
                />
                <Label className="text-sm font-normal">Enable hreflang tags</Label>
              </div>
            </div>
            {showHreflangFields && (
              <Button onClick={addHreflangSetting}>
                <Plus className="w-4 h-4 mr-2" />
                Add Language
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showHreflangFields && (
            <p className="text-gray-600">
              Enable hreflang tags to configure language and region targeting for search engines.
            </p>
          )}

          {showHreflangFields && (
            <>
              {!hasActiveLanguages && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-900 mb-1">No Active Languages Configured</h4>
                      <p className="text-sm text-yellow-800">
                        Please configure your store's active languages in the{' '}
                        <a href="/admin/settings" className="underline font-medium">Store Settings</a>{' '}
                        page before adding hreflang tags. Active languages are used to populate the language dropdown.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {seoSettings.hreflang_settings.length > 0 ? (
                <div className="space-y-4">
                  {seoSettings.hreflang_settings.map((hreflang, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                          <Label>Language Code</Label>
                          {hasActiveLanguages ? (
                            <Select
                              value={hreflang.language_code}
                              onValueChange={(value) => updateHreflangSetting(index, 'language_code', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeLanguages.map((lang) => (
                                  <SelectItem key={lang} value={lang}>
                                    {lang.toUpperCase()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={hreflang.language_code}
                              onChange={(e) => updateHreflangSetting(index, 'language_code', e.target.value)}
                              placeholder="en"
                            />
                          )}
                        </div>
                        <div>
                          <Label>Country Code (Optional)</Label>
                          <Input
                            value={hreflang.country_code}
                            onChange={(e) => updateHreflangSetting(index, 'country_code', e.target.value)}
                            placeholder="US"
                          />
                        </div>
                        <div>
                          <Label>URL Pattern</Label>
                          <Input
                            value={hreflang.url_pattern}
                            onChange={(e) => updateHreflangSetting(index, 'url_pattern', e.target.value)}
                            placeholder="{{base_url}}/{{language_code}}{{relative_path}}"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={hreflang.is_active}
                              onCheckedChange={(checked) => updateHreflangSetting(index, 'is_active', checked)}
                            />
                            <Label>Active</Label>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeHreflangSetting(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Preview: {hreflang.url_pattern
                          .replace(/\{\{base_url\}\}/g, seoSettings.canonical_settings?.base_url || 'https://yourdomain.com')
                          .replace(/\{\{language_code\}\}/g, hreflang.language_code || 'lang')
                          .replace(/\{\{absolute_path\}\}/g, '/public/storename/category/example')
                          .replace(/\{\{relative_path\}\}/g, '/category/example')
                          .replace(/\{\{current_url\}\}/g, '/current-page')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No hreflang settings configured yet. Click "Add Language" to get started.</p>
              )}

              <div className="bg-blue-50 p-4 rounded-lg mt-6">
                <h4 className="font-medium text-blue-900 mb-2">Hreflang Configuration</h4>
                <p className="text-sm text-blue-800 mb-2">
                  Hreflang tags help search engines understand which language and region your content targets.
                  Use the "Active" toggle on each language to control whether it's rendered on your site.
                </p>
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">Available variables in URL patterns:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><code>{'{{base_url}}'}</code> - Your canonical base URL</li>
                    <li><code>{'{{absolute_path}}'}</code> - Full current path including store prefix</li>
                    <li><code>{'{{relative_path}}'}</code> - Clean content path without store prefix (recommended for custom domains)</li>
                    <li><code>{'{{language_code}}'}</code> - The language code (e.g., 'en', 'de')</li>
                  </ul>
                  <p className="text-xs mt-2 bg-blue-100 p-2 rounded">
                    💡 <strong>Tip:</strong> Use <code>{'{{base_url}}/{{language_code}}{{relative_path}}'}</code> for URLs that work with custom domains
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end mt-4">
        <SaveButton
            onClick={handleSave}
            loading={saving}
            success={saveSuccess}
            defaultText="Save Hreflang Settings"
        />
      </div>
    </div>
  );
}
