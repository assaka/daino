const ShopifyClient = require('./shopify-client');
const shopifyIntegration = require('./shopify-integration');
const ImportStatistic = require('../models/ImportStatistic');
const StorageManager = require('./storage-manager');
const ConnectionManager = require('./database/ConnectionManager');
const AttributeMappingService = require('./AttributeMappingService');
const CategoryMappingService = require('./CategoryMappingService');
const { syncProductAttributeValues } = require('../utils/productTenantHelpers');
const axios = require('axios');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class ShopifyImportService {
  constructor(storeId) {
    this.storeId = storeId;
    this.client = null;
    this.attributeMapper = new AttributeMappingService(storeId, 'shopify');
    this.importStats = {
      collections: { total: 0, imported: 0, skipped: 0, failed: 0 },
      products: { total: 0, imported: 0, skipped: 0, failed: 0 },
      customers: { total: 0, imported: 0, skipped: 0, failed: 0 },
      orders: { total: 0, imported: 0, skipped: 0, failed: 0 },
      errors: []
    };
  }

  /**
   * Initialize the service with Shopify credentials
   */
  async initialize() {
    try {
      // Use shopify-integration service which reads from integration_configs table
      const tokenRecord = await shopifyIntegration.getTokenInfo(this.storeId);

      if (!tokenRecord) {
        throw new Error('No Shopify connection found for this store. Please connect your Shopify account first.');
      }

      // Debug: Check if token looks encrypted (starts with 'encrypted:')
      const accessToken = tokenRecord.access_token;
      if (!accessToken) {
        throw new Error('Shopify access token is missing from the configuration.');
      }

      if (accessToken.startsWith('encrypted:')) {
        console.error('❌ Shopify access token is still encrypted! Decryption may have failed.');
        console.error('Token preview:', accessToken.substring(0, 50) + '...');
        throw new Error('Shopify access token decryption failed. Please reconnect your Shopify account.');
      }

      // Log token preview for debugging (first/last few chars only for security)
      console.log('🔐 Shopify token retrieved:', {
        shopDomain: tokenRecord.shop_domain,
        tokenLength: accessToken.length,
        tokenPreview: accessToken.substring(0, 8) + '...' + accessToken.substring(accessToken.length - 4)
      });

      this.client = new ShopifyClient(tokenRecord.shop_domain, accessToken);
      this.shopDomain = tokenRecord.shop_domain;

      return { success: true };
    } catch (error) {
      console.error('Failed to initialize Shopify import service:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Test connection to Shopify
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
   * Import Shopify collections as categories
   */
  async importCollections(options = {}) {
    const { dryRun = false, progressCallback = null } = options;

    console.log(`📊 [ShopifyImport.importCollections] CALLED with options:`, { dryRun, hasProgressCallback: !!progressCallback });

    try {
      if (!this.client) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          console.log(`📊 [ShopifyImport.importCollections] Initialize failed:`, initResult);
          return initResult;
        }
      }

      console.log('Starting Shopify collections import...');

      // Get all collections (custom + smart)
      const collectionsData = await this.client.getAllCollections((progress) => {
        if (progressCallback) {
          progressCallback({
            stage: 'fetching_collections',
            ...progress
          });
        }
      });

      const allCollections = collectionsData.all;
      this.importStats.collections.total = allCollections.length;

      console.log(`Found ${allCollections.length} collections to import`);

      if (dryRun) {
        console.log(`📊 [ShopifyImport.importCollections] DRY RUN - returning early, no stats saved`);
        return {
          success: true,
          dryRun: true,
          stats: this.importStats,
          preview: allCollections.slice(0, 5).map(collection => ({
            id: collection.id,
            title: collection.title,
            handle: collection.handle,
            type: collection.collection_type || 'custom'
          }))
        };
      }

      // Process collections
      for (const collection of allCollections) {
        try {
          await this.importCollection(collection);
          this.importStats.collections.imported++;
          
          if (progressCallback) {
            progressCallback({
              stage: 'importing_collections',
              current: this.importStats.collections.imported,
              total: this.importStats.collections.total,
              item: collection.title
            });
          }
        } catch (error) {
          console.error(`Failed to import collection ${collection.title}:`, error);
          this.importStats.collections.failed++;
          this.importStats.errors.push({
            type: 'collection',
            id: collection.id,
            title: collection.title,
            error: error.message
          });
        }
      }

      // Save import statistics
      try {
        console.log(`📊 [ShopifyImport] Saving collection stats for store ${this.storeId}:`, {
          total: this.importStats.collections.total,
          imported: this.importStats.collections.imported,
          failed: this.importStats.collections.failed
        });

        await ImportStatistic.saveImportResults(this.storeId, 'collections', {
          totalProcessed: this.importStats.collections.total,
          successfulImports: this.importStats.collections.imported,
          failedImports: this.importStats.collections.failed,
          skippedImports: this.importStats.collections.skipped,
          errorDetails: JSON.stringify(this.importStats.errors.filter(e => e.type === 'collection')),
          importMethod: 'manual',
          importSource: 'shopify'
        });

        console.log(`📊 [ShopifyImport] Collection stats saved successfully`);
      } catch (statsError) {
        console.error(`📊 [ShopifyImport] Failed to save collection stats:`, statsError);
        // Don't fail the import if stats saving fails
      }

      return {
        success: true,
        stats: this.importStats.collections,
        errors: this.importStats.errors.filter(e => e.type === 'collection')
      };

    } catch (error) {
      console.error('Collections import failed:', error);
      return {
        success: false,
        message: error.message,
        stats: this.importStats.collections
      };
    }
  }

  /**
   * Import a single Shopify collection as a category
   */
  async importCollection(collection) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

      // Check if category already exists
      const { data: existingCategories } = await tenantDb
        .from('categories')
        .select('*')
        .eq('store_id', this.storeId)
        .or(`external_id.eq.${collection.id.toString()},slug.eq.${collection.handle}`);

      const existingCategory = existingCategories && existingCategories.length > 0 ? existingCategories[0] : null;

      const categoryData = {
        name: collection.title,
        description: collection.body_html || '',
        slug: collection.handle,
        is_active: collection.published_at ? true : false,
        external_id: collection.id.toString(),
        external_source: 'shopify',
        store_id: this.storeId,
        parent_id: null, // Shopify collections are flat
        level: 0,
        sort_order: collection.sort_order || 0,
        meta_title: collection.title,
        meta_description: collection.body_html ? collection.body_html.replace(/<[^>]*>/g, '').substring(0, 160) : '',
        updated_at: new Date().toISOString()
      };

      if (existingCategory) {
        const { data, error } = await tenantDb
          .from('categories')
          .update(categoryData)
          .eq('id', existingCategory.id)
          .select()
          .single();

        if (error) throw error;
        console.log(`Updated collection: ${collection.title}`);
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
        console.log(`Created collection: ${collection.title}`);
        return data;
      }
    } catch (error) {
      console.error(`Error importing collection ${collection.title}:`, error);
      throw error;
    }
  }

  /**
   * Import Shopify products
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

      console.log('Starting Shopify products import...');

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
            title: product.title,
            handle: product.handle,
            variants: product.variants?.length || 0,
            status: product.status
          }))
        };
      }

      // Ensure we have required attributes for products and Shopify attribute set
      const shopifyAttributeSet = await this.ensureProductAttributes();
      this.shopifyAttributeSetId = shopifyAttributeSet.id;

      // Track all attribute IDs used during import
      this.allShopifyAttributeIds = new Set(shopifyAttributeSet.attribute_ids || []);

      // Initialize category mapping service for auto-creation of unmapped categories
      this.categoryMappingService = new CategoryMappingService(this.storeId, 'shopify');
      this.autoCreateSettings = await this.categoryMappingService.getAutoCreateSettings();
      console.log(`🔧 Category auto-create: ${this.autoCreateSettings.enabled ? 'enabled' : 'disabled'}`);

      // Build collection ID to name map for auto-creation (fetch from Shopify)
      this.shopifyCollectionMap = {};
      console.log('📂 Fetching Shopify collections for category mapping...');
      try {
        const collectionsData = await this.client.getAllCollections();
        const allCollections = collectionsData.all || [];
        allCollections.forEach(col => {
          this.shopifyCollectionMap[col.id.toString()] = {
            id: col.id.toString(),
            code: col.id.toString(),
            name: col.title,
            handle: col.handle
          };
        });
        console.log(`✅ Loaded ${allCollections.length} Shopify collections for lookup`);
      } catch (colError) {
        console.warn('⚠️ Could not fetch Shopify collections:', colError.message);
      }

      // Build product-collection map using collects API + smart collections
      // Shopify products don't include collection IDs directly - we need to fetch them
      // buildFullProductCollectionsMap handles both custom collections (via collects API) and smart collections
      let productCollectionsMap = {};
      console.log('📂 Building product-collection relationships (including smart collections)...');
      try {
        productCollectionsMap = await this.client.buildFullProductCollectionsMap((progress) => {
          if (progressCallback) {
            progressCallback({
              stage: 'fetching_collections',
              ...progress
            });
          }
        });
        console.log(`✅ Built collection map for ${Object.keys(productCollectionsMap).length} products`);
      } catch (collectsError) {
        console.warn('⚠️ Could not build product-collections map:', collectsError.message);
      }

      // Enrich products with their collection IDs
      let productsWithCollections = 0;
      for (const product of productsToImport) {
        const productIdStr = product.id.toString();
        product.collections = productCollectionsMap[productIdStr] || [];
        if (product.collections.length > 0) {
          productsWithCollections++;
        }
      }
      console.log(`📂 ${productsWithCollections}/${productsToImport.length} products have collection assignments`);

      // Log sample of products with collections for debugging
      const sampleWithCollections = productsToImport.filter(p => p.collections.length > 0).slice(0, 3);
      if (sampleWithCollections.length > 0) {
        console.log('📂 Sample products with collections:', sampleWithCollections.map(p => ({
          id: p.id,
          title: p.title,
          collections: p.collections
        })));
      }

      // Debug: Show what mappings exist in the database for Shopify
      const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
      const { data: existingMappings } = await tenantDb
        .from('integration_category_mappings')
        .select('external_category_id, external_category_name, internal_category_id')
        .eq('store_id', this.storeId)
        .eq('integration_source', 'shopify');
      console.log(`📂 Existing Shopify category mappings in DB: ${existingMappings?.length || 0}`);
      if (existingMappings && existingMappings.length > 0) {
        console.log('📂 Mappings sample:', existingMappings.slice(0, 5).map(m => ({
          external_id: m.external_category_id,
          name: m.external_category_name,
          internal_id: m.internal_category_id ? 'mapped' : 'unmapped'
        })));
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
              item: product.title
            });
          }
        } catch (error) {
          console.error(`Failed to import product ${product.title}:`, error);
          this.importStats.products.failed++;
          this.importStats.errors.push({
            type: 'product',
            id: product.id,
            title: product.title,
            error: error.message
          });
        }
      }

      // After importing all products, update the Shopify attribute set with ALL attribute IDs
      await this.updateShopifyAttributeSetWithAllAttributes();

      // Save import statistics
      await ImportStatistic.saveImportResults(this.storeId, 'products', {
        totalProcessed: this.importStats.products.total,
        successfulImports: this.importStats.products.imported,
        failedImports: this.importStats.products.failed,
        skippedImports: this.importStats.products.skipped,
        errorDetails: JSON.stringify(this.importStats.errors.filter(e => e.type === 'product')),
        importMethod: 'manual',
        importSource: 'shopify'
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
   * Download and store image from URL using store's configured storage provider
   */
  async downloadAndStoreImage(imageUrl, productHandle, index = 0) {
    try {
      // Download image from Shopify
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000 // 30 second timeout
      });

      const imageBuffer = Buffer.from(response.data);

      // Determine file extension and MIME type
      const urlPath = new URL(imageUrl).pathname;
      const urlExt = path.extname(urlPath).toLowerCase();

      // Determine extension from URL
      let ext = urlExt;
      if (!ext || ext === '') {
        // Try to detect from URL path
        if (urlPath.includes('.png')) ext = '.png';
        else if (urlPath.includes('.jpg') || urlPath.includes('.jpeg')) ext = '.jpg';
        else if (urlPath.includes('.webp')) ext = '.webp';
        else if (urlPath.includes('.gif')) ext = '.gif';
        else ext = '.jpg'; // Default
      }

      // Determine MIME type
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
        mimeType = 'image/jpeg'; // Default
      }

      console.log(`📷 Downloading image: ext=${ext}, mimeType=${mimeType}, url=${imageUrl.substring(0, 80)}...`);

      // Generate organized directory path: products/g/i/gift-card-0.jpg
      const firstChar = productHandle.charAt(0).toLowerCase();
      const secondChar = productHandle.length > 1 ? productHandle.charAt(1).toLowerCase() : firstChar;
      const filename = `${productHandle}-${index}${ext}`;

      // Validate MIME type before upload
      if (!mimeType || mimeType === 'undefined' || mimeType === undefined) {
        throw new Error(`Invalid MIME type: ${mimeType}. Extension was: ${ext}`);
      }

      // Prepare file object for storage manager (multer-like format)
      const fileObject = {
        buffer: imageBuffer,
        mimetype: mimeType,
        size: imageBuffer.length,
        originalname: filename
      };

      // Upload using StorageManager.uploadFile() - the correct API
      const uploadResult = await StorageManager.uploadFile(this.storeId, fileObject, {
        folder: `products/${firstChar}/${secondChar}`,
        public: true,
        type: 'product'
      });

      console.log(`✅ Stored image: ${uploadResult.url}`);
      return uploadResult.url;

    } catch (error) {
      console.error(`❌ Failed to download/store image from ${imageUrl}:`, error.message);
      // Return original URL as fallback
      return imageUrl;
    }
  }

  /**
   * Import a single Shopify product
   */
  async importProduct(product) {
    try {
      // Log the full product object to see what Shopify sends
      console.log('🔍 Shopify Product Data:', JSON.stringify({
        id: product.id,
        title: product.title,
        handle: product.handle,
        options: product.options,
        variants: product.variants?.map(v => ({
          option1: v.option1,
          option2: v.option2,
          option3: v.option3,
          grams: v.grams,
          weight: v.weight,
          weight_unit: v.weight_unit
        })),
        metafields_global_title_tag: product.metafields_global_title_tag,
        metafields_global_description_tag: product.metafields_global_description_tag,
        metafields: product.metafields
      }, null, 2));

      const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

      // Check if product already exists
      const { data: existingProducts } = await tenantDb
        .from('products')
        .select('*')
        .eq('store_id', this.storeId)
        .or(`external_id.eq.${product.id.toString()},sku.eq.${product.handle}`);

      const existingProduct = existingProducts && existingProducts.length > 0 ? existingProducts[0] : null;

      // Map collections to categories using integration_category_mappings
      const categoryIds = [];
      if (product.collections && product.collections.length > 0) {
        console.log(`🔍 Product "${product.title}" has ${product.collections.length} collections: ${product.collections.join(', ')}`);

        for (const collectionId of product.collections) {
          const collectionIdStr = collectionId.toString();
          let foundCategoryId = null;

          // Check integration_category_mappings for mapping
          const { data: mapping, error: mappingError } = await tenantDb
            .from('integration_category_mappings')
            .select('internal_category_id, external_category_id, external_category_name')
            .eq('store_id', this.storeId)
            .eq('integration_source', 'shopify')
            .eq('external_category_id', collectionIdStr)
            .not('internal_category_id', 'is', null)
            .maybeSingle();

          if (mappingError) {
            console.error(`❌ Error querying mapping for collection ${collectionIdStr}:`, mappingError);
          }

          if (mapping?.internal_category_id) {
            foundCategoryId = mapping.internal_category_id;
            console.log(`✅ Found mapping for collection ${collectionIdStr} -> category ${foundCategoryId}`);
          } else {
            console.log(`⚠️ No mapping found for collection ${collectionIdStr} (${this.shopifyCollectionMap?.[collectionIdStr]?.name || 'unknown'})`);
          }

          // Auto-create if enabled and no mapping found
          if (!foundCategoryId && this.autoCreateSettings?.enabled && this.categoryMappingService) {
            const collectionInfo = this.shopifyCollectionMap?.[collectionIdStr] || {
              id: collectionIdStr,
              code: collectionIdStr,
              name: `Collection ${collectionIdStr}`
            };

            console.log(`🔄 Auto-creating category for Shopify collection: ${collectionInfo.name}`);
            const newCategoryId = await this.categoryMappingService.autoCreateCategory({
              id: collectionIdStr,
              code: collectionIdStr,
              name: collectionInfo.name,
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

        console.log(`📋 Product "${product.title}" direct categories: ${categoryIds.length}`);
      }

      // Expand categories to include all parent categories (up to root)
      let expandedCategoryIds = categoryIds;
      if (categoryIds.length > 0 && this.categoryMappingService) {
        try {
          expandedCategoryIds = await this.categoryMappingService.expandCategoriesWithParents(categoryIds);
          if (expandedCategoryIds.length > categoryIds.length) {
            console.log(`📋 Product "${product.title}" expanded to ${expandedCategoryIds.length} categories (including parents): ${expandedCategoryIds.join(', ')}`);
          }
        } catch (expandError) {
          console.warn(`⚠️ Could not expand categories for "${product.title}":`, expandError.message);
          expandedCategoryIds = categoryIds;
        }
      }

      // Extract and process attributes using AttributeMappingService
      const rawAttributes = this.extractProductAttributes(product);
      const { attributes: processedAttributes, createdAttributes } = await this.attributeMapper.processProductAttributes(rawAttributes);

      // Track attribute IDs for the Shopify attribute set
      if (this.allShopifyAttributeIds && createdAttributes) {
        for (const attr of createdAttributes) {
          this.allShopifyAttributeIds.add(attr.id);
        }
      }

      // Prepare product data (NOTE: name and description go in product_translations, not products table)
      // Build product data incrementally to handle missing schema columns gracefully
      const productData = {
        slug: product.handle, // Shopify handle → SuprShop slug
        sku: product.handle, // Also use handle as SKU
        status: product.status === 'active' ? 'active' : 'draft',
        price: parseFloat(product.variants?.[0]?.price || 0),
        manage_stock: product.variants?.[0]?.inventory_management === 'shopify',
        stock_quantity: product.variants?.reduce((total, variant) => total + (variant.inventory_quantity || 0), 0) || 0,
        allow_backorders: product.variants?.[0]?.inventory_policy === 'continue',
        category_ids: expandedCategoryIds,
        external_id: product.id.toString(),
        external_source: 'shopify',
        store_id: this.storeId,
        attribute_set_id: this.shopifyAttributeSetId // Assign Shopify attribute set
        // Note: attributes are synced to product_attribute_values table separately
      };

      // Add optional fields if they have values
      if (product.variants?.[0]?.compare_at_price) {
        productData.compare_price = parseFloat(product.variants[0].compare_at_price);
      }

      if (product.variants?.[0]?.weight) {
        productData.weight = product.variants[0].weight;
        // Note: weight_unit column doesn't exist in products table, weight is stored as numeric only
      }

      // Note: Images will be stored in product_files table after product is saved
      // Don't set productData.images - it will be handled separately

      let savedProduct;
      if (existingProduct) {
        console.log(`📝 Updating product "${product.title}" with category_ids:`, expandedCategoryIds);
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
        console.log(`✅ Updated product: ${product.title}, saved category_ids:`, savedProduct.category_ids);
      } else {
        console.log(`📝 Creating product "${product.title}" with category_ids:`, expandedCategoryIds);
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
        console.log(`✅ Created product: ${product.title}, saved category_ids:`, savedProduct.category_ids);
      }

      // Sync attributes to product_attribute_values table for storefront display
      if (processedAttributes && Object.keys(processedAttributes).length > 0) {
        try {
          await syncProductAttributeValues(tenantDb, this.storeId, savedProduct.id, processedAttributes);
          console.log(`✅ Synced ${Object.keys(processedAttributes).length} attributes for product: ${product.title}`);
        } catch (attrError) {
          console.warn(`⚠️ Failed to sync attributes for product ${savedProduct.id}:`, attrError.message);
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

      // Save translations for name and description (default language: 'en')
      try {
        // Check if translation exists
        const { data: existingTranslation, error: selectError } = await tenantDb
          .from('product_translations')
          .select('*')
          .eq('product_id', savedProduct.id)
          .eq('language_code', 'en')
          .maybeSingle();

        if (selectError) {
          console.error(`❌ Error checking existing translation for ${product.title}:`, selectError);
        }

        const translationData = {
          name: product.title,
          description: product.body_html || '',
          short_description: product.body_html ? product.body_html.replace(/<[^>]*>/g, '').substring(0, 255) : '',
          updated_at: new Date().toISOString()
        };

        console.log(`💾 Saving translation for ${product.title}:`, {
          product_id: savedProduct.id,
          language_code: 'en',
          name: translationData.name,
          description_length: translationData.description.length,
          short_description_length: translationData.short_description.length,
          existing: !!existingTranslation
        });

        if (existingTranslation) {
          const { data: updated, error: updateError } = await tenantDb
            .from('product_translations')
            .update(translationData)
            .eq('product_id', savedProduct.id)
            .eq('language_code', 'en')
            .select();

          if (updateError) {
            console.error(`❌ Update error for ${product.title}:`, updateError);
            throw updateError;
          }
          console.log(`✅ Updated translation for product: ${product.title}`, updated);
        } else {
          const { data: inserted, error: insertError } = await tenantDb
            .from('product_translations')
            .insert({
              product_id: savedProduct.id,
              language_code: 'en',
              ...translationData,
              created_at: new Date().toISOString()
            })
            .select();

          if (insertError) {
            console.error(`❌ Insert error for ${product.title}:`, insertError);
            throw insertError;
          }
          console.log(`✅ Inserted translation for product: ${product.title}`, inserted);
        }
      } catch (translationError) {
        console.error(`❌ Failed to save translations for ${product.title}:`, translationError.message);
        console.error('Translation error details:', JSON.stringify(translationError, null, 2));
      }

      // Save SEO metadata to product_seo table
      try {
        // Check if SEO record exists
        const { data: existingSeo } = await tenantDb
          .from('product_seo')
          .select('*')
          .eq('product_id', savedProduct.id)
          .maybeSingle();

        // Extract SEO data from Shopify product
        // Shopify can provide SEO through metafields: metafields_global_title_tag and metafields_global_description_tag
        const metaTitleFromShopify = product.metafields_global_title_tag || product.seo_title || product.title;
        const metaDescriptionFromShopify = product.metafields_global_description_tag ||
                                           product.seo_description ||
                                           (product.body_html ? product.body_html.replace(/<[^>]*>/g, '').substring(0, 160) : '');

        // Get primary product image for OG and Twitter cards
        const primaryImageUrl = product.images?.[0]?.src || product.image?.src || null;

        const seoData = {
          language_code: 'en',
          meta_title: metaTitleFromShopify,
          meta_description: metaDescriptionFromShopify,
          meta_keywords: product.tags ? (Array.isArray(product.tags) ? product.tags.join(', ') : product.tags) : null,
          meta_robots_tag: 'index, follow',
          og_title: metaTitleFromShopify,
          og_description: metaDescriptionFromShopify,
          og_image_url: primaryImageUrl,
          twitter_title: metaTitleFromShopify,
          twitter_description: metaDescriptionFromShopify,
          twitter_image_url: primaryImageUrl,
          canonical_url: null, // Will be set by frontend based on store URL
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

        console.log(`✅ Saved SEO metadata for product: ${product.title} (meta_title: "${metaTitleFromShopify}")`);
      } catch (seoError) {
        console.error(`❌ Failed to save SEO metadata for ${product.title}:`, seoError.message);
        console.error('SEO error details:', seoError);
      }

      // Save images to product_files table
      if (product.images && product.images.length > 0) {
        try {
          // First, delete existing images for this product to avoid duplicates on re-import
          await tenantDb
            .from('product_files')
            .delete()
            .eq('product_id', savedProduct.id)
            .eq('file_type', 'image');

          console.log(`🖼️  Processing ${product.images.length} images for ${product.title}`);

          for (let i = 0; i < product.images.length; i++) {
            try {
              const image = product.images[i];

              // Download and store image using storage provider
              const storedUrl = await this.downloadAndStoreImage(image.src, product.handle, i);

              // Insert into product_files table
              await tenantDb
                .from('product_files')
                .insert({
                  id: uuidv4(),
                  product_id: savedProduct.id,
                  file_url: storedUrl,
                  file_type: 'image',
                  position: i,
                  is_primary: i === 0, // First image is primary
                  alt_text: image.alt || product.title,
                  metadata: {
                    shopify_id: image.id,
                    shopify_position: image.position,
                    original_src: image.src
                  },
                  store_id: this.storeId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });

              console.log(`✅ Saved image ${i + 1}/${product.images.length} for ${product.title}`);
            } catch (imageError) {
              console.warn(`⚠️ Failed to process image ${i} for ${product.title}, using original URL:`, imageError.message);

              // Fallback: Insert with original Shopify URL
              const image = product.images[i];
              await tenantDb
                .from('product_files')
                .insert({
                  id: uuidv4(),
                  product_id: savedProduct.id,
                  file_url: image.src,
                  file_type: 'image',
                  position: i,
                  is_primary: i === 0,
                  alt_text: image.alt || product.title,
                  metadata: {
                    shopify_id: image.id,
                    shopify_position: image.position,
                    original_src: image.src,
                    storage_error: imageError.message
                  },
                  store_id: this.storeId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
            }
          }

          console.log(`✅ Saved ${product.images.length} images for product: ${product.title}`);
        } catch (imagesError) {
          console.error(`❌ Failed to save images for ${product.title}:`, imagesError.message);
          // Don't throw - images are not critical, product is already saved
        }
      }

      return savedProduct;
    } catch (error) {
      console.error(`Error importing product ${product.title}:`, error);
      throw error;
    }
  }

  /**
   * Format metric values to human-readable strings
   */
  formatMetricValue(value, metricType) {
    if (value === null || value === undefined) return null;

    const conversions = {
      grams: {
        threshold: 1000,
        convert: (g) => g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} grams`,
        unit: 'grams'
      },
      weight: {
        threshold: 1000,
        convert: (g) => g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} grams`,
        unit: 'grams'
      },
      milliliters: {
        threshold: 1000,
        convert: (ml) => ml >= 1000 ? `${(ml / 1000).toFixed(2)} L` : `${ml} ml`,
        unit: 'ml'
      },
      centimeters: {
        threshold: 100,
        convert: (cm) => cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${cm} cm`,
        unit: 'cm'
      }
    };

    const conversion = conversions[metricType];
    if (conversion) {
      return conversion.convert(value);
    }

    // Default: just return value with unit
    return `${value} ${metricType}`;
  }

  /**
   * Extract custom attributes from Shopify product
   */
  extractProductAttributes(product) {
    const attributes = {};

    // Map standard Shopify fields to custom attributes
    if (product.vendor) attributes.vendor = product.vendor;
    if (product.product_type) attributes.product_type = product.product_type;
    if (product.tags) attributes.tags = product.tags;

    // Handle metafields if available
    if (product.metafields) {
      product.metafields.forEach(metafield => {
        const key = `${metafield.namespace}_${metafield.key}`;
        attributes[key] = metafield.value;
      });
    }

    // Handle variant-specific attributes with proper option names
    if (product.variants && product.variants.length > 0) {
      const mainVariant = product.variants[0];

      // Map option values to their proper names from product.options
      // Shopify product.options = [{ name: "Size", position: 1, values: [...] }, ...]
      // Variant has option1, option2, option3 which map to the option names by position
      if (product.options && Array.isArray(product.options)) {
        product.options.forEach((option, index) => {
          const optionKey = `option${index + 1}`;
          const optionValue = mainVariant[optionKey];

          if (optionValue && option.name) {
            // Use the actual option name (e.g., "Size", "Color") instead of "option1"
            attributes[option.name.toLowerCase().replace(/\s+/g, '_')] = optionValue;
          }
        });
      } else {
        // Fallback to option1/2/3 if product.options not available
        if (mainVariant.option1) attributes.option1 = mainVariant.option1;
        if (mainVariant.option2) attributes.option2 = mainVariant.option2;
        if (mainVariant.option3) attributes.option3 = mainVariant.option3;
      }

      // Handle barcode
      if (mainVariant.barcode) attributes.barcode = mainVariant.barcode;

      // Handle weight with smart formatting
      if (mainVariant.grams) {
        attributes.weight = this.formatMetricValue(mainVariant.grams, 'grams');
      }
    }

    return attributes;
  }

  /**
   * Ensure Shopify attribute set exists and return its ID
   */
  async ensureShopifyAttributeSet() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    // Check if Shopify attribute set already exists
    const { data: existingSet } = await tenantDb
      .from('attribute_sets')
      .select('*')
      .eq('store_id', this.storeId)
      .eq('name', 'Shopify')
      .maybeSingle();

    if (existingSet) {
      return existingSet;
    }

    // Create Shopify attribute set
    const { data: newSet, error } = await tenantDb
      .from('attribute_sets')
      .insert({
        id: uuidv4(),
        name: 'Shopify',
        description: 'Attribute set for products imported from Shopify',
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
      console.error('Failed to create Shopify attribute set:', error);
      throw error;
    }

    console.log('✅ Created Shopify attribute set');
    return newSet;
  }

  /**
   * Ensure required product attributes exist and assign to Shopify attribute set
   */
  async ensureProductAttributes() {
    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    const requiredAttributes = [
      { code: 'vendor', name: 'Vendor', type: 'text', filterable: true },
      { code: 'product_type', name: 'Product Type', type: 'text', filterable: true },
      { code: 'tags', name: 'Tags', type: 'text', filterable: false },
      { code: 'barcode', name: 'Barcode', type: 'text', filterable: false },
      { code: 'weight', name: 'Weight', type: 'text', filterable: false },
      { code: 'option1', name: 'Option 1', type: 'text', filterable: false },
      { code: 'option2', name: 'Option 2', type: 'text', filterable: false },
      { code: 'option3', name: 'Option 3', type: 'text', filterable: false }
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

        // Create English translation for the attribute
        const { data: existingTranslation } = await tenantDb
          .from('attribute_translations')
          .select('id')
          .eq('attribute_id', attributeId)
          .eq('language_code', 'en')
          .maybeSingle();

        if (!existingTranslation) {
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
          console.log(`✅ Created English translation for attribute: ${attrData.code}`);
        }
      } else {
        attributeId = existingAttr.id;

        // Ensure English translation exists for existing attributes too
        const { data: existingTranslation } = await tenantDb
          .from('attribute_translations')
          .select('id')
          .eq('attribute_id', attributeId)
          .eq('language_code', 'en')
          .maybeSingle();

        if (!existingTranslation) {
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
          console.log(`✅ Added missing English translation for attribute: ${attrData.code}`);
        }
      }

      attributeIds.push(attributeId);
    }

    // Get or create Shopify attribute set
    const attributeSet = await this.ensureShopifyAttributeSet();

    // Update attribute set with all attribute IDs
    await tenantDb
      .from('attribute_sets')
      .update({
        attribute_ids: attributeIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', attributeSet.id);

    console.log(`✅ Assigned ${attributeIds.length} attributes to Shopify attribute set`);

    return attributeSet;
  }

  /**
   * Update the Shopify attribute set with all attributes used during import
   * This ensures ALL attributes (including dynamically created ones) are assigned to the Shopify attribute set
   */
  async updateShopifyAttributeSetWithAllAttributes() {
    if (!this.allShopifyAttributeIds || this.allShopifyAttributeIds.size === 0) {
      console.log('⚠️ No additional attributes to assign to Shopify attribute set');
      return;
    }

    const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);

    // Get all attributes for this store that match the tracked IDs
    const attributeIdsArray = Array.from(this.allShopifyAttributeIds);

    // Update the Shopify attribute set with all attribute IDs
    const { error } = await tenantDb
      .from('attribute_sets')
      .update({
        attribute_ids: attributeIdsArray,
        updated_at: new Date().toISOString()
      })
      .eq('id', this.shopifyAttributeSetId);

    if (error) {
      console.error('Failed to update Shopify attribute set with all attributes:', error);
    } else {
      console.log(`✅ Updated Shopify attribute set with ${attributeIdsArray.length} total attributes`);
    }
  }

  /**
   * Get import statistics
   */
  getImportStats() {
    return this.importStats;
  }

  /**
   * Full import (collections + products)
   */
  async fullImport(options = {}) {
    const { progressCallback = null } = options;
    const results = {
      collections: null,
      products: null,
      success: true,
      errors: []
    };

    try {
      // Import collections first
      if (progressCallback) {
        progressCallback({ stage: 'starting_collections', progress: 0 });
      }
      
      results.collections = await this.importCollections({
        ...options,
        progressCallback: (progress) => {
          if (progressCallback) {
            progressCallback({
              ...progress,
              overall_progress: Math.round((progress.current || 0) / (progress.total || 1) * 50) // 0-50% for collections
            });
          }
        }
      });

      if (!results.collections.success) {
        results.success = false;
        results.errors.push(...(results.collections.errors || []));
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
              overall_progress: 50 + Math.round((progress.current || 0) / (progress.total || 1) * 50) // 50-100% for products
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

module.exports = ShopifyImportService;