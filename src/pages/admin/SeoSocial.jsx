import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import SaveButton from '@/components/ui/save-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Share2, Facebook, Twitter, Plus, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { SeoSetting } from '@/api/entities';
import FlashMessage from '@/components/storefront/FlashMessage';

export default function SeoSocial() {
  const { selectedStore: store } = useStoreSelection();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(null);

  // Form state - using consolidated social_media_settings
  const [settings, setSettings] = useState({
    social_media_settings: {
      open_graph: {
        enabled: true,
        default_title: '',
        default_description: '',
        default_image_url: '',
        facebook_app_id: '',
        facebook_page_url: ''
      },
      twitter: {
        enabled: true,
        card_type: 'summary_large_image',
        default_title: '',
        default_description: '',
        site_username: '',
        creator_username: ''
      },
      social_profiles: {
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: '',
        youtube: '',
        pinterest: '',
        tiktok: '',
        other: []
      },
      schema: {
        enable_product_schema: true,
        enable_organization_schema: true,
        enable_breadcrumb_schema: true,
        enable_social_profiles: true,
        organization_name: '',
        organization_logo_url: '',
        organization_description: '',
        contact_type: 'customer service',
        contact_telephone: '',
        contact_email: '',
        price_range: '',
        founded_year: '',
        founder_name: ''
      }
    }
  });


  // Helper function to update nested social media settings
  const updateSocialMediaSettings = (section, field, value) => {
    setSettings({
      ...settings,
      social_media_settings: {
        ...settings.social_media_settings,
        [section]: {
          ...settings.social_media_settings[section],
          [field]: value
        }
      }
    });
  };

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!store?.id) return;

      try {
        setLoading(true);
        const result = await SeoSetting.filter({ store_id: store.id });

        if (result && result.length > 0) {
          const existingSettings = result[0];

          // Use new consolidated structure, fall back to legacy fields if needed
          const socialMediaSettings = existingSettings.social_media_settings || {
            open_graph: existingSettings.open_graph_settings || {},
            twitter: existingSettings.twitter_card_settings || {},
            social_profiles: existingSettings.social_profiles || {},
            schema: existingSettings.schema_settings || {}
          };

          setSettings({
            id: existingSettings.id,
            social_media_settings: {
              open_graph: {
                enabled: socialMediaSettings.open_graph?.enabled !== false,
                default_title: socialMediaSettings.open_graph?.default_title || '',
                default_description: socialMediaSettings.open_graph?.default_description || '',
                default_image_url: socialMediaSettings.open_graph?.default_image_url || '',
                facebook_app_id: socialMediaSettings.open_graph?.facebook_app_id || '',
                facebook_page_url: socialMediaSettings.open_graph?.facebook_page_url || ''
              },
              twitter: {
                enabled: socialMediaSettings.twitter?.enabled !== false,
                card_type: socialMediaSettings.twitter?.card_type || 'summary_large_image',
                default_title: socialMediaSettings.twitter?.default_title || '',
                default_description: socialMediaSettings.twitter?.default_description || '',
                site_username: socialMediaSettings.twitter?.site_username || '',
                creator_username: socialMediaSettings.twitter?.creator_username || ''
              },
              social_profiles: {
                facebook: socialMediaSettings.social_profiles?.facebook || '',
                twitter: socialMediaSettings.social_profiles?.twitter || '',
                instagram: socialMediaSettings.social_profiles?.instagram || '',
                linkedin: socialMediaSettings.social_profiles?.linkedin || '',
                youtube: socialMediaSettings.social_profiles?.youtube || '',
                pinterest: socialMediaSettings.social_profiles?.pinterest || '',
                tiktok: socialMediaSettings.social_profiles?.tiktok || '',
                other: socialMediaSettings.social_profiles?.other || []
              },
              schema: {
                enable_product_schema: socialMediaSettings.schema?.enable_product_schema !== false,
                enable_organization_schema: socialMediaSettings.schema?.enable_organization_schema !== false,
                enable_breadcrumb_schema: socialMediaSettings.schema?.enable_breadcrumb_schema !== false,
                enable_social_profiles: socialMediaSettings.schema?.enable_social_profiles !== false,
                organization_name: socialMediaSettings.schema?.organization_name || '',
                organization_logo_url: socialMediaSettings.schema?.organization_logo_url || '',
                organization_description: socialMediaSettings.schema?.organization_description || '',
                contact_type: socialMediaSettings.schema?.contact_type || 'customer service',
                contact_telephone: socialMediaSettings.schema?.contact_telephone || '',
                contact_email: socialMediaSettings.schema?.contact_email || '',
                price_range: socialMediaSettings.schema?.price_range || '',
                founded_year: socialMediaSettings.schema?.founded_year || '',
                founder_name: socialMediaSettings.schema?.founder_name || ''
              }
            }
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

    console.log('Starting save with store ID:', store.id);
    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload = {
        store_id: store.id,
        social_media_settings: settings.social_media_settings
      };

      console.log('Payload to save:', payload);
      console.log('Existing settings ID:', settings.id);

      let response;
      if (settings.id) {
        console.log('Updating existing settings with ID:', settings.id);
        response = await SeoSetting.update(settings.id, payload);
        console.log('Update response:', response);
      } else {
        console.log('Creating new settings');
        response = await SeoSetting.create(payload);
        console.log('Create response:', response);

        // Handle different response formats
        const createdData = Array.isArray(response) ? response[0] : response;
        if (createdData?.id) {
          setSettings({ ...settings, id: createdData.id });
        }
      }

      setSaveSuccess(true);
      console.log('Save successful!');
      setFlashMessage({
        type: 'success',
        message: 'Social media settings saved successfully!'
      });
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving SEO settings:', error);
      console.error('Error details:', error.message, error.stack);
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
          <Share2 className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Social Media & Schema</h1>
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
          <Share2 className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Social Media & Schema</h1>
        </div>
      </div>

      <Tabs defaultValue="opengraph">
        <TabsList>
          <TabsTrigger value="opengraph">Open Graph</TabsTrigger>
          <TabsTrigger value="twitter">Twitter Card</TabsTrigger>
          <TabsTrigger value="social">Social Profiles</TabsTrigger>
          <TabsTrigger value="schema">Schema Markup</TabsTrigger>
        </TabsList>

        <TabsContent value="opengraph" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Open Graph Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="og-enabled" className="text-base font-semibold">Enable Open Graph</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable Open Graph meta tags for social media sharing (Facebook, LinkedIn, etc.)
                  </p>
                </div>
                <Switch
                  id="og-enabled"
                  checked={settings.social_media_settings.open_graph.enabled}
                  onCheckedChange={(checked) => updateSocialMediaSettings('open_graph', 'enabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-title">Default OG Title (Optional)</Label>
                <Input
                  id="og-title"
                  placeholder="{{store_name}} - Quality Products"
                  value={settings.social_media_settings.open_graph.default_title}
                  onChange={(e) => updateSocialMediaSettings('open_graph', 'default_title', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Default title for social sharing. Supports templates: {'{'}{'{'} store_name {'}}'}{'}'}, {'{'}{'{'} page_title {'}'}{'}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-description">Default OG Description (Optional)</Label>
                <Textarea
                  id="og-description"
                  placeholder="Discover quality products at {{store_name}}"
                  value={settings.social_media_settings.open_graph.default_description}
                  onChange={(e) => updateSocialMediaSettings('open_graph', 'default_description', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Default description for social sharing
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="og-image">Default OG Image URL</Label>
                <Input
                  id="og-image"
                  placeholder="https://example.com/og-image.jpg"
                  value={settings.social_media_settings.open_graph.default_image_url}
                  onChange={(e) => updateSocialMediaSettings('open_graph', 'default_image_url', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Recommended: 1200x630px for optimal display. This will be used as fallback when pages don't have specific OG images.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fb-app-id">Facebook App ID (Optional)</Label>
                <Input
                  id="fb-app-id"
                  placeholder="1234567890"
                  value={settings.social_media_settings.open_graph.facebook_app_id}
                  onChange={(e) => updateSocialMediaSettings('open_graph', 'facebook_app_id', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Used for Facebook analytics and insights
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fb-page-url">Facebook Page URL (Optional)</Label>
                <Input
                  id="fb-page-url"
                  placeholder="https://facebook.com/yourstore"
                  value={settings.social_media_settings.open_graph.facebook_page_url}
                  onChange={(e) => updateSocialMediaSettings('open_graph', 'facebook_page_url', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Link to your Facebook business page (used for article:publisher tag)
                </p>
              </div>

              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">💡 Tip:</h4>
                <p className="text-sm text-muted-foreground">
                  This Facebook Page URL is used specifically for Open Graph article:publisher metadata. It should match your Facebook profile in the "Social Profiles" tab for consistency.
                </p>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Open Graph Best Practices:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Image should be 1200x630px for optimal display on all platforms</li>
                  <li>Title should be 40-60 characters</li>
                  <li>Description should be 155-160 characters</li>
                  <li>Use high-quality images that represent your brand</li>
                  <li>Test your OG tags with Facebook Sharing Debugger</li>
                </ul>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="twitter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Twitter Card Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="twitter-enabled" className="text-base font-semibold">Enable Twitter Card</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable Twitter Card meta tags for enhanced sharing on X/Twitter
                  </p>
                </div>
                <Switch
                  id="twitter-enabled"
                  checked={settings.social_media_settings.twitter.enabled}
                  onCheckedChange={(checked) => updateSocialMediaSettings('twitter', 'enabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-title">Default Twitter Title (Optional)</Label>
                <Input
                  id="twitter-title"
                  placeholder="{{store_name}} - Quality Products"
                  value={settings.social_media_settings.twitter.default_title}
                  onChange={(e) => updateSocialMediaSettings('twitter', 'default_title', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Default title for Twitter sharing. Supports templates: {'{'}{'{'} store_name {'}}'}{'}'}, {'{'}{'{'} page_title {'}'}{'}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-description">Default Twitter Description (Optional)</Label>
                <Textarea
                  id="twitter-description"
                  placeholder="Discover quality products at {{store_name}}"
                  value={settings.social_media_settings.twitter.default_description}
                  onChange={(e) => updateSocialMediaSettings('twitter', 'default_description', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Default description for Twitter sharing
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-card">Card Type</Label>
                <Select
                  value={settings.social_media_settings.twitter.card_type}
                  onValueChange={(value) => updateSocialMediaSettings('twitter', 'card_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Summary</SelectItem>
                    <SelectItem value="summary_large_image">Summary Large Image</SelectItem>
                    <SelectItem value="app">App</SelectItem>
                    <SelectItem value="player">Player</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-site">Twitter Site Username</Label>
                <Input
                  id="twitter-site"
                  placeholder="@yourstore"
                  value={settings.social_media_settings.twitter.site_username}
                  onChange={(e) => updateSocialMediaSettings('twitter', 'site_username', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Your store's Twitter/X handle (with or without @). Shown as the site attribution.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter-creator">Twitter Creator Username (Optional)</Label>
                <Input
                  id="twitter-creator"
                  placeholder="@contentcreator"
                  value={settings.social_media_settings.twitter.creator_username}
                  onChange={(e) => updateSocialMediaSettings('twitter', 'creator_username', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Attribution for the content creator (individual, not brand)
                </p>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Twitter Card Best Practices:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>"Summary Large Image" is recommended for most e-commerce sites</li>
                  <li>Images should be at least 300x157px (better 1200x628px)</li>
                  <li>Use @site for brand account, @creator for author attribution</li>
                  <li>Validate cards with Twitter Card Validator</li>
                  <li>Cards appear when your URLs are shared on X/Twitter</li>
                </ul>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Profiles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <h4 className="font-semibold text-sm mb-2">ℹ️ About Social Profiles</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  These URLs are included in your website's Schema.org structured data and help search engines understand your brand's online presence.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> For best results, ensure your Facebook URL here matches the "Facebook Page URL" in Open Graph settings, and your Twitter URL corresponds to the handle in Twitter Card settings.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="social-facebook">
                    <Facebook className="w-4 h-4 inline mr-2" />
                    Facebook
                  </Label>
                  <Input
                    id="social-facebook"
                    placeholder="https://facebook.com/yourstore"
                    value={settings.social_media_settings.social_profiles.facebook}
                    onChange={(e) => updateSocialMediaSettings('social_profiles', 'facebook', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social-twitter">
                    <Twitter className="w-4 h-4 inline mr-2" />
                    Twitter / X
                  </Label>
                  <Input
                    id="social-twitter"
                    placeholder="https://twitter.com/yourstore"
                    value={settings.social_media_settings.social_profiles.twitter}
                    onChange={(e) => updateSocialMediaSettings('social_profiles', 'twitter', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social-instagram">
                    <Share2 className="w-4 h-4 inline mr-2" />
                    Instagram
                  </Label>
                  <Input
                    id="social-instagram"
                    placeholder="https://instagram.com/yourstore"
                    value={settings.social_media_settings.social_profiles.instagram}
                    onChange={(e) => updateSocialMediaSettings('social_profiles', 'instagram', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social-linkedin">
                    <Share2 className="w-4 h-4 inline mr-2" />
                    LinkedIn
                  </Label>
                  <Input
                    id="social-linkedin"
                    placeholder="https://linkedin.com/company/yourstore"
                    value={settings.social_media_settings.social_profiles.linkedin}
                    onChange={(e) => updateSocialMediaSettings('social_profiles', 'linkedin', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social-youtube">
                    <Share2 className="w-4 h-4 inline mr-2" />
                    YouTube
                  </Label>
                  <Input
                    id="social-youtube"
                    placeholder="https://youtube.com/@yourstore"
                    value={settings.social_media_settings.social_profiles.youtube}
                    onChange={(e) => updateSocialMediaSettings('social_profiles', 'youtube', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social-pinterest">
                    <Share2 className="w-4 h-4 inline mr-2" />
                    Pinterest
                  </Label>
                  <Input
                    id="social-pinterest"
                    placeholder="https://pinterest.com/yourstore"
                    value={settings.social_media_settings.social_profiles.pinterest}
                    onChange={(e) => updateSocialMediaSettings('social_profiles', 'pinterest', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="social-tiktok">
                    <Share2 className="w-4 h-4 inline mr-2" />
                    TikTok
                  </Label>
                  <Input
                    id="social-tiktok"
                    placeholder="https://tiktok.com/@yourstore"
                    value={settings.social_media_settings.social_profiles.tiktok}
                    onChange={(e) => updateSocialMediaSettings('social_profiles', 'tiktok', e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Best Practices:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Use complete profile URLs, not just usernames</li>
                  <li>Ensure your profiles are public and active</li>
                  <li>Keep profile information consistent across platforms</li>
                  <li>These URLs will be included in your site's structured data</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schema" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schema Markup Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="schema-product" className="text-base font-semibold">Enable Product Schema</Label>
                    <p className="text-sm text-muted-foreground">
                      Add structured data for product pages
                    </p>
                  </div>
                  <Switch
                    id="schema-product"
                    checked={settings.social_media_settings.schema.enable_product_schema}
                    onCheckedChange={(checked) => updateSocialMediaSettings('schema', 'enable_product_schema', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="schema-organization" className="text-base font-semibold">Enable Organization Schema</Label>
                    <p className="text-sm text-muted-foreground">
                      Add structured data for organization information
                    </p>
                  </div>
                  <Switch
                    id="schema-organization"
                    checked={settings.social_media_settings.schema.enable_organization_schema}
                    onCheckedChange={(checked) => updateSocialMediaSettings('schema', 'enable_organization_schema', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="schema-breadcrumb" className="text-base font-semibold">Enable Breadcrumb Schema</Label>
                    <p className="text-sm text-muted-foreground">
                      Add structured data for navigation breadcrumbs
                    </p>
                  </div>
                  <Switch
                    id="schema-breadcrumb"
                    checked={settings.social_media_settings.schema.enable_breadcrumb_schema}
                    onCheckedChange={(checked) => updateSocialMediaSettings('schema', 'enable_breadcrumb_schema', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="schema-social-profiles" className="text-base font-semibold">Enable Social Profiles</Label>
                    <p className="text-sm text-muted-foreground">
                      Include social media profiles in structured data
                    </p>
                  </div>
                  <Switch
                    id="schema-social-profiles"
                    checked={settings.social_media_settings.schema.enable_social_profiles}
                    onCheckedChange={(checked) => updateSocialMediaSettings('schema', 'enable_social_profiles', checked)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  placeholder="Your Company Name"
                  value={settings.social_media_settings.schema.organization_name}
                  onChange={(e) => updateSocialMediaSettings('schema', 'organization_name', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Used in structured data markup for search engines
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-logo">Organization Logo URL</Label>
                <Input
                  id="org-logo"
                  placeholder="https://example.com/logo.png"
                  value={settings.social_media_settings.schema.organization_logo_url}
                  onChange={(e) => updateSocialMediaSettings('schema', 'organization_logo_url', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  URL to your organization's logo image
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-description">Organization Description (Optional)</Label>
                <Textarea
                  id="org-description"
                  placeholder="Brief description of your organization"
                  value={settings.social_media_settings.schema.organization_description}
                  onChange={(e) => updateSocialMediaSettings('schema', 'organization_description', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  A brief description of your organization for structured data
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-type">Contact Type (Optional)</Label>
                  <Select
                    value={settings.social_media_settings.schema.contact_type}
                    onValueChange={(value) => updateSocialMediaSettings('schema', 'contact_type', value)}
                  >
                    <SelectTrigger id="contact-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer service">Customer Service</SelectItem>
                      <SelectItem value="technical support">Technical Support</SelectItem>
                      <SelectItem value="billing support">Billing Support</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-telephone">Contact Telephone (Optional)</Label>
                  <Input
                    id="contact-telephone"
                    placeholder="+1-555-123-4567"
                    value={settings.social_media_settings.schema.contact_telephone}
                    onChange={(e) => updateSocialMediaSettings('schema', 'contact_telephone', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email">Contact Email (Optional)</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="contact@example.com"
                    value={settings.social_media_settings.schema.contact_email}
                    onChange={(e) => updateSocialMediaSettings('schema', 'contact_email', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price-range">Price Range (Optional)</Label>
                  <Input
                    id="price-range"
                    placeholder="$$"
                    value={settings.social_media_settings.schema.price_range}
                    onChange={(e) => updateSocialMediaSettings('schema', 'price_range', e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    E.g., $, $$, $$$, or $$$$
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="founded-year">Founded Year (Optional)</Label>
                  <Input
                    id="founded-year"
                    type="number"
                    placeholder="2020"
                    value={settings.social_media_settings.schema.founded_year}
                    onChange={(e) => updateSocialMediaSettings('schema', 'founded_year', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="founder-name">Founder Name (Optional)</Label>
                  <Input
                    id="founder-name"
                    placeholder="John Doe"
                    value={settings.social_media_settings.schema.founder_name}
                    onChange={(e) => updateSocialMediaSettings('schema', 'founder_name', e.target.value)}
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-sm mb-2">ℹ️ Note:</h4>
                <p className="text-sm text-muted-foreground">
                  Social media profiles are configured in the "Social Profiles" tab. When "Enable Social Profiles" is turned on above, they will be included in your Schema.org structured data (Organization schema).
                </p>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-6">
        <SaveButton
          onClick={handleSave}
          loading={saving}
          success={saveSuccess}
          defaultText="Save All Settings"
        />
      </div>
    </div>
  );
}