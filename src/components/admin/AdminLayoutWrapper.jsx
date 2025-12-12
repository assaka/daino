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
    // Use centralized config to skip store check for certain pages
    if (shouldSkipStoreContext(location.pathname)) {
      setChecking(false);
      return;
    }

    // Skip check for non-admin routes (storefront, public pages, etc.)
    // Admin routes start with /admin/ or /plugins or /editor/
    const isAdminRoute = location.pathname.startsWith('/admin') ||
                         location.pathname.startsWith('/plugins') ||
                         location.pathname.startsWith('/editor');

    if (!isAdminRoute) {
      setChecking(false);
      return;
    }

    try {
      // Check if user has any stores
      const response = await apiClient.get('/stores/dropdown');

      if (response?.data && response.data.length === 0) {
        console.log('🔍 No stores found, redirecting to onboarding...');
        navigate('/admin/onboarding', { replace: true });
        return;
      }

      setChecking(false);
    } catch (error) {
      console.error('Store check error:', error);
      // If session has been terminated, redirect to auth
      if (error.message?.includes('Session has been terminated')) {
        navigate('/admin/auth', { replace: true });
        return;
      }
      // On other errors, allow access (fail open)
      setChecking(false);
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
