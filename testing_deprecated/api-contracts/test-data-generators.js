// Test Data Generators for API Contract Testing
// Generates realistic test data for different scenarios and edge cases

const { faker } = require('@faker-js/faker');

class TestDataGenerators {
  constructor() {
    this.seedValue = 12345; // For consistent test data
    faker.seed(this.seedValue);
  }

  // Reset faker seed for consistent tests
  resetSeed() {
    faker.seed(this.seedValue);
  }

  // Generate product test data
  generateProduct(overrides = {}) {
    const categories = [
      faker.string.uuid(),
      faker.string.uuid()
    ];

    return {
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      slug: faker.helpers.slugify(faker.commerce.productName()).toLowerCase(),
      sku: faker.string.alphanumeric(8).toUpperCase(),
      price: parseFloat(faker.commerce.price()),
      special_price: faker.datatype.boolean() ? parseFloat(faker.commerce.price()) : null,
      description: faker.commerce.productDescription(),
      short_description: faker.lorem.sentence(),
      status: faker.helpers.arrayElement(['active', 'inactive']),
      visibility: faker.helpers.arrayElement(['catalog', 'search', 'both', 'none']),
      weight: faker.number.float({ min: 0.1, max: 50 }),
      dimensions: {
        length: faker.number.float({ min: 1, max: 100 }),
        width: faker.number.float({ min: 1, max: 100 }),
        height: faker.number.float({ min: 1, max: 100 })
      },
      stock_quantity: faker.number.int({ min: 0, max: 1000 }),
      manage_stock: faker.datatype.boolean(),
      in_stock: faker.datatype.boolean(),
      backorders: faker.helpers.arrayElement(['no', 'notify', 'yes']),
      categories,
      images: this.generateProductImages(),
      attributes: this.generateProductAttributes(),
      seo: {
        meta_title: faker.lorem.words(5),
        meta_description: faker.lorem.sentence(),
        meta_keywords: faker.lorem.words(10).join(', ')
      },
      created_at: faker.date.past().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...overrides
    };
  }

  generateProductImages(count = 3) {
    return Array.from({ length: count }, (_, index) => ({
      id: faker.string.uuid(),
      url: faker.image.url(),
      alt: faker.lorem.words(3),
      position: index
    }));
  }

  generateProductAttributes() {
    return {
      color: faker.helpers.arrayElement(['red', 'blue', 'green', 'black', 'white']),
      size: faker.helpers.arrayElement(['XS', 'S', 'M', 'L', 'XL']),
      material: faker.helpers.arrayElement(['cotton', 'polyester', 'wool', 'silk']),
      brand: faker.company.name(),
      warranty: faker.datatype.boolean(),
      eco_friendly: faker.datatype.boolean(),
      tags: [faker.lorem.word(), faker.lorem.word(), faker.lorem.word()]
    };
  }

  // Generate category test data
  generateCategory(overrides = {}) {
    return {
      id: faker.string.uuid(),
      name: faker.commerce.department(),
      slug: faker.helpers.slugify(faker.commerce.department()).toLowerCase(),
      description: faker.lorem.paragraph(),
      parent_id: faker.datatype.boolean() ? faker.string.uuid() : null,
      level: faker.number.int({ min: 0, max: 3 }),
      position: faker.number.int({ min: 0, max: 100 }),
      is_active: faker.datatype.boolean(),
      include_in_menu: faker.datatype.boolean(),
      image: faker.image.url(),
      meta_title: faker.lorem.words(4),
      meta_description: faker.lorem.sentence(),
      created_at: faker.date.past().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...overrides
    };
  }

  // Generate order test data
  generateOrder(overrides = {}) {
    const items = this.generateOrderItems();
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * 0.1; // 10% tax
    const shippingAmount = 15.99;
    const discountAmount = faker.datatype.boolean() ? subtotal * 0.1 : 0;
    const total = subtotal + taxAmount + shippingAmount - discountAmount;

    return {
      id: faker.string.uuid(),
      order_number: `ORD-${faker.string.numeric(8)}`,
      status: faker.helpers.arrayElement([
        'pending', 'processing', 'shipped', 'delivered', 
        'cancelled', 'refunded', 'failed'
      ]),
      payment_status: faker.helpers.arrayElement([
        'pending', 'paid', 'failed', 'refunded', 'partially_refunded'
      ]),
      customer_email: faker.internet.email(),
      customer_name: faker.person.fullName(),
      subtotal: parseFloat(subtotal.toFixed(2)),
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      shipping_amount: shippingAmount,
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      currency: 'USD',
      items,
      billing_address: this.generateAddress(),
      shipping_address: faker.datatype.boolean() ? this.generateAddress() : undefined,
      created_at: faker.date.past().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...overrides
    };
  }

  generateOrderItems(count = 3) {
    return Array.from({ length: count }, () => {
      const quantity = faker.number.int({ min: 1, max: 5 });
      const price = parseFloat(faker.commerce.price());
      const total = quantity * price;

      return {
        id: faker.string.uuid(),
        product_id: faker.string.uuid(),
        product_name: faker.commerce.productName(),
        sku: faker.string.alphanumeric(8).toUpperCase(),
        quantity,
        price,
        total: parseFloat(total.toFixed(2))
      };
    });
  }

  generateAddress() {
    return {
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      company: faker.datatype.boolean() ? faker.company.name() : '',
      address_1: faker.location.streetAddress(),
      address_2: faker.datatype.boolean() ? faker.location.secondaryAddress() : '',
      city: faker.location.city(),
      state: faker.location.state(),
      postal_code: faker.location.zipCode(),
      country: faker.location.country()
    };
  }

  // Generate user test data
  generateUser(overrides = {}) {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      role: faker.helpers.arrayElement(['admin', 'store_owner', 'customer', 'guest']),
      account_type: faker.helpers.arrayElement(['agency', 'brand', 'individual']),
      first_name: faker.person.firstName(),
      last_name: faker.person.lastName(),
      is_active: faker.datatype.boolean(),
      email_verified: faker.datatype.boolean(),
      last_login: faker.datatype.boolean() ? faker.date.recent().toISOString() : null,
      created_at: faker.date.past().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...overrides
    };
  }

  // Generate store test data
  generateStore(overrides = {}) {
    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
      domain: faker.internet.domainName(),
      status: faker.helpers.arrayElement(['active', 'inactive', 'suspended']),
      owner_id: faker.string.uuid(),
      settings: {
        currency: faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'CAD']),
        timezone: faker.helpers.arrayElement(['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']),
        language: faker.helpers.arrayElement(['en', 'es', 'fr', 'de']),
        theme: faker.helpers.arrayElement(['default', 'modern', 'classic'])
      },
      created_at: faker.date.past().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...overrides
    };
  }

  // Generate Akeneo mapping test data (critical for transformation bug prevention)
  generateAkeneoMapping(overrides = {}) {
    return {
      id: faker.string.uuid(),
      store_id: faker.string.uuid(),
      akeneo_attribute: faker.helpers.arrayElement([
        'name', 'description', 'price', 'color', 'size', 'material', 'weight'
      ]),
      catalog_attribute: faker.helpers.arrayElement([
        'product_name', 'product_description', 'base_price', 'color_option', 
        'size_option', 'material_type', 'shipping_weight'
      ]),
      attribute_type: faker.helpers.arrayElement([
        'text', 'textarea', 'number', 'price', 'date', 
        'boolean', 'select', 'multiselect', 'image', 'file'
      ]),
      mapping_rules: {
        transform: faker.helpers.arrayElement(['lowercase', 'uppercase', 'trim', 'none']),
        default_value: faker.lorem.word(),
        required: faker.datatype.boolean(),
        validation: {
          min_length: faker.number.int({ min: 1, max: 10 }),
          max_length: faker.number.int({ min: 50, max: 255 }),
          pattern: '^[a-zA-Z0-9\\s]+$'
        }
      },
      is_active: faker.datatype.boolean(),
      created_at: faker.date.past().toISOString(),
      updated_at: faker.date.recent().toISOString(),
      ...overrides
    };
  }

  // Generate Akeneo custom mapping response (the endpoint that was broken by transformation)
  generateAkeneoCustomMappingResponse(overrides = {}) {
    const attributeMappings = Array.from({ length: 5 }, () => ({
      akeneo_code: faker.helpers.arrayElement(['name', 'description', 'price', 'color', 'size']),
      catalog_code: faker.helpers.arrayElement(['product_name', 'product_desc', 'base_price', 'color_attr', 'size_attr']),
      type: faker.helpers.arrayElement(['text', 'textarea', 'price', 'select', 'multiselect']),
      label: faker.lorem.words(2),
      required: faker.datatype.boolean(),
      options: faker.datatype.boolean() ? [faker.lorem.word(), faker.lorem.word()] : undefined
    }));

    const imageMappings = Array.from({ length: 2 }, (_, index) => ({
      akeneo_code: `image_${index + 1}`,
      catalog_code: `product_image_${index + 1}`,
      type: 'image',
      position: index
    }));

    const fileMappings = Array.from({ length: 1 }, () => ({
      akeneo_code: 'product_manual',
      catalog_code: 'manual_file',
      type: 'file'
    }));

    return {
      success: true,
      mappings: {
        attributes: attributeMappings,
        images: imageMappings,
        files: fileMappings
      },
      meta: {
        total_mappings: attributeMappings.length + imageMappings.length + fileMappings.length,
        active_mappings: faker.number.int({ min: 5, max: 8 }),
        last_sync: faker.date.recent().toISOString()
      },
      ...overrides
    };
  }

  // Generate API response wrappers
  generateSuccessResponse(data, meta = null) {
    return {
      success: true,
      data,
      ...(meta && { meta })
    };
  }

  generateErrorResponse(message, errors = [], statusCode = 400) {
    return {
      success: false,
      message,
      errors,
      status: statusCode
    };
  }

  generateListResponse(items, pagination = null) {
    const response = {
      success: true,
      data: items
    };

    if (pagination) {
      response.meta = {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || items.length,
        pages: Math.ceil((pagination.total || items.length) / (pagination.limit || 10))
      };
    }

    return response;
  }

  // Generate edge case scenarios
  generateEdgeCaseScenarios() {
    return {
      emptyList: this.generateListResponse([]),
      singleItem: this.generateListResponse([this.generateProduct()]),
      largeList: this.generateListResponse(
        Array.from({ length: 100 }, () => this.generateProduct())
      ),
      invalidData: {
        missingRequiredFields: this.generateProduct({ 
          name: undefined, 
          price: undefined 
        }),
        wrongTypes: this.generateProduct({ 
          price: "not-a-number", 
          status: 123 
        }),
        invalidEnums: this.generateProduct({ 
          status: "invalid-status",
          visibility: "invalid-visibility"
        })
      },
      transformationCases: {
        // Critical: Test cases for the transformation bug
        customMappingsRawResponse: this.generateAkeneoCustomMappingResponse(),
        customMappingsTransformedResponse: [this.generateAkeneoMapping()], // Wrong transformation
        storageEndpointResponse: {
          success: true,
          data: {
            file_url: faker.internet.url(),
            file_name: faker.system.fileName(),
            file_size: faker.number.int({ min: 1024, max: 1048576 }),
            content_type: 'image/jpeg'
          }
        }
      }
    };
  }

  // Generate performance test data
  generatePerformanceTestData(size = 'medium') {
    const sizes = {
      small: { products: 10, categories: 5, orders: 20 },
      medium: { products: 100, categories: 20, orders: 200 },
      large: { products: 1000, categories: 50, orders: 2000 },
      xlarge: { products: 10000, categories: 100, orders: 20000 }
    };

    const config = sizes[size] || sizes.medium;

    return {
      products: Array.from({ length: config.products }, () => this.generateProduct()),
      categories: Array.from({ length: config.categories }, () => this.generateCategory()),
      orders: Array.from({ length: config.orders }, () => this.generateOrder()),
      users: Array.from({ length: Math.ceil(config.orders / 10) }, () => this.generateUser()),
      stores: Array.from({ length: 5 }, () => this.generateStore())
    };
  }

  // Generate regression test data (data that previously caused bugs)
  generateRegressionTestData() {
    return {
      customMappingsBug: {
        description: 'Response transformation broke custom mappings structure',
        endpoint: '/integrations/akeneo/custom-mappings',
        correctResponse: this.generateAkeneoCustomMappingResponse(),
        incorrectResponse: [this.generateAkeneoMapping()], // This would be the wrong transformation
        testCase: 'Ensure custom mappings endpoint returns raw response structure'
      },
      endpointTransformationBug: {
        description: 'Endpoints ending in "s" were incorrectly transformed',
        testCases: [
          {
            endpoint: '/integrations/akeneo/status',
            shouldTransform: false,
            response: { success: true, status: 'connected', last_sync: faker.date.recent().toISOString() }
          },
          {
            endpoint: '/products/stats',
            shouldTransform: false,
            response: { success: true, total_products: 150, active_products: 120 }
          },
          {
            endpoint: '/storage/files',
            shouldTransform: false,
            response: { success: true, files: [], total_size: 0 }
          }
        ]
      }
    };
  }
}

module.exports = TestDataGenerators;