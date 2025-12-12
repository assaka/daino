/**
 * LoginSlotsEditor - Login/Auth page slot editor
 * - Uses preprocessSlotData for consistent rendering with storefront
 * - Supports login customization
 * - Maintainable structure
 */

import { useMemo, useCallback } from 'react';
import { LogIn, UserPlus } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { useCategories } from '@/hooks/useApiQueries';
import useDraftConfiguration from '@/hooks/useDraftConfiguration';
import { EditorStoreProvider } from '@/components/editor/EditorStoreProvider';
import { buildEditorHeaderContext } from '@/components/editor/editorHeaderUtils';
import { useAIWorkspace, PAGE_TYPES } from '@/contexts/AIWorkspaceContext';
import slotConfigurationService from '@/services/slotConfigurationService';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/login');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid login config from API');
      return null;
    }
    return result.data.slots;
  } catch (error) {
    console.error('Failed to load login config:', error);
    return null;
  }
};

// Generate login context based on view mode
const generateLoginContext = (viewMode, selectedStore) => {
  const storeSettings = selectedStore?.settings || {};

  const rawData = {
    authMode: viewMode === 'register' ? 'register' : 'login',
    showSocialLogin: true,
    redirectUrl: null
  };

  // Use preprocessSlotData for consistent rendering
  return preprocessSlotData('login', rawData, selectedStore || {}, storeSettings, {
    translations: {}
  });
};

// Login Editor Configuration
const loginEditorConfig = {
  pageType: 'login',
  pageName: 'Login/Register',
  slotType: 'login_layout',
  defaultViewMode: 'login',
  viewModes: [
    { key: 'login', label: 'Login', icon: LogIn },
    { key: 'register', label: 'Register', icon: UserPlus }
  ],
  generateContext: generateLoginContext,
  createDefaultSlots,
  viewModeAdjustments: {},
  cmsBlockPositions: ['login_top', 'login_bottom', 'login_sidebar']
};

const LoginSlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'login'
}) => {
  const { selectedStore, getSelectedStoreId } = useStoreSelection();
  const storeId = getSelectedStoreId();

  // Get selectPage from AIWorkspace to enable "Edit Header" functionality
  const { selectPage } = useAIWorkspace();

  // Fetch categories for header context
  const { data: categories = [] } = useCategories(storeId, { enabled: !!storeId });

  // Fetch header DRAFT configuration for combined header + page editing
  // Use useDraftConfiguration to always load draft (not published) in editor
  const { draftConfig: headerDraftConfig } = useDraftConfiguration(storeId, 'header');
  const headerConfig = headerDraftConfig?.configuration || null;

  // Header save callback - saves header config changes to database
  const handleHeaderSave = useCallback(async (headerConfigToSave) => {
    if (!storeId) return;
    try {
      await slotConfigurationService.saveConfiguration(storeId, headerConfigToSave, 'header');
      console.log('[LoginSlotsEditor] Header config saved');
    } catch (error) {
      console.error('[LoginSlotsEditor] Failed to save header config:', error);
    }
  }, [storeId]);

  // Build config with header integration
  const enhancedConfig = useMemo(() => ({
    ...loginEditorConfig,
    includeHeader: true,
    headerSlots: headerConfig?.slots || null,
    headerContext: buildEditorHeaderContext({
      store: selectedStore,
      settings: selectedStore?.settings || {},
      categories,
      viewport: 'desktop',
      pathname: '/login'
    }),
    onEditHeader: () => selectPage(PAGE_TYPES.HEADER),
    onHeaderSave: handleHeaderSave
  }), [headerConfig, selectedStore, categories, selectPage, handleHeaderSave]);

  return (
    <EditorStoreProvider>
      <UnifiedSlotsEditor
        config={enhancedConfig}
        mode={mode}
        onSave={onSave}
        viewMode={viewMode}
      />
    </EditorStoreProvider>
  );
};

export default LoginSlotsEditor;
