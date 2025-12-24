import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SaveButton from '@/components/ui/save-button';
import { Copy, ExternalLink, Rss, ShoppingBag, Bot, Globe, Check, RefreshCw } from "lucide-react";
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { AdminAttribute, AdminSeoSetting } from '@/api/admin-entities';
import FlashMessage from '@/components/storefront/FlashMessage';

export default function ProductFeeds() {
  const { selectedStore: store } = useStoreSelection();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attributes, setAttributes] = useState([]);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);

  // Attribute mappings for feed fields
  const [mappings, setMappings] = useState({
    brand: '',
    mpn: '',
    manufacturer: '',
    color: '',
    size: '',
    material: '',
    gender: '',
    age_group: ''
  });

  // Build feed URLs based on store
  const getBaseUrl = () => {
    if (store?.domain) {
      return `https://${store.domain}`;
    }
    return window.location.origin;
  };

  const feedUrls = {
    googleMerchant: `${getBaseUrl()}/api/public/${store?.slug}/google-merchant.xml`,
    microsoftMerchant: `${getBaseUrl()}/api/public/${store?.slug}/microsoft-merchant.xml`,
    chatgpt: `${getBaseUrl()}/api/public/${store?.slug}/chatgpt-feed.json`,
    universal: `${getBaseUrl()}/api/public/${store?.slug}/universal-feed.json`
  };

  // Load attributes and existing mappings
  useEffect(() => {
    const loadData = async () => {
      if (!store?.id) return;

      try {
        setLoading(true);

        // Load attributes
        const attrs = await AdminAttribute.filter({ store_id: store.id });
        setAttributes(attrs || []);

        // Load existing mappings from SEO settings
        const seoSettings = await AdminSeoSetting.filter({ store_id: store.id });
        if (seoSettings && seoSettings.length > 0) {
          const feedMappings = seoSettings[0].feed_attribute_mappings || {};
          setMappings(prev => ({ ...prev, ...feedMappings }));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [store?.id]);

  const handleSave = async () => {
    if (!store?.id) return;

    setSaving(true);
    try {
      // Get existing SEO settings
      const existing = await AdminSeoSetting.filter({ store_id: store.id });

      const payload = {
        store_id: store.id,
        feed_attribute_mappings: mappings
      };

      if (existing && existing.length > 0) {
        await AdminSeoSetting.update(existing[0].id, payload);
      } else {
        await AdminSeoSetting.create(payload);
      }

      setFlashMessage({ type: 'success', message: 'Feed settings saved successfully!' });
      setTimeout(() => setFlashMessage(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setFlashMessage({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (url, feedName) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(feedName);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const openInNewTab = (url) => {
    window.open(url, '_blank');
  };

  const handleMappingChange = (field, value) => {
    setMappings(prev => ({
      ...prev,
      [field]: value === 'none' ? '' : value
    }));
  };

  // Feed card component
  const FeedCard = ({ title, description, url, icon: Icon, feedKey, badge }) => (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-sm mt-1">{description}</CardDescription>
            </div>
          </div>
          {badge && (
            <Badge variant="secondary" className="text-xs">{badge}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Input
            value={url}
            readOnly
            className="font-mono text-sm bg-muted"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(url, feedKey)}
            title="Copy URL"
          >
            {copiedUrl === feedKey ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => openInNewTab(url)}
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Attribute mapping selector
  const AttributeMapper = ({ label, field, description }) => (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Select
        value={mappings[field] || 'none'}
        onValueChange={(value) => handleMappingChange(field, value)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select attribute..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">-- Not mapped --</SelectItem>
          {attributes.map(attr => (
            <SelectItem key={attr.id} value={attr.code}>
              {attr.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {flashMessage && (
        <FlashMessage
          type={flashMessage.type}
          message={flashMessage.message}
          onClose={() => setFlashMessage(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold">Product Feeds</h1>
        <p className="text-muted-foreground mt-1">
          Generate product feeds for Google Shopping, Microsoft Ads, AI assistants, and more.
        </p>
      </div>

      <Tabs defaultValue="feeds" className="space-y-6">
        <TabsList>
          <TabsTrigger value="feeds">Feed URLs</TabsTrigger>
          <TabsTrigger value="mappings">Attribute Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="feeds" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FeedCard
              title="Google Merchant Center"
              description="RSS 2.0 XML feed for Google Shopping"
              url={feedUrls.googleMerchant}
              icon={ShoppingBag}
              feedKey="google"
              badge="XML"
            />

            <FeedCard
              title="Microsoft Merchant Center"
              description="RSS 2.0 XML feed for Microsoft/Bing Shopping"
              url={feedUrls.microsoftMerchant}
              icon={ShoppingBag}
              feedKey="microsoft"
              badge="XML"
            />

            <FeedCard
              title="ChatGPT / AI Assistants"
              description="JSON feed optimized for AI shopping assistants"
              url={feedUrls.chatgpt}
              icon={Bot}
              feedKey="chatgpt"
              badge="JSON"
            />

            <FeedCard
              title="Universal Schema.org"
              description="Schema.org compliant JSON-LD feed"
              url={feedUrls.universal}
              icon={Globe}
              feedKey="universal"
              badge="JSON-LD"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How to use these feeds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Google Merchant Center:</strong> Go to Products → Feeds → Add feed → Scheduled fetch,
                and paste the Google Merchant feed URL.
              </p>
              <p>
                <strong>Microsoft Merchant Center:</strong> Similar process - create a new feed and use the
                Microsoft Merchant URL for scheduled fetches.
              </p>
              <p>
                <strong>AI Assistants:</strong> The ChatGPT and Universal feeds are designed for AI shopping
                assistants. They include natural language descriptions and Schema.org structured data.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attribute Mappings</CardTitle>
              <CardDescription>
                Map your product attributes to standard feed fields. This tells the feed generators
                which of your attributes contain brand, MPN, and other product identifiers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <AttributeMapper
                  label="Brand"
                  field="brand"
                  description="The brand or manufacturer name (e.g., 'Nike', 'Apple')"
                />

                <AttributeMapper
                  label="MPN (Manufacturer Part Number)"
                  field="mpn"
                  description="Unique product identifier from the manufacturer"
                />

                <AttributeMapper
                  label="Manufacturer"
                  field="manufacturer"
                  description="The company that makes the product (if different from brand)"
                />

                <AttributeMapper
                  label="Color"
                  field="color"
                  description="Product color for filtering and display"
                />

                <AttributeMapper
                  label="Size"
                  field="size"
                  description="Product size (e.g., 'S', 'M', 'L', '42')"
                />

                <AttributeMapper
                  label="Material"
                  field="material"
                  description="Product material (e.g., 'Cotton', 'Leather')"
                />

                <AttributeMapper
                  label="Gender"
                  field="gender"
                  description="Target gender (male, female, unisex)"
                />

                <AttributeMapper
                  label="Age Group"
                  field="age_group"
                  description="Target age group (adult, kids, infant, etc.)"
                />
              </div>

              <div className="flex justify-end pt-4 border-t">
                <SaveButton
                  onSave={handleSave}
                  saving={saving}
                  label="Save Mappings"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tips for better feeds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <strong>Create attributes:</strong> If you don't have a "brand" or "mpn" attribute yet,
                go to <a href="/admin/attributes" className="text-primary hover:underline">Product Attributes</a> to create them.
              </p>
              <p>
                <strong>Assign values:</strong> Make sure your products have values set for these attributes
                in the product editor.
              </p>
              <p>
                <strong>Google requirements:</strong> Google Shopping requires at least two of these: GTIN,
                MPN + Brand, or Brand alone for most product categories.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
