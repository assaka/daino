import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../utils/api';

const TranslationContext = createContext();

// Global cache to prevent duplicate language fetches across all instances (use window)
if (typeof window !== 'undefined') {
  if (!window.__languagesCache) {
    window.__languagesCache = null;
  }
  if (typeof window.__languagesFetching === 'undefined') {
    window.__languagesFetching = false;
  }
}

/**
 * Translation Provider Component
 *
 * Manages translation state and provides translation functions
 * throughout the application.
 *
 * For admin panel: Uses store from StoreSelectionContext (must be wrapped in StoreSelectionProvider)
 * For storefront: Expects storeId prop from StoreProvider
 */
export function TranslationProvider({ children, storeId: propStoreId, initialLanguages, initialTranslations }) {
  // For admin panel, storeId will come from the component that uses TranslationContext
  // For storefront, storeId is passed as a prop along with bootstrap data
  // This context is now primarily used for managing translation state, not fetching with store_id
  const storeId = propStoreId;

  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [availableLanguages, setAvailableLanguages] = useState(initialLanguages || []);
  const [translations, setTranslations] = useState(initialTranslations?.labels || {});
  const [loading, setLoading] = useState(true);
  const [isRTL, setIsRTL] = useState(false);

  /**
   * Load available languages from API (only if not provided via initialLanguages)
   * Storefront: Uses initialLanguages from bootstrap (no API call)
   * Admin: Fetches from API
   */
  const loadAvailableLanguages = useCallback(async () => {
    // CRITICAL: If languages provided from bootstrap, use them (no API call!)
    if (initialLanguages && Array.isArray(initialLanguages) && initialLanguages.length > 0) {
      const activeLanguages = initialLanguages.filter(lang => lang.is_active !== false);
      setAvailableLanguages(activeLanguages);

      // Set RTL status
      const current = activeLanguages.find(lang => lang.code === currentLanguage);
      if (current) {
        setIsRTL(current.is_rtl || false);
      }
      setLoading(false);
      return; // Skip API call!
    }

    // If already loaded, skip
    if (availableLanguages.length > 0) {
      setLoading(false);
      return; // Skip duplicate API call!
    }

    // Check global cache first
    if (window.__languagesCache) {
      setAvailableLanguages(window.__languagesCache);
      setLoading(false);
      return; // Use cached data!
    }

    // If another instance is already fetching, wait for it
    if (window.__languagesFetching) {
      // Wait for the other fetch to complete
      const checkCache = setInterval(() => {
        if (window.__languagesCache) {
          setAvailableLanguages(window.__languagesCache);
          setLoading(false);
          clearInterval(checkCache);
        }
      }, 100);
      return;
    }

    // CRITICAL: For admin panel, check if selectedStoreId is available before making API call
    const selectedStoreId = localStorage.getItem('selectedStoreId');
    if (!selectedStoreId || selectedStoreId === 'undefined') {
      console.warn('⚠️ TranslationContext: No store selected yet, using English fallback');
      const fallback = [
        { code: 'en', name: 'English', native_name: 'English', is_active: true, is_rtl: false }
      ];
      window.__languagesCache = fallback;
      setAvailableLanguages(fallback);
      setLoading(false);
      return; // Don't make API call without store_id!
    }

    // Otherwise fetch from API (for admin panel ONLY)
    window.__languagesFetching = true;

    try {
      const response = await api.get('/languages');

      if (response && response.success && response.data) {
        // Handle data structure: response.data.languages or response.data
        const languagesData = response.data.languages || response.data || [];
        const languages = Array.isArray(languagesData)
          ? languagesData.filter(lang => lang.is_active)
          : [];

        if (languages.length > 0) {
          window.__languagesCache = languages; // Cache globally
          setAvailableLanguages(languages);

          // Set RTL status based on current language
          const current = languages.find(lang => lang.code === currentLanguage);
          if (current) {
            setIsRTL(current.is_rtl || false);
          }
        } else {
          // No active languages found, use English fallback
          const fallback = [
            { code: 'en', name: 'English', native_name: 'English', is_active: true, is_rtl: false }
          ];
          window.__languagesCache = fallback;
          setAvailableLanguages(fallback);
        }
      } else {
        // Invalid response, use English fallback
        setAvailableLanguages([
          { code: 'en', name: 'English', native_name: 'English', is_active: true, is_rtl: false }
        ]);
      }
    } catch (error) {
      console.error('Failed to load languages:', error);
      // Fallback to English only
      const fallback = [
        { code: 'en', name: 'English', native_name: 'English', is_active: true, is_rtl: false }
      ];
      window.__languagesCache = fallback;
      setAvailableLanguages(fallback);
    } finally {
      window.__languagesFetching = false;
    }
  }, [currentLanguage, initialLanguages, availableLanguages.length]);

  /**
   * Load UI translations for current language
   */
  const loadTranslations = useCallback(async (lang) => {
    // If translations provided from bootstrap, use them (no API call!)
    if (initialTranslations && initialTranslations.labels) {
      setTranslations(initialTranslations.labels);
      setLoading(false);
      return; // Skip API call!
    }

    try {
      setLoading(true);
      if (!storeId) {
        console.warn('No store_id available for translation loading');
        setTranslations({});
        setLoading(false);
        return;
      }
      const response = await api.get(`/translations/ui-labels?store_id=${storeId}&lang=${lang}`);

      // API client returns the full backend response for translations endpoints
      // Backend response structure: { success: true, data: { language: 'nl', labels: {...} } }
      if (response && response.success && response.data && response.data.labels) {
        setTranslations(response.data.labels);
      }
    } catch (error) {
      console.error('Failed to load translations:', error);
      setTranslations({});
    } finally {
      setLoading(false);
    }
  }, [storeId, initialTranslations]);

  /**
   * Change current language
   */
  const changeLanguage = useCallback(async (langCode) => {

    // Save to localStorage
    localStorage.setItem('daino_language', langCode);

    // Update state
    setCurrentLanguage(langCode);

    // Update RTL status
    const language = availableLanguages.find(lang => lang.code === langCode);
    if (language) {
      setIsRTL(language.is_rtl || false);

      // Update HTML dir attribute for RTL
      document.documentElement.dir = language.is_rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = langCode;
    }

    // Load translations for new language (only if storeId is available)
    if (storeId) {
      await loadTranslations(langCode);
    } else {
    }

    // Dispatch custom event for language change
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: langCode } }));
  }, [availableLanguages, loadTranslations, storeId]);

  /**
   * Get translated text by key
   */
  const t = useCallback((key, defaultValue = '') => {
    // Support nested keys with dot notation (e.g., "common.button.submit")
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Key not found - return default or formatted key
        const fallback = defaultValue || key;
        return typeof fallback === 'string' ? fallback : String(fallback || '');
      }
    }

    // Always return a string - React error #300 if object is rendered
    if (typeof value === 'string') {
      return value;
    }
    // Value is not a string (could be object, array, etc.) - use fallback
    const fallback = defaultValue || key;
    return typeof fallback === 'string' ? fallback : String(fallback || '');
  }, [translations]);

  /**
   * Get entity translation (for products, categories, etc.)
   */
  const getEntityTranslation = useCallback((entity, field, fallbackLang = 'en') => {
    if (!entity || !entity.translations) {
      return '';
    }

    // Try current language first
    if (entity.translations[currentLanguage] && entity.translations[currentLanguage][field]) {
      return entity.translations[currentLanguage][field];
    }

    // Fallback to specified language
    if (entity.translations[fallbackLang] && entity.translations[fallbackLang][field]) {
      return entity.translations[fallbackLang][field];
    }

    // Return empty string if not found
    return '';
  }, [currentLanguage]);

  /**
   * Format number according to current locale
   */
  const formatNumber = useCallback((number, options = {}) => {
    try {
      return new Intl.NumberFormat(currentLanguage, options).format(number);
    } catch (error) {
      return number.toString();
    }
  }, [currentLanguage]);

  /**
   * Format currency according to current locale
   */
  const formatCurrency = useCallback((amount, currency = 'USD') => {
    try {
      return new Intl.NumberFormat(currentLanguage, {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch (error) {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }, [currentLanguage]);

  /**
   * Format date according to current locale
   */
  const formatDate = useCallback((date, options = {}) => {
    try {
      return new Intl.DateTimeFormat(currentLanguage, options).format(new Date(date));
    } catch (error) {
      return date.toString();
    }
  }, [currentLanguage]);

  /**
   * Initialize translations
   */
  useEffect(() => {
    const initializeTranslations = async () => {
      // Load available languages
      await loadAvailableLanguages();

      // Check for saved language preference
      const savedLang = localStorage.getItem('daino_language');
      const browserLang = navigator.language?.split('-')[0];
      const initialLang = savedLang || browserLang || 'en';

      // Set initial language
      setCurrentLanguage(initialLang);

      // Update HTML attributes
      document.documentElement.lang = initialLang;

      // CRITICAL: If bootstrap provided translations, ONLY use those (no API call)
      if (initialTranslations && initialTranslations.labels) {
        setTranslations(initialTranslations.labels);
        setLoading(false);
        return; // STOP - don't fetch from API!
      }

      // Only fetch translations for admin panel (no initialTranslations)
      if (storeId && !initialTranslations) {
        await loadTranslations(initialLang);
      } else {
        setLoading(false);
      }
    };

    initializeTranslations();

    // Listen for store selection changes and reload languages
    const handleStoreChange = () => {
      // Clear the cache so languages get reloaded for the new store
      window.__languagesCache = null;
      window.__languagesFetching = false;
      // Reload languages for the newly selected store
      loadAvailableLanguages();
    };

    window.addEventListener('storeSelectionChanged', handleStoreChange);

    return () => {
      window.removeEventListener('storeSelectionChanged', handleStoreChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]); // Only re-run when storeId changes, NOT when initialTranslations changes

  const value = {
    // State
    currentLanguage,
    availableLanguages,
    translations,
    loading,
    isRTL,

    // Functions
    changeLanguage,
    t,
    getEntityTranslation,
    formatNumber,
    formatCurrency,
    formatDate,
    loadTranslations,
    loadAvailableLanguages
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * useTranslation Hook
 *
 * Access translation context in functional components
 *
 * @example
 * const { t, currentLanguage, changeLanguage } = useTranslation();
 *
 * return (
 *   <div>
 *     <h1>{t('common.welcome')}</h1>
 *     <button onClick={() => changeLanguage('es')}>Español</button>
 *   </div>
 * );
 */
export function useTranslation() {
  const context = useContext(TranslationContext);

  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }

  return context;
}

/**
 * withTranslation HOC
 *
 * Inject translation props into class components
 *
 * @example
 * class MyComponent extends React.Component {
 *   render() {
 *     const { t } = this.props;
 *     return <h1>{t('common.welcome')}</h1>;
 *   }
 * }
 *
 * export default withTranslation(MyComponent);
 */
export function withTranslation(Component) {
  return function TranslatedComponent(props) {
    const translation = useTranslation();
    return <Component {...props} {...translation} />;
  };
}

export default TranslationContext;
