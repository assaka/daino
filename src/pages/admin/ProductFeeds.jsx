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
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Rss className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Product Feeds</h1>
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

      <div className="flex items-center gap-2 mb-6">
        <Rss className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Product Feeds</h1>
      </div>

      <p className="text-muted-foreground -mt-4 mb-6">
        Generate product feeds for Google Shopping, Microsoft Ads, AI assistants, and more.
      </p>

      <Tabs defaultValue="feeds" className="space-y-6">
        <TabsList>
          <TabsTrigger value="feeds">Feed URLs</TabsTrigger>
          <TabsTrigger value="mappings">Attribute Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="feeds" className="space-y-4">
          {/* Benefits Section */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-green-900">Why use product feeds?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 text-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <ShoppingBag className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-900">Reach more customers</h4>
                    <p className="text-muted-foreground">Your products appear in Google Shopping, Bing Shopping, and comparison sites - reaching millions of shoppers actively searching for products.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-900">AI-powered discovery</h4>
                    <p className="text-muted-foreground">AI assistants like ChatGPT, Google Gemini, and Copilot can recommend your products to users asking for shopping advice.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Globe className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-900">Better SEO & visibility</h4>
                    <p className="text-muted-foreground">Structured product data helps search engines understand your products, improving rankings and enabling rich snippets in search results.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
              <CardTitle className="text-base">How to add feeds to shopping platforms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <h4 className="font-semibold text-blue-900">Google Merchant Center</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to <a href="https://merchants.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">merchants.google.com</a></li>
                  <li>Navigate to <strong>Products → Feeds</strong></li>
                  <li>Click <strong>Add feed</strong> (+ button)</li>
                  <li>Select your country and language</li>
                  <li>Choose <strong>Scheduled fetch</strong> as the input method</li>
                  <li>Paste the Google Merchant feed URL above</li>
                  <li>Set fetch frequency (daily recommended)</li>
                </ol>
              </div>

              <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-2">
                <h4 className="font-semibold text-cyan-900">Microsoft Merchant Center</h4>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to <a href="https://ads.microsoft.com/merchant" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ads.microsoft.com/merchant</a></li>
                  <li>Navigate to <strong>Feed management</strong></li>
                  <li>Click <strong>Create feed</strong></li>
                  <li>Select <strong>Download from URL</strong></li>
                  <li>Paste the Microsoft Merchant feed URL above</li>
                  <li>Configure schedule and save</li>
                </ol>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-3">
                <h4 className="font-semibold text-purple-900">AI Shopping Assistants</h4>
                <p className="text-muted-foreground">
                  AI assistants discover your products through multiple channels:
                </p>
                <div className="space-y-2 text-muted-foreground">
                  <div className="pl-3 border-l-2 border-purple-300">
                    <strong className="text-purple-800">Google Gemini:</strong> Uses your Google Merchant Center feed.
                    When users ask Gemini for product recommendations, it pulls from Shopping data.
                  </div>
                  <div className="pl-3 border-l-2 border-purple-300">
                    <strong className="text-purple-800">Microsoft Copilot:</strong> Uses your Microsoft Merchant Center feed.
                    Copilot in Bing and Edge can recommend your products to shoppers.
                  </div>
                  <div className="pl-3 border-l-2 border-purple-300">
                    <strong className="text-purple-800">ChatGPT & Custom GPTs:</strong> Create a <a href="https://chat.openai.com/gpts" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Custom GPT</a> that
                    fetches your ChatGPT feed URL via Actions. Users can then ask your GPT for product recommendations.
                  </div>
                  <div className="pl-3 border-l-2 border-purple-300">
                    <strong className="text-purple-800">Schema.org / Web Crawlers:</strong> The Universal feed provides
                    structured data that AI crawlers (like GPTBot, Google-Extended) can index from your sitemap.
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Tip: Submitting to Google and Microsoft Merchant Centers automatically makes your products
                  discoverable by their AI assistants (Gemini and Copilot).
                </p>
              </div>
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
