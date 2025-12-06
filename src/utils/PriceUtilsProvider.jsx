import React, { useEffect, useRef } from 'react';
import { useStore } from '@/components/storefront/StoreProvider';
import { _setStoreContext } from './priceUtils';

/**
 * PriceUtilsProvider - Initializes the price utils with store context
 * This component should wrap your app to enable context-aware price formatting
 */
export const PriceUtilsProvider = ({ children }) => {
  const storeContext = useStore();
  const hasSetContext = useRef(false);

  // Set context synchronously during render to avoid race conditions
  // where formatPrice is called before useEffect runs
  if (storeContext && !hasSetContext.current) {
    _setStoreContext(storeContext);
    hasSetContext.current = true;
  }

  // Also update in useEffect for when context changes
  useEffect(() => {
    if (storeContext) {
      _setStoreContext(storeContext);
    }
  }, [storeContext]);

  return <>{children}</>;
};

export default PriceUtilsProvider;
