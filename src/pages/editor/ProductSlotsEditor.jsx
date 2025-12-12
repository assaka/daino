/**
 * ProductSlotsEditor - Uses real product data from store
 * - Fetches actual product from the store's catalog
 * - Passes productData in SAME format as storefront ProductDetail.jsx
 * - Falls back to mock data if no products available
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from "react-router-dom";
import { Package } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { useSlotConfiguration, useCategories } from '@/hooks/useApiQueries';
import { generateMockProductContext } from '@/utils/mockProductData';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/product');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid product config from API');
      return null;
    }
    return result.data.slots;
  } catch (error) {
    console.error('Failed to load product config:', error);
    return null;
  }
};

/**
 * ProductSlotsEditor Component - Fetches real product for preview
 */
export default function ProductSlotsEditor({
  mode = 'edit',
  onSave,
  viewMode = 'default'
}) {
  // Get initial product from URL params (e.g., ?product=my-product-slug)
  const [searchParams] = useSearchParams();
  const initialProductSlug = searchParams.get('product');

  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const storeId = getSelectedStoreId();

  // Fetch header and categories for combined header + page editing
  const { data: headerConfig, isLoading: headerLoading } = useSlotConfiguration(storeId, 'header', { enabled: !!storeId });
  const { data: categories = [] } = useCategories(storeId, { enabled: !!storeId });

  // Debug logging
  console.log('[ProductSlotsEditor] State:', {
    storeId,
    selectedStore: !!selectedStore,
    headerLoading,
    headerSlots: headerConfig?.slots ? Object.keys(headerConfig.slots).length : 0,
    selectedProductSlug
  });

  const [realProduct, setRealProduct] = useState(null);
  const [allProducts, setAllProducts] = useState([]);
  const [selectedProductSlug, setSelectedProductSlug] = useState(initialProductSlug);
  const [productTabs, setProductTabs] = useState([]);
  const [customOptions, setCustomOptions] = useState([]);
  const [productLabels, setProductLabels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all products for the selector
  useEffect(() => {
    const fetchAllProducts = async () => {
      if (!selectedStore?.id) return;

      try {
        const response = await fetch(
          `/api/public/products?store_id=${selectedStore.id}&status=active&limit=50`
        );
        if (response.ok) {
          const data = await response.json();
          const products = data.data || data.products || [];
          setAllProducts(products);

          // If no product selected yet, select the first one or the one from URL
          if (!selectedProductSlug && products.length > 0) {
            const slugToUse = initialProductSlug || products[0]?.slug;
            setSelectedProductSlug(slugToUse);
          }
        }
      } catch (error) {
        console.error('Error fetching products list:', error);
      }
    };

    fetchAllProducts();
  }, [selectedStore?.id, initialProductSlug]);

  // Fetch the selected product's full details
  useEffect(() => {
    const fetchSelectedProduct = async () => {
      if (!selectedStore?.id || !selectedProductSlug) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch full product details
        const fullResponse = await fetch(
          `/api/public/products/by-slug/${encodeURIComponent(selectedProductSlug)}/full?store_id=${selectedStore.id}`
        );

        if (fullResponse.ok) {
          const fullData = await fullResponse.json();
          const productData = fullData.data || fullData;

          setRealProduct(productData.product);
          setProductTabs(productData.productTabs || []);
          setCustomOptions(productData.customOptions || []);
          setProductLabels(productData.productLabels || []);
        } else {
          console.warn('Failed to fetch product details');
          setRealProduct(null);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        setRealProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSelectedProduct();
  }, [selectedStore?.id, selectedProductSlug]);

  // Generate context - MUST match storefront ProductDetail.jsx productData structure exactly
  const generateProductContext = useCallback((viewMode, store) => {
    const storeSettings = store?.settings || selectedStore?.settings || {};

    // If we have a real product, use it in the SAME format as storefront
    if (realProduct) {
      // Match storefront ProductDetail.jsx productData structure exactly
      return {
        product: {
          ...realProduct,
          images: realProduct.images || [],
          attributes: realProduct.attributes || {},
          in_stock: realProduct.stock_quantity > 0 || realProduct.infinite_stock
        },
        baseProduct: realProduct,
        productTabs: productTabs.length > 0 ? productTabs : [
          { id: 1, name: 'Description', tab_type: 'description', content: realProduct.description || '', is_active: true, sort_order: 1 },
          { id: 2, name: 'Specifications', tab_type: 'attributes', content: null, is_active: true, sort_order: 2 }
        ],
        customOptions,
        relatedProducts: [],
        store: store || selectedStore,
        settings: storeSettings,
        categories: [],
        breadcrumbs: [
          { name: 'Home', url: '/' },
          { name: realProduct.name || 'Product', url: null }
        ],
        productLabels: productLabels.map(label => ({
          ...label,
          text: label.text || label.name
        })),
        selectedOptions: [],
        quantity: 1,
        totalPrice: realProduct.price || 0,
        activeImageIndex: 0,
        activeTab: 0,
        isInWishlist: false,
        canAddToCart: realProduct.stock_quantity > 0 || realProduct.infinite_stock,
        // Editor-safe handler stubs (match storefront function signatures)
        setQuantity: () => {},
        setSelectedOptions: () => {},
        setActiveImageIndex: () => {},
        setActiveTab: () => {},
        setIsInWishlist: () => {},
        handleAddToCart: () => {},
        handleWishlistToggle: () => {},
        handleOptionChange: () => {},
        customOptionsLabel: 'Options',
        selectedVariant: null,
        handleVariantChange: () => {},
        translations: {}
      };
    }

    // Fall back to mock data - also in storefront productData format
    const mockContext = generateMockProductContext(storeSettings);
    return {
      product: {
        ...mockContext.product,
        in_stock: true
      },
      baseProduct: mockContext.product,
      productTabs: mockContext.productTabs || [],
      customOptions: mockContext.customOptions || [],
      relatedProducts: mockContext.relatedProducts || [],
      store: store || selectedStore,
      settings: storeSettings,
      categories: mockContext.categories || [],
      breadcrumbs: mockContext.breadcrumbs || [],
      productLabels: mockContext.productLabels || [],
      selectedOptions: [],
      quantity: 1,
      totalPrice: mockContext.product?.price || 0,
      activeImageIndex: 0,
      activeTab: 0,
      isInWishlist: false,
      canAddToCart: true,
      setQuantity: () => {},
      setSelectedOptions: () => {},
      setActiveImageIndex: () => {},
      setActiveTab: () => {},
      setIsInWishlist: () => {},
      handleAddToCart: () => {},
      handleWishlistToggle: () => {},
      handleOptionChange: () => {},
      customOptionsLabel: 'Options',
      selectedVariant: null,
      handleVariantChange: () => {},
      translations: {}
    };
  }, [realProduct, productTabs, customOptions, productLabels, selectedStore]);

  // Product Editor Configuration - memoized with generateProductContext dependency
  const productEditorConfig = useMemo(() => ({
    pageType: 'product',
    pageName: 'Product Detail',
    slotType: 'product_layout',
    defaultViewMode: 'default',
    viewModes: [
      {
        key: 'default',
        label: 'Default View',
        icon: Package
      }
    ],
    generateContext: generateProductContext,
    createDefaultSlots,
    cmsBlockPositions: ['product_above', 'product_below'],
    // Product selector for navbar
    availableProducts: allProducts,
    selectedProductSlug,
    onProductChange: setSelectedProductSlug,
    isLoadingProductData: loading,
    // Header integration - show header + page content together
    includeHeader: true,
    headerSlots: headerConfig?.slots || null,
    headerContext: {
      store: selectedStore,
      settings: selectedStore?.settings || {},
      categories: categories,
      languages: [],
      currentLanguage: 'en',
      mobileMenuOpen: false,
      mobileSearchOpen: false,
      setMobileMenuOpen: () => {},
      setMobileSearchOpen: () => {},
      navigate: () => {},
      location: { pathname: '/' }
    }
  }), [generateProductContext, allProducts, selectedProductSlug, loading, headerConfig, selectedStore, categories]);

  // Show loading state while fetching product
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading product...</span>
      </div>
    );
  }

  return (
    <UnifiedSlotsEditor
      config={productEditorConfig}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
}
