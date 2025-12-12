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
import { mergeStoreSettings } from '@/utils/storeSettingsDefaults';

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

  const [selectedCountry, setSelectedCountry] = useState(() => {
    return localStorage.getItem('selectedCountry') || 'US';
  });

  // Get current language from localStorage or default to 'en'
  const currentLanguage = typeof localStorage !== 'undefined'
    ? localStorage.getItem('daino_language') || 'en'
    : 'en';

  // Fetch additional data using React Query hooks
  const { data: categories = [] } = useCategories(storeId, { enabled: !!storeId });
  const { data: filterableAttributes = [] } = useFilterableAttributes(storeId, { enabled: !!storeId });
  const { data: productLabels = [] } = useProductLabels(storeId, { enabled: !!storeId });
  const { data: taxes = [] } = useTaxes(storeId, { enabled: !!storeId });
  const { data: translations = {} } = useTranslations(storeId, currentLanguage, { enabled: !!storeId });

  // Build the store context value
  const storeContextValue = useMemo(() => {
    if (!selectedStore) {
      return null;
    }

    // Merge settings with defaults
    const mergedSettings = selectedStore.settings
      ? mergeStoreSettings({ ...selectedStore, settings: selectedStore.settings })
      : {};

    return {
      store: {
        ...selectedStore,
        settings: mergedSettings
      },
      settings: mergedSettings,
      loading: false,

      // Categories and attributes
      categories,
      filterableAttributes,

      // Product labels and taxes
      productLabels,
      taxes,

      // Languages - minimal for editor
      languages: [],

      // User - not logged in for editor preview
      user: null,

      // Wishlist - empty for editor
      wishlist: [],

      // SEO
      seoSettings: {},
      seoTemplates: [],

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
      storefront: null,
      isPreviewMode: false,

      // Header slot config - will be fetched separately by editors
      headerSlotConfig: null
    };
  }, [selectedStore, categories, filterableAttributes, productLabels, taxes, selectedCountry]);

  // Build translation context value with fetched translations
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
        const value = getNestedValue(translations, key);
        return value || fallback || key;
      },
      currentLanguage,
      availableLanguages: [],
      translations,
      loading: false,
      isRTL: false,
      changeLanguage: () => {},
      getEntityTranslation: () => '',
      formatNumber: (num) => num.toString(),
      formatCurrency: (amount, currency = 'USD') => `${currency} ${amount.toFixed(2)}`,
      formatDate: (date) => new Date(date).toLocaleDateString()
    };
  }, [translations, currentLanguage]);

  // If no store selected, just render children without context
  if (!storeId || !storeContextValue) {
    return <>{children}</>;
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
