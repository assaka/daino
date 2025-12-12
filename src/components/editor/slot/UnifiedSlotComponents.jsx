/**
 * UnifiedSlotComponents - Unified component implementations for both editor and storefront
 *
 * Components implement the unified interface:
 * - renderEditor(): Visual preview for editor
 * - renderStorefront(): Full functionality for storefront
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { processVariables } from '@/utils/variableProcessor';
import { formatPrice as formatPriceUtil, getPriceDisplay } from '@/utils/priceUtils';
import { getStockLabel as getStockLabelUtil, getStockLabelStyle } from '@/utils/stockUtils';
import {
  ShoppingCart,
  Heart,
  Plus,
  Minus,
  Star,
  Home,
  Trash2,
} from 'lucide-react';
import { registerSlotComponent, createSlotComponent } from './SlotComponentRegistry';
import ProductTabsComponent from '@/components/storefront/ProductTabs';
import CustomOptionsComponent from '@/components/storefront/CustomOptions';
import TotalPriceDisplayComponent from '@/components/storefront/TotalPriceDisplay';
import CmsBlockRendererComponent from '@/components/storefront/CmsBlockRenderer';
import ConfigurableProductSelectorComponent from '@/components/storefront/ConfigurableProductSelector';
import ProductLabelComponent from '@/components/storefront/ProductLabel';
import { getCurrentLanguage, getTranslatedField } from '@/utils/translationUtils';

// Import category and header slot components to register them
import './CategorySlotComponents.jsx';
import './HeaderSlotComponents.jsx';
import './BreadcrumbsSlotComponent.jsx';


/**
 * QuantitySelector - Unified quantity selector component
 */
const QuantitySelector = createSlotComponent({
  name: 'QuantitySelector',
  render: ({ slot, productContext, className, styles, context, variableContext }) => {
    // CRITICAL: Check hide_quantity_selector setting FIRST (before any other logic)
    // Check both productContext and variableContext for settings
    // Default to false (show quantity selector) when setting is undefined or not set
    const settings = productContext?.settings || variableContext?.settings || {};
    const hideQuantitySelector = settings.hide_quantity_selector ?? false;
    if (hideQuantitySelector === true) {
      return null;
    }

    const containerRef = React.useRef(null);
    const content = slot?.content || '';

    // Process variables in content
    const processedContent = processVariables(content, variableContext);

    React.useEffect(() => {
      if (!containerRef.current || context === 'editor') return;

      const decreaseBtn = containerRef.current.querySelector('[data-action="decrease"]');
      const increaseBtn = containerRef.current.querySelector('[data-action="increase"]');
      const quantityInput = containerRef.current.querySelector('[data-quantity-input]');

      if (!decreaseBtn || !increaseBtn || !quantityInput) return;

      const { quantity, setQuantity } = productContext;

      // Set initial value
      if (quantityInput && quantity) {
        quantityInput.value = quantity;
      }

      const handleDecrease = (e) => {
        e.preventDefault();
        if (setQuantity && quantity > 1) {
          setQuantity(Math.max(1, quantity - 1));
        }
      };

      const handleIncrease = (e) => {
        e.preventDefault();
        if (setQuantity) {
          setQuantity(quantity + 1);
        }
      };

      const handleInputChange = (e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= 1 && setQuantity) {
          setQuantity(val);
        }
      };

      decreaseBtn.addEventListener('click', handleDecrease);
      increaseBtn.addEventListener('click', handleIncrease);
      quantityInput.addEventListener('change', handleInputChange);

      return () => {
        decreaseBtn.removeEventListener('click', handleDecrease);
        increaseBtn.removeEventListener('click', handleIncrease);
        quantityInput.removeEventListener('change', handleInputChange);
      };
    }, [productContext, context]);

    // Update input value when quantity changes
    React.useEffect(() => {
      if (!containerRef.current || context === 'editor') return;
      const quantityInput = containerRef.current.querySelector('[data-quantity-input]');
      if (quantityInput && productContext?.quantity) {
        quantityInput.value = productContext.quantity;
      }
    }, [productContext?.quantity, context]);

    if (context === 'editor') {
      // Editor version - visual preview only
      return (
        <div
          ref={containerRef}
          className={className}
          style={styles}
          dangerouslySetInnerHTML={{ __html: processedContent }}
        />
      );
    }

    // Storefront version - full functionality
    return (
      <div
        ref={containerRef}
        className={className}
        style={styles}
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    );
  },

  metadata: {
    displayName: 'Quantity Selector',
    category: 'Product'
  }
});
//
// /**
//  * AddToCartButton - Unified add to cart button component
//  */
// const AddToCartButton = createSlotComponent({
//   name: 'AddToCartButton',
//   render: ({ slot, productContext, className, styles, context }) => {
//     if (context === 'editor') {
//       // Editor version - visual preview only
//       return (
//         <div className={className} style={styles}>
//           <button className="flex-1 h-12 text-lg bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-medium">
//             Add to Cart
//           </button>
//         </div>
//       );
//     }
//
//     // Storefront version - full functionality
//     const { handleAddToCart, canAddToCart, product } = productContext;
//
//     const handleClick = (e) => {
//       if (handleAddToCart) {
//         handleAddToCart(e);
//       }
//     };
//
//     return (
//       <div className={className} style={styles}>
//         <Button
//           onClick={handleClick}
//           disabled={!canAddToCart}
//           className="flex-1 h-12 text-lg bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed"
//         >
//           <ShoppingCart className="w-5 h-5 mr-2" />
//           Add to Cart
//         </Button>
//       </div>
//     );
//   }
// });

/**
 * ProductBreadcrumbs - Unified breadcrumb component
 */
const ProductBreadcrumbs = createSlotComponent({
  name: 'ProductBreadcrumbsSlot',

  render: ({ slot, productContext, className, styles, context }) => {
    if (context === 'editor') {
      // Editor version - visual preview only
      return (
        <div className={className} style={styles}>
          <nav className="flex items-center text-sm text-gray-600">
            <Home className="w-4 h-4 mr-2" />
            <span>Home &gt; Category &gt; Product</span>
          </nav>
        </div>
      );
    }

    // Storefront version - full functionality
    const { breadcrumbs } = productContext;

    return (
      <div className={className} style={styles}>
        <nav className="flex items-center text-sm text-gray-600">
          {/* Home Icon */}
          <Link to="/" className="flex items-center hover:text-gray-900 mr-2">
            <Home className="w-4 h-4" />
          </Link>

          {/* Breadcrumb Items */}
          {breadcrumbs && breadcrumbs.length > 0 ? (
            breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center">
                <span className="mx-2 text-gray-400">&gt;</span>
                {crumb.url ? (
                  <Link to={crumb.url} className="hover:text-gray-900 whitespace-nowrap">
                    {crumb.name}
                  </Link>
                ) : (
                  <span className="text-gray-900 whitespace-nowrap">{crumb.name}</span>
                )}
              </span>
            ))
          ) : (
            <>
              <span className="mx-2 text-gray-400">&gt;</span>
              <span>Product</span>
            </>
          )}
        </nav>
      </div>
    );
  }
});


/**
 * ProductGallery - Legacy unified gallery component (keeping for backward compatibility)
 */
const ProductGallery = createSlotComponent({
  name: 'ProductGallerySlot',

  render: ({ slot, productContext, className, styles, context, variableContext }) => {
    // Get settings from variableContext
    const settings = variableContext?.settings || {};

    const galleryLayout = settings.product_gallery_layout || 'horizontal';
    const verticalPosition = settings.vertical_gallery_position || 'left';
    const mobileLayout = settings.mobile_gallery_layout || 'below';
    const isVertical = galleryLayout === 'vertical';

    // For storefront, get state from productContext
    const activeImageIndex = productContext?.activeImageIndex || 0;
    const setActiveImageIndex = productContext?.setActiveImageIndex;

    // Thumbnail renderer
    // Mobile: always horizontal row
    // Desktop: horizontal row for horizontal layout, vertical column for vertical layout
    const renderThumbnails = (images, getImageUrl, productName, activeIdx, setActiveIdx, extraClass = '') => {
      const thumbContainerClass = isVertical
        ? 'flex flex-row overflow-x-auto space-x-2 sm:flex-col sm:overflow-visible sm:space-x-0 sm:space-y-2 sm:w-24 flex-shrink-0'
        : 'flex flex-row overflow-x-auto space-x-2';

      return (
        <div className={`${thumbContainerClass} ${extraClass}`.trim()}>
          {images.map((image, index) => {
            const thumbUrl = typeof getImageUrl === 'function' ? getImageUrl(image) : image;
            return (
              <button
                key={index}
                onClick={() => setActiveIdx && setActiveIdx(index)}
                className={`relative group flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:shadow-md ${
                  activeIdx === index
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <img
                  src={thumbUrl}
                  alt={`${productName} ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=Error'; }}
                />
                {activeIdx === index && (
                  <div className="absolute top-1 right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      );
    };

    // Main image renderer
    const renderMainImage = (imageSrc, altText, productLabels, product, extraClass = '') => (
      <div className={extraClass}>
        <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
          <img src={imageSrc} alt={altText} className="w-full h-full object-cover" />
          {productLabels && productLabels.length > 0 && (
            <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-2 justify-between">
              {productLabels.map((label, index) => (
                <Badge
                  key={index}
                  variant="default"
                  style={{
                    backgroundColor: label.background_color || '#3B82F6',
                    color: label.text_color || '#FFFFFF'
                  }}
                >
                  {label.text || label}
                </Badge>
              ))}
            </div>
          )}
          {product?.compare_price && parseFloat(product.compare_price) > parseFloat(product.price) && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive" className="bg-red-600 text-white">SALE</Badge>
            </div>
          )}
        </div>
      </div>
    );

    // Build thumbnail order classes based on settings
    // Mobile: controlled by mobileLayout (above/below)
    // Desktop vertical: controlled by verticalPosition (left/right)
    const getThumbnailOrderClass = () => {
      const mobileOrder = mobileLayout === 'above' ? 'order-first' : 'order-last';
      if (isVertical) {
        const desktopOrder = verticalPosition === 'left' ? 'sm:order-first' : 'sm:order-last';
        return `${mobileOrder} ${desktopOrder}`;
      }
      // Horizontal: always below on desktop
      return `${mobileOrder} sm:order-last`;
    };

    // EDITOR VERSION
    if (context === 'editor') {
      const demoImages = Array.from({ length: 4 }, (_, i) => `https://placehold.co/100x100?text=Thumb+${i + 1}`);
      // Always flex-col on mobile, flex-row on desktop for vertical layout
      const containerClass = isVertical
        ? 'flex flex-col sm:flex-row gap-4'
        : 'flex flex-col gap-4';
      const finalContainerClass = className ? `${containerClass} ${className}` : containerClass;

      return (
        <div className={finalContainerClass} style={styles}>
          {renderMainImage('https://placehold.co/600x600?text=Product+Image', 'Product', null, null, `order-none ${isVertical ? 'sm:flex-1' : ''}`)}
          {renderThumbnails(demoImages, (img) => img, 'Demo', 0, null, getThumbnailOrderClass())}
        </div>
      );
    }

    // STOREFRONT VERSION
    const { product } = productContext || {};
    if (!product) return null;

    const images = product.images || [];

    const getImageUrl = (img) => {
      if (!img) return 'https://placehold.co/600x600?text=No+Image';
      if (typeof img === 'string') return img;
      if (typeof img === 'object') {
        return img.url || img.src || img.image || img.thumbnail || img.path || 'https://placehold.co/600x600?text=No+Image';
      }
      return 'https://placehold.co/600x600?text=No+Image';
    };

    const currentImage = getImageUrl(images[activeImageIndex]) || getImageUrl(images[0]) || 'https://placehold.co/600x600?text=No+Image';
    const hasMultipleImages = images.length > 1;

    // Container classes - always flex-col on mobile, flex-row on desktop for vertical
    const containerClass = isVertical
      ? 'flex flex-col sm:flex-row gap-4'
      : 'flex flex-col gap-4';
    const finalContainerClass = className ? `${containerClass} ${className}` : containerClass;

    return (
      <div className={finalContainerClass} style={styles}>
        {renderMainImage(currentImage, product.name, productContext.productLabels, product, `order-none ${isVertical ? 'sm:flex-1' : ''}`)}
        {hasMultipleImages &&
          renderThumbnails(images, getImageUrl, product.name, activeImageIndex, setActiveImageIndex, getThumbnailOrderClass())}
      </div>
    );
  }
});

// ProductInfo component removed - not used in product-config.js
// Product name and info are rendered via Handlebars templates in the config

/**
 * ProductOptions - Unified product options component
 */
const ProductOptions = createSlotComponent({
  name: 'ProductOptionsSlot',

  render: ({ slot, productContext, className, styles, context }) => {
    if (context === 'editor') {
      // Editor version - visual preview only
      return (
        <div className={className} style={styles}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block font-medium text-gray-900">Size *</label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2">
                <option value="">Choose Size...</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        </div>
      );
    }

    // Storefront version - full functionality
    const { customOptions, handleOptionChange } = productContext;

    return (
      <div className={className} style={styles}>
        {customOptions && customOptions.length > 0 && (
          <div className="space-y-4">
            {customOptions.map((option) => (
              <div key={option.id} className="space-y-2">
                <label className="block font-medium text-gray-900">
                  {option.name}
                  {option.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {option.type === 'select' && (
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    onChange={(e) => {
                      const selectedOpt = option.options.find(opt => opt.value === e.target.value);
                      handleOptionChange && handleOptionChange(option.id, selectedOpt);
                    }}
                    required={option.required}
                  >
                    <option value="">Choose {option.name}...</option>
                    {option.options.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.name} {opt.price > 0 && `(+${formatPriceUtil(opt.price)})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
});

/**
 * ProductTabs - Unified product tabs component
 */
const ProductTabs = createSlotComponent({
  name: 'ProductTabsSlot',

  render: ({ slot, productContext, className, styles, context, variableContext }) => {
    if (context === 'editor') {
      const containerRef = React.useRef(null);
      const content = slot?.content || '';
      // Editor version - static preview with config HTML
      const sampleTabs = [
        { id: 'description', title: 'Description', isActive: true, tab_type: 'text', content: '<p>This is a sample product description.</p>' },
        { id: 'specifications', title: 'Specifications', isActive: false, tab_type: 'attributes' },
        { id: 'reviews', title: 'Reviews', isActive: false, tab_type: 'text', content: '<p>Customer reviews will appear here.</p>' }
      ];

      const sampleProduct = {
        description: '<p>Sample product description</p>',
        attributes: { color: 'Blue', size: 'Medium' }
      };

      const editorVariableContext = {
        ...variableContext,
        tabs: sampleTabs,
        product: sampleProduct
      };

      const processedContent = processVariables(content, editorVariableContext);

      // Render tab content for editor
      React.useEffect(() => {
        if (!containerRef.current) return;

        const tabPanels = containerRef.current.querySelectorAll('[data-tab-type]');

        tabPanels.forEach((panel) => {
          const tabType = panel.getAttribute('data-tab-type');
          const textContent = panel.getAttribute('data-tab-text-content');
          const contentContainer = panel.querySelector('.prose');

          if (!contentContainer) return;

          let html = '';

          switch (tabType) {
            case 'text':
              html = `<div>${textContent || ''}</div>`;
              break;
            case 'description':
              html = `<div>${sampleProduct?.description || ''}</div>`;
              break;
            case 'attributes':
              if (sampleProduct?.attributes && Object.keys(sampleProduct.attributes).length > 0) {
                const template = contentContainer.getAttribute('data-attributes-template') || `
                  <div class="flex justify-between py-2 border-b border-gray-100">
                    <span class="font-bold capitalize">__KEY__</span>
                    <span>__VALUE__</span>
                  </div>
                `;

                const itemsHtml = Object.entries(sampleProduct.attributes).map(([key, value]) =>
                  template
                    .replace('__KEY__', key.replace(/_/g, ' '))
                    .replace('__VALUE__', String(value ?? ''))
                ).join('');

                html = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${itemsHtml}</div>`;
              } else {
                html = '<p class="text-gray-500">No specifications available for this product.</p>';
              }
              break;
            case 'attribute_sets':
              html = '<p class="text-gray-500">Attribute sets preview.</p>';
              break;
            default:
              html = '<p class="text-gray-500">Unknown tab type.</p>';
          }

          contentContainer.innerHTML = html;
        });
      }, [processedContent]);

      return (
        <div ref={containerRef} className={className} style={styles}
             dangerouslySetInnerHTML={{ __html: processedContent }} />
      );
    }

    // Storefront version - Use the standalone ProductTabs component
    const { productTabs, product, settings } = productContext;

    // Use the ProductTabsComponent which has proper translation support
    return (
      <div className={className} style={styles}>
        <ProductTabsComponent
          productTabs={productTabs || []}
          product={product}
          settings={settings}
          className=""
          slotConfig={slot}
        />
      </div>
    );
  }
});

/**
 * ProductRecommendations - Unified product recommendations component
 */
const ProductRecommendations = createSlotComponent({
  name: 'ProductRecommendationsSlot',

  render: ({ slot, productContext, className, styles, context }) => {
    if (context === 'editor') {
      // Editor version - visual preview only
      return (
        <div className={className} style={styles}>
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Recommended Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((index) => (
                <Card key={index} className="group hover:shadow-lg transition-shadow duration-200">
                  <div className="relative aspect-square overflow-hidden rounded-t-lg">
                    <img
                      src={`https://placehold.co/300x300?text=Product+${index}`}
                      alt={`Product ${index}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Sample Product {index}</h3>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-bold text-green-600">$99.99</span>
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <span>(12)</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Storefront version - full functionality
    const { relatedProducts } = productContext;

    if (!relatedProducts || relatedProducts.length === 0) return null;

    return (
      <div className={className} style={styles}>
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Recommended Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {relatedProducts.slice(0, 4).map((relatedProduct) => {
              // Use translated product name
              const translatedProductName = relatedProduct.name;

              return (
                <Card key={relatedProduct.id} className="group hover:shadow-lg transition-shadow duration-200">
                  <div className="relative aspect-square overflow-hidden rounded-t-lg">
                    <img
                      src={relatedProduct.images?.[0] || 'https://placehold.co/300x300?text=No+Image'}
                      alt={translatedProductName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    {relatedProduct.compare_price && parseFloat(relatedProduct.compare_price) > parseFloat(relatedProduct.price) && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="destructive" className="bg-red-600 text-white text-xs">
                          SALE
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{translatedProductName}</h3>
                    <div className="flex items-center space-x-2 mb-2">
                      {(() => {
                        const priceInfo = getPriceDisplay(relatedProduct);

                        if (priceInfo.hasComparePrice) {
                          return (
                            <>
                              <span className="font-bold text-red-600">
                                {formatPriceUtil(priceInfo.displayPrice)}
                              </span>
                              <span className="text-sm text-gray-500 line-through">
                                {formatPriceUtil(priceInfo.originalPrice)}
                              </span>
                            </>
                          );
                        }

                        return (
                          <span className="font-bold text-green-600">
                            {formatPriceUtil(priceInfo.displayPrice)}
                          </span>
                        );
                      })()}
                    </div>
                    {relatedProduct.rating && (
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i < Math.floor(relatedProduct.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                        <span>({relatedProduct.reviews_count || 0})</span>
                      </div>
                    )}
                </CardContent>
              </Card>
            )})}
          </div>
        </div>
      </div>
    );
  }
});

/**
 * CustomOptions - Unified custom options component
 */
const CustomOptions = createSlotComponent({
  name: 'CustomOptions',

  render: ({ slot, productContext, className, styles, context, variableContext }) => {
    if (context === 'editor') {
      // Editor version - use template preview
      const content = slot?.content || '';
      const customOptionsData = variableContext?.customOptions || null;
      const displayLabel = variableContext?.customOptionsLabel || 'Custom Options';

      if (!customOptionsData || customOptionsData.length === 0) {
        return null;
      }

      const containerRef = React.useRef(null);

      // Prepare variable context with custom options data
      const enhancedVariableContext = React.useMemo(() => ({
        ...variableContext,
        customOptions: customOptionsData,
        displayLabel
      }), [variableContext, customOptionsData, displayLabel]);

      const processedContent = React.useMemo(() => {
        const result = processVariables(content, enhancedVariableContext);
        return result;
      }, [content, enhancedVariableContext]);

      return (
        <div
          ref={containerRef}
          className={className}
          style={styles}
          dangerouslySetInnerHTML={{ __html: processedContent }}
          key={processedContent}
        />
      );
    }

    // Storefront version - use the actual CustomOptionsComponent
    const { product, store, settings, selectedOptions, handleOptionChange } = productContext;

    // Get color theme from slot metadata or use defaults
    const colorTheme = slot?.metadata?.colorTheme || settings?.customOptionsColorTheme || {};

    return (
      <div className={className} style={styles}>
        <CustomOptionsComponent
          product={product}
          store={store}
          settings={settings}
          selectedOptions={selectedOptions || []}
          onSelectionChange={handleOptionChange}
          colorTheme={colorTheme}
        />
      </div>
    );
  }
});

/**
 * ConfigurableProductSelector - Variant selector for configurable products
 */
const ConfigurableProductSelector = createSlotComponent({
  name: 'ConfigurableProductSelector',

  render: ({ slot, productContext, className, styles, context }) => {
    if (context === 'editor') {
      // Editor version - visual preview only
      return (
        <div className={className} style={styles}>
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Size</label>
              <div className="flex flex-wrap gap-2">
                <button className="px-4 py-2 rounded-md border-2 border-gray-300 bg-white text-gray-700 hover:border-gray-400">
                  Small
                </button>
                <button className="px-4 py-2 rounded-md border-2 border-blue-600 bg-blue-50 text-blue-700">
                  Medium
                </button>
                <button className="px-4 py-2 rounded-md border-2 border-gray-300 bg-white text-gray-700 hover:border-gray-400">
                  Large
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <div className="flex flex-wrap gap-2">
                <button className="px-4 py-2 rounded-md border-2 border-gray-300 bg-white text-gray-700 hover:border-gray-400">
                  Blue
                </button>
                <button className="px-4 py-2 rounded-md border-2 border-gray-300 bg-white text-gray-700 hover:border-gray-400">
                  Red
                </button>
                <button className="px-4 py-2 rounded-md border-2 border-blue-600 bg-blue-50 text-blue-700">
                  Green
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Storefront version - full functionality
    // IMPORTANT: Always use baseProduct for ConfigurableProductSelector
    // because product might be the selected variant (type: 'simple'),
    // but the selector needs the parent configurable product
    const { product, baseProduct, store, settings, handleVariantChange } = productContext;
    const productForSelector = baseProduct || product;

    return (
      <div className={className} style={styles}>
        <ConfigurableProductSelectorComponent
          product={productForSelector}
          store={store}
          settings={settings}
          onVariantChange={handleVariantChange}
        />
      </div>
    );
  }
});

/**
 * Standalone ProductTabs wrapper for slot system
 */
const ProductTabsStandalone = createSlotComponent({
  name: 'ProductTabs',

  render: ({ slot, productContext, className, styles, context }) => {
    if (context === 'editor') {
      // Editor version - visual preview only
      return (
        <div className={className} style={styles}>
          <ProductTabsComponent
            productTabs={[
              { id: 1, title: 'Description', content: 'Sample product description content' },
              { id: 2, title: 'Specifications', content: 'Sample specifications content' }
            ]}
            product={{ description: 'Sample description' }}
            className=""
          />
        </div>
      );
    }

    // Storefront version - full functionality
    const { productTabs, product } = productContext;

    return (
      <div className={className} style={styles}>
        <ProductTabsComponent
          productTabs={productTabs || []}
          product={product}
          className=""
          slotConfig={slot}
        />
      </div>
    );
  }
});

/**
 * TotalPriceDisplay - Shows price breakdown with custom options
 */
const TotalPriceDisplay = createSlotComponent({
  name: 'TotalPriceDisplay',

  render: ({ slot, className, styles, productContext, context }) => {
    if (context === 'editor') {
      // Editor version - shows example breakdown
      return (
        <div className={className} style={styles}>
          <div className="border-t pt-4 mb-4">
            <div className="bg-gray-50 rounded-lg py-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Price Breakdown
              </h3>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Product × 1</span>
                <span className="font-medium">$99.99</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="text-sm font-medium text-gray-700 mb-1">Selected Options:</div>
                <div className="flex justify-between items-center text-sm pl-4">
                  <span className="text-gray-600">Extra Feature × 1</span>
                  <span className="font-medium">+$19.99</span>
                </div>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-900">Total Price:</span>
                  <span className="text-lg font-bold text-green-600">$119.98</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Storefront version - uses actual product data
    return (
      <div className={className} style={styles}>
        <TotalPriceDisplayComponent productContext={productContext} />
      </div>
    );
  }
});

// Register all components
registerSlotComponent('QuantitySelector', QuantitySelector);
// registerSlotComponent('AddToCartButton', AddToCartButton);

/**
 * CartItemsSlot - Cart items listing with selected options breakdown
 */
const CartItemsSlot = createSlotComponent({
  name: 'CartItemsSlot',

  render: ({ slot, cartContext, className, styles, context, variableContext }) => {
    const containerRef = React.useRef(null);
    const content = slot?.content || '';

    if (context === 'editor') {
      // Editor version - use template with sample data
      const sampleCartItems = [
        {
          id: '1',
          product: { name: 'Sample Product', image_url: 'https://placehold.co/100x100?text=Product' },
          price: 20,
          quantity: 1,
          selected_options: [{ name: 'Option 1', price: 5 }]
        }
      ];

      const editorVariableContext = {
        ...variableContext,
        cartItems: sampleCartItems
      };

      const processedContent = processVariables(content, editorVariableContext);

      // Render dynamic content
      React.useEffect(() => {
        if (!containerRef.current) return;

        // Update prices for editor preview
        containerRef.current.querySelectorAll('.cart-item').forEach((cartItemEl) => {
          const price = parseFloat(cartItemEl.getAttribute('data-price')) || 0;
          const quantity = parseInt(cartItemEl.getAttribute('data-quantity')) || 1;

          // Update item price display
          const priceDisplay = cartItemEl.querySelector('.text-sm.text-gray-600');
          if (priceDisplay && priceDisplay.textContent.includes('×')) {
            priceDisplay.textContent = `${formatPriceUtil(price)} × ${quantity}`;
          }

          // Update item total
          const itemTotalEl = cartItemEl.querySelector('[data-item-total]');
          if (itemTotalEl) {
            itemTotalEl.textContent = formatPriceUtil(price * quantity);
          }
        });

        // Render selected options
        const optionsContainers = containerRef.current.querySelectorAll('[data-selected-options]');
        optionsContainers.forEach((container) => {
          const sampleOptions = sampleCartItems[0].selected_options;
          if (sampleOptions && sampleOptions.length > 0) {
            container.innerHTML = sampleOptions.map(opt =>
              `<div class="text-sm text-gray-600">+ ${opt.name} (+${formatPriceUtil(opt.price)})</div>`
            ).join('');
          }
        });
      }, [processedContent]);

      return (
        <div ref={containerRef} className={className} style={styles}
             dangerouslySetInnerHTML={{ __html: processedContent }} />
      );
    }

    // Storefront version - full functionality
    if (!cartContext) {
      return <div className={className} style={styles}>Cart context not available</div>;
    }

    const {
      cartItems = [],
      calculateItemTotal = () => 0,
      updateQuantity = () => {},
      removeItem = () => {}
    } = cartContext;

    if (cartItems.length === 0) {
      return (
        <div className={`${className} text-center py-12`} style={styles}>
          <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
          <p className="text-gray-600 mb-6">Start shopping to add items to your cart</p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Continue Shopping
          </Link>
        </div>
      );
    }

    const storefrontVariableContext = {
      ...variableContext,
      cartItems
    };

    const processedContent = processVariables(content, storefrontVariableContext);

    // Render dynamic content and attach event handlers
    React.useEffect(() => {
      if (!containerRef.current) return;

      // Update prices with currency symbol
      containerRef.current.querySelectorAll('.cart-item').forEach((cartItemEl) => {
        const itemId = cartItemEl.getAttribute('data-item-id');
        const item = cartItems.find(i => i.id === itemId);

        if (item) {
          // Update item price display
          const priceDisplay = cartItemEl.querySelector('.text-sm.text-gray-600');
          if (priceDisplay && priceDisplay.textContent.includes('×')) {
            priceDisplay.textContent = `${formatPriceUtil(item.price)} × ${item.quantity}`;
          }

          // Update item total
          const itemTotalEl = cartItemEl.querySelector('[data-item-total]');
          if (itemTotalEl) {
            const total = calculateItemTotal(item, item.product);
            itemTotalEl.textContent = formatPriceUtil(total);
          }
        }
      });

      // Render selected options
      const optionsContainers = containerRef.current.querySelectorAll('[data-selected-options]');
      optionsContainers.forEach((container) => {
        const cartItem = container.closest('.cart-item');
        if (cartItem) {
          const itemId = cartItem.getAttribute('data-item-id');
          const item = cartItems.find(i => i.id === itemId);
          if (item?.selected_options && item.selected_options.length > 0) {
            container.innerHTML = item.selected_options.map(opt =>
              `<div class="text-sm text-gray-600">
                <div>+ ${opt.name}</div>
                <div class="ml-2 text-xs">${formatPriceUtil(opt.price)} × ${item.quantity}</div>
              </div>`
            ).join('');
          }
        }
      });

      // Attach event handlers
      const handleClick = (e) => {
        const decreaseBtn = e.target.closest('[data-action="decrease-quantity"]');
        if (decreaseBtn) {
          const itemId = decreaseBtn.getAttribute('data-item-id');
          const item = cartItems.find(i => i.id === itemId);
          if (item) updateQuantity(itemId, Math.max(1, item.quantity - 1));
          return;
        }

        const increaseBtn = e.target.closest('[data-action="increase-quantity"]');
        if (increaseBtn) {
          const itemId = increaseBtn.getAttribute('data-item-id');
          const item = cartItems.find(i => i.id === itemId);
          if (item) updateQuantity(itemId, item.quantity + 1);
          return;
        }

        const removeBtn = e.target.closest('[data-action="remove-item"]');
        if (removeBtn) {
          const itemId = removeBtn.getAttribute('data-item-id');
          removeItem(itemId);
          return;
        }
      };

      containerRef.current.addEventListener('click', handleClick);
      return () => {
        if (containerRef.current) {
          containerRef.current.removeEventListener('click', handleClick);
        }
      };
    }, [cartItems, calculateItemTotal, updateQuantity, removeItem]);

    return (
      <div ref={containerRef} className={className} style={styles}
           dangerouslySetInnerHTML={{ __html: processedContent }} />
    );
  }
});

/**
 * CartCouponSlot - Functional coupon component
 */
const CartCouponSlot = createSlotComponent({
  name: 'CartCouponSlot',

  render: ({ slot, cartContext, className, styles, context, variableContext }) => {
    const containerRef = React.useRef(null);
    const content = slot?.content || '';

    if (context === 'editor') {
      // Editor version - use template for preview
      const processedContent = processVariables(content, variableContext);

      return (
        <div ref={containerRef} className={className} style={styles}
             dangerouslySetInnerHTML={{ __html: processedContent }} />
      );
    }

    // Storefront version - use template with event handlers
    const {
      couponCode = '',
      setCouponCode = () => {},
      handleApplyCoupon = () => {},
      handleRemoveCoupon = () => {},
      handleCouponKeyPress = () => {},
      appliedCoupon = null,
      discount = 0,
      formatPrice = formatPriceUtil,
      settings = {},
      cartItems = []
    } = cartContext || {};

    const processedContent = processVariables(content, variableContext);

    React.useEffect(() => {
      if (!containerRef.current) return;

      const input = containerRef.current.querySelector('[data-coupon-input]');
      const applyButton = containerRef.current.querySelector('[data-action="apply-coupon"]');
      const removeButton = containerRef.current.querySelector('[data-action="remove-coupon"]');

      // Handle applied coupon display
      if (appliedCoupon) {
        // Hide input section if applied
        const inputSection = containerRef.current.querySelector('[data-coupon-input-section]');
        if (inputSection) inputSection.style.display = 'none';

        // Show applied coupon section
        const appliedSection = containerRef.current.querySelector('[data-applied-coupon-section]');
        if (appliedSection) {
          appliedSection.style.display = 'block';
          const couponNameEl = appliedSection.querySelector('[data-coupon-name]');
          const currentLang = getCurrentLanguage();
          const translatedName = getTranslatedField(appliedCoupon, 'name', currentLang, 'en') || appliedCoupon.name || appliedCoupon.code;
          if (couponNameEl) couponNameEl.textContent = translatedName;

          // Display discount information
          const couponDiscountEl = appliedSection.querySelector('[data-coupon-discount]');
          if (couponDiscountEl) {
            let discountText = '';
            if (appliedCoupon.discount_type === 'fixed') {
              discountText = `${formatPrice(appliedCoupon.discount_value)} off`;
            } else if (appliedCoupon.discount_type === 'percentage') {
              discountText = `${appliedCoupon.discount_value}% (${formatPrice(discount)} off)`;
            }
            couponDiscountEl.textContent = discountText;
          }
        }
      } else {
        // Show input section
        const inputSection = containerRef.current.querySelector('[data-coupon-input-section]');
        if (inputSection) inputSection.style.display = 'block';

        // Hide applied coupon section
        const appliedSection = containerRef.current.querySelector('[data-applied-coupon-section]');
        if (appliedSection) appliedSection.style.display = 'none';
      }

      if (input) {
        input.value = couponCode;
        input.addEventListener('input', (e) => setCouponCode(e.target.value));
        input.addEventListener('keypress', handleCouponKeyPress);
      }

      if (applyButton) {
        applyButton.addEventListener('click', handleApplyCoupon);
      }

      if (removeButton) {
        removeButton.addEventListener('click', handleRemoveCoupon);
      }

      return () => {
        if (input) {
          input.removeEventListener('input', (e) => setCouponCode(e.target.value));
          input.removeEventListener('keypress', handleCouponKeyPress);
        }
        if (applyButton) {
          applyButton.removeEventListener('click', handleApplyCoupon);
        }
        if (removeButton) {
          removeButton.removeEventListener('click', handleRemoveCoupon);
        }
      };
    }, [couponCode, setCouponCode, handleApplyCoupon, handleRemoveCoupon, handleCouponKeyPress, appliedCoupon, discount, formatPrice]);

    // Re-render when language changes
    React.useEffect(() => {
      const handleLanguageChange = () => {
        // Update coupon name when language changes
        if (containerRef.current && appliedCoupon) {
          const couponNameEl = containerRef.current.querySelector('[data-coupon-name]');
          const currentLang = getCurrentLanguage();
          const translatedName = getTranslatedField(appliedCoupon, 'name', currentLang, 'en') || appliedCoupon.name || appliedCoupon.code;
          if (couponNameEl) couponNameEl.textContent = translatedName;
        }
      };

      window.addEventListener('languageChanged', handleLanguageChange);
      return () => window.removeEventListener('languageChanged', handleLanguageChange);
    }, [appliedCoupon]);

    // Handle discount details toggle and populate eligible products
    React.useEffect(() => {
      if (!containerRef.current || !appliedCoupon || discount <= 0) return;

      const discountToggle = containerRef.current.querySelector('[data-discount-toggle]');
      const discountDetails = containerRef.current.querySelector('[data-discount-details]');
      const discountChevron = containerRef.current.querySelector('[data-discount-chevron]');
      const eligibleProductsList = containerRef.current.querySelector('[data-eligible-products]');

      if (!discountToggle || !discountDetails) return;

      // Populate eligible products list
      const hasProductFilter = appliedCoupon.applicable_products && appliedCoupon.applicable_products.length > 0;
      const hasCategoryFilter = appliedCoupon.applicable_categories && appliedCoupon.applicable_categories.length > 0;
      const hasSkuFilter = appliedCoupon.applicable_skus && appliedCoupon.applicable_skus.length > 0;

      if (!hasProductFilter && !hasCategoryFilter && !hasSkuFilter) {
        eligibleProductsList.innerHTML = '<li class="text-xs text-green-700">All products in cart</li>';
      } else {
        const eligibleItems = cartItems.filter(item => {
          // Check product ID
          if (hasProductFilter) {
            const productId = typeof item.product_id === 'object' ?
              (item.product_id?.id || item.product_id?.toString() || null) :
              item.product_id;
            if (productId && appliedCoupon.applicable_products.includes(productId)) {
              return true;
            }
          }

          // Check category
          if (hasCategoryFilter) {
            if (item.product?.category_ids?.some(catId =>
              appliedCoupon.applicable_categories.includes(catId)
            )) {
              return true;
            }
          }

          // Check SKU
          if (hasSkuFilter) {
            if (item.product?.sku && appliedCoupon.applicable_skus.includes(item.product.sku)) {
              return true;
            }
          }

          return false;
        });

        eligibleProductsList.innerHTML = eligibleItems.map(item => {
          const productName = item.product?.name || item.name || 'Product';
          return `<li class="text-xs flex items-center gap-2">
            <span class="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            <span>${productName}</span>
          </li>`;
        }).join('');
      }

      // Toggle handler
      const handleToggle = () => {
        const isHidden = discountDetails.classList.contains('hidden');
        if (isHidden) {
          discountDetails.classList.remove('hidden');
          if (discountChevron) {
            discountChevron.style.transform = 'rotate(180deg)';
          }
        } else {
          discountDetails.classList.add('hidden');
          if (discountChevron) {
            discountChevron.style.transform = 'rotate(0deg)';
          }
        }
      };

      discountToggle.addEventListener('click', handleToggle);

      return () => {
        discountToggle.removeEventListener('click', handleToggle);
      };
    }, [appliedCoupon, discount, cartItems]);

    return (
      <div ref={containerRef} className={className} style={styles}
           dangerouslySetInnerHTML={{ __html: processedContent }} />
    );
  }
});

/**
 * CartOrderSummarySlot - Functional order summary component
 */
const CartOrderSummarySlot = createSlotComponent({
  name: 'CartOrderSummarySlot',

  render: ({ slot, cartContext, className, styles, context, variableContext }) => {
    const containerRef = React.useRef(null);
    const content = slot?.content || '';

    if (context === 'editor') {
      // Editor version - use template with sample data
      const processedContent = processVariables(content, variableContext);

      React.useEffect(() => {
        if (!containerRef.current) return;

        // Set sample prices for preview
        const subtotalEl = containerRef.current.querySelector('[data-subtotal]');
        const taxEl = containerRef.current.querySelector('[data-tax]');
        const totalEl = containerRef.current.querySelector('[data-total]');

        if (subtotalEl) subtotalEl.textContent = '$99.99';
        if (taxEl) taxEl.textContent = '$8.00';
        if (totalEl) totalEl.textContent = '$107.99';
      }, [processedContent]);

      return (
        <div ref={containerRef} className={className} style={styles}
             dangerouslySetInnerHTML={{ __html: processedContent }} />
      );
    }

    // Storefront version - use template with dynamic data
    const {
      subtotal = 0,
      discount = 0,
      tax = 0,
      total = 0,
      customOptionsTotal = 0,
      taxDetails = null,
      handleCheckout = () => {},
      appliedCoupon = null,
      cartItems = []
    } = cartContext || {};

    const processedContent = processVariables(content, variableContext);

    React.useEffect(() => {
      if (!containerRef.current) return;

      // Update prices
      const subtotalEl = containerRef.current.querySelector('[data-subtotal]');
      const customOptionsEl = containerRef.current.querySelector('[data-custom-options-total]');
      const customOptionsRow = containerRef.current.querySelector('[data-custom-options-row]');
      const discountEl = containerRef.current.querySelector('[data-discount]');
      const discountLabelEl = containerRef.current.querySelector('[data-discount-label]');
      const discountRow = containerRef.current.querySelector('[data-discount-row]');
      const taxEl = containerRef.current.querySelector('[data-tax]');
      const totalEl = containerRef.current.querySelector('[data-total]');
      const checkoutBtn = containerRef.current.querySelector('[data-action="checkout"]');

      if (subtotalEl) subtotalEl.textContent = formatPriceUtil(subtotal);

      // Update tax with country and percentage if available
      if (taxEl) {
        let taxText = formatPriceUtil(tax);
        if (taxDetails && taxDetails.country && taxDetails.effectiveRate > 0) {
          // Find the parent element to insert country/rate info
          const taxParent = taxEl.parentElement;
          if (taxParent) {
            // Look for existing tax label span or create structure
            let taxLabelSpan = taxParent.querySelector('span:first-child');
            if (taxLabelSpan && taxLabelSpan !== taxEl) {
              // Check if we already added the details span
              let detailsSpan = taxLabelSpan.querySelector('.tax-details');
              if (!detailsSpan) {
                detailsSpan = document.createElement('span');
                detailsSpan.className = 'tax-details text-gray-500 text-sm ml-1';
                taxLabelSpan.appendChild(detailsSpan);
              }
              detailsSpan.textContent = `(${taxDetails.country} ${taxDetails.effectiveRate}%)`;
            }
          }
        }
        taxEl.textContent = taxText;
      }

      if (totalEl) totalEl.textContent = formatPriceUtil(total);

      // Show/hide custom options
      if (customOptionsTotal > 0) {
        if (customOptionsRow) customOptionsRow.style.display = 'flex';
        if (customOptionsEl) customOptionsEl.textContent = `+${formatPriceUtil(customOptionsTotal)}`;
      } else {
        if (customOptionsRow) customOptionsRow.style.display = 'none';
      }

      // Show/hide discount
      if (appliedCoupon && discount > 0) {
        if (discountRow) discountRow.style.display = 'flex';
        const currentLang = getCurrentLanguage();
        const translatedName = getTranslatedField(appliedCoupon, 'name', currentLang, 'en') || appliedCoupon.name;
        if (discountLabelEl) discountLabelEl.textContent = `Discount (${translatedName})`;
        if (discountEl) discountEl.textContent = `-${formatPriceUtil(discount)}`;
      } else {
        if (discountRow) discountRow.style.display = 'none';
      }

      // Attach checkout handler
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
      }

      return () => {
        if (checkoutBtn) {
          checkoutBtn.removeEventListener('click', handleCheckout);
        }
      };
    }, [subtotal, discount, tax, total, customOptionsTotal, taxDetails, handleCheckout, appliedCoupon]);

    // Re-render discount label when language changes
    React.useEffect(() => {
      const handleLanguageChange = () => {
        if (containerRef.current && appliedCoupon && discount > 0) {
          const discountLabelEl = containerRef.current.querySelector('[data-discount-label]');
          const currentLang = getCurrentLanguage();
          const translatedName = getTranslatedField(appliedCoupon, 'name', currentLang, 'en') || appliedCoupon.name;
          if (discountLabelEl) discountLabelEl.textContent = `Discount (${translatedName})`;
        }
      };

      window.addEventListener('languageChanged', handleLanguageChange);
      return () => window.removeEventListener('languageChanged', handleLanguageChange);
    }, [appliedCoupon, discount]);

    return (
      <div ref={containerRef} className={className} style={styles}
           dangerouslySetInnerHTML={{ __html: processedContent }} />
    );
  }
});

registerSlotComponent('CartItemsSlot', CartItemsSlot);
registerSlotComponent('CartCouponSlot', CartCouponSlot);
registerSlotComponent('CartOrderSummarySlot', CartOrderSummarySlot);
registerSlotComponent('ProductBreadcrumbsSlot', ProductBreadcrumbs);
// ProductGallerySlot removed - pure handlebars approach only
// ProductInfoSlot removed - not used in product-config.js
registerSlotComponent('ProductOptionsSlot', ProductOptions);
registerSlotComponent('CustomOptions', CustomOptions);
registerSlotComponent('ConfigurableProductSelector', ConfigurableProductSelector);
registerSlotComponent('ProductTabsSlot', ProductTabs);
registerSlotComponent('ProductTabs', ProductTabsStandalone);
registerSlotComponent('ProductRecommendationsSlot', ProductRecommendations);
registerSlotComponent('TotalPriceDisplay', TotalPriceDisplay);

// StockStatus - Dynamic stock status display
const StockStatus = createSlotComponent({
  name: 'StockStatus',

  render: ({ slot, className, styles, productContext, context, variableContext }) => {
    if (context === 'editor') {
      // Editor version - shows static example
      return (
        <div className={className} style={styles}>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
            In Stock (Editor)
          </span>
        </div>
      );
    }

    // Storefront version - use centralized stock label utility
    const { product, settings } = productContext || {};
    const translations = variableContext?.translations || null;

    if (!product) {
      return (
        <div className={className} style={styles}>
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
            Loading...
          </span>
        </div>
      );
    }

    // Use centralized utility with translations
    const stockLabelInfo = getStockLabelUtil(product, settings, null, translations);
    const stockLabelStyle = getStockLabelStyle(product, settings, null, translations);

    if (!stockLabelInfo) {
      return null;
    }

    return (
      <div className={className} style={styles}>
        <span
          className="w-fit inline-flex items-center px-2 py-1 rounded-full text-xs"
          style={stockLabelStyle}
        >
          {stockLabelInfo.text}
        </span>
      </div>
    );
  }
});

/**
 * BreadcrumbRenderer - Unified breadcrumb component for all page types
 */
// const BreadcrumbRenderer = createSlotComponent({
//   name: 'BreadcrumbRenderer',
//
//   render: ({ slot, productContext, categoryContext, className, styles, context }) => {
//     if (context === 'editor') {
//       // Editor version - visual preview only
//       return (
//         <div className={className} style={styles}>
//           <nav className="flex items-center text-sm text-gray-600">
//             <Home className="w-4 h-4 mr-2" />
//             <span>Home &gt; Category &gt; Product</span>
//           </nav>
//         </div>
//       );
//     }
//
//     // Storefront version - full functionality
//     // Determine context and page type
//     let pageType, pageData, storeCode, categories, settings;
//
//     if (productContext) {
//       pageType = 'product';
//       pageData = productContext.product;
//       storeCode = productContext.store?.slug || productContext.store?.code;
//       categories = productContext.categories;
//       settings = productContext.settings;
//     } else if (categoryContext) {
//       pageType = 'category';
//       pageData = categoryContext.category;
//       storeCode = categoryContext.store?.slug || categoryContext.store?.code;
//       categories = categoryContext.categories;
//       settings = categoryContext.settings;
//     } else {
//       return null;
//     }
//
//     return (
//       <div className={className} style={styles}>
//         <BreadcrumbRendererComponent
//           pageType={pageType}
//           pageData={pageData}
//           storeCode={storeCode}
//           categories={categories}
//           settings={settings}
//           className="text-sm text-gray-600"
//         />
//       </div>
//     );
//   }
// });

/**
 * ProductImage - Main product image component
 * Shows real product images in both editor and storefront modes
 */
const ProductImage = createSlotComponent({
  name: 'ProductImage',

  render: ({ slot, productContext, className, styles, context, variableContext }) => {
    // Use real product data in both editor and storefront modes
    const { product, activeImageIndex } = productContext || {};

    if (!product) {
      return (
        <img
          src="https://placehold.co/600x600?text=No+Product"
          alt="No product"
          className={className}
          style={styles}
        />
      );
    }

    const getImageUrl = () => {
      console.log('🖼️ ProductImage Debug:', {
        hasProduct: !!product,
        hasImages: !!product?.images,
        imagesLength: product?.images?.length,
        images: product?.images,
        activeImageIndex,
        productKeys: product ? Object.keys(product) : []
      });

      if (!product.images || product.images.length === 0) {
        console.log('❌ No images found');
        return 'https://placehold.co/600x600?text=No+Image';
      }

      const index = activeImageIndex || 0;
      const image = product.images[index];

      console.log('🖼️ Image at index', index, ':', image);

      // Only handle new format - object with url property
      if (typeof image === 'object' && image !== null) {
        const url = image.url || 'https://placehold.co/600x600?text=No+Image';
        console.log('✅ Image URL:', url);
        return url;
      }

      console.log('❌ Invalid image format');
      return 'https://placehold.co/600x600?text=Invalid+Format';
    };

    const imageUrl = getImageUrl();
    const currentImageData = product.images[activeImageIndex || 0];

    // Use translated product name from variableContext (already translated in ProductDetail.jsx)
    const translatedProductName = variableContext?.product?.name || product.name || 'Product image';

    return (
      <div className="relative w-full h-full group">
        <img
          src={imageUrl}
          alt={translatedProductName}
          className={`${className} transition-transform duration-300 group-hover:scale-105`}
          style={styles}
          onError={(e) => {
            console.error('Image load error:', imageUrl);
            e.target.src = 'https://placehold.co/600x600?text=Image+Error';
          }}
        />

        {/* Image info overlay for hover */}
        {typeof currentImageData === 'object' && currentImageData?.filepath && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <p className="truncate">{currentImageData.filepath}</p>
            {currentImageData.filesize && (
              <p>{(currentImageData.filesize / 1024).toFixed(1)} KB</p>
            )}
          </div>
        )}
      </div>
    );
  }
});

/**
 * ProductThumbnails - Image gallery thumbnails component
 */
const ProductThumbnails = createSlotComponent({
  name: 'ProductThumbnails',

  // Unified render method for both editor and storefront - ensures WYSIWYG
  render: ({ slot, productContext, className, styles, variableContext, context }) => {
    const { product, activeImageIndex, setActiveImageIndex, settings } = productContext;

    // 🔧 ENHANCED SETTINGS PRIORITY: Check both contexts and force refresh from admin changes
    // Priority: 1) productContext.settings (fresh from StoreProvider) 2) variableContext.settings (fallback) 3) default
    const galleryLayout = settings?.product_gallery_layout || variableContext?.settings?.product_gallery_layout || 'horizontal';
    const verticalPosition = settings?.vertical_gallery_position || variableContext?.settings?.vertical_gallery_position || 'left';
    const isVertical = galleryLayout === 'vertical';

    // Direct CSS classes based on layout
    const finalClassName = isVertical
      ? 'thumbnail-gallery flex flex-col space-y-2 w-24'
      : 'thumbnail-gallery flex overflow-x-auto space-x-2 mt-4';

    // Get images: use real product images in both editor and storefront
    const images = product?.images || [];

    // Show thumbnails if multiple images exist (both editor and storefront)
    // Fall back to demo images only if no real images available in editor
    const shouldShow = images.length > 1 || (context === 'editor' && images.length === 0);

    if (!shouldShow) {
      return null;
    }

    // Use real images if available, only fall back to demo in editor if no images
    const thumbnailImages = images.length > 0
      ? images
      : (context === 'editor'
        ? Array.from({ length: 4 }, (_, i) => ({
            url: `https://placehold.co/100x100?text=Thumb+${i + 1}`,
            name: `Demo Thumbnail ${i + 1}`
          }))
        : []);

    const getImageUrl = (image, index) => {
      // Handle real image data
      if (typeof image === 'object' && image !== null) {
        return image.url || 'https://placehold.co/100x100?text=No+Image';
      }
      return 'https://placehold.co/100x100?text=Invalid';
    };

    return (
      <div className={finalClassName} style={styles}>
        {thumbnailImages.map((image, index) => (
          <button
            key={context === 'editor' ? index : (image?.attribute_code || index)}
            onClick={() => setActiveImageIndex && setActiveImageIndex(index)}
            className={`relative group flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:shadow-md ${
              activeImageIndex === index
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <img
              src={getImageUrl(image, index)}
              alt={`${variableContext?.product?.name || product?.name || 'Product'} ${index + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                e.target.src = 'https://placehold.co/100x100?text=Error';
              }}
            />

            {/* Thumbnail overlay info - only in storefront for real images */}
            {context === 'storefront' && typeof image === 'object' && image?.filesize && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <p className="text-center">{(image.filesize / 1024).toFixed(0)}KB</p>
              </div>
            )}

            {/* Active indicator */}
            {activeImageIndex === index && (
              <div className="absolute top-1 right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
            )}
          </button>
        ))}
      </div>
    );
  }
});

/**
 * CmsBlockRenderer - Renders CMS blocks in editor and storefront
 */
const CmsBlockRenderer = createSlotComponent({
  name: 'CmsBlockRenderer',
  render: ({ slot, className, styles, context, productContext, categoryContext, cartContext, headerContext }) => {
    // Get the position from slot metadata or id
    const position = slot.metadata?.cmsPosition || slot.id?.replace('cms_block_', '') || 'default';

    // In editor mode, use mock CMS blocks from context
    if (context === 'editor') {
      // Try to get cmsBlocks from any available context
      const cmsBlocks = productContext?.cmsBlocks ||
                        categoryContext?.cmsBlocks ||
                        cartContext?.cmsBlocks ||
                        headerContext?.cmsBlocks ||
                        [];

      // Filter blocks by position
      const matchingBlocks = cmsBlocks.filter(block => {
        if (!block.is_active) return false;
        return block.position === position;
      });

      // Sort by sort_order
      matchingBlocks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      // Skip rendering if no blocks assigned
      if (matchingBlocks.length === 0) {
        return null;
      }

      return (
        <div className={`${className || slot.className || ''} cms-blocks`} style={styles || slot.styles}>
          {matchingBlocks.map((block) => (
            <div
              key={block.id}
              className="cms-block mb-4"
              dangerouslySetInnerHTML={{ __html: block.content }}
            />
          ))}
        </div>
      );
    }

    // In storefront mode, use the real CmsBlockRenderer component
    return (
      <div className={className || slot.className} style={styles || slot.styles}>
        <CmsBlockRendererComponent position={position} />
      </div>
    );
  }
});

registerSlotComponent('CmsBlockRenderer', CmsBlockRenderer);
// registerSlotComponent('BreadcrumbRenderer', BreadcrumbRenderer);
registerSlotComponent('StockStatus', StockStatus);
registerSlotComponent('ProductImage', ProductImage);
registerSlotComponent('ProductThumbnails', ProductThumbnails);
registerSlotComponent('ProductGallery', ProductGallery);

export {
  QuantitySelector,
  // ProductBreadcrumbs,
  // ProductGallery,
  // ProductInfo removed - not used in product-config.js
  ProductOptions,
  // CustomOptions,
  // ConfigurableProductSelector,
  ProductTabs,
  // ProductRecommendations,
  // TotalPriceDisplay,
  // StockStatus,
  // ProductImage,
  // ProductThumbnails,
  // CmsBlockRenderer
};