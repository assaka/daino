import React, {Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { SlotManager } from '@/utils/slotUtils';
import { filterSlotsByViewMode, sortSlotsByGridCoordinates } from '@/hooks/useSlotConfiguration';
import CmsBlockRenderer from '@/components/storefront/CmsBlockRenderer';
import ProductItemCard from '@/components/storefront/ProductItemCard';
import { ComponentRegistry } from '@/components/editor/slot/SlotComponentRegistry';
import '@/components/editor/slot/CategorySlotComponents';
import '@/components/editor/slot/BreadcrumbsSlotComponent';
import { createProductUrl } from '@/utils/urlUtils';
import { formatPrice, formatPriceNumber, getPriceDisplay } from '@/utils/priceUtils';
import { getStockLabel, getStockLabelStyle, isProductOutOfStock } from '@/utils/stockUtils';
import { getCategoryName, getProductName, getCurrentLanguage } from '@/utils/translationUtils';
import { processVariables } from '@/utils/variableProcessor';
import { useTranslation } from '@/contexts/TranslationContext';

/**
 * CategorySlotRenderer - Data Processor & Slot Tree Renderer for Category Pages
 *
 * ARCHITECTURE FLOW:
 * Category.jsx (raw data from API)
 *   → CategorySlotRenderer (THIS FILE - formats data & processes slots)
 *     → ComponentRegistry.get('ComponentName')
 *       → CategorySlotComponents (component implementations)
 *         → UnifiedSlotRenderer (renders individual slot elements)
 *           → processVariables (replaces {{template}} variables)
 *
 * PRIMARY RESPONSIBILITIES:
 * 1. Format products using getPriceDisplay() - SINGLE SOURCE OF TRUTH for price display
 * 2. Create variableContext with pre-formatted data
 * 3. Process slot tree (filter by viewMode, sort by position)
 * 4. Render slots by type (component, container, text, image, etc.)
 * 5. Call ComponentRegistry for registered components
 *
 * CRITICAL: Price Formatting
 * - Lines 192-220: Format products using getPriceDisplay() utility
 * - This is the ONLY place where product prices should be formatted
 * - All downstream components use pre-formatted prices from variableContext
 * - DO NOT re-format prices in components - use price_formatted/compare_price_formatted
 *
 * DATA FLOW:
 * Input:  categoryContext (raw products with price, compare_price)
 * Output: variableContext (formatted products with price_formatted, compare_price_formatted)
 *
 * DUAL MODE SUPPORT:
 * - Storefront mode: Renders for end users
 * - Editor mode: N/A (editor uses UnifiedSlotsEditor directly)
 *
 * @see CategorySlotComponents.jsx - Component implementations
 * @see UnifiedSlotRenderer.jsx - Individual slot element renderer
 * @see variableProcessor.js - Template variable replacement
 * @see priceUtils.js - getPriceDisplay() utility
 */
export function CategorySlotRenderer({
  slots,
  parentId = null,
  viewMode = 'grid',
  categoryContext = {}
}) {
  // Get translations for stock labels
  const { translations, t } = useTranslation();

  // Helper function to generate dynamic grid classes
  const getDynamicGridClasses = (slot) => {
    if (viewMode === 'list') {
      return 'space-y-4';
    }

    // Use store settings for grid configuration
    const gridConfig = settings?.product_grid;

    if (gridConfig) {
      let classes = ['grid', 'gap-4'];
      const breakpoints = gridConfig.breakpoints || {};
      const customBreakpoints = gridConfig.customBreakpoints || [];

      // Standard breakpoints
      Object.entries(breakpoints).forEach(([breakpoint, columns]) => {
        if (columns > 0) {
          if (breakpoint === 'default') {
            if (columns === 1) classes.push('grid-cols-1');
            else if (columns === 2) classes.push('grid-cols-2');
          } else {
            if (columns === 1) classes.push(`${breakpoint}:grid-cols-1`);
            else if (columns === 2) classes.push(`${breakpoint}:grid-cols-2`);
            else if (columns === 3) classes.push(`${breakpoint}:grid-cols-3`);
            else if (columns === 4) classes.push(`${breakpoint}:grid-cols-4`);
            else if (columns === 5) classes.push(`${breakpoint}:grid-cols-5`);
            else if (columns === 6) classes.push(`${breakpoint}:grid-cols-6`);
          }
        }
      });

      // Custom breakpoints
      customBreakpoints.forEach(({ name, columns }) => {
        if (name && columns > 0) {
          if (columns === 1) classes.push(`${name}:grid-cols-1`);
          else if (columns === 2) classes.push(`${name}:grid-cols-2`);
          else if (columns === 3) classes.push(`${name}:grid-cols-3`);
          else if (columns === 4) classes.push(`${name}:grid-cols-4`);
          else if (columns === 5) classes.push(`${name}:grid-cols-5`);
          else if (columns === 6) classes.push(`${name}:grid-cols-6`);
        }
      });

      return classes.length > 0 ? classes.join(' ') : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4';
    }

    // Default fallback
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4';
  };

  const {
    category,
    products = [],
    allProducts = [],
    filteredProductsCount = 0, // Count of products after filtering
    filters = {},
    filterableAttributes = [],
    sortOption,
    searchQuery,
    currentPage,
    totalPages,
    itemsPerPage = 12, // Dynamic items per page
    breadcrumbs = [],
    selectedFilters = {},
    priceRange = {},
    currencySymbol, // Currency symbol from categoryContext (passed from Category.jsx)
    settings = {},
    store,
    categories = [],
    taxes,
    selectedCountry,
    productLabels = [],
    handleFilterChange,
    handleSortChange,
    handleSearchChange,
    handlePageChange,
    clearFilters,
    formatDisplayPrice,
    getProductImageUrl,
    navigate,
    onProductClick
  } = categoryContext;

  // Check if filters should be enabled
  const filtersEnabled = settings?.enable_product_filters !== false && filterableAttributes?.length > 0;

  // Prepare settings with proper defaults for category page behavior
  // This is defined at component level so it's available everywhere
  const settingsForCategoryPage = {
    ...(settings || {}),
    collapse_filters: settings?.collapse_filters !== undefined ? settings.collapse_filters : false,
    max_visible_attributes: settings?.max_visible_attributes || 5
  };

  // Helper function to evaluate conditional display expressions
  const evaluateConditionalDisplay = (expression, context) => {
    if (!expression) return true; // No condition means always show

    try {
      // Handle simple dot notation like "settings.enable_view_mode_toggle"
      const parts = expression.split('.');
      let value = context;

      for (const part of parts) {
        if (value === undefined || value === null) return false;
        value = value[part];
      }

      // Return the boolean value
      return !!value;
    } catch (error) {
      console.warn('Failed to evaluate conditional display:', expression, error);
      return true; // Default to showing if evaluation fails
    }
  };

  // Get child slots for current parent
  let childSlots = SlotManager.getChildSlots(slots, parentId);
  // Filter by conditionalDisplay
  childSlots = childSlots.filter(slot => {
    if (!slot.conditionalDisplay) return true;
    const shouldShow = evaluateConditionalDisplay(slot.conditionalDisplay, categoryContext);
    return shouldShow;
  });

  // Filter by viewMode if applicable
  const filteredSlots = filterSlotsByViewMode(childSlots, viewMode);

  // Sort slots using grid coordinates for precise positioning
  const sortedSlots = sortSlotsByGridCoordinates(filteredSlots);

  // Sort completed

  // Helper function to get child slots of a parent
  const renderChildSlots = (allSlots, parentId) => {
    if (!allSlots) return [];

    const childSlots = Object.values(allSlots).filter(slot =>
      slot.parentId === parentId
    );

    // Sort by position for proper rendering order
    return childSlots.sort((a, b) => {
      const posA = a.position || { col: 1, row: 1 };
      const posB = b.position || { col: 1, row: 1 };

      if (posA.row !== posB.row) {
        return posA.row - posB.row;
      }
      return posA.col - posB.col;
    });
  };

  const renderSlotContent = (slot) => {
    // Extract slot configuration with defaults
    const {
      id,
      type,
      content,
      className = '',
      styles = {},
      parentClassName = '',
      metadata = {},
      component: componentName
    } = slot || {};

    // Fallback: check metadata.component if component field is missing (for backward compatibility)
    const finalComponentName = componentName || metadata?.component;

    // Check if this is a registered component type - use ComponentRegistry
    if (type === 'component' && finalComponentName && ComponentRegistry.has(finalComponentName)) {
      const registeredComponent = ComponentRegistry.get(finalComponentName);

      // Format products with all necessary fields for templates
      const currentLanguage = getCurrentLanguage();
      const formattedProducts = products.map(product => {
        // Use the centralized getPriceDisplay utility
        const priceInfo = getPriceDisplay(product);

        // Get translated product name
        const translatedName = getProductName(product, currentLanguage) || product.name;

        // Calculate stock status using centralized function
        const isInStock = !isProductOutOfStock(product);

        // Get stock label from centralized utility
        const stockLabelInfo = getStockLabel(product, settings, null, translations);
        const stockLabelStyle = getStockLabelStyle(product, settings, null, translations);

        const formattedProduct = {
          ...product,
          // Add translated name
          name: translatedName,
          // Use getPriceDisplay results for consistent pricing
          price_formatted: formatPrice(priceInfo.displayPrice), // Lowest price with currency
          compare_price_formatted: priceInfo.hasComparePrice ? formatPrice(priceInfo.originalPrice) : '', // Highest price with currency (only if sale)
          // Price numbers without currency (for conditional currency display)
          price_number: formatPriceNumber(priceInfo.displayPrice),
          compare_price_number: priceInfo.hasComparePrice ? formatPriceNumber(priceInfo.originalPrice) : '',
          lowest_price_formatted: formatPrice(priceInfo.displayPrice),
          highest_price_formatted: priceInfo.hasComparePrice ? formatPrice(priceInfo.originalPrice) : formatPrice(priceInfo.displayPrice),
          // Also keep old names for backwards compatibility
          formatted_price: formatPrice(priceInfo.displayPrice),
          formatted_compare_price: priceInfo.hasComparePrice ? formatPrice(priceInfo.originalPrice) : null,
          image_url: getProductImageUrl ? getProductImageUrl(product) : (product.images?.[0]?.url || product.image_url || product.image || ''),
          url: product.url || createProductUrl(store?.public_storecode || store?.slug || store?.code, product.slug || product.id),
          in_stock: isInStock,
          // Add stock label using centralized utility (respects admin settings including colors)
          stock_label: stockLabelInfo?.text || '',
          stock_label_style: stockLabelStyle,
          labels: productLabels?.filter(label => {
            // Check if product has this label
            if (label.type === 'new' && product.is_new) return true;
            if (label.type === 'sale' && product.compare_price) return true;
            if (label.type === 'featured' && product.is_featured) return true;
            return false;
          }).map(label => ({
            text: label.text,
            className: label.background_color ? `bg-[${label.background_color}] text-white` : 'bg-red-600 text-white'
          })) || []
        };

        return formattedProduct;
      });

      // Prepare filters data for LayeredNavigation template
      const filtersData = filters || {};

      // Format price filter (slider or ranges)
      let priceFilter = null;
      if (filtersData.price) {
        // Check if it's a slider type (has min, max, type properties)
        if (filtersData.price.type === 'slider' && filtersData.price.min !== undefined && filtersData.price.max !== undefined) {
          priceFilter = {
            min: filtersData.price.min,
            max: filtersData.price.max,
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
              value: value,
              label: typeof label === 'string' ? label : value,
              count: 0,
              active: false
            }))
          };
        }
      }

      // Format attribute filters
      const attributeFilters = filterableAttributes?.map(attr => {
        const attrCode = attr.code || attr.name;
        const filterData = filtersData[attrCode];
        const filterType = attr.filter_type || 'multiselect';

        // Structure: { label, options: ["inbouw", "onderbouw"] }
        let valueCodes = [];

        // Safely get translated attribute label - handle missing or malformed translation objects
        let attributeLabel = attr.name || attr.code || attrCode;
        if (attr.translations) {
          const langTranslation = attr.translations[currentLanguage];
          const enTranslation = attr.translations.en;

          if (langTranslation && typeof langTranslation.name === 'string') {
            attributeLabel = langTranslation.name;
          } else if (enTranslation && typeof enTranslation.name === 'string') {
            attributeLabel = enTranslation.name;
          }
        }

        if (filterData && typeof filterData === 'object' && filterData.options) {
          valueCodes = filterData.options;
          // Only use filterData.label as fallback if no translation found
          if (!attr.translations?.[currentLanguage]?.name && !attr.translations?.en?.name) {
            attributeLabel = filterData.label || attributeLabel;
          }
        }

        // Handle slider type for numeric attributes
        if (filterType === 'slider') {
          // Collect numeric values from products for this attribute
          const numericValues = [];
          allProducts.forEach(p => {
            const productAttributes = p.attributes || [];
            if (!Array.isArray(productAttributes)) return;

            const matchingAttr = productAttributes.find(pAttr => pAttr.code === attrCode);
            if (matchingAttr) {
              const numVal = parseFloat(matchingAttr.rawValue || matchingAttr.value);
              if (!isNaN(numVal)) {
                numericValues.push(numVal);
              }
            }
          });

          if (numericValues.length > 0) {
            const minVal = Math.floor(Math.min(...numericValues));
            const maxVal = Math.ceil(Math.max(...numericValues));

            // Only show slider if there's a range
            if (minVal !== maxVal) {
              return {
                code: attrCode,
                label: attributeLabel,
                filter_type: 'slider',
                min: minVal,
                max: maxVal
              };
            }
          }
          return null; // Skip if no valid numeric range
        }

        // Get attribute values with translations from attr
        // attr should have a 'values' property with AttributeValue records
        const attributeValues = attr.values || [];

        // Map value codes to full option objects with translations
        const formattedOptions = valueCodes
          .map(valueCode => {
            // Find the AttributeValue record for this code
            const attrValue = attributeValues.find(av => av.code === valueCode);

            // Count products that have this attribute value
            const productCount = allProducts.filter(p => {
              const productAttributes = p.attributes || [];
              if (!Array.isArray(productAttributes)) return false;

              const matchingAttr = productAttributes.find(pAttr => pAttr.code === attrCode);
              // Use rawValue (code) if available, otherwise fall back to value (translated label)
              // This matches the logic in Category.jsx buildFilters()
              const productValue = String(matchingAttr?.rawValue || matchingAttr?.value || '');
              return matchingAttr && productValue === String(valueCode);
            }).length;

            // Check if this filter value is currently selected
            const isActive = selectedFilters[attrCode]?.includes(valueCode) || false;

            if (attrValue) {
              // Safely get translated label - handle missing or malformed translation objects
              let valueLabel = String(valueCode || '');
              if (attrValue.translations) {
                const langTranslation = attrValue.translations[currentLanguage];
                const enTranslation = attrValue.translations.en;

                if (langTranslation && typeof langTranslation.label === 'string') {
                  valueLabel = langTranslation.label;
                } else if (enTranslation && typeof enTranslation.label === 'string') {
                  valueLabel = enTranslation.label;
                }
              }

              return {
                value: valueCode,
                label: valueLabel,
                count: productCount,
                active: isActive,
                attributeCode: attrCode,
                sort_order: attrValue.sort_order || 0,
                filter_type: filterType // Pass filter_type to each option for template access
              };
            }

            // Fallback if no AttributeValue found
            return {
              value: valueCode,
              label: valueCode,
              count: productCount,
              active: isActive,
              attributeCode: attrCode,
              sort_order: 999,
              filter_type: filterType // Pass filter_type to each option for template access
            };
          })
          .sort((a, b) => a.sort_order - b.sort_order); // Sort by sort_order

        const result = {
          code: attrCode,
          label: attributeLabel, // Use translated label from filter data
          options: formattedOptions,
          filter_type: attr.filter_type || 'multiselect' // multiselect (checkboxes), select (radio), slider
        };

        return result;
      }).filter(attr => attr && attr.options && attr.options.length > 0) || [];

      // Use component-level settingsForCategoryPage (defined above) for filter behavior
      const formattedFilters = {
        price: priceFilter,
        attributes: attributeFilters,
        settings: settingsForCategoryPage // Pass settings within filters object for easier template access
      };

      // Get filter option styles from slots
      const filterOptionStyles = slots?.filter_option_styles?.styles || {
        optionTextColor: '#374151',
        optionHoverColor: '#1F2937',
        optionCountColor: '#9CA3AF',
        checkboxColor: '#3B82F6',
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

      // Build pages array for pagination template
      const buildPagesArray = () => {
        const pages = [];
        const maxPagesToShow = 7; // Show max 7 page numbers

        if (totalPages <= maxPagesToShow) {
          // Show all pages if total is small
          for (let i = 1; i <= totalPages; i++) {
            pages.push({
              number: i,
              isCurrent: i === currentPage,
              isEllipsis: false
            });
          }
        } else {
          // Show first page
          pages.push({
            number: 1,
            isCurrent: 1 === currentPage,
            isEllipsis: false
          });

          // Calculate range around current page
          let startPage = Math.max(2, currentPage - 2);
          let endPage = Math.min(totalPages - 1, currentPage + 2);

          // Add ellipsis after first page if needed
          if (startPage > 2) {
            pages.push({ isEllipsis: true });
          }

          // Add middle pages
          for (let i = startPage; i <= endPage; i++) {
            pages.push({
              number: i,
              isCurrent: i === currentPage,
              isEllipsis: false
            });
          }

          // Add ellipsis before last page if needed
          if (endPage < totalPages - 1) {
            pages.push({ isEllipsis: true });
          }

          // Show last page
          pages.push({
            number: totalPages,
            isCurrent: totalPages === currentPage,
            isEllipsis: false
          });
        }

        return pages;
      };

      // Get translated category name (reuse currentLanguage from above)
      const translatedCategoryName = category ? (getCategoryName(category, currentLanguage) || category.name) : '';

      // Get selected price range if any
      const selectedPriceRange = selectedFilters?.priceRange;
      const currentPriceMin = selectedPriceRange?.[0] ?? formattedFilters.price?.min;
      const currentPriceMax = selectedPriceRange?.[1] ?? formattedFilters.price?.max;

      const variableContext = {
        category: category ? {
          ...category,
          name: translatedCategoryName
        } : null,
        products: formattedProducts,
        filters: {
          ...formattedFilters,
          price: formattedFilters.price ? {
            ...formattedFilters.price,
            currentMin: currentPriceMin,
            currentMax: currentPriceMax
          } : null
        },
        selectedFilters: selectedFilters || {},
        activeFilters: categoryContext.activeFilters || [],
        pagination: (() => {
          const total = Number(categoryContext.filteredProductsCount) || 0;
          const start = (currentPage - 1) * itemsPerPage + 1;
          const end = Math.min(currentPage * itemsPerPage, total);
          // Build the product count text with proper singular/plural (lowercase)
          let countText;
          if (total === 0) {
            countText = t('category.no_products_found', 'No products found');
          } else if (total === 1) {
            countText = `1 ${t('common.product', 'product').toLowerCase()}`;
          } else if (start === 1 && end === total) {
            // All products on one page
            countText = `${total} ${t('common.products', 'products').toLowerCase()}`;
          } else {
            // Paginated: "1-8 of 9 products"
            countText = `${start}-${end} ${t('common.of', 'of')} ${total} ${t('common.products', 'products').toLowerCase()}`;
          }

          return {
            start,
            end,
            total,
            countText, // Pre-formatted product count text
            currentPage,
            totalPages,
            hasPrev: currentPage > 1,
            hasNext: currentPage < totalPages,
            prevPage: currentPage - 1,
            nextPage: currentPage + 1,
            pages: buildPagesArray() // Add pages array for template
          };
        })(),
        sorting: {
          current: sortOption
        },
        settings: settingsForCategoryPage,
        translations, // Add translations from TranslationContext
        // Filter UI translations for templates
        filterTranslations: {
          filter_by: t('common.filter_by', 'Filter By'),
          clear_all: t('common.clear_all', 'Clear All'),
          price: t('common.price', 'Price')
        },
        filterOptionStyles: filterOptionStyles,
        attributeLabelStyles: attributeLabelStyles,
        activeFilterStyles: activeFilterStyles
      };

      // Special handling for breadcrumbs - pass styles directly and slots at top level
      const contextToPass = id === 'breadcrumbs_content'
        ? {
            ...categoryContext,
            slots, // Ensure slots object is passed
            breadcrumbStyles: slots?.breadcrumb_styles?.styles || {}, // Pass styles directly too
            allSlots: slots // Also pass as allSlots for direct access
          }
        : {
            ...categoryContext,
            slots,
            allSlots: slots // Pass allSlots to all components, not just breadcrumbs
          };

      // Use the registered component's render method
      try {
        const result = registeredComponent.render({
          slot,
          categoryContext: contextToPass,
          variableContext,
          context: 'storefront',
          className,
          styles,
          viewMode, // Pass viewMode to components
          allSlots: slots // Also pass allSlots as a direct prop
        });
        return result;
      } catch (error) {
        console.error('🔍 Error in registeredComponent.render:', error);
        return null;
      }
    }

    // Helper function to wrap content with parent class if needed
    const wrapWithParentClass = (children) => {
      if (parentClassName) {
        return <div className={parentClassName}>{children}</div>;
      }
      return children;
    };

    // Handle category image
    if (id === 'category_image') {
      const imageUrl = category?.image || category?.image_url;

      if (!imageUrl && !content) return null;

      return wrapWithParentClass(
        <div className={className || "relative w-full h-64 mb-6 rounded-lg overflow-hidden"} style={styles}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={category?.name || 'Category'}
              className="w-full h-full object-cover"
            />
          ) : content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : null}
        </div>
      );
    }

    // Handle category header content - with dynamic content from categoryContext
    if (id === 'category_header' || id === 'header' || id === 'category_title') {
      // Use content from slot if provided, otherwise use translated category name
      const currentLanguage = getCurrentLanguage();
      const translatedCategoryName = category ? (getCategoryName(category, currentLanguage) || category.name) : '';

      // Process template variables if content contains them
      const headerVariableContext = {
        category: category ? {
          ...category,
          name: translatedCategoryName
        } : null,
        settings,
        store
      };

      // If content exists, process variables; otherwise use translated name directly
      const headerContent = content
        ? processVariables(content, headerVariableContext)
        : translatedCategoryName || 'Products';

      return wrapWithParentClass(
        <h1 className={className} style={styles}>
          {headerContent}
        </h1>
      );
    }

    if (id === 'category_description' || id === 'header_description') {
      // Use content from slot if provided, otherwise use category description
      const descContent = content || category?.description || '';

      if (!descContent) return null;

      // Process template variables including translations
      const descVariableContext = {
        category,
        settings,
        store
      };
      const processedDescContent = processVariables(descContent, descVariableContext);

      return wrapWithParentClass(
        <p className={className} style={styles} dangerouslySetInnerHTML={{ __html: processedDescContent }} />
      );
    }

    // Breadcrumbs are now handled by CategoryBreadcrumbs component via ComponentRegistry
    // No direct rendering needed here

    // Search bar
    if (id === 'search_bar') {
      return wrapWithParentClass(
        <div className={className} style={styles}>
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder={content || "Search products..."}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
      );
    }

    // Main content container
    if (id === 'main_content_container') {
      return wrapWithParentClass(
        <div className={className || "w-full"} style={styles}>
          <CategorySlotRenderer
            slots={slots}
            parentId={slot.id}
            viewMode={viewMode}
            categoryContext={categoryContext}
          />
        </div>
      );
    }

    // Sorting controls container
    if (id === 'sorting_controls') {
      return wrapWithParentClass(
        <div className={className} style={styles}>
          <CategorySlotRenderer
            slots={slots}
            parentId={slot.id}
            viewMode={viewMode}
            categoryContext={categoryContext}
          />
        </div>
      );
    }

    // Product count info
    if (id === 'product_count_info') {
      // Use filteredProductsCount for accurate count after filtering
      const totalProducts = Number(filteredProductsCount) || allProducts?.length || 0;

      // Handle infinite scroll case
      if (itemsPerPage === -1) {
        return wrapWithParentClass(
          <div className={className} style={styles}>
            {totalProducts === 0 ? (
              t('category.no_products_found', 'No products found')
            ) : totalProducts === 1 ? (
              `1 ${t('common.product', 'product').toLowerCase()}`
            ) : (
              `${totalProducts} ${t('common.products', 'products').toLowerCase()}`
            )}
          </div>
        );
      }

      // Calculate pagination ranges correctly
      const currentPageNum = currentPage || 1;
      const startIndex = (currentPageNum - 1) * itemsPerPage + 1;
      const endIndex = Math.min(startIndex + (products?.length || 0) - 1, totalProducts);

      // Build the display text with proper singular/plural (lowercase)
      const getProductCountText = () => {
        if (totalProducts === 0) {
          return t('category.no_products_found', 'No products found');
        }
        if (totalProducts === 1) {
          return `1 ${t('common.product', 'product').toLowerCase()}`;
        }
        // If showing all products on one page
        if (startIndex === 1 && endIndex === totalProducts) {
          return `${totalProducts} ${t('common.products', 'products').toLowerCase()}`;
        }
        // Paginated: "1-8 of 9 products"
        return `${startIndex}-${endIndex} ${t('common.of', 'of')} ${totalProducts} ${t('common.products', 'products').toLowerCase()}`;
      };

      return wrapWithParentClass(
        <div className={className} style={styles}>
          {getProductCountText()}
        </div>
      );
    }

    // Sort selector
    if (id === 'sort_selector') {
      const sortOptions = [
        { value: '', label: 'Default' },
        { value: 'name-asc', label: 'Name A-Z' },
        { value: 'name-desc', label: 'Name Z-A' },
        { value: 'price-asc', label: 'Price Low to High' },
        { value: 'price-desc', label: 'Price High to Low' },
        { value: 'newest', label: 'Newest First' },
        { value: 'oldest', label: 'Oldest First' }
      ];

      return wrapWithParentClass(
        <div className={className} style={styles}>
          <Label className="text-sm font-medium">Sort by:</Label>
          <select
            value={sortOption || ''}
            onChange={(e) => handleSortChange && handleSortChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // NOTE: products_grid and product_items now use ComponentRegistry with templates from category-config.js
    // The old hardcoded ProductItemCard rendering has been removed

    // Handle product_item_card slot specifically
    if (id === 'product_item_card') {
      // Get configuration from slot content or use defaults
      const itemsToShow = slot.metadata?.itemsToShow || 3;
      const productsToShow = products.slice(0, itemsToShow);

      // Use the className from slot configuration if available, otherwise use dynamic grid
      const dynamicGridClass = getDynamicGridClasses(slot);
      const finalClassName = className || dynamicGridClass;

      // Create slot configuration object for ProductItemCard
      const slotConfig = {
        productTemplate: slots?.product_template || {},
        productImage: slots?.product_image || {},
        productName: slots?.product_name || {},
        productPrice: slots?.product_price || {},
        productComparePrice: slots?.product_compare_price || {},
        productAddToCart: slots?.product_add_to_cart || {}
      };

      return wrapWithParentClass(
        <div className={`${finalClassName} mb-8`} style={styles}>
          {productsToShow.map(product => (
            <ProductItemCard
              key={product.id}
              product={product}
              settings={settingsForCategoryPage}
              store={store}
              taxes={taxes}
              selectedCountry={selectedCountry}
              productLabels={productLabels}
              viewMode={viewMode}
              slotConfig={slotConfig}
              pageType="category"
              onAddToCartStateChange={(isAdding) => {
                // Handle add to cart state change
              }}
            />
          ))}
        </div>
      );
    }

    // Products container
    if (id === 'products_container') {
      return wrapWithParentClass(
        <div className={className || "w-full"} style={styles}>
          <CategorySlotRenderer
            slots={slots}
            parentId={slot.id}
            viewMode={viewMode}
            categoryContext={categoryContext}
          />
        </div>
      );
    }

    // Pagination container
    if (id === 'pagination_container' || id === 'pagination_controls') {
      if (!totalPages || totalPages <= 1) return null;

      const pages = [];
      const maxPagesToShow = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

      if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }

      // Previous button
      if (currentPage > 1) {
        pages.push(
          <Button
            key="prev"
            variant="outline"
            size="sm"
            onClick={() => handlePageChange && handlePageChange(currentPage - 1)}
          >
            Previous
          </Button>
        );
      }

      // Page numbers
      for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <Button
            key={i}
            variant={currentPage === i ? "default" : "outline"}
            size="sm"
            onClick={() => handlePageChange && handlePageChange(i)}
          >
            {i}
          </Button>
        );
      }

      // Next button
      if (currentPage < totalPages) {
        pages.push(
          <Button
            key="next"
            variant="outline"
            size="sm"
            onClick={() => handlePageChange && handlePageChange(currentPage + 1)}
          >
            Next
          </Button>
        );
      }

      return wrapWithParentClass(
        <div className={className} style={styles}>
          {pages}
        </div>
      );
    }

    // Handle container types (grid, flex, container)
    if (type === 'container' || type === 'grid' || type === 'flex') {
      const containerClass = type === 'grid' ? 'grid grid-cols-12 gap-2' :
                            type === 'flex' ? 'flex' : '';
      return (
        <div className={`${containerClass} ${className}`} style={styles}>
          <CategorySlotRenderer
            slots={slots}
            parentId={slot.id}
            viewMode={viewMode}
            categoryContext={categoryContext}
          />
        </div>
      );
    }

    // Handle basic element types
    switch (type) {
      case 'text':
        // Process template variables in text content using variableContext
        const currentLanguage = getCurrentLanguage();
        const translatedCategoryName = getCategoryName(category, currentLanguage);
        const attributeCategoryName = category?.attributes?.name;
        const directCategoryName = category?.name;
        const finalCategoryName = translatedCategoryName || attributeCategoryName || directCategoryName || '';

        const textVariableContext = {
          category: category ? {
            ...category,
            name: finalCategoryName
          } : null,
          settings,
          store
        };
        const processedContent = processVariables(content || '', textVariableContext);

        return (
          <div
            className={className}
            style={styles}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        );

      case 'image':
        return (
          <img
            src={content || 'https://via.placeholder.com/300x200'}
            alt="Category content"
            className={className}
            style={styles}
          />
        );

      case 'button':
        return (
          <Button
            className={className}
            style={styles}
          >
            {content || 'Button'}
          </Button>
        );

      case 'cms_block':
        return (
          <div className={className} style={styles}>
            <CmsBlockRenderer position={slot.metadata?.cmsPosition || 'undefined'} />
          </div>
        );

      case 'breadcrumbs':
        // Breadcrumbs are now handled by CategoryBreadcrumbs/ProductBreadcrumbs components via ComponentRegistry
        return null;

      default:
        // For any unknown slot type, render as text
        return (
          <div className={className} style={styles}>
            {content || `[${type} slot]`}
          </div>
        );
    }
  };

  // Main render function - follows CartSlotRenderer structure
  return (
    <>
      {sortedSlots.map((slot) => {
        // Handle number, object with viewMode, and Tailwind responsive classes
        let colSpanClass = 'col-span-12'; // default Tailwind class
        let gridColumn = 'span 12 / span 12'; // default grid style

        if (typeof slot.colSpan === 'number') {
          // Old format: direct number
          colSpanClass = `col-span-${slot.colSpan}`;
          gridColumn = `span ${slot.colSpan} / span ${slot.colSpan}`;
        } else if (typeof slot.colSpan === 'object' && slot.colSpan !== null) {
          // New format: object with viewMode keys
          const viewModeValue = slot.colSpan[viewMode];

          if (typeof viewModeValue === 'number') {
            // Simple viewMode: number format
            colSpanClass = `col-span-${viewModeValue}`;
            gridColumn = `span ${viewModeValue} / span ${viewModeValue}`;
          } else if (typeof viewModeValue === 'string') {
            // Tailwind responsive class format: 'col-span-12 lg:col-span-8'
            colSpanClass = viewModeValue;
            // For Tailwind classes, we don't set gridColumn as it will be handled by CSS
            gridColumn = null;
          } else if (typeof viewModeValue === 'object' && viewModeValue !== null) {
            // Legacy nested breakpoint format: { mobile: 12, tablet: 12, desktop: 8 }
            const colSpanValue = viewModeValue.desktop || viewModeValue.tablet || viewModeValue.mobile || 12;
            colSpanClass = `col-span-${colSpanValue}`;
            gridColumn = `span ${colSpanValue} / span ${colSpanValue}`;
          }
        }

        return (
          <div
            key={slot.id}
            className={colSpanClass}
            style={{
              ...(gridColumn ? { gridColumn } : {}),
              ...slot.containerStyles
            }}
          >
            {renderSlotContent(slot)}
          </div>
        );
      })}
    </>
  );
}