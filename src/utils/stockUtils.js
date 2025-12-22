/**
 * stockUtils.js - Centralized Stock Management & Validation
 *
 * =====================================================================
 * PURPOSE: Single source of truth for stock label text, colors,
 * visibility, and stock validation across all product displays
 * =====================================================================
 *
 * ARCHITECTURE ROLE:
 *
 * Stock utilities provide **unified stock status display and validation** for:
 * 1. Category product grids
 * 2. Product detail pages
 * 3. Cart items
 * 4. Editor previews
 * 5. Template variable processing
 *
 * DATA FLOW:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Component (Category, Product, Cart, etc.)                   │
 * │ - Has product object with stock_quantity, infinite_stock    │
 * │ - Has settings object with stock_settings from admin        │
 * └────────────────────┬────────────────────────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │ stockLabelUtils (THIS FILE)                                 │
 * │ 1. Check if stock labels should be shown                    │
 * │ 2. Determine stock status:                                  │
 * │    - Infinite stock → In Stock (no quantity)               │
 * │    - stock_quantity <= 0 → Out of Stock                    │
 * │    - stock_quantity <= threshold → Low Stock + quantity    │
 * │    - Otherwise → In Stock + quantity (if not hidden)       │
 * │ 3. Return { text, textColor, bgColor }                     │
 * └─────────────────────┬────────────────────────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Component renders: <Badge style={{...}}>{{text}}</Badge>   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * STOCK STATES:
 *
 * **Infinite Stock**:
 * - product.infinite_stock === true
 * - Shows: settings.stock_settings.in_stock_label
 * - Colors: in_stock_text_color, in_stock_bg_color
 * - Quantity blocks removed: "{only {quantity} left}" → ""
 *
 * **Out of Stock**:
 * - product.stock_quantity <= 0
 * - Shows: settings.stock_settings.out_of_stock_label
 * - Colors: out_of_stock_text_color, out_of_stock_bg_color
 *
 * **Low Stock**:
 * - product.stock_quantity <= lowStockThreshold
 * - Shows: settings.stock_settings.low_stock_label
 * - Colors: low_stock_text_color, low_stock_bg_color
 * - Processes quantity: "{only {quantity} left}" → "only 3 left"
 *
 * **In Stock**:
 * - product.stock_quantity > lowStockThreshold
 * - Shows: settings.stock_settings.in_stock_label
 * - Colors: in_stock_text_color, in_stock_bg_color
 * - Processes quantity if not hidden
 *
 * QUANTITY PLACEHOLDERS:
 *
 * Labels support flexible quantity formatting:
 * - {quantity} → Replaced with actual quantity
 * - {item} → "item" (singular) or "items" (plural)
 * - {unit} → "unit" (singular) or "units" (plural)
 * - {piece} → "piece" (singular) or "pieces" (plural)
 *
 * Examples:
 * - "{only {quantity} {item} left}" + quantity=3 → "only 3 items left"
 * - "{only {quantity} {item} left}" + quantity=1 → "only 1 item left"
 * - "{In Stock, {quantity} available}" + quantity=50 → "In Stock, 50 available"
 *
 * QUANTITY HIDING:
 *
 * If settings.hide_stock_quantity === true OR quantity === null:
 * - All blocks containing {quantity} are removed
 * - "{In Stock, {only {quantity} left}}" → "In Stock"
 *
 * ADMIN SETTINGS:
 *
 * Configured in Admin → Catalog → Stock Settings:
 * - show_stock_label: Boolean - Show/hide all stock labels
 * - in_stock_label: String - Text for in stock (default: "In Stock")
 * - out_of_stock_label: String - Text for out of stock (default: "Out of Stock")
 * - low_stock_label: String - Text for low stock (default: "Only {quantity} left!")
 * - in_stock_text_color: Hex color
 * - in_stock_bg_color: Hex color
 * - out_of_stock_text_color: Hex color
 * - out_of_stock_bg_color: Hex color
 * - low_stock_text_color: Hex color
 * - low_stock_bg_color: Hex color
 *
 * USAGE EXAMPLES:
 *
 * ```javascript
 * // Get label with colors
 * const label = getStockLabel(product, settings);
 * if (label) {
 *   <Badge style={{ backgroundColor: label.bgColor, color: label.textColor }}>
 *     {label.text}
 *   </Badge>
 * }
 *
 * // Get just the inline styles
 * const styles = getStockLabelStyle(product, settings);
 * <span style={styles}>{getStockLabel(product, settings)?.text}</span>
 *
 * // Get Tailwind classes
 * const classes = getStockLabelClass(product, settings);
 * <span className={classes} style={getStockLabelStyle(product, settings)}>
 *   {getStockLabel(product, settings)?.text}
 * </span>
 * ```
 *
 * RELATED FILES:
 * - CategorySlotRenderer.jsx: Uses getStockLabel() to format products
 * - variableProcessor.js: Uses getStockLabel() for {{product.stock_status}}
 * - CustomOptions.jsx: Could use getStockLabel() for option products
 * - Admin/StockSettings.jsx: Configures stock label settings
 *
 * CRITICAL PATTERNS:
 *
 * 1. **Always check return value**: getStockLabel() returns null if labels disabled
 *
 * 2. **Use centralized utility everywhere**: Don't implement stock label logic elsewhere
 *
 * 3. **Respect admin settings**: All text and colors come from settings object
 *
 * 4. **Process quantity placeholders**: Use processLabel() for flexible formatting
 *
 * @module stockUtils
 */

/**
 * getStockLabel - Get stock label text and colors
 *
 * Main function for determining stock status display. Checks stock quantity,
 * infinite_stock flag, and low stock threshold to determine appropriate label.
 * Processes quantity placeholders and respects admin settings.
 *
 * @param {Object} product - Product object
 * @param {boolean} product.infinite_stock - True if product has infinite stock
 * @param {number} product.stock_quantity - Current stock quantity
 * @param {number} [product.low_stock_threshold] - Custom low stock threshold for this product
 * @param {Object} settings - Store settings
 * @param {Object} settings.stock_settings - Stock label settings from admin
 * @param {boolean} settings.stock_settings.show_stock_label - Show/hide stock labels globally
 * @param {string} settings.stock_settings.in_stock_label - In stock label text (fallback)
 * @param {string} settings.stock_settings.out_of_stock_label - Out of stock label text (fallback)
 * @param {string} settings.stock_settings.low_stock_label - Low stock label text (fallback)
 * @param {string} settings.stock_settings.in_stock_text_color - In stock text color (hex)
 * @param {string} settings.stock_settings.in_stock_bg_color - In stock background color (hex)
 * @param {string} settings.stock_settings.out_of_stock_text_color - Out of stock text color
 * @param {string} settings.stock_settings.out_of_stock_bg_color - Out of stock background color
 * @param {string} settings.stock_settings.low_stock_text_color - Low stock text color
 * @param {string} settings.stock_settings.low_stock_bg_color - Low stock background color
 * @param {boolean} [settings.hide_stock_quantity] - Hide quantity numbers in labels
 * @param {number} [settings.display_low_stock_threshold] - Default low stock threshold
 * @param {string} [lang] - Language code (default: current browser language)
 * @param {Object} [globalTranslations] - Global translations object from TranslationContext (preferred)
 * @returns {Object|null} { text: string, textColor: string, bgColor: string } or null if disabled
 *
 * @example
 * // Infinite stock
 * getStockLabel({ infinite_stock: true }, settings, null, translations)
 * // { text: "In Stock", textColor: "#22c55e", bgColor: "#dcfce7" }
 *
 * @example
 * // Low stock with quantity
 * getStockLabel({ stock_quantity: 3, low_stock_threshold: 5 }, settings, null, translations)
 * // { text: "Only 3 left!", textColor: "#f59e0b", bgColor: "#fef3c7" }
 *
 * @example
 * // Out of stock
 * getStockLabel({ stock_quantity: 0 }, settings, null, translations)
 * // { text: "Out of Stock", textColor: "#ef4444", bgColor: "#fee2e2" }
 */
export function getStockLabel(product, settings = {}, lang = null, globalTranslations = null) {
  // Check if stock labels should be shown at all
  // Check both top-level path (from ThemeLayout) and nested path (from StockSettings) for backwards compatibility
  const showStockLabel = settings?.show_stock_label !== undefined
    ? settings.show_stock_label
    : (settings?.stock_settings?.show_stock_label !== false);
  if (!showStockLabel) return null;

  if (!product) return null;

  // For configurable products, don't show stock label until a variant is selected
  // The parent configurable product typically has stock_quantity: 0 since it's not sold directly
  if (product.type === 'configurable') {
    return null;
  }

  // Get current language if not provided
  if (!lang) {
    lang = typeof localStorage !== 'undefined'
      ? localStorage.getItem('daino_language') || 'en'
      : 'en';
  }

  // Stock settings are required - no fallbacks needed as StockSettings.jsx handles defaults
  const stockSettings = settings?.stock_settings || {};

  // Helper function to get translated label from translations table only
  const getTranslatedLabel = (labelField) => {
    // Use global translations table - no fallback
    if (globalTranslations && globalTranslations.stock && globalTranslations.stock[labelField]) {
      return globalTranslations.stock[labelField];
    }

    // No translation found
    return 'No Stock Label';
  };

  // Default colors - same as StockSettings.jsx defaults
  const defaultColors = {
    in_stock_text_color: '#166534',
    in_stock_bg_color: '#dcfce7',
    out_of_stock_text_color: '#991b1b',
    out_of_stock_bg_color: '#fee2e2',
    low_stock_text_color: '#92400e',
    low_stock_bg_color: '#fef3c7'
  };

  // Handle infinite stock
  if (product.infinite_stock) {
    const label = getTranslatedLabel('in_stock_label');
    const text = processLabel(label, null, settings, globalTranslations); // Remove quantity blocks
    const textColor = stockSettings.in_stock_text_color || defaultColors.in_stock_text_color;
    const bgColor = stockSettings.in_stock_bg_color || defaultColors.in_stock_bg_color;

    return { text, textColor, bgColor };
  }

  // Handle out of stock
  if (product.stock_quantity <= 0) {
    const text = getTranslatedLabel('out_of_stock_label');
    const textColor = stockSettings.out_of_stock_text_color || defaultColors.out_of_stock_text_color;
    const bgColor = stockSettings.out_of_stock_bg_color || defaultColors.out_of_stock_bg_color;

    return { text, textColor, bgColor };
  }

  // Check if stock quantity should be hidden
  const hideStockQuantity = settings?.hide_stock_quantity === true;

  // Handle low stock
  const lowStockThreshold = product.low_stock_threshold || settings?.display_low_stock_threshold || 0;
  if (lowStockThreshold > 0 && product.stock_quantity <= lowStockThreshold) {
    const label = getTranslatedLabel('low_stock_label');
    const text = processLabel(label, hideStockQuantity ? null : product.stock_quantity, settings, globalTranslations);
    const textColor = stockSettings.low_stock_text_color || defaultColors.low_stock_text_color;
    const bgColor = stockSettings.low_stock_bg_color || defaultColors.low_stock_bg_color;

    return { text, textColor, bgColor };
  }

  // Handle regular in stock
  const label = getTranslatedLabel('in_stock_label');
  const text = processLabel(label, hideStockQuantity ? null : product.stock_quantity, settings, globalTranslations);
  const textColor = stockSettings.in_stock_text_color || defaultColors.in_stock_text_color;
  const bgColor = stockSettings.in_stock_bg_color || defaultColors.in_stock_bg_color;

  return { text, textColor, bgColor };
}

/**
 * processLabel - Process label template with quantity placeholders
 *
 * Handles nested braces and multiple placeholder types.
 * Removes blocks containing {quantity} when quantity is null or hidden.
 *
 * Supported placeholders:
 * - {quantity} → Actual quantity number
 * - {item} → Translatable singular/plural from common.item/common.items
 * - {unit} → Translatable singular/plural from common.unit/common.units
 * - {piece} → Translatable singular/plural from common.piece/common.pieces
 *
 * @param {string} label - Label template with {placeholders}
 * @param {number|null} quantity - Stock quantity (null removes quantity blocks)
 * @param {Object} settings - Store settings (currently unused, reserved for future)
 * @param {Object} globalTranslations - Global translations object from TranslationContext
 * @returns {string} Processed label text
 *
 * @example
 * processLabel("In Stock, {only {quantity} {item} left}", 3, settings, translations)
 * // "In Stock, only 3 items left" (or translated equivalent)
 *
 * @example
 * processLabel("In Stock, {only {quantity} {item} left}", 1, settings, translations)
 * // "In Stock, only 1 item left" (or translated equivalent)
 *
 * @example
 * processLabel("In Stock, {only {quantity} {item} left}", null, settings, translations)
 * // "In Stock"
 * @private
 */
function processLabel(label, quantity, settings, globalTranslations = null) {
  if (!label) return '';

  let processedLabel = label;

  // Helper to get translated plural forms
  const getPlural = (singular, plural) => {
    if (globalTranslations && globalTranslations.common) {
      const singularText = globalTranslations.common[singular];
      const pluralText = globalTranslations.common[plural];

      if (singularText && pluralText) {
        return quantity === 1 ? singularText : pluralText;
      }
    }

    // Fallback to English
    const fallbacks = {
      'item': quantity === 1 ? 'item' : 'items',
      'unit': quantity === 1 ? 'unit' : 'units',
      'piece': quantity === 1 ? 'piece' : 'pieces'
    };
    return fallbacks[singular] || '';
  };

  // If quantity is null (infinite stock or hidden), remove all blocks containing {quantity} or {item}
  if (quantity === null) {
    // Use a similar approach to the main loop to properly handle nested braces
    let cleanedLabel = processedLabel;
    let previousLabel;
    let iterations = 0;
    const maxIterations = 10;

    do {
      previousLabel = cleanedLabel;
      let depth = 0;
      let start = -1;
      let toRemove = [];

      // Find all blocks that contain {quantity} or {item}/{unit}/{piece}
      for (let i = 0; i < cleanedLabel.length; i++) {
        if (cleanedLabel[i] === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (cleanedLabel[i] === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            const content = cleanedLabel.substring(start + 1, i);
            // If this block contains quantity-related placeholders, mark for removal
            if (/\{quantity\}|\{item\}|\{unit\}|\{piece\}/gi.test(content)) {
              toRemove.push({ start, end: i });
            }
            start = -1;
          }
        }
      }

      // Remove blocks in reverse order to maintain indices
      for (let j = toRemove.length - 1; j >= 0; j--) {
        const { start, end } = toRemove[j];
        cleanedLabel = cleanedLabel.substring(0, start) + cleanedLabel.substring(end + 1);
      }

      // Also remove any standalone placeholders
      cleanedLabel = cleanedLabel
        .replace(/\{quantity\}/gi, '')
        .replace(/\{item\}/gi, '')
        .replace(/\{items\}/gi, '')
        .replace(/\{unit\}/gi, '')
        .replace(/\{units\}/gi, '')
        .replace(/\{piece\}/gi, '')
        .replace(/\{pieces\}/gi, '');

      iterations++;
    } while (cleanedLabel !== previousLabel && iterations < maxIterations);

    return cleanedLabel
      .replace(/\s+/g, ' ')
      .replace(/,\s*$/, '')
      .trim();
  }

  // Recursively process nested braces until no more changes occur
  // This handles multiple levels of nesting like {, {nog maar {quantity} {item} over}}
  let previousLabel;
  let iterations = 0;
  const maxIterations = 10; // Prevent infinite loops

  do {
    previousLabel = processedLabel;

    // Process nested braces by finding outer {...} blocks first
    // BUT skip single-level placeholders (they'll be handled later)
    let depth = 0;
    let start = -1;
    const knownPlaceholders = ['quantity', 'item', 'unit', 'piece', 'items', 'units', 'pieces'];

    for (let i = 0; i < processedLabel.length; i++) {
      if (processedLabel[i] === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (processedLabel[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          const content = processedLabel.substring(start + 1, i);

          // Check if this is a single placeholder (not a nested block)
          const isSinglePlaceholder = knownPlaceholders.some(p => content.toLowerCase() === p);

          // Process nested blocks (contains inner braces) OR unwrap arbitrary wrapper braces
          if (!isSinglePlaceholder) {
            if (content.includes('{')) {
              // Has nested braces - process inner placeholders
              const processed = content
                .replace(/\{quantity\}/gi, quantity)
                .replace(/\{item\}/gi, getPlural('item', 'items'))
                .replace(/\{unit\}/gi, getPlural('unit', 'units'))
                .replace(/\{piece\}/gi, getPlural('piece', 'pieces'));

              processedLabel = processedLabel.substring(0, start) + processed + processedLabel.substring(i + 1);
              i = start + processed.length - 1;
            } else {
              // No nested braces - unwrap arbitrary wrapper (e.g., {nog maar 3 items over})
              processedLabel = processedLabel.substring(0, start) + content + processedLabel.substring(i + 1);
              i = start + content.length - 1;
            }
          }
          start = -1;
        }
      }
    }

    // Now replace all standalone placeholders
    processedLabel = processedLabel
      .replace(/\{quantity\}/gi, quantity)
      .replace(/\{item\}/gi, getPlural('item', 'items'))
      .replace(/\{unit\}/gi, getPlural('unit', 'units'))
      .replace(/\{piece\}/gi, getPlural('piece', 'pieces'));

    iterations++;
  } while (processedLabel !== previousLabel && iterations < maxIterations);

  return processedLabel;
}

/**
 * getStockLabelClass - Get Tailwind CSS classes for stock label
 *
 * Returns base Tailwind classes for stock label styling. Use with
 * getStockLabelStyle() for custom colors from admin settings.
 *
 * @param {Object} product - Product object
 * @param {Object} settings - Store settings
 * @returns {string} Tailwind CSS class string
 *
 * @example
 * const classes = getStockLabelClass(product, settings);
 * const styles = getStockLabelStyle(product, settings);
 * <span className={classes} style={styles}>
 *   {getStockLabel(product, settings)?.text}
 * </span>
 */
export function getStockLabelClass(product, settings = {}) {
  const stockLabel = getStockLabel(product, settings);
  if (!stockLabel) return '';

  // Return inline style object instead of classes for custom colors
  return `inline-flex items-center px-2 py-1 rounded-full text-xs`;
}

/**
 * getStockLabelStyle - Get inline styles for stock label
 *
 * Returns object with backgroundColor and color properties based on
 * stock status and admin-configured colors. Use with JSX style prop.
 *
 * @param {Object} product - Product object
 * @param {Object} settings - Store settings with stock_settings
 * @param {string} [lang] - Language code (default: current browser language)
 * @param {Object} [globalTranslations] - Global translations object from TranslationContext
 * @returns {Object} Style object { backgroundColor: string, color: string }
 *
 * @example
 * // In Stock
 * getStockLabelStyle({ stock_quantity: 50 }, settings, null, translations)
 * // { backgroundColor: "#dcfce7", color: "#22c55e" }
 *
 * @example
 * // Low Stock
 * getStockLabelStyle({ stock_quantity: 3, low_stock_threshold: 5 }, settings, null, translations)
 * // { backgroundColor: "#fef3c7", color: "#f59e0b" }
 *
 * @example
 * // Out of Stock
 * getStockLabelStyle({ stock_quantity: 0 }, settings, null, translations)
 * // { backgroundColor: "#fee2e2", color: "#ef4444" }
 *
 * @example
 * // Usage in component
 * <Badge style={getStockLabelStyle(product, settings, null, translations)}>
 *   {getStockLabel(product, settings, null, translations)?.text}
 * </Badge>
 */
export function getStockLabelStyle(product, settings = {}, lang = null, globalTranslations = null) {
  const stockLabel = getStockLabel(product, settings, lang, globalTranslations);
  if (!stockLabel) return {};

  return {
    backgroundColor: stockLabel.bgColor,
    color: stockLabel.textColor
  };
}

/**
 * isProductOutOfStock - Check if a product is out of stock
 *
 * Centralized logic for determining if a product can be purchased.
 * Considers infinite_stock, manage_stock, allow_backorders, and stock_quantity.
 *
 * @param {Object} product - Product object
 * @param {boolean} product.infinite_stock - True if product has unlimited stock
 * @param {boolean} product.manage_stock - True if stock should be tracked
 * @param {boolean} product.allow_backorders - True if purchases allowed when out of stock
 * @param {number} product.stock_quantity - Current stock quantity
 * @returns {boolean} True if product is out of stock and cannot be purchased
 *
 * @example
 * isProductOutOfStock({ stock_quantity: 0, manage_stock: true, allow_backorders: false })
 * // true - out of stock, no backorders allowed
 *
 * @example
 * isProductOutOfStock({ stock_quantity: 0, manage_stock: true, allow_backorders: true })
 * // false - out of stock but backorders allowed
 *
 * @example
 * isProductOutOfStock({ infinite_stock: true })
 * // false - never out of stock
 */
export function isProductOutOfStock(product) {
  if (!product) return true;

  // Infinite stock products are never out of stock
  if (product.infinite_stock) return false;

  // If not managing stock, never out of stock
  if (!product.manage_stock) return false;

  // Check if stock is depleted
  if (product.stock_quantity <= 0) {
    // Allow if backorders are enabled
    return !product.allow_backorders;
  }

  return false;
}

/**
 * getAvailableQuantity - Get maximum purchasable quantity for a product
 *
 * Returns Infinity for infinite stock, not managing stock, or backorders allowed.
 * Otherwise returns actual stock quantity.
 *
 * @param {Object} product - Product object
 * @param {boolean} product.infinite_stock - True if product has unlimited stock
 * @param {boolean} product.manage_stock - True if stock should be tracked
 * @param {boolean} product.allow_backorders - True if purchases allowed when out of stock
 * @param {number} product.stock_quantity - Current stock quantity
 * @returns {number} Maximum quantity available (Infinity or actual quantity)
 *
 * @example
 * getAvailableQuantity({ infinite_stock: true })
 * // Infinity
 *
 * @example
 * getAvailableQuantity({ stock_quantity: 5, manage_stock: true })
 * // 5
 */
export function getAvailableQuantity(product) {
  if (!product) return 0;

  // Infinite stock
  if (product.infinite_stock) return Infinity;

  // Not managing stock
  if (!product.manage_stock) return Infinity;

  // Allow backorders
  if (product.allow_backorders) return Infinity;

  // Return actual stock
  return Math.max(0, product.stock_quantity);
}

export default {
  getStockLabel,
  getStockLabelClass,
  getStockLabelStyle,
  isProductOutOfStock,
  getAvailableQuantity
};
