/**
 * Account and Login Slot Components
 * Unified components for account and login pages
 * Updated: Force rebuild
 */

import React from 'react';
import { createSlotComponent, registerSlotComponent } from './SlotComponentRegistry';
import { CustomerAuth } from '@/api/storefront-entities';
import { useNavigate, useParams } from 'react-router-dom';
import { createPublicUrl } from '@/utils/urlUtils';
import { useStore } from '@/components/storefront/StoreProvider';
import { useTranslation } from '@/contexts/TranslationContext';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePreviewMode } from '@/contexts/PreviewModeContext';
import storefrontApiClient from '@/api/storefront-client';
import { SaveButton } from '@/components/ui/save-button';
import { trackCustomerLogin, trackCustomerRegistration } from '@/components/storefront/DataLayerManager';

// Helper function to replace placeholders with React components
const replacePlaceholders = (text, replacements) => {
  const placeholderRegex = /\{(\w+)\}/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = placeholderRegex.exec(text)) !== null) {
    // Add text before placeholder
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Add replacement component
    const placeholderName = match[1];
    if (replacements[placeholderName]) {
      parts.push(replacements[placeholderName]);
    } else {
      parts.push(match[0]); // Keep original if no replacement
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.map((part, index) =>
    typeof part === 'string' ? <span key={index}>{part}</span> : React.cloneElement(part, { key: index })
  );
};

/**
 * UserProfileSlot - User profile display with avatar and info
 */
const UserProfileSlot = createSlotComponent({
  name: 'UserProfileSlot',
  render: ({ slot, context, variableContext }) => {
    const user = variableContext?.user || { full_name: 'John Doe', email: 'john@example.com' };

    return (
      <div className={slot.className} style={slot.styles}>
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900">{user.full_name}</h3>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>
    );
  }
});

/**
 * NavigationMenuSlot - Account navigation menu
 */
const NavigationMenuSlot = createSlotComponent({
  name: 'NavigationMenuSlot',
  render: ({ slot, context, variableContext }) => {
    return (
      <div className={slot.className} style={slot.styles}>
        <nav className="space-y-2">
          <button className="w-full text-left px-3 py-2 rounded-lg bg-blue-100 text-blue-700">Overview</button>
          <button className="w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Orders</button>
          <button className="w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Addresses</button>
          <button className="w-full text-left px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Wishlist</button>
        </nav>
      </div>
    );
  }
});

/**
 * AccountStatsSlot - Account statistics display
 */
const AccountStatsSlot = createSlotComponent({
  name: 'AccountStatsSlot',
  render: ({ slot, context, variableContext }) => {
    const orders = variableContext?.orders || [];
    const addresses = variableContext?.addresses || [];
    const wishlistItems = variableContext?.wishlistItems || [];

    return (
      <div className={slot.className} style={slot.styles}>
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Orders</h3>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
              </svg>
            </div>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-gray-500">All time</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Saved Addresses</h3>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
              </svg>
            </div>
            <div className="text-2xl font-bold">{addresses.length}</div>
            <p className="text-xs text-gray-500">Delivery locations</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Wishlist Items</h3>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
              </svg>
            </div>
            <div className="text-2xl font-bold">{wishlistItems.length}</div>
            <p className="text-xs text-gray-500">Saved for later</p>
          </div>
        </div>
      </div>
    );
  }
});

/**
 * RecentOrdersSlot - Recent orders display
 */
const RecentOrdersSlot = createSlotComponent({
  name: 'RecentOrdersSlot',
  render: ({ slot, context, variableContext }) => {
    const orders = variableContext?.orders || [];

    return (
      <div className={slot.className} style={slot.styles}>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-2">No orders yet</p>
              <p className="text-gray-600">Your order history will appear here once you make a purchase.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="border rounded p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Order #{order.id}</p>
                      <p className="text-sm text-gray-600">{order.date}</p>
                    </div>
                    <span className="text-sm font-medium text-green-600">{order.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
});

/**
 * ProfileFormSlot - Profile edit form
 */
const ProfileFormSlotComponent = ({ slot, variableContext }) => {
  const { t } = useTranslation();
  const { settings } = useStore();
  const user = variableContext?.user || { full_name: 'John Doe', email: 'john@example.com' };
  const [firstName, lastName] = (user.full_name || '').split(' ');
  const primaryColor = settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color;

  return (
    <div className={slot.className} style={slot.styles}>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{t('account.profile_information', 'Profile Information')}</h3>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.first_name', 'First Name')}</label>
              <input type="text" defaultValue={firstName} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.last_name', 'Last Name')}</label>
              <input type="text" defaultValue={lastName} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email', 'Email')}</label>
            <input type="email" defaultValue={user.email} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone', 'Phone')}</label>
            <input type="tel" defaultValue={user.phone || ''} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.date_of_birth', 'Date of Birth')}
                <span className="text-gray-400 font-normal ml-1">({t('common.optional', 'optional')})</span>
              </label>
              <input
                type="date"
                defaultValue={user.date_of_birth || ''}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('common.gender', 'Gender')}
                <span className="text-gray-400 font-normal ml-1">({t('common.optional', 'optional')})</span>
              </label>
              <select
                defaultValue={user.gender || ''}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">{t('common.select', 'Select...')}</option>
                <option value="male">{t('common.male', 'Male')}</option>
                <option value="female">{t('common.female', 'Female')}</option>
                <option value="other">{t('common.other', 'Other')}</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="btn-themed text-white px-6 py-2 rounded-md"
            style={{ backgroundColor: primaryColor }}
          >
            {t('common.save_changes', 'Save Changes')}
          </button>
        </form>
      </div>
    </div>
  );
};

const ProfileFormSlot = createSlotComponent({
  name: 'ProfileFormSlot',
  render: (props) => <ProfileFormSlotComponent {...props} />
});

/**
 * LoginFormSlot - Login form
 * Wrapper component to use React hooks
 */
const LoginFormSlotComponent = ({ slot, context, variableContext }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { storeCode } = useParams();
  const { store, settings } = useStore();

  // Local state - will be used since loginData from variableContext is empty
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);

  // Forgot password state
  const [showForgotPasswordModal, setShowForgotPasswordModal] = React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = React.useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = React.useState(false);
  const [forgotPasswordError, setForgotPasswordError] = React.useState('');
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const getCustomerAccountUrl = async () => {
    if (storeCode) {
      return createPublicUrl(storeCode, 'ACCOUNT');
    }
    const savedStoreCode = localStorage.getItem('customer_auth_store_code');
    if (savedStoreCode) {
      return createPublicUrl(savedStoreCode, 'ACCOUNT');
    }
    return createPublicUrl('default', 'ACCOUNT');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Ensure store is loaded before attempting login
      if (!store?.id) {
        setError(t('common.store_info_not_available', 'Store information not available. Please refresh.'));
        return;
      }

      // Use CustomerAuth from storefront-entities for store-specific token storage
      const response = await CustomerAuth.login(
        formData.email,
        formData.password,
        formData.rememberMe,
        store.id
      );

      // Backend returns: { success: true, data: { user, token, requiresVerification, ... } }
      if (response.success) {
        // Token is already saved by CustomerAuth.login() with store-specific key
        // Just remove the logged out flag
        localStorage.removeItem('user_logged_out');

        // Track login event
        trackCustomerLogin(response.data?.user?.id || null, 'email');

        // Check if email verification is required
        if (response.data?.requiresVerification) {
          const verifyPath = createPublicUrl(storeCode, 'VERIFY_EMAIL');
          navigate(`${verifyPath}?email=${encodeURIComponent(formData.email)}`);
        } else {
          const accountUrl = await getCustomerAccountUrl();
          navigate(accountUrl);
        }
      } else {
        setError(response.message || t('common.login_failed', 'Login failed. Please check your credentials.'));
      }
    } catch (error) {
      setError(error.message || t('common.login_failed', 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);

    try {
      const response = await CustomerAuth.forgotPassword(forgotPasswordEmail, store?.id);

      if (response?.success) {
        setForgotPasswordSuccess(true);
      } else {
        setForgotPasswordError(response?.message || t('account.forgot_password_error', 'Failed to send reset email. Please try again.'));
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setForgotPasswordError(error.message || t('account.forgot_password_error', 'Failed to send reset email. Please try again.'));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const openForgotPasswordModal = () => {
    setForgotPasswordEmail(formData.email || '');
    setForgotPasswordError('');
    setForgotPasswordSuccess(false);
    setShowForgotPasswordModal(true);
  };

  const handleGoogleLogin = () => {
    if (!store?.id) {
      setError(t('common.store_info_not_available', 'Store information not available. Please refresh.'));
      return;
    }

    setGoogleLoading(true);
    setError('');

    // Build Google OAuth URL with store info
    const backendUrl = import.meta.env.VITE_API_BASE_URL || 'https://backend.dainostore.com';
    const googleAuthUrl = `${backendUrl}/api/public/auth/customer/google?store_id=${store.id}&store_slug=${store.slug || storeCode || 'default'}`;

    // Set a timeout to reset loading state if redirect doesn't happen
    const redirectTimeout = setTimeout(() => {
      setError(t('auth.google_login_failed', 'Failed to connect to Google. Please try again.'));
      setGoogleLoading(false);
    }, 5000);

    // Clear timeout on page unload (successful redirect)
    window.addEventListener('beforeunload', () => {
      clearTimeout(redirectTimeout);
    });

    try {
      window.location.href = googleAuthUrl;
    } catch (err) {
      setError(t('auth.google_login_failed', 'Failed to redirect to Google. Please try again.'));
      setGoogleLoading(false);
    }
  };

    return (
      <div className={slot.className} style={slot.styles}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email_address', 'Email Address')}</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder={t('common.enter_your_email', 'Enter your email')}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.password', 'Password')}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10"
                placeholder={t('common.enter_your_password', 'Enter your password')}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                disabled={loading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleInputChange}
                className="rounded"
                disabled={loading}
              />
              <span className="ml-2 text-sm">{t('common.remember_me', 'Remember me')}</span>
            </label>
            <button
              type="button"
              onClick={openForgotPasswordModal}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {t('account.forgot_password', 'Forgot password?')}
            </button>
          </div>

          <p className="text-xs text-center text-gray-500">
            {(() => {
              const hostname = window.location.hostname;
              const protocol = window.location.protocol;
              const isCustomDomain = !hostname.includes('dainostore.com') && !hostname.includes('localhost');

              const termsUrl = isCustomDomain
                ? `${protocol}//${hostname}/cms-page/terms-of-service`
                : `${protocol}//${hostname}/public/${store?.slug || 'default'}/cms-page/terms-of-service`;

              const privacyUrl = isCustomDomain
                ? `${protocol}//${hostname}/cms-page/privacy-policy`
                : `${protocol}//${hostname}/public/${store?.slug || 'default'}/cms-page/privacy-policy`;

              return replacePlaceholders(
                t('auth.agree_signin_with_links', 'By signing in, you agree to our {termsLink} and {privacyLink}.'),
                {
                  termsLink: (
                    <a
                      href={termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {t('common.terms_of_service', 'Terms of Service')}
                    </a>
                  ),
                  privacyLink: (
                    <a
                      href={privacyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {t('common.privacy_policy', 'Privacy Policy')}
                    </a>
                  )
                }
              );
            })()}
          </p>

          <SaveButton
            type="submit"
            loading={loading}
            defaultText={t('common.sign_in', 'Sign In')}
            loadingText={t('common.signing_in', 'Signing in...')}
            className="w-full font-medium py-2.5 rounded-md"
            style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
          />

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-500">{t('common.or', 'or')}</span>
            </div>
          </div>

          {/* Google Login Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? t('common.redirecting', 'Redirecting...') : t('auth.sign_in_with_google', 'Sign in with Google')}
          </button>
        </form>

        {/* Forgot Password Modal */}
        <Dialog open={showForgotPasswordModal} onOpenChange={setShowForgotPasswordModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('account.forgot_password', 'Forgot Password')}</DialogTitle>
              <DialogDescription>
                {t('account.forgot_password_description', 'Enter your email address and we will send you a link to reset your password.')}
              </DialogDescription>
            </DialogHeader>

            {forgotPasswordSuccess ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  {t('account.forgot_password_success', 'Password reset email sent! Please check your inbox.')}
                </div>
                <button
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="w-full btn-themed text-white font-medium py-2.5 rounded-md"
                  style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                {forgotPasswordError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {forgotPasswordError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email', 'Email')}</label>
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    disabled={forgotPasswordLoading}
                    placeholder={t('common.enter_email', 'Enter your email address')}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForgotPasswordModal(false)}
                    disabled={forgotPasswordLoading}
                    className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-md hover:bg-gray-50"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <SaveButton
                    type="submit"
                    loading={forgotPasswordLoading}
                    defaultText={t('account.send_reset_link', 'Send Reset Link')}
                    loadingText={t('common.sending', 'Sending...')}
                    className="flex-1 font-medium py-2.5 rounded-md"
                    style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
                  />
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
};

// Wrap with createSlotComponent
const LoginFormSlot = createSlotComponent({
  name: 'LoginFormSlot',
  render: (props) => <LoginFormSlotComponent {...props} />
});

/**
 * RegisterFormSlot - Registration form
 */
const RegisterFormSlotComponent = ({ slot, context, variableContext }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { storeCode } = useParams();
  const { store, settings } = useStore();
  const { isPublishedPreview } = usePreviewMode();

  // Local state
  const [formData, setFormData] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: '',
    gender: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Email configuration state for preview mode
  const [isEmailConfigured, setIsEmailConfigured] = React.useState(null);
  const [showEmailNotConfiguredModal, setShowEmailNotConfiguredModal] = React.useState(false);

  // Check email configuration on mount when in preview mode
  // Uses public endpoint that works on custom domains without admin auth
  React.useEffect(() => {
    const checkEmailConfig = async () => {
      if (isPublishedPreview && store?.id) {
        try {
          // Use public endpoint that checks ANY email provider (Brevo or SendGrid)
          const response = await storefrontApiClient.getPublic(`auth/email-configured?store_id=${store.id}`);
          setIsEmailConfigured(response?.success && response?.data?.isConfigured);
        } catch (error) {
          console.error('Failed to check email configuration:', error);
          setIsEmailConfigured(false);
        }
      }
    };
    checkEmailConfig();
  }, [isPublishedPreview, store?.id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getCustomerAccountUrl = async () => {
    if (storeCode) {
      return createPublicUrl(storeCode, 'ACCOUNT');
    }
    const savedStoreCode = localStorage.getItem('customer_auth_store_code');
    if (savedStoreCode) {
      return createPublicUrl(savedStoreCode, 'ACCOUNT');
    }
    return createPublicUrl('default', 'ACCOUNT');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Check if in preview mode and email is not configured
    if (isPublishedPreview && isEmailConfigured === false) {
      setShowEmailNotConfiguredModal(true);
      setLoading(false);
      return;
    }

    try {
      // Client-side password validation
      if (formData.password.length < 8) {
        setError(t('auth.error.password.min_length', 'Password must be at least 8 characters long'));
        setLoading(false);
        return;
      }

      if (!/[A-Z]/.test(formData.password)) {
        setError(t('auth.error.password.uppercase', 'Password must contain at least one uppercase letter'));
        setLoading(false);
        return;
      }

      if (!/[a-z]/.test(formData.password)) {
        setError(t('auth.error.password.lowercase', 'Password must contain at least one lowercase letter'));
        setLoading(false);
        return;
      }

      if (!/\d/.test(formData.password)) {
        setError(t('auth.error.password.number', 'Password must contain at least one number'));
        setLoading(false);
        return;
      }

      if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
        setError(t('auth.error.password.special_char', 'Password must contain at least one special character'));
        setLoading(false);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError(t('message.password_mismatch', 'Passwords do not match'));
        setLoading(false);
        return;
      }

      // Ensure store is loaded
      if (!store?.id) {
        setError(t('common.store_info_not_available', 'Store information not available. Please refresh.'));
        setLoading(false);
        return;
      }

      // Use CustomerAuth from storefront-entities for registration
      const registerData = {
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: 'customer',
        account_type: 'individual',
        store_id: store.id,
        send_welcome_email: true
      };

      // Add optional fields if provided
      if (formData.dateOfBirth) {
        registerData.date_of_birth = formData.dateOfBirth;
      }
      if (formData.gender) {
        registerData.gender = formData.gender;
      }

      const response = await CustomerAuth.register(registerData);

      // Backend returns: { success: true, data: { user, token, requiresVerification, ... } }
      if (response.success) {
        // Token is already saved by CustomerAuth.register()
        localStorage.removeItem('user_logged_out');

        // Track registration event
        trackCustomerRegistration(response.data?.user?.id || null, 'email');

        // Check if email verification is required
        if (response.data?.requiresVerification) {
          // Redirect to verification page
          const verifyPath = createPublicUrl(storeCode, 'VERIFY_EMAIL');
          navigate(`${verifyPath}?email=${encodeURIComponent(formData.email)}`);
        } else {
          setSuccess(t('customer_auth.success.registration', 'Registration successful!'));
          // Redirect after showing success message
          setTimeout(async () => {
            const accountUrl = await getCustomerAccountUrl();
            navigate(accountUrl);
          }, 2000);
        }
      } else {
        // Show error message from backend
        setError(response.message || t('customer_auth.error.registration_failed', 'Registration failed. Please try again.'));
      }
    } catch (error) {
      console.error('Registration error:', error);

      // Handle validation errors from backend
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        const errorMessages = validationErrors.map(err => err.msg || err.message).join('. ');
        setError(errorMessages);
      } else {
        setError(error.message || t('customer_auth.error.registration_failed', 'Registration failed. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={slot.className} style={slot.styles}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.first_name', 'First Name')}</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder={t('common.first_name', 'First Name')}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.last_name', 'Last Name')}</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder={t('common.last_name', 'Last Name')}
              disabled={loading}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email_address', 'Email Address')}</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            placeholder={t('common.enter_your_email', 'Enter your email')}
            disabled={loading}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.date_of_birth', 'Date of Birth')}
              <span className="text-gray-400 font-normal ml-1">({t('common.optional', 'optional')})</span>
            </label>
            <input
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('common.gender', 'Gender')}
              <span className="text-gray-400 font-normal ml-1">({t('common.optional', 'optional')})</span>
            </label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={loading}
            >
              <option value="">{t('common.select', 'Select...')}</option>
              <option value="male">{t('common.male', 'Male')}</option>
              <option value="female">{t('common.female', 'Female')}</option>
              <option value="other">{t('common.other', 'Other')}</option>
              <option value="prefer_not_to_say">{t('common.prefer_not_to_say', 'Prefer not to say')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.password', 'Password')}</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10"
              placeholder={t('common.enter_your_password', 'Enter your password')}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              disabled={loading}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.confirm_password', 'Confirm Password')}</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10"
              placeholder={t('common.confirm_password', 'Confirm Password')}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              disabled={loading}
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <p className="text-xs text-center text-gray-500">
          {(() => {
            const hostname = window.location.hostname;
            const protocol = window.location.protocol;
            const isCustomDomain = !hostname.includes('dainostore.com') && !hostname.includes('localhost');

            const termsUrl = isCustomDomain
              ? `${protocol}//${hostname}/cms-page/terms-of-service`
              : `${protocol}//${hostname}/public/${store?.slug || 'default'}/cms-page/terms-of-service`;

            const privacyUrl = isCustomDomain
              ? `${protocol}//${hostname}/cms-page/privacy-policy`
              : `${protocol}//${hostname}/public/${store?.slug || 'default'}/cms-page/privacy-policy`;

            return replacePlaceholders(
              t('auth.agree_signup_with_links', 'By creating an account, you agree to our {termsLink} and {privacyLink}.'),
              {
                termsLink: (
                  <a
                    href={termsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {t('common.terms_of_service', 'Terms of Service')}
                  </a>
                ),
                privacyLink: (
                  <a
                    href={privacyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {t('common.privacy_policy', 'Privacy Policy')}
                  </a>
                )
              }
            );
          })()}
        </p>

        <SaveButton
          type="submit"
          loading={loading}
          defaultText={t('common.create_account', 'Create My Account')}
          loadingText={t('common.creating', 'Creating...')}
          className="w-full font-medium py-2.5 rounded-md"
          style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
        />
      </form>

      {/* Email Not Configured Modal - Shows in preview mode when email provider is not set up */}
      <Dialog open={showEmailNotConfiguredModal} onOpenChange={setShowEmailNotConfiguredModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('account.email_not_configured_title', 'Email Not Configured')}</DialogTitle>
            <DialogDescription>
              {t('account.email_not_configured_description', 'Please configure an email provider in Store -> Email to enable customer registration.')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setShowEmailNotConfiguredModal(false)}
              className="btn-themed text-white font-medium py-2.5 px-6 rounded-md"
              style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Wrap with createSlotComponent
const RegisterFormSlot = createSlotComponent({
  name: 'RegisterFormSlot',
  render: (props) => <RegisterFormSlotComponent {...props} />
});

/**
 * AccountIntroHeroSlot - Hero section for intro view (not logged in)
 */
const AccountIntroHeroSlot = createSlotComponent({
  name: 'AccountIntroHeroSlot',
  render: ({ slot, context }) => {
    return (
      <div className={slot.className} style={slot.styles}>
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg shadow-lg p-12 mb-8">
          <div className="max-w-3xl mx-auto text-center">
            <svg className="w-20 h-20 mx-auto mb-6 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            <h2 className="text-4xl font-bold mb-4">Welcome to Your Account</h2>
            <p className="text-xl mb-8 opacity-90">Sign in to access your orders, track shipments, and manage your preferences</p>
          </div>
        </div>
      </div>
    );
  }
});

/**
 * AccountBenefitsSlot - Benefits grid for intro view (not logged in)
 */
const AccountBenefitsSlot = createSlotComponent({
  name: 'AccountBenefitsSlot',
  render: ({ slot, context }) => {
    return (
      <div className={slot.className} style={slot.styles}>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Order History</h3>
            <p className="text-gray-600">View and track all your orders in one place</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Fast Checkout</h3>
            <p className="text-gray-600">Save addresses and payment methods for quick checkout</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Wishlist</h3>
            <p className="text-gray-600">Save your favorite items for later</p>
          </div>
        </div>
      </div>
    );
  }
});

/**
 * AccountCTASlot - Call-to-action for intro view (not logged in)
 */
const AccountCTASlotComponent = ({ slot }) => {
  const { settings } = useStore();
  const primaryColor = settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color;

  return (
    <div className={slot.className} style={slot.styles}>
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h3 className="text-2xl font-semibold mb-4">Ready to Get Started?</h3>
        <p className="text-gray-600 mb-6">Create an account or sign in to access all features</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => window.location.href = '/customer/login'}
            className="btn-themed text-white px-8 py-3 rounded-lg font-medium"
            style={{ backgroundColor: primaryColor }}
          >
            Sign In
          </button>
          <button
            onClick={() => window.location.href = '/customer/login'}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-8 py-3 rounded-lg font-medium"
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

const AccountCTASlot = createSlotComponent({
  name: 'AccountCTASlot',
  render: (props) => <AccountCTASlotComponent {...props} />
});

/**
 * AuthAgreementSlot - Terms and Privacy Policy agreement text
 */
const AuthAgreementSlotComponent = ({ slot }) => {
  const { t } = useTranslation();
  const { store } = useStore();

  // Build URLs based on current domain
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const isCustomDomain = !hostname.includes('dainostore.com') && !hostname.includes('localhost');

  const termsUrl = isCustomDomain
    ? `${protocol}//${hostname}/cms-page/terms-of-service`
    : `${protocol}//${hostname}/public/${store?.slug || 'default'}/cms-page/terms-of-service`;

  const privacyUrl = isCustomDomain
    ? `${protocol}//${hostname}/cms-page/privacy-policy`
    : `${protocol}//${hostname}/public/${store?.slug || 'default'}/cms-page/privacy-policy`;

  return (
    <div className={slot?.className || 'text-center text-sm text-gray-600'} style={slot?.styles}>
      <p className="text-xs">
        {replacePlaceholders(
          t('common.terms_agreement', 'View our {termsLink} and {privacyLink}.'),
          {
            termsLink: (
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {t('common.terms_of_service', 'Terms of Service')}
              </a>
            ),
            privacyLink: (
              <a
                href={privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                {t('common.privacy_policy', 'Privacy Policy')}
              </a>
            )
          }
        )}
      </p>
    </div>
  );
};

const AuthAgreementSlot = createSlotComponent({
  name: 'AuthAgreementSlot',
  render: (props) => <AuthAgreementSlotComponent {...props} />
});

// Register all components
registerSlotComponent('UserProfileSlot', UserProfileSlot);
registerSlotComponent('NavigationMenuSlot', NavigationMenuSlot);
registerSlotComponent('AccountStatsSlot', AccountStatsSlot);
registerSlotComponent('RecentOrdersSlot', RecentOrdersSlot);
registerSlotComponent('ProfileFormSlot', ProfileFormSlot);
registerSlotComponent('LoginFormSlot', LoginFormSlot);
registerSlotComponent('RegisterFormSlot', RegisterFormSlot);
registerSlotComponent('AccountIntroHeroSlot', AccountIntroHeroSlot);
registerSlotComponent('AccountBenefitsSlot', AccountBenefitsSlot);
registerSlotComponent('AccountCTASlot', AccountCTASlot);
registerSlotComponent('AuthAgreementSlot', AuthAgreementSlot);

export {
  UserProfileSlot,
  NavigationMenuSlot,
  AccountStatsSlot,
  RecentOrdersSlot,
  ProfileFormSlot,
  LoginFormSlot,
  RegisterFormSlot,
  AccountIntroHeroSlot,
  AccountBenefitsSlot,
  AccountCTASlot,
  AuthAgreementSlot
};
