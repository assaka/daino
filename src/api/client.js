// API Client for backend communication
import { apiDebugger } from '../utils/api-debugger.js';

class ApiClient {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    this.apiVersion = import.meta.env.VITE_API_VERSION || 'v1';
    
    // Check if user was explicitly logged out (persists across page reloads)
    const logoutFlag = localStorage.getItem('user_logged_out');
    
    this.isLoggedOut = logoutFlag === 'true';
    this.token = null; // Will be set dynamically based on current context
    
    // Initialize debugging and register known schemas
    this.initializeDebugging();
  }

  // Initialize debugging system
  initializeDebugging() {
    // Register known API schemas for validation
    apiDebugger.registerSchema('/integrations/akeneo/custom-mappings', {
      success: 'boolean',
      mappings: {
        attributes: 'array',
        images: 'array',
        files: 'array'
      }
    }, 'Akeneo custom mappings endpoint');

    apiDebugger.registerSchema('/products', {
      success: 'boolean',
      data: 'array'
    }, 'Products list endpoint');

    apiDebugger.registerSchema('/categories', {
      success: 'boolean', 
      data: 'array'
    }, 'Categories list endpoint');

    // Register transformation rules
    apiDebugger.registerTransformation('/custom-mappings', 
      'No transformation - return raw response', 
      'Custom mappings should not be transformed');
  }

  // Set auth token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.removeItem('user_logged_out'); // Clear logout flag when setting new token
      this.isLoggedOut = false; // Reset logout state when setting new token
    } else {
      localStorage.setItem('user_logged_out', 'true'); // Persist logout state across page reloads
      // Ensure in-memory token is also cleared
      this.token = null;
      this.isLoggedOut = true; // Mark as logged out when clearing token
    }
  }

  // Get auth token - automatically determine which role-specific token to use
  getToken() {
    // Always check the logout flag in localStorage as well
    if (this.isLoggedOut || localStorage.getItem('user_logged_out') === 'true') {
      return null;
    }
    
    // If token was explicitly set (e.g., by role switching), use it
    if (this.token) {
      return this.token;
    }
    
    // Auto-determine token based on current context - prioritize store owner for admin pages
    const currentPath = window.location.pathname.toLowerCase();
    
    // Admin context: /admin/* routes (covers all new admin URLs)
    const isAdminContext = currentPath.startsWith('/admin/') ||
                          currentPath === '/dashboard' || 
                          currentPath === '/auth' ||
                          currentPath === '/ai-context-window' ||
                          currentPath.startsWith('/editor/') ||
                          // Legacy paths for backward compatibility
                          currentPath.includes('/dashboard') || 
                          currentPath.includes('/products') || 
                          currentPath.includes('/categories') || 
                          currentPath.includes('/settings') ||
                          currentPath.includes('/file-library');
    
    // Customer context: /public/* routes and legacy customer routes
    const isCustomerContext = currentPath.startsWith('/public/') ||
                             currentPath.includes('/storefront') || 
                             currentPath.includes('/cart') || 
                             currentPath.includes('/checkout') ||
                             currentPath.includes('/customerdashboard');
    
    // Check role-specific tokens
    const storeOwnerToken = localStorage.getItem('store_owner_auth_token');
    const customerToken = localStorage.getItem('customer_auth_token');

    if (isAdminContext && storeOwnerToken) {
      return storeOwnerToken;
    } else if (isCustomerContext && customerToken) {
      return customerToken;
    } else if (storeOwnerToken) {
      // Default to store owner token if available (admin priority)
      return storeOwnerToken;
    } else if (customerToken) {
      // Fallback to customer token
      return customerToken;
    }
    
    return null;
  }

  // Build full URL
  buildUrl(endpoint) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    
    // In development with Vite proxy, use relative URLs that get proxied
    if (import.meta.env.DEV) {
      return `/api/${cleanEndpoint}`;
    }
    
    // In production, use the full base URL
    return `${this.baseURL}/api/${cleanEndpoint}`;
  }

  // Get or create session ID for A/B testing
  getSessionId() {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }

  // Default headers
  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    const token = this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Add X-Language header from localStorage
    const currentLanguage = localStorage.getItem('daino_language') || 'en';
    headers['X-Language'] = currentLanguage;

    // Add X-Store-Id header from localStorage (selected store)
    const selectedStoreId = localStorage.getItem('selectedStoreId');
    if (selectedStoreId && selectedStoreId !== 'undefined') {
      headers['x-store-id'] = selectedStoreId;
    }

    // Add X-Session-ID for A/B testing (consistent across requests)
    const sessionId = this.getSessionId();
    headers['X-Session-ID'] = sessionId;

    return headers;
  }

  // Public request method (no authentication required)
  async publicRequest(method, endpoint, data = null, customHeaders = {}) {
    // For public endpoints, use /api/public/ prefix
    const publicEndpoint = endpoint.startsWith('public/') ? endpoint : `public/${endpoint}`;
    const url = this.buildUrl(publicEndpoint);

    // Add X-Language header from localStorage
    const currentLanguage = localStorage.getItem('daino_language') || 'en';

    const headers = {
      'Content-Type': 'application/json',
      'X-Language': currentLanguage,
      ...customHeaders
    };

    const config = {
      method,
      headers,
      credentials: 'include'
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Unexpected response type: ${contentType}`);
      }

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || result.message || `HTTP error! status: ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = result;
        throw error;
      }

      // Handle wrapped API responses
      if (result && typeof result === 'object' && result.success && result.data) {
        if (Array.isArray(result.data)) {
          return result.data;
        }
        
        if (result.data && typeof result.data === 'object' && result.data.id) {
          return [result.data];
        }
        
        const dataEntries = Object.entries(result.data);
        for (const [key, value] of dataEntries) {
          if (Array.isArray(value) && key !== 'gdpr_countries') {
            return value;
          }
        }
        
        return [result.data];
      }
      
      return result;
    } catch (error) {
      console.error(`Public API request failed: ${method} ${url}`, error);
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server');
      }
      
      throw error;
    }
  }

  // Generic request method
  async request(method, endpoint, data = null, customHeaders = {}) {

    const startTime = performance.now();
    const debugId = apiDebugger.debugAPICall('request', {
      endpoint,
      method,
      data,
      headers: customHeaders
    });

    // Check for auth routes
    const isAuthRoute = endpoint.startsWith('auth/');

    // Check for public endpoints that should work even when logged out
    const isPublicEndpoint = endpoint.startsWith('public/') ||
                            endpoint.includes('/published/') || // Published slot configurations
                            endpoint.includes('/health') ||
                            endpoint.includes('/version') ||
                            endpoint.includes('/translations/') || // Translation endpoints (UI labels, etc.)
                            endpoint.includes('/canonical-urls/') || // Canonical URLs for SEO (public access)
                            endpoint === 'languages' || // Language list endpoint
                            endpoint === '/languages';

    // Prevent authenticated requests if user has been logged out, except for auth routes and public endpoints
    if (!isAuthRoute && !isPublicEndpoint && (this.isLoggedOut || localStorage.getItem('user_logged_out') === 'true')) {
      throw new Error('Session has been terminated. Please log in again.');
    }

    const url = this.buildUrl(endpoint);
    const headers = this.getHeaders(customHeaders);

    // Extract options from headers (if passed as a special header)
    const skipTransform = customHeaders['x-skip-transform'] === 'true';
    delete customHeaders['x-skip-transform'];

    const config = {
      method,
      headers,
      credentials: 'include'
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Unexpected response type: ${contentType}`);
      }

      const result = await response.json();


      if (!response.ok) {
        // Check for authentication failures that should trigger logout
        if (response.status === 401 || response.status === 403) {
          const errorMessage = result.message || result.error || '';

          // Check for specific authentication error patterns
          const isAuthError = errorMessage.includes('store_owner_auth_token') ||
                             errorMessage.includes('Missing store_owner_auth_token') ||
                             errorMessage.includes('Invalid token') ||
                             errorMessage.includes('Unauthorized') ||
                             errorMessage.includes('Authentication failed') ||
                             errorMessage.includes('Token expired');

          if (isAuthError && !isAuthRoute) {
            console.warn('❌ Authentication failure detected, logging out user:', errorMessage);
            this.handleAuthenticationFailure();
          }
        }

        // Handle API errors - check both 'error' and 'message' fields
        const errorMessage = result.error || result.message || `HTTP error! status: ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = result;
        throw error;
      }

      // Handle wrapped API responses - extract the actual data array
      // Skip transformation if explicitly requested
      if (skipTransform) {
        return result;
      }
      
      // ONLY transform responses for known list endpoints
      // Exclude POST/PUT/PATCH requests as they typically create/update single resources
      const isListEndpoint = method === 'GET' && (
                            endpoint.includes('/list') ||
                            endpoint.endsWith('s') && !endpoint.includes('/stats') &&
                            !endpoint.includes('/status') &&
                            !endpoint.includes('/config') &&
                            !endpoint.includes('/test') &&
                            !endpoint.includes('/save')
                            );
      
      // Special handling for storage endpoints - don't transform, return full response
      if (endpoint.includes('/storage/')) {
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: result,
          status: response.status,
          transformed: false
        });
        return result;
      }
      
      // Special handling for custom mappings endpoint - don't transform, return full response
      if (endpoint.includes('/custom-mappings')) {
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: result,
          status: response.status,
          transformed: false
        });
        return result;
      }
      
      // Special handling for patches endpoints - don't transform, return full response
      if (endpoint.includes('/patches/') || endpoint.startsWith('patches/')) {
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: result,
          status: response.status,
          transformed: false
        });
        return result;
      }
      
      // Special handling for extensions/baselines endpoint - don't transform, return full response
      if (endpoint.includes('extensions/baselines')) {
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: result,
          status: response.status,
          transformed: false
        });
        return result;
      }

      // Special handling for translations endpoints - don't transform, return full response
      if (endpoint.includes('translations/')) {
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: result,
          status: response.status,
          transformed: false
        });
        return result;
      }

      // Special handling for languages endpoint - don't transform, return full response
      if (endpoint === 'languages' || endpoint === '/languages') {
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: result,
          status: response.status,
          transformed: false
        });
        return result;
      }

      // Special handling for stores/dropdown endpoint - don't transform, return full response
      if (endpoint === 'stores/dropdown' || endpoint === '/stores/dropdown') {
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: result,
          status: response.status,
          transformed: false
        });
        return result;
      }

      // Special handling for heatmap endpoints - don't transform, return full response
      if (endpoint.includes('heatmap/')) {
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: result,
          status: response.status,
          transformed: false
        });
        return result;
      }
      
      let transformedResult = result;
      if (isListEndpoint && result && typeof result === 'object' && result.success && result.data) {
        // If data is already an array, return it directly (for list responses)
        if (Array.isArray(result.data)) {
          transformedResult = result.data;
        }
        // If data is an object with an 'id' field, it's a single record - wrap in array
        else if (result.data && typeof result.data === 'object' && result.data.id) {
          transformedResult = [result.data];
        }
        // Handle paginated responses with arrays in data properties (only for list endpoints)
        else {
          const dataEntries = Object.entries(result.data);
          for (const [key, value] of dataEntries) {
            if (Array.isArray(value) && key !== 'gdpr_countries') {
              transformedResult = value;
              break;
            }
          }
          // Default: return the data object wrapped in array
          if (transformedResult === result) {
            transformedResult = [result.data];
          }
        }
        
        // Debug transformed response
        const duration = performance.now() - startTime;
        apiDebugger.debugAPICall('response', {
          debugId,
          endpoint,
          method,
          duration: Math.round(duration),
          rawResponse: result,
          response: transformedResult,
          status: response.status,
          transformed: true
        });
        
        return transformedResult;
      }
      
      // Debug untransformed response (no special handling matched)
      const duration = performance.now() - startTime;
      apiDebugger.debugAPICall('response', {
        debugId,
        endpoint,
        method,
        duration: Math.round(duration),
        rawResponse: result,
        response: result,
        status: response.status,
        transformed: false
      });

      return result;
    } catch (error) {
      // Debug error response
      const duration = performance.now() - startTime;
      apiDebugger.debugAPICall('error', {
        debugId,
        endpoint,
        method,
        duration: Math.round(duration),
        error,
        status: error.status
      });

      // Suppress "No token provided" errors for auth/me endpoint (expected for guest users)
      const isAuthMeEndpoint = endpoint.includes('auth/me');
      const isNoTokenError = error.message && error.message.includes('No token provided');

      if (!(isAuthMeEndpoint && isNoTokenError)) {
        console.error(`API request failed: ${method} ${url}`, error);
      }
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server');
      }
      
      throw error;
    }
  }

  // HTTP methods
  async get(endpoint, options = {}) {
    // Handle both old format (headers as second param) and new format (options object)
    if (options.params) {
      // Build query string from params
      const queryString = new URLSearchParams(options.params).toString();
      const endpointWithQuery = queryString ? `${endpoint}?${queryString}` : endpoint;
      return this.request('GET', endpointWithQuery, null, options.headers || {});
    }
    // Backwards compatibility: treat second param as headers if not an options object
    return this.request('GET', endpoint, null, options);
  }

  async post(endpoint, data, customHeaders = {}) {
    return this.request('POST', endpoint, data, customHeaders);
  }

  async put(endpoint, data, customHeaders = {}) {
    return this.request('PUT', endpoint, data, customHeaders);
  }

  async patch(endpoint, data, customHeaders = {}) {
    return this.request('PATCH', endpoint, data, customHeaders);
  }

  async delete(endpoint, options = {}) {
    // Support both data and customHeaders
    const data = options.data || null;
    const customHeaders = options.headers || {};  // ❌ FIX: Don't fallback to options!
    const result = await this.request('DELETE', endpoint, data, customHeaders);
    return result;
  }

  // File upload
  async uploadFile(endpoint, file, additionalData = {}) {
    const url = this.buildUrl(endpoint);
    const token = this.getToken();

    const formData = new FormData();
    formData.append('file', file);

    // Add additional data to form
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    // Build headers - include auth token and store ID
    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Add X-Store-Id header from localStorage (required for storage endpoints)
    const selectedStoreId = localStorage.getItem('selectedStoreId');
    if (selectedStoreId && selectedStoreId !== 'undefined') {
      headers['x-store-id'] = selectedStoreId;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include'
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || result.message || `HTTP error! status: ${response.status}`;
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = result;
        throw error;
      }

      return result;
    } catch (error) {
      console.error(`File upload failed: ${url}`, error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Clear token (for role switching)
  clearToken() {
    this.token = null;
  }

  // Get current user role
  getCurrentUserRole() {
    // Check if we have cached user data
    const storeOwnerData = localStorage.getItem('store_owner_user_data');
    const customerData = localStorage.getItem('customer_user_data');

    if (storeOwnerData) {
      try {
        const data = JSON.parse(storeOwnerData);
        return data.role || 'store_owner';
      } catch (e) {
        // Invalid data
      }
    }

    if (customerData) {
      try {
        const data = JSON.parse(customerData);
        return data.role || 'customer';
      } catch (e) {
        // Invalid data
      }
    }

    // Fallback: If we have a store_owner token but no user data, assume store_owner role
    const storeOwnerToken = localStorage.getItem('store_owner_auth_token');
    if (storeOwnerToken) {
      return 'store_owner';
    }

    // If we have a customer token but no user data, assume customer role
    const customerToken = localStorage.getItem('customer_auth_token');
    if (customerToken) {
      return 'customer';
    }

    // Default to guest if no user data or tokens
    return 'guest';
  }

  // Handle authentication failures by automatically logging out the user
  handleAuthenticationFailure() {
    console.warn('🚨 Automatic logout triggered due to authentication failure');
    
    // Clear all authentication data
    this.clearAllAuthData();
    
    // Import and use the logout utility function
    import('../utils/auth.js').then(({ handleLogout }) => {
      // Use handleLogout which handles role-based redirection
      handleLogout();
    }).catch((error) => {
      console.error('❌ Error during automatic logout:', error);
      // Fallback: redirect to admin auth page
      this.redirectToAuth();
    });
  }

  // Clear all authentication data
  clearAllAuthData() {
    // Clear role-specific tokens
    localStorage.removeItem('customer_auth_token');
    localStorage.removeItem('customer_user_data');
    localStorage.removeItem('store_owner_auth_token');
    localStorage.removeItem('store_owner_user_data');
    localStorage.removeItem('selectedStoreId');
    localStorage.removeItem('storeProviderCache');
    localStorage.removeItem('onboarding_form_data');
    localStorage.removeItem('guest_session_id');
    localStorage.removeItem('cart_session_id');
    localStorage.removeItem('session_created_at');
    
    // Set logout flag
    localStorage.setItem('user_logged_out', 'true');
    
    // Clear API client state
    this.token = null;
    this.isLoggedOut = true;
  }

  // Fallback redirect to auth page
  redirectToAuth() {
    try {
      // Try to determine if we're in admin or customer context
      const currentPath = window.location.pathname.toLowerCase();
      const isCustomerContext = currentPath.startsWith('/public/') ||
                               currentPath.includes('/storefront') || 
                               currentPath.includes('/cart') || 
                               currentPath.includes('/checkout');
      
      if (isCustomerContext) {
        // For customers, just reload the current page
        window.location.reload();
      } else {
        // For admin users, redirect to admin auth
        window.location.href = '/admin/auth';
      }
    } catch (error) {
      console.error('❌ Error during auth redirect:', error);
      // Ultimate fallback
      window.location.href = '/admin/auth';
    }
  }

  // Manual logout for testing
  manualLogout() {
    // Clear role-specific tokens
    localStorage.removeItem('customer_auth_token');
    localStorage.removeItem('customer_user_data');
    localStorage.removeItem('store_owner_auth_token');
    localStorage.removeItem('store_owner_user_data');
    localStorage.setItem('user_logged_out', 'true');
    localStorage.removeItem('selectedStoreId');
    this.token = null;
    this.isLoggedOut = true;
  }

  // Manual role assignment for testing
  async setUserRole(role = 'store_owner', accountType = 'agency') {
    try {
      const response = await this.patch('auth/me', {
        role: role,
        account_type: accountType
      });
      return response;
    } catch (error) {
      console.error('Failed to set role', error);
      throw error;
    }
  }

  // Fix existing user role immediately
  async fixUserRole() {
    try {
      const user = await this.get('auth/me');
      
      if (!user.role || user.role === 'customer') {
        const response = await this.patch('auth/me', {
          role: 'store_owner',
          account_type: 'agency'
        });
        return response;
      } else {
        return user;
      }
    } catch (error) {
      console.error('Failed to fix user role', error);
      throw error;
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Make apiClient globally accessible for debugging
window.apiClient = apiClient;

export default apiClient;