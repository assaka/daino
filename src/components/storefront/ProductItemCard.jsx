import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createProductUrl } from '@/utils/urlUtils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ProductLabelComponent, { renderLabelsGroupedByPosition } from '@/components/storefront/ProductLabel';
import { formatPriceWithTax, formatPriceNumber, safeNumber, getPriceDisplay } from '@/utils/priceUtils';
import cartService from '@/services/cartService';
import { ShoppingCart } from 'lucide-react';
import { getPrimaryImageUrl } from '@/utils/imageUtils';
import { getStockLabel, getStockLabelStyle, isProductOutOfStock } from '@/utils/stockUtils';
import { getProductName, getCurrentLanguage } from '@/utils/translationUtils';
import { useTranslation } from '@/contexts/TranslationContext';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';

/**
 * ProductItemCard - Reusable product card component
 * Can be used in ProductCard, CategorySlotRenderer, and other components
 */
const ProductItemCard = ({
  product,
  settings = {},
  store,
  productLabels = [],
  className = "",
  viewMode = 'grid',
  slotConfig = {},
  onAddToCartStateChange = null,
  isAddingToCart = false,
  isEditorMode = false,
  onElementClick = null,
  pageType = 'category' // 'category' or 'product' - determines which hide_currency setting to use
}) => {
  const { t, translations, currentLanguage } = useTranslation();

  // Local state for add to cart if not managed externally
  const [localIsAddingToCart, setLocalIsAddingToCart] = useState(false);

  // Use external state if provided, otherwise use local state
  const addingToCart = isAddingToCart || localIsAddingToCart;
  const setAddingToCart = onAddToCartStateChange || setLocalIsAddingToCart;

  if (!product || !store) return null;

  // Determine whether to hide currency based on page type
  // Category pages use hide_currency_category, product pages use hide_currency_product
  const hideCurrency = pageType === 'category'
    ? settings?.hide_currency_category
    : settings?.hide_currency_product;

  // Get slot configurations for styling - support both nested and flat structures
  const {
    productTemplate = {},
    productImage = {},
    productName: productNameSlot = {},
    productPrice = {},
    productComparePrice = {},
    productAddToCart = {},
    // Also check for card-specific slots
    product_card_template = {},
    product_card_image = {},
    product_card_name = {},
    product_card_price = {},
    product_card_compare_price = {},
    add_to_cart_button = {}
  } = slotConfig;

  // Get translated product name - use currentLanguage from context instead of getCurrentLanguage()
  const translatedProductName = getProductName(product, currentLanguage) || product.name;

  // Merge configurations (card-specific takes precedence)
  const templateConfig = { ...productTemplate, ...product_card_template };
  const imageConfig = { ...productImage, ...product_card_image };
  const nameConfig = { ...productNameSlot, ...product_card_name };
  const priceConfig = { ...productPrice, ...product_card_price };
  const comparePriceConfig = { ...productComparePrice, ...product_card_compare_price };
  const addToCartConfig = { ...productAddToCart, ...add_to_cart_button };

  // Product label logic - unified across all components
  const renderProductLabels = () => {
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
                const matches = productAttributeValue === conditionValue;
                return matches;
              }
            }
            return false;
          });
          if (!attributeMatch) {
            shouldShow = false;
          } else {
          }
        }
      } else {
      }
      return shouldShow;
    }) || [];

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

  const handleAddToCart = async (e) => {
    e.preventDefault(); // Prevent navigation when clicking the button
    e.stopPropagation();

    // Check if product is out of stock
    if (isProductOutOfStock(product)) {
      window.dispatchEvent(new CustomEvent('showFlashMessage', {
        detail: {
          type: 'error',
          message: t('product.out_of_stock', 'This product is currently out of stock.')
        }
      }));
      return;
    }

    // Prevent multiple rapid additions
    if (addingToCart) {
      return;
    }

    try {
      setAddingToCart(true);

      if (!product || !product.id) {
        console.error('Invalid product for add to cart');
        return;
      }

      if (!store?.id) {
        console.error('Store ID is required for add to cart');
        return;
      }

      // Add to cart using cartService
      // CRITICAL: Get the correct base price using utility function (same as ProductDetail)
      const priceInfo = getPriceDisplay(product);
      const basePrice = priceInfo.displayPrice;

      const result = await cartService.addItem(
        product.id,
        1, // quantity
        basePrice,
        [], // selectedOptions
        store.id
      );

      // CRITICAL: Use same success check as ProductDetail (result.success === true, not !== false)
      if (result.success) {
        // Track add to cart event
        if (typeof window !== 'undefined' && window.daino?.trackAddToCart) {
          window.daino.trackAddToCart(product, 1);
        }

        // Show flash message
        window.dispatchEvent(new CustomEvent('showFlashMessage', {
          detail: {
            type: 'success',
            message: `${translatedProductName} ${t('common.added_to_cart', 'added to cart successfully!')}`
          }
        }));
      } else {
        console.error('❌ Failed to add to cart:', result.error);

        // Show error flash message
        window.dispatchEvent(new CustomEvent('showFlashMessage', {
          detail: {
            type: 'error',
            message: `${t('common.failed_to_add', 'Failed to add')} ${translatedProductName} ${t('common.to_cart', 'to cart')}. ${t('common.please_try_again', 'Please try again')}.`
          }
        }));
      }
    } catch (error) {
      console.error("❌ Failed to add to cart", error);

      // Show error flash message for catch block
      window.dispatchEvent(new CustomEvent('showFlashMessage', {
        detail: {
          type: 'error',
          message: `${t('common.error_adding', 'Error adding')} ${translatedProductName} ${t('common.to_cart', 'to cart')}. ${t('common.please_try_again', 'Please try again')}.`
        }
      }));
    } finally {
      // Always reset the loading state after 2 seconds to prevent permanent lock
      setTimeout(() => {
        setAddingToCart(false);
      }, 2000);
    }
  };

  // Handle slot clicks in editor mode
  const handleSlotClick = (e, slotId) => {
    if (isEditorMode && onElementClick) {
      e.preventDefault();
      e.stopPropagation();
      onElementClick(slotId, e.currentTarget);
    }
  };

  return (
    <Card
      className={templateConfig.className || `group overflow-hidden ${className} ${viewMode === 'list' ? 'flex' : ''}`}
      style={templateConfig.styles || {}}
      data-product-card={isEditorMode ? 'editable' : undefined}
      data-slot-id={isEditorMode ? 'product_card_template' : undefined}
      onClick={isEditorMode ? (e) => handleSlotClick(e, 'product_card_template') : undefined}
    >
      <CardContent className="p-0">
        <Link to={createProductUrl(store.slug, product.slug)} onClick={isEditorMode ? (e) => e.preventDefault() : undefined}>
          <div
            className={imageConfig.parentClassName || "relative"}
            data-slot-id={isEditorMode ? 'product_card_image' : undefined}
            onClick={isEditorMode ? (e) => handleSlotClick(e, 'product_card_image') : undefined}
          >
            <img
              src={getPrimaryImageUrl(product.images) || '/placeholder-product.jpg'}
              alt={translatedProductName}
              className={imageConfig.className || `w-full ${viewMode === 'list' ? 'h-32' : 'h-48'} object-cover transition-transform duration-300 group-hover:scale-105`}
              style={imageConfig.styles || {}}
              loading="lazy"
              decoding="async"
            />
            {/* Product labels */}
            {renderProductLabels()}
          </div>
        </Link>
        <div className={viewMode === 'list' ? 'p-4 flex-1' : 'p-4'}>
          <h3
            className={nameConfig.className || "font-semibold text-lg truncate mt-1"}
            style={nameConfig.styles || {}}
            data-slot-id={isEditorMode ? 'product_card_name' : undefined}
          >
            <Link to={createProductUrl(store.slug, product.slug)} onClick={isEditorMode ? (e) => e.preventDefault() : undefined}>{translatedProductName}</Link>
          </h3>

          {viewMode === 'list' && product.description && (
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {product.description}
            </p>
          )}

          <div className="space-y-3 mt-4">
            {/* Stock label - uses centralized utility */}
            {(() => {
              const stockLabelInfo = getStockLabel(product, settings, null, translations);
              const stockLabelStyle = getStockLabelStyle(product, settings, null, translations);

              if (!stockLabelInfo) return null;

              return (
                <div className="mb-2">
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={stockLabelStyle}
                  >
                    {stockLabelInfo.text}
                  </span>
                </div>
              );
            })()}

            {/* Price display */}
            <div
              className="flex items-baseline gap-2"
              data-slot-id={isEditorMode ? 'product_card_price_container' : undefined}
              onClick={isEditorMode ? (e) => handleSlotClick(e, 'product_card_price_container') : undefined}
            >
              {(() => {
                const priceInfo = getPriceDisplay(product);

                if (priceInfo.hasComparePrice) {
                  return (
                    <>
                      <p
                        className={priceConfig.className || "font-bold text-red-600 text-xl"}
                        style={priceConfig.styles || {}}
                        data-slot-id={isEditorMode ? 'product_card_price' : undefined}
                        onClick={isEditorMode ? (e) => handleSlotClick(e, 'product_card_price') : undefined}
                      >
                        {!hideCurrency && settings?.currency_symbol}{formatPriceNumber(priceInfo.displayPrice)}
                      </p>
                      <p
                        className={comparePriceConfig.className || "text-gray-500 line-through text-sm"}
                        style={comparePriceConfig.styles || {}}
                        data-slot-id={isEditorMode ? 'product_card_compare_price' : undefined}
                        onClick={isEditorMode ? (e) => handleSlotClick(e, 'product_card_compare_price') : undefined}
                      >
                        {!hideCurrency && settings?.currency_symbol}{formatPriceNumber(priceInfo.originalPrice)}
                      </p>
                    </>
                  );
                }

                return (
                  <p
                    className={priceConfig.className || "font-bold text-xl text-gray-900"}
                    style={priceConfig.styles || {}}
                    data-slot-id={isEditorMode ? 'product_card_price' : undefined}
                    onClick={isEditorMode ? (e) => handleSlotClick(e, 'product_card_price') : undefined}
                  >
                    {!hideCurrency && settings?.currency_symbol}{formatPriceNumber(priceInfo.displayPrice)}
                  </p>
                );
              })()}
            </div>

            {/* Add to Cart Button */}
            <Button
              onClick={isEditorMode ? (e) => handleSlotClick(e, 'add_to_cart_button') : handleAddToCart}
              disabled={(addingToCart || isProductOutOfStock(product)) && !isEditorMode}
              variant="themed"
              className={addToCartConfig.className || "w-full text-white border-0 btn-add-to-cart transition-all duration-200"}
              size="sm"
              style={{
                backgroundColor: settings?.theme?.add_to_cart_button_color || getThemeDefaults().add_to_cart_button_color,
                color: 'white',
                opacity: isProductOutOfStock(product) && !isEditorMode ? 0.5 : 1,
                cursor: isProductOutOfStock(product) && !isEditorMode ? 'not-allowed' : 'pointer',
                ...addToCartConfig.styles
              }}
              data-slot-id={isEditorMode ? 'add_to_cart_button' : undefined}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {isProductOutOfStock(product) && !isEditorMode
                ? t('product.out_of_stock', 'Out of Stock')
                : addingToCart
                ? t('common.adding', 'Adding...')
                : (addToCartConfig.content || t('product.add_to_cart', 'Add to Cart'))}
            </Button>

            {/* Stock status for list view */}
            {viewMode === 'list' && (() => {
              const stockLabelInfo = getStockLabel(product, settings, null, translations);
              const stockLabelStyle = getStockLabelStyle(product, settings, null, translations);

              if (!stockLabelInfo) return null;

              return (
                <div className="mt-2">
                  <span
                    className="text-xs px-2 py-1 rounded"
                    style={stockLabelStyle}
                  >
                    {stockLabelInfo.text}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductItemCard;