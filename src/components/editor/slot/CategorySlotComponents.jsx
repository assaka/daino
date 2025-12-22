/**
 * Category Slot Components - Component Library for Category Page
 *
 * ARCHITECTURE FLOW:
 * CategorySlotRenderer (formats data)
 *   → ComponentRegistry.get('ProductItemsGrid')
 *     → THIS FILE - ProductItemsGrid.render() (uses formatted data)
 *       → UnifiedSlotRenderer (renders individual slot elements)
 *         → processVariables (replaces {{template}} variables)
 *
 * PURPOSE:
 * - Registers all category-specific slot components
 * - Provides dual-mode rendering (editor + storefront)
 * - Uses pre-formatted data from CategorySlotRenderer
 *
 * REGISTERED COMPONENTS:
 * - ProductItemsGrid:    Main product grid (dual rendering path)
 * - LayeredNavigation:   Filters sidebar (price, attributes)
 * - ActiveFilters:       Selected filters display
 * - SortSelector:        Sort dropdown
 * - PaginationComponent: Page navigation
 * - ProductCountInfo:    "Showing X-Y of Z products"
 * - ViewModeToggle:      Grid/List switcher
 *
 * DUAL RENDERING PATHS:
 *
 * Path 1: HTML Template (category-config.js content)
 * - slot.content contains '{{#each products}}...'
 * - Uses processVariables() to replace {{variables}}
 * - Renders as HTML string with dangerouslySetInnerHTML
 *
 * Path 2: Slot-based (product_card_template slots)
 * - Uses UnifiedSlotRenderer for React components
 * - Renders individual product card slots
 * - More flexible, allows per-element customization
 *
 * CRITICAL: Price Handling
 * - DO NOT format prices in this file
 * - Use pre-formatted prices from variableContext.products
 * - CategorySlotRenderer already called getPriceDisplay()
 * - Products have: price_formatted, compare_price_formatted
 *
 * DUAL MODE SUPPORT:
 * - Editor mode (context='editor'):   Shows sample data, allows editing
 * - Storefront mode (context='storefront'): Shows real data, read-only
 *
 * @see CategorySlotRenderer.jsx - Formats data before passing to components
 * @see category-config.js - Template definitions with {{variables}}
 * @see UnifiedSlotRenderer.jsx - Renders individual slot elements
 * @see variableProcessor.js - Replaces {{template}} variables
 */

import React, { useRef, useEffect, Fragment, useState, useCallback } from 'react';
import { createSlotComponent, registerSlotComponent } from './SlotComponentRegistry';
import CmsBlockRenderer from '@/components/storefront/CmsBlockRenderer';
import { useStore } from '@/components/storefront/StoreProvider';
import { UnifiedSlotRenderer } from './UnifiedSlotRenderer';
import { processVariables } from '@/utils/variableProcessor';
import { formatPrice, formatPriceNumber, safeNumber } from '@/utils/priceUtils';
import { getStockLabel, getStockLabelStyle } from '@/utils/stockUtils';
import { useTranslation } from '@/contexts/TranslationContext';
import ProductLabelComponent from '@/components/storefront/ProductLabel';

// Active Filters Component with processVariables
const ActiveFilters = createSlotComponent({
  name: 'ActiveFilters',
  render: ({ slot, className, styles, categoryContext, variableContext, context }) => {
    const containerRef = useRef(null);

    // Use template from slot.content or fallback
    const template = slot?.content || `
      {{#if activeFilters}}
        <div class="mb-4">
          <div class="flex flex-wrap gap-2">
            {{#each activeFilters}}
              <div class="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                <span>{{this.label}}: {{this.value}}</span>
                <button class="ml-1 hover:text-blue-900"
                        data-action="remove-filter"
                        data-filter-type="{{this.type}}"
                        data-filter-value="{{this.value}}">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            {{/each}}
            {{#if (gt activeFilters.length 1)}}
              <button class="text-sm text-red-600 hover:text-red-800 underline ml-2"
                      data-action="clear-all-filters">
                Clear All
              </button>
            {{/if}}
          </div>
        </div>
      {{/if}}
    `;

    const html = processVariables(template, variableContext || {});

    // Attach event listeners in storefront
    useEffect(() => {
      if (!containerRef.current || context === 'editor') return;

      const handleClick = (e) => {
        const removeBtn = e.target.closest('[data-action="remove-filter"]');
        const clearAllBtn = e.target.closest('[data-action="clear-all-filters"]');

        if (removeBtn && categoryContext?.handleFilterChange) {
          const filterType = removeBtn.getAttribute('data-filter-type');
          const filterValue = removeBtn.getAttribute('data-filter-value');
          const attributeCode = removeBtn.getAttribute('data-attribute-code');

          // Get current filters
          const currentFilters = categoryContext.selectedFilters || {};

          if (filterType === 'attribute' && attributeCode) {
            // Remove this specific value from the attribute's array
            const currentValues = currentFilters[attributeCode] || [];
            const newValues = currentValues.filter(v => v !== filterValue);

            const newFilters = { ...currentFilters };
            if (newValues.length > 0) {
              newFilters[attributeCode] = newValues;
            } else {
              delete newFilters[attributeCode];
            }

            categoryContext.handleFilterChange(newFilters);
          }
        } else if (clearAllBtn && categoryContext?.clearFilters) {
          categoryContext.clearFilters();
        }
      };

      containerRef.current.addEventListener('click', handleClick);
      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('click', handleClick);
        }
      };
    }, [categoryContext, context]);

    return (
      <div ref={containerRef} className={className || slot.className} style={styles || slot.styles}
           dangerouslySetInnerHTML={{ __html: html }} />
    );
  }
});

// Import the actual LayeredNavigation component from storefront
import StorefrontLayeredNavigation from '@/components/storefront/LayeredNavigation';

// Layered Navigation Component - uses the same component as storefront
const LayeredNavigation = createSlotComponent({
  name: 'LayeredNavigation',
  render: ({ slot, className, styles, categoryContext, variableContext, context, allSlots, onElementClick }) => {
    // Use the actual LayeredNavigation component for both editor and storefront
    // This ensures identical behavior and appearance
    // IMPORTANT: Use allProducts (unfiltered) for LayeredNavigation so filter options remain visible after filtering
    const products = categoryContext?.allProducts || variableContext?.allProducts || categoryContext?.products || variableContext?.products || [];
    const filterableAttributes = categoryContext?.filterableAttributes || variableContext?.filterableAttributes || [];
    const settings = categoryContext?.settings || variableContext?.settings || {};
    const selectedFilters = categoryContext?.selectedFilters || {};
    const activeFiltersArray = categoryContext?.activeFilters || [];

    // In editor mode, we disable filter interactions but show the real UI
    const isEditMode = context === 'editor';

    // Use actual handleFilterChange for storefront, no-op for editor
    const handleFilterChange = isEditMode
      ? () => {}
      : (categoryContext?.handleFilterChange || (() => {}));

    // Clear filters handler
    const handleClearFilters = isEditMode
      ? () => {}
      : (categoryContext?.clearFilters || (() => {}));

    // Collect child slots for LayeredNavigation (filter_heading, attribute_filter_label, etc.)
    const childSlots = {};
    if (allSlots) {
      Object.values(allSlots).forEach(childSlot => {
        if (childSlot.parentId === 'layered_navigation' || childSlot.parentId === slot?.id) {
          childSlots[childSlot.id] = childSlot;
        }
      });
    }

    // Build slotConfig in the format StorefrontLayeredNavigation expects
    // It expects child slots like filter_option_styles, filter_by_label, etc. inside slotConfig
    const slotConfig = {
      ...slot,
      filter_by_label: childSlots.filter_heading || childSlots.filter_by_label || { content: 'Filter By' },
      filter_card_header: childSlots.filter_heading || { content: 'Filter By' },
      filter_price_title: childSlots.price_filter_label || { content: 'Price' },
      filter_option_styles: childSlots.filter_option_styles || { styles: {} },
      filter_attribute_titles: {
        attribute_filter_label: childSlots.attribute_filter_label || {}
      }
    };

    // Handle element click - opens sidebar when clicking on editable elements in edit mode
    const handleElementClick = (slotKey, element) => {
      if (isEditMode && onElementClick) {
        // Call the parent's onElementClick handler
        onElementClick(slotKey, element);
      }
    };

    // Handle click on the main wrapper - opens LayeredNavigation sidebar
    const handleWrapperClick = (e) => {
      if (isEditMode && onElementClick) {
        // Only trigger if clicking directly on the wrapper or card, not on specific editable elements
        const clickedElement = e.target;
        const isEditableElement = clickedElement.closest('[data-slot-id]');

        if (!isEditableElement) {
          // Click on non-editable area - open the LayeredNavigation sidebar
          onElementClick('layered_navigation', e.currentTarget);
        }
      }
    };

    return (
      <div
        className={className || slot?.className}
        style={styles || slot?.styles}
        data-slot-id="layered_navigation"
        data-editable="true"
        onClick={handleWrapperClick}
      >
        <StorefrontLayeredNavigation
          products={products}
          attributes={filterableAttributes}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          selectedFilters={selectedFilters}
          activeFilters={activeFiltersArray}
          showActiveFilters={true}
          slotConfig={slotConfig}
          settings={settings}
          isEditMode={isEditMode}
          childSlots={childSlots}
          onElementClick={handleElementClick}
        />
      </div>
    );
  }
});

// Sort Selector Component - React-based for proper translations
const SortSelector = createSlotComponent({
  name: 'SortSelector',
  render: ({ slot, className, styles, categoryContext, variableContext, context }) => {
    const { t } = useTranslation();
    const currentSort = variableContext?.sorting?.current || categoryContext?.sortOption || '';

    // Sort options with translations
    const sortOptions = [
      { value: '', label: t('common.sort_default', 'Default') },
      { value: 'name-asc', label: t('common.sort_name_asc', 'Name (A-Z)') },
      { value: 'name-desc', label: t('common.sort_name_desc', 'Name (Z-A)') },
      { value: 'price-asc', label: t('common.sort_price_asc', 'Price (Low to High)') },
      { value: 'price-desc', label: t('common.sort_price_desc', 'Price (High to Low)') },
      { value: 'newest', label: t('common.sort_newest', 'Newest First') },
      { value: 'oldest', label: t('common.sort_oldest', 'Oldest First') }
    ];

    const handleChange = (e) => {
      if (categoryContext?.handleSortChange) {
        categoryContext.handleSortChange(e.target.value);
      }
    };

    return (
      <div className={className || slot.className} style={styles || slot.styles}>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 font-medium">
            {t('common.sort_by', 'Sort by:')}
          </label>
          <select
            className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
            value={currentSort}
            onChange={handleChange}
            disabled={context === 'editor'}
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }
});

// Pagination Component - React-based with customizable styles from settings
const PaginationComponent = createSlotComponent({
  name: 'PaginationComponent',
  render: ({ slot, className, styles, categoryContext, variableContext, context }) => {
    // Get pagination data - check variableContext first (from preprocessedData), then categoryContext
    const totalPages = variableContext?.pagination?.totalPages || variableContext?.totalPages || categoryContext?.pagination?.totalPages || categoryContext?.totalPages || 0;
    const currentPage = variableContext?.pagination?.currentPage || variableContext?.currentPage || categoryContext?.pagination?.currentPage || categoryContext?.currentPage || 1;
    const hasPrev = currentPage > 1;
    const hasNext = currentPage < totalPages;

    if (totalPages <= 1 && context !== 'editor') {
      return null;
    }

    const handlePageChange = (page) => {
      if (categoryContext?.handlePageChange) {
        categoryContext.handlePageChange(page);
      }
    };

    // Get pagination settings - slot styles take precedence over store settings
    // Slot styles are synced from Admin Theme&Layout when saved
    const slotStyles = slot?.styles || styles || {};
    const storeSettings = categoryContext?.settings?.pagination || variableContext?.settings?.pagination || {};

    // Extract customizable styles: slot styles first (synced from admin), then store settings, then defaults
    const buttonBgColor = slotStyles.buttonBgColor || storeSettings.buttonBgColor || '#FFFFFF';
    const buttonTextColor = slotStyles.buttonTextColor || storeSettings.buttonTextColor || '#374151';
    const buttonBorderColor = slotStyles.buttonBorderColor || storeSettings.buttonBorderColor || '#D1D5DB';
    const buttonHoverBgColor = slotStyles.buttonHoverBgColor || storeSettings.buttonHoverBgColor || '#F3F4F6';
    const activeBgColor = slotStyles.activeBgColor || storeSettings.activeBgColor || '#3B82F6';
    const activeTextColor = slotStyles.activeTextColor || storeSettings.activeTextColor || '#FFFFFF';

    // Ensure className is a string and styles is an object
    const finalClassName = typeof className === 'string' ? className : (typeof slot?.className === 'string' ? slot?.className : '');

    const buttonBaseStyle = {
      backgroundColor: buttonBgColor,
      color: buttonTextColor,
      border: `1px solid ${buttonBorderColor}`,
      borderRadius: '0.375rem',
      padding: '0.5rem 0.75rem',
      fontSize: '0.875rem',
      cursor: 'pointer',
      transition: 'background-color 0.2s',
    };

    const disabledButtonStyle = {
      ...buttonBaseStyle,
      opacity: '0.5',
      cursor: 'not-allowed',
    };

    const activeButtonStyle = {
      ...buttonBaseStyle,
      backgroundColor: activeBgColor,
      color: activeTextColor,
      borderColor: activeBgColor,
    };

    // Build page numbers array with ellipsis for many pages
    const buildPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;

      if (totalPages <= maxVisiblePages + 2) {
        // Show all pages if total is small
        for (let i = 1; i <= totalPages; i++) {
          pages.push({ number: i, isEllipsis: false });
        }
      } else {
        // Always show first page
        pages.push({ number: 1, isEllipsis: false });

        // Calculate range around current page
        let startPage = Math.max(2, currentPage - 1);
        let endPage = Math.min(totalPages - 1, currentPage + 1);

        // Adjust if at the beginning
        if (currentPage <= 3) {
          startPage = 2;
          endPage = Math.min(4, totalPages - 1);
        }

        // Adjust if at the end
        if (currentPage >= totalPages - 2) {
          startPage = Math.max(2, totalPages - 3);
          endPage = totalPages - 1;
        }

        // Add ellipsis before middle pages if needed
        if (startPage > 2) {
          pages.push({ isEllipsis: true });
        }

        // Add middle pages
        for (let i = startPage; i <= endPage; i++) {
          pages.push({ number: i, isEllipsis: false });
        }

        // Add ellipsis after middle pages if needed
        if (endPage < totalPages - 1) {
          pages.push({ isEllipsis: true });
        }

        // Always show last page
        pages.push({ number: totalPages, isEllipsis: false });
      }

      return pages;
    };

    const pageNumbers = buildPageNumbers();

    return (
      <div className={finalClassName}>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {/* Previous Button */}
              <button
                style={hasPrev ? buttonBaseStyle : disabledButtonStyle}
                onClick={() => hasPrev && handlePageChange(currentPage - 1)}
                disabled={!hasPrev || context === 'editor'}
                onMouseEnter={(e) => hasPrev && (e.target.style.backgroundColor = buttonHoverBgColor)}
                onMouseLeave={(e) => hasPrev && (e.target.style.backgroundColor = buttonBgColor)}
              >
                Previous
              </button>

              {/* Page Numbers */}
              {pageNumbers.map((page, index) => (
                page.isEllipsis ? (
                  <span key={`ellipsis-${index}`} style={{ padding: '0.5rem 0.5rem', color: buttonTextColor }}>
                    ...
                  </span>
                ) : (
                  <button
                    key={page.number}
                    style={page.number === currentPage ? activeButtonStyle : buttonBaseStyle}
                    onClick={() => page.number !== currentPage && handlePageChange(page.number)}
                    disabled={context === 'editor'}
                    onMouseEnter={(e) => page.number !== currentPage && (e.target.style.backgroundColor = buttonHoverBgColor)}
                    onMouseLeave={(e) => page.number !== currentPage && (e.target.style.backgroundColor = buttonBgColor)}
                  >
                    {page.number}
                  </button>
                )
              ))}

              {/* Next Button */}
              <button
                style={hasNext ? buttonBaseStyle : disabledButtonStyle}
                onClick={() => hasNext && handlePageChange(currentPage + 1)}
                disabled={!hasNext || context === 'editor'}
                onMouseEnter={(e) => hasNext && (e.target.style.backgroundColor = buttonHoverBgColor)}
                onMouseLeave={(e) => hasNext && (e.target.style.backgroundColor = buttonBgColor)}
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>
    );
  }
});

// CMS Block Renderer (already exists, just register it)
const CmsBlockComponent = createSlotComponent({
  name: 'CmsBlockRenderer',
  render: ({ slot, className, styles }) => {
    const position = slot.metadata?.cmsPosition || slot.id || 'default';
    return (
      <div className={className || slot.className} style={styles || slot.styles}>
        <CmsBlockRenderer position={position} />
      </div>
    );
  }
});

// Helper function to generate grid classes from store settings
const getGridClasses = (storeSettings) => {
  const gridConfig = storeSettings?.product_grid;

  if (!gridConfig) {
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';
  }

  const breakpoints = gridConfig.breakpoints || {};
  const customBreakpoints = gridConfig.customBreakpoints || [];
  let classes = [];

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

  return classes.length > 0 ? classes.join(' ') : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';
};

// Product Count Info Component
const ProductCountInfo = createSlotComponent({
  name: 'ProductCountInfo',
  render: ({ slot, className, styles, categoryContext, variableContext, context }) => {
    // Use pre-formatted countText from variableContext.pagination or categoryContext
    let countText = variableContext?.pagination?.countText || categoryContext?.pagination?.countText || '';

    // Fallback: Calculate count text if not provided
    if (!countText) {
      const pagination = variableContext?.pagination || categoryContext?.pagination || {};
      const currentPage = pagination.currentPage || variableContext?.currentPage || categoryContext?.currentPage || 1;
      const itemsPerPage = pagination.itemsPerPage || variableContext?.itemsPerPage || categoryContext?.itemsPerPage || 12;
      const totalProducts = pagination.totalProducts ||
        variableContext?.filteredProductsCount ||
        categoryContext?.filteredProductsCount ||
        variableContext?.products?.length ||
        categoryContext?.products?.length || 0;

      if (totalProducts > 0 || context === 'editor') {
        // In editor mode with no data, use sample count
        const displayTotal = totalProducts > 0 ? totalProducts : 24;
        const startIndex = ((currentPage - 1) * itemsPerPage) + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, displayTotal);
        const productWord = displayTotal === 1 ? 'product' : 'products';

        if (startIndex === 1 && endIndex === displayTotal) {
          // Showing all products on one page: "8 products" or "1 product"
          countText = `${displayTotal} ${productWord}`;
        } else {
          // Paginated: "12-24 of 24 products"
          countText = `${startIndex}-${endIndex} of ${displayTotal} ${productWord}`;
        }
      } else {
        countText = 'No products found';
      }
    }

    return (
      <div className={className || slot?.className} style={styles || slot?.styles}>
        <div className="text-sm text-gray-600">
          {countText}
        </div>
      </div>
    );
  }
});

/**
 * Helper function to render product labels for a product
 * Matches the logic in ProductItemCard.jsx for consistency
 */
const renderProductLabelsForProduct = (product, productLabels = []) => {
  // Filter labels that match the product conditions
  const matchingLabels = productLabels?.filter((label) => {
    let shouldShow = true; // Assume true, prove false (AND logic)

    if (label.conditions && Object.keys(label.conditions).length > 0) {
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
              const productAttributeValue = String(attr.value).toLowerCase();
              const conditionValue = String(cond.attribute_value).toLowerCase();
              return productAttributeValue === conditionValue;
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
  }) || [];

  // Group labels by position and show one label per position
  const labelsByPosition = matchingLabels.reduce((acc, label) => {
    const position = label.position || 'top-right';
    if (!acc[position]) {
      acc[position] = [];
    }
    acc[position].push(label);
    return acc;
  }, {});

  // For each position, sort by sort_order (ASC) then by priority (DESC) and take the first one
  const labelsToShow = Object.values(labelsByPosition).map(positionLabels => {
    const sortedLabels = positionLabels.sort((a, b) => {
      const sortOrderA = a.sort_order || 0;
      const sortOrderB = b.sort_order || 0;
      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB; // ASC
      }
      const priorityA = a.priority || 0;
      const priorityB = b.priority || 0;
      return priorityB - priorityA; // DESC
    });
    return sortedLabels[0]; // Return highest priority label for this position
  }).filter(Boolean);

  // Render all labels (one per position)
  return labelsToShow.map(label => (
    <ProductLabelComponent
      key={label.id}
      label={label}
    />
  ));
};

/**
 * ProductItemsGrid Component - Main Product Display Grid
 *
 * DUAL RENDERING PATHS:
 *
 * 1. HTML Template Path (most common):
 *    - slot.content has HTML template with {{variables}}
 *    - Uses processVariables() for Handlebars-like replacement
 *    - Renders: {{#each products}} loops, {{#if}} conditionals
 *    - Output: HTML string rendered with dangerouslySetInnerHTML
 *
 * 2. Slot-based Path (for advanced customization):
 *    - Uses product_card_template slots from allSlots
 *    - Renders individual React components via UnifiedSlotRenderer
 *    - Allows per-element editing in page builder
 *    - Output: React component tree
 *
 * CRITICAL: Data Flow
 * - Input: variableContext.products (ALREADY FORMATTED by CategorySlotRenderer)
 * - Products have:
 *   ✅ price_formatted        (lowest price with currency)
 *   ✅ compare_price_formatted (highest price, only if on sale)
 *   ✅ stock_label            ('In Stock' or 'Out of Stock')
 *   ✅ stock_label_class      (CSS classes for label)
 *   ✅ image_url, url, in_stock, labels
 *
 * - DO NOT re-format prices here (was causing bugs)
 * - Just pass through formatted values to template/renderer
 *
 * MODES:
 * - Editor:     Uses sample products, shows all slots, allows editing
 * - Storefront: Uses real products, hides empty slots, read-only
 *
 * @param {Object} variableContext - Contains pre-formatted products
 * @param {string} context - 'editor' or 'storefront'
 * @param {Object} allSlots - All slot configurations (for slot-based path)
 */
const ProductItemsGrid = createSlotComponent({
  name: 'ProductItemsGrid',
  render: ({
    slot,
    className,
    styles,
    context,
    categoryContext,
    variableContext,
    allSlots,
    onElementClick,
    setPageConfig,
    saveConfiguration,
    // Editor grid props
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
    viewMode = 'grid' // Add viewMode prop with default
  }) => {
    const containerRef = useRef(null);
    const isEditor = context === 'editor';

    // UNIFIED: Same logic for both editor and storefront
    const storeContext = useStore();
    const storeSettings = storeContext?.settings || null;
    const gridClasses = viewMode === 'list' ? 'grid-cols-1' : getGridClasses(storeSettings);

    // Get products - use pre-formatted from variableContext, limit to 6 in editor
    const allProductsRaw = variableContext?.products || categoryContext?.products || [];
    const products = isEditor ? allProductsRaw.slice(0, 6) : allProductsRaw;

    const { t } = useTranslation();

    // Check if filters are actively applied (storefront only)
    const selectedFilters = variableContext?.selectedFilters || categoryContext?.selectedFilters || {};
    const hasActiveFilters = Object.keys(selectedFilters).length > 0;
    const allProducts = categoryContext?.allProducts || [];
    const categoryHasProducts = allProducts.length > 0;

    // Show "no products" message in editor
    if (products.length === 0 && isEditor) {
      return (
        <div className={`${className || slot.className || ''}`} style={styles || slot.styles}>
          <div className="p-4 border-2 border-dashed border-red-300 rounded-lg text-center">
            <div className="text-red-600 font-bold">Product Items Grid - No products available</div>
            <div className="text-xs text-gray-500 mt-2">
              Products: {allProductsRaw.length || 0}
            </div>
          </div>
        </div>
      );
    }

    // Show friendly message when no products match filters (storefront only)
    if (products.length === 0 && !isEditor && (hasActiveFilters || categoryHasProducts)) {
      return (
        <div className={`${className || slot.className || ''}`} style={styles || slot.styles}>
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 rounded-lg border border-gray-200">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {t('category.no_products_match', 'No products match your filters')}
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              {t('category.try_different_filters', 'Try adjusting your filters or clearing some selections to see more products.')}
            </p>
          </div>
        </div>
      );
    }

    // No products at all - let parent handle
    if (products.length === 0) {
      return null;
    }

    // Find product card template and descendants - same for both contexts
    const productCardTemplate = allSlots?.product_card_template;
    const productCardChildSlots = {};

    if (allSlots) {
      const collectDescendants = (parentId) => {
        Object.values(allSlots).forEach(s => {
          if (s.parentId === parentId) {
            productCardChildSlots[s.id] = s;
            collectDescendants(s.id);
          }
        });
      };
      collectDescendants('product_card_template');
    }

    // UNIFIED: Single rendering path for both editor and storefront
    return (
      <div className={`grid ${gridClasses} gap-4 ${className || slot.className || ''}`} style={styles || slot.styles}>
        {products.map((product, index) => {
          const productSlots = {};

          Object.entries(productCardChildSlots).forEach(([slotId, slotConfig]) => {
            const savedSlotConfig = allSlots[slotId];

            // Process styles - replace template variables
            const processedStyles = {};
            if (slotConfig.styles) {
              Object.entries(slotConfig.styles).forEach(([key, value]) => {
                processedStyles[key] = typeof value === 'string' ? processVariables(value, variableContext) : value;
              });
            }

            const processedSavedStyles = {};
            if (savedSlotConfig?.styles) {
              Object.entries(savedSlotConfig.styles).forEach(([key, value]) => {
                processedSavedStyles[key] = typeof value === 'string' ? processVariables(value, variableContext) : value;
              });
            }

            const finalStyles = savedSlotConfig ? { ...processedStyles, ...processedSavedStyles } : processedStyles;
            const finalClassName = savedSlotConfig?.className ?? slotConfig.className;
            const isEditableButton = slotConfig.type === 'button';
            const isTextSlot = slotConfig.type === 'text';
            const isImageSlot = slotConfig.type === 'image';

            // Process template variables in content
            let processedContent = slotConfig.content;
            if (isEditableButton) {
              processedContent = savedSlotConfig?.content || slotConfig.content || 'Button';
            } else if (isTextSlot || isImageSlot) {
              const productContext = {
                ...variableContext,
                this: product,
                product
              };
              processedContent = processVariables(slotConfig.content || '', productContext);
            }

            // Add stock label inline styles dynamically
            const dynamicStyles = slotConfig.id === 'product_card_stock_label' && product.stock_label_style
              ? { ...finalStyles, ...product.stock_label_style }
              : finalStyles;

            const finalColSpan = savedSlotConfig?.colSpan ?? slotConfig.colSpan;

            productSlots[slotId] = {
              ...slotConfig,
              // CRITICAL: Use colSpan from savedSlotConfig (allSlots) if available - this ensures resize updates are applied
              colSpan: finalColSpan,
              content: processedContent,
              className: finalClassName,
              styles: dynamicStyles,
              metadata: {
                ...(slotConfig.metadata || {}),
                ...(savedSlotConfig?.metadata || {}),
                // Editor-specific metadata
                ...(isEditor ? {
                  conditionalDisplay: undefined, // Show all slots in editor
                  styleOnly: !isEditableButton,
                  readOnly: isTextSlot,
                  textOnly: isEditableButton
                } : {})
              }
            };
          });

          // Get product labels from context
          const productLabels = variableContext?.productLabels || categoryContext?.productLabels || [];

          // Render product card - same structure for both contexts
          const productCard = (
            <div
              key={`product-${product.id || index}`}
              data-slot-id="product_card_template"
              data-editable="true"
              className={productCardTemplate?.className || ''}
              style={{ ...productCardTemplate?.styles, overflow: 'visible', width: '100%', position: 'relative' }}
            >
              {/* Product labels - positioned absolutely over the image */}
              {renderProductLabelsForProduct(product, productLabels)}
              <UnifiedSlotRenderer
                slots={productSlots}
                parentId="product_card_template"
                context={context}
                categoryData={{ ...categoryContext, product }}
                productData={{
                  product,
                  store: categoryContext?.store,
                  settings: variableContext?.settings
                }}
                variableContext={{ ...variableContext, this: product, product }}
                viewMode={viewMode}
                // Editor props - only passed when in editor context
                {...(isEditor ? {
                  mode: mode || "edit",
                  showBorders: showBorders !== undefined ? showBorders : true,
                  onElementClick,
                  setPageConfig,
                  saveConfiguration,
                  onGridResize,
                  onSlotDrop,
                  onSlotDelete,
                  onSlotHeightResize,
                  onResizeStart,
                  onResizeEnd,
                  currentDragInfo,
                  setCurrentDragInfo,
                  selectedElementId
                } : {})}
              />
            </div>
          );

          return productCard;
        })}
      </div>
    );
  }
});

// View Mode Toggle Component
const ViewModeToggle = createSlotComponent({
  name: 'ViewModeToggle',
  render: ({ slot, className, styles, categoryContext, context, viewMode: parentViewMode }) => {
    const containerRef = useRef(null);

    // Use viewMode from parent (Category.jsx) or default to 'grid'
    const currentViewMode = parentViewMode || 'grid';

    // In editor mode, just show the static UI
    if (context === 'editor') {
      return (
        <div className={className || slot.className} style={styles || slot.styles}>
          <div className="inline-flex sm:bg-gray-100 sm:rounded-lg sm:p-1 space-x-1">
            <button className="sm:px-3 sm:py-2 rounded-md text-sm font-medium sm:bg-white text-gray-900 sm:shadow-sm sm:border border-gray-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              <span>Grid</span>
            </button>
            <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span>List</span>
            </button>
          </div>
        </div>
      );
    }

    // Storefront mode with actual functionality
    const handleViewModeChange = (mode) => {
      if (categoryContext?.onViewModeChange) {
        categoryContext.onViewModeChange(mode);
      }
    };

      return (
      <div ref={containerRef} className={className || slot.className} style={styles || slot.styles}>
        <div className="inline-flex sm:bg-gray-100 sm:rounded-lg sm:p-1 space-x-1">
          <button
            onClick={() => handleViewModeChange('grid')}
            className={`sm:px-3 sm:py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              currentViewMode === 'grid'
                ? 'bg-white text-gray-900 sm:shadow-sm sm:border border-gray-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" strokeWidth="2" />
              <rect x="14" y="3" width="7" height="7" strokeWidth="2" />
              <rect x="3" y="14" width="7" height="7" strokeWidth="2" />
              <rect x="14" y="14" width="7" height="7" strokeWidth="2" />
            </svg>
            <span>Grid</span>
          </button>
          <button
            onClick={() => handleViewModeChange('list')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              currentViewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2" />
              <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2" />
              <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2" />
            </svg>
            <span>List</span>
          </button>
        </div>
      </div>
    );
  }
});

// Empty Products Message Component
// This component shows when the category itself has no products (not filtered)
const EmptyProductsMessage = createSlotComponent({
  name: 'EmptyProductsMessage',
  render: ({ slot, className, styles, categoryContext, variableContext, context }) => {
    const { t } = useTranslation();
    const products = variableContext?.products || categoryContext?.products || [];

    // Check if the category itself has any products (before filtering)
    const allProducts = categoryContext?.allProducts || [];
    const categoryHasProducts = allProducts.length > 0;

    // Check if filters are applied
    const selectedFilters = variableContext?.selectedFilters || categoryContext?.selectedFilters || {};
    const hasActiveFilters = Object.keys(selectedFilters).length > 0;

    // Only show this message when:
    // 1. There are no products to display AND
    // 2. The category itself is empty (no products at all, not due to filtering)
    // If filters are causing the empty result, ProductItemsGrid will show the "no match" message
    if (products.length > 0 || categoryHasProducts || hasActiveFilters) {
      return null;
    }

    return (
      <div className={`${className || slot.className || ''}`} style={styles || slot.styles}>
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 rounded-lg border border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {t('category.no_products', 'No products in this category')}
          </h3>
          <p className="text-gray-500 text-center max-w-md">
            {t('category.no_products_description', 'This category doesn\'t have any products yet. Check back soon or browse other categories.')}
          </p>
        </div>
      </div>
    );
  }
});

// Register components
registerSlotComponent('ActiveFilters', ActiveFilters);
registerSlotComponent('LayeredNavigation', LayeredNavigation);
registerSlotComponent('SortSelector', SortSelector);
registerSlotComponent('ViewModeToggle', ViewModeToggle);
registerSlotComponent('PaginationComponent', PaginationComponent);
registerSlotComponent('ProductCountInfo', ProductCountInfo);
registerSlotComponent('CmsBlockRenderer', CmsBlockComponent);
registerSlotComponent('ProductItemsGrid', ProductItemsGrid);
registerSlotComponent('EmptyProductsMessage', EmptyProductsMessage);

export {
  ActiveFilters,
  LayeredNavigation,
  SortSelector,
  ViewModeToggle,
  PaginationComponent,
  ProductCountInfo,
  CmsBlockComponent,
  ProductItemsGrid,
  EmptyProductsMessage
};