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

      console.log('[DemoData] Creating custom option rules...');
      await this.createDemoCustomOptionRules();

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
   * Note: price = regular price, compare_price = sale/discounted price (shown with strikethrough on regular)
   */
  async createDemoProducts() {
    // Realistic product images from Unsplash
    const productImages = {
      // Electronics
      'DEMO-ELEC-001': ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=600&h=600&fit=crop'],
      'DEMO-ELEC-002': ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1589003077984-894e133dabab?w=600&h=600&fit=crop'],
      'DEMO-ELEC-003': ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=600&h=600&fit=crop'],
      'DEMO-ELEC-004': ['https://images.unsplash.com/photo-1625723044792-44de16ccb4e9?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop'],
      'DEMO-ELEC-005': ['https://images.unsplash.com/photo-1586816879360-004f5b0c51e3?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1622675363311-3e1904dc1885?w=600&h=600&fit=crop'],
      'DEMO-ELEC-006': ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600&h=600&fit=crop'],
      // Clothing
      'DEMO-CLTH-001': ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=600&h=600&fit=crop'],
      'DEMO-CLTH-002': ['https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&h=600&fit=crop'],
      'DEMO-CLTH-003': ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=600&fit=crop'],
      'DEMO-CLTH-004': ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=600&h=600&fit=crop'],
      'DEMO-CLTH-005': ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=600&h=600&fit=crop'],
      'DEMO-CLTH-006': ['https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&h=600&fit=crop'],
      // Home & Living
      'DEMO-HOME-001': ['https://images.unsplash.com/photo-1533090481720-856c6e3c1fdc?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop'],
      'DEMO-HOME-002': ['https://images.unsplash.com/photo-1603199506016-5d54ebfc0173?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=600&h=600&fit=crop'],
      'DEMO-HOME-003': ['https://images.unsplash.com/photo-1513519245088-0e12902e35ca?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=600&fit=crop'],
      'DEMO-HOME-004': ['https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1592789705501-f9ae4287c4e9?w=600&h=600&fit=crop'],
      'DEMO-HOME-005': ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=600&h=600&fit=crop'],
      'DEMO-HOME-006': ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=600&h=600&fit=crop'],
      // Sports
      'DEMO-SPRT-001': ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=600&fit=crop'],
      'DEMO-SPRT-002': ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&h=600&fit=crop'],
      'DEMO-SPRT-003': ['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&h=600&fit=crop'],
      'DEMO-SPRT-004': ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=600&h=600&fit=crop'],
      'DEMO-SPRT-005': ['https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1562886877-f12251816e01?w=600&h=600&fit=crop'],
      'DEMO-SPRT-006': ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=600&fit=crop', 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?w=600&h=600&fit=crop']
    };

    // Map subcategory slugs to parent category slugs
    const categoryParentMap = {
      'smartphones': 'electronics', 'laptops': 'electronics', 'audio': 'electronics', 'electronics-accessories': 'electronics',
      'mens-wear': 'clothing', 'womens-wear': 'clothing', 'kids-clothing': 'clothing', 'footwear': 'clothing',
      'furniture': 'home-living', 'kitchen': 'home-living', 'decor': 'home-living', 'bedding': 'home-living',
      'fitness-equipment': 'sports-outdoors', 'outdoor-gear': 'sports-outdoors', 'sports-apparel': 'sports-outdoors'
    };

    const products = [
      // Electronics
      { name: 'Premium Wireless Headphones', sku: 'DEMO-ELEC-001', price: 249.99, compare_price: 199.99, category: 'audio', attrSetCode: 'electronics', description: 'High-quality wireless headphones with active noise cancellation and 30-hour battery life.' },
      { name: 'Bluetooth Speaker Pro', sku: 'DEMO-ELEC-002', price: 99.99, compare_price: 79.99, category: 'audio', attrSetCode: 'electronics', description: 'Portable waterproof speaker with deep bass and 360-degree sound.' },
      { name: 'Smart Watch Series X', sku: 'DEMO-ELEC-003', price: 349.99, compare_price: 299.99, category: 'electronics-accessories', attrSetCode: 'electronics', description: 'Advanced smartwatch with health monitoring, GPS, and cellular connectivity.' },
      { name: 'USB-C Hub 7-in-1', sku: 'DEMO-ELEC-004', price: 49.99, compare_price: null, category: 'electronics-accessories', attrSetCode: 'electronics', description: 'Multi-port adapter with HDMI, USB 3.0, SD card reader, and PD charging.' },
      { name: 'Wireless Charging Pad', sku: 'DEMO-ELEC-005', price: 39.99, compare_price: 29.99, category: 'electronics-accessories', attrSetCode: 'electronics', description: 'Fast wireless charger compatible with all Qi-enabled devices.' },
      { name: 'Noise Cancelling Earbuds', sku: 'DEMO-ELEC-006', price: 179.99, compare_price: 149.99, category: 'audio', attrSetCode: 'electronics', description: 'True wireless earbuds with premium sound and ANC technology.' },
      // Clothing
      { name: 'Classic Cotton T-Shirt', sku: 'DEMO-CLTH-001', price: 24.99, compare_price: null, category: 'mens-wear', attrSetCode: 'clothing', description: 'Comfortable 100% cotton t-shirt in various colors. Perfect for everyday wear.' },
      { name: 'Slim Fit Jeans', sku: 'DEMO-CLTH-002', price: 79.99, compare_price: 59.99, category: 'mens-wear', attrSetCode: 'clothing', description: 'Modern slim fit jeans with stretch comfort and durable construction.' },
      { name: 'Summer Floral Dress', sku: 'DEMO-CLTH-003', price: 69.99, compare_price: 49.99, category: 'womens-wear', attrSetCode: 'clothing', description: 'Light and breezy floral print dress perfect for summer occasions.' },
      { name: 'Leather Belt', sku: 'DEMO-CLTH-004', price: 34.99, compare_price: null, category: 'mens-wear', attrSetCode: 'clothing', description: 'Genuine leather belt with classic buckle design.' },
      { name: 'Running Shoes Pro', sku: 'DEMO-CLTH-005', price: 159.99, compare_price: 129.99, category: 'footwear', attrSetCode: 'clothing', description: 'Lightweight running shoes with responsive cushioning and breathable mesh.' },
      { name: 'Kids Hoodie', sku: 'DEMO-CLTH-006', price: 29.99, compare_price: null, category: 'kids-clothing', attrSetCode: 'clothing', description: 'Cozy pullover hoodie for kids with fun designs.' },
      // Home & Living
      { name: 'Modern Coffee Table', sku: 'DEMO-HOME-001', price: 249.99, compare_price: 199.99, category: 'furniture', attrSetCode: 'home-living', description: 'Sleek modern coffee table with tempered glass top and wooden legs.' },
      { name: 'Ceramic Dinner Set', sku: 'DEMO-HOME-002', price: 89.99, compare_price: null, category: 'kitchen', attrSetCode: 'home-living', description: '16-piece ceramic dinner set for 4, dishwasher safe.' },
      { name: 'Decorative Wall Art', sku: 'DEMO-HOME-003', price: 79.99, compare_price: 59.99, category: 'decor', attrSetCode: 'home-living', description: 'Canvas wall art set of 3 panels with abstract design.' },
      { name: 'Memory Foam Pillow', sku: 'DEMO-HOME-004', price: 44.99, compare_price: null, category: 'bedding', attrSetCode: 'home-living', description: 'Ergonomic memory foam pillow for optimal neck support.' },
      { name: 'LED Desk Lamp', sku: 'DEMO-HOME-005', price: 49.99, compare_price: 39.99, category: 'decor', attrSetCode: 'home-living', description: 'Adjustable LED desk lamp with touch control and USB charging port.' },
      { name: 'Cotton Bed Sheet Set', sku: 'DEMO-HOME-006', price: 89.99, compare_price: 69.99, category: 'bedding', attrSetCode: 'home-living', description: '400 thread count Egyptian cotton sheet set, queen size.' },
      // Sports
      { name: 'Yoga Mat Premium', sku: 'DEMO-SPRT-001', price: 49.99, compare_price: null, category: 'fitness-equipment', attrSetCode: 'sports', description: 'Extra thick non-slip yoga mat with carrying strap.' },
      { name: 'Adjustable Dumbbells', sku: 'DEMO-SPRT-002', price: 249.99, compare_price: 199.99, category: 'fitness-equipment', attrSetCode: 'sports', description: 'Space-saving adjustable dumbbells from 5-52.5 lbs per hand.' },
      { name: 'Camping Tent 4-Person', sku: 'DEMO-SPRT-003', price: 189.99, compare_price: 149.99, category: 'outdoor-gear', attrSetCode: 'sports', description: 'Waterproof dome tent with easy setup and ventilation.' },
      { name: 'Sports Water Bottle', sku: 'DEMO-SPRT-004', price: 24.99, compare_price: null, category: 'fitness-equipment', attrSetCode: 'sports', description: 'Insulated stainless steel bottle keeps drinks cold for 24 hours.' },
      { name: 'Athletic Shorts', sku: 'DEMO-SPRT-005', price: 34.99, compare_price: null, category: 'sports-apparel', attrSetCode: 'sports', description: 'Quick-dry athletic shorts with zip pockets.' },
      { name: 'Hiking Backpack 40L', sku: 'DEMO-SPRT-006', price: 109.99, compare_price: 89.99, category: 'outdoor-gear', attrSetCode: 'sports', description: 'Durable hiking backpack with rain cover and hydration compatible.' }
    ];

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const productId = uuidv4();

      // Find subcategory ID by slug
      const { data: subCategoryData } = await this.tenantDb
        .from('categories')
        .select('id, parent_id')
        .eq('slug', prod.category)
        .eq('demo', true)
        .maybeSingle();

      // Build category_ids array with both parent and subcategory
      const categoryIds = [];
      if (subCategoryData) {
        categoryIds.push(subCategoryData.id);
        // Also add parent category
        if (subCategoryData.parent_id) {
          categoryIds.push(subCategoryData.parent_id);
        } else {
          // Find parent by slug mapping
          const parentSlug = categoryParentMap[prod.category];
          if (parentSlug) {
            const { data: parentData } = await this.tenantDb
              .from('categories')
              .select('id')
              .eq('slug', parentSlug)
              .eq('demo', true)
              .maybeSingle();
            if (parentData) {
              categoryIds.push(parentData.id);
            }
          }
        }
      }

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
          type: 'simple',
          status: 'active',
          visibility: 'visible',
          manage_stock: true,
          stock_quantity: Math.floor(Math.random() * 100) + 10,
          category_ids: categoryIds,
          attribute_set_id: attributeSetId,
          sort_order: i,
          featured: false,
          demo: true
        });

      if (prodError) {
        console.error(`[DemoData] Error creating product ${prod.name}:`, prodError);
        continue;
      }

      this.createdIds.products.push({ id: productId, sku: prod.sku, name: prod.name });

      // Create product images in product_files table using realistic images
      const images = productImages[prod.sku] || [];
      for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
        const { error: imgError } = await this.tenantDb
          .from('product_files')
          .insert({
            id: uuidv4(),
            product_id: productId,
            store_id: this.storeId,
            file_url: images[imgIdx],
            file_type: 'image',
            position: imgIdx,
            is_primary: imgIdx === 0,
            alt_text: imgIdx === 0 ? prod.name : `${prod.name} - View ${imgIdx + 1}`,
            mime_type: 'image/jpeg',
            demo: true
          });

        if (imgError) {
          console.error(`[DemoData] Error creating product image for ${prod.name}:`, imgError);
        }
      }

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

      // Create product attribute values
      await this.createProductAttributeValues(productId, prod.attrSetCode);
    }

    // Randomly select 6-8 products to be featured
    await this.setRandomFeaturedProducts();
  }

  /**
   * Randomly select products to be marked as featured
   */
  async setRandomFeaturedProducts() {
    const productIds = this.createdIds.products.map(p => p.id);
    if (productIds.length === 0) {
      console.log('[DemoData] No products to mark as featured');
      return;
    }

    // Randomly select 6-8 products (or all if less than 6)
    const numFeatured = Math.min(productIds.length, Math.floor(Math.random() * 3) + 6); // 6-8 products

    // Shuffle array and take first N
    const shuffled = [...productIds].sort(() => Math.random() - 0.5);
    const featuredIds = shuffled.slice(0, numFeatured);

    console.log(`[DemoData] Marking ${featuredIds.length} random products as featured`);

    // Update products to be featured
    for (const productId of featuredIds) {
      const { error } = await this.tenantDb
        .from('products')
        .update({ featured: true })
        .eq('id', productId)
        .eq('store_id', this.storeId);

      if (error) {
        console.error(`[DemoData] Error marking product ${productId} as featured:`, error);
      }
    }

    console.log(`[DemoData] Successfully marked ${featuredIds.length} products as featured`);
  }

  /**
   * Create attribute values for a product based on its attribute set
   */
  async createProductAttributeValues(productId, attrSetCode) {
    console.log(`[DemoData] createProductAttributeValues called for product ${productId}, attrSetCode: ${attrSetCode}`);
    console.log(`[DemoData] Available attributes: ${this.createdIds.attributes.length}, values: ${this.createdIds.attributeValues.length}`);

    // Get random attribute values to assign
    const brandAttr = this.createdIds.attributes.find(a => a.code === 'brand');
    const colorAttr = this.createdIds.attributes.find(a => a.code === 'color');
    const sizeAttr = this.createdIds.attributes.find(a => a.code === 'size');
    const materialAttr = this.createdIds.attributes.find(a => a.code === 'material');
    const warrantyAttr = this.createdIds.attributes.find(a => a.code === 'warranty');

    console.log(`[DemoData] Found attrs - brand: ${!!brandAttr}, color: ${!!colorAttr}, size: ${!!sizeAttr}, material: ${!!materialAttr}, warranty: ${!!warrantyAttr}`);

    // Get random values for each attribute
    const brandValues = this.createdIds.attributeValues.filter(v => v.attrCode === 'brand');
    const colorValues = this.createdIds.attributeValues.filter(v => v.attrCode === 'color');
    const sizeValues = this.createdIds.attributeValues.filter(v => v.attrCode === 'size');
    const materialValues = this.createdIds.attributeValues.filter(v => v.attrCode === 'material');
    const warrantyValues = this.createdIds.attributeValues.filter(v => v.attrCode === 'warranty');

    console.log(`[DemoData] Found values - brand: ${brandValues.length}, color: ${colorValues.length}, size: ${sizeValues.length}, material: ${materialValues.length}, warranty: ${warrantyValues.length}`);

    const attributesToAssign = [];

    // All products get brand and color
    if (brandAttr && brandValues.length > 0) {
      const randomBrand = brandValues[Math.floor(Math.random() * brandValues.length)];
      attributesToAssign.push({
        id: uuidv4(),
        product_id: productId,
        attribute_id: brandAttr.id,
        value_id: randomBrand.id,
        demo: true
      });
    }

    if (colorAttr && colorValues.length > 0) {
      const randomColor = colorValues[Math.floor(Math.random() * colorValues.length)];
      attributesToAssign.push({
        id: uuidv4(),
        product_id: productId,
        attribute_id: colorAttr.id,
        value_id: randomColor.id,
        demo: true
      });
    }

    // Clothing and sports get size
    if ((attrSetCode === 'clothing' || attrSetCode === 'sports') && sizeAttr && sizeValues.length > 0) {
      const randomSize = sizeValues[Math.floor(Math.random() * sizeValues.length)];
      attributesToAssign.push({
        id: uuidv4(),
        product_id: productId,
        attribute_id: sizeAttr.id,
        value_id: randomSize.id,
        demo: true
      });
    }

    // Clothing and home get material
    if ((attrSetCode === 'clothing' || attrSetCode === 'home-living') && materialAttr && materialValues.length > 0) {
      const randomMaterial = materialValues[Math.floor(Math.random() * materialValues.length)];
      attributesToAssign.push({
        id: uuidv4(),
        product_id: productId,
        attribute_id: materialAttr.id,
        value_id: randomMaterial.id,
        demo: true
      });
    }

    // Electronics and home get warranty
    if ((attrSetCode === 'electronics' || attrSetCode === 'home-living') && warrantyAttr && warrantyValues.length > 0) {
      const randomWarranty = warrantyValues[Math.floor(Math.random() * warrantyValues.length)];
      attributesToAssign.push({
        id: uuidv4(),
        product_id: productId,
        attribute_id: warrantyAttr.id,
        value_id: randomWarranty.id,
        demo: true
      });
    }

    // Insert all attribute values
    console.log(`[DemoData] Inserting ${attributesToAssign.length} attribute values for product ${productId}`);

    for (const attrValue of attributesToAssign) {
      const { error } = await this.tenantDb
        .from('product_attribute_values')
        .insert(attrValue);

      if (error) {
        console.error(`[DemoData] Error creating product attribute value:`, error);
      }
    }

    console.log(`[DemoData] Successfully created ${attributesToAssign.length} attribute values for product ${productId}`);
  }

  /**
   * Create demo product tabs
   */
  async createDemoProductTabs() {
    // Get all attribute set IDs for Specifications tab
    const attributeSetIds = this.createdIds.attributeSets.map(as => as.id);

    const tabs = [
      { name: 'Description', slug: 'description', tab_type: 'description', sort_order: 0 },
      { name: 'Specifications', slug: 'specifications', tab_type: 'attribute_sets', sort_order: 1, attribute_set_ids: attributeSetIds },
      { name: 'Reviews', slug: 'reviews', tab_type: 'text', content: '<p>Customer reviews will appear here.</p>', sort_order: 2 }
    ];

    for (const tab of tabs) {
      const { error } = await this.tenantDb
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
          attribute_set_ids: tab.attribute_set_ids || [],
          demo: true
        });

      if (error) {
        console.error(`[DemoData] Error creating product tab ${tab.name}:`, error);
      }
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
   * Create demo custom option rules and mark some products as custom options
   */
  async createDemoCustomOptionRules() {
    // First, mark some products as custom options (these can be added to other products)
    // We'll mark 3 products as custom options: gift wrapping, extended warranty, and priority shipping
    const customOptionProducts = [
      {
        name: 'Gift Wrapping Service',
        sku: 'DEMO-CUSTOM-001',
        price: 4.99,
        description: 'Beautiful gift wrapping with ribbon and card. Perfect for special occasions.'
      },
      {
        name: 'Extended Warranty - 2 Year',
        sku: 'DEMO-CUSTOM-002',
        price: 29.99,
        description: 'Extend your product warranty by an additional 2 years for peace of mind.'
      },
      {
        name: 'Priority Shipping Upgrade',
        sku: 'DEMO-CUSTOM-003',
        price: 9.99,
        description: 'Upgrade to priority shipping for faster delivery (2-3 business days).'
      }
    ];

    const customOptionProductIds = [];

    for (let i = 0; i < customOptionProducts.length; i++) {
      const prod = customOptionProducts[i];
      const productId = uuidv4();

      const { data: insertedProduct, error: prodError } = await this.tenantDb
        .from('products')
        .insert({
          id: productId,
          store_id: this.storeId,
          slug: prod.sku.toLowerCase(),
          sku: prod.sku,
          price: prod.price,
          compare_price: null,
          type: 'simple',
          status: 'active',
          visibility: 'not_visible', // Custom options are not visible in catalog
          manage_stock: false,
          infinite_stock: true, // Always in stock
          stock_quantity: 9999, // High stock for display purposes
          is_custom_option: true, // This marks it as a custom option product
          sort_order: 100 + i,
          demo: true
        })
        .select('id')
        .single();

      if (prodError) {
        console.error(`[DemoData] Error creating custom option product ${prod.name}:`, prodError);
        continue;
      }

      customOptionProductIds.push(productId);
      this.createdIds.products.push({ id: productId, sku: prod.sku, name: prod.name });

      // Create product translation
      await this.tenantDb
        .from('product_translations')
        .insert({
          product_id: productId,
          language_code: 'en',
          name: prod.name,
          description: `<p>${prod.description}</p>`,
          short_description: prod.description,
          demo: true
        });

      // Create a simple product image for custom options
      await this.tenantDb
        .from('product_files')
        .insert({
          id: uuidv4(),
          product_id: productId,
          store_id: this.storeId,
          file_url: `https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&h=600&fit=crop`,
          file_type: 'image',
          position: 0,
          is_primary: true,
          alt_text: prod.name,
          mime_type: 'image/jpeg',
          demo: true
        });
    }

    // Now create custom option rules that make these products available as options for other products
    if (customOptionProductIds.length > 0) {
      // Rule 1: Gift Wrapping for all products
      const { error: rule1Error } = await this.tenantDb
        .from('custom_option_rules')
        .insert({
          id: uuidv4(),
          store_id: this.storeId,
          name: 'Gift Wrapping Available',
          display_label: 'Add Gift Wrapping',
          is_active: true,
          conditions: { applies_to: 'all' },
          optional_product_ids: [customOptionProductIds[0]], // Gift wrapping product
          translations: {
            en: { display_label: 'Add Gift Wrapping', description: 'Add beautiful gift wrapping to your order' }
          },
          demo: true
        });

      if (rule1Error) {
        console.error('[DemoData] Error creating gift wrapping rule:', rule1Error);
      }

      // Rule 2: Extended Warranty for Electronics
      if (customOptionProductIds.length > 1) {
        const { error: rule2Error } = await this.tenantDb
          .from('custom_option_rules')
          .insert({
            id: uuidv4(),
            store_id: this.storeId,
            name: 'Extended Warranty - Electronics',
            display_label: 'Add Extended Warranty',
            is_active: true,
            conditions: { category_slug: 'electronics', applies_to: 'category' },
            optional_product_ids: [customOptionProductIds[1]], // Extended warranty product
            translations: {
              en: { display_label: 'Add Extended Warranty', description: 'Protect your electronics with extended warranty' }
            },
            demo: true
          });

        if (rule2Error) {
          console.error('[DemoData] Error creating extended warranty rule:', rule2Error);
        }
      }

      // Rule 3: Priority Shipping for all products (multiple options example)
      if (customOptionProductIds.length > 2) {
        const { error: rule3Error } = await this.tenantDb
          .from('custom_option_rules')
          .insert({
            id: uuidv4(),
            store_id: this.storeId,
            name: 'Shipping Upgrades',
            display_label: 'Upgrade Shipping',
            is_active: true,
            conditions: { applies_to: 'all' },
            optional_product_ids: [customOptionProductIds[2]], // Priority shipping
            translations: {
              en: { display_label: 'Upgrade Shipping', description: 'Get your order faster with shipping upgrades' }
            },
            demo: true
          });

        if (rule3Error) {
          console.error('[DemoData] Error creating shipping upgrade rule:', rule3Error);
        }
      }
    }

    this.createdIds.customOptionRules = customOptionProductIds.length;
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

    console.log(`[DemoData] Creating ${pages.length} CMS pages...`);
    let pagesCreated = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageId = uuidv4();

      // Check if page with same slug already exists - skip if so
      const { data: existingPage } = await this.tenantDb
        .from('cms_pages')
        .select('id')
        .eq('store_id', this.storeId)
        .eq('slug', page.slug)
        .maybeSingle();

      if (existingPage) {
        console.log(`[DemoData] CMS page ${page.slug} already exists, skipping...`);
        continue;
      }

      const { error: pageError } = await this.tenantDb
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

      if (pageError) {
        console.error(`[DemoData] Error creating CMS page ${page.slug}:`, pageError);
        continue;
      }

      const { error: transError } = await this.tenantDb
        .from('cms_page_translations')
        .insert({
          cms_page_id: pageId,
          language_code: 'en',
          title: page.title,
          content: page.content,
          demo: true
        });

      if (transError) {
        console.error(`[DemoData] Error creating CMS page translation ${page.slug}:`, transError);
      } else {
        pagesCreated++;
        console.log(`[DemoData] Created CMS page: ${page.slug}`);
      }
    }

    console.log(`[DemoData] CMS pages created: ${pagesCreated}/${pages.length}`);

    // Create CMS blocks for various placement locations
    // Placements must match actual slot cmsPosition values from config files
    const blocks = [
      // ==================== HOMEPAGE BLOCKS ====================
      {
        identifier: 'homepage-hero',
        title: 'Homepage Hero Banner',
        placement: ['homepage_hero'],
        content: `
          <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white">
            <div class="absolute inset-0 bg-black/10"></div>
            <div class="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
            <div class="absolute -bottom-24 -left-24 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
            <div class="relative px-8 py-16 md:py-24 text-center">
              <span class="inline-block px-4 py-1 mb-4 text-sm font-medium bg-white/20 rounded-full backdrop-blur-sm">New Season Collection</span>
              <h1 class="text-4xl md:text-6xl font-bold mb-6 tracking-tight">Discover Your Style</h1>
              <p class="text-xl md:text-2xl mb-8 text-white/90 max-w-2xl mx-auto">Curated collections that define modern elegance. Premium quality, exceptional value.</p>
              <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/products" class="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold bg-white text-indigo-600 rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg">
                  Shop Collection
                  <svg class="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                </a>
                <a href="/categories" class="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold border-2 border-white/50 rounded-xl hover:bg-white/10 transition-all">
                  Browse Categories
                </a>
              </div>
            </div>
          </div>
        `
      },
      {
        identifier: 'homepage-promo-banner',
        title: 'Promo Banner',
        placement: ['homepage_above_hero'],
        content: `
          <div class="bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 text-white py-3 px-4">
            <div class="flex items-center justify-center gap-3 text-sm md:text-base font-medium">
              <span class="animate-pulse">🔥</span>
              <span>LIMITED TIME: Free shipping on orders over $100!</span>
              <span class="hidden md:inline">|</span>
              <span class="hidden md:inline">Use code: <strong class="bg-white/20 backdrop-blur px-2 py-0.5 rounded font-mono">FREESHIP</strong></span>
              <span class="animate-pulse">🔥</span>
            </div>
          </div>
        `
      },
      {
        identifier: 'homepage-features',
        title: 'Homepage Features',
        placement: ['homepage_below_hero'],
        content: `
          <div class="py-12 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto px-4">
              <div class="group text-center p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:bg-white/10 transition-all duration-300">
                <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/25">
                  <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                </div>
                <h3 class="font-bold text-white mb-2">Free Shipping</h3>
                <p class="text-slate-400 text-sm">On all orders over $100. Fast & reliable delivery.</p>
              </div>
              <div class="group text-center p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:bg-white/10 transition-all duration-300">
                <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/25">
                  <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </div>
                <h3 class="font-bold text-white mb-2">Easy Returns</h3>
                <p class="text-slate-400 text-sm">30-day hassle-free return policy. No questions asked.</p>
              </div>
              <div class="group text-center p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:bg-white/10 transition-all duration-300">
                <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-violet-400 to-purple-500 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg shadow-violet-500/25">
                  <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                </div>
                <h3 class="font-bold text-white mb-2">Secure Payment</h3>
                <p class="text-slate-400 text-sm">256-bit SSL encryption. Your data is always safe.</p>
              </div>
              <div class="group text-center p-6 rounded-2xl bg-white/5 backdrop-blur border border-white/10 hover:bg-white/10 transition-all duration-300">
                <div class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-rose-400 to-pink-500 rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg shadow-rose-500/25">
                  <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                </div>
                <h3 class="font-bold text-white mb-2">24/7 Support</h3>
                <p class="text-slate-400 text-sm">Expert assistance whenever you need it.</p>
              </div>
            </div>
          </div>
        `
      },
      {
        identifier: 'newsletter-signup',
        title: 'Newsletter Signup',
        placement: ['homepage_below_content', 'footer'],
        content: `
          <div class="relative overflow-hidden bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 md:p-12 my-8">
            <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"30\" height=\"30\" viewBox=\"0 0 30 30\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cpath d=\"M1.22676 0C1.91374 0 2.45351 0.539773 2.45351 1.22676C2.45351 1.91374 1.91374 2.45351 1.22676 2.45351C0.539773 2.45351 0 1.91374 0 1.22676C0 0.539773 0.539773 0 1.22676 0Z\" fill=\"rgba(255,255,255,0.05)\"%3E%3C/path%3E%3C/svg%3E')] opacity-50"></div>
            <div class="relative text-center max-w-2xl mx-auto">
              <span class="inline-block px-4 py-1 mb-4 text-xs font-semibold tracking-wider text-emerald-400 bg-emerald-400/10 rounded-full uppercase">Newsletter</span>
              <h3 class="text-3xl md:text-4xl font-bold text-white mb-4">Stay in the Loop</h3>
              <p class="text-gray-400 mb-6 text-lg">Subscribe for exclusive deals, early access to new arrivals, and insider tips delivered straight to your inbox.</p>
              <div class="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <div class="flex-1 relative">
                  <input type="email" placeholder="Enter your email" class="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
                </div>
                <button class="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/25">
                  Subscribe
                </button>
              </div>
              <p class="text-gray-500 text-sm mt-4">No spam, unsubscribe anytime. We respect your privacy.</p>
            </div>
          </div>
        `
      },
      // ==================== PRODUCT PAGE BLOCKS ====================
      {
        identifier: 'product-promo-banner',
        title: 'Product Page Promo',
        placement: ['product_above'],
        content: `
          <div class="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-xl p-4 mb-6">
            <div class="absolute -right-8 -top-8 w-24 h-24 bg-white/20 rounded-full blur-2xl"></div>
            <div class="relative flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                  <span class="text-xl">🎁</span>
                </div>
                <div>
                  <p class="font-semibold text-white">Bundle & Save!</p>
                  <p class="text-sm text-white/80">Buy 2+ items and get 10% off automatically</p>
                </div>
              </div>
              <span class="hidden md:block px-3 py-1 bg-white/20 backdrop-blur text-white text-sm font-bold rounded-lg">AUTO-APPLIED</span>
            </div>
          </div>
        `
      },
      {
        identifier: 'product-trust-badges',
        title: 'Product Trust Badges',
        placement: ['product_above_price'],
        content: `
          <div class="flex flex-wrap items-center gap-4 py-3 mb-2">
            <div class="flex items-center gap-2 text-sm">
              <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
              </div>
              <span class="text-green-700 font-medium">In Stock</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <div class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
              </div>
              <span class="text-blue-700 font-medium">100% Authentic</span>
            </div>
            <div class="flex items-center gap-2 text-sm">
              <div class="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
              </div>
              <span class="text-purple-700 font-medium">Top Rated</span>
            </div>
          </div>
        `
      },
      {
        identifier: 'product-shipping-info',
        title: 'Product Shipping Info',
        placement: ['product_below'],
        content: `
          <div class="mt-8 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 rounded-2xl p-6">
            <h4 class="font-bold text-white mb-4 flex items-center gap-2">
              <svg class="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Shipping & Returns
            </h4>
            <div class="grid md:grid-cols-3 gap-4">
              <div class="flex items-start gap-3 p-4 bg-white/10 backdrop-blur rounded-xl">
                <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                </div>
                <div>
                  <p class="font-medium text-white">Free Shipping</p>
                  <p class="text-sm text-white/70">On orders over $100</p>
                </div>
              </div>
              <div class="flex items-start gap-3 p-4 bg-white/10 backdrop-blur rounded-xl">
                <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                  <p class="font-medium text-white">Fast Delivery</p>
                  <p class="text-sm text-white/70">Ships in 1-2 days</p>
                </div>
              </div>
              <div class="flex items-start gap-3 p-4 bg-white/10 backdrop-blur rounded-xl">
                <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </div>
                <div>
                  <p class="font-medium text-white">Easy Returns</p>
                  <p class="text-sm text-white/70">30-day guarantee</p>
                </div>
              </div>
            </div>
          </div>
        `
      },
      // ==================== GLOBAL BLOCKS ====================
      {
        identifier: 'site-announcement',
        title: 'Site Announcement',
        placement: ['header'],
        content: `
          <div class="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white py-2.5 px-4">
            <div class="flex items-center justify-center gap-2 text-sm font-medium">
              <svg class="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clip-rule="evenodd"></path></svg>
              <span>New arrivals every week!</span>
              <a href="/products" class="underline decoration-2 underline-offset-2 hover:text-white/80 transition-colors">Shop now →</a>
            </div>
          </div>
        `
      },
      // ==================== CHECKOUT BLOCKS ====================
      {
        identifier: 'checkout-guarantee',
        title: 'Checkout Guarantee',
        placement: ['checkout_above_payment'],
        content: `
          <div class="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-600 rounded-xl p-5 mb-6">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              </div>
              <div>
                <h4 class="font-bold text-white mb-2">Shop with Confidence</h4>
                <ul class="space-y-1.5 text-sm text-white/90">
                  <li class="flex items-center gap-2"><span class="text-emerald-300">✓</span> 30-day money-back guarantee</li>
                  <li class="flex items-center gap-2"><span class="text-emerald-300">✓</span> Free returns on all orders</li>
                  <li class="flex items-center gap-2"><span class="text-emerald-300">✓</span> Price match promise</li>
                </ul>
              </div>
            </div>
          </div>
        `
      },
      {
        identifier: 'checkout-security',
        title: 'Checkout Security Notice',
        placement: ['checkout_below_payment'],
        content: `
          <div class="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl py-5 px-6 mt-4">
            <div class="flex flex-col items-center justify-center gap-3">
              <div class="flex items-center gap-6 text-white/60">
                <svg class="w-10 h-6" viewBox="0 0 50 20" fill="currentColor"><path d="M8.5 3.5h-7A1.5 1.5 0 000 5v10a1.5 1.5 0 001.5 1.5h7A1.5 1.5 0 0010 15V5A1.5 1.5 0 008.5 3.5zM5 14.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"></path></svg>
                <svg class="w-10 h-6" viewBox="0 0 50 20" fill="currentColor"><path d="M20 5v10h-5V5h5zm-2.5 7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"></path></svg>
                <svg class="w-10 h-6" viewBox="0 0 50 20" fill="currentColor"><path d="M35 10a5 5 0 11-10 0 5 5 0 0110 0zm-5 3a3 3 0 100-6 3 3 0 000 6z"></path></svg>
              </div>
              <div class="flex items-center gap-2 text-sm text-white/80">
                <svg class="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path></svg>
                <span>Secured with 256-bit SSL encryption</span>
              </div>
            </div>
          </div>
        `
      },
      // ==================== SUCCESS PAGE BLOCKS ====================
      {
        identifier: 'order-success-message',
        title: 'Order Success Message',
        placement: ['success_below_content'],
        content: `
          <div class="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-8 text-center mt-8">
            <div class="w-16 h-16 mx-auto mb-4 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 class="text-xl font-bold text-white mb-2">What Happens Next?</h3>
            <div class="flex flex-col md:flex-row justify-center gap-6 mt-6 text-sm">
              <div class="flex items-center gap-2 text-white"><span class="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">1</span> Confirmation email sent</div>
              <div class="flex items-center gap-2 text-white"><span class="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">2</span> Order processing (1-2 days)</div>
              <div class="flex items-center gap-2 text-white"><span class="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">3</span> Shipped with tracking</div>
            </div>
          </div>
        `
      },
      // ==================== CATEGORY PAGE BLOCKS ====================
      {
        identifier: 'category-promo-banner',
        title: 'Category Promo Banner',
        placement: ['category_above'],
        content: `
          <div class="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white rounded-2xl p-6 mb-6">
            <div class="absolute -right-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
            <div class="relative flex flex-col md:flex-row items-center justify-between gap-4">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span class="text-3xl">🏷️</span>
                </div>
                <div>
                  <h3 class="font-bold text-xl">Category Sale!</h3>
                  <p class="text-white/80">Save up to 30% on select items in this collection</p>
                </div>
              </div>
              <a href="#products" class="px-6 py-3 bg-white text-purple-600 font-semibold rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg whitespace-nowrap">
                View Deals
              </a>
            </div>
          </div>
        `
      },
      {
        identifier: 'category-filter-tip',
        title: 'Category Filter Tip',
        placement: ['category_above_products'],
        content: `
          <div class="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 mb-6">
            <div class="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>
            </div>
            <div>
              <p class="text-white font-medium">Pro tip!</p>
              <p class="text-white/80 text-sm">Use the filters to narrow down your search and find exactly what you're looking for faster.</p>
            </div>
          </div>
        `
      },
      {
        identifier: 'category-newsletter',
        title: 'Category Newsletter',
        placement: ['category_below_products'],
        content: `
          <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 mt-12 text-center">
            <span class="inline-block px-4 py-1 mb-4 text-xs font-semibold tracking-wider text-cyan-400 bg-cyan-400/10 rounded-full uppercase">Stay Updated</span>
            <h3 class="text-2xl font-bold text-white mb-2">Love This Category?</h3>
            <p class="text-slate-400 mb-6 max-w-md mx-auto">Get notified when we add new products and exclusive deals to this collection.</p>
            <button class="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all transform hover:scale-105 shadow-lg shadow-cyan-500/25">
              Notify Me
            </button>
          </div>
        `
      },
      {
        identifier: 'category-help-banner',
        title: 'Category Help Banner',
        placement: ['category_below'],
        content: `
          <div class="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 mt-8">
            <div class="flex flex-col md:flex-row items-center justify-center gap-4">
              <div class="flex items-center gap-3 text-white">
                <div class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <span class="text-white/90">Need help choosing the right product?</span>
              </div>
              <a href="/contact" class="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 font-medium rounded-xl hover:bg-gray-100 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                Chat with Expert
              </a>
            </div>
          </div>
        `
      },
      // ==================== CART PAGE BLOCKS ====================
      {
        identifier: 'cart-free-shipping',
        title: 'Cart Free Shipping Banner',
        placement: ['cart_above'],
        content: `
          <div class="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl p-5 mb-6">
            <div class="absolute -right-8 top-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div class="relative flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                </div>
                <div>
                  <p class="font-bold text-lg">Almost there!</p>
                  <p class="text-white/80">Add $25 more for FREE shipping</p>
                </div>
              </div>
              <div class="hidden md:block">
                <div class="w-32 h-2 bg-white/30 rounded-full overflow-hidden">
                  <div class="w-3/4 h-full bg-white rounded-full"></div>
                </div>
                <p class="text-xs text-white/70 mt-1 text-right">75% to free shipping</p>
              </div>
            </div>
          </div>
        `
      },
      {
        identifier: 'cart-promo-items',
        title: 'Cart Promo Items',
        placement: ['cart_above_items'],
        content: `
          <div class="flex items-center gap-4 bg-gradient-to-r from-fuchsia-600 to-pink-600 rounded-xl p-4 mb-6">
            <div class="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
              <span class="text-xl">💡</span>
            </div>
            <div class="flex-1">
              <p class="font-medium text-white">Complete your order!</p>
              <p class="text-sm text-white/80">Customers who bought these items also loved our accessories collection.</p>
            </div>
            <a href="/products" class="hidden md:block px-4 py-2 text-sm font-medium text-fuchsia-600 bg-white rounded-lg hover:bg-gray-100 transition-colors">
              Browse
            </a>
          </div>
        `
      },
      {
        identifier: 'cart-continue-shopping',
        title: 'Cart Continue Shopping',
        placement: ['cart_below_items'],
        content: `
          <div class="flex items-center justify-center py-6 mt-4">
            <a href="/products" class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"></path></svg>
              Continue Shopping
            </a>
          </div>
        `
      },
      {
        identifier: 'cart-coupon-reminder',
        title: 'Cart Coupon Reminder',
        placement: ['cart_above_total'],
        content: `
          <div class="bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl p-4 mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center flex-shrink-0">
                <span class="text-xl">🎟️</span>
              </div>
              <div>
                <p class="font-medium text-white">Have a promo code?</p>
                <p class="text-sm text-white/80">Enter it at checkout to unlock savings!</p>
              </div>
            </div>
          </div>
        `
      },
      {
        identifier: 'cart-payment-methods',
        title: 'Cart Payment Methods',
        placement: ['cart_below_total'],
        content: `
          <div class="bg-gradient-to-r from-slate-700 to-slate-800 rounded-xl py-4 px-6 mt-4">
            <p class="text-xs text-white/70 text-center mb-3">Secure payment methods</p>
            <div class="flex items-center justify-center gap-3">
              <div class="w-12 h-8 bg-white/10 rounded flex items-center justify-center">
                <span class="text-xs font-bold text-white">VISA</span>
              </div>
              <div class="w-12 h-8 bg-white/10 rounded flex items-center justify-center">
                <span class="text-xs font-bold text-white">MC</span>
              </div>
              <div class="w-12 h-8 bg-white/10 rounded flex items-center justify-center">
                <span class="text-xs font-bold text-blue-300">Pay</span>
              </div>
              <div class="w-12 h-8 bg-white/10 rounded flex items-center justify-center">
                <span class="text-xs font-bold text-white">AMEX</span>
              </div>
            </div>
          </div>
        `
      },
      {
        identifier: 'cart-trust-badges',
        title: 'Cart Trust Badges',
        placement: ['cart_below'],
        content: `
          <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 mt-6">
            <div class="flex flex-col md:flex-row items-center justify-center gap-6 text-sm">
              <div class="flex items-center gap-2 text-white">
                <div class="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path></svg>
                </div>
                <span class="text-white/90">Secure Checkout</span>
              </div>
              <div class="flex items-center gap-2 text-white">
                <div class="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" clip-rule="evenodd"></path></svg>
                </div>
                <span class="text-white/90">30-Day Returns</span>
              </div>
              <div class="flex items-center gap-2 text-white">
                <div class="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                </div>
                <span class="text-white/90">24/7 Support</span>
              </div>
            </div>
          </div>
        `
      }
    ];

    console.log(`[DemoData] Creating ${blocks.length} CMS blocks...`);
    let blocksCreated = 0;

    for (const block of blocks) {
      const blockId = uuidv4();

      // Check if block with same identifier already exists - skip if so
      const { data: existingBlock } = await this.tenantDb
        .from('cms_blocks')
        .select('id')
        .eq('store_id', this.storeId)
        .eq('identifier', block.identifier)
        .maybeSingle();

      if (existingBlock) {
        console.log(`[DemoData] CMS block ${block.identifier} already exists, skipping...`);
        continue;
      }

      const { data: blockData, error: blockError } = await this.tenantDb
        .from('cms_blocks')
        .insert({
          id: blockId,
          store_id: this.storeId,
          identifier: block.identifier,
          placement: block.placement || ['content'],
          is_active: true,
          sort_order: blocks.indexOf(block),
          demo: true
        })
        .select('id')
        .single();

      if (blockError) {
        console.error(`[DemoData] Error creating CMS block ${block.identifier}:`, blockError);
        console.error(`[DemoData] Block insert payload:`, { blockId, storeId: this.storeId, identifier: block.identifier });
        continue;
      }

      if (!blockData) {
        console.error(`[DemoData] CMS block ${block.identifier} was not created (no data returned)`);
        continue;
      }

      console.log(`[DemoData] Created CMS block: ${block.identifier} with ID: ${blockData.id}`);

      const { data: transData, error: transError } = await this.tenantDb
        .from('cms_block_translations')
        .insert({
          cms_block_id: blockData.id,
          language_code: 'en',
          title: block.title,
          content: block.content,
          demo: true
        })
        .select('cms_block_id')
        .single();

      if (transError) {
        console.error(`[DemoData] Error creating CMS block translation ${block.identifier}:`, transError);
      } else {
        blocksCreated++;
        console.log(`[DemoData] Created CMS block translation for: ${block.identifier}`);
      }
    }

    console.log(`[DemoData] CMS blocks created: ${blocksCreated}/${blocks.length}`);
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
          meta_title: '{{product_name}} | Buy Online',
          meta_description: 'Shop {{product_name}} at great prices. {{short_description}}',
          og_title: '{{product_name}}',
          og_description: '{{short_description}}'
        }
      },
      {
        name: 'Category SEO Template',
        type: 'category',
        template: {
          meta_title: '{{category_name}} - Shop Our Collection',
          meta_description: 'Browse our {{category_name}} collection. {{category_description}}',
          og_title: '{{category_name}} Collection',
          og_description: '{{category_description}}'
        }
      },
      {
        name: 'CMS Page SEO Template',
        type: 'cms_page',
        template: {
          meta_title: '{{page_title}} | Our Store',
          meta_description: '{{page_excerpt}}',
          og_title: '{{page_title}}',
          og_description: '{{page_excerpt}}'
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
      customOptionProducts: 3,
      customOptionRules: this.createdIds.customOptionRules || 3,
      customers: this.createdIds.customers.length,
      orders: this.createdIds.orders.length,
      cmsPages: 5,
      cmsBlocks: 21,
      taxes: 2,
      coupons: 3,
      seoTemplates: 3,
      productTabs: 3,
      productLabels: 3
    };
  }
}

module.exports = DemoDataProvisioningService;
