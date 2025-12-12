import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Trash2, Plus, Minus, Tag, ShoppingCart, ChevronDown } from 'lucide-react';
import { SlotManager } from '@/utils/slotUtils';
import { filterSlotsByViewMode, sortSlotsByGridCoordinates } from '@/hooks/useSlotConfiguration';
import { useTranslation } from '@/contexts/TranslationContext';
import { getProductName } from '@/utils/translationUtils';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';

/**
 * CartSlotRenderer - Renders slots with full cart functionality
 * Extends the concept of HierarchicalSlotRenderer for cart-specific needs
 */
export function CartSlotRenderer({
  slots,
  parentId = null,
  viewMode = 'emptyCart',
  cartContext = {}
}) {
  const { t, getEntityTranslation, currentLanguage } = useTranslation();
  const {
    cartItems = [],
    appliedCoupon,
    couponCode,
    subtotal,
    discount,
    tax,
    total,
    taxDetails,
    currencySymbol,
    settings,
    store,
    taxes,
    selectedCountry,
    calculateItemTotal,
    formatPrice, // Renamed from safeToFixed
    updateQuantity,
    removeItem,
    handleCheckout,
    handleApplyCoupon,
    handleRemoveCoupon,
    handleCouponKeyPress,
    setCouponCode,
    formatDisplayPrice,
    getStoreBaseUrl,
    navigate
  } = cartContext;

  // Helper function to extract image URL from product images array
  const getProductImageUrl = (product) => {
    if (!product || !product.images || !product.images[0]) {
      return 'https://placehold.co/100x100?text=No+Image';
    }

    const firstImage = product.images[0];

    // Images are stored as objects with url property
    if (typeof firstImage === 'object' && firstImage) {
      return firstImage.url || 'https://placehold.co/100x100?text=No+Image';
    }

    return 'https://placehold.co/100x100?text=No+Image';
  };

  // Get child slots for current parent
  let childSlots = SlotManager.getChildSlots(slots, parentId);

  // Special debugging for coupon container internal layout
  if (parentId === 'coupon_container') {
    const expectedOrder = ['coupon_title', 'coupon_input', 'coupon_button'];
    const actualOrder = childSlots.map(s => s.id);
    const orderMatches = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder);

    // Suggested grid coordinates for proper positioning
    const suggestedGridCoordinates = {
      'coupon_title': { gridColumn: '1 / -1', gridRow: '1', colSpan: 12 },
      'coupon_input': { gridColumn: '1 / 9', gridRow: '2', colSpan: 8 },
      'coupon_button': { gridColumn: '9 / -1', gridRow: '2', colSpan: 4 }
    };

  }

  // Special debugging for order summary container internal layout
  if (parentId === 'order_summary_container') {
    const expectedOrder = ['order_summary_title', 'order_summary_subtotal', 'order_summary_tax', 'order_summary_total', 'checkout_button'];
    const actualOrder = childSlots.map(s => s.id);
    const orderMatches = JSON.stringify(expectedOrder) === JSON.stringify(actualOrder);
  }

  // If this is the cart_items_container, generate dynamic cart item slots based on actual cart data
  if (parentId === 'cart_items_container' && cartItems && cartItems.length > 0 && viewMode === 'withProducts') {
    const dynamicCartItemSlots = cartItems.map((item, index) => ({
      id: `dynamic_cart_item_${index + 1}`,
      type: 'container',
      content: '',
      className: 'cart-item p-4',
      styles: {},
      parentId: 'cart_items_container',
      layout: 'flex',
      colSpan: {
        withProducts: 12
      },
      viewMode: ['withProducts'],
      metadata: {
        hierarchical: true,
        dynamic: true,
        itemId: item.id,
        itemIndex: index
      }
    }));

    // Replace any existing static cart item slots with dynamic ones
    childSlots = childSlots.filter(slot => !slot.id.startsWith('cart_item_'));
    childSlots = [...childSlots, ...dynamicCartItemSlots];
  } else if (parentId === 'cart_items_container' && (!cartItems || cartItems.length === 0)) {
    // For empty cart, remove all cart item slots
    childSlots = childSlots.filter(slot => !slot.id.startsWith('cart_item_') && !slot.id.startsWith('dynamic_cart_item_'));
  }

  // Filter by viewMode
  const filteredSlots = filterSlotsByViewMode(childSlots, viewMode);

  // Sort slots using grid coordinates for precise positioning
  const sortedSlots = sortSlotsByGridCoordinates(filteredSlots);

  const renderSlotContent = (slot) => {
    const { id, type, content, className = '', styles = {}, parentClassName = '' } = slot;

    // Helper function to wrap content with parent class if needed
    const wrapWithParentClass = (children) => {
      if (parentClassName) {
        return <div className={parentClassName}>{children}</div>;
      }
      return children;
    };

    // Handle text content slots
    if (id === 'header_title') {
      return wrapWithParentClass(
        <h1 className={className || "text-3xl font-bold text-gray-900 mb-4"} style={styles}>
          {content || t('common.my_cart', 'My Cart')}
        </h1>
      );
    }

    if (id === 'empty_cart_title') {
      return wrapWithParentClass(
        <h2 className={className || "text-xl font-semibold text-gray-900 mb-2"} style={styles}>
          {content || t('common.cart_empty', 'Your cart is empty')}
        </h2>
      );
    }

    if (id === 'empty_cart_text') {
      return wrapWithParentClass(
        <p className={className || "text-gray-600 mb-6"} style={styles}>
          {content || t('common.no_items_yet', "Looks like you haven't added anything to your cart yet.")}
        </p>
      );
    }

    if (id === 'empty_cart_button') {
      return wrapWithParentClass(
        <Button
          onClick={() => navigate(getStoreBaseUrl(store))}
          className={className || "btn-primary text-white"}
          style={styles || { backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
        >
          {content || t('common.continue_shopping', 'Continue Shopping')}
        </Button>
      );
    }

    if (id === 'empty_cart_icon') {
      return (
        <ShoppingCart className={className || "w-16 h-16 mx-auto text-gray-400 mb-4"} style={styles} />
      );
    }

    // Cart items container - render actual cart items dynamically
    if (id === 'cart_items_container') {
      return (
        <Card className={className} style={styles}>
          <CardContent className="px-4 divide-y divide-gray-200">
            {cartItems.map(item => {
              const product = item.product;
              if (!product) return null;

              let basePriceForDisplay = item.price > 0 ? item.price : (product.sale_price || product.price);
              const itemTotal = calculateItemTotal(item, product);

              const translatedProductName = getProductName(product, currentLanguage) || product.name || 'Product';

              return (
                <div key={item.id} className="flex items-center space-x-4 py-6 border-b border-gray-200">
                  <img
                    src={getProductImageUrl(product)}
                    alt={translatedProductName}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{translatedProductName}</h3>
                    <p className="text-gray-600">
                      {formatDisplayPrice(basePriceForDisplay)} each
                    </p>
                    <div className="flex items-center space-x-3 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, Math.max(1, (item.quantity || 1) - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-lg font-semibold">{item.quantity || 1}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeItem(item.id)}
                        className="ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">
                      {formatDisplayPrice(itemTotal)}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      );
    }

    // Handle dynamic cart item slots - these are generated from actual cart data
    if (id.startsWith('dynamic_cart_item_') || (id.startsWith('cart_item_') && !id.includes('_'))) {
      // Extract item index from slot metadata or ID
      let itemIndex;
      let item;

      if (slot.metadata?.dynamic && slot.metadata?.itemIndex !== undefined) {
        itemIndex = slot.metadata.itemIndex;
        item = cartItems[itemIndex];
      } else {
        // Fallback for static cart item slots
        itemIndex = parseInt(id.replace(/^(dynamic_)?cart_item_/, '')) - 1;
        item = cartItems[itemIndex];
      }

      if (!item || !item.product) {
        return null; // Don't render if item doesn't exist
      }

      const product = item.product;
      let basePriceForDisplay = item.price > 0 ? item.price : (product.sale_price || product.price);
      const itemTotal = calculateItemTotal(item, product);
      const translatedProductName = getProductName(product, currentLanguage) || product.name || 'Product';

      return (
        <div className={`${className} flex items-center space-x-4 py-6 border-b border-gray-200`} style={styles}>
          <img
            src={getProductImageUrl(product)}
            alt={translatedProductName}
            className="w-20 h-20 object-cover rounded-lg"
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{translatedProductName}</h3>
            <p className="text-gray-600">
              {formatDisplayPrice(basePriceForDisplay)} each
            </p>
            <div className="flex items-center space-x-3 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateQuantity(item.id, Math.max(1, (item.quantity || 1) - 1))}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-lg font-semibold">{item.quantity || 1}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => removeItem(item.id)}
                className="ml-auto"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">
              {formatDisplayPrice(itemTotal)}
            </p>
          </div>
        </div>
      );
    }

    // Handle cart item sub-slots (quantity controls, remove buttons, etc.)
    if (id.includes('cart_item_') && id.includes('_')) {
      const { currentItem, currentProduct, currentItemTotal, currentBasePriceForDisplay } = cartContext;

      if (!currentItem || !currentProduct) {
        return null;
      }

      if (id.endsWith('_quantity')) {
        return (
          <div className={`${className} flex items-center space-x-3 mt-3`} style={styles}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateQuantity(currentItem.id, Math.max(1, (currentItem.quantity || 1) - 1))}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-lg font-semibold">{currentItem.quantity || 1}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateQuantity(currentItem.id, (currentItem.quantity || 1) + 1)}
            >
              <Plus className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeItem(currentItem.id)}
              className="ml-auto"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      }

      if (id.endsWith('_name')) {
        return (
          <h3 className={className} style={styles}>
            {currentProduct.name}
          </h3>
        );
      }

      if (id.endsWith('_description')) {
        return (
          <p className={className} style={styles}>
            {currentProduct.description || `${formatDisplayPrice(currentBasePriceForDisplay)} each`}
          </p>
        );
      }

      if (id.endsWith('_price')) {
        return (
          <p className={className} style={styles}>
            {formatDisplayPrice(currentItemTotal)}
          </p>
        );
      }

      if (id.endsWith('_image')) {
        return (
          <img
            src={getProductImageUrl(currentProduct)}
            alt={currentProduct.name}
            className={className}
            style={styles}
          />
        );
      }

      if (id.endsWith('_remove')) {
        return (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => removeItem(currentItem.id)}
            className={className}
            style={styles}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        );
      }
    }

    // Coupon container - dynamic content with preserved functionality
    if (id === 'coupon_container') {
      // If content is provided and is substantial HTML/custom content, use it as override
      const hasSubstantialContent = content && content.trim() && (content.includes('<') || content.length > 50);

      if (hasSubstantialContent) {
        return (
          <Card className={className} style={styles}>
            <CardContent className="p-4 grid">
              <div dangerouslySetInnerHTML={{ __html: content }} />
            </CardContent>
          </Card>
        );
      }

      // Default coupon functionality - check for child slots first
      const childSlots = SlotManager.getChildSlots(slots, slot.id);
      const hasChildSlots = childSlots && childSlots.length > 0;

      if (hasChildSlots) {
        // Render child slots if they exist (customizable coupon layout)
        return (
          <Card className={className} style={styles}>
            <CardContent className="p-4 grid">
              <CartSlotRenderer
                slots={slots}
                parentId={slot.id}
                viewMode={viewMode}
                cartContext={cartContext}
              />
            </CardContent>
          </Card>
        );
      }

      // Fallback to default UI if no child slots
      return (
        <Card className={className} style={styles}>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">{content || t('apply_coupon', settings)}</h3>
            {!appliedCoupon ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyPress={handleCouponKeyPress}
                  className="flex-1"
                />
                <Button
                  onClick={handleApplyCoupon}
                  disabled={!couponCode.trim()}
                  className="btn-primary text-white"
                  style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
                >
                  <Tag className="w-4 h-4 mr-2" /> {t('apply', settings)}
                </Button>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div className="bg-green-50 p-3 rounded-lg flex-1 mr-2">
                  <p className="text-sm font-medium text-green-800">
                    {getEntityTranslation(appliedCoupon, 'name', 'en') || appliedCoupon.name}
                  </p>
                  <p className="text-xs text-green-600">
                    {appliedCoupon.discount_type === 'fixed'
                      ? `${formatPrice(appliedCoupon.discount_value)} ${t('off', settings)}`
                      : `${appliedCoupon.discount_value}% (${formatPrice(discount)} ${t('off', settings)})`
                    }
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveCoupon}
                  className="text-red-600 hover:text-red-800"
                >
                  {t('remove', settings)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // Coupon input field
    if (id === 'coupon_input') {
      return (
        <Input
          placeholder={content || "Enter coupon code"}
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          onKeyPress={handleCouponKeyPress}
          className={className}
          style={styles}
        />
      );
    }

    // Coupon apply button
    if (id === 'coupon_button') {
      return (
        <Button
          onClick={handleApplyCoupon}
          disabled={!couponCode.trim()}
          className={className || "btn-primary text-white"}
          style={styles || { backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
        >
          <Tag className="w-4 h-4 mr-2" /> {content || t('apply', settings)}
        </Button>
      );
    }

    // Order summary container - dynamic content with preserved functionality
    if (id === 'order_summary_container') {
      // If content is provided, use it as override, otherwise render the default summary
      const hasContentOverride = content && content.trim();

      if (hasContentOverride) {
        return (
          <Card className={className} style={styles}>
            <CardContent className="p-4">
              <div dangerouslySetInnerHTML={{ __html: content }} />
            </CardContent>
          </Card>
        );
      }

      // Default order summary functionality - check for child slots first
      const childSlots = SlotManager.getChildSlots(slots, slot.id);
      const hasChildSlots = childSlots && childSlots.length > 0;

      if (hasChildSlots) {
        // Render child slots if they exist (customizable order summary layout)
        return (
          <Card className={className} style={styles}>
            <CardContent className="p-4">
              <CartSlotRenderer
                slots={slots}
                parentId={slot.id}
                viewMode={viewMode}
                cartContext={cartContext}
              />
            </CardContent>
          </Card>
        );
      }

      // Fallback to default UI if no child slots
      return (
        <Card className={className} style={styles}>
          <CardContent className="p-4">
            <h3 className="text-lg font-semibold mb-4">{t('order_summary', settings)}</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>{t('subtotal', settings)}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between">
                  <span>
                    {t('tax', settings)}
                    {taxDetails && taxDetails.country && (
                      <span className="text-gray-500 text-sm ml-1">
                        ({taxDetails.country} {taxDetails.effectiveRate ? `${taxDetails.effectiveRate}%` : ''})
                      </span>
                    )}
                  </span>
                  <span>{formatPrice(tax)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{t('shipping', settings)}</span>
                <span>{t('free', settings)}</span>
              </div>
              {discount > 0 && appliedCoupon && (
                <div className="w-full">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="discount-details" className="border-0">
                          <AccordionTrigger className="py-2 px-0 hover:no-underline flex gap-2 items-center">
                            <span>{t('discount', settings)}</span>
                            {appliedCoupon && (
                              <span className="text-xs text-gray-500">
                                ({getEntityTranslation(appliedCoupon, 'name', 'en') || appliedCoupon.name})
                              </span>
                            )}
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200" />
                          </AccordionTrigger>
                      <AccordionContent className="px-0 pt-2 pb-2">
                      <div className="text-sm text-gray-600 space-y-1">
                        {(() => {
                          // Determine which items qualify for the coupon
                          const hasProductFilter = appliedCoupon.applicable_products && appliedCoupon.applicable_products.length > 0;
                          const hasCategoryFilter = appliedCoupon.applicable_categories && appliedCoupon.applicable_categories.length > 0;
                          const hasSkuFilter = appliedCoupon.applicable_skus && appliedCoupon.applicable_skus.length > 0;

                          if (!hasProductFilter && !hasCategoryFilter && !hasSkuFilter) {
                            return <p className="text-xs text-gray-500">{t('cart.all_products', settings) || 'All products in cart'}</p>;
                          }

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

                          return (
                            <ul className="space-y-1">
                              {eligibleItems.map((item, index) => {
                                const productName = item.product
                                  ? (getProductName(item.product, currentLanguage) || item.product.name || 'Product')
                                  : (item.name || 'Product');
                                return (
                                  <li key={index} className="text-xs flex items-center gap-2">
                                    <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                    <span>{productName}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          );
                        })()}
                      </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                    <span className="text-green-600">-{formatPrice(discount)}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold border-t pt-4">
                <span>{t('total', settings)}</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
            <div className="mt-6">
              <Button
                size="lg"
                className="w-full"
                onClick={handleCheckout}
                style={{
                  backgroundColor: settings?.theme?.checkout_button_color || getThemeDefaults().checkout_button_color,
                  color: '#FFFFFF',
                  ...styles  // Custom styles override defaults
                }}
              >
                {t('proceed_to_checkout', settings)}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Order summary individual components
    if (id === 'order_summary_subtotal') {
      // Parse content for custom labels, fallback to default structure
      let leftLabel = 'Subtotal';
      let rightValue = formatPrice(subtotal);

      if (content && content.includes('<span>')) {
        // Handle HTML content format: '<span>Subtotal</span><span>$79.97</span>'
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const spans = tempDiv.querySelectorAll('span');
        if (spans.length >= 1) leftLabel = spans[0].textContent || leftLabel;
        // Keep dynamic right value regardless of static content
      } else if (content) {
        leftLabel = content;
      }

      return (
        <div className={className} style={styles}>
          <span>{leftLabel}</span>
          <span>{rightValue}</span>
        </div>
      );
    }

    if (id === 'order_summary_tax') {
      // Parse content for custom labels, fallback to default structure
      let leftLabel = 'Tax';
      let rightValue = formatPrice(tax);

      if (content && content.includes('<span>')) {
        // Handle HTML content format: '<span>Tax</span><span>$6.40</span>'
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const spans = tempDiv.querySelectorAll('span');
        if (spans.length >= 1) leftLabel = spans[0].textContent || leftLabel;
        // Keep dynamic right value regardless of static content
      } else if (content) {
        leftLabel = content;
      }

      return (
        <div className={className} style={styles}>
          <span>{leftLabel}</span>
          <span>{rightValue}</span>
        </div>
      );
    }

    if (id === 'order_summary_total') {
      // Parse content for custom labels, fallback to default structure
      let leftLabel = 'Total';
      let rightValue = formatPrice(total);

      if (content && content.includes('<span>')) {
        // Handle HTML content format: '<span>Total</span><span>$81.37</span>'
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const spans = tempDiv.querySelectorAll('span');
        if (spans.length >= 1) leftLabel = spans[0].textContent || leftLabel;
        // Keep dynamic right value regardless of static content
      } else if (content) {
        leftLabel = content;
      }

      return (
        <div className={className} style={styles}>
          <span>{leftLabel}</span>
          <span>{rightValue}</span>
        </div>
      );
    }

    // Checkout button
    if (id === 'checkout_button') {
      return (
        <Button
          size="lg"
          className={`${className} w-full`}
          onClick={handleCheckout}
          style={{
            backgroundColor: settings?.theme?.checkout_button_color || getThemeDefaults().checkout_button_color,
            color: '#FFFFFF',
            ...styles  // Custom styles override defaults
          }}
        >
          {content || t('proceed_to_checkout', settings)}
        </Button>
      );
    }

    // Handle container types (grid, flex, container)
    if (type === 'container' || type === 'grid' || type === 'flex') {
      const containerClass = type === 'grid' ? 'grid grid-cols-12 gap-2' :
                            type === 'flex' ? 'flex' : '';
      return (
        <div className={`${containerClass} ${className}`} style={styles}>
          <CartSlotRenderer
            slots={slots}
            parentId={slot.id}
            viewMode={viewMode}
            cartContext={cartContext}
          />
        </div>
      );
    }

    // Handle basic element types
    switch (type) {
      case 'text':
        return (
          <div
            className={className}
            style={styles}
            dangerouslySetInnerHTML={{ __html: content || '' }}
          />
        );

      case 'image':
        return (
          <img
            src={content || 'https://via.placeholder.com/300x200'}
            alt="Cart content"
            className={className}
            style={styles}
          />
        );

      case 'link':
        return (
          <a
            href="#"
            className={className}
            style={styles}
          >
            {content || 'Link'}
          </a>
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

      default:
        // For any unknown slot type, render as text
        return (
          <div className={className} style={styles}>
            {content || `[${type} slot]`}
          </div>
        );
    }
  };

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