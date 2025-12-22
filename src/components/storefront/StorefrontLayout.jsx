
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { createPublicUrl, createCategoryUrl } from '@/utils/urlUtils';
import { handleLogout, getUserDataForRole } from '@/utils/auth';
import { CustomerAuth } from '@/api/storefront-entities';
import { ShoppingBag, User as UserIcon, Menu, Search, ChevronDown, Settings, LogOut, X } from "lucide-react";
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import MiniCart from './MiniCart';
import WishlistDropdown from './WishlistDropdown';
import CategoryNav from './CategoryNav';
import HeaderSearch from './HeaderSearch';
import CmsBlockRenderer from './CmsBlockRenderer';
import { useStore } from '@/components/storefront/StoreProvider';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';
import RedirectHandler from '@/components/shared/RedirectHandler';
import { SeoSettingsProvider } from '@/components/storefront/SeoSettingsProvider';
import { CountrySelect } from "@/components/ui/country-select";
import SeoHeadManager from './SeoHeadManager';
import DataLayerManager from '@/components/storefront/DataLayerManager';
import CookieConsentBanner from '@/components/storefront/CookieConsentBanner';
import RoleSwitcher from '@/components/admin/RoleSwitcher';
import StorefrontPreviewBanner from '@/components/storefront/StorefrontPreviewBanner';
import { lazy, Suspense } from 'react';

// Lazy load heatmap tracker to defer it (improves LCP)
const HeatmapTrackerComponent = lazy(() => import('@/components/admin/heatmap/HeatmapTracker'));
import FlashMessage from '@/components/storefront/FlashMessage';
import { HeaderSlotRenderer } from './HeaderSlotRenderer';
import { useHeaderConfig } from '@/hooks/useHeaderConfig';
import LanguageSelector from '@/components/shared/LanguageSelector';
import { useTranslation } from '@/contexts/TranslationContext';
import { PreviewModeProvider, usePreviewMode } from '@/contexts/PreviewModeContext';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Separate component for the paused overlay that can use the preview mode context
function PausedStoreOverlay({ store, isStoreOwnerViewingOwnStore }) {
    const { isPreviewDraftMode, isPublishedPreview, isWorkspaceMode } = usePreviewMode();

    // Also check URL params as fallback (for initial load before context initializes)
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const isInPreviewModeFromUrl = urlParams?.get('version') === 'published' || urlParams?.get('mode') === 'workspace';

    const isInPreviewMode = isPreviewDraftMode || isInPreviewModeFromUrl;
    const isStorePaused = store?.published === false && !isStoreOwnerViewingOwnStore && !isInPreviewMode;

    if (!isStorePaused) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4 text-center">
                <div className="mb-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                        <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {store?.name || 'DAINO'} Shop is currently paused
                </h2>
                <p className="text-gray-600 mb-4">
                    This store is temporarily unavailable. Please check back later.
                </p>
                <p className="text-sm text-gray-500 mb-4">
                    If you're the store owner, you can publish your store in the DainoStore dashboard.
                </p>
                <div className="pt-4 border-t border-gray-200">
                    <a
                        href="https://www.dainostore.com"
                        className="text-sm text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Powered by <span className="font-semibold ml-1">DainoStore</span>
                    </a>
                </div>
            </div>
        </div>
    );
}

const retryApiCall = async (apiCall, maxRetries = 2, baseDelay = 1000, defaultValueOnError = []) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      const isRateLimit = error.response?.status === 429 ||
                         error.message?.includes('Rate limit') ||
                         error.message?.includes('429');

      if (isRateLimit && i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i);
        console.warn(`StorefrontLayout: Rate limit hit, retrying...`);
        await delay(delayTime);
        continue;
      }
      if (isRateLimit) {
          return defaultValueOnError;
      }
      throw error;
    }
  }
};

export default function StorefrontLayout({ children }) {
    const { store, settings, loading, selectedCountry, setSelectedCountry, categories } = useStore();
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [languages, setLanguages] = useState([]);
    const [currentLanguage, setCurrentLanguage] = useState('en');
    const [user, setUser] = useState(null);
    const [userLoading, setUserLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [gtmScript, setGtmScript] = useState(null);
    const [expandedMobileCategories, setExpandedMobileCategories] = useState(new Set());

    // Flash message state
    const [flashMessage, setFlashMessage] = useState(null);

    // Load header slot configuration
    const { headerSlots, headerConfigLoaded } = useHeaderConfig(store);

    // Toggle function for mobile category expansion
    const toggleMobileCategory = (categoryId) => {
        setExpandedMobileCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };

    // Custom logout handler for storefront - ONLY clears customer tokens
    // This ensures store owner sessions are not affected when logging out from storefront
    const handleCustomerLogout = async () => {
        try {
            // IMPORTANT: Only call CustomerAuth.logout() which only clears customer tokens
            // This will NOT clear store_owner_auth_token or store_owner_user_data
            await CustomerAuth.logout();

            // Redirect to login page after logout
            const loginUrl = createPublicUrl(store?.slug || 'default', 'CUSTOMER_AUTH');
            window.location.href = loginUrl;
        } catch (error) {
            console.error('Customer logout error:', error);
            // Even on error, redirect to login to ensure clean state
            const loginUrl = createPublicUrl(store?.slug || 'default', 'CUSTOMER_AUTH');
            window.location.href = loginUrl;
        }
    };

    // Apply store theme settings to CSS variables and load fonts
    useEffect(() => {
      if (store?.settings?.theme) {
        const theme = store.settings.theme;
        const root = document.documentElement;

        if (theme.primary_button_color) {
          root.style.setProperty('--theme-primary-button', theme.primary_button_color);
        }
        if (theme.secondary_button_color) {
          root.style.setProperty('--theme-secondary-button', theme.secondary_button_color);
        }
        if (theme.add_to_cart_button_color) {
          root.style.setProperty('--theme-add-to-cart-button', theme.add_to_cart_button_color);
        }
        if (theme.font_family) {
          root.style.setProperty('--theme-font-family', `'${theme.font_family}', sans-serif`);
        }

        // Load custom fonts into <head>
        const customFonts = theme.custom_fonts || [];
        const selectedFont = theme.font_family || 'Inter';
        const isCustomFont = customFonts.some(f => f.name === selectedFont);

        // Remove old font links
        document.querySelectorAll('link[data-custom-font]').forEach(el => el.remove());
        document.querySelectorAll('style[data-custom-font-face]').forEach(el => el.remove());

        // Add Google Font for built-in fonts
        if (!isCustomFont && selectedFont) {
          const googleLink = document.createElement('link');
          googleLink.rel = 'stylesheet';
          googleLink.href = `https://fonts.googleapis.com/css2?family=${selectedFont.replace(/ /g, '+')}:wght@100..900&display=swap`;
          googleLink.setAttribute('data-custom-font', 'google-builtin');
          document.head.appendChild(googleLink);
        }

        // Add custom fonts
        customFonts.forEach((font, idx) => {
          if (font.isGoogleFont) {
            // Google Fonts URL - add as link
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = font.url;
            link.setAttribute('data-custom-font', `custom-${idx}`);
            document.head.appendChild(link);
          } else {
            // Direct font file - add @font-face style
            const formatMap = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' };
            const style = document.createElement('style');
            style.setAttribute('data-custom-font-face', `custom-${idx}`);
            style.textContent = `
              @font-face {
                font-family: '${font.name}';
                src: url('${font.url}') format('${formatMap[font.format] || 'truetype'}');
                font-weight: 100 900;
                font-style: normal;
                font-display: swap;
              }
            `;
            document.head.appendChild(style);
          }
        });
      }
    }, [store?.settings?.theme]);

    useEffect(() => {
        const fetchData = async () => {
            if (loading || !store) return;

            try {
                // Load languages from store settings
                const activeLanguages = settings?.active_languages || ['en'];
                const defaultLanguage = settings?.default_language || 'en';

                // Build languages array with proper format for selector
                const languagesData = activeLanguages.map(code => {
                    const languageNames = {
                        'en': { name: 'English', flag_icon: '🇬🇧' },
                        'nl': { name: 'Nederlands', flag_icon: '🇳🇱' },
                        'de': { name: 'Deutsch', flag_icon: '🇩🇪' },
                        'fr': { name: 'Français', flag_icon: '🇫🇷' },
                        'es': { name: 'Español', flag_icon: '🇪🇸' }
                    };
                    return {
                        id: code,
                        code: code,
                        name: languageNames[code]?.name || code.toUpperCase(),
                        flag_icon: languageNames[code]?.flag_icon || '🌐'
                    };
                });

                setLanguages(languagesData);

                // Initialize current language from localStorage or default
                const savedLang = localStorage.getItem('daino_language');
                if (savedLang && activeLanguages.includes(savedLang)) {
                    setCurrentLanguage(savedLang);
                } else {
                    setCurrentLanguage(defaultLanguage);
                    localStorage.setItem('daino_language', defaultLanguage);
                }

                try {
                    // Only attempt to fetch user data if authenticated with a token
                    if (CustomerAuth.isAuthenticated()) {
                        const userData = await retryApiCall(async () => {
                            return await CustomerAuth.me();
                        }, 2, 1000, null);

                        // Only show user as logged in if they are a customer in storefront context
                        if (userData && userData.role === 'customer') {
                            setUser(userData);
                        } else {
                            // Store owners/admins should not appear as logged in on storefront
                            setUser(null);
                        }
                    } else {
                        // No token, user is a guest
                        setUser(null);
                    }
                } catch (e) {
                    setUser(null);
                } finally {
                    setUserLoading(false);
                }

            } catch (error) {
                setUser(null);
                setUserLoading(false);
            }
        };
        fetchData();
    }, [loading, store, settings]);

    // Handle language changes and reload page to fetch new translations
    useEffect(() => {
        const handleLanguageChange = (newLanguage) => {
            localStorage.setItem('daino_language', newLanguage);
            setCurrentLanguage(newLanguage);
            // Reload page to fetch new translations
            window.location.reload();
        };

        // Wrap the handler for HeaderSlotRenderer
        const wrappedSetCurrentLanguage = (newLang) => {
            if (newLang !== currentLanguage) {
                handleLanguageChange(newLang);
            }
        };

        // Replace setCurrentLanguage with the wrapped version
        window._setCurrentLanguage = wrappedSetCurrentLanguage;

        return () => {
            delete window._setCurrentLanguage;
        };
    }, [currentLanguage]);

    // Flash message event listener
    useEffect(() => {
      const handleShowFlashMessage = (event) => {
        const { type, message } = event.detail;
        setFlashMessage({ type, message });

        // Auto-hide flash message after 5 seconds
        setTimeout(() => {
          setFlashMessage(null);
        }, 5000);
      };

      window.addEventListener('showFlashMessage', handleShowFlashMessage);
      return () => window.removeEventListener('showFlashMessage', handleShowFlashMessage);
    }, []);

    if (loading) {
        return <PageLoader size="lg" className="h-screen" />;
    }

    if (!store) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
                    <p className="text-gray-600">The store you're looking for doesn't exist.</p>
                </div>
            </div>
        );
    }

    const path = location.pathname.toLowerCase();
    // FIXED: Apply store settings properly  
    const hideHeaderOnCart = settings?.hide_header_cart && path.includes('/cart');
    const hideHeaderOnCheckout = settings?.hide_header_checkout && path.includes('/checkout');
    const hideHeader = hideHeaderOnCart || hideHeaderOnCheckout;

    const getCurrentPage = () => {
        if (path.includes('/cart')) return 'storefront_cart';
        if (path.includes('/checkout')) return 'storefront_checkout';
        if (path.includes('/productdetail')) return 'storefront_product';
        if (path.includes('/storefront') && location.search.includes('category=')) return 'storefront_category';
        if (path.includes('/storefront')) return 'storefront_home';
        return 'all_pages';
    };

    // FIXED: Apply show permanent search setting
    const showPermanentSearch = settings?.show_permanent_search !== false;

    // Font family for CSS (fonts are loaded in useEffect into <head>)
    const selectedFontFamily = settings?.theme?.font_family || 'Inter';

    // FIXED: Apply theme colors to cart buttons
    const defaults = getThemeDefaults();
    const themeStyles = `
      :root {
        --theme-primary-button: ${settings?.theme?.primary_button_color || defaults.primary_button_color};
        --theme-secondary-button: ${settings?.theme?.secondary_button_color || defaults.secondary_button_color};
        --theme-add-to-cart-button: ${settings?.theme?.add_to_cart_button_color || defaults.add_to_cart_button_color};
        --theme-view-cart-button: ${settings?.theme?.view_cart_button_color || defaults.view_cart_button_color};
        --theme-checkout-button: ${settings?.theme?.checkout_button_color || defaults.checkout_button_color};
        --theme-place-order-button: ${settings?.theme?.place_order_button_color || defaults.place_order_button_color};
        --theme-font-family: '${selectedFontFamily}', sans-serif;
        --theme-nav-hover-color: ${settings?.theme?.primary_button_color || defaults.primary_button_color};
      }
      body {
          font-family: var(--theme-font-family);
      }
      /* Apply theme colors to buttons */
      .btn-primary, .bg-blue-600 {
          background-color: var(--theme-primary-button);
      }
      .btn-secondary, .bg-gray-600 {
          background-color: var(--theme-secondary-button);
      }
      .btn-add-to-cart, .bg-green-600 {
          background-color: var(--theme-add-to-cart-button);
      }
      .btn-view-cart {
          background-color: var(--theme-view-cart-button);
      }
      .btn-checkout {
          background-color: var(--theme-checkout-button);
      }
      .btn-place-order {
          background-color: var(--theme-place-order-button);
      }
      /* Hover effects for themed buttons - use brightness filter only */
      .btn-primary:hover, .btn-secondary:hover, .btn-add-to-cart:hover,
      .btn-view-cart:hover, .btn-checkout:hover, .btn-place-order:hover,
      .btn-themed:hover {
          filter: brightness(1.15) !important;
          transition: filter 0.2s ease;
      }
      /* Prevent Tailwind default hover from changing background color */
      .btn-primary, .btn-secondary, .btn-add-to-cart,
      .btn-view-cart, .btn-checkout, .btn-place-order, .btn-themed {
          transition: filter 0.2s ease;
      }
      .btn-primary:hover, .btn-secondary:hover, .btn-add-to-cart:hover,
      .btn-view-cart:hover, .btn-checkout:hover, .btn-place-order:hover,
      .btn-themed:hover {
          --tw-bg-opacity: 1 !important;
      }
      /* Override blue hover colors with theme color */
      .nav-link-themed:hover, .hover\\:text-blue-600:hover {
          color: var(--theme-nav-hover-color) !important;
      }
    `;

    // Check if store owner is viewing their own store (must have valid token AND user data)
    const hasStoreOwnerToken = !!localStorage.getItem('store_owner_auth_token');
    const storeOwnerData = hasStoreOwnerToken ? (getUserDataForRole('store_owner') || getUserDataForRole('admin')) : null;
    const isStoreOwnerViewingOwnStore = storeOwnerData && storeOwnerData.store_id === store?.id;

    return (
        <PreviewModeProvider>
        <SeoSettingsProvider>
            <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800 relative">
                <StorefrontPreviewBanner />
                <RoleSwitcher />
                <DataLayerManager />

                {/* Paused Store Overlay - uses PreviewModeContext to persist preview mode across navigation */}
                <PausedStoreOverlay store={store} isStoreOwnerViewingOwnStore={isStoreOwnerViewingOwnStore} />
                
                {/* Heatmap Tracker - Lazy loaded to not block LCP */}
                <Suspense fallback={null}>
                    <HeatmapTrackerComponent
                        storeId={store?.id}
                        config={{
                            trackClicks: true,
                            trackHovers: true,
                            trackScrolls: true,
                            trackTouches: true,
                            trackFocus: true,
                            batchSize: 10,
                            batchTimeout: 3000,
                            excludeSelectors: ['.heatmap-exclude', '[data-heatmap-exclude]', '.role-switcher']
                        }}
                    />
                </Suspense>
            {/* Fonts are loaded in useEffect to ensure they're in <head> */}
            {settings?.theme?.font_script && (
              <div dangerouslySetInnerHTML={{ __html: settings.theme.font_script }} />
            )}
            {gtmScript && (
                <div dangerouslySetInnerHTML={{ __html: gtmScript }} />
            )}
            <style>{themeStyles}</style>
            
            <SeoHeadManager
                pageType="storefront"
                pageTitle={store?.name || 'Daino Store'}
                pageDescription={store?.description || 'Welcome to our store.'}
            />

            {!hideHeader && headerConfigLoaded && headerSlots ? (
                <>
                    {/* New slot-based header */}
                    <HeaderSlotRenderer
                        slots={headerSlots}
                        parentId={null}
                        viewMode="default"
                        headerContext={{
                            store,
                            settings,
                            user,
                            userLoading,
                            categories,
                            languages,
                            currentLanguage,
                            selectedCountry,
                            mobileMenuOpen,
                            mobileSearchOpen,
                            expandedMobileCategories,
                            setCurrentLanguage,
                            setSelectedCountry,
                            setMobileMenuOpen,
                            setMobileSearchOpen,
                            setExpandedMobileCategories,
                            handleCustomerLogout,
                            navigate,
                            location
                        }}
                    />
                </>
            ) : !hideHeader && (
                <>
                    {/* Fallback to old hardcoded header */}
                    <header className="bg-white shadow-md sticky top-0 z-40">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex items-center justify-between h-16">
                                <div className="flex items-center">
                                    <Link to={createPublicUrl(store.slug, 'STOREFRONT')} className="flex items-center space-x-2">
                                        {store?.logo_url ? (
                                            <img src={store.logo_url} alt={store.name || 'Store Logo'} className="h-8 w-8 object-contain" />
                                        ) : (
                                            <img src="/logo_red.svg" alt="DainoStore" className="h-12" />
                                        )}
                                        <span className="text-xl font-bold text-gray-800">{store?.name || 'DainoStore'}</span>
                                    </Link>
                                </div>

                                {/* FIXED: Apply hide search setting */}
                                {!settings?.hide_header_search && (
                                    <div className="hidden md:flex flex-1 justify-center px-8">
                                        <div className="w-full ">
                                            <HeaderSearch />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-1 md:hidden">
                                        {!showPermanentSearch && !settings?.hide_header_search && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                                            >
                                                <Search className="w-5 h-5" />
                                            </Button>
                                        )}
                                        {user ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={userLoading}
                                                    >
                                                        <UserIcon className="w-5 h-5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="w-48">
                                                    <DropdownMenuLabel>
                                                        {user.first_name || user.name || user.email}
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    {user.role === 'customer' ? (
                                                        <>
                                                            <DropdownMenuItem onClick={() => {
                                                                navigate(createPublicUrl(store.slug, 'CUSTOMER_ACCOUNT'));
                                                            }}>
                                                                <Settings className="mr-2 h-4 w-4" />
                                                                <span>My Account</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => {
                                                                handleCustomerLogout();
                                                            }}>
                                                                <LogOut className="mr-2 h-4 w-4" />
                                                                <span>Logout</span>
                                                            </DropdownMenuItem>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <DropdownMenuItem onClick={() => {
                                                                window.location.href = createPageUrl('Dashboard');
                                                            }}>
                                                                <Settings className="mr-2 h-4 w-4" />
                                                                <span>Admin Dashboard</span>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => {
                                                                handleLogout();
                                                            }}>
                                                                <LogOut className="mr-2 h-4 w-4" />
                                                                <span>Logout</span>
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => {
                                                    // Save store info for redirect after login
                                                    localStorage.setItem('customer_auth_store_id', store.id);
                                                    localStorage.setItem('customer_auth_store_code', store.slug);
                                                    navigate(createPublicUrl(store.slug, 'CUSTOMER_AUTH'));
                                                }}
                                                disabled={userLoading}
                                            >
                                                <UserIcon className="w-5 h-5" />
                                            </Button>
                                        )}
                                        <WishlistDropdown />
                                     </div>

                                     <div className="hidden md:flex items-center space-x-3">
                                        {/* New Translation System Language Selector */}
                                        <LanguageSelector variant="storefront" />

                                        {settings.allowed_countries && Array.isArray(settings.allowed_countries) && settings.allowed_countries.length > 1 && (
                                            <CountrySelect
                                                value={selectedCountry}
                                                onValueChange={setSelectedCountry}
                                                allowedCountries={settings.allowed_countries}
                                            />
                                        )}
                                        {user ? (
                                            <div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="themed"
                                                            className="text-white px-4 py-2 rounded-lg flex items-center space-x-1"
                                                            style={{ backgroundColor: settings?.theme?.primary_button_color || defaults.primary_button_color }}
                                                        >
                                                            <UserIcon className="w-4 h-4" />
                                                            <span>{user.first_name || user.name || user.email}</span>
                                                            <ChevronDown className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="w-56">
                                                        <DropdownMenuLabel>
                                                            {user.first_name || user.name || user.email}
                                                        </DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        {user.role === 'customer' ? (
                                                            <>
                                                                <DropdownMenuItem onClick={() => {
                                                                    navigate(createPublicUrl(store.slug, 'ACCOUNT'));
                                                                }}>
                                                                    <Settings className="mr-2 h-4 w-4" />
                                                                    <span>My Account</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => {
                                                                    handleCustomerLogout();
                                                                }}>
                                                                    <LogOut className="mr-2 h-4 w-4" />
                                                                    <span>Logout</span>
                                                                </DropdownMenuItem>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <DropdownMenuItem onClick={() => {
                                                                    window.location.href = '/admin/dashboard';
                                                                }}>
                                                                    <Settings className="mr-2 h-4 w-4" />
                                                                    <span>Admin Dashboard</span>
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => {
                                                                    handleLogout();
                                                                }}>
                                                                    <LogOut className="mr-2 h-4 w-4" />
                                                                    <span>Logout</span>
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        ) : (
                                            <Button
                                                onClick={() => {
                                                    // Save store info for redirect after login
                                                    localStorage.setItem('customer_auth_store_id', store.id);
                                                    localStorage.setItem('customer_auth_store_code', store.slug);
                                                    navigate(createPublicUrl(store.slug, 'CUSTOMER_AUTH'));
                                                }}
                                                disabled={userLoading}
                                                variant="themed"
                                                className="text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                                                style={{ backgroundColor: settings?.theme?.primary_button_color || defaults.primary_button_color }}
                                            >
                                                <UserIcon className="w-5 h-5 mr-2" />
                                                <span>{t('common.sign_in', 'Sign In')}</span>
                                            </Button>
                                        )}
                                        <WishlistDropdown />
                                     </div>

                                     {/* Single responsive MiniCart for both mobile and desktop */}
                                     <MiniCart />

                                     <Button
                                        variant="ghost"
                                        size="icon"
                                        className="md:hidden"
                                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                    >
                                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* FIXED: Apply permanent search and hide search settings */}
                        {!settings?.hide_header_search && (mobileSearchOpen || showPermanentSearch) && (
                            <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3">
                                <HeaderSearch />
                            </div>
                        )}

                        {/* Old mobile menu removed - now using slot-based HeaderSlotRenderer mobile menu */}
                    </header>

                    <nav className={`${store?.settings?.expandAllMenuItems ? 'block' : 'hidden md:block'} bg-gray-50 border-b border-gray-200`}>
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex justify-center py-3">
                                <CategoryNav categories={categories} />
                            </div>
                        </div>
                    </nav>
                </>
            )}

            <CmsBlockRenderer position="header" page={getCurrentPage()} />

            <div className="flex-1">
                {/* Main Content - Full Width */}
                <main className="w-full px-2 sm:px-4 lg:px-8 pb-8">
                    <CmsBlockRenderer position="before_content" page={getCurrentPage()} />

                    {/* Global Flash Message */}
                    {flashMessage && (
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                            <FlashMessage
                                message={flashMessage}
                                onClose={() => setFlashMessage(null)}
                            />
                        </div>
                    )}

                    <RedirectHandler storeId={store?.id}>
                        {children}
                    </RedirectHandler>
                    <CmsBlockRenderer position="after_content" page={getCurrentPage()} />
                </main>
            </div>

            <CmsBlockRenderer position="footer" page={getCurrentPage()} />

            <footer className="bg-gray-800 text-white">
                <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <div>
                            <h3 className="text-sm font-semibold tracking-wider uppercase">Shop</h3>
                            <ul className="mt-4 space-y-2">
                                {Array.isArray(categories) && store && (() => {
                                    let footerCategories = categories.filter(c => !c.hide_in_menu);
                                    
                                    // If store has a root category, filter to only show that category tree
                                    const rootCategoryId = store?.settings?.rootCategoryId;
                                    const excludeRootFromMenu = store?.settings?.excludeRootFromMenu === true || store?.settings?.excludeRootFromMenu === 'true';

                                    if (rootCategoryId && rootCategoryId !== 'none') {
                                        const rootCategoryIdStr = String(rootCategoryId);

                                        const filterCategoryTree = (categoryId, allCategories) => {
                                            const categoryIdStr = String(categoryId);
                                            const children = allCategories.filter(c => String(c.parent_id) === categoryIdStr);
                                            let result = children.slice();
                                            children.forEach(child => {
                                                result = result.concat(filterCategoryTree(child.id, allCategories));
                                            });
                                            return result;
                                        };

                                        const rootCategory = footerCategories.find(c => String(c.id) === rootCategoryIdStr);
                                        if (rootCategory) {
                                            const descendants = filterCategoryTree(rootCategoryId, footerCategories);

                                            // Check if we should exclude root category from menu
                                            if (excludeRootFromMenu) {
                                                footerCategories = descendants; // Only show descendants, not the root
                                            } else {
                                                footerCategories = [rootCategory, ...descendants]; // Include root and descendants
                                            }
                                        } else {
                                            footerCategories = [];
                                        }
                                    }

                                    // Only show root categories in footer (first level of visible categories)
                                    return footerCategories
                                        .filter(c => {
                                            if (rootCategoryId && rootCategoryId !== 'none') {
                                                const rootCategoryIdStr = String(rootCategoryId);
                                                // If excluding root from menu, show direct children of root category
                                                if (excludeRootFromMenu) {
                                                    return String(c.parent_id) === rootCategoryIdStr;
                                                } else {
                                                    // Show the root category itself or direct children of root category
                                                    return String(c.parent_id) === rootCategoryIdStr || String(c.id) === rootCategoryIdStr;
                                                }
                                            } else {
                                                // Show all root categories when no root category is set
                                                return !c.parent_id;
                                            }
                                        })
                                        .slice(0, 4)
                                        .map(c => (
                                            <li key={c.id}>
                                                <Link to={createCategoryUrl(store.slug, c.slug)} className="text-base text-gray-300 hover:text-white">{c.name}</Link>
                                            </li>
                                        ));
                                })()}
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold tracking-wider uppercase">About</h3>
                            <ul className="mt-4 space-y-2">
                                <li><Link to="#" className="text-base text-gray-300 hover:text-white">Our Story</Link></li>
                                <li><Link to="#" className="text-base text-gray-300 hover:text-white">Careers</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold tracking-wider uppercase">Support</h3>
                            <ul className="mt-4 space-y-2">
                                <li><Link to="#" className="text-base text-gray-300 hover:text-white">Contact Us</Link></li>
                                <li><Link to="#" className="text-base text-gray-300 hover:text-white">Shipping & Returns</Link></li>
                                <li><Link to={createPublicUrl(store.slug, 'SITEMAP')} className="text-base text-gray-300 hover:text-white">Sitemap</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold tracking-wider uppercase">Connect</h3>
                        </div>
                    </div>
                    <div className="mt-8 border-t border-gray-700 pt-8 text-center">
                        <p className="text-base text-gray-400">&copy; {new Date().getFullYear()} {store?.name || 'DainoStore'}. All rights reserved.</p>
                    </div>
                </div>
            </footer>
            
            {settings?.cookie_consent?.enabled && (
                <CookieConsentBanner />
            )}
            </div>
        </SeoSettingsProvider>
        </PreviewModeProvider>
    );
}
