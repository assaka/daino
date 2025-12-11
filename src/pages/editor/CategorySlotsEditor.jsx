/**
 * CategorySlotsEditor - Refactored to use UnifiedSlotsEditor
 * - Consistent with other slot editors
 * - AI enhancement ready
 * - Maintainable structure
 * - Uses real category/product data from database
 */

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Grid, List } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { generateMockCategoryContext } from '@/utils/mockCategoryData';
import { useStore } from '@/components/storefront/StoreProvider';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { useCategory, useCategories, useFilterableAttributes } from '@/hooks/useApiQueries';
import CmsBlockRenderer from '@/components/storefront/CmsBlockRenderer';
// Use same preprocessing as storefront for consistent rendering
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';
import { formatPrice } from '@/utils/priceUtils';
// Import slot components to register them with ComponentRegistry (side effect imports)
import '@/components/editor/slot/CategorySlotComponents';
import '@/components/editor/slot/BreadcrumbsSlotComponent';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/category');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid category config from API');
      return null;
    }
    return {
      page_name: result.data.page_name || 'Category',
      slot_type: result.data.slot_type || 'category_layout',
      slots: result.data.slots,
      metadata: {
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        version: '1.0',
        pageType: 'category'
      },
      cmsBlocks: result.data.cmsBlocks || []
    };
  } catch (error) {
    console.error('Failed to load category config:', error);
    return null;
  }
};

// Helper function to generate grid classes from store settings
const getGridClasses = (storeSettings) => {
  const gridConfig = storeSettings?.product_grid;

  if (!gridConfig) {
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';
  }

  const breakpoints = gridConfig.breakpoints || {};
  const customBreakpoints = gridConfig.customBreakpoints || [];
  let classes = [];

  // Standard breakpoints
  Object.entries(breakpoints).forEach(([breakpoint, columns]) => {
    if (columns > 0) {
      if (breakpoint === 'default') {
        if (columns === 1) classes.push('grid-cols-1');
        else if (columns === 2) classes.push('grid-cols-2');
      } else {
        if (columns === 1) classes.push(`${breakpoint}:grid-cols-1`);
        else if (columns === 2) classes.push(`${breakpoint}:grid-cols-2`);
        else if (columns === 3) classes.push(`${breakpoint}:grid-cols-3`);
        else if (columns === 4) classes.push(`${breakpoint}:grid-cols-4`);
        else if (columns === 5) classes.push(`${breakpoint}:grid-cols-5`);
        else if (columns === 6) classes.push(`${breakpoint}:grid-cols-6`);
      }
    }
  });

  // Custom breakpoints
  customBreakpoints.forEach(({ name, columns }) => {
    if (name && columns > 0) {
      if (columns === 1) classes.push(`${name}:grid-cols-1`);
      else if (columns === 2) classes.push(`${name}:grid-cols-2`);
      else if (columns === 3) classes.push(`${name}:grid-cols-3`);
      else if (columns === 4) classes.push(`${name}:grid-cols-4`);
      else if (columns === 5) classes.push(`${name}:grid-cols-5`);
      else if (columns === 6) classes.push(`${name}:grid-cols-6`);
    }
  });

  return classes.length > 0 ? classes.join(' ') : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';
};

// Custom slot renderer - minimal overrides, let ComponentRegistry handle most components
// This ensures editor renders exactly the same as storefront
const categoryCustomSlotRenderer = (slot, context) => {
  // Only handle CMS blocks - everything else should go through ComponentRegistry
  // to ensure consistent rendering with storefront

  // Handle CMS block component slots
  if (slot.type === 'component' && slot.component === 'CmsBlockRenderer') {
    const position = slot.metadata?.cmsPosition || slot.id || 'default';
    return (
      <div className={slot.className} style={slot.styles}>
        <CmsBlockRenderer position={position} />
      </div>
    );
  }

  // Handle CMS block slots (legacy pattern)
  if (slot.type === 'cms_block') {
    const position = slot.metadata?.cmsPosition || slot.id || 'default';
    return (
      <div className={slot.className} style={slot.styles}>
        <CmsBlockRenderer position={position} />
      </div>
    );
  }

  // Return undefined for all other slots - let UnifiedSlotRenderer and ComponentRegistry handle them
  // This ensures the editor uses the exact same rendering logic as the storefront
  return undefined;
};

// Note: Category editor config is now created inline in CategorySlotsEditor
// to support real category/product data fetching

const CategorySlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'grid'
}) => {
  // Get initial category from URL params (e.g., ?category=electronics)
  const [searchParams] = useSearchParams();
  const initialCategorySlug = searchParams.get('category');

  // Get store context for settings and filterableAttributes
  // Handle null case when StoreProvider is not available in editor context
  const storeContext = useStore();
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const storeSettings = storeContext?.settings || selectedStore?.settings || null;
  const storeId = getSelectedStoreId();

  // Fetch categories and filterable attributes directly since StoreProvider is skipped for editor pages
  const { data: fetchedCategories = [] } = useCategories(storeId, { enabled: !!storeId });
  const { data: fetchedFilterableAttributes = [] } = useFilterableAttributes(storeId, { enabled: !!storeId });

  const categories = storeContext?.categories?.length > 0 ? storeContext.categories : fetchedCategories;
  const filterableAttributes = storeContext?.filterableAttributes?.length > 0
    ? storeContext.filterableAttributes
    : fetchedFilterableAttributes;

  // State for selected category (for previewing different categories)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(initialCategorySlug);

  // Set initial category from URL or auto-select first category when categories load
  useEffect(() => {
    if (categories.length > 0 && !selectedCategorySlug) {
      // Use URL param if provided, otherwise use first category
      if (initialCategorySlug) {
        const matchingCategory = categories.find(c => c.slug === initialCategorySlug);
        if (matchingCategory) {
          setSelectedCategorySlug(initialCategorySlug);
          return;
        }
      }
      // Fallback to first category
      const firstCategory = categories[0];
      if (firstCategory?.slug) {
        setSelectedCategorySlug(firstCategory.slug);
      }
    }
  }, [categories, selectedCategorySlug, initialCategorySlug]);

  // Fetch real category data with products
  const { data: realCategoryData, isLoading: categoryLoading, error: categoryError } = useCategory(
    selectedCategorySlug,
    storeId,
    { enabled: !!selectedCategorySlug && !!storeId }
  );


  // Listen for settings updates from admin panel
  useEffect(() => {
    try {
      const channel = new BroadcastChannel('store_settings_update');
      channel.onmessage = (event) => {
        if (event.data.type === 'clear_cache') {
          // Clear localStorage and reload
          localStorage.removeItem('storeProviderCache');
          setTimeout(() => window.location.reload(), 500);
        }
      };
      return () => channel.close();
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }, []);

  // Build filters from products and filterable attributes (same as storefront Category.jsx)
  const buildFilters = (products, filterableAttrs) => {
    const filters = {};

    if (!products || products.length === 0) return filters;

    // Build price filter
    const allPrices = products.map(p => {
      let price = parseFloat(p.price || 0);
      if (p.compare_price && parseFloat(p.compare_price) > 0) {
        price = Math.min(price, parseFloat(p.compare_price));
      }
      return price;
    }).filter(p => p > 0);

    const minPrice = allPrices.length > 0 ? Math.floor(Math.min(...allPrices)) : 0;
    const maxPrice = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices)) : 0;

    if (minPrice > 0 && maxPrice > 0 && minPrice !== maxPrice) {
      filters.price = {
        label: 'Price',
        min: minPrice,
        max: maxPrice,
        currentMin: minPrice,
        currentMax: maxPrice,
        selected: [minPrice, maxPrice],
        type: 'slider'
      };
    }

    // Build attribute filters
    if (filterableAttrs && filterableAttrs.length > 0) {
      filterableAttrs.forEach(attr => {
        const attrCode = attr.code || attr.attribute_name;
        const excludedAttributes = ['name', 'sku', 'description', 'image', 'price'];
        if (excludedAttributes.includes(attrCode)) return;

        // Count products per value
        const valueCounts = {};
        products.forEach(p => {
          const productAttributes = p.attributes || [];
          if (!Array.isArray(productAttributes)) return;

          const matchingAttr = productAttributes.find(pAttr => pAttr.code === attrCode);
          if (!matchingAttr || (!matchingAttr.rawValue && !matchingAttr.value)) return;

          const valueCode = String(matchingAttr.rawValue || matchingAttr.value);
          const valueLabel = matchingAttr.value || valueCode;
          if (valueCode) {
            if (!valueCounts[valueCode]) {
              valueCounts[valueCode] = { value: valueCode, label: valueLabel, count: 0 };
            }
            valueCounts[valueCode].count++;
          }
        });

        const options = Object.values(valueCounts).filter(opt => opt.count > 0);
        if (options.length > 0) {
          filters.attributes = filters.attributes || [];
          filters.attributes.push({
            code: attrCode,
            label: attr.label || attrCode,
            options: options.map(opt => ({
              value: opt.value,
              label: opt.label,
              count: opt.count,
              active: false,
              attributeCode: attrCode
            }))
          });
        }
      });
    }

    return filters;
  };

  // Build real category context from API data, falling back to mock data
  // Then preprocess using same logic as storefront for consistent rendering
  const categoryContext = useMemo(() => {
    const store = storeContext?.store || selectedStore || { id: storeId, name: 'Store' };
    const productLabels = storeContext?.productLabels || [];

    // If we have real category data, use it (even with 0 products)
    if (realCategoryData?.category) {
      const products = realCategoryData.products;
      const filters = buildFilters(products, filterableAttributes);
      const totalPages = Math.max(5, Math.ceil(products.length / 12)); // Show at least 5 pages for preview

      // Build raw data in same format as storefront Category.jsx
      const rawData = {
        category: realCategoryData.category,
        products: products,
        allProducts: products,
        filters: filters,
        filterableAttributes: filterableAttributes,
        breadcrumbs: [
          { name: 'Home', url: '/' },
          { name: realCategoryData.category.name, url: `/${realCategoryData.category.slug}` }
        ],
        selectedFilters: {},
        priceRange: {},
        categories: categories || [],
        currentPage: 2,
        totalPages: totalPages,
        itemsPerPage: 12,
        filteredProductsCount: products.length,
        // Editor handlers (no-op in editor mode)
        handleFilterChange: () => {},
        handleSortChange: () => {},
        handleSearchChange: () => {},
        handlePageChange: () => {},
        clearFilters: () => {},
        onProductClick: () => {},
        navigate: () => {},
        formatDisplayPrice: (product) => formatPrice(typeof product === 'object' ? product.price : product),
        getProductImageUrl: (product) => {
          const img = product?.images?.[0];
          if (!img) return '/placeholder-product.jpg';
          if (typeof img === 'string') return img;
          return img.url || '/placeholder-product.jpg';
        },
      };

      // Use same preprocessing as storefront for consistent rendering
      const preprocessed = preprocessSlotData('category', rawData, store, storeSettings || {}, {
        translations: {},
        productLabels: productLabels
      });

      // Add pagination info that preprocessSlotData expects
      return {
        ...preprocessed,
        pagination: {
          start: 1,
          end: Math.min(12, products.length),
          total: products.length,
          currentPage: 2,
          totalPages: totalPages,
          perPage: 12,
          hasPrev: true,
          hasNext: true
        },
        subcategories: realCategoryData.subcategories || [],
      };
    }

    // Fall back to mock data - also preprocess it
    console.log('[CategorySlotsEditor] Using mock data - no real category data available');
    const mockContext = generateMockCategoryContext(filterableAttributes, storeSettings);

    // Preprocess mock data too for consistency
    const rawMockData = {
      category: mockContext.category,
      products: mockContext.products || [],
      allProducts: mockContext.products || [],
      filters: mockContext.filters || {},
      filterableAttributes: filterableAttributes,
      breadcrumbs: mockContext.breadcrumbs || [],
      selectedFilters: {},
      priceRange: {},
      categories: categories || [],
      currentPage: 2,
      totalPages: 5,
      itemsPerPage: 12,
      filteredProductsCount: (mockContext.products || []).length,
      handleFilterChange: () => {},
      handleSortChange: () => {},
      handleSearchChange: () => {},
      handlePageChange: () => {},
      clearFilters: () => {},
      onProductClick: () => {},
      navigate: () => {},
      formatDisplayPrice: (product) => formatPrice(typeof product === 'object' ? product.price : product),
      getProductImageUrl: (product) => {
        const img = product?.images?.[0];
        if (!img) return '/placeholder-product.jpg';
        if (typeof img === 'string') return img;
        return img.url || '/placeholder-product.jpg';
      },
    };

    const preprocessed = preprocessSlotData('category', rawMockData, store, storeSettings || {}, {
      translations: {},
      productLabels: productLabels
    });

    return {
      ...preprocessed,
      pagination: {
        start: 1,
        end: 12,
        total: (mockContext.products || []).length,
        currentPage: 2,
        totalPages: 5,
        perPage: 12,
        hasPrev: true,
        hasNext: true
      },
      subcategories: [],
    };
  }, [realCategoryData, filterableAttributes, storeSettings, storeContext, selectedStore, storeId, categories]);


  // Create editor config with real data
  const categoryEditorConfig = useMemo(() => ({
    pageType: 'category',
    pageName: 'Category',
    slotType: 'category_layout',
    defaultViewMode: 'grid',
    viewModes: [
      { key: 'grid', label: 'Grid', icon: Grid },
      { key: 'list', label: 'List', icon: List }
    ],
    // Return the pre-built context with real data
    generateContext: () => categoryContext,
    createDefaultSlots,
    viewModeAdjustments: {
      filters_container: {
        colSpan: {
          shouldAdjust: (currentValue) => typeof currentValue === 'number',
          newValue: {
            grid: 'col-span-12 lg:col-span-3',
            list: 'col-span-12 lg:col-span-3'
          }
        }
      },
      products_container: {
        colSpan: {
          shouldAdjust: (currentValue) => typeof currentValue === 'number',
          newValue: {
            grid: 'col-span-12 lg:col-span-9',
            list: 'col-span-12 lg:col-span-9'
          }
        }
      }
    },
    customSlotRenderer: categoryCustomSlotRenderer,
    cmsBlockPositions: ['category_above_products', 'category_below_products'],
    // Extra: pass available categories for category selector
    availableCategories: categories,
    selectedCategorySlug,
    onCategoryChange: setSelectedCategorySlug,
    isLoadingCategoryData: categoryLoading
  }), [categoryContext, categories, selectedCategorySlug, categoryLoading]);

  // Create enhanced config with store settings and filterable attributes
  const enhancedConfig = {
    ...categoryEditorConfig,
    storeSettings,
    filterableAttributes
  };

  return (
    <UnifiedSlotsEditor
      config={enhancedConfig}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};


export default CategorySlotsEditor;