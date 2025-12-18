import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPublicUrl } from '@/utils/urlUtils';
import { StorefrontProduct } from '@/api/storefront-entities';
import { useStore } from '@/components/storefront/StoreProvider';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice, safeNumber } from '@/utils/priceUtils';
import { useTranslation } from '@/contexts/TranslationContext';
import { getProductName, getProductShortDescription, getCurrentLanguage } from '@/utils/translationUtils';
import { getPrimaryImageUrl } from '@/utils/imageUtils';

export default function HeaderSearch({ styles = {} }) {
  const navigate = useNavigate();
  const params = useParams();
  const { store, settings, taxes, selectedCountry } = useStore();
  const { t } = useTranslation();

  // Get store code from params or store object or URL
  const getStoreCode = () => {
    // Try params first
    if (params.storeCode) return params.storeCode;
    if (params.slug) return params.slug;

    // Try extracting from current URL path
    const match = window.location.pathname.match(/^\/public\/([^\/]+)/);
    if (match && match[1]) return match[1];

    // Fallback to store object
    if (store?.slug) return store.slug;
    if (store?.code) return store.code;

    return null;
  };

  const storeCode = getStoreCode();

  // Extract input styles from slot configuration
  const inputStyles = {
    backgroundColor: styles?.backgroundColor,
    borderColor: styles?.borderColor,
    borderRadius: styles?.borderRadius,
  };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current && 
        !searchRef.current.contains(event.target) &&
        resultsRef.current &&
        !resultsRef.current.contains(event.target)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setLoading(true);
      try {
        // Get products from backend search
        const products = await StorefrontProduct.list('-created_date', 50);

        // Filter by search query including translations
        const searchLower = searchQuery.toLowerCase();
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

        setSearchResults(filteredProducts.slice(0, 5));
        setShowResults(true);
      } catch (error) {
        console.error("Error searching products:", error);
        setSearchResults([]);
        setShowResults(false);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = (e) => {
    e.preventDefault();

    if (searchQuery.trim()) {
      // Track search event
      if (typeof window !== 'undefined' && window.daino?.trackSearch) {
        window.daino.trackSearch(searchQuery.trim(), searchResults.length);
      }

      // Navigate to Storefront page with search parameter
      if (storeCode) {
        const searchUrl = createPublicUrl(storeCode, 'STOREFRONT', { search: searchQuery.trim() });
        navigate(searchUrl);
      } else {
        console.error('❌ No store code available for search navigation');
      }
      setShowResults(false);
      setSearchQuery('');
    }
  };

  const handleProductClick = (product) => {
    if (storeCode) {
      const productUrl = createPublicUrl(storeCode, 'PRODUCT_DETAIL', { id: product.id });
      navigate(productUrl);
      setShowResults(false);
      setSearchQuery('');
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder={t('common.search_products', 'Search products...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-12 py-2 w-full"
            style={inputStyles}
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              onClick={clearSearch}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Search Results Dropdown */}
      {showResults && searchQuery.trim().length >= 2 && (
        <Card className="absolute top-full mt-1 w-full z-50 shadow-lg border" ref={resultsRef}>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                {searchResults.map((product) => {
                  const currentLang = getCurrentLanguage();
                  const displayName = getProductName(product, currentLang) || product.name;

                  return (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                    >
                      <img
                        src={getPrimaryImageUrl(product.images) || 'https://placehold.co/40x40?text=No+Image'}
                        alt={displayName}
                        className="w-10 h-10 object-cover rounded-md mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {displayName}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">
                          SKU: {product.sku}
                        </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {product.compare_price && safeNumber(product.compare_price) > 0 && safeNumber(product.compare_price) !== safeNumber(product.price) ? (
                          <>
                            <span className="text-red-600">
                              {formatPrice(
                                Math.min(safeNumber(product.price), safeNumber(product.compare_price))
                              )}
                            </span>
                            <span className="text-gray-500 line-through ml-1 text-xs">
                              {formatPrice(
                                Math.max(safeNumber(product.price), safeNumber(product.compare_price))
                              )}
                            </span>
                          </>
                        ) : (
                          <span>{formatPrice(product.price)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  );
                })}

                {searchResults.length > 0 && (
                  <div className="p-3 bg-gray-50 border-t">
                    <Button
                      onClick={handleSearch}
                      variant="ghost"
                      size="sm"
                      className="w-full text-blue-600 hover:text-blue-800"
                    >
                      {t('common.view_all_results_for', 'View all results for')} "{searchQuery}"
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                {t('common.no_products_found_for', 'No products found for')} "{searchQuery}"
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}