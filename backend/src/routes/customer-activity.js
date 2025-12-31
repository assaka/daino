const express = require('express');
const ConnectionManager = require('../services/database/ConnectionManager');
const { analyticsLimiter, publicReadLimiter } = require('../middleware/rateLimiters');
const { validateRequest, customerActivitySchema } = require('../validation/analyticsSchemas');
const { attachConsentInfo, sanitizeEventData } = require('../middleware/consentMiddleware');
const { attachGeoLocation } = require('../middleware/geoLocationMiddleware');
const eventBus = require('../services/analytics/EventBus');

// Initialize handlers
require('../services/analytics/handlers/CustomerActivityHandler');
require('../services/analytics/handlers/WebhookIntegrationHandler');

const router = express.Router();

// Apply middleware to all routes
router.use(attachConsentInfo);
router.use(attachGeoLocation); // Add geographic data

// @route   GET /api/customer-activity
// @desc    Get customer activities
// @access  Public (Rate Limited)
router.get('/', publicReadLimiter, async (req, res) => {
  try {
    const {
      session_id,
      store_id,
      user_id,
      activity_type,
      page = 1,
      limit = 50,
      start_date,
      end_date
    } = req.query;

    if (!store_id) {
      return res.status(400).json({
        success: false,
        message: 'store_id is required'
      });
    }

    // Get tenant database connection
    const tenantDb = await ConnectionManager.getStoreConnection(store_id);

    // Build query with filters
    let query = tenantDb
      .from('customer_activities')
      .select('*')
      .eq('store_id', store_id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (session_id) {
      query = query.eq('session_id', session_id);
    }
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (activity_type) {
      query = query.eq('activity_type', activity_type);
    }
    if (start_date && end_date) {
      query = query.gte('created_at', new Date(start_date).toISOString())
                   .lte('created_at', new Date(end_date).toISOString());
    }

    // Get total count for pagination (separate query without limit/offset)
    let countQuery = tenantDb
      .from('customer_activities')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', store_id);

    if (session_id) countQuery = countQuery.eq('session_id', session_id);
    if (user_id) countQuery = countQuery.eq('user_id', user_id);
    if (activity_type) countQuery = countQuery.eq('activity_type', activity_type);
    if (start_date && end_date) {
      countQuery = countQuery.gte('created_at', new Date(start_date).toISOString())
                             .lte('created_at', new Date(end_date).toISOString());
    }

    // Execute count query
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    // Apply pagination to main query
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + parseInt(limit) - 1);

    // Execute main query
    const { data: activities, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: {
        activities: activities || [],
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((count || 0) / limit),
          total_items: count || 0,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get customer activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/customer-activity
// @desc    Log customer activity (via unified event bus)
// @access  Public (Rate Limited + Validated + Consent-aware)
router.post('/', analyticsLimiter, validateRequest(customerActivitySchema), sanitizeEventData, async (req, res) => {
  try {
    const {
      session_id,
      store_id,
      activity_type,
      page_url,
      referrer,
      product_id,
      search_query,
      user_id,
      language,
      metadata
    } = req.body;

    // Get geographic data from middleware
    const geoData = req.geoLocation || {};

    // Publish event to unified event bus
    const result = await eventBus.publish('customer_activity', {
      session_id,
      store_id,
      user_id,
      activity_type,
      page_url,
      referrer,
      product_id,
      search_query,
      user_agent: req.get('User-Agent'),
      ip_address: req.ip || req.connection.remoteAddress,
      country: geoData.country,
      country_name: geoData.country_name,
      city: geoData.city,
      region: geoData.region,
      timezone: geoData.timezone,
      language: language || req.get('Accept-Language')?.split(',')[0]?.split('-')[0] || null,
      metadata: metadata || {}
    }, {
      source: 'api',
      priority: activity_type === 'order_completed' ? 'high' : 'normal'
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    res.status(201).json({
      success: true,
      data: {
        event_id: result.eventId,
        correlation_id: result.correlationId,
        session_id,
        activity_type,
        duplicate: result.duplicate || false
      }
    });
  } catch (error) {
    // Log error with context for debugging
    console.error('[CUSTOMER ACTIVITY ERROR]', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      store_id: req.body?.store_id
    });

    res.status(500).json({
      success: false,
      message: 'Server error while logging activity',
      error: error.message
    });
  }
});

module.exports = router;