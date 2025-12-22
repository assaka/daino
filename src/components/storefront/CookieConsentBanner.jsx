import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, ConsentLog } from '@/api/entities';
import { CustomerAuth } from '@/api/storefront-entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Settings, Shield } from 'lucide-react';
import { useStore } from './StoreProvider';
import { getCurrentLanguage } from '@/utils/translationUtils';
import { createCmsPageUrl } from '@/utils/urlUtils';
import { useTranslation } from '@/contexts/TranslationContext';
import { usePreviewMode } from '@/contexts/PreviewModeContext';
import { getUserDataForRole } from '@/utils/auth';

const getUserCountry = async () => {
  // Check cache first (24-hour localStorage cache)
  const cached = localStorage.getItem('user_country');
  const cacheTimestamp = localStorage.getItem('user_country_timestamp');

  // Use cache if less than 24 hours old
  if (cached && cacheTimestamp && (Date.now() - parseInt(cacheTimestamp) < 86400000)) {
    return cached;
  }

  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    const country = data.country_code || 'US';

    // Cache for 24 hours
    localStorage.setItem('user_country', country);
    localStorage.setItem('user_country_timestamp', Date.now().toString());

    return country;
  } catch (error) {
    console.warn('Could not detect user country:', error);
    return cached || 'US'; // Use cached value if fetch fails
  }
};

const getSessionId = () => {
  let sessionId = localStorage.getItem('cookie_consent_session');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('cookie_consent_session', sessionId);
  }
  return sessionId;
};

export default function CookieConsentBanner() {
  const { store, settings } = useStore();
  const { t } = useTranslation();
  const { isPreviewDraftMode } = usePreviewMode();
  const [showBanner, setShowBanner] = useState(false);

  // Check if store is paused (same logic as PausedStoreOverlay)
  const hasStoreOwnerToken = typeof window !== 'undefined' && !!localStorage.getItem('store_owner_auth_token');
  const storeOwnerData = hasStoreOwnerToken ? (getUserDataForRole('store_owner') || getUserDataForRole('admin')) : null;
  const isStoreOwnerViewingOwnStore = storeOwnerData && storeOwnerData.store_id === store?.id;
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isInPreviewModeFromUrl = urlParams?.get('version') === 'published' || urlParams?.get('mode') === 'workspace';
  const isInPreviewMode = isPreviewDraftMode || isInPreviewModeFromUrl;
  const isStorePaused = store?.published === false && !isStoreOwnerViewingOwnStore && !isInPreviewMode;
  const [showPreferences, setShowPreferences] = useState(false);
  const [userCountry, setUserCountry] = useState('US');
  const [selectedCategories, setSelectedCategories] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    const initializeBanner = async () => {
      if (store?.id && settings?.cookie_consent) {
        // DEFER country detection by 3 seconds to improve LCP (not critical for initial render)
        setTimeout(async () => {
          try {
            // Get the country directly to avoid React state update timing issues
            const detectedCountry = await getUserCountry();
            setUserCountry(detectedCountry);

            await loadUser();

            // Pass the detected country directly instead of relying on state
            checkExistingConsent(detectedCountry);
          } catch (error) {
            console.warn('Error initializing cookie banner:', error);
          }
        }, 3000); // Defer by 3 seconds
      }
    };

    initializeBanner();
  }, [store?.id, settings?.cookie_consent]);

  const loadUser = async () => {
    try {
      // Only attempt to fetch user data if authenticated with a token
      if (CustomerAuth.isAuthenticated()) {
        const userData = await CustomerAuth.me().catch(() => null);
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    }
  };

  const detectUserCountry = async () => {
    const country = await getUserCountry();
    setUserCountry(country);
  };

  const checkExistingConsent = (detectedCountry) => {
    const consent = localStorage.getItem('cookie_consent');
    const consentExpiry = localStorage.getItem('cookie_consent_expiry');

    if (consent && consentExpiry) {
      const expiryDate = new Date(consentExpiry);
      if (expiryDate > new Date()) {
        return;
      }
    }

    // Show banner if should be shown
    // Pass the detected country directly to avoid state timing issues
    const shouldShow = shouldShowBanner(detectedCountry);

    if (shouldShow) {
      setShowBanner(true);

      // Initialize selected categories
      const cookieSettings = settings.cookie_consent;
      if (cookieSettings?.categories) {
        const initialCategories = {};
        cookieSettings.categories.forEach(cat => {
          initialCategories[cat.id] = cat.required || cat.default_enabled;
        });
        setSelectedCategories(initialCategories);
      }
    }
  };

  const isGDPRCountry = (country) => {
    const gdprCountries = settings?.cookie_consent?.gdpr_countries || [
      "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
      "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
      "PL", "PT", "RO", "SK", "SI", "ES", "SE"
    ];
    const countryToCheck = country || userCountry;
    return gdprCountries.includes(countryToCheck);
  };

  const shouldShowBanner = (detectedCountry) => {
    const cookieSettings = settings?.cookie_consent;
    const countryToCheck = detectedCountry || userCountry;

    if (!cookieSettings?.enabled) {
      return false;
    }

    if (cookieSettings.gdpr_mode && cookieSettings.auto_detect_country) {
      const isGDPR = isGDPRCountry(countryToCheck);
      return isGDPR;
    }

    return true;
  };

  const saveConsent = async (consentGiven, categories) => {
    const sessionId = getSessionId();
    const cookieSettings = settings.cookie_consent;
    
    // Store consent in localStorage
    localStorage.setItem('cookie_consent', JSON.stringify(categories));
    localStorage.setItem('cookie_consent_expiry', 
      new Date(Date.now() + ((cookieSettings?.consent_expiry_days || 365) * 24 * 60 * 60 * 1000)).toISOString()
    );
    
    
    // Save consent to backend for audit purposes
    try {
      const consentMethod = categories.length === (cookieSettings?.categories?.length || 0) ? 'accept_all' : 
                           categories.filter(cat => !cookieSettings?.categories?.find(c => c.id === cat && c.required)).length === 0 ? 'reject_all' : 
                           'custom';
      
      await ConsentLog.create({
        store_id: store?.id,
        session_id: sessionId,
        user_id: user?.id || null,
        consent_given: consentGiven,
        categories_accepted: categories,
        country_code: userCountry,
        consent_method: consentMethod,
        page_url: window.location.href
      });
      
    } catch (error) {
      console.warn('Failed to save consent to backend (non-critical):', error);
    }
    
    setShowBanner(false);
    setShowPreferences(false);
  };

  const handleAcceptAll = () => {
    const cookieSettings = settings.cookie_consent;
    const allCategories = cookieSettings?.categories?.map(cat => cat.id) || [];
    saveConsent(true, allCategories);
  };

  const handleRejectAll = () => {
    const cookieSettings = settings.cookie_consent;
    const essentialOnly = cookieSettings?.categories?.filter(cat => cat.required).map(cat => cat.id) || [];
    saveConsent(false, essentialOnly);
  };

  const handleSavePreferences = () => {
    const acceptedCategories = Object.keys(selectedCategories).filter(key => selectedCategories[key]);
    saveConsent(true, acceptedCategories);
  };

  const handleCategoryChange = (categoryId, checked) => {
    setSelectedCategories(prev => ({
      ...prev,
      [categoryId]: checked
    }));
  };

  // Hide banner when store is paused (pause modal is shown) or when not enabled
  if (!showBanner || !settings?.cookie_consent?.enabled || isStorePaused) {
    return null;
  }

  const cookieSettings = settings.cookie_consent;
  const currentLang = getCurrentLanguage();

  // Helper function to get translated text from translations JSON (no fallback)
  const getTranslatedText = (field, defaultValue = '') => {
    const translations = cookieSettings?.translations;

    if (translations && translations[currentLang] && translations[currentLang][field]) {
      return translations[currentLang][field];
    }
    // Fallback to English if current language not available
    if (translations && translations.en && translations.en[field]) {
      return translations.en[field];
    }
    return defaultValue;
  };

  return (
    <>
      {cookieSettings.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: cookieSettings.custom_css }} />
      )}

      <div className={`cookie-banner fixed inset-x-0 z-50 ${
        cookieSettings.banner_position === 'top' ? 'top-0' :
        cookieSettings.banner_position === 'center' ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2' :
        'bottom-0'
      }`}>
        <Card className={`mx-4 mb-4 shadow-lg ${cookieSettings.banner_position === 'center' ? 'max-w-lg' : 'max-w-4xl mx-auto'}`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold">
                  {showPreferences ? t('cookie_consent.title.manage_preferences') : t('cookie_consent.title.preferences')}
                </h3>
              </div>
              {cookieSettings.show_close_button && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBanner(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <p className="text-sm text-gray-600 mb-4">
              {getTranslatedText('banner_text', 'We use cookies to enhance your browsing experience.')}
            </p>

            {showPreferences && cookieSettings.categories && (
              <div className="mb-4 space-y-3">
                {cookieSettings.categories.map(category => {
                  // Get translated category name and description
                  const categoryName = getTranslatedText(`${category.id}_name`, category.name);
                  const categoryDescription = getTranslatedText(`${category.id}_description`, category.description);

                  return (
                    <div key={category.id} className="flex items-start justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Label className="font-medium">{categoryName}</Label>
                          {category.required && (
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">{t('common.required')}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{categoryDescription}</p>
                      </div>
                      <Switch
                        checked={selectedCategories[category.id] || false}
                        onCheckedChange={(checked) => handleCategoryChange(category.id, checked)}
                        disabled={category.required}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleAcceptAll}
                style={{
                  backgroundColor: cookieSettings.accept_button_bg_color || '#2563eb',
                  color: cookieSettings.accept_button_text_color || '#ffffff'
                }}
                className="hover:opacity-90"
              >
                {getTranslatedText('accept_button_text', 'Accept All')}
              </Button>

              <Button
                onClick={handleRejectAll}
                style={{
                  backgroundColor: cookieSettings.reject_button_bg_color || '#ffffff',
                  color: cookieSettings.reject_button_text_color || '#374151',
                  border: '1px solid #d1d5db'
                }}
                className="hover:opacity-90"
              >
                {getTranslatedText('reject_button_text', 'Reject All')}
              </Button>

              {!showPreferences ? (
                <Button
                  onClick={() => setShowPreferences(true)}
                  variant="outline"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  {getTranslatedText('settings_button_text', 'Manage Preferences')}
                </Button>
              ) : (
                <Button
                  onClick={handleSavePreferences}
                  style={{
                    backgroundColor: cookieSettings.save_preferences_button_bg_color || '#16a34a',
                    color: cookieSettings.save_preferences_button_text_color || '#ffffff'
                  }}
                  className="hover:opacity-90"
                >
                  {getTranslatedText('save_preferences_button_text', 'Save Preferences')}
                </Button>
              )}

              {(() => {
                const privacyUrl = cookieSettings.privacy_policy_url ||
                  (store?.website_url
                    ? `${store.website_url.replace(/\/$/, '')}${createCmsPageUrl(store?.slug, 'privacy-policy')}`
                    : createCmsPageUrl(store?.slug, 'privacy-policy'));
                const isExternal = privacyUrl.startsWith('http');

                return isExternal ? (
                  <a
                    href={privacyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline self-center"
                  >
                    {getTranslatedText('privacy_policy_text', 'Privacy Policy')}
                  </a>
                ) : (
                  <Link
                    to={privacyUrl}
                    className="text-sm text-blue-600 hover:text-blue-800 underline self-center"
                  >
                    {getTranslatedText('privacy_policy_text', 'Privacy Policy')}
                  </Link>
                );
              })()}

              {showPreferences && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreferences(false)}
                  className="ml-auto"
                >
                  {t('common.back')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}