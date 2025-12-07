import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "react-router-dom";
import { createCategoryUrl, createProductUrl } from "@/utils/urlUtils";
import { buildCategoryBreadcrumbs } from "@/utils/breadcrumbUtils";
import { useNotFound } from "@/utils/notFoundUtils";
import { StorefrontProduct } from "@/api/storefront-entities";
import { useStore, cachedApiCall } from "@/components/storefront/StoreProvider";
import SeoHeadManager from "@/components/storefront/SeoHeadManager";
import { CategorySlotRenderer } from "@/components/storefront/CategorySlotRenderer";
import { usePagination, useSorting } from "@/hooks/useUrlUtils";
import { Card, CardContent } from "@/components/ui/card";
// Slot configurations are loaded from database via useSlotConfiguration hook
import { formatPrice } from '@/utils/priceUtils';
import { getCategoryName, getCurrentLanguage } from "@/utils/translationUtils";
import { useTranslation } from '@/contexts/TranslationContext';
// React Query hooks for optimized API calls
import { useCategory, useSlotConfiguration } from '@/hooks/useApiQueries';
import { PageLoader } from '@/components/ui/page-loader';

const ensureArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data === null || data === undefined) return [];
  return [];
};

export default function Category() {
  const { store, settings, loading: storeLoading, categories, filterableAttributes } = useStore();
  const { showNotFound } = useNotFound();
  const { t } = useTranslation();

  const { storeCode } = useParams();
  const location = useLocation();

  // Extract category path from URL
  // Platform domain: /public/storeCode/category/path/to/category (slice from index 4)
  // Custom domain: /category/path/to/category (slice from index 2)
  const isCustomDomain = !storeCode; // If no storeCode param, we're on a custom domain
  const pathParts = location.pathname.split('/');
  const categoryPath = isCustomDomain
    ? pathParts.slice(2).join('/') // /category/keuken -> ['', 'category', 'keuken'] -> 'keuken'
    : pathParts.slice(4).join('/'); // /public/hamid2/category/keuken -> ['', 'public', 'hamid2', 'category', 'keuken'] -> 'keuken'
  const categorySlug = categoryPath.split('/').pop() || categoryPath; // Get the last segment as the actual category slug

  // Use React Query hooks for automatic caching & deduplication
  const {
    data: categoryData,
    isLoading: categoryLoading,
    error: categoryError
  } = useCategory(categorySlug, store?.id, {
    enabled: !storeLoading && !!store?.id && !!categorySlug
  });

  // Use React Query hook for slot configuration
  const { data: slotConfig } = useSlotConfiguration(store?.id, 'category');

  const [products, setProducts] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [activeFilters, setActiveFilters] = useState({});
  // Detect current breakpoint based on window width
  const getCurrentBreakpoint = () => {
    if (typeof window === 'undefined') return 'default';

    const width = window.innerWidth;

    // Tailwind breakpoints: sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px
    if (width >= 1536) return '2xl';
    if (width >= 1280) return 'xl';
    if (width >= 1024) return 'lg';
    if (width >= 768) return 'md';
    if (width >= 640) return 'sm';
    return 'default';
  };

  // Calculate dynamic items per page based on current breakpoint and grid configuration
  const calculateItemsPerPage = () => {
    const gridConfig = settings?.product_grid;
    if (!gridConfig) return 12;

    const rows = gridConfig.rows || 4;
    if (rows === 0) return -1; // Infinite scroll

    const breakpoints = gridConfig.breakpoints || {};
    const currentBreakpoint = getCurrentBreakpoint();

    // Get the columns for the current breakpoint, with fallback logic
    let currentColumns = 1;

    // Tailwind CSS cascade: start from current breakpoint and fall back to smaller ones
    const breakpointOrder = ['2xl', 'xl', 'lg', 'md', 'sm', 'default'];
    const currentIndex = breakpointOrder.indexOf(currentBreakpoint);

    // Look for the first defined breakpoint starting from current and going down
    for (let i = currentIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (breakpoints[bp] && breakpoints[bp] > 0) {
        currentColumns = breakpoints[bp];
        break;
      }
    }

    return currentColumns * rows;
  };

  const [itemsPerPage, setItemsPerPage] = useState(calculateItemsPerPage());
  const [categoryLayoutConfig, setCategoryLayoutConfig] = useState(null);
  const [categoryConfigLoaded, setCategoryConfigLoaded] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  // Update viewMode when settings are loaded
  useEffect(() => {
    if (settings?.default_view_mode) {
      setViewMode(settings.default_view_mode);
    }
  }, [settings?.default_view_mode]);

  const { currentPage, setPage } = usePagination();
  const { currentSort, setSort } = useSorting();

  // Update items per page when window resizes (breakpoint changes) or settings change
  useEffect(() => {
    const handleResize = () => {
      const newItemsPerPage = calculateItemsPerPage();
      if (newItemsPerPage !== itemsPerPage) {
        setItemsPerPage(newItemsPerPage);
        // Reset to page 1 when items per page changes
        setPage(1);
      }
    };

    // Recalculate when settings change
    if (settings?.product_grid) {
      const newItemsPerPage = calculateItemsPerPage();
      if (newItemsPerPage !== itemsPerPage) {
        setItemsPerPage(newItemsPerPage);
        setPage(1);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [settings?.product_grid, itemsPerPage, setPage]);

  // Update layout config when slotConfig changes from React Query
  useEffect(() => {
    if (slotConfig) {
      setCategoryLayoutConfig(slotConfig);
      setCategoryConfigLoaded(true);
    } else if (slotConfig === null) {
      // No published config exists - this should not happen if store was provisioned correctly
      console.warn('No published category configuration found. Store may not be provisioned correctly.');
      setCategoryLayoutConfig(null);
      setCategoryConfigLoaded(true);
    }
  }, [slotConfig]);

  // Extract slots from the loaded configuration
  const categorySlots = categoryLayoutConfig?.slots || null;

  // Generate grid classes from store settings
  const getGridClasses = () => {
    const gridConfig = settings?.product_grid;

    if (gridConfig) {
      let classes = [];
      const breakpoints = gridConfig.breakpoints || {};
      const customBreakpoints = gridConfig.customBreakpoints || [];

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
    }

    // Fallback to default grid
    return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2';
  };

  // Update state when categoryData changes from React Query
  useEffect(() => {
    if (categoryData && categoryData.category) {
      setCurrentCategory(categoryData.category);
      setProducts(ensureArray(categoryData.products));
      setActiveFilters({});

      // Track category view
      if (typeof window !== 'undefined' && window.daino?.trackEvent) {
        window.daino.trackEvent('page_view', {
          page_type: 'category',
          category_name: getCategoryName(categoryData.category, getCurrentLanguage()),
          category_id: categoryData.category.id,
          store_name: store.name,
          store_id: store.id
        });
      }
    } else if (categoryError) {
      showNotFound(`Category "${categorySlug}" not found`);
      setProducts([]);
    }
  }, [categoryData, categoryError, store, categorySlug]);
  
  const filteredProducts = useMemo(() => {
    let currentProducts = products;

    // First apply stock filtering based on display_out_of_stock setting
    if (settings?.enable_inventory && !settings?.display_out_of_stock) {
      currentProducts = currentProducts.filter(product => {
        if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
          return product.stock_quantity > 0;
        }
        return true; // Products without stock_quantity are always shown (unlimited stock)
      });
    }

    // Then apply user filters
    if (Object.keys(activeFilters).length === 0) return currentProducts;

    return currentProducts.filter(product => {
      // Price range filtering
      if (activeFilters.priceRange) {
        const [min, max] = activeFilters.priceRange;
        let price = parseFloat(product.price || 0);

        // Use the lowest price if compare_price exists and is lower
        if (product.compare_price && parseFloat(product.compare_price) > 0) {
          price = Math.min(price, parseFloat(product.compare_price));
        }

        if (price < min || price > max) {
          return false;
        }
      }

      // Attribute filtering
      for (const key in activeFilters) {
        if (key === 'priceRange') continue;

        const filterValues = activeFilters[key];
        if (!filterValues || filterValues.length === 0) continue;

        // Handle attribute range filters (e.g., price_amountRange, weightRange)
        if (key.endsWith('Range') && Array.isArray(filterValues) && filterValues.length === 2) {
          const attrCode = key.replace(/Range$/, ''); // Remove 'Range' suffix to get attribute code
          const [min, max] = filterValues;

          const productAttributes = product.attributes || [];
          if (!Array.isArray(productAttributes)) return false;

          const matchingAttr = productAttributes.find(pAttr => pAttr.code === attrCode);
          if (!matchingAttr) return false;

          const attrValue = parseFloat(matchingAttr.rawValue || matchingAttr.value);
          if (isNaN(attrValue) || attrValue < min || attrValue > max) {
            return false;
          }
          continue;
        }

        // Standard attribute value filtering (multiselect/select)
        const productAttributes = product.attributes || [];

        // Attributes is an array of {code, label, value, ...}
        if (!Array.isArray(productAttributes)) return false;

        const matchingAttr = productAttributes.find(pAttr => pAttr.code === key);
        if (!matchingAttr || !matchingAttr.value) {
          return false;
        }

        const productValue = String(matchingAttr.value);
        const hasMatch = filterValues.some(filterVal => String(filterVal) === productValue);

        if (!hasMatch) {
          return false;
        }
      }
      return true;
    });
  }, [products, activeFilters, settings]);

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];

    // Handle both hyphen format (name-asc) and underscore format (name_asc)
    switch (currentSort) {
      case 'name-asc':
      case 'name_asc':
        return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'name-desc':
      case 'name_desc':
        return sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
      case 'price-asc':
      case 'price_asc':
        return sorted.sort((a, b) => {
          // Use the same logic as ProductCard for actual selling price
          let priceA = parseFloat(a.price || 0);
          let priceB = parseFloat(b.price || 0);

          // If there's a compare_price, use the lower of the two prices (sale price)
          if (a.compare_price && parseFloat(a.compare_price) > 0) {
            priceA = Math.min(priceA, parseFloat(a.compare_price));
          }
          if (b.compare_price && parseFloat(b.compare_price) > 0) {
            priceB = Math.min(priceB, parseFloat(b.compare_price));
          }

          return priceA - priceB;
        });
      case 'price-desc':
      case 'price_desc':
        return sorted.sort((a, b) => {
          // Use the same logic as ProductCard for actual selling price
          let priceA = parseFloat(a.price || 0);
          let priceB = parseFloat(b.price || 0);

          // If there's a compare_price, use the lower of the two prices (sale price)
          if (a.compare_price && parseFloat(a.compare_price) > 0) {
            priceA = Math.min(priceA, parseFloat(a.compare_price));
          }
          if (b.compare_price && parseFloat(b.compare_price) > 0) {
            priceB = Math.min(priceB, parseFloat(b.compare_price));
          }

          return priceB - priceA;
        });
      case 'newest':
      case 'created_desc':
        return sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      case 'oldest':
      case 'created_asc':
        return sorted.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
      case 'position':
      default:
        return sorted;
    }
  }, [filteredProducts, currentSort]);

  const paginatedProducts = useMemo(() => {
    // If infinite scroll is enabled (itemsPerPage = -1), show all products
    if (itemsPerPage === -1) {
      return sortedProducts;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedProducts.slice(startIndex, endIndex);
  }, [sortedProducts, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(sortedProducts.length / itemsPerPage);

  const handleSortChange = (newSort) => {
    setSort(newSort);
  };

  const handlePageChange = (page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    if (Object.keys(activeFilters).length > 0) {
      setPage(1);
    }
  }, [activeFilters, setPage]);


  // Build dynamic filters from database attributes where is_filterable = true
  // Only show options that have products (count > 0)
  const buildFilters = () => {
    const filters = {};
    const currentLang = getCurrentLanguage();

    // Define min and max price from entire product collection first
    const allPrices = products.map(p => {
      let price = parseFloat(p.price || 0);
      // Use the lowest price if compare_price exists and is lower
      if (p.compare_price && parseFloat(p.compare_price) > 0) {
        price = Math.min(price, parseFloat(p.compare_price));
      }
      return price;
    }).filter(p => p > 0);

    const minPrice = allPrices.length > 0 ? Math.floor(Math.min(...allPrices)) : 0;
    const maxPrice = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices)) : 0;

    // Always add price slider if we have products with prices
    if (minPrice > 0 && maxPrice > 0 && minPrice !== maxPrice) {
      filters.price = {
        label: t('common.price', 'Price'),
        min: minPrice,
        max: maxPrice,
        type: 'slider'
      };
    }

    // Use filterableAttributes from database (where is_filterable = true)
    if (!filterableAttributes || filterableAttributes.length === 0) {
      return filters;
    }

    // Process each filterable attribute from database (already filtered by is_filterable = true)
    filterableAttributes.forEach(attr => {
      const attrCode = attr.code || attr.name || attr.attribute_name;

      // Skip attributes that shouldn't be displayed as filters
      // (even if marked as filterable, they're used for other purposes)
      const excludedAttributes = ['name', 'sku', 'description', 'image'];
      if (excludedAttributes.includes(attrCode)) return;

      // Extract unique values from products (just the codes)
      const valueSet = new Set();

      if (products && products.length > 0) {
        products.forEach(p => {
          const productAttributes = p.attributes || [];

          // Attributes is an array of {code, label, value, ...}
          if (!Array.isArray(productAttributes)) return;

          const matchingAttr = productAttributes.find(pAttr => pAttr.code === attrCode);
          if (!matchingAttr || (!matchingAttr.rawValue && !matchingAttr.value)) return;

          // Store just the value code (use rawValue which contains the code, not the translated value)
          const valueCode = String(matchingAttr.rawValue || matchingAttr.value);
          if (valueCode && valueCode !== '') {
            valueSet.add(valueCode);
          }
        });
      }

      // Get translated attribute label for filter header
      const attributeLabel = attr.translations?.[currentLang]?.name ||
                            attr.translations?.en?.name ||
                            attr.name ||
                            attrCode;

      // Skip price attribute (handled separately above)
      if (attrCode === 'price') return;

      // Only include attributes that have values with count > 0
      if (valueSet.size > 0) {
        // Store just the value codes array
        // Labels will be fetched from attribute_values.translations when displaying
        filters[attrCode] = {
          label: attributeLabel,
          options: Array.from(valueSet) // Just the value codes
        };
      }
    });
    return filters;
  };

  // Build active filters array for display
  const buildActiveFiltersArray = () => {
    const activeFiltersArray = [];
    const currentLang = getCurrentLanguage();

    Object.entries(activeFilters).forEach(([attributeCode, values]) => {
      if (attributeCode === 'priceRange') {
        return;
      }

      // Find the attribute from filterableAttributes and use translated label
      const attr = filterableAttributes?.find(a => a.code === attributeCode);
      const attributeLabel = attr?.translations?.[currentLang]?.name ||
                            attr?.translations?.en?.name ||
                            attr?.name ||
                            attributeCode;

      // Add each selected value as a separate active filter
      if (Array.isArray(values)) {
        values.forEach(value => {
          activeFiltersArray.push({
            type: 'attribute',
            attributeCode: attributeCode,
            label: attributeLabel,
            value: value
          });
        });
      }
    });
    return activeFiltersArray;
  };

  // Create category context for CategorySlotRenderer
  const categoryContext = {
    category: currentCategory,
    products: paginatedProducts,
    allProducts: products, // Use unfiltered products for filter counting
    filteredProductsCount: sortedProducts.length, // Count of products after filtering
    filters: buildFilters(),
    filterableAttributes, // Pass database filterable attributes directly
    activeFilters: buildActiveFiltersArray(), // Array of active filter objects for display
    sortOption: currentSort,
    currentPage,
    totalPages,
    itemsPerPage, // Add dynamic items per page
    subcategories: [],
    breadcrumbs: buildCategoryBreadcrumbs(currentCategory, storeCode, categories, settings),
    selectedFilters: activeFilters,
    priceRange: {},
    currencySymbol: settings?.currency_symbol, // Currency symbol from StoreProvider
    settings: {
      ...settings,
      // Ensure defaults for view mode toggle
      enable_view_mode_toggle: settings?.enable_view_mode_toggle ?? true,
      default_view_mode: settings?.default_view_mode || 'grid',
      show_stock_label: settings?.show_stock_label ?? false,
      // Preserve theme settings including breadcrumb colors
      theme: settings?.theme || {}
    },
    store,
    categories,
    slots: categorySlots, // Add slots to context for breadcrumb configuration access
    taxes: [],
    selectedCountry: null,
    handleFilterChange: setActiveFilters,
    handleSortChange: handleSortChange,
    handlePageChange: handlePageChange,
    onViewModeChange: setViewMode,
    clearFilters: () => setActiveFilters({}),
    formatDisplayPrice: (product) => {
      // Handle if product is passed instead of price value
      const priceValue = typeof product === 'object' ? product.price : product;
      return formatPrice(priceValue);
    },
    getProductImageUrl: (product) => product?.images?.[0]?.url || '/placeholder-product.jpg',
    navigate: (url) => window.location.href = url,
    onProductClick: (product) => window.location.href = createProductUrl(storeCode, product.slug)
  };

  // Combined loading state from both store and category
  const loading = storeLoading || categoryLoading;

  if (loading) {
    return <PageLoader size="lg" fullScreen={false} className="h-96" />;
  }

  const pageTitle = currentCategory ? getCategoryName(currentCategory, getCurrentLanguage()) : (categorySlug ? "Category Not Found" : "All Products");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
        <SeoHeadManager
        pageType="category"
        pageData={currentCategory ? {
          ...currentCategory,
          category_ids: [currentCategory.id],
          categories: [currentCategory.id],
          breadcrumbs: buildCategoryBreadcrumbs(currentCategory, storeCode, categories, settings)
        } : store}
        pageTitle={pageTitle}
      />

      {/* Dynamic layout using CategorySlotRenderer for everything below header */}
      <div className="max-w-7xl mx-auto">
        {loading || !categoryConfigLoaded ? (
          <div className={`grid ${getGridClasses()} gap-8 min-h-[400px]`}>
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-t-lg"></div>
                <CardContent className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-10 bg-gray-300 rounded w-full mt-2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Always show CategorySlotRenderer with layered navigation, even when no products */}
            <div className="grid grid-cols-12 gap-2 auto-rows-min">
              <CategorySlotRenderer
                slots={categorySlots}
                parentId={null}
                viewMode={viewMode}
                categoryContext={categoryContext}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}