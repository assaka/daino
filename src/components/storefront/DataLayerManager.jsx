
import { useEffect, useRef } from 'react';
import { useStore } from './StoreProvider';
import { CustomerActivity } from '@/api/entities';

// Initialize dataLayer
if (typeof window !== 'undefined' && !window.dataLayer) {
  window.dataLayer = [];
}

// Tracking deduplication - prevents duplicate calls for the same page
const trackedPages = new Set();
const pendingTracking = new Map(); // For debouncing

// Clear tracked pages when URL changes (for SPA navigation)
let lastKnownUrl = typeof window !== 'undefined' ? window.location.href : '';
export const clearPageTrackingForUrl = (url) => {
  // Remove any tracked pages for the old URL
  const keysToRemove = [];
  trackedPages.forEach(key => {
    if (key.includes(lastKnownUrl) && key !== `page_view:${url}`) {
      // Keep the current URL tracking, but allow tracking on new URLs
    }
  });
  lastKnownUrl = url;
};

// Export for testing/debugging
export const resetTracking = () => {
  trackedPages.clear();
  pendingTracking.forEach(timeoutId => clearTimeout(timeoutId));
  pendingTracking.clear();
};

export const pushToDataLayer = (event) => {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push(event);
    
    // Also dispatch a custom event for debugging
    window.dispatchEvent(new CustomEvent('dataLayerPush', { detail: event }));
  }
};

export const trackEvent = (eventName, eventData = {}) => {
  const event = {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...eventData
  };
  
  pushToDataLayer(event);
};

// Customer Activity Tracking - re-enabled with proper backend support
let sessionId = localStorage.getItem('guest_session_id');
let userId = localStorage.getItem('customer_user_id');

// Debounce time for tracking calls (prevents duplicate rapid calls)
const TRACKING_DEBOUNCE_MS = 500;

export const trackActivity = async (activityType, data = {}) => {
  try {

    if (!sessionId) {
      sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('guest_session_id', sessionId);
    }

    // Get store ID from the data payload if provided, otherwise check context
    let storeId = data.store_id;
    if (!storeId) {
        try {
            const storeContext = window.__STORE_CONTEXT__;
            if (storeContext?.store?.id) {
                storeId = storeContext.store.id;
            }
        } catch (error) {
            console.warn('Could not get store context for activity tracking');
        }
    }

    // Create a unique key for this tracking event to prevent duplicates
    const pageUrl = window.location.href;
    const trackingKey = `${activityType}:${storeId}:${pageUrl}`;

    // For page_view events, check if we've already tracked this exact page in this session
    if (activityType === 'page_view') {
      if (trackedPages.has(trackingKey)) {
        // Already tracked this page view, skip
        return;
      }
      trackedPages.add(trackingKey);
    }

    // Debounce: Cancel any pending tracking for the same key
    if (pendingTracking.has(trackingKey)) {
      clearTimeout(pendingTracking.get(trackingKey));
    }

    const activityData = {
      user_id: userId,
      session_id: sessionId,
      store_id: storeId,
      activity_type: activityType,
      page_url: pageUrl,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      language: navigator.language || navigator.userLanguage || null,
      ip_address: null, // Will be filled by server
      metadata: data,
      ...data
    };

    // Clean up undefined values
    Object.keys(activityData).forEach(key => {
      if (activityData[key] === undefined) {
        delete activityData[key];
      }
    });

    // Only track if we have store_id to prevent validation errors
    if (storeId) {
      // DEFER analytics tracking to improve LCP (don't block page render)
      // Use debounced timeout to prevent duplicate calls
      const timeoutId = setTimeout(async () => {
        pendingTracking.delete(trackingKey);

        try {
          // Use direct fetch instead of CustomerActivity.create to avoid auth issues
          const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
          const apiUrl = `${apiBaseUrl}/api/customer-activity`;

          const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(activityData),
          credentials: 'include'
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error response:', errorText);
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const responseData = await response.json();

        // Additional verification
        if (!(responseData.success && responseData.data && responseData.data.id)) {
          console.warn('⚠️ Unexpected response format:', responseData);
        }

      } catch (apiError) {
        // Check if it's a network error
        if (apiError.name === 'TypeError' && apiError.message.includes('fetch')) {
          console.error('🚨 Network connectivity issue detected!');
        }
        }
      }, 2000 + TRACKING_DEBOUNCE_MS); // Defer by 2 seconds + debounce

      pendingTracking.set(trackingKey, timeoutId);
    }

  } catch (error) {
    console.error('❌ Failed to track activity:', error);
  }
};

/**
 * Format product for dataLayer (enhanced with all available fields)
 */
const formatProduct = (product, index = 0, listName = null) => {
  return {
    item_id: product.id || product.product_id,
    item_name: product.name || product.product_name,
    item_brand: product.brand || product.brand_name || 'Unknown',
    item_category: product.category_name || product.category || 'Uncategorized',
    item_category2: product.subcategory || undefined,
    item_variant: product.variant_name || product.selected_variant || undefined,
    item_list_name: listName,
    item_list_id: listName,
    index: index,
    quantity: product.quantity || 1,
    price: parseFloat(product.price || 0),
    discount: product.discount || 0,
    currency: product.currency || 'USD',
    sku: product.sku,
    stock_status: product.in_stock ? 'in_stock' : 'out_of_stock',
    item_url: product.url || product.product_url,
    image_url: product.image || product.image_url
  };
};

// Enhanced event tracking functions

/**
 * PRODUCT IMPRESSIONS (Category/List View)
 */
export const trackProductImpressions = (products, listName = 'Category Page') => {
  if (!products || products.length === 0) return;

  const items = products.map((product, index) => formatProduct(product, index, listName));

  pushToDataLayer({
    event: 'view_item_list',
    ecommerce: {
      item_list_name: listName,
      item_list_id: listName.toLowerCase().replace(/\s+/g, '_'),
      items: items
    }
  });

  trackActivity('page_view', {
    page_type: 'category_list',
    metadata: {
      products_shown: products.length,
      list_name: listName,
      product_ids: products.map(p => p.id).slice(0, 10)
    }
  });
};

/**
 * PRODUCT CLICK (From List to Detail)
 */
export const trackProductClick = (product, position, listName = 'Category Page') => {
  pushToDataLayer({
    event: 'select_item',
    ecommerce: {
      item_list_name: listName,
      item_list_id: listName.toLowerCase().replace(/\s+/g, '_'),
      items: [formatProduct(product, position, listName)]
    }
  });
};

/**
 * PRODUCT DETAIL VIEW (Enhanced)
 */
export const trackProductView = (product) => {
  const productData = formatProduct(product);

  pushToDataLayer({
    event: 'view_item',
    ecommerce: {
      currency: productData.currency,
      value: productData.price,
      items: [productData]
    }
  });

  trackActivity('product_view', {
    product_id: product.id,
    metadata: {
      product_name: product.name,
      product_sku: product.sku,
      product_price: product.price,
      product_category: product.category_name,
      product_brand: product.brand,
      in_stock: product.in_stock,
      has_variants: product.has_variants || false
    }
  });
};

/**
 * ADD TO CART (Enhanced with full product data)
 */
export const trackAddToCart = (product, quantity = 1, variant = null) => {
  const productData = {
    ...formatProduct(product),
    quantity: quantity
  };

  if (variant) {
    productData.item_variant = variant.name || variant.option_values?.join(' / ');
    productData.variant_id = variant.id;
  }

  pushToDataLayer({
    event: 'add_to_cart',
    ecommerce: {
      currency: productData.currency,
      value: productData.price * quantity,
      items: [productData]
    }
  });

  trackActivity('add_to_cart', {
    product_id: product.id,
    metadata: {
      product_name: product.name,
      product_sku: product.sku,
      product_price: product.price,
      quantity: quantity,
      variant: variant ? {
        id: variant.id,
        name: variant.name,
        options: variant.option_values
      } : null,
      cart_value: product.price * quantity,
      currency: productData.currency,
      category: product.category_name,
      brand: product.brand
    }
  });
};

/**
 * REMOVE FROM CART (Enhanced)
 */
export const trackRemoveFromCart = (product, quantity = 1) => {
  const productData = {
    ...formatProduct(product),
    quantity: quantity
  };

  pushToDataLayer({
    event: 'remove_from_cart',
    ecommerce: {
      currency: productData.currency,
      value: productData.price * quantity,
      items: [productData]
    }
  });

  trackActivity('remove_from_cart', {
    product_id: product.id,
    metadata: {
      product_name: product.name,
      product_sku: product.sku,
      product_price: product.price,
      quantity: quantity,
      removed_value: product.price * quantity,
      currency: productData.currency,
      category: product.category_name,
      brand: product.brand
    }
  });
};

/**
 * VIEW CART
 */
export const trackViewCart = (cartItems, cartTotal) => {
  const items = cartItems.map((item, index) => formatProduct({
    id: item.product_id || item.id,
    name: item.product_name || item.name,
    price: item.unit_price || item.price,
    quantity: item.quantity,
    category_name: item.category_name,
    brand: item.brand,
    sku: item.sku
  }, index));

  pushToDataLayer({
    event: 'view_cart',
    ecommerce: {
      currency: 'USD',
      value: parseFloat(cartTotal),
      items: items
    }
  });
};

/**
 * BEGIN CHECKOUT
 */
export const trackBeginCheckout = (cartItems, cartTotal) => {
  const items = cartItems.map((item, index) => formatProduct({
    id: item.product_id || item.id,
    name: item.product_name || item.name,
    price: item.unit_price || item.price,
    quantity: item.quantity,
    category_name: item.category_name,
    brand: item.brand,
    sku: item.sku
  }, index));

  pushToDataLayer({
    event: 'begin_checkout',
    ecommerce: {
      currency: 'USD',
      value: parseFloat(cartTotal),
      items: items
    }
  });

  trackActivity('checkout_started', {
    metadata: {
      cart_items_count: items.length,
      cart_value: cartTotal,
      product_ids: items.map(item => item.item_id)
    }
  });
};

/**
 * ADD TO WISHLIST
 */
export const trackAddToWishlist = (product) => {
  const productData = formatProduct(product);

  pushToDataLayer({
    event: 'add_to_wishlist',
    ecommerce: {
      currency: productData.currency,
      value: productData.price,
      items: [productData]
    }
  });
};

/**
 * PROMOTION VIEW
 */
export const trackPromotionView = (promotions) => {
  if (!Array.isArray(promotions)) promotions = [promotions];

  const promoItems = promotions.map((promo, index) => ({
    promotion_id: promo.id,
    promotion_name: promo.name || promo.title,
    creative_name: promo.creative || promo.banner_name,
    creative_slot: promo.position || `slot_${index}`,
    location_id: promo.location || window.location.pathname
  }));

  pushToDataLayer({
    event: 'view_promotion',
    ecommerce: {
      items: promoItems
    }
  });
};

/**
 * PROMOTION CLICK
 */
export const trackPromotionClick = (promotion) => {
  pushToDataLayer({
    event: 'select_promotion',
    ecommerce: {
      items: [{
        promotion_id: promotion.id,
        promotion_name: promotion.name || promotion.title,
        creative_name: promotion.creative || promotion.banner_name,
        creative_slot: promotion.position,
        location_id: window.location.pathname
      }]
    }
  });
};

/**
 * NEWSLETTER SIGNUP
 */
export const trackNewsletterSignup = (source = 'footer') => {
  pushToDataLayer({
    event: 'newsletter_signup',
    form_location: source,
    page_url: window.location.href
  });
};

/**
 * PRODUCT FILTER APPLIED
 */
export const trackFilterApplied = (filterType, filterValue, resultsCount) => {
  pushToDataLayer({
    event: 'filter_applied',
    filter_type: filterType,
    filter_value: filterValue,
    results_count: resultsCount,
    page_url: window.location.href
  });
};

/**
 * COUPON APPLIED
 */
export const trackCouponApplied = (couponCode, discountAmount, cartTotal) => {
  pushToDataLayer({
    event: 'coupon_applied',
    coupon_code: couponCode,
    discount_amount: parseFloat(discountAmount),
    cart_total: parseFloat(cartTotal)
  });
};

/**
 * QUICK VIEW
 */
export const trackQuickView = (product) => {
  const productData = formatProduct(product);

  pushToDataLayer({
    event: 'quick_view',
    ecommerce: {
      items: [productData]
    }
  });
};

/**
 * PURCHASE (Enhanced)
 */
export const trackPurchase = (order) => {
  const orderId = order.id || order.order_id;
  const orderTotal = parseFloat(order.total_amount || order.total || 0);
  const orderCurrency = order.currency || 'USD';
  const orderItems = order.OrderItems || order.items || order.orderItems || [];

  const items = orderItems.map((item, index) => formatProduct({
    id: item.product_id || item.id,
    name: item.product_name || item.name,
    price: item.unit_price || item.price,
    quantity: item.quantity,
    category_name: item.category_name,
    brand: item.brand,
    sku: item.sku
  }, index));

  pushToDataLayer({
    event: 'purchase',
    ecommerce: {
      transaction_id: orderId,
      value: orderTotal,
      tax: parseFloat(order.tax_amount || 0),
      shipping: parseFloat(order.shipping_amount || 0),
      currency: orderCurrency,
      coupon: order.coupon_code || undefined,
      items: items
    }
  });

  trackActivity('order_completed', {
    metadata: {
      order_id: orderId,
      order_total: orderTotal,
      order_items_count: orderItems.length,
      tax_amount: order.tax_amount,
      shipping_amount: order.shipping_amount,
      discount_amount: order.discount_amount,
      coupon_code: order.coupon_code,
      payment_method: order.payment_method,
      shipping_method: order.shipping_method
    }
  });
};

/**
 * SEARCH
 */
export const trackSearch = (query, resultsCount = 0, filters = {}) => {
  pushToDataLayer({
    event: 'search',
    search_term: query,
    search_results: resultsCount,
    search_filters: filters
  });

  trackActivity('search', {
    search_query: query,
    metadata: {
      results_count: resultsCount,
      filters: filters
    }
  });
};

export default function DataLayerManager() {
  const { store, settings } = useStore();
  const hasTrackedPageRef = useRef(false);
  const lastTrackedUrlRef = useRef(null);

  // Set up global context and tracking functions (doesn't need store.id stability)
  useEffect(() => {
    if (store) {
      window.__STORE_CONTEXT__ = { store, settings };

      // Make tracking functions globally available
      window.daino = {
        // Core tracking
        trackEvent,
        trackActivity,
        pushToDataLayer,
        // Product tracking
        trackProductImpressions,
        trackProductClick,
        trackProductView,
        trackAddToCart,
        trackRemoveFromCart,
        trackViewCart,
        // Checkout tracking
        trackBeginCheckout,
        trackPurchase,
        trackSearch,
        // Engagement tracking
        trackAddToWishlist,
        trackPromotionView,
        trackPromotionClick,
        trackNewsletterSignup,
        trackFilterApplied,
        trackCouponApplied,
        trackQuickView
      };
    }
  }, [store, settings]);

  // Track page view - use store.id as dependency to prevent re-runs on object reference changes
  useEffect(() => {
    const storeId = store?.id;
    const currentUrl = window.location.href;

    // Skip if no store ID or if we've already tracked this exact URL
    if (!storeId) return;
    if (hasTrackedPageRef.current && lastTrackedUrlRef.current === currentUrl) {
      return;
    }

    // Mark as tracked for this URL
    hasTrackedPageRef.current = true;
    lastTrackedUrlRef.current = currentUrl;

    // Initialize GTM dataLayer with basic info
    pushToDataLayer({
      event: 'page_view',
      page_title: document.title,
      page_url: currentUrl,
      store_name: store.name,
      store_id: storeId,
      currency: store.currency || 'No Currency'
    });

    // Track page view activity (deduplication is also handled in trackActivity)
    trackActivity('page_view', {
      page_url: currentUrl,
      page_title: document.title,
      store_id: storeId
    });
  }, [store?.id]); // Use store.id as dependency - stable primitive value

  // Add event listener for dataLayer pushes
  useEffect(() => {
    const handleDataLayerPush = (e) => {
      // Event listener for future use
    };

    window.addEventListener('dataLayerPush', handleDataLayerPush);

    return () => {
      window.removeEventListener('dataLayerPush', handleDataLayerPush);
    };
  }, []);

  return null;
}
