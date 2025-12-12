/**
 * Editor Header Utilities
 *
 * Helper functions for building header context in editor pages.
 * These utilities ensure consistent header context structure across
 * all editor pages (Category, Product, Cart, etc.)
 */

/**
 * Build header context for editor mode
 *
 * Creates a headerContext object compatible with HeaderSlotRenderer.
 * This context is used when rendering the header in editor preview.
 *
 * @param {Object} options - Context options
 * @param {Object} options.store - Store object
 * @param {Object} options.settings - Store settings
 * @param {Array} options.categories - Category list for navigation
 * @param {string} options.viewport - Current viewport mode ('mobile', 'tablet', 'desktop')
 * @param {string} options.pathname - Current pathname for navigation state
 * @returns {Object} Header context object
 */
export const buildEditorHeaderContext = ({
  store,
  settings = {},
  categories = [],
  viewport = 'desktop',
  pathname = '/'
}) => {
  return {
    // Store info
    store,
    settings,

    // Categories for navigation
    categories,

    // User - not logged in for editor preview
    user: null,
    userLoading: false,

    // Language settings
    languages: [],
    currentLanguage: 'en',
    setCurrentLanguage: () => {},

    // Country selection
    selectedCountry: null,
    setSelectedCountry: () => {},

    // Mobile menu state - closed by default in editor
    mobileMenuOpen: false,
    mobileSearchOpen: false,
    setMobileMenuOpen: () => {},
    setMobileSearchOpen: () => {},

    // Auth handlers - no-op in editor
    handleCustomerLogout: () => {},

    // Navigation - no-op in editor
    navigate: () => {},
    location: { pathname },

    // Editor flags
    isEditor: true,
    responsiveMode: viewport // 'mobile', 'tablet', 'desktop'
  };
};

/**
 * Get viewport mode for header from current viewport setting
 *
 * Maps viewport to the mode expected by HeaderSlotRenderer
 *
 * @param {string} viewport - Current viewport ('mobile', 'tablet', 'desktop')
 * @returns {string} Header view mode ('mobile' or 'desktop')
 */
export const getHeaderViewMode = (viewport) => {
  return viewport === 'mobile' ? 'mobile' : 'desktop';
};

export default {
  buildEditorHeaderContext,
  getHeaderViewMode
};
