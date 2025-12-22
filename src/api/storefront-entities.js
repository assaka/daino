import storefrontApiClient from './storefront-client';

// Helper to check if error is an AbortError (request cancelled)
const isAbortError = (error) => {
  return error.name === 'AbortError' || error.message?.includes('aborted');
};

// Base Entity class for storefront operations (public by default)
class StorefrontBaseEntity {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.client = storefrontApiClient;
  }

  // Get all records - always uses public API
  async findAll(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;

      const response = await this.client.getPublic(url);

      // Handle new structured response format {success: true, data: [...], pagination: {...}}
      if (response && response.success && Array.isArray(response.data)) {
        return response.data;
      }

      // Handle direct array response (backwards compatibility)
      return Array.isArray(response) ? response : [];
    } catch (error) {
      // Don't log AbortErrors - they're expected when requests are cancelled
      if (!isAbortError(error)) {
        console.error(`❌ Storefront ${this.endpoint}.findAll() error:`, error.message);
      }
      return []; // Return empty array instead of throwing for public APIs
    }
  }

  // Get single record by ID - uses public API
  async findById(id) {
    try {
      const response = await this.client.getPublic(`${this.endpoint}/${id}`);
      return Array.isArray(response) ? response[0] : response;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error(`Storefront ${this.endpoint}.findById() error:`, error.message);
      }
      return null;
    }
  }

  // Filter records - uses public API
  async filter(params = {}) {
    // Handle 'ids' parameter - convert array to JSON string for backend
    const sanitizedParams = { ...params };
    if (sanitizedParams.ids && Array.isArray(sanitizedParams.ids)) {
      sanitizedParams.ids = JSON.stringify(sanitizedParams.ids);
    }
    return this.findAll(sanitizedParams);
  }

  // List records with optional ordering
  async list(orderBy = null, limit = null) {
    const params = {};
    if (orderBy) params.order_by = orderBy;
    if (limit) params.limit = limit;
    return this.findAll(params);
  }

  // Find one record
  async findOne(params = {}) {
    const results = await this.findAll({ ...params, limit: 1 });
    const safeResults = Array.isArray(results) ? results : [];
    return safeResults.length > 0 ? safeResults[0] : null;
  }
}

// Customer-specific base entity (requires authentication)
class CustomerBaseEntity {
  constructor(endpoint) {
    this.endpoint = endpoint;
    this.client = storefrontApiClient;
  }

  // Customer operations require authentication
  async findAll(params = {}) {
    try {
      let url = this.endpoint;
      
      // Add params as query string if provided
      if (params && Object.keys(params).length > 0) {
        const queryString = new URLSearchParams(params).toString();
        url = `${this.endpoint}?${queryString}`;
      }

      const response = await this.client.getCustomer(url);
      
      // Handle wrapped response format {success: true, data: [...]}
      if (response && response.success && Array.isArray(response.data)) {
        return response.data;
      }
      
      // Handle direct array response
      return Array.isArray(response) ? response : [];
    } catch (error) {
      // Don't log or throw AbortErrors - they're expected when requests are cancelled
      if (isAbortError(error)) {
        return [];
      }
      console.error(`Customer ${this.endpoint}.findAll() error:`, error.message);
      throw error; // Throw errors for customer operations
    }
  }

  async findById(id) {
    const response = await this.client.getCustomer(`${this.endpoint}/${id}`);
    // Handle wrapped response format {success: true, data: {...}}
    return (response && response.success && response.data) ? response.data : response;
  }

  async create(data) {
    const response = await this.client.postCustomer(this.endpoint, data);
    // Handle wrapped response format {success: true, data: {...}}
    return (response && response.success && response.data) ? response.data : response;
  }

  async update(id, data) {
    const response = await this.client.putCustomer(`${this.endpoint}/${id}`, data);
    // Handle wrapped response format {success: true, data: {...}}
    return (response && response.success && response.data) ? response.data : response;
  }

  async delete(id) {
    const response = await this.client.deleteCustomer(`${this.endpoint}/${id}`);
    // Handle wrapped response format {success: true, data: {...}}
    return (response && response.success && response.data) ? response.data : response;
  }

  async filter(params = {}) {
    return this.findAll(params);
  }

  async updateStatus(orderId, status, notes = null) {
    const data = { status };
    if (notes) data.notes = notes;
    
    const response = await this.client.putCustomer(`${this.endpoint}/${orderId}/status`, data);
    // Handle wrapped response format {success: true, data: {...}}
    return (response && response.success && response.data) ? response.data : response;
  }
}

// Customer Authentication service
class CustomerAuthService {
  constructor() {
    this.client = storefrontApiClient;
  }

  async login(email, password, rememberMe = false, storeId = null) {
    // Ensure store_id is provided for store-specific customer login
    if (!storeId) {
      throw new Error('Store ID is required for customer login');
    }

    // Use the public customer login endpoint (no auth required for login)
    const response = await this.client.postPublic('auth/customer/login', {
      email,
      password,
      store_id: storeId,
      rememberMe
    });

    // Extract token from response.data (backend returns {success, data: {token, user}})
    const token = response.data?.token;

    if (token) {
      // Get store slug - try currentStoreSlug first, fallback to extracting from URL
      let storeSlug = this.client.currentStoreSlug;

      if (!storeSlug) {
        // Extract from URL as fallback: /public/{storeSlug}/...
        const match = window.location.pathname.match(/^\/public\/([^\/]+)/);
        storeSlug = match ? match[1] : null;
      }

      if (storeSlug) {
        this.client.setCustomerToken(token, storeSlug);
        // Clear auth cache so next .me() call fetches fresh user data
        if (window.__authMeCache) {
          window.__authMeCache = { data: null, timestamp: 0, fetching: false, callbacks: [] };
        }
      } else {
        console.error('Cannot set customer token: No store context available');
      }
    }

    // Return full response with success flag intact
    return response;
  }

  async register(userData) {
    // Ensure store_id is provided for store-specific customer registration
    if (!userData.store_id) {
      throw new Error('Store ID is required for customer registration');
    }

    // Use the public customer register endpoint (no auth required for registration)
    const response = await this.client.postPublic('auth/customer/register', userData);

    // Extract token from response.data (backend returns {success, data: {token, user}})
    const token = response.data?.token;

    if (token) {
      // Get store slug - try currentStoreSlug first, fallback to extracting from URL
      let storeSlug = this.client.currentStoreSlug;

      if (!storeSlug) {
        // Extract from URL as fallback: /public/{storeSlug}/...
        const match = window.location.pathname.match(/^\/public\/([^\/]+)/);
        storeSlug = match ? match[1] : null;
      }

      if (storeSlug) {
        this.client.setCustomerToken(token, storeSlug);
        // Clear auth cache so next .me() call fetches fresh user data
        if (window.__authMeCache) {
          window.__authMeCache = { data: null, timestamp: 0, fetching: false, callbacks: [] };
        }
      } else {
        console.error('Cannot set customer token: No store context available');
      }
    }

    // Return full response with success flag intact
    return response;
  }

  async logout() {
    // Clear auth cache on logout
    if (window.__authMeCache) {
      window.__authMeCache = { data: null, timestamp: 0, fetching: false, callbacks: [] };
    }
    return this.client.customerLogout();
  }

  async me() {
    // Global cache to prevent duplicate auth/me calls
    if (!window.__authMeCache) window.__authMeCache = { data: null, timestamp: 0, fetching: false, callbacks: [] };

    const cache = window.__authMeCache;
    const now = Date.now();

    // Return cached data if fresh (30 seconds)
    if (cache.data && (now - cache.timestamp < 30000)) {
      return cache.data;
    }

    // If already fetching, wait for that request
    if (cache.fetching) {
      return new Promise(resolve => {
        cache.callbacks.push(resolve);
      });
    }

    // Start fetching
    cache.fetching = true;
    try {
      const response = await this.client.getCustomer('auth/me');
      const data = response.data || response;
      const userData = Array.isArray(data) ? data[0] : data;

      // Cache the result
      cache.data = userData;
      cache.timestamp = now;
      cache.fetching = false;

      // Resolve any pending callbacks
      cache.callbacks.forEach(cb => cb(userData));
      cache.callbacks = [];

      return userData;
    } catch (error) {
      cache.fetching = false;
      cache.callbacks.forEach(cb => cb(null));
      cache.callbacks = [];
      throw error;
    }
  }

  async getCurrentUser() {
    return this.me();
  }

  isAuthenticated() {
    return this.client.isCustomerAuthenticated();
  }

  async forgotPassword(email, storeId) {
    if (!storeId) {
      throw new Error('Store ID is required for password reset');
    }

    // Use public auth endpoint (consistent with login/register)
    return this.client.postPublic('auth/customer/forgot-password', {
      email,
      store_id: storeId
    });
  }

  async resetPassword(token, password, storeId) {
    if (!storeId) {
      throw new Error('Store ID is required for password reset');
    }

    // Use public auth endpoint (consistent with login/register)
    return this.client.postPublic('auth/customer/reset-password', {
      token,
      password,
      store_id: storeId
    });
  }

  async validateResetToken(token, storeId) {
    if (!storeId) {
      throw new Error('Store ID is required for token validation');
    }

    return this.client.postPublic('auth/customer/validate-reset-token', {
      token,
      store_id: storeId
    });
  }
}

// Store service (public)
class StorefrontStoreService extends StorefrontBaseEntity {
  constructor() {
    super('stores');
  }

  // Override to use direct public call without extra processing
  async filter(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `stores?${queryString}` : 'stores';

      const response = await this.client.getPublic(url);
      
      return Array.isArray(response) ? response : [];
    } catch (error) {
      if (!isAbortError(error)) {
        console.error(`StorefrontStore.filter() error:`, error.message);
      }
      return [];
    }
  }

  async findAll(params = {}) {
    return this.filter(params);
  }
}

// Product service (public)
class StorefrontProductService extends StorefrontBaseEntity {
  constructor() {
    super('products');
  }

  // Override findAll to handle complex query parameters (like id with $in operator)
  async findAll(params = {}) {
    try {
      // Handle complex id parameter (like {$in: [...]})
      const sanitizedParams = { ...params };
      if (sanitizedParams.id && typeof sanitizedParams.id === 'object') {
        // Stringify complex id parameter for backend parsing
        sanitizedParams.id = JSON.stringify(sanitizedParams.id);
      }

      const queryString = new URLSearchParams(sanitizedParams).toString();
      const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;

      const response = await this.client.getPublic(url);

      // Handle structured response format {success: true, data: [...], pagination: {...}}
      if (response && response.success && Array.isArray(response.data)) {
        return response.data;
      }

      // Handle direct array response (backwards compatibility)
      return Array.isArray(response) ? response : [];
    } catch (error) {
      if (!isAbortError(error)) {
        console.error(`❌ Storefront ${this.endpoint}.findAll() error:`, error.message);
      }
      return []; // Return empty array instead of throwing for public APIs
    }
  }

  async search(query, params = {}) {
    const result = await this.findAll({ ...params, search: query });
    return Array.isArray(result) ? result : [];
  }

  async getByCategory(categoryId, params = {}) {
    const result = await this.findAll({ ...params, category_id: categoryId });
    return Array.isArray(result) ? result : [];
  }

  async getFeatured(params = {}) {
    const result = await this.findAll({ ...params, featured: true });
    return Array.isArray(result) ? result : [];
  }
}

// Category service (public)
class StorefrontCategoryService extends StorefrontBaseEntity {
  constructor() {
    super('categories');
  }

  async getRootCategories(params = {}) {
    const result = await this.findAll({ ...params, parent_id: null });
    return Array.isArray(result) ? result : [];
  }

  async getChildren(parentId, params = {}) {
    const result = await this.findAll({ ...params, parent_id: parentId });
    return Array.isArray(result) ? result : [];
  }
}

// Cart service (hybrid - supports both authenticated and guest users)
class StorefrontCartService {
  constructor() {
    this.endpoint = 'cart';
    this.client = storefrontApiClient;
  }

  async addItem(productId, quantity = 1, options = {}) {
    const data = { product_id: productId, quantity, options };
    
    try {
      return await this.client.customerRequest('POST', this.endpoint, data);
    } catch (error) {
      console.error(`Cart addItem error:`, error.message);
      throw error;
    }
  }

  async updateItem(itemId, quantity) {
    const data = { quantity };
    
    try {
      return await this.client.customerRequest('PUT', `${this.endpoint}/${itemId}`, data);
    } catch (error) {
      console.error(`Cart updateItem error:`, error.message);
      throw error;
    }
  }

  async removeItem(itemId) {
    try {
      return await this.client.customerRequest('DELETE', `${this.endpoint}/${itemId}`);
    } catch (error) {
      console.error(`Cart removeItem error:`, error.message);
      throw error;
    }
  }

  async getItems() {
    try {
      const response = await this.client.customerRequest('GET', this.endpoint);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error(`Cart getItems error:`, error.message);
      return [];
    }
  }

  async clear() {
    try {
      return await this.client.customerRequest('DELETE', 'cart/clear');
    } catch (error) {
      console.error(`Cart clear error:`, error.message);
      throw error;
    }
  }
}

// Wishlist service (hybrid - supports both authenticated and guest users)
class StorefrontWishlistService {
  constructor() {
    this.endpoint = 'wishlist';
    this.client = storefrontApiClient;
  }

  // Check if user is authenticated and should use authenticated endpoints
  isAuthenticated() {
    return this.client.isCustomerAuthenticated();
  }

  async addItem(productId, storeId) {
    const data = {
      product_id: productId,
      store_id: storeId
      // session_id is automatically added by customerRequest for POST requests
    };

    try {
      // Use customerRequest which handles both authenticated and guest users
      return await this.client.customerRequest('POST', this.endpoint, data);
    } catch (error) {
      console.error(`Wishlist addItem error:`, error.message);
      throw error;
    }
  }

  async removeItem(productId, storeId) {
    try {
      // Use the same endpoint as addItem but with DELETE method and query params
      // NOTE: Don't add store_id here - customerRequest automatically adds it from currentStoreId
      const endpoint = `${this.endpoint}?product_id=${productId}`;
      return await this.client.customerRequest('DELETE', endpoint);
    } catch (error) {
      console.error(`Wishlist removeItem error:`, error.message);
      throw error;
    }
  }

  async getItems(storeId) {
    try {
      // Always use customerRequest which handles both authenticated and guest users
      // NOTE: Don't add store_id here - customerRequest automatically adds it from currentStoreId
      const response = await this.client.customerRequest('GET', this.endpoint);
      
      // Handle wrapped response structure from backend
      let items = [];
      if (response && response.success && response.data) {
        items = Array.isArray(response.data) ? response.data : [];
      } else if (Array.isArray(response)) {
        items = response;
      }
      
      return items;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error(`Wishlist ${this.endpoint}.getItems() error:`, error.message);
      }
      return []; // Return empty array instead of throwing for guest users
    }
  }
}

// Create storefront entity instances
export const CustomerAuth = new CustomerAuthService();
export const StorefrontStore = new StorefrontStoreService();
export const StorefrontProduct = new StorefrontProductService();
export const StorefrontCategory = new StorefrontCategoryService();

// Public entities (no authentication required)
export const StorefrontTax = new StorefrontBaseEntity('tax');
export const StorefrontAttribute = new StorefrontBaseEntity('attributes');
export const StorefrontAttributeSet = new StorefrontBaseEntity('attribute-sets');
export const StorefrontProductLabel = new StorefrontBaseEntity('product-labels');
export const StorefrontProductTab = new StorefrontBaseEntity('product-tabs');
export const StorefrontSeoTemplate = new StorefrontBaseEntity('seo-templates');
export const StorefrontSeoSetting = new StorefrontBaseEntity('seo-settings');
export const StorefrontCookieConsentSettings = new StorefrontBaseEntity('cookie-consent-settings');
export const StorefrontCmsPage = new StorefrontBaseEntity('cms-pages');
export const StorefrontCmsBlock = new StorefrontBaseEntity('cms-blocks');
export const StorefrontCustomOptionRule = new StorefrontBaseEntity('custom-option-rules');

// Customer entities (authentication required)
export const CustomerCart = new StorefrontCartService();
export const CustomerWishlist = new StorefrontWishlistService();
export const CustomerOrder = new CustomerBaseEntity('orders/customer-orders');
export const CustomerAddress = new CustomerBaseEntity('addresses');
export const CustomerProfile = new CustomerBaseEntity('customers');

// Export API client for advanced usage
export { storefrontApiClient };