import React, { useState, useEffect } from 'react';
import { StorefrontCmsBlock } from '@/api/entities';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { useStore } from '@/components/storefront/StoreProvider';
import { getBlockContent } from '@/utils/translationUtils';

/**
 * Process store variables in CMS content
 * Replaces {{store_name}}, {{store_email}}, etc. with actual store values
 */
function processStoreVariables(content, store, settings) {
    if (!content || typeof content !== 'string') return content;

    const variables = {
        store_name: store?.name || '',
        store_email: store?.contact_email || settings?.contact_email || '',
        store_phone: store?.contact_phone || settings?.contact_phone || '',
        store_address: store?.address || settings?.store_address || '',
        store_city: store?.city || settings?.store_city || '',
        store_country: store?.country || settings?.store_country || '',
        store_currency: settings?.currency_symbol || '$',
    };

    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
    });
}

// Global cache and request queue to prevent duplicate requests
const cmsBlockCache = new Map();
const pendingRequests = new Map();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryApiCall = async (apiCall, maxRetries = 2, baseDelay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      const isRateLimit = error.response?.status === 429 ||
                         error.message?.includes('Rate limit') ||
                         error.message?.includes('429');

      if (isRateLimit && i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i);
        console.warn(`CmsBlockRenderer: Rate limit hit, retrying... (Attempt ${i + 1}/${maxRetries})`);
        await delay(delayTime);
        continue;
      }

      if (isRateLimit) {
        return [];
      }

      throw error;
    }
  }
};

const loadCmsBlocksWithCache = async (storeId) => {
  // Include language in cache key to ensure proper translation switching
  const currentLanguage = localStorage.getItem('daino_language') || 'en';
  const cacheKey = `store_${storeId}_lang_${currentLanguage}`;

  // Check cache first
  if (cmsBlockCache.has(cacheKey)) {
    return cmsBlockCache.get(cacheKey);
  }

  // Check if there's already a pending request
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // Create new request to load CMS blocks
  const requestPromise = retryApiCall(async () => {
    try {
      const blocks = await StorefrontCmsBlock.findAll({ store_id: storeId });
      return blocks;
    } catch (error) {
      console.warn('⚠️ CmsBlockRenderer: Backend CMS blocks API failed, this is expected if backend is not properly configured:', error.message);
      // Return empty array instead of throwing - CMS blocks are optional
      return [];
    }
  })
    .then(blocks => {
      const result = blocks || [];
      cmsBlockCache.set(cacheKey, result);
      pendingRequests.delete(cacheKey);
      return result;
    })
    .catch(error => {
      console.warn("⚠️ CmsBlockRenderer: Failed to load CMS blocks, continuing without them:", error.message);
      pendingRequests.delete(cacheKey);
      return [];
    });

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

export default function CmsBlockRenderer({ position, page, storeId }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Try to get store from different contexts
  let adminStore = null;
  let storefrontStore = null;
  let storeIdToUse = storeId;
  
  // Try admin context first
  try {
    const { selectedStore } = useStoreSelection();
    if (selectedStore?.id) {
      adminStore = selectedStore;
    }
  } catch (e) {
    // Not in admin context - this is expected on storefront pages
  }
  
  // Try storefront context
  let storefrontSettings = null;
  try {
    const storeContext = useStore();
    if (storeContext?.store?.id) {
      storefrontStore = storeContext.store;
      storefrontSettings = storeContext.settings;
    }
  } catch (e) {
    // Not in storefront context - this is expected on admin pages
  }
  
  // Determine which store ID to use
  if (!storeIdToUse) {
    if (storefrontStore?.id) {
      storeIdToUse = storefrontStore.id;
    } else if (adminStore?.id) {
      storeIdToUse = adminStore.id;
    }
  }
  

  useEffect(() => {
    const loadBlocks = async () => {
      try {
        if (!storeIdToUse) {
          setBlocks([]);
          setLoading(false);
          return;
        }

        const allBlocks = await loadCmsBlocksWithCache(storeIdToUse);
        
        
        const filteredBlocks = allBlocks.filter(block => {
          if (!block.is_active) return false;

          // Handle new array-based placement format
          let placements = [];

          if (Array.isArray(block.placement)) {
            // New array format: ["header", "product_above_title", ...]
            placements = block.placement;
          } else if (typeof block.placement === 'string') {
            // Legacy string format: "header"
            placements = [block.placement];
          } else if (typeof block.placement === 'object' && block.placement.position) {
            // Legacy object format: { position: "above_add_to_cart", pages: ["storefront_product"] }
            placements = [block.placement.position];
          } else {
            // Fallback
            placements = ['content'];
          }

          // Check if the requested position is in the block's placements
          return placements.includes(position);
        });

        // Sort by sort_order field from the block model
        filteredBlocks.sort((a, b) => {
          const aOrder = a.sort_order || 0;
          const bOrder = b.sort_order || 0;
          return aOrder - bOrder;
        });

        setBlocks(filteredBlocks);
      } catch (error) {
        console.error("Error filtering CMS blocks:", error);
        setBlocks([]);
      } finally {
        setLoading(false);
      }
    };

    loadBlocks();
  }, [position, page, storeIdToUse]);

  // Listen for language changes and clear cache
  useEffect(() => {
    const handleLanguageChange = (event) => {
      const newLanguage = event.detail?.language;
      // Clear all cached blocks
      cmsBlockCache.clear();
      pendingRequests.clear();

      // Trigger reload by setting loading state
      setLoading(true);

      // Reload blocks with new language
      if (storeIdToUse) {
        loadCmsBlocksWithCache(storeIdToUse).then(allBlocks => {
          const filteredBlocks = allBlocks.filter(block => {
            if (!block.is_active) return false;
            let placements = [];
            if (Array.isArray(block.placement)) {
              placements = block.placement;
            } else if (typeof block.placement === 'string') {
              placements = [block.placement];
            } else if (typeof block.placement === 'object' && block.placement.position) {
              placements = [block.placement.position];
            } else {
              placements = ['content'];
            }
            return placements.includes(position);
          });

          filteredBlocks.sort((a, b) => {
            const aOrder = a.sort_order || 0;
            const bOrder = b.sort_order || 0;
            return aOrder - bOrder;
          });

          setBlocks(filteredBlocks);
          setLoading(false);
        });
      }
    };

    window.addEventListener('languageChanged', handleLanguageChange);
    return () => window.removeEventListener('languageChanged', handleLanguageChange);
  }, [position, storeIdToUse]);

  if (loading) {
    return null; // Don't show loading spinner for CMS blocks
  }

  if (blocks.length === 0) {
    return null;
  }

  // Get store and settings for variable processing
  const storeForVariables = storefrontStore || adminStore;
  const settingsForVariables = storefrontSettings;

  return (
    <div className="cms-blocks">
      {blocks.map((block) => {
        const rawContent = getBlockContent(block);
        if (!rawContent) return null;

        // Process store variables ({{store_name}}, {{store_email}}, etc.)
        const content = processStoreVariables(rawContent, storeForVariables, settingsForVariables);

        return (
          <div
            key={block.id}
            className="cms-block relative"
          >
            {block.demo && (
              <div className="absolute top-2 right-2 z-10 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 border border-amber-300 rounded-md opacity-75">
                Demo Content
              </div>
            )}
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        );
      })}
    </div>
  );
}