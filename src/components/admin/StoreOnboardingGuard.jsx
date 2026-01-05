import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '@/utils/api';
import { Loader2 } from 'lucide-react';

/**
 * Store Onboarding Guard
 *
 * Checks if user has any active stores.
 * If no stores (count = 0) → redirect to /admin/onboarding
 * If has stores → continue to requested page
 */
export default function StoreOnboardingGuard({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasStores, setHasStores] = useState(false);

  useEffect(() => {
    checkStoreStatus();
  }, []);

  const checkStoreStatus = async () => {
    // Don't check if already on onboarding page
    if (location.pathname === '/admin/onboarding') {
      setChecking(false);
      setHasStores(false);
      return;
    }

    try {
      // Check if user has any stores (same endpoint as AdminLayoutWrapper)
      const response = await apiClient.get('/stores/dropdown');
      const stores = response?.data || response || [];

      if (Array.isArray(stores) && stores.length > 0) {
        // Filter for active stores only
        const activeStores = stores.filter(store => store.status === 'active' || store.is_active);

        if (activeStores.length === 0) {
          // No active stores - redirect to onboarding
          navigate('/admin/onboarding', { replace: true });
          return;
        } else {
          // Has active stores - allow access
          setHasStores(true);
        }
      } else {
        // No stores at all - redirect to onboarding
        navigate('/admin/onboarding', { replace: true });
        return;
      }
    } catch (err) {
      console.error('Store status check error:', err);
      // Error checking - allow access (fail open)
      setHasStores(true);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    // Show loading while checking
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Render children (the protected page)
  return children;
}
