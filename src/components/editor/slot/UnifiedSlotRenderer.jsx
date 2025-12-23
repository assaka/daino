/**
 * UnifiedSlotRenderer.jsx - Universal Slot Rendering Engine
 *
 * =====================================================================
 * PURPOSE: Single rendering engine for ALL slot-based UI in both
 * editor and storefront contexts
 * =====================================================================
 *
 * ARCHITECTURE ROLE:
 *
 * UnifiedSlotRenderer is the **universal rendering engine** that handles:
 * 1. Type-based rendering (text, button, image, component, container, grid, flex, html, cms)
 * 2. Dual-mode support (editor vs storefront)
 * 3. Variable processing ({{product.name}}, {{settings.currency}})
 * 4. Component registry integration
 * 5. Responsive layout (grid/flex/tailwind)
 * 6. Interactive editing (resize, drag, click)
 * 7. Script execution (for dynamic behavior)
 *
 * DATA FLOW:
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Page Component (Product, Category, Cart, Header, etc.)     │
 * │ - Loads slot configuration from database/template           │
 * │ - Prepares data context (product, category, cart, etc.)    │
 * └────────────────────┬────────────────────────────────────────┘
 *                      │
 *                      ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │ UnifiedSlotRenderer (THIS FILE)                             │
 * │ 1. Receives slots tree + data context                       │
 * │ 2. Filters slots by viewMode (emptyCart, withProducts)     │
 * │ 3. Processes variables {{}} in content/className/styles     │
 * │ 4. Renders each slot based on type:                        │
 * │    - text → TextSlotWithScript                             │
 * │    - button → Button component with handlers               │
 * │    - image → img or Link wrapped img                       │
 * │    - component → ComponentRegistry lookup + render         │
 * │    - container/grid/flex → recursive render children       │
 * │ 5. Wraps with editor functionality if context='editor'     │
 * └─────────────────────────────────────────────────────────────┘
 *
 * DUAL-MODE RENDERING:
 *
 * **Editor Mode** (context='editor'):
 * - Wraps elements with ResizeWrapper for visual resizing
 * - Adds GridColumn wrapper for drag & drop editing
 * - Shows borders and interactive controls
 * - Uses demo/placeholder data for preview
 * - onClick handlers for element selection
 *
 * **Storefront Mode** (context='storefront'):
 * - No wrappers or borders - clean output
 * - Real data from API/database
 * - Full interactive functionality (add to cart, links, scripts)
 * - Executes slot.script for dynamic behavior
 *
 * VARIABLE PROCESSING:
 *
 * Variables in slot content/className/styles are replaced with real data:
 * - {{product.name}} → "Samsung RS66A8101B1"
 * - {{product.price_formatted}} → "¥1049.00"
 * - {{settings.currency_symbol}} → "¥"
 *
 * Variable sources (variableContext):
 * - product: Single product data
 * - products: Array of products (for category pages)
 * - category: Category metadata
 * - cart: Cart data
 * - settings: Store settings (currency, theme colors, etc.)
 * - filters: Active filters (for category filtering UI)
 *
 * COMPONENT REGISTRY:
 *
 * Complex components (ProductGallerySlot, CategoryFilterSlot, etc.) are:
 * 1. Registered in SlotComponentRegistry
 * 2. Looked up by name when slot.type === 'component'
 * 3. Rendered via component.render() method
 *
 * TYPE-BASED RENDERING:
 *
 * Each slot type has specific rendering logic:
 * - **text**: Renders as HTML with variable processing, supports custom HTML tags
 * - **html**: Same as text but always uses dangerouslySetInnerHTML
 * - **button**: Interactive button with add-to-cart/wishlist/logout handlers
 * - **image**: img tag with optional Link wrapper for product cards
 * - **component**: Looks up in ComponentRegistry and calls render()
 * - **container/grid/flex**: Recursively renders children with layout classes
 * - **cms**: Loads CMS block content from database by position
 * - **style_config**: Hidden (used for storing filter styles, etc.)
 *
 * RESPONSIVE LAYOUT:
 *
 * Slots use colSpan for grid positioning:
 * - Number: col-span-6 (static)
 * - String: "col-span-12 md:col-span-6" (Tailwind responsive)
 * - Object: { default: 12, withProducts: 6 } (viewMode-based)
 *
 * Editor viewport modes (desktop/tablet/mobile) transform responsive classes:
 * - md:hidden in mobile viewport → remove class (show element)
 * - md:hidden in desktop viewport → skip rendering (hide element)
 *
 * SCRIPT EXECUTION:
 *
 * Slots can have a `script` property for dynamic behavior:
 * - Named handlers: "priceFormatter" → executeHandler()
 * - Inline code: "element.classList.add('active')" → executeScript()
 * - Only executes in storefront mode for security
 * - Cleanup functions supported for proper unmounting
 *
 * RELATED FILES:
 * - SlotComponentRegistry.js: Component registration system
 * - variableProcessor.js: {{variable}} processing logic
 * - scriptHandler.js: Script execution utilities
 * - SlotComponents.jsx: GridColumn wrapper for editor drag/resize
 * - CategorySlotRenderer.jsx: Pre-processes category data before rendering
 * - ProductSlotRenderer.jsx: Pre-processes product data before rendering
 *
 * CRITICAL PATTERNS:
 *
 * 1. **Never re-format data here**: Data should be pre-formatted by parent renderers
 *    (CategorySlotRenderer, ProductSlotRenderer) using centralized utilities
 *
 * 2. **Respect pre-processed data**: Use formattedProducts from variableContext
 *    instead of re-calculating prices/labels
 *
 * 3. **Maintain dual-mode parity**: Same visual output in editor and storefront,
 *    only difference is interactive controls
 *
 * @module UnifiedSlotRenderer
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResizeWrapper } from '@/components/ui/resize-element-wrapper';
import { SlotManager } from '@/utils/slotUtils';
import { filterSlotsByViewMode, sortSlotsByGridCoordinates } from '@/hooks/useSlotConfiguration';
// @deprecated - EditorInteractionWrapper is not used in UnifiedSlotRenderer (dead import, can be removed)
// import EditorInteractionWrapper from '@/components/editor/EditorInteractionWrapper';
import { GridColumn } from '@/components/editor/slot/SlotComponents';
import { EditOverlay } from '@/components/editor/slot/EditOverlay';
import { processVariables, generateDemoData } from '@/utils/variableProcessor';
import { executeScript, executeHandler } from '@/utils/scriptHandler';
import { ComponentRegistry } from './SlotComponentRegistry';
import { createProductUrl, getStoreBaseUrl, createPublicUrl } from '@/utils/urlUtils';
import cartService from '@/services/cartService';
// Slot configurations come from database - renderConditions handled via slot metadata
import { CmsBlock } from '@/api/entities';
import { useStore } from '@/components/storefront/StoreProvider';
import { formatPrice, formatPriceNumber, safeNumber } from '@/utils/priceUtils';
import ProductLabelComponent, { renderLabelsGroupedByPosition } from '@/components/storefront/ProductLabel';
import { useTranslation } from '@/contexts/TranslationContext';

// Import component registry to ensure all components are registered
import '@/components/editor/slot/UnifiedSlotComponents';

// Re-export registry functions for backward compatibility
export { createSlotComponent, ComponentRegistry, registerSlotComponent } from './SlotComponentRegistry';

/**
 * Helper function to render product labels for a product
 * Used for rendering labels on product card images in category pages
 * All matching labels are shown in a flex container at top-left
 */
const renderProductLabels = (product, productLabels = []) => {
  if (!product || !productLabels || productLabels.length === 0) return null;

  // Filter labels that match the product conditions
  const matchingLabels = productLabels.filter((label) => {
    let shouldShow = true;
    const conditionsLength = label.conditions ? Object.keys(label.conditions).length : 0;

    if (label.conditions && conditionsLength > 0) {
      // Check product_ids condition
      if (shouldShow && label.conditions.product_ids && Array.isArray(label.conditions.product_ids) && label.conditions.product_ids.length > 0) {
        if (!label.conditions.product_ids.includes(product.id)) {
          shouldShow = false;
        }
      }

      // Check category_ids condition
      if (shouldShow && label.conditions.category_ids && Array.isArray(label.conditions.category_ids) && label.conditions.category_ids.length > 0) {
        if (!product.category_ids || !product.category_ids.some(catId => label.conditions.category_ids.includes(catId))) {
          shouldShow = false;
        }
      }

      // Check price conditions
      if (shouldShow && label.conditions.price_conditions) {
        const conditions = label.conditions.price_conditions;
        if (conditions.has_sale_price) {
          const hasComparePrice = product.compare_price && safeNumber(product.compare_price) > 0;
          const pricesAreDifferent = hasComparePrice && safeNumber(product.compare_price) !== safeNumber(product.price);
          if (!pricesAreDifferent) {
            shouldShow = false;
          }
        }
        if (shouldShow && conditions.is_new && conditions.days_since_created) {
          const productCreatedDate = new Date(product.created_date);
          const now = new Date();
          const daysSince = Math.floor((now.getTime() - productCreatedDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSince > conditions.days_since_created) {
            shouldShow = false;
          }
        }
      }

      // Check attribute conditions
      if (shouldShow && label.conditions.attribute_conditions && Array.isArray(label.conditions.attribute_conditions) && label.conditions.attribute_conditions.length > 0) {
        const attributeMatch = label.conditions.attribute_conditions.every(cond => {
          if (product.attributes && Array.isArray(product.attributes)) {
            const attr = product.attributes.find(a => a.code === cond.attribute_code);
            if (attr?.value) {
              return String(attr.value).toLowerCase() === String(cond.attribute_value).toLowerCase();
            }
          }
          return false;
        });
        if (!attributeMatch) {
          shouldShow = false;
        }
      }
    }
    return shouldShow;
  });

  if (matchingLabels.length === 0) return null;

  // Sort by sort_order then priority
  const sortedLabels = matchingLabels.sort((a, b) => {
    if ((a.sort_order || 0) !== (b.sort_order || 0)) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    }
    return (b.priority || 0) - (a.priority || 0);
  });

  // Render labels grouped by position (top-left labels together, top-right together, etc.)
  return renderLabelsGroupedByPosition(sortedLabels);
};

/**
 * CmsBlockSlot - Renders dynamic CMS block content from database
 *
 * Loads CMS blocks by placement/position (e.g., 'homepage_top', 'category_sidebar')
 * and renders the HTML content. Used for marketing banners, info blocks, etc.
 *
 * @param {Object} slot - Slot configuration
 * @param {string} slot.cmsBlockPosition - CMS block placement/position identifier
 * @param {string} context - 'editor' or 'storefront'
 * @param {string} className - CSS classes
 * @param {Object} styles - Inline styles
 */
const CmsBlockSlot = ({ slot, context, className, styles }) => {
  const [cmsContent, setCmsContent] = useState('');
  const [loading, setLoading] = useState(true);
  const { store } = useStore();

  useEffect(() => {
    const loadCmsBlock = async () => {
      if (!slot.cmsBlockPosition || !store?.id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch CMS blocks for this store and placement
        const blocks = await CmsBlock.filter({
          store_id: store.id,
          placement: slot.cmsBlockPosition,
          is_active: true
        });

        if (blocks && blocks.length > 0) {
          // Use the first active block for this position
          setCmsContent(blocks[0].content || '');
        }
      } catch (error) {
        console.error('Error loading CMS block:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCmsBlock();
  }, [slot.cmsBlockPosition, store?.id]);

  if (loading) {
    return context === 'editor' ? (
      <div className={`${className} p-4 border-2 border-dashed border-gray-300 rounded`} style={styles}>
        <p className="text-gray-500 text-sm">Loading CMS block...</p>
      </div>
    ) : null;
  }

  if (!cmsContent) {
    return context === 'editor' ? (
      <div className={`${className} p-4 border-2 border-dashed border-gray-300 rounded`} style={styles}>
        <p className="text-gray-500 text-sm">CMS Block: {slot.cmsBlockPosition}</p>
        <p className="text-gray-400 text-xs mt-1">No content assigned</p>
      </div>
    ) : null;
  }

  return (
    <div
      className={className}
      style={styles}
      dangerouslySetInnerHTML={{ __html: cmsContent }}
    />
  );
};

/**
 * TextSlotWithScript - Text/HTML slot with script execution support
 *
 * Renders text content with optional script execution for dynamic behavior.
 * Scripts only execute in storefront mode for security. Supports cleanup functions.
 *
 * Handles special cases:
 * - Price slots: Shows example prices in editor (e.g., $99.99)
 * - Label slots: Shows example labels in editor
 * - Conditional slots: Hidden when empty (no placeholder)
 *
 * @param {Object} slot - Slot configuration
 * @param {string} slot.id - Slot identifier (used for special handling)
 * @param {string|function} slot.script - Script to execute (code or handler name)
 * @param {Object} slot.metadata - Metadata (htmlTag, htmlAttributes, conditionalDisplay)
 * @param {string} processedContent - Content after variable processing
 * @param {string} processedClassName - className after variable processing
 * @param {string} context - 'editor' or 'storefront'
 * @param {Object} productData - Product context
 * @param {Object} variableContext - All variable data
 */
const TextSlotWithScript = ({ slot, processedContent, processedClassName, context, productData, variableContext }) => {
  const { id, styles } = slot;
  const elementRef = useRef(null);
  const cleanupRef = useRef(null);

  // Execute script after render (only in storefront)
  useEffect(() => {
    if (context !== 'storefront' || !slot.script) {
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    const scriptContext = {
      element,
      slotData: slot,
      productData,
      variableContext
    };

    // Execute named handler if script is a string reference
    if (typeof slot.script === 'string' && !slot.script.includes('(')) {
      cleanupRef.current = executeHandler(slot.script, scriptContext);
    } else {
      // Execute raw JavaScript code
      cleanupRef.current = executeScript(slot.script, scriptContext);
    }

    // Cleanup on unmount
    return () => {
      if (typeof cleanupRef.current === 'function') {
        cleanupRef.current();
      }
    };
  }, [slot.script, context, productData, variableContext]);

  // Don't show placeholder for intentionally empty content (like conditional price displays)
  let textContent = processedContent;

  // Special handling for price-related slots
  const isPriceSlot = ['product_price', 'product_card_price', 'original_price', 'compare_price'].includes(slot.id);

  // Slots that should remain empty when there's no content (conditional slots)
  const conditionalSlots = ['product_labels', 'product_card_compare_price', 'compare_price'];

  // Check if slot has conditionalDisplay metadata and evaluate it
  // Check both slot root and metadata for conditionalDisplay (config may have it at root level)
  const conditionalDisplay = slot.conditionalDisplay || slot.metadata?.conditionalDisplay;
  if (conditionalDisplay && context === 'storefront') {
    // Evaluate the conditionalDisplay condition
    // Format can be a path like 'product.compare_price_formatted' or 'this.compare_price_formatted'
    // Wrap in {{}} to evaluate as a variable if it's not already a template
    const isTemplate = conditionalDisplay.includes('{{');
    const conditionToEvaluate = isTemplate ? conditionalDisplay : `{{${conditionalDisplay}}}`;
    const evaluatedCondition = processVariables(conditionToEvaluate, variableContext || {});

    // Debug: Log conditionalDisplay evaluation for stock_label
    if (slot.id?.includes('stock_label')) {
      console.log('🏷️ conditionalDisplay check:', {
        slotId: slot.id,
        conditionalDisplay,
        conditionToEvaluate,
        evaluatedCondition,
        settingsValue: variableContext?.settings?.show_stock_label
      });
    }

    // If the condition evaluates to empty/falsy, don't render the slot
    if (!evaluatedCondition || evaluatedCondition.trim() === '' || evaluatedCondition === 'false') {
      return null;
    }
    // If it's a template that should evaluate to 'show', check for that
    if (isTemplate && evaluatedCondition.trim() !== 'show') {
      return null;
    }
  }
  const hasConditionalDisplay = !!conditionalDisplay;

  if (context === 'editor' && !processedContent) {
    if (isPriceSlot && !conditionalSlots.includes(slot.id)) {
      // Show example price in editor for main price slots only (not compare prices)
      if (slot.id === 'product_price' || slot.id === 'product_card_price') {
        textContent = '<span data-main-price class="main-price">$99.99</span>';
      } else if (slot.id === 'original_price') {
        textContent = '<span data-original-price class="original-price">$129.99</span>';
      }
    } else if (slot.id === 'product_labels') {
      // Show example labels in editor
      textContent = '<span class="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded mr-2">Sale</span><span class="inline-block bg-red-600 text-white text-xs px-2 py-1 rounded mr-2">New</span>';
    }
    // For conditional slots or slots with conditionalDisplay, don't show any placeholder
  }

  // Skip rendering entirely if empty (no placeholder text)
  // Debug: Log for stock_label slots
  if (slot.id?.includes('stock_label')) {
    console.log('🏷️ TextSlot render check:', {
      slotId: slot.id,
      textContent,
      processedContent,
      willRender: !!textContent
    });
  }
  if (!textContent) {
    return null;
  }

  // Check if metadata specifies an HTML tag
  const HtmlTag = slot.metadata?.htmlTag || 'div';
  const htmlAttributes = slot.metadata?.htmlAttributes || {};

  // Merge className with htmlAttributes.class if both exist, and add whitespace-normal
  const { class: htmlClass, ...otherHtmlAttributes } = htmlAttributes;
  const mergedClassName = htmlClass
    ? `${processedClassName} ${htmlClass} whitespace-normal`.trim()
    : `${processedClassName} whitespace-normal`.trim();

  return React.createElement(
    HtmlTag,
    {
      ref: elementRef,
      className: mergedClassName,
      style: styles,
      dangerouslySetInnerHTML: { __html: textContent },
      ...otherHtmlAttributes
    }
  );
};

/**
 * UnifiedSlotRenderer - Main rendering function for slot-based UI
 *
 * This is the core function that renders the entire slot tree. It handles:
 * - Filtering slots by viewMode and renderCondition
 * - Building variableContext from all data sources
 * - Rendering each slot based on type
 * - Wrapping with editor controls if in editor mode
 *
 * @param {Object} props - Component props
 * @param {Object} props.slots - Slot tree (hierarchical structure with parentId relationships)
 * @param {string|null} props.parentId - Parent slot ID (null for root level)
 * @param {string} props.viewMode - Page state for slot visibility (default, emptyCart, withProducts, etc.)
 * @param {string} props.viewportMode - Responsive viewport (desktop, tablet, mobile) for colSpan calculation
 * @param {string} props.context - Rendering context: 'editor' | 'storefront'
 * @param {Object} props.productData - Product page context { product, settings, productLabels, canAddToCart, handleWishlistToggle }
 *
 * @param {string} props.mode - Editor mode: 'edit' | 'preview'
 * @param {boolean} props.showBorders - Show borders around slots in editor
 * @param {Object} props.currentDragInfo - Current drag state
 * @param {Function} props.setCurrentDragInfo - Update drag state
 * @param {Function} props.onElementClick - Element click handler (for selection)
 * @param {Function} props.onGridResize - Grid resize handler
 * @param {Function} props.onSlotHeightResize - Slot height resize handler
 * @param {Function} props.onSlotDrop - Slot drop handler (drag & drop)
 * @param {Function} props.onSlotDelete - Slot delete handler
 * @param {Function} props.onResizeStart - Resize start handler
 * @param {Function} props.onResizeEnd - Resize end handler
 * @param {string|null} props.selectedElementId - Currently selected slot ID
 * @param {Function} props.setPageConfig - Update page configuration
 * @param {Function} props.saveConfiguration - Save configuration to database
 *
 * @param {Object} props.categoryData - Category page context { category, products, filters, filterableAttributes, pagination, settings, store }
 * @param {Object} props.cartData - Cart page context { items, subtotal, total, etc. }
 * @param {Object} props.headerContext - Header context { user, isLoggedIn, mobileMenuOpen, mobileSearchOpen, settings }
 * @param {Object} props.loginData - Login page context { onLogin, onRegister, etc. }
 * @param {Object} props.accountData - Account page context { user, handleLogout, etc. }
 * @param {Object} props.slotConfig - Static slot configuration (for renderCondition support)
 *
 * @returns {JSX.Element} Rendered slot tree
 *
 * @example
 * // Category page usage
 * <UnifiedSlotRenderer
 *   slots={pageConfig.slots}
 *   parentId={null}
 *   viewMode="default"
 *   viewportMode="desktop"
 *   context="storefront"
 *   categoryData={{ category, products, filters, settings, store }}
 * />
 *
 * @example
 * // Product page usage in editor
 * <UnifiedSlotRenderer
 *   slots={pageConfig.slots}
 *   parentId={null}
 *   viewMode="default"
 *   viewportMode="desktop"
 *   context="editor"
 *   mode="edit"
 *   showBorders={true}
 *   productData={{ product: demoProduct, settings }}
 *   onElementClick={handleElementClick}
 *   setPageConfig={setPageConfig}
 *   saveConfiguration={saveConfiguration}
 * />
 */
export function UnifiedSlotRenderer({
  slots,
  parentId = null,
  viewMode = 'default', // Page/cart state (emptyCart, withProducts, etc.) - for slot visibility
  viewportMode = 'desktop', // Responsive viewport (desktop, tablet, mobile) - for colSpan calculation
  context = 'storefront', // 'editor' | 'storefront'
  productData = {},

  // Editor-specific props
  mode = 'edit',
  showBorders = false,
  currentDragInfo,
  setCurrentDragInfo,
  onElementClick,
  onGridResize,
  onSlotHeightResize,
  onSlotDrop,
  onSlotDelete,
  onResizeStart,
  onResizeEnd,
  selectedElementId = null,
  setPageConfig,
  saveConfiguration,

  // Additional contexts for different page types
  categoryData = null,
  cartData = null,
  headerContext = null,
  loginData = null,
  accountData = null, // For account page (handleLogout, user, etc.)

  // Config for renderCondition support
  slotConfig = null,

  // NEW: Feature flag for using EditOverlay instead of GridColumn wrapper
  // When true, uses overlay-based editing (same DOM structure as storefront)
  // When false (default), uses traditional GridColumn wrapper
  useOverlay = false,

  // NEW: Preprocessed data from slotDataPreprocessor (optional)
  // When provided, uses this instead of building variableContext internally
  preprocessedData = null
}) {
  // Get translation function and translations data
  const { t, translations: contextTranslations, currentLanguage } = useTranslation();

  /**
   * processTranslation - Detects and translates content if it's a translation key
   *
   * Checks if content matches translation key patterns:
   * - Dotted notation: common.welcome_back, editor.header_title.123456
   * - If matches, translates using t() function
   * - Otherwise returns content as-is
   *
   * @param {string} content - Content to check and possibly translate
   * @returns {string} Translated content or original content
   */
  const processTranslation = (content) => {
    if (!content || typeof content !== 'string') return content;

    // Check if content is a translation key (dotted notation like "common.button.add_to_cart" or "editor.header_title.1234")
    const translationKeyPattern = /^[a-z_]+\.[a-z_0-9]+(\.[a-z_0-9]+)*$/;

    if (translationKeyPattern.test(content.trim())) {
      // It's a translation key, translate it
      const translated = t(content.trim());

      // If translation returns the same key (not found), return empty string to avoid showing the key
      // Only exception: if context is editor, show the key for debugging
      if (translated === content.trim() && context !== 'editor') {
        return '';
      }

      return translated;
    }

    return content;
  };

  // Get child slots for current parent
  let childSlots = SlotManager.getChildSlots(slots, parentId);

  // Filter slots by view mode
  const filteredSlots = filterSlotsByViewMode(childSlots, viewMode);

  // Apply renderCondition filtering based on slot metadata
  // renderConditions are now stored as string identifiers in slot.metadata.renderCondition
  const conditionFilteredSlots = filteredSlots.filter(slot => {
    const renderCondition = slot.metadata?.renderCondition;
    if (!renderCondition) return true; // No condition = always render

    const contextToUse = headerContext || categoryData || cartData || {};

    // Handle standard render conditions by identifier
    switch (renderCondition) {
      case 'hideOnMobileMenu':
        return !contextToUse.mobileMenuOpen;
      case 'showOnMobileMenu':
        return contextToUse.mobileMenuOpen;
      case 'hideOnMobileSearch':
        return !contextToUse.mobileSearchOpen;
      case 'showOnMobileSearch':
        return contextToUse.mobileSearchOpen;
      default:
        return true;
    }
  });

  // Sort slots by grid coordinates for proper rendering order
  const sortedSlots = sortSlotsByGridCoordinates(conditionFilteredSlots);

  // SIMPLIFIED: Use same data structure for both editor and storefront
  // Get filter option styles from slots for both editor and storefront
  const filterOptionStyles = slots?.filter_option_styles?.styles || {
    optionTextColor: '#374151',
    optionHoverColor: '#1F2937',
    optionCountColor: '#9CA3AF',
    checkboxColor: '#3B82F6',
    sliderColor: '#3B82F6',
    activeFilterBgColor: '#DBEAFE',
    activeFilterTextColor: '#1E40AF'
  };

  // Get attribute label styles (also used for Price label)
  const attributeLabelStyles = slots?.attribute_filter_label?.styles || {
    color: '#374151',
    fontSize: '1rem',
    fontWeight: '600'
  };

  // Get active filter styles
  const activeFilterStyles = slots?.active_filter_styles?.styles || {
    titleColor: '#374151',
    titleFontSize: '0.875rem',
    titleFontWeight: '600',
    backgroundColor: '#DBEAFE',
    textColor: '#1E40AF',
    clearAllColor: '#DC2626'
  };

  // Format products for category templates (same format as CategorySlotRenderer)
  const currencySymbol = categoryData?.settings?.currency_symbol || productData?.settings?.currency_symbol;
  // Check if currency should be hidden on category page
  const hideCurrencyCategory = categoryData?.settings?.hide_currency_category === true;
  const formattedProducts = (categoryData?.products || []).map(product => {
    const price = parseFloat(product.price || 0);
    const comparePrice = parseFloat(product.compare_price || 0);
    const hasValidComparePrice = comparePrice > 0 && comparePrice !== price;

    const lowestPrice = hasValidComparePrice ? Math.min(price, comparePrice) : price;
    const highestPrice = hasValidComparePrice ? Math.max(price, comparePrice) : price;

    // When hide_currency_category is enabled, use price numbers without currency
    const formatPriceForDisplay = hideCurrencyCategory ? formatPriceNumber : formatPrice;

    return {
      ...product,
      // Formatted prices for template (respects hide_currency_category setting)
      price_formatted: hasValidComparePrice ? formatPriceForDisplay(comparePrice) : formatPriceForDisplay(price),
      compare_price_formatted: hasValidComparePrice ? formatPriceForDisplay(price) : '',
      // Price numbers without currency (for conditional currency display)
      price_number: hasValidComparePrice ? formatPriceNumber(comparePrice) : formatPriceNumber(price),
      compare_price_number: hasValidComparePrice ? formatPriceNumber(price) : '',
      lowest_price_formatted: formatPriceForDisplay(lowestPrice),
      highest_price_formatted: formatPriceForDisplay(highestPrice),
      formatted_price: formatPriceForDisplay(price),
      formatted_compare_price: hasValidComparePrice ? formatPriceForDisplay(comparePrice) : null,
      image_url: product.images?.[0]?.url || product.image_url || product.image || '',
      url: product.url || '#',
      in_stock: product.infinite_stock || product.stock_quantity > 0,
      labels: []
    };
  });

  // Extract full settings object - keep ui_translations for template processing
  const fullSettings = productData.settings || categoryData?.settings || cartData?.settings || loginData?.settings || accountData?.settings || {};

  // Add translations from TranslationContext to settings for {{t "key"}} processing
  // variableProcessor expects ui_translations in format: { en: { common: { my_cart: "My Cart" } } }
  if (contextTranslations && Object.keys(contextTranslations).length > 0) {
    if (!fullSettings.ui_translations) {
      fullSettings.ui_translations = {};
    }
    // Add current language translations
    fullSettings.ui_translations[currentLanguage] = contextTranslations;
    // Also add as 'en' if not already present (for fallback)
    if (currentLanguage !== 'en' && !fullSettings.ui_translations.en) {
      fullSettings.ui_translations.en = contextTranslations;
    }
  }

  // Format single product with price_number fields (for product detail page)
  // This ensures {{product.price_number}} and {{product.compare_price_number}} work in templates
  const formatSingleProduct = (product) => {
    if (!product) return null;
    const price = parseFloat(product.price || 0);
    const comparePrice = parseFloat(product.compare_price || 0);
    const hasValidComparePrice = comparePrice > 0 && comparePrice !== price;

    return {
      ...product,
      // Price numbers without currency (for conditional currency display)
      price_number: formatPriceNumber(price),
      compare_price_number: hasValidComparePrice ? formatPriceNumber(comparePrice) : '',
      // Also add formatted prices for backward compatibility
      price_formatted: formatPrice(price),
      compare_price_formatted: hasValidComparePrice ? formatPrice(comparePrice) : ''
    };
  };

  const formattedProduct = productData.product
    ? formatSingleProduct(productData.product)
    : (context === 'editor' ? generateDemoData('product', {}).product : null);

  // Use preprocessedData if available (from storefront or editor), otherwise build from categoryData
  // This ensures both editor and storefront use the same data format
  const categorySource = preprocessedData || categoryData;

  // Debug: Check if preprocessedData contains products with stock_label
  if (preprocessedData?.products?.[0]) {
    console.log('🏷️ UnifiedSlotRenderer preprocessedData check:', {
      hasPreprocessedData: !!preprocessedData,
      firstProductHasStockLabel: 'stock_label' in (preprocessedData?.products?.[0] || {}),
      firstProductStockLabel: preprocessedData?.products?.[0]?.stock_label
    });
  }

  // Debug: Check which products are used
  const productsToUse = preprocessedData?.products || formattedProducts;
  console.log('🏷️ variableContext products assignment:', {
    parentId: parentId,  // To identify which render this is
    hasPreprocessedData: !!preprocessedData,
    usingPreprocessed: !!preprocessedData?.products,
    usingFormattedProducts: !preprocessedData?.products,
    firstProductHasStockLabel: 'stock_label' in (productsToUse?.[0] || {}),
    firstProductStockLabel: productsToUse?.[0]?.stock_label
  });

  const variableContext = {
    product: formattedProduct,
    products: productsToUse, // Use preprocessed products if available
    allProducts: preprocessedData?.allProducts || categorySource?.allProducts || [], // Unfiltered products for LayeredNavigation
    category: categorySource?.category || categoryData,
    cart: cartData,
    settings: fullSettings, // Keep ui_translations for {{t "key"}} processing
    translations: productData.translations || categorySource?.translations || null, // Translations from TranslationContext
    productLabels: productData.productLabels || categorySource?.productLabels,
    // Wishlist state for button styling
    isInWishlist: productData.isInWishlist || false,
    // Product-specific data
    customOptions: productData.customOptions || [],
    customOptionsLabel: productData.customOptionsLabel || 'Custom Options',
    // Category-specific data
    filters: categorySource?.filters || {},
    filterOptionStyles: filterOptionStyles,
    attributeLabelStyles: attributeLabelStyles,
    activeFilterStyles: activeFilterStyles,
    filterableAttributes: categorySource?.filterableAttributes || [],
    pagination: categorySource?.pagination || {},
    // Active filters - use from preprocessedData/categoryData
    activeFilters: categorySource?.activeFilters || [],
    // Pagination handlers from preprocessed data
    currentPage: categorySource?.currentPage,
    totalPages: categorySource?.totalPages,
    handlePageChange: categorySource?.handlePageChange,
    handleFilterChange: categorySource?.handleFilterChange,
    clearFilters: categorySource?.clearFilters,
    // Login data for login page
    loginData: loginData
  };

  /**
   * wrapWithResize - Wraps element with ResizeWrapper for visual resizing in editor
   *
   * Only applies in editor mode with mode='edit'. Adds resize handles to allow
   * visual resizing of slot elements. Updates slot styles and saves to database.
   *
   * @param {JSX.Element} element - Element to wrap
   * @param {Object} slot - Slot configuration
   * @param {number} minWidth - Minimum width in pixels (default: 20)
   * @param {number} minHeight - Minimum height in pixels (default: 16)
   * @returns {JSX.Element} Wrapped element (or unwrapped if not in editor mode)
   */
  const wrapWithResize = (element, slot, minWidth = 20, minHeight = 16) => {
    if (context !== 'editor' || mode !== 'edit') {
      return element;
    }

    const isDisabled = slot.metadata?.disableResize || false;

    return (
      <ResizeWrapper
        minWidth={minWidth}
        minHeight={minHeight}
        disabled={isDisabled}
        hideBorder={selectedElementId === slot.id}
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
        onResize={(newSize) => {
          if (!setPageConfig || !saveConfiguration) return;

          setPageConfig(prevConfig => {
            const updatedSlots = { ...prevConfig?.slots };

            // CRITICAL: Create slot if it doesn't exist (for template slots not yet in config)
            if (!updatedSlots[slot.id]) {
              updatedSlots[slot.id] = {
                id: slot.id,
                type: slot.type || 'text',
                content: slot.content || '',
                className: slot.className || '',
                styles: {},
                parentId: slot.parentId,
                metadata: {
                  ...(slot.metadata || {})
                }
              };
            }

            // Save width for all elements when user manually resizes
            const newStyles = {
              ...updatedSlots[slot.id].styles,
              width: `${newSize.width}${newSize.widthUnit || 'px'}`,
              // Save height if explicitly set (not auto)
              ...(newSize.height !== 'auto' ? {
                height: `${newSize.height}${newSize.heightUnit || 'px'}`
              } : {}),
              // Save fontSize for text elements when it's being dynamically calculated
              ...(newSize.fontSize !== undefined && { fontSize: `${newSize.fontSize}px` })
            };

            updatedSlots[slot.id] = {
              ...updatedSlots[slot.id],
              styles: newStyles
            };

            const updatedConfig = { ...prevConfig, slots: updatedSlots };

            setTimeout(() => {
              saveConfiguration(updatedConfig);
            }, 500);

            return updatedConfig;
          });
        }}
      >
        {element}
      </ResizeWrapper>
    );
  };

  /**
   * renderBasicSlot - Type-based rendering of slot content
   *
   * Routes slot rendering based on slot.type:
   * - text: TextSlotWithScript (with variable processing)
   * - html: Raw HTML content with dangerouslySetInnerHTML
   * - button: Interactive Button component
   * - image: img tag (optionally wrapped with Link for product cards)
   * - component: ComponentRegistry lookup + render
   * - container/grid/flex: Recursive rendering of children
   * - cms: CmsBlockSlot (loads from database)
   * - style_config: Returns null (hidden, used for config storage)
   *
   * Applies:
   * - Variable processing to content, className, styles
   * - Viewport-aware responsive class handling (md:hidden, sm:flex, etc.)
   * - Special handling for product card links
   * - ResizeWrapper in editor mode
   *
   * @param {Object} slot - Slot configuration
   * @param {string} slot.type - Slot type (text, button, image, component, container, grid, flex, html, cms)
   * @param {string} slot.content - Slot content (may contain {{variables}})
   * @param {string} slot.className - CSS classes (may contain {{variables}})
   * @param {Object} slot.styles - Inline styles (may contain {{variables}})
   * @param {Object} slot.metadata - Metadata (htmlTag, htmlAttributes, disableResize, component, etc.)
   * @returns {JSX.Element|null} Rendered slot content
   */
  const renderBasicSlot = (slot) => {
    const { id, type, content, className, styles, metadata } = slot;

    // Process variables in content and className
    let processedContent = processVariables(content, variableContext);

    // Process translation - if content is a translation key, translate it
    processedContent = processTranslation(processedContent);

    let processedClassName = processVariables(className, variableContext);

    // Handle viewport-aware responsive classes in editor mode
    // Convert Tailwind breakpoint classes (sm:, md:, lg:) to viewport-based visibility
    let shouldSkipDueToViewport = false;
    if (context === 'editor' && processedClassName) {
      // Handle md:hidden (hidden on medium screens and up - mobile/tablet show, desktop hide)
      if (processedClassName.includes('md:hidden')) {
        if (viewportMode === 'mobile') {
          // Remove md:hidden and make visible in mobile viewport
          processedClassName = processedClassName.replace(/\bmd:hidden\b/g, '').trim();
        } else {
          // In tablet/desktop viewport, skip rendering entirely
          shouldSkipDueToViewport = true;
        }
      }

      // sm:hidden means "hidden on small screens and up" (mobile should show, desktop should hide)
      if (processedClassName.includes('sm:hidden')) {
        if (viewportMode === 'mobile') {
          // Remove sm:hidden and make visible in mobile viewport
          processedClassName = processedClassName.replace(/\bsm:hidden\b/g, '').trim();
        } else {
          // In tablet/desktop viewport, skip rendering entirely
          shouldSkipDueToViewport = true;
        }
      }

      // hidden md:flex means "hidden on mobile, flex on medium screens and up"
      if (processedClassName.includes('hidden') && processedClassName.includes('md:flex')) {
        if (viewportMode === 'mobile') {
          // Skip rendering in mobile viewport
          shouldSkipDueToViewport = true;
        } else {
          // In tablet/desktop viewport, remove hidden and apply flex
          processedClassName = processedClassName.replace(/\bhidden\b/g, '').replace(/\bmd:flex\b/g, 'flex').trim();
        }
      }

      // hidden sm:flex means "hidden on mobile, flex on small screens and up"
      if (processedClassName.includes('hidden') && processedClassName.includes('sm:flex')) {
        if (viewportMode === 'mobile') {
          // Skip rendering in mobile viewport
          shouldSkipDueToViewport = true;
        } else {
          // In tablet/desktop viewport, remove hidden and apply flex
          processedClassName = processedClassName.replace(/\bhidden\b/g, '').replace(/\bsm:flex\b/g, 'flex').trim();
        }
      }

      // Transform responsive grid-cols classes based on viewport mode
      // ONLY in editor mode - storefront uses real Tailwind breakpoints
      // e.g., "grid md:grid-cols-12" -> "grid grid-cols-12" in desktop mode
      if (context === 'editor' && (viewportMode === 'desktop' || viewportMode === 'tablet')) {
        // Replace md:grid-cols-X with grid-cols-X for desktop/tablet
        processedClassName = processedClassName.replace(/\bmd:grid-cols-(\d+)\b/g, 'grid-cols-$1');
        processedClassName = processedClassName.replace(/\blg:grid-cols-(\d+)\b/g, 'grid-cols-$1');
        // Also handle md:col-span-X classes that might be in className
        processedClassName = processedClassName.replace(/\bmd:col-span-(\d+)\b/g, 'col-span-$1');
        processedClassName = processedClassName.replace(/\blg:col-span-(\d+)\b/g, 'col-span-$1');
      }

      // Clean up multiple spaces
      processedClassName = processedClassName.replace(/\s+/g, ' ').trim();
    }

    // Skip rendering if viewport doesn't match responsive classes
    if (shouldSkipDueToViewport) {
      return null;
    }

    // Process variables in styles (e.g., {{settings.theme.add_to_cart_button_color}})
    const processedStyles = {};
    if (styles) {
      Object.entries(styles).forEach(([key, value]) => {
        if (typeof value === 'string') {
          processedStyles[key] = processVariables(value, variableContext);
        } else {
          processedStyles[key] = value;
        }
      });
    }


    // HTML Element (raw HTML content)
    if (type === 'html') {
      // Skip rendering entirely if empty
      if (!processedContent) {
        return null;
      }

      // If context is storefront and slot has a script, use the script-enabled version
      if (context === 'storefront' && slot.script) {
        return (
          <TextSlotWithScript
            slot={slot}
            processedContent={processedContent}
            processedClassName={processedClassName}
            context={context}
            productData={productData}
            variableContext={variableContext}
          />
        );
      }

      // Don't wrap absolute positioned elements with ResizeWrapper as it interferes with positioning
      const isAbsolutePositioned = processedClassName?.includes('absolute') || processedStyles?.position === 'absolute';
      // Don't wrap gallery container to prevent width constraints
      const isGalleryContainer = id === 'product_gallery_container';

      // In editor mode - add click handler for element selection
      if (context === 'editor') {
        const htmlElement = (
          <div
            className={processedClassName}
            style={{ ...processedStyles, cursor: 'pointer' }}
            data-slot-id={id}
            data-editable="true"
            onClick={(e) => {
              e.stopPropagation();
              if (onElementClick) {
                onElementClick(id, e.currentTarget);
              }
            }}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        );

        if (!isAbsolutePositioned && !isGalleryContainer) {
          return wrapWithResize(htmlElement, slot, 20, 16);
        }
        return htmlElement;
      }

      // Storefront mode - no click handler needed
      const htmlElement = (
        <div
          className={processedClassName}
          style={processedStyles}
          dangerouslySetInnerHTML={{ __html: processedContent }}
        />
      );
      return htmlElement;
    }

    // Text Element
    if (type === 'text') {

      if (context === 'editor' && mode === 'edit') {
        const hasWFit = className?.includes('w-fit');
        // Check if metadata specifies an HTML tag (h1, h2, p, etc.)
        const HtmlTag = metadata?.htmlTag || 'span';
        const htmlAttributes = metadata?.htmlAttributes || {};

        // Merge className with htmlAttributes.class if both exist, and add whitespace-normal
        const { class: htmlClass, ...otherHtmlAttributes } = htmlAttributes;
        const mergedClassName = htmlClass
          ? `${processedClassName} ${htmlClass} whitespace-normal`.trim()
          : `${processedClassName} whitespace-normal`.trim();

        // Keep width from styles if it's a percentage, otherwise use fit-content
        const { width: storedWidth, ...stylesWithoutWidth } = processedStyles || {};
        const shouldUseStoredWidth = storedWidth && storedWidth.includes('%');

        // Check if slot is conditional (exact match or starts with pattern for instances)
        const conditionalSlotPatterns = ['product_labels', 'product_card_compare_price', 'compare_price'];
        // Skip rendering entirely if empty (no content at all)
        if (!processedContent) {
          return null;
        }

        // Add click handler for element selection
        const textElement = React.createElement(
          HtmlTag,
          {
            className: mergedClassName,
            style: {
              ...stylesWithoutWidth,
              cursor: 'pointer',
              display: 'inline-block',
              width: shouldUseStoredWidth ? storedWidth : 'fit-content'
            },
            onClick: (e) => {
              e.stopPropagation();
              if (onElementClick) {
                onElementClick(id, e.currentTarget);
              }
            },
            'data-slot-id': id,
            'data-editable': 'true',
            dangerouslySetInnerHTML: {
              __html: processedContent
            },
            ...otherHtmlAttributes
          }
        );
        return wrapWithResize(textElement, slot, 20, 16);
      } else {
        // Storefront mode - check if this is a product name that should link to product
        // Only add Link in actual storefront, not in editor (even in preview mode)
        const isProductCardName = id === 'product_card_name' || id === 'product_name';
        const product = productData?.product || productData;
        const store = categoryData?.store || productData?.store;

        if (context === 'storefront' && isProductCardName && product?.slug && store?.slug) {
          const productUrl = createProductUrl(store.slug, product.slug);
          const HtmlTag = metadata?.htmlTag || 'div';

          return (
            <Link to={productUrl} className="block">
              <HtmlTag
                className={processedClassName}
                style={processedStyles}
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />
            </Link>
          );
        }

        return (
          <TextSlotWithScript
            slot={slot}
            processedContent={processedContent}
            processedClassName={processedClassName}
            context={context}
            productData={productData}
            variableContext={variableContext}
          />
        );
      }
    }

    // Button Element
    if (type === 'button') {

      // Handle out-of-stock state for add_to_cart_button
      const isAddToCartButton = id === 'add_to_cart_button';
      const isOutOfStock = isAddToCartButton && (productData?.in_stock === false || productData?.canAddToCart === false);

      // Use out-of-stock content/className if available and product is out of stock
      let buttonContent = processedContent || 'Button';
      let buttonClassName = processedClassName;
      let buttonStyles = processedStyles;

      if (isOutOfStock && slot.metadata?.outOfStockContent) {
        buttonContent = processVariables(slot.metadata.outOfStockContent, variableContext);
      }
      if (isOutOfStock && slot.metadata?.outOfStockClassName) {
        buttonClassName = slot.metadata.outOfStockClassName;
        // Clear the background color style for out-of-stock (uses class instead)
        buttonStyles = { ...processedStyles };
        delete buttonStyles.backgroundColor;
      }

      // Handle wishlist button state - change appearance when product is in wishlist
      const isWishlistButton = id === 'wishlist_button';
      const isInWishlist = variableContext?.isInWishlist || productData?.isInWishlist;
      if (isWishlistButton && isInWishlist) {
        // Change to filled heart and red color when in wishlist
        buttonContent = '❤️';
        buttonClassName = (buttonClassName || '') + ' text-red-500';
        buttonStyles = { ...buttonStyles, color: '#ef4444' };
      }

      // Check if button content contains HTML
      const isHtmlContent = buttonContent.includes('<') && buttonContent.includes('>');

      if (context === 'storefront') {
        // Storefront: Full functionality
        const handleButtonClick = async (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Handle different button actions based on slot id
          if (id === 'add_to_cart_button') {
            // Add to cart logic
            const product = productData?.product || productData;
            const store = categoryData?.store || productData?.store;

            if (!product?.id || !store?.id) {
              console.error('Missing product or store data for add to cart');
              return;
            }

            try {
              // CRITICAL: Get the correct base price using utility function (same as ProductItemCard)
              const { getPriceDisplay } = await import('@/utils/priceUtils');
              const priceInfo = getPriceDisplay(product);
              const basePrice = priceInfo.displayPrice;

              const result = await cartService.addItem(
                product.id,
                1,
                basePrice,
                [],
                store.id
              );

              // CRITICAL: Use same success check as ProductItemCard (result.success === true, not !== false)
              if (result.success) {
                // Track add to cart event
                if (typeof window !== 'undefined' && window.daino?.trackAddToCart) {
                  window.daino.trackAddToCart(product, 1);
                }

                // Get translation from ui_translations
                const currentLang = localStorage.getItem('daino_language') || 'en';
                const translations = variableContext?.settings?.ui_translations || {};
                const addedToCartMessage = translations[currentLang]?.common?.added_to_cart ||
                                          translations['en']?.common?.added_to_cart ||
                                          ' added to cart successfully!';

                // Show success message
                window.dispatchEvent(new CustomEvent('showFlashMessage', {
                  detail: {
                    type: 'success',
                    message: `${product.name} ${addedToCartMessage}`
                  }
                }));
              }
            } catch (error) {
              console.error('Failed to add to cart:', error);

              // Get translation from ui_translations
              const currentLang = localStorage.getItem('daino_language') || 'en';
              const translations = variableContext?.settings?.ui_translations || {};
              const errorMessage = translations[currentLang]?.common?.error_adding_to_cart ||
                                  translations['en']?.common?.error_adding_to_cart ||
                                  'Failed to add to cart. Please try again.';

              window.dispatchEvent(new CustomEvent('showFlashMessage', {
                detail: {
                  type: 'error',
                  message: errorMessage
                }
              }));
            }
          } else if (id === 'wishlist_button') {
            productData.handleWishlistToggle?.();
          } else if (id === 'logout_button') {
            // Handle account logout
            accountData?.handleLogout?.();
          } else if (id === 'empty_cart_button') {
            // Handle empty cart "Continue Shopping" button
            const store = cartData?.store || categoryData?.store || productData?.store;
            const navigate = cartData?.navigate;
            if (store && navigate) {
              const storeUrl = `/public/${store.slug}`;
              navigate(storeUrl);
            }
          }
        };

        return (
          <Button
            variant="themed"
            className={buttonClassName}
            style={buttonStyles}
            onClick={handleButtonClick}
            disabled={isOutOfStock}
          >
            {isHtmlContent ? (
              <span className="flex items-center" dangerouslySetInnerHTML={{ __html: buttonContent }} />
            ) : (
              buttonContent
            )}
          </Button>
        );
      } else {
        // Editor: Visual preview only - add click handler for element selection
        const buttonElement = (
          <button
            className={buttonClassName}
            style={{ ...buttonStyles, cursor: 'pointer' }}
            data-slot-id={id}
            data-editable="true"
            onClick={(e) => {
              e.stopPropagation();
              if (onElementClick) {
                onElementClick(id, e.currentTarget);
              }
            }}
          >
            {isHtmlContent ? (
              <span className="flex items-center" dangerouslySetInnerHTML={{ __html: buttonContent }} />
            ) : (
              buttonContent
            )}
          </button>
        );
        return wrapWithResize(buttonElement, slot, 50, 20);
      }
    }

    // Image Element
    if (type === 'image') {
      let imageSrc = processedContent || content;

      // Handle product-specific images
      if (id === 'product_image' && productData.product) {
        imageSrc = getProductImageUrl(productData.product, productData.activeImageIndex || 0);
      }

      // Fallback image for empty, placeholder, or unprocessed template variables
      if (!imageSrc || imageSrc === 'product-main-image') {
        imageSrc = context === 'storefront' ?
          getProductImageUrl(productData.product) :
          'https://placehold.co/400x400?text=Product+Image';
      }
      // Check for unprocessed template variables in both editor and storefront
      else if (imageSrc.includes('{{') || imageSrc.includes('}}')) {
        imageSrc = context === 'storefront' ?
          getProductImageUrl(productData.product) :
          'https://placehold.co/400x400?text=Product+Image';
      }

      // Remove width from styles for images - let them be full width
      const { width, ...stylesWithoutWidth } = processedStyles || {};

      // Check if this is a product card image that should link to product
      const isProductCardImage = id === 'product_card_image' || id === 'product_image';
      const product = productData?.product || productData;
      const store = categoryData?.store || productData?.store;

      if (context === 'storefront' && isProductCardImage && product?.slug && store?.slug) {
        const productUrl = createProductUrl(store.slug, product.slug);

        // Get product labels for rendering on image
        const productLabels = variableContext?.productLabels || [];
        const labelsToRender = renderProductLabels(product, productLabels);

        return (
          <Link to={productUrl} className="block relative">
            <img
              src={imageSrc}
              alt={variableContext.product?.name || 'Image'}
              className={processedClassName}
              style={{ ...stylesWithoutWidth, width: '100%' }}
            />
            {labelsToRender}
          </Link>
        );
      }

      const imageElement = (
        <img
          src={imageSrc}
          alt={variableContext.product?.name || 'Image'}
          className={processedClassName}
          style={{ ...stylesWithoutWidth, width: '100%' }} // Force full width
        />
      );
      return wrapWithResize(imageElement, slot, 50, 50);
    }

    // CMS Block Element
    if (type === 'cms') {
      return <CmsBlockSlot slot={slot} context={context} className={processedClassName} styles={processedStyles} />;
    }

    // Plugin Widget Element
    if (type === 'plugin_widget') {
      // Lazy load PluginWidgetRenderer to avoid circular dependencies
      const PluginWidgetRenderer = React.lazy(() => import('@/components/plugins/PluginWidgetRenderer'));

      if (context === 'editor') {
        // Show placeholder in editor
        return (
          <div className={`${processedClassName} p-4 border-2 border-dashed border-purple-300 rounded bg-purple-50`} style={processedStyles}>
            <p className="text-purple-700 text-sm font-medium">🎨 Plugin Widget: {slot.widgetId}</p>
            <p className="text-purple-500 text-xs mt-1">Preview not available in editor</p>
          </div>
        );
      }

      // Render actual widget in storefront
      return (
        <React.Suspense fallback={<div className="p-4 text-gray-500">Loading widget...</div>}>
          <PluginWidgetRenderer
            widgetId={slot.widgetId}
            config={slot.widgetConfig || {}}
            slotData={variableContext}
          />
        </React.Suspense>
      );
    }

    // Container, Grid, Flex Elements
    if (type === 'container' || type === 'grid' || type === 'flex') {
      // Check if this container has any children
      const childSlots = SlotManager.getChildSlots(slots, id);
      const filteredChildren = filterSlotsByViewMode(childSlots, viewMode);

      // Skip rendering empty containers (no children)
      if (filteredChildren.length === 0) {
        return null;
      }

      // Use custom className from config if provided, otherwise use default
      let containerClass = '';

      if (processedClassName) {
        // If className is provided in config, use it as-is
        containerClass = processedClassName;
      } else {
        // Fallback to default classes if no className provided
        containerClass = type === 'grid' ? 'grid grid-cols-12 gap-2' :
                        type === 'flex' ? 'flex flex-wrap gap-2' : '';
      }

      // CRITICAL: In editor mode, containers need grid layout for child colSpan/gridColumn to work
      // Add grid classes if not already present (for container type, not flex)
      if (context === 'editor' && type === 'container' && !containerClass.includes('grid')) {
        containerClass = `grid grid-cols-12 gap-2 ${containerClass}`;
      }

      return (
        <div className={containerClass} style={processedStyles}>
          <UnifiedSlotRenderer
            slots={slots}
            parentId={id}
            viewMode={viewMode}
            viewportMode={viewportMode}
            context={context}
            productData={productData}
            mode={mode}
            showBorders={showBorders}
            currentDragInfo={currentDragInfo}
            setCurrentDragInfo={setCurrentDragInfo}
            onElementClick={onElementClick}
            onGridResize={onGridResize}
            onSlotHeightResize={onSlotHeightResize}
            onSlotDrop={onSlotDrop}
            onSlotDelete={onSlotDelete}
            onResizeStart={onResizeStart}
            onResizeEnd={onResizeEnd}
            selectedElementId={selectedElementId}
            setPageConfig={setPageConfig}
            saveConfiguration={saveConfiguration}
            categoryData={categoryData}
            cartData={cartData}
            headerContext={headerContext}
            loginData={loginData}
            accountData={accountData}
            useOverlay={useOverlay}
          />
        </div>
      );
    }

    // Component Element
    if (type === 'component') {
      const componentName = slot.component || slot.metadata?.component;

      if (componentName && ComponentRegistry.has(componentName)) {
        const component = ComponentRegistry.get(componentName);

        // Use unified render method - backward compatibility removed
        const renderMethod = component.render;

        if (!renderMethod) {
          throw new Error(`Component ${componentName} must implement a unified 'render' method. Separate renderEditor/renderStorefront methods are no longer supported.`);
        }

        return renderMethod({
          slot,
          productContext: productData,
          categoryContext: categoryData,
          cartContext: cartData,
          headerContext: headerContext,
          context,
          className: processedClassName,
          styles: processedStyles,
          variableContext,
          allSlots: slots,
          onElementClick,
          setPageConfig,
          saveConfiguration,
          // Pass grid editing props for nested components
          onGridResize,
          onSlotDrop,
          onSlotDelete,
          onSlotHeightResize,
          onResizeStart,
          onResizeEnd,
          currentDragInfo,
          setCurrentDragInfo,
          selectedElementId,
          showBorders,
          mode,
          viewMode // Pass viewMode to components
        });
      }

      // Fallback for unregistered components
      return (
        <div className={processedClassName} style={processedStyles}>
          {componentName ? `[${componentName} component]` : '[Unknown component]'}
        </div>
      );
    }

    // Hide style_config slots - they don't render visually
    if (type === 'style_config') {
      return null;
    }

    // Default fallback
    return (
      <div className={processedClassName} style={processedStyles}>
        {processedContent || `[${type} slot]`}
      </div>
    );
  };

  /**
   * wrapSlotForEditor - Wraps slot with grid/layout container and editor controls
   *
   * Handles:
   * - Grid column positioning (col-span-X or responsive classes)
   * - Editor-specific wrapping (GridColumn for drag & drop)
   * - Absolute positioning detection (skips wrapper)
   * - Null content handling (returns null)
   *
   * Editor mode: Wraps with GridColumn for drag/resize functionality
   * Storefront mode: Simple div wrapper for layout only
   *
   * @param {Object} slot - Slot configuration
   * @param {JSX.Element|null} slotContent - Rendered slot content
   * @param {string} colSpanClass - Tailwind colSpan class (e.g., 'col-span-6', 'col-span-12 md:col-span-6')
   * @param {string|null} gridColumn - CSS grid-column value (e.g., 'span 6 / span 6')
   * @returns {JSX.Element|null} Wrapped slot or null
   */
  const wrapSlotForEditor = (slot, slotContent, colSpanClass, gridColumn) => {
    // If slot content is null or undefined (e.g., empty slots, style_config slots), don't render anything
    if (slotContent === null || slotContent === undefined) {
      return null;
    }

    // Check if slotContent is an empty React element (false or empty string)
    if (slotContent === false || slotContent === '') {
      return null;
    }

    // Check if slot has absolute positioning - if so, return it directly without any wrapper
    const isAbsolutePositioned = slot.className?.includes('absolute') || slot.styles?.position === 'absolute';

    if (isAbsolutePositioned) {
      // For absolutely positioned elements, return directly without any grid wrapper
      return <React.Fragment key={slot.id}>{slotContent}</React.Fragment>;
    }

    // Check if colSpan is empty object and skip wrapper
    const isEmptyColSpan = typeof slot.colSpan === 'object' &&
                           slot.colSpan !== null &&
                           Object.keys(slot.colSpan).length === 0;

    if (isEmptyColSpan) {
      return <React.Fragment key={slot.id}>{slotContent}</React.Fragment>;
    }

    // Use same layout structure for both editor and storefront
    const processedParentClassName = processVariables(slot.parentClassName || '', variableContext);

    const layoutWrapper = (
      <div
        key={slot.id}
        className={`${colSpanClass} ${processedParentClassName}`}
        style={{
          // CRITICAL: Only apply gridColumn in editor mode
          // In storefront, Tailwind responsive classes (col-span-12 md:col-span-6) handle grid layout
          // Inline gridColumn style would override responsive breakpoints
          ...(context === 'editor' && gridColumn ? { gridColumn } : {}),
          ...slot.containerStyles
        }}
      >
        {slotContent}
      </div>
    );

    // In editor, add editing functionality
    if (context === 'editor') {

      // NEW: Use EditOverlay if useOverlay flag is set
      // This provides the same DOM structure as storefront with overlay-based editing
      if (useOverlay) {
        // Handle select callback for EditOverlay
        const handleOverlaySelect = (slotId, slotData) => {
          if (onElementClick) {
            // Create a synthetic event-like object for compatibility
            const syntheticEvent = {
              target: document.querySelector(`[data-slot-id="${slotId}"]`),
              stopPropagation: () => {},
              preventDefault: () => {},
            };
            onElementClick(syntheticEvent);
          }
        };

        // Handle resize callback for EditOverlay
        const handleOverlayResize = (slotId, dimension, delta) => {
          if (!setPageConfig || !saveConfiguration) return;

          setPageConfig(prevConfig => {
            const updatedSlots = { ...prevConfig?.slots };
            if (!updatedSlots[slotId]) return prevConfig;

            const currentStyles = updatedSlots[slotId].styles || {};
            const currentValue = parseInt(currentStyles[dimension === 'width' ? 'width' : 'height']) || 100;
            const newValue = Math.max(20, currentValue + delta);

            updatedSlots[slotId] = {
              ...updatedSlots[slotId],
              styles: {
                ...currentStyles,
                [dimension === 'width' ? 'width' : 'height']: `${newValue}px`
              }
            };

            const updatedConfig = { ...prevConfig, slots: updatedSlots };
            setTimeout(() => saveConfiguration(updatedConfig), 500);
            return updatedConfig;
          });
        };

        // Handle drop callback for EditOverlay
        const handleOverlayDrop = (draggedSlotId, targetSlotId, dropZone, targetSlot) => {
          if (onSlotDrop) {
            onSlotDrop(draggedSlotId, targetSlotId, dropZone);
          }
        };

        // EditOverlay becomes the grid item directly (with col-span classes)
        // The slotContent goes inside without the extra wrapper div
        return (
          <EditOverlay
            key={`${slot.id}-${viewportMode}`}
            slotId={slot.id}
            slot={slot}
            mode={mode}
            isSelected={selectedElementId === slot.id}
            showBorders={showBorders}
            onSelect={handleOverlaySelect}
            onDrop={handleOverlayDrop}
            onResize={handleOverlayResize}
            onDelete={onSlotDelete ? (slotId) => onSlotDelete(slotId, slot) : null}
            currentDragInfo={currentDragInfo}
            setCurrentDragInfo={setCurrentDragInfo}
            className={`${colSpanClass} ${processedParentClassName}`}
            style={{
              ...(gridColumn ? { gridColumn } : {}),
              ...slot.containerStyles
            }}
          >
            {slotContent}
          </EditOverlay>
        );
      }

      // DEFAULT: Use traditional GridColumn wrapper
      let colSpanValue = 12;
      let useTailwindClass = false;

      if (typeof slot.colSpan === 'number') {
        colSpanValue = slot.colSpan;
      } else if (typeof slot.colSpan === 'string') {
        // Direct string colSpan like 'col-span-12 md:col-span-6'
        useTailwindClass = true;
        colSpanValue = 12;
      } else if (typeof slot.colSpan === 'object' && slot.colSpan !== null) {
        // Try viewMode key first, then 'default', then first available value
        const viewModeValue = slot.colSpan[viewMode] ?? slot.colSpan['default'] ?? Object.values(slot.colSpan)[0];
        if (typeof viewModeValue === 'number') {
          colSpanValue = viewModeValue;
        } else if (typeof viewModeValue === 'string') {
          useTailwindClass = true;
          colSpanValue = 12;
        } else {
          colSpanValue = 12;
        }
      }

      return (
        <GridColumn
          key={`${slot.id}-${viewportMode}`}
          colSpan={colSpanValue}
          colSpanClass={colSpanClass}
          useTailwindClass={useTailwindClass}
          rowSpan={1}
          height={slot.styles?.height}
          slotId={slot.id}
          slot={slot}
          onGridResize={onGridResize}
          onSlotHeightResize={onSlotHeightResize}
          onResizeStart={onResizeStart}
          onResizeEnd={onResizeEnd}
          onSlotDrop={onSlotDrop}
          onSlotDelete={onSlotDelete}
          onElementClick={onElementClick}
          mode={mode}
          viewMode={viewMode}
          showBorders={showBorders}
          currentDragInfo={currentDragInfo}
          setCurrentDragInfo={setCurrentDragInfo}
          selectedElementId={selectedElementId}
          slots={slots}
          isNested={parentId !== null}
          productData={productData}
          preserveLayout={true}
        >
          {layoutWrapper}
        </GridColumn>
      );
    }

    return layoutWrapper;
  };

  // Filter mobile search and menu based on state (storefront behavior)
  const finalSlots = sortedSlots.filter((slot) => {
    // Check if permanent mobile search is enabled from store settings
    const showPermanentMobile = headerContext?.settings?.show_permanent_search || false;

    // In storefront context, hide mobile_search_bar unless mobileSearchOpen OR showPermanentMobile
    if (context === 'storefront' && slot.id === 'mobile_search_bar' && !headerContext?.mobileSearchOpen && !showPermanentMobile) {
      return false;
    }
    // In storefront context, hide mobile_menu unless mobileMenuOpen
    if (context === 'storefront' && slot.id === 'mobile_menu' && !headerContext?.mobileMenuOpen) {
      return false;
    }
    return true;
  });

  /**
   * transformResponsiveClass - Transform Tailwind responsive classes based on viewport mode
   *
   * In the editor, the preview container width doesn't match browser viewport,
   * so Tailwind's responsive breakpoints (sm:, md:, lg:) don't work correctly.
   * This function extracts the appropriate class based on the selected viewportMode.
   *
   * @param {string} classString - Tailwind class string like 'col-span-12 md:col-span-6 lg:col-span-4'
   * @param {string} viewport - 'desktop' | 'tablet' | 'mobile'
   * @returns {string} Transformed class for the viewport
   */
  const transformResponsiveClass = (classString, viewport) => {
    if (!classString || context !== 'editor') return classString;

    // Parse the class string to extract responsive variants
    const classes = classString.split(' ').filter(Boolean);
    const baseClasses = [];
    const responsiveMap = { sm: [], md: [], lg: [], xl: [], '2xl': [] };

    classes.forEach(cls => {
      const match = cls.match(/^(sm|md|lg|xl|2xl):(.+)$/);
      if (match) {
        responsiveMap[match[1]].push(match[2]);
      } else {
        baseClasses.push(cls);
      }
    });

    // Select classes based on viewport mode
    // desktop: use lg/xl/2xl > md > sm > base
    // tablet: use md > sm > base
    // mobile: use sm > base
    let selectedClasses = [...baseClasses];

    if (viewport === 'desktop') {
      // For desktop, apply the largest breakpoint available
      if (responsiveMap['2xl'].length) selectedClasses = responsiveMap['2xl'];
      else if (responsiveMap.xl.length) selectedClasses = responsiveMap.xl;
      else if (responsiveMap.lg.length) selectedClasses = responsiveMap.lg;
      else if (responsiveMap.md.length) selectedClasses = responsiveMap.md;
      else if (responsiveMap.sm.length) selectedClasses = responsiveMap.sm;
    } else if (viewport === 'tablet') {
      // For tablet, apply md breakpoint
      if (responsiveMap.md.length) selectedClasses = responsiveMap.md;
      else if (responsiveMap.sm.length) selectedClasses = responsiveMap.sm;
    }
    // For mobile, just use base classes (already set)

    return selectedClasses.join(' ');
  };

  return (
    <>
      {finalSlots.map((slot) => {
        // Handle colSpan configuration
        let colSpanClass = 'col-span-12';
        let gridColumn = 'span 12 / span 12';

        if (slot.colSpan === undefined || slot.colSpan === null) {
          // No colSpan defined - default to full width
          colSpanClass = 'col-span-12';
          gridColumn = 'span 12 / span 12';
        } else if (typeof slot.colSpan === 'number') {
          colSpanClass = `col-span-${slot.colSpan}`;
          gridColumn = `span ${slot.colSpan} / span ${slot.colSpan}`;
        } else if (typeof slot.colSpan === 'string') {
          // Handle responsive colSpan strings like 'col-span-12 md:col-span-6'
          // Transform based on viewportMode in editor
          colSpanClass = transformResponsiveClass(slot.colSpan, viewportMode);
          // Extract col-span number for gridColumn
          const colSpanMatch = colSpanClass.match(/col-span-(\d+)/);
          if (colSpanMatch) {
            const span = colSpanMatch[1];
            gridColumn = `span ${span} / span ${span}`;
          } else {
            gridColumn = null;
          }
        } else if (typeof slot.colSpan === 'object' && slot.colSpan !== null) {
          // Try viewMode key first, then 'default', then first available value
          const viewModeValue = slot.colSpan[viewMode] ?? slot.colSpan['default'] ?? Object.values(slot.colSpan)[0];

          if (typeof viewModeValue === 'number') {
            colSpanClass = `col-span-${viewModeValue}`;
            gridColumn = `span ${viewModeValue} / span ${viewModeValue}`;
          } else if (typeof viewModeValue === 'string') {
            // Transform responsive classes based on viewportMode (only in editor)
            colSpanClass = transformResponsiveClass(viewModeValue, viewportMode);
            // Extract col-span number for gridColumn
            const colSpanMatch = colSpanClass.match(/col-span-(\d+)/);
            if (colSpanMatch) {
              const span = colSpanMatch[1];
              gridColumn = `span ${span} / span ${span}`;
            } else {
              gridColumn = null;
            }
          }
        }

        // Render slot content
        const slotContent = renderBasicSlot(slot);

        // Skip rendering if slot content is null or undefined (empty slots)
        if (slotContent === null || slotContent === undefined) {
          return null;
        }

        // Wrap with appropriate container
        return wrapSlotForEditor(slot, slotContent, colSpanClass, gridColumn);
      })}
    </>
  );
}

/**
 * getProductImageUrl - Extracts product image URL from various formats
 *
 * Handles multiple image object formats:
 * - String: Direct URL
 * - Object with url/src/path/image_url/uri/file_url properties
 *
 * @param {Object} product - Product object
 * @param {Array} product.images - Array of image URLs or objects
 * @param {number} imageIndex - Image index (default: 0 for main image)
 * @returns {string} Image URL or placeholder
 *
 * @example
 * getProductImageUrl(product, 0) // Main image
 * getProductImageUrl(product, 1) // Second image (for gallery)
 */
function getProductImageUrl(product, imageIndex = 0) {
  if (!product || !product.images || !product.images[imageIndex]) {
    return 'https://placehold.co/600x600?text=No+Image';
  }

  const image = product.images[imageIndex];

  // Handle string URLs directly
  if (typeof image === 'string') {
    return image || 'https://placehold.co/600x600?text=No+Image';
  }

  // Images are stored as objects with url property
  if (typeof image === 'object' && image !== null) {
    return image.url || 'https://placehold.co/600x600?text=No+Image';
  }

  return 'https://placehold.co/600x600?text=No+Image';
}

export default UnifiedSlotRenderer;