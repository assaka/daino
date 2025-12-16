'use strict';

const { v4: uuidv4 } = require('uuid');
const ConnectionManager = require('./database/ConnectionManager');
const { masterDbClient } = require('../database/masterConnection');
const tenantMigration = require('../../migrations/20251215000002-add-demo-column-to-tenant-tables');

/**
 * Demo Data Provisioning Service
 *
 * Generates and inserts realistic demo data for stores.
 * All generated data is marked with demo=true for selective deletion later.
 */
class DemoDataProvisioningService {
  constructor(storeId) {
    this.storeId = storeId;
    this.tenantDb = null;
    this.createdIds = {
      categories: [],
      subcategories: [],
      attributeSets: [],
      attributes: [],
      attributeValues: [],
      products: [],
      customers: [],
      orders: []
    };
  }

  /**
   * Initialize tenant database connection
   */
  async initialize() {
    this.tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
  }

  /**
   * Main provisioning method
   * @returns {Promise<Object>} Provisioning result
   */
  async provisionDemoData() {
    await this.initialize();
    console.log(`[DemoData] Starting provisioning for store: ${this.storeId}`);

    try {
      // First, ensure demo column exists on all tables
      await this.ensureDemoColumns();

      // Create demo data in order of dependencies
      console.log('[DemoData] Creating categories...');
      await this.createDemoCategories();

      console.log('[DemoData] Creating attribute sets...');
      await this.createDemoAttributeSets();

      console.log('[DemoData] Creating attributes...');
      await this.createDemoAttributes();

      console.log('[DemoData] Creating products...');
      await this.createDemoProducts();

      console.log('[DemoData] Creating product tabs...');
      await this.createDemoProductTabs();

      console.log('[DemoData] Creating product labels...');
      await this.createDemoProductLabels();

      console.log('[DemoData] Creating customers...');
      await this.createDemoCustomers();

      console.log('[DemoData] Creating orders...');
      await this.createDemoOrders();

      console.log('[DemoData] Creating CMS content...');
      await this.createDemoCMSContent();

      console.log('[DemoData] Creating tax configuration...');
      await this.createDemoTaxConfiguration();

      console.log('[DemoData] Creating coupons...');
      await this.createDemoCoupons();

      console.log('[DemoData] Creating SEO templates...');
      await this.createDemoSEOTemplates();

      // Update store status to 'demo'
      console.log('[DemoData] Updating store status to demo...');
      await this.updateStoreStatus('demo');

      const summary = this.getProvisioningSummary();
      console.log('[DemoData] Provisioning complete:', summary);

      return {
        success: true,
        summary
      };
    } catch (error) {
      console.error('[DemoData] Provisioning failed:', error);
      throw error;
    }
  }

  /**
   * Ensure demo column exists on all tables
   */
  async ensureDemoColumns() {
    const tables = tenantMigration.TABLES_WITH_DEMO_COLUMN;

    for (const table of tables) {
      try {
        // Try to add the column - will fail silently if exists
        const { error } = await this.tenantDb.rpc('exec_sql', {
          sql: `
            ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS demo BOOLEAN DEFAULT false;
            CREATE INDEX IF NOT EXISTS idx_${table}_demo ON ${table}(demo) WHERE demo = true;
          `
        });

        if (error) {
          console.log(`[DemoData] Note: Could not add demo column to ${table} via RPC, assuming it exists`);
        }
      } catch (err) {
        // Column might already exist, continue
        console.log(`[DemoData] Demo column check for ${table}: ${err.message}`);
      }
    }
  }

  /**
   * Create demo categories with subcategories
   */
  async createDemoCategories() {
    const categories = [
      {
        name: 'Electronics',
        slug: 'electronics',
        description: 'Latest electronic gadgets and devices',
        image_url: 'https://picsum.photos/seed/cat-electronics/400/300',
        subcategories: [
          { name: 'Smartphones', slug: 'smartphones', description: 'Mobile phones and accessories' },
          { name: 'Laptops', slug: 'laptops', description: 'Notebooks and laptop accessories' },
          { name: 'Audio', slug: 'audio', description: 'Headphones, speakers and audio equipment' },
          { name: 'Accessories', slug: 'electronics-accessories', description: 'Cables, chargers and tech accessories' }
        ]
      },
      {
        name: 'Clothing',
        slug: 'clothing',
        description: 'Fashion and apparel for everyone',
        image_url: 'https://picsum.photos/seed/cat-clothing/400/300',
        subcategories: [
          { name: "Men's Wear", slug: 'mens-wear', description: 'Clothing for men' },
          { name: "Women's Wear", slug: 'womens-wear', description: 'Clothing for women' },
          { name: 'Kids', slug: 'kids-clothing', description: 'Clothing for children' },
          { name: 'Footwear', slug: 'footwear', description: 'Shoes, boots and sandals' }
        ]
      },
      {
        name: 'Home & Living',
        slug: 'home-living',
        description: 'Everything for your home',
        image_url: 'https://picsum.photos/seed/cat-home/400/300',
        subcategories: [
          { name: 'Furniture', slug: 'furniture', description: 'Tables, chairs and home furniture' },
          { name: 'Kitchen', slug: 'kitchen', description: 'Kitchen appliances and utensils' },
          { name: 'Decor', slug: 'decor', description: 'Home decoration items' },
          { name: 'Bedding', slug: 'bedding', description: 'Bed sheets, pillows and blankets' }
        ]
      },
      {
        name: 'Sports & Outdoors',
        slug: 'sports-outdoors',
        description: 'Sports equipment and outdoor gear',
        image_url: 'https://picsum.photos/seed/cat-sports/400/300',
        subcategories: [
          { name: 'Fitness Equipment', slug: 'fitness-equipment', description: 'Gym and workout equipment' },
          { name: 'Outdoor Gear', slug: 'outdoor-gear', description: 'Camping and hiking gear' },
          { name: 'Sports Apparel', slug: 'sports-apparel', description: 'Sportswear and athletic clothing' }
        ]
      }
    ];

    for (const cat of categories) {
      const parentId = uuidv4();

      // Insert parent category
      const { error: catError } = await this.tenantDb
        .from('categories')
        .insert({
          id: parentId,
          store_id: this.storeId,
          slug: cat.slug,
          image_url: cat.image_url,
          sort_order: categories.indexOf(cat),
          is_active: true,
          level: 0,
          path: parentId,
          demo: true
        });

      if (catError) {
        console.error(`[DemoData] Error creating category ${cat.name}:`, catError);
        continue;
      }

      this.createdIds.categories.push(parentId);

      // Insert category translation
      await this.tenantDb
        .from('category_translations')
        .insert({
          category_id: parentId,
          language_code: 'en',
          name: cat.name,
          description: cat.description,
          demo: true
        });

      // Insert subcategories
      for (let i = 0; i < cat.subcategories.length; i++) {
        const sub = cat.subcategories[i];
        const subId = uuidv4();

        await this.tenantDb
          .from('categories')
          .insert({
            id: subId,
            store_id: this.storeId,
            slug: sub.slug,
            parent_id: parentId,
            sort_order: i,
            is_active: true,
            level: 1,
            path: `${parentId}/${subId}`,
            demo: true
          });

        this.createdIds.subcategories.push(subId);

        await this.tenantDb
          .from('category_translations')
          .insert({
            category_id: subId,
            language_code: 'en',
            name: sub.name,
            description: sub.description,
            demo: true
          });
      }
    }
  }

  /**
   * Create demo attribute sets
   */
  async createDemoAttributeSets() {
    const attributeSets = [
      { name: 'Electronics', code: 'electronics', description: 'Attributes for electronic products' },
      { name: 'Clothing', code: 'clothing', description: 'Attributes for clothing items' },
      { name: 'Home & Living', code: 'home-living', description: 'Attributes for home products' },
      { name: 'Sports & Outdoors', code: 'sports', description: 'Attributes for sports products' }
    ];

    for (const attrSet of attributeSets) {
      const id = uuidv4();

      const { error } = await this.tenantDb
        .from('attribute_sets')
        .insert({
          id,
          store_id: this.storeId,
          name: attrSet.name,
          description: attrSet.description,
          attribute_ids: [], // Will be populated after attributes are created
          demo: true
        });

      if (!error) {
        this.createdIds.attributeSets.push({ id, code: attrSet.code, name: attrSet.name });
      } else {
        console.error(`[DemoData] Error creating attribute set ${attrSet.name}:`, error);
      }
    }
  }

  /**
   * Create demo attributes with values
   */
  async createDemoAttributes() {
    const attributes = [
      {
        name: 'Brand',
        code: 'brand',
        type: 'select',
        is_filterable: true,
        values: ['Apple', 'Samsung', 'Sony', 'Nike', 'Adidas', 'IKEA', 'Generic'],
        forSets: ['electronics', 'clothing', 'home-living', 'sports'] // All sets
      },
      {
        name: 'Color',
        code: 'color',
        type: 'select',
        is_filterable: true,
        values: ['Black', 'White', 'Blue', 'Red', 'Green', 'Gray', 'Brown'],
        forSets: ['electronics', 'clothing', 'home-living', 'sports']
      },
      {
        name: 'Size',
        code: 'size',
        type: 'select',
        is_filterable: true,
        values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        forSets: ['clothing', 'sports']
      },
      {
        name: 'Material',
        code: 'material',
        type: 'select',
        is_filterable: true,
        values: ['Cotton', 'Polyester', 'Leather', 'Metal', 'Plastic', 'Wood'],
        forSets: ['clothing', 'home-living']
      },
      {
        name: 'Warranty',
        code: 'warranty',
        type: 'select',
        is_filterable: false,
        values: ['1 Year', '2 Years', '3 Years', 'Lifetime'],
        forSets: ['electronics', 'home-living']
      }
    ];

    // Track which attributes belong to which sets
    const setAttributeMap = {};

    for (let i = 0; i < attributes.length; i++) {
      const attr = attributes[i];
      const attrId = uuidv4();

      const { error: attrError } = await this.tenantDb
        .from('attributes')
        .insert({
          id: attrId,
          store_id: this.storeId,
          name: attr.name,
          code: attr.code,
          type: attr.type,
          is_filterable: attr.is_filterable,
          is_searchable: true,
          sort_order: i,
          demo: true
        });

      if (attrError) {
        console.error(`[DemoData] Error creating attribute ${attr.name}:`, attrError);
        continue;
      }

      this.createdIds.attributes.push({ id: attrId, code: attr.code });

      // Track which sets this attribute belongs to
      for (const setCode of attr.forSets) {
        if (!setAttributeMap[setCode]) {
          setAttributeMap[setCode] = [];
        }
        setAttributeMap[setCode].push(attrId);
      }

      // Create attribute translation
      await this.tenantDb
        .from('attribute_translations')
        .insert({
          attribute_id: attrId,
          language_code: 'en',
          label: attr.name,
          demo: true
        });

      // Create attribute values
      for (let j = 0; j < attr.values.length; j++) {
        const valueId = uuidv4();

        await this.tenantDb
          .from('attribute_values')
          .insert({
            id: valueId,
            attribute_id: attrId,
            code: attr.values[j].toLowerCase().replace(/\s+/g, '-'),
            sort_order: j,
            demo: true
          });

        this.createdIds.attributeValues.push({ id: valueId, attrCode: attr.code, value: attr.values[j] });

        await this.tenantDb
          .from('attribute_value_translations')
          .insert({
            attribute_value_id: valueId,
            language_code: 'en',
            value: attr.values[j],
            demo: true
          });
      }
    }

    // Update attribute sets with their attribute IDs
    for (const attrSet of this.createdIds.attributeSets) {
      const attributeIds = setAttributeMap[attrSet.code] || [];
      if (attributeIds.length > 0) {
        const { error: updateError } = await this.tenantDb
          .from('attribute_sets')
          .update({ attribute_ids: attributeIds })
          .eq('id', attrSet.id);

        if (updateError) {
          console.error(`[DemoData] Error updating attribute set ${attrSet.name}:`, updateError);
        }
      }
    }
  }

  /**
   * Create demo products
   */
  async createDemoProducts() {
    const products = [
      // Electronics - use 'electronics' attribute set
      { name: 'Premium Wireless Headphones', sku: 'DEMO-ELEC-001', price: 199.99, compare_price: 249.99, category: 'audio', attrSetCode: 'electronics', description: 'High-quality wireless headphones with active noise cancellation and 30-hour battery life.' },
      { name: 'Bluetooth Speaker Pro', sku: 'DEMO-ELEC-002', price: 79.99, compare_price: 99.99, category: 'audio', attrSetCode: 'electronics', description: 'Portable waterproof speaker with deep bass and 360-degree sound.' },
      { name: 'Smart Watch Series X', sku: 'DEMO-ELEC-003', price: 299.99, compare_price: 349.99, category: 'electronics-accessories', attrSetCode: 'electronics', description: 'Advanced smartwatch with health monitoring, GPS, and cellular connectivity.' },
      { name: 'USB-C Hub 7-in-1', sku: 'DEMO-ELEC-004', price: 49.99, compare_price: null, category: 'electronics-accessories', attrSetCode: 'electronics', description: 'Multi-port adapter with HDMI, USB 3.0, SD card reader, and PD charging.' },
      { name: 'Wireless Charging Pad', sku: 'DEMO-ELEC-005', price: 29.99, compare_price: 39.99, category: 'electronics-accessories', attrSetCode: 'electronics', description: 'Fast wireless charger compatible with all Qi-enabled devices.' },
      { name: 'Noise Cancelling Earbuds', sku: 'DEMO-ELEC-006', price: 149.99, compare_price: 179.99, category: 'audio', attrSetCode: 'electronics', description: 'True wireless earbuds with premium sound and ANC technology.' },

      // Clothing - use 'clothing' attribute set
      { name: 'Classic Cotton T-Shirt', sku: 'DEMO-CLTH-001', price: 24.99, compare_price: null, category: 'mens-wear', attrSetCode: 'clothing', description: 'Comfortable 100% cotton t-shirt in various colors. Perfect for everyday wear.' },
      { name: 'Slim Fit Jeans', sku: 'DEMO-CLTH-002', price: 59.99, compare_price: 79.99, category: 'mens-wear', attrSetCode: 'clothing', description: 'Modern slim fit jeans with stretch comfort and durable construction.' },
      { name: 'Summer Floral Dress', sku: 'DEMO-CLTH-003', price: 49.99, compare_price: 69.99, category: 'womens-wear', attrSetCode: 'clothing', description: 'Light and breezy floral print dress perfect for summer occasions.' },
      { name: 'Leather Belt', sku: 'DEMO-CLTH-004', price: 34.99, compare_price: null, category: 'mens-wear', attrSetCode: 'clothing', description: 'Genuine leather belt with classic buckle design.' },
      { name: 'Running Shoes Pro', sku: 'DEMO-CLTH-005', price: 129.99, compare_price: 159.99, category: 'footwear', attrSetCode: 'clothing', description: 'Lightweight running shoes with responsive cushioning and breathable mesh.' },
      { name: 'Kids Hoodie', sku: 'DEMO-CLTH-006', price: 29.99, compare_price: null, category: 'kids-clothing', attrSetCode: 'clothing', description: 'Cozy pullover hoodie for kids with fun designs.' },

      // Home & Living - use 'home-living' attribute set
      { name: 'Modern Coffee Table', sku: 'DEMO-HOME-001', price: 199.99, compare_price: 249.99, category: 'furniture', attrSetCode: 'home-living', description: 'Sleek modern coffee table with tempered glass top and wooden legs.' },
      { name: 'Ceramic Dinner Set', sku: 'DEMO-HOME-002', price: 89.99, compare_price: null, category: 'kitchen', attrSetCode: 'home-living', description: '16-piece ceramic dinner set for 4, dishwasher safe.' },
      { name: 'Decorative Wall Art', sku: 'DEMO-HOME-003', price: 59.99, compare_price: 79.99, category: 'decor', attrSetCode: 'home-living', description: 'Canvas wall art set of 3 panels with abstract design.' },
      { name: 'Memory Foam Pillow', sku: 'DEMO-HOME-004', price: 44.99, compare_price: null, category: 'bedding', attrSetCode: 'home-living', description: 'Ergonomic memory foam pillow for optimal neck support.' },
      { name: 'LED Desk Lamp', sku: 'DEMO-HOME-005', price: 39.99, compare_price: 49.99, category: 'decor', attrSetCode: 'home-living', description: 'Adjustable LED desk lamp with touch control and USB charging port.' },
      { name: 'Cotton Bed Sheet Set', sku: 'DEMO-HOME-006', price: 69.99, compare_price: 89.99, category: 'bedding', attrSetCode: 'home-living', description: '400 thread count Egyptian cotton sheet set, queen size.' },

      // Sports - use 'sports' attribute set
      { name: 'Yoga Mat Premium', sku: 'DEMO-SPRT-001', price: 49.99, compare_price: null, category: 'fitness-equipment', attrSetCode: 'sports', description: 'Extra thick non-slip yoga mat with carrying strap.' },
      { name: 'Adjustable Dumbbells', sku: 'DEMO-SPRT-002', price: 199.99, compare_price: 249.99, category: 'fitness-equipment', attrSetCode: 'sports', description: 'Space-saving adjustable dumbbells from 5-52.5 lbs per hand.' },
      { name: 'Camping Tent 4-Person', sku: 'DEMO-SPRT-003', price: 149.99, compare_price: 189.99, category: 'outdoor-gear', attrSetCode: 'sports', description: 'Waterproof dome tent with easy setup and ventilation.' },
      { name: 'Sports Water Bottle', sku: 'DEMO-SPRT-004', price: 24.99, compare_price: null, category: 'fitness-equipment', attrSetCode: 'sports', description: 'Insulated stainless steel bottle keeps drinks cold for 24 hours.' },
      { name: 'Athletic Shorts', sku: 'DEMO-SPRT-005', price: 34.99, compare_price: null, category: 'sports-apparel', attrSetCode: 'sports', description: 'Quick-dry athletic shorts with zip pockets.' },
      { name: 'Hiking Backpack 40L', sku: 'DEMO-SPRT-006', price: 89.99, compare_price: 109.99, category: 'outdoor-gear', attrSetCode: 'sports', description: 'Durable hiking backpack with rain cover and hydration compatible.' }
    ];

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const productId = uuidv4();

      // Find category ID by slug
      const { data: categoryData } = await this.tenantDb
        .from('categories')
        .select('id')
        .eq('slug', prod.category)
        .eq('demo', true)
        .maybeSingle();

      const categoryIds = categoryData ? [categoryData.id] : [];

      // Find attribute set ID by code
      const attrSet = this.createdIds.attributeSets.find(as => as.code === prod.attrSetCode);
      const attributeSetId = attrSet ? attrSet.id : null;

      const { error: prodError } = await this.tenantDb
        .from('products')
        .insert({
          id: productId,
          store_id: this.storeId,
          slug: prod.sku.toLowerCase(),
          sku: prod.sku,
          price: prod.price,
          compare_price: prod.compare_price,
          images: [
            { url: `https://picsum.photos/seed/${prod.sku}-1/600/600`, alt: prod.name },
            { url: `https://picsum.photos/seed/${prod.sku}-2/600/600`, alt: `${prod.name} - View 2` },
            { url: `https://picsum.photos/seed/${prod.sku}-3/600/600`, alt: `${prod.name} - View 3` }
          ],
          type: 'simple',
          status: 'active',
          visibility: 'visible',
          manage_stock: true,
          stock_quantity: Math.floor(Math.random() * 100) + 10,
          category_ids: categoryIds,
          attribute_set_id: attributeSetId,
          sort_order: i,
          demo: true
        });

      if (prodError) {
        console.error(`[DemoData] Error creating product ${prod.name}:`, prodError);
        continue;
      }

      this.createdIds.products.push(productId);

      // Create product translation
      await this.tenantDb
        .from('product_translations')
        .insert({
          product_id: productId,
          language_code: 'en',
          name: prod.name,
          description: `<p>${prod.description}</p>`,
          short_description: prod.description.substring(0, 100),
          demo: true
        });
    }
  }

  /**
   * Create demo product tabs
   */
  async createDemoProductTabs() {
    const tabs = [
      { name: 'Description', slug: 'description', tab_type: 'description', sort_order: 0 },
      { name: 'Specifications', slug: 'specifications', tab_type: 'attributes', sort_order: 1 },
      { name: 'Reviews', slug: 'reviews', tab_type: 'text', content: '<p>Customer reviews will appear here.</p>', sort_order: 2 }
    ];

    for (const tab of tabs) {
      await this.tenantDb
        .from('product_tabs')
        .insert({
          id: uuidv4(),
          store_id: this.storeId,
          name: tab.name,
          slug: tab.slug,
          tab_type: tab.tab_type,
          content: tab.content || null,
          sort_order: tab.sort_order,
          is_active: true,
          demo: true
        });
    }
  }

  /**
   * Create demo product labels
   */
  async createDemoProductLabels() {
    const labels = [
      { name: 'New', slug: 'new', text: 'NEW', color: '#ffffff', background_color: '#10b981', position: 'top-left' },
      { name: 'Sale', slug: 'sale', text: 'SALE', color: '#ffffff', background_color: '#ef4444', position: 'top-right' },
      { name: 'Bestseller', slug: 'bestseller', text: 'BEST', color: '#ffffff', background_color: '#f59e0b', position: 'top-left' }
    ];

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      await this.tenantDb
        .from('product_labels')
        .insert({
          id: uuidv4(),
          store_id: this.storeId,
          name: label.name,
          slug: label.slug,
          text: label.text,
          color: label.color,
          background_color: label.background_color,
          position: label.position,
          is_active: true,
          sort_order: i,
          demo: true
        });
    }
  }

  /**
   * Create demo customers
   */
  async createDemoCustomers() {
    const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Lisa', 'James', 'Emma'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor'];

    for (let i = 0; i < 20; i++) {
      const customerId = uuidv4();
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];

      const { error: custError } = await this.tenantDb
        .from('customers')
        .insert({
          id: customerId,
          store_id: this.storeId,
          email: `demo.customer${i + 1}@example.com`,
          first_name: firstName,
          last_name: lastName,
          phone: `+1-555-${String(1000 + i).padStart(4, '0')}`,
          is_active: true,
          customer_type: 'registered',
          total_orders: 0,
          total_spent: 0,
          demo: true
        });

      if (custError) {
        console.error(`[DemoData] Error creating customer:`, custError);
        continue;
      }

      this.createdIds.customers.push(customerId);

      // Create customer address
      await this.tenantDb
        .from('customer_addresses')
        .insert({
          id: uuidv4(),
          customer_id: customerId,
          type: 'both',
          full_name: `${firstName} ${lastName}`,
          street: `${100 + i} Demo Street`,
          city: 'Demo City',
          state: 'CA',
          postal_code: `90${String(i).padStart(3, '0')}`,
          country: 'US',
          is_default: true,
          demo: true
        });
    }
  }

  /**
   * Create demo orders
   */
  async createDemoOrders() {
    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'completed'];
    const paymentStatuses = ['paid', 'pending', 'refunded'];

    for (let i = 0; i < 50; i++) {
      const orderId = uuidv4();
      const customerId = this.createdIds.customers[i % this.createdIds.customers.length];
      const productId = this.createdIds.products[i % this.createdIds.products.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const paymentStatus = status === 'completed' || status === 'delivered' ? 'paid' : paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)];

      // Random date within last 90 days
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 90));

      const subtotal = Math.floor(Math.random() * 300) + 50;
      const taxAmount = Math.round(subtotal * 0.08 * 100) / 100;
      const shippingAmount = subtotal > 100 ? 0 : 9.99;
      const totalAmount = Math.round((subtotal + taxAmount + shippingAmount) * 100) / 100;

      // Get customer info for the address
      const { data: customerData } = await this.tenantDb
        .from('customers')
        .select('first_name, last_name, email')
        .eq('id', customerId)
        .maybeSingle();

      const customerName = customerData ? `${customerData.first_name} ${customerData.last_name}` : 'Demo Customer';
      const customerEmail = customerData ? customerData.email : `demo.customer${i}@example.com`;

      const { error: orderError } = await this.tenantDb
        .from('sales_orders')
        .insert({
          id: orderId,
          store_id: this.storeId,
          order_number: `DEMO-${String(i + 1).padStart(6, '0')}`,
          customer_id: customerId,
          customer_email: customerEmail,
          status,
          payment_status: paymentStatus,
          subtotal,
          tax_amount: taxAmount,
          shipping_amount: shippingAmount,
          total_amount: totalAmount,
          currency: 'USD',
          billing_address: {
            full_name: customerName,
            street: '123 Demo St',
            city: 'Demo City',
            state: 'CA',
            postal_code: '90001',
            country: 'US'
          },
          shipping_address: {
            full_name: customerName,
            street: '123 Demo St',
            city: 'Demo City',
            state: 'CA',
            postal_code: '90001',
            country: 'US'
          },
          created_at: orderDate.toISOString(),
          demo: true
        });

      if (orderError) {
        console.error(`[DemoData] Error creating order:`, orderError);
        continue;
      }

      this.createdIds.orders.push(orderId);

      // Create order item
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = subtotal / quantity;

      await this.tenantDb
        .from('sales_order_items')
        .insert({
          id: uuidv4(),
          order_id: orderId,
          product_id: productId,
          quantity,
          unit_price: unitPrice,
          total_price: subtotal,
          product_name: 'Demo Product',
          product_sku: `DEMO-${i}`,
          demo: true
        });
    }
  }

  /**
   * Create demo CMS content
   */
  async createDemoCMSContent() {
    const pages = [
      {
        slug: 'about-us',
        title: 'About Us',
        content: `
          <div class="prose max-w-none">
            <h1>About Our Store</h1>
            <p>Welcome to our demo store! We are passionate about providing high-quality products at competitive prices.</p>
            <h2>Our Mission</h2>
            <p>To deliver exceptional products and outstanding customer service that exceeds expectations.</p>
            <h2>Our Values</h2>
            <ul>
              <li><strong>Quality:</strong> We never compromise on product quality</li>
              <li><strong>Service:</strong> Customer satisfaction is our priority</li>
              <li><strong>Innovation:</strong> We constantly improve our offerings</li>
            </ul>
          </div>
        `
      },
      {
        slug: 'contact',
        title: 'Contact Us',
        content: `
          <div class="prose max-w-none">
            <h1>Contact Us</h1>
            <p>We'd love to hear from you! Get in touch with our team.</p>
            <h2>Contact Information</h2>
            <ul>
              <li><strong>Email:</strong> demo@example.com</li>
              <li><strong>Phone:</strong> +1 (555) 123-4567</li>
              <li><strong>Address:</strong> 123 Demo Street, Demo City, CA 90001</li>
            </ul>
            <h2>Business Hours</h2>
            <p>Monday - Friday: 9:00 AM - 6:00 PM<br>Saturday: 10:00 AM - 4:00 PM<br>Sunday: Closed</p>
          </div>
        `
      },
      {
        slug: 'faq',
        title: 'FAQ',
        content: `
          <div class="prose max-w-none">
            <h1>Frequently Asked Questions</h1>
            <h3>How long does shipping take?</h3>
            <p>Standard shipping takes 5-7 business days. Express shipping is available for 2-3 day delivery.</p>
            <h3>What is your return policy?</h3>
            <p>We offer a 30-day return policy for unused items in original packaging.</p>
            <h3>Do you ship internationally?</h3>
            <p>Yes, we ship to most countries worldwide. Shipping rates vary by destination.</p>
          </div>
        `
      },
      {
        slug: 'shipping-policy',
        title: 'Shipping Policy',
        content: `
          <div class="prose max-w-none">
            <h1>Shipping Policy</h1>
            <h2>Domestic Shipping</h2>
            <p>Free shipping on orders over $100. Standard shipping: $9.99.</p>
            <h2>International Shipping</h2>
            <p>Rates calculated at checkout based on destination and weight.</p>
          </div>
        `
      },
      {
        slug: 'returns',
        title: 'Returns & Refunds',
        content: `
          <div class="prose max-w-none">
            <h1>Returns & Refunds</h1>
            <p>We want you to be completely satisfied with your purchase.</p>
            <h2>Return Policy</h2>
            <p>Items can be returned within 30 days of delivery for a full refund.</p>
            <h2>How to Return</h2>
            <ol>
              <li>Contact our support team</li>
              <li>Receive a return authorization</li>
              <li>Ship the item back</li>
              <li>Receive your refund within 5-7 business days</li>
            </ol>
          </div>
        `
      }
    ];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageId = uuidv4();

      await this.tenantDb
        .from('cms_pages')
        .insert({
          id: pageId,
          store_id: this.storeId,
          slug: page.slug,
          is_active: true,
          is_system: false,
          sort_order: i,
          demo: true
        });

      await this.tenantDb
        .from('cms_page_translations')
        .insert({
          cms_page_id: pageId,
          language_code: 'en',
          title: page.title,
          content: page.content,
          demo: true
        });
    }

    // Create CMS blocks
    const blocks = [
      {
        identifier: 'homepage-banner',
        title: 'Homepage Banner',
        content: `
          <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-lg text-center">
            <h2 class="text-3xl font-bold mb-4">Welcome to Our Store</h2>
            <p class="text-lg mb-6">Discover amazing products at great prices</p>
            <a href="/products" class="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100">Shop Now</a>
          </div>
        `
      },
      {
        identifier: 'newsletter-signup',
        title: 'Newsletter Signup',
        content: `
          <div class="bg-gray-100 p-6 rounded-lg text-center">
            <h3 class="text-xl font-semibold mb-2">Subscribe to Our Newsletter</h3>
            <p class="text-gray-600 mb-4">Get the latest updates and exclusive offers</p>
          </div>
        `
      }
    ];

    for (const block of blocks) {
      const blockId = uuidv4();

      const { error: blockError } = await this.tenantDb
        .from('cms_blocks')
        .insert({
          id: blockId,
          store_id: this.storeId,
          identifier: block.identifier,
          is_active: true,
          demo: true
        });

      if (blockError) {
        console.error(`[DemoData] Error creating CMS block ${block.identifier}:`, blockError);
        continue;
      }

      const { error: transError } = await this.tenantDb
        .from('cms_block_translations')
        .insert({
          cms_block_id: blockId,
          language_code: 'en',
          title: block.title,
          content: block.content,
          demo: true
        });

      if (transError) {
        console.error(`[DemoData] Error creating CMS block translation ${block.identifier}:`, transError);
      }
    }
  }

  /**
   * Create demo tax configuration
   */
  async createDemoTaxConfiguration() {
    const taxes = [
      {
        name: 'Standard Tax',
        description: 'Standard sales tax',
        is_default: true,
        country_rates: [
          { country: 'US', rate: 8 },
          { country: 'CA', rate: 13 },
          { country: 'GB', rate: 20 },
          { country: 'DE', rate: 19 }
        ]
      },
      {
        name: 'Reduced Rate',
        description: 'Reduced tax for essential items',
        is_default: false,
        country_rates: [
          { country: 'US', rate: 0 },
          { country: 'GB', rate: 5 },
          { country: 'DE', rate: 7 }
        ]
      }
    ];

    for (const tax of taxes) {
      const { error } = await this.tenantDb
        .from('taxes')
        .insert({
          id: uuidv4(),
          store_id: this.storeId,
          name: tax.name,
          description: tax.description,
          is_default: tax.is_default,
          is_active: true,
          country_rates: tax.country_rates, // Pass as native array, not stringified
          demo: true
        });

      if (error) {
        console.error(`[DemoData] Error creating tax ${tax.name}:`, error);
      }
    }
  }

  /**
   * Create demo coupons
   */
  async createDemoCoupons() {
    const coupons = [
      {
        name: 'Welcome Discount',
        code: 'DEMO10',
        description: '10% off your first order',
        discount_type: 'percentage',
        discount_value: 10,
        usage_limit: 100
      },
      {
        name: 'Free Shipping',
        code: 'FREESHIP',
        description: 'Free shipping on orders over $50',
        discount_type: 'free_shipping',
        discount_value: 0,
        min_purchase_amount: 50
      },
      {
        name: 'Summer Sale',
        code: 'SUMMER20',
        description: '$20 off orders over $100',
        discount_type: 'fixed',
        discount_value: 20,
        min_purchase_amount: 100
      }
    ];

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);

    for (const coupon of coupons) {
      await this.tenantDb
        .from('coupons')
        .insert({
          id: uuidv4(),
          store_id: this.storeId,
          name: coupon.name,
          code: coupon.code,
          description: coupon.description,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          min_purchase_amount: coupon.min_purchase_amount || 0,
          usage_limit: coupon.usage_limit || null,
          usage_count: 0,
          is_active: true,
          start_date: new Date().toISOString(),
          end_date: endDate.toISOString(),
          demo: true
        });
    }
  }

  /**
   * Create demo SEO templates
   */
  async createDemoSEOTemplates() {
    const templates = [
      {
        name: 'Product SEO Template',
        type: 'product',
        template: {
          meta_title: '{{product.name}} | Buy Online',
          meta_description: 'Shop {{product.name}} at great prices. {{product.short_description}}',
          og_title: '{{product.name}}',
          og_description: '{{product.short_description}}'
        }
      },
      {
        name: 'Category SEO Template',
        type: 'category',
        template: {
          meta_title: '{{category.name}} - Shop Our Collection',
          meta_description: 'Browse our {{category.name}} collection. {{category.description}}',
          og_title: '{{category.name}} Collection',
          og_description: '{{category.description}}'
        }
      },
      {
        name: 'CMS Page SEO Template',
        type: 'cms_page',
        template: {
          meta_title: '{{page.title}} | Our Store',
          meta_description: '{{page.excerpt}}',
          og_title: '{{page.title}}',
          og_description: '{{page.excerpt}}'
        }
      }
    ];

    for (let i = 0; i < templates.length; i++) {
      const tpl = templates[i];
      const { error } = await this.tenantDb
        .from('seo_templates')
        .insert({
          id: uuidv4(),
          store_id: this.storeId,
          name: tpl.name,
          type: tpl.type,
          meta_title: tpl.template.meta_title,
          meta_description: tpl.template.meta_description,
          og_title: tpl.template.og_title,
          og_description: tpl.template.og_description,
          template: tpl.template, // Pass as native object
          is_active: true,
          sort_order: i,
          demo: true
        });

      if (error) {
        console.error(`[DemoData] Error creating SEO template ${tpl.name}:`, error);
      }
    }
  }

  /**
   * Update store status to demo
   */
  async updateStoreStatus(status) {
    const { error } = await masterDbClient
      .from('stores')
      .update({
        status,
        published: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.storeId);

    if (error) {
      throw new Error(`Failed to update store status: ${error.message}`);
    }
  }

  /**
   * Get provisioning summary
   */
  getProvisioningSummary() {
    return {
      categories: this.createdIds.categories.length,
      subcategories: this.createdIds.subcategories.length,
      attributeSets: this.createdIds.attributeSets.length,
      attributes: this.createdIds.attributes.length,
      products: this.createdIds.products.length,
      customers: this.createdIds.customers.length,
      orders: this.createdIds.orders.length,
      cmsPages: 5,
      cmsBlocks: 2,
      taxes: 2,
      coupons: 3,
      seoTemplates: 3,
      productTabs: 3,
      productLabels: 3
    };
  }
}

module.exports = DemoDataProvisioningService;
