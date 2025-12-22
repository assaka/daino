import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CustomerAuth as CustomerAuthAPI } from "@/api/storefront-entities";
import { createPublicUrl } from "@/utils/urlUtils";
import { useStore } from "@/components/storefront/StoreProvider";
import { useTranslation } from '@/contexts/TranslationContext';
import { getThemeDefaults } from '@/utils/storeSettingsDefaults';
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { store, settings } = useStore();
  const themeDefaults = getThemeDefaults();
  const primaryButtonColor = settings?.theme?.primary_button_color || themeDefaults.primary_button_color;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const token = searchParams.get("token");
  const email = searchParams.get("email");

  // Validate token on page load
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError(t('account.reset_password_invalid_link', 'Invalid or expired reset link. Please request a new password reset.'));
        setValidating(false);
        return;
      }

      if (!store?.id) {
        // Wait for store to load
        return;
      }

      try {
        const response = await CustomerAuthAPI.validateResetToken(token, store.id);
        if (response?.valid) {
          setTokenValid(true);
        } else {
          setError(response?.message || t('account.reset_password_invalid_link', 'Invalid or expired reset link. Please request a new password reset.'));
        }
      } catch (err) {
        setError(t('account.reset_password_invalid_link', 'Invalid or expired reset link. Please request a new password reset.'));
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token, store?.id, t]);

  const validatePassword = (pwd) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(pwd);
    const hasLowerCase = /[a-z]/.test(pwd);
    const hasNumber = /\d/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

    if (pwd.length < minLength) {
      return t('account.password_min_length', 'Password must be at least 8 characters');
    }
    if (!hasUpperCase) {
      return t('account.password_uppercase', 'Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      return t('account.password_lowercase', 'Password must contain at least one lowercase letter');
    }
    if (!hasNumber) {
      return t('account.password_number', 'Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      return t('account.password_special', 'Password must contain at least one special character');
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t('account.passwords_not_match', 'Passwords do not match'));
      return;
    }

    // Validate password strength
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!store?.id) {
      setError(t('account.store_not_available', 'Store information not available. Please try again.'));
      return;
    }

    setLoading(true);

    try {
      const response = await CustomerAuthAPI.resetPassword(token, password, store.id);

      if (response?.success) {
        setSuccess(true);
        // Redirect to login after 3 seconds
        const storeSlug = store?.slug || store?.code || 'default';
        setTimeout(() => {
          navigate(createPublicUrl(storeSlug, 'LOGIN'));
        }, 3000);
      } else {
        setError(response?.message || t('account.reset_password_failed', 'Failed to reset password. Please try again.'));
      }
    } catch (err) {
      setError(err.message || t('account.reset_password_failed', 'Failed to reset password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Show loading while validating token
  if (validating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {t('account.validating_link', 'Validating reset link...')}
            </h2>
          </div>
        </div>
      </div>
    );
  }

  // Show error if token is invalid (without the form)
  if (!tokenValid && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('account.invalid_reset_link_title', 'Invalid Reset Link')}
            </h2>
            <p className="text-gray-600 mb-6">
              {error}
            </p>
            <button
              onClick={() => navigate(createPublicUrl(store?.slug || store?.code || 'default', 'LOGIN'))}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('account.back_to_login', 'Back to Login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {t('account.password_reset_success', 'Password Reset Successful!')}
            </h2>
            <p className="text-gray-600 mb-6">
              {t('account.password_reset_success_message', 'Your password has been reset successfully. You can now log in with your new password.')}
            </p>
            <p className="text-sm text-gray-500">
              {t('account.redirecting_to_login', 'Redirecting to login...')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <Lock className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('account.reset_password_title', 'Reset Your Password')}
            </h2>
            {email && (
              <p className="text-gray-600 mt-2">
                {t('account.reset_password_for', 'for')} <span className="font-medium">{email}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!token ? (
            <div className="text-center">
              <button
                onClick={() => navigate(createPublicUrl(store?.slug || store?.code || 'default', 'LOGIN'))}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                {t('account.back_to_login', 'Back to Login')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('account.new_password', 'New Password')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                    placeholder={t('account.enter_new_password', 'Enter your new password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('account.confirm_new_password', 'Confirm New Password')}
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                    placeholder={t('account.confirm_new_password_placeholder', 'Confirm your new password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>{t('account.password_requirements', 'Password must contain:')}</p>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  <li>{t('account.password_req_length', 'At least 8 characters')}</li>
                  <li>{t('account.password_req_upper', 'One uppercase letter')}</li>
                  <li>{t('account.password_req_lower', 'One lowercase letter')}</li>
                  <li>{t('account.password_req_number', 'One number')}</li>
                  <li>{t('account.password_req_special', 'One special character (!@#$%^&*)')}</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white btn-themed focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: primaryButtonColor }}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('account.resetting_password', 'Resetting Password...')}
                  </span>
                ) : (
                  t('account.reset_password_button', 'Reset Password')
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate(createPublicUrl(store?.slug || store?.code || 'default', 'LOGIN'))}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {t('account.back_to_login', 'Back to Login')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
