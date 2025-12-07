import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'daino_preview_mode';

/**
 * PreviewModeContext - Stores the current preview/workspace mode
 * This persists across navigation within the storefront using localStorage
 * so that clicking internal links doesn't lose the mode state.
 *
 * Modes:
 * - version=published: Shows published version, bypasses pause modal
 * - mode=workspace: Shows draft version (AI workspace)
 */
const PreviewModeContext = createContext({
  isPreviewDraftMode: false,
  isPublishedPreview: false,
  isWorkspaceMode: false,
  clearPreviewMode: () => {},
});

export function PreviewModeProvider({ children }) {
  const [isPublishedPreview, setIsPublishedPreview] = useState(false);
  const [isWorkspaceMode, setIsWorkspaceMode] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Check URL params on initial load, then persist to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const versionParam = urlParams.get('version');
    const modeParam = urlParams.get('mode');

    // Check if URL has preview params
    const urlHasPublishedPreview = versionParam === 'published';
    const urlHasWorkspaceMode = modeParam === 'workspace';

    if (urlHasPublishedPreview || urlHasWorkspaceMode) {
      // URL params take priority - save to localStorage
      const previewState = {
        isPublishedPreview: urlHasPublishedPreview,
        isWorkspaceMode: urlHasWorkspaceMode,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(previewState));
      setIsPublishedPreview(urlHasPublishedPreview);
      setIsWorkspaceMode(urlHasWorkspaceMode);
    } else if (!initialized) {
      // No URL params - check localStorage for persisted state
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const previewState = JSON.parse(stored);
          // Optional: expire after 24 hours
          const maxAge = 24 * 60 * 60 * 1000;
          if (Date.now() - previewState.timestamp < maxAge) {
            setIsPublishedPreview(previewState.isPublishedPreview || false);
            setIsWorkspaceMode(previewState.isWorkspaceMode || false);
          } else {
            // Expired - clear it
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (e) {
        console.warn('Failed to parse preview mode from localStorage:', e);
      }
    }

    setInitialized(true);
  }, [initialized]);

  // Function to clear preview mode (useful for exiting preview)
  const clearPreviewMode = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsPublishedPreview(false);
    setIsWorkspaceMode(false);
  };

  // Legacy support: isPreviewDraftMode is true if either mode is active
  const isPreviewDraftMode = isPublishedPreview || isWorkspaceMode;

  return (
    <PreviewModeContext.Provider value={{
      isPreviewDraftMode,
      isPublishedPreview,
      isWorkspaceMode,
      clearPreviewMode,
      initialized
    }}>
      {children}
    </PreviewModeContext.Provider>
  );
}

export function usePreviewMode() {
  const context = useContext(PreviewModeContext);
  if (!context) {
    // Not inside provider - check URL and localStorage directly
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const versionParam = urlParams.get('version');
      const modeParam = urlParams.get('mode');

      let isPublishedPreview = versionParam === 'published';
      let isWorkspaceMode = modeParam === 'workspace';

      // Also check localStorage if no URL params
      if (!isPublishedPreview && !isWorkspaceMode) {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const previewState = JSON.parse(stored);
            const maxAge = 24 * 60 * 60 * 1000;
            if (Date.now() - previewState.timestamp < maxAge) {
              isPublishedPreview = previewState.isPublishedPreview || false;
              isWorkspaceMode = previewState.isWorkspaceMode || false;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      return {
        isPreviewDraftMode: isPublishedPreview || isWorkspaceMode,
        isPublishedPreview,
        isWorkspaceMode,
        clearPreviewMode: () => localStorage.removeItem(STORAGE_KEY),
        initialized: true
      };
    }
    return {
      isPreviewDraftMode: false,
      isPublishedPreview: false,
      isWorkspaceMode: false,
      clearPreviewMode: () => {},
      initialized: false
    };
  }
  return context;
}

export default PreviewModeContext;
