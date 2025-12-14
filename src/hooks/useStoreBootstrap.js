/**
 * Bootstrap Hook - Layer 1 Global Data
 *
 * Fetches all initial storefront data in a single API call.
 * This hook provides the foundation for the 3-layer data architecture.
 *
 * Layer 1 (Bootstrap): Global data loaded once per session
 * - Store configuration
 * - Languages
 * - Translations (UI labels)
 * - Categories (navigation)
 * - SEO settings
 * - SEO templates
 * - Wishlist
 * - User data
 * - Header slot configuration
 */

import { useQuery } from '@tanstack/react-query';
import { storefrontApiClient, StorefrontStore } from '@/api/storefront-entities';
import { isPlatformDomain, isCustomDomain, shouldSkipStoreContext } from '@/utils/domainConfig';

/**
 * Helper hook to fetch store slug when we only have ID
 * @param {string} storeId - Store ID
 * @returns {Object} React Query result with store slug
 */
export function useStoreSlugById(storeId) {
  return useQuery({
    queryKey: ['store-slug', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      try {
        const result = await StorefrontStore.filter({ id: storeId });
        const store = Array.isArray(result) ? result[0] : null;
        return store?.slug || null;
      } catch (error) {
        console.error('Failed to fetch store slug:', error);
        return null;
      }
    },
    staleTime: 3600000, // 1 hour - slug rarely changes
    enabled: !!storeId,
  });
}

/**
 * Hook to fetch bootstrap data (Layer 1 - Global data)
 * This should be the PRIMARY data source for StoreProvider
 *
 * @param {string} storeSlug - Store slug or hostname
 * @param {string} language - Language code (e.g., 'en', 'es')
 * @returns {Object} React Query result with bootstrap data
 */
export function useStoreBootstrap(storeSlug, language) {
  // Check for storefront preview in URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const storefrontSlug = urlParams.get('storefront');
  const versionParam = urlParams.get('version');

  // Also check localStorage for persisted preview mode
  let version = versionParam;
  if (!version) {
    try {
      const stored = localStorage.getItem('daino_preview_mode');
      if (stored) {
        const previewState = JSON.parse(stored);
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - previewState.timestamp < maxAge) {
          if (previewState.isPublishedPreview) version = 'published';
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  return useQuery({
    queryKey: ['bootstrap', storeSlug, language, storefrontSlug, version],
    queryFn: async () => {
      if (!storeSlug) {
        throw new Error('Store slug is required for bootstrap');
      }

      // Build query string for bootstrap endpoint
      const sessionId = localStorage.getItem('guestSessionId') || localStorage.getItem('guest_session_id');
      const params = new URLSearchParams({
        slug: storeSlug,
        lang: language || 'en'
      });

      // Only add session_id if it exists
      if (sessionId) {
        params.append('session_id', sessionId);
      }

      // Add storefront preview parameter if present in URL
      if (storefrontSlug) {
        params.append('storefront', storefrontSlug);
      }

      // Note: version=published is handled automatically by buildPublicUrl in storefront-client.js
      // Do NOT add it here to avoid duplicates

      // Use getPublic (not .get) - returns data directly, not wrapped in response.data
      const result = await storefrontApiClient.getPublic(`storefront/bootstrap?${params.toString()}`);

      // getPublic returns the JSON directly
      if (!result.success) {
        throw new Error(result.message || 'Bootstrap failed');
      }

      return result.data;
    },
    staleTime: (storefrontSlug || version === 'published') ? 0 : 900000, // No cache when previewing or viewing published, 15 minutes otherwise
    gcTime: 1800000, // 30 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: !!storeSlug, // Only run query if storeSlug is provided
  });
}

/**
 * Helper to determine store slug from various sources
 * @param {Object} location - React Router location object
 * @returns {string} Store slug
 */
export function determineStoreSlug(location) {
  const hostname = window.location.hostname;
  const path = location?.pathname || '';

  // Use centralized config - pages that skip store context return null
  if (shouldSkipStoreContext(path, hostname)) {
    return null;
  }

  // Check for public URL pattern: /public/:slug
  const publicUrlMatch = path.match(/^\/public\/([^\/]+)/);
  if (publicUrlMatch) {
    return publicUrlMatch[1];
  }

  // Check for custom domain (uses centralized domainConfig)
  if (isCustomDomain(hostname)) {
    return hostname;
  }

  // Fallback to localStorage
  const savedSlug = localStorage.getItem('selectedStoreSlug');
  if (savedSlug) {
    return savedSlug;
  }

  // No store found - redirect to Landing page
  if (typeof window !== 'undefined' && !path.startsWith('/Landing') && !path.startsWith('/landing')) {
    window.location.href = '/Landing';
  }
  return null;
}
