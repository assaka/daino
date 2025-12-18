
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { createCmsPageUrl } from '@/utils/urlUtils';
import { CookieConsentSettings, ConsentLog, CmsPage } from '@/api/entities';
import { User } from '@/api/entities';
import { Store } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import FlashMessage from '@/components/storefront/FlashMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Eye, Settings, BarChart3, Plus, Trash2, Download, Languages, Wand2 } from 'lucide-react';
import SaveButton from '@/components/ui/save-button';
import { Separator } from '@/components/ui/separator';
import { clearCookieConsentCache } from '@/utils/cacheUtils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import TranslationFields from "@/components/admin/TranslationFields";
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
        console.warn(`CookieConsent: Rate limit hit, retrying in ${delayTime}ms...`);
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

// Field mapping functions for frontend <-> backend compatibility
const mapBackendToFrontend = (backendSettings) => {
  if (!backendSettings) return null;

  // Handle translations with backward compatibility
  let translations = backendSettings.translations || {};

  // Get categories for translation initialization
  const categories = backendSettings.categories || [
    { id: "necessary", name: "Necessary Cookies", description: "These cookies are necessary for the website to function and cannot be switched off." },
    { id: "analytics", name: "Analytics Cookies", description: "These cookies help us understand how visitors interact with our website." },
    { id: "marketing", name: "Marketing Cookies", description: "These cookies are used to deliver personalized advertisements." },
    { id: "functional", name: "Functional Cookies", description: "These cookies enable enhanced functionality and personalization." }
  ];

  // Ensure English translation exists (backward compatibility)
  if (!translations.en || (!translations.en.banner_text && backendSettings.banner_text)) {
    translations.en = {
      banner_text: backendSettings.banner_text || "We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking 'Accept All', you consent to our use of cookies.",
      accept_button_text: backendSettings.accept_button_text || "Accept All",
      reject_button_text: backendSettings.reject_button_text || "Reject All",
      settings_button_text: backendSettings.settings_button_text || "Cookie Settings",
      save_preferences_button_text: backendSettings.save_preferences_button_text || "Save Preferences",
      privacy_policy_text: backendSettings.privacy_policy_text || "Privacy Policy"
    };
  }

  // Ensure category translations exist in English (backward compatibility)
  if (translations.en) {
    categories.forEach(category => {
      if (!translations.en[`${category.id}_name`]) {
        translations.en[`${category.id}_name`] = category.name;
      }
      if (!translations.en[`${category.id}_description`]) {
        translations.en[`${category.id}_description`] = category.description;
      }
    });
  }

  return {
    id: backendSettings.id,
    store_id: backendSettings.store_id,
    enabled: backendSettings.is_enabled,
    gdpr_mode: backendSettings.gdpr_mode ?? true,
    auto_detect_country: backendSettings.auto_detect_country ?? true,
    audit_enabled: backendSettings.audit_enabled ?? true,
    banner_message: backendSettings.banner_text || "We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking 'Accept All', you consent to our use of cookies.",
    accept_all_text: backendSettings.accept_button_text || "Accept All",
    reject_all_text: backendSettings.reject_button_text || "Reject All",
    manage_preferences_text: backendSettings.settings_button_text || "Cookie Settings",
    privacy_policy_text: backendSettings.privacy_policy_text || "Privacy Policy",
    privacy_policy_url: backendSettings.privacy_policy_url || "/privacy-policy",
    banner_position: backendSettings.banner_position || "bottom",
    show_close_button: backendSettings.show_close_button ?? true,
    consent_expiry_days: backendSettings.consent_expiry_days || 365,
    accept_button_bg_color: backendSettings.accept_button_bg_color || '#2563eb',
    accept_button_text_color: backendSettings.accept_button_text_color || '#ffffff',
    reject_button_bg_color: backendSettings.reject_button_bg_color || '#ffffff',
    reject_button_text_color: backendSettings.reject_button_text_color || '#374151',
    save_preferences_button_bg_color: backendSettings.save_preferences_button_bg_color || '#16a34a',
    save_preferences_button_text_color: backendSettings.save_preferences_button_text_color || '#ffffff',
    translations: translations,
    categories: backendSettings.categories || [
      {
        id: "necessary",
        name: "Necessary Cookies",
        description: "These cookies are necessary for the website to function and cannot be switched off.",
        required: true,
        default_enabled: true
      },
      {
        id: "analytics",
        name: "Analytics Cookies",
        description: "These cookies help us understand how visitors interact with our website.",
        required: false,
        default_enabled: backendSettings.analytics_cookies || false
      },
      {
        id: "marketing",
        name: "Marketing Cookies",
        description: "These cookies are used to deliver personalized advertisements.",
        required: false,
        default_enabled: backendSettings.marketing_cookies || false
      },
      {
        id: "functional",
        name: "Functional Cookies",
        description: "These cookies enable enhanced functionality and personalization.",
        required: false,
        default_enabled: backendSettings.functional_cookies || false
      }
    ],
    gdpr_countries: backendSettings.gdpr_countries || ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
    custom_css: backendSettings.custom_css || "",
    // Theme settings
    theme: backendSettings.theme || "light",
    primary_color: backendSettings.primary_color || "#007bff",
    background_color: backendSettings.background_color || "#ffffff",
    text_color: backendSettings.text_color || "#333333"
  };
};

const mapFrontendToBackend = (frontendSettings) => {
  if (!frontendSettings) return null;

  // Extract category settings
  const categories = frontendSettings.categories || [];
  const analyticsCategory = categories.find(c => c.id === "analytics");
  const marketingCategory = categories.find(c => c.id === "marketing");
  const functionalCategory = categories.find(c => c.id === "functional");

  return {
    id: frontendSettings.id,
    store_id: frontendSettings.store_id,
    is_enabled: frontendSettings.enabled || false,
    banner_text: frontendSettings.banner_message,
    accept_button_text: frontendSettings.accept_all_text,
    reject_button_text: frontendSettings.reject_all_text,
    settings_button_text: frontendSettings.manage_preferences_text,
    privacy_policy_url: frontendSettings.privacy_policy_url,
    privacy_policy_text: frontendSettings.privacy_policy_text,
    banner_position: frontendSettings.banner_position,
    consent_expiry_days: frontendSettings.consent_expiry_days,
    show_close_button: frontendSettings.show_close_button,
    accept_button_bg_color: frontendSettings.accept_button_bg_color,
    accept_button_text_color: frontendSettings.accept_button_text_color,
    reject_button_bg_color: frontendSettings.reject_button_bg_color,
    reject_button_text_color: frontendSettings.reject_button_text_color,
    save_preferences_button_bg_color: frontendSettings.save_preferences_button_bg_color,
    save_preferences_button_text_color: frontendSettings.save_preferences_button_text_color,
    translations: frontendSettings.translations || {},
    // GDPR and compliance settings
    gdpr_mode: frontendSettings.gdpr_mode,
    auto_detect_country: frontendSettings.auto_detect_country,
    audit_enabled: frontendSettings.audit_enabled,
    // Cookie categories (individual fields + JSON)
    necessary_cookies: true, // Always true
    analytics_cookies: analyticsCategory?.default_enabled || false,
    marketing_cookies: marketingCategory?.default_enabled || false,
    functional_cookies: functionalCategory?.default_enabled || false,
    categories: frontendSettings.categories,
    gdpr_countries: frontendSettings.gdpr_countries,
    custom_css: frontendSettings.custom_css,
    // Theme settings
    theme: frontendSettings.theme || "light",
    primary_color: frontendSettings.primary_color || "#007bff",
    background_color: frontendSettings.background_color || "#ffffff",
    text_color: frontendSettings.text_color || "#333333"
  };
};

export default function CookieConsent() {
  const { selectedStore, getSelectedStoreId, refreshStores } = useStoreSelection();
  const [settings, setSettings] = useState(null);
  const [consentLogs, setConsentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [flashMessage, setFlashMessage] = useState(null);
  const [store, setStore] = useState(null);
  const [user, setUser] = useState(null); // Added user state
  const [cmsPages, setCmsPages] = useState([]); // CMS pages for privacy policy dropdown
  const [showTranslations, setShowTranslations] = useState(false);
  const [showCategoryTranslations, setShowCategoryTranslations] = useState({});

  useEffect(() => {
    if (selectedStore) {
      loadData();
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

  const loadData = async () => {
    try {
      setLoading(true);

      if (!selectedStore) {
        setStore(null);
        setSettings(null);
        setLoading(false);
        return;
      }

      const currentStoreId = selectedStore.id;

      setStore(selectedStore);

      // Load cookie consent settings
      const cookieSettings = await retryApiCall(() => CookieConsentSettings.filter({ store_id: currentStoreId }));

      if (cookieSettings && cookieSettings.length > 0) {
        // Map backend fields to frontend fields
        const backendData = cookieSettings[0];

        const mappedSettings = mapBackendToFrontend(backendData);
        setSettings(mappedSettings);
      } else {
        // Create default settings with valid store_id - use the same structure as mapBackendToFrontend
        const defaultSettings = mapBackendToFrontend({
          store_id: currentStoreId,
          is_enabled: false,
          gdpr_mode: true,
          auto_detect_country: true,
          analytics_cookies: false,
          marketing_cookies: false,
          functional_cookies: false
        });
        setSettings(defaultSettings);
      }
      
      // Load CMS pages for privacy policy dropdown
      try {
        const pages = await retryApiCall(() => CmsPage.filter({ store_id: selectedStore.id }));
        setCmsPages(pages || []);
      } catch (pagesError) {
        console.error('Error loading CMS pages:', pagesError);
        setCmsPages([]);
      }

      // Load consent logs
      try {
        const logs = await retryApiCall(() => ConsentLog.filter({ store_id: selectedStore.id }));
        setConsentLogs(logs || []);
      } catch (logError) {
        console.warn('Failed to load consent logs (non-critical):', logError);
        setConsentLogs([]);
      }
      
    } catch (error) {
      console.error('Failed to load cookie consent data:', error);
      setFlashMessage({ type: 'error', message: 'Failed to load cookie consent settings.' });
      setStore(null);
      setSettings(null);
      setConsentLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Check if settings or store are null, or if store doesn't have an ID (which is required for saving)
    if (!settings || !selectedStore) {
      setFlashMessage({ type: 'error', message: 'Settings not loaded or no store found. Cannot save.' });
      return;
    }

    // CRITICAL: Capture the current store ID at save time to prevent stale reference
    const currentStoreId = selectedStore.id;

    if (!currentStoreId) {
      setFlashMessage({ type: 'error', message: 'No store ID available. Cannot save.' });
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      // FORCE the correct store_id - completely replace any existing store_id
      const settingsToSave = {
        ...settings,
        store_id: currentStoreId  // This MUST match the selected store
      };

      // Map frontend settings to backend format
      const backendSettings = mapFrontendToBackend(settingsToSave);

      // Always use create endpoint - backend automatically handles upsert based on store_id
      // This prevents duplicate rows without needing separate create/update logic
      const result = await retryApiCall(() =>
        CookieConsentSettings.create(backendSettings)
      );

      // Handle response (could be array or wrapped object)
      let settingsData;
      if (Array.isArray(result) && result[0]) {
        settingsData = result[0];
      } else if (result?.success && result?.data) {
        settingsData = result.data;
      } else if (result?.id) {
        settingsData = result;
      }

      if (settingsData && settingsData.id) {
        const updatedSettings = mapBackendToFrontend(settingsData);
        setSettings(updatedSettings);
      } else {
        // Fallback to reload if response structure is unexpected
        await refreshStores();
        await loadData();
      }

      // Clear storefront cache so changes appear immediately
      clearCookieConsentCache(currentStoreId);

      setFlashMessage({
        type: 'success',
        message: 'Cookie consent settings saved! Refresh your storefront to see changes.'
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

    } catch (error) {
      setFlashMessage({
        type: 'error',
        message: error.response?.data?.message || `Failed to save settings: ${error.message}`
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryChange = (index, field, value) => {
    const updatedCategories = [...settings.categories];
    updatedCategories[index] = { ...updatedCategories[index], [field]: value };

    // Bi-directional sync: Update English translation when category name/description changes
    const category = updatedCategories[index];
    const updatedTranslations = { ...settings.translations };

    if (!updatedTranslations.en) {
      updatedTranslations.en = {};
    }

    if (field === 'name') {
      updatedTranslations.en[`${category.id}_name`] = value;
    } else if (field === 'description') {
      updatedTranslations.en[`${category.id}_description`] = value;
    }

    setSettings({
      ...settings,
      categories: updatedCategories,
      translations: updatedTranslations
    });
  };

  const addCategory = () => {
    const newCategory = {
      id: `custom_${Date.now()}`,
      name: "New Category",
      description: "Description for new category",
      required: false,
      default_enabled: false
    };
    setSettings({
      ...settings,
      categories: [...settings.categories, newCategory]
    });
  };

  const removeCategory = (index) => {
    const updatedCategories = settings.categories.filter((_, i) => i !== index);
    setSettings({ ...settings, categories: updatedCategories });
  };

  const exportConsentLogs = () => {
    const csvContent = [
      ['Date', 'User ID', 'Session ID', 'IP Address', 'Consent Given', 'Categories', 'Country', 'Method', 'Page URL'].join(','),
      ...consentLogs.map(log => [
        new Date(log.created_date).toISOString(),
        log.user_id || '',
        log.session_id || '',
        log.ip_address || '',
        log.consent_given ? 'Yes' : 'No',
        log.categories_accepted.join(';'),
        log.country_code || '',
        log.consent_method || '',
        log.page_url || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookie-consent-logs-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  if (loading) {
    return <PageLoader size="lg" />;
  }

  // This block handles cases where no store is found or data loading failed,
  // preventing further rendering with null settings/store.
  if (!store || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-700">
        <Card className="w-full max-w-lg text-center p-8">
            <CardHeader>
                <CardTitle className="text-2xl">No Store Found</CardTitle>
                <CardDescription className="text-base">
                    Please ensure you have a store set up to use Cookie Consent features.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {user?.account_type === 'agency' && (
                    <Link to={createPageUrl('Stores')}>
                        <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Your First Store
                        </Button>
                    </Link>
                )}
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cookie Consent & GDPR</h1>
          <p className="text-gray-600 mt-1">Manage cookie consent, GDPR compliance, and user privacy preferences</p>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-6">
            <div className="grid gap-6">
              <Card className="material-elevation-1 border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    General Settings
                  </CardTitle>
                  <CardDescription>Basic cookie consent and GDPR configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enabled" className="text-base font-medium">Enable Cookie Consent</Label>
                      <p className="text-sm text-gray-500">Show cookie consent banner to visitors</p>
                    </div>
                    <Switch
                      id="enabled"
                      checked={settings?.enabled || false}
                      onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="gdpr_mode" className="text-base font-medium">GDPR Compliance Mode</Label>
                      <p className="text-sm text-gray-500">Enable enhanced privacy protection for EU visitors</p>
                    </div>
                    <Switch
                      id="gdpr_mode"
                      checked={settings?.gdpr_mode ?? true}
                      onCheckedChange={(checked) => setSettings({ ...settings, gdpr_mode: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto_detect_country" className="text-base font-medium">Auto-Detect Country</Label>
                      <p className="text-sm text-gray-500">Automatically detect visitor location for GDPR compliance</p>
                    </div>
                    <Switch
                      id="auto_detect_country"
                      checked={settings?.auto_detect_country ?? true}
                      onCheckedChange={(checked) => setSettings({ ...settings, auto_detect_country: checked })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="banner_position">Banner Position</Label>
                    <Select value={settings.banner_position} onValueChange={(value) => setSettings({ ...settings, banner_position: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom">Bottom</SelectItem>
                        <SelectItem value="top">Top</SelectItem>
                        <SelectItem value="center">Center (Modal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="consent_expiry_days">Consent Expiry (Days)</Label>
                    <Input
                      id="consent_expiry_days"
                      type="number"
                      value={settings.consent_expiry_days}
                      onChange={(e) => setSettings({ ...settings, consent_expiry_days: parseInt(e.target.value) })}
                    />
                    <p className="text-sm text-gray-500 mt-1">Number of days before asking for consent again</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="material-elevation-1 border-0">
                <CardHeader>
                  <CardTitle>Banner Content</CardTitle>
                  <CardDescription>
                    Customize the text and buttons on your consent banner
                    <button
                      type="button"
                      onClick={() => setShowTranslations(!showTranslations)}
                      className="text-sm text-blue-600 hover:text-blue-800 ml-4 inline-flex items-center gap-1"
                    >
                      <Languages className="w-4 h-4" />
                      {showTranslations ? 'Hide translations' : 'Manage translations'}
                    </button>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Banner Message - Hidden when translations shown */}
                  {!showTranslations && (
                    <div>
                      <Label htmlFor="banner_message">Banner Message</Label>
                      <Textarea
                        id="banner_message"
                        value={settings.banner_message}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          const updatedTranslations = { ...settings.translations };
                          if (!updatedTranslations.en) updatedTranslations.en = {};
                          updatedTranslations.en.banner_text = newValue;
                          setSettings({
                            ...settings,
                            banner_message: newValue,
                            translations: updatedTranslations
                          });
                        }}
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Button Text Fields - Hidden when translations shown */}
                  {!showTranslations && (
                    <>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="accept_all_text">Accept Button</Label>
                          <div className="flex gap-2">
                            <Input
                              id="accept_all_text"
                              className="flex-1"
                              value={settings.accept_all_text}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                const updatedTranslations = { ...settings.translations };
                                if (!updatedTranslations.en) updatedTranslations.en = {};
                                updatedTranslations.en.accept_button_text = newValue;
                                setSettings({
                                  ...settings,
                                  accept_all_text: newValue,
                                  translations: updatedTranslations
                                });
                              }}
                              placeholder="Accept All"
                            />
                            <div className="flex gap-2">
                              <div className="relative">
                                <Input
                                  type="color"
                                  className="w-16 h-10 p-1 cursor-pointer"
                                  value={settings.accept_button_text_color || '#ffffff'}
                                  onChange={(e) => setSettings({ ...settings, accept_button_text_color: e.target.value })}
                                  title="Text Color"
                                />
                                <span className="text-xs text-gray-500 absolute -bottom-5 left-0 whitespace-nowrap">Text</span>
                              </div>
                              <div className="relative">
                                <Input
                                  type="color"
                                  className="w-16 h-10 p-1 cursor-pointer"
                                  value={settings.accept_button_bg_color || '#2563eb'}
                                  onChange={(e) => setSettings({ ...settings, accept_button_bg_color: e.target.value })}
                                  title="Background Color"
                                />
                                <span className="text-xs text-gray-500 absolute -bottom-5 left-0 whitespace-nowrap">Background</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Button colors</p>
                        </div>
                        <div>
                          <Label htmlFor="reject_all_text">Reject Button</Label>
                          <div className="flex gap-2">
                            <Input
                              id="reject_all_text"
                              className="flex-1"
                              value={settings.reject_all_text}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                const updatedTranslations = { ...settings.translations };
                                if (!updatedTranslations.en) updatedTranslations.en = {};
                                updatedTranslations.en.reject_button_text = newValue;
                                setSettings({
                                  ...settings,
                                  reject_all_text: newValue,
                                  translations: updatedTranslations
                                });
                              }}
                              placeholder="Reject All"
                            />
                            <div className="flex gap-2">
                              <div className="relative">
                                <Input
                                  type="color"
                                  className="w-16 h-10 p-1 cursor-pointer"
                                  value={settings.reject_button_text_color || '#374151'}
                                  onChange={(e) => setSettings({ ...settings, reject_button_text_color: e.target.value })}
                                  title="Text Color"
                                />
                                <span className="text-xs text-gray-500 absolute -bottom-5 left-0 whitespace-nowrap">Text</span>
                              </div>
                              <div className="relative">
                                <Input
                                  type="color"
                                  className="w-16 h-10 p-1 cursor-pointer"
                                  value={settings.reject_button_bg_color || '#ffffff'}
                                  onChange={(e) => setSettings({ ...settings, reject_button_bg_color: e.target.value })}
                                  title="Background Color"
                                />
                                <span className="text-xs text-gray-500 absolute -bottom-5 left-0 whitespace-nowrap">Background</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Button colors</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="manage_preferences_text">Manage Preferences Text</Label>
                          <Input
                            id="manage_preferences_text"
                            value={settings.manage_preferences_text}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              const updatedTranslations = { ...settings.translations };
                              if (!updatedTranslations.en) updatedTranslations.en = {};
                              updatedTranslations.en.settings_button_text = newValue;
                              setSettings({
                                ...settings,
                                manage_preferences_text: newValue,
                                translations: updatedTranslations
                              });
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="privacy_policy_text">Privacy Policy Link Text</Label>
                          <Input
                            id="privacy_policy_text"
                            value={settings.privacy_policy_text}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              const updatedTranslations = { ...settings.translations };
                              if (!updatedTranslations.en) updatedTranslations.en = {};
                              updatedTranslations.en.privacy_policy_text = newValue;
                              setSettings({
                                ...settings,
                                privacy_policy_text: newValue,
                                translations: updatedTranslations
                              });
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Translation Fields */}
                  {showTranslations && (
                    <div className="mt-4 border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Languages className="w-5 h-5 text-blue-600" />
                        <Wand2 className="w-5 h-5 text-purple-500" />
                        <h3 className="text-base font-semibold text-blue-900">Banner Text Translations</h3>
                      </div>
                      <TranslationFields
                        translations={settings.translations}
                        onChange={(newTranslations) => {
                          // Bi-directional sync: Update main fields when English translation changes
                          const updates = { translations: newTranslations };

                          if (newTranslations.en) {
                            if (newTranslations.en.banner_text) {
                              updates.banner_message = newTranslations.en.banner_text;
                            }
                            if (newTranslations.en.accept_button_text) {
                              updates.accept_all_text = newTranslations.en.accept_button_text;
                            }
                            if (newTranslations.en.reject_button_text) {
                              updates.reject_all_text = newTranslations.en.reject_button_text;
                            }
                            if (newTranslations.en.settings_button_text) {
                              updates.manage_preferences_text = newTranslations.en.settings_button_text;
                            }
                            if (newTranslations.en.privacy_policy_text) {
                              updates.privacy_policy_text = newTranslations.en.privacy_policy_text;
                            }
                          }

                          setSettings(prev => ({ ...prev, ...updates }));
                        }}
                        fields={[
                          { name: 'banner_text', label: 'Banner Message', type: 'textarea', rows: 3, required: true },
                          { name: 'accept_button_text', label: 'Accept Button Text', type: 'text', required: true },
                          { name: 'reject_button_text', label: 'Reject Button Text', type: 'text', required: true },
                          { name: 'settings_button_text', label: 'Cookie Settings Button Text', type: 'text', required: true },
                          { name: 'save_preferences_button_text', label: 'Save Preferences Button Text', type: 'text', required: true },
                          { name: 'privacy_policy_text', label: 'Privacy Policy Link Text', type: 'text', required: true }
                        ]}
                        storeId={selectedStore?.id}
                        entityType="cookie_consent"
                      />
                      <p className="text-sm text-gray-600 mt-3">
                        Translate all cookie banner text to provide a localized experience for your visitors
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="privacy_policy_page">Privacy Policy Page</Label>
                      <Select
                        value={settings.privacy_policy_url || 'none'}
                        onValueChange={(value) => setSettings({ ...settings, privacy_policy_url: value === 'none' ? '' : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a CMS page for privacy policy" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-gray-500">No privacy policy page</span>
                          </SelectItem>
                          {/* System pages first */}
                          {cmsPages
                            .filter(page => page.is_system)
                            .map((page) => (
                              <SelectItem key={page.id} value={createCmsPageUrl(store?.slug, page.slug)}>
                                {page.translations?.en?.title || page.slug} (System)
                              </SelectItem>
                            ))
                          }
                          {/* Regular pages */}
                          {cmsPages
                            .filter(page => !page.is_system)
                            .map((page) => (
                              <SelectItem key={page.id} value={createCmsPageUrl(store?.slug, page.slug)}>
                                {page.translations?.en?.title || page.slug}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-500 mt-1">
                        Select a CMS page to use as your privacy policy. The page will be linked in the cookie banner.
                        {cmsPages.filter(p => p.slug === 'privacy-policy').length === 0 && (
                          <span className="block mt-1 text-amber-600">
                            ⚠️ No Privacy Policy page found. System pages should be created automatically.
                          </span>
                        )}
                      </p>
                    </div>

                    <div>
                      <Label>Save Preferences Button</Label>
                      <div className="flex gap-2">
                        <Input
                          className="flex-1"
                          value={settings.translations?.en?.save_preferences_button_text || 'Save Preferences'}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            const updatedTranslations = { ...settings.translations };
                            if (!updatedTranslations.en) updatedTranslations.en = {};
                            updatedTranslations.en.save_preferences_button_text = newValue;
                            setSettings({
                              ...settings,
                              translations: updatedTranslations
                            });
                          }}
                          placeholder="Save Preferences"
                        />
                        <div className="flex gap-2">
                          <div className="relative">
                            <Input
                              type="color"
                              className="w-16 h-10 p-1 cursor-pointer"
                              value={settings.save_preferences_button_text_color || '#ffffff'}
                              onChange={(e) => setSettings({ ...settings, save_preferences_button_text_color: e.target.value })}
                              title="Text Color"
                            />
                            <span className="text-xs text-gray-500 absolute -bottom-5 left-0 whitespace-nowrap">Text</span>
                          </div>
                          <div className="relative">
                            <Input
                              type="color"
                              className="w-16 h-10 p-1 cursor-pointer"
                              value={settings.save_preferences_button_bg_color || '#16a34a'}
                              onChange={(e) => setSettings({ ...settings, save_preferences_button_bg_color: e.target.value })}
                              title="Background Color"
                            />
                            <span className="text-xs text-gray-500 absolute -bottom-5 left-0 whitespace-nowrap">Background</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="material-elevation-1 border-0">
                <CardHeader>
                  <CardTitle>Custom Styling</CardTitle>
                  <CardDescription>Add custom CSS to style your consent banner</CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="custom_css">Custom CSS</Label>
                    <Textarea
                      id="custom_css"
                      value={settings.custom_css || ''}
                      onChange={(e) => setSettings({ ...settings, custom_css: e.target.value })}
                      rows={10}
                      placeholder=".cookie-banner { background: #000; color: #fff; }"
                      className="font-mono text-sm"
                    />
                    <p className="text-sm text-gray-500 mt-1">Custom CSS styles for the cookie consent banner</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="mt-6">
            <Card className="material-elevation-1 border-0">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Cookie Categories
                  </div>
                  <Button onClick={addCategory} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                  </Button>
                </CardTitle>
                <CardDescription>Define cookie categories and their purposes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(settings.categories || []).map((category, index) => (
                    <Card key={category.id} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="grid grid-cols-2 gap-4 flex-1">
                            <div>
                              <Label>Category Name</Label>
                              <Input
                                value={category.name}
                                onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => setShowCategoryTranslations(prev => ({
                                  ...prev,
                                  [category.id]: !prev[category.id]
                                }))}
                                className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-flex items-center gap-1"
                              >
                                <Languages className="w-4 h-4" />
                                {showCategoryTranslations[category.id] ? 'Hide translations' : 'Manage translations'}
                              </button>
                            </div>
                            <div>
                              <Label>Category ID</Label>
                              <Input
                                value={category.id}
                                onChange={(e) => handleCategoryChange(index, 'id', e.target.value)}
                                disabled={category.required}
                              />
                            </div>
                          </div>
                          {!category.required && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeCategory(index)}
                              className="ml-4"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>

                        {/* Translation Fields for this specific category */}
                        {showCategoryTranslations[category.id] && (
                          <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-4">
                              <Languages className="w-5 h-5 text-blue-600" />
                              <Wand2 className="w-5 h-5 text-purple-500" />
                              <h3 className="text-base font-semibold text-blue-900">{category.name} Translations</h3>
                            </div>
                            <TranslationFields
                              translations={settings.translations}
                              onChange={(newTranslations) => {
                                // Bi-directional sync: Update category when English translation changes
                                const updatedCategories = [...settings.categories];
                                const categoryIndex = updatedCategories.findIndex(c => c.id === category.id);

                                if (categoryIndex !== -1 && newTranslations.en) {
                                  if (newTranslations.en[`${category.id}_name`]) {
                                    updatedCategories[categoryIndex].name = newTranslations.en[`${category.id}_name`];
                                  }
                                  if (newTranslations.en[`${category.id}_description`]) {
                                    updatedCategories[categoryIndex].description = newTranslations.en[`${category.id}_description`];
                                  }
                                }

                                setSettings(prev => ({
                                  ...prev,
                                  translations: newTranslations,
                                  categories: updatedCategories
                                }));
                              }}
                              fields={[
                                { name: `${category.id}_name`, label: 'Category Name', type: 'text', required: true },
                                { name: `${category.id}_description`, label: 'Category Description', type: 'textarea', rows: 2, required: true }
                              ]}
                              storeId={selectedStore?.id}
                              entityType="cookie_consent_category"
                            />
                            <p className="text-sm text-gray-600 mt-3">
                              Translate this category's name and description
                            </p>
                          </div>
                        )}

                        {!showCategoryTranslations[category.id] && (
                          <div>
                            <Label>Description</Label>
                            <Textarea
                              value={category.description}
                              onChange={(e) => handleCategoryChange(index, 'description', e.target.value)}
                              rows={2}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-6">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`required-${index}`}
                              checked={category?.required || false}
                              onCheckedChange={(checked) => handleCategoryChange(index, 'required', checked)}
                              disabled={category.id === 'necessary'}
                            />
                            <Label htmlFor={`required-${index}`}>Required</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`default-${index}`}
                              checked={category?.default_enabled || false}
                              onCheckedChange={(checked) => handleCategoryChange(index, 'default_enabled', checked)}
                            />
                            <Label htmlFor={`default-${index}`}>Enabled by Default</Label>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="audit" className="mt-6">
            <Card className="material-elevation-1 border-0">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Consent Audit Logs
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={exportConsentLogs} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                    <Switch
                      checked={settings?.audit_enabled ?? true}
                      onCheckedChange={(checked) => setSettings({ ...settings, audit_enabled: checked })}
                    />
                  </div>
                </CardTitle>
                <CardDescription>GDPR-compliant audit trail of all consent decisions</CardDescription>
              </CardHeader>
              <CardContent>
                {consentLogs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">User</th>
                          <th className="text-left p-2">Consent</th>
                          <th className="text-left p-2">Categories</th>
                          <th className="text-left p-2">Country</th>
                          <th className="text-left p-2">Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consentLogs.slice(0, 50).map((log) => (
                          <tr key={log.id} className="border-b">
                            <td className="p-2">{new Date(log.created_date).toLocaleString()}</td>
                            <td className="p-2">{log.user_id || log.session_id?.substring(0, 8) || 'Unknown'}</td>
                            <td className="p-2">
                              <Badge variant={log.consent_given ? 'default' : 'destructive'}>
                                {log.consent_given ? 'Accepted' : 'Rejected'}
                              </Badge>
                            </td>
                            <td className="p-2">{log.categories_accepted.join(', ')}</td>
                            <td className="p-2">{log.country_code || 'Unknown'}</td>
                            <td className="p-2">{log.consent_method || 'banner'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No consent logs yet</p>
                    <p className="text-sm">Logs will appear here once visitors interact with the consent banner</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-8">
          <SaveButton
            onClick={handleSave}
            loading={saving}
            success={saveSuccess}
            defaultText="Save Settings"
          />
        </div>
      </div>
    </div>
  );
}
