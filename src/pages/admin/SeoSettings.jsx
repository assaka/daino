import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SaveButton from '@/components/ui/save-button';
import { Settings } from "lucide-react";
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { SeoSetting } from '@/api/entities';
import FlashMessage from '@/components/storefront/FlashMessage';

export default function SeoSettings() {
  const { selectedStore: store } = useStoreSelection();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);

  // Form state
  const [settings, setSettings] = useState({
    site_title: '',
    title_separator: '|',
    default_meta_description: '',
    meta_keywords: '',
    meta_robots: 'index, follow',
    auto_generate_meta: true,
    enable_sitemap: true
  });

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!store?.id) return;

      try {
        setLoading(true);
        const result = await SeoSetting.filter({ store_id: store.id });

        if (result && result.length > 0) {
          const existingSettings = result[0];
          const defaultMeta = existingSettings.default_meta_settings || {};

          setSettings({
            id: existingSettings.id,
            site_title: defaultMeta.site_title || '',
            title_separator: defaultMeta.title_separator || '|',
            default_meta_description: defaultMeta.default_meta_description || defaultMeta.meta_description || '',
            meta_keywords: defaultMeta.meta_keywords || '',
            meta_robots: defaultMeta.meta_robots || 'index, follow',
            auto_generate_meta: defaultMeta.auto_generate_meta !== false,
            enable_sitemap: defaultMeta.enable_sitemap !== false
          });
        }
      } catch (error) {
        console.error('Error loading SEO settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [store?.id]);

  const handleSave = async () => {
    if (!store?.id) {
      console.error('No store ID available');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        store_id: store.id,
        default_meta_settings: {
          site_title: settings.site_title,
          title_separator: settings.title_separator,
          default_meta_description: settings.default_meta_description,
          meta_title: settings.site_title, // Use site_title as default meta_title
          meta_description: settings.default_meta_description,
          meta_keywords: settings.meta_keywords,
          meta_robots: settings.meta_robots,
          auto_generate_meta: settings.auto_generate_meta,
          enable_sitemap: settings.enable_sitemap
        }
      };

      let response;
      if (settings.id) {
        response = await SeoSetting.update(settings.id, payload);
      } else {
        response = await SeoSetting.create(payload);
        const createdData = Array.isArray(response) ? response[0] : response;
        if (createdData?.id) {
          setSettings({ ...settings, id: createdData.id });
        }
      }

      setSaveSuccess(true);
      setFlashMessage({
        type: 'success',
        message: 'SEO settings saved successfully!'
      });
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving SEO settings:', error);
      setFlashMessage({
        type: 'error',
        message: `Failed to save settings: ${error.message || 'Unknown error'}`
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-6 w-6" />
          <h1 className="text-3xl font-bold">SEO Settings</h1>
        </div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <FlashMessage
        message={flashMessage}
        onClose={() => setFlashMessage(null)}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6" />
          <h1 className="text-3xl font-bold">SEO Settings</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global SEO Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-title">Site Title</Label>
            <Input
              id="site-title"
              placeholder="Your Store Name"
              value={settings.site_title}
              onChange={(e) => setSettings({ ...settings, site_title: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              The main title for your store used in meta tags and page titles
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title-separator">Title Separator</Label>
            <Input
              id="title-separator"
              placeholder="|"
              value={settings.title_separator}
              onChange={(e) => setSettings({ ...settings, title_separator: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Character used to separate page title from site title (e.g., "Page | Store Name")
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-description">Default Meta Description</Label>
            <Textarea
              id="meta-description"
              placeholder="Default description for pages"
              value={settings.default_meta_description}
              onChange={(e) => setSettings({ ...settings, default_meta_description: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Fallback meta description used when pages don't have specific descriptions
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-keywords">Default Meta Keywords</Label>
            <Input
              id="meta-keywords"
              placeholder="ecommerce, online store, products"
              value={settings.meta_keywords}
              onChange={(e) => setSettings({ ...settings, meta_keywords: e.target.value })}
            />
            <p className="text-sm text-muted-foreground">
              Comma-separated keywords for SEO (optional, less important for modern SEO)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meta-robots">Default Meta Robots</Label>
            <Select
              value={settings.meta_robots}
              onValueChange={(value) => setSettings({ ...settings, meta_robots: value })}
            >
              <SelectTrigger id="meta-robots">
                <SelectValue placeholder="Select robots directive" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="index, follow">index, follow (Allow indexing, follow links)</SelectItem>
                <SelectItem value="noindex, nofollow">noindex, nofollow (Block indexing, follow links)</SelectItem>
                <SelectItem value="index, nofollow">index, nofollow (Allow indexing, do not follow links)</SelectItem>
                <SelectItem value="noindex, follow">noindex, follow (Block indexing, follow links)</SelectItem>
                <SelectItem value="none">none (Same as noindex, nofollow)</SelectItem>
                <SelectItem value="noarchive">noarchive (Prevent cached copy)</SelectItem>
                <SelectItem value="nosnippet">nosnippet (No text snippets in search results)</SelectItem>
                <SelectItem value="noimageindex">noimageindex (Don't index images on this page)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Controls how search engines index your pages
            </p>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <span className="text-blue-600">ℹ️</span>
              Available Template Variables
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              You can use these variables in your titles and descriptions. They will be automatically replaced with actual values:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div><code className="bg-white px-2 py-1 rounded">{'{{store_name}}'}</code> - Your store name</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{site_name}}'}</code> - Same as store name</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{page_title}}'}</code> - Current page title</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{separator}}'}</code> - Title separator character</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{product_name}}'}</code> - Product name (on product pages)</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{category_name}}'}</code> - Category name (on category pages)</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{product_description}}'}</code> - Product description</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{category_description}}'}</code> - Category description</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{store_description}}'}</code> - Your store description</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{base_url}}'}</code> - Your website URL</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{current_url}}'}</code> - Current page URL</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{year}}'}</code> - Current year</div>
              <div><code className="bg-white px-2 py-1 rounded">{'{{currency}}'}</code> - Store currency</div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              <strong>Example:</strong> <code className="bg-white px-2 py-1 rounded">{'{{page_title}} {{separator}} {{store_name}}'}</code> becomes "Product Name | My Store"
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="auto-generate" className="text-base font-semibold">Auto-generate meta tags</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate meta descriptions from page content when not set
              </p>
            </div>
            <Switch
              id="auto-generate"
              checked={settings.auto_generate_meta}
              onCheckedChange={(checked) => setSettings({ ...settings, auto_generate_meta: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="sitemap" className="text-base font-semibold">Enable XML Sitemap</Label>
              <p className="text-sm text-muted-foreground">
                Generate and enable XML sitemap for search engines
              </p>
            </div>
            <Switch
              id="sitemap"
              checked={settings.enable_sitemap}
              onCheckedChange={(checked) => setSettings({ ...settings, enable_sitemap: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SaveButton
          onClick={handleSave}
          loading={saving}
          success={saveSuccess}
          defaultText="Save Settings"
        />
      </div>
    </div>
  );
}