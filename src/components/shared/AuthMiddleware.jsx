import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl, createStoreUrl, getStoreSlugFromUrl } from "@/utils";
import { createAdminUrl, createPublicUrl, getStoreSlugFromPublicUrl } from "@/utils/urlUtils";
import { setRoleBasedAuthData } from "@/utils/auth";
import { Auth as AuthService, User } from "@/api/entities";
import apiClient from "@/api/client";
import StoreOwnerAuthLayout from "@/components/admin/StoreOwnerAuthLayout";
import CustomerAuthLayout from "@/components/storefront/CustomerAuthLayout";
import { useTranslation } from "@/contexts/TranslationContext";

// Helper function to clear logout state and retry authentication
window.clearLogoutState = () => {
  localStorage.removeItem('user_logged_out');
  apiClient.isLoggedOut = false;
  window.location.reload();
};

// Helper function to check localStorage user data
window.checkUserData = () => {
  const storeOwnerUserData = localStorage.getItem('store_owner_user_data');
  const customerUserData = localStorage.getItem('customer_user_data'); 

  if (storeOwnerUserData) {
    try {
      const parsed = JSON.parse(storeOwnerUserData);
    } catch (e) {
    }
  }
  
  if (customerUserData) {
    try {
      const parsed = JSON.parse(customerUserData);
    } catch (e) {
    }
  }
};

// Helper function to decode JWT token and compare with localStorage data
window.checkTokenData = () => {
  const token = localStorage.getItem('store_owner_auth_token');
  const userData = localStorage.getItem('store_owner_user_data');
  
  if (token) {
    try {
      // Decode JWT payload (basic decode, not verification)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const tokenData = JSON.parse(jsonPayload);
      
      if (userData) {
        const userDataParsed = JSON.parse(userData);
      }
    } catch (e) {
      console.error('Error decoding token:', e);
    }
  }
};

// Helper function to check store ownership and permissions
window.checkStoreOwnership = async () => {
  const { Store, User } = await import('@/api/entities');
  
  try {
    // Get current user
    const user = await User.me();

    // Get user's stores
    const stores = await Store.getUserStores();
    
    if (stores.length > 0) {
      stores.forEach(store => {
        // Check all possible owner fields
        const ownerFields = {
          user_id: store.user_id,
          created_by: store.created_by,
          userId: store.userId
        };
      });
      
      // Check localStorage selected store
      const selectedStoreId = localStorage.getItem('selectedStoreId');
      
      if (selectedStoreId) {
        const selectedStore = stores.find(s => s.id === selectedStoreId);
      }
    }
  } catch (error) {
    console.error('Error in ownership check:', error);
  }
};

// Helper function to switch to a store you actually own
window.switchToOwnedStore = async () => {
  const { Store, User } = await import('@/api/entities');
  
  try {
    const user = await User.me();
    const stores = await Store.getUserStores();

    // Find stores where user_id matches
    const ownedStores = stores.filter(s => s.user_id === user.id);

    if (ownedStores.length > 0) {
      const firstOwned = ownedStores[0];
      
      // Update localStorage
      localStorage.setItem('selectedStoreId', firstOwned.id);
      
      return firstOwned;
    }
  } catch (error) {
  }
};

// Helper function to fix store ownership
window.fixStoreOwnership = async () => {
  const { Store, User } = await import('@/api/entities');
  
  try {
    const user = await User.me();
    const stores = await Store.getUserStores();
    
    if (stores.length === 0) {
      return;
    }
    
    const store = stores[0];

    // Try to update the store's user_id
    try {

      if (store.user_id === user.id) {
        return;
      }

      const updateData = {
        user_id: user.id
      };

      const updated = await Store.update(store.id, updateData);

      // Verify the update
      const verifyStores = await Store.getUserStores();
      const verifyStore = verifyStores.find(s => s.id === store.id);

    } catch (error) {
    }
    
  } catch (error) {
    console.error('Error fixing ownership:', error);
  }
};

// Helper function to check delivery settings ownership
window.checkDeliveryOwnership = async () => {
  const { DeliverySettings, Store } = await import('@/api/entities');
  
  try {
    // Get current user's stores
    const stores = await Store.getUserStores();
    
    if (stores.length === 0) {
      return;
    }
    
    // Check delivery settings for each store
    for (const store of stores) {
      try {
        const settings = await DeliverySettings.filter({ store_id: store.id });
      } catch (error) {
      }
    }
    
    // Check the specific problematic ID
    try {
      const problematicSettings = await DeliverySettings.findById('dc0d4518-cbd1-4cb7-9238-10ac381f5fac');
    } catch (error) {
    }
    
  } catch (error) {
  }
};

// Helper function to manually fetch and store user data for current session
window.fixUserData = async () => {
  
  try {
    const token = localStorage.getItem('store_owner_auth_token');
    if (!token) {
      return;
    }

    apiClient.setToken(token);

    const { User } = await import('@/api/entities');
    const user = await User.me();
    
    if (user && user.id) {
      // Store user data WITHOUT credits (credits fetched live from database)
      const { credits, ...userDataWithoutCredits } = user;
      localStorage.setItem('store_owner_user_data', JSON.stringify(userDataWithoutCredits));
      window.location.reload();
    } else {
    }
  } catch (error) {
  }
};

// Helper function to create a complete authenticated session (NOTE: Creates mock token - backend will reject)
window.createAuthSession = () => {
  // Clear logout state completely
  localStorage.removeItem('user_logged_out');
  apiClient.isLoggedOut = false;
  
  // Create realistic auth data
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6InRlc3RAYXV0aGVudGljYXRlZC5jb20iLCJyb2xlIjoic3RvcmVfb3duZXIifQ.test_signature';
  const userData = {
    id: 1,
    email: 'test@authenticated.com',
    role: 'store_owner',
    account_type: 'agency',
    first_name: 'Store',
    last_name: 'Owner',
    is_active: true,
    email_verified: true
  };
  
  // Set both in localStorage and apiClient
  localStorage.setItem('store_owner_auth_token', token);
  localStorage.setItem('store_owner_user_data', JSON.stringify(userData));
  apiClient.setToken(token);

  // Reload to trigger auth check
  window.location.reload();
};

// Helper function to clear all authentication data
window.clearAllAuth = () => {
  
  // Clear all possible auth-related keys
  const authKeys = [
    'user_logged_out',
    'store_owner_auth_token',
    'store_owner_user_data', 
    'customer_auth_token',
    'customer_user_data',
    'guest_session_id'
  ];
  
  authKeys.forEach(key => {
    localStorage.removeItem(key);
  });
  
  apiClient.setToken(null);
  apiClient.isLoggedOut = false;

  window.location.reload();
};


export default function AuthMiddleware({ role = 'store_owner' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    
    const token = searchParams.get('token');
    const oauth = searchParams.get('oauth');
    const errorParam = searchParams.get('error');

    if (token && oauth === 'success') {
      apiClient.setToken(token);
      checkAuthStatus();
    } else if (errorParam) {
      setError(getErrorMessage(errorParam));
    } else {
      // Check if user is already logged in based on role
      const tokenKey = role === 'customer' ? 'customer_auth_token' : 'store_owner_auth_token';
      const existingToken = localStorage.getItem(tokenKey);

      if (existingToken) {
        // Always clear logout flag when we have a token - important for post-login flow
        if (localStorage.getItem('user_logged_out') === 'true') {
          localStorage.removeItem('user_logged_out');
          apiClient.isLoggedOut = false;
        }

        apiClient.setToken(existingToken);
        checkAuthStatus();
      }
    }
  }, [searchParams, role]);

  const getErrorMessage = (error) => {
    const errorKeyMap = {
      'oauth_failed': 'auth.error.oauth_failed',
      'token_generation_failed': 'auth.error.token_generation_failed',
      'database_connection_failed': 'auth.error.database_connection_failed'
    };
    return t(errorKeyMap[error] || 'auth.error.general');
  };

  const checkAuthStatus = async () => {
    try {
      
      if (apiClient.isLoggedOut) {
        return;
      }

      const user = await User.me();
      
      if (!user) {
        return;
      }
      
      // CRITICAL FIX: Store user data in localStorage
      const currentToken = apiClient.getToken();
      if (currentToken && user) {
        setRoleBasedAuthData(user, currentToken);
      }

      // Redirect based on user role and expected role
      if (role === 'customer') {
        if (user.role === 'store_owner' || user.role === 'admin') {
          navigate(createAdminUrl("ADMIN_AUTH"));
        } else if (user.role === 'customer') {
          const returnTo = searchParams.get('returnTo');
          if (returnTo) {
            navigate(returnTo);
          } else {
            const storefrontUrl = await getStorefrontUrl();
            navigate(storefrontUrl);
          }
        }
      } else {
        if (user.role === 'customer') {
          // Get store slug from current URL or use default
          const currentStoreSlug = getStoreSlugFromPublicUrl(window.location.pathname) || 'default';
          navigate(createPublicUrl(currentStoreSlug, "CUSTOMER_AUTH"));
        } else if (user.role === 'store_owner' || user.role === 'admin') {
          // Check for redirect parameter first (e.g., from invitation acceptance flow)
          const redirectUrl = searchParams.get('redirect');
          if (redirectUrl) {
            navigate(decodeURIComponent(redirectUrl));
          } else {
            const dashboardUrl = createAdminUrl("DASHBOARD");
            navigate(dashboardUrl);
          }
        }
      }
    } catch (error) {
      
      // If token is invalid, clear it automatically
      if (error.message && (error.message.includes('Invalid token') || error.message.includes('Unauthorized'))) {
        // Clear tokens for the current role
        const tokenKey = role === 'customer' ? 'customer_auth_token' : 'store_owner_auth_token';
        const userDataKey = role === 'customer' ? 'customer_user_data' : 'store_owner_user_data';
        
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userDataKey);
        apiClient.setToken(null);

      }
    }
  };

  const getCustomerAccountUrl = async () => {
    // First try to get from localStorage
    const savedStoreCode = localStorage.getItem('customer_auth_store_code');
    if (savedStoreCode) {
      return createPublicUrl(savedStoreCode, 'ACCOUNT');
    }
    
    // Try to get from current URL (new and legacy)
    const currentStoreSlug = getStoreSlugFromPublicUrl(window.location.pathname) || 
                             getStoreSlugFromUrl(window.location.pathname);
    if (currentStoreSlug) {
      return createPublicUrl(currentStoreSlug, 'ACCOUNT');
    }
    
    // Try to fetch the first available store
    try {
      const { Store } = await import('@/api/entities');
      const stores = await Store.findAll();
      if (stores && stores.length > 0) {
        const firstStore = stores[0];
        return createPublicUrl(firstStore.slug, 'ACCOUNT');
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
    
    // Default fallback to new URL structure
    return createPublicUrl('default', 'ACCOUNT');
  };

  const handleAuth = async (formData, isLogin) => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (isLogin) {
        const response = await AuthService.login(
          formData.email,
          formData.password,
          formData.rememberMe,
          role
        );

        // Handle both array and object responses
        let actualResponse = response;
        if (Array.isArray(response)) {
          actualResponse = response[0];
        }
        
        // Check multiple possible success indicators
        const isSuccess = actualResponse?.success || 
                         actualResponse?.status === 'success' || 
                         actualResponse?.token || 
                         (actualResponse && Object.keys(actualResponse).length > 0);

        if (isSuccess) {
          const token = actualResponse.data?.token || actualResponse.token;
          
          if (token) {
            
            // Clear logged out flag before setting token
            localStorage.removeItem('user_logged_out');
            apiClient.isLoggedOut = false; // Critical: Clear the logged out flag

            // Store token based on role
            const tokenKey = role === 'customer' ? 'customer_auth_token' : 'store_owner_auth_token';
            localStorage.setItem(tokenKey, token);

            // Verify token was stored
            const verifyToken = localStorage.getItem(tokenKey);

            apiClient.setToken(token);
            
            // CRITICAL FIX: Store user data from login response
            const userData = actualResponse.data?.user || actualResponse.user || actualResponse;
            if (userData && userData.id) {
              setRoleBasedAuthData(userData, token);
            }
            
            // For customers, navigate immediately without verification
            if (role === 'customer') {
              localStorage.removeItem('customer_auth_store_id');
              localStorage.removeItem('customer_auth_store_code');
              
              const returnTo = searchParams.get('returnTo');
              if (returnTo) {
                navigate(returnTo);
              } else {
                const accountUrl = await getCustomerAccountUrl();
                navigate(accountUrl);
              }
              return;
            }
            
            // For store owners, check if they have active stores and redirect accordingly

            // Check if backend flagged this user as needing onboarding
            const requiresOnboarding = actualResponse.data?.requiresOnboarding;

            if (requiresOnboarding) {
              window.location.href = '/admin/onboarding';
              return;
            }

            setTimeout(async () => {
              try {
                // Get user data which includes store_id from JWT token
                const userData = actualResponse.data?.user || actualResponse.user || actualResponse;

                // Try to get store_id from user data, or decode from JWT token
                let storeId = userData.store_id;

                if (!storeId && token) {
                  // Decode JWT to get store_id (check both snake_case and camelCase)
                  try {
                    const base64Url = token.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    const tokenData = JSON.parse(jsonPayload);
                    // Check both store_id (snake_case) and storeId (camelCase) for compatibility
                    storeId = tokenData.store_id || tokenData.storeId;
                  } catch (decodeError) {
                    console.error('❌ Error decoding JWT:', decodeError);
                  }
                }

                if (storeId) {

                  // BETTER APPROACH: Fetch from /stores/dropdown directly
                  // The /stores/{id} endpoint seems to return malformed data
                  try {
                    const dropdownResponse = await apiClient.get('/stores/dropdown');
                    const stores = dropdownResponse.data || dropdownResponse;

                    // CRITICAL: Don't blindly trust storeId from JWT
                    // Check if it's actually active, otherwise use first active store
                    let selectedStore = stores.find(s => s.id === storeId);

                    if (selectedStore) {
                      // Check if this store is actually active and ready
                      if (!selectedStore.is_active || selectedStore.status === 'pending_database') {
                        selectedStore = null;
                      }
                    }

                    // If JWT store not found or not active, use first active store
                    if (!selectedStore) {
                      selectedStore = stores.find(s => s.is_active && s.status !== 'pending_database') || stores.find(s => s.is_active) || stores[0];
                    }

                    if (selectedStore) {
                      // Set all store context in localStorage
                      localStorage.setItem('selectedStoreId', selectedStore.id);
                      localStorage.setItem('selectedStoreSlug', selectedStore.slug || selectedStore.code);
                      localStorage.setItem('selectedStoreName', selectedStore.name);

                      // CRITICAL: Wait a tick to ensure localStorage is fully written
                      await new Promise(resolve => setTimeout(resolve, 50));

                      // Check for redirect parameter (e.g., from invitation acceptance flow)
                      const redirectUrl = searchParams.get('redirect');
                      if (redirectUrl) {
                        window.location.href = decodeURIComponent(redirectUrl);
                      } else {
                        const dashboardUrl = createAdminUrl("DASHBOARD");
                        window.location.href = dashboardUrl;
                      }
                    } else {

                      // Clear all authentication data
                      localStorage.removeItem('store_owner_auth_token');
                      localStorage.removeItem('store_owner_user_data');
                      localStorage.removeItem('selectedStoreId');
                      localStorage.removeItem('selectedStoreSlug');
                      localStorage.removeItem('selectedStoreName');
                      localStorage.setItem('user_logged_out', 'true');
                      apiClient.clearToken();
                      apiClient.isLoggedOut = true;

                      // Redirect to login with error message
                      const loginUrl = createAdminUrl("ADMIN_AUTH");
                      window.location.href = loginUrl + '?error=no_active_store';
                    }
                  } catch (dropdownError) {
                    // Last resort: just set the storeId and navigate
                    localStorage.setItem('selectedStoreId', storeId);
                    window.location.href = createAdminUrl("DASHBOARD");
                  }
                } else {
                  // No active stores found - check for redirect parameter first (invitation flow)
                  const redirectUrl = searchParams.get('redirect');
                  if (redirectUrl) {
                    // User is likely accepting an invitation - redirect there to complete
                    window.location.href = decodeURIComponent(redirectUrl);
                  } else {
                    // No redirect, go to onboarding
                    const onboardingUrl = createAdminUrl("StoreOnboarding");
                    navigate(onboardingUrl || '/admin/onboarding');
                  }
                }
              } catch (error) {
                // On error, check for redirect parameter first
                const redirectUrl = searchParams.get('redirect');
                if (redirectUrl) {
                  window.location.href = decodeURIComponent(redirectUrl);
                } else {
                  // On error with no redirect, redirect to onboarding (safer fallback)
                  const onboardingUrl = createAdminUrl("StoreOnboarding");
                  navigate(onboardingUrl || '/admin/onboarding');
                }
              }
            }, 100); // Small delay to ensure token is set
          }
        }
      } else {
        // Registration
        if (formData.password !== formData.confirmPassword) {
          setError(t('message.password_mismatch', 'Passwords do not match'));
          return;
        }

        const registerData = {
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: role,
          account_type: role === 'customer' ? 'individual' : 'agency'
        };

        // Add store_id for customer registration
        if (role === 'customer') {
          const savedStoreId = localStorage.getItem('customer_auth_store_id');
          registerData.store_id = savedStoreId;
        }
        
        const response = await AuthService.register(registerData);
        
        // Handle both array and object responses for registration
        let actualRegResponse = response;
        if (Array.isArray(response)) {
          actualRegResponse = response[0];
        }
        
        if (actualRegResponse?.success) {
          const token = actualRegResponse.data?.token || actualRegResponse.token;
          
          if (token) {
            // Clear logged out flag before setting token
            localStorage.removeItem('user_logged_out');
            
            const tokenKey = role === 'customer' ? 'customer_auth_token' : 'store_owner_auth_token';
            localStorage.setItem(tokenKey, token);
            apiClient.setToken(token);
            
            if (role === 'customer') {
              localStorage.removeItem('customer_auth_store_id');
              localStorage.removeItem('customer_auth_store_code');
              const accountUrl = await getCustomerAccountUrl();
              navigate(accountUrl);
            } else {
              setSuccess(t('auth.success.user_created'));
              setTimeout(() => {
                // Check for redirect parameter (e.g., from invitation acceptance flow)
                const redirectUrl = searchParams.get('redirect');
                if (redirectUrl) {
                  navigate(decodeURIComponent(redirectUrl));
                } else {
                  navigate(createAdminUrl("DASHBOARD"));
                }
              }, 1500);
            }
          }
        }
      }
    } catch (error) {

      // Check if this is a NO_STORE error - redirect to onboarding instead of showing error
      const isNoStoreError = error.data?.code === 'NO_STORE' ||
                             error.message?.includes('No store found');

      if (isNoStoreError && role !== 'customer') {
        navigate('/admin/onboarding');
        return;
      }

      const defaultMessage = isLogin ? t('common.login_failed') : t('customer_auth.error.registration_failed');
      setError(error.message || defaultMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    if (role === 'customer') {
      setError(t('auth.error.google_not_available_customer'));
      return;
    }
    setLoading(true);
    setError("");
    
    const googleAuthUrl = `${apiClient.baseURL}/api/auth/google`;

    // Add a timeout to check if redirect fails
    const redirectTimeout = setTimeout(() => {
      setError(t('auth.error.google_redirect_failed'));
      setLoading(false);
    }, 5000);
    
    // Clear timeout if page unloads (successful redirect)
    window.addEventListener('beforeunload', () => {
      clearTimeout(redirectTimeout);
    });
    
    try {
      window.location.href = googleAuthUrl;
    } catch (error) {
      setError(t('auth.error.redirect_failed'));
      setLoading(false);
    }
  };

  // Render appropriate layout based on role
  if (role === 'customer') {
    return (
      <CustomerAuthLayout
        loading={loading}
        error={error}
        success={success}
        onAuth={handleAuth}
        onGoogleAuth={handleGoogleAuth}
      />
    );
  } else {
    return (
      <StoreOwnerAuthLayout
        loading={loading}
        error={error}
        success={success}
        onAuth={handleAuth}
        onGoogleAuth={handleGoogleAuth}
      />
    );
  }
}