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
import brevoAPI from '@/api/brevo';

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
  const { settings } = useStore();
  const user = variableContext?.user || { full_name: 'John Doe', email: 'john@example.com' };
  const [firstName, lastName] = user.full_name.split(' ');
  const primaryColor = settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color;

  return (
    <div className={slot.className} style={slot.styles}>
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input type="text" defaultValue={firstName} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input type="text" defaultValue={lastName} className="w-full border border-gray-300 rounded-md px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" defaultValue={user.email} className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" className="w-full border border-gray-300 rounded-md px-3 py-2" />
          </div>
          <button
            type="submit"
            className="btn-themed text-white px-6 py-2 rounded-md"
            style={{ backgroundColor: primaryColor }}
          >
            Save Changes
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

        // Check if email verification is required
        if (response.data?.requiresVerification) {
          navigate(`/public/${storeCode}/verify-email?email=${encodeURIComponent(formData.email)}`);
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
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-themed text-white font-medium py-2.5 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed"
            style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
          >
            {loading ? t('common.signing_in', 'Signing in...') : t('common.sign_in', 'Sign In')}
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
                  <button
                    type="submit"
                    disabled={forgotPasswordLoading}
                    className="flex-1 btn-themed text-white font-medium py-2.5 rounded-md disabled:bg-gray-400"
                    style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
                  >
                    {forgotPasswordLoading ? t('common.sending', 'Sending...') : t('account.send_reset_link', 'Send Reset Link')}
                  </button>
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
  React.useEffect(() => {
    const checkEmailConfig = async () => {
      if (isPublishedPreview && store?.id) {
        try {
          const response = await brevoAPI.getConnectionStatus(store.id);
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
      const response = await CustomerAuth.register({
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: 'customer',
        account_type: 'individual',
        store_id: store.id,
        send_welcome_email: true
      });

      // Backend returns: { success: true, data: { user, token, requiresVerification, ... } }
      if (response.success) {
        // Token is already saved by CustomerAuth.register()
        localStorage.removeItem('user_logged_out');

        // Check if email verification is required
        if (response.data?.requiresVerification) {
          // Redirect to verification page
          navigate(`/public/${storeCode}/verify-email?email=${encodeURIComponent(formData.email)}`);
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
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-themed text-white font-medium py-2.5 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed"
          style={{ backgroundColor: settings?.theme?.primary_button_color || getThemeDefaults().primary_button_color }}
        >
          {loading ? t('common.creating', 'Creating...') : t('common.create_account', 'Create My Account')}
        </button>
      </form>

      {/* Email Not Configured Modal - Shows in preview mode when email provider is not set up */}
      <Dialog open={showEmailNotConfiguredModal} onOpenChange={setShowEmailNotConfiguredModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('preview.email_not_configured_title', 'Email Not Configured')}</DialogTitle>
            <DialogDescription>
              {t('preview.email_not_configured_description', 'Registration is not available in preview mode because email verification cannot be sent. Please configure an email provider in your store settings to enable customer registration.')}
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
  AccountCTASlot
};
