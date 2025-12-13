import apiClient from './client';
import storefrontApiClient from './storefront-client';
import { shouldUsePublicAPI, hasAccessToEndpoint } from './endpointAccess';
import { setRoleBasedAuthData } from '../utils/auth';

// Base Entity class for common CRUD operations
class BaseEntity {
  constructor(endpoint) {
    this.endpoint = endpoint;
  }

  // Get all records with pagination and filters
  async findAll(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;

      // Check authentication status and determine which API to use
      const hasToken = apiClient.getToken();
      const userRole = apiClient.getCurrentUserRole();
      const usePublicAPI = shouldUsePublicAPI(this.endpoint, hasToken, userRole);

      let response;
      if (usePublicAPI) {
        // Use public endpoint for endpoints that support it
        response = await apiClient.publicRequest('GET', url);
        
        // Public API usually returns just an array
        return Array.isArray(response) ? response : [];
      } else {
        // Use regular authenticated endpoint
        response = await apiClient.get(url);

        // Check if response has pagination structure
        if (response && response.success && response.data) {
          // If data is directly an array, return it (e.g., { success: true, data: [...] })
          if (Array.isArray(response.data)) {
            return response.data;
          }

          // Handle paginated response structure (e.g., { success: true, data: { products: [...], pagination: {...} } })
          const entityKey = Object.keys(response.data).find(key =>
            key !== 'pagination' && Array.isArray(response.data[key])
          );

          if (entityKey && response.data[entityKey]) {
            // Return the entity array along with pagination info
            const result = response.data[entityKey];
            result.pagination = response.data.pagination;
            return result;
          }
        }

        // Fallback to treating response as array
        return Array.isArray(response) ? response : [];
      }
    } catch (error) {
      return [];
    }
  }

  // Get single record by ID
  async findById(id, params = {}) {
    let url = `${this.endpoint}/${id}`;

    // Add query parameters if provided (e.g., store_id)
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return await apiClient.get(url);;
  }

  // Create new record
  async create(data) {
    return await apiClient.post(this.endpoint, data);;
  }

  // Update record by ID
  async update(id, data) {
    let url = `${this.endpoint}/${id}`;

    // If data contains store_id, add it as query parameter for routes that require it
    if (data && data.store_id) {
      url += `?store_id=${data.store_id}`;
    }

    return await apiClient.put(url, data);;
  }

  // Delete record by ID
  async delete(id, params = {}) {
    let url = `${this.endpoint}/${id}`;

    // Add query parameters if provided (e.g., store_id)
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return await apiClient.delete(url);
  }

  // List records with optional ordering (alias for findAll)
  async list(orderBy = null, limit = null) {
    const params = {};
    if (orderBy) {
      params.order_by = orderBy;
    }
    if (limit) {
      params.limit = limit;
    }
    return this.findAll(params);
  }

  // Filter records (alias for findAll for compatibility)
  async filter(params = {}) {
    try {
      const result = await this.findAll(params);
      
      // Double-check that result is an array
      const finalResult = Array.isArray(result) ? result : [];
      
      return finalResult;
    } catch (error) {
      console.error(`BaseEntity.filter() error for ${this.endpoint}:`, error.message);
      return [];
    }
  }

  // Get paginated records with full pagination metadata
  async findPaginated(page = 1, limit = 10, filters = {}) {
    try {
      const params = {
        page: page,
        limit: limit,
        ...filters
      };
      
      const queryString = new URLSearchParams(params).toString();
      const url = `${this.endpoint}?${queryString}`;
      
      // Check authentication status and determine which API to use
      const hasToken = apiClient.getToken();
      const userRole = apiClient.getCurrentUserRole();
      const usePublicAPI = shouldUsePublicAPI(this.endpoint, hasToken, userRole);

      let response;
      if (usePublicAPI) {
        // Use public endpoint for endpoints that support it
        response = await apiClient.publicRequest('GET', url);
        
        // Public API usually returns just an array, simulate pagination
        const data = Array.isArray(response) ? response : [];
        return {
          data: data,
          pagination: {
            current_page: page,
            per_page: limit,
            total: data.length,
            total_pages: Math.ceil(data.length / limit)
          }
        };
      } else {
        // Use regular authenticated endpoint
        response = await apiClient.get(url);
        
        // Check if response has pagination structure
        if (response && response.success && response.data) {
          // Handle different entity key formats (attributes, attribute_sets, etc.)
          const possibleKeys = ['attributes', 'attribute_sets', 'categories', 'products'];
          let entityKey = Object.keys(response.data).find(key => 
            key !== 'pagination' && Array.isArray(response.data[key])
          );
          
          // If no key found, try the possible keys
          if (!entityKey) {
            entityKey = possibleKeys.find(key => 
              response.data[key] && Array.isArray(response.data[key])
            );
          }
          
          if (entityKey && response.data[entityKey]) {
            return {
              data: response.data[entityKey],
              pagination: response.data.pagination || {
                current_page: page,
                per_page: limit,
                total: response.data[entityKey].length,
                total_pages: Math.ceil(response.data[entityKey].length / limit)
              }
            };
          }
        }
        
        // Fallback
        const data = Array.isArray(response) ? response : [];
        return {
          data: data,
          pagination: {
            current_page: page,
            per_page: limit,
            total: data.length,
            total_pages: Math.ceil(data.length / limit)
          }
        };
      }
    } catch (error) {
      return {
        data: [],
        pagination: {
          current_page: page,
          per_page: limit,
          total: 0,
          total_pages: 0
        }
      };
    }
  }

  // Find one record (returns first match)
  async findOne(params = {}) {
    const results = await this.findAll({ ...params, limit: 1 });
    // Ensure results is an array before accessing length
    const safeResults = Array.isArray(results) ? results : [];
    return safeResults.length > 0 ? safeResults[0] : null;
  }
}

// Authentication service
class AuthService {
  async login(email, password, rememberMe = false, role = 'store_owner', store_id = null) {

    // Use customer-specific endpoint for customer login
    // For store owners/admins, use the refactored /auth/login that queries master DB
    const endpoint = role === 'customer' ? 'auth/customer/login' : 'auth/login';

    // Build request payload - include role and store_id based on user type
    const payload = { email, password, rememberMe, role };
    if (role === 'customer' && store_id) {
      payload.store_id = store_id;
    }
    // Note: store_id is optional for store owners (not used in backend)

    const response = await apiClient.post(endpoint, payload);

    let token = null;
    if (response.data && response.data.token) {
      token = response.data.token;
      apiClient.setToken(token);
    } else if (response.token) {
      token = response.token;
      apiClient.setToken(token);
    } else {
      console.error('❌ AuthService.login: No token found in response!');
    }

    const result = response.data || response;

    // CRITICAL FIX: Store user data if we have both token and user info
    // For customers, also store the current store slug to bind session to store
    const currentStoreSlug = role === 'customer' ? this.getCurrentStoreSlug() : null;

    if (token && result.user) {
      setRoleBasedAuthData(result.user, token, currentStoreSlug);
    } else if (token && result.id) {
      // Handle case where user data is at root level
      setRoleBasedAuthData(result, token, currentStoreSlug);
    } else if (token) {
      // If we have token but no user data, fetch it immediately
      try {
        const userResponse = await apiClient.get('auth/me');
        const userData = userResponse.data || userResponse;
        if (userData && userData.id) {
          setRoleBasedAuthData(userData, token, currentStoreSlug);
          // Update result to include user data
          result.user = userData;
        } else {
          console.error('❌ AuthService.login: Fetched user data invalid');
        }
      } catch (fetchError) {
        console.error('❌ Failed to fetch user data after login:', fetchError.message);
      }
    } else {
      console.error('❌ AuthService.login: No token, cannot store user data');
    }

    // Notify components that user data is ready
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('userDataReady', {
        detail: { timestamp: Date.now() }
      }));
    }, 100);

    return result;
  }

  // Get current store slug from URL (for customer sessions)
  getCurrentStoreSlug() {
    try {
      const pathname = window.location.pathname;
      // Extract store slug from URL pattern: /public/{storeSlug}/...
      const match = pathname.match(/^\/public\/([^\/]+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('Error extracting store slug:', error);
      return null;
    }
  }

  googleLogin() {
    window.location.href = `${apiClient.baseURL}/api/auth/google`;
  }

  async register(userData) {
    // Use customer-specific endpoint for customer registration
    const endpoint = userData.role === 'customer' ? 'auth/customer/register' : 'auth/register';
    const response = await apiClient.post(endpoint, userData);
    
    let token = null;
    if (response.data && response.data.token) {
      token = response.data.token;
      apiClient.setToken(token);
    } else if (response.token) {
      token = response.token;
      apiClient.setToken(token);
    }
    
    // Return the full response to maintain compatibility
    const result = response.data || response;

    // CRITICAL FIX: Store user data if we have both token and user info
    // For customers, also store the current store slug to bind session to store
    const currentStoreSlug = userData.role === 'customer' ? this.getCurrentStoreSlug() : null;

    if (token && result.user) {
      setRoleBasedAuthData(result.user, token, currentStoreSlug);
    } else if (token && result.id) {
      // Handle case where user data is at root level
      setRoleBasedAuthData(result, token, currentStoreSlug);
    }

    return result;
  }

  async logout() {
    try {
      await apiClient.post('auth/logout');
    } catch (error) {
      console.error('Backend logout failed:', error.message);
    }

    // Clear the token from client-side storage
    apiClient.setToken(null);
    
    // Clear all user-related cached data
    localStorage.removeItem('user_data');
    localStorage.removeItem('selectedStoreId');
    localStorage.removeItem('storeProviderCache');
    localStorage.removeItem('onboarding_form_data');
    
    // Clear session IDs
    localStorage.removeItem('guest_session_id');
    localStorage.removeItem('cart_session_id');
    
    // Clear authentication cookies (if any exist)
    // This attempts to clear common auth cookie names
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      // Clear cookies that might be authentication related
      if (name.toLowerCase().includes('auth') || 
          name.toLowerCase().includes('session') || 
          name.toLowerCase().includes('token') ||
          name === 'connect.sid' || 
          name === 'jwt') {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      }
    });
    
    // Dispatch logout event to notify other components
    window.dispatchEvent(new CustomEvent('userLoggedOut', { 
      detail: { timestamp: new Date().toISOString() } 
    }));
    
    return { success: true };
  }

  async me() {
    const response = await apiClient.get('auth/me');
    const data = response.data || response;
    // Handle case where data is returned as an array
    return Array.isArray(data) ? data[0] : data;
  }

  async getCurrentUser() {
    return this.me();
  }

  isAuthenticated() {
    return !!apiClient.getToken();
  }
}

// User service with special methods
class UserService extends BaseEntity {
  constructor() {
    super('users');
  }

  // Get current user (alias for auth/me) - fetches user based on current token
  async me() {
    try {
      const response = await apiClient.get('auth/me');
      const data = response.data || response;
      // Handle case where data is returned as an array
      const user = Array.isArray(data) ? data[0] : data;
      
      // Ensure we return null if no valid user data
      if (!user || !user.id) {
        return null;
      }
      
      return user;
    } catch (error) {
      // Clear invalid token if authentication fails
      if (error.status === 401 || error.status === 403) {
        apiClient.setToken(null);
      }
      return null;
    }
  }

  // Update profile
  async updateProfile(data) {
    const user = await this.me();
    return this.update(user.id, data);
  }
}

// Store service
class StoreService extends BaseEntity {
  constructor() {
    super('stores');
  }

  // Get user's stores (authenticated) - includes full store data with theme_preset
  async getUserStores() {
    try {
      const response = await apiClient.get('stores');
      // Client already transforms to array
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error(`❌ StoreService.getUserStores() error:`, error.message);
      return [];
    }
  }

  // Public store access (no authentication required)
  async filter(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `stores?${queryString}` : 'stores';

      const response = await apiClient.publicRequest('GET', url);
      
      // Ensure response is always an array
      const result = Array.isArray(response) ? response : [];
      
      return result;
    } catch (error) {
      console.error(`❌ StoreService.filter() error:`, error.message);
      console.error('Error details:', error);
      return [];
    }
  }

  // Get stores - uses dropdown endpoint for authenticated users (Editor+ only), public endpoint for others
  async findAll(params = {}) {
    try {
      const hasToken = apiClient.getToken();

      if (hasToken) {
        // Check user role from token
        try {
          const token = apiClient.getToken();
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userRole = payload.role;

          // Only admin/store_owner should use dropdown endpoint
          if (userRole === 'admin' || userRole === 'store_owner') {
            return this.getUserStores();
          }
          // Customers fall through to public endpoint
        } catch (roleCheckError) {
          console.error('Error checking user role:', roleCheckError);
          // Fall through to public endpoint on error
        }
      }

      // Public users and customers get all active stores
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `stores?${queryString}` : 'stores';

      const response = await apiClient.publicRequest('GET', url);

      // Ensure response is always an array
      const result = Array.isArray(response) ? response : [];

      return result;
    } catch (error) {
      console.error(`StoreService.findAll() error:`, error.message);
      return [];
    }
  }

  // Update store settings specifically
  async updateSettings(id, settingsData) {
    try {
      // Use the specific settings endpoint
      const response = await apiClient.put(`stores/${id}/settings`, settingsData);
      return response;
    } catch (error) {
      console.error(`StoreService.updateSettings() error:`, error.message);
      throw error;
    }
  }
}

// Product service with additional methods
class ProductService extends BaseEntity {
  constructor() {
    super('products');
  }

  // Override findById to always use authenticated API for admin operations
  async findById(id) {
    try {
      // Always use authenticated API for product details
      const response = await apiClient.get(`${this.endpoint}/${id}`);
      return response?.data || response;
    } catch (error) {
      console.error(`ProductService.findById() error:`, error.message);
      return null;
    }
  }

  // Override findPaginated to handle both authenticated and public access
  async findPaginated(page = 1, limit = 10, filters = {}) {
    try {
      // Add include_all_translations for authenticated admin requests
      const token = apiClient.getToken();
      const enhancedFilters = token
        ? { ...filters, include_all_translations: 'true' }
        : filters;

      const params = {
        page: page,
        limit: limit,
        ...enhancedFilters
      };

      const queryString = new URLSearchParams(params).toString();
      const url = `${this.endpoint}?${queryString}`;

      let response;

      if (token) {
        // Use authenticated endpoint if token is available
        response = await apiClient.get(url);
      } else {
        // Fall back to public endpoint if no token with proper query params
        const publicUrl = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;
        response = await apiClient.publicRequest('GET', publicUrl, null);
      }

      // Check if response has pagination structure
      if (response && response.success && response.data) {
        // Handle different entity key formats (products, etc.)
        const entityKey = Object.keys(response.data).find(key => 
          key !== 'pagination' && Array.isArray(response.data[key])
        ) || 'products';
        
        if (entityKey && response.data[entityKey]) {
          return {
            data: response.data[entityKey],
            pagination: response.data.pagination || {
              current_page: page,
              per_page: limit,
              total: response.data[entityKey].length,
              total_pages: Math.ceil(response.data[entityKey].length / limit)
            }
          };
        }
        
        // If data structure is different, try to extract products directly
        if (response.data.products !== undefined) {
          return {
            data: response.data.products || [],
            pagination: response.data.pagination || {
              current_page: page,
              per_page: limit,
              total: 0,
              total_pages: 0
            }
          };
        }
      }
      
      // Handle array response (typically from public API)
      const data = Array.isArray(response) ? response : [];
      return {
        data: data,
        pagination: {
          current_page: page,
          per_page: limit,
          total: data.length,
          total_pages: Math.ceil(data.length / limit)
        }
      };
    } catch (error) {
      console.error(`ProductService.findPaginated() error:`, error.message);
      
      // Try public API as fallback if authenticated fails
      if (error.status === 401) {
        try {
          const params = {
            page: page,
            limit: limit,
            ...filters
          };
          const queryString = new URLSearchParams(params).toString();
          const publicUrl = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;
          const response = await apiClient.publicRequest('GET', publicUrl, null);
          const data = Array.isArray(response) ? response : [];
          return {
            data: data,
            pagination: {
              current_page: page,
              per_page: limit,
              total: data.length,
              total_pages: Math.ceil(data.length / limit)
            }
          };
        } catch (publicError) {
          console.error(`ProductService.findPaginated() public fallback error:`, publicError.message);
        }
      }
      
      return {
        data: [],
        pagination: {
          current_page: page,
          per_page: limit,
          total: 0,
          total_pages: 0
        }
      };
    }
  }

  // Filter products - uses findAll which smartly chooses between admin/public API
  async filter(params = {}) {
    try {
      const result = await this.findAll(params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error(`ProductService.filter() error:`, error.message);
      return [];
    }
  }

  // Smart findAll - uses authenticated API for admin, public API for storefront
  async findAll(params = {}) {
    try {
      // Add include_all_translations for authenticated admin requests
      const hasToken = apiClient.getToken();
      const enhancedParams = hasToken
        ? { ...params, include_all_translations: 'true' }
        : params;

      const queryString = new URLSearchParams(enhancedParams).toString();
      const url = queryString ? `products?${queryString}` : 'products';

      let response;

      if (hasToken) {
        try {
          // Try authenticated API first for admin users
          response = await apiClient.get(url);

          // Handle paginated admin response
          if (response && response.success && response.data) {
            if (Array.isArray(response.data.products)) {
              return response.data.products;
            } else if (Array.isArray(response.data)) {
              return response.data;
            }
          }

          // Handle direct array response
          return Array.isArray(response) ? response : [];
        } catch (authError) {
          // If authenticated request fails, fall back to public API
          if (authError.status === 401 || authError.status === 403) {
            console.warn('ProductService: Authenticated request failed, falling back to public API');
            response = await apiClient.publicRequest('GET', url);
          } else {
            throw authError;
          }
        }
      } else {
        // No token, use public API
        response = await apiClient.publicRequest('GET', url);
      }

      // Ensure response is always an array
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error(`ProductService.findAll() error:`, error.message);
      return [];
    }
  }

  // Search products
  async search(query, params = {}) {
    const result = await this.findAll({ ...params, search: query });
    return Array.isArray(result) ? result : [];
  }

  // Get products by category
  async getByCategory(categoryId, params = {}) {
    const result = await this.findAll({ ...params, category_id: categoryId });
    return Array.isArray(result) ? result : [];
  }

  // Get featured products
  async getFeatured(params = {}) {
    const result = await this.findAll({ ...params, featured: true });
    return Array.isArray(result) ? result : [];
  }
}

// Category service with hierarchy methods
class CategoryService extends BaseEntity {
  constructor() {
    super('categories');
  }

  // Admin category access (authentication required)
  async filter(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `categories?${queryString}` : 'categories';

      // Use authenticated request for admin API, not public API
      const response = await apiClient.get(url);

      // Handle paginated admin response: {success: true, data: {categories: [...], pagination: {...}}}
      if (response && response.success && response.data) {
        if (Array.isArray(response.data.categories)) {
          return response.data.categories;
        } else if (Array.isArray(response.data)) {
          return response.data;
        }
      }

      // Handle direct array response
      const result = Array.isArray(response) ? response : [];
      return result;
    } catch (error) {
      console.error(`CategoryService.filter() error:`, error.message);
      return [];
    }
  }

  // Smart findAll - uses authenticated API for admin, public API for storefront
  async findAll(params = {}) {
    try {
      // Add include_all_translations for authenticated admin requests
      const hasToken = apiClient.getToken();
      const enhancedParams = hasToken
        ? { ...params, include_all_translations: 'true' }
        : params;

      const queryString = new URLSearchParams(enhancedParams).toString();
      const url = queryString ? `categories?${queryString}` : 'categories';

      // Check if user is authenticated (admin or store owner)
      let response;

      if (hasToken) {
        try {
          // Try authenticated API first for admin users
          response = await apiClient.get(url);

          // Handle paginated admin response: {success: true, data: {categories: [...], pagination: {...}}}
          if (response && response.success && response.data) {
            if (Array.isArray(response.data.categories)) {
              return response.data.categories;
            } else if (Array.isArray(response.data)) {
              return response.data;
            }
          }

          // Handle direct array response
          const result = Array.isArray(response) ? response : [];
          return result;
        } catch (authError) {
          // If authenticated request fails (e.g., 401), fall back to public API
          if (authError.status === 401 || authError.status === 403) {
            console.warn('CategoryService: Authenticated request failed, falling back to public API');
            response = await apiClient.publicRequest('GET', url);
          } else {
            throw authError;
          }
        }
      } else {
        // No token, use public API
        response = await apiClient.publicRequest('GET', url);
      }

      // Ensure response is always an array
      const result = Array.isArray(response) ? response : [];
      return result;
    } catch (error) {
      console.error(`CategoryService.findAll() error:`, error.message, error);
      return [];
    }
  }

  // Get root categories
  async getRootCategories(params = {}) {
    const result = await this.findAll({ ...params, parent_id: null });
    return Array.isArray(result) ? result : [];
  }

  // Get child categories
  async getChildren(parentId, params = {}) {
    const result = await this.findAll({ ...params, parent_id: parentId });
    return Array.isArray(result) ? result : [];
  }

  // Override findPaginated to include all translations for admin
  async findPaginated(page = 1, limit = 10, filters = {}) {
    try {
      const params = {
        page: page,
        limit: limit,
        include_all_translations: 'true', // Always include all translations for admin
        ...filters
      };

      const queryString = new URLSearchParams(params).toString();
      const url = `${this.endpoint}?${queryString}`;

      const hasToken = apiClient.getToken();
      if (!hasToken) {
        // No auth, use public API (without translations)
        const response = await apiClient.publicRequest('GET', url);
        return {
          data: Array.isArray(response) ? response : [],
          pagination: {
            current_page: page,
            per_page: limit,
            total: response.length || 0,
            total_pages: Math.ceil((response.length || 0) / limit)
          }
        };
      }

      // Use authenticated API
      const response = await apiClient.get(url);

      // Handle paginated admin response
      if (response && response.success && response.data) {
        return {
          data: response.data.categories || [],
          pagination: response.data.pagination || {
            current_page: page,
            per_page: limit,
            total: 0,
            total_pages: 0
          }
        };
      }

      return {
        data: [],
        pagination: {
          current_page: page,
          per_page: limit,
          total: 0,
          total_pages: 0
        }
      };
    } catch (error) {
      console.error(`CategoryService.findPaginated() error:`, error.message);
      return {
        data: [],
        pagination: {
          current_page: page,
          per_page: limit,
          total: 0,
          total_pages: 0
        }
      };
    }
  }
}

// Order service with status methods
class OrderService extends BaseEntity {
  constructor() {
    super('orders');
  }

  // Override filter to ensure proper order items loading
  async filter(params = {}) {
    try {
      const result = await this.findAll(params);
      
      // Double-check that result is an array and log first order structure
      const finalResult = Array.isArray(result) ? result : [];
      return finalResult;
    } catch (error) {
      console.error(`OrderService.filter() error:`, error.message);
      return [];
    }
  }

  // Get orders by status
  async getByStatus(status, params = {}) {
    const result = await this.findAll({ ...params, status });
    return Array.isArray(result) ? result : [];
  }

  // Update order status
  async updateStatus(id, status) {
    return this.update(id, { status });
  }
}

// Create entity instances
export const Auth = new AuthService();
export const User = new UserService();
export const Store = new StoreService();
export const Product = new ProductService();
export const Category = new CategoryService();
export const Attribute = new BaseEntity('attributes');
export const AttributeSet = new BaseEntity('attribute-sets');
export const Order = new OrderService();
export const OrderItem = new BaseEntity('order-items');
export const Coupon = new BaseEntity('coupons');

// CmsPage service - ADMIN ONLY (use StorefrontCmsPage for public/storefront)
class CmsPageService extends BaseEntity {
  constructor() {
    super('cms-pages');
  }

  // Admin filter - uses authenticated API only
  async filter(params = {}) {
    try {
      // Add include_all_translations for admin requests
      const enhancedParams = { ...params, include_all_translations: 'true' };

      const queryString = new URLSearchParams(enhancedParams).toString();
      const url = queryString ? `cms-pages?${queryString}` : 'cms-pages';

      const response = await apiClient.get(url);

      // Handle paginated admin response: {success: true, data: {pages: [...], pagination: {...}}}
      if (response && response.success && response.data) {
        if (Array.isArray(response.data.pages)) {
          return response.data.pages;
        } else if (Array.isArray(response.data)) {
          return response.data;
        }
      }

      // Handle direct array response
      const result = Array.isArray(response) ? response : [];
      return result;
    } catch (error) {
      console.error(`❌ CmsPageService.filter() error:`, error.message);
      return [];
    }
  }

  // Admin findAll - uses authenticated API only
  async findAll(params = {}) {
    return this.filter(params);
  }
}

// CmsBlock service - ADMIN ONLY (use StorefrontCmsBlock for public/storefront)
class CmsBlockService extends BaseEntity {
  constructor() {
    super('cms-blocks');
  }

  // Admin filter - uses authenticated API only
  async filter(params = {}) {
    try {
      // Add include_all_translations for admin requests
      const enhancedParams = { ...params, include_all_translations: 'true' };

      const queryString = new URLSearchParams(enhancedParams).toString();
      const url = queryString ? `cms-blocks?${queryString}` : 'cms-blocks';

      const response = await apiClient.get(url);

      // Handle paginated admin response: {success: true, data: {blocks: [...], pagination: {...}}}
      if (response && response.success && response.data) {
        if (Array.isArray(response.data.blocks)) {
          return response.data.blocks;
        } else if (Array.isArray(response.data)) {
          return response.data;
        }
      }

      // Handle direct array response
      const result = Array.isArray(response) ? response : [];
      return result;
    } catch (error) {
      console.error(`❌ CmsBlockService.filter() error:`, error.message);
      return [];
    }
  }

  // Admin findAll - uses authenticated API only
  async findAll(params = {}) {
    return this.filter(params);
  }
}

export const CmsPage = new CmsPageService();
export const CmsBlock = new CmsBlockService();

// EmailTemplate service - Email management with translations
class EmailTemplateService extends BaseEntity {
  constructor() {
    super('email-templates');
  }

  // Filter email templates by store
  async filter(filters = {}) {
    try {
      const queryString = new URLSearchParams(filters).toString();
      const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;

      const response = await apiClient.get(url);

      // Handle response structure: { success: true, data: [...] }
      if (response && response.success && response.data) {
        return response.data;
      }

      // Fallback to array
      const result = Array.isArray(response) ? response : [];
      return result;
    } catch (error) {
      console.error(`❌ EmailTemplateService.filter() error:`, error.message);
      return [];
    }
  }

  // Send test email
  async testEmail(templateId, testEmail, languageCode = 'en') {
    try {
      const response = await apiClient.post(`${this.endpoint}/${templateId}/test`, {
        test_email: testEmail,
        language_code: languageCode
      });
      return response;
    } catch (error) {
      console.error(`❌ EmailTemplateService.testEmail() error:`, error.message);
      throw error;
    }
  }

  // Bulk translate email templates
  async bulkTranslate(storeId, fromLang, toLang) {
    try {
      const response = await apiClient.post(`${this.endpoint}/bulk-translate`, {
        store_id: storeId,
        from_lang: fromLang,
        to_lang: toLang
      });
      return response;
    } catch (error) {
      console.error(`❌ EmailTemplateService.bulkTranslate() error:`, error.message);
      throw error;
    }
  }
}

export const EmailTemplate = new EmailTemplateService();

// Storefront CMS entities - use public routes without authentication
class StorefrontCmsPageService extends BaseEntity {
  constructor() {
    super('cms-pages'); // Endpoint without 'public-' prefix (storefront client adds it)
  }

  async findAll(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const endpoint = queryString ? `cms-pages?${queryString}` : 'cms-pages';

      // Use storefront API client (public route with X-Language header)
      const response = await storefrontApiClient.getPublic(endpoint);

      // Public route returns array directly
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error(`❌ StorefrontCmsPageService.findAll() error:`, error.message);
      return [];
    }
  }
}

class StorefrontCmsBlockService extends BaseEntity {
  constructor() {
    super('cms-blocks'); // Endpoint without 'public-' prefix (storefront client adds it)
  }

  async findAll(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const endpoint = queryString ? `cms-blocks?${queryString}` : 'cms-blocks';

      // Use storefront API client (public route with X-Language header)
      const response = await storefrontApiClient.getPublic(endpoint);

      // Public route returns array directly
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error(`❌ StorefrontCmsBlockService.findAll() error:`, error.message);
      return [];
    }
  }
}

export const StorefrontCmsPage = new StorefrontCmsPageService();
export const StorefrontCmsBlock = new StorefrontCmsBlockService();

export const Tax = new BaseEntity('tax');
export const ShippingMethod = new BaseEntity('shipping');
export const ShippingMethodType = new BaseEntity('shipping-types');
export const DeliverySettings = new BaseEntity('delivery');

// Additional entities (you can implement these as needed)
export const Cart = new BaseEntity('cart');
export const ProductLabel = new BaseEntity('product-labels');
// Admin ProductTab entity - forces authenticated API usage for admin operations
class AdminProductTabEntity extends BaseEntity {
  constructor() {
    super('product-tabs');
  }

  // Override to force authenticated API usage for admin operations
  async findAll(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;

      // Always use authenticated API for admin operations
      const response = await apiClient.get(url);

      if (response && response.data) {
        // Backend returns {success: true, data: [...]}
        const result = Array.isArray(response.data) ? response.data : [];
        return result;
      } else {
        // Direct array response
        const result = Array.isArray(response) ? response : [];
        return result;
      }
    } catch (error) {
      console.error(`AdminProductTab.findAll() error:`, error.message);
      return [];
    }
  }

  async filter(params = {}) {
    return this.findAll(params);
  }
}

export const ProductTab = new AdminProductTabEntity();
export const TaxType = new BaseEntity('tax-types');
export const Service = new BaseEntity('services');

// CustomOptionRule entity that uses public API for storefront access
class CustomOptionRuleEntity extends BaseEntity {
  constructor() {
    super('custom-option-rules');
  }

  // Override filter to use public API for storefront access
  async filter(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `custom-option-rules?${queryString}` : 'custom-option-rules';

      // Use public request for custom option rule filtering (no authentication required for storefront)
      const response = await apiClient.publicRequest('GET', url);

      // Ensure response is always an array
      const result = Array.isArray(response) ? response : [];

      return result;
    } catch (error) {
      console.error(`CustomOptionRuleEntity.filter() error:`, error.message);
      return [];
    }
  }

  // Override findAll to use public API
  async findAll(params = {}) {
    return this.filter(params);
  }
}

export const CustomOptionRule = new CustomOptionRuleEntity();
export const Plugin = new BaseEntity('plugins');

// Team Management Service
class StoreTeamService extends BaseEntity {
  constructor() {
    super('store-teams');
  }

  // Get team members for a store
  async getTeamMembers(storeId) {
    try {
      const response = await apiClient.get(`${this.endpoint}/${storeId}`);
      return response?.data || response || [];
    } catch (error) {
      console.error(`StoreTeamService.getTeamMembers() error:`, error.message);
      return [];
    }
  }

  // Invite a team member
  async inviteMember(storeId, inviteData) {
    try {
      const response = await apiClient.post(`${this.endpoint}/${storeId}/invite`, inviteData);
      return response;
    } catch (error) {
      console.error(`StoreTeamService.inviteMember() error:`, error.message);
      throw error;
    }
  }

  // Get pending invitations for a store
  async getInvitations(storeId) {
    try {
      const response = await apiClient.get(`${this.endpoint}/${storeId}/invitations`);
      // apiClient transforms response and may return the invitations array directly
      if (Array.isArray(response)) {
        return response;
      }
      return response?.data?.invitations || response?.invitations || [];
    } catch (error) {
      console.error(`StoreTeamService.getInvitations() error:`, error.message);
      return [];
    }
  }

  // Resend invitation email
  async resendInvitation(storeId, invitationId) {
    try {
      const response = await apiClient.post(`${this.endpoint}/${storeId}/invitations/${invitationId}/resend`);
      return response;
    } catch (error) {
      console.error(`StoreTeamService.resendInvitation() error:`, error.message);
      throw error;
    }
  }

  // Delete/cancel invitation
  async deleteInvitation(storeId, invitationId) {
    try {
      const response = await apiClient.delete(`${this.endpoint}/${storeId}/invitations/${invitationId}`);
      return response;
    } catch (error) {
      console.error(`StoreTeamService.deleteInvitation() error:`, error.message);
      throw error;
    }
  }

  // Update team member
  async updateMember(storeId, memberId, updateData) {
    try {
      const response = await apiClient.put(`${this.endpoint}/${storeId}/members/${memberId}`, updateData);
      return response;
    } catch (error) {
      console.error(`StoreTeamService.updateMember() error:`, error.message);
      throw error;
    }
  }

  // Remove team member
  async removeMember(storeId, memberId) {
    try {
      const response = await apiClient.delete(`${this.endpoint}/${storeId}/members/${memberId}`);
      return response;
    } catch (error) {
      console.error(`StoreTeamService.removeMember() error:`, error.message);
      throw error;
    }
  }
}

export const StoreTeam = new StoreTeamService();
export const Language = new BaseEntity('languages');
export const SeoTemplate = new BaseEntity('seo-templates');
export const SeoSetting = new BaseEntity('seo-settings');
export const CreditTransaction = new BaseEntity('credits/transactions');
export const CookieConsentSettings = new BaseEntity('cookie-consent-settings');
export const ConsentLog = new BaseEntity('consent-logs');
export const PriceAlertSubscription = new BaseEntity('price-alert-subscriptions');
export const StockAlertSubscription = new BaseEntity('stock-alert-subscriptions');

// PaymentMethod service with public API support for storefront
class PaymentMethodService extends BaseEntity {
  constructor() {
    super('payment-methods');
  }

  // Override filter to use public API for storefront access with language support
  async filter(params = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const url = queryString ? `payment-methods?${queryString}` : 'payment-methods';

      // Use public request for payment method filtering (no authentication required for storefront)
      // This will automatically send X-Language header from localStorage
      const response = await apiClient.publicRequest('GET', url);

      // Ensure response is always an array
      const result = Array.isArray(response) ? response : [];

      return result;
    } catch (error) {
      console.error(`❌ PaymentMethodService.filter() error:`, error.message);
      return [];
    }
  }

  // Override findAll to use public API
  async findAll(params = {}) {
    return this.filter(params);
  }
}

export const PaymentMethod = new PaymentMethodService();
export const Customer = new BaseEntity('customers');
export const CustomerActivity = new BaseEntity('customer-activity');
export const Redirect = new BaseEntity('redirects');
export const MediaAsset = new BaseEntity('media-assets');
export const SlotConfiguration = new BaseEntity('slot-configurations');

// For backward compatibility, export common methods
export const getCurrentUser = () => User.me();
export const login = (email, password) => Auth.login(email, password);
export const logout = () => Auth.logout();
export const register = (userData) => Auth.register(userData);

// Export API client for advanced usage
export { apiClient };

// Health check
export const healthCheck = () => apiClient.healthCheck();