import { useEffect, useCallback } from 'react';

/**
 * useAIRefresh - Hook to trigger page refresh when AI chat performs actions
 *
 * This hook listens for 'ai-admin-refresh' events dispatched by the AI chat
 * and calls the provided callback to refresh page data silently.
 *
 * @param {Function} callback - Function to call when refresh is triggered (e.g., loadData)
 * @param {Object} options - Optional configuration
 * @param {string[]} options.actions - Only refresh for specific actions (e.g., ['create', 'update', 'delete'])
 *
 * @example
 * // Basic usage - refresh on any AI action
 * useAIRefresh(loadData);
 *
 * @example
 * // Only refresh for specific actions
 * useAIRefresh(loadData, { actions: ['create', 'update', 'delete'] });
 *
 * @example
 * // With React Query
 * useAIRefresh(() => queryClient.invalidateQueries(['products']));
 */
export const useAIRefresh = (callback, options = {}) => {
  const { actions } = options;

  const handleRefresh = useCallback((event) => {
    const { action } = event.detail || {};
    console.log('[useAIRefresh] Received ai-admin-refresh event:', { action, detail: event.detail });

    // If specific actions are defined, only refresh for those
    if (actions && actions.length > 0) {
      if (!action || !actions.includes(action)) {
        console.log('[useAIRefresh] Skipping refresh - action not in filter list');
        return;
      }
    }

    // Call the refresh callback
    console.log('[useAIRefresh] Calling refresh callback');
    callback?.();
  }, [callback, actions]);

  useEffect(() => {
    window.addEventListener('ai-admin-refresh', handleRefresh);
    return () => window.removeEventListener('ai-admin-refresh', handleRefresh);
  }, [handleRefresh]);
};

/**
 * Dispatch an AI refresh event
 * Call this after AI completes an action that modifies data
 *
 * @param {string} action - The action that was performed (e.g., 'create', 'update', 'delete')
 */
export const dispatchAIRefresh = (action) => {
  window.dispatchEvent(new CustomEvent('ai-admin-refresh', {
    detail: { action, timestamp: Date.now() }
  }));
};

export default useAIRefresh;
