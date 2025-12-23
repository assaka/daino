# AI Shopping Ready Products - Comprehensive Implementation Plan

> **Purpose:** Make all products discoverable and optimized for AI shopping assistants (Google Shopping/Gemini, Microsoft Copilot/Bing, ChatGPT/OpenAI plugins, and other AI agents)

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Database Schema Changes](#1-database-schema-changes)
3. [Product Feed Generation System](#2-product-feed-generation-system)
4. [Enhanced Schema.org Markup](#3-enhanced-schemaorg-markup)
5. [AI Agent API Endpoint](#4-ai-agent-api-endpoint)
6. [Admin UI for Product Enrichment](#5-admin-ui-for-product-enrichment)
7. [Implementation Phases](#implementation-phases)
8. [Files Reference](#files-reference)

---

## Executive Summary

This plan details how to make products "AI shopping ready" for the Catalyst e-commerce platform. The implementation covers:

- **Product Feeds** for Google Merchant Center, Microsoft Merchant Center, ChatGPT/OpenAI
- **Enhanced Schema.org Markup** with GTIN, MPN, brand, dimensions, shipping, and reviews
- **AI Agent API** optimized for conversational commerce
- **Admin UI** for manual product data enrichment with quality scoring

### Current State
- Products have basic fields: name, description, price, images, SKU, barcode, weight, dimensions
- Schema.org Product JSON-LD exists with: name, description, image, sku, brand, offers
- No GTIN/UPC/EAN identifiers stored
- No dedicated feeds for AI shopping platforms

---

## 1. Database Schema Changes

### 1.1 New Product Fields

Add the following columns to the `products` table:

```sql
-- Core AI Shopping Identifiers
ALTER TABLE products ADD COLUMN IF NOT EXISTS gtin VARCHAR(14);
ALTER TABLE products ADD COLUMN IF NOT EXISTS mpn VARCHAR(70);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(255);

-- Extended Product Data (JSONB for flexibility)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_identifiers JSONB DEFAULT '{}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_shopping_data JSONB DEFAULT '{}'::jsonb;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_gtin ON products(gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_mpn ON products(mpn) WHERE mpn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_ai_shopping_data ON products USING gin(ai_shopping_data);
```

### 1.2 JSONB Field Structures

**product_identifiers:**
```json
{
  "upc": "012345678901",
  "ean": "0012345678905",
  "isbn": "978-3-16-148410-0",
  "manufacturer": "ACME Corporation",
  "condition": "new",          // new, refurbished, used
  "age_group": "adult",        // newborn, infant, toddler, kids, adult
  "gender": "unisex",          // male, female, unisex
  "color": "Black",
  "size": "Medium",
  "material": "Cotton"
}
```

**ai_shopping_data:**
```json
{
  "google_category_id": "5322",
  "shipping": {
    "weight": 0.5,
    "weight_unit": "kg",
    "dimensions": {
      "length": 20,
      "width": 15,
      "height": 5,
      "unit": "cm"
    },
    "class": "standard",
    "rate": 5.99
  },
  "custom_labels": ["bestseller", "summer-2025"],
  "product_highlights": [
    "Premium quality materials",
    "30-day money back guarantee"
  ],
  "data_completeness_score": 85,
  "availability_date": "2025-01-15",
  "expiration_date": null
}
```

### 1.3 Sequelize Model Update

**File:** `backend/src/models/Product.js`

```javascript
// Add after existing barcode field (around line 34)
gtin: {
  type: DataTypes.STRING(14),
  allowNull: true,
  validate: {
    is: /^(\d{8}|\d{12}|\d{13}|\d{14})?$/  // Valid GTIN formats or empty
  }
},
mpn: {
  type: DataTypes.STRING(70),
  allowNull: true
},
brand: {
  type: DataTypes.STRING(255),
  allowNull: true
},
product_identifiers: {
  type: DataTypes.JSON,
  defaultValue: {},
  comment: 'Extended identifiers: upc, ean, isbn, manufacturer, condition, age_group, gender, color, size, material'
},
ai_shopping_data: {
  type: DataTypes.JSON,
  defaultValue: {},
  comment: 'AI shopping metadata: google_category_id, shipping, custom_labels, product_highlights, data_completeness_score'
}
```

---

## 2. Product Feed Generation System

### 2.1 Feed Generator Service

**New File:** `backend/src/services/ai-shopping-feed-generator.js`

```javascript
const xml2js = require('xml2js');

class AIShoppingFeedGenerator {
  constructor(storeId, baseUrl, currency = 'USD') {
    this.storeId = storeId;
    this.baseUrl = baseUrl;
    this.currency = currency;
  }

  /**
   * Generate Google Merchant Center RSS 2.0 feed
   */
  async generateGoogleFeed(products, options = {}) {
    const items = products.map(product => this.formatGoogleItem(product));

    const feed = {
      rss: {
        $: {
          version: '2.0',
          'xmlns:g': 'http://base.google.com/ns/1.0'
        },
        channel: {
          title: options.storeName || 'Product Feed',
          link: this.baseUrl,
          description: options.description || 'Product catalog',
          item: items
        }
      }
    };

    const builder = new xml2js.Builder();
    return builder.buildObject(feed);
  }

  formatGoogleItem(product) {
    const availability = this.getAvailability(product);
    const primaryImage = this.getPrimaryImage(product);

    return {
      'g:id': product.sku,
      'g:title': product.name,
      'g:description': this.sanitizeDescription(product.description || product.short_description),
      'g:link': `${this.baseUrl}/product/${product.slug}`,
      'g:image_link': primaryImage,
      'g:additional_image_link': this.getAdditionalImages(product),
      'g:price': `${product.price} ${this.currency}`,
      ...(product.compare_price && { 'g:sale_price': `${product.price} ${this.currency}` }),
      'g:availability': availability,
      'g:condition': product.product_identifiers?.condition || 'new',
      ...(product.gtin && { 'g:gtin': product.gtin }),
      ...(product.mpn && { 'g:mpn': product.mpn }),
      ...(product.brand && { 'g:brand': product.brand }),
      ...(product.ai_shopping_data?.google_category_id && {
        'g:google_product_category': product.ai_shopping_data.google_category_id
      }),
      ...(product.product_identifiers?.color && { 'g:color': product.product_identifiers.color }),
      ...(product.product_identifiers?.size && { 'g:size': product.product_identifiers.size }),
      ...(product.product_identifiers?.gender && { 'g:gender': product.product_identifiers.gender }),
      ...(product.product_identifiers?.age_group && { 'g:age_group': product.product_identifiers.age_group }),
      ...(product.weight && { 'g:shipping_weight': `${product.weight} kg` })
    };
  }

  /**
   * Generate Microsoft/Bing Merchant Center feed (similar to Google)
   */
  async generateMicrosoftFeed(products, options = {}) {
    // Microsoft uses same format as Google with minor differences
    return this.generateGoogleFeed(products, options);
  }

  /**
   * Generate ChatGPT/OpenAI plugin compatible JSON feed
   */
  async generateChatGPTFeed(products, store, options = {}) {
    return {
      feed_version: '1.0',
      format: 'chatgpt-shopping',
      store: {
        name: store.name,
        url: this.baseUrl,
        currency: this.currency,
        return_policy: store.settings?.return_policy || '30-day returns',
        shipping_info: store.settings?.shipping_info || 'Standard shipping available'
      },
      products: products.map(product => this.formatChatGPTProduct(product)),
      generated_at: new Date().toISOString(),
      total_products: products.length
    };
  }

  formatChatGPTProduct(product) {
    return {
      id: product.id,
      name: product.name,

      // Natural language description for AI to speak/summarize
      natural_description: this.generateNaturalDescription(product),

      // Structured description
      description: product.description,
      short_description: product.short_description,

      // Key selling points
      highlights: product.ai_shopping_data?.product_highlights || [],

      // Pricing with context
      pricing: {
        current_price: parseFloat(product.price),
        original_price: product.compare_price ? parseFloat(product.compare_price) : null,
        currency: this.currency,
        formatted_current: this.formatPrice(product.price),
        formatted_original: product.compare_price ? this.formatPrice(product.compare_price) : null,
        discount_percentage: this.calculateDiscount(product),
        price_context: this.getPriceContext(product)
      },

      // Availability
      availability: {
        status: this.getAvailabilityStatus(product),
        quantity: product.stock_quantity,
        message: this.getAvailabilityMessage(product),
        low_stock_warning: product.stock_quantity <= (product.low_stock_threshold || 5)
      },

      // Identifiers
      identifiers: {
        sku: product.sku,
        gtin: product.gtin,
        mpn: product.mpn,
        barcode: product.barcode
      },

      brand: product.brand,

      // Category
      category: {
        ids: product.category_ids,
        path: product.category_path  // Populated by API
      },

      // Specifications
      specifications: this.formatSpecifications(product),

      // URLs
      url: `${this.baseUrl}/product/${product.slug}`,
      images: this.formatImages(product),

      // Shipping
      shipping: {
        weight: product.weight ? `${product.weight} kg` : null,
        dimensions: this.formatDimensions(product.dimensions),
        class: product.ai_shopping_data?.shipping?.class
      }
    };
  }

  /**
   * Generate Universal AI-compatible feed (Schema.org based)
   */
  async generateUniversalFeed(products, store, options = {}) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${store.name} Product Catalog`,
      description: `Products from ${store.name}`,
      url: this.baseUrl,
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: this.formatSchemaProduct(product)
      })),
      dateModified: new Date().toISOString()
    };
  }

  formatSchemaProduct(product) {
    return {
      '@type': 'Product',
      '@id': `${this.baseUrl}/product/${product.slug}`,
      identifier: product.id,
      sku: product.sku,
      ...(product.gtin && { gtin: product.gtin }),
      ...(product.mpn && { mpn: product.mpn }),
      name: product.name,
      description: product.description,
      image: this.formatImages(product).map(img => img.url),
      ...(product.brand && {
        brand: {
          '@type': 'Brand',
          name: product.brand
        }
      }),
      offers: {
        '@type': 'Offer',
        url: `${this.baseUrl}/product/${product.slug}`,
        price: parseFloat(product.price),
        priceCurrency: this.currency,
        availability: `https://schema.org/${this.getSchemaAvailability(product)}`,
        itemCondition: `https://schema.org/${this.getSchemaCondition(product)}`
      },
      ...(product.weight && {
        weight: {
          '@type': 'QuantitativeValue',
          value: parseFloat(product.weight),
          unitCode: 'KGM'
        }
      }),
      ...(product.product_identifiers?.color && { color: product.product_identifiers.color }),
      ...(product.product_identifiers?.material && { material: product.product_identifiers.material })
    };
  }

  // Helper methods
  generateNaturalDescription(product) {
    const parts = [];

    if (product.brand) {
      parts.push(`The ${product.brand} ${product.name}`);
    } else {
      parts.push(`This ${product.name}`);
    }

    if (product.short_description) {
      parts.push(product.short_description);
    }

    if (product.ai_shopping_data?.product_highlights?.length) {
      parts.push(`Key features include: ${product.ai_shopping_data.product_highlights.join(', ')}.`);
    }

    const discount = this.calculateDiscount(product);
    if (discount > 0) {
      parts.push(`Currently ${discount}% off at ${this.formatPrice(product.price)}.`);
    } else {
      parts.push(`Priced at ${this.formatPrice(product.price)}.`);
    }

    return parts.join(' ');
  }

  getAvailability(product) {
    if (product.infinite_stock || product.stock_quantity > 0) return 'in_stock';
    if (product.allow_backorders) return 'backorder';
    return 'out_of_stock';
  }

  getAvailabilityStatus(product) {
    if (product.infinite_stock || product.stock_quantity > 0) return 'in_stock';
    if (product.allow_backorders) return 'backorder';
    return 'out_of_stock';
  }

  getAvailabilityMessage(product) {
    if (product.infinite_stock) return 'In stock and ready to ship';
    if (product.stock_quantity > 10) return 'In stock and ready to ship';
    if (product.stock_quantity > 0) return `Only ${product.stock_quantity} left in stock`;
    if (product.allow_backorders) return 'Available for backorder';
    return 'Out of stock';
  }

  getSchemaAvailability(product) {
    if (product.infinite_stock || product.stock_quantity > 0) return 'InStock';
    if (product.allow_backorders) return 'BackOrder';
    return 'OutOfStock';
  }

  getSchemaCondition(product) {
    const condition = product.product_identifiers?.condition || 'new';
    const map = {
      'new': 'NewCondition',
      'refurbished': 'RefurbishedCondition',
      'used': 'UsedCondition'
    };
    return map[condition] || 'NewCondition';
  }

  getPrimaryImage(product) {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images[0].url || product.images[0];
    }
    return `${this.baseUrl}/placeholder-product.jpg`;
  }

  getAdditionalImages(product) {
    if (Array.isArray(product.images) && product.images.length > 1) {
      return product.images.slice(1, 10).map(img => img.url || img);
    }
    return [];
  }

  formatImages(product) {
    if (!Array.isArray(product.images)) return [];
    return product.images.map((img, index) => ({
      url: img.url || img,
      alt: img.alt || `${product.name} image ${index + 1}`
    }));
  }

  formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency
    }).format(price);
  }

  calculateDiscount(product) {
    if (!product.compare_price || product.compare_price <= product.price) return 0;
    return Math.round((1 - product.price / product.compare_price) * 100);
  }

  getPriceContext(product) {
    const discount = this.calculateDiscount(product);
    if (discount > 0) {
      const savings = product.compare_price - product.price;
      return `Currently ${discount}% off, save ${this.formatPrice(savings)}`;
    }
    return 'Regular price';
  }

  formatSpecifications(product) {
    const specs = [];

    if (product.product_identifiers?.color) {
      specs.push({ name: 'Color', value: product.product_identifiers.color });
    }
    if (product.product_identifiers?.size) {
      specs.push({ name: 'Size', value: product.product_identifiers.size });
    }
    if (product.product_identifiers?.material) {
      specs.push({ name: 'Material', value: product.product_identifiers.material });
    }
    if (product.weight) {
      specs.push({ name: 'Weight', value: `${product.weight} kg` });
    }

    // Add product attributes if available
    if (Array.isArray(product.attributes)) {
      product.attributes.forEach(attr => {
        specs.push({ name: attr.label || attr.code, value: attr.value });
      });
    }

    return specs;
  }

  formatDimensions(dimensions) {
    if (!dimensions) return null;
    const parts = [];
    if (dimensions.length) parts.push(`${dimensions.length}`);
    if (dimensions.width) parts.push(`${dimensions.width}`);
    if (dimensions.height) parts.push(`${dimensions.height}`);
    if (parts.length === 0) return null;
    return `${parts.join(' x ')} ${dimensions.unit || 'cm'}`;
  }

  sanitizeDescription(text) {
    if (!text) return '';
    // Remove HTML tags and limit length
    return text.replace(/<[^>]*>/g, '').substring(0, 5000);
  }
}

module.exports = AIShoppingFeedGenerator;
```

### 2.2 Feed API Routes

**New File:** `backend/src/routes/ai-shopping-feeds.js`

```javascript
const express = require('express');
const router = express.Router();
const AIShoppingFeedGenerator = require('../services/ai-shopping-feed-generator');
const { getConnection } = require('../database/connectionManager');
const redis = require('../config/redis');

const CACHE_TTL = 3600; // 1 hour

// Middleware to get store and tenant connection
const withStoreContext = async (req, res, next) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    req.storeId = storeId;
    req.tenantDb = await getConnection(storeId);

    // Get store info
    const store = await req.tenantDb('stores').where('id', storeId).first();
    req.store = store;
    req.baseUrl = store?.domain || `https://${store?.subdomain}.catalyst.com`;

    next();
  } catch (error) {
    console.error('Feed context error:', error);
    res.status(500).json({ error: 'Failed to establish store context' });
  }
};

// Get products for feed
const getProductsForFeed = async (tenantDb, storeId) => {
  return tenantDb('products')
    .leftJoin('product_translations', function() {
      this.on('products.id', '=', 'product_translations.product_id')
          .andOn('product_translations.language_code', '=', tenantDb.raw('?', ['en']));
    })
    .where('products.store_id', storeId)
    .where('products.status', 'active')
    .where('products.visibility', 'visible')
    .select(
      'products.*',
      'product_translations.name',
      'product_translations.description',
      'product_translations.short_description'
    );
};

// Google Merchant Center Feed
router.get('/google-merchant', withStoreContext, async (req, res) => {
  try {
    const cacheKey = `feed:google:${req.storeId}`;

    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.set('Content-Type', 'application/xml');
      return res.send(cached);
    }

    const products = await getProductsForFeed(req.tenantDb, req.storeId);
    const generator = new AIShoppingFeedGenerator(req.storeId, req.baseUrl, req.store?.currency || 'USD');
    const xml = await generator.generateGoogleFeed(products, { storeName: req.store?.name });

    // Cache result
    await redis.setex(cacheKey, CACHE_TTL, xml);

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Google feed error:', error);
    res.status(500).json({ error: 'Failed to generate Google feed' });
  }
});

// Microsoft Merchant Center Feed
router.get('/microsoft-merchant', withStoreContext, async (req, res) => {
  try {
    const cacheKey = `feed:microsoft:${req.storeId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      res.set('Content-Type', 'application/xml');
      return res.send(cached);
    }

    const products = await getProductsForFeed(req.tenantDb, req.storeId);
    const generator = new AIShoppingFeedGenerator(req.storeId, req.baseUrl, req.store?.currency || 'USD');
    const xml = await generator.generateMicrosoftFeed(products, { storeName: req.store?.name });

    await redis.setex(cacheKey, CACHE_TTL, xml);

    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Microsoft feed error:', error);
    res.status(500).json({ error: 'Failed to generate Microsoft feed' });
  }
});

// ChatGPT/OpenAI Compatible Feed
router.get('/chatgpt', withStoreContext, async (req, res) => {
  try {
    const cacheKey = `feed:chatgpt:${req.storeId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const products = await getProductsForFeed(req.tenantDb, req.storeId);
    const generator = new AIShoppingFeedGenerator(req.storeId, req.baseUrl, req.store?.currency || 'USD');
    const feed = await generator.generateChatGPTFeed(products, req.store);

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(feed));

    res.json(feed);
  } catch (error) {
    console.error('ChatGPT feed error:', error);
    res.status(500).json({ error: 'Failed to generate ChatGPT feed' });
  }
});

// Universal AI Feed (Schema.org based)
router.get('/universal', withStoreContext, async (req, res) => {
  try {
    const cacheKey = `feed:universal:${req.storeId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const products = await getProductsForFeed(req.tenantDb, req.storeId);
    const generator = new AIShoppingFeedGenerator(req.storeId, req.baseUrl, req.store?.currency || 'USD');
    const feed = await generator.generateUniversalFeed(products, req.store);

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(feed));

    res.json(feed);
  } catch (error) {
    console.error('Universal feed error:', error);
    res.status(500).json({ error: 'Failed to generate universal feed' });
  }
});

// Invalidate feed cache (admin endpoint)
router.post('/invalidate-cache', withStoreContext, async (req, res) => {
  try {
    const patterns = [
      `feed:google:${req.storeId}`,
      `feed:microsoft:${req.storeId}`,
      `feed:chatgpt:${req.storeId}`,
      `feed:universal:${req.storeId}`
    ];

    await Promise.all(patterns.map(key => redis.del(key)));

    res.json({ success: true, message: 'Feed cache invalidated' });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

module.exports = router;
```

---

## 3. Enhanced Schema.org Markup

### 3.1 SeoHeadManager Updates

**File:** `src/components/storefront/SeoHeadManager.jsx`

Update the Product structured data generation (around lines 690-747) to include enhanced fields:

```jsx
// Enhanced Product Schema.org structured data
const generateProductSchema = (pageData, store, seoSettings) => {
  const actualPrice = parseFloat(pageData.price) || 0;
  const comparePrice = pageData.compare_price ? parseFloat(pageData.compare_price) : null;

  // Determine GTIN type based on length
  const gtinFields = {};
  if (pageData.gtin) {
    gtinFields.gtin = pageData.gtin;
    switch (pageData.gtin.length) {
      case 8: gtinFields.gtin8 = pageData.gtin; break;
      case 12: gtinFields.gtin12 = pageData.gtin; break;
      case 13: gtinFields.gtin13 = pageData.gtin; break;
      case 14: gtinFields.gtin14 = pageData.gtin; break;
    }
  }

  // Get product images as array
  const images = Array.isArray(pageData.images)
    ? pageData.images.map(img => img.url || img)
    : [];

  // Build the schema
  const schema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": pageData.name,
    "description": pageData.description || pageData.short_description || '',
    "image": images,
    "sku": pageData.sku,

    // Product Identifiers
    ...gtinFields,
    ...(pageData.mpn && { "mpn": pageData.mpn }),

    // Brand
    "brand": {
      "@type": "Brand",
      "name": pageData.brand ||
              seoSettings?.schema_settings?.organization_name ||
              store?.name || "Store"
    },

    // Manufacturer (if different from brand)
    ...(pageData.product_identifiers?.manufacturer && {
      "manufacturer": {
        "@type": "Organization",
        "name": pageData.product_identifiers.manufacturer
      }
    }),

    // Physical Properties
    ...(pageData.weight && {
      "weight": {
        "@type": "QuantitativeValue",
        "value": parseFloat(pageData.weight),
        "unitCode": "KGM"
      }
    }),

    // Dimensions
    ...(pageData.dimensions?.length && {
      "depth": {
        "@type": "QuantitativeValue",
        "value": parseFloat(pageData.dimensions.length),
        "unitCode": "CMT"
      }
    }),
    ...(pageData.dimensions?.width && {
      "width": {
        "@type": "QuantitativeValue",
        "value": parseFloat(pageData.dimensions.width),
        "unitCode": "CMT"
      }
    }),
    ...(pageData.dimensions?.height && {
      "height": {
        "@type": "QuantitativeValue",
        "value": parseFloat(pageData.dimensions.height),
        "unitCode": "CMT"
      }
    }),

    // Product Attributes
    ...(pageData.product_identifiers?.color && { "color": pageData.product_identifiers.color }),
    ...(pageData.product_identifiers?.size && { "size": pageData.product_identifiers.size }),
    ...(pageData.product_identifiers?.material && { "material": pageData.product_identifiers.material }),

    // Offers
    "offers": {
      "@type": "Offer",
      "url": window.location.href,
      "priceCurrency": store?.currency || "USD",
      "price": actualPrice,
      "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],

      // Availability
      "availability": (pageData.stock_quantity > 0 || pageData.infinite_stock)
        ? "https://schema.org/InStock"
        : pageData.allow_backorders
          ? "https://schema.org/BackOrder"
          : "https://schema.org/OutOfStock",

      // Condition
      "itemCondition": `https://schema.org/${
        pageData.product_identifiers?.condition === 'used' ? 'UsedCondition' :
        pageData.product_identifiers?.condition === 'refurbished' ? 'RefurbishedCondition' :
        'NewCondition'
      }`,

      // Seller
      "seller": {
        "@type": "Organization",
        "name": store?.name
      },

      // Shipping Details
      ...(pageData.ai_shopping_data?.shipping && {
        "shippingDetails": {
          "@type": "OfferShippingDetails",
          "shippingRate": {
            "@type": "MonetaryAmount",
            "value": pageData.ai_shopping_data.shipping.rate || 0,
            "currency": store?.currency || "USD"
          },
          "deliveryTime": {
            "@type": "ShippingDeliveryTime",
            "handlingTime": {
              "@type": "QuantitativeValue",
              "minValue": 0,
              "maxValue": 2,
              "unitCode": "d"
            },
            "transitTime": {
              "@type": "QuantitativeValue",
              "minValue": 3,
              "maxValue": 7,
              "unitCode": "d"
            }
          }
        }
      })
    },

    // Aggregate Rating (if reviews exist)
    ...(pageData.reviews_count > 0 && pageData.average_rating && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": pageData.average_rating,
        "reviewCount": pageData.reviews_count,
        "bestRating": 5,
        "worstRating": 1
      }
    }),

    // Additional Properties from attributes
    ...(pageData.attributes?.length > 0 && {
      "additionalProperty": pageData.attributes
        .filter(attr => attr.value)
        .map(attr => ({
          "@type": "PropertyValue",
          "name": attr.label || attr.code,
          "value": String(attr.value)
        }))
    })
  };

  return schema;
};
```

---

## 4. AI Agent API Endpoint

### 4.1 AI Agent API Routes

**New File:** `backend/src/routes/ai-agent-api.js`

```javascript
const express = require('express');
const router = express.Router();
const { getConnection } = require('../database/connectionManager');
const rateLimit = require('express-rate-limit');

// Rate limiting for AI agent API
const aiAgentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please slow down' }
});

router.use(aiAgentLimiter);

// Middleware for store context
const withStoreContext = async (req, res, next) => {
  try {
    const storeId = req.headers['x-store-id'] || req.query.store_id;
    if (!storeId) {
      return res.status(400).json({ error: 'Store ID required' });
    }

    req.storeId = storeId;
    req.tenantDb = await getConnection(storeId);

    const store = await req.tenantDb('stores').where('id', storeId).first();
    req.store = store;
    req.baseUrl = store?.domain || `https://${store?.subdomain}.catalyst.com`;
    req.currency = store?.currency || 'USD';

    next();
  } catch (error) {
    console.error('AI Agent API context error:', error);
    res.status(500).json({ error: 'Failed to establish store context' });
  }
};

/**
 * GET /api/ai-agent/products
 * List products with AI-friendly responses
 */
router.get('/products', withStoreContext, async (req, res) => {
  try {
    const {
      search,
      category,
      brand,
      min_price,
      max_price,
      in_stock,
      limit = 20,
      page = 1
    } = req.query;

    let query = req.tenantDb('products')
      .leftJoin('product_translations', function() {
        this.on('products.id', '=', 'product_translations.product_id')
            .andOn('product_translations.language_code', '=', req.tenantDb.raw('?', ['en']));
      })
      .where('products.store_id', req.storeId)
      .where('products.status', 'active')
      .where('products.visibility', 'visible');

    // Apply filters
    if (search) {
      query = query.where(function() {
        this.whereILike('product_translations.name', `%${search}%`)
            .orWhereILike('product_translations.description', `%${search}%`)
            .orWhereILike('products.sku', `%${search}%`);
      });
    }

    if (category) {
      query = query.whereRaw('products.category_ids @> ?', [JSON.stringify([category])]);
    }

    if (brand) {
      query = query.whereILike('products.brand', `%${brand}%`);
    }

    if (min_price) {
      query = query.where('products.price', '>=', parseFloat(min_price));
    }

    if (max_price) {
      query = query.where('products.price', '<=', parseFloat(max_price));
    }

    if (in_stock === 'true') {
      query = query.where(function() {
        this.where('products.infinite_stock', true)
            .orWhere('products.stock_quantity', '>', 0);
      });
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const products = await query
      .select(
        'products.*',
        'product_translations.name',
        'product_translations.description',
        'product_translations.short_description'
      )
      .limit(parseInt(limit))
      .offset(offset);

    // Format for AI consumption
    const formattedProducts = products.map(product => formatProductForAI(product, req.baseUrl, req.currency));

    res.json({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: products.length
        }
      },
      meta: {
        response_format: 'ai-agent-v1',
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('AI Agent products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/ai-agent/products/:id
 * Get single product with full AI context
 */
router.get('/products/:id', withStoreContext, async (req, res) => {
  try {
    const { id } = req.params;

    const product = await req.tenantDb('products')
      .leftJoin('product_translations', function() {
        this.on('products.id', '=', 'product_translations.product_id')
            .andOn('product_translations.language_code', '=', req.tenantDb.raw('?', ['en']));
      })
      .where('products.id', id)
      .orWhere('products.slug', id)
      .orWhere('products.sku', id)
      .where('products.store_id', req.storeId)
      .select(
        'products.*',
        'product_translations.name',
        'product_translations.description',
        'product_translations.short_description'
      )
      .first();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get product attributes
    const attributes = await req.tenantDb('product_attribute_values')
      .join('attributes', 'product_attribute_values.attribute_id', 'attributes.id')
      .where('product_attribute_values.product_id', product.id)
      .select('attributes.code', 'attributes.label', 'product_attribute_values.*');

    // Get related products
    const relatedIds = product.related_product_ids || [];
    let relatedProducts = [];
    if (relatedIds.length > 0) {
      relatedProducts = await req.tenantDb('products')
        .leftJoin('product_translations', function() {
          this.on('products.id', '=', 'product_translations.product_id')
              .andOn('product_translations.language_code', '=', req.tenantDb.raw('?', ['en']));
        })
        .whereIn('products.id', relatedIds.slice(0, 5))
        .where('products.status', 'active')
        .select('products.id', 'products.slug', 'products.price', 'products.images', 'product_translations.name');
    }

    const formattedProduct = formatProductForAI(product, req.baseUrl, req.currency, {
      attributes,
      relatedProducts
    });

    res.json({
      success: true,
      data: {
        product: formattedProduct,
        store: {
          name: req.store?.name,
          return_policy: req.store?.settings?.return_policy || '30-day hassle-free returns',
          warranty: req.store?.settings?.warranty || 'Standard manufacturer warranty'
        }
      },
      meta: {
        response_format: 'ai-agent-v1',
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('AI Agent product detail error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

/**
 * GET /api/ai-agent/products/search
 * Natural language product search
 */
router.get('/products/search', withStoreContext, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Parse natural language query
    const searchTerms = parseNaturalLanguageQuery(q);

    let query = req.tenantDb('products')
      .leftJoin('product_translations', function() {
        this.on('products.id', '=', 'product_translations.product_id')
            .andOn('product_translations.language_code', '=', req.tenantDb.raw('?', ['en']));
      })
      .where('products.store_id', req.storeId)
      .where('products.status', 'active');

    // Apply parsed filters
    if (searchTerms.keywords.length > 0) {
      query = query.where(function() {
        searchTerms.keywords.forEach(keyword => {
          this.orWhereILike('product_translations.name', `%${keyword}%`)
              .orWhereILike('product_translations.description', `%${keyword}%`);
        });
      });
    }

    if (searchTerms.maxPrice) {
      query = query.where('products.price', '<=', searchTerms.maxPrice);
    }

    if (searchTerms.color) {
      query = query.whereRaw("products.product_identifiers->>'color' ILIKE ?", [`%${searchTerms.color}%`]);
    }

    const products = await query
      .select(
        'products.*',
        'product_translations.name',
        'product_translations.description',
        'product_translations.short_description'
      )
      .limit(parseInt(limit));

    const formattedProducts = products.map(product => formatProductForAI(product, req.baseUrl, req.currency));

    res.json({
      success: true,
      data: {
        query: q,
        interpreted_as: searchTerms,
        products: formattedProducts,
        result_count: formattedProducts.length
      },
      meta: {
        response_format: 'ai-agent-v1',
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('AI Agent search error:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

/**
 * GET /api/ai-agent/categories
 * Get category tree for AI navigation
 */
router.get('/categories', withStoreContext, async (req, res) => {
  try {
    const categories = await req.tenantDb('categories')
      .leftJoin('category_translations', function() {
        this.on('categories.id', '=', 'category_translations.category_id')
            .andOn('category_translations.language_code', '=', req.tenantDb.raw('?', ['en']));
      })
      .where('categories.store_id', req.storeId)
      .where('categories.status', 'active')
      .select(
        'categories.id',
        'categories.slug',
        'categories.parent_id',
        'category_translations.name',
        'category_translations.description'
      )
      .orderBy('categories.sort_order');

    // Build tree structure
    const categoryTree = buildCategoryTree(categories);

    res.json({
      success: true,
      data: {
        categories: categoryTree,
        flat_list: categories.map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          url: `${req.baseUrl}/category/${c.slug}`
        }))
      }
    });
  } catch (error) {
    console.error('AI Agent categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/ai-agent/store-info
 * Get store information for AI context
 */
router.get('/store-info', withStoreContext, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        store: {
          name: req.store?.name,
          url: req.baseUrl,
          currency: req.currency,
          description: req.store?.description
        },
        policies: {
          return_policy: req.store?.settings?.return_policy || '30-day returns accepted',
          shipping_policy: req.store?.settings?.shipping_policy || 'Standard shipping available',
          warranty: req.store?.settings?.warranty || 'Manufacturer warranty applies'
        },
        contact: {
          email: req.store?.email,
          phone: req.store?.phone
        },
        capabilities: {
          search: true,
          filtering: true,
          product_details: true,
          related_products: true,
          categories: true
        }
      }
    });
  } catch (error) {
    console.error('AI Agent store info error:', error);
    res.status(500).json({ error: 'Failed to fetch store info' });
  }
});

// Helper Functions

function formatProductForAI(product, baseUrl, currency, extras = {}) {
  const discount = product.compare_price && product.compare_price > product.price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : 0;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(price);
  };

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,

    // AI-friendly summary
    ai_summary: generateAISummary(product, discount, formatPrice),

    // Descriptions
    description: product.description,
    short_description: product.short_description,

    // Highlights
    highlights: product.ai_shopping_data?.product_highlights || [],

    // Pricing
    pricing: {
      current_price: parseFloat(product.price),
      original_price: product.compare_price ? parseFloat(product.compare_price) : null,
      currency: currency,
      formatted_current: formatPrice(product.price),
      formatted_original: product.compare_price ? formatPrice(product.compare_price) : null,
      discount_percentage: discount,
      price_context: discount > 0
        ? `Currently ${discount}% off, save ${formatPrice(product.compare_price - product.price)}`
        : 'Regular price'
    },

    // Availability
    availability: {
      status: product.infinite_stock || product.stock_quantity > 0 ? 'in_stock' : 'out_of_stock',
      quantity: product.stock_quantity,
      message: getAvailabilityMessage(product),
      low_stock_warning: product.stock_quantity > 0 && product.stock_quantity <= (product.low_stock_threshold || 5)
    },

    // Identifiers
    identifiers: {
      sku: product.sku,
      gtin: product.gtin,
      mpn: product.mpn,
      barcode: product.barcode
    },

    brand: product.brand,

    // Specifications
    specifications: formatSpecifications(product, extras.attributes),

    // URLs
    urls: {
      product_page: `${baseUrl}/product/${product.slug}`,
      add_to_cart: `${baseUrl}/cart/add/${product.id}`,
      images: formatImages(product.images)
    },

    // Shipping
    shipping: {
      weight: product.weight ? `${product.weight} kg` : null,
      dimensions: formatDimensions(product.dimensions)
    },

    // Related products
    ...(extras.relatedProducts && {
      related_products: extras.relatedProducts.map(rp => ({
        id: rp.id,
        name: rp.name,
        price: formatPrice(rp.price),
        url: `${baseUrl}/product/${rp.slug}`
      }))
    })
  };
}

function generateAISummary(product, discount, formatPrice) {
  const parts = [];

  if (product.brand) {
    parts.push(`The ${product.brand} ${product.name}`);
  } else {
    parts.push(`This ${product.name}`);
  }

  if (product.short_description) {
    parts.push(product.short_description.substring(0, 150));
  }

  if (discount > 0) {
    parts.push(`Currently ${discount}% off at ${formatPrice(product.price)}.`);
  } else {
    parts.push(`Priced at ${formatPrice(product.price)}.`);
  }

  if (product.infinite_stock || product.stock_quantity > 10) {
    parts.push('In stock and ready to ship.');
  } else if (product.stock_quantity > 0) {
    parts.push(`Only ${product.stock_quantity} left in stock.`);
  }

  return parts.join(' ');
}

function getAvailabilityMessage(product) {
  if (product.infinite_stock) return 'In stock and ready to ship';
  if (product.stock_quantity > 10) return 'In stock and ready to ship';
  if (product.stock_quantity > 0) return `Only ${product.stock_quantity} left in stock`;
  if (product.allow_backorders) return 'Available for backorder';
  return 'Out of stock';
}

function formatSpecifications(product, attributes = []) {
  const specs = [];

  if (product.product_identifiers?.color) {
    specs.push({ name: 'Color', value: product.product_identifiers.color });
  }
  if (product.product_identifiers?.size) {
    specs.push({ name: 'Size', value: product.product_identifiers.size });
  }
  if (product.product_identifiers?.material) {
    specs.push({ name: 'Material', value: product.product_identifiers.material });
  }
  if (product.weight) {
    specs.push({ name: 'Weight', value: `${product.weight} kg` });
  }

  // Add fetched attributes
  attributes.forEach(attr => {
    const value = attr.text_value || attr.number_value || attr.boolean_value;
    if (value) {
      specs.push({ name: attr.label || attr.code, value: String(value) });
    }
  });

  return specs;
}

function formatImages(images) {
  if (!Array.isArray(images)) return [];
  return images.map((img, index) => ({
    url: img.url || img,
    alt: img.alt || `Product image ${index + 1}`
  }));
}

function formatDimensions(dimensions) {
  if (!dimensions) return null;
  const parts = [];
  if (dimensions.length) parts.push(dimensions.length);
  if (dimensions.width) parts.push(dimensions.width);
  if (dimensions.height) parts.push(dimensions.height);
  if (parts.length === 0) return null;
  return `${parts.join(' x ')} ${dimensions.unit || 'cm'}`;
}

function parseNaturalLanguageQuery(query) {
  const result = {
    keywords: [],
    maxPrice: null,
    color: null,
    category: null
  };

  // Extract price constraints
  const priceMatch = query.match(/under\s*\$?(\d+)/i) || query.match(/less\s*than\s*\$?(\d+)/i);
  if (priceMatch) {
    result.maxPrice = parseInt(priceMatch[1]);
  }

  // Extract color
  const colors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'purple', 'pink', 'orange', 'brown', 'gray', 'grey'];
  colors.forEach(color => {
    if (query.toLowerCase().includes(color)) {
      result.color = color;
    }
  });

  // Extract keywords (remove price and color terms)
  let cleanQuery = query
    .replace(/under\s*\$?\d+/gi, '')
    .replace(/less\s*than\s*\$?\d+/gi, '')
    .replace(new RegExp(colors.join('|'), 'gi'), '')
    .trim();

  result.keywords = cleanQuery.split(/\s+/).filter(word => word.length > 2);

  return result;
}

function buildCategoryTree(categories, parentId = null) {
  return categories
    .filter(cat => cat.parent_id === parentId)
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      children: buildCategoryTree(categories, cat.id)
    }));
}

module.exports = router;
```

---

## 5. Admin UI for Product Enrichment

### 5.1 ProductForm Enhancement

**File:** `src/components/admin/products/ProductForm.jsx`

Add a new accordion section after existing product sections:

```jsx
import { Sparkles, CheckCircle, AlertCircle, Lightbulb, Info } from 'lucide-react';

// Add these helper functions
const calculateDataCompleteness = (product) => {
  const weights = {
    name: 10,
    description: 15,
    short_description: 5,
    price: 10,
    images: 15,
    sku: 5,
    gtin: 10,
    brand: 10,
    mpn: 5,
    category_ids: 10,
    weight: 2.5,
    dimensions: 2.5
  };

  let score = 0;
  let maxScore = 0;

  Object.entries(weights).forEach(([field, weight]) => {
    maxScore += weight;
    const value = product[field];

    if (field === 'images') {
      if (Array.isArray(value) && value.length > 0) score += weight;
    } else if (field === 'category_ids') {
      if (Array.isArray(value) && value.length > 0) score += weight;
    } else if (field === 'dimensions') {
      if (value && (value.length || value.width || value.height)) score += weight;
    } else if (field === 'description') {
      if (value && value.length >= 100) score += weight;
      else if (value && value.length >= 50) score += weight * 0.5;
    } else if (value) {
      score += weight;
    }
  });

  return Math.round((score / maxScore) * 100);
};

const getDescriptionTips = (product) => {
  const tips = [];

  const descLen = (product.description || '').length;
  tips.push({
    passed: descLen >= 100,
    message: descLen >= 100
      ? `Description is ${descLen} characters (good length)`
      : `Description is ${descLen} characters (aim for 100-500 characters)`
  });

  const hasFeatures = (product.description || '').includes('feature') ||
                      (product.description || '').includes('include') ||
                      (product.description || '').match(/\n-|\n\*|\n\d\./);
  tips.push({
    passed: hasFeatures,
    message: hasFeatures
      ? "Description includes feature list"
      : "Consider adding bullet points or features list"
  });

  tips.push({
    passed: !!product.gtin || !!product.mpn,
    message: (product.gtin || product.mpn)
      ? "Product has identifiers (GTIN/MPN)"
      : "Add GTIN or MPN for better discoverability"
  });

  tips.push({
    passed: !!product.brand,
    message: product.brand
      ? `Brand is set: ${product.brand}`
      : "Add brand name for better search visibility"
  });

  tips.push({
    passed: Array.isArray(product.images) && product.images.length >= 2,
    message: Array.isArray(product.images) && product.images.length >= 2
      ? `Has ${product.images.length} images`
      : "Add at least 2 product images"
  });

  return tips;
};

// Add this JSX inside the form, as a new Accordion section:

{/* AI Shopping Readiness Section */}
<Accordion type="multiple" className="w-full" defaultValue={[]}>
  <AccordionItem value="ai-shopping">
    <AccordionTrigger className="hover:no-underline">
      <div className="flex items-center justify-between w-full pr-4">
        <span className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI Shopping Readiness
        </span>
        <Badge
          variant={
            calculateDataCompleteness(formData) >= 80 ? "success" :
            calculateDataCompleteness(formData) >= 50 ? "warning" :
            "destructive"
          }
        >
          {calculateDataCompleteness(formData)}% Complete
        </Badge>
      </div>
    </AccordionTrigger>
    <AccordionContent className="space-y-6 pt-4">

      {/* Data Quality Score Card */}
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-purple-900 text-base">Data Quality Score</CardTitle>
          <CardDescription>
            Higher scores improve visibility in AI shopping assistants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-purple-600">
              {calculateDataCompleteness(formData)}%
            </div>
            <div className="flex-1">
              <Progress
                value={calculateDataCompleteness(formData)}
                className="h-3"
              />
              <p className="text-sm text-gray-600 mt-2">
                {calculateDataCompleteness(formData) >= 80
                  ? "Excellent! Your product is well optimized for AI shopping."
                  : calculateDataCompleteness(formData) >= 50
                    ? "Good start. Add more details to improve discoverability."
                    : "Add more product information to improve AI visibility."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Identifiers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Product Identifiers
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-4 h-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Required for Google Shopping, Microsoft Ads, and AI assistants.
                    GTIN is the barcode number on product packaging.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gtin">GTIN (UPC/EAN/ISBN)</Label>
              <Input
                id="gtin"
                value={formData.gtin || ''}
                onChange={(e) => handleInputChange("gtin", e.target.value)}
                placeholder="e.g., 0012345678905"
              />
              <p className="text-xs text-gray-500 mt-1">8, 12, 13, or 14 digit barcode</p>
            </div>
            <div>
              <Label htmlFor="mpn">Manufacturer Part Number (MPN)</Label>
              <Input
                id="mpn"
                value={formData.mpn || ''}
                onChange={(e) => handleInputChange("mpn", e.target.value)}
                placeholder="e.g., ACME-WH-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand || ''}
                onChange={(e) => handleInputChange("brand", e.target.value)}
                placeholder="e.g., ACME Audio"
              />
            </div>
            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={formData.product_identifiers?.manufacturer || ''}
                onChange={(e) => handleNestedInputChange("product_identifiers", "manufacturer", e.target.value)}
                placeholder="e.g., ACME Corporation"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Details for AI */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Product Attributes for AI</CardTitle>
          <CardDescription>
            These fields help AI assistants describe and filter your products
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Condition</Label>
              <Select
                value={formData.product_identifiers?.condition || 'new'}
                onValueChange={(val) => handleNestedInputChange("product_identifiers", "condition", val)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Age Group</Label>
              <Select
                value={formData.product_identifiers?.age_group || ''}
                onValueChange={(val) => handleNestedInputChange("product_identifiers", "age_group", val)}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Not specified</SelectItem>
                  <SelectItem value="newborn">Newborn</SelectItem>
                  <SelectItem value="infant">Infant</SelectItem>
                  <SelectItem value="toddler">Toddler</SelectItem>
                  <SelectItem value="kids">Kids</SelectItem>
                  <SelectItem value="adult">Adult</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select
                value={formData.product_identifiers?.gender || ''}
                onValueChange={(val) => handleNestedInputChange("product_identifiers", "gender", val)}
              >
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Not specified</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="unisex">Unisex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.product_identifiers?.color || ''}
                onChange={(e) => handleNestedInputChange("product_identifiers", "color", e.target.value)}
                placeholder="e.g., Black, Red"
              />
            </div>
            <div>
              <Label htmlFor="size">Size</Label>
              <Input
                id="size"
                value={formData.product_identifiers?.size || ''}
                onChange={(e) => handleNestedInputChange("product_identifiers", "size", e.target.value)}
                placeholder="e.g., Medium, 10"
              />
            </div>
            <div>
              <Label htmlFor="material">Material</Label>
              <Input
                id="material"
                value={formData.product_identifiers?.material || ''}
                onChange={(e) => handleNestedInputChange("product_identifiers", "material", e.target.value)}
                placeholder="e.g., Cotton, Leather"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Highlights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Product Highlights</CardTitle>
          <CardDescription>
            Key selling points that AI assistants will use to describe your product
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(formData.ai_shopping_data?.product_highlights || []).map((highlight, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={highlight}
                  onChange={(e) => {
                    const highlights = [...(formData.ai_shopping_data?.product_highlights || [])];
                    highlights[index] = e.target.value;
                    handleNestedInputChange("ai_shopping_data", "product_highlights", highlights);
                  }}
                  placeholder={`Highlight ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const highlights = (formData.ai_shopping_data?.product_highlights || []).filter((_, i) => i !== index);
                    handleNestedInputChange("ai_shopping_data", "product_highlights", highlights);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const highlights = [...(formData.ai_shopping_data?.product_highlights || []), ''];
                handleNestedInputChange("ai_shopping_data", "product_highlights", highlights);
              }}
              disabled={(formData.ai_shopping_data?.product_highlights || []).length >= 5}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Highlight
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Description Quality Tips */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Optimization Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {getDescriptionTips(formData).map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                {tip.passed ?
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> :
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                }
                <span className={tip.passed ? "text-gray-600" : "text-amber-800"}>
                  {tip.message}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### 5.2 Helper Function for Nested Input Changes

Add this handler to ProductForm:

```jsx
const handleNestedInputChange = (parentField, childField, value) => {
  setFormData(prev => ({
    ...prev,
    [parentField]: {
      ...(prev[parentField] || {}),
      [childField]: value
    }
  }));
};
```

---

## Implementation Phases

### Phase 1: Database & Backend Foundation
1. Create database migration for new product fields
2. Update `Product.js` Sequelize model with new fields
3. Update `backend/src/routes/products.js` to handle new fields in CRUD operations
4. Update `backend/src/routes/publicProducts.js` to return new fields in public API

### Phase 2: Feed Generation System
1. Create `ai-shopping-feed-generator.js` service class
2. Implement Google Merchant Center XML feed format
3. Implement Microsoft Merchant Center XML feed format
4. Implement ChatGPT/Universal JSON formats
5. Create `ai-shopping-feeds.js` routes with Redis caching
6. Register routes in `backend/src/server.js`

### Phase 3: Enhanced Schema.org
1. Update `SeoHeadManager.jsx` with enhanced Product structured data
2. Add GTIN/MPN/brand fields to schema
3. Add weight/dimensions to schema
4. Add shipping details schema
5. Add aggregate ratings support
6. Test with Google Rich Results Test tool

### Phase 4: AI Agent API
1. Create `ai-agent-api.js` routes
2. Implement product listing with AI-friendly format
3. Implement natural language search endpoint
4. Add rate limiting and caching
5. Register routes in `backend/src/server.js`

### Phase 5: Admin UI
1. Add AI Shopping Readiness accordion to `ProductForm.jsx`
2. Implement data completeness scoring function
3. Add description quality tips component
4. Add product highlights input
5. Style and test the new UI section

---

## Files Reference

### New Files to Create
| File | Purpose |
|------|---------|
| `backend/src/services/ai-shopping-feed-generator.js` | Feed generation service class |
| `backend/src/routes/ai-shopping-feeds.js` | Public feed endpoints (XML/JSON) |
| `backend/src/routes/ai-agent-api.js` | AI agent API endpoints |
| `src/components/admin/products/GoogleCategorySelector.jsx` | Google category taxonomy picker (optional) |

### Files to Modify
| File | Changes |
|------|---------|
| `backend/src/database/schemas/tenant/001-create-tenant-tables.sql` | Add gtin, mpn, brand, product_identifiers, ai_shopping_data columns |
| `backend/src/models/Product.js` | Add new field definitions to Sequelize model |
| `backend/src/routes/products.js` | Handle new fields in create/update operations |
| `backend/src/routes/publicProducts.js` | Return new fields in public API responses |
| `backend/src/server.js` | Register new feed and AI agent routes |
| `src/components/storefront/SeoHeadManager.jsx` | Enhanced Product schema.org JSON-LD |
| `src/components/admin/products/ProductForm.jsx` | Add AI Shopping Readiness accordion section |

---

## Testing Checklist

### Feed Testing
- [ ] Google Merchant Center feed validates in Google's feed testing tool
- [ ] Microsoft Merchant Center feed validates
- [ ] ChatGPT JSON feed returns valid response
- [ ] Universal feed contains valid Schema.org markup
- [ ] Feeds are properly cached in Redis
- [ ] Cache invalidation works correctly

### Schema.org Testing
- [ ] Product pages pass Google Rich Results Test
- [ ] GTIN, MPN, brand appear in structured data
- [ ] Dimensions and weight appear correctly
- [ ] Shipping details are valid
- [ ] Aggregate ratings appear when reviews exist

### AI Agent API Testing
- [ ] Product search returns AI-friendly format
- [ ] Natural language queries are parsed correctly
- [ ] Rate limiting works as expected
- [ ] Product details include all required fields
- [ ] Related products are returned

### Admin UI Testing
- [ ] Data completeness score calculates correctly
- [ ] All new fields save properly
- [ ] Validation works for GTIN format
- [ ] Product highlights can be added/removed
- [ ] Tips update based on product data

---

## Resources

- [Google Merchant Center Feed Specification](https://support.google.com/merchants/answer/7052112)
- [Microsoft Merchant Center Feed Specification](https://help.ads.microsoft.com/#apex/ads/en/51084/1)
- [Schema.org Product](https://schema.org/Product)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ChatGPT Plugins Documentation](https://platform.openai.com/docs/plugins)
