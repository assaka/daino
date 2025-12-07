
import React, { useState, useEffect, useCallback, Fragment } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { buildProductBreadcrumbs } from "@/utils/breadcrumbUtils";
import { getCategoryName as getTranslatedCategoryName, getProductName, getCurrentLanguage, getTranslatedField } from "@/utils/translationUtils";
import { useTranslation } from '@/contexts/TranslationContext';
import eventSystem from '@/core/EventSystem';
// Redirect handling moved to global RedirectHandler component
import { useNotFound } from "@/utils/notFoundUtils";
import { StorefrontProduct } from "@/api/storefront-entities";
import { User } from "@/api/entities";
import cartService from "@/services/cartService";
// React Query hooks for optimized API calls
import { useProduct, useUser, useWishlist } from "@/hooks/useApiQueries";
// ProductLabel entity is no longer imported directly as its data is now provided via useStore.
import { useStore, cachedApiCall } from "@/components/storefront/StoreProvider";
import { formatPriceWithTax, calculateDisplayPrice, safeNumber, formatPrice, getPriceDisplay } from "@/utils/priceUtils";
import { getImageUrlByIndex, getPrimaryImageUrl } from "@/utils/imageUtils";
import { getStockLabel as getStockLabelUtil, getStockLabelStyle, isProductOutOfStock } from "@/utils/stockUtils";
import {
  ShoppingCart, Star, ChevronLeft, ChevronRight, Minus, Plus, Heart, Download, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SeoHeadManager from "@/components/storefront/SeoHeadManager";
import { Skeleton } from "@/components/ui/skeleton";
import { StorefrontProductTab } from "@/api/storefront-entities";
import { CustomerWishlist } from "@/api/storefront-entities";
import FlashMessage from "@/components/storefront/FlashMessage";
// New imports for enhanced functionality
import CustomOptions from "@/components/storefront/CustomOptions";
import CmsBlockRenderer from "@/components/storefront/CmsBlockRenderer";
import RecommendedProducts from "@/components/storefront/RecommendedProducts";
import ConfigurableProductSelector from "@/components/storefront/ConfigurableProductSelector";

// Slot system imports
import slotConfigurationService from '@/services/slotConfigurationService';
import { UnifiedSlotRenderer } from '@/components/editor/slot/UnifiedSlotRenderer';
import '@/components/editor/slot/UnifiedSlotComponents'; // Register unified components
import { productConfig } from '@/components/editor/slot/configs/product-config';
import { useABTesting } from '@/hooks/useABTest';

// Utility function to generate a product name from attributes
const generateProductName = (product, basePrefix = '') => {
  if (!product?.attributes) return '';
  
  const nameComponents = [];
  
  // Add base prefix if provided
  if (basePrefix) {
    nameComponents.push(basePrefix);
  }
  
  // Define priority order of attributes for name generation
  const priorityAttributes = [
    'brand', 'manufacturer', 'model', 'color', 'size', 'material', 'style', 'type'
  ];
  
  // Add attributes in priority order
  priorityAttributes.forEach(attrCode => {
    const value = product.attributes[attrCode];
    if (value && typeof value === 'string' && value.trim()) {
      nameComponents.push(value.trim());
    }
  });

  // Add any other string attributes not yet included
  Object.entries(product.attributes).forEach(([code, value]) => {
    if (!priorityAttributes.includes(code) && 
        value && 
        typeof value === 'string' && 
        value.trim() && 
        !nameComponents.includes(value.trim())) {
      nameComponents.push(value.trim());
    }
  });
  
  return nameComponents.join(' ');
};

export default function ProductDetail() {
  const { slug: paramSlug, productSlug: routeProductSlug, storeCode } = useParams();
  const [searchParams] = useSearchParams();
  const slug = searchParams.get('slug') || routeProductSlug || paramSlug;


  // Updated useStore destructuring: productLabels is now sourced directly from the store context.
  const { store, settings, loading: storeLoading, categories, productLabels, taxes, selectedCountry } = useStore();
  const navigate = useNavigate();
  const { showNotFound } = useNotFound();
  const { t, currentLanguage, translations } = useTranslation();

  // Use React Query hooks for optimized API calls with automatic deduplication
  const { data: user } = useUser();
  const {
    data: productData,
    isLoading: productLoading,
    error: productError
  } = useProduct(slug, store?.id, {
    enabled: !storeLoading && !!store?.id && !!slug
  });

  // Use shared wishlist hook to avoid duplicate API calls
  const { data: wishlistData = [] } = useWishlist(store?.id);

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  // customOptions and customOptionsLabel states are removed as their logic is moved to the CustomOptions component.
  const [selectedOptions, setSelectedOptions] = useState([]); // This state remains to track selected options for price and cart.
  const [flashMessage, setFlashMessage] = useState(null);
  const [productTabs, setProductTabs] = useState([]);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [customOptions, setCustomOptions] = useState([]);
  const [customOptionsLabel, setCustomOptionsLabel] = useState('Custom Options');
  // productLabels state is removed as it's now managed by the useStore context.

  // State for product layout configuration
  const [productLayoutConfig, setProductLayoutConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // State for configurable products
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [displayProduct, setDisplayProduct] = useState(null);

  // A/B Testing - Get active tests for product page
  const { activeTests, isLoading: abTestsLoading, error: abTestError } = useABTesting(store?.id, 'product');

  // Update display product when product or selected variant changes
  useEffect(() => {
    if (product) {
      // For configurable products, show variant if selected, otherwise show parent
      if (product.type === 'configurable' && selectedVariant) {
        setDisplayProduct(selectedVariant);
      } else {
        setDisplayProduct(product);
      }
    }
  }, [product, selectedVariant]);

  // Handler for variant selection
  const handleVariantChange = (variant) => {
    setSelectedVariant(variant);
  };

  // Update product state when productData changes from React Query
  useEffect(() => {
    if (productData && productData.product) {
      // Product with pre-evaluated labels from backend
      const productWithLabels = {
        ...productData.product,
        labels: productData.productLabels?.map(label => label.text) || [],
        applicableLabels: productData.productLabels || []
      };

      setProduct(productWithLabels);
      setProductTabs(productData.productTabs || []);
      setCustomOptions(productData.customOptions || []);

      // Track product view with enhanced analytics
      if (typeof window !== 'undefined' && window.daino?.trackProductView) {
        window.daino.trackProductView(productData.product);
      }

      // Send Google Analytics 'view_item' event
      if (window.dataLayer) {
        window.dataLayer.push({
          event: 'view_item',
          ecommerce: {
            items: [{
              item_id: productData.product.id,
              item_name: getProductName(productData.product, getCurrentLanguage()) || productData.product.name,
              price: safeNumber(productData.product.price),
              item_brand: productData.product.brand,
              item_category: (() => {
                const category = categories.find(cat => cat.id === productData.product.category_ids?.[0]);
                return category ? getTranslatedCategoryName(category) : '';
              })(),
              currency: settings?.currency_code || 'No Currency'
            }]
          }
        });
      }

      // Check wishlist status using shared hook data (no additional API call!)
      if (productData.product.id && wishlistData) {
        const isProductInWishlist = wishlistData.some(item => item.product_id === productData.product.id);
        setIsInWishlist(isProductInWishlist);
      }
    }
  }, [productData, categories, settings, wishlistData]);

  // Check if we're in draft preview mode (AI Workspace preview)
  const isPreviewDraftMode = searchParams.get('preview') === 'draft' || searchParams.get('workspace') === 'true';

  // Load product layout configuration directly
  useEffect(() => {
    const loadProductLayoutConfig = async () => {
      if (!store?.id) {
        return;
      }

      try {
        // Load draft or published configuration based on preview mode
        const response = isPreviewDraftMode
          ? await slotConfigurationService.getDraftConfiguration(store.id, 'product')
          : await slotConfigurationService.getPublishedConfiguration(store.id, 'product');
        // Check for various "no published config" scenarios
        if (response.success && response.data &&
            response.data.configuration &&
            response.data.configuration.slots &&
            Object.keys(response.data.configuration.slots).length > 0) {

          const publishedConfig = response.data;

          // Deep merge published config with default config
          // This preserves default slot properties (type, content, className, etc.)
          // while only overriding specific properties from the database (position, styles, parentId)
          const mergedSlots = {};

          // Start with all default slots
          Object.keys(productConfig.slots).forEach(slotId => {
            mergedSlots[slotId] = { ...productConfig.slots[slotId] };
          });

          // Deep merge published customizations
          if (publishedConfig.configuration?.slots) {
            Object.keys(publishedConfig.configuration.slots).forEach(slotId => {
              const publishedSlot = publishedConfig.configuration.slots[slotId];
              if (mergedSlots[slotId]) {
                // Deep merge: preserve defaults, override with published
                mergedSlots[slotId] = {
                  ...mergedSlots[slotId],
                  ...publishedSlot,
                  // Deep merge nested objects
                  styles: {
                    ...(mergedSlots[slotId].styles || {}),
                    ...(publishedSlot.styles || {})
                  },
                  position: {
                    ...(mergedSlots[slotId].position || {}),
                    ...(publishedSlot.position || {})
                  }
                };
              } else {
                // New slot from published config (not in defaults)
                mergedSlots[slotId] = publishedSlot;
              }
            });
          }

          const mergedConfig = {
            ...publishedConfig.configuration,
            slots: mergedSlots
          };

          setProductLayoutConfig(mergedConfig);
          setConfigLoaded(true);

        } else {
          // Fallback to product-config.js
          const fallbackConfig = {
            slots: { ...productConfig.slots },
            metadata: {
              ...productConfig.metadata,
              fallbackUsed: true,
              fallbackReason: `No valid published configuration`
            }
          };

          setProductLayoutConfig(fallbackConfig);
          setConfigLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load product layout config:', error);

        // Final fallback to default config
        const fallbackConfig = {
          slots: { ...productConfig.slots },
          metadata: {
            ...productConfig.metadata,
            fallbackUsed: true,
            fallbackReason: `Error loading configuration: ${error.message}`
          }
        };

        setProductLayoutConfig(fallbackConfig);
        setConfigLoaded(true);
      }
    };

    if (!storeLoading) {
      loadProductLayoutConfig();
    }
  }, [store?.id, storeLoading, isPreviewDraftMode]);

  // Apply A/B test overrides to loaded config
  useEffect(() => {
    if (!productLayoutConfig || !configLoaded || abTestsLoading) {
      return;
    }

    if (!activeTests || activeTests.length === 0) {
      return;
    }

    // Clone the config to avoid mutations
    const configWithTests = JSON.parse(JSON.stringify(productLayoutConfig));

    // Apply each test's overrides
    activeTests.forEach((test, index) => {
      // Check different possible locations for variant config
      const variantConfig = test.variant_config || test.config;

      if (variantConfig?.slot_overrides) {
        const overrides = variantConfig.slot_overrides;

        // Apply each slot override
        Object.entries(overrides).forEach(([slotId, override]) => {
          if (configWithTests.slots[slotId]) {
            // Slot exists, merge the override
            configWithTests.slots[slotId] = {
              ...configWithTests.slots[slotId],
              ...override
            };
          } else {
            // Slot doesn't exist, create it if enabled
            if (override.enabled !== false) {
              configWithTests.slots[slotId] = override;
            }
          }
        });
      }
    });

    // Update the config with A/B test overrides applied
    setProductLayoutConfig(configWithTests);

  }, [activeTests, configLoaded, abTestsLoading]);

  /**
   * Evaluate which labels apply to the product based on their conditions
   * @deprecated
   */
  const evaluateProductLabels = (product, labels) => {
    if (!labels || !Array.isArray(labels) || !product) {
      return [];
    }

    // Extract key attributes for logging
    const manufacturerAttr = product.attributes?.find(attr => attr.code === 'manufacturer');
    const brandAttr = product.attributes?.find(attr => attr.code === 'brand');

    const applicableLabels = [];

    for (const label of labels) {

      if (!label.is_active) {
        continue;
      }

      let conditions;
      try {
        conditions = typeof label.conditions === 'string'
          ? JSON.parse(label.conditions)
          : label.conditions;
      } catch (e) {
        console.error('Failed to parse label conditions:', e);
        continue;
      }

      let shouldApply = true;


      // Check attribute conditions
      if (conditions?.attribute_conditions?.length > 0) {
        for (const condition of conditions.attribute_conditions) {
          // Check both direct product properties and nested attributes
          let productValue = product[condition.attribute_code];

          // If not found directly, check in product.attributes
          if (productValue === undefined && product.attributes) {
            // Handle both array and object structures for attributes
            if (Array.isArray(product.attributes)) {
              // Attributes stored as array - find by code or attribute_code
              const attrObj = product.attributes.find(
                attr => attr.code === condition.attribute_code || attr.attribute_code === condition.attribute_code
              );

              if (attrObj) {
                // Handle different attribute structures
                productValue = attrObj.value || attrObj.label || attrObj;
              }
            } else {
              // Attributes stored as object - direct property access
              productValue = product.attributes[condition.attribute_code];

              // Handle attributes that are objects with value/label structure
              if (productValue && typeof productValue === 'object' && productValue.value) {
                productValue = productValue.value;
              }
            }
          }

          if (productValue !== condition.attribute_value) {
            shouldApply = false;
            break;
          }
        }
      }

      // Check price conditions
      if (conditions?.price_conditions && Object.keys(conditions.price_conditions).length > 0) {
        const priceConditions = conditions.price_conditions;

        // Check if product has sale price
        if (priceConditions.has_sale_price === true && !product.compare_price) {
          shouldApply = false;
        }

        // Check if product is new
        if (priceConditions.is_new === true && priceConditions.days_since_created) {
          const productDate = new Date(product.created_at);
          const daysSinceCreated = Math.floor((Date.now() - productDate) / (1000 * 60 * 60 * 24));
          if (daysSinceCreated > priceConditions.days_since_created) {
            shouldApply = false;
          }
        }
      }

      if (shouldApply) {
        applicableLabels.push(label);
      }
    }

    // Sort by priority if specified
    applicableLabels.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return applicableLabels;
  };

  // loadProductData function removed - now using React Query useProduct hook
  // which provides automatic caching, deduplication, and retry logic

  /**
   * @deprecated
   */
  const loadCustomOptions = async (product) => {
    if (!product || !store?.id) {
      return;
    }

    try {

      // Import the CustomOptionRule entity
      const { CustomOptionRule } = await import('@/api/entities');

      // Check if we're authenticated
      const apiClient = (await import('@/api/client')).default;
      const hasToken = apiClient.getToken();

      try {
        // Fetch active custom option rules for this store
        const rules = await CustomOptionRule.filter({
          store_id: store.id,
          is_active: true
        });

        // Find applicable rules for this product
        const applicableRules = rules.filter(rule => {
          let conditions;
        try {
          conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
        } catch (e) {
          console.error('Failed to parse conditions:', e);
          return false;
        }

        // Check SKU conditions
        if (conditions?.skus?.includes(product.sku)) {
          return true;
        }

        // Check category conditions
        if (conditions?.categories?.length > 0 && product.category_ids?.length > 0) {
          const hasMatch = conditions.categories.some(catId => product.category_ids.includes(catId));
          if (hasMatch) {
            return true;
          }
        }

        // Check attribute conditions
        if (conditions?.attribute_conditions?.length > 0) {
          for (const condition of conditions.attribute_conditions) {
            if (product[condition.attribute_code] === condition.attribute_value) {
              return true;
            }
          }
        }

        return false;
      });

      if (applicableRules.length > 0) {
        const rule = applicableRules[0];
        const currentLang = getCurrentLanguage();
        setCustomOptionsLabel(getTranslatedField(rule, 'display_label', currentLang) || 'Custom Options');

        // Parse optional_product_ids
        let productIds = [];
        try {
          productIds = typeof rule.optional_product_ids === 'string'
            ? JSON.parse(rule.optional_product_ids)
            : rule.optional_product_ids;
        } catch (e) {
          console.error('Failed to parse optional_product_ids:', e);
          productIds = [];
        }

        if (productIds && productIds.length > 0) {
          const currentLang = getCurrentLanguage();
          const optionProducts = [];
          for (const productId of productIds) {
            try {
              const products = await StorefrontProduct.filter({
                id: productId,
                status: 'active',
                lang: currentLang
              });
              if (products && products.length > 0) {
                const customOptionProduct = products[0];

                // Only include if it's marked as a custom option
                if (!customOptionProduct.is_custom_option) {
                  continue;
                }

                // IMPORTANT: Check stock availability - only show if in stock
                // Only check products.stock_quantity and products.infinite_stock
                const trackStock = settings?.track_stock !== false; // Default to true
                const isInStock = trackStock
                  ? (customOptionProduct.infinite_stock === true || customOptionProduct.stock_quantity > 0)
                  : true; // If not tracking stock, always show

                // Only add to optionProducts if in stock
                if (isInStock) {
                  // Enrich with price display properties for the template
                  const priceInfo = getPriceDisplay(customOptionProduct);
                  const enrichedProduct = {
                    ...customOptionProduct,
                    displayPrice: formatPrice(priceInfo.displayPrice),
                    hasSpecialPrice: priceInfo.hasComparePrice,
                    originalPrice: priceInfo.hasComparePrice ? formatPrice(priceInfo.originalPrice) : null,
                    isSelected: false // Default to not selected
                  };
                  optionProducts.push(enrichedProduct);
                }
              }
            } catch (err) {
              console.error(`Failed to load option product ${productId}:`, err);
            }
          }
          setCustomOptions(optionProducts);
        }
      }
      } catch (apiError) {
        console.error('Error with CustomOptionRule API calls:', apiError);
        setCustomOptions([]);
      }
    } catch (error) {
      console.error('Error loading custom options:', error);
      setCustomOptions([]);
    }
  };

  /**
   *
   * @deprecated
   */
  const loadProductTabs = async () => {
    if (!store?.id) return;
    try {
      // Include language in cache key to ensure proper translation switching
      const tabs = await cachedApiCall(
        `product-tabs-${store.id}-${currentLanguage}`,
        () => StorefrontProductTab.filter({ store_id: store.id, is_active: true })
      );
      setProductTabs(tabs || []);
    } catch (error) {
      console.error('❌ ProductDetail: Error loading product tabs:', error);
      setProductTabs([]);
    }
  };

  // checkWishlistStatus removed - now using shared useWishlist() hook
  // This eliminates duplicate API calls (was called 2x per page load)

  const getTotalPrice = () => {
    if (!product) return 0;

    // For configurable products, use the selected variant's price
    // For simple products or when no variant is selected, use the base product price
    const productForPrice = displayProduct || product;

    // Get the correct base price using utility function
    const priceInfo = getPriceDisplay(productForPrice);
    const basePrice = priceInfo.displayPrice;

    // Add selected options price
    const optionsPrice = selectedOptions.reduce((sum, option) => sum + safeNumber(option.price), 0);

    // Calculate tax-inclusive price if needed
    const unitPrice = basePrice + optionsPrice;
    const displayUnitPrice = calculateDisplayPrice(unitPrice);

    return displayUnitPrice * quantity;
  };

  const handleAddToCart = async () => {
    if (!product) return;

    // For configurable products, ensure a variant is selected
    if (product.type === 'configurable' && !selectedVariant) {
      setFlashMessage({
        type: 'error',
        message: 'Please select product options before adding to cart.'
      });
      return;
    }

    try {
      // Validate store context
      if (!store?.id) {
        console.error('ProductDetail: No store context available');
        setFlashMessage({
          type: 'error',
          message: 'Store information not available. Please refresh the page.'
        });
        return;
      }

      // For configurable products, use the selected variant
      const productToAdd = displayProduct || product;

      // Get the correct base price using utility function
      const priceInfo = getPriceDisplay(productToAdd);
      const basePrice = priceInfo.displayPrice;

      const result = await cartService.addItem(
        productToAdd.id,
        quantity,
        basePrice,
        selectedOptions,
        store.id
      );

      if (result.success) {
        // Track add to cart with enhanced analytics
        if (typeof window !== 'undefined' && window.daino?.trackAddToCart) {
          window.daino.trackAddToCart(product, quantity);
        }

        // Send Google Analytics 'add_to_cart' event
        if (window.dataLayer) {
          window.dataLayer.push({
            event: 'add_to_cart',
            ecommerce: {
              items: [{
                item_id: product.id,
                item_name: getProductName(product, getCurrentLanguage()) || product.name,
                price: safeNumber(basePrice),
                quantity: quantity,
                item_brand: product.brand,
                item_category: (() => {
                  const category = categories.find(cat => cat.id === product.category_ids?.[0]);
                  return category ? getTranslatedCategoryName(category) : '';
                })(),
                currency: settings?.currency_code || 'No Currency'
              }]
            }
          });
        }

        const translatedProductName = getProductName(product, currentLanguage) || product.name;
        setFlashMessage({
          type: 'success',
          message: `${translatedProductName} ${t('common.added_to_cart', ' added to cart successfully!')}`
        });
      } else {
        setFlashMessage({
          type: 'error',
          message: result.error || 'Failed to add product to cart. Please try again.'
        });
      }

    } catch (error) {
      console.error('Failed to add to cart:', error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to add product to cart. Please try again.'
      });
    }
  };

  const handleWishlistToggle = async () => {
    if (!product || !store?.id) return;

    try {
      if (isInWishlist) {
        await CustomerWishlist.removeItem(product.id, store.id);
        setIsInWishlist(false);
        setFlashMessage({
          type: 'success',
          message: 'Product removed from wishlist'
        });
      } else {
        try {
          await CustomerWishlist.addItem(product.id, store.id);
          setIsInWishlist(true);
          setFlashMessage({
            type: 'success',
            message: 'Product added to wishlist'
          });
        } catch (addError) {
          // Handle "Item already in wishlist" as a success case
          if (addError.message?.includes('already in wishlist')) {
            setIsInWishlist(true);
            setFlashMessage({
              type: 'success',
              message: 'Product is already in your wishlist'
            });
          } else {
            throw addError; // Re-throw other errors
          }
        }
      }

      window.dispatchEvent(new CustomEvent('wishlistUpdated'));
      
      // Add a small delay to ensure backend persistence completes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Wishlist hook will automatically update via React Query invalidation
      // No need to manually check - useWishlist will refetch automatically
      // when CustomerWishlist.addItem() or removeItem() is called

    } catch (error) {
      console.error("Error toggling wishlist:", error);
      setFlashMessage({
        type: 'error',
        message: 'Failed to update wishlist. Please try again.'
      });
    }
  };

  // useCallback is used to memoize handleOptionChange, preventing unnecessary re-renders in CustomOptions
  const handleOptionChange = useCallback((newSelectedOptions) => {
    setSelectedOptions(newSelectedOptions);
  }, []); // Empty dependency array ensures this function is stable

  // Combined loading state from both store and product
  const loading = storeLoading || productLoading;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Only show 404 if we have definitively failed (not loading and either error or no product)
  if (!loading && !storeLoading && (productError || (!product && productData === undefined))) {
    // Trigger 404 page display
    showNotFound(`Product "${slug}" not found`);
    return null;
  }

  // Don't render anything if we don't have product data yet
  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Determine stock status based on product and store settings
  // For configurable products, use the selected variant's stock
  const productForStock = displayProduct || product;
  const trackStock = settings?.track_stock !== false; // Default to true if not explicitly false
  const isInStock = trackStock ? (productForStock?.infinite_stock || productForStock?.stock_quantity > 0) : true;
  const canAddToCart = !productLoading && isInStock && quantity > 0 && (!trackStock || productForStock?.infinite_stock || productForStock?.stock_quantity >= quantity);

  // For configurable products without a selected variant, prevent adding to cart
  const canAddToCartFinal = product?.type === 'configurable' && !selectedVariant ? false : canAddToCart;


  return (
    <div>
      {flashMessage && (
        <div className="mb-6 max-w-6xl mx-auto px-4">
          <FlashMessage message={flashMessage} onClose={() => setFlashMessage(null)} />
        </div>
      )}

      <SeoHeadManager
        pageType="product"
        pageData={{
          ...product,
          breadcrumbs: buildProductBreadcrumbs(product, storeCode, categories, settings)
        }}
        pageTitle={product?.name}
      />

      {/* Check if we should use slot configuration or fallback to traditional layout */}
      {(() => {
        // Determine if we should render with slots
        const hasConfig = productLayoutConfig && configLoaded;
        const hasSlots = hasConfig && productLayoutConfig.slots && Object.keys(productLayoutConfig.slots).length > 0;
        const slotCount = hasSlots ? Object.keys(productLayoutConfig.slots).length : 0;

        const shouldRender = true; // Force slot system usage


        return shouldRender;
      })() ? (
        <div className="grid grid-cols-12 gap-2 auto-rows-min">
          <UnifiedSlotRenderer
            slots={productLayoutConfig?.slots || productConfig.slots}
            parentId={null}
            viewMode="default"
            context="storefront"
            productData={{
              product: product ? (() => {
                // Calculate the final name to use
                const translatedName = getProductName(product, getCurrentLanguage());
                const attributeName = product.attributes?.name;
                const directName = product.name;
                const finalName = translatedName || attributeName || directName;

                // Create a modified product with the correct name and stock status
                return {
                  ...product,
                  name: finalName,
                  in_stock: !isProductOutOfStock(product)
                };
              })() : (displayProduct || product),
              baseProduct: product, // Keep reference to parent for configurable products
              productTabs,
              customOptions: customOptions,
              relatedProducts: [], // TODO: Load related products
              store,
              settings,
              categories, // CRITICAL: Pass categories for breadcrumb building
              breadcrumbs: buildProductBreadcrumbs(product, storeCode, categories, settings),
              productLabels: product?.applicableLabels || productLabels,
              selectedOptions,
              quantity,
              totalPrice: getTotalPrice(), // Pass calculated total price
              activeImageIndex: activeImage,
              activeTab,
              isInWishlist,
              // currencySymbol removed - now handled by priceUtils context
              canAddToCart: canAddToCartFinal,
              setQuantity,
              setSelectedOptions,
              setActiveImageIndex: setActiveImage,
              setActiveTab,
              setIsInWishlist,
              handleAddToCart: handleAddToCart,
              handleWishlistToggle: handleWishlistToggle,
              handleOptionChange: handleOptionChange,
              customOptionsLabel: customOptionsLabel,
              // Configurable product support
              selectedVariant,
              handleVariantChange,
              ConfigurableProductSelector, // Pass the component itself
              // Translations for stock labels
              translations
            }}
          />
        </div>
      ) : null
      }

    </div>
  );
}
