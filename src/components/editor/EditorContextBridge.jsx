/**
 * EditorContextBridge - Re-provides React contexts inside iframe portal
 *
 * Since createPortal breaks React context inheritance, this component
 * receives context values as props and re-provides them to children
 * inside the iframe.
 *
 * This enables header components (MiniCart, HeaderSearch, etc.) to use
 * useStore() inside the ResponsiveIframe while still responding to
 * viewport changes.
 */

import React from 'react';
import TranslationContext from '@/contexts/TranslationContext';
// Import the actual StoreContext from StoreProvider so useStore() works
import { StoreContext } from '@/components/storefront/StoreProvider';

/**
 * EditorContextBridge Component
 *
 * Wraps children with context providers inside the iframe portal.
 * Context values are passed as props from outside the portal where
 * they're still accessible.
 *
 * Uses the same StoreContext as StoreProvider so that useStore() hook
 * works correctly inside the iframe.
 *
 * @param {Object} storeContextValue - Store context value (store, settings, categories, etc.)
 * @param {Object} translationContextValue - Translation context value (t, currentLanguage, etc.)
 * @param {React.ReactNode} children - Components to wrap with contexts
 */
export function EditorContextBridge({
  storeContextValue,
  translationContextValue,
  children
}) {
  // Create a minimal translation value if not provided
  const translationValue = translationContextValue || {
    t: (key, fallback) => fallback || key,
    currentLanguage: 'en',
    availableLanguages: [],
    loading: false,
    isRTL: false
  };

  return (
    <StoreContext.Provider value={storeContextValue}>
      <TranslationContext.Provider value={translationValue}>
        {children}
      </TranslationContext.Provider>
    </StoreContext.Provider>
  );
}

export default EditorContextBridge;
