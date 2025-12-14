// Storefront API Client - Public by default, optional customer authentication
class StorefrontApiClient {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    this.currentStoreSlug = null;
    this.currentStoreId = null;
    this.customerToken = null;

    // Storefront client is public by default
    this.isPublic = true;

    // Initialize or get guest session ID
    this.sessionId = this.getOrCreateSessionId();

  }

  // Get the version parameter from URL if present (for bypassing pause modal)
  // Note: Only returns version from URL - does NOT auto-add to requests
  getVersionParam() {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('version');
  }

  // Set the current store context
  setStoreContext(storeSlug, storeId = null) {
    this.currentStoreSlug = storeSlug;
    this.currentStoreId = storeId;
    // Load the token for this store
    this.customerToken = this.getCustomerToken();
  }

  // Get or create a guest session ID
  getOrCreateSessionId() {
    let sessionId = localStorage.getItem('guest_session_id');
    if (!sessionId) {
      // Generate a new session ID
      sessionId = 'guest_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('guest_session_id', sessionId);
    }

    // Check for old cart_session_id and clean it up
    const oldSessionId = localStorage.getItem('cart_session_id');
    if (oldSessionId) {
      localStorage.removeItem('cart_session_id');
    }

    return sessionId;
  }

  // Set customer auth token (store-specific)
  setCustomerToken(token, storeSlug = null) {
    const slug = storeSlug || this.currentStoreSlug;
    if (!slug) {
      console.error('Cannot set customer token without store context');
      return;
    }

    this.customerToken = token;
    const tokenKey = `customer_auth_token_${slug}`;

    if (token) {
      localStorage.setItem(tokenKey, token);
      // Also store which store this token belongs to
      localStorage.setItem('customer_current_store', slug);
    } else {
      localStorage.removeItem(tokenKey);
      if (localStorage.getItem('customer_current_store') === slug) {
        localStorage.removeItem('customer_current_store');
      }
    }
  }

  // Get customer auth token (store-specific)
  getCustomerToken() {
    const slug = this.currentStoreSlug;
    if (!slug) {
      return null;
    }

    const tokenKey = `customer_auth_token_${slug}`;
    return localStorage.getItem(tokenKey);
  }

  // Build public URL
  // Note: version=published is only added by callers when bypassing pause modal
  buildPublicUrl(endpoint) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseURL}/api/public/${cleanEndpoint}`;
  }

  // Build authenticated URL
  buildAuthUrl(endpoint) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${this.baseURL}/api/${cleanEndpoint}`;
  }

  // Public headers (no auth required)
  getPublicHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    // Add language header from localStorage
    const currentLanguage = localStorage.getItem('daino_language') || 'en';
    headers['X-Language'] = currentLanguage;

    // Add store ID header if available
    if (this.currentStoreId) {
      headers['X-Store-Id'] = this.currentStoreId;
    }

    return headers;
  }

  // Customer headers (with optional auth)
  getCustomerHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    const token = this.getCustomerToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Add language header from localStorage
    const currentLanguage = localStorage.getItem('daino_language') || 'en';
    headers['X-Language'] = currentLanguage;

    return headers;
  }

  // Public request method (no authentication required)
  async publicRequest(method, endpoint, data = null, customHeaders = {}) {
    const url = this.buildPublicUrl(endpoint);
    const headers = this.getPublicHeaders(customHeaders);


    const config = {
      method,
      headers,
      credentials: 'include'
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
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
        const error = new Error(result.message || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.data = result;
        throw error;
      }

      // Return result as-is, let entities handle unwrapping
      return result;
    } catch (error) {
      console.error(`Storefront public API request failed: ${method} ${url}`, error);
      throw error;
    }
  }

  // Customer request method (optional authentication)
  async customerRequest(method, endpoint, data = null, customHeaders = {}) {
    const token = this.getCustomerToken();
    let finalEndpoint = endpoint;

    // Always ensure we have a session ID for guest functionality
    this.sessionId = this.getOrCreateSessionId();

    // For GET and DELETE requests, add session_id and store_id to URL
    // For POST, PUT, PATCH requests, add session_id and store_id to body
    if (method === 'GET' || method === 'DELETE') {
      const separator = endpoint.includes('?') ? '&' : '?';
      let params = `session_id=${this.sessionId}`;
      if (this.currentStoreId) {
        params += `&store_id=${this.currentStoreId}`;
      }
      finalEndpoint = `${endpoint}${separator}${params}`;
    }

    const url = this.buildAuthUrl(finalEndpoint);
    const headers = this.getCustomerHeaders(customHeaders);

    const config = {
      method,
      headers,
      credentials: 'include'
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      // CRITICAL FIX: Include session_id and store_id in body for POST/PUT/PATCH requests
      const bodyData = {
        ...data,
        session_id: this.sessionId
      };
      if (this.currentStoreId) {
        bodyData.store_id = this.currentStoreId;
      }
      config.body = JSON.stringify(bodyData);
    }

    try {
      const response = await fetch(url, config);
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Unexpected response type: ${contentType}`);
      }

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Clear invalid customer token
          this.setCustomerToken(null);
          throw new Error('Customer session expired. Please log in again.');
        }
        
        const error = new Error(result.message || `HTTP error! status: ${response.status}`);
        error.status = response.status;
        error.data = result;
        throw error;
      }


      return result;
    } catch (error) {
      console.error(`Storefront customer API request failed: ${method} ${url}`, error);
      throw error;
    }
  }

  // Public HTTP methods
  async getPublic(endpoint, customHeaders = {}) {
    return this.publicRequest('GET', endpoint, null, customHeaders);
  }

  async postPublic(endpoint, data, customHeaders = {}) {
    return this.publicRequest('POST', endpoint, data, customHeaders);
  }

  // Customer HTTP methods
  async getCustomer(endpoint, customHeaders = {}) {
    return this.customerRequest('GET', endpoint, null, customHeaders);
  }

  async postCustomer(endpoint, data, customHeaders = {}) {
    return this.customerRequest('POST', endpoint, data, customHeaders);
  }

  async putCustomer(endpoint, data, customHeaders = {}) {
    return this.customerRequest('PUT', endpoint, data, customHeaders);
  }

  async patchCustomer(endpoint, data, customHeaders = {}) {
    return this.customerRequest('PATCH', endpoint, data, customHeaders);
  }

  async deleteCustomer(endpoint, customHeaders = {}) {
    return this.customerRequest('DELETE', endpoint, null, customHeaders);
  }

  // Customer logout
  async customerLogout() {
    try {
      if (this.getCustomerToken()) {
        await this.postCustomer('auth/logout');
      }
    } catch (error) {
      console.error('Customer logout failed:', error.message);
    }
    
    // Clear all customer-related data
    this.setCustomerToken(null);
    localStorage.removeItem('customer_user_data');
    localStorage.removeItem('cart_session_id');
    localStorage.removeItem('user_logged_out'); // Clear this flag too
    
    // Reset customer token reference
    this.customerToken = null;
    
    return { success: true };
  }

  // Check if customer is authenticated
  isCustomerAuthenticated() {
    return !!this.getCustomerToken();
  }
}

// Create singleton instance
const storefrontApiClient = new StorefrontApiClient();

export default storefrontApiClient;