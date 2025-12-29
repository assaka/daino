/**
 * SlotBasedProductCard - Unified product card component using slot-based rendering
 *
 * This component replaces ProductItemCard by using the same slot-based rendering
 * system as the category page ProductGrid. This ensures consistent styling between
 * editor and storefront, and eliminates duplication.
 *
 * Usage:
 * <SlotBasedProductCard
 *   product={product}
 *   store={store}
 *   settings={settings}
 *   slotConfig={slotConfig} // Optional: custom slot configuration
 *   productLabels={productLabels}
 *   className="custom-class"
 * />
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { UnifiedSlotRenderer } from '@/components/editor/slot/UnifiedSlotRenderer';
import { processVariables } from '@/utils/variableProcessor';
import { formatPrice, formatPriceNumber, getPriceDisplay } from '@/utils/priceUtils';
import { getStockLabel, getStockLabelStyle, isProductOutOfStock } from '@/utils/stockUtils';
import { getProductName, getCurrentLanguage } from '@/utils/translationUtils';
import { createProductUrl } from '@/utils/urlUtils';
import { renderLabelsGroupedByPosition } from '@/components/storefront/ProductLabel';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';
import { enrichSettings } from '@/utils/slotDataPreprocessor';

// Default slot configuration for product cards (fallback when no custom config provided)
const DEFAULT_PRODUCT_CARD_SLOTS = {
  product_card_template: {
    id: 'product_card_template',
    type: 'container',
    content: '',
    className: 'group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden',
    styles: {},
    parentId: null,
    metadata: { hierarchical: true, isTemplate: true }
  },
  product_card_image: {
    id: 'product_card_image',
    type: 'image',
    content: '{{this.image_url}}',
    className: 'w-full aspect-square object-cover',
    parentClassName: 'relative overflow-hidden',
    styles: {},
    parentId: 'product_card_template',
    colSpan: 12,
    metadata: { displayName: 'Product Image' }
  },
  product_card_content: {
    id: 'product_card_content',
    type: 'container',
    content: '',
    className: 'p-4',
    styles: {},
    parentId: 'product_card_template',
    colSpan: 12,
    metadata: { hierarchical: true }
  },
  product_card_name: {
    id: 'product_card_name',
    type: 'text',
    content: '<a href="{{this.url}}" class="hover:text-blue-600 transition-colors">{{this.name}}</a>',
    className: 'text-sm font-medium text-gray-900 mb-2 line-clamp-2',
    styles: {},
    parentId: 'product_card_content',
    colSpan: 12,
    metadata: { displayName: 'Product Name', htmlTag: 'h3' }
  },
  product_card_price_container: {
    id: 'product_card_price_container',
    type: 'container',
    content: '',
    className: 'flex items-center gap-2 mb-2',
    styles: {},
    parentId: 'product_card_content',
    colSpan: 12,
    metadata: { hierarchical: true }
  },
  product_card_price: {
    id: 'product_card_price',
    type: 'text',
    content: '{{this.price_formatted}}',
    className: 'text-lg font-bold text-gray-900',
    styles: {},
    parentId: 'product_card_price_container',
    colSpan: 'col-span-12',
    metadata: { displayName: 'Price' }
  },
  product_card_compare_price: {
    id: 'product_card_compare_price',
    type: 'text',
    content: '{{this.compare_price_formatted}}',
    className: 'text-sm text-gray-500 line-through',
    styles: {},
    parentId: 'product_card_price_container',
    colSpan: 'col-span-12',
    conditionalDisplay: 'this.compare_price_formatted',
    metadata: { displayName: 'Compare Price', conditionalDisplay: 'this.compare_price_formatted' }
  },
  add_to_cart_button: {
    id: 'add_to_cart_button',
    type: 'button',
    content: 'Add to Cart',
    className: 'w-full py-2 px-4 rounded-md text-white font-medium flex items-center justify-center gap-2',
    styles: {
      backgroundColor: '{{settings.theme.add_to_cart_button_bg_color}}',
      color: '{{settings.theme.add_to_cart_button_text_color}}',
      borderRadius: '{{settings.theme.add_to_cart_button_border_radius}}'
    },
    parentId: 'product_card_content',
    colSpan: 12,
    metadata: {
      displayName: 'Add to Cart Button',
      outOfStockContent: 'Out of Stock',
      outOfStockClassName: 'w-full py-2 px-4 rounded-md bg-gray-400 text-white font-medium cursor-not-allowed'
    }
  }
};

/**
 * Format a single product with all necessary fields for template rendering
 */
function formatProduct(product, context) {
  const { store, settings, currentLanguage, productLabels = [] } = context;

  // Use centralized getPriceDisplay utility
  const priceInfo = getPriceDisplay(product);

  // Get translated product name
  const translatedName = getProductName(product, currentLanguage) || product.name;

  // Calculate stock status
  const isInStock = !isProductOutOfStock(product);
  const stockLabelInfo = getStockLabel(product, settings, null, {});
  const stockLabelStyle = getStockLabelStyle(product, settings, null, {});

  // Get image URL
  const imageUrl = product.images?.[0]?.url || product.image_url || product.image || '';

  // Build product URL
  const productUrl = product.url || createProductUrl(
    store?.public_storecode || store?.slug || store?.code,
    product.slug || product.id
  );

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
    // URLs
    image_url: imageUrl,
    url: productUrl,
    // Stock info
    in_stock: isInStock,
    stock_label: stockLabelInfo?.text || '',
    stock_label_style: stockLabelStyle,
    // Sale flag
    is_sale: priceInfo.isSale,
  };
}

/**
 * Render product labels for a product
 */
function renderProductLabels(product, productLabels = []) {
  if (!product || !productLabels || productLabels.length === 0) return null;

  // Filter labels that match the product conditions
  const matchingLabels = productLabels.filter((label) => {
    let shouldShow = true;

    if (label.conditions && Object.keys(label.conditions).length > 0) {
      // Check product_ids condition
      if (shouldShow && label.conditions.product_ids?.length > 0) {
        if (!label.conditions.product_ids.includes(product.id)) {
          shouldShow = false;
        }
      }

      // Check category_ids condition
      if (shouldShow && label.conditions.category_ids?.length > 0) {
        if (!product.category_ids || !product.category_ids.some(catId => label.conditions.category_ids.includes(catId))) {
          shouldShow = false;
        }
      }

      // Check price conditions (sale)
      if (shouldShow && label.conditions.price_conditions?.has_sale_price) {
        if (!product.is_sale) {
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

  return renderLabelsGroupedByPosition(sortedLabels);
}

const SlotBasedProductCard = ({
  product,
  store,
  settings = {},
  slotConfig = null, // Custom slot configuration from page config
  productLabels = [],
  className = '',
  viewMode = 'grid'
}) => {
  if (!product || !store) return null;

  const currentLanguage = getCurrentLanguage();
  const enrichedSettings = enrichSettings(settings);

  // Format the product with all necessary fields
  const formattedProduct = formatProduct(product, {
    store,
    settings: enrichedSettings,
    currentLanguage,
    productLabels
  });

  // Merge default slots with custom config
  const baseSlots = slotConfig?.slots || DEFAULT_PRODUCT_CARD_SLOTS;

  // Build slots with processed content for this specific product
  const productSlots = {};
  Object.entries(baseSlots).forEach(([slotId, slot]) => {
    // Skip slots that don't belong to product_card hierarchy
    if (!slotId.startsWith('product_card') && slotId !== 'add_to_cart_button') {
      return;
    }

    const productContext = {
      this: formattedProduct,
      product: formattedProduct,
      settings: enrichedSettings
    };

    // Process content with product variables
    let processedContent = slot.content || '';
    if (typeof processedContent === 'string') {
      processedContent = processVariables(processedContent, productContext);
    }

    // Process styles with theme variables
    const processedStyles = {};
    if (slot.styles) {
      Object.entries(slot.styles).forEach(([key, value]) => {
        if (typeof value === 'string') {
          processedStyles[key] = processVariables(value, productContext);
        } else {
          processedStyles[key] = value;
        }
      });
    }

    // Add stock label styles if applicable
    const finalStyles = slotId === 'product_card_stock_label' && formattedProduct.stock_label_style
      ? { ...processedStyles, ...formattedProduct.stock_label_style }
      : processedStyles;

    productSlots[slotId] = {
      ...slot,
      content: processedContent,
      styles: finalStyles
    };
  });

  // Variable context for UnifiedSlotRenderer
  const variableContext = {
    this: formattedProduct,
    product: formattedProduct,
    settings: enrichedSettings,
    productLabels
  };

  const templateSlot = productSlots.product_card_template || DEFAULT_PRODUCT_CARD_SLOTS.product_card_template;

  return (
    <div
      className={`${templateSlot.className || ''} ${className}`}
      style={{ ...templateSlot.styles, overflow: 'visible', width: '100%', position: 'relative' }}
    >
      {/* Product labels - positioned absolutely over the image */}
      {renderProductLabels(formattedProduct, productLabels)}

      <UnifiedSlotRenderer
        slots={productSlots}
        parentId="product_card_template"
        context="storefront"
        productData={{
          product: formattedProduct,
          store,
          settings: enrichedSettings,
          productLabels,
          canAddToCart: formattedProduct.in_stock
        }}
        viewMode={viewMode}
        preprocessedData={{
          settings: enrichedSettings,
          productLabels
        }}
      />
    </div>
  );
};

export default SlotBasedProductCard;
