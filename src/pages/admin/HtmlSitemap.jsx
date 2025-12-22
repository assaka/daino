import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import SaveButton from '@/components/ui/save-button';
import { FileText, ExternalLink } from "lucide-react";
import { SeoSetting } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import FlashMessage from '@/components/storefront/FlashMessage';

export default function HtmlSitemap() {
  const { selectedStore: store } = useStoreSelection();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);

  // HTML Sitemap Settings
  const [enableHtmlSitemap, setEnableHtmlSitemap] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [includeProducts, setIncludeProducts] = useState(true);
  const [includePages, setIncludePages] = useState(true);
  const [maxProducts, setMaxProducts] = useState(20);
  const [productSort, setProductSort] = useState('-updated_date');
  const [seoSettingsId, setSeoSettingsId] = useState(null);

  useEffect(() => {
    if (store?.id) {
      loadSettings();
    }
  }, [store?.id]);

  const loadSettings = async () => {
    try {
      const settings = await SeoSetting.filter({ store_id: store.id });
      if (settings && settings.length > 0) {
        const s = settings[0];
        setSeoSettingsId(s.id);

        // Extract from JSON field
        const htmlSettings = s.html_sitemap_settings || {};

        setEnableHtmlSitemap(htmlSettings.enabled ?? true);
        setIncludeCategories(htmlSettings.include_categories ?? true);
        setIncludeProducts(htmlSettings.include_products ?? true);
        setIncludePages(htmlSettings.include_pages ?? true);
        setMaxProducts(htmlSettings.max_products ?? 20);
        setProductSort(htmlSettings.product_sort ?? '-updated_date');
      }
    } catch (error) {
      console.error('Error loading SEO settings:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to load SEO settings'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      // Package HTML sitemap settings into JSON structure
      const htmlSitemapSettings = {
        enabled: enableHtmlSitemap,
        include_categories: includeCategories,
        include_products: includeProducts,
        include_pages: includePages,
        max_products: maxProducts,
        product_sort: productSort
      };

      const data = {
        store_id: store.id,
        html_sitemap_settings: htmlSitemapSettings
      };

      if (seoSettingsId) {
        await SeoSetting.update(seoSettingsId, data);
      } else {
        const created = await SeoSetting.create(data);
        setSeoSettingsId(created.id);
      }

      setSaveSuccess(true);
      setFlashMessage({
        type: 'success',
        message: 'HTML sitemap settings saved successfully'
      });
    } catch (error) {
      console.error('Error saving SEO settings:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to save SEO settings'
      });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />

      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-6 w-6" />
        <h1 className="text-3xl font-bold">HTML Sitemap Configuration</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>HTML Sitemap Settings</CardTitle>
          </div>
          <CardDescription>
            Configure what appears in your HTML sitemap page for visitors and search engines
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="enable-html-sitemap"
              checked={enableHtmlSitemap}
              onCheckedChange={setEnableHtmlSitemap}
            />
            <Label htmlFor="enable-html-sitemap">Enable HTML Sitemap</Label>
          </div>

          {enableHtmlSitemap && (
            <>
              <div className="pl-6 space-y-4 border-l-2 border-gray-200">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-categories"
                    checked={includeCategories}
                    onCheckedChange={setIncludeCategories}
                  />
                  <Label htmlFor="include-categories">Include Categories</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-products"
                    checked={includeProducts}
                    onCheckedChange={setIncludeProducts}
                  />
                  <Label htmlFor="include-products">Include Products</Label>
                </div>

                {includeProducts && (
                  <div className="pl-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="max-products">Maximum Products to Display</Label>
                      <Input
                        id="max-products"
                        type="number"
                        min="1"
                        max="100"
                        value={maxProducts}
                        onChange={(e) => setMaxProducts(parseInt(e.target.value) || 20)}
                        placeholder="20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product-sort">Product Sort Order</Label>
                      <select
                        id="product-sort"
                        value={productSort}
                        onChange={(e) => setProductSort(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="-updated_date">Recently Updated</option>
                        <option value="updated_date">Oldest Updated</option>
                        <option value="-created_date">Newest First</option>
                        <option value="created_date">Oldest First</option>
                        <option value="name">Name (A-Z)</option>
                        <option value="-name">Name (Z-A)</option>
                        <option value="-price">Price (High to Low)</option>
                        <option value="price">Price (Low to High)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-pages"
                    checked={includePages}
                    onCheckedChange={setIncludePages}
                  />
                  <Label htmlFor="include-pages">Include CMS Pages</Label>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-800">
                    <strong>Public URL:</strong> /public/{store?.slug || 'your-store'}/sitemap
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `/public/${store?.slug || 'your-store'}/sitemap`;
                      window.open(url, '_blank');
                    }}
                    disabled={!store?.slug}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-end mt-8">
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
