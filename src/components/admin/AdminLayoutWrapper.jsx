/**
 * AdminLayoutWrapper
 *
 * Wraps admin routes with TranslationProvider
 * Also checks if user has stores and redirects to onboarding if not
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TranslationProvider } from '@/contexts/TranslationContext';
import { shouldSkipStoreContext } from '@/utils/domainConfig';
import apiClient from '@/utils/api';
import { PageLoader } from '@/components/ui/page-loader';

// Get store ID from localStorage for admin/editor contexts
const getSelectedStoreId = () => {
  return localStorage.getItem('selectedStoreId') || null;
};

export function AdminLayoutWrapper({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkStoreStatus();
  }, [location.pathname]);

  const checkStoreStatus = async () => {
    // Skip check for non-admin routes (storefront, public pages, etc.)
    // Admin routes start with /admin/ or /plugins or /editor/
    const isAdminRoute = location.pathname.startsWith('/admin') ||
                         location.pathname.startsWith('/plugins') ||
                         location.pathname.startsWith('/editor');

    if (!isAdminRoute) {
      setChecking(false);
      return;
    }

    // Skip email verification check for auth and verify-email pages only
    const skipEmailVerificationPages = ['/admin/auth', '/admin/verify-email'];
    const shouldSkipEmailCheck = skipEmailVerificationPages.some(page =>
      location.pathname.startsWith(page)
    );

    // Check email verification status first (before any other checks)
    // This runs for ALL admin routes except auth and verify-email
    if (!shouldSkipEmailCheck) {
      const userDataStr = localStorage.getItem('store_owner_user_data');
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          if (userData.email_verified === false) {
            navigate(`/admin/verify-email?email=${encodeURIComponent(userData.email)}`, { replace: true });
            return;
          }
        } catch (e) {
          // Invalid JSON, continue with other checks
        }
      }
    }

    // Use centralized config to skip store check for certain pages
    if (shouldSkipStoreContext(location.pathname)) {
      setChecking(false);
      return;
    }

    try {
      // Check if user has any stores
      const response = await apiClient.get('/stores/dropdown');

      // Handle both wrapped { success, data } and direct array responses
      let stores = [];
      if (Array.isArray(response)) {
        stores = response;
      } else if (response?.success && Array.isArray(response.data)) {
        stores = response.data;
      } else if (Array.isArray(response?.data)) {
        stores = response.data;
      }

      if (stores.length === 0) {
        // Clear stale localStorage data for non-existent stores
        localStorage.removeItem('selectedStoreId');
        localStorage.removeItem('selectedStoreName');
        localStorage.removeItem('selectedStoreSlug');
        localStorage.removeItem('selectedStoreStatus');
        localStorage.removeItem('selectedStoreThemePreset');
        navigate('/admin/onboarding', { replace: true });
        return;
      }

      // Check if any store is stuck in 'provisioning' or 'pending_database' status
      const activeStores = stores.filter(s => s.status === 'active');
      const stuckStores = stores.filter(s => s.status === 'provisioning' || s.status === 'pending_database');

      if (activeStores.length === 0 && stuckStores.length > 0) {
        // All stores are stuck - redirect to onboarding to complete setup
        const stuckStore = stuckStores[0];
        console.warn(`Store ${stuckStore.id} is stuck in '${stuckStore.status}' status, redirecting to onboarding`);
        navigate(`/admin/onboarding?storeId=${stuckStore.id}&resume=true`, { replace: true });
        return;
      }

      setChecking(false);
    } catch (error) {
      console.error('Store check error:', error);

      // Check for auth-related errors (session terminated, invalid token, etc.)
      const isAuthError = error.message?.includes('Session has been terminated') ||
                         error.message?.includes('Invalid token') ||
                         error.message?.includes('Token expired') ||
                         error.message?.includes('Unauthorized') ||
                         error.message?.includes('Authentication failed') ||
                         error.status === 401 ||
                         error.status === 403;

      if (isAuthError) {
        // CRITICAL: Clear session data to prevent redirect loop
        // When session expires, localStorage still has the expired token
        // Clear it before redirecting to auth page
        localStorage.removeItem('store_owner_auth_token');
        localStorage.removeItem('store_owner_user_data');
        localStorage.removeItem('store_owner_session_id');
        localStorage.removeItem('selectedStoreId');
        localStorage.removeItem('selectedStoreSlug');
        localStorage.removeItem('selectedStoreName');
        localStorage.removeItem('selectedStoreStatus');
        localStorage.removeItem('selectedStoreThemePreset');

        // Redirect to auth if not already there (prevents loops)
        if (!location.pathname.includes('/admin/auth')) {
          navigate('/admin/auth', { replace: true });
        }
        return;
      }

      // On API errors (e.g. 500), clear stale store data and redirect to onboarding
      // This handles cases where the database is empty or corrupted
      console.warn('Store check failed, clearing localStorage and redirecting to onboarding');
      localStorage.removeItem('selectedStoreId');
      localStorage.removeItem('selectedStoreName');
      localStorage.removeItem('selectedStoreSlug');
      localStorage.removeItem('selectedStoreStatus');
      localStorage.removeItem('selectedStoreThemePreset');
      navigate('/admin/onboarding', { replace: true });
    }
  };

  if (checking) {
    return <PageLoader size="lg" />;
  }

  // For pages that skip store context, provide minimal TranslationProvider with English fallback (no API calls)
  if (shouldSkipStoreContext(location.pathname)) {
    const defaultLanguages = [
      { code: 'en', name: 'English', native_name: 'English', is_active: true, is_rtl: false }
    ];
    return (
      <TranslationProvider
        initialLanguages={defaultLanguages}
        initialTranslations={{ labels: {}, customKeys: [] }}
      >
        {children}
      </TranslationProvider>
    );
  }

  return (
    <TranslationProvider storeId={getSelectedStoreId()}>
      {children}
    </TranslationProvider>
  );
}
