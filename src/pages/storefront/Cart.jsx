
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { createPublicUrl, getExternalStoreUrl, getStoreBaseUrl } from '@/utils/urlUtils';
import { useStore } from '@/components/storefront/StoreProvider';
import { StorefrontProduct } from '@/api/storefront-entities';
import { Coupon } from '@/api/entities';
import { Tax } from '@/api/entities';
import cartService from '@/services/cartService';
import couponService from '@/services/couponService';
import taxService from '@/services/taxService';
import FlashMessage from '@/components/storefront/FlashMessage';
import SeoHeadManager from '@/components/storefront/SeoHeadManager';
import { formatPriceWithTax, calculateDisplayPrice, safeNumber, formatPrice as formatPriceUtil } from '@/utils/priceUtils';
import { getProductName, getCurrentLanguage } from '@/utils/translationUtils';
import { useCartPageBootstrap } from '@/hooks/usePageBootstrap';
import { useTranslation } from '@/contexts/TranslationContext';

// Import new hook system
import hookSystem from '@/core/HookSystem.js';
import eventSystem from '@/core/EventSystem.js';

import slotConfigurationService from '@/services/slotConfigurationService';
import { UnifiedSlotRenderer } from '@/components/editor/slot/UnifiedSlotRenderer';
import '@/components/editor/slot/UnifiedSlotComponents'; // Register unified components
// Slot configurations are loaded from database via slotConfigurationService
import { PageLoader } from '@/components/ui/page-loader';

const getSessionId = () => {
  let sid = localStorage.getItem('guest_session_id');
  if (!sid) {
    sid = 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('guest_session_id', sid);
  }

  // Check for old cart_session_id and clean it up
  const oldSid = localStorage.getItem('cart_session_id');
  if (oldSid) {
    localStorage.removeItem('cart_session_id');
  }

  return sid;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Use centralized price formatting from priceUtils
// formatPriceUtil already handles currency symbols and decimal places

// Simplified retry function without artificial delays
const simpleRetry = async (apiCall, maxRetries = 2) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      const isRateLimit = error.response?.status === 429;

      if (isRateLimit && i < maxRetries - 1) {
        // Only minimal delay for rate limits
        await delay(1000);
        continue;
      }

      if (i === maxRetries - 1) {
        throw error;
      }
    }
  }
};

const useDebouncedEffect = (effect, deps, delay) => {
    useEffect(() => {
        const handler = setTimeout(() => effect(), delay);
        return () => clearTimeout(handler);
    }, [...(deps || []), delay]);
};

export default function Cart() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();


    // Use StoreProvider data instead of making separate API calls
    const { store, settings, taxes: storeTaxes, selectedCountry, loading: storeLoading } = useStore();

    // Layer 2: Cart page bootstrap (cart slots, taxes)
    const language = getCurrentLanguage();
    const { data: pageBootstrap, isLoading: pageBootstrapLoading } = useCartPageBootstrap(
        store?.id,
        language
    );

    // Use taxes from page bootstrap if available, otherwise use from StoreProvider
    const taxes = pageBootstrap?.taxes || storeTaxes;

    // State for cart layout configuration
    const [cartLayoutConfig, setCartLayoutConfig] = useState(null);
    const [configLoaded, setConfigLoaded] = useState(false);

    // Check if we're viewing published version (version=published takes priority)
    const isViewingPublished = searchParams.get('version') === 'published';
    // Only load draft when in workspace mode AND NOT viewing published version
    const shouldLoadDraft = !isViewingPublished && (searchParams.get('preview') === 'draft' || searchParams.get('workspace') === 'true');

    // Load cart layout configuration directly
    useEffect(() => {
        const loadCartLayoutConfig = async () => {
            if (!store?.id) {
                return;
            }

            // Priority 1: Use page bootstrap if available (no API call!) - only if NOT loading draft
            if (!shouldLoadDraft && pageBootstrap?.cartSlotConfig) {
                setCartLayoutConfig(pageBootstrap.cartSlotConfig);
                setConfigLoaded(true);
                return;
            }

            // Priority 2: Check global cache - use different cache key for draft mode
            if (!window.__slotConfigCache) window.__slotConfigCache = {};
            if (!window.__slotConfigFetching) window.__slotConfigFetching = {};

            const cacheKey = shouldLoadDraft ? `cart:draft:${store.id}` : `cart:${store.id}`;
            const cached = window.__slotConfigCache[cacheKey];

            if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
                setCartLayoutConfig(cached.data);
                setConfigLoaded(true);
                return;
            }

            // Priority 3: Fetch from API (with deduplication)
            if (window.__slotConfigFetching[cacheKey]) {
                // Already fetching - wait for it
                await window.__slotConfigFetching[cacheKey];
                // After fetch completes, config will be in cache
                const cachedAfterFetch = window.__slotConfigCache[cacheKey];
                if (cachedAfterFetch) {
                    setCartLayoutConfig(cachedAfterFetch.data);
                    setConfigLoaded(true);
                }
                return;
            }

            // Start fetching - use draft or published based on mode
            const fetchPromise = shouldLoadDraft
                ? slotConfigurationService.getDraftConfiguration(store.id, 'cart')
                : slotConfigurationService.getPublishedConfiguration(store.id, 'cart');
            window.__slotConfigFetching[cacheKey] = fetchPromise;

            try {
                const response = await fetchPromise;
                delete window.__slotConfigFetching[cacheKey]; // Clear fetching flag

                // Check for various "no published config" scenarios
                if (response.success && response.data &&
                    response.data.configuration &&
                    response.data.configuration.slots &&
                    Object.keys(response.data.configuration.slots).length > 0) {

                    const publishedConfig = response.data;
                    const config = publishedConfig.configuration;

                    // Cache the result
                    window.__slotConfigCache[cacheKey] = { data: config, timestamp: Date.now() };

                    setCartLayoutConfig(config);
                    setConfigLoaded(true);

                } else {
                    // No published config exists - this should not happen if store was provisioned correctly
                    console.warn('No published cart configuration found. Store may not be provisioned correctly.');
                    setCartLayoutConfig(null);
                    setConfigLoaded(true);
                }
            } catch (error) {
                delete window.__slotConfigFetching[cacheKey]; // Clear fetching flag
                console.error('❌ CART: Error loading published slot configuration:', error);
                setCartLayoutConfig(null);
                setConfigLoaded(true);
            }
        };

        loadCartLayoutConfig();

        // Listen for configuration updates from editor
        const handleStorageChange = (e) => {
            if (e.key === 'slot_config_updated' && e.newValue) {
                const updateData = JSON.parse(e.newValue);
                if (updateData.storeId === store?.id && updateData.pageType === 'cart') {
                    loadCartLayoutConfig();
                    // Clear the notification
                    localStorage.removeItem('slot_config_updated');
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [store?.id, pageBootstrap, shouldLoadDraft]);
    
    const [taxRules, setTaxRules] = useState([]);
    
    // Get currency symbol from settings with hook support
    // Currency symbol comes from StoreProvider which derives it from store.currency → getCurrencySymbol()
    const currencySymbol = hookSystem.apply('cart.getCurrencySymbol', settings?.currency_symbol, {
        store,
        settings
    });
    
    // Enhanced cart context for hooks
    const cartContext = useMemo(() => ({
        store,
        settings,
        taxes,
        selectedCountry,
        currencySymbol,
        sessionId: getSessionId()
    }), [store, settings, taxes, selectedCountry, currencySymbol]);
    const [cartItems, setCartItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [flashMessage, setFlashMessage] = useState(null);
    const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
    
    const [externalCartUpdateTrigger, setExternalCartUpdateTrigger] = useState(0);


    useEffect(() => {
        // Load cart data immediately when store is available - tax rules now loaded in parallel within loadCartData
        if (!storeLoading && store?.id) {
            loadCartData().catch(error => {
                console.error('Error loading cart data:', error);
            });
        }
        
    }, [storeLoading, store?.id]);

    // Removed loadTaxRules - now using taxes from page bootstrap or StoreProvider

    // Load applied coupon from service on mount
    useEffect(() => {
        const storedCoupon = couponService.getAppliedCoupon();
        if (storedCoupon) {
            setAppliedCoupon(storedCoupon);
        }

        // Listen for coupon changes from other components
        const unsubscribe = couponService.addListener((coupon) => {
            setAppliedCoupon(coupon);
        });

        return unsubscribe;
    }, []);

    // Listen for cart updates from other components (like MiniCart, add to cart) with debouncing
    useEffect(() => {
        let debounceTimer;

        const handleCartUpdate = (event) => {
            // Check if we have fresh cart data from the service
            if (event.detail?.freshCartData && event.detail.freshCartData.items) {
                // Use fresh data directly instead of API call
                const freshItems = event.detail.freshCartData.items;

                // Check if we need to load product details
                const hasProductDetails = freshItems.length > 0 && cartItems.length > 0 &&
                    freshItems.some(item => {
                        const existingItem = cartItems.find(existing => existing.id === item.id);
                        return existingItem?.product;
                    });

                if (hasProductDetails) {
                    // We have existing product data, use it
                    const populatedCart = freshItems.map(item => {
                        const existingItem = cartItems.find(existing => existing.id === item.id);
                        return {
                            ...item,
                            product: existingItem?.product,
                            selected_options: item.selected_options || []
                        };
                    }).filter(item => item.product);

                    setCartItems(populatedCart);
                    return;
                } else {
                    // No existing product data, trigger full reload to fetch product details
                    if (!loading && hasLoadedInitialData) {
                        clearTimeout(debounceTimer);
                        debounceTimer = setTimeout(() => {
                            setExternalCartUpdateTrigger(prev => prev + 1);
                        }, 300);
                    } else if (!hasLoadedInitialData) {
                        // If we haven't loaded initial data yet, load it now
                        loadCartData(false);
                    }
                    return;
                }
            }

            // Only reload if we don't have fresh data and we're not currently loading
            if (!loading && hasLoadedInitialData) {
                // Clear existing timer
                clearTimeout(debounceTimer);

                // Debounce rapid cart updates
                debounceTimer = setTimeout(() => {
                    // Trigger reload using state instead of direct function call
                    setExternalCartUpdateTrigger(prev => prev + 1);
                }, 300); // 300ms debounce
            }
        };

        window.addEventListener('cartUpdated', handleCartUpdate);

        return () => {
            clearTimeout(debounceTimer);
            window.removeEventListener('cartUpdated', handleCartUpdate);
        };
    }, [loading, hasLoadedInitialData, cartItems]);


    const loadCartData = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);

        try {
            const totalStartTime = performance.now();

            // Create cart context locally to avoid circular dependency
            const localCartContext = {
                store,
                settings,
                taxes,
                selectedCountry,
                currencySymbol,
                sessionId: getSessionId()
            };

            // Apply before load hooks
            const shouldLoad = hookSystem.apply('cart.beforeLoadItems', true, localCartContext);
            if (!shouldLoad) {
                setLoading(false);
                return;
            }

            // Emit loading event
            eventSystem.emit('cart.loadingStarted', localCartContext);
            // Load cart data (tax rules already available from page bootstrap or StoreProvider!)
            const cartResult = await cartService.getCart(true, store?.id).then(
                result => ({ status: 'fulfilled', value: result }),
                error => ({ status: 'rejected', reason: error })
            );

            // Use tax rules from page bootstrap or StoreProvider (no API call!)
            const taxRulesData = { status: 'fulfilled', value: taxes || [] };

            // Extract cart results
            let cartItems = [];
            if (cartResult.status === 'fulfilled' && cartResult.value.success && cartResult.value.items) {
                cartItems = cartResult.value.items;
            } else if (cartResult.status === 'rejected') {
                console.error('Cart loading failed:', cartResult.reason);
            }

            // Update tax rules from parallel load
            if (taxRulesData.status === 'fulfilled') {
                setTaxRules(taxRulesData.value);
            }

            if (!cartItems || cartItems.length === 0) {
                // Apply hook even for empty cart (important for empty cart hooks!)
                hookSystem.apply('cart.processLoadedItems', [], localCartContext);

                setCartItems([]);
                // Clear applied coupon when cart is empty
                if (appliedCoupon) {
                    couponService.removeAppliedCoupon();
                }
                if (showLoader) setLoading(false);
                return;
            }

            const productIds = [...new Set(cartItems.map(item => {
                // Ensure product_id is a string/number, not an object
                const productId = typeof item.product_id === 'object' ?
                    (item.product_id?.id || item.product_id?.toString() || null) :
                    item.product_id;
                return productId;
            }).filter(id => id !== null))];

            // Batch Product Fetching with request deduplication
            let products = [];
            try {
                const cacheKey = `products:${store?.id}:${productIds.sort().join(',')}`;

                // Initialize global cache if needed
                if (!window.__productBatchCache) window.__productBatchCache = {};
                if (!window.__productFetching) window.__productFetching = {};

                // Check cache first
                if (window.__productBatchCache[cacheKey]) {
                    const cached = window.__productBatchCache[cacheKey];
                    if (Date.now() - cached.timestamp < 30000) { // 30s cache
                        products = cached.data;
                    }
                }

                // If not cached, check if already fetching
                if (!products.length) {
                    if (window.__productFetching[cacheKey]) {
                        // Wait for the in-flight request
                        products = await window.__productFetching[cacheKey];
                    } else {
                        // Start fetching - explicitly pass store_id to ensure correct store filtering
                        const fetchPromise = StorefrontProduct.filter({ ids: productIds, store_id: store?.id }).then(result => {
                            const productsResult = result || [];
                            window.__productBatchCache[cacheKey] = { data: productsResult, timestamp: Date.now() };
                            delete window.__productFetching[cacheKey];
                            return productsResult;
                        });
                        window.__productFetching[cacheKey] = fetchPromise;
                        products = await fetchPromise;
                    }
                }
            } catch (error) {
                console.error('Cart: Failed to fetch products:', error);
                products = [];
            }

            const populatedCart = cartItems.map(item => {
                const productDetails = (products || []).filter(p => p).find(p => p && p.id === item.product_id);
                return {
                    ...item,
                    product: productDetails,
                    selected_options: item.selected_options || [] // Ensure selected_options is always an array
                };
            }).filter(item => item.product); // Ensure product exists

            // Apply item processing hooks
            const processedItems = hookSystem.apply('cart.processLoadedItems', populatedCart, localCartContext);

            setCartItems(processedItems);
            setHasLoadedInitialData(true);

            // Apply after load hooks
            hookSystem.do('cart.afterLoadItems', {
                items: processedItems,
                ...localCartContext
            });

            // Emit loaded event
            eventSystem.emit('cart.itemsLoaded', {
                items: processedItems,
                ...localCartContext
            });
            
            // Validate applied coupon when cart contents change
            if (appliedCoupon) {
                validateAppliedCoupon(appliedCoupon, processedItems);
            }

        } catch (error) {
            console.error("❌ Error loading cart:", error);
            setFlashMessage({ type: 'error', message: "Could not load your cart. Please try refreshing." });
            setCartItems([]); // Set to empty array on error
            setHasLoadedInitialData(true);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [appliedCoupon, store, settings, taxes, selectedCountry, currencySymbol]); // Fixed dependencies to avoid circular reference

    // Handle external cart update triggers (placed after loadCartData definition)
    useEffect(() => {
        if (externalCartUpdateTrigger > 0 && !loading && hasLoadedInitialData) {
            loadCartData(false);
        }
    }, [externalCartUpdateTrigger, loading, hasLoadedInitialData, loadCartData]);

    // Enhanced updateQuantity with hooks - server-first approach
    const updateQuantity = useCallback(async (itemId, newQuantity) => {
        const currentItem = cartItems.find(item => item.id === itemId);
        if (!currentItem || newQuantity <= 0) return;

        try {
            if (!store?.id) {
                console.error('🛒 Cart: No store context available for update');
                setFlashMessage({ type: 'error', message: "Store context not available." });
                return;
            }

            // Apply before update hooks
            const shouldUpdate = hookSystem.apply('cart.beforeUpdateQuantity', true, {
                itemId,
                currentQuantity: currentItem.quantity,
                newQuantity,
                item: currentItem,
                ...cartContext
            });

            if (!shouldUpdate) return;

            // Apply quantity validation hooks
            const validatedQuantity = hookSystem.apply('cart.validateQuantity', Math.max(1, newQuantity), {
                item: currentItem,
                maxStock: currentItem.product?.stock_quantity,
                ...cartContext
            });

            // Server-first approach: update server then UI
            const updatedItems = cartItems.map(item =>
                item.id === itemId ? { ...item, quantity: validatedQuantity } : item
            );

            const result = await cartService.updateCart(updatedItems, store.id);

            if (result.success) {
                // Apply after update hooks
                hookSystem.do('cart.afterUpdateQuantity', {
                    itemId,
                    oldQuantity: currentItem.quantity,
                    newQuantity: validatedQuantity,
                    item: currentItem,
                    ...cartContext
                });

                // Emit update event
                eventSystem.emit('cart.quantityUpdated', {
                    itemId,
                    oldQuantity: currentItem.quantity,
                    newQuantity: validatedQuantity,
                    item: currentItem,
                    ...cartContext
                });

                // CartService will dispatch event with fresh data, which our listener will handle
            } else {
                console.error('Failed to update quantity:', result.error);
                setFlashMessage({ type: 'error', message: "Failed to update quantity." });
            }
        } catch (error) {
            console.error("Error updating cart quantity:", error);
            setFlashMessage({ type: 'error', message: "Failed to update cart quantity." });
        }
    }, [cartItems, cartContext, store?.id]);

    // Enhanced removeItem with hooks
    const removeItem = useCallback(async (itemId) => {
        const itemToRemove = cartItems.find(item => item.id === itemId);
        if (!itemToRemove) return;

        try {
            if (!store?.id) {
                console.error('🛒 Cart: No store context available for remove');
                setFlashMessage({ type: 'error', message: "Store context not available." });
                return;
            }

            // Don't update if we don't have valid cart items loaded
            if (!cartItems || cartItems.length === 0) {
                console.error('🛒 Cart: No cart items to remove from');
                return;
            }

            // Don't remove if we're still loading initial data
            if (loading || !hasLoadedInitialData) {
                return;
            }

            // Apply before remove hooks
            const shouldRemove = hookSystem.apply('cart.beforeRemoveItem', true, {
                itemId,
                item: itemToRemove,
                ...cartContext
            });

            if (!shouldRemove) return;

            // Server-first approach: update server then UI
            const updatedItems = cartItems.filter(item => item.id !== itemId);

            const result = await cartService.updateCart(updatedItems, store.id);

            if (result.success) {
                // Apply after remove hooks
                hookSystem.do('cart.afterRemoveItem', {
                    itemId,
                    removedItem: itemToRemove,
                    ...cartContext
                });

                // Emit remove event
                eventSystem.emit('cart.itemRemoved', {
                    itemId,
                    removedItem: itemToRemove,
                    ...cartContext
                });

                // CartService will dispatch event with fresh data, which our listener will handle
                setFlashMessage({ type: 'success', message: t('cart.item_removed', 'Item removed from cart.') });
            } else {
                console.error('Failed to remove item:', result.error);
                setFlashMessage({ type: 'error', message: "Failed to remove item." });
            }
        } catch (error) {
            console.error("Error removing item:", error);
            setFlashMessage({ type: 'error', message: "Failed to remove item." });
            
            eventSystem.emit('cart.removeError', {
                error: error.message,
                itemId,
                ...cartContext
            });
        }
    }, [cartItems, cartContext, store?.id, loading, hasLoadedInitialData]);

    // Validate that applied coupon is still valid for current cart contents
    const validateAppliedCoupon = (coupon, cartItems) => {
        if (!coupon || !cartItems || cartItems.length === 0) return;

        try {
            // Check if coupon applies to products in cart
            if (coupon.applicable_products && coupon.applicable_products.length > 0) {
                const hasApplicableProduct = cartItems.some(item => {
                    // Normalize product_id to handle cases where it might be an object
                    const productId = typeof item.product_id === 'object' ?
                        (item.product_id?.id || item.product_id?.toString() || null) :
                        item.product_id;
                    return productId && coupon.applicable_products.includes(productId);
                });
                if (!hasApplicableProduct) {
                    couponService.removeAppliedCoupon();
                    setFlashMessage({ type: 'warning', message: `Coupon "${coupon.name}" was removed because it doesn't apply to current cart items.` });
                    return;
                }
            }

            // Check if coupon applies to categories in cart
            if (coupon.applicable_categories && coupon.applicable_categories.length > 0) {
                const hasApplicableCategory = cartItems.some(item => 
                    item.product?.category_ids?.some(catId => 
                        coupon.applicable_categories.includes(catId)
                    )
                );
                if (!hasApplicableCategory) {
                    couponService.removeAppliedCoupon();
                    setFlashMessage({ type: 'warning', message: `Coupon "${coupon.name}" was removed because it doesn't apply to current cart items.` });
                    return;
                }
            }

            // Check minimum purchase amount
            const subtotal = calculateSubtotal();
            if (coupon.min_purchase_amount && subtotal < coupon.min_purchase_amount) {
                couponService.removeAppliedCoupon();
                setFlashMessage({
                    type: 'warning',
                    message: `Coupon "${coupon.name}" was removed because the minimum order amount of ${formatPriceUtil(coupon.min_purchase_amount)} is no longer met.`
                });
                return;
            }

        } catch (error) {
            console.error('Error validating applied coupon:', error);
        }
    };

    const handleApplyCoupon = async () => {
        if (!couponCode) {
            setFlashMessage({ type: 'error', message: t('common.enter_coupon_code', 'Please enter a coupon code.') });
            return;
        }

        if (!store?.id) {
            setFlashMessage({ type: 'error', message: "Store information not available." });
            return;
        }

        try {
            const coupons = await simpleRetry(() => Coupon.filter({
                code: couponCode,
                is_active: true,
                store_id: store.id
            }));

            if (coupons && coupons.length > 0) {
                const coupon = coupons[0];
                
                // Check if coupon is still valid (not expired)
                if (coupon.end_date) {
                    const expiryDate = new Date(coupon.end_date);
                    const now = new Date();
                    if (expiryDate < now) {
                        setFlashMessage({ type: 'error', message: "This coupon has expired." });
                        return;
                    }
                }
                
                // Check if coupon has started
                if (coupon.start_date) {
                    const startDate = new Date(coupon.start_date);
                    const now = new Date();
                    if (startDate > now) {
                        setFlashMessage({ type: 'error', message: "This coupon is not yet active." });
                        return;
                    }
                }
                
                // Check usage limit
                if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
                    setFlashMessage({ type: 'error', message: "This coupon has reached its usage limit." });
                    return;
                }
                
                // Check minimum purchase amount
                if (coupon.min_purchase_amount && subtotal < coupon.min_purchase_amount) {
                    setFlashMessage({
                        type: 'error',
                        message: `Minimum order amount of ${formatPriceUtil(coupon.min_purchase_amount)} required for this coupon.`
                    });
                    return;
                }
                
                // Check if coupon applies to products in cart
                if (coupon.applicable_products && coupon.applicable_products.length > 0) {
                    const hasApplicableProduct = cartItems.some(item => {
                        // Normalize product_id to handle cases where it might be an object
                        const productId = typeof item.product_id === 'object' ?
                            (item.product_id?.id || item.product_id?.toString() || null) :
                            item.product_id;
                        return productId && coupon.applicable_products.includes(productId);
                    });
                    if (!hasApplicableProduct) {
                        setFlashMessage({
                            type: 'error',
                            message: "This coupon doesn't apply to any products in your cart."
                        });
                        return;
                    }
                }
                
                // Check if coupon applies to categories in cart
                if (coupon.applicable_categories && coupon.applicable_categories.length > 0) {
                    const hasApplicableCategory = cartItems.some(item => 
                        item.product?.category_ids?.some(catId => 
                            coupon.applicable_categories.includes(catId)
                        )
                    );
                    if (!hasApplicableCategory) {
                        setFlashMessage({ 
                            type: 'error', 
                            message: "This coupon doesn't apply to any products in your cart." 
                        });
                        return;
                    }
                }
                
                // Use coupon service to persist and sync coupon
                const result = couponService.setAppliedCoupon(coupon);
                if (result.success) {
                    setAppliedCoupon(coupon);
                    setFlashMessage({ type: 'success', message: t('cart.coupon_applied', `Coupon "${coupon.name}" applied!`).replace('{coupon}', coupon.name) });
                    setCouponCode(''); // Clear the input after successful application
                } else {
                    setFlashMessage({ type: 'error', message: t('cart.coupon_apply_failed', 'Failed to apply coupon. Please try again.') });
                }
            } else {
                setAppliedCoupon(null);
                setFlashMessage({ type: 'error', message: "Invalid or expired coupon code." });
            }
        } catch (error) {
            console.error("❌ Error applying coupon:", error);
            console.error("Error details:", {
                message: error.message,
                response: error.response,
                stack: error.stack
            });
            setFlashMessage({ type: 'error', message: "Could not apply coupon. Please try again." });
        }
    };

    const handleRemoveCoupon = () => {
        const result = couponService.removeAppliedCoupon();
        if (result.success) {
            setAppliedCoupon(null);
            setCouponCode('');
            setFlashMessage({ type: 'success', message: t('cart.coupon_removed', 'Coupon removed.') });
        }
    };

    const handleCouponKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleApplyCoupon();
        }
    };

    // Use data from StoreProvider instead of making API calls
    const getProductTaxRate = useCallback((product) => {
        if (!product || !product.tax_id || !taxes || taxes.length === 0) return 0;
        const taxRule = taxes.find(t => t.id === product.tax_id);
        if (!taxRule) return 0;
        const countryRate = taxRule.country_rates?.find(r => r.country === selectedCountry);
        return countryRate ? countryRate.rate / 100 : 0;
    }, [taxes, selectedCountry]);

    const calculateItemTotal = useCallback((item, product) => {
        if (!item || !product) return 0;

        let basePrice = safeNumber(item.price); // Try to use price stored in the cart item itself
        if (basePrice <= 0) { // If item.price is not a valid positive number
            basePrice = safeNumber(product.sale_price || product.price || 0); // Fallback to product's current sale_price or price
        }

        let optionsPrice = 0;
        if (item.selected_options && Array.isArray(item.selected_options)) {
            optionsPrice = item.selected_options.reduce((sum, option) => sum + safeNumber(option.price), 0);
        }

        return (basePrice + optionsPrice) * (safeNumber(item.quantity) || 1);
    }, []);

    const calculateSubtotal = useCallback(() => {
        return cartItems.reduce((total, item) => {
            // Subtotal is base product price only (without custom options)
            const basePrice = safeNumber(item.price) || safeNumber(item.product?.sale_price || item.product?.price || 0);
            return total + (basePrice * (safeNumber(item.quantity) || 1));
        }, 0);
    }, [cartItems]);

    const { subtotal, discount, tax, total, customOptionsTotal, taxDetails } = useMemo(() => {
        const calculatedSubtotal = calculateSubtotal();

        // Calculate custom options total separately
        const calculatedCustomOptionsTotal = cartItems.reduce((total, item) => {
            if (item.selected_options && Array.isArray(item.selected_options)) {
                const optionsPrice = item.selected_options.reduce((sum, option) =>
                    sum + safeNumber(option.price), 0
                );
                return total + (optionsPrice * (safeNumber(item.quantity) || 1));
            }
            return total;
        }, 0);

        // Calculate total with custom options included
        const calculatedTotalWithOptions = calculatedSubtotal + calculatedCustomOptionsTotal;

        let disc = 0;
        if (appliedCoupon) {

            // Helper function to check if an item qualifies for the coupon
            const itemQualifiesForCoupon = (item) => {
                // If no filters are set, coupon applies to all items
                const hasProductFilter = appliedCoupon.applicable_products && appliedCoupon.applicable_products.length > 0;
                const hasCategoryFilter = appliedCoupon.applicable_categories && appliedCoupon.applicable_categories.length > 0;
                const hasSkuFilter = appliedCoupon.applicable_skus && appliedCoupon.applicable_skus.length > 0;

                if (!hasProductFilter && !hasCategoryFilter && !hasSkuFilter) {
                    return true; // No filters = applies to all
                }

                // Check product ID filter
                if (hasProductFilter) {
                    const productId = typeof item.product_id === 'object' ?
                        (item.product_id?.id || item.product_id?.toString() || null) :
                        item.product_id;

                    if (productId && appliedCoupon.applicable_products.includes(productId)) {
                        return true;
                    }
                }

                // Check category filter
                if (hasCategoryFilter) {

                    if (item.product?.category_ids?.some(catId =>
                        appliedCoupon.applicable_categories.includes(catId)
                    )) {
                        return true;
                    }
                }

                // Check SKU filter
                if (hasSkuFilter) {

                    if (item.product?.sku && appliedCoupon.applicable_skus.includes(item.product.sku)) {
                        return true;
                    }
                }

                return false;
            };

            // Calculate the total of qualifying items only
            const qualifyingTotal = cartItems.reduce((total, item) => {
                const qualifies = itemQualifiesForCoupon(item);

                if (qualifies) {
                    // Use same price logic as cart display: item.price first, then fallback to product price
                    const price = safeNumber(item.price) || safeNumber(item.product?.sale_price || item.product?.price || 0);
                    const quantity = safeNumber(item.quantity || 1);
                    let itemTotal = price * quantity;

                    // Add custom options for this item
                    if (item.selected_options && Array.isArray(item.selected_options)) {
                        const optionsPrice = item.selected_options.reduce((sum, option) =>
                            sum + safeNumber(option.price), 0
                        );
                        itemTotal += optionsPrice * quantity;
                    }
                    return total + itemTotal;
                }
                return total;
            }, 0);

            // Apply discount based on type
            if (appliedCoupon.discount_type === 'fixed') {
                disc = safeNumber(appliedCoupon.discount_value);
            } else if (appliedCoupon.discount_type === 'percentage') {
                // Apply percentage to qualifying items only
                disc = qualifyingTotal * (safeNumber(appliedCoupon.discount_value) / 100);

                // Apply max discount limit if specified
                if (appliedCoupon.max_discount_amount && disc > safeNumber(appliedCoupon.max_discount_amount)) {
                    disc = safeNumber(appliedCoupon.max_discount_amount);
                }
            } else if (appliedCoupon.discount_type === 'free_shipping') {
                // For free shipping, the discount is 0 here but would be applied to shipping cost
                disc = 0;
            }

            // Ensure discount doesn't exceed qualifying total for product-specific coupons
            // or the entire total for cart-wide coupons
            const maxDiscount = qualifyingTotal > 0 ? qualifyingTotal : calculatedTotalWithOptions;
            if (disc > maxDiscount) {
                disc = maxDiscount;
            }

        }

        const subAfterDiscount = calculatedTotalWithOptions - disc;

        // Use new tax service for calculation
        const taxResult = (() => {
            if (!store || !taxRules.length || !cartItems.length) {
                return { taxAmount: 0, effectiveRate: 0, country: null };
            }

            // Create a shipping address object from selected country
            const shippingAddress = { country: selectedCountry || 'US' };

            // Create a simple product map for taxService
            const cartProducts = {};
            cartItems.forEach(item => {
                if (item.product) {
                    cartProducts[item.product_id] = item.product;
                }
            });

            const result = taxService.calculateTax(
                cartItems,
                cartProducts,
                store,
                taxRules,
                shippingAddress,
                calculatedTotalWithOptions,
                disc
            );

            return {
                taxAmount: result.taxAmount || 0,
                effectiveRate: result.effectiveRate || 0,
                country: selectedCountry || 'US'
            };
        })();

        const totalAmount = subAfterDiscount + taxResult.taxAmount;

        return {
            subtotal: calculatedSubtotal,
            customOptionsTotal: calculatedCustomOptionsTotal,
            discount: disc,
            tax: taxResult.taxAmount,
            total: totalAmount,
            taxDetails: taxResult
        };
    }, [cartItems, appliedCoupon, store, taxRules, selectedCountry, calculateSubtotal]);

    // Enhanced checkout navigation with hooks
    const handleCheckout = useCallback(() => {
        // Apply before checkout hooks
        const checkoutData = hookSystem.apply('cart.beforeCheckout', {
            items: cartItems,
            subtotal,
            discount,
            tax,
            total,
            canProceed: cartItems.length > 0
        }, cartContext);

        if (!checkoutData.canProceed) {
            eventSystem.emit('cart.checkoutBlocked', {
                reason: 'No items in cart',
                ...cartContext
            });
            return;
        }

        // Apply checkout URL hooks
        const checkoutUrl = hookSystem.apply('cart.getCheckoutUrl', createPublicUrl(store.slug, 'CHECKOUT'), {
            ...checkoutData,
            ...cartContext
        });

        // Emit checkout event
        eventSystem.emit('cart.checkoutStarted', {
            ...checkoutData,
            checkoutUrl,
            ...cartContext
        });

        navigate(checkoutUrl);
    }, [cartItems, subtotal, discount, tax, total, cartContext, store?.slug, navigate]);

    // Wait for plugins to be ready before emitting events
    // Check global flag immediately to handle race conditions
    const [pluginsReady, setPluginsReady] = useState(window.__pluginsReady || false);

    useEffect(() => {
        // If plugins already ready on mount, no need to wait for event
        if (window.__pluginsReady) {
            setPluginsReady(true);
            return;
        }

        // Otherwise wait for system.ready event
        const handleSystemReady = () => {
            setPluginsReady(true);
        };
        eventSystem.on('system.ready', handleSystemReady);
        return () => eventSystem.off('system.ready', handleSystemReady);
    }, []);

    // Emit cart viewed event (only after plugins are ready)
    useEffect(() => {
        if (!loading && cartItems.length >= 0 && pluginsReady) {
            eventSystem.emit('cart.viewed', {
                items: cartItems,
                subtotal,
                discount,
                tax,
                total,
                ...cartContext
            });
        }
    }, [loading, cartItems, subtotal, discount, tax, total, cartContext, pluginsReady]);

    
    // Wait for both store data and cart data to load
    if (loading || storeLoading) {
        return <PageLoader size="lg" className="h-screen" />;
    }

    // Prepare data object for CartSlots component
    const cartSlotsData = {
        store,
        cartItems,
        appliedCoupon,
        couponCode,
        subtotal,
        discount,
        tax,
        total,
        currencySymbol,
        settings,
        flashMessage,
        selectedCountry,
        taxes,
        loading,
        storeLoading,
        calculateItemTotal,
        formatPrice: formatPriceUtil, // Use centralized formatPrice
        updateQuantity,
        removeItem,
        handleCheckout,
        handleApplyCoupon,
        handleRemoveCoupon,
        handleCouponKeyPress,
        setCouponCode,
        setFlashMessage,
        formatDisplayPrice: formatPriceWithTax, // Use centralized formatPriceWithTax
        getStoreBaseUrl,
        getExternalStoreUrl,
        // Layout configuration - merge the cart layout config into the data
        ...(cartLayoutConfig || {})
    };
    

    // Render cart with complete slot-based layout
    return (
        <div className="bg-gray-50 cart-page" style={{ backgroundColor: '#f9fafb' }}>
            <SeoHeadManager
                pageType="cart"
                pageTitle="Your Cart"
                pageDescription="Review your shopping cart items before proceeding to checkout."
            />
            <div className="max-w-7xl mx-auto sm:px-4 sm:px-6 lg:px-8 sm:py-12">
                {/* FlashMessage Section */}
                <div className="flashMessage-section mb-6">
                    <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
                </div>

                {/* Complete Slot-Based Layout with Full Cart Functionality */}
                {(() => {
                    const hasConfig = !!cartLayoutConfig;
                    const hasSlots = !!cartLayoutConfig?.slots;
                    const slotsObject = cartLayoutConfig?.slots || {};
                    const slotCount = Object.keys(slotsObject).length;

                    const shouldRender = hasConfig && hasSlots && slotCount > 0;

                    return shouldRender;
                })() ? (
                    <div className="grid grid-cols-12 gap-2 auto-rows-min">
                        <UnifiedSlotRenderer
                            slots={cartLayoutConfig.slots}
                            parentId={null}
                            viewMode={cartItems.length === 0 ? 'emptyCart' : 'withProducts'}
                            context="storefront"
                            cartData={{
                                cartItems: cartItems.map(item => ({
                                    ...item,
                                    product: item.product ? {
                                        ...item.product,
                                        name: getProductName(item.product, getCurrentLanguage()) || item.product.name,
                                        image_url: item.product.images?.[0]?.url || item.product.image_url || item.product.image || ''
                                    } : item.product
                                })),
                                appliedCoupon,
                                couponCode,
                                subtotal,
                                customOptionsTotal,
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
                                formatPrice: formatPriceUtil, // Use centralized formatPrice
                                updateQuantity,
                                removeItem,
                                handleCheckout,
                                handleApplyCoupon,
                                handleRemoveCoupon,
                                handleCouponKeyPress,
                                setCouponCode,
                                formatDisplayPrice: formatPriceWithTax, // Use centralized formatPriceWithTax
                                getStoreBaseUrl,
                                navigate
                            }}
                        />
                    </div>
                ) : (
                    // Fallback when no slot configuration is available
                    <div className="text-center py-12">
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('checkout.my_cart', 'My Cart')}</h1>
                        {!cartLayoutConfig ? (
                            <p className="text-gray-600">Loading cart configuration...</p>
                        ) : (
                            <div className="text-gray-600">
                                <p className="mb-2">Cart configuration not available.</p>
                                {cartLayoutConfig?.metadata?.fallbackReason && (
                                    <p className="text-sm text-orange-600 mb-4">
                                        Reason: {cartLayoutConfig.metadata.fallbackReason}
                                    </p>
                                )}
                                <p className="text-sm">
                                    Using default cart layout. Please check your store configuration.
                                </p>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
}
