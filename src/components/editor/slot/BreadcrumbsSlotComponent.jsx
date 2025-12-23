/**
 * Breadcrumbs Slot Component
 * Unified breadcrumbs component for both category and product pages
 */

import React from 'react';
import { createSlotComponent, registerSlotComponent } from './SlotComponentRegistry';
import Breadcrumbs from '@/components/shared/Breadcrumbs.jsx';
import { buildBreadcrumbs } from '@/utils/breadcrumbUtils';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';

const BreadcrumbsSlotComponent = createSlotComponent({
  name: 'Breadcrumbs',
  render: (props) => {
    const { slot, categoryContext, productContext } = props;

    console.log('🍞 BreadcrumbsSlotComponent render:', {
      hasCategoryContext: !!categoryContext,
      hasProductContext: !!productContext,
      categoryContextKeys: categoryContext ? Object.keys(categoryContext) : [],
      productContextKeys: productContext ? Object.keys(productContext) : []
    });

    // Determine context (category or product)
    const context = categoryContext || productContext;

    if (!context) {
      console.log('🍞 BreadcrumbsSlotComponent: No context, returning null');
      return null;
    }

    const { category, product, store, categories = [], settings = {}, breadcrumbs: prebuiltBreadcrumbs } = context;

    console.log('🍞 BreadcrumbsSlotComponent data:', {
      hasCategory: !!category,
      hasProduct: !!product,
      hasStore: !!store,
      categoriesCount: categories?.length,
      hasPrebuiltBreadcrumbs: !!prebuiltBreadcrumbs,
      prebuiltBreadcrumbsLength: prebuiltBreadcrumbs?.length,
      prebuiltBreadcrumbs
    });

    // Use pre-built breadcrumbs if available (already built by Category.jsx or ProductDetail.jsx)
    // Otherwise build them here (fallback for editor or when not pre-built)
    let breadcrumbItems = prebuiltBreadcrumbs;

    if (!breadcrumbItems || breadcrumbItems.length === 0) {
      const pageType = category ? 'category' : 'product';
      const contextData = category || product;
      const storeCode = store?.public_storecode || store?.slug || store?.code;
      breadcrumbItems = buildBreadcrumbs(
        pageType,
        contextData,
        storeCode,
        categories,
        settings
      );
    }

    if (!breadcrumbItems || breadcrumbItems.length === 0) return null;

    // Get configuration: priority is store theme settings > slot metadata > defaults
    const storeTheme = settings?.theme || {};
    const slotMetadata = slot?.metadata || {};

    const config = {
      showHomeIcon: storeTheme.breadcrumb_show_home_icon ?? slotMetadata.showHomeIcon ?? true,
      itemTextColor: storeTheme.breadcrumb_item_text_color || slotMetadata.itemTextColor || getThemeDefaults().breadcrumb_item_text_color,
      itemHoverColor: storeTheme.breadcrumb_item_hover_color || slotMetadata.itemHoverColor || getThemeDefaults().breadcrumb_item_hover_color,
      activeItemColor: storeTheme.breadcrumb_active_item_color || slotMetadata.activeItemColor || getThemeDefaults().breadcrumb_active_item_color,
      separatorColor: storeTheme.breadcrumb_separator_color || slotMetadata.separatorColor || getThemeDefaults().breadcrumb_separator_color,
      fontSize: storeTheme.breadcrumb_font_size || slotMetadata.fontSize || '0.875rem',
      mobileFontSize: storeTheme.breadcrumb_mobile_font_size || slotMetadata.mobileFontSize || '0.75rem',
      fontWeight: storeTheme.breadcrumb_font_weight || slotMetadata.fontWeight || '400'
    };

    return <Breadcrumbs items={breadcrumbItems} config={config} />;
  }
});

// Register the component
registerSlotComponent('Breadcrumbs', BreadcrumbsSlotComponent);

export default BreadcrumbsSlotComponent;
