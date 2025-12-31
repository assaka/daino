import apiClient from './client';

/**
 * Webhook Integrations API Client
 * Unified API for n8n, Zapier, and Make workflow automation integrations
 */

// Supported providers
export const PROVIDERS = {
  N8N: 'n8n',
  ZAPIER: 'zapier',
  MAKE: 'make'
};

// Supported event types
export const EVENT_TYPES = [
  'page_view',
  'product_view',
  'add_to_cart',
  'remove_from_cart',
  'checkout_started',
  'order_placed',
  'customer_created',
  'abandoned_cart',
  'search'
];

// Authentication types
export const AUTH_TYPES = {
  NONE: 'none',
  API_KEY: 'api_key',
  BASIC: 'basic',
  BEARER: 'bearer',
  HMAC: 'hmac'
};

/**
 * Get all webhooks for a provider
 * @param {string} provider - Provider type (n8n, zapier, make)
 * @returns {Promise<Object>} Webhooks list with pagination
 */
export const getWebhooks = async (provider) => {
  const response = await apiClient.get(`/webhook-integrations/${provider}/webhooks`);
  return response;
};

/**
 * Create a new webhook
 * @param {string} provider - Provider type
 * @param {Object} webhookData - Webhook configuration
 * @returns {Promise<Object>} Created webhook
 */
export const createWebhook = async (provider, webhookData) => {
  const response = await apiClient.post(`/webhook-integrations/${provider}/webhooks`, webhookData);
  return response;
};

/**
 * Update an existing webhook
 * @param {string} provider - Provider type
 * @param {string} webhookId - Webhook ID
 * @param {Object} webhookData - Updated webhook configuration
 * @returns {Promise<Object>} Updated webhook
 */
export const updateWebhook = async (provider, webhookId, webhookData) => {
  const response = await apiClient.put(`/webhook-integrations/${provider}/webhooks/${webhookId}`, webhookData);
  return response;
};

/**
 * Delete a webhook
 * @param {string} provider - Provider type
 * @param {string} webhookId - Webhook ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteWebhook = async (provider, webhookId) => {
  const response = await apiClient.delete(`/webhook-integrations/${provider}/webhooks/${webhookId}`);
  return response;
};

/**
 * Test a webhook by sending a test payload
 * @param {string} provider - Provider type
 * @param {string} webhookId - Webhook ID
 * @returns {Promise<Object>} Test result
 */
export const testWebhook = async (provider, webhookId) => {
  const response = await apiClient.post(`/webhook-integrations/${provider}/webhooks/${webhookId}/test`);
  return response;
};

/**
 * Get delivery logs for a webhook
 * @param {string} provider - Provider type
 * @param {string} webhookId - Webhook ID
 * @param {Object} params - Query params (page, limit)
 * @returns {Promise<Object>} Delivery logs with pagination
 */
export const getWebhookLogs = async (provider, webhookId, params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = `/webhook-integrations/${provider}/webhooks/${webhookId}/logs${queryString ? `?${queryString}` : ''}`;
  const response = await apiClient.get(endpoint);
  return response;
};

/**
 * Get webhook statistics
 * @param {string} provider - Provider type
 * @returns {Promise<Object>} Statistics for all webhooks
 */
export const getWebhookStats = async (provider) => {
  const response = await apiClient.get(`/webhook-integrations/${provider}/stats`);
  return response;
};

/**
 * Get supported event types
 * @returns {Promise<Object>} List of supported event types
 */
export const getEventTypes = async () => {
  const response = await apiClient.get('/webhook-integrations/event-types');
  return response;
};

/**
 * Get available providers
 * @returns {Promise<Object>} List of available providers
 */
export const getProviders = async () => {
  const response = await apiClient.get('/webhook-integrations/providers');
  return response;
};

/**
 * Get supported authentication types
 * @returns {Promise<Object>} List of supported auth types
 */
export const getAuthTypes = async () => {
  const response = await apiClient.get('/webhook-integrations/auth-types');
  return response;
};

// Named export object for convenience
export const webhookIntegrationsApi = {
  PROVIDERS,
  EVENT_TYPES,
  AUTH_TYPES,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookLogs,
  getWebhookStats,
  getEventTypes,
  getProviders,
  getAuthTypes
};

export default webhookIntegrationsApi;
