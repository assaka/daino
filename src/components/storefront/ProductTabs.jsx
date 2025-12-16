import React, { useState, useEffect, useRef, useMemo } from 'react';
import { processVariables } from '@/utils/variableProcessor';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';

/**
 * ProductTabs Component
 * Renders product tabs with content from config template
 */
export default function ProductTabs({ productTabs = [], product = null, settings = {}, className = '', slotConfig = null }) {
  const containerRef = useRef(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // Prepare tabs data with active state
  const tabsData = useMemo(() => {
    if (!productTabs || productTabs.length === 0) return [];

    const validTabs = productTabs.filter(tab =>
      tab && tab.is_active !== false
    );

    // Add default description tab if needed
    const hasDescriptionTab = validTabs.some(tab => {
      // Backend returns translated name in base field (based on X-Language header)
      const translatedTitle = tab.name;
      return translatedTitle?.toLowerCase().includes('description');
    });

    const tabsToRender = [...validTabs];
    if (product?.description && !hasDescriptionTab) {
      tabsToRender.unshift({
        id: 'description',
        name: 'Description', // Backend will translate if needed
        content: product.description,
        is_active: true,
        tab_type: 'description'
      });
    }

    const mappedTabs = tabsToRender.map((tab, index) => {
      // Backend returns translated name/content in base fields (based on X-Language header)
      const translatedTitle = tab.name || 'No Tab Name';
      const translatedContent = tab.content || '';

      return {
        ...tab,
        id: tab.id?.toString() || `tab-${index}`,
        title: translatedTitle,
        isActive: index === activeTabIndex,
        content: translatedContent,
        tab_type: tab.tab_type || 'text'
      };
    });

    return mappedTabs;
  }, [productTabs, product, activeTabIndex]);

  // Render attributes dynamically (processVariables doesn't support {{@key}})
  useEffect(() => {
    if (!containerRef.current) return;

    // Find all attribute containers (there might be multiple for desktop/mobile)
    const attributesContainers = containerRef.current.querySelectorAll('[data-attributes-container]');
    if (!attributesContainers || attributesContainers.length === 0) return;

    const attributes = product?.attributes;

    // Attributes should be an array of {code, label, value, ...}
    let attributesArray = [];
    if (Array.isArray(attributes)) {
      // New normalized format from API (already translated)
      attributesArray = attributes;
    } else if (attributes && typeof attributes === 'object') {
      // Old format - convert to array
      attributesArray = Object.entries(attributes).map(([key, value]) => ({
        code: key,
        label: key.replace(/_/g, ' '),
        value: String(value ?? ''),
        type: 'text'
      }));
    }

    // Get the active tab to check if it has specific attribute_ids or attribute_set_ids
    const activeTab = tabsData[activeTabIndex];

    // Filter attributes based on the tab's attribute_ids (for "attributes" tab type)
    if (activeTab?.tab_type === 'attributes' && activeTab?.attribute_ids && activeTab.attribute_ids.length > 0) {
      // Filter to only show attributes that are in the attribute_ids array
      attributesArray = attributesArray.filter(attr => {
        // Match by attribute ID if available, otherwise skip
        return attr.id && activeTab.attribute_ids.includes(attr.id);
      });
    }

    // For "attribute_sets" tab type, show all attributes if product's attribute_set_id matches
    if (activeTab?.tab_type === 'attribute_sets') {
      const tabAttributeSetIds = activeTab?.attribute_set_ids || [];
      // If tab has attribute_set_ids and product has attribute_set_id, check for match
      if (tabAttributeSetIds.length > 0 && product?.attribute_set_id) {
        // If product's attribute set is not in the tab's allowed sets, show nothing
        if (!tabAttributeSetIds.includes(product.attribute_set_id)) {
          attributesArray = [];
        }
        // Otherwise, show all product attributes (no filtering)
      }
      // If no attribute_set_ids specified, show all attributes
    }

    if (!attributesArray || attributesArray.length === 0) {
      attributesContainers.forEach(container => {
        container.innerHTML = '<p class="text-gray-500">No specifications available for this product.</p>';
      });
      return;
    }

    // Get attribute label color from slot config styles (synced from admin) or theme settings
    const slotStylesAttr = slotConfig?.styles || {};
    const attributeLabelColor = slotStylesAttr.attributeLabelColor || settings?.theme?.product_tabs_attribute_label_color || getThemeDefaults().product_tabs_attribute_label_color;

    const attributesHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${attributesArray.map(attr => {
          // For color attributes with hex metadata, show a color swatch
          const colorSwatch = attr.metadata?.hex
            ? `<span class="inline-block w-4 h-4 rounded border border-gray-300 ml-2" style="background-color: ${attr.metadata.hex}"></span>`
            : '';

          return `
            <div class="flex justify-between py-2 border-b border-gray-100">
              <span class="font-bold capitalize" style="color: ${attributeLabelColor};">${attr.label}</span>
              <span>${attr.value}${colorSwatch}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Populate all attribute containers (desktop and mobile)
    attributesContainers.forEach(container => {
      container.innerHTML = attributesHTML;
    });
  }, [product, tabsData, activeTabIndex, settings]);

  // Store theme settings in ref for click handler access (merged with defaults)
  const mergedTheme = getThemeDefaults(settings?.theme || {});
  const themeSettingsRef = useRef(mergedTheme);
  themeSettingsRef.current = mergedTheme;

  // Attach tab click handlers
  useEffect(() => {
    if (!containerRef.current) return;

    const handleClick = (e) => {
      // Handle desktop tab switching
      const tabButton = e.target.closest('[data-action="switch-tab"]');
      if (tabButton) {
        const tabId = tabButton.getAttribute('data-tab-id');
        const tabIndex = tabsData.findIndex(tab => tab.id === tabId);

        if (tabIndex !== -1) {
          setActiveTabIndex(tabIndex);

          // Update UI immediately using theme settings
          const allTabs = containerRef.current.querySelectorAll('[data-action="switch-tab"]');
          const allContents = containerRef.current.querySelectorAll('[data-tab-content]');
          const theme = themeSettingsRef.current;

          allTabs.forEach((btn, idx) => {
            if (idx === tabIndex) {
              // Active tab styles - theme already has defaults from getThemeDefaults()
              btn.style.color = theme.product_tabs_title_color;
              btn.style.backgroundColor = theme.product_tabs_active_bg || 'transparent';
            } else {
              // Inactive tab styles - theme already has defaults from getThemeDefaults()
              btn.style.color = theme.product_tabs_inactive_color;
              btn.style.backgroundColor = theme.product_tabs_inactive_bg || 'transparent';
            }
          });

          allContents.forEach((content, idx) => {
            if (idx === tabIndex) {
              content.classList.remove('hidden');
            } else {
              content.classList.add('hidden');
            }
          });
        }
        return;
      }

      // Handle mobile accordion toggle
      const accordionButton = e.target.closest('[data-action="toggle-accordion"]');
      if (accordionButton) {
        const accordionIndex = accordionButton.getAttribute('data-accordion-index');
        const accordionContent = containerRef.current.querySelector(`[data-accordion-content="${accordionIndex}"]`);
        const chevron = accordionButton.querySelector('.accordion-chevron');

        // Get theme colors from data attributes
        const activeBg = accordionButton.getAttribute('data-active-bg');
        const inactiveBg = accordionButton.getAttribute('data-inactive-bg');
        const activeColor = accordionButton.getAttribute('data-active-color');
        const inactiveColor = accordionButton.getAttribute('data-inactive-color');

        if (accordionContent) {
          // Toggle visibility
          const isHidden = accordionContent.classList.contains('hidden');

          if (isHidden) {
            // Opening - apply active styles
            accordionContent.classList.remove('hidden');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
            accordionButton.style.backgroundColor = activeBg;
            accordionButton.style.color = activeColor;
          } else {
            // Closing - apply inactive styles
            accordionContent.classList.add('hidden');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
            accordionButton.style.backgroundColor = inactiveBg;
            accordionButton.style.color = inactiveColor;
          }
        }
      }
    };

    containerRef.current.addEventListener('click', handleClick);
    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleClick);
      }
    };
  }, [tabsData]);

  if (!tabsData || tabsData.length === 0) {
    return null;
  }

  // Get template from slotConfig or use default with theme styling
  // IMPORTANT: Always use the code template, ignore slotConfig to ensure latest styling
  const template = `
    <div class="w-full">
      <!-- Desktop: Tab Navigation - Hidden on mobile -->
      <div class="hidden md:block">
        <nav class="flex space-x-2">
          {{#each tabs}}
            {{#if this.isActive}}
            <button
              class="py-2 px-4 border transition-colors duration-200"
              style="font-size: {{settings.theme.product_tabs_title_size}}; font-weight: {{settings.theme.product_tabs_font_weight}}; text-decoration: {{settings.theme.product_tabs_text_decoration}}; color: {{settings.theme.product_tabs_title_color}}; background-color: {{settings.theme.product_tabs_active_bg}}; border-color: {{settings.theme.product_tabs_border_color}}; border-radius: {{settings.theme.product_tabs_border_radius}};"
              data-action="switch-tab"
              data-tab-id="{{this.id}}">
              {{this.title}}
            </button>
            {{else}}
            <button
              class="py-2 px-4 border transition-colors duration-200"
              style="font-size: {{settings.theme.product_tabs_title_size}}; font-weight: {{settings.theme.product_tabs_font_weight}}; text-decoration: {{settings.theme.product_tabs_text_decoration}}; color: {{settings.theme.product_tabs_inactive_color}}; background-color: {{settings.theme.product_tabs_inactive_bg}}; border-color: {{settings.theme.product_tabs_border_color}}; border-radius: {{settings.theme.product_tabs_border_radius}};"
              onmouseover="this.style.color='{{settings.theme.product_tabs_hover_color}}'; this.style.backgroundColor='{{settings.theme.product_tabs_hover_bg}}';"
              onmouseout="this.style.color='{{settings.theme.product_tabs_inactive_color}}'; this.style.backgroundColor='{{settings.theme.product_tabs_inactive_bg}}';"
              data-action="switch-tab"
              data-tab-id="{{this.id}}">
              {{this.title}}
            </button>
            {{/if}}
          {{/each}}
        </nav>
      </div>

      <!-- Desktop: Tab Content - Hidden on mobile -->
      <div class="hidden md:block mt-6">
        {{#each tabs}}
          <div
            class="tab-panel {{#if this.isActive}}{{else}}hidden{{/if}}"
            data-tab-content="{{this.id}}"
            data-tab-index="{{@index}}"
            data-tab-type="{{this.tab_type}}"
            data-tab-text-content="{{this.content}}">
            <div class="prose max-w-none text-gray-800 leading-relaxed tab-content-container p-6"
                 style="background-color: {{settings.theme.product_tabs_content_bg}};">
              {{#if (eq this.tab_type "text")}}
                <div>{{{this.content}}}</div>
              {{/if}}

              {{#if (eq this.tab_type "description")}}
                {{#if this.content}}
                  <div>{{{this.content}}}</div>
                {{else}}
                  <div>{{{../product.description}}}</div>
                {{/if}}
              {{/if}}

              {{#if (eq this.tab_type "attributes")}}
                <div id="attributes-placeholder" data-attributes-container></div>
              {{/if}}

              {{#if (eq this.tab_type "attribute_sets")}}
                <div id="attributes-placeholder" data-attributes-container data-attribute-set-ids="{{this.attribute_set_ids}}"></div>
              {{/if}}
            </div>
          </div>
        {{/each}}
      </div>

      <!-- Mobile: Accordion - Hidden on desktop -->
      <div class="md:hidden space-y-2">
        {{#each tabs}}
          <div data-accordion-item="{{@index}}">
            <!-- Accordion Header -->
            {{#if @first}}
            <button
              class="w-full flex items-center justify-between p-4 text-left border transition-colors duration-200"
              style="color: {{settings.theme.product_tabs_title_color}}; background-color: {{settings.theme.product_tabs_active_bg}}; border-color: {{settings.theme.product_tabs_border_color}}; border-radius: {{settings.theme.product_tabs_border_radius}};"
              data-action="toggle-accordion"
              data-accordion-index="{{@index}}"
              data-active-bg="{{settings.theme.product_tabs_active_bg}}"
              data-inactive-bg="{{settings.theme.product_tabs_inactive_bg}}"
              data-active-color="{{settings.theme.product_tabs_title_color}}"
              data-inactive-color="{{settings.theme.product_tabs_inactive_color}}">
              <span style="font-size: {{settings.theme.product_tabs_title_size}}; font-weight: {{settings.theme.product_tabs_font_weight}}; text-decoration: {{settings.theme.product_tabs_text_decoration}};">{{this.title}}</span>
              <svg
                class="w-5 h-5 transition-transform duration-200 accordion-chevron"
                style="transform: rotate(180deg);"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {{else}}
            <button
              class="w-full flex items-center justify-between p-4 text-left border transition-colors duration-200"
              style="color: {{settings.theme.product_tabs_inactive_color}}; background-color: {{settings.theme.product_tabs_inactive_bg}}; border-color: {{settings.theme.product_tabs_border_color}}; border-radius: {{settings.theme.product_tabs_border_radius}};"
              data-action="toggle-accordion"
              data-accordion-index="{{@index}}"
              data-active-bg="{{settings.theme.product_tabs_active_bg}}"
              data-inactive-bg="{{settings.theme.product_tabs_inactive_bg}}"
              data-active-color="{{settings.theme.product_tabs_title_color}}"
              data-inactive-color="{{settings.theme.product_tabs_inactive_color}}">
              <span style="font-size: {{settings.theme.product_tabs_title_size}}; font-weight: {{settings.theme.product_tabs_font_weight}}; text-decoration: {{settings.theme.product_tabs_text_decoration}};">{{this.title}}</span>
              <svg
                class="w-5 h-5 transition-transform duration-200 accordion-chevron"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {{/if}}

            <!-- Accordion Content -->
            <div class="accordion-content {{#if @first}}{{else}}hidden{{/if}} p-4 pt-0"
                 data-accordion-content="{{@index}}"
                 data-tab-type="{{this.tab_type}}"
                 data-tab-text-content="{{this.content}}">
              <div class="prose max-w-none text-gray-800 leading-relaxed tab-content-container p-6"
                   style="background-color: {{settings.theme.product_tabs_content_bg}};">
                {{#if (eq this.tab_type "text")}}
                  <div>{{{this.content}}}</div>
                {{/if}}

                {{#if (eq this.tab_type "description")}}
                  {{#if this.content}}
                    <div>{{{this.content}}}</div>
                  {{else}}
                    <div>{{{../product.description}}}</div>
                  {{/if}}
                {{/if}}

                {{#if (eq this.tab_type "attributes")}}
                  <div id="attributes-placeholder-mobile" data-attributes-container></div>
                {{/if}}

                {{#if (eq this.tab_type "attribute_sets")}}
                  <div id="attributes-placeholder-mobile" data-attributes-container data-attribute-set-ids="{{this.attribute_set_ids}}"></div>
                {{/if}}
              </div>
            </div>
          </div>
        {{/each}}
      </div>
    </div>
  `;

  // Use settings from props (passed from productContext)
  // Merge with defaults to ensure all theme settings have values
  // Slot config styles take precedence (synced from Admin Theme&Layout)
  const baseThemeSettings = getThemeDefaults(settings?.theme || {});
  const slotStyles = slotConfig?.styles || {};

  // Merge slot styles into theme settings - slot styles override base settings
  const themeSettings = {
    ...baseThemeSettings,
    // Map slot config styles to theme setting names
    ...(slotStyles.titleSize && { product_tabs_title_size: slotStyles.titleSize }),
    ...(slotStyles.fontWeight && { product_tabs_font_weight: slotStyles.fontWeight }),
    ...(slotStyles.borderRadius && { product_tabs_border_radius: slotStyles.borderRadius }),
    ...(slotStyles.textDecoration && { product_tabs_text_decoration: slotStyles.textDecoration }),
    ...(slotStyles.titleColor && { product_tabs_title_color: slotStyles.titleColor }),
    ...(slotStyles.activeBgColor && { product_tabs_active_bg: slotStyles.activeBgColor }),
    ...(slotStyles.inactiveColor && { product_tabs_inactive_color: slotStyles.inactiveColor }),
    ...(slotStyles.inactiveBgColor && { product_tabs_inactive_bg: slotStyles.inactiveBgColor }),
    ...(slotStyles.hoverColor && { product_tabs_hover_color: slotStyles.hoverColor }),
    ...(slotStyles.hoverBgColor && { product_tabs_hover_bg: slotStyles.hoverBgColor }),
    ...(slotStyles.borderColor && { product_tabs_border_color: slotStyles.borderColor }),
    ...(slotStyles.contentBgColor && { product_tabs_content_bg: slotStyles.contentBgColor }),
    ...(slotStyles.attributeLabelColor && { product_tabs_attribute_label_color: slotStyles.attributeLabelColor }),
  };

  const variableContext = {
    tabs: tabsData,
    product,
    settings: {
      theme: themeSettings
    }
  };

  const html = processVariables(template, variableContext);

  return (
    <div ref={containerRef} className={`product-tabs ${className}`}
         dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// For slot system registration
ProductTabs.displayName = 'ProductTabs';
