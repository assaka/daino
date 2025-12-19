// Base API Contract Schemas for Testing
// This file defines the core schemas used across all API endpoints

const Joi = require('joi');

// Common field types
const commonFields = {
  id: Joi.alternatives().try(
    Joi.string().uuid(),
    Joi.number().integer().positive()
  ),
  timestamp: Joi.string().isoDate(),
  email: Joi.string().email(),
  url: Joi.string().uri(),
  slug: Joi.string().pattern(/^[a-z0-9-]+$/),
  price: Joi.number().precision(2).positive().allow(0),
  boolean: Joi.boolean(),
  optionalString: Joi.string().allow('', null),
  requiredString: Joi.string().min(1)
};

// Base response wrapper schema
const baseResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  message: Joi.string().optional(),
  data: Joi.any().optional(),
  meta: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    total: Joi.number().integer().min(0).optional(),
    pages: Joi.number().integer().min(0).optional()
  }).optional(),
  errors: Joi.array().items(Joi.string()).optional()
});

// Error response schema
const errorResponseSchema = Joi.object({
  success: Joi.boolean().valid(false).required(),
  message: Joi.string().required(),
  errors: Joi.array().items(Joi.string()).optional(),
  status: Joi.number().integer().min(400).max(599).optional()
});

// Entity schemas
const productSchema = Joi.object({
  id: commonFields.id.required(),
  name: commonFields.requiredString,
  slug: commonFields.slug.required(),
  sku: commonFields.optionalString,
  price: commonFields.price.required(),
  special_price: commonFields.price.allow(null),
  description: commonFields.optionalString,
  short_description: commonFields.optionalString,
  status: Joi.string().valid('active', 'inactive').required(),
  visibility: Joi.string().valid('catalog', 'search', 'both', 'none').required(),
  weight: Joi.number().positive().allow(null),
  dimensions: Joi.object({
    length: Joi.number().positive().allow(null),
    width: Joi.number().positive().allow(null),
    height: Joi.number().positive().allow(null)
  }).optional(),
  stock_quantity: Joi.number().integer().min(0).allow(null),
  manage_stock: commonFields.boolean,
  in_stock: commonFields.boolean,
  backorders: Joi.string().valid('no', 'notify', 'yes'),
  categories: Joi.array().items(commonFields.id).optional(),
  images: Joi.array().items(
    Joi.object({
      id: commonFields.id.required(),
      url: commonFields.url.required(),
      alt: commonFields.optionalString,
      position: Joi.number().integer().min(0)
    })
  ).optional(),
  attributes: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string(),
      Joi.number(),
      Joi.boolean(),
      Joi.array().items(Joi.string())
    )
  ).optional(),
  seo: Joi.object({
    meta_title: commonFields.optionalString,
    meta_description: commonFields.optionalString,
    meta_keywords: commonFields.optionalString
  }).optional(),
  created_at: commonFields.timestamp.required(),
  updated_at: commonFields.timestamp.required()
});

const categorySchema = Joi.object({
  id: commonFields.id.required(),
  name: commonFields.requiredString,
  slug: commonFields.slug.required(),
  description: commonFields.optionalString,
  parent_id: commonFields.id.allow(null),
  level: Joi.number().integer().min(0).required(),
  position: Joi.number().integer().min(0),
  is_active: commonFields.boolean.required(),
  include_in_menu: commonFields.boolean,
  image: commonFields.url.allow(null),
  meta_title: commonFields.optionalString,
  meta_description: commonFields.optionalString,
  created_at: commonFields.timestamp.required(),
  updated_at: commonFields.timestamp.required()
});

const orderSchema = Joi.object({
  id: commonFields.id.required(),
  order_number: commonFields.requiredString,
  status: Joi.string().valid(
    'pending', 'processing', 'shipped', 'delivered', 
    'cancelled', 'refunded', 'failed'
  ).required(),
  payment_status: Joi.string().valid(
    'pending', 'paid', 'failed', 'refunded', 'partially_refunded'
  ).required(),
  customer_email: commonFields.email.required(),
  customer_name: commonFields.requiredString,
  subtotal: commonFields.price.required(),
  tax_amount: commonFields.price,
  shipping_amount: commonFields.price,
  discount_amount: commonFields.price.allow(0),
  total: commonFields.price.required(),
  currency: Joi.string().length(3).uppercase().required(),
  items: Joi.array().items(
    Joi.object({
      id: commonFields.id.required(),
      product_id: commonFields.id.required(),
      product_name: commonFields.requiredString,
      sku: commonFields.optionalString,
      quantity: Joi.number().integer().min(1).required(),
      price: commonFields.price.required(),
      total: commonFields.price.required()
    })
  ).min(1).required(),
  billing_address: Joi.object({
    first_name: commonFields.requiredString,
    last_name: commonFields.requiredString,
    email: commonFields.email,
    phone: commonFields.optionalString,
    company: commonFields.optionalString,
    address_1: commonFields.requiredString,
    address_2: commonFields.optionalString,
    city: commonFields.requiredString,
    state: commonFields.optionalString,
    postal_code: commonFields.requiredString,
    country: commonFields.requiredString
  }).required(),
  shipping_address: Joi.object({
    first_name: commonFields.requiredString,
    last_name: commonFields.requiredString,
    company: commonFields.optionalString,
    address_1: commonFields.requiredString,
    address_2: commonFields.optionalString,
    city: commonFields.requiredString,
    state: commonFields.optionalString,
    postal_code: commonFields.requiredString,
    country: commonFields.requiredString
  }).optional(),
  created_at: commonFields.timestamp.required(),
  updated_at: commonFields.timestamp.required()
});

const userSchema = Joi.object({
  id: commonFields.id.required(),
  email: commonFields.email.required(),
  role: Joi.string().valid('admin', 'store_owner', 'customer', 'guest').required(),
  account_type: Joi.string().valid('agency', 'brand', 'individual').optional(),
  first_name: commonFields.optionalString,
  last_name: commonFields.optionalString,
  is_active: commonFields.boolean,
  email_verified: commonFields.boolean,
  last_login: commonFields.timestamp.allow(null),
  created_at: commonFields.timestamp.required(),
  updated_at: commonFields.timestamp.required()
});

const storeSchema = Joi.object({
  id: commonFields.id.required(),
  name: commonFields.requiredString,
  slug: commonFields.slug.required(),
  domain: commonFields.optionalString,
  status: Joi.string().valid('active', 'inactive', 'suspended').required(),
  owner_id: commonFields.id.required(),
  settings: Joi.object({
    currency: Joi.string().length(3).uppercase(),
    timezone: Joi.string(),
    language: Joi.string().length(2).lowercase(),
    theme: Joi.string().optional()
  }).optional(),
  created_at: commonFields.timestamp.required(),
  updated_at: commonFields.timestamp.required()
});

// Akeneo specific schemas (related to the transformation bug)
const akeneoMappingSchema = Joi.object({
  id: commonFields.id.required(),
  store_id: commonFields.id.required(),
  akeneo_attribute: commonFields.requiredString,
  catalog_attribute: commonFields.requiredString,
  attribute_type: Joi.string().valid(
    'text', 'textarea', 'number', 'price', 'date', 
    'boolean', 'select', 'multiselect', 'image', 'file'
  ).required(),
  mapping_rules: Joi.object({
    transform: Joi.string().optional(),
    default_value: Joi.any().optional(),
    required: commonFields.boolean.optional(),
    validation: Joi.object().optional()
  }).optional(),
  is_active: commonFields.boolean.required(),
  created_at: commonFields.timestamp.required(),
  updated_at: commonFields.timestamp.required()
});

const akeneoCustomMappingSchema = Joi.object({
  success: Joi.boolean().required(),
  mappings: Joi.object({
    attributes: Joi.array().items(
      Joi.object({
        akeneo_code: commonFields.requiredString,
        catalog_code: commonFields.requiredString,
        type: commonFields.requiredString,
        label: commonFields.optionalString,
        required: commonFields.boolean.optional(),
        options: Joi.array().items(Joi.string()).optional()
      })
    ).required(),
    images: Joi.array().items(
      Joi.object({
        akeneo_code: commonFields.requiredString,
        catalog_code: commonFields.requiredString,
        type: Joi.string().valid('image').required(),
        position: Joi.number().integer().min(0).optional()
      })
    ).required(),
    files: Joi.array().items(
      Joi.object({
        akeneo_code: commonFields.requiredString,
        catalog_code: commonFields.requiredString,
        type: Joi.string().valid('file').required()
      })
    ).required()
  }).required(),
  meta: Joi.object({
    total_mappings: Joi.number().integer().min(0).required(),
    active_mappings: Joi.number().integer().min(0).required(),
    last_sync: commonFields.timestamp.allow(null)
  }).optional()
});

module.exports = {
  commonFields,
  baseResponseSchema,
  errorResponseSchema,
  productSchema,
  categorySchema,
  orderSchema,
  userSchema,
  storeSchema,
  akeneoMappingSchema,
  akeneoCustomMappingSchema,
  
  // Helper functions
  createListResponse: (itemSchema) => Joi.object({
    success: Joi.boolean().valid(true).required(),
    data: Joi.array().items(itemSchema).required(),
    meta: Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).optional(),
      total: Joi.number().integer().min(0).required(),
      pages: Joi.number().integer().min(0).optional()
    }).optional()
  }),
  
  createSingleResponse: (itemSchema) => Joi.object({
    success: Joi.boolean().valid(true).required(),
    data: itemSchema.required()
  })
};