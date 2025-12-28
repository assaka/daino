/**
 * Page Bootstrap Hook - Layer 2 Page-Specific Data
 *
 * Fetches page-specific data in a single API call.
 * Completes the 3-layer data architecture.
 *
 * Layer 2 (Page Bootstrap): Page-specific data loaded per page type
 * - Product page: attributes, attributeSets, productLabels, customOptionRules, productTabs
 * - Category page: filterableAttributes, productLabels
 * - Checkout page: taxes, shippingMethods, paymentMethods, deliverySettings
 * - Homepage: featuredProducts, cmsBlocks
 */

import { useQuery } from '@tanstack/react-query';
import { storefrontApiClient } from '@/api/storefront-entities';

/**
 * Hook to fetch page-specific bootstrap data (Layer 2)
 *
 * @param {string} pageType - Page type: 'product', 'category', 'checkout', 'homepage'
 * @param {string} storeId - Store ID
 * @param {string} language - Language code
 * @param {boolean} enabled - Whether to fetch (default true)
 * @returns {Object} React Query result with page-specific data
 */
export function usePageBootstrap(pageType, storeId, language = 'en', enabled = true) {
  return useQuery({
    queryKey: ['page-bootstrap', pageType, storeId, language],
    queryFn: async () => {
      if (!storeId || !pageType) {
        throw new Error('Store ID and page type are required');
      }

      const params = new URLSearchParams({
        page_type: pageType,
        store_id: storeId,
        lang: language
      });

      const result = await storefrontApiClient.getPublic(`page-bootstrap?${params.toString()}`);

      if (!result.success) {
        throw new Error(result.message || 'Page bootstrap failed');
      }

      return result.data;
    },
    staleTime: 300000, // 5 minutes - page data is semi-static
    gcTime: 600000, // 10 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: enabled && !!storeId && !!pageType,
  });
}

/**
 * Hook for product page bootstrap
 * Returns: attributes, attributeSets, productLabels, customOptionRules, productTabs
 */
export function useProductPageBootstrap(storeId, language = 'en', enabled = true) {
  return usePageBootstrap('product', storeId, language, enabled);
}

/**
 * Hook for category page bootstrap
 * Returns: filterableAttributes, productLabels
 */
export function useCategoryPageBootstrap(storeId, language = 'en', enabled = true) {
  return usePageBootstrap('category', storeId, language, enabled);
}

/**
 * Hook for cart page bootstrap
 * Returns: cartSlotConfig, taxes
 */
export function useCartPageBootstrap(storeId, language = 'en', enabled = true) {
  return usePageBootstrap('cart', storeId, language, enabled);
}

/**
 * Hook for checkout page bootstrap
 * Returns: taxes, shippingMethods, paymentMethods, deliverySettings
 * Note: Uses shorter cache time since payment/shipping methods can change
 */
export function useCheckoutPageBootstrap(storeId, language = 'en', enabled = true) {
  return useQuery({
    queryKey: ['page-bootstrap', 'checkout', storeId, language],
    queryFn: async () => {
      if (!storeId) {
        throw new Error('Store ID is required');
      }

      const params = new URLSearchParams({
        page_type: 'checkout',
        store_id: storeId,
        lang: language
      });

      const result = await storefrontApiClient.getPublic(`page-bootstrap?${params.toString()}`);

      if (!result.success) {
        throw new Error(result.message || 'Checkout bootstrap failed');
      }

      return result.data;
    },
    staleTime: 30000, // 30 seconds - checkout data can change (payment methods enabled/disabled)
    gcTime: 60000, // 1 minute
    refetchOnMount: true, // Always refetch when checkout page loads
    refetchOnWindowFocus: false,
    enabled: enabled && !!storeId,
  });
}

/**
 * Hook for homepage bootstrap
 * Returns: featuredProducts, cmsBlocks
 */
export function useHomepageBootstrap(storeId, language = 'en', enabled = true) {
  return usePageBootstrap('homepage', storeId, language, enabled);
}
