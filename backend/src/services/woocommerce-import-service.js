const WooCommerceClient = require('./woocommerce-client');
const woocommerceIntegration = require('./woocommerce-integration');
const ImportStatistic = require('../models/ImportStatistic');
const StorageManager = require('./storage-manager');
const ConnectionManager = require('./database/ConnectionManager');
const AttributeMappingService = require('./AttributeMappingService');
const CategoryMappingService = require('./CategoryMappingService');
const { syncProductAttributeValues } = require('../utils/productTenantHelpers');
const axios = require('axios');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class WooCommerceImportService {
  constructor(storeId) {
    this.storeId = storeId;
    this.client = null;
    this.attributeMapper = new AttributeMappingService(storeId, 'woocommerce');
    this.importStats = {
      categories: { total: 0, imported: 0, skipped: 0, failed: 0 },
      products: { total: 0, imported: 0, skipped: 0, failed: 0 },
      customers: { total: 0, imported: 0, skipped: 0, failed: 0 },
      orders: { total: 0, imported: 0, skipped: 0, failed: 0 },
      errors: []
    };
  }

  /**
   * Initialize the service with WooCommerce credentials
   */
  async initialize() {
    try {
      const config = await woocommerceIntegration.getTokenInfo(this.storeId);

      if (!config) {
        throw new Error('No WooCommerce connection found for this store. Please connect your WooCommerce store first.');
      }

      const storeUrl = config.store_url;
      const consumerKey = config.consumer_key;
      const consumerSecret = config.consumer_secret;

      if (!storeUrl || !consumerKey || !consumerSecret) {
        throw new Error('WooCommerce configuration is incomplete. Please check your credentials.');
      }

      console.log('WooCommerce connection initialized:', {
        storeUrl: storeUrl,
        hasConsumerKey: !!consumerKey,
        hasConsumerSecret: !!consumerSecret
      });

      this.client = new WooCommerceClient(storeUrl, consumerKey, consumerSecret);
      this.storeUrl = storeUrl;

      return { success: true };
    } catch (error) {
      console.error('Failed to initialize WooCommerce import service:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Test connection to WooCommerce
   */
  async testConnection() {
    if (!this.client) {
      const initResult = await this.initialize();
      if (!initResult.success) {
        return initResult;
      }
    }

    return await this.client.testConnection();
  }

  /**
   * Import WooCommerce categories
   */
  async importCategories(options = {}) {
    const { dryRun = false, progressCallback = null } = options;

    console.log(`[WooCommerceImport.importCategories] CALLED with options:`, { dryRun, hasProgressCallback: !!progressCallback });

    try {
      if (!this.client) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          console.log(`[WooCommerceImport.importCategories] Initialize failed:`, initResult);
          return initResult;
        }
      }

      console.log('Starting WooCommerce categories import...');

      // Get all categories
      const categories = await this.client.getAllCategories((progress) => {
        if (progressCallback) {
          progressCallback({
            stage: 'fetching_categories',
            ...progress
          });
        }
      });

      this.importStats.categories.total = categories.length;

      console.log(`Found ${categories.length} categories to import`);

      if (dryRun) {
        console.log(`[WooCommerceImport.importCategories] DRY RUN - returning early, no stats saved`);
        return {
          success: true,
          dryRun: true,
          stats: this.importStats,
          preview: categories.slice(0, 5).map(category => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            parent: category.parent,
            count: category.count
          }))
        };
      }

      // Process categories (sort by parent to handle hierarchy)
      const sortedCategories = this.sortCategoriesByHierarchy(categories);

      for (const category of sortedCategories) {
        try {
          await this.importCategory(category, categories);
          this.importStats.categories.imported++;

          if (progressCallback) {
            progressCallback({
              stage: 'importing_categories',
              current: this.importStats.categories.imported,
              total: this.importStats.categories.total,
              item: category.name
            });
          }
        } catch (error) {
          console.error(`Failed to import category ${category.name}:`, error);
          this.importStats.categories.failed++;
          this.importStats.errors.push({
            type: 'category',
            id: category.id,
            name: category.name,
            error: error.message
          });
        }
      }

      // Save import statistics
      try {
        console.log(`[WooCommerceImport] Saving category stats for store ${this.storeId}:`, {
          total: this.importStats.categories.total,
          imported: this.importStats.categories.imported,
          failed: this.importStats.categories.failed
        });

        await ImportStatistic.saveImportResults(this.storeId, 'categories', {
          totalProcessed: this.importStats.categories.total,
          successfulImports: this.importStats.categories.imported,
          failedImports: this.importStats.categories.failed,
          skippedImports: this.importStats.categories.skipped,
          errorDetails: JSON.stringify(this.importStats.errors.filter(e => e.type === 'category')),
          importMethod: 'manual',
          importSource: 'woocommerce'
        });

        console.log(`[WooCommerceImport] Category stats saved successfully`);
      } catch (statsError) {
        console.error(`[WooCommerceImport] Failed to save category stats:`, statsError);
      }

      return {
        success: true,
        stats: this.importStats.categories,
        errors: this.importStats.errors.filter(e => e.type === 'category')
      };

    } catch (error) {
      console.error('Categories import failed:', error);
      return {
        success: false,
        message: error.message,
        stats: this.importStats.categories
      };
    }
  }

  /**
   * Sort categories by hierarchy (parents first)
   */
  sortCategoriesByHierarchy(categories) {
    const sorted = [];
    const remaining = [...categories];
    const processedIds = new Set();

    // First pass: add root categories (parent = 0)
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (remaining[i].parent === 0) {
        sorted.push(remaining[i]);
        processedIds.add(remaining[i].id);
        remaining.splice(i, 1);
      }
    }

    // Subsequent passes: add categories whose parents are already processed
    let maxIterations = categories.length;
    while (remaining.length > 0 && maxIterations > 0) {
      for (let i = remaining.length - 1; i >= 0; i--) {
        if (processedIds.has(remaining[i].parent)) {
          sorted.push(remaining[i]);
          processedIds.add(remaining[i].id);
          remaining.splice(i, 1);
        }
      }
      maxIterations--;
    }

    // Add any remaining (orphaned) categories
    sorted.push(...remaining);

    return sorted;
  }

  /**
   * Import a single WooCommerce category
   */
  async importCategory(category, allCategories) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

      // Check if category already exists
      const { data: existingCategories } = await tenantDb
        .from('categories')
        .select('*')
        .eq('store_id', this.storeId)
        .or(`external_id.eq.${category.id.toString()},slug.eq.${category.slug}`);

      const existingCategory = existingCategories && existingCategories.length > 0 ? existingCategories[0] : null;

      // Handle category image
      let mediaAssetId = null;

      if (category.image && category.image.src) {
        try {
          console.log(`Downloading category image for "${category.name}": ${category.image.src.substring(0, 60)}...`);
          const storedImage = await this.downloadAndStoreCategoryImage(category.image.src, category.slug);
          if (storedImage) {
            mediaAssetId = storedImage.mediaAssetId;
            console.log(`Stored category image, mediaAssetId: ${mediaAssetId}`);
          }
        } catch (imgError) {
          console.warn(`Failed to download category image for "${category.name}":`, imgError.message);
        }
      }

      // Find parent category ID in our database
      let parentId = null;
      if (category.parent > 0) {
        const { data: parentCategories } = await tenantDb
          .from('categories')
          .select('id')
          .eq('store_id', this.storeId)
          .eq('external_id', category.parent.toString())
          .maybeSingle();

        if (parentCategories) {
          parentId = parentCategories.id;
        }
      }

      // Calculate level based on parent
      let level = 0;
      if (parentId) {
        const { data: parent } = await tenantDb
          .from('categories')
          .select('level')
          .eq('id', parentId)
          .maybeSingle();
        level = (parent?.level || 0) + 1;
      }

      const categoryData = {
        name: category.name,
        description: category.description || '',
        slug: category.slug,
        is_active: true,
        external_id: category.id.toString(),
        external_source: 'woocommerce',
        store_id: this.storeId,
        parent_id: parentId,
        level: level,
        sort_order: category.menu_order || 0,
        meta_title: category.name,
        meta_description: category.description ? category.description.replace(/<[^>]*>/g, '').substring(0, 160) : '',
        updated_at: new Date().toISOString()
      };

      // Add media_asset_id if we have an image
      if (mediaAssetId) {
        categoryData.media_asset_id = mediaAssetId;
      }

      if (existingCategory) {
        const { data, error } = await tenantDb
          .from('categories')
          .update(categoryData)
          .eq('id', existingCategory.id)
          .select()
          .single();

        if (error) throw error;
        console.log(`Updated category: ${category.name}${mediaAssetId ? ' (with image)' : ''}`);
        return data;
      } else {
        const { data, error } = await tenantDb
          .from('categories')
          .insert({
            id: uuidv4(),
            ...categoryData,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        console.log(`Created category: ${category.name}${mediaAssetId ? ' (with image)' : ''}`);
        return data;
      }
    } catch (error) {
      console.error(`Error importing category ${category.name}:`, error);
      throw error;
    }
  }

  /**
   * Download and store a category image
   */
  async downloadAndStoreCategoryImage(imageUrl, categorySlug) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const buffer = Buffer.from(response.data);

      // Determine file extension and mime type from URL
      const urlPath = new URL(imageUrl).pathname;
      let ext = path.extname(urlPath).toLowerCase().split('?')[0];
      let mimeType = 'image/jpeg';

      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (ext === '.webp') mimeType = 'image/webp';
      else ext = '.jpg';

      const filename = `${categorySlug}${ext}`;

      const fileObject = {
        buffer: buffer,
        originalname: filename,
        mimetype: mimeType,
        size: buffer.length
      };

      const uploadResult = await StorageManager.uploadFile(this.storeId, fileObject, {
        folder: 'category',
        public: true,
        type: 'category'
      });

      return {
        url: uploadResult.url,
        mediaAssetId: uploadResult.mediaAssetId
      };
    } catch (error) {
      console.error(`Error downloading category image:`, error);
      return null;
    }
  }

  /**
   * Import WooCommerce products
   */
  async importProducts(options = {}) {
    const { dryRun = false, progressCallback = null, limit = null } = options;

    try {
      if (!this.client) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      console.log('Starting WooCommerce products import...');

      // Get all products
      const products = await this.client.getAllProducts((progress) => {
        if (progressCallback) {
          progressCallback({
            stage: 'fetching_products',
            ...progress
          });
        }
      });

      // Apply limit if specified
      const productsToImport = limit ? products.slice(0, limit) : products;
      this.importStats.products.total = productsToImport.length;

      console.log(`Found ${productsToImport.length} products to import`);

      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          stats: this.importStats,
          preview: productsToImport.slice(0, 5).map(product => ({
            id: product.id,
            name: product.name,
            slug: product.slug,
            type: product.type,
            status: product.status,
            price: product.price,
            categories: product.categories?.length || 0
          }))
        };
      }

      // Ensure we have required attributes for products and WooCommerce attribute set
      const woocommerceAttributeSet = await this.ensureProductAttributes();
      this.woocommerceAttributeSetId = woocommerceAttributeSet.id;

      // Track all attribute IDs used during import
      this.allWooCommerceAttributeIds = new Set(woocommerceAttributeSet.attribute_ids || []);

      // Initialize category mapping service for auto-creation of unmapped categories
      this.categoryMappingService = new CategoryMappingService(this.storeId, 'woocommerce');
      this.autoCreateSettings = await this.categoryMappingService.getAutoCreateSettings();
      console.log(`Category auto-create: ${this.autoCreateSettings.enabled ? 'enabled' : 'disabled'}`);

      // Get the root-catalog category as fallback for products without categories
      const rootCatDb = await ConnectionManager.getStoreConnection(this.storeId);
      const { data: rootCategory } = await rootCatDb
        .from('categories')
        .select('id')
        .eq('store_id', this.storeId)
        .eq('slug', 'root-catalog')
        .maybeSingle();
      this.rootCategoryId = rootCategory?.id || null;
      console.log(`Root category for fallback: ${this.rootCategoryId || 'not found'}`);

      // Build category map from WooCommerce categories
      this.woocommerceCategoryMap = {};
      console.log('Fetching WooCommerce categories for category mapping...');
      try {
        const categories = await this.client.getAllCategories();
        categories.forEach(cat => {
          this.woocommerceCategoryMap[cat.id.toString()] = {
            id: cat.id.toString(),
            code: cat.id.toString(),
            name: cat.name,
            slug: cat.slug
          };
        });
        console.log(`Loaded ${categories.length} WooCommerce categories for lookup`);
      } catch (catError) {
        console.warn('Could not fetch WooCommerce categories:', catError.message);
      }

      // Process products
      for (const product of productsToImport) {
        try {
          await this.importProduct(product);
          this.importStats.products.imported++;

          if (progressCallback) {
            progressCallback({
              stage: 'importing_products',
              current: this.importStats.products.imported,
              total: this.importStats.products.total,
              item: product.name
            });
          }
        } catch (error) {
          console.error(`Failed to import product ${product.name}:`, error);
          this.importStats.products.failed++;
          this.importStats.errors.push({
            type: 'product',
            id: product.id,
            name: product.name,
            error: error.message
          });
        }
      }

      // After importing all products, update the WooCommerce attribute set with ALL attribute IDs
      await this.updateWooCommerceAttributeSetWithAllAttributes();

      // Save import statistics
      await ImportStatistic.saveImportResults(this.storeId, 'products', {
        totalProcessed: this.importStats.products.total,
        successfulImports: this.importStats.products.imported,
        failedImports: this.importStats.products.failed,
        skippedImports: this.importStats.products.skipped,
        errorDetails: JSON.stringify(this.importStats.errors.filter(e => e.type === 'product')),
        importMethod: 'manual',
        importSource: 'woocommerce'
      });

      return {
        success: true,
        stats: this.importStats.products,
        errors: this.importStats.errors.filter(e => e.type === 'product')
      };

    } catch (error) {
      console.error('Products import failed:', error);
      return {
        success: false,
        message: error.message,
        stats: this.importStats.products
      };
    }
  }

  /**
   * Download and store image from URL
   */
  async downloadAndStoreImage(imageUrl, productSlug, index = 0) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const imageBuffer = Buffer.from(response.data);

      // Determine file extension and MIME type
      const urlPath = new URL(imageUrl).pathname;
      let ext = path.extname(urlPath).toLowerCase();

      if (!ext || ext === '') {
        if (urlPath.includes('.png')) ext = '.png';
        else if (urlPath.includes('.jpg') || urlPath.includes('.jpeg')) ext = '.jpg';
        else if (urlPath.includes('.webp')) ext = '.webp';
        else if (urlPath.includes('.gif')) ext = '.gif';
        else ext = '.jpg';
      }

      let mimeType;
      if (ext === '.png') {
        mimeType = 'image/png';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        mimeType = 'image/jpeg';
      } else if (ext === '.webp') {
        mimeType = 'image/webp';
      } else if (ext === '.gif') {
        mimeType = 'image/gif';
      } else {
        mimeType = 'image/jpeg';
      }

      console.log(`Downloading image: ext=${ext}, mimeType=${mimeType}, url=${imageUrl.substring(0, 80)}...`);

      const filename = `${productSlug}-${index}${ext}`;

      const fileObject = {
        buffer: imageBuffer,
        mimetype: mimeType,
        size: imageBuffer.length,
        originalname: filename
      };

      const uploadResult = await StorageManager.uploadFile(this.storeId, fileObject, {
        folder: 'products',
        public: true,
        type: 'product'
      });

      console.log(`Stored image: ${uploadResult.url}, mediaAssetId: ${uploadResult.mediaAssetId}`);
      return {
        url: uploadResult.url,
        mediaAssetId: uploadResult.mediaAssetId,
        path: uploadResult.path
      };

    } catch (error) {
      console.error(`Failed to download/store image from ${imageUrl}:`, error.message);
      return { url: imageUrl, mediaAssetId: null, path: null };
    }
  }

  /**
   * Import a single WooCommerce product
   */
  async importProduct(product) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

      // Check if product already exists
      const { data: existingProducts } = await tenantDb
        .from('products')
        .select('*')
        .eq('store_id', this.storeId)
        .or(`external_id.eq.${product.id.toString()},sku.eq.${product.sku || product.slug}`);

      const existingProduct = existingProducts && existingProducts.length > 0 ? existingProducts[0] : null;

      // Map categories
      const categoryIds = [];
      if (product.categories && product.categories.length > 0) {
        console.log(`Product "${product.name}" has ${product.categories.length} categories`);

        for (const cat of product.categories) {
          const categoryIdStr = cat.id.toString();
          let foundCategoryId = null;

          // Check integration_category_mappings for mapping
          const { data: mapping, error: mappingError } = await tenantDb
            .from('integration_category_mappings')
            .select('internal_category_id, external_category_id, external_category_name')
            .eq('store_id', this.storeId)
            .eq('integration_source', 'woocommerce')
            .eq('external_category_id', categoryIdStr)
            .not('internal_category_id', 'is', null)
            .maybeSingle();

          if (mappingError) {
            console.error(`Error querying mapping for category ${categoryIdStr}:`, mappingError);
          }

          if (mapping?.internal_category_id) {
            foundCategoryId = mapping.internal_category_id;
            console.log(`Found mapping for category ${categoryIdStr} -> category ${foundCategoryId}`);
          } else {
            // Try to find by external_id in categories table
            const { data: directCategory } = await tenantDb
              .from('categories')
              .select('id')
              .eq('store_id', this.storeId)
              .eq('external_id', categoryIdStr)
              .eq('external_source', 'woocommerce')
              .maybeSingle();

            if (directCategory) {
              foundCategoryId = directCategory.id;
              console.log(`Found direct category for ${categoryIdStr} -> ${foundCategoryId}`);
            }
          }

          // Auto-create if enabled and no mapping found
          if (!foundCategoryId && this.autoCreateSettings?.enabled && this.categoryMappingService) {
            const categoryInfo = this.woocommerceCategoryMap?.[categoryIdStr] || {
              id: categoryIdStr,
              code: categoryIdStr,
              name: cat.name || `Category ${categoryIdStr}`
            };

            console.log(`Auto-creating category for WooCommerce category: ${categoryInfo.name}`);
            const newCategoryId = await this.categoryMappingService.autoCreateCategory({
              id: categoryIdStr,
              code: categoryIdStr,
              name: categoryInfo.name,
              parent_code: null
            });

            if (newCategoryId) {
              foundCategoryId = newCategoryId;
            }
          }

          if (foundCategoryId) {
            categoryIds.push(foundCategoryId);
          }
        }

        console.log(`Product "${product.name}" direct categories: ${categoryIds.length}`);
      }

      // Expand categories to include all parent categories (up to root)
      let expandedCategoryIds = categoryIds;
      if (categoryIds.length > 0 && this.categoryMappingService) {
        try {
          expandedCategoryIds = await this.categoryMappingService.expandCategoriesWithParents(categoryIds);
          if (expandedCategoryIds.length > categoryIds.length) {
            console.log(`Product "${product.name}" expanded to ${expandedCategoryIds.length} categories (including parents)`);
          }
        } catch (expandError) {
          console.warn(`Could not expand categories for "${product.name}":`, expandError.message);
          expandedCategoryIds = categoryIds;
        }
      }

      // Fallback: Assign to root-catalog if product has no categories
      if (expandedCategoryIds.length === 0 && this.rootCategoryId) {
        expandedCategoryIds = [this.rootCategoryId];
        console.log(`Product "${product.name}" has no categories - assigning to root-catalog`);
      }

      // Extract and process attributes using AttributeMappingService
      const rawAttributes = this.extractProductAttributes(product);
      const { attributes: processedAttributes, createdAttributes } = await this.attributeMapper.processProductAttributes(rawAttributes);

      // Track attribute IDs for the WooCommerce attribute set
      if (this.allWooCommerceAttributeIds && createdAttributes) {
        for (const attr of createdAttributes) {
          this.allWooCommerceAttributeIds.add(attr.id);
        }
      }

      // Determine product status
      let status = 'draft';
      if (product.status === 'publish') {
        status = 'active';
      } else if (product.status === 'pending') {
        status = 'pending';
      }

      // Build product data
      const productData = {
        slug: product.slug,
        sku: product.sku || product.slug,
        status: status,
        price: parseFloat(product.price || product.regular_price || 0),
        manage_stock: product.manage_stock || false,
        stock_quantity: product.stock_quantity || 0,
        allow_backorders: product.backorders === 'yes' || product.backorders === 'notify',
        category_ids: expandedCategoryIds,
        external_id: product.id.toString(),
        external_source: 'woocommerce',
        store_id: this.storeId,
        attribute_set_id: this.woocommerceAttributeSetId
      };

      // Add optional fields
      if (product.sale_price) {
        productData.compare_price = parseFloat(product.regular_price || 0);
        productData.price = parseFloat(product.sale_price);
      }

      if (product.weight) {
        productData.weight = parseFloat(product.weight);
      }

      let savedProduct;
      if (existingProduct) {
        console.log(`Updating product "${product.name}" with category_ids:`, expandedCategoryIds);
        const { data, error } = await tenantDb
          .from('products')
          .update({
            ...productData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProduct.id)
          .select()
          .single();

        if (error) throw error;
        savedProduct = data;
        console.log(`Updated product: ${product.name}`);
      } else {
        console.log(`Creating product "${product.name}" with category_ids:`, expandedCategoryIds);
        const { data, error } = await tenantDb
          .from('products')
          .insert({
            id: uuidv4(),
            ...productData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) throw error;
        savedProduct = data;
        console.log(`Created product: ${product.name}`);
      }

      // Sync attributes to product_attribute_values table
      if (processedAttributes && Object.keys(processedAttributes).length > 0) {
        try {
          await syncProductAttributeValues(tenantDb, this.storeId, savedProduct.id, processedAttributes);
          console.log(`Synced ${Object.keys(processedAttributes).length} attributes for product: ${product.name}`);
        } catch (attrError) {
          console.warn(`Failed to sync attributes for product ${savedProduct.id}:`, attrError.message);
        }
      }

      // Ensure 'en' language exists before saving translations
      const { data: existingLanguage } = await tenantDb
        .from('languages')
        .select('*')
        .eq('code', 'en')
        .maybeSingle();

      if (!existingLanguage) {
        await tenantDb
          .from('languages')
          .insert({
            id: uuidv4(),
            code: 'en',
            name: 'English',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }

      // Save translations for name and description
      try {
        const { data: existingTranslation } = await tenantDb
          .from('product_translations')
          .select('*')
          .eq('product_id', savedProduct.id)
          .eq('language_code', 'en')
          .maybeSingle();

        const translationData = {
          name: product.name,
          description: product.description || '',
          short_description: product.short_description || '',
          updated_at: new Date().toISOString()
        };

        if (existingTranslation) {
          await tenantDb
            .from('product_translations')
            .update(translationData)
            .eq('product_id', savedProduct.id)
            .eq('language_code', 'en');
        } else {
          await tenantDb
            .from('product_translations')
            .insert({
              product_id: savedProduct.id,
              language_code: 'en',
              ...translationData,
              created_at: new Date().toISOString()
            });
        }
      } catch (translationError) {
        console.error(`Failed to save translations for ${product.name}:`, translationError.message);
      }

      // Save SEO metadata
      try {
        const { data: existingSeo } = await tenantDb
          .from('product_seo')
          .select('*')
          .eq('product_id', savedProduct.id)
          .maybeSingle();

        // WooCommerce Yoast SEO fields if available
        const metaTitle = product.yoast_head_json?.title || product.name;
        const metaDescription = product.yoast_head_json?.description ||
                               (product.short_description ? product.short_description.replace(/<[^>]*>/g, '').substring(0, 160) : '');

        const primaryImageUrl = product.images?.[0]?.src || null;

        const seoData = {
          language_code: 'en',
          meta_title: metaTitle,
          meta_description: metaDescription,
          meta_keywords: product.tags ? product.tags.map(t => t.name).join(', ') : null,
          meta_robots_tag: 'index, follow',
          og_title: metaTitle,
          og_description: metaDescription,
          og_image_url: primaryImageUrl,
          twitter_title: metaTitle,
          twitter_description: metaDescription,
          twitter_image_url: primaryImageUrl,
          canonical_url: null,
          updated_at: new Date().toISOString()
        };

        if (existingSeo) {
          await tenantDb
            .from('product_seo')
            .update(seoData)
            .eq('product_id', savedProduct.id);
        } else {
          await tenantDb
            .from('product_seo')
            .insert({
              product_id: savedProduct.id,
              ...seoData,
              created_at: new Date().toISOString()
            });
        }
      } catch (seoError) {
        console.error(`Failed to save SEO metadata for ${product.name}:`, seoError.message);
      }

      // Save images to product_files table
      if (product.images && product.images.length > 0) {
        try {
          // First, delete existing images for this product
          await tenantDb
            .from('product_files')
            .delete()
            .eq('product_id', savedProduct.id)
            .eq('file_type', 'image');

          console.log(`Processing ${product.images.length} images for ${product.name}`);

          for (let i = 0; i < product.images.length; i++) {
            const image = product.images[i];

            try {
              const storedResult = await this.downloadAndStoreImage(image.src, product.slug, i);

              let mediaAssetId = storedResult.mediaAssetId;

              if (!mediaAssetId) {
                console.warn(`No mediaAssetId returned for image ${i}, creating fallback record`);

                const { data: existingAsset } = await tenantDb
                  .from('media_assets')
                  .select('id')
                  .eq('store_id', this.storeId)
                  .eq('file_url', image.src)
                  .maybeSingle();

                if (existingAsset) {
                  mediaAssetId = existingAsset.id;
                } else {
                  const filePath = `external/${product.slug}-${i}.jpg`;
                  const { data: newAsset } = await tenantDb
                    .from('media_assets')
                    .insert({
                      id: uuidv4(),
                      store_id: this.storeId,
                      file_url: image.src,
                      file_path: filePath,
                      file_name: `${product.slug}-${i}.jpg`,
                      mime_type: 'image/jpeg',
                      folder: 'external'
                    })
                    .select('id')
                    .single();
                  mediaAssetId = newAsset?.id;
                }
              }

              if (!mediaAssetId) {
                console.error(`Could not get mediaAssetId for image ${i}, skipping`);
                continue;
              }

              await tenantDb
                .from('product_files')
                .insert({
                  id: uuidv4(),
                  product_id: savedProduct.id,
                  media_asset_id: mediaAssetId,
                  file_type: 'image',
                  position: i,
                  is_primary: i === 0,
                  alt_text: image.alt || product.name,
                  metadata: {
                    woocommerce_id: image.id,
                    original_src: image.src
                  },
                  store_id: this.storeId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              console.log(`Saved image ${i + 1}/${product.images.length} for ${product.name}`);
            } catch (imageError) {
              console.error(`Failed to process image ${i} for ${product.name}:`, imageError.message);
            }
          }
        } catch (imagesError) {
          console.error(`Failed to save images for ${product.name}:`, imagesError.message);
        }
      }

      return savedProduct;
    } catch (error) {
      console.error(`Error importing product ${product.name}:`, error);
      throw error;
    }
  }

  /**
   * Extract custom attributes from WooCommerce product
   */
  extractProductAttributes(product) {
    const attributes = {};

    // Handle WooCommerce attributes
    if (product.attributes && product.attributes.length > 0) {
      for (const attr of product.attributes) {
        const attrCode = attr.name.toLowerCase().replace(/\s+/g, '_');
        // WooCommerce attributes have options array
        if (attr.options && attr.options.length > 0) {
          attributes[attrCode] = attr.options.join(', ');
        }
      }
    }

    // Map standard WooCommerce fields to custom attributes
    if (product.weight) attributes.weight = `${product.weight} ${product.weight_unit || 'kg'}`;
    if (product.dimensions) {
      if (product.dimensions.length) attributes.length = product.dimensions.length;
      if (product.dimensions.width) attributes.width = product.dimensions.width;
      if (product.dimensions.height) attributes.height = product.dimensions.height;
    }

    // Handle tags
    if (product.tags && product.tags.length > 0) {
      attributes.tags = product.tags.map(t => t.name).join(', ');
    }

    // Product type
    if (product.type) attributes.product_type = product.type;

    return attributes;
  }

  /**
   * Ensure WooCommerce attribute set exists and return its ID
   */
  async ensureWooCommerceAttributeSet() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const { data: existingSet } = await tenantDb
      .from('attribute_sets')
      .select('*')
      .eq('store_id', this.storeId)
      .eq('name', 'WooCommerce')
      .maybeSingle();

    if (existingSet) {
      return existingSet;
    }

    const { data: newSet, error } = await tenantDb
      .from('attribute_sets')
      .insert({
        id: uuidv4(),
        name: 'WooCommerce',
        description: 'Attribute set for products imported from WooCommerce',
        is_default: false,
        sort_order: 0,
        store_id: this.storeId,
        attribute_ids: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create WooCommerce attribute set:', error);
      throw error;
    }

    console.log('Created WooCommerce attribute set');
    return newSet;
  }

  /**
   * Ensure required product attributes exist
   */
  async ensureProductAttributes() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const requiredAttributes = [
      { code: 'product_type', name: 'Product Type', type: 'text', filterable: true },
      { code: 'tags', name: 'Tags', type: 'text', filterable: false },
      { code: 'weight', name: 'Weight', type: 'text', filterable: false },
      { code: 'length', name: 'Length', type: 'text', filterable: false },
      { code: 'width', name: 'Width', type: 'text', filterable: false },
      { code: 'height', name: 'Height', type: 'text', filterable: false }
    ];

    const attributeIds = [];

    for (const attrData of requiredAttributes) {
      const { data: existingAttr } = await tenantDb
        .from('attributes')
        .select('*')
        .eq('store_id', this.storeId)
        .eq('code', attrData.code)
        .maybeSingle();

      let attributeId;

      if (!existingAttr) {
        const { data: newAttr, error: insertError } = await tenantDb
          .from('attributes')
          .insert({
            id: uuidv4(),
            code: attrData.code,
            name: attrData.name,
            type: attrData.type,
            store_id: this.storeId,
            is_required: false,
            is_filterable: attrData.filterable,
            is_searchable: true,
            sort_order: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (insertError || !newAttr) {
          throw new Error(`Failed to create attribute ${attrData.code}: ${insertError?.message || 'Unknown error'}`);
        }

        attributeId = newAttr.id;

        // Create English translation
        await tenantDb
          .from('attribute_translations')
          .insert({
            attribute_id: attributeId,
            language_code: 'en',
            label: attrData.name,
            description: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      } else {
        attributeId = existingAttr.id;
      }

      attributeIds.push(attributeId);
    }

    // Get or create WooCommerce attribute set
    const attributeSet = await this.ensureWooCommerceAttributeSet();

    // Update attribute set with all attribute IDs
    await tenantDb
      .from('attribute_sets')
      .update({
        attribute_ids: attributeIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', attributeSet.id);

    console.log(`Assigned ${attributeIds.length} attributes to WooCommerce attribute set`);

    return attributeSet;
  }

  /**
   * Update the WooCommerce attribute set with all attributes used during import
   */
  async updateWooCommerceAttributeSetWithAllAttributes() {
    if (!this.allWooCommerceAttributeIds || this.allWooCommerceAttributeIds.size === 0) {
      console.log('No additional attributes to assign to WooCommerce attribute set');
      return;
    }

    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
    const attributeIdsArray = Array.from(this.allWooCommerceAttributeIds);

    const { error } = await tenantDb
      .from('attribute_sets')
      .update({
        attribute_ids: attributeIdsArray,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.woocommerceAttributeSetId);

    if (error) {
      console.error('Failed to update WooCommerce attribute set with all attributes:', error);
    } else {
      console.log(`Updated WooCommerce attribute set with ${attributeIdsArray.length} total attributes`);
    }
  }

  /**
   * Get import statistics
   */
  getImportStats() {
    return this.importStats;
  }

  /**
   * Full import (categories + products)
   */
  async fullImport(options = {}) {
    const { progressCallback = null } = options;
    const results = {
      categories: null,
      products: null,
      success: true,
      errors: []
    };

    try {
      // Import categories first
      if (progressCallback) {
        progressCallback({ stage: 'starting_categories', progress: 0 });
      }

      results.categories = await this.importCategories({
        ...options,
        progressCallback: (progress) => {
          if (progressCallback) {
            progressCallback({
              ...progress,
              overall_progress: Math.round((progress.current || 0) / (progress.total || 1) * 50)
            });
          }
        }
      });

      if (!results.categories.success) {
        results.success = false;
        results.errors.push(...(results.categories.errors || []));
      }

      // Then import products
      if (progressCallback) {
        progressCallback({ stage: 'starting_products', progress: 50 });
      }

      results.products = await this.importProducts({
        ...options,
        progressCallback: (progress) => {
          if (progressCallback) {
            progressCallback({
              ...progress,
              overall_progress: 50 + Math.round((progress.current || 0) / (progress.total || 1) * 50)
            });
          }
        }
      });

      if (!results.products.success) {
        results.success = false;
        results.errors.push(...(results.products.errors || []));
      }

      return results;

    } catch (error) {
      console.error('Full import failed:', error);
      return {
        ...results,
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = WooCommerceImportService;
