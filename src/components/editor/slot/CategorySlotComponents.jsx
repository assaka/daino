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
import { formatPrice, formatPriceNumber } from '@/utils/priceUtils';
import { getStockLabel, getStockLabelStyle } from '@/utils/stockUtils';
import { useTranslation } from '@/contexts/TranslationContext';

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

// Layered Navigation Component with processVariables
const LayeredNavigation = createSlotComponent({
  name: 'LayeredNavigation',
  render: ({ slot, className, styles, categoryContext, variableContext, context, allSlots }) => {
    const containerRef = useRef(null);

    if (context === 'editor') {
      // Editor: Render template with filters
      // Style controls are now in the specialized LayeredNavigationSidebar
      const html = processVariables(slot?.content || '', variableContext);

      return (
        <div
          ref={containerRef}
          className={className || slot.className}
          style={styles || slot.styles}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Storefront: Use template from slot.content or fallback
    // Default template with price slider and dynamic attribute filters
    const template = slot?.content || `
      <div class="space-y-4">
        <!-- Header with Clear All button -->
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900" style="color: {{attributeLabelStyles.color}}">Filter By</h3>
          {{#if (gt activeFilters.length 0)}}
          <button
            data-action="clear-all-filters"
            class="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Clear All
          </button>
          {{/if}}
        </div>

        <!-- Active Filters / Selected Filters -->
        {{#if (gt activeFilters.length 0)}}
        <div class="pb-3 border-b">
          <div class="flex flex-wrap gap-2">
            {{#each activeFilters}}
            <span
              class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full"
              style="background-color: {{activeFilterStyles.backgroundColor}}; color: {{activeFilterStyles.textColor}}"
            >
              <span>{{this.label}}: {{this.value}}</span>
              <button
                data-action="remove-filter"
                data-filter-type="{{this.type}}"
                data-attribute-code="{{this.attributeCode}}"
                data-filter-value="{{this.value}}"
                class="ml-1 hover:opacity-70"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </span>
            {{/each}}
          </div>
        </div>
        {{/if}}

        {{#if filters.price}}
        <!-- Price Slider Section -->
        <div class="border-b pb-4">
          <button
            data-action="toggle-section"
            data-section="price-filter"
            class="flex items-center justify-between w-full py-2 text-left font-medium"
            style="color: {{attributeLabelStyles.color}}"
          >
            <span>Price</span>
            <svg class="w-4 h-4 transform transition-transform" data-collapse-icon="price-filter" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div data-section-content="price-filter" class="mt-3">
            <div class="px-2">
              <!-- Dual range slider container -->
              <div class="relative h-6 flex items-center">
                <!-- Background track -->
                <div class="absolute w-full h-1 bg-gray-200 rounded"></div>
                <!-- Colored track between thumbs -->
                <div id="price-range-track" class="absolute h-1 bg-blue-500 rounded" style="left: 0%; width: 100%;"></div>
                <!-- Min slider -->
                <input
                  type="range"
                  id="price-slider-min"
                  data-action="price-slider"
                  data-slider-type="min"
                  min="{{filters.price.min}}"
                  max="{{filters.price.max}}"
                  value="{{filters.price.currentMin}}"
                  class="absolute w-full h-1 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                />
                <!-- Max slider -->
                <input
                  type="range"
                  id="price-slider-max"
                  data-action="price-slider"
                  data-slider-type="max"
                  min="{{filters.price.min}}"
                  max="{{filters.price.max}}"
                  value="{{filters.price.currentMax}}"
                  class="absolute w-full h-1 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
                />
              </div>
              <!-- Price display -->
              <div class="flex justify-between text-sm text-gray-600 mt-2">
                <span>{{settings.currency_symbol}}<span id="selected-min">{{filters.price.currentMin}}</span></span>
                <span>{{settings.currency_symbol}}<span id="selected-max">{{filters.price.currentMax}}</span></span>
              </div>
            </div>
          </div>
        </div>
        {{/if}}

        {{#each filters.attributes}}
        <!-- Attribute Filter: {{this.label}} -->
        <div class="border-b pb-4">
          <button
            data-action="toggle-section"
            data-section="filter-{{this.code}}"
            class="flex items-center justify-between w-full py-2 text-left font-medium"
            style="color: {{attributeLabelStyles.color}}"
          >
            <span>{{this.label}}</span>
            <svg class="w-4 h-4 transform transition-transform" data-collapse-icon="filter-{{this.code}}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <div data-section-content="filter-{{this.code}}" class="mt-2 space-y-2">
            {{#if (eq this.filter_type "slider")}}
            <!-- Slider for numeric attribute -->
            <div class="px-2">
              <div class="relative h-6 flex items-center">
                <div class="absolute w-full h-1 bg-gray-200 rounded"></div>
                <div id="{{this.code}}-range-track" class="absolute h-1 bg-blue-500 rounded" style="left: 0%; width: 100%;"></div>
                <input
                  type="range"
                  id="{{this.code}}-slider-min"
                  data-action="attribute-slider"
                  data-slider-type="min"
                  data-attribute-code="{{this.code}}"
                  min="{{this.min}}"
                  max="{{this.max}}"
                  value="{{this.min}}"
                  class="absolute w-full h-1 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <input
                  type="range"
                  id="{{this.code}}-slider-max"
                  data-action="attribute-slider"
                  data-slider-type="max"
                  data-attribute-code="{{this.code}}"
                  min="{{this.min}}"
                  max="{{this.max}}"
                  value="{{this.max}}"
                  class="absolute w-full h-1 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
              <div class="flex justify-between text-sm text-gray-600 mt-2">
                <span id="{{this.code}}-selected-min">{{this.min}}</span>
                <span id="{{this.code}}-selected-max">{{this.max}}</span>
              </div>
            </div>
            {{else}}
            <!-- Checkbox/Radio options -->
            {{#each this.options}}
            <label class="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-1 rounded">
              <div class="flex items-center">
                {{#if (eq this.filter_type "select")}}
                <input
                  type="radio"
                  name="filter-{{this.attributeCode}}"
                  data-action="toggle-filter"
                  data-filter-type="attribute"
                  data-filter-input-type="select"
                  data-attribute-code="{{this.attributeCode}}"
                  data-filter-value="{{this.value}}"
                  {{#if this.active}}checked{{/if}}
                  class="h-4 w-4 mr-2"
                  style="accent-color: {{filterOptionStyles.checkboxColor}}"
                />
                {{else}}
                <input
                  type="checkbox"
                  data-action="toggle-filter"
                  data-filter-type="attribute"
                  data-filter-input-type="multiselect"
                  data-attribute-code="{{this.attributeCode}}"
                  data-filter-value="{{this.value}}"
                  {{#if this.active}}checked{{/if}}
                  class="h-4 w-4 mr-2 rounded"
                  style="accent-color: {{filterOptionStyles.checkboxColor}}"
                />
                {{/if}}
                <span class="text-sm" style="color: {{filterOptionStyles.optionTextColor}}">{{this.label}}</span>
              </div>
              <span class="text-xs" style="color: {{filterOptionStyles.optionCountColor}}">({{this.count}})</span>
            </label>
            {{/each}}
            {{/if}}
          </div>
        </div>
        {{/each}}
      </div>
    `;

    const html = processVariables(template, variableContext);

    // Sync DOM checkboxes with selectedFilters state when filters are cleared or changed externally
    useEffect(() => {
      if (!containerRef.current || context === 'editor') return;

      const selectedFilters = categoryContext?.selectedFilters || {};
      const allCheckboxes = containerRef.current.querySelectorAll('[data-action="toggle-filter"]');

      allCheckboxes.forEach(cb => {
        const cbCode = cb.getAttribute('data-attribute-code');
        const cbValue = cb.getAttribute('data-filter-value');

        if (cbCode && cbValue) {
          // Check if this value is in the selectedFilters
          const shouldBeChecked = selectedFilters[cbCode]?.includes(cbValue) || false;
          if (cb.checked !== shouldBeChecked) {
            cb.checked = shouldBeChecked;
          }
          // Also add/remove CSS class for styling (backup for :checked selector)
          if (shouldBeChecked) {
            cb.classList.add('filter-checked');
          } else {
            cb.classList.remove('filter-checked');
          }
        }
      });
    }, [categoryContext?.selectedFilters, context]);

    // Attach event listeners in storefront
    useEffect(() => {
      if (!containerRef.current || context === 'editor') return;

      const handleChange = (e) => {
        const input = e.target.closest('[data-action="toggle-filter"]');
        if (!input || !categoryContext?.handleFilterChange) return;

        const filterType = input.getAttribute('data-filter-type');
        const filterValue = input.getAttribute('data-filter-value');
        const attributeCode = input.getAttribute('data-attribute-code');
        const filterInputType = input.getAttribute('data-filter-input-type'); // 'select' or 'multiselect'

        // Build filters from all checked inputs in the DOM (avoids stale closure issue)
        const newFilters = {};
        const allInputs = containerRef.current.querySelectorAll('[data-action="toggle-filter"]');

        allInputs.forEach(cb => {
          const cbType = cb.getAttribute('data-filter-type');
          const cbCode = cb.getAttribute('data-attribute-code');
          const cbValue = cb.getAttribute('data-filter-value');
          const cbInputType = cb.getAttribute('data-filter-input-type');

          if (cbType === 'attribute' && cbCode && cb.checked) {
            // For 'select' type (radio buttons), only keep the one value
            if (cbInputType === 'select') {
              // Radio button - replace any existing value
              newFilters[cbCode] = [cbValue];
            } else {
              // Checkbox - add to array
              if (!newFilters[cbCode]) {
                newFilters[cbCode] = [];
              }
              if (!newFilters[cbCode].includes(cbValue)) {
                newFilters[cbCode].push(cbValue);
              }
            }
          }
        });

        categoryContext.handleFilterChange(newFilters);
      };

      const updatePriceSliderTrack = () => {
        const minSlider = containerRef.current.querySelector('#price-slider-min');
        const maxSlider = containerRef.current.querySelector('#price-slider-max');
        const rangeTrack = containerRef.current.querySelector('#price-range-track');

        if (!minSlider || !maxSlider || !rangeTrack) return;

        // Get min/max from attributes (now clean numbers without currency)
        let min = parseInt(minSlider.getAttribute('min'));
        let max = parseInt(minSlider.getAttribute('max'));

        // If still not found, use current slider values as boundaries
        if (!min || isNaN(min)) {
          min = 0;
        }
        if (!max || isNaN(max)) {
          max = 100;
        }

        const minValue = parseInt(minSlider.value);
        const maxValue = parseInt(maxSlider.value);

        const percentMin = ((minValue - min) / (max - min)) * 100;
        const percentMax = ((maxValue - min) / (max - min)) * 100;
        rangeTrack.style.left = percentMin + '%';
        rangeTrack.style.width = (percentMax - percentMin) + '%';
      };

      const handlePriceSlider = (e) => {
        const slider = e.target.closest('[data-action="price-slider"]');
        if (!slider || !categoryContext?.handleFilterChange) return;

        const sliderType = slider.getAttribute('data-slider-type');
        const value = parseInt(slider.value);

        const minSlider = containerRef.current.querySelector('#price-slider-min');
        const maxSlider = containerRef.current.querySelector('#price-slider-max');
        const selectedMin = containerRef.current.querySelector('#selected-min');
        const selectedMax = containerRef.current.querySelector('#selected-max');

        if (!minSlider || !maxSlider) return;

        let minValue = parseInt(minSlider.value);
        let maxValue = parseInt(maxSlider.value);

        // Update values based on which slider moved
        if (sliderType === 'min') {
          minValue = Math.min(value, maxValue);
          minSlider.value = minValue;
        } else {
          maxValue = Math.max(value, minValue);
          maxSlider.value = maxValue;
        }

        // Update display
        if (selectedMin) selectedMin.textContent = minValue;
        if (selectedMax) selectedMax.textContent = maxValue;

        // Update the colored track between thumbs
        updatePriceSliderTrack();

        // Update filters
        const currentFilters = categoryContext.selectedFilters || {};
        const newFilters = { ...currentFilters };
        newFilters.priceRange = [minValue, maxValue];
        categoryContext.handleFilterChange(newFilters);
      };

      // Handle custom attribute slider (for numeric attributes like price_amount, weight, etc.)
      const updateAttributeSliderTrack = (attrCode) => {
        const minSlider = containerRef.current.querySelector(`#${attrCode}-slider-min`);
        const maxSlider = containerRef.current.querySelector(`#${attrCode}-slider-max`);
        const rangeTrack = containerRef.current.querySelector(`#${attrCode}-range-track`);

        if (!minSlider || !maxSlider || !rangeTrack) return;

        let min = parseFloat(minSlider.getAttribute('min')) || 0;
        let max = parseFloat(minSlider.getAttribute('max')) || 100;

        const minValue = parseFloat(minSlider.value);
        const maxValue = parseFloat(maxSlider.value);

        const percentMin = ((minValue - min) / (max - min)) * 100;
        const percentMax = ((maxValue - min) / (max - min)) * 100;
        rangeTrack.style.left = percentMin + '%';
        rangeTrack.style.width = (percentMax - percentMin) + '%';
      };

      const handleAttributeSlider = (e) => {
        const slider = e.target.closest('[data-action="attribute-slider"]');
        if (!slider || !categoryContext?.handleFilterChange) return;

        const attrCode = slider.getAttribute('data-attribute-code');
        const sliderType = slider.getAttribute('data-slider-type');
        const value = parseFloat(slider.value);

        if (!attrCode) return;

        const minSlider = containerRef.current.querySelector(`#${attrCode}-slider-min`);
        const maxSlider = containerRef.current.querySelector(`#${attrCode}-slider-max`);
        const minDisplay = containerRef.current.querySelector(`#${attrCode}-min-display`);
        const maxDisplay = containerRef.current.querySelector(`#${attrCode}-max-display`);

        if (!minSlider || !maxSlider) return;

        let minValue = parseFloat(minSlider.value);
        let maxValue = parseFloat(maxSlider.value);

        // Update values based on which slider moved
        if (sliderType === 'min') {
          minValue = Math.min(value, maxValue);
          minSlider.value = minValue;
        } else {
          maxValue = Math.max(value, minValue);
          maxSlider.value = maxValue;
        }

        // Update display
        if (minDisplay) minDisplay.textContent = minValue;
        if (maxDisplay) maxDisplay.textContent = maxValue;

        // Update the colored track between thumbs
        updateAttributeSliderTrack(attrCode);

        // Update filters - store as attributeRange for this attribute
        const currentFilters = categoryContext.selectedFilters || {};
        const newFilters = { ...currentFilters };
        newFilters[`${attrCode}Range`] = [minValue, maxValue];
        categoryContext.handleFilterChange(newFilters);
      };

      // Initialize attribute sliders
      const initAttributeSliders = () => {
        const attrSliders = containerRef.current?.querySelectorAll('[data-action="attribute-slider"][data-slider-type="min"]');
        attrSliders?.forEach(minSlider => {
          const attrCode = minSlider.getAttribute('data-attribute-code');
          if (attrCode) {
            updateAttributeSliderTrack(attrCode);
          }
        });
      };

      // Initialize slider track position and values on mount
      const initSlider = () => {
        const minSlider = containerRef.current?.querySelector('#price-slider-min');
        const maxSlider = containerRef.current?.querySelector('#price-slider-max');

        if (minSlider && maxSlider) {
          // Get min/max from attributes or data attributes (now clean numbers)
          let min = parseInt(minSlider.getAttribute('min'));
          let max = parseInt(minSlider.getAttribute('max'));

          // Fallback to value attributes if min/max not set
          if (!min || isNaN(min)) {
            min = parseInt(minSlider.getAttribute('value')) || 0;
          }
          if (!max || isNaN(max)) {
            max = parseInt(maxSlider.getAttribute('value')) || 100;
          }

          // Set attributes if they're missing
          if (!minSlider.getAttribute('min') || minSlider.getAttribute('min') === 'null') {
            minSlider.setAttribute('min', min);
            maxSlider.setAttribute('min', min);
          }
          if (!minSlider.getAttribute('max') || minSlider.getAttribute('max') === 'null') {
            minSlider.setAttribute('max', max);
            maxSlider.setAttribute('max', max);
          }

          // Set initial values
          if (!minSlider.value || minSlider.value === '0' || minSlider.value === '50') {
            minSlider.value = min;
          }
          if (!maxSlider.value || maxSlider.value === '0' || maxSlider.value === '50') {
            maxSlider.value = max;
          }

          updatePriceSliderTrack();
        }
      };

      // Initialize max visible attributes
      const initMaxVisibleAttributes = () => {
        const filterContents = containerRef.current?.querySelectorAll('[data-max-visible]');

        filterContents?.forEach(filterContent => {
          const maxVisibleAttr = filterContent.getAttribute('data-max-visible');
          const maxVisible = parseInt(maxVisibleAttr);

          // Only apply if maxVisible is a valid number and > 0
          // If not set or invalid, don't limit (show all)
          if (!maxVisibleAttr || maxVisibleAttr === '' || maxVisibleAttr === 'null' || maxVisibleAttr === 'undefined' || isNaN(maxVisible) || maxVisible <= 0) {
            return;
          }

          const allOptions = filterContent.querySelectorAll('.filter-option');
          // The show-more-btn is a sibling element, not a child
          const showMoreBtn = filterContent.nextElementSibling?.classList?.contains('show-more-btn')
            ? filterContent.nextElementSibling
            : null;

          // Hide options beyond max visible
          let hiddenCount = 0;
          allOptions.forEach((option, index) => {
            if (index >= maxVisible) {
              option.classList.add('hidden');
              hiddenCount++;
            }
          });

          // Show "Show More" button if there are hidden options
          if (allOptions.length > maxVisible && showMoreBtn) {
            showMoreBtn.classList.remove('hidden');
          }
        });
      };

      setTimeout(() => {
        initSlider();
        initAttributeSliders();
        initMaxVisibleAttributes();
      }, 100);

      // Handle filter section toggle (collapse/expand)
      const handleToggleSection = (e) => {
        const button = e.target.closest('[data-action="toggle-filter-section"]');
        if (!button) return;

        const section = button.getAttribute('data-section');
        const filterSection = button.closest('[data-filter-section]');
        const filterContent = filterSection?.querySelector('.filter-content');
        const chevron = button.querySelector('.filter-chevron');

        if (filterContent) {
          const isHidden = filterContent.style.display === 'none';
          filterContent.style.display = isHidden ? 'block' : 'none';

          if (chevron) {
            if (isHidden) {
              chevron.classList.add('rotate-180');
            } else {
              chevron.classList.remove('rotate-180');
            }
          }
        }
      };

      // Handle Show More / Show Less toggle
      const handleShowMore = (e) => {
        const button = e.target.closest('[data-action="toggle-show-more"]');
        if (!button) return;

        const attributeCode = button.getAttribute('data-attribute-code');
        const filterContent = containerRef.current.querySelector(`[data-attribute-code="${attributeCode}"]`);

        if (!filterContent) return;

        // The data-max-visible is on a child element inside filterContent
        const maxVisibleContainer = filterContent.querySelector('[data-max-visible]');
        const maxVisible = parseInt(maxVisibleContainer?.getAttribute('data-max-visible')) || 5;
        const allOptions = maxVisibleContainer?.querySelectorAll('.filter-option') || [];
        const isShowingMore = button.textContent.trim().toLowerCase().includes('more');

        allOptions.forEach((option, index) => {
          if (index >= maxVisible) {
            if (isShowingMore) {
              option.classList.remove('hidden');
            } else {
              option.classList.add('hidden');
            }
          }
        });

        button.textContent = isShowingMore ? 'Show Less' : 'Show More';
      };

      // Handle mobile filter toggle (overlay) - uses document-level search since button might be outside this component
      const handleMobileFilterToggle = (e) => {
        const button = e.target.closest('[data-action="toggle-mobile-filters"]');
        if (!button) return;

        // Search entire document for overlay since button is in a different slot
        const overlay = document.querySelector('[data-filter-overlay]');
        const drawer = document.querySelector('[data-filter-drawer]');

        if (!overlay || !drawer) return;

        // Show overlay
        overlay.classList.remove('hidden');

        // Animate drawer in after a brief delay
        setTimeout(() => {
          drawer.classList.remove('-translate-x-full');
        }, 10);

        // Prevent body scroll when overlay is open
        document.body.style.overflow = 'hidden';
      };

      // Handle mobile filter close
      const handleMobileFilterClose = (e) => {
        const closeButton = e.target.closest('[data-action="close-mobile-filters"]');
        const overlayClick = e.target.closest('[data-filter-overlay]') === e.target;

        if (!closeButton && !overlayClick) return;

        const overlay = containerRef.current.querySelector('[data-filter-overlay]');
        const drawer = containerRef.current.querySelector('[data-filter-drawer]');

        if (!overlay || !drawer) return;

        // Animate drawer out
        drawer.classList.add('-translate-x-full');

        // Hide overlay after animation
        setTimeout(() => {
          overlay.classList.add('hidden');
          // Restore body scroll
          document.body.style.overflow = '';
        }, 300);
      };

      // Handle remove filter from mobile active filters
      const handleRemoveFilter = (e) => {
        const removeBtn = e.target.closest('[data-action="remove-filter"]');
        if (!removeBtn || !categoryContext?.handleFilterChange) return;

        const filterType = removeBtn.getAttribute('data-filter-type');
        const filterValue = removeBtn.getAttribute('data-filter-value');
        const attributeCode = removeBtn.getAttribute('data-attribute-code');

        const currentFilters = categoryContext.selectedFilters || {};

        // Handle price range filter removal
        if (filterType === 'priceRange') {
          const newFilters = { ...currentFilters };
          delete newFilters.priceRange;
          categoryContext.handleFilterChange(newFilters);

          // Also reset the slider UI to original values
          const minSlider = containerRef.current?.querySelector('#price-slider-min');
          const maxSlider = containerRef.current?.querySelector('#price-slider-max');
          const selectedMin = containerRef.current?.querySelector('#selected-min');
          const selectedMax = containerRef.current?.querySelector('#selected-max');

          if (minSlider && maxSlider) {
            const min = parseInt(minSlider.getAttribute('min'));
            const max = parseInt(minSlider.getAttribute('max'));
            minSlider.value = min;
            maxSlider.value = max;
            if (selectedMin) selectedMin.textContent = min;
            if (selectedMax) selectedMax.textContent = max;

            // Reset the track
            const rangeTrack = containerRef.current?.querySelector('#price-range-track');
            if (rangeTrack) {
              rangeTrack.style.left = '0%';
              rangeTrack.style.width = '100%';
            }
          }
          return;
        }

        if (filterType === 'attribute' && attributeCode) {
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
      };

      // Handle clear all filters
      const handleClearAllFilters = (e) => {
        const clearAllBtn = e.target.closest('[data-action="clear-all-filters"]');
        if (!clearAllBtn) return;

        if (categoryContext?.clearFilters) {
          categoryContext.clearFilters();
        } else if (categoryContext?.handleFilterChange) {
          categoryContext.handleFilterChange({});
        }

        // Reset the price slider UI to original values
        const minSlider = containerRef.current?.querySelector('#price-slider-min');
        const maxSlider = containerRef.current?.querySelector('#price-slider-max');
        const selectedMin = containerRef.current?.querySelector('#selected-min');
        const selectedMax = containerRef.current?.querySelector('#selected-max');

        if (minSlider && maxSlider) {
          const min = parseInt(minSlider.getAttribute('min'));
          const max = parseInt(minSlider.getAttribute('max'));
          minSlider.value = min;
          maxSlider.value = max;
          if (selectedMin) selectedMin.textContent = min;
          if (selectedMax) selectedMax.textContent = max;

          // Reset the track
          const rangeTrack = containerRef.current?.querySelector('#price-range-track');
          if (rangeTrack) {
            rangeTrack.style.left = '0%';
            rangeTrack.style.width = '100%';
          }
        }

        // Also uncheck all checkboxes/radio buttons
        const allInputs = containerRef.current?.querySelectorAll('[data-action="toggle-filter"]');
        allInputs?.forEach(input => {
          input.checked = false;
        });
      };

      containerRef.current.addEventListener('change', handleChange);
      containerRef.current.addEventListener('input', handlePriceSlider);
      containerRef.current.addEventListener('input', handleAttributeSlider);
      containerRef.current.addEventListener('click', handleToggleSection);
      containerRef.current.addEventListener('click', handleShowMore);
      containerRef.current.addEventListener('click', handleRemoveFilter);
      containerRef.current.addEventListener('click', handleClearAllFilters);

      // Attach mobile filter toggle to document since button is in a different slot
      document.addEventListener('click', handleMobileFilterToggle);
      document.addEventListener('click', handleMobileFilterClose);

      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('change', handleChange);
          containerRef.current.removeEventListener('input', handlePriceSlider);
          containerRef.current.removeEventListener('input', handleAttributeSlider);
          containerRef.current.removeEventListener('click', handleToggleSection);
          containerRef.current.removeEventListener('click', handleShowMore);
          containerRef.current.removeEventListener('click', handleRemoveFilter);
          containerRef.current.removeEventListener('click', handleClearAllFilters);
        }
        // Clean up document-level listeners
        document.removeEventListener('click', handleMobileFilterToggle);
        document.removeEventListener('click', handleMobileFilterClose);
        // Clean up body scroll on unmount
        document.body.style.overflow = '';
      };
    }, [categoryContext, context]);

    return (
      <div ref={containerRef} className={className || slot.className} style={styles || slot.styles}
           dangerouslySetInnerHTML={{ __html: html }} />
    );
  }
});

// Sort Selector Component with processVariables
const SortSelector = createSlotComponent({
  name: 'SortSelector',
  render: ({ slot, className, styles, categoryContext, variableContext, context }) => {
    const containerRef = useRef(null);

    // Use template from slot.content or fallback
    const template = slot?.content || `
      <div class="flex items-center gap-2">
        <label class="text-sm text-gray-700 font-medium">Sort by:</label>
        <select class="border border-gray-300 rounded px-3 py-1.5 text-sm"
                data-action="change-sort">
          <option value="position">Position</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="price_asc">Price (Low to High)</option>
        </select>
      </div>
    `;

    const html = processVariables(template, variableContext);

    // Attach event listeners in storefront
    useEffect(() => {
      if (!containerRef.current || context === 'editor') return;

      const selectElement = containerRef.current.querySelector('[data-action="change-sort"]');
      if (!selectElement) return;

      const handleChange = (e) => {
        if (categoryContext?.handleSortChange) {
          categoryContext.handleSortChange(e.target.value);
        }
      };

      selectElement.addEventListener('change', handleChange);
      return () => {
        selectElement.removeEventListener('change', handleChange);
      };
    }, [categoryContext, context]);

    return (
      <div ref={containerRef} className={className || slot.className} style={styles || slot.styles}
           dangerouslySetInnerHTML={{ __html: html }} />
    );
  }
});

// Pagination Component with processVariables
const PaginationComponent = createSlotComponent({
  name: 'PaginationComponent',
  render: ({ slot, className, styles, categoryContext, variableContext, context }) => {
    const containerRef = useRef(null);

    // Don't render pagination if there's only 1 page or no pages
    const totalPages = variableContext?.pagination?.totalPages || 0;
    if (totalPages <= 1 && context !== 'editor') {
      return null;
    }

    // Use template from slot.content or fallback
    const template = slot?.content || `
      {{#if (gt pagination.totalPages 1)}}
      <div class="flex justify-center mt-8">
        <nav class="flex items-center gap-1">
          <button class="px-3 py-2 border rounded hover:bg-gray-50 {{#unless pagination.hasPrev}}opacity-50 cursor-not-allowed{{/unless}}"
                  data-action="go-to-page"
                  data-page="prev"
                  {{#unless pagination.hasPrev}}disabled{{/unless}}>
            Previous
          </button>
          <span class="px-3 py-2">{{pagination.currentPage}} of {{pagination.totalPages}}</span>
          <button class="px-3 py-2 border rounded hover:bg-gray-50 {{#unless pagination.hasNext}}opacity-50 cursor-not-allowed{{/unless}}"
                  data-action="go-to-page"
                  data-page="next"
                  {{#unless pagination.hasNext}}disabled{{/unless}}>
            Next
          </button>
        </nav>
      </div>
      {{/if}}
    `;

    const html = processVariables(template, variableContext);

    // Attach event listeners in storefront
    useEffect(() => {
      if (!containerRef.current || context === 'editor') return;

      const handleClick = (e) => {
        const button = e.target.closest('[data-action="go-to-page"]');
        if (!button || !categoryContext?.handlePageChange) return;

        const page = button.getAttribute('data-page');
        if (page === 'prev' || page === 'next') {
          // Handle prev/next
          const currentPage = categoryContext.currentPage || 1;
          const newPage = page === 'prev' ? currentPage - 1 : currentPage + 1;
          categoryContext.handlePageChange(newPage);
        } else {
          // Handle specific page number
          const pageNum = parseInt(page, 10);
          if (!isNaN(pageNum)) {
            categoryContext.handlePageChange(pageNum);
          }
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
  render: ({ slot, className, styles, categoryContext, variableContext }) => {
    // Use template from slot.content or fallback
    const template = slot?.content || `
      <div class="text-sm text-gray-600">
        Showing {{pagination.start}}-{{pagination.end}} of {{pagination.total}} products
      </div>
    `;

    const html = processVariables(template, variableContext);

    return (
      <div className={className || slot.className} style={styles || slot.styles}
           dangerouslySetInnerHTML={{ __html: html }} />
    );
  }
});

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

    if (context === 'editor') {
      // Editor: Render individual product cards as slot-based containers
      const storeContext = useStore();
      const storeSettings = storeContext?.settings || null;
      // Use grid-cols-1 for list view, dynamic grid for grid view
      const gridClasses = viewMode === 'list' ? 'grid-cols-1' : getGridClasses(storeSettings);

      // Find product card template early for logging
      const productCardTemplate = allSlots?.product_card_template;

      // Get sample products from categoryContext OR variableContext
      const rawProducts = categoryContext?.products?.slice(0, 6) || variableContext?.products || [];

      // Format prices if not already formatted
      const products = rawProducts.map(p => {
        const isInStock = p.infinite_stock || (p.stock_quantity !== undefined && p.stock_quantity > 0);
        const price = parseFloat(p.price || 0);
        const comparePrice = parseFloat(p.compare_price || 0);
        const hasComparePrice = comparePrice > 0 && comparePrice !== price;
        return {
          ...p,
          price_formatted: p.price_formatted || formatPrice(p.price || 0),
          compare_price_formatted: hasComparePrice ? formatPrice(p.compare_price) : '',
          // Price numbers without currency (for conditional currency display)
          price_number: p.price_number || formatPriceNumber(price),
          compare_price_number: p.compare_price_number || (hasComparePrice ? formatPriceNumber(comparePrice) : ''),
          image_url: p.image_url || p.images?.[0]?.url || p.images?.[0] || '/placeholder-product.jpg',
          in_stock: p.in_stock !== undefined ? p.in_stock : (p.stock_status === 'in_stock'),
          stock_label: isInStock ? 'In Stock' : 'Out of Stock',
          stock_label_class: isInStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        };
      });

      if (products.length === 0) {
        return (
          <div
            className={`${className || slot.className || ''}`}
            style={styles || slot.styles}
          >
            <div className="p-4 border-2 border-dashed border-red-300 rounded-lg text-center">
              <div className="text-red-600 font-bold">Product Items Grid - No products available in editor</div>
              <div className="text-xs text-gray-500 mt-2">
                CategoryContext products: {categoryContext?.products?.length || 0}<br />
                VariableContext products: {variableContext?.products?.length || 0}
              </div>
            </div>
          </div>
        );
      }

      // Find ALL descendant slots of product card template (children, grandchildren, etc.)
      const productCardChildSlots = {};

      if (allSlots) {
        // Helper to collect all descendants recursively
        const collectDescendants = (parentId) => {
          Object.values(allSlots).forEach(slot => {
            if (slot.parentId === parentId) {
              productCardChildSlots[slot.id] = slot;
              // Recursively collect children of this slot
              collectDescendants(slot.id);
            }
          });
        };

        // Start collecting from product_card_template
        collectDescendants('product_card_template');
      }

      // Render each product with its child slots as individual editable elements
      return (
        <div className={`grid ${gridClasses} gap-4 ${className || slot.className || ''}`} style={styles || slot.styles}>
          {products.map((product, index) => {
            // Create unique slot IDs for each product instance
            const productSlots = {};
            // Add the product card container itself as a grid slot
            const productCardId = `product_card_${index}`;
            productSlots[productCardId] = {
              ...productCardTemplate,
              id: productCardId,
              type: 'container', // Make it a container type for proper grid rendering
              parentId: 'product_items',
              colSpan: productCardTemplate?.colSpan || { grid: 1, list: 12 }, // Use template's colSpan
              position: { col: index + 1, row: 1 },
              styles: {
                ...productCardTemplate?.styles,
                width: '100%',
                height: 'auto'
              },
              metadata: {
                ...productCardTemplate?.metadata,
                hierarchical: true, // Enable child slot rendering
                isProductCard: true,
                productIndex: index
              }
            };

            Object.entries(productCardChildSlots).forEach(([slotId, slotConfig]) => {
              // Create unique slot ID for this product instance
              const templateSlotId = `${slotId}_${index}`;

              // CRITICAL: Check if this specific product slot has saved customizations
              // First check for product-specific customization (templateSlotId with _index)
              // Then fall back to template-wide customization (base slotId)
              const savedSlotConfig = allSlots[templateSlotId] || allSlots[slotId];

              // Replace template variables in styles using processVariables
              // This will use the variableContext which has settings.theme.add_to_cart_button_color
              const processedStyles = {};

              // Process each style property from template
              if (slotConfig.styles) {
                Object.entries(slotConfig.styles).forEach(([key, value]) => {
                  if (typeof value === 'string') {
                    // Use processVariables to replace template variables with actual values
                    processedStyles[key] = processVariables(value, variableContext);
                  } else {
                    processedStyles[key] = value;
                  }
                });
              }

              // Process saved styles to replace template variables
              const processedSavedStyles = {};
              if (savedSlotConfig?.styles) {
                Object.entries(savedSlotConfig.styles).forEach(([key, value]) => {
                  if (typeof value === 'string') {
                    // Use processVariables to replace template variables with actual values
                    processedSavedStyles[key] = processVariables(value, variableContext);
                  } else {
                    processedSavedStyles[key] = value;
                  }
                });
              }

              // CRITICAL: Merge saved styles with template styles (saved styles take precedence)
              const finalStyles = savedSlotConfig
                ? { ...processedStyles, ...processedSavedStyles }
                : processedStyles;

              // CRITICAL: Use saved className if available, otherwise use template className
              const finalClassName = savedSlotConfig?.className ?? slotConfig.className;
              const finalParentClassName = savedSlotConfig?.parentClassName ?? slotConfig.parentClassName;

              // Check if this is a button slot that should allow text editing
              const isEditableButton = slotConfig.type === 'button';
              const isTextSlot = slotConfig.type === 'text';
              const isImageSlot = slotConfig.type === 'image';

              // Process template variables in content for text AND image slots
              // CRITICAL: Use processVariables to handle {{#unless}} conditionals and all template variables
              let processedContent = slotConfig.content;
              if (isEditableButton) {
                processedContent = savedSlotConfig?.content || slotConfig.content || 'Button';
              } else if (isTextSlot || isImageSlot) {
                // Build product context with 'this' alias for {{this.price_number}} etc.
                const productContext = {
                  ...variableContext,
                  this: product,
                  product
                };
                processedContent = processVariables(slotConfig.content || '', productContext);
              }

              // Add stock label inline styles dynamically for stock label slot
              const dynamicStyles = slotConfig.id === 'product_card_stock_label' && product.stock_label_style
                ? { ...finalStyles, ...product.stock_label_style }
                : finalStyles;

              productSlots[templateSlotId] = {
                ...slotConfig,
                id: templateSlotId,
                parentId: slotConfig.parentId === 'product_card_template' ? productCardId : `${slotConfig.parentId}_${index}`, // Update parent ID to unique product card
                content: processedContent,
                className: finalClassName, // Use merged className
                parentClassName: finalParentClassName, // Use merged parentClassName
                styles: dynamicStyles, // Use merged styles with inline stock label colors
                // CRITICAL: Use saved position and colSpan if available
                position: savedSlotConfig?.position ?? slotConfig.position,
                colSpan: savedSlotConfig?.colSpan ?? slotConfig.colSpan,
                // Remove conditionalDisplay in editor mode so all slots are visible
                // Mark as styleOnly to prevent content editing (content comes from product data)
                // Exception: buttons allow text editing but not full HTML
                // CRITICAL: Merge saved metadata to preserve disableResize and other settings
                metadata: {
                  ...slotConfig.metadata,
                  ...(savedSlotConfig?.metadata || {}), // Merge saved metadata
                  conditionalDisplay: undefined, // Always remove conditionalDisplay in editor
                  styleOnly: isEditableButton ? false : true, // Buttons allow text editing
                  readOnly: isTextSlot ? true : false, // Text slots are read-only, buttons are editable
                  textOnly: isEditableButton ? true : false // Buttons only allow text editing, not HTML
                }
              };

            });

            // Render the product card as a container slot with its children
            return (
              <UnifiedSlotRenderer
                key={`product-${index}`}
                slots={productSlots}
                parentId="product_items"
                context={context}
                categoryData={{ ...categoryContext, product }}
                productData={product}
                variableContext={{ ...variableContext, this: product, product }}
                mode={mode || "edit"}
                showBorders={showBorders !== undefined ? showBorders : true}
                viewMode={viewMode}
                onElementClick={onElementClick}
                setPageConfig={setPageConfig}
                saveConfiguration={saveConfiguration}
                // Pass grid editing props for draggable functionality
                onGridResize={onGridResize}
                onSlotDrop={onSlotDrop}
                onSlotDelete={onSlotDelete}
                onSlotHeightResize={onSlotHeightResize}
                onResizeStart={onResizeStart}
                onResizeEnd={onResizeEnd}
                currentDragInfo={currentDragInfo}
                setCurrentDragInfo={setCurrentDragInfo}
                selectedElementId={selectedElementId}
              />
            );
          })}
        </div>
      );
    }

    // Storefront version - use same slot-based rendering as editor
    const storeContext = useStore();
    const storeSettings = storeContext?.settings || null;
    // Use grid-cols-1 for list view, dynamic grid for grid view
    const gridClasses = viewMode === 'list' ? 'grid-cols-1' : getGridClasses(storeSettings);

    /**
     * CRITICAL FIX: Use pre-formatted products from variableContext
     *
     * BUG HISTORY:
     * - Before: This code was re-formatting prices incorrectly:
     *   ```
     *   price_formatted: p.price_formatted || formatPrice(p.price),
     *   compare_price_formatted: p.compare_price ? formatPrice(p.compare_price) : null
     *   ```
     * - Problem: Ignored getPriceDisplay logic, showed wrong prices
     *
     * - After: Now uses products directly from variableContext
     * - CategorySlotRenderer already formatted them using getPriceDisplay()
     * - Products already have: price_formatted, compare_price_formatted, stock_label, etc.
     *
     * DO NOT re-format prices here or you'll break the fix!
     */
    const products = variableContext?.products || categoryContext?.products || [];
    const { t } = useTranslation();

    // Show friendly message when no products match filters
    if (products.length === 0) {
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

    // Find product card template and descendants
    const productCardTemplate = allSlots?.product_card_template;
    const productCardChildSlots = {};

    if (allSlots) {
      const collectDescendants = (parentId) => {
        Object.values(allSlots).forEach(slot => {
          if (slot.parentId === parentId) {
            productCardChildSlots[slot.id] = slot;
            collectDescendants(slot.id);
          }
        });
      };
      collectDescendants('product_card_template');
    }

    return (
      <div className={`grid ${gridClasses} gap-4 ${className || slot.className || ''}`} style={styles || slot.styles}>
        {products.map((product, index) => {
          const productSlots = {};

          Object.entries(productCardChildSlots).forEach(([slotId, slotConfig]) => {
            const savedSlotConfig = allSlots[slotId];

            // Process styles
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

            // Process template variables in content for text AND image slots
            // CRITICAL: Use processVariables to handle {{#unless}} conditionals and all template variables
            let processedContent = slotConfig.content;
            if (isEditableButton) {
              processedContent = savedSlotConfig?.content || slotConfig.content || 'Button';
            } else if (isTextSlot || isImageSlot) {
              // Build product context with 'this' alias for {{this.price_number}} etc.
              const productContext = {
                ...variableContext,
                this: product,
                product
              };
              processedContent = processVariables(slotConfig.content || '', productContext);
            }

            // Add stock label inline styles dynamically for stock label slot
            const dynamicStyles = slotConfig.id === 'product_card_stock_label' && product.stock_label_style
              ? { ...finalStyles, ...product.stock_label_style }
              : finalStyles;

            productSlots[slotId] = {
              ...slotConfig,
              content: processedContent,
              className: finalClassName,
              styles: dynamicStyles,
              metadata: { ...(slotConfig.metadata || {}), ...(savedSlotConfig?.metadata || {}) }
            };
          });

          return (
            <div
              key={`product-${product.id || index}`}
              data-slot-id="product_card_template"
              data-editable="true"
              className={productCardTemplate?.className || ''}
              style={{ ...productCardTemplate?.styles, overflow: 'visible', width: '100%' }}
            >
              <UnifiedSlotRenderer
                slots={productSlots}
                parentId="product_card_template"
                context="storefront"
                categoryData={{ ...categoryContext, product }}
                productData={{
                  product,
                  store: categoryContext?.store,
                  settings: variableContext?.settings
                }}
                variableContext={{ ...variableContext, this: product, product }}
                viewMode={viewMode}
              />
            </div>
          );
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
const EmptyProductsMessage = createSlotComponent({
  name: 'EmptyProductsMessage',
  render: ({ slot, className, styles, categoryContext, variableContext, context }) => {
    const { t } = useTranslation();
    const products = variableContext?.products || categoryContext?.products || [];

    // Only show when there are no products
    if (products.length > 0) {
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