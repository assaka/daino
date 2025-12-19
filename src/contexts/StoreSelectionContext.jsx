import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Store } from '@/api/entities';
import { useLocation } from 'react-router-dom';

const StoreSelectionContext = createContext();

export const useStoreSelection = () => {
  const context = useContext(StoreSelectionContext);
  if (!context) {
    throw new Error('useStoreSelection must be used within a StoreSelectionProvider');
  }
  return context;
};

export const StoreSelectionProvider = ({ children }) => {
  const location = useLocation();
  const [availableStores, setAvailableStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(() => {
    // Try to restore from localStorage immediately
    const savedStoreId = localStorage.getItem('selectedStoreId');
    const savedStoreName = localStorage.getItem('selectedStoreName');
    const savedStoreSlug = localStorage.getItem('selectedStoreSlug');
    const savedStoreStatus = localStorage.getItem('selectedStoreStatus');
    const savedThemePreset = localStorage.getItem('selectedStoreThemePreset');
    if (savedStoreId && savedStoreName) {
      return { id: savedStoreId, name: savedStoreName, slug: savedStoreSlug, status: savedStoreStatus, theme_preset: savedThemePreset || null };
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [storeHealth, setStoreHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const storesLoadedRef = useRef(false);
  const healthCheckedRef = useRef(null); // Track which store ID was health-checked

  // Check if we're on an admin page (exclude auth and onboarding)
  const isAdminPage = () => {
    const path = location.pathname;
    const isAuth = path === '/admin/auth' || path === '/auth';
    const isOnboarding = path === '/admin/onboarding' || path.startsWith('/admin/onboarding');

    if (isAuth || isOnboarding) {
      return false; // Don't load stores on auth/onboarding
    }

    return path.startsWith('/admin') || path.startsWith('/editor') || path.startsWith('/plugins');
  };

  // Load available stores on mount only if on admin pages
  useEffect(() => {
    if (isAdminPage()) {
      // Skip loading if stores are already loaded - prevents extra API calls on navigation
      if (storesLoadedRef.current && selectedStore?.id) {
        setLoading(false);
        return;
      }
      loadStores();
    } else {
      // Not on admin page, skip loading
      setLoading(false);
    }
  }, [location.pathname]);

  // Listen for logout events and reset context
  useEffect(() => {
    const handleLogout = () => {
      setAvailableStores([]);
      setSelectedStore(null);
      setLoading(true);
      storesLoadedRef.current = false;
    };

    window.addEventListener('userLoggedOut', handleLogout);
    return () => window.removeEventListener('userLoggedOut', handleLogout);
  }, []);

  // Quick health check - just query tenant DB stores table
  const quickHealthCheck = async (storeId) => {
    try {
      const token = localStorage.getItem('store_owner_auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/stores/${storeId}/health`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return false;

      const result = await response.json();
      return result.success && result.data?.status === 'healthy';
    } catch (err) {
      return false;
    }
  };

  const loadStores = async () => {
    try {
      setLoading(true);

      const stores = await Store.findAll();

      // Always keep existing selection if we have one and no stores were loaded
      if (stores.length === 0 && selectedStore) {
        setAvailableStores([selectedStore]); // Keep the current store in the list
        storesLoadedRef.current = true;
        return; // Don't change selection
      }

      setAvailableStores(stores);
      storesLoadedRef.current = true;

      // Auto-select first ACTIVE store or load from localStorage
      if (stores.length > 0) {
        const savedStoreId = localStorage.getItem('selectedStoreId');
        let savedStore = savedStoreId ? stores.find(s => s.id === savedStoreId) : null;

        if (savedStore) {
          // Found the saved store - allow pending_database stores to be selected (for database setup)
          if (savedStore.is_active || savedStore.status === 'pending_database') {
            // Skip health check for pending_database stores (they don't have a DB yet)
            if (savedStore.status === 'pending_database') {
              setSelectedStore({ ...savedStore, database_healthy: false });
            } else {
              // Do quick health check for active stores
              const isHealthy = await quickHealthCheck(savedStore.id);
              setSelectedStore({ ...savedStore, database_healthy: isHealthy });
            }
            localStorage.setItem('selectedStoreId', savedStore.id);
            localStorage.setItem('selectedStoreName', savedStore.name);
            localStorage.setItem('selectedStoreSlug', savedStore.slug || savedStore.code);
            localStorage.setItem('selectedStoreStatus', savedStore.status || '');
            localStorage.setItem('selectedStoreThemePreset', savedStore.theme_preset || '');
          } else {
            // Saved store is not active and not pending_database - clear it and select first active store
            localStorage.removeItem('selectedStoreId');
            localStorage.removeItem('selectedStoreName');
            localStorage.removeItem('selectedStoreSlug');
            localStorage.removeItem('selectedStoreStatus');
            localStorage.removeItem('selectedStoreThemePreset');

            const firstActiveStore = stores.find(s => s.is_active && s.status !== 'pending_database') || stores.find(s => s.is_active) || stores[0];

            if (firstActiveStore) {
              const isHealthy = await quickHealthCheck(firstActiveStore.id);
              setSelectedStore({ ...firstActiveStore, database_healthy: isHealthy });
              localStorage.setItem('selectedStoreId', firstActiveStore.id);
              localStorage.setItem('selectedStoreName', firstActiveStore.name);
              localStorage.setItem('selectedStoreSlug', firstActiveStore.slug || firstActiveStore.code);
              localStorage.setItem('selectedStoreStatus', firstActiveStore.status || '');
              localStorage.setItem('selectedStoreThemePreset', firstActiveStore.theme_preset || '');
            } else {
              // No active stores at all - clear auth and redirect to login
              localStorage.removeItem('store_owner_auth_token');
              localStorage.removeItem('store_owner_user_data');
              localStorage.setItem('user_logged_out', 'true');
              window.location.href = '/admin/auth?error=no_active_store';
            }
          }
        } else {
          // Saved store not found in user's stores list - clear stale localStorage and select first active store
          console.warn('⚠️ StoreSelection: Saved store not found in user stores, clearing stale selection');
          localStorage.removeItem('selectedStoreId');
          localStorage.removeItem('selectedStoreName');
          localStorage.removeItem('selectedStoreSlug');
          localStorage.removeItem('selectedStoreStatus');
          localStorage.removeItem('selectedStoreThemePreset');

          const firstActiveStore = stores.find(s => s.is_active && s.status !== 'pending_database') || stores.find(s => s.is_active) || stores[0];

          if (firstActiveStore) {
            const isHealthy = await quickHealthCheck(firstActiveStore.id);
            setSelectedStore({ ...firstActiveStore, database_healthy: isHealthy });
            localStorage.setItem('selectedStoreId', firstActiveStore.id);
            localStorage.setItem('selectedStoreName', firstActiveStore.name);
            localStorage.setItem('selectedStoreSlug', firstActiveStore.slug || firstActiveStore.code);
            localStorage.setItem('selectedStoreStatus', firstActiveStore.status || '');
            localStorage.setItem('selectedStoreThemePreset', firstActiveStore.theme_preset || '');
          } else {
            console.error('❌ StoreSelection: No stores available!');
          }
        }

      }
    } catch (error) {
      console.error('❌ StoreSelection: Error loading stores:', error);
      // Keep existing selection if we have one
      if (selectedStore) {
        setAvailableStores([selectedStore]);
      } else {
        setAvailableStores([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check store health when selected store changes
  const checkStoreHealth = async (storeId) => {
    if (!storeId) {
      setStoreHealth(null);
      return null;
    }

    // Skip if already checked this store
    if (healthCheckedRef.current === storeId && storeHealth) {
      return storeHealth;
    }

    try {
      setHealthLoading(true);
      const token = localStorage.getItem('store_owner_auth_token');

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/stores/${storeId}/health`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check store health');
      }

      const result = await response.json();

      if (result.success) {
        setStoreHealth(result.data);
        healthCheckedRef.current = storeId;
        return result.data;
      } else {
        setStoreHealth({ status: 'error', message: result.error });
        return null;
      }
    } catch (error) {
      console.error('❌ StoreSelection: Error checking store health:', error);
      setStoreHealth({ status: 'error', message: error.message });
      return null;
    } finally {
      setHealthLoading(false);
    }
  };

  // Check health when selected store changes
  useEffect(() => {
    if (selectedStore?.id && selectedStore.is_active && selectedStore.status === 'active') {
      // If dropdown told us database is unhealthy (no config), set that immediately
      if (selectedStore.database_healthy === false) {
        console.log('🔴 Store database_healthy=false from dropdown, setting health to empty');
        setStoreHealth({
          status: 'empty',
          message: 'Store database needs provisioning',
          actions: ['provision_database', 'remove_store'],
          storeId: selectedStore.id
        });
        healthCheckedRef.current = selectedStore.id;
      } else {
        // database_healthy is null (config exists) or true - assume healthy
        // Skip on-demand health check for speed - errors will surface in API calls
        setStoreHealth({ status: 'healthy' });
        healthCheckedRef.current = selectedStore.id;
      }
    } else {
      setStoreHealth(null);
      healthCheckedRef.current = null;
    }
  }, [selectedStore?.id, selectedStore?.database_healthy]);

  // Reprovision store database
  const reprovisionStore = async (storeName, storeSlug) => {
    if (!selectedStore?.id) return { success: false, error: 'No store selected' };

    try {
      const token = localStorage.getItem('store_owner_auth_token');

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/stores/${selectedStore.id}/reprovision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ storeName, storeSlug })
      });

      const result = await response.json();

      if (result.success) {
        // Re-check health after reprovisioning
        healthCheckedRef.current = null;
        await checkStoreHealth(selectedStore.id);
      }

      return result;
    } catch (error) {
      console.error('❌ StoreSelection: Error reprovisioning store:', error);
      return { success: false, error: error.message };
    }
  };

  // Permanently delete store
  const deleteStorePermanently = async () => {
    if (!selectedStore?.id) return { success: false, error: 'No store selected' };

    try {
      const token = localStorage.getItem('store_owner_auth_token');

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/stores/${selectedStore.id}/permanent`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        // Clear selection and reload stores
        localStorage.removeItem('selectedStoreId');
        localStorage.removeItem('selectedStoreName');
        localStorage.removeItem('selectedStoreSlug');
        localStorage.removeItem('selectedStoreStatus');
        localStorage.removeItem('selectedStoreThemePreset');
        setSelectedStore(null);
        setStoreHealth(null);
        healthCheckedRef.current = null;
        storesLoadedRef.current = false;
        await loadStores();
      }

      return result;
    } catch (error) {
      console.error('❌ StoreSelection: Error deleting store:', error);
      return { success: false, error: error.message };
    }
  };

  const selectStore = (store) => {
    setSelectedStore(store);
    localStorage.setItem('selectedStoreId', store.id);
    localStorage.setItem('selectedStoreName', store.name);
    localStorage.setItem('selectedStoreSlug', store.slug);
    localStorage.setItem('selectedStoreStatus', store.status || '');
    localStorage.setItem('selectedStoreThemePreset', store.theme_preset || '');

    // Dispatch custom event to notify components of store change
    window.dispatchEvent(new CustomEvent('storeSelectionChanged', {
      detail: { store }
    }));
  };

  // Reset health check when store changes
  const handleSelectStore = (store) => {
    healthCheckedRef.current = null;
    setStoreHealth(null);
    selectStore(store);
  };

  const value = {
    availableStores,
    selectedStore,
    loading,
    selectStore: handleSelectStore,
    refreshStores: loadStores,
    getSelectedStoreId: () => selectedStore?.id || null,
    hasMultipleStores: () => availableStores.length > 1,
    // Health check
    storeHealth,
    healthLoading,
    checkStoreHealth,
    reprovisionStore,
    deleteStorePermanently,
    isStoreHealthy: storeHealth?.status === 'healthy',
    needsProvisioning: storeHealth?.status === 'empty' || storeHealth?.status === 'partial'
  };

  return (
    <StoreSelectionContext.Provider value={value}>
      {children}
    </StoreSelectionContext.Provider>
  );
};