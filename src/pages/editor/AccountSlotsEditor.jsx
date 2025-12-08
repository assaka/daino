/**
 * AccountSlotsEditor - Customer account page slot editor
 * - Uses preprocessSlotData for consistent rendering with storefront
 * - Supports account customization
 * - Maintainable structure
 */

import { User, UserCircle } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";
import { preprocessSlotData } from '@/utils/slotDataPreprocessor';

// Create default slots function - fetches from backend API as fallback when no draft exists
const createDefaultSlots = async () => {
  try {
    const response = await fetch('/api/slot-configurations/defaults/account');
    const result = await response.json();
    if (!result.success || !result.data?.slots) {
      console.error('Invalid account config from API');
      return null;
    }
    return result.data.slots;
  } catch (error) {
    console.error('Failed to load account config:', error);
    return null;
  }
};

// Generate account context based on view mode
const generateAccountContext = (viewMode, selectedStore) => {
  const storeSettings = selectedStore?.settings || {};

  // Intro view - no user logged in
  const rawData = viewMode === 'intro' ? {
    user: null,
    isLoggedIn: false,
    activeTab: null,
    orders: [],
    addresses: [],
    wishlistItems: []
  } : {
    // Logged in views
    user: {
      id: 1,
      full_name: 'John Doe',
      email: 'john@example.com',
      role: 'customer'
    },
    isLoggedIn: true,
    activeTab: viewMode === 'profile' ? 'profile' : 'overview',
    orders: [],
    addresses: [],
    wishlistItems: []
  };

  // Use preprocessSlotData for consistent rendering
  return preprocessSlotData('account', rawData, selectedStore || {}, storeSettings, {
    translations: {}
  });
};

// Account Editor Configuration
const accountEditorConfig = {
  pageType: 'account',
  pageName: 'Customer Account',
  slotType: 'account_layout',
  defaultViewMode: 'overview',
  viewModes: [
    { key: 'intro', label: 'Intro', icon: UserCircle },
    { key: 'overview', label: 'Overview', icon: User },
    { key: 'profile', label: 'Profile', icon: User }
  ],
  generateContext: generateAccountContext,
  createDefaultSlots,
  viewModeAdjustments: {},
  cmsBlockPositions: ['account_top', 'account_bottom', 'account_sidebar']
};

const AccountSlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'overview'
}) => {
  return (
    <UnifiedSlotsEditor
      config={accountEditorConfig}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};

export default AccountSlotsEditor;
