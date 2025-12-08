/**
 * Additional Store Data Hook - Layer 3 Dynamic Data
 *
 * Fetches store data that is NOT included in the bootstrap endpoint.
 * This includes frequently changing data that needs shorter cache TTL.
 *
 * Data fetched here:
 * - Taxes (changes when tax rules are updated)
 * - Product labels (changes when labels are activated/deactivated)
 * - Attributes (changes when attributes are added/modified)
 * - Attribute sets (changes when sets are configured)
 */

import {
  StorefrontTax,
  StorefrontProductLabel,
  StorefrontAttribute,
  StorefrontAttributeSet,
  StorefrontCookieConsentSettings
} from '@/api/storefront-entities';
import {
  cachedApiCall,
  CACHE_DURATION_SHORT,
  CACHE_DURATION_MEDIUM,
  CACHE_DURATION_LONG
} from '@/utils/cacheUtils';

/**
 * Fetch additional store data NOT in bootstrap (Layer 3)
 * @param {string} storeId - Store ID
 * @param {string} language - Language code
 * @returns {Promise<Object>} Additional store data
 */
export async function fetchAdditionalStoreData(storeId, language) {
  if (!storeId) {
    console.warn('useStoreData: No store ID provided');
    return {
      taxes: [],
      productLabels: [],
      attributes: [],
      filterableAttributes: [],
      attributeSets: [],
    };
  }

  const dataPromises = [
    // 1. Taxes - frequently updated by admin
    cachedApiCall(`taxes-${storeId}`, async () => {
      const result = await StorefrontTax.filter({ store_id: storeId });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_SHORT),

    // 2. Product labels - frequently updated
    cachedApiCall(`labels-${storeId}-${language}`, async () => {
      const result = await StorefrontProductLabel.filter({ store_id: storeId });
      return Array.isArray(result) ? result.filter(l => l.is_active !== false) : [];
    }, CACHE_DURATION_SHORT),

    // 3. Attributes - semi-static data
    cachedApiCall(`attributes-${storeId}`, async () => {
      const result = await StorefrontAttribute.filter({ store_id: storeId });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_MEDIUM),

    // 4. Filterable attributes only - used for category filters
    cachedApiCall(`filterable-attributes-${storeId}`, async () => {
      const result = await StorefrontAttribute.filter({
        store_id: storeId,
        is_filterable: true
      });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_MEDIUM),

    // 5. Attribute sets - semi-static data
    cachedApiCall(`attr-sets-${storeId}`, async () => {
      const result = await StorefrontAttributeSet.filter({ store_id: storeId });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_MEDIUM),
  ];

  try {
    const results = await Promise.allSettled(dataPromises);

    return {
      taxes: results[0].status === 'fulfilled' ? results[0].value : [],
      productLabels: results[1].status === 'fulfilled' ? results[1].value : [],
      attributes: results[2].status === 'fulfilled' ? results[2].value : [],
      filterableAttributes: results[3].status === 'fulfilled' ? results[3].value : [],
      attributeSets: results[4].status === 'fulfilled' ? results[4].value : [],
    };
  } catch (error) {
    console.error('useStoreData: Failed to fetch additional data:', error);
    return {
      taxes: [],
      productLabels: [],
      attributes: [],
      filterableAttributes: [],
      attributeSets: [],
    };
  }
}

/**
 * Fetch cookie consent settings separately (not in bootstrap, but needed by store)
 * @param {string} storeId - Store ID
 * @returns {Promise<Object|null>} Cookie consent settings
 */
export async function fetchCookieConsentSettings(storeId) {
  if (!storeId) return null;

  try {
    // Check if cache version changed (admin panel increments this on save)
    const currentCacheVersion = localStorage.getItem('cookieConsentCacheVersion') || '0';
    const lastKnownVersion = sessionStorage.getItem('lastCookieConsentVersion') || '0';

    // If version changed, we'll fetch fresh data (cachedApiCall will handle cache clearing)
    if (currentCacheVersion !== lastKnownVersion) {
      sessionStorage.setItem('lastCookieConsentVersion', currentCacheVersion);
    }

    const cookieConsentData = await cachedApiCall(`cookie-consent-${storeId}`, async () => {
      const result = await StorefrontCookieConsentSettings.filter({ store_id: storeId });
      return Array.isArray(result) ? result : [];
    }, CACHE_DURATION_LONG);

    if (cookieConsentData && cookieConsentData.length > 0) {
      const cookieSettings = cookieConsentData[0];

      // Map backend cookie settings to frontend format
      return {
        enabled: cookieSettings.is_enabled || false,
        gdpr_mode: cookieSettings.gdpr_mode ?? true,
        auto_detect_country: cookieSettings.auto_detect_country ?? true,
        banner_message: cookieSettings.banner_text || "We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking 'Accept All', you consent to our use of cookies.",
        accept_all_text: cookieSettings.accept_button_text || "Accept All",
        reject_all_text: cookieSettings.reject_button_text || "Reject All",
        manage_preferences_text: cookieSettings.settings_button_text || "Cookie Settings",
        privacy_policy_text: cookieSettings.privacy_policy_text || "Privacy Policy",
        privacy_policy_url: cookieSettings.privacy_policy_url || "/privacy-policy",
        banner_position: cookieSettings.banner_position || "bottom",
        show_close_button: cookieSettings.show_close_button ?? true,
        consent_expiry_days: cookieSettings.consent_expiry_days || 365,
        accept_button_bg_color: cookieSettings.accept_button_bg_color || '#2563eb',
        accept_button_text_color: cookieSettings.accept_button_text_color || '#ffffff',
        reject_button_bg_color: cookieSettings.reject_button_bg_color || '#ffffff',
        reject_button_text_color: cookieSettings.reject_button_text_color || '#374151',
        save_preferences_button_bg_color: cookieSettings.save_preferences_button_bg_color || '#16a34a',
        save_preferences_button_text_color: cookieSettings.save_preferences_button_text_color || '#ffffff',
        translations: cookieSettings.translations || {},
        categories: cookieSettings.categories || [
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
            default_enabled: cookieSettings.analytics_cookies || false
          },
          {
            id: "marketing",
            name: "Marketing Cookies",
            description: "These cookies are used to deliver personalized advertisements.",
            required: false,
            default_enabled: cookieSettings.marketing_cookies || false
          },
          {
            id: "functional",
            name: "Functional Cookies",
            description: "These cookies enable enhanced functionality and personalization.",
            required: false,
            default_enabled: cookieSettings.functional_cookies || false
          }
        ],
        gdpr_countries: cookieSettings.gdpr_countries || ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
        custom_css: cookieSettings.custom_css || ""
      };
    }

    return { enabled: false };
  } catch (error) {
    console.error('useStoreData: Error loading cookie consent settings:', error);
    return { enabled: false };
  }
}
