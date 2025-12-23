import apiClient from './client';

/**
 * Meta Commerce API Client
 *
 * Handles Instagram Shopping integration via Meta Commerce Manager
 */
export const MetaCommerce = {
  // ==================== OAuth ====================

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl: async () => {
    const response = await apiClient.post('meta-commerce/auth/url');
    return response.data;
  },

  /**
   * Disconnect integration
   */
  disconnect: async () => {
    const response = await apiClient.post('meta-commerce/auth/disconnect');
    return response.data;
  },

  // ==================== Configuration ====================

  /**
   * Get connection status
   */
  getStatus: async () => {
    const response = await apiClient.get('meta-commerce/status');
    return response.data;
  },

  /**
   * Get configuration
   */
  getConfig: async () => {
    const response = await apiClient.get('meta-commerce/config');
    return response.data;
  },

  /**
   * Save configuration
   */
  saveConfig: async (config) => {
    const response = await apiClient.post('meta-commerce/save-config', config);
    return response.data;
  },

  /**
   * Test connection
   */
  testConnection: async () => {
    const response = await apiClient.post('meta-commerce/test-connection');
    return response.data;
  },

  // ==================== Business & Catalogs ====================

  /**
   * Get available business accounts
   */
  getBusinesses: async () => {
    const response = await apiClient.get('meta-commerce/businesses');
    return response.data;
  },

  /**
   * Select business account
   */
  selectBusiness: async (businessId, businessName) => {
    const response = await apiClient.put('meta-commerce/businesses/select', {
      businessId,
      businessName
    });
    return response.data;
  },

  /**
   * Get catalogs for selected business
   */
  getCatalogs: async () => {
    const response = await apiClient.get('meta-commerce/catalogs');
    return response.data;
  },

  /**
   * Create new catalog
   */
  createCatalog: async (name) => {
    const response = await apiClient.post('meta-commerce/catalogs', { name });
    return response.data;
  },

  /**
   * Select catalog
   */
  selectCatalog: async (catalogId, catalogName) => {
    const response = await apiClient.put('meta-commerce/catalogs/select', {
      catalogId,
      catalogName
    });
    return response.data;
  },

  // ==================== Sync ====================

  /**
   * Sync products (foreground)
   */
  syncProducts: async (productIds = null, options = {}) => {
    const response = await apiClient.post('meta-commerce/sync', {
      productIds,
      ...options
    });
    return response.data;
  },

  /**
   * Schedule sync job (background)
   */
  scheduleSyncJob: async (options = {}) => {
    const response = await apiClient.post('meta-commerce/sync-job', options);
    return response.data;
  },

  /**
   * Get sync status
   */
  getSyncStatus: async () => {
    const response = await apiClient.get('meta-commerce/sync/status');
    return response.data;
  },

  // ==================== Product Status ====================

  /**
   * Get product errors
   */
  getProductErrors: async () => {
    const response = await apiClient.get('meta-commerce/products/errors');
    return response.data;
  }
};

export default MetaCommerce;
