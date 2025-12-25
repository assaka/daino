/**
 * StoreProvider - Refactored for Clarity and Performance
 *
 * REFACTORED: Reduced from 934 lines to ~350 lines
 * - Extracted settings merging to utils/storeSettingsDefaults.js
 * - Extracted caching to utils/cacheUtils.js
 * - Uses useStoreBootstrap hook for Layer 1 data (eliminates duplicate API calls)
 * - Uses fetchAdditionalStoreData for Layer 3 data
 *
 * 3-Layer Architecture:
 * Layer 1 (Bootstrap): Global data loaded once - store, languages, translations, categories, SEO
 * Layer 2 (CMS): Page-specific content (future)
 * Layer 3 (Dynamic): Taxes, labels, attributes (frequently changing)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { storefrontApiClient } from '@/api/storefront-entities';
import { shouldSkipStoreProvider } from '@/utils/domainConfig';

// New utilities and hooks
import { useStoreBootstrap, useStoreSlugById, determineStoreSlug } from '@/hooks/useStoreBootstrap';
import { fetchAdditionalStoreData, fetchCookieConsentSettings } from '@/hooks/useStoreData';
import { mergeStoreSettings, setThemeDefaultsFromBootstrap } from '@/utils/storeSettingsDefaults';
import { clearCache, deleteCacheKey } from '@/utils/cacheUtils';
import {PageLoader} from "@/components/ui/page-loader.jsx";

// European countries get EUR, all others get USD (Stripe only supports EUR/USD)
const EUROPEAN_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE', 'GB', 'CH', 'NO', 'IS', 'LI', 'AD', 'MC', 'SM', 'VA'
];

// Export StoreContext so it can be re-provided inside iframe portals (for editor context bridging)
export const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

// Re-export cachedApiCall for backward compatibility
export { cachedApiCall, clearCache, clearCacheKeys } from '@/utils/cacheUtils';

export const StoreProvider = ({ children }) => {
  const location = useLocation();

  // Check if we should skip StoreProvider BEFORE any conditional logic
  // but AFTER useLocation (which is always called)
  const shouldSkip = shouldSkipStoreProvider(location.pathname);

  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(() => {
    return localStorage.getItem('selectedCountry') || 'US';
  });

  // Step 1: Try to get store slug (use useState to prevent re-renders)
  const [resolvedSlug, setResolvedSlug] = useState(() => {
    if (shouldSkip) return null;
    const slug = determineStoreSlug(location);
    return slug;
  });

  const storeId = !resolvedSlug && !shouldSkip ? localStorage.getItem('selectedStoreId') : null;

  // Step 2: If no slug but have ID, fetch slug first
  const { data: fetchedSlug, isLoading: slugLoading } = useStoreSlugById(storeId);

  // Use fetched slug if we had to look it up
  useEffect(() => {
    if (shouldSkip) return;
    if (!resolvedSlug && fetchedSlug) {
      setResolvedSlug(fetchedSlug);
      localStorage.setItem('selectedStoreSlug', fetchedSlug);
    }
  }, [fetchedSlug, resolvedSlug, shouldSkip]);

  const language = localStorage.getItem('daino_language') || 'en';

  // LAYER 1: Bootstrap data (global data - 1 API call)
  // Pass null slug when skipping to prevent API calls
  const { data: bootstrap, isLoading: bootstrapLoading, refetch: refetchBootstrap, error: bootstrapError } = useStoreBootstrap(shouldSkip ? null : resolvedSlug, language);

  // Main data loading effect
  // IMPORTANT: All hooks must be called before any conditional returns (React Rules of Hooks)
  useEffect(() => {
    // Skip data loading if shouldSkip is true
    if (shouldSkip) return;

    if (slugLoading || bootstrapLoading || !bootstrap) {
      setLoading(true);
      return;
    }

    const loadStoreData = async () => {
      try {
        const store = bootstrap.store;

        if (!store) {
          setLoading(false);
          return;
        }

        // Set theme defaults from bootstrap (if available) before merging
        // This ensures DB-defined defaults are used as the middle layer
        if (bootstrap.themeDefaults) {
          setThemeDefaultsFromBootstrap(bootstrap.themeDefaults);
        }

        // Merge settings with defaults
        const mergedSettings = mergeStoreSettings(store);

        // Set API client context with both slug and ID
        storefrontApiClient.setStoreContext(store.slug, store.id);

        // Initialize language
        const savedLang = localStorage.getItem('daino_language');
        if (!savedLang) {
          const defaultLang = mergedSettings.default_language || 'en';
          localStorage.setItem('daino_language', defaultLang);
        } else {
          const activeLanguages = mergedSettings.active_languages || ['en'];
          if (!activeLanguages.includes(savedLang)) {
            const defaultLang = mergedSettings.default_language || 'en';
            localStorage.setItem('daino_language', defaultLang);
          }
        }

        // Handle country selection
        const currentSelectedCountry = localStorage.getItem('selectedCountry') || 'US';
        const allowedCountries = mergedSettings.allowed_countries || ['US'];

        if (!allowedCountries.includes(currentSelectedCountry)) {
          const newCountry = allowedCountries[0] || 'US';
          setSelectedCountry(newCountry);
          localStorage.setItem('selectedCountry', newCountry);
        } else {
          setSelectedCountry(currentSelectedCountry);
        }

        // LAYER 3: Fetch additional data NOT in bootstrap
        const isAdminPage = location.pathname.includes('/admin/');

        // Only fetch cookie consent on storefront pages, not admin
        const [additionalData, cookieConsent] = await Promise.all([
          fetchAdditionalStoreData(store.id, language),
          !isAdminPage ? fetchCookieConsentSettings(store.id) : Promise.resolve(null)
        ]);

        // Merge cookie consent into settings (only for storefront)
        if (cookieConsent) {
          mergedSettings.cookie_consent = cookieConsent;
        }

        // Load UI translations (from bootstrap)
        const currentLang = localStorage.getItem('daino_language') || mergedSettings.default_language || 'en';
        if (!mergedSettings.ui_translations) {
          mergedSettings.ui_translations = {};
        }
        mergedSettings.ui_translations[currentLang] = bootstrap.translations?.labels || {};

        // Set all data
        const finalStoreData = {
          // Layer 1 - From bootstrap
          store: { ...store, settings: mergedSettings },
          storefront: bootstrap.storefront || null,
          languages: bootstrap.languages || [],
          categories: bootstrap.categories || [],
          seoSettings: bootstrap.seoSettings || {},
          seoTemplates: bootstrap.seoTemplates || [],
          wishlist: bootstrap.wishlist || [],
          user: bootstrap.user || null,
          headerSlotConfig: bootstrap.headerSlotConfig || null,
          // UI translations for TranslationProvider
          translations: bootstrap.translations || null,

          // Layer 3 - Additional data
          taxes: additionalData.taxes || [],
          productLabels: additionalData.productLabels || [],
          attributes: additionalData.attributes || [],
          filterableAttributes: additionalData.filterableAttributes || [],
          attributeSets: additionalData.attributeSets || [],
        };

        setStoreData(finalStoreData);

        setLoading(false);
      } catch (error) {
        console.error('StoreProvider: Failed to load store data:', error);
        setLoading(false);
      }
    };

    loadStoreData();
  }, [bootstrap, bootstrapLoading, slugLoading, language, location.pathname, shouldSkip]);

  // Event Listener: Store selection changes
  useEffect(() => {
    if (shouldSkip) return;
    const handleStoreChange = () => {
      clearCache();
      refetchBootstrap();
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);
    return () => window.removeEventListener('storeSelectionChanged', handleStoreChange);
  }, [refetchBootstrap, shouldSkip]);

  // Event Listener: Language changes
  useEffect(() => {
    if (shouldSkip) return;
    const handleLanguageChange = () => {
      clearCache();
      refetchBootstrap();
    };

    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, [refetchBootstrap, shouldSkip]);

  // Event Listener: Cache clear broadcasts (from admin)
  useEffect(() => {
    if (shouldSkip) return;
    try {
      const storeChannel = new BroadcastChannel('store_settings_update');
      storeChannel.onmessage = (event) => {
        if (event.data.type === 'clear_cache') {
          clearCache();

          const isAdminPage = window.location.pathname.includes('/admin/');
          if (!isAdminPage) {
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
      };

      // Translation updates
      const translationsChannel = new BroadcastChannel('translations_update');
      translationsChannel.onmessage = (event) => {
        if (event.data.type === 'clear_translations_cache') {
          const lang = event.data.language;
          const translationsCacheKey = `ui-translations-${lang}`;
          deleteCacheKey(translationsCacheKey);

          const isAdminPage = window.location.pathname.includes('/admin/');
          if (!isAdminPage) {
            window.location.reload(true);
          }
        }
      };

      return () => {
        storeChannel.close();
        translationsChannel.close();
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }, [shouldSkip]);

  // Country selection handler
  const handleSetSelectedCountry = useCallback((country) => {
    setSelectedCountry(country);
    localStorage.setItem('selectedCountry', country);
  }, []);

  // Use centralized config to decide if we should skip StoreProvider
  // Admin/editor pages use StoreSelectionContext instead - see domainConfig.js
  // IMPORTANT: This check must be AFTER all hooks to comply with React Rules of Hooks
  if (shouldSkip) {
    return <>{children}</>;
  }

  // Context value
  // Check for storefront preview mode
  const urlParams = new URLSearchParams(window.location.search);
  const isPreviewMode = !!urlParams.get('storefront');

  // Get customer's currency based on their selected country (EUR for Europe, USD for rest)
  const customerCurrencyCode = EUROPEAN_COUNTRIES.includes(selectedCountry) ? 'EUR' : 'USD';
  const customerCurrencySymbol = customerCurrencyCode === 'EUR' ? '€' : '$';

  // Override settings with customer's currency
  const baseSettings = storeData?.store?.settings || {};
  const settings = {
    ...baseSettings,
    currency_code: customerCurrencyCode,
    currency_symbol: customerCurrencySymbol,
  };

  const value = {
    store: storeData?.store,
    settings,
    loading,

    // Layer 1 - Global data from bootstrap
    languages: storeData?.languages || [],
    categories: storeData?.categories || [],
    seoSettings: storeData?.seoSettings || {},
    seoTemplates: storeData?.seoTemplates || [],
    wishlist: storeData?.wishlist || [],
    user: storeData?.user,
    headerSlotConfig: storeData?.headerSlotConfig,

    // Storefront variant support
    storefront: storeData?.storefront || null,
    isPreviewMode,

    // Layer 3 - Additional data
    taxes: storeData?.taxes || [],
    productLabels: storeData?.productLabels || [],
    attributes: storeData?.attributes || [],
    filterableAttributes: storeData?.filterableAttributes || [],
    attributeSets: storeData?.attributeSets || [],

    // Country selection
    selectedCountry,
    setSelectedCountry: handleSetSelectedCountry,
  };

  return (
    <StoreContext.Provider value={value}>
      {storeData?.languages ? (
        <TranslationProvider
          storeId={storeData.store.id}
          initialLanguages={storeData.languages}
          initialTranslations={storeData.translations}
        >
          {children}
        </TranslationProvider>
      ) : (
        // show loading spinner
          <PageLoader size="lg" className="h-screen" />
      )}
    </StoreContext.Provider>
  );
};
