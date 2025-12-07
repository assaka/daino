import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAIWorkspace, PAGE_TYPES, VIEWPORT_MODES } from '@/contexts/AIWorkspaceContext';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { Loader2, RefreshCw, ExternalLink, Monitor, Tablet, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getExternalStoreUrl, getStoreBaseUrl, createPublicUrl } from '@/utils/urlUtils';
import { StorefrontProduct, StorefrontCategory } from '@/api/storefront-entities';

/**
 * WorkspaceStorefrontPreview - Interactive storefront preview in iframe
 * Shows the actual live storefront homepage with full clickable features
 */
const WorkspaceStorefrontPreview = () => {
  const { selectedPageType, viewportMode, setViewportMode, previewRefreshTrigger } = useAIWorkspace();
  const { getSelectedStoreId, selectedStore } = useStoreSelection();

  const iframeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState('');
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(Date.now()); // Force refresh on mount

  // Refresh preview when trigger changes (e.g., after AI styling changes)
  useEffect(() => {
    if (previewRefreshTrigger > 0) {
      setRefreshKey(Date.now());
      setIsLoading(true);
    }
  }, [previewRefreshTrigger]);
  const [firstProductSlug, setFirstProductSlug] = useState(null);
  const [firstCategorySlug, setFirstCategorySlug] = useState(null);

  const storeId = getSelectedStoreId();
  const storeSlug = selectedStore?.slug || selectedStore?.code || 'store';

  // Fetch first product and category from store for page previews
  useEffect(() => {
    const fetchFirstProduct = async () => {
      if (!storeId) return;
      try {
        const products = await StorefrontProduct.findAll({ store_id: storeId, limit: 1 });
        if (products && products.length > 0) {
          setFirstProductSlug(products[0].slug || products[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch first product:', err);
      }
    };

    const fetchFirstCategory = async () => {
      if (!storeId) return;
      try {
        const categories = await StorefrontCategory.findAll({ store_id: storeId, limit: 1 });
        if (categories && categories.length > 0) {
          setFirstCategorySlug(categories[0].slug || categories[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch first category:', err);
      }
    };

    fetchFirstProduct();
    fetchFirstCategory();
  }, [storeId]);

  // Auto-refresh on component mount (when switching from Editor to Preview)
  useEffect(() => {
    // Generate new refresh key to bust cache
    setRefreshKey(Date.now());
    setIsLoading(true);
  }, []); // Only on mount

  // Build the storefront URL
  const storefrontUrl = useMemo(() => {
    // Get the base URL for the store
    const baseUrl = getStoreBaseUrl(selectedStore);

    // Build the full storefront URL with draft mode parameter
    const url = getExternalStoreUrl(storeSlug, '', baseUrl);

    // Add workspace mode to show draft version and bypass pause modal
    return `${url}?mode=workspace&_t=${refreshKey}`;
  }, [storeSlug, selectedStore, refreshKey]);

  // Map page types to storefront paths
  const getPagePath = (pageType) => {
    switch (pageType) {
      case PAGE_TYPES.PRODUCT:
        // Use actual product from store collection
        return firstProductSlug ? `product/${firstProductSlug}` : null;
      case PAGE_TYPES.CATEGORY:
        // Use actual category from store collection
        return firstCategorySlug ? `category/${firstCategorySlug}` : null;
      case PAGE_TYPES.CART:
        return 'cart';
      case PAGE_TYPES.CHECKOUT:
        return 'checkout';
      case PAGE_TYPES.ACCOUNT:
        return 'account';
      case PAGE_TYPES.LOGIN:
        return 'login';
      case PAGE_TYPES.SUCCESS:
        return 'order-success';
      case PAGE_TYPES.HEADER:
      case PAGE_TYPES.HOMEPAGE:
      default:
        return ''; // Homepage
    }
  };

  // Update iframe URL based on selected page type being edited
  useEffect(() => {
    const baseUrl = getStoreBaseUrl(selectedStore);
    const pagePath = getPagePath(selectedPageType);
    // If pagePath is null (e.g., product page but product not loaded yet), show homepage
    const effectivePath = pagePath === null ? '' : pagePath;
    const newUrl = getExternalStoreUrl(storeSlug, effectivePath, baseUrl);
    setCurrentUrl(`${newUrl}?mode=workspace&_t=${refreshKey}`);
  }, [storeSlug, selectedStore, refreshKey, selectedPageType, firstProductSlug, firstCategorySlug]);

  // Viewport dimensions
  const viewportStyles = useMemo(() => {
    switch (viewportMode) {
      case VIEWPORT_MODES.MOBILE:
        return { width: '375px', height: '667px' };
      case VIEWPORT_MODES.TABLET:
        return { width: '768px', height: '1024px' };
      default:
        return { width: '100%', height: '100%' };
    }
  }, [viewportMode]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load storefront preview');
  };

  // Refresh iframe with new cache-busting key
  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshKey(Date.now()); // This will update currentUrl via useEffect
  };

  // Open in new tab
  const handleOpenExternal = () => {
    window.open(currentUrl || storefrontUrl, '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Preview Controls */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b shrink-0 h-12">
        <div className="flex items-center gap-2">
          {/* Viewport toggles */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewportMode === VIEWPORT_MODES.DESKTOP ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-none"
              onClick={() => setViewportMode(VIEWPORT_MODES.DESKTOP)}
              title="Desktop"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={viewportMode === VIEWPORT_MODES.TABLET ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-none border-x"
              onClick={() => setViewportMode(VIEWPORT_MODES.TABLET)}
              title="Tablet"
            >
              <Tablet className="h-4 w-4" />
            </Button>
            <Button
              variant={viewportMode === VIEWPORT_MODES.MOBILE ? 'default' : 'ghost'}
              size="sm"
              className="h-8 rounded-none"
              onClick={() => setViewportMode(VIEWPORT_MODES.MOBILE)}
              title="Mobile"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* URL bar */}
        <div className="flex-1 mx-4 max-w-xl">
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {currentUrl || storefrontUrl}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={handleOpenExternal}
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Badge */}
      <div className="px-4 py-1 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
        <p className="text-xs text-yellow-700 dark:text-yellow-400 text-center">
          Live Preview - Click and interact with your storefront. Changes from Editor will reflect after refresh.
        </p>
      </div>

      {/* Iframe Container */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        <div
          className={cn(
            'bg-white shadow-2xl transition-all duration-300 relative',
            viewportMode !== VIEWPORT_MODES.DESKTOP && 'rounded-lg overflow-hidden border-8 border-gray-800'
          )}
          style={{
            width: viewportStyles.width,
            height: viewportMode === VIEWPORT_MODES.DESKTOP ? 'calc(100% - 1rem)' : viewportStyles.height,
            maxHeight: viewportMode === VIEWPORT_MODES.DESKTOP ? 'none' : '90vh'
          }}
        >
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-10">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-sm text-gray-500">Loading storefront...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-10">
              <div className="text-center p-4">
                <p className="text-red-500 mb-4">{error}</p>
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Iframe */}
          <iframe
            ref={iframeRef}
            src={currentUrl || storefrontUrl}
            className="w-full h-full border-0"
            title="Storefront Preview"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>

        {/* Device frame for mobile/tablet */}
        {viewportMode === VIEWPORT_MODES.MOBILE && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-gray-300 rounded-full pointer-events-none" />
        )}
      </div>
    </div>
  );
};

export default WorkspaceStorefrontPreview;
