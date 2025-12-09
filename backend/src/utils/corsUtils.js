/**
 * CORS Utilities - Centralized CORS Configuration
 *
 * This file contains all CORS-related logic for the backend.
 * Single source of truth for origin validation and CORS options.
 */

const { isAllowedDomain, getAllPlatformDomainVariants } = require('./domainConfig');

/**
 * Extract hostname from origin URL safely
 * @param {string} origin - The origin URL
 * @returns {string|null} - Hostname or null if invalid
 */
function extractHostname(origin) {
  if (!origin) return null;

  try {
    return new URL(origin).hostname;
  } catch (e) {
    console.warn('⚠️ CORS: Invalid origin URL:', origin);
    return null;
  }
}

/**
 * Check if origin is allowed based on static rules (no DB lookup)
 * @param {string} origin - The origin URL
 * @returns {boolean}
 */
function isStaticAllowedOrigin(origin) {
  if (!origin) return true; // Allow requests with no origin (mobile apps, curl)

  const hostname = extractHostname(origin);
  if (!hostname) return false;

  return isAllowedDomain(hostname);
}

/**
 * Check if origin is a verified custom domain (requires DB lookup)
 * @param {string} hostname - The hostname to check
 * @param {Object} masterDbClient - Supabase client for master DB
 * @returns {Promise<boolean>}
 */
async function isVerifiedCustomDomain(hostname, masterDbClient) {
  if (!masterDbClient) {
    console.warn('⚠️ CORS: masterDbClient not available for custom domain check');
    return false;
  }

  try {
    const { data: lookupDomain, error } = await masterDbClient
      .from('custom_domains_lookup')
      .select('store_id')
      .eq('domain', hostname)
      .eq('is_active', true)
      .eq('is_verified', true)
      .maybeSingle();

    if (error) {
      console.warn('⚠️ CORS custom domain lookup error:', error.message);
      return false;
    }

    return !!lookupDomain;
  } catch (error) {
    console.warn('⚠️ CORS custom domain check failed:', error.message);
    return false;
  }
}

/**
 * Create the CORS origin validation function
 * @returns {Function} - Async function for cors middleware origin option
 */
function createCorsOriginValidator() {
  return async function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check static allowed origins first (platform, dev, hosting domains)
    if (isStaticAllowedOrigin(origin)) {
      return callback(null, true);
    }

    // Check if origin is a verified custom domain (requires DB lookup)
    const hostname = extractHostname(origin);
    if (hostname) {
      try {
        const { masterDbClient } = require('../database/masterConnection');
        const isVerified = await isVerifiedCustomDomain(hostname, masterDbClient);
        if (isVerified) {
          return callback(null, true);
        }
      } catch (error) {
        console.warn('⚠️ CORS: Error checking custom domain:', error.message);
      }
    }

    // Reject origin
    callback(new Error('Not allowed by CORS: ' + origin));
  };
}

/**
 * Get complete CORS options object
 * @returns {Object} - CORS configuration object for cors middleware
 */
function getCorsOptions() {
  return {
    maxAge: 86400, // Cache OPTIONS preflight for 24 hours
    origin: createCorsOriginValidator(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-store-id',
      'X-Store-Id',
      'X-Language',
      'x-session-id',
      'X-Session-Id',
      'params',
      'cache-control',
      'Cache-Control',
      'pragma',
      'Pragma',
      'expires',
      'Expires',
      'headers',
      'x-requested-with',
      'x-skip-transform',
      'X-Skip-Transform'
    ],
    exposedHeaders: ['Access-Control-Allow-Origin'],
    optionsSuccessStatus: 200,
    preflightContinue: false
  };
}

module.exports = {
  extractHostname,
  isStaticAllowedOrigin,
  isVerifiedCustomDomain,
  createCorsOriginValidator,
  getCorsOptions
};
