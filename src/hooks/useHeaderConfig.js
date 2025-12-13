import { useState, useEffect } from 'react';
import { useLayoutConfig } from './useSlotConfiguration';
import { useStore } from '@/components/storefront/StoreProvider';
import { usePreviewMode } from '@/contexts/PreviewModeContext';

/**
 * Custom hook for loading header configuration
 * Uses bootstrap headerSlotConfig if available (no API call!)
 * In workspace mode, always fetches fresh draft config
 * @param {Object} store - The store object
 * @returns {Object} - { headerSlots, headerConfigLoaded, reloadHeaderConfig }
 */
export function useHeaderConfig(store) {
  const { headerSlotConfig: bootstrapHeaderConfig } = useStore() || {};

  // Use context for preview mode (persists across navigation)
  const { isPublishedPreview, isWorkspaceMode } = usePreviewMode();

  // Also check URL as fallback for workspace mode only
  const urlWorkspaceMode = typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('preview') === 'draft' ||
     new URLSearchParams(window.location.search).get('workspace') === 'true');

  // Only load draft when in workspace mode (NOT when viewing published version)
  // isPublishedPreview means "show published version only", NOT "load draft"
  const shouldLoadDraft = (isWorkspaceMode || urlWorkspaceMode) && !isPublishedPreview;

  // In workspace mode, always fetch fresh draft config (skip bootstrap)
  // Otherwise, only fetch if bootstrap didn't provide config
  const shouldFetch = shouldLoadDraft || !bootstrapHeaderConfig;

  const { layoutConfig, configLoaded, reloadConfig } = useLayoutConfig(
    store,
    'header',
    null, // No static fallback - configs come from database
    shouldFetch
  );

  const [headerSlots, setHeaderSlots] = useState(null);
  const [headerConfigLoaded, setHeaderConfigLoaded] = useState(false);

  useEffect(() => {
    // Priority 1: Use bootstrap data if available (no API call!) - but not in workspace mode
    if (!shouldLoadDraft && bootstrapHeaderConfig?.slots) {
      setHeaderSlots(bootstrapHeaderConfig.slots);
      setHeaderConfigLoaded(true);
      return;
    }

    // Priority 2: Use fetched layout config (always used in workspace mode)
    if (configLoaded && layoutConfig?.slots) {
      setHeaderSlots(layoutConfig.slots);
      setHeaderConfigLoaded(true);
    }
  }, [configLoaded, layoutConfig, bootstrapHeaderConfig, shouldLoadDraft]);

  return {
    headerSlots,
    headerConfigLoaded,
    reloadHeaderConfig: reloadConfig
  };
}

export default useHeaderConfig;
