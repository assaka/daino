/**
 * ProductSlotsEditor - Uses real product data from store
 * - Fetches actual product from the store's catalog
 * - Uses preprocessSlotData for consistent rendering with storefront
 * - Falls back to mock data if no products available
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Package } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { generateMockProductContext } from '@/utils/mockProductData';
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';

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

  // Generate context - uses real product if available, falls back to mock
  const generateProductContext = useCallback((viewMode, store) => {
    const storeSettings = store?.settings || selectedStore?.settings || {};

    // If we have a real product, use it
    if (realProduct) {
      const productContext = {
        product: {
          ...realProduct,
          // Ensure required fields exist
          images: realProduct.images || [],
          attributes: realProduct.attributes || {},
          in_stock: realProduct.stock_quantity > 0 || realProduct.infinite_stock
        },
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

      return preprocessSlotData('product', productContext, store || selectedStore || {}, storeSettings, {
        translations: {},
        productLabels: productLabels
      });
    }

    // Fall back to mock data
    const mockContext = generateMockProductContext(storeSettings);
    return preprocessSlotData('product', mockContext, store || selectedStore || {}, storeSettings, {
      translations: {},
      productLabels: []
    });
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
