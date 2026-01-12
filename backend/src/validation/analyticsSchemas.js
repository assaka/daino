/**
 * Validation Schemas for Analytics and Tracking Endpoints
 * Uses Joi for comprehensive input validation
 */

const Joi = require('joi');

/**
 * Valid activity types for customer activity tracking
 */
const ACTIVITY_TYPES = [
    'page_view',
    'product_view',
    'add_to_cart',
    'remove_from_cart',
    'checkout_started',
    'order_completed',
    'search',
    'customer_login',
    'customer_registration'
];

/**
 * Valid interaction types for heatmap tracking
 */
const INTERACTION_TYPES = [
    'click',
    'hover',
    'scroll',
    'mouse_move',
    'touch',
    'focus',
    'key_press'
];

/**
 * Schema for customer activity tracking
 */
const customerActivitySchema = Joi.object({
    session_id: Joi.string()
        .required()
        .max(255)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .messages({
            'string.pattern.base': 'session_id must contain only alphanumeric characters, hyphens, and underscores',
            'any.required': 'session_id is required'
        }),

    store_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'store_id must be a valid UUID',
            'any.required': 'store_id is required'
        }),

    user_id: Joi.string()
        .uuid()
        .allow(null)
        .optional()
        .messages({
            'string.guid': 'user_id must be a valid UUID'
        }),

    activity_type: Joi.string()
        .valid(...ACTIVITY_TYPES)
        .required()
        .messages({
            'any.only': `activity_type must be one of: ${ACTIVITY_TYPES.join(', ')}`,
            'any.required': 'activity_type is required'
        }),

    page_url: Joi.string()
        .uri({ allowRelative: true })
        .max(2048)
        .optional()
        .allow(null, '')
        .messages({
            'string.uri': 'page_url must be a valid URL',
            'string.max': 'page_url must not exceed 2048 characters'
        }),

    referrer: Joi.string()
        .uri({ allowRelative: true })
        .max(2048)
        .optional()
        .allow(null, '')
        .messages({
            'string.uri': 'referrer must be a valid URL',
            'string.max': 'referrer must not exceed 2048 characters'
        }),

    product_id: Joi.string()
        .uuid()
        .optional()
        .allow(null)
        .messages({
            'string.guid': 'product_id must be a valid UUID'
        }),

    search_query: Joi.string()
        .max(500)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'search_query must not exceed 500 characters'
        }),

    user_agent: Joi.string()
        .max(1000)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'user_agent must not exceed 1000 characters'
        }),

    ip_address: Joi.string()
        .ip({ version: ['ipv4', 'ipv6'] })
        .optional()
        .allow(null, '')
        .messages({
            'string.ip': 'ip_address must be a valid IPv4 or IPv6 address'
        }),

    language: Joi.string()
        .max(10)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'language must not exceed 10 characters'
        }),

    country: Joi.string()
        .max(2)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'country must not exceed 2 characters'
        }),

    country_name: Joi.string()
        .max(100)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'country_name must not exceed 100 characters'
        }),

    city: Joi.string()
        .max(100)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'city must not exceed 100 characters'
        }),

    region: Joi.string()
        .max(100)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'region must not exceed 100 characters'
        }),

    timezone: Joi.string()
        .max(50)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'timezone must not exceed 50 characters'
        }),

    metadata: Joi.object()
        .optional()
        .allow(null)
        .messages({
            'object.base': 'metadata must be a valid JSON object'
        })
}).options({ stripUnknown: true }); // Remove unknown fields

/**
 * Schema for heatmap interaction tracking
 */
const heatmapInteractionSchema = Joi.object({
    session_id: Joi.string()
        .required()
        .max(255)
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .messages({
            'string.pattern.base': 'session_id must contain only alphanumeric characters, hyphens, and underscores',
            'any.required': 'session_id is required'
        }),

    store_id: Joi.string()
        .uuid()
        .required()
        .messages({
            'string.guid': 'store_id must be a valid UUID',
            'any.required': 'store_id is required'
        }),

    user_id: Joi.string()
        .uuid()
        .allow(null)
        .optional()
        .messages({
            'string.guid': 'user_id must be a valid UUID'
        }),

    page_url: Joi.string()
        .uri({ allowRelative: true })
        .max(2048)
        .required()
        .messages({
            'string.uri': 'page_url must be a valid URL',
            'any.required': 'page_url is required',
            'string.max': 'page_url must not exceed 2048 characters'
        }),

    viewport_width: Joi.number()
        .integer()
        .min(200)
        .max(5000)
        .optional()
        .messages({
            'number.min': 'viewport_width must be at least 200',
            'number.max': 'viewport_width must not exceed 5000'
        }),

    viewport_height: Joi.number()
        .integer()
        .min(200)
        .max(5000)
        .optional()
        .messages({
            'number.min': 'viewport_height must be at least 200',
            'number.max': 'viewport_height must not exceed 5000'
        }),

    interaction_type: Joi.string()
        .valid(...INTERACTION_TYPES)
        .required()
        .messages({
            'any.only': `interaction_type must be one of: ${INTERACTION_TYPES.join(', ')}`,
            'any.required': 'interaction_type is required'
        }),

    x_coordinate: Joi.number()
        .integer()
        .min(0)
        .max(10000)
        .optional()
        .allow(null)
        .messages({
            'number.min': 'x_coordinate must be at least 0',
            'number.max': 'x_coordinate must not exceed 10000'
        }),

    y_coordinate: Joi.number()
        .integer()
        .min(0)
        .max(10000)
        .optional()
        .allow(null)
        .messages({
            'number.min': 'y_coordinate must be at least 0',
            'number.max': 'y_coordinate must not exceed 10000'
        }),

    element_selector: Joi.string()
        .max(500)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'element_selector must not exceed 500 characters'
        }),

    element_tag: Joi.string()
        .max(50)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'element_tag must not exceed 50 characters'
        }),

    element_id: Joi.string()
        .max(255)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'element_id must not exceed 255 characters'
        }),

    element_class: Joi.string()
        .max(500)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'element_class must not exceed 500 characters'
        }),

    element_text: Joi.string()
        .max(500)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'element_text must not exceed 500 characters'
        }),

    scroll_position: Joi.number()
        .min(0)
        .max(100000)
        .optional()
        .allow(null)
        .messages({
            'number.min': 'scroll_position must be at least 0',
            'number.max': 'scroll_position must not exceed 100000',
            'number.base': 'scroll_position must be a number'
        }),

    scroll_depth_percent: Joi.number()
        .min(0)
        .max(100)
        .optional()
        .allow(null)
        .messages({
            'number.min': 'scroll_depth_percent must be at least 0',
            'number.max': 'scroll_depth_percent must not exceed 100'
        }),

    time_on_element: Joi.number()
        .integer()
        .min(0)
        .max(86400000) // 24 hours in milliseconds
        .optional()
        .allow(null)
        .messages({
            'number.min': 'time_on_element must be at least 0',
            'number.max': 'time_on_element must not exceed 86400000 (24 hours)'
        }),

    device_type: Joi.string()
        .max(50)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'device_type must not exceed 50 characters'
        }),

    user_agent: Joi.string()
        .max(1000)
        .optional()
        .allow(null, '')
        .messages({
            'string.max': 'user_agent must not exceed 1000 characters'
        }),

    ip_address: Joi.string()
        .ip({ version: ['ipv4', 'ipv6'] })
        .optional()
        .allow(null, '')
        .messages({
            'string.ip': 'ip_address must be a valid IPv4 or IPv6 address'
        }),

    metadata: Joi.object()
        .optional()
        .allow(null)
        .messages({
            'object.base': 'metadata must be a valid JSON object'
        })
}).options({ stripUnknown: true }); // Remove unknown fields

/**
 * Schema for batch heatmap interactions
 */
const heatmapBatchSchema = Joi.object({
    interactions: Joi.array()
        .items(heatmapInteractionSchema)
        .min(1)
        .max(100) // Limit batch size to 100 events
        .required()
        .messages({
            'array.min': 'interactions array must contain at least 1 item',
            'array.max': 'interactions array must not exceed 100 items',
            'any.required': 'interactions array is required'
        })
}).options({ stripUnknown: true });

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi schema to validate against
 * @returns {Function} Express middleware function
 */
function validateRequest(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Return all errors, not just the first one
            stripUnknown: true // Remove unknown fields
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            console.warn(`[VALIDATION ERROR] ${req.method} ${req.path}`, {
                ip: req.ip,
                errors
            });

            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        // Replace req.body with validated and sanitized data
        req.body = value;
        next();
    };
}

module.exports = {
    customerActivitySchema,
    heatmapInteractionSchema,
    heatmapBatchSchema,
    validateRequest,
    ACTIVITY_TYPES,
    INTERACTION_TYPES
};
