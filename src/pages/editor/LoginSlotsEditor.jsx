/**
 * LoginSlotsEditor - Login/Auth page slot editor
 * - Uses preprocessSlotData for consistent rendering with storefront
 * - Supports login customization
 * - Maintainable structure
 */

import { useMemo } from 'react';
import { LogIn, UserPlus } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { useStoreSelection } from '@/contexts/StoreSelectionContext';
import { useSlotConfiguration, useCategories } from '@/hooks/useApiQueries';
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';

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

  // Fetch header and categories for combined header + page editing
  const { data: headerConfig } = useSlotConfiguration(storeId, 'header', { enabled: !!storeId });
  const { data: categories = [] } = useCategories(storeId, { enabled: !!storeId });

  // Build config with header
  const configWithHeader = useMemo(() => ({
    ...loginEditorConfig,
    // Header integration - show header + page content together
    includeHeader: true,
    headerSlots: headerConfig?.slots || null,
    headerContext: {
      store: selectedStore,
      settings: selectedStore?.settings || {},
      categories: categories,
      languages: [],
      currentLanguage: 'en',
      mobileMenuOpen: false,
      mobileSearchOpen: false,
      setMobileMenuOpen: () => {},
      setMobileSearchOpen: () => {},
      navigate: () => {},
      location: { pathname: '/login' }
    }
  }), [headerConfig, selectedStore, categories]);

  return (
    <UnifiedSlotsEditor
      config={configWithHeader}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};

export default LoginSlotsEditor;
