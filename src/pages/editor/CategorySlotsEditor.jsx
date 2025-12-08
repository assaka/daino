/**
 * CategorySlotsEditor - Refactored to use UnifiedSlotsEditor
 * - Consistent with other slot editors
 * - AI enhancement ready
 * - Maintainable structure
 * - Uses real category/product data from database
 */

import { useEffect, useState, useMemo } from "react";
import { Grid, List } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { generateMockCategoryContext } from '@/utils/mockCategoryData';
import { useStore } from '@/components/storefront/StoreProvider';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { useCategory, useCategories } from '@/hooks/useApiQueries';
import ProductItemCard from '@/components/storefront/ProductItemCard';
import CmsBlockRenderer from '@/components/storefront/CmsBlockRenderer';
// Import component registry to render components consistently with storefront
import { ComponentRegistry } from '@/components/editor/slot/SlotComponentRegistry';
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

// Custom slot renderer for category-specific components
const categoryCustomSlotRenderer = (slot, context) => {
  const storeSettings = context?.storeSettings || {};
  const filterableAttributes = context?.filterableAttributes || [];
  const sampleCategoryContext = context || generateMockCategoryContext(filterableAttributes, storeSettings);

  // Handle component slots (new pattern from category-config.js)
  if (slot.type === 'component') {
    const componentName = slot.component;

    // CategoryBreadcrumbs component - use component registry for consistency with storefront
    if (componentName === 'CategoryBreadcrumbs') {
      if (ComponentRegistry.has('CategoryBreadcrumbs')) {
        const registeredComponent = ComponentRegistry.get('CategoryBreadcrumbs');
        return registeredComponent.render({
          slot,
          categoryContext: sampleCategoryContext,
          variableContext: {},
          context: 'editor',
          className: slot.className,
          styles: slot.styles,
          allSlots: context?.layoutConfig?.slots
        });
      }
      // Fallback to old component if registry not available
      return undefined;
    }

    // BreadcrumbRenderer (legacy)
    if (componentName === 'BreadcrumbRenderer') {
      return (
        <div className={slot.className} style={slot.styles}>
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Home</span>
            <span>/</span>
            <span>Category</span>
            <span>/</span>
            <span className="font-medium text-gray-900">Current Page</span>
          </nav>
        </div>
      );
    }

    // ProductCountInfo component
    if (componentName === 'ProductCountInfo') {
      return (
        <div className={slot.className} style={slot.styles}>
          <div className="text-sm text-blue-600 font-bold">
            Hamid 1-{sampleCategoryContext?.products?.length || 12} of {sampleCategoryContext?.products?.length || 12} products
          </div>
        </div>
      );
    }

    // ProductItemsGrid component - let ComponentRegistry handle it
    // The registered ProductItemsGrid component in CategorySlotComponents.jsx
    // will create individual slot containers for each product
    if (componentName === 'ProductItemsGrid') {
      return undefined; // Pass through to ComponentRegistry
    }

    // ActiveFilters component
    if (componentName === 'ActiveFilters') {
      return (
        <div className={slot.className} style={slot.styles}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Active Filters:</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
              Brand: Apple ×
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
              Price: $100-$500 ×
            </span>
          </div>
        </div>
      );
    }

    // LayeredNavigation component - now handled by ComponentRegistry
    // Removed hardcoded renderer to allow UnifiedSlotRenderer to use the actual component

    // SortSelector component
    if (componentName === 'SortSelector') {
      return (
        <div className={slot.className} style={slot.styles}>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 font-medium">Sort by:</label>
            <select className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white">
              <option>Position</option>
              <option>Name (A-Z)</option>
              <option>Name (Z-A)</option>
              <option>Price (Low to High)</option>
              <option>Price (High to Low)</option>
              <option>Newest First</option>
            </select>
          </div>
        </div>
      );
    }

    // PaginationComponent
    if (componentName === 'PaginationComponent') {
      return (
        <div className={slot.className} style={slot.styles}>
          <div className="flex justify-center mt-8">
            <nav className="flex items-center gap-1">
              <button className="px-3 py-2 border rounded hover:bg-gray-50">Previous</button>
              <button className="px-3 py-2 border rounded bg-blue-600 text-white">1</button>
              <button className="px-3 py-2 border rounded hover:bg-gray-50">2</button>
              <button className="px-3 py-2 border rounded hover:bg-gray-50">3</button>
              <button className="px-3 py-2 border rounded hover:bg-gray-50">Next</button>
            </nav>
          </div>
        </div>
      );
    }

    // CmsBlockRenderer is handled by UnifiedSlotRenderer, but add fallback
    if (componentName === 'CmsBlockRenderer') {
      const position = slot.metadata?.cmsPosition || slot.id || 'default';
      return (
        <div className={slot.className} style={slot.styles}>
          <CmsBlockRenderer position={position} />
        </div>
      );
    }
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

  // Remove text slot handler - let UnifiedSlotRenderer handle it with proper variable processing

  if (slot.type === 'select') {
    return (
      <div className={slot.className} style={slot.styles}>
        <select className="border border-gray-300 rounded px-3 py-1 text-sm bg-white">
          <option>Sort option 1</option>
          <option>Sort option 2</option>
        </select>
      </div>
    );
  }

  if (slot.type === 'pagination') {
    return (
      <div className={slot.className} style={slot.styles}>
        <div className="flex items-center justify-center space-x-2">
          <button className="px-3 py-1 border rounded">Previous</button>
          <span className="px-3 py-1">1 of 10</span>
          <button className="px-3 py-1 border rounded">Next</button>
        </div>
      </div>
    );
  }

  if (slot.type === 'breadcrumbs') {
    return (
      <div className={slot.className} style={slot.styles}>
        <nav className="flex items-center space-x-2 text-sm text-gray-600">
          <span>Home</span>
          <span>/</span>
          <span>Category</span>
          <span>/</span>
          <span className="font-medium text-gray-900">Current Page</span>
        </nav>
      </div>
    );
  }

  if (slot.type === 'active_filters') {
    return (
      <div className={slot.className} style={slot.styles}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Active Filters:</span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
            Brand: Apple ×
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
            Price: $100-$500 ×
          </span>
        </div>
      </div>
    );
  }

  if (slot.type === 'layered_navigation') {
    return (
      <div className={slot.className} style={slot.styles}>
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Filter By</h3>
          <div>
            <h4 className="font-medium text-gray-700 mb-2">Price</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">Under $25</span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" />
                <span className="text-sm">$25 - $50</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle products_container explicitly
  if (slot.id === 'products_container') {
    // Find the product_items child slot and render it explicitly
    const productItemsSlot = Object.values(context?.layoutConfig?.slots || {}).find(s => s.id === 'product_items');

    if (productItemsSlot) {

      // Get microslot configurations from category config
      const microslotConfigs = {
        productAddToCart: context?.layoutConfig?.slots?.product_add_to_cart || {
          className: 'bg-blue-600 text-white border-0 hover:bg-blue-700 transition-colors duration-200 px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2',
          content: 'Add to Cart'
        },
        productImage: context?.layoutConfig?.slots?.product_image || {},
        productName: context?.layoutConfig?.slots?.product_name || {},
        productPrice: context?.layoutConfig?.slots?.product_price || {},
        productComparePrice: context?.layoutConfig?.slots?.product_compare_price || {}
      };

      // Merge slot content with metadata and microslot configs
      const contentWithConfig = {
        ...productItemsSlot.content,
        ...productItemsSlot.metadata,
        ...microslotConfigs,
        itemsToShow: productItemsSlot.metadata?.itemsToShow || 3,
        gridConfig: productItemsSlot.metadata?.gridConfig || { mobile: 1, tablet: 2, desktop: 3 }
      };

      return (
        <div className="products-container-wrapper">
          <CategoryProductItemCardSlot
            categoryContext={sampleCategoryContext}
            content={contentWithConfig}
            config={{ viewMode: context?.viewMode }}
          />
        </div>
      );
    }
    return null;
  }

  // Don't handle product_items - let ComponentRegistry ProductItemsGrid handle it
  // This ensures storefront and editor use the same rendering logic
  if (slot.id === 'product_items') {
    return undefined; // Let ComponentRegistry handle it
  }

  // Handle individual product_item_card if needed (fallback for individual card rendering)
  if (slot.id === 'product_item_card') {

    // For individual card rendering, just render a single sample card
    const sampleProduct = sampleCategoryContext?.products?.[0];
    if (!sampleProduct) return null;

    return (
      <ProductItemCard
        key={sampleProduct.id}
        product={sampleProduct}
        settings={{
          currency_symbol: '123',
          theme: { add_to_cart_button_color: '#3B82F6' }
        }}
        store={{ slug: 'demo-store', id: 1 }}
        taxes={[]}
        selectedCountry="US"
        productLabels={sampleCategoryContext?.productLabels || []}
        viewMode={context?.viewMode}
        slotConfig={slot}
        onAddToCartStateChange={() => {}}
      />
    );
  }

  const componentMap = {
    // Headers
    'category_title': CategoryHeaderSlot,
    'category_header': CategoryHeaderSlot,
    'category_description': CategoryHeaderSlot,

    // Filters and navigation
    'filters_container': CategoryFiltersSlot,
    'layered_navigation': CategoryLayeredNavigationSlot,
    'active_filters': CategoryActiveFiltersSlot,

    // Products
    'products_container': CategoryProductsSlot,
    'products_grid': CategoryProductsSlot,
    'product_items': CategoryProductItemsSlot,
    'product_item_card': CategoryProductItemCardSlot,
    'product_template': CategoryProductItemCardSlot,

    // Sorting and controls
    'sorting_controls': CategorySortingSlot,
    'product_count_info': CategorySortingSlot,
    'sort_selector': CategorySortingSlot,

    // Pagination
    'pagination_controls': CategoryPaginationSlot,
    'pagination_container': CategoryPaginationSlot
  };

  const SlotComponent = componentMap[slot.id];

  if (SlotComponent) {
    return (
      <SlotComponent
        categoryData={sampleCategoryContext}
        categoryContext={sampleCategoryContext}
        content={slot.content}
        className={slot.className}
        styles={slot.styles}
        config={{ viewMode: context?.viewMode }}
        allSlots={context?.layoutConfig?.slots}
        mode={context?.mode}
        onElementClick={context?.onElementClick}
      />
    );
  }

  return null;
};

// Note: Category editor config is now created inline in CategorySlotsEditor
// to support real category/product data fetching

const CategorySlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'grid'
}) => {
  // Get store context for settings and filterableAttributes
  // Handle null case when StoreProvider is not available in editor context
  const storeContext = useStore();
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const storeSettings = storeContext?.settings || selectedStore?.settings || null;
  const filterableAttributes = storeContext?.filterableAttributes || selectedStore?.filterableAttributes || [];
  const storeId = getSelectedStoreId();

  // Fetch categories directly since StoreProvider is skipped for editor pages
  const { data: fetchedCategories = [] } = useCategories(storeId, { enabled: !!storeId });
  const categories = storeContext?.categories?.length > 0 ? storeContext.categories : fetchedCategories;

  // State for selected category (for previewing different categories)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState(null);

  // Auto-select first category when categories load
  useEffect(() => {
    if (categories.length > 0 && !selectedCategorySlug) {
      // Find first category with products, or just use first category
      const firstCategory = categories[0];
      if (firstCategory?.slug) {
        setSelectedCategorySlug(firstCategory.slug);
      }
    }
  }, [categories, selectedCategorySlug]);

  // Fetch real category data with products
  const { data: realCategoryData, isLoading: categoryLoading } = useCategory(
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
  const categoryContext = useMemo(() => {
    // If we have real data, use it
    if (realCategoryData?.category && realCategoryData?.products?.length > 0) {
      const products = realCategoryData.products;
      const filters = buildFilters(products, filterableAttributes);

      return {
        category: realCategoryData.category,
        products: products,
        allProducts: products,
        filters: filters,
        filterableAttributes: filterableAttributes,
        pagination: {
          start: 1,
          end: products.length,
          total: products.length,
          currentPage: 1,
          totalPages: 1,
          perPage: 12,
          hasPrev: false,
          hasNext: false
        },
        sortOption: 'default',
        currentPage: 1,
        totalPages: 1,
        subcategories: realCategoryData.subcategories || [],
        breadcrumbs: [
          { name: 'Home', url: '/' },
          { name: realCategoryData.category.name, url: `/${realCategoryData.category.slug}` }
        ],
        selectedFilters: {},
        settings: storeSettings || {},
        store: storeContext?.store || selectedStore || { id: storeId, name: 'Store' },
        productLabels: storeContext?.productLabels || []
      };
    }

    // Fall back to mock data
    console.log('[CategorySlotsEditor] Using mock data - no real category data available');
    return generateMockCategoryContext(filterableAttributes, storeSettings);
  }, [realCategoryData, filterableAttributes, storeSettings, storeContext, selectedStore, storeId]);

  // Debug logging
  console.log('[CategorySlotsEditor] State:', {
    storeId,
    selectedCategorySlug,
    categoryLoading,
    hasRealData: !!realCategoryData?.category,
    productCount: realCategoryData?.products?.length || 0,
    categoriesCount: categories?.length || 0,
    filtersBuilt: Object.keys(categoryContext?.filters || {})
  });

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