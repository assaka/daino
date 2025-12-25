/**
 * Domain Configuration - Single Source of Truth (Backend)
 *
 * This file centralizes all domain-related logic for the backend.
 * Import from here instead of duplicating domain checks across files.
 */

const { masterDbClient } = require('../database/masterConnection');

// Platform domains - these are our main application domains
const PLATFORM_DOMAINS = [
  'dainostore.com',
  'daino.ai',
  'daino.store'
];

// Development/staging domains
const DEV_DOMAINS = [
  'localhost',
  '127.0.0.1'
];

// Hosting provider domains
const HOSTING_DOMAINS = [
  'vercel.app',
  'onrender.com'
];

/**
 * Check if hostname is a platform domain (dainostore.com, daino.ai, daino.store)
 * @param {string} hostname
 * @returns {boolean}
 */
function isPlatformDomain(hostname) {
  if (!hostname) return false;
  return PLATFORM_DOMAINS.some(domain => hostname.includes(domain));
}

/**
 * Check if hostname is a development environment
 * @param {string} hostname
 * @returns {boolean}
 */
function isDevDomain(hostname) {
  if (!hostname) return false;
  return DEV_DOMAINS.some(domain => hostname.includes(domain));
}

/**
 * Check if hostname is a hosting provider domain (vercel.app, onrender.com)
 * @param {string} hostname
 * @returns {boolean}
 */
function isHostingDomain(hostname) {
  if (!hostname) return false;
  return HOSTING_DOMAINS.some(domain => hostname.includes(domain));
}

/**
 * Check if hostname is a custom store domain (not platform, dev, or hosting)
 * @param {string} hostname
 * @returns {boolean}
 */
function isCustomDomain(hostname) {
  if (!hostname) return false;
  return !isPlatformDomain(hostname) &&
         !isDevDomain(hostname) &&
         !isHostingDomain(hostname);
}

/**
 * Check if hostname is allowed (platform, dev, or hosting domain)
 * Used for CORS and other security checks
 * @param {string} hostname
 * @returns {boolean}
 */
function isAllowedDomain(hostname) {
  return isPlatformDomain(hostname) ||
         isDevDomain(hostname) ||
         isHostingDomain(hostname);
}

/**
 * Get all platform domain variants (with and without www)
 * @returns {string[]}
 */
function getAllPlatformDomainVariants() {
  const variants = [];
  PLATFORM_DOMAINS.forEach(domain => {
    variants.push(domain);
    variants.push(`www.${domain}`);
  });
  return variants;
}

// Default platform URL for store links (use CORS_ORIGIN from env)
const DEFAULT_PLATFORM_URL = process.env.CORS_ORIGIN || 'https://www.dainostore.com';

/**
 * Get the primary verified custom domain for a store
 * @param {object} tenantDb - Tenant database connection
 * @param {string} storeId - Store ID
 * @returns {Promise<string|null>} - Custom domain or null
 */
async function getPrimaryCustomDomain(tenantDb, storeId) {
  try {
    // Look up custom domain in master DB's custom_domains_lookup table
    if (!masterDbClient) {
      console.warn('[DOMAIN-CONFIG] masterDbClient not available');
      return null;
    }

    // Get active non-redirect custom domain (prefer main domain over www redirect)
    const { data: customDomain } = await masterDbClient
      .from('custom_domains_lookup')
      .select('domain')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .eq('is_redirect', false)
      .limit(1)
      .maybeSingle();

    if (customDomain?.domain) {
      return customDomain.domain;
    }

    // Fallback: get any active domain for this store
    const { data: anyDomain } = await masterDbClient
      .from('custom_domains_lookup')
      .select('domain')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    return anyDomain?.domain || null;
  } catch (error) {
    console.error('Error fetching custom domain:', error);
    return null;
  }
}

/**
 * Build the store URL, preferring custom domain if available
 * @param {object} options - Options object
 * @param {object} options.tenantDb - Tenant database connection
 * @param {string} options.storeId - Store ID
 * @param {string} options.storeSlug - Store slug (fallback)
 * @param {string} [options.path] - Optional path to append
 * @param {object} [options.queryParams] - Optional query parameters
 * @returns {Promise<string>} - Full store URL
 */
async function buildStoreUrl({ tenantDb, storeId, storeSlug, path = '', queryParams = {} }) {
  let baseUrl;

  // Try to get custom domain
  const customDomain = await getPrimaryCustomDomain(tenantDb, storeId);

  if (customDomain) {
    baseUrl = `https://${customDomain}`;
  } else {
    // Fallback to platform URL with store slug
    baseUrl = `${DEFAULT_PLATFORM_URL}/public/${storeSlug}`;
  }

  // Build full URL with path and query params
  let fullUrl = baseUrl;
  if (path) {
    fullUrl += path.startsWith('/') ? path : `/${path}`;
  }

  // Add query parameters
  const queryString = new URLSearchParams(queryParams).toString();
  if (queryString) {
    fullUrl += `?${queryString}`;
  }

  return fullUrl;
}

/**
 * Synchronous version for when custom domain is already known
 * @param {object} options - Options object
 * @param {string} [options.customDomain] - Custom domain if known
 * @param {string} options.storeSlug - Store slug (fallback)
 * @param {string} [options.path] - Optional path to append
 * @param {object} [options.queryParams] - Optional query parameters
 * @returns {string} - Full store URL
 */
function buildStoreUrlSync({ customDomain, storeSlug, path = '', queryParams = {} }) {
  let baseUrl;

  if (customDomain) {
    baseUrl = `https://${customDomain}`;
  } else {
    baseUrl = `${DEFAULT_PLATFORM_URL}/public/${storeSlug}`;
  }

  let fullUrl = baseUrl;
  if (path) {
    fullUrl += path.startsWith('/') ? path : `/${path}`;
  }

  const queryString = new URLSearchParams(queryParams).toString();
  if (queryString) {
    fullUrl += `?${queryString}`;
  }

  return fullUrl;
}

module.exports = {
  PLATFORM_DOMAINS,
  DEV_DOMAINS,
  HOSTING_DOMAINS,
  DEFAULT_PLATFORM_URL,
  isPlatformDomain,
  isDevDomain,
  isHostingDomain,
  isCustomDomain,
  isAllowedDomain,
  getAllPlatformDomainVariants,
  getPrimaryCustomDomain,
  buildStoreUrl,
  buildStoreUrlSync
};
