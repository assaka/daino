/**
 * Comprehensive URL utility system for SEO-friendly URLs with layered navigation
 * Supports /public and /admin URL prefixes, UTM tracking, and filter parameters
 */

// Import centralized domain configuration
import { isCustomDomain as isCustomDomainCheck } from './domainConfig';

/**
 * Check if current hostname is a custom domain (not platform domains)
 * @see domainConfig.js for the single source of truth
 */
export function isCustomDomain() {
  return isCustomDomainCheck();
}

// URL Architecture Configuration
export const URL_CONFIG = {
  // Base prefixes
  PUBLIC_PREFIX: '/public',
  ADMIN_PREFIX: '/admin',
  
  // SEO-friendly slugs
  PAGES: {
    // Public storefront pages
    STOREFRONT: '',  // Root store page
    SHOP: 'shop',
    PRODUCT_DETAIL: 'product',
    PRODUCT_SHORT: 'p',  // Short product URL
    CATEGORY: 'category',
    CATEGORY_SHORT: 'c',  // Short category URL
    BRAND: 'brand',
    COLLECTION: 'collection',
    SEARCH: 'search',
    CART: 'cart',
    CHECKOUT: 'checkout',
    ORDER_SUCCESS: 'order-success',
    THANK_YOU: 'thank-you',
    CUSTOMER_AUTH: 'login',
    CUSTOMER_REGISTER: 'register',
    CUSTOMER_FORGOT_PASSWORD: 'forgot-password',
    CUSTOMER_DASHBOARD: 'dashboard',
    ACCOUNT: 'account',
    MY_ACCOUNT: 'my-account',
    CUSTOMER_ORDERS: 'orders',
    MY_ORDERS: 'my-orders',
    CUSTOMER_PROFILE: 'profile',
    CMS_PAGE: 'cms-page',
    SITEMAP: 'sitemap',
    XML_SITEMAP: 'sitemap.xml',
    ROBOTS_TXT: 'robots.txt',
    ORDER_CANCEL: 'order-cancel',
    COOKIE_CONSENT: 'cookie-consent',
    
    // Admin pages  
    ADMIN_AUTH: 'auth',
    DASHBOARD: 'dashboard',
    PRODUCTS: 'products',
    CATEGORIES: 'categories',
    ORDERS: 'orders',
    CUSTOMERS: 'customers',
    SETTINGS: 'settings',
    ANALYTICS: 'analytics',
    ATTRIBUTES: 'attributes',
    PLUGINS: 'plugins',
    CMS_BLOCKS: 'cms-blocks',
    TAX: 'tax',
    COUPONS: 'coupons',
    CMS_PAGES: 'cms-pages',
    PRODUCT_TABS: 'product-tabs',
    PRODUCT_LABELS: 'product-labels',
    CUSTOM_OPTION_RULES: 'custom-option-rules',
    SHIPPING_METHODS: 'shipping-methods',
    DELIVERY_SETTINGS: 'delivery-settings',
    THEME_LAYOUT: 'theme-layout',
    IMAGE_MANAGER: 'image-manager',
    STOCK_SETTINGS: 'stock-settings',
    PAYMENT_METHODS: 'payment-methods',
    SEO_TOOLS: 'seo-tools',
    STORES: 'stores',
    CUSTOMER_ACTIVITY: 'customer-activity',
    HEATMAPS: 'heatmaps',
    ABTESTING: 'ab-testing',
    ONBOARDING: 'onboarding',
    VERIFY_EMAIL: 'verify-email'
  },
  
  // Filter parameter mapping for SEO URLs
  FILTER_PARAMS: {
    'category': 'c',
    'price': 'p',
    'brand': 'b',
    'color': 'color',
    'size': 'size',
    'rating': 'r',
    'availability': 'stock',
    'sort': 'sort',
    'page': 'page'
  }
};

/**
 * Create admin URL with proper prefix
 */
export function createAdminUrl(pageName, params = {}) {
  // Handle query parameters in pageName (e.g., "SEO_TOOLS?tab=settings")
  let actualPageName = pageName;
  let queryString = '';
  
  if (pageName.includes('?')) {
    [actualPageName, queryString] = pageName.split('?', 2);
  }
  
  // Handle path-based URLs (e.g., "seo-tools/settings")
  if (pageName.includes('/')) {
    // For path-based URLs, use the path as-is
    let baseUrl = `${URL_CONFIG.ADMIN_PREFIX}/${pageName}`;
    return addUrlParams(baseUrl, params);
  }
  
  const slug = URL_CONFIG.PAGES[actualPageName.toUpperCase()] || actualPageName.toLowerCase();
  
  // All admin URLs now use the /admin prefix consistently
  let baseUrl = `${URL_CONFIG.ADMIN_PREFIX}/${slug}`;
  
  // Add query string if it exists
  if (queryString) {
    baseUrl += `?${queryString}`;
  }
  
  return addUrlParams(baseUrl, params);
}

/**
 * Create public storefront URL with store context
 * On custom domains, omits /public/:storeSlug prefix
 */
export function createPublicUrl(storeSlug, pageName, params = {}) {
  const pageKey = pageName.toUpperCase();

  // Check if the page exists in config (including empty string values)
  if (!(pageKey in URL_CONFIG.PAGES)) {
    console.error(`❌ Unknown page name: "${pageName}". This page does not exist in URL_CONFIG.PAGES.`);
    throw new Error(`Unknown page name: "${pageName}". Please use a valid page name from URL_CONFIG.PAGES.`);
  }

  const slug = URL_CONFIG.PAGES[pageKey];

  // Custom domain: use root paths without /public/:storeSlug prefix
  if (isCustomDomain()) {
    const baseUrl = slug ? `/${slug}` : '/';
    return addUrlParams(baseUrl, params);
  }

  // Platform domain: include /public/:storeSlug prefix
  const baseUrl = slug
    ? `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug}/${slug}`
    : `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug}`;

  return addUrlParams(baseUrl, params);
}

/**
 * Create SEO-friendly product URL
 * Custom domain: /product/wireless-headphones-sony
 * Platform domain: /public/storename/product/wireless-headphones-sony
 */
export function createProductUrl(storeSlug, productSlug, params = {}, useShortUrl = false) {
  const productPage = useShortUrl ? URL_CONFIG.PAGES.PRODUCT_SHORT : URL_CONFIG.PAGES.PRODUCT_DETAIL;

  // Custom domain: use root paths without /public/:storeSlug prefix
  if (isCustomDomain()) {
    const baseUrl = `/${productPage}/${productSlug}`;
    return addUrlParams(baseUrl, params);
  }

  // Platform domain: include /public/:storeSlug prefix
  const baseUrl = `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug}/${productPage}/${productSlug}`;
  return addUrlParams(baseUrl, params);
}

/**
 * Create SEO-friendly brand URL
 * Custom domain: /brand/nike
 * Platform domain: /public/storename/brand/nike
 */
export function createBrandUrl(storeSlug, brandSlug, filters = {}, params = {}) {
  // Custom domain: use root paths without /public/:storeSlug prefix
  const baseUrl = isCustomDomain()
    ? `/${URL_CONFIG.PAGES.BRAND}/${brandSlug}`
    : `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug}/${URL_CONFIG.PAGES.BRAND}/${brandSlug}`;

  const filterParams = buildFilterParams(filters);
  const allParams = { ...filterParams, ...params };
  return addUrlParams(baseUrl, allParams);
}

/**
 * Create SEO-friendly collection URL
 * Custom domain: /collection/summer-2024
 * Platform domain: /public/storename/collection/summer-2024
 */
export function createCollectionUrl(storeSlug, collectionSlug, filters = {}, params = {}) {
  // Custom domain: use root paths without /public/:storeSlug prefix
  const baseUrl = isCustomDomain()
    ? `/${URL_CONFIG.PAGES.COLLECTION}/${collectionSlug}`
    : `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug}/${URL_CONFIG.PAGES.COLLECTION}/${collectionSlug}`;

  const filterParams = buildFilterParams(filters);
  const allParams = { ...filterParams, ...params };
  return addUrlParams(baseUrl, allParams);
}

/**
 * Create SEO-friendly search URL
 * Custom domain: /search/wireless-headphones
 * Platform domain: /public/storename/search/wireless-headphones
 */
export function createSearchUrl(storeSlug, searchQuery, filters = {}, params = {}) {
  const searchSlug = encodeURIComponent(searchQuery.toLowerCase().replace(/\s+/g, '-'));

  // Custom domain: use root paths without /public/:storeSlug prefix
  const baseUrl = isCustomDomain()
    ? `/${URL_CONFIG.PAGES.SEARCH}/${searchSlug}`
    : `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug}/${URL_CONFIG.PAGES.SEARCH}/${searchSlug}`;

  const filterParams = buildFilterParams(filters);
  const allParams = { ...filterParams, ...params };
  return addUrlParams(baseUrl, allParams);
}

/**
 * Create SEO-friendly category URL with layered navigation
 * Custom domain: /category/electronics/headphones?brand=sony,apple&price=100-500&color=black
 * Platform domain: /public/storename/category/electronics/headphones?brand=sony,apple&price=100-500&color=black
 */
export function createCategoryUrl(storeSlug, categoryPath, filters = {}, params = {}, useShortUrl = false) {
  const categorySlug = Array.isArray(categoryPath) ? categoryPath.join('/') : categoryPath;
  const categoryPage = useShortUrl ? URL_CONFIG.PAGES.CATEGORY_SHORT : URL_CONFIG.PAGES.CATEGORY;

  // Custom domain: use root paths without /public/:storeSlug prefix
  let baseUrl = isCustomDomain()
    ? `/${categoryPage}/${categorySlug}`
    : `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug}/${categoryPage}/${categorySlug}`;

  // Convert filters to SEO-friendly URL structure
  const filterParams = buildFilterParams(filters);
  const allParams = { ...filterParams, ...params };

  return addUrlParams(baseUrl, allParams);
}

/**
 * Create CMS page URL
 * Custom domain: /cms-page/about-us
 * Platform domain: /public/storename/cms-page/about-us
 */
export function createCmsPageUrl(storeSlug, pageSlug) {
  // Custom domain: use root paths without /public/:storeSlug prefix
  return isCustomDomain()
    ? `/${URL_CONFIG.PAGES.CMS_PAGE}/${pageSlug}`
    : `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug}/${URL_CONFIG.PAGES.CMS_PAGE}/${pageSlug}`;
}

/**
 * Build filter parameters for layered navigation
 */
export function buildFilterParams(filters) {
  const params = {};
  
  Object.entries(filters).forEach(([key, value]) => {
    const paramKey = URL_CONFIG.FILTER_PARAMS[key] || key;
    
    if (Array.isArray(value)) {
      // Multiple values: brand=sony,apple
      params[paramKey] = value.join(',');
    } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
      // Range values: price=100-500
      params[paramKey] = `${value.min}-${value.max}`;
    } else {
      params[paramKey] = value;
    }
  });
  
  return params;
}

/**
 * Parse filter parameters from URL
 */
export function parseFilterParams(searchParams) {
  const filters = {};
  
  Object.entries(URL_CONFIG.FILTER_PARAMS).forEach(([filterKey, paramKey]) => {
    const value = searchParams.get(paramKey);
    if (value) {
      if (value.includes(',')) {
        // Multiple values
        filters[filterKey] = value.split(',');
      } else if (value.includes('-') && (filterKey === 'price' || filterKey === 'rating')) {
        // Range values
        const [min, max] = value.split('-');
        filters[filterKey] = { min: parseFloat(min), max: parseFloat(max) };
      } else {
        filters[filterKey] = value;
      }
    }
  });
  
  return filters;
}

/**
 * Add URL parameters while preserving UTM and tracking parameters
 */
export function addUrlParams(baseUrl, params = {}) {
  if (Object.keys(params).length === 0) {
    return baseUrl;
  }
  
  const url = new URL(baseUrl, window.location.origin);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, value.toString());
    }
  });
  
  return url.pathname + url.search;
}

/**
 * Preserve UTM and tracking parameters when navigating
 */
export function preserveTrackingParams(newUrl) {
  const currentParams = new URLSearchParams(window.location.search);
  const newUrlObj = new URL(newUrl, window.location.origin);
  
  // UTM parameters to preserve
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 
                         'gclid', 'fbclid', 'ref', 'referrer', 'affiliate_id'];
  
  trackingParams.forEach(param => {
    const value = currentParams.get(param);
    if (value && !newUrlObj.searchParams.has(param)) {
      newUrlObj.searchParams.set(param, value);
    }
  });
  
  return newUrlObj.pathname + newUrlObj.search;
}

/**
 * Get current URL type (public/admin)
 */
export function getCurrentUrlType() {
  const pathname = window.location.pathname;
  if (pathname.startsWith(URL_CONFIG.ADMIN_PREFIX)) {
    return 'admin';
  } else if (pathname.startsWith(URL_CONFIG.PUBLIC_PREFIX)) {
    return 'public';
  }
  return 'legacy'; // For backward compatibility
}

/**
 * Generate external public store URL
 * @param {string} storeSlug - The store slug/code
 * @param {string} path - Optional path after the store slug (e.g., 'product/item-slug')
 * @param {string} customBaseUrl - Optional custom base URL (falls back to env var or default)
 * @returns {string} - The complete external URL
 */
export function getExternalStoreUrl(storeSlug, path = '', customBaseUrl = null) {
  // Priority: customBaseUrl > environment variable > default
  const baseUrl = customBaseUrl || 
                  import.meta.env.VITE_PUBLIC_STORE_BASE_URL || 
                  'https://www.dainostore.com';
  
  const publicPath = `${URL_CONFIG.PUBLIC_PREFIX}/${storeSlug || 'store'}`;
  const fullPath = path ? `${publicPath}/${path}` : publicPath;
  return `${baseUrl}${fullPath}`;
}

/**
 * Get base URL for public stores from store settings or environment
 * @param {object} store - Store object with settings
 * @returns {string} - The base URL for public stores
 */
export function getStoreBaseUrl(store = null) {
  // Check if store has a custom domain configured
  if (store?.custom_domain && store?.domain_status === 'active') {
    // If store has active custom domain, use it
    return `https://${store.custom_domain}`;
  }
  
  // Check store settings for configured base URL
  if (store?.settings?.public_base_url) {
    return store.settings.public_base_url;
  }
  
  // Fall back to environment variable or default
  return import.meta.env.VITE_PUBLIC_STORE_BASE_URL || 'https://www.dainostore.com';
}

/**
 * Extract store slug from public URL
 */
export function getStoreSlugFromPublicUrl(pathname) {
  // Match store slug with or without trailing slash
  const match = pathname.match(new RegExp(`^${URL_CONFIG.PUBLIC_PREFIX}/([^/]+)(?:/|$)`));
  return match ? match[1] : null;
}

/**
 * Parse product details from SEO URL (supports both long and short URLs)
 */
export function parseProductUrl(pathname) {
  // Try long URL format first
  let regex = new RegExp(`^${URL_CONFIG.PUBLIC_PREFIX}/([^/]+)/${URL_CONFIG.PAGES.PRODUCT_DETAIL}/(.+)-(\\d+)$`);
  let match = pathname.match(regex);
  
  // Try short URL format
  if (!match) {
    regex = new RegExp(`^${URL_CONFIG.PUBLIC_PREFIX}/([^/]+)/${URL_CONFIG.PAGES.PRODUCT_SHORT}/(.+)-(\\d+)$`);
    match = pathname.match(regex);
  }
  
  if (match) {
    return {
      storeSlug: match[1],
      productSlug: match[2],
      productId: parseInt(match[3]),
      isShortUrl: pathname.includes(`/${URL_CONFIG.PAGES.PRODUCT_SHORT}/`)
    };
  }
  
  return null;
}

/**
 * Parse category details from SEO URL (supports both long and short URLs)
 */
export function parseCategoryUrl(pathname) {
  // Try long URL format first
  let regex = new RegExp(`^${URL_CONFIG.PUBLIC_PREFIX}/([^/]+)/${URL_CONFIG.PAGES.CATEGORY}/(.+)$`);
  let match = pathname.match(regex);
  
  // Try short URL format
  if (!match) {
    regex = new RegExp(`^${URL_CONFIG.PUBLIC_PREFIX}/([^/]+)/${URL_CONFIG.PAGES.CATEGORY_SHORT}/(.+)$`);
    match = pathname.match(regex);
  }
  
  if (match) {
    return {
      storeSlug: match[1],
      categoryPath: match[2].split('/'),
      isShortUrl: pathname.includes(`/${URL_CONFIG.PAGES.CATEGORY_SHORT}/`)
    };
  }
  
  return null;
}

/**
 * Parse brand details from SEO URL
 */
export function parseBrandUrl(pathname) {
  const regex = new RegExp(`^${URL_CONFIG.PUBLIC_PREFIX}/([^/]+)/${URL_CONFIG.PAGES.BRAND}/(.+)$`);
  const match = pathname.match(regex);
  
  if (match) {
    return {
      storeSlug: match[1],
      brandSlug: match[2]
    };
  }
  
  return null;
}

/**
 * Parse collection details from SEO URL
 */
export function parseCollectionUrl(pathname) {
  const regex = new RegExp(`^${URL_CONFIG.PUBLIC_PREFIX}/([^/]+)/${URL_CONFIG.PAGES.COLLECTION}/(.+)$`);
  const match = pathname.match(regex);
  
  if (match) {
    return {
      storeSlug: match[1],
      collectionSlug: match[2]
    };
  }
  
  return null;
}

/**
 * Parse search details from SEO URL
 */
export function parseSearchUrl(pathname) {
  const regex = new RegExp(`^${URL_CONFIG.PUBLIC_PREFIX}/([^/]+)/${URL_CONFIG.PAGES.SEARCH}/(.+)$`);
  const match = pathname.match(regex);
  
  if (match) {
    return {
      storeSlug: match[1],
      searchSlug: match[2],
      searchQuery: decodeURIComponent(match[2].replace(/-/g, ' '))
    };
  }
  
  return null;
}

/**
 * Generate breadcrumb data from URL
 */
export function generateBreadcrumbs(pathname, searchParams) {
  const breadcrumbs = [];
  const urlType = getCurrentUrlType();
  
  if (urlType === 'public') {
    const storeSlug = getStoreSlugFromPublicUrl(pathname);
    if (storeSlug) {
      breadcrumbs.push({
        label: 'Home',
        url: createPublicUrl(storeSlug, 'STOREFRONT')
      });
      
      // Add category breadcrumbs
      const categoryData = parseCategoryUrl(pathname);
      if (categoryData) {
        let currentPath = '';
        categoryData.categoryPath.forEach((segment, index) => {
          currentPath = currentPath ? `${currentPath}/${segment}` : segment;
          breadcrumbs.push({
            label: segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: createCategoryUrl(storeSlug, currentPath, {}, {}, categoryData.isShortUrl)
          });
        });
      }
      
      // Add product breadcrumbs
      const productData = parseProductUrl(pathname);
      if (productData) {
        breadcrumbs.push({
          label: productData.productSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          url: pathname
        });
      }
      
      // Add brand breadcrumbs
      const brandData = parseBrandUrl(pathname);
      if (brandData) {
        breadcrumbs.push({
          label: `Brand: ${brandData.brandSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
          url: pathname
        });
      }
      
      // Add collection breadcrumbs
      const collectionData = parseCollectionUrl(pathname);
      if (collectionData) {
        breadcrumbs.push({
          label: `Collection: ${collectionData.collectionSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
          url: pathname
        });
      }
      
      // Add search breadcrumbs
      const searchData = parseSearchUrl(pathname);
      if (searchData) {
        breadcrumbs.push({
          label: `Search: "${searchData.searchQuery}"`,
          url: pathname
        });
      }
    }
  }
  
  return breadcrumbs;
}

/**
 * Create canonical URL for SEO
 */
export function createCanonicalUrl(pathname, searchParams = null) {
  const baseUrl = `${window.location.protocol}//${window.location.host}${pathname}`;
  
  if (!searchParams) {
    return baseUrl;
  }
  
  // Only include SEO-relevant parameters in canonical URL
  const canonicalParams = new URLSearchParams();
  const relevantParams = ['page', 'sort', ...Object.values(URL_CONFIG.FILTER_PARAMS)];
  
  relevantParams.forEach(param => {
    const value = searchParams.get(param);
    if (value) {
      canonicalParams.set(param, value);
    }
  });
  
  const queryString = canonicalParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}


// Backward compatibility exports
export function createPageUrl(pageName) {
  console.warn('createPageUrl is deprecated. Use createAdminUrl or createPublicUrl instead.');
  return createAdminUrl(pageName);
}

export function createStoreUrl(storeSlug, pageName) {
  console.warn('createStoreUrl is deprecated. Use createPublicUrl instead.');
  return createPublicUrl(storeSlug, pageName);
}

export function getStoreSlugFromUrl(pathname) {
  console.warn('getStoreSlugFromUrl is deprecated. Use getStoreSlugFromPublicUrl instead.');
  return getStoreSlugFromPublicUrl(pathname) || pathname.match(/^\/([^\/]+)\//)?.[1];
}