/**
 * EditorStoreProvider - Provides store context for editor pages
 *
 * This is a lightweight alternative to the full StoreProvider for use
 * in editor pages where:
 * - We don't have a store slug in the URL
 * - We use StoreSelectionContext to get the selected store
 * - We need to provide store data for header components
 *
 * This provider fetches store data and provides it via StoreContext
 * so that components like MiniCart, HeaderSearch can use useStore().
 */

import React, { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { StoreContext } from '@/components/storefront/StoreProvider';
import { TranslationProvider } from '@/contexts/TranslationContext';
import TranslationContext from '@/contexts/TranslationContext';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { useCategories, useFilterableAttributes, useProductLabels, useTaxes, useTranslations } from '@/hooks/useApiQueries';
import { useSlotConfiguration } from '@/hooks/useApiQueries';
import { mergeStoreSettings, setThemeDefaultsFromBootstrap } from '@/utils/storeSettingsDefaults';
import { useStoreBootstrap } from '@/hooks/useStoreBootstrap';

/**
 * Hook to get store context value for passing to context bridge
 * Use this in components that render ResponsiveIframe with context bridging
 */
export const useEditorStoreContext = () => {
  return useContext(StoreContext);
};

/**
 * Hook to get translation context value for passing to context bridge
 */
export const useEditorTranslationContext = () => {
  return useContext(TranslationContext);
};

/**
 * EditorStoreProvider Component
 *
 * Wraps editor pages with store and translation context.
 * Fetches store data based on selected store from StoreSelectionContext.
 */
export function EditorStoreProvider({ children }) {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const storeId = getSelectedStoreId();
  const storeSlug = selectedStore?.slug;

  const [selectedCountry, setSelectedCountry] = useState(() => {
    return localStorage.getItem('selectedCountry') || 'US';
  });

  // Get current language from localStorage or default to 'en'
  const currentLanguage = typeof localStorage !== 'undefined'
    ? localStorage.getItem('daino_language') || 'en'
    : 'en';

  // CRITICAL: Fetch bootstrap data to get full store settings (including theme settings)
  // This ensures editor preview uses the same settings as the live storefront
  const { data: bootstrap, isLoading: bootstrapLoading, refetch: refetchBootstrap } = useStoreBootstrap(storeSlug, currentLanguage);

  // Set theme defaults from bootstrap (same as StoreProvider)
  useEffect(() => {
    if (bootstrap?.themeDefaults) {
      setThemeDefaultsFromBootstrap(bootstrap.themeDefaults);
    }
  }, [bootstrap?.themeDefaults]);

  // Listen for settings updates from admin panel (e.g., ThemeLayout changes)
  // Refetch bootstrap to get latest settings without page reload
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('store_settings_update');
      channel.onmessage = (event) => {
        if (event.data.type === 'clear_cache' || event.data.type === 'settings_updated') {
          console.log('[EditorStoreProvider] Settings updated, refetching bootstrap');
          refetchBootstrap();
        }
      };
      return () => channel.close();
    } catch (e) {
      // BroadcastChannel not supported in some browsers
      console.warn('BroadcastChannel not supported:', e);
    }
  }, [refetchBootstrap]);

  // Fetch additional data using React Query hooks (as fallback if not in bootstrap)
  const { data: categories = [] } = useCategories(storeId, { enabled: !!storeId && !bootstrap?.categories });
  const { data: filterableAttributes = [] } = useFilterableAttributes(storeId, { enabled: !!storeId });
  const { data: productLabels = [] } = useProductLabels(storeId, { enabled: !!storeId && !bootstrap?.productLabels });
  const { data: taxes = [] } = useTaxes(storeId, { enabled: !!storeId });
  const { data: translations = {} } = useTranslations(storeId, currentLanguage, { enabled: !!storeId && !bootstrap?.translations });

  // Build the store context value
  const storeContextValue = useMemo(() => {
    if (!selectedStore) {
      return null;
    }

    // Use bootstrap data if available, otherwise fall back to selectedStore
    const storeData = bootstrap?.store || selectedStore;

    // Merge settings with defaults - prioritize bootstrap settings (full settings from API)
    const mergedSettings = storeData.settings
      ? mergeStoreSettings({ ...storeData, settings: storeData.settings })
      : {};

    return {
      store: {
        ...storeData,
        settings: mergedSettings
      },
      settings: mergedSettings,
      loading: bootstrapLoading,

      // Categories and attributes - prefer bootstrap data
      categories: bootstrap?.categories || categories,
      filterableAttributes,

      // Product labels and taxes
      productLabels: bootstrap?.productLabels || productLabels,
      taxes,

      // Languages - from bootstrap or minimal for editor
      languages: bootstrap?.languages || [],

      // User - from bootstrap or not logged in for editor preview
      user: bootstrap?.user || null,

      // Wishlist - from bootstrap or empty for editor
      wishlist: bootstrap?.wishlist || [],

      // SEO
      seoSettings: bootstrap?.seoSettings || {},
      seoTemplates: bootstrap?.seoTemplates || [],

      // Attributes
      attributes: [],
      attributeSets: [],

      // Country selection
      selectedCountry,
      setSelectedCountry: (country) => {
        setSelectedCountry(country);
        localStorage.setItem('selectedCountry', country);
      },

      // Storefront variant
      storefront: bootstrap?.storefront || null,
      isPreviewMode: false,

      // Header slot config - from bootstrap
      headerSlotConfig: bootstrap?.headerSlotConfig || null,

      // Translations from bootstrap
      translations: bootstrap?.translations || null,
    };
  }, [selectedStore, bootstrap, bootstrapLoading, categories, filterableAttributes, productLabels, taxes, selectedCountry]);

  // Build translation context value with fetched translations
  // Prefer bootstrap translations over separate translations fetch
  const effectiveTranslations = bootstrap?.translations?.labels || translations;

  const translationContextValue = useMemo(() => {
    // Helper to get nested value from dotted key
    const getNestedValue = (obj, key) => {
      if (!obj || typeof key !== 'string') return null;
      const keys = key.split('.');
      let current = obj;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return null;
        }
      }
      return typeof current === 'string' ? current : null;
    };

    return {
      t: (key, fallback) => {
        const value = getNestedValue(effectiveTranslations, key);
        return value || fallback || key;
      },
      currentLanguage,
      availableLanguages: bootstrap?.languages || [],
      translations: effectiveTranslations,
      loading: bootstrapLoading,
      isRTL: false,
      changeLanguage: () => {},
      getEntityTranslation: () => '',
      formatNumber: (num) => num.toString(),
      formatCurrency: (amount, currency = 'USD') => `${currency} ${amount.toFixed(2)}`,
      formatDate: (date) => new Date(date).toLocaleDateString()
    };
  }, [effectiveTranslations, currentLanguage, bootstrap?.languages, bootstrapLoading]);

  // If no store selected, just render children without context
  if (!storeId || !storeContextValue) {
    return <>{children}</>;
  }

  // Wait for bootstrap to load before rendering editor with settings
  // This ensures editor preview has the correct theme settings from the database
  if (bootstrapLoading && !bootstrap) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <StoreContext.Provider value={storeContextValue}>
      <TranslationContext.Provider value={translationContextValue}>
        {children}
      </TranslationContext.Provider>
    </StoreContext.Provider>
  );
}

export default EditorStoreProvider;
