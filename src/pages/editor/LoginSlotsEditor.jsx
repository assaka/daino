/**
 * LoginSlotsEditor - Login/Auth page slot editor
 * - Uses UnifiedSlotsEditor
 * - Supports login customization
 * - Maintainable structure
 */

import { LogIn, UserPlus } from "lucide-react";
import UnifiedSlotsEditor from "@/components/editor/UnifiedSlotsEditor";

// Generate login context based on view mode
const generateLoginContext = (viewMode) => ({
  authMode: viewMode === 'register' ? 'register' : 'login',
  showSocialLogin: true,
  redirectUrl: null
});

// Login Editor Configuration
// Config structure (views, cmsBlocks, slots) comes from database via UnifiedSlotsEditor
const loginEditorConfig = {
  pageType: 'login',
  pageName: 'Login/Register',
  slotType: 'login_layout',
  defaultViewMode: 'login',
  viewModes: [
    { key: 'login', label: 'Login', icon: LogIn },
    { key: 'register', label: 'Register', icon: UserPlus }
  ],
  slotComponents: {},
  generateContext: generateLoginContext,
  viewModeAdjustments: {},
  cmsBlockPositions: ['login_top', 'login_bottom', 'login_sidebar']
};

const LoginSlotsEditor = ({
  mode = 'edit',
  onSave,
  viewMode = 'login'
}) => {
  return (
    <UnifiedSlotsEditor
      config={loginEditorConfig}
      mode={mode}
      onSave={onSave}
      viewMode={viewMode}
    />
  );
};

export default LoginSlotsEditor;
