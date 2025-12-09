/**
 * slotDataPreprocessor.js - Unified Data Preprocessing for Slot Rendering
 *
 * =====================================================================
 * PURPOSE: Single source of truth for preprocessing data before slot rendering.
 * Consolidates formatting logic from CategorySlotRenderer, CartSlotRenderer,
 * and HeaderSlotRenderer into one centralized location.
 * =====================================================================
 *
 * ARCHITECTURE ROLE:
 *
 * This module is the **central data formatting layer** that:
 * 1. Formats products with prices, stock labels, and URLs
 * 2. Formats cart items with totals and options
 * 3. Formats category/filter data
 * 4. Processes template variables
 *
 * DATA FLOW:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Page Component (Category.jsx, Cart.jsx, Header.jsx, etc.)  │
 * │ - Raw data from API (products, cart, user, etc.)           │
 * └────────────────────┬────────────────────────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │ slotDataPreprocessor (THIS FILE)                            │
 * │ 1. preprocessSlotData(pageType, rawData, store, settings)  │
 * │ 2. Returns fully formatted variableContext                  │
 * └────────────────────┬────────────────────────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │ UnifiedSlotRenderer                                         │
 * │ - Uses preprocessedData directly                            │
 * │ - No additional formatting needed                           │
 * └─────────────────────────────────────────────────────────────┘
 *
 * @module slotDataPreprocessor
 */

import { formatPrice, formatPriceNumber, getPriceDisplay, calculateItemTotal } from './priceUtils';
import { getStockLabel, getStockLabelStyle, isProductOutOfStock } from './stockUtils';
import { getProductName, getCategoryName, getCurrentLanguage } from './translationUtils';
import { createProductUrl, createPublicUrl } from './urlUtils';

/**
 * Main entry point for preprocessing slot data
 * Call this before passing data to UnifiedSlotRenderer
 *
 * @param {string} pageType - Type of page: 'category', 'product', 'cart', 'header', etc.
 * @param {Object} rawData - Raw data from API/hooks
 * @param {Object} store - Store object
 * @param {Object} settings - Store settings
 * @param {Object} options - Additional options (translations, taxes, etc.)
 * @returns {Object} Preprocessed data ready for slot rendering
 */
export function preprocessSlotData(pageType, rawData, store, settings, options = {}) {
  const { translations = {}, taxes = [], selectedCountry = null, productLabels = [] } = options;
  const currentLanguage = getCurrentLanguage();

  const baseContext = {
    store,
    settings: enrichSettings(settings),
    currentLanguage,
    translations,
  };

  switch (pageType) {
    case 'category':
      return preprocessCategoryData(rawData, baseContext, { taxes, selectedCountry, productLabels });

    case 'product':
      return preprocessProductData(rawData, baseContext, { taxes, selectedCountry });

    case 'cart':
      return preprocessCartData(rawData, baseContext, { taxes, selectedCountry });

    case 'header':
      return preprocessHeaderData(rawData, baseContext);

    case 'checkout':
    case 'success':
    case 'account':
    case 'login':
      return preprocessGenericData(rawData, baseContext);

    default:
      console.warn(`Unknown page type: ${pageType}, returning base context`);
      return { ...baseContext, ...rawData };
  }
}

/**
 * Enrich settings with defaults for slot rendering
 */
function enrichSettings(settings) {
  return {
    ...settings,
    collapse_filters: settings?.collapse_filters !== undefined ? settings.collapse_filters : false,
    max_visible_attributes: settings?.max_visible_attributes || 5,
  };
}

// =============================================================================
// CATEGORY DATA PREPROCESSING
// =============================================================================

/**
 * Preprocess category page data
 * Extracted from CategorySlotRenderer lines 239-289
 */
function preprocessCategoryData(rawData, baseContext, options) {
  const { taxes, selectedCountry, productLabels = [] } = options;
  const { store, settings, currentLanguage, translations } = baseContext;

  const {
    category,
    products = [],
    allProducts = [],
    filters = {},
    filterableAttributes = [],
    breadcrumbs = [],
    selectedFilters = {},
    priceRange = {},
    categories = [],
    // Pagination
    currentPage,
    totalPages,
    itemsPerPage,
    filteredProductsCount,
    // Handlers (pass through)
    handleFilterChange,
    handleSortChange,
    handleSearchChange,
    handlePageChange,
    clearFilters,
    onProductClick,
    navigate,
    // Utilities (pass through)
    formatDisplayPrice,
    getProductImageUrl,
  } = rawData;

  // Format products with all necessary fields for templates
  const formattedProducts = formatProducts(products, {
    store,
    settings,
    currentLanguage,
    translations,
    productLabels,
    getProductImageUrl,
  });

  // Format all products (unfiltered) if provided
  const formattedAllProducts = allProducts.length > 0
    ? formatProducts(allProducts, { store, settings, currentLanguage, translations, productLabels, getProductImageUrl })
    : formattedProducts;

  // Format filters data - pass allProducts and selectedFilters for option formatting
  const formattedFilters = formatFiltersData(filters, filterableAttributes, currentLanguage, formattedAllProducts, selectedFilters);

  // Format category with translation
  const formattedCategory = category ? {
    ...category,
    name: getCategoryName(category, currentLanguage) || category.name,
  } : null;

  // Calculate pagination count text (singular/plural)
  // - "1 product" when showing 1 of 1
  // - "8 products" when showing all 8 of 8
  // - "12-24 of 24 products" when paginated
  const totalProducts = filteredProductsCount || formattedProducts.length;
  const startIndex = totalProducts > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0;
  const endIndex = Math.min(currentPage * itemsPerPage, totalProducts);
  const productWord = totalProducts === 1 ? 'product' : 'products';

  let countText;
  if (totalProducts === 0) {
    countText = 'No products found';
  } else if (startIndex === 1 && endIndex === totalProducts) {
    // Showing all products on one page
    countText = `${totalProducts} ${productWord}`;
  } else {
    // Paginated - show range
    countText = `${startIndex}-${endIndex} of ${totalProducts} ${productWord}`;
  }

  return {
    ...baseContext,
    // Formatted data
    category: formattedCategory,
    products: formattedProducts,
    allProducts: formattedAllProducts,
    filters: formattedFilters,
    filterableAttributes,
    breadcrumbs,
    selectedFilters,
    priceRange,
    categories,
    // Pagination - include countText for ProductCountInfo component
    pagination: {
      currentPage,
      totalPages,
      itemsPerPage,
      totalProducts,
      startIndex,
      endIndex,
      countText,
    },
    currentPage,
    totalPages,
    itemsPerPage,
    filteredProductsCount,
    // Pass through handlers
    handleFilterChange,
    handleSortChange,
    handleSearchChange,
    handlePageChange,
    clearFilters,
    onProductClick,
    navigate,
    formatDisplayPrice,
    getProductImageUrl,
  };
}

/**
 * Format products array with prices, stock, URLs
 * Extracted from CategorySlotRenderer lines 241-289
 */
function formatProducts(products, context) {
  const { store, settings, currentLanguage, translations, productLabels = [], getProductImageUrl } = context;

  return products.map(product => {
    // Use centralized getPriceDisplay utility
    const priceInfo = getPriceDisplay(product);

    // Get translated product name
    const translatedName = getProductName(product, currentLanguage) || product.name;

    // Calculate stock status
    const isInStock = !isProductOutOfStock(product);
    const stockLabelInfo = getStockLabel(product, settings, null, translations);
    const stockLabelStyle = getStockLabelStyle(product, settings, null, translations);

    // Get image URL
    const imageUrl = getProductImageUrl
      ? getProductImageUrl(product)
      : (product.images?.[0]?.url || product.image_url || product.image || '');

    // Build product URL
    const productUrl = product.url || createProductUrl(
      store?.public_storecode || store?.slug || store?.code,
      product.slug || product.id
    );

    // Format product labels (new, sale, featured)
    const formattedLabels = (productLabels || [])
      .filter(label => {
        if (label.type === 'new' && product.is_new) return true;
        if (label.type === 'sale' && product.compare_price) return true;
        if (label.type === 'featured' && product.is_featured) return true;
        return false;
      })
      .map(label => ({
        text: label.text,
        className: label.background_color
          ? `bg-[${label.background_color}] text-white`
          : 'bg-red-600 text-white'
      }));

    return {
      ...product,
      // Translated name
      name: translatedName,
      // Formatted prices (with currency symbol)
      price_formatted: formatPrice(priceInfo.displayPrice),
      compare_price_formatted: priceInfo.hasComparePrice ? formatPrice(priceInfo.originalPrice) : '',
      // Price numbers (without currency, for conditional display)
      price_number: formatPriceNumber(priceInfo.displayPrice),
      compare_price_number: priceInfo.hasComparePrice ? formatPriceNumber(priceInfo.originalPrice) : '',
      // Additional price formats for backward compatibility
      lowest_price_formatted: formatPrice(priceInfo.displayPrice),
      highest_price_formatted: priceInfo.hasComparePrice ? formatPrice(priceInfo.originalPrice) : formatPrice(priceInfo.displayPrice),
      formatted_price: formatPrice(priceInfo.displayPrice),
      formatted_compare_price: priceInfo.hasComparePrice ? formatPrice(priceInfo.originalPrice) : null,
      // URLs
      image_url: imageUrl,
      url: productUrl,
      // Stock info
      in_stock: isInStock,
      stock_label: stockLabelInfo?.text || '',
      stock_label_style: stockLabelStyle,
      // Labels
      labels: formattedLabels,
      // Sale flag
      is_sale: priceInfo.isSale,
    };
  });
}

/**
 * Format filters data for LayeredNavigation
 * Extracted from CategorySlotRenderer lines 291-461
 *
 * @param {Object} filters - Filters object from Category.jsx buildFilters()
 * @param {Array} filterableAttributes - Filterable attributes from API
 * @param {string} currentLanguage - Current language code
 * @param {Array} allProducts - All products for counting (optional)
 * @param {Object} selectedFilters - Currently selected filters (optional)
 */
function formatFiltersData(filters, filterableAttributes, currentLanguage, allProducts = [], selectedFilters = {}) {
  const filtersData = filters || {};

  // Format price filter
  let priceFilter = null;
  if (filtersData.price) {
    if (filtersData.price.type === 'slider' && filtersData.price.min !== undefined) {
      priceFilter = {
        min: filtersData.price.min,
        max: filtersData.price.max,
        currentMin: filtersData.price.min,
        currentMax: filtersData.price.max,
        type: 'slider'
      };
    } else if (Array.isArray(filtersData.price)) {
      priceFilter = {
        ranges: filtersData.price.map(item => ({
          value: typeof item === 'object' ? (item.value || item.label) : item,
          label: typeof item === 'object' ? (item.label || item.value) : item,
          count: 0,
          active: false
        }))
      };
    } else if (typeof filtersData.price === 'object') {
      priceFilter = {
        ranges: Object.entries(filtersData.price).map(([value, label]) => ({
          value,
          label: typeof label === 'string' ? label : value,
          count: 0,
          active: false
        }))
      };
    }
  }

  // Format attribute filters with properly formatted options
  const attributeFilters = (filterableAttributes || []).map(attr => {
    const attrCode = attr.code || attr.name;
    const filterData = filtersData[attrCode];
    const filterType = attr.filter_type || 'multiselect';

    // Get translated attribute label - use pre-translated label from backend first
    const attributeLabel = attr.label ||
      attr.translations?.[currentLanguage]?.label ||
      attr.translations?.en?.label ||
      attr.name || attr.code || attrCode;

    // Get value codes from filterData.options
    let valueCodes = [];
    if (filterData && typeof filterData === 'object' && filterData.options) {
      valueCodes = filterData.options;
    }

    // Get attribute values with translations from attr.values (from publicAttributes API)
    const attributeValues = attr.values || [];

    // Format options with value, label, count, active, attributeCode, filter_type
    const formattedOptions = valueCodes
      .map(valueCode => {
        // Ensure valueCode is a string
        const valueCodeStr = String(valueCode);

        // Find the AttributeValue record for this code
        const attrValue = attributeValues.find(av => av.code === valueCodeStr);

        // Count products that have this attribute value
        const productCount = allProducts.filter(p => {
          const productAttributes = p.attributes || [];
          if (!Array.isArray(productAttributes)) return false;

          const matchingAttr = productAttributes.find(pAttr => pAttr.code === attrCode);
          // Use rawValue (code) if available, otherwise fall back to value (translated label)
          const productValue = String(matchingAttr?.rawValue || matchingAttr?.value || '');
          return matchingAttr && productValue === valueCodeStr;
        }).length;

        // Check if this filter value is currently selected
        const isActive = selectedFilters[attrCode]?.includes(valueCodeStr) || false;

        // Get translated label - use pre-translated value from backend
        const valueLabel = attrValue?.value || valueCodeStr;

        return {
          value: valueCodeStr,
          label: valueLabel,
          count: productCount,
          active: isActive,
          attributeCode: attrCode,
          sort_order: attrValue?.sort_order || 999,
          filter_type: filterType
        };
      })
      .filter(opt => opt.count > 0) // Only include options with products
      .sort((a, b) => a.sort_order - b.sort_order);

    return {
      code: attrCode,
      label: attributeLabel,
      filter_type: filterType,
      options: formattedOptions,
    };
  }).filter(attr => attr && attr.options && attr.options.length > 0);

  return {
    price: priceFilter,
    attributes: attributeFilters,
    raw: filtersData,
  };
}

// =============================================================================
// PRODUCT DATA PREPROCESSING
// =============================================================================

/**
 * Preprocess product detail page data
 */
function preprocessProductData(rawData, baseContext, options) {
  const { store, settings, currentLanguage, translations } = baseContext;

  const { product, relatedProducts = [], breadcrumbs = [], ...rest } = rawData;

  // Format main product
  const formattedProduct = product ? formatProducts([product], {
    store,
    settings,
    currentLanguage,
    translations,
    productLabels: [],
  })[0] : null;

  // Format related products
  const formattedRelatedProducts = formatProducts(relatedProducts, {
    store,
    settings,
    currentLanguage,
    translations,
    productLabels: [],
  });

  return {
    ...baseContext,
    product: formattedProduct,
    relatedProducts: formattedRelatedProducts,
    breadcrumbs,
    ...rest,
  };
}

// =============================================================================
// CART DATA PREPROCESSING
// =============================================================================

/**
 * Preprocess cart page data
 * Extracted from CartSlotRenderer lines 51-65, 187-270
 */
function preprocessCartData(rawData, baseContext, options) {
  const { store, settings, currentLanguage, translations } = baseContext;

  const {
    cartItems = [],
    appliedCoupon,
    couponCode,
    subtotal,
    discount,
    tax,
    total,
    taxDetails,
    currencySymbol,
    // Handlers (pass through)
    updateQuantity,
    removeItem,
    handleCheckout,
    handleApplyCoupon,
    handleRemoveCoupon,
    handleCouponKeyPress,
    setCouponCode,
    formatDisplayPrice,
    navigate,
    getStoreBaseUrl,
  } = rawData;

  // Format cart items
  const formattedCartItems = cartItems.map(item => {
    const product = item.product;
    if (!product) return item;

    // Get translated product name
    const translatedName = getProductName(product, currentLanguage) || product.name || 'Product';

    // Calculate item total
    const itemTotal = calculateItemTotal(item, product);

    // Get base price for display
    const basePriceForDisplay = item.price > 0 ? item.price : (product.sale_price || product.price);

    // Get image URL
    const imageUrl = getCartItemImageUrl(product);

    return {
      ...item,
      product: {
        ...product,
        name: translatedName,
        image_url: imageUrl,
      },
      // Formatted values
      translated_name: translatedName,
      image_url: imageUrl,
      base_price_formatted: formatPrice(basePriceForDisplay),
      item_total: itemTotal,
      item_total_formatted: formatPrice(itemTotal),
    };
  });

  return {
    ...baseContext,
    // Cart data
    cartItems: formattedCartItems,
    appliedCoupon,
    couponCode,
    // Totals (formatted)
    subtotal,
    subtotal_formatted: formatPrice(subtotal || 0),
    discount,
    discount_formatted: formatPrice(discount || 0),
    tax,
    tax_formatted: formatPrice(tax || 0),
    total,
    total_formatted: formatPrice(total || 0),
    taxDetails,
    currencySymbol,
    // Handlers
    updateQuantity,
    removeItem,
    handleCheckout,
    handleApplyCoupon,
    handleRemoveCoupon,
    handleCouponKeyPress,
    setCouponCode,
    formatDisplayPrice,
    navigate,
    getStoreBaseUrl,
  };
}

/**
 * Get image URL from cart item product
 * Extracted from CartSlotRenderer lines 52-65
 */
function getCartItemImageUrl(product) {
  if (!product || !product.images || !product.images[0]) {
    return 'https://placehold.co/100x100?text=No+Image';
  }

  const firstImage = product.images[0];
  if (typeof firstImage === 'object' && firstImage) {
    return firstImage.url || 'https://placehold.co/100x100?text=No+Image';
  }

  return 'https://placehold.co/100x100?text=No+Image';
}

// =============================================================================
// HEADER DATA PREPROCESSING
// =============================================================================

/**
 * Preprocess header data
 * Extracted from HeaderSlotRenderer lines 81-108
 */
function preprocessHeaderData(rawData, baseContext) {
  const { store, settings } = baseContext;

  const {
    user,
    userLoading,
    categories = [],
    languages = [],
    currentLanguage,
    selectedCountry,
    mobileMenuOpen,
    mobileSearchOpen,
    // Handlers
    setCurrentLanguage,
    setSelectedCountry,
    setMobileMenuOpen,
    setMobileSearchOpen,
    handleCustomerLogout,
    navigate,
    location,
  } = rawData;

  return {
    ...baseContext,
    // User data
    user,
    userLoading,
    user_name: user?.name || user?.email || '',
    user_email: user?.email || '',
    is_logged_in: !!user,
    // Navigation data
    categories,
    languages,
    currentLanguage,
    selectedCountry,
    // Mobile state
    mobileMenuOpen,
    mobileSearchOpen,
    // Store URL
    store_url: createPublicUrl(store?.slug, 'STOREFRONT'),
    store_name: store?.name || '',
    store_logo_url: store?.logo_url || '',
    // Handlers
    setCurrentLanguage,
    setSelectedCountry,
    setMobileMenuOpen,
    setMobileSearchOpen,
    handleCustomerLogout,
    navigate,
    location,
  };
}

// =============================================================================
// GENERIC DATA PREPROCESSING
// =============================================================================

/**
 * Preprocess generic page data (checkout, success, account, login)
 */
function preprocessGenericData(rawData, baseContext) {
  return {
    ...baseContext,
    ...rawData,
  };
}

// =============================================================================
// TEMPLATE VARIABLE PROCESSING
// =============================================================================

/**
 * Process template variables in a string
 * Extracted from HeaderSlotRenderer lines 81-108
 *
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {Object} context - Variable context from preprocessSlotData
 * @returns {string} Processed string with variables replaced
 */
export function processTemplateVariables(template, context) {
  if (!template) return '';

  let processed = template;

  // Replace store variables
  if (context.store) {
    processed = processed.replace(/\{\{store\.name\}\}/g, context.store.name || '');
    processed = processed.replace(/\{\{store\.logo_url\}\}/g, context.store.logo_url || '');
    processed = processed.replace(/\{\{store\.url\}\}/g, context.store_url || '');
  }

  // Replace user variables
  if (context.user) {
    processed = processed.replace(/\{\{user\.name\}\}/g, context.user_name || '');
    processed = processed.replace(/\{\{user\.email\}\}/g, context.user_email || '');
  }

  // Replace settings.theme variables
  if (context.settings?.theme) {
    Object.keys(context.settings.theme).forEach(key => {
      const regex = new RegExp(`\\{\\{settings\\.theme\\.${key}\\}\\}`, 'g');
      processed = processed.replace(regex, context.settings.theme[key] || '');
    });
  }

  // Replace product variables (for product pages)
  if (context.product) {
    processed = processed.replace(/\{\{product\.name\}\}/g, context.product.name || '');
    processed = processed.replace(/\{\{product\.price_formatted\}\}/g, context.product.price_formatted || '');
    processed = processed.replace(/\{\{product\.compare_price_formatted\}\}/g, context.product.compare_price_formatted || '');
    processed = processed.replace(/\{\{product\.stock_label\}\}/g, context.product.stock_label || '');
  }

  // Replace category variables
  if (context.category) {
    processed = processed.replace(/\{\{category\.name\}\}/g, context.category.name || '');
  }

  // Replace cart variables
  if (context.subtotal_formatted !== undefined) {
    processed = processed.replace(/\{\{cart\.subtotal\}\}/g, context.subtotal_formatted || '');
    processed = processed.replace(/\{\{cart\.total\}\}/g, context.total_formatted || '');
    processed = processed.replace(/\{\{cart\.tax\}\}/g, context.tax_formatted || '');
    processed = processed.replace(/\{\{cart\.discount\}\}/g, context.discount_formatted || '');
  }

  return processed;
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  formatProducts,
  formatFiltersData,
  getCartItemImageUrl,
  enrichSettings,
};
