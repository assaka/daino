import React, { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createCategoryUrl } from "@/utils/urlUtils";
import { StorefrontProduct } from "@/api/storefront-entities";
import { useStore, cachedApiCall } from "@/components/storefront/StoreProvider";
import ProductItemCard from "@/components/storefront/ProductItemCard";
import SeoHeadManager from "@/components/storefront/SeoHeadManager";
import CmsBlockRenderer from "@/components/storefront/CmsBlockRenderer";
import { Package, Search as SearchIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProductName, getProductShortDescription, getCurrentLanguage } from "@/utils/translationUtils";
import { useTranslation } from "@/contexts/TranslationContext";
import { useHomepageBootstrap } from "@/hooks/usePageBootstrap";
import { PageLoader } from "@/components/ui/page-loader";

const ensureArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data === null || data === undefined) return [];
  return [];
};

export default function Homepage() {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');
  const { store, settings, loading: storeLoading, categories, productLabels, taxes, selectedCountry } = useStore();
  const { t } = useTranslation();

  // Layer 2: Homepage bootstrap (featuredProducts, cmsBlocks)
  const language = getCurrentLanguage();
  const { data: pageBootstrap, isLoading: pageBootstrapLoading } = useHomepageBootstrap(
    store?.id,
    language,
    !searchQuery // Only fetch if not searching
  );

  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Scroll state for featured products carousel
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Use featured products from page bootstrap (no API call!)
  const featuredProducts = pageBootstrap?.featuredProducts || [];

  useEffect(() => {
    if (!storeLoading && store?.id) {
      if (searchQuery) {
        loadSearchResults(searchQuery);
      } else {
        // Featured products come from page bootstrap, just stop loading
        setLoading(pageBootstrapLoading);
      }

      // Track homepage view
      if (typeof window !== 'undefined' && window.daino?.trackEvent) {
        window.daino.trackEvent('page_view', {
          page_type: searchQuery ? 'search_results' : 'homepage',
          store_name: store.name,
          store_id: store.id,
          search_query: searchQuery || undefined
        });
      }
    }
  }, [store?.id, storeLoading, searchQuery, pageBootstrapLoading]);

  // Check if scroll arrows should be visible
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    }
  };

  // Track scroll state for featured products carousel
  useEffect(() => {
    if (!searchQuery && !loading && featuredProducts.length > 0) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(checkScrollButtons, 100);
      const container = scrollContainerRef.current;
      if (container) {
        container.addEventListener('scroll', checkScrollButtons);
        window.addEventListener('resize', checkScrollButtons);
      }
      return () => {
        clearTimeout(timer);
        if (container) {
          container.removeEventListener('scroll', checkScrollButtons);
          window.removeEventListener('resize', checkScrollButtons);
        }
      };
    }
  }, [featuredProducts, loading, searchQuery]);

  // Scroll the featured products carousel
  const scroll = (direction) => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 300; // Approximate card width + gap
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const loadSearchResults = async (query) => {
    try {
      setLoading(true);
      if (!store) return;

      // Get products from backend
      const products = await StorefrontProduct.list('-created_date', 50);

      // Filter by search query including translations
      const searchLower = query.toLowerCase();
      const currentLang = getCurrentLanguage();

      const filteredProducts = products.filter(product => {
        // Search in direct fields
        const matchesDirectFields =
          product.name?.toLowerCase().includes(searchLower) ||
          product.sku?.toLowerCase().includes(searchLower) ||
          product.short_description?.toLowerCase().includes(searchLower);

        // Search in translated fields
        const translatedName = getProductName(product, currentLang);
        const translatedDescription = getProductShortDescription(product, currentLang);
        const matchesTranslations =
          translatedName?.toLowerCase().includes(searchLower) ||
          translatedDescription?.toLowerCase().includes(searchLower);

        return matchesDirectFields || matchesTranslations;
      });

      setSearchResults(filteredProducts);
    } catch (error) {
      console.error("Homepage: Error searching products:", error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter products based on stock settings
  const getFilteredProducts = () => {
    let products = searchQuery ? searchResults : featuredProducts;
    
    // Apply stock filtering based on display_out_of_stock setting
    if (settings?.enable_inventory && !settings?.display_out_of_stock) {
      products = products.filter(product => {
        if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
          return product.stock_quantity > 0;
        }
        return true; // Products without stock_quantity are always shown (unlimited stock)
      });
    }
    
    return products;
  };

  if (storeLoading) {
    return <PageLoader size="lg" fullScreen={false} className="h-96" />;
  }

  const filteredProducts = getFilteredProducts();
  const storeCode = store?.slug || store?.code;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <SeoHeadManager
        pageType={searchQuery ? "search" : "homepage"}
        pageData={store}
        pageTitle={searchQuery ? `Search results for "${searchQuery}"` : ''}
      />
      
      <div className="max-w-7xl mx-auto">
        {!searchQuery && (
          <>
            <CmsBlockRenderer position="homepage_above_hero" />

            {/* Hero section via CMS Block */}
            <CmsBlockRenderer position="homepage_hero" />

            <CmsBlockRenderer position="homepage_below_hero" />
          </>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-square bg-gray-200 rounded-t-lg"></div>
                <CardContent className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {!searchQuery && <CmsBlockRenderer position="homepage_above_featured" />}

            {/* Hide featured products section header when empty and store is published */}
            {(filteredProducts.length > 0 || searchQuery || !store?.published) && (
              <div className="flex justify-between items-center my-8">
                <h2 className="text-3xl font-bold">
                  {searchQuery ? (
                    <>
                      <SearchIcon className="inline-block w-8 h-8 mr-2 mb-1" />
                      {t('common.search_results_for', 'Search Results for')} "{searchQuery}"
                    </>
                  ) : (
                    'Featured Products'
                  )}
                </h2>
                {!searchQuery && categories && categories.length > 0 && (
                  <Link to={createCategoryUrl(storeCode, categories[0]?.slug)}>
                    <Button variant="outline">View All Products</Button>
                  </Link>
                )}
              </div>
            )}

            {filteredProducts.length > 0 ? (
              searchQuery ? (
                // Grid layout for search results
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {filteredProducts.map((product) => (
                    <ProductItemCard
                      key={product.id}
                      product={product}
                      settings={settings}
                      store={store}
                      taxes={taxes}
                      selectedCountry={selectedCountry}
                      productLabels={productLabels}
                      className="hover:shadow-lg transition-shadow rounded-lg"
                      viewMode="grid"
                      slotConfig={{}}
                    />
                  ))}
                </div>
              ) : (
                // Scrollable carousel for featured products
                <div className="relative">
                  {/* Left Arrow */}
                  {canScrollLeft && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg hover:bg-gray-50 w-10 h-10 rounded-full border-gray-200"
                      onClick={() => scroll('left')}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                  )}

                  {/* Scrollable Container */}
                  <div
                    ref={scrollContainerRef}
                    className="flex gap-6 overflow-x-auto scrollbar-hide px-1 py-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {filteredProducts.slice(0, 12).map((product) => (
                      <div key={product.id} className="flex-shrink-0 w-[280px]">
                        <ProductItemCard
                          product={product}
                          settings={settings}
                          store={store}
                          taxes={taxes}
                          selectedCountry={selectedCountry}
                          productLabels={productLabels}
                          className="hover:shadow-lg transition-shadow rounded-lg h-full"
                          viewMode="grid"
                          slotConfig={{}}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Right Arrow */}
                  {canScrollRight && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg hover:bg-gray-50 w-10 h-10 rounded-full border-gray-200"
                      onClick={() => scroll('right')}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              )
            ) : searchQuery ? (
              // Show empty state only for search results
              <div className="text-center py-16">
                <SearchIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600">No products match your search for "{searchQuery}".</p>
                <p className="text-gray-600 mt-2">Try different keywords or browse all products.</p>
              </div>
            ) : !store?.published ? (
              // Show empty featured products message only for unpublished stores (admin preview)
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No Featured Products</h3>
                <p className="text-gray-600">Mark some products as featured to display them here.</p>
              </div>
            ) : null}

            {!searchQuery && (
              <>
                <CmsBlockRenderer position="homepage_below_featured" />

                <CmsBlockRenderer position="homepage_above_content" />

                {/* Additional homepage content can go here */}

                <CmsBlockRenderer position="homepage_below_content" />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}