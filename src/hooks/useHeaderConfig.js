import { useState, useEffect } from 'react';
import { useLayoutConfig } from './useSlotConfiguration';
import { useStore } from '@/components/storefront/StoreProvider';
import { usePreviewMode } from '@/contexts/PreviewModeContext';

/**
 * Custom hook for loading header configuration
 * Uses bootstrap headerSlotConfig if available (no API call!)
 * In draft preview mode, always fetches fresh draft config
 * @param {Object} store - The store object
 * @returns {Object} - { headerSlots, headerConfigLoaded, reloadHeaderConfig }
 */
export function useHeaderConfig(store) {
  const { headerSlotConfig: bootstrapHeaderConfig } = useStore() || {};

  // Use context for preview mode (persists across navigation)
  const { isPreviewDraftMode: contextPreviewMode } = usePreviewMode();

  // Also check URL as fallback
  const urlPreviewMode = typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('preview') === 'draft' ||
     new URLSearchParams(window.location.search).get('workspace') === 'true');

  const isPreviewDraftMode = contextPreviewMode || urlPreviewMode;

  // In draft preview mode, always fetch fresh draft config (skip bootstrap)
  // Otherwise, only fetch if bootstrap didn't provide config
  const shouldFetch = isPreviewDraftMode || !bootstrapHeaderConfig;

  const { layoutConfig, configLoaded, reloadConfig } = useLayoutConfig(
    store,
    'header',
    null, // No static fallback - configs come from database
    shouldFetch
  );

  const [headerSlots, setHeaderSlots] = useState(null);
  const [headerConfigLoaded, setHeaderConfigLoaded] = useState(false);

  useEffect(() => {
    // Priority 1: Use bootstrap data if available (no API call!) - but not in draft preview mode
    if (!isPreviewDraftMode && bootstrapHeaderConfig?.slots) {
      setHeaderSlots(bootstrapHeaderConfig.slots);
      setHeaderConfigLoaded(true);
      return;
    }

    // Priority 2: Use fetched layout config (always used in draft preview mode)
    if (configLoaded && layoutConfig?.slots) {
      setHeaderSlots(layoutConfig.slots);
      setHeaderConfigLoaded(true);
    }
  }, [configLoaded, layoutConfig, bootstrapHeaderConfig, isPreviewDraftMode]);

  return {
    headerSlots,
    headerConfigLoaded,
    reloadHeaderConfig: reloadConfig
  };
}

export default useHeaderConfig;
