// Admin/Store Owner API Client - Always requires authentication
class AdminApiClient {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
    this.token = localStorage.getItem('store_owner_auth_token');

    // Admin client always requires authentication
    this.requiresAuth = true;
  }

  // Set auth token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('store_owner_auth_token', token);
    } else {
      localStorage.removeItem('store_owner_auth_token');
    }
  }

  // Get auth token
  getToken() {
    return this.token || localStorage.getItem('store_owner_auth_token');
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

  // Default headers with required authentication
  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    const token = this.getToken();
    if (!token) {
      throw new Error('Admin authentication required. Please log in.');
    }
    
    headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  // Generic request method - always authenticated
  async request(method, endpoint, data = null, customHeaders = {}) {
    const url = this.buildUrl(endpoint);
    const headers = this.getHeaders(customHeaders);

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
        if (response.status === 401 || response.status === 403) {
          // Clear invalid token
          this.setToken(null);
          throw new Error('Admin session expired. Please log in again.');
        }
        
        const error = new Error(result.message || `HTTP error! status: ${response.status}`);
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
      throw error;
    }
  }

  // HTTP methods
  async get(endpoint, customHeaders = {}) {
    return this.request('GET', endpoint, null, customHeaders);
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

  async delete(endpoint, customHeaders = {}) {
    return this.request('DELETE', endpoint, null, customHeaders);
  }

  // Admin logout
  async logout() {
    try {
      await this.post('auth/logout');
    } catch (error) {
      console.error('Admin logout failed:', error.message);
    }

    this.setToken(null);
    localStorage.removeItem('store_owner_user_data');

    return { success: true };
  }

  // Check if admin is authenticated
  isAuthenticated() {
    return !!this.getToken();
  }
}

// Create singleton instance
const adminApiClient = new AdminApiClient();

export default adminApiClient;