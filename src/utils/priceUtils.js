// Utility functions for safe price formatting and calculations

// Store context - will be set by useStore hook
let _storeContext = null;

/**
 * Internal function to set store context
 * This should be called by a React component using useStore()
 * @param {Object} context - The store context from useStore()
 */
export const _setStoreContext = (context) => {
    _storeContext = context;
};

/**
 * Internal function to get store context
 * @returns {Object} - The store context
 */
const _getStoreContext = () => {
    if (!_storeContext) {
        console.error('❌ Price utils: Store context not initialized! Make sure PriceUtilsProvider wraps your app.');
        return null;
    }
    return _storeContext;
};

/**
 * Safely converts a value to a number, returning 0 if invalid
 * @param {any} value - The value to convert
 * @returns {number} - The parsed number or 0
 */
export const safeNumber = (value) => {
    // Handle null, undefined, empty string, or invalid types
    if (value === null || value === undefined || value === '' || typeof value === 'object') {
        return 0;
    }
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
};

/**
 * Format price with currency symbol (CONTEXT-AWARE)
 * Automatically gets currency symbol from store context
 * @param {any} value - The price value
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted price with currency symbol (e.g., "¥1,234.56")
 */
export const formatPrice = (value, decimals = 2) => {
    const context = _getStoreContext();
    const num = safeNumber(value);

    if (!context) {
        // Return formatted number without symbol as fallback during initial load
        console.warn('⚠️ formatPrice: Store context not yet available, returning price without symbol');
        return num.toFixed(decimals);
    }

    const symbol = context.settings?.currency_symbol;

    if (!symbol) {
        // Return formatted number without symbol as fallback
        console.warn('⚠️ formatPrice: currency_symbol not found in store context');
        return num.toFixed(decimals);
    }

    return `${symbol}${num.toFixed(decimals)}`;
};

/**
 * Format price number without currency symbol
 * Use this when you need to conditionally show/hide currency symbol
 * @param {number|string} value - Price value to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted price number without currency symbol (e.g., "885.95")
 */
export const formatPriceNumber = (value, decimals = 2) => {
    const num = safeNumber(value);
    return num.toFixed(decimals);
};

/**
 * Calculates total price for an item including options
 * @param {Object} item - Cart item
 * @param {Object} product - Product details
 * @returns {number} - Total price for the item
 */
export const calculateItemTotal = (item, product) => {
    if (!item || !product) return 0;

    let basePrice = safeNumber(item.price);
    if (basePrice <= 0) {
        basePrice = safeNumber(product.sale_price || product.price);
    }

    let optionsPrice = 0;
    if (item.selected_options && Array.isArray(item.selected_options)) {
        optionsPrice = item.selected_options.reduce((sum, option) => sum + safeNumber(option.price), 0);
    }

    return (basePrice + optionsPrice) * (safeNumber(item.quantity) || 1);
};

/**
 * Calculates display price considering tax-inclusive settings (CONTEXT-AWARE)
 * Automatically gets store and selectedCountry from context
 * @param {number} basePrice - The base price of the product
 * @param {Array} taxRules - Tax rules (optional, defaults to context taxes)
 * @param {string} country - Country code (optional, defaults to context selectedCountry)
 * @returns {number} - Price adjusted for tax-inclusive display
 */
export const calculateDisplayPrice = (basePrice, taxRules = null, country = null) => {
    const price = safeNumber(basePrice);
    if (price <= 0) {
        return 0;
    }

    const context = _getStoreContext();
    if (!context) {
        // Return base price as fallback during initial load
        console.warn('⚠️ calculateDisplayPrice: Store context not yet available, returning base price');
        return price;
    }

    // Get from context
    const store = context.store;
    const contextTaxes = context.taxes || [];
    const contextCountry = context.selectedCountry || 'US';

    // Use provided values or fall back to context
    const finalTaxRules = taxRules !== null ? taxRules : contextTaxes;
    const finalCountry = country !== null ? country : contextCountry;

    // Handle missing store or settings gracefully
    const settings = store?.settings || {};
    const displayTaxInclusive = settings.display_tax_inclusive_prices || false;
    const defaultTaxIncludedInPrices = settings.default_tax_included_in_prices || false;

    // If tax display setting is same as input setting, no calculation needed
    if (displayTaxInclusive === defaultTaxIncludedInPrices) {
        return price;
    }

    // Handle missing or invalid tax rules
    if (!Array.isArray(finalTaxRules)) {
        return price;
    }

    // Find applicable tax rate
    const taxRate = getApplicableTaxRate(finalTaxRules, finalCountry);

    if (taxRate === 0) {
        return price;
    }

    let calculatedPrice = price;

    if (displayTaxInclusive && !defaultTaxIncludedInPrices) {
        // Show tax-inclusive price when products don't include tax
        calculatedPrice = price * (1 + taxRate / 100);
    } else if (!displayTaxInclusive && defaultTaxIncludedInPrices) {
        // Show tax-exclusive price when products include tax
        calculatedPrice = price / (1 + taxRate / 100);
    }

    return calculatedPrice;
};

/**
 * Get applicable tax rate for a country
 * @param {Array} taxRules - Array of tax rules
 * @param {string} country - Country code
 * @returns {number} - Tax rate percentage
 */
export const getApplicableTaxRate = (taxRules, country = 'US') => {
    if (!taxRules || taxRules.length === 0) {
        return 0;
    }

    // Find rules with country rates
    const rulesWithCountry = taxRules.filter(rule =>
        rule.is_active &&
        rule.country_rates &&
        rule.country_rates.some(rate =>
            rate.country && rate.country.toUpperCase() === country.toUpperCase()
        )
    );

    if (rulesWithCountry.length > 0) {
        const rule = rulesWithCountry.find(r => r.is_default) || rulesWithCountry[0];

        const countryRate = rule.country_rates.find(rate =>
            rate.country && rate.country.toUpperCase() === country.toUpperCase()
        );

        const rate = parseFloat(countryRate?.rate) || 0;
        return rate;
    }

    // Fallback to default rule
    const defaultRule = taxRules.find(rule => rule.is_default && rule.is_active);

    if (defaultRule && defaultRule.country_rates) {
        const usRate = defaultRule.country_rates.find(rate =>
            rate.country && rate.country.toUpperCase() === 'US'
        );
        const rate = parseFloat(usRate?.rate) || 0;
        return rate;
    }

    return 0;
};

/**
 * Format price with tax consideration for display (CONTEXT-AWARE)
 * Automatically gets currency symbol, store, taxes, and country from context
 * @param {number} basePrice - Base price
 * @param {Array} taxRules - Tax rules (optional, defaults to context taxes)
 * @param {string} country - Country code (optional, defaults to context selectedCountry)
 * @returns {string} - Formatted price string with currency and tax adjustment
 */
export const formatPriceWithTax = (basePrice, taxRules = null, country = null) => {
    const displayPrice = calculateDisplayPrice(basePrice, taxRules, country);
    return formatPrice(displayPrice);
};

/**
 * Get price display information for products with compare_price
 * Returns the display price (lowest) and original price (highest) for proper rendering
 *
 * @param {Object} product - Product object with price and compare_price
 * @returns {Object} - { hasComparePrice, displayPrice, originalPrice, isSale }
 *
 * @example
 * const priceInfo = getPriceDisplay({ price: 1349, compare_price: 1049 });
 * // Returns: { hasComparePrice: true, displayPrice: 1049, originalPrice: 1349, isSale: true }
 */
export const getPriceDisplay = (product) => {
    if (!product) {
        return {
            hasComparePrice: false,
            displayPrice: 0,
            originalPrice: null,
            isSale: false
        };
    }

    const price = safeNumber(product.price);
    const comparePrice = safeNumber(product.compare_price);

    // Check if compare_price is valid and different from price
    const hasComparePrice = comparePrice > 0 && comparePrice !== price;

    if (!hasComparePrice) {
        return {
            hasComparePrice: false,
            displayPrice: price,
            originalPrice: null,
            isSale: false
        };
    }

    // Return lowest as display price, highest as original price
    return {
        hasComparePrice: true,
        displayPrice: Math.min(price, comparePrice),
        originalPrice: Math.max(price, comparePrice),
        isSale: true
    };
};
