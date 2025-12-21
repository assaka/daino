/**
 * Store Settings Defaults and Merging Utilities
 *
 * Extracted from StoreProvider.jsx to improve readability and maintainability.
 * This file handles all default settings merging logic.
 */

/**
 * Helper function to clean checkout layouts
 * Removes deprecated sections and applies migrations
 */
export function cleanCheckoutLayout(layout) {
  if (!layout) return layout;

  const cleanedLayout = {};
  Object.keys(layout).forEach(stepKey => {
    cleanedLayout[stepKey] = {};
    Object.keys(layout[stepKey]).forEach(columnKey => {
      let sections = layout[stepKey][columnKey] || [];

      // Replace old "Delivery Options" with "Delivery Settings"
      sections = sections.map(section =>
        section === 'Delivery Options' ? 'Delivery Settings' : section
      );

      // Remove "Account" section (deprecated)
      sections = sections.filter(section => section !== 'Account');

      // Remove duplicates while preserving order
      cleanedLayout[stepKey][columnKey] = [...new Set(sections)];
    });
  });
  return cleanedLayout;
}

/**
 * Get currency symbol from currency code
 */
export function getCurrencySymbol(currencyCode) {
  const currencyMap = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'CNY': '¥',
    'SEK': 'kr',
    'NOK': 'kr',
    'MXN': '$',
    'INR': '₹',
    'KRW': '₩',
    'SGD': 'S$',
    'HKD': 'HK$',
    'BRL': 'R$',
    'ZAR': 'R',
    'RUB': '₽',
    'PLN': 'zł',
    'CZK': 'Kč',
    'HUF': 'Ft',
    'RON': 'lei',
    'BGN': 'лв',
    'HRK': 'kn',
    'DKK': 'kr',
    'TRY': '₺',
    'NZD': 'NZ$',
    'THB': '฿',
    'MYR': 'RM',
    'IDR': 'Rp',
    'PHP': '₱',
    'VND': '₫',
    'AED': 'د.إ',
    'SAR': '﷼',
    'ILS': '₪',
    // Africa
    'AOA': 'Kz',
    'NGN': '₦',
    'KES': 'KSh',
    'EGP': 'E£',
    'MAD': 'د.م.',
    'GHS': 'GH₵',
  };
  const normalizedCode = currencyCode?.toUpperCase?.() || '';
  return currencyMap[normalizedCode] || '$';
}

/**
 * Get stock-related default settings
 */
function getStockDefaults(settings) {
  return {
    enable_inventory: settings?.enable_inventory !== undefined
      ? settings.enable_inventory
      : true,
    display_out_of_stock: settings?.display_out_of_stock !== undefined
      ? settings.display_out_of_stock
      : true,
    hide_stock_quantity: settings?.hide_stock_quantity !== undefined
      ? settings.hide_stock_quantity
      : false,
    display_low_stock_threshold: settings?.display_low_stock_threshold !== undefined
      ? settings.display_low_stock_threshold
      : 0,
    // FIXED: Check top-level path first (where ThemeLayout saves), then fall back to nested path for backwards compatibility
    show_stock_label: settings?.show_stock_label !== undefined
      ? settings.show_stock_label
      : (settings?.stock_settings?.show_stock_label !== undefined
        ? settings.stock_settings.show_stock_label
        : false),
  };
}

/**
 * Get general store default settings
 */
function getGeneralDefaults(settings) {
  return {
    enable_reviews: settings?.enable_reviews !== undefined
      ? settings.enable_reviews
      : true,
    allow_guest_checkout: settings?.allow_guest_checkout !== undefined
      ? settings.allow_guest_checkout
      : true,
    require_shipping_address: settings?.require_shipping_address !== undefined
      ? settings.require_shipping_address
      : true,
    collect_phone_number_at_checkout: settings?.collect_phone_number_at_checkout !== undefined
      ? settings.collect_phone_number_at_checkout
      : false,
    phone_number_required_at_checkout: settings?.phone_number_required_at_checkout !== undefined
      ? settings.phone_number_required_at_checkout
      : true,
    hide_currency_category: settings?.hide_currency_category !== undefined
      ? settings.hide_currency_category
      : false,
    hide_currency_product: settings?.hide_currency_product !== undefined
      ? settings.hide_currency_product
      : false,
    hide_header_cart: settings?.hide_header_cart !== undefined
      ? settings.hide_header_cart
      : false,
    hide_header_checkout: settings?.hide_header_checkout !== undefined
      ? settings.hide_header_checkout
      : false,
    hide_quantity_selector: settings?.hide_quantity_selector !== undefined
      ? settings.hide_quantity_selector
      : false,
    show_permanent_search: settings?.show_permanent_search !== undefined
      ? settings.show_permanent_search
      : true,
    show_category_in_breadcrumb: settings?.show_category_in_breadcrumb !== undefined
      ? settings.show_category_in_breadcrumb
      : true,
    // Header settings
    show_language_selector: settings?.show_language_selector !== undefined
      ? settings.show_language_selector
      : false,
  };
}

/**
 * Get category page default settings
 */
function getCategoryDefaults(settings) {
  return {
    enable_product_filters: settings?.enable_product_filters !== undefined
      ? settings.enable_product_filters
      : true,
    collapse_filters: settings?.collapse_filters !== undefined
      ? settings.collapse_filters
      : false,
    max_visible_attributes: settings?.max_visible_attributes !== undefined
      ? settings.max_visible_attributes
      : 5,
    enable_view_mode_toggle: settings?.enable_view_mode_toggle !== undefined
      ? settings.enable_view_mode_toggle
      : true,
    default_view_mode: settings?.default_view_mode || 'grid',
  };
}

/**
 * Cache for theme defaults from bootstrap/API
 * This allows us to use DB-defined defaults when available
 */
let cachedThemeDefaults = null;

/**
 * Set theme defaults from bootstrap data
 * Called once when bootstrap data is received from the server
 * @param {Object} themeDefaults - Theme defaults from master DB
 */
export function setThemeDefaultsFromBootstrap(themeDefaults) {
  if (themeDefaults && typeof themeDefaults === 'object') {
    cachedThemeDefaults = themeDefaults;
  }
}

/**
 * Get cached theme defaults (for components that need direct access)
 * @returns {Object|null} Cached theme defaults or null
 */
export function getCachedThemeDefaults() {
  return cachedThemeDefaults;
}

/**
 * Hardcoded fallback defaults (ultimate safety net when DB unavailable)
 */
const HARDCODED_THEME_DEFAULTS = {
  // Button colors
  primary_button_color: '#007bff',
  secondary_button_color: '#6c757d',
  add_to_cart_button_color: '#28a745',
  view_cart_button_color: '#17a2b8',
  checkout_button_color: '#007bff',
  place_order_button_color: '#28a745',
  font_family: 'Inter',

  // Product Tabs defaults
  product_tabs_title_color: '#DC2626',
  product_tabs_title_size: '1rem',
  product_tabs_content_bg: '#EFF6FF',
  product_tabs_content_color: '#374151',
  product_tabs_attribute_label_color: '#16A34A',
  product_tabs_active_bg: 'transparent',
  product_tabs_inactive_color: '#6B7280',
  product_tabs_inactive_bg: 'transparent',
  product_tabs_hover_color: '#111827',
  product_tabs_hover_bg: '#F3F4F6',
  product_tabs_font_weight: '500',
  product_tabs_border_radius: '0.5rem',
  product_tabs_border_color: '#E5E7EB',
  product_tabs_text_decoration: 'none',

  // Breadcrumb defaults
  breadcrumb_show_home_icon: true,
  breadcrumb_item_text_color: '#6B7280',
  breadcrumb_item_hover_color: '#374151',
  breadcrumb_active_item_color: '#111827',
  breadcrumb_separator_color: '#9CA3AF',
  breadcrumb_font_size: '0.875rem',
  breadcrumb_mobile_font_size: '0.75rem',
  breadcrumb_font_weight: '400',

  // Checkout defaults
  checkout_steps_count: 2,
  checkout_step_indicator_active_color: '#007bff',
  checkout_step_indicator_inactive_color: '#D1D5DB',
  checkout_step_indicator_completed_color: '#10B981',
  checkout_step_indicator_style: 'circles',
  checkout_section_title_color: '#111827',
  checkout_section_title_size: '1.25rem',
  checkout_section_bg_color: '#FFFFFF',
  checkout_section_border_color: '#E5E7EB',
  checkout_section_text_color: '#374151'
};

/**
 * Get theme default settings
 * Priority: 1. themeSettings (user overrides), 2. Bootstrap/API defaults, 3. Hardcoded fallbacks
 * @param {Object} themeSettings - User's custom theme settings
 * @returns {Object} Merged theme settings
 */
export function getThemeDefaults(themeSettings = {}) {
  return {
    // 1. Hardcoded fallbacks (lowest priority)
    ...HARDCODED_THEME_DEFAULTS,
    // 2. Bootstrap/API defaults from master DB (middle priority)
    ...(cachedThemeDefaults || {}),
    // 3. User's saved settings (highest priority)
    ...themeSettings
  };
}

/**
 * Get product grid default settings
 */
function getProductGridDefaults(gridSettings = {}) {
  return {
    breakpoints: {
      default: gridSettings?.breakpoints?.default ?? 1,
      sm: gridSettings?.breakpoints?.sm ?? 2,
      md: gridSettings?.breakpoints?.md ?? 0,
      lg: gridSettings?.breakpoints?.lg ?? 2,
      xl: gridSettings?.breakpoints?.xl ?? 0,
      '2xl': gridSettings?.breakpoints?.['2xl'] ?? 0
    },
    customBreakpoints: gridSettings?.customBreakpoints || [],
    rows: gridSettings?.rows ?? 4
  };
}

/**
 * Get checkout page default settings
 */
function getCheckoutDefaults(settings) {
  // Theme colors are stored in settings.theme, so read from there
  const theme = settings?.theme || {};

  return {
    checkout_steps_count: settings?.checkout_steps_count ?? 2,

    // Step names for 2-step checkout
    checkout_2step_step1_name: settings?.checkout_2step_step1_name || 'Information',
    checkout_2step_step2_name: settings?.checkout_2step_step2_name || 'Payment',

    // Step names for 3-step checkout
    checkout_3step_step1_name: settings?.checkout_3step_step1_name || 'Information',
    checkout_3step_step2_name: settings?.checkout_3step_step2_name || 'Shipping',
    checkout_3step_step3_name: settings?.checkout_3step_step3_name || 'Payment',

    // Checkout styling - read from theme object where these colors are stored
    checkout_step_indicator_active_color: theme.checkout_step_indicator_active_color || HARDCODED_THEME_DEFAULTS.checkout_step_indicator_active_color,
    checkout_step_indicator_inactive_color: theme.checkout_step_indicator_inactive_color || HARDCODED_THEME_DEFAULTS.checkout_step_indicator_inactive_color,
    checkout_step_indicator_completed_color: theme.checkout_step_indicator_completed_color || HARDCODED_THEME_DEFAULTS.checkout_step_indicator_completed_color,
    checkout_step_indicator_style: theme.checkout_step_indicator_style || HARDCODED_THEME_DEFAULTS.checkout_step_indicator_style,
    checkout_section_title_color: theme.checkout_section_title_color || HARDCODED_THEME_DEFAULTS.checkout_section_title_color,
    checkout_section_title_size: theme.checkout_section_title_size || HARDCODED_THEME_DEFAULTS.checkout_section_title_size,
    checkout_section_bg_color: theme.checkout_section_bg_color || HARDCODED_THEME_DEFAULTS.checkout_section_bg_color,
    checkout_section_border_color: theme.checkout_section_border_color || HARDCODED_THEME_DEFAULTS.checkout_section_border_color,
    checkout_section_text_color: theme.checkout_section_text_color || HARDCODED_THEME_DEFAULTS.checkout_section_text_color,

    // Checkout Layout Configuration
    checkout_1step_columns: settings?.checkout_1step_columns ?? 3,
    checkout_2step_columns: settings?.checkout_2step_columns ?? 2,
    checkout_3step_columns: settings?.checkout_3step_columns ?? 2,

    checkout_1step_layout: cleanCheckoutLayout(settings?.checkout_1step_layout) || {
      step1: {
        column1: ['Shipping Address', 'Shipping Method', 'Billing Address'],
        column2: ['Delivery Settings', 'Payment Method'],
        column3: ['Coupon', 'Order Summary']
      }
    },
    checkout_2step_layout: cleanCheckoutLayout(settings?.checkout_2step_layout) || {
      step1: {
        column1: ['Shipping Address', 'Billing Address'],
        column2: ['Shipping Method', 'Delivery Settings']
      },
      step2: {
        column1: ['Summary', 'Payment Method'],
        column2: ['Coupon', 'Order Summary']
      }
    },
    checkout_3step_layout: cleanCheckoutLayout(settings?.checkout_3step_layout) || {
      step1: {
        column1: ['Shipping Address', 'Billing Address'],
        column2: []
      },
      step2: {
        column1: ['Shipping Method', 'Delivery Settings'],
        column2: []
      },
      step3: {
        column1: ['Summary', 'Payment Method'],
        column2: ['Coupon', 'Order Summary']
      }
    },
  };
}

/**
 * Get product gallery layout defaults
 */
function getProductGalleryDefaults(settings) {
  return {
    product_gallery_layout: settings?.product_gallery_layout !== undefined
      ? settings.product_gallery_layout
      : 'horizontal',
    vertical_gallery_position: settings?.vertical_gallery_position !== undefined
      ? settings.vertical_gallery_position
      : 'left',
    mobile_gallery_layout: settings?.mobile_gallery_layout !== undefined
      ? settings.mobile_gallery_layout
      : 'below',
  };
}

/**
 * Get navigation defaults
 */
function getNavigationDefaults(settings) {
  // Handle both boolean and string values for boolean settings
  const parseBoolean = (value) => value === true || value === 'true';

  return {
    excludeRootFromMenu: parseBoolean(settings?.excludeRootFromMenu),
    expandAllMenuItems: parseBoolean(settings?.expandAllMenuItems),
    // Preserve rootCategoryId as-is (it's a string/null, not a boolean)
    rootCategoryId: settings?.rootCategoryId || null,
  };
}

/**
 * Get currency defaults
 */
function getCurrencyDefaults(store, settings) {
  const currencyCode = store.currency || settings?.currency_code || 'No Currency';
  return {
    currency_code: currencyCode,
    currency_symbol: getCurrencySymbol(currencyCode),
  };
}

/**
 * Main function to merge store settings with all defaults
 * @param {Object} store - Store object from database
 * @returns {Object} Merged settings with all defaults applied
 */
export function mergeStoreSettings(store) {
  const settings = store.settings || {};

  return {
    // Spread existing store settings first to preserve saved values
    ...settings,

    // Apply defaults for each category
    ...getStockDefaults(settings),
    ...getGeneralDefaults(settings),
    ...getCategoryDefaults(settings),
    ...getCurrencyDefaults(store, settings),
    ...getProductGalleryDefaults(settings),
    ...getNavigationDefaults(settings),
    ...getCheckoutDefaults(settings),

    // Complex nested objects
    theme: getThemeDefaults(settings.theme),
    product_grid: getProductGridDefaults(settings.product_grid),

    // Cookie consent defaults (only if not already defined)
    cookie_consent: settings?.cookie_consent || {
      enabled: false
    },

    // Allowed countries default
    allowed_countries: settings?.allowed_countries || ['US', 'CA', 'GB', 'DE', 'FR']
  };
}
