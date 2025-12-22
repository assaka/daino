
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Category } from '@/api/entities';
import { User } from '@/api/entities';
import apiClient from '@/api/client';
import { useStoreSelection } from '@/contexts/StoreSelectionContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Building2, Bell, Settings as SettingsIcon, Globe, KeyRound } from 'lucide-react';
import SaveButton from '@/components/ui/save-button';
import { CountrySelect } from "@/components/ui/country-select";
import { TimezoneSelect } from "@/components/ui/timezone-select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { clearSettingsCache, clearAllCache } from '@/utils/cacheUtils';
import { queryClient } from '@/config/queryClient';
import FlashMessage from '@/components/storefront/FlashMessage';
import { PageLoader } from '@/components/ui/page-loader';
import StoreLogoUpload from '@/components/admin/StoreLogoUpload';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';

// Country to currency mapping for auto-setting currency when country changes
const COUNTRY_TO_CURRENCY = {
  // Europe - Euro zone
  DE: 'EUR', AT: 'EUR', BE: 'EUR', CY: 'EUR', EE: 'EUR', ES: 'EUR', FI: 'EUR',
  FR: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR', LV: 'EUR',
  MT: 'EUR', NL: 'EUR', PT: 'EUR', SI: 'EUR', SK: 'EUR',
  // Europe - Non-Euro
  GB: 'GBP', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
  HU: 'HUF', RO: 'RON', BG: 'BGN', HR: 'EUR',
  // Americas
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL',
  // Asia-Pacific
  JP: 'JPY', CN: 'CNY', KR: 'KRW', AU: 'AUD', NZ: 'NZD', SG: 'SGD', HK: 'HKD',
  IN: 'INR', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP', VN: 'VND',
  // Middle East & Africa
  AE: 'AED', SA: 'SAR', IL: 'ILS', ZA: 'ZAR', TR: 'TRY', RU: 'RUB',
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 5, baseDelay = 3000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await delay(Math.random() * 1000 + 500); // Random delay before each attempt
      return await apiCall();
    } catch (error) {
      const isRateLimit = error.response?.status === 429 ||
                         error.message?.includes('Rate limit') ||
                         error.message?.includes('429') ||
                         error.detail?.includes('Rate limit');

      if (isRateLimit && i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i) + Math.random() * 2000;
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

export default function Settings() {
  const navigate = useNavigate();
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const [store, setStore] = useState(null);
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
        setLoading(false);
        return;
      }
      
      if (!selectedStore.id) {
        setFlashMessage({ type: 'error', message: 'Invalid store selection. Please select a store.' });
        setLoading(false);
        return;
      }
      
      const user = await retryApiCall(() => User.me());
      
     // Fetch fresh store data to ensure we have the latest settings
      let freshStoreData = null;
      try {
        const storeResponse = await retryApiCall(() => Store.findById(selectedStore.id));
        // The API returns { success: true, data: { store: {...}, tenantData: {...} } }
        if (storeResponse && storeResponse.success && storeResponse.data) {
          // Use tenantData which contains the full store record from tenant DB
          if (storeResponse.data.tenantData) {
            freshStoreData = storeResponse.data.tenantData;
          } else if (storeResponse.data.store) {
            // Fallback to master store data if tenantData not available
            freshStoreData = { ...selectedStore, ...storeResponse.data.store };
          } else {
            freshStoreData = storeResponse.data;
          }
        } else if (storeResponse && storeResponse.id) {
          // Direct store object
          freshStoreData = storeResponse;
        } else if (Array.isArray(storeResponse) && storeResponse.length > 0) {
          // Array response
          freshStoreData = storeResponse[0];
        } else {
          freshStoreData = selectedStore;
        }
      } catch (error) {
        freshStoreData = selectedStore;
      }

      const storeData = freshStoreData || selectedStore;

      const settings = storeData.settings || {};

      setStore({
        id: storeData.id,
        name: storeData.name || '',
        description: storeData.description || '',
        logo_url: storeData.logo_url || '',
        domain: storeData.domain || '', // Keep existing domain if it's used internally
        domain_status: storeData.domain_status || '',
        ssl_enabled: storeData.ssl_enabled || false,
        currency: storeData.currency || 'No Currency',
        timezone: storeData.timezone || 'UTC',
        slug: storeData.slug || '',
        status: storeData.status || 'active', // Default status
        // NOTE: root_category_id is NOT a column in the stores table
        // It's stored in settings.rootCategoryId
        contact_details: {
          email: storeData.settings?.store_email || '', // From settings JSON
          phone: storeData.settings?.store_phone || '', // From settings JSON
          address: storeData.settings?.store_address || '', // From settings JSON
          address_line2: storeData.settings?.store_address_line2 || '', // From settings JSON
          city: storeData.settings?.store_city || '', // From settings JSON
          state: storeData.settings?.store_state || '', // From settings JSON
          postal_code: storeData.settings?.store_postal_code || '', // From settings JSON
          country: storeData.settings?.store_country || 'US', // From settings JSON
          support_email: storeData.settings?.store_email || '', // Use store_email as support_email
        },
        stripe_settings: {
          enabled: storeData.stripe_settings?.enabled || false,
          publishable_key: storeData.stripe_settings?.publishable_key || '',
          secret_key: storeData.stripe_settings?.secret_key || '',
          webhook_secret: storeData.stripe_settings?.webhook_secret || ''
        },
        brevo_settings: {
          enabled: storeData.brevo_settings?.enabled || false,
          api_key: storeData.brevo_settings?.api_key || '',
          sender_email: storeData.brevo_settings?.sender_email || '',
          sender_name: storeData.brevo_settings?.sender_name || ''
        },
        settings: {
          // CRITICAL FIX: Check if value exists in database first, then use default
          enable_inventory: settings.hasOwnProperty('enable_inventory') ? settings.enable_inventory : true,
          enable_reviews: settings.hasOwnProperty('enable_reviews') ? settings.enable_reviews : true,
          hide_currency_category: settings.hasOwnProperty('hide_currency_category') ? settings.hide_currency_category : false,
          hide_currency_product: settings.hasOwnProperty('hide_currency_product') ? settings.hide_currency_product : false,
          hide_header_cart: settings.hasOwnProperty('hide_header_cart') ? settings.hide_header_cart : false,
          hide_header_checkout: settings.hasOwnProperty('hide_header_checkout') ? settings.hide_header_checkout : false,
          show_category_in_breadcrumb: settings.hasOwnProperty('show_category_in_breadcrumb') ? settings.show_category_in_breadcrumb : true,
          show_permanent_search: settings.hasOwnProperty('show_permanent_search') ? settings.show_permanent_search : true,
          hide_shipping_costs: settings.hasOwnProperty('hide_shipping_costs') ? settings.hide_shipping_costs : false,
          hide_quantity_selector: settings.hasOwnProperty('hide_quantity_selector') ? settings.hide_quantity_selector : false,
          require_shipping_address: settings.hasOwnProperty('require_shipping_address') ? settings.require_shipping_address : true,
          collect_phone_number_at_checkout: settings.hasOwnProperty('collect_phone_number_at_checkout') ? settings.collect_phone_number_at_checkout : false,
          allow_guest_checkout: settings.hasOwnProperty('allow_guest_checkout') ? settings.allow_guest_checkout : true,
          allowed_countries: settings.allowed_countries || ["US", "CA", "GB", "DE", "FR"],
          theme: settings.theme || getThemeDefaults(), 
          cookie_consent: settings.cookie_consent || { // Ensure cookie_consent is loaded with defaults
            enabled: false,
            message: 'We use cookies to ensure you get the best experience on our website. By continuing to use our site, you agree to our use of cookies.',
            accept_button_text: 'Accept',
            decline_button_text: 'Deline',
            policy_link: '/privacy-policy',
          }, 
          analytics_settings: settings.analytics_settings || {}, // Ensure analytics_settings is loaded
          seo_settings: settings.seo_settings || { // Ensure seo_settings is loaded with defaults
            meta_title_suffix: '',
            meta_description: '',
            meta_keywords: '',
            robots_txt_content: '',
            enable_rich_snippets_product: true,
            enable_rich_snippets_store: true,
            global_schema_markup_json: '',
          },
          // New settings fields from database or default
          default_tax_included_in_prices: settings.hasOwnProperty('default_tax_included_in_prices') ? settings.default_tax_included_in_prices : false,
          display_tax_inclusive_prices: settings.hasOwnProperty('display_tax_inclusive_prices') ? settings.display_tax_inclusive_prices : false,
          calculate_tax_after_discount: settings.hasOwnProperty('calculate_tax_after_discount') ? settings.calculate_tax_after_discount : true,
          display_out_of_stock: settings.hasOwnProperty('display_out_of_stock') ? settings.display_out_of_stock : true,
          product_filter_attributes: settings.product_filter_attributes || [], // New: initialize as array
          enable_credit_updates: settings.hasOwnProperty('enable_credit_updates') ? settings.enable_credit_updates : false,
          enable_coupon_rules: settings.hasOwnProperty('enable_coupon_rules') ? settings.enable_coupon_rules : false, // New
          allow_stacking_coupons: settings.hasOwnProperty('allow_stacking_coupons') ? settings.allow_stacking_coupons : false, // New
          hide_stock_quantity: settings.hasOwnProperty('hide_stock_quantity') ? settings.hide_stock_quantity : false, // New
          display_low_stock_threshold: settings.hasOwnProperty('display_low_stock_threshold') ? settings.display_low_stock_threshold : 0, // New
          
          // Root category settings - ensure boolean values are properly handled
          rootCategoryId: settings.rootCategoryId || null,
          excludeRootFromMenu: settings.excludeRootFromMenu === true,
          expandAllMenuItems: settings.expandAllMenuItems === true,

          // Language settings
          active_languages: settings.active_languages || ['en'],
          default_language: settings.default_language || 'en',
          use_geoip_language: settings.hasOwnProperty('use_geoip_language') ? settings.use_geoip_language : false,
        }
      });
    } catch (error) {
      setFlashMessage({ type: 'error', message: 'Failed to load store settings. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleContactChange = (field, value) => {
    setStore(prev => {
      const updates = {
        ...prev,
        contact_details: {
          ...prev.contact_details,
          [field]: value
        }
      };

      // Auto-set currency when country changes (only for supported currencies in dropdown)
      if (field === 'country' && value) {
        const suggestedCurrency = COUNTRY_TO_CURRENCY[value];
        const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'SEK', 'NOK', 'DKK', 'PLN', 'INR', 'KRW', 'SGD', 'HKD', 'MXN', 'BRL', 'ZAR', 'TRY'];
        if (suggestedCurrency && supportedCurrencies.includes(suggestedCurrency)) {
          updates.currency = suggestedCurrency;
        }
      }

      return updates;
    });
  };
  
  const handleStripeChange = (field, value) => {
    setStore(prev => ({
      ...prev,
      stripe_settings: {
        ...prev.stripe_settings,
        [field]: value
      }
    }));
  };

  const handleBrevoChange = (field, value) => {
    setStore(prev => ({
      ...prev,
      brevo_settings: {
        ...prev.brevo_settings,
        [field]: value
      }
    }));
  };

  const handleSettingsChange = (key, value) => {
    setStore((prev) => ({
      ...prev, 
      settings: {
        ...prev.settings,
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!store || !store.id) {
      setFlashMessage({ type: 'error', message: 'Store data not loaded. Cannot save.' });
      return;
    }
    setSaving(true);
    setSaveSuccess(false);

    try {
      
      // Create a more explicit payload to ensure all boolean fields are included
      const settingsPayload = {
        // Store email - saved in settings for CMS templates
        store_email: store.contact_details?.email || '',
        enable_inventory: store.settings.enable_inventory,
        enable_reviews: store.settings.enable_reviews,
        hide_currency_category: store.settings.hide_currency_category,
        hide_currency_product: store.settings.hide_currency_product,
        hide_header_cart: store.settings.hide_header_cart,
        hide_header_checkout: store.settings.hide_header_checkout,
        show_category_in_breadcrumb: store.settings.show_category_in_breadcrumb,
        show_permanent_search: store.settings.show_permanent_search,
        hide_shipping_costs: store.settings.hide_shipping_costs,
        hide_quantity_selector: store.settings.hide_quantity_selector,
        require_shipping_address: store.settings.require_shipping_address,
        collect_phone_number_at_checkout: store.settings.collect_phone_number_at_checkout,
        allow_guest_checkout: store.settings.allow_guest_checkout,
        allowed_countries: store.settings.allowed_countries,
        analytics_settings: store.settings.analytics_settings || {},
        // Add new settings fields to the payload explicitly
        default_tax_included_in_prices: store.settings.default_tax_included_in_prices,
        display_tax_inclusive_prices: store.settings.display_tax_inclusive_prices,
        calculate_tax_after_discount: store.settings.calculate_tax_after_discount,
        display_out_of_stock: store.settings.display_out_of_stock,
        product_filter_attributes: store.settings.product_filter_attributes,
        enable_credit_updates: store.settings.enable_credit_updates,
        enable_coupon_rules: store.settings.enable_coupon_rules,
        allow_stacking_coupons: store.settings.allow_stacking_coupons,
        hide_stock_quantity: store.settings.hide_stock_quantity,
        display_low_stock_threshold: store.settings.display_low_stock_threshold,
        
        // Root category settings - ensure boolean values are explicitly set
        rootCategoryId: store.settings.rootCategoryId || null,
        excludeRootFromMenu: store.settings.excludeRootFromMenu === true,
        expandAllMenuItems: store.settings.expandAllMenuItems === true,

        // Language settings
        active_languages: store.settings.active_languages || ['en'],
        default_language: store.settings.default_language || 'en',
        use_geoip_language: store.settings.use_geoip_language === true,

        seo_settings: {
          meta_title_suffix: store.settings.seo_settings?.meta_title_suffix || '',
          meta_description: store.settings.seo_settings?.meta_description || '',
          meta_keywords: store.settings.seo_settings?.meta_keywords || '',
          robots_txt_content: store.settings.seo_settings?.robots_txt_content || '',
          enable_rich_snippets_product: store.settings.seo_settings?.enable_rich_snippets_product || false,
          enable_rich_snippets_store: store.settings.seo_settings?.enable_rich_snippets_store || false,
          global_schema_markup_json: store.settings.seo_settings?.global_schema_markup_json || '',
        },
        cookie_consent: {
          enabled: store.settings.cookie_consent?.enabled || false,
          message: store.settings.cookie_consent?.message || '',
          accept_button_text: store.settings.cookie_consent?.accept_button_text || '',
          decline_button_text: store.settings.cookie_consent?.decline_button_text || '',
          policy_link: store.settings.cookie_consent?.policy_link || '',
        },
        theme: {
          primary_button_color: store.settings.theme?.primary_button_color || '',
          secondary_button_color: store.settings.theme?.secondary_button_color || '',
          font_family: store.settings.theme?.font_family || '',
        },
      };
      
      // Also include other store fields that might need updating
      // Map contact_details to settings
      const payload = {
        name: store.name,
        description: store.description,
        logo_url: store.logo_url,
        timezone: store.timezone,
        currency: store.currency,
        // All contact details are stored in settings
        settings: {
          ...settingsPayload,
          store_email: store.contact_details?.email || '',
          store_phone: store.contact_details?.phone || '',
          store_address: store.contact_details?.address || '',
          store_address_line2: store.contact_details?.address_line2 || '',
          store_city: store.contact_details?.city || '',
          store_state: store.contact_details?.state || '',
          store_postal_code: store.contact_details?.postal_code || '',
          store_country: store.contact_details?.country || ''
        }
      };

      // Ensure settings is a proper object
      if (typeof payload.settings === 'string') {
        payload.settings = JSON.parse(payload.settings);
      }
      
      // Use the specific settings endpoint for updating store settings
      const apiResult = await retryApiCall(() => Store.updateSettings(store.id, payload));

      // Handle array response from API client
      const result = Array.isArray(apiResult) ? apiResult[0] : apiResult;

      // Update our local store state with the response data
      if (result && result.settings) {
        setFlashMessage({ type: 'success', message: 'Settings saved successfully!' });
        setSaveSuccess(true);

        // Auto-clear success state after 3 seconds
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);

        // Clear ALL StoreProvider cache to force reload of settings
        try {
          clearAllCache(store.id);
          localStorage.removeItem('storeProviderCache');
          sessionStorage.removeItem('storeProviderCache');

          // CRITICAL: Invalidate React Query bootstrap cache to force storefront to refetch settings
          queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
        } catch (e) {
        }
        
        // Update local store state with the fresh data from the response
        // Map the backend response to frontend structure just like loadStore does
        const settings = result.settings || {};
        
        setStore({
          ...store, // Keep existing store data
          settings: {
            // Update with the fresh settings from the response
            enable_inventory: settings.hasOwnProperty('enable_inventory') ? settings.enable_inventory : true,
            enable_reviews: settings.hasOwnProperty('enable_reviews') ? settings.enable_reviews : true,
            hide_currency_category: settings.hasOwnProperty('hide_currency_category') ? settings.hide_currency_category : false,
            hide_currency_product: settings.hasOwnProperty('hide_currency_product') ? settings.hide_currency_product : false,
            hide_header_cart: settings.hasOwnProperty('hide_header_cart') ? settings.hide_header_cart : false,
            hide_header_checkout: settings.hasOwnProperty('hide_header_checkout') ? settings.hide_header_checkout : false,
            show_category_in_breadcrumb: settings.hasOwnProperty('show_category_in_breadcrumb') ? settings.show_category_in_breadcrumb : true,
            show_permanent_search: settings.hasOwnProperty('show_permanent_search') ? settings.show_permanent_search : true,
            hide_shipping_costs: settings.hasOwnProperty('hide_shipping_costs') ? settings.hide_shipping_costs : false,
            hide_quantity_selector: settings.hasOwnProperty('hide_quantity_selector') ? settings.hide_quantity_selector : false,
            require_shipping_address: settings.hasOwnProperty('require_shipping_address') ? settings.require_shipping_address : true,
            collect_phone_number_at_checkout: settings.hasOwnProperty('collect_phone_number_at_checkout') ? settings.collect_phone_number_at_checkout : false,
            allow_guest_checkout: settings.hasOwnProperty('allow_guest_checkout') ? settings.allow_guest_checkout : true,
            allowed_countries: settings.allowed_countries || ["US", "CA", "GB", "DE", "FR"],
            // Root category navigation settings
            rootCategoryId: settings.rootCategoryId || null,
            excludeRootFromMenu: settings.hasOwnProperty('excludeRootFromMenu') ? settings.excludeRootFromMenu : false,
            expandAllMenuItems: settings.hasOwnProperty('expandAllMenuItems') ? settings.expandAllMenuItems : false,
            // Include all other settings...
            ...settings
          }
        });
        
      } else {
        setFlashMessage({ type: 'warning', message: 'Settings saved but response unclear. Please refresh to verify.' });
      }
      
    } catch (error) {
      setFlashMessage({ type: 'error', message: `Failed to save settings: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return <PageLoader size="lg" />;
  }

  // Ensure store is not null before rendering form elements that depend on it
  if (!store) {
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
          <h1 className="text-3xl font-bold text-gray-900">Store Settings</h1>
          <p className="text-gray-600 mt-1">Configure your store's basic information and preferences</p>
        </div>

        <Tabs value="general" className="w-full">

          <TabsContent value="general" className="mt-6">
            <Card className="material-elevation-1 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  General Settings
                </CardTitle>
                <CardDescription>Basic store information and branding</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Store Name</Label>
                    <Input
                      id="name"
                      value={store?.name || ''}
                      onChange={(e) => setStore(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="My Awesome Store"
                    />
                  </div>
                  <div>
                    <Label htmlFor="slug">Store Slug</Label>
                    <Input
                      id="slug"
                      value={store?.slug || ''}
                      onChange={(e) => setStore(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="my-awesome-store"
                      disabled={true} // Slugs are usually immutable after creation
                    />
                     <p className="text-sm text-gray-500 mt-1">This is your unique store identifier for URLs.</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Store Description</Label>
                  <Textarea
                    id="description"
                    value={store?.description || ''}
                    onChange={(e) => setStore(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of your store..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="logo_url">Store Logo</Label>
                  <StoreLogoUpload
                    value={store?.logo_url || ''}
                    onChange={(url) => setStore(prev => ({ ...prev, logo_url: url }))}
                    storeId={store?.id}
                    maxFileSizeMB={5}
                    allowedTypes={['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg']}
                  />
                  <p className="text-sm text-gray-500 mt-1">Upload your store logo (recommended size: 200x200px). Saves automatically.</p>
                </div>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="currency">Default Currency</Label>
                    <Select value={store?.currency || 'USD'} onValueChange={(value) => setStore(prev => ({ ...prev, currency: value }))}>
                      <SelectTrigger id="currency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                        <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar (C$)</SelectItem>
                        <SelectItem value="AUD">AUD - Australian Dollar (A$)</SelectItem>
                        <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                        <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                        <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
                        <SelectItem value="SEK">SEK - Swedish Krona (kr)</SelectItem>
                        <SelectItem value="NOK">NOK - Norwegian Krone (kr)</SelectItem>
                        <SelectItem value="DKK">DKK - Danish Krone (kr)</SelectItem>
                        <SelectItem value="PLN">PLN - Polish Zloty (zł)</SelectItem>
                        <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                        <SelectItem value="KRW">KRW - South Korean Won (₩)</SelectItem>
                        <SelectItem value="SGD">SGD - Singapore Dollar (S$)</SelectItem>
                        <SelectItem value="HKD">HKD - Hong Kong Dollar (HK$)</SelectItem>
                        <SelectItem value="MXN">MXN - Mexican Peso ($)</SelectItem>
                        <SelectItem value="BRL">BRL - Brazilian Real (R$)</SelectItem>
                        <SelectItem value="ZAR">ZAR - South African Rand (R)</SelectItem>
                        <SelectItem value="TRY">TRY - Turkish Lira (₺)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Store Status</Label>
                    <Select value={store?.status || 'active'} onValueChange={(value) => setStore(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <TimezoneSelect
                    value={store?.timezone || 'UTC'}
                    onChange={(timezone) => setStore(prev => ({ ...prev, timezone }))}
                    placeholder="Select your store's timezone..."
                    className="w-full"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This timezone will be used for order timestamps, scheduling, and reports
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="material-elevation-1 border-0 mt-6">
              <CardHeader>
                <CardTitle>Allowed Countries for Shipping/Billing</CardTitle>
                <CardDescription>Configure which countries are available for customer shipping and billing addresses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Select countries where your store operates</Label>
                  <CountrySelect
                    value={Array.isArray(store?.settings?.allowed_countries) ? store.settings.allowed_countries : []}
                    onChange={(countries) => handleSettingsChange('allowed_countries', countries)}
                    placeholder="Select countries where your store operates..."
                    multiple={true}
                  />
                  <p className="text-sm text-gray-500">
                    These countries will be available for shipping and billing addresses
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="material-elevation-1 border-0 mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Language Settings
                </CardTitle>
                <CardDescription>Configure supported languages and localization options for your store</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="active_languages">Active Languages</Label>
                  <MultiSelect
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'nl', label: 'Dutch (Nederlands)' },
                      { value: 'fr', label: 'French (Français)' },
                      { value: 'de', label: 'German (Deutsch)' },
                      { value: 'es', label: 'Spanish (Español)' },
                      { value: 'it', label: 'Italian (Italiano)' },
                      { value: 'pt', label: 'Portuguese (Português)' },
                      { value: 'pl', label: 'Polish (Polski)' },
                      { value: 'ru', label: 'Russian (Русский)' },
                      { value: 'zh', label: 'Chinese (中文)' },
                      { value: 'ja', label: 'Japanese (日本語)' },
                      { value: 'ko', label: 'Korean (한국어)' }
                    ]}
                    value={store?.settings?.active_languages || ['en']}
                    onChange={(languages) => handleSettingsChange('active_languages', languages)}
                    placeholder="Select active languages..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Select which languages are available in your store. Customers can switch between these languages.
                  </p>
                </div>

                <div>
                  <Label htmlFor="default_language">Default Language</Label>
                  <Select
                    value={store?.settings?.default_language || 'en'}
                    onValueChange={(value) => handleSettingsChange('default_language', value)}
                  >
                    <SelectTrigger id="default_language">
                      <SelectValue placeholder="Select default language" />
                    </SelectTrigger>
                    <SelectContent>
                      {(store?.settings?.active_languages || ['en']).map((lang) => {
                        const labels = {
                          en: 'English',
                          nl: 'Dutch (Nederlands)',
                          fr: 'French (Français)',
                          de: 'German (Deutsch)',
                          es: 'Spanish (Español)',
                          it: 'Italian (Italiano)',
                          pt: 'Portuguese (Português)',
                          pl: 'Polish (Polski)',
                          ru: 'Russian (Русский)',
                          zh: 'Chinese (中文)',
                          ja: 'Japanese (日本語)',
                          ko: 'Korean (한국어)'
                        };
                        return (
                          <SelectItem key={lang} value={lang}>
                            {labels[lang] || lang}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1">
                    This language will be used when a customer first visits your store or when their browser language is not supported.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="use_geoip_language" className="text-base">Use GeoIP Location</Label>
                    <p className="text-sm text-gray-500">
                      Automatically detect and set language based on customer's location
                    </p>
                  </div>
                  <Switch
                    id="use_geoip_language"
                    checked={store?.settings?.use_geoip_language || false}
                    onCheckedChange={(checked) => handleSettingsChange('use_geoip_language', checked)}
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="material-elevation-1 border-0 mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Contact Information
                </CardTitle>
                <CardDescription>Details for customer communication and support</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_email">Store Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={store?.contact_details?.email || ''}
                      onChange={(e) => handleContactChange('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="support_email">Support Email</Label>
                    <Input
                      id="support_email"
                      type="email"
                      value={store?.contact_details?.support_email || ''}
                      onChange={(e) => handleContactChange('support_email', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input
                      id="contact_phone"
                      value={store?.contact_details?.phone || ''}
                      onChange={(e) => handleContactChange('phone', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_address">Address</Label>
                    <Input
                      id="contact_address"
                      value={store?.contact_details?.address || ''}
                      onChange={(e) => handleContactChange('address', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_city">City</Label>
                    <Input
                      id="contact_city"
                      value={store?.contact_details?.city || ''}
                      onChange={(e) => handleContactChange('city', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_state">State/Province</Label>
                    <Input
                      id="contact_state"
                      value={store?.contact_details?.state || ''}
                      onChange={(e) => handleContactChange('state', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_postal">Postal Code</Label>
                    <Input
                      id="contact_postal"
                      value={store?.contact_details?.postal_code || ''}
                      onChange={(e) => handleContactChange('postal_code', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_country">Country</Label>
                    <CountrySelect
                      id="contact_country"
                      value={store?.contact_details?.country || ''}
                      onChange={(country) => handleContactChange('country', country)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        <div className="flex justify-end mt-8">
          <SaveButton
            onClick={handleSave}
            loading={saving}
            success={saveSuccess}
            disabled={!store?.id}
            defaultText="Save All Settings"
          />
        </div>
      </div>
    </div>
  );
}
