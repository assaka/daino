
import React, { useState, useEffect } from 'react';
import { Heart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StorefrontProduct } from '@/api/storefront-entities';
import { getExternalStoreUrl, getStoreBaseUrl } from '@/utils/urlUtils';
import { useStore } from '@/components/storefront/StoreProvider';
import { formatPrice } from '@/utils/priceUtils';
import { useTranslation } from '@/contexts/TranslationContext';
import { getPrimaryImageUrl } from '@/utils/imageUtils';
// React Query hooks for optimized wishlist management
import { useWishlist, useRemoveFromWishlist } from '@/hooks/useApiQueries';

export default function WishlistDropdown({ iconVariant = 'outline' }) {
  const { t } = useTranslation();
  const { store, wishlist: bootstrapWishlist } = useStore();

  // Always fetch wishlist to stay in sync - React Query will deduplicate
  const { data: fetchedWishlist = [], isLoading, refetch } = useWishlist(store?.id);
  const removeFromWishlist = useRemoveFromWishlist();

  // Use fetched data (React Query) as it stays in sync, fallback to bootstrap only on initial load
  // fetchedWishlist is kept in sync by React Query cache invalidation
  const wishlistData = fetchedWishlist.length > 0 ? fetchedWishlist : (bootstrapWishlist || []);

  const [wishlistItems, setWishlistItems] = useState([]);

  // Choose icon based on variant
  const getWishlistIcon = () => {
    switch (iconVariant) {
      case 'filled':
        return <Heart className="w-5 h-5 fill-current" />;
      case 'outline':
      default:
        return <Heart className="w-5 h-5" />;
    }
  };

  // Load product details for wishlist items
  useEffect(() => {
    const loadProductDetails = async () => {
      if (!wishlistData || wishlistData.length === 0) {
        setWishlistItems([]);
        return;
      }

      try {
        const productIds = [...new Set(wishlistData.map(item => item.product_id))];

        // Load products in parallel (React Query will deduplicate if called elsewhere)
        const productPromises = productIds.map(async (productId) => {
          try {
            const response = await StorefrontProduct.findById(productId);

            // Handle wrapped response structure
            let product = null;
            if (response && response.success && response.data) {
              product = response.data;
            } else if (response && !response.success) {
              product = response;
            }

            return product;
          } catch (error) {
            console.warn(`WishlistDropdown: Could not load product ${productId}`);
            return null;
          }
        });

        const products = (await Promise.all(productPromises)).filter(Boolean);

        const productLookup = products.reduce((acc, product) => {
          if (product && product.id) acc[product.id] = product;
          return acc;
        }, {});

        const newWishlistItems = wishlistData.map(item => {
          const product = productLookup[item.product_id];
          return product ? { ...item, product } : null;
        }).filter(Boolean);

        setWishlistItems(newWishlistItems);
      } catch (error) {
        console.error("WishlistDropdown: Error loading product details:", error);
      }
    };

    loadProductDetails();
  }, [wishlistData]);

  // Listen for wishlist updates (for components not using React Query)
  useEffect(() => {
    const handleWishlistUpdate = () => {
      refetch(); // Refetch data from React Query cache
    };

    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
  }, [refetch]);

  const handleRemoveFromWishlist = async (productId) => {
    try {
      await removeFromWishlist.mutateAsync({ productId, storeId: store?.id });
    } catch (error) {
      console.error("WishlistDropdown: Error removing item from wishlist:", error);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {getWishlistIcon()}
          {wishlistItems.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
            >
              {wishlistItems.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">{t('common.wishlist', 'Wishlist')}</h3>

          {isLoading ? (
            <div className="text-center py-4">{t('common.loading', 'Loading...')}</div>
          ) : wishlistItems.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              {t('common.your_wishlist_is_empty', 'Your wishlist is empty')}
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {wishlistItems.map(item => (
                <div key={item.id} className="flex items-center space-x-3 py-2 border-b border-gray-200">
                  <img
                    src={getPrimaryImageUrl(item.product?.images) || 'https://placehold.co/50x50?text=No+Image'}
                    alt={item.product?.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <a href={getExternalStoreUrl(store?.slug, `product/${item.product?.slug || item.product_id}`, getStoreBaseUrl(store))}>
                      <p className="text-sm font-medium truncate hover:underline">{item.product?.name}</p>
                    </a>
                    <p className="text-sm text-gray-500">
                      {formatPrice(item.product?.price)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFromWishlist(item.product_id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
