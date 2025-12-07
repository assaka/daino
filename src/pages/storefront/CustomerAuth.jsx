import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CustomerAuth as CustomerAuthAPI } from "@/api/storefront-entities";
import storefrontApiClient from "@/api/storefront-client";
import { createPublicUrl } from "@/utils/urlUtils";
import { useStore } from "@/components/storefront/StoreProvider";
import slotConfigurationService from '@/services/slotConfigurationService';
import { UnifiedSlotRenderer } from '@/components/editor/slot/UnifiedSlotRenderer';
import '@/components/editor/slot/AccountLoginSlotComponents'; // Register account/login components
// Slot configurations are loaded from database via slotConfigurationService
import { useTranslation } from '@/contexts/TranslationContext';
import { PageLoader } from '@/components/ui/page-loader';

export default function CustomerAuth() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { storeCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { store, loading: storeLoading } = useStore();

  // Slot configuration state
  const [loginLayoutConfig, setLoginLayoutConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Check if we're in draft preview mode (AI Workspace preview)
  const isPreviewDraftMode = searchParams.get('preview') === 'draft' || searchParams.get('workspace') === 'true';

  // Load login layout configuration
  useEffect(() => {
    const loadLoginLayoutConfig = async () => {
      if (!store?.id) {
        return;
      }

      try {
        // Load draft or published configuration based on preview mode
        const response = isPreviewDraftMode
          ? await slotConfigurationService.getDraftConfiguration(store.id, 'login')
          : await slotConfigurationService.getPublishedConfiguration(store.id, 'login');

        // Check for valid published config
        if (response.success && response.data &&
            response.data.configuration &&
            response.data.configuration.slots &&
            Object.keys(response.data.configuration.slots).length > 0) {

          const publishedConfig = response.data;
          setLoginLayoutConfig(publishedConfig.configuration);
          setConfigLoaded(true);

        } else {
          // No published config exists - this should not happen if store was provisioned correctly
          console.warn('No published login configuration found. Store may not be provisioned correctly.');
          setLoginLayoutConfig(null);
          setConfigLoaded(true);
        }
      } catch (error) {
        console.error('❌ CUSTOMER_AUTH: Error loading published slot configuration:', error);
        setLoginLayoutConfig(null);
        setConfigLoaded(true);
      }
    };

    loadLoginLayoutConfig();
  }, [store, isPreviewDraftMode]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if customer is authenticated using the proper API
      if (CustomerAuthAPI.isAuthenticated()) {
        const userData = await CustomerAuthAPI.me();
        if (userData && userData.role === 'customer') {
          // User is already authenticated, redirect to dashboard
          const accountUrl = await getCustomerAccountUrl();
          navigate(accountUrl);
          return;
        }
      }
    } catch (error) {
      // User not authenticated, stay on auth page
    } finally {
      setLoading(false);
    }
  };

  const getCustomerAccountUrl = async () => {
    // Use current store from URL
    if (storeCode) {
      return createPublicUrl(storeCode, 'ACCOUNT');
    }

    // Fallback to saved store code
    const savedStoreCode = localStorage.getItem('customer_auth_store_code');
    if (savedStoreCode) {
      return createPublicUrl(savedStoreCode, 'ACCOUNT');
    }

    return createPublicUrl('default', 'ACCOUNT');
  };

  // Extract settings from store for loginData
  const { settings } = useStore();

  const handleAuth = async (formData, isLogin) => {
    setAuthLoading(true);
    setError("");
    setSuccess("");

    try {
      if (isLogin) {
        // Extract store_id from store context for customer login validation

        const storeId = store?.id;

        if (!storeId) {
          setError(t('customer_auth.error.store_not_available'));
          setAuthLoading(false);
          return;
        }

        // CustomerAuthAPI.login automatically stores the token with store context
        const response = await CustomerAuthAPI.login(
          formData.email,
          formData.password,
          formData.rememberMe,
          storeId // Pass store_id to validate customer belongs to this store
        );

        // CustomerAuthAPI returns { success: true, data: { token, user } }
        if (response.success) {
          // Clear logged out flag
          localStorage.removeItem('user_logged_out');

          // Token is already stored by CustomerAuthAPI.login()
          // Navigate to customer account
          const accountUrl = await getCustomerAccountUrl();
          navigate(accountUrl);
          return;
        }
      } else {
        // Registration
        if (formData.password !== formData.confirmPassword) {
          setError(t('message.password_mismatch', 'Passwords do not match'));
          return;
        }

        // Extract store_id from store context for customer registration
        const storeId = store?.id;

        if (!storeId) {
          setError(t('customer_auth.error.store_not_available'));
          setAuthLoading(false);
          return;
        }

        const registerData = {
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: 'customer',
          account_type: 'individual',
          store_id: storeId, // CRITICAL: Bind customer to this specific store
          send_welcome_email: true // Send welcome email after registration
        };

        // CustomerAuthAPI.register automatically stores the token with store context
        const response = await CustomerAuthAPI.register(registerData);

        // CustomerAuthAPI returns { success: true, data: { token, user } }
        if (response.success) {
          // Set success message for welcome email
          setSuccess(t('customer_auth.success.registration'));

          // Clear logged out flag
          localStorage.removeItem('user_logged_out');

          // Token is already stored by CustomerAuthAPI.register()
          // Wait a moment to show the success message before redirecting
          setTimeout(async () => {
            const accountUrl = await getCustomerAccountUrl();
            navigate(accountUrl);
          }, 2000);
          return;
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      // Use backend error message if available
      const defaultMessage = isLogin ? t('common.login_failed') : t('customer_auth.error.registration_failed');
      const errorMessage = error.response?.data?.message || error.data?.message || error.message || defaultMessage;
      setError(errorMessage);
    } finally {
      setAuthLoading(false);
    }
  };

  // Wait for both config AND store to be loaded before rendering
  if (loading || !configLoaded || !store) {
    return <PageLoader size="lg" fullScreen={false} className="min-h-[50vh]" />;
  }

  const hasConfig = loginLayoutConfig && loginLayoutConfig.slots;
  const hasSlots = hasConfig && Object.keys(loginLayoutConfig.slots).length > 0;

  return (
    <div className="min-h-screen bg-gray-50 sm:py-12 sm:px-4">
      {hasConfig && hasSlots ? (
        <UnifiedSlotRenderer
          slots={loginLayoutConfig.slots}
          parentId={null}
          viewMode="register"
          context="storefront"
          loginData={{
            loading: authLoading,
            error,
            success,
            handleAuth,
            navigate,
            storeCode,
            createPublicUrl,
            settings,  // Add settings for translations
            store      // Add store data
          }}
        />
      ) : (
        <div className="max-w-md w-full mx-auto">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-center mb-4">{t('customer_auth.title')}</h2>
            <p className="text-gray-600 text-center">
              {t('customer_auth.error.config_not_available')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
