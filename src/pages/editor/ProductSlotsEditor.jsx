/**
 * ProductSlotsEditor - Uses real product data from store
 * - Fetches actual product from the store's catalog
 * - Passes productData in SAME format as storefront ProductDetail.jsx
 * - Falls back to mock data if no products available
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
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
  const { selectedStore } = useStoreSelection();
  const [realProduct, setRealProduct] = useState(null);
  const [productTabs, setProductTabs] = useState([]);
  const [customOptions, setCustomOptions] = useState([]);
  const [productLabels, setProductLabels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch a real product from the store
  useEffect(() => {
    const fetchRealProduct = async () => {
      if (!selectedStore?.id) {
        setLoading(false);
        return;
      }

      try {
        // Fetch products from store - get first active product
        const response = await fetch(
          `/api/public/products?store_id=${selectedStore.id}&status=active&limit=1`
        );

        if (!response.ok) {
          console.warn('Failed to fetch products, using mock data');
          setLoading(false);
          return;
        }

        const data = await response.json();
        const products = data.data || data.products || [];

        if (products.length > 0) {
          const product = products[0];

          // Fetch full product details including tabs, options, labels
          try {
            const fullResponse = await fetch(
              `/api/public/products/by-slug/${encodeURIComponent(product.slug)}/full?store_id=${selectedStore.id}`
            );

            if (fullResponse.ok) {
              const fullData = await fullResponse.json();
              const productData = fullData.data || fullData;

              console.log('[ProductSlotsEditor] 📦 Full product API response:', {
                hasProduct: !!productData.product,
                productName: productData.product?.name,
                imagesFromAPI: productData.product?.images,
                imagesCount: productData.product?.images?.length || 0
              });

              setRealProduct(productData.product || product);
              setProductTabs(productData.productTabs || []);
              setCustomOptions(productData.customOptions || []);
              setProductLabels(productData.productLabels || []);
            } else {
              // Use basic product if full fetch fails
              setRealProduct(product);
            }
          } catch (fullError) {
            console.warn('Failed to fetch full product details:', fullError);
            setRealProduct(product);
          }
        }
      } catch (error) {
        console.error('Error fetching product for editor:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRealProduct();
  }, [selectedStore?.id]);

  // Debug: Log product data and images
  console.log('[ProductSlotsEditor] 🖼️ Product Debug:', {
    storeId: selectedStore?.id,
    hasRealProduct: !!realProduct,
    productName: realProduct?.name,
    productId: realProduct?.id,
    imagesCount: realProduct?.images?.length || 0,
    images: realProduct?.images,
    imageUrls: realProduct?.images?.map(img => typeof img === 'string' ? img : img?.url),
    loading
  });

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
    cmsBlockPositions: ['product_above', 'product_below']
  }), [generateProductContext]);

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
