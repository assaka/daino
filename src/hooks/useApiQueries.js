/**
 * React Query Hooks for API Calls
 *
 * These hooks provide automatic request deduplication, caching, and retry logic
 * to significantly reduce the number of API calls made by the application.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import { User } from '@/api/entities';
import {
  CustomerWishlist,
  StorefrontProduct,
  StorefrontStore,
  StorefrontCategory,
  StorefrontProductLabel,
  StorefrontTax,
  StorefrontAttribute,
  StorefrontAttributeSet,
  StorefrontSeoTemplate
} from '@/api/storefront-entities';
import api from '@/utils/api';
import { getCurrentLanguage } from '@/utils/translationUtils';
import { usePreviewMode } from '@/contexts/PreviewModeContext';

/**
 * Hook to fetch current user (auth/me)
 * Automatically deduplicates multiple simultaneous calls
 */
export const useUser = (options = {}) => {
  return useQuery({
    queryKey: queryKeys.user.me(),
    queryFn: async () => {
      try {
        const userData = await User.me();
        return userData;
      } catch (error) {
        // Return null for unauthenticated users
        if (error.response?.status === 401) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 300000, // 5 minutes - user data doesn't change often
    gcTime: 600000, // 10 minutes cache
    retry: 1, // Only retry once for auth calls
    refetchOnMount: false, // CRITICAL: Don't refetch when component remounts
    refetchOnWindowFocus: false, // CRITICAL: Don't refetch on window focus
    refetchOnReconnect: false, // CRITICAL: Don't refetch on reconnect
    ...options
  });
};

/**
 * Hook to fetch product by slug
 * Includes language in the cache key for proper i18n
 */
export const useProduct = (slug, storeId, options = {}) => {
  const language = getCurrentLanguage();

  return useQuery({
    queryKey: queryKeys.product.bySlug(slug, storeId, language),
    queryFn: async () => {
      const response = await fetch(
        `/api/public/products/by-slug/${encodeURIComponent(slug)}/full?store_id=${storeId}`,
        {
          headers: {
            'X-Language': language
          }
        }
      );

      if (!response.ok) {
        throw new Error('Product not found');
      }

      const responseData = await response.json();
      return responseData.data;
    },
    enabled: !!(slug && storeId), // Only run if slug and storeId are provided
    staleTime: 120000, // 2 minutes - products change moderately
    gcTime: 300000, // 5 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch wishlist items
 * Supports both guest and authenticated users
 */
export const useWishlist = (storeId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.wishlist.items(storeId),
    queryFn: async () => {
      try {
        const items = await CustomerWishlist.getItems(storeId);
        return Array.isArray(items) ? items : [];
      } catch (error) {
        return [];
      }
    },
    enabled: !!storeId,
    staleTime: 120000, // 2 minutes - reduces unnecessary refetches
    gcTime: 300000, // 5 minutes cache
    retry: 1,
    refetchOnMount: false, // CRITICAL: Prevent duplicate calls
    refetchOnWindowFocus: false, // CRITICAL: Prevent duplicate calls
    refetchOnReconnect: false, // CRITICAL: Prevent duplicate calls
    ...options
  });
};

/**
 * Hook to add item to wishlist
 */
export const useAddToWishlist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, storeId }) => {
      return await CustomerWishlist.addItem(productId, storeId);
    },
    onSuccess: (_, variables) => {
      // Invalidate wishlist queries to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.wishlist.items(variables.storeId)
      });

      // Dispatch event for components not using React Query
      window.dispatchEvent(new CustomEvent('wishlistUpdated'));
    }
  });
};

/**
 * Hook to remove item from wishlist
 */
export const useRemoveFromWishlist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, storeId }) => {
      return await CustomerWishlist.removeItem(productId, storeId);
    },
    onSuccess: (_, variables) => {
      // Invalidate wishlist queries to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.wishlist.items(variables.storeId)
      });

      // Dispatch event for components not using React Query
      window.dispatchEvent(new CustomEvent('wishlistUpdated'));
    }
  });
};

/**
 * Hook to fetch UI translations
 */
export const useTranslations = (storeId, language, options = {}) => {
  return useQuery({
    queryKey: queryKeys.translation.uiLabels(language, storeId),
    queryFn: async () => {
      if (!storeId) {
        return {};
      }

      const response = await api.get(`/translations/ui-labels?store_id=${storeId}&lang=${language}`);

      if (response && response.success && response.data && response.data.labels) {
        return response.data.labels;
      }

      return {};
    },
    enabled: !!(language && storeId),
    staleTime: 600000, // 10 minutes - translations rarely change
    gcTime: 1800000, // 30 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch store by slug
 */
export const useStore = (slug, options = {}) => {
  return useQuery({
    queryKey: queryKeys.store.bySlug(slug),
    queryFn: async () => {
      const stores = await StorefrontStore.filter({ slug });
      return stores?.[0] || null;
    },
    enabled: !!slug,
    staleTime: 600000, // 10 minutes - store data rarely changes
    gcTime: 1800000, // 30 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch categories
 */
export const useCategories = (storeId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.category.list(storeId),
    queryFn: async () => {
      const categories = await StorefrontCategory.filter({
        store_id: storeId,
        limit: 1000
      });
      return categories || [];
    },
    enabled: !!storeId,
    staleTime: 600000, // 10 minutes - categories rarely change
    gcTime: 1800000, // 30 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch product labels
 */
export const useProductLabels = (storeId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.productLabel.list(storeId),
    queryFn: async () => {
      const labels = await StorefrontProductLabel.filter({ store_id: storeId });
      return labels || [];
    },
    enabled: !!storeId,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch taxes
 */
export const useTaxes = (storeId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.tax.list(storeId),
    queryFn: async () => {
      const taxes = await StorefrontTax.filter({ store_id: storeId });
      return taxes || [];
    },
    enabled: !!storeId,
    staleTime: 300000, // 5 minutes - taxes don't change often
    gcTime: 600000, // 10 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch attributes
 */
export const useAttributes = (storeId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.attribute.list(storeId),
    queryFn: async () => {
      const attributes = await StorefrontAttribute.filter({ store_id: storeId });
      return attributes || [];
    },
    enabled: !!storeId,
    staleTime: 600000, // 10 minutes - attributes rarely change
    gcTime: 1800000, // 30 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch filterable attributes
 */
export const useFilterableAttributes = (storeId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.attribute.filterable(storeId),
    queryFn: async () => {
      const attributes = await StorefrontAttribute.filter({
        store_id: storeId,
        is_filterable: true
      });
      return attributes || [];
    },
    enabled: !!storeId,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch attribute sets
 */
export const useAttributeSets = (storeId, options = {}) => {
  return useQuery({
    queryKey: [...queryKeys.attribute.all, 'sets', storeId],
    queryFn: async () => {
      const sets = await StorefrontAttributeSet.filter({ store_id: storeId });
      return sets || [];
    },
    enabled: !!storeId,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch SEO templates
 */
export const useSeoTemplates = (storeId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.seo.templates(storeId),
    queryFn: async () => {
      const templates = await StorefrontSeoTemplate.filter({ store_id: storeId });
      return templates || [];
    },
    enabled: !!storeId,
    staleTime: 600000, // 10 minutes - SEO templates rarely change
    gcTime: 1800000, // 30 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch cart items
 */
export const useCart = (sessionId, userId, options = {}) => {
  return useQuery({
    queryKey: queryKeys.cart.items(sessionId, userId),
    queryFn: async () => {
      // Import cartService dynamically to avoid circular dependencies
      const { default: cartService } = await import('@/services/cartService');
      return await cartService.getCart();
    },
    enabled: !!(sessionId || userId),
    staleTime: 10000, // 10 seconds - cart changes frequently
    gcTime: 30000, // 30 seconds cache
    retry: 1,
    ...options
  });
};

/**
 * Hook to fetch category by slug with products
 */
export const useCategory = (slug, storeId, options = {}) => {
  const language = getCurrentLanguage();

  return useQuery({
    queryKey: [...queryKeys.category.all, 'slug', slug, storeId, language],
    queryFn: async () => {
      const response = await fetch(
        `/api/public/categories/by-slug/${encodeURIComponent(slug)}/full?store_id=${storeId}`,
        {
          headers: {
            'X-Language': language
          }
        }
      );

      if (!response.ok) {
        throw new Error('Category not found');
      }

      const responseData = await response.json();
      return responseData.data;
    },
    enabled: !!(slug && storeId),
    staleTime: 120000, // 2 minutes - categories change moderately
    gcTime: 300000, // 5 minutes cache
    retry: 2,
    ...options
  });
};

/**
 * Hook to fetch slot configuration for a page type
 * In workspace mode (AI Workspace), loads draft configuration instead of published
 * When version=published, always loads published regardless of other params
 */
export const useSlotConfiguration = (storeId, pageType, options = {}) => {
  // Use context for preview mode (persists across navigation)
  const { isPublishedPreview, isWorkspaceMode } = usePreviewMode();

  // Check URL params - version=published takes priority
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const isViewingPublished = urlParams?.get('version') === 'published' || isPublishedPreview;
  // Support both mode=workspace (from AI workspace iframe) and workspace=true (legacy)
  const urlWorkspaceMode = urlParams?.get('preview') === 'draft' || urlParams?.get('mode') === 'workspace' || urlParams?.get('workspace') === 'true';

  // Only load draft when in workspace mode AND NOT viewing published version
  const shouldLoadDraft = !isViewingPublished && (isWorkspaceMode || urlWorkspaceMode);

  return useQuery({
    // Use different query key for draft mode to avoid cache conflicts
    queryKey: shouldLoadDraft
      ? [...queryKeys.slot.config(storeId, pageType), 'draft']
      : queryKeys.slot.config(storeId, pageType),
    queryFn: async () => {
      const { default: slotConfigurationService } = await import('@/services/slotConfigurationService');

      // Load draft or published configuration based on mode
      const response = shouldLoadDraft
        ? await slotConfigurationService.getDraftConfiguration(storeId, pageType)
        : await slotConfigurationService.getPublishedConfiguration(storeId, pageType);

      if (response.success && response.data &&
          response.data.configuration &&
          response.data.configuration.slots &&
          Object.keys(response.data.configuration.slots).length > 0) {
        return response.data.configuration;
      }

      return null; // No config found
    },
    enabled: !!(storeId && pageType),
    // In workspace mode, always fetch fresh to pick up editor changes
    staleTime: shouldLoadDraft ? 0 : 300000, // Always stale in draft mode, 5 min for published
    gcTime: shouldLoadDraft ? 30000 : 600000, // 30s cache in draft mode, 10 min for published
    refetchOnMount: shouldLoadDraft ? 'always' : true, // Always refetch in draft mode
    retry: 2,
    ...options
  });
};
