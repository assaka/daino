/**
 * AccountSlotsEditor - Customer account page slot editor
 * - Uses UnifiedSlotsEditor
 * - Supports account customization
 * - Maintainable structure
 */

import { User, UserCircle } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";

// Generate account context based on view mode
const generateAccountContext = (viewMode) => {
  // Intro view - no user logged in
  if (viewMode === 'intro') {
    return {
      user: null,
      isLoggedIn: false,
      activeTab: null,
      orders: [],
      addresses: [],
      wishlistItems: []
    };
  }

  // Logged in views
  return {
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
};

// Account Editor Configuration
// Config structure (views, cmsBlocks, slots) comes from database via UnifiedSlotsEditor
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
  slotComponents: {},
  generateContext: generateAccountContext,
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
