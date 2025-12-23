const { XMLBuilder } = require('fast-xml-parser');

/**
 * AI Shopping Feed Generator
 *
 * Generates product feeds for AI shopping platforms:
 * - Google Merchant Center (RSS 2.0 with g: namespace)
 * - Microsoft Merchant Center (similar to Google)
 * - ChatGPT/OpenAI (JSON with natural language descriptions)
 * - Universal AI (Schema.org compliant JSON)
 */
class AIShoppingFeedGenerator {
  constructor(baseUrl, currency = 'USD') {
    this.baseUrl = baseUrl;
    this.currency = currency;

    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  ',
      suppressEmptyNode: false,
      attributeNamePrefix: '@_'
    });
  }

  /**
   * Generate Google Merchant Center RSS 2.0 feed
   */
  generateGoogleFeed(products, options = {}) {
    const items = products.map(product => this.formatGoogleItem(product));

    const feed = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      rss: {
        '@_version': '2.0',
        '@_xmlns:g': 'http://base.google.com/ns/1.0',
        channel: {
          title: options.storeName || 'Product Feed',
          link: this.baseUrl,
          description: options.description || 'Product catalog for AI shopping',
          item: items
        }
      }
    };

    return this.xmlBuilder.build(feed);
  }

  formatGoogleItem(product) {
    const availability = this.getAvailability(product);
    const primaryImage = this.getPrimaryImage(product);
    const condition = product.product_identifiers?.condition || 'new';

    const item = {
      'g:id': product.sku || product.id,
      'g:title': this.truncate(product.name, 150),
      'g:description': this.sanitizeDescription(product.description || product.short_description, 5000),
      'g:link': `${this.baseUrl}/product/${product.slug}`,
      'g:image_link': primaryImage,
      'g:price': `${product.price} ${this.currency}`,
      'g:availability': availability,
      'g:condition': condition
    };

    // Sale price
    if (product.compare_price && parseFloat(product.compare_price) > parseFloat(product.price)) {
      item['g:sale_price'] = `${product.price} ${this.currency}`;
      item['g:price'] = `${product.compare_price} ${this.currency}`;
    }

    // Additional images
    const additionalImages = this.getAdditionalImages(product);
    if (additionalImages.length > 0) {
      item['g:additional_image_link'] = additionalImages;
    }

    // Product identifiers
    if (product.gtin) item['g:gtin'] = product.gtin;
    if (product.mpn) item['g:mpn'] = product.mpn;
    if (product.brand) item['g:brand'] = product.brand;
    if (product.barcode && !product.gtin) item['g:gtin'] = product.barcode;

    // Google product category
    if (product.ai_shopping_data?.google_category_id) {
      item['g:google_product_category'] = product.ai_shopping_data.google_category_id;
    }

    // Product attributes
    const identifiers = product.product_identifiers || {};
    if (identifiers.color) item['g:color'] = identifiers.color;
    if (identifiers.size) item['g:size'] = identifiers.size;
    if (identifiers.gender) item['g:gender'] = identifiers.gender;
    if (identifiers.age_group) item['g:age_group'] = identifiers.age_group;
    if (identifiers.material) item['g:material'] = identifiers.material;

    // Shipping weight
    if (product.weight) {
      item['g:shipping_weight'] = `${product.weight} kg`;
    }

    return item;
  }

  /**
   * Generate Microsoft/Bing Merchant Center feed
   * Uses same format as Google with minor differences
   */
  generateMicrosoftFeed(products, options = {}) {
    return this.generateGoogleFeed(products, options);
  }

  /**
   * Generate ChatGPT/OpenAI plugin compatible JSON feed
   */
  generateChatGPTFeed(products, store = {}) {
    return {
      feed_version: '1.0',
      format: 'chatgpt-shopping',
      store: {
        name: store.name || 'Store',
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
    const discount = this.calculateDiscount(product);

    return {
      id: product.id,
      name: product.name,

      // Natural language description for AI to speak/summarize
      natural_description: this.generateNaturalDescription(product, discount),

      // Structured description
      description: product.description,
      short_description: product.short_description,

      // Key selling points
      highlights: product.ai_shopping_data?.product_highlights || [],

      // Pricing with context
      pricing: {
        current_price: parseFloat(product.price) || 0,
        original_price: product.compare_price ? parseFloat(product.compare_price) : null,
        currency: this.currency,
        formatted_current: this.formatPrice(product.price),
        formatted_original: product.compare_price ? this.formatPrice(product.compare_price) : null,
        discount_percentage: discount,
        price_context: this.getPriceContext(product, discount)
      },

      // Availability
      availability: {
        status: this.getAvailabilityStatus(product),
        quantity: product.stock_quantity,
        message: this.getAvailabilityMessage(product),
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

      // Category
      category: {
        ids: product.category_ids || [],
        path: product.category_path || null
      },

      // Specifications from product_identifiers
      specifications: this.formatSpecifications(product),

      // URLs
      url: `${this.baseUrl}/product/${product.slug}`,
      images: this.formatImages(product),

      // Shipping
      shipping: {
        weight: product.weight ? `${product.weight} kg` : null,
        dimensions: this.formatDimensions(product.dimensions)
      }
    };
  }

  /**
   * Generate Universal AI-compatible feed (Schema.org based)
   */
  generateUniversalFeed(products, store = {}) {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${store.name || 'Store'} Product Catalog`,
      description: `Products from ${store.name || 'Store'}`,
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
    const schema = {
      '@type': 'Product',
      '@id': `${this.baseUrl}/product/${product.slug}`,
      identifier: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description || product.short_description,
      image: this.formatImages(product).map(img => img.url),
      offers: {
        '@type': 'Offer',
        url: `${this.baseUrl}/product/${product.slug}`,
        price: parseFloat(product.price) || 0,
        priceCurrency: this.currency,
        availability: `https://schema.org/${this.getSchemaAvailability(product)}`,
        itemCondition: `https://schema.org/${this.getSchemaCondition(product)}`
      }
    };

    // Product identifiers
    if (product.gtin) schema.gtin = product.gtin;
    if (product.mpn) schema.mpn = product.mpn;

    // Brand
    if (product.brand) {
      schema.brand = {
        '@type': 'Brand',
        name: product.brand
      };
    }

    // Physical properties
    if (product.weight) {
      schema.weight = {
        '@type': 'QuantitativeValue',
        value: parseFloat(product.weight),
        unitCode: 'KGM'
      };
    }

    // Attributes
    const identifiers = product.product_identifiers || {};
    if (identifiers.color) schema.color = identifiers.color;
    if (identifiers.material) schema.material = identifiers.material;

    return schema;
  }

  // ============ Helper Methods ============

  generateNaturalDescription(product, discount) {
    const parts = [];

    if (product.brand) {
      parts.push(`The ${product.brand} ${product.name}`);
    } else {
      parts.push(`This ${product.name}`);
    }

    if (product.short_description) {
      parts.push(product.short_description.substring(0, 150));
    }

    const highlights = product.ai_shopping_data?.product_highlights;
    if (highlights && highlights.length > 0) {
      parts.push(`Key features include: ${highlights.slice(0, 3).join(', ')}.`);
    }

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
      return product.images[0].url || product.images[0].file_url || product.images[0];
    }
    return `${this.baseUrl}/placeholder-product.jpg`;
  }

  getAdditionalImages(product) {
    if (Array.isArray(product.images) && product.images.length > 1) {
      return product.images.slice(1, 10).map(img => img.url || img.file_url || img);
    }
    return [];
  }

  formatImages(product) {
    if (!Array.isArray(product.images)) return [];
    return product.images.map((img, index) => ({
      url: img.url || img.file_url || img,
      alt: img.alt || img.alt_text || `${product.name} image ${index + 1}`
    }));
  }

  formatPrice(price) {
    const num = parseFloat(price) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency
    }).format(num);
  }

  calculateDiscount(product) {
    if (!product.compare_price || parseFloat(product.compare_price) <= parseFloat(product.price)) return 0;
    return Math.round((1 - parseFloat(product.price) / parseFloat(product.compare_price)) * 100);
  }

  getPriceContext(product, discount) {
    if (discount > 0) {
      const savings = parseFloat(product.compare_price) - parseFloat(product.price);
      return `Currently ${discount}% off, save ${this.formatPrice(savings)}`;
    }
    return 'Regular price';
  }

  formatSpecifications(product) {
    const specs = [];
    const identifiers = product.product_identifiers || {};

    if (identifiers.color) specs.push({ name: 'Color', value: identifiers.color });
    if (identifiers.size) specs.push({ name: 'Size', value: identifiers.size });
    if (identifiers.material) specs.push({ name: 'Material', value: identifiers.material });
    if (identifiers.gender) specs.push({ name: 'Gender', value: identifiers.gender });
    if (identifiers.age_group) specs.push({ name: 'Age Group', value: identifiers.age_group });
    if (product.weight) specs.push({ name: 'Weight', value: `${product.weight} kg` });

    return specs;
  }

  formatDimensions(dimensions) {
    if (!dimensions) return null;
    const parts = [];
    if (dimensions.length) parts.push(dimensions.length);
    if (dimensions.width) parts.push(dimensions.width);
    if (dimensions.height) parts.push(dimensions.height);
    if (parts.length === 0) return null;
    return `${parts.join(' x ')} ${dimensions.unit || 'cm'}`;
  }

  sanitizeDescription(text, maxLength = 5000) {
    if (!text) return '';
    // Remove HTML tags and limit length
    return text.replace(/<[^>]*>/g, '').substring(0, maxLength);
  }

  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}

module.exports = AIShoppingFeedGenerator;
