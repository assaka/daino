const AkeneoClient = require('./akeneo-client');
const AkeneoMapping = require('./akeneo-mapping');
const ConnectionManager = require('./database/ConnectionManager');
const CategoryMappingService = require('./CategoryMappingService');

class AkeneoIntegration {
  constructor(config) {
    this.config = config;
    this.client = new AkeneoClient(
      config.baseUrl,
      config.clientId,
      config.clientSecret,
      config.username,
      config.password,
      config.version || '7' // Pass version for correct API endpoint selection
    );
    this.mapping = new AkeneoMapping();
    this.importStats = {
      categories: { total: 0, imported: 0, skipped: 0, failed: 0 },
      products: { total: 0, imported: 0, skipped: 0, failed: 0 },
      families: { total: 0, imported: 0, skipped: 0, failed: 0 },
      attributes: { total: 0, imported: 0, skipped: 0, failed: 0 },
      errors: []
    };
  }

  /**
   * Test connection to Akeneo PIM
   */
  async testConnection() {
    try {
      return await this.client.testConnection();
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Import categories from Akeneo to DainoStore
   */
  async importCategories(storeId, options = {}) {
    const { locale = 'en_US', dryRun = false, filters = {}, settings = {}, progressCallback } = options;
    
    // Create separate stats for this import job
    const jobStats = {
      categories: { total: 0, imported: 0, skipped: 0, failed: 0 },
      errors: []
    };
    
    try {
      console.log('Starting category import from Akeneo...');
      
      // Get all categories from Akeneo
      let akeneoCategories = await this.client.getAllCategories();
      
      // Apply filters if specified
      if (filters.channels && filters.channels.length > 0) {
        console.log(`🔍 Filtering categories by channels: ${filters.channels.join(', ')}`);
        // Note: Category filtering by channel would need additional Akeneo API calls
        // For now, we'll log this for future implementation
      }
      
      if (filters.categoryIds && filters.categoryIds.length > 0) {
        console.log(`🔍 Filtering to specific categories: ${filters.categoryIds.join(', ')}`);
        akeneoCategories = akeneoCategories.filter(cat => filters.categoryIds.includes(cat.code));
      }
      
      // Filter by root categories and their descendants
      if (filters.rootCategories && filters.rootCategories.length > 0) {
        console.log(`🌱 Filtering to root categories and their descendants: ${filters.rootCategories.join(', ')}`);
        
        // Find all categories that belong to the selected root category trees
        const selectedCategoryTree = new Set();
        
        // First, add all selected root categories
        filters.rootCategories.forEach(rootCode => {
          const rootCategory = akeneoCategories.find(cat => cat.code === rootCode);
          if (rootCategory) {
            selectedCategoryTree.add(rootCode);
          }
        });
        
        // Then, recursively add all descendants
        const addDescendants = (parentCode) => {
          akeneoCategories.forEach(cat => {
            if (cat.parent === parentCode && !selectedCategoryTree.has(cat.code)) {
              selectedCategoryTree.add(cat.code);
              addDescendants(cat.code); // Recursively add children
            }
          });
        };
        
        filters.rootCategories.forEach(rootCode => {
          addDescendants(rootCode);
        });
        
        // Filter to only include categories in the selected trees
        akeneoCategories = akeneoCategories.filter(cat => selectedCategoryTree.has(cat.code));
        console.log(`📊 After root category filtering: ${akeneoCategories.length} categories selected`);
      }
      
      jobStats.categories.total = akeneoCategories.length;

      console.log(`Found ${akeneoCategories.length} categories in Akeneo`);

      // Transform categories to DainoStore format
      const dainoCategories = akeneoCategories.map(akeneoCategory => 
        this.mapping.transformCategory(akeneoCategory, storeId, locale, settings)
      );

      // Build category hierarchy
      const hierarchicalCategories = this.mapping.buildCategoryHierarchy(
        akeneoCategories, 
        dainoCategories
      );

      // Import categories (respecting hierarchy - parents first)
      const sortedCategories = hierarchicalCategories.sort((a, b) => a.level - b.level);
      const createdCategories = {}; // Map of akeneo_code to database ID
      const totalCategories = sortedCategories.length;
      let processed = 0;

      for (const category of sortedCategories) {
        processed++;

        // Call progress callback for linear progress tracking
        if (progressCallback) {
          await progressCallback({
            stage: 'importing_categories',
            current: processed,
            total: totalCategories,
            item: category.name || category._temp_akeneo_code
          });
        }

        try {
          // Validate category
          const validationErrors = this.mapping.validateCategory(category);
          if (validationErrors.length > 0) {
            jobStats.categories.failed++;
            jobStats.errors.push({
              type: 'category',
              akeneo_code: category._temp_akeneo_code,
              errors: validationErrors
            });
            continue;
          }

          if (!dryRun) {
            // Resolve parent_id if this category has a parent
            let parentId = null;
            if (category._temp_parent_akeneo_code && createdCategories[category._temp_parent_akeneo_code] && !category.isRoot) {
              parentId = createdCategories[category._temp_parent_akeneo_code];
            }
            
            // Log category processing info
            console.log(`🔍 Processing category: "${category.name}" (${category._temp_akeneo_code})`);
            console.log(`   - Level: ${category.level}, IsRoot: ${category.isRoot}, Parent: ${category._temp_parent_akeneo_code || 'none'}`);
            console.log(`   - Resolved parent_id: ${parentId}`);
            
            if (category.isRoot) {
              console.log(`   🌱 This is a ROOT category - parent_id will be set to null`);
            }
            
            // Check if category already exists by akeneo_code or slug
            const tenantDb = await ConnectionManager.getStoreConnection(storeId);

            const { data: existingCategories } = await tenantDb
              .from('categories')
              .select('*')
              .eq('store_id', storeId)
              .or(`slug.eq.${category.slug},name.eq.${category.name}`)
              .limit(1);

            const existingCategory = existingCategories && existingCategories.length > 0 ? existingCategories[0] : null;

            if (existingCategory) {
              // Prepare update data
              const updateData = {
                name: category.name,
                description: category.description,
                image_url: category.image_url,
                sort_order: category.sort_order,
                is_active: category.is_active,
                hide_in_menu: category.hide_in_menu,
                meta_title: category.meta_title,
                meta_description: category.meta_description,
                meta_keywords: category.meta_keywords,
                parent_id: category.isRoot ? null : parentId,
                level: category.level,
                path: category.path
              };

              // Check if prevent URL key override is enabled
              const preventOverride = settings.preventUrlKeyOverride || false;
              if (!preventOverride || !existingCategory.slug) {
                // Update slug only if setting is disabled or existing category has no slug
                updateData.slug = category.slug;
                console.log(`  🔗 Updating slug to: ${category.slug}`);
              } else {
                console.log(`  🔒 Preserving existing slug: ${existingCategory.slug} (prevent override enabled)`);
              }

              // Update existing category
              await tenantDb
                .from('categories')
                .update(updateData)
                .eq('id', existingCategory.id);
              
              createdCategories[category._temp_akeneo_code] = existingCategory.id;
              
              // Create or update Akeneo mapping
              const AkeneoMapping = require('../models/AkeneoMapping');
              await AkeneoMapping.createMapping(
                storeId,
                category._temp_akeneo_code,
                'category',
                'category',
                existingCategory.id,
                existingCategory.slug,
                { source: 'import', notes: `Updated during category import: ${category.name}`, force: true }
              );
              
              console.log(`✅ Updated category: ${category.name} (ID: ${existingCategory.id})`);
              console.log(`  📋 Created/Updated mapping: ${category._temp_akeneo_code} -> ${existingCategory.id}`);
            } else {
              // Prepare category data with resolved parent_id
              const categoryData = { ...category };
              delete categoryData.id;
              delete categoryData._temp_parent_akeneo_code;
              delete categoryData._temp_akeneo_code; // Remove temporary akeneo code
              delete categoryData.isRoot; // Remove temporary flag
              delete categoryData._originalSlug; // Remove temporary slug field
              categoryData.parent_id = category.isRoot ? null : parentId;
              
              // Create new category
              const { data: newCategory, error: createError } = await tenantDb
                .from('categories')
                .insert(categoryData)
                .select()
                .single();

              if (createError) {
                throw new Error(`Failed to create category: ${createError.message}`);
              }

              createdCategories[category._temp_akeneo_code] = newCategory.id;
              
              // Create Akeneo mapping for new category
              const AkeneoMapping = require('../models/AkeneoMapping');
              await AkeneoMapping.createMapping(
                storeId,
                category._temp_akeneo_code,
                'category',
                'category',
                newCategory.id,
                newCategory.slug,
                { source: 'import', notes: `Created during category import: ${category.name}` }
              );
              
              console.log(`✅ Created category: ${newCategory.name} (ID: ${newCategory.id})`);
              console.log(`  📋 Created mapping: ${category._temp_akeneo_code} -> ${newCategory.id}`);
            }
          } else {
            console.log(`🔍 Dry run - would process category: ${category.name}`);
          }

          jobStats.categories.imported++;
        } catch (error) {
          jobStats.categories.failed++;
          jobStats.errors.push({
            type: 'category',
            akeneo_code: category._temp_akeneo_code,
            error: error.message
          });
          console.error(`Failed to import category ${category.name}:`, error.message);
        }
      }

      console.log('Category import completed');
      
      // Update global stats for overall tracking
      this.importStats.categories = jobStats.categories;
      this.importStats.errors = [...this.importStats.errors, ...jobStats.errors];
      
      // Save import statistics to database (only if not a dry run)
      if (!dryRun) {
        try {
          const ImportStatistic = require('../models/ImportStatistic');
          await ImportStatistic.saveImportResults(storeId, 'categories', {
            totalProcessed: jobStats.categories.total,
            successfulImports: jobStats.categories.imported,
            failedImports: jobStats.categories.failed,
            skippedImports: jobStats.categories.skipped,
            errorDetails: jobStats.errors.length > 0 ? JSON.stringify(jobStats.errors) : null,
            importMethod: 'manual',
            importSource: 'akeneo'
          });
          console.log('✅ Category import statistics saved to database');
        } catch (statsError) {
          console.error('❌ Failed to save category import statistics:', statsError.message);
        }
      }

      // Prepare response based on dry run mode
      const response = {
        success: true,
        stats: jobStats.categories,
        errors: jobStats.errors,
        dryRun: dryRun
      };
      
      if (dryRun) {
        response.message = `Dry run completed. Would import ${jobStats.categories.imported} categories`;
        response.preview = {
          totalFound: jobStats.categories.total,
          wouldImport: jobStats.categories.imported,
          wouldSkip: jobStats.categories.skipped,
          wouldFail: jobStats.categories.failed
        };
      } else {
        response.message = `Imported ${jobStats.categories.imported} categories`;
      }
      
      return response;

    } catch (error) {
      console.error('Category import failed:', error);
      return {
        success: false,
        error: error.message,
        stats: jobStats.categories,
        errors: jobStats.errors
      };
    }
  }

  /**
   * Import products from Akeneo to DainoStore
   * This method now automatically imports product models as configurable products
   * and links variants to their parent products
   */
  async importProducts(storeId, options = {}) {
    // Delegate to the new method that handles product models
    return await this.importProductsWithModels(storeId, options);
  }

  /**
   * Legacy method: Import products from Akeneo to DainoStore (without product model support)
   * This is kept for backward compatibility but importProducts() now uses importProductsWithModels()
   */
  async importProductsLegacy(storeId, options = {}) {
    const { locale = 'en_US', dryRun = false, batchSize = 50, filters = {}, settings = {}, customMappings = {} } = options;
    
    // Ensure downloadImages is enabled by default in settings
    const enhancedSettings = {
      includeImages: true,
      downloadImages: true,
      includeFiles: true,
      includeStock: true,
      akeneoBaseUrl: this.config.baseUrl,
      ...settings
    };
    
    try {
      console.log('🚀 Starting product import from Akeneo...');
      console.log(`📍 Store ID: ${storeId}`);
      console.log(`🧪 Dry run mode: ${dryRun}`);
      console.log(`📦 Batch size: ${batchSize}`);
      
      // Get category mapping for product category assignment
      console.log('📂 Building category mapping...');
      const categoryMapping = await this.buildCategoryMapping(storeId);
      console.log(`✅ Category mapping built: ${Object.keys(categoryMapping).length} categories`);

      // Initialize CategoryMappingService for auto-creation of unmapped categories
      const categoryMappingService = new CategoryMappingService(storeId, 'akeneo');
      const autoCreateSettings = await categoryMappingService.getAutoCreateSettings();
      console.log(`🔧 Category auto-create: ${autoCreateSettings.enabled ? 'enabled' : 'disabled'}`);

      // Fetch Akeneo categories for name lookup (needed for auto-creation)
      let akeneoCategories = [];
      if (autoCreateSettings.enabled) {
        console.log('📂 Fetching Akeneo categories for auto-creation lookup...');
        try {
          akeneoCategories = await this.client.getAllCategories();
          console.log(`✅ Loaded ${akeneoCategories.length} Akeneo categories for lookup`);
        } catch (catError) {
          console.warn('⚠️ Could not fetch Akeneo categories for auto-creation:', catError.message);
        }
      }
      // Build category code to name map for quick lookup
      const akeneoCategoryMap = {};
      akeneoCategories.forEach(cat => {
        akeneoCategoryMap[cat.code] = {
          code: cat.code,
          name: cat.labels?.en_US || cat.labels?.en_GB || cat.code,
          parent_code: cat.parent
        };
      });
      
      // Get family mapping for product attribute set assignment
      console.log('🏷️ Building family mapping...');
      const familyMapping = await this.buildFamilyMapping(storeId);
      console.log(`✅ Family mapping built: ${Object.keys(familyMapping).length} families`);

      // Fetch attribute types for automatic image/file mapping
      console.log('📸 Fetching attribute types for automatic image/file mapping...');
      const akeneoAttributeTypes = {};
      try {
        const allAttributes = await this.client.getAllAttributes();
        allAttributes.forEach(attr => {
          akeneoAttributeTypes[attr.code] = attr.type;
        });
        const imageTypeCount = Object.values(akeneoAttributeTypes).filter(t => t === 'pim_catalog_image').length;
        const fileTypeCount = Object.values(akeneoAttributeTypes).filter(t => t === 'pim_catalog_file').length;
        console.log(`✅ Loaded ${Object.keys(akeneoAttributeTypes).length} attribute types (${imageTypeCount} image, ${fileTypeCount} file)`);
      } catch (attrError) {
        console.warn('⚠️ Could not fetch attribute types for auto-mapping:', attrError.message);
      }

      // Get all products from Akeneo using the robust client method
      // Pass updatedSince filter to API for efficient server-side filtering
      console.log('📡 Fetching products from Akeneo...');
      const productFetchOptions = {};
      if (filters.updatedSince && filters.updatedSince > 0) {
        productFetchOptions.updatedSinceHours = filters.updatedSince;
        console.log(`🔍 Will filter products updated in last ${filters.updatedSince} hours`);
      }
      let akeneoProducts = await this.client.getAllProducts(productFetchOptions);

      console.log(`📦 Found ${akeneoProducts.length} products from Akeneo`);
      console.log(`🎯 Product filters:`, filters);
      console.log(`⚙️ Product settings:`, enhancedSettings);
      console.log(`🗺️ Custom mappings:`, customMappings);

      // Apply product filters (family filter still done in-memory)
      if (filters.families && filters.families.length > 0) {
        console.log(`🔍 Filtering by families: ${filters.families.join(', ')}`);
        akeneoProducts = akeneoProducts.filter(product =>
          filters.families.includes(product.family)
        );
        console.log(`📊 After family filtering: ${akeneoProducts.length} products`);
      }

      if (filters.completeness && filters.completeness > 0) {
        console.log(`🔍 Filtering by completeness: ${filters.completeness}%`);
        // Note: This would require additional API calls to check completeness
        // For now, we'll log this requirement for future implementation
        console.log(`⚠️ Completeness filtering requires additional implementation`);
      }
      
      this.importStats.products.total = akeneoProducts.length;
      
      if (akeneoProducts.length === 0) {
        console.log('⚠️ No products found in Akeneo');
        return {
          success: true,
          stats: this.importStats.products,
          message: 'No products found in Akeneo to import',
          dryRun: dryRun
        };
      }

      // Process products in batches
      console.log(`💾 Processing ${akeneoProducts.length} products in batches of ${batchSize}...`);
      let processed = 0;
      
      for (let i = 0; i < akeneoProducts.length; i += batchSize) {
        const batch = akeneoProducts.slice(i, i + batchSize);
        console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(akeneoProducts.length/batchSize)} (${batch.length} products)`);
        
        for (const akeneoProduct of batch) {
          processed++;
          try {
            // Log progress for every 10 products or if it's a small batch
            if (processed % 10 === 0 || batch.length <= 10) {
              console.log(`📊 Processing product ${processed}/${akeneoProducts.length}: ${akeneoProduct.identifier || akeneoProduct.uuid || 'Unknown'}`);
            }
            
            // Transform product to DainoStore format (now async)
            const dainoProduct = await this.mapping.transformProduct(akeneoProduct, storeId, locale, null, customMappings, enhancedSettings, this.client, akeneoAttributeTypes);

            // Apply product settings
            if (enhancedSettings.status === 'disabled') {
              dainoProduct.status = 'inactive';
            } else if (enhancedSettings.status === 'enabled') {
              dainoProduct.status = 'active';
            }
            
            // Handle image inclusion setting
            if (!enhancedSettings.includeImages) {
              dainoProduct.images = [];
            }
            
            // Handle file inclusion setting (if implemented in transformProduct)
            if (!enhancedSettings.includeFiles) {
              if (dainoProduct.files) {
                dainoProduct.files = [];
              }
            }
            
            // Handle stock inclusion setting
            if (!enhancedSettings.includeStock) {
              dainoProduct.stock_quantity = 0;
              dainoProduct.manage_stock = true;
              dainoProduct.infinite_stock = false;
              if (dainoProduct.stock_data) {
                delete dainoProduct.stock_data;
              }
            }
            
            // Map category IDs with auto-creation support for unmapped categories
            const originalCategoryIds = akeneoProduct.categories || [];
            const mappedCategoryIds = this.mapping.mapCategoryIds(originalCategoryIds, categoryMapping);

            // For unmapped categories, try auto-creation if enabled
            const unmappedCategoryCodes = originalCategoryIds.filter(code => !categoryMapping[code]);

            if (unmappedCategoryCodes.length > 0 && autoCreateSettings.enabled && !dryRun) {
              console.log(`🔄 Auto-creating ${unmappedCategoryCodes.length} unmapped categories for product ${dainoProduct.sku}...`);
              for (const catCode of unmappedCategoryCodes) {
                const catInfo = akeneoCategoryMap[catCode] || { code: catCode, name: catCode };
                const newCategoryId = await categoryMappingService.autoCreateCategory({
                  id: catCode,
                  code: catCode,
                  name: catInfo.name,
                  parent_code: catInfo.parent_code
                });
                if (newCategoryId) {
                  mappedCategoryIds.push(newCategoryId);
                  // Add to categoryMapping for future products in this import
                  categoryMapping[catCode] = newCategoryId;
                }
              }
            }

            dainoProduct.category_ids = mappedCategoryIds;

            if (originalCategoryIds.length > 0 && dainoProduct.category_ids.length === 0) {
              console.warn(`⚠️ Product ${dainoProduct.sku}: No valid category mappings found for ${originalCategoryIds.join(', ')}`);
            }
            
            // Map family to attribute set
            if (akeneoProduct.family && familyMapping[akeneoProduct.family]) {
              dainoProduct.attribute_set_id = familyMapping[akeneoProduct.family];
            } else if (akeneoProduct.family) {
              console.warn(`⚠️ Product ${dainoProduct.sku}: No valid family mapping found for ${akeneoProduct.family}`);
            }

            // Validate product
            const validationErrors = this.mapping.validateProduct(dainoProduct);
            if (validationErrors.length > 0) {
              this.importStats.products.failed++;
              this.importStats.errors.push({
                type: 'product',
                akeneo_identifier: dainoProduct.akeneo_identifier,
                errors: validationErrors
              });
              console.error(`❌ Validation failed for ${dainoProduct.sku}: ${validationErrors.join(', ')}`);
              continue;
            }

            if (!dryRun) {
              // Check if product already exists
              const tenantDb = await ConnectionManager.getStoreConnection(storeId);

              const { data: existingProducts } = await tenantDb
                .from('products')
                .select('*')
                .eq('store_id', storeId)
                .eq('sku', dainoProduct.sku)
                .limit(1);

              const existingProduct = existingProducts && existingProducts.length > 0 ? existingProducts[0] : null;

              if (existingProduct) {
                // Log image data for debugging
                if (dainoProduct.images && dainoProduct.images.length > 0) {
                  console.log(`[Akeneo] Images for product ${dainoProduct.sku}:`, dainoProduct.images);
                } else {
                  console.log(`[Akeneo] No images for product ${dainoProduct.sku}`);
                }
                
                // Prepare update data
                const updateData = {
                  name: dainoProduct.name,
                  description: dainoProduct.description,
                  short_description: dainoProduct.short_description,
                  price: dainoProduct.price,
                  compare_price: dainoProduct.compare_price,
                  cost_price: dainoProduct.cost_price,
                  weight: dainoProduct.weight,
                  dimensions: dainoProduct.dimensions,
                  images: dainoProduct.images,
                  status: dainoProduct.status,
                  visibility: dainoProduct.visibility,
                  featured: dainoProduct.featured,
                  tags: dainoProduct.tags,
                  attributes: dainoProduct.attributes,
                  seo: dainoProduct.seo,
                  category_ids: dainoProduct.category_ids,
                  // Include stock-related fields
                  manage_stock: dainoProduct.manage_stock,
                  stock_quantity: dainoProduct.stock_quantity,
                  allow_backorders: dainoProduct.allow_backorders,
                  low_stock_threshold: dainoProduct.low_stock_threshold,
                  infinite_stock: dainoProduct.infinite_stock
                };

                // Check if prevent URL key override is enabled
                const preventOverride = settings.preventUrlKeyOverride || false;
                if (!preventOverride || !existingProduct.slug) {
                  // Update slug only if setting is disabled or existing product has no slug
                  updateData.slug = dainoProduct.slug;
                  if (processed <= 5 || processed % 25 === 0) {
                    console.log(`  🔗 Updating slug to: ${dainoProduct.slug}`);
                  }
                } else {
                  if (processed <= 5 || processed % 25 === 0) {
                    console.log(`  🔒 Preserving existing slug: ${existingProduct.slug} (prevent override enabled)`);
                  }
                }

                // Clean metadata from images array in update data
                if (updateData.images && Array.isArray(updateData.images)) {
                  updateData.images = updateData.images.map(img => {
                    if (img && typeof img === 'object' && 'metadata' in img) {
                      const { metadata, ...cleanImg } = img;
                      return cleanImg;
                    }
                    return img;
                  });
                }
                
                // Clean any field that might have 'metadata' as a key
                if (updateData.attributes && typeof updateData.attributes === 'object') {
                  // Remove metadata key if it exists in attributes
                  if ('metadata' in updateData.attributes) {
                    delete updateData.attributes.metadata;
                    console.log('[DEBUG] Removed metadata from attributes field in update');
                  }
                }

                // Debug: Log what we're trying to update
                console.log('[DEBUG] Update data keys being sent to database:', Object.keys(updateData));
                
                // Check if any field contains metadata
                Object.keys(updateData).forEach(key => {
                  if (typeof updateData[key] === 'object' && updateData[key] !== null) {
                    if (Array.isArray(updateData[key])) {
                      updateData[key].forEach((item, idx) => {
                        if (item && typeof item === 'object' && 'metadata' in item) {
                          console.log(`[DEBUG] Update field '${key}[${idx}]' contains metadata property`);
                        }
                      });
                    } else if ('metadata' in updateData[key]) {
                      console.log(`[DEBUG] Update field '${key}' contains metadata property`);
                    }
                  }
                });

                // CRITICAL FIX: Check for [object Object] values in numeric fields before database update
                const numericFields = ['price', 'compare_price', 'cost_price', 'weight'];
                numericFields.forEach(field => {
                  if (updateData[field] !== null && updateData[field] !== undefined) {
                    const value = updateData[field];
                    const stringValue = String(value);
                    
                    if (stringValue === '[object Object]' || stringValue.includes('[object Object]')) {
                      console.warn(`⚠️ CRITICAL: Preventing [object Object] in field '${field}' for product ${updateData.sku || 'unknown'}`);
                      console.warn(`   Original value:`, value);
                      console.warn(`   String representation: "${stringValue}"`);
                      updateData[field] = null; // Set to null to prevent database error
                    }
                  }
                });

                // Update existing product
                await tenantDb
                  .from('products')
                  .update(updateData)
                  .eq('id', existingProduct.id);
                
                if (processed <= 5 || processed % 25 === 0) {
                  console.log(`✅ Updated product: ${dainoProduct.name} (${dainoProduct.sku})`);
                }
              } else {
                // Prepare product data for creation
                const productData = { ...dainoProduct };
                delete productData._originalSlug; // Remove temporary slug field
                // Remove Akeneo-specific fields that don't exist in Product model
                delete productData.akeneo_uuid;
                delete productData.akeneo_identifier;
                delete productData.akeneo_family;
                delete productData.akeneo_groups;
                delete productData.sale_price; // Not in Product model
                delete productData.files; // Not in Product model
                delete productData.metadata; // Not in Product model
                delete productData.custom_attributes; // Not in Product model
                
                // Clean metadata from images array
                if (productData.images && Array.isArray(productData.images)) {
                  productData.images = productData.images.map(img => {
                    if (img && typeof img === 'object' && 'metadata' in img) {
                      const { metadata, ...cleanImg } = img;
                      return cleanImg;
                    }
                    return img;
                  });
                }
                
                // Clean any field that might have 'metadata' as a key
                if (productData.attributes && typeof productData.attributes === 'object') {
                  // Remove metadata key if it exists in attributes
                  if ('metadata' in productData.attributes) {
                    delete productData.attributes.metadata;
                    console.log('[DEBUG] Removed metadata from attributes field');
                  }
                }
                
                // Debug: Log what we're trying to create
                console.log('[DEBUG] Product data keys being sent to database:', Object.keys(productData));
                
                // Check if any field contains metadata
                Object.keys(productData).forEach(key => {
                  if (typeof productData[key] === 'object' && productData[key] !== null) {
                    if (Array.isArray(productData[key])) {
                      productData[key].forEach((item, idx) => {
                        if (item && typeof item === 'object' && 'metadata' in item) {
                          console.log(`[DEBUG] Field '${key}[${idx}]' contains metadata property`);
                        }
                      });
                    } else if ('metadata' in productData[key]) {
                      console.log(`[DEBUG] Field '${key}' contains metadata property`);
                    }
                  }
                });
                
                // CRITICAL FIX: Check for [object Object] values in numeric fields before database insertion
                const numericFields = ['price', 'compare_price', 'cost_price', 'weight'];
                numericFields.forEach(field => {
                  if (productData[field] !== null && productData[field] !== undefined) {
                    const value = productData[field];
                    const stringValue = String(value);
                    
                    if (stringValue === '[object Object]' || stringValue.includes('[object Object]')) {
                      console.warn(`⚠️ CRITICAL: Preventing [object Object] in field '${field}' for product ${productData.sku}`);
                      console.warn(`   Original value:`, value);
                      console.warn(`   String representation: "${stringValue}"`);
                      productData[field] = null; // Set to null to prevent database error
                    }
                  }
                });
                
                // Create new product
                await tenantDb
                  .from('products')
                  .insert(productData);
                if (processed <= 5 || processed % 25 === 0) {
                  console.log(`✅ Created product: ${dainoProduct.name} (${dainoProduct.sku})`);
                }
              }
            } else {
              if (processed <= 5) {
                console.log(`🔍 Dry run - would process product: ${dainoProduct.name} (${dainoProduct.sku})`);
              }
            }

            this.importStats.products.imported++;
          } catch (error) {
            this.importStats.products.failed++;
            this.importStats.errors.push({
              type: 'product',
              akeneo_identifier: akeneoProduct.identifier || akeneoProduct.uuid || 'Unknown',
              error: error.message
            });
            console.error(`❌ Failed to import product ${akeneoProduct.identifier || akeneoProduct.uuid}: ${error.message}`);
          }
        }

        // Log batch progress
        const batchEnd = Math.min(i + batchSize, akeneoProducts.length);
        console.log(`📊 Batch ${Math.floor(i/batchSize) + 1} completed: ${batchEnd}/${akeneoProducts.length} products processed`);
      }

      console.log('🎉 Product import completed successfully!');
      console.log(`📊 Final stats: ${this.importStats.products.imported} imported, ${this.importStats.products.failed} failed, ${this.importStats.products.total} total`);
      
      const response = {
        success: true,
        stats: this.importStats.products,
        dryRun: dryRun,
        details: {
          processedCount: processed,
          completedSuccessfully: true
        }
      };
      
      // Save import statistics to database (only if not a dry run)
      if (!dryRun) {
        try {
          const ImportStatistic = require('../models/ImportStatistic');
          await ImportStatistic.saveImportResults(storeId, 'products', {
            totalProcessed: this.importStats.products.total,
            successfulImports: this.importStats.products.imported,
            failedImports: this.importStats.products.failed,
            skippedImports: this.importStats.products.skipped,
            errorDetails: this.importStats.errors.length > 0 ? JSON.stringify(this.importStats.errors) : null,
            importMethod: 'manual',
            importSource: 'akeneo'
          });
          console.log('✅ Product import statistics saved to database');
        } catch (statsError) {
          console.error('❌ Failed to save product import statistics:', statsError.message);
        }
      }

      if (dryRun) {
        response.message = `Dry run completed. Would import ${this.importStats.products.imported} products`;
        console.log(`🧪 Dry run result: Would import ${this.importStats.products.imported}/${this.importStats.products.total} products`);
      } else {
        response.message = `Successfully imported ${this.importStats.products.imported} products`;
        console.log(`✅ Live import result: Imported ${this.importStats.products.imported}/${this.importStats.products.total} products to database`);
      }
      
      return response;

    } catch (error) {
      console.error('Product import failed:', error);
      return {
        success: false,
        error: error.message,
        stats: this.importStats.products
      };
    }
  }

  /**
   * Import attributes from Akeneo to DainoStore
   */
  async importAttributes(storeId, options = {}) {
    const { dryRun = false, filters = {}, settings = {}, progressCallback } = options;
    
    try {
      console.log('🚀 Starting attribute import from Akeneo...');
      console.log(`📍 Store ID: ${storeId}`);
      console.log(`🧪 Dry run mode: ${dryRun}`);
      
      // Get all attributes from Akeneo
      console.log('📡 Fetching attributes from Akeneo API...');
      let akeneoAttributes = await this.client.getAllAttributes();
      
      console.log(`📦 Found ${akeneoAttributes.length} attributes in Akeneo`);
      console.log(`🎯 Attribute filters:`, filters);
      console.log(`⚙️ Attribute settings:`, settings);
      
      // Apply attribute filters
      if (filters.families && filters.families.length > 0) {
        console.log(`🔍 Filtering by families: ${filters.families.join(', ')}`);
        
        // Get the selected families to extract their attribute codes
        console.log('📡 Fetching family data to get attribute codes...');
        const selectedFamilyData = [];
        for (const familyCode of filters.families) {
          try {
            const family = await this.client.getFamily(familyCode);
            selectedFamilyData.push(family);
            console.log(`✅ Found family ${familyCode} with ${family.attributes ? family.attributes.length : 0} attributes`);
          } catch (error) {
            console.warn(`⚠️ Failed to fetch family ${familyCode}:`, error.message);
          }
        }
        
        // Extract all attribute codes from selected families
        const familyAttributeCodes = new Set();
        selectedFamilyData.forEach(family => {
          if (family.attributes && Array.isArray(family.attributes)) {
            family.attributes.forEach(attrCode => familyAttributeCodes.add(attrCode));
          }
        });
        
        console.log(`📊 Found ${familyAttributeCodes.size} unique attributes across selected families`);
        
        // Filter attributes to only those belonging to selected families
        akeneoAttributes = akeneoAttributes.filter(attribute => 
          familyAttributeCodes.has(attribute.code)
        );
        
        console.log(`📊 After family filtering: ${akeneoAttributes.length} attributes (filtered from ${this.importStats.attributes.total || 'unknown'})`);
      }
      
      if (filters.updatedSince) {
        console.log(`🔍 Filtering by updated interval: ${filters.updatedSince} hours`);
        // Calculate the date threshold
        const hoursAgo = new Date();
        hoursAgo.setHours(hoursAgo.getHours() - filters.updatedSince);
        
        akeneoAttributes = akeneoAttributes.filter(attribute => {
          if (attribute.updated) {
            const updatedDate = new Date(attribute.updated);
            return updatedDate >= hoursAgo;
          }
          return true; // Include attributes without update timestamp
        });
        console.log(`📊 After time filtering: ${akeneoAttributes.length} attributes`);
      }
      
      this.importStats.attributes.total = akeneoAttributes.length;
      
      // Log sample of attribute types
      const attributeTypes = {};
      akeneoAttributes.slice(0, 10).forEach(attr => {
        attributeTypes[attr.type] = (attributeTypes[attr.type] || 0) + 1;
      });
      console.log('🏷️ Sample attribute types:', attributeTypes);

      // Transform attributes to DainoStore format
      console.log('🔄 Transforming attributes to DainoStore format...');
      const dainoAttributes = [];
      
      // Check if attribute options should be included (default: true)
      const includeAttributeOptions = settings.includeAttributeOptions !== false;
      console.log(`🎯 Include attribute options: ${includeAttributeOptions}`);
      
      for (const akeneoAttribute of akeneoAttributes) {
        let attributeOptions = null;
        
        // Fetch attribute options for select/multiselect types if enabled
        if (includeAttributeOptions && 
            (akeneoAttribute.type === 'pim_catalog_simpleselect' || 
             akeneoAttribute.type === 'pim_catalog_multiselect')) {
          try {
            console.log(`📋 Fetching options for ${akeneoAttribute.type} attribute: ${akeneoAttribute.code}`);
            attributeOptions = await this.client.getAttributeOptions(akeneoAttribute.code);
            console.log(`✅ Found ${attributeOptions.length} options for ${akeneoAttribute.code}`);
          } catch (error) {
            console.error(`❌ Failed to fetch options for attribute ${akeneoAttribute.code}:`, error.message);
            // Continue with transformation without options
          }
        }
        
        // Transform the attribute with fetched options
        const transformedAttribute = this.mapping.transformAttribute(akeneoAttribute, storeId, 'en_US', attributeOptions);
        dainoAttributes.push(transformedAttribute);
      }

      console.log(`✅ Transformed ${dainoAttributes.length} attributes`);

      // Import attributes
      console.log('💾 Starting database import process...');
      let processed = 0;
      const totalAttributes = dainoAttributes.length;
      for (const attribute of dainoAttributes) {
        processed++;

        // Call progress callback for linear progress tracking
        if (progressCallback) {
          await progressCallback({
            stage: 'importing_attributes',
            current: processed,
            total: totalAttributes,
            item: attribute.name || attribute.code
          });
        }

        if (processed % 50 === 0) {
          console.log(`📊 Progress: ${processed}/${totalAttributes} attributes processed`);
        }
        try {
          // Validate attribute
          const validationErrors = this.mapping.validateAttribute(attribute);
          if (validationErrors.length > 0) {
            this.importStats.attributes.failed++;
            this.importStats.errors.push({
              type: 'attribute',
              akeneo_code: attribute.akeneo_code,
              errors: validationErrors
            });
            continue;
          }

          if (!dryRun) {
            // Check if attribute already exists
            const tenantDb = await ConnectionManager.getStoreConnection(storeId);

            const { data: existingAttributes } = await tenantDb
              .from('attributes')
              .select('*')
              .eq('store_id', storeId)
              .eq('code', attribute.code)
              .limit(1);

            const existingAttribute = existingAttributes && existingAttributes.length > 0 ? existingAttributes[0] : null;

            if (existingAttribute) {
              // Update existing attribute - preserve filterable setting for existing attributes
              await tenantDb
                .from('attributes')
                .update({
                type: attribute.type,
                is_required: attribute.is_required,
                // Don't update is_filterable for existing attributes to preserve user customizations
                is_searchable: attribute.is_searchable,
                is_usable_in_conditions: attribute.is_usable_in_conditions,
                filter_type: attribute.filter_type,
                // Note: options are stored in attribute_values table, not here
                file_settings: attribute.file_settings,
                sort_order: attribute.sort_order,
                updated_at: new Date().toISOString()
              })
                .eq('id', existingAttribute.id);

              // Ensure English translation exists for existing attribute
              const { data: existingTranslation } = await tenantDb
                .from('attribute_translations')
                .select('id')
                .eq('attribute_id', existingAttribute.id)
                .eq('language_code', 'en')
                .maybeSingle();

              if (!existingTranslation) {
                await tenantDb
                  .from('attribute_translations')
                  .insert({
                    attribute_id: existingAttribute.id,
                    language_code: 'en',
                    label: attribute.name,
                    description: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                console.log(`✅ Added missing English translation for existing attribute: ${attribute.code}`);
              } else {
                // Update existing translation
                await tenantDb
                  .from('attribute_translations')
                  .update({
                    label: attribute.name,
                    updated_at: new Date().toISOString()
                  })
                  .eq('attribute_id', existingAttribute.id)
                  .eq('language_code', 'en');
              }

              console.log(`✅ Updated attribute: ${attribute.name} (${attribute.code}) - Preserved filterable setting`);
            } else {
              // Define default filterable attributes for new imports only
              const defaultFilterableAttributes = ['price', 'name', 'color', 'colour', 'brand', 'manufacturer'];

              // Define price-related attributes that should NOT be filterable
              const excludedPriceAttributes = [
                'retail_price', 'minimal_price', 'price_type', 'dealer_price',
                'price_view', 'msrp_display_actual_price_type'
              ];

              // For new attributes, check if it should be filterable by default (exact match only, excluding specific price attributes)
              const shouldBeFilterable = defaultFilterableAttributes.includes(attribute.code.toLowerCase()) &&
                                        !excludedPriceAttributes.includes(attribute.code.toLowerCase());

              // Remove temporary fields and fields that belong in other tables
              const attributeData = { ...attribute };
              delete attributeData.akeneo_code;
              delete attributeData.akeneo_type;
              delete attributeData.akeneo_group;
              // Keep name - attributes table has NOT NULL constraint on name column
              // Note: name is also stored in attribute_translations for i18n
              delete attributeData.options; // Remove options - they go in attribute_values table

              // Ensure name is never null - fallback to code if needed
              if (!attributeData.name) {
                attributeData.name = attribute.code || `attribute_${Date.now()}`;
              }

              // Override filterable setting for new attributes
              if (shouldBeFilterable) {
                attributeData.is_filterable = true;
                console.log(`🎯 Setting ${attribute.code} as filterable (matches default criteria)`);
              } else {
                attributeData.is_filterable = false;
                console.log(`🚫 Setting ${attribute.code} as not filterable (not in default criteria)`);
              }

              // Create new attribute
              const { data: newAttribute, error: createError } = await tenantDb
                .from('attributes')
                .insert(attributeData)
                .select()
                .single();

              if (createError) {
                throw new Error(`Failed to create attribute: ${createError.message}`);
              }

              // Create English translation for the new attribute
              try {
                await tenantDb
                  .from('attribute_translations')
                  .insert({
                    attribute_id: newAttribute.id,
                    language_code: 'en',
                    label: attribute.name,
                    description: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
              } catch (translationError) {
                console.error(`⚠️ Failed to create translation for ${attribute.code}:`, translationError);
                // Don't throw - attribute is created, translation can be added later
              }

              if (processed <= 10 || processed % 100 === 0) {
                console.log(`✅ Created attribute: ${attribute.name} (${newAttribute.code}) - Type: ${newAttribute.type} - Filterable: ${newAttribute.is_filterable}`);
              }
            }
          } else {
            if (processed <= 5) {
              console.log(`🔍 Dry run - would process attribute: ${attribute.name} (${attribute.code}) - Type: ${attribute.type}`);
            }
          }

          this.importStats.attributes.imported++;
        } catch (error) {
          this.importStats.attributes.failed++;
          this.importStats.errors.push({
            type: 'attribute',
            akeneo_code: attribute.akeneo_code,
            error: error.message
          });
          console.error(`Failed to import attribute ${attribute.code}:`, error.message);
        }
      }

      console.log('🎉 Attribute import completed successfully!');
      console.log(`📊 Final stats: ${this.importStats.attributes.imported} imported, ${this.importStats.attributes.failed} failed, ${this.importStats.attributes.total} total`);
      
      const response = {
        success: true,
        stats: this.importStats.attributes,
        dryRun: dryRun,
        details: {
          processedCount: processed,
          completedSuccessfully: true
        }
      };
      
      // Save import statistics to database (only if not a dry run)
      if (!dryRun) {
        try {
          const ImportStatistic = require('../models/ImportStatistic');
          await ImportStatistic.saveImportResults(storeId, 'attributes', {
            totalProcessed: this.importStats.attributes.total,
            successfulImports: this.importStats.attributes.imported,
            failedImports: this.importStats.attributes.failed,
            skippedImports: this.importStats.attributes.skipped,
            errorDetails: this.importStats.errors.length > 0 ? JSON.stringify(this.importStats.errors) : null,
            importMethod: 'manual',
            importSource: 'akeneo'
          });
          console.log('✅ Attribute import statistics saved to database');
        } catch (statsError) {
          console.error('❌ Failed to save attribute import statistics:', statsError.message);
        }
      }

      if (dryRun) {
        response.message = `Dry run completed. Would import ${this.importStats.attributes.imported} attributes`;
        console.log(`🧪 Dry run result: Would import ${this.importStats.attributes.imported}/${this.importStats.attributes.total} attributes`);
      } else {
        response.message = `Successfully imported ${this.importStats.attributes.imported} attributes`;
        console.log(`✅ Live import result: Imported ${this.importStats.attributes.imported}/${this.importStats.attributes.total} attributes to database`);
      }
      
      return response;

    } catch (error) {
      console.error('Attribute import failed:', error);
      return {
        success: false,
        error: error.message,
        stats: this.importStats.attributes
      };
    }
  }

  /**
   * Import families from Akeneo to DainoStore AttributeSets
   */
  async importFamilies(storeId, options = {}) {
    const { dryRun = false, filters = {}, progressCallback } = options;
    
    try {
      console.log('Starting family import from Akeneo...');
      console.log(`🎯 Family filters:`, filters);
      
      // Get all families from Akeneo
      let akeneoFamilies = await this.client.getAllFamilies();
      
      // Apply family filter if specified
      if (filters.families && filters.families.length > 0) {
        console.log(`🔍 Filtering to specific families: ${filters.families.join(', ')}`);
        akeneoFamilies = akeneoFamilies.filter(family => 
          filters.families.includes(family.code)
        );
        console.log(`📊 After filtering: ${akeneoFamilies.length} families selected`);
      }
      
      this.importStats.families.total = akeneoFamilies.length;

      console.log(`Found ${akeneoFamilies.length} families to import`);

      // Transform families to DainoStore format
      const dainoFamilies = akeneoFamilies.map(akeneoFamily => 
        this.mapping.transformFamily(akeneoFamily, storeId)
      );

      // Build mapping of attribute codes to IDs for linking
      const attributeMapping = await this.buildAttributeMapping(storeId);

      // Import families
      const totalFamilies = dainoFamilies.length;
      let processed = 0;
      for (const family of dainoFamilies) {
        processed++;

        // Call progress callback for linear progress tracking
        if (progressCallback) {
          await progressCallback({
            stage: 'importing_families',
            current: processed,
            total: totalFamilies,
            item: family.name || family.akeneo_code
          });
        }

        try {
          // Validate family
          const validationErrors = this.mapping.validateFamily(family);
          if (validationErrors.length > 0) {
            this.importStats.families.failed++;
            this.importStats.errors.push({
              type: 'family',
              akeneo_code: family.akeneo_code,
              errors: validationErrors
            });
            continue;
          }

          if (!dryRun) {
            // Map attribute codes to IDs
            const attributeIds = family.akeneo_attribute_codes
              .map(code => attributeMapping[code])
              .filter(id => id); // Remove undefined mappings

            // Check if family already exists
            const tenantDb = await ConnectionManager.getStoreConnection(storeId);

            const { data: existingFamilies } = await tenantDb
              .from('attribute_sets')
              .select('*')
              .eq('store_id', storeId)
              .eq('name', family.name)
              .limit(1);

            const existingFamily = existingFamilies && existingFamilies.length > 0 ? existingFamilies[0] : null;

            if (existingFamily) {
              // Update existing family
              await tenantDb
                .from('attribute_sets')
                .update({
                name: family.name,
                description: family.description,
                attribute_ids: attributeIds,
                updated_at: new Date().toISOString()
              })
                .eq('id', existingFamily.id);
              
              console.log(`✅ Updated family: ${family.name} with ${attributeIds.length} attributes`);
            } else {
              // Remove temporary fields
              const familyData = { ...family };
              delete familyData.akeneo_code;
              delete familyData.akeneo_attribute_codes;
              familyData.attribute_ids = attributeIds;
              
              // Create new family
              const { data: newFamily, error: createError } = await tenantDb
                .from('attribute_sets')
                .insert(familyData)
                .select()
                .single();

              if (createError) {
                throw new Error(`Failed to create family: ${createError.message}`);
              }

              console.log(`✅ Created family: ${newFamily.name} with ${attributeIds.length} attributes`);
            }
          } else {
            console.log(`🔍 Dry run - would process family: ${family.name} with ${family.akeneo_attribute_codes.length} attributes`);
          }

          this.importStats.families.imported++;
        } catch (error) {
          this.importStats.families.failed++;
          this.importStats.errors.push({
            type: 'family',
            akeneo_code: family.akeneo_code,
            error: error.message
          });
          console.error(`Failed to import family ${family.name}:`, error.message);
        }
      }

      console.log('Family import completed');
      
      const response = {
        success: true,
        stats: this.importStats.families,
        dryRun: dryRun
      };
      
      // Save import statistics to database (only if not a dry run)
      if (!dryRun) {
        try {
          const ImportStatistic = require('../models/ImportStatistic');
          await ImportStatistic.saveImportResults(storeId, 'families', {
            totalProcessed: this.importStats.families.total,
            successfulImports: this.importStats.families.imported,
            failedImports: this.importStats.families.failed,
            skippedImports: this.importStats.families.skipped,
            errorDetails: this.importStats.errors.length > 0 ? JSON.stringify(this.importStats.errors) : null,
            importMethod: 'manual',
            importSource: 'akeneo'
          });
          console.log('✅ Family import statistics saved to database');
        } catch (statsError) {
          console.error('❌ Failed to save family import statistics:', statsError.message);
        }
      }

      if (dryRun) {
        response.message = `Dry run completed. Would import ${this.importStats.families.imported} families`;
      } else {
        response.message = `Imported ${this.importStats.families.imported} families`;
      }
      
      return response;

    } catch (error) {
      console.error('Family import failed:', error);
      return {
        success: false,
        error: error.message,
        stats: this.importStats.families
      };
    }
  }

  /**
   * Import both categories and products
   */
  async importAll(storeId, options = {}) {
    const { locale = 'en_US', dryRun = false } = options;

    try {
      console.log('Starting full import from Akeneo...');

      // Reset stats
      this.resetStats();

      // Import categories first (needed for product category mapping)
      const categoryResult = await this.importCategories(storeId, { locale, dryRun });
      
      if (!categoryResult.success) {
        return {
          success: false,
          error: 'Category import failed',
          results: { categories: categoryResult }
        };
      }

      // Import products
      const productResult = await this.importProducts(storeId, { locale, dryRun });

      return {
        success: true,
        stats: {
          categories: categoryResult.stats,
          products: productResult.stats,
          total: (categoryResult.stats?.imported || 0) + (productResult.stats?.imported || 0)
        },
        results: {
          categories: categoryResult,
          products: productResult
        },
        totalStats: {
          categories: this.importStats.categories,
          products: this.importStats.products,
          errors: this.importStats.errors
        }
      };

    } catch (error) {
      console.error('Full import failed:', error);
      return {
        success: false,
        error: error.message,
        stats: null, // Add missing stats property for consistency
        totalStats: {
          categories: this.importStats.categories,
          products: this.importStats.products,
          errors: this.importStats.errors
        }
      };
    }
  }

  /**
   * Build mapping from Akeneo category codes to DainoStore category IDs
   * Uses integration_category_mappings table
   */
  async buildCategoryMapping(storeId) {
    const CategoryMappingService = require('./CategoryMappingService');
    const categoryMapping = {};

    try {
      const mappingService = new CategoryMappingService(storeId, 'akeneo');
      const integrationMappings = await mappingService.getMappings();

      // Build mapping from external_category_code -> internal_category_id
      for (const m of integrationMappings) {
        if (m.internal_category_id && m.external_category_code) {
          categoryMapping[m.external_category_code] = m.internal_category_id;
        }
      }

      console.log(`📋 Loaded ${Object.keys(categoryMapping).length} category mappings from integration_category_mappings`);
    } catch (error) {
      console.warn('⚠️ Could not load integration_category_mappings:', error.message);
    }

    return categoryMapping;
  }

  /**
   * Build mapping from Akeneo family codes to DainoStore AttributeSet IDs
   * Maps original Akeneo family codes to attribute_sets that have "akeneo_" prefix
   */
  async buildFamilyMapping(storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: attributeSets, error } = await tenantDb
      .from('attribute_sets')
      .select('id, name')
      .eq('store_id', storeId);

    if (error) {
      console.error('Error fetching attribute sets:', error);
      return {};
    }

    const mapping = {};
    (attributeSets || []).forEach(attributeSet => {
      // Check if attribute set has "akeneo_" prefix
      if (attributeSet.name.startsWith('akeneo_')) {
        // Map by original Akeneo code (without prefix) for product import lookup
        const originalCode = attributeSet.name.replace('akeneo_', '');
        mapping[originalCode] = attributeSet.id;
      } else {
        // Also map user-created attribute sets (without prefix) by their exact name
        mapping[attributeSet.name] = attributeSet.id;
      }
    });

    return mapping;
  }

  /**
   * Build mapping from Akeneo attribute codes to DainoStore attribute IDs
   */
  async buildAttributeMapping(storeId) {
    const tenantDb = await ConnectionManager.getStoreConnection(storeId);

    const { data: attributes, error } = await tenantDb
      .from('attributes')
      .select('id, code')
      .eq('store_id', storeId);

    if (error) {
      console.error('Error fetching attributes:', error);
      return {};
    }

    const mapping = {};
    (attributes || []).forEach(attribute => {
      mapping[attribute.code] = attribute.id;
    });

    return mapping;
  }

  /**
   * Import a single transformed product to the database
   */
  async importSingleProduct(transformedProduct, storeId) {
    try {
      const tenantDb = await ConnectionManager.getStoreConnection(storeId);

      // Check if product already exists
      const { data: existingProducts } = await tenantDb
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('sku', transformedProduct.sku)
        .limit(1);

      const existingProduct = existingProducts && existingProducts.length > 0 ? existingProducts[0] : null;

      if (existingProduct) {
        // Prepare update data
        const updateData = { ...transformedProduct };
        delete updateData.id;
        delete updateData.sku; // Don't update SKU
        delete updateData.store_id; // Don't update store_id
        delete updateData._originalSlug;
        delete updateData.akeneo_uuid;
        delete updateData.akeneo_identifier;
        delete updateData.akeneo_family;
        delete updateData.akeneo_groups;
        delete updateData.akeneo_code;
        delete updateData.akeneo_family_variant;
        // Translatable fields go in product_translations table
        delete updateData.name;
        delete updateData.description;
        delete updateData.short_description;
        delete updateData.meta_title;
        delete updateData.meta_description;
        delete updateData.meta_keywords;
        delete updateData.seo; // SEO object also contains translatable fields
        // sale_price is not a valid column - use compare_price instead
        delete updateData.sale_price;
        // attributes go in product_attribute_values table, not on products
        delete updateData.attributes;
        updateData.updated_at = new Date().toISOString();

        // Clean metadata from images array (causes Supabase errors)
        if (updateData.images && Array.isArray(updateData.images)) {
          updateData.images = updateData.images.map(img => {
            if (img && typeof img === 'object' && 'metadata' in img) {
              const { metadata, ...cleanImg } = img;
              return cleanImg;
            }
            return img;
          });
        }

        await tenantDb
          .from('products')
          .update(updateData)
          .eq('id', existingProduct.id);

        // Update or create product_translations
        try {
          const { data: existingTranslation } = await tenantDb
            .from('product_translations')
            .select('id')
            .eq('product_id', existingProduct.id)
            .eq('language_code', 'en')
            .maybeSingle();

          // Helper to extract string from potential {label, value} objects
          const extractString = (val) => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') return val;
            if (typeof val === 'object') {
              if (val.label !== undefined) return val.label;
              if (val.value !== undefined) return String(val.value);
              return JSON.stringify(val);
            }
            return String(val);
          };

          const translationData = {
            name: extractString(transformedProduct.name),
            description: extractString(transformedProduct.description),
            short_description: extractString(transformedProduct.short_description),
            updated_at: new Date().toISOString()
          };

          console.log(`📝 Syncing translation for product ${existingProduct.id}: name="${translationData.name?.substring(0, 50)}..."`);

          if (existingTranslation) {
            const { error: updateErr } = await tenantDb
              .from('product_translations')
              .update(translationData)
              .eq('product_id', existingProduct.id)
              .eq('language_code', 'en');
            if (updateErr) throw updateErr;
            console.log(`✅ Updated translation for product ${existingProduct.id}`);
          } else {
            const { error: insertErr } = await tenantDb
              .from('product_translations')
              .insert({
                product_id: existingProduct.id,
                language_code: 'en',
                ...translationData,
                created_at: new Date().toISOString()
              });
            if (insertErr) throw insertErr;
            console.log(`✅ Created translation for product ${existingProduct.id}`);
          }
        } catch (translationError) {
          console.error(`❌ Failed to update translation for product ${existingProduct.id}:`, translationError.message);
        }

        // Sync attributes to product_attribute_values table using AttributeMappingService
        if (transformedProduct.attributes && typeof transformedProduct.attributes === 'object') {
          try {
            const AttributeMappingService = require('./AttributeMappingService');
            const mappingService = new AttributeMappingService(storeId, 'akeneo');
            const { attributes: processedAttributes } = await mappingService.processProductAttributes(transformedProduct.attributes);

            const { syncProductAttributeValues } = require('../utils/productTenantHelpers');
            await syncProductAttributeValues(tenantDb, storeId, existingProduct.id, processedAttributes);
          } catch (attrError) {
            console.warn(`⚠️ Failed to sync attributes for product ${existingProduct.id}:`, attrError.message);
          }
        }

        // Sync images to product_files table
        if (transformedProduct.images && Array.isArray(transformedProduct.images) && transformedProduct.images.length > 0) {
          try {
            const { syncProductImages } = require('../utils/productTenantHelpers');
            await syncProductImages(tenantDb, storeId, existingProduct.id, transformedProduct.images);
          } catch (imgError) {
            console.warn(`⚠️ Failed to sync images for product ${existingProduct.id}:`, imgError.message);
          }
        }

        return { success: true, action: 'updated', productId: existingProduct.id };
      } else {
        // Create new product
        const productData = { ...transformedProduct };
        delete productData._originalSlug;
        delete productData.akeneo_uuid;
        delete productData.akeneo_identifier;
        delete productData.akeneo_family;
        delete productData.akeneo_groups;
        delete productData.akeneo_code;
        delete productData.akeneo_family_variant;
        // Translatable fields go in product_translations table
        delete productData.name;
        delete productData.description;
        delete productData.short_description;
        delete productData.meta_title;
        delete productData.meta_description;
        delete productData.meta_keywords;
        delete productData.seo; // SEO object also contains translatable fields
        // sale_price is not a valid column - use compare_price instead
        delete productData.sale_price;
        // attributes go in product_attribute_values table, not on products
        delete productData.attributes;

        // Clean metadata from images array (causes Supabase errors)
        if (productData.images && Array.isArray(productData.images)) {
          productData.images = productData.images.map(img => {
            if (img && typeof img === 'object' && 'metadata' in img) {
              const { metadata, ...cleanImg } = img;
              return cleanImg;
            }
            return img;
          });
        }

        const { data: newProduct, error: createError } = await tenantDb
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create product: ${createError.message}`);
        }

        // Create product_translations for name, description, etc.
        try {
          // Helper to extract string from potential {label, value} objects
          const extractString = (val) => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') return val;
            if (typeof val === 'object') {
              if (val.label !== undefined) return val.label;
              if (val.value !== undefined) return String(val.value);
              return JSON.stringify(val);
            }
            return String(val);
          };

          const nameStr = extractString(transformedProduct.name);
          console.log(`📝 Creating translation for new product ${newProduct.id}: name="${nameStr?.substring(0, 50)}..."`);

          const { error: insertErr } = await tenantDb
            .from('product_translations')
            .insert({
              product_id: newProduct.id,
              language_code: 'en',
              name: nameStr,
              description: extractString(transformedProduct.description),
              short_description: extractString(transformedProduct.short_description),
              created_at: new Date().toISOString()
            });
          if (insertErr) throw insertErr;
          console.log(`✅ Created translation for product ${newProduct.id}`);
        } catch (translationError) {
          console.error(`❌ Failed to create translation for product ${newProduct.id}:`, translationError.message);
        }

        // Sync attributes to product_attribute_values table using AttributeMappingService
        if (transformedProduct.attributes && typeof transformedProduct.attributes === 'object') {
          try {
            const AttributeMappingService = require('./AttributeMappingService');
            const mappingService = new AttributeMappingService(storeId, 'akeneo');
            const { attributes: processedAttributes } = await mappingService.processProductAttributes(transformedProduct.attributes);

            const { syncProductAttributeValues } = require('../utils/productTenantHelpers');
            await syncProductAttributeValues(tenantDb, storeId, newProduct.id, processedAttributes);
          } catch (attrError) {
            console.warn(`⚠️ Failed to sync attributes for product ${newProduct.id}:`, attrError.message);
          }
        }

        // Sync images to product_files table
        if (transformedProduct.images && Array.isArray(transformedProduct.images) && transformedProduct.images.length > 0) {
          try {
            const { syncProductImages } = require('../utils/productTenantHelpers');
            await syncProductImages(tenantDb, storeId, newProduct.id, transformedProduct.images);
          } catch (imgError) {
            console.warn(`⚠️ Failed to sync images for product ${newProduct.id}:`, imgError.message);
          }
        }

        return { success: true, action: 'created', productId: newProduct.id };
      }
    } catch (error) {
      console.error(`Failed to import product ${transformedProduct.sku}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import products and product models from Akeneo to DainoStore
   *
   * Import behavior:
   * - Standalone products: ALWAYS imported as simple products
   * - Variant products: ALWAYS imported as simple products
   * - Product models: OPTIONAL - when enabled, imported as configurable products
   *
   * importProductModels setting:
   * - true (default): Import product models as configurable + link variants to them via parent_id
   * - false: Skip product models, import only products (all as simple, no linking)
   */
  async importProductsWithModels(storeId, options = {}) {
    const { locale = 'en_US', dryRun = false, batchSize = 50, filters = {}, settings = {}, customMappings = {}, progressCallback } = options;

    // Ensure downloadImages is enabled by default in settings
    const enhancedSettings = {
      includeImages: true,
      downloadImages: true,
      includeFiles: true,
      includeStock: true,
      importProductModels: true, // true = import product models as configurable + link variants | false = skip product models
      akeneoBaseUrl: this.config.baseUrl,
      ...settings
    };

    try {
      console.log('🚀 Starting product import from Akeneo...');
      console.log(`📍 Store ID: ${storeId}`);
      console.log(`🧪 Dry run mode: ${dryRun}`);
      console.log(`📦 Batch size: ${batchSize}`);
      console.log(`⚙️ Import product models: ${enhancedSettings.importProductModels ? 'YES (will create configurables and link variants)' : 'NO (variants will remain standalone simple products)'}`);

      // Get category and family mappings
      console.log('📂 Building category mapping...');
      const categoryMapping = await this.buildCategoryMapping(storeId);
      console.log(`✅ Category mapping built: ${Object.keys(categoryMapping).length} categories`);

      // Initialize CategoryMappingService for auto-creation of unmapped categories
      const categoryMappingService = new CategoryMappingService(storeId, 'akeneo');
      const autoCreateSettings = await categoryMappingService.getAutoCreateSettings();
      console.log(`🔧 Category auto-create: ${autoCreateSettings.enabled ? 'enabled' : 'disabled'}`);

      // Fetch Akeneo categories for name lookup (needed for auto-creation)
      let akeneoCategories = [];
      if (autoCreateSettings.enabled) {
        console.log('📂 Fetching Akeneo categories for auto-creation lookup...');
        try {
          akeneoCategories = await this.client.getAllCategories();
          console.log(`✅ Loaded ${akeneoCategories.length} Akeneo categories for lookup`);
        } catch (catError) {
          console.warn('⚠️ Could not fetch Akeneo categories for auto-creation:', catError.message);
        }
      }
      // Build category code to name map for quick lookup
      const akeneoCategoryMap = {};
      akeneoCategories.forEach(cat => {
        akeneoCategoryMap[cat.code] = {
          code: cat.code,
          name: cat.labels?.en_US || cat.labels?.en_GB || cat.code,
          parent_code: cat.parent
        };
      });

      console.log('🏷️ Building family mapping...');
      const familyMapping = await this.buildFamilyMapping(storeId);
      console.log(`✅ Family mapping built: ${Object.keys(familyMapping).length} families`);

      // Fetch attribute types for automatic image/file mapping
      console.log('📸 Fetching attribute types for automatic image/file mapping...');
      const akeneoAttributeTypes = {};
      try {
        const allAttributes = await this.client.getAllAttributes();
        allAttributes.forEach(attr => {
          akeneoAttributeTypes[attr.code] = attr.type;
        });
        const imageTypeCount = Object.values(akeneoAttributeTypes).filter(t => t === 'pim_catalog_image').length;
        const fileTypeCount = Object.values(akeneoAttributeTypes).filter(t => t === 'pim_catalog_file').length;
        console.log(`✅ Loaded ${Object.keys(akeneoAttributeTypes).length} attribute types (${imageTypeCount} image, ${fileTypeCount} file)`);
      } catch (attrError) {
        console.warn('⚠️ Could not fetch attribute types for auto-mapping:', attrError.message);
      }

      // Fetch products with server-side filters for efficiency
      console.log('📡 Fetching products from Akeneo...');
      const productFetchOptions = {};
      if (filters.updatedSince && filters.updatedSince > 0) {
        productFetchOptions.updatedSinceHours = filters.updatedSince;
        console.log(`🔍 Will filter products updated in last ${filters.updatedSince} hours`);
      }
      // Pass families filter for server-side filtering (much more efficient than fetching all)
      if (filters.families && filters.families.length > 0) {
        productFetchOptions.families = filters.families;
        console.log(`🔍 Will filter products by families (server-side): ${filters.families.join(', ')}`);
      }
      let akeneoProducts = await this.client.getAllProducts(productFetchOptions);
      console.log(`📦 Found ${akeneoProducts.length} products from Akeneo`);

      let akeneoProductModels = [];
      if (enhancedSettings.importProductModels) {
        console.log('📡 Fetching all product models from Akeneo...');
        akeneoProductModels = await this.client.getAllProductModels();
        console.log(`📦 Found ${akeneoProductModels.length} product models in Akeneo`);

        // Filter product models by family (API doesn't support family filter for product models)
        if (filters.families && filters.families.length > 0) {
          const beforeCount = akeneoProductModels.length;
          akeneoProductModels = akeneoProductModels.filter(model =>
            filters.families.includes(model.family)
          );
          console.log(`📊 Filtered product models by family: ${beforeCount} -> ${akeneoProductModels.length}`);
        }
      } else {
        console.log('⏭️ Skipping product models (importProductModels is disabled)');
      }

      // Separate products into variants (have parent) and standalone products
      const variantProducts = akeneoProducts.filter(p => p.parent);
      const standaloneProducts = akeneoProducts.filter(p => !p.parent);

      console.log(`📊 Product breakdown:`);
      console.log(`   - ${standaloneProducts.length} standalone products`);
      console.log(`   - ${variantProducts.length} variant products`);
      if (enhancedSettings.importProductModels) {
        console.log(`   - ${akeneoProductModels.length} product models (will become configurable)`);
      }

      this.importStats.products.total = standaloneProducts.length + variantProducts.length + (enhancedSettings.importProductModels ? akeneoProductModels.length : 0);

      // Build a map of product model code to product model data
      const productModelMap = {};
      akeneoProductModels.forEach(model => {
        productModelMap[model.code] = model;
      });

      // Track created products by their Akeneo identifier/code
      const createdProducts = {}; // Maps akeneo identifier/code to DainoStore product ID
      let processed = 0;

      // STEP 1: Import standalone simple products first
      if (standaloneProducts.length > 0) {
        console.log(`\n📦 STEP 1: Processing ${standaloneProducts.length} standalone products...`);

        for (let i = 0; i < standaloneProducts.length; i += batchSize) {
          const batch = standaloneProducts.slice(i, i + batchSize);
          console.log(`\n📦 Processing standalone batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(standaloneProducts.length/batchSize)} (${batch.length} products)`);

          for (const akeneoProduct of batch) {
            processed++;

            // Call progress callback for linear progress tracking
            if (progressCallback) {
              await progressCallback({
                stage: 'importing_standalone',
                current: processed,
                total: this.importStats.products.total,
                item: akeneoProduct.identifier
              });
            }

            try {
              // Transform product to DainoStore format
              const dainoProduct = await this.mapping.transformProduct(akeneoProduct, storeId, locale, null, customMappings, enhancedSettings, this.client, akeneoAttributeTypes);

              // Apply settings
              if (enhancedSettings.status === 'disabled') {
                dainoProduct.status = 'inactive';
              } else if (enhancedSettings.status === 'enabled') {
                dainoProduct.status = 'active';
              }

              // Map category IDs with auto-creation support
              const originalCategoryIds1 = akeneoProduct.categories || [];
              const mappedCategoryIds1 = this.mapping.mapCategoryIds(originalCategoryIds1, categoryMapping);
              const unmappedCategoryCodes1 = originalCategoryIds1.filter(code => !categoryMapping[code]);

              if (unmappedCategoryCodes1.length > 0 && autoCreateSettings.enabled && !dryRun) {
                for (const catCode of unmappedCategoryCodes1) {
                  const catInfo = akeneoCategoryMap[catCode] || { code: catCode, name: catCode };
                  const newCategoryId = await categoryMappingService.autoCreateCategory({
                    id: catCode,
                    code: catCode,
                    name: catInfo.name,
                    parent_code: catInfo.parent_code
                  });
                  if (newCategoryId) {
                    mappedCategoryIds1.push(newCategoryId);
                    categoryMapping[catCode] = newCategoryId;
                  }
                }
              }
              dainoProduct.category_ids = mappedCategoryIds1;

              if (akeneoProduct.family && familyMapping[akeneoProduct.family]) {
                dainoProduct.attribute_set_id = familyMapping[akeneoProduct.family];
              }

              // Validate product
              const validationErrors = this.mapping.validateProduct(dainoProduct);
              if (validationErrors.length > 0) {
                this.importStats.products.failed++;
                this.importStats.errors.push({
                  type: 'product',
                  akeneo_identifier: dainoProduct.akeneo_identifier,
                  errors: validationErrors
                });
                console.error(`❌ Validation failed for ${dainoProduct.sku}: ${validationErrors.join(', ')}`);
                continue;
              }

              if (!dryRun) {
                const result = await this.importSingleProduct(dainoProduct, storeId);
                if (result.success) {
                  createdProducts[akeneoProduct.identifier] = result.productId;
                  this.importStats.products.imported++;
                  if (processed <= 5 || processed % 25 === 0) {
                    console.log(`✅ ${result.action} standalone product: ${dainoProduct.name} (${dainoProduct.sku})`);
                  }
                } else {
                  this.importStats.products.failed++;
                  this.importStats.errors.push({
                    type: 'product',
                    akeneo_identifier: akeneoProduct.identifier,
                    error: result.error
                  });
                  console.error(`❌ Failed to import standalone product ${akeneoProduct.identifier}: ${result.error}`);
                }
              } else {
                this.importStats.products.imported++;
              }
            } catch (error) {
              this.importStats.products.failed++;
              this.importStats.errors.push({
                type: 'product',
                akeneo_identifier: akeneoProduct.identifier,
                error: error.message
              });
              console.error(`❌ Failed to import standalone product ${akeneoProduct.identifier}: ${error.message}`);
            }
          }
        }
      }

      // STEP 2: Import variant products as simple products
      if (variantProducts.length > 0) {
        console.log(`\n📦 STEP 2: Processing ${variantProducts.length} variant products...`);

        for (let i = 0; i < variantProducts.length; i += batchSize) {
          const batch = variantProducts.slice(i, i + batchSize);
          console.log(`\n📦 Processing variant batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(variantProducts.length/batchSize)} (${batch.length} products)`);

          for (const akeneoProduct of batch) {
            processed++;

            // Call progress callback for linear progress tracking
            if (progressCallback) {
              await progressCallback({
                stage: 'importing_variants',
                current: processed,
                total: this.importStats.products.total,
                item: akeneoProduct.identifier
              });
            }

            try {
              // Transform variant as a simple product (for now, we'll link to parent later)
              const dainoProduct = await this.mapping.transformProduct(akeneoProduct, storeId, locale, null, customMappings, enhancedSettings, this.client, akeneoAttributeTypes);

              // Ensure it's marked as simple
              dainoProduct.type = 'simple';

              // Apply settings
              if (enhancedSettings.status === 'disabled') {
                dainoProduct.status = 'inactive';
              } else if (enhancedSettings.status === 'enabled') {
                dainoProduct.status = 'active';
              }

              // Map category IDs with auto-creation support
              const originalCategoryIds2 = akeneoProduct.categories || [];
              const mappedCategoryIds2 = this.mapping.mapCategoryIds(originalCategoryIds2, categoryMapping);
              const unmappedCategoryCodes2 = originalCategoryIds2.filter(code => !categoryMapping[code]);

              if (unmappedCategoryCodes2.length > 0 && autoCreateSettings.enabled && !dryRun) {
                for (const catCode of unmappedCategoryCodes2) {
                  const catInfo = akeneoCategoryMap[catCode] || { code: catCode, name: catCode };
                  const newCategoryId = await categoryMappingService.autoCreateCategory({
                    id: catCode,
                    code: catCode,
                    name: catInfo.name,
                    parent_code: catInfo.parent_code
                  });
                  if (newCategoryId) {
                    mappedCategoryIds2.push(newCategoryId);
                    categoryMapping[catCode] = newCategoryId;
                  }
                }
              }
              dainoProduct.category_ids = mappedCategoryIds2;

              if (akeneoProduct.family && familyMapping[akeneoProduct.family]) {
                dainoProduct.attribute_set_id = familyMapping[akeneoProduct.family];
              }

              // Validate product
              const validationErrors = this.mapping.validateProduct(dainoProduct);
              if (validationErrors.length > 0) {
                this.importStats.products.failed++;
                this.importStats.errors.push({
                  type: 'product',
                  akeneo_identifier: dainoProduct.akeneo_identifier,
                  errors: validationErrors
                });
                console.error(`❌ Validation failed for variant ${dainoProduct.sku}: ${validationErrors.join(', ')}`);
                continue;
              }

              if (!dryRun) {
                const result = await this.importSingleProduct(dainoProduct, storeId);
                if (result.success) {
                  // Store variant product ID for later linking to parent
                  createdProducts[akeneoProduct.identifier] = result.productId;
                  this.importStats.products.imported++;
                  if (processed <= 5 || processed % 25 === 0) {
                    console.log(`✅ ${result.action} variant product: ${dainoProduct.name} (${dainoProduct.sku}) - parent: ${akeneoProduct.parent}`);
                  }
                } else {
                  this.importStats.products.failed++;
                  this.importStats.errors.push({
                    type: 'product',
                    akeneo_identifier: akeneoProduct.identifier,
                    error: result.error
                  });
                  console.error(`❌ Failed to import variant product ${akeneoProduct.identifier}: ${result.error}`);
                }
              } else {
                this.importStats.products.imported++;
              }
            } catch (error) {
              this.importStats.products.failed++;
              this.importStats.errors.push({
                type: 'product',
                akeneo_identifier: akeneoProduct.identifier,
                error: error.message
              });
              console.error(`❌ Failed to import variant product ${akeneoProduct.identifier}: ${error.message}`);
            }
          }
        }
      }

      // STEP 3: Import product models as configurable products (only if enabled)
      if (enhancedSettings.importProductModels && akeneoProductModels.length > 0) {
        console.log(`\n📦 STEP 3: Processing ${akeneoProductModels.length} product models as configurable products...`);

        for (let i = 0; i < akeneoProductModels.length; i += batchSize) {
          const batch = akeneoProductModels.slice(i, i + batchSize);
          console.log(`\n📦 Processing product model batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(akeneoProductModels.length/batchSize)} (${batch.length} models)`);

          for (const akeneoProductModel of batch) {
            processed++;

            // Call progress callback for linear progress tracking
            if (progressCallback) {
              await progressCallback({
                stage: 'importing_configurables',
                current: processed,
                total: this.importStats.products.total,
                item: akeneoProductModel.code
              });
            }

            try {
              // Transform product model to configurable product
              const configurableProduct = await this.mapping.transformProductModel(akeneoProductModel, storeId, locale, null, customMappings, enhancedSettings, this.client, akeneoAttributeTypes);

              // Apply settings
              if (enhancedSettings.status === 'disabled') {
                configurableProduct.status = 'inactive';
              } else if (enhancedSettings.status === 'enabled') {
                configurableProduct.status = 'active';
              }

              // Map category IDs with auto-creation support
              const originalCategoryIds3 = akeneoProductModel.categories || [];
              const mappedCategoryIds3 = this.mapping.mapCategoryIds(originalCategoryIds3, categoryMapping);
              const unmappedCategoryCodes3 = originalCategoryIds3.filter(code => !categoryMapping[code]);

              if (unmappedCategoryCodes3.length > 0 && autoCreateSettings.enabled && !dryRun) {
                for (const catCode of unmappedCategoryCodes3) {
                  const catInfo = akeneoCategoryMap[catCode] || { code: catCode, name: catCode };
                  const newCategoryId = await categoryMappingService.autoCreateCategory({
                    id: catCode,
                    code: catCode,
                    name: catInfo.name,
                    parent_code: catInfo.parent_code
                  });
                  if (newCategoryId) {
                    mappedCategoryIds3.push(newCategoryId);
                    categoryMapping[catCode] = newCategoryId;
                  }
                }
              }
              configurableProduct.category_ids = mappedCategoryIds3;

              if (akeneoProductModel.family && familyMapping[akeneoProductModel.family]) {
                configurableProduct.attribute_set_id = familyMapping[akeneoProductModel.family];
              }

              // Validate configurable product
              const validationErrors = this.mapping.validateProduct(configurableProduct);
              if (validationErrors.length > 0) {
                this.importStats.products.failed++;
                this.importStats.errors.push({
                  type: 'product_model',
                  akeneo_code: akeneoProductModel.code,
                  errors: validationErrors
                });
                console.error(`❌ Validation failed for product model ${configurableProduct.sku}: ${validationErrors.join(', ')}`);
                continue;
              }

              if (!dryRun) {
                const result = await this.importSingleProduct(configurableProduct, storeId);
                if (result.success) {
                  createdProducts[akeneoProductModel.code] = result.productId;
                  this.importStats.products.imported++;
                  console.log(`✅ ${result.action} configurable product: ${configurableProduct.name} (${configurableProduct.sku})`);
                } else {
                  this.importStats.products.failed++;
                  this.importStats.errors.push({
                    type: 'product_model',
                    akeneo_code: akeneoProductModel.code,
                    error: result.error
                  });
                  console.error(`❌ Failed to import product model ${akeneoProductModel.code}: ${result.error}`);
                }
              } else {
                this.importStats.products.imported++;
              }
            } catch (error) {
              this.importStats.products.failed++;
              this.importStats.errors.push({
                type: 'product_model',
                akeneo_code: akeneoProductModel.code,
                error: error.message
              });
              console.error(`❌ Failed to import product model ${akeneoProductModel.code}: ${error.message}`);
            }
          }
        }
      }

      // STEP 4: Link variants to their parent configurable products (only if product models were imported)
      if (enhancedSettings.importProductModels && variantProducts.length > 0 && !dryRun) {
        console.log(`\n📦 STEP 4: Linking ${variantProducts.length} variants to their parent configurable products...`);

        for (const variantProduct of variantProducts) {
          try {
            const parentCode = variantProduct.parent;
            const variantIdentifier = variantProduct.identifier;

            const parentId = createdProducts[parentCode];
            const variantId = createdProducts[variantIdentifier];

            if (parentId && variantId) {
              // Update variant to set parent_id
              const tenantDb = await ConnectionManager.getStoreConnection(this.storeId);
              await tenantDb
                .from('products')
                .update({
                  parent_id: parentId,
                  updated_at: new Date().toISOString()
                })
                .eq('id', variantId);

              console.log(`✅ Linked variant ${variantIdentifier} to parent ${parentCode}`);
            } else {
              console.warn(`⚠️ Could not link variant ${variantIdentifier} to parent ${parentCode} - parent or variant not found`);
            }
          } catch (error) {
            console.error(`❌ Failed to link variant ${variantProduct.identifier} to parent: ${error.message}`);
          }
        }
      }

      console.log('🎉 Product import completed!');
      console.log(`📊 Final stats: ${this.importStats.products.imported} imported, ${this.importStats.products.failed} failed, ${this.importStats.products.total} total`);
      if (enhancedSettings.importProductModels) {
        console.log(`✅ Imported ${standaloneProducts.length} standalone + ${variantProducts.length} variants (linked to ${akeneoProductModels.length} configurables)`);
      } else {
        console.log(`✅ Imported ${standaloneProducts.length} standalone + ${variantProducts.length} variants (all as simple products, no configurables)`);
      }

      const response = {
        success: true,
        stats: this.importStats.products,
        errors: this.importStats.errors,
        dryRun: dryRun,
        details: {
          processedCount: processed,
          standaloneProducts: standaloneProducts.length,
          variantProducts: variantProducts.length,
          productModels: akeneoProductModels.length,
          completedSuccessfully: true
        }
      };

      // Log errors summary if any
      if (this.importStats.errors.length > 0) {
        console.log(`\n❌ ${this.importStats.errors.length} errors occurred during import:`);
        this.importStats.errors.forEach((err, idx) => {
          console.log(`   ${idx + 1}. [${err.type}] ${err.akeneo_identifier || err.akeneo_code}: ${err.error || (err.errors ? err.errors.join(', ') : 'Unknown error')}`);
        });
      }

      // Save import statistics to database (only if not a dry run)
      if (!dryRun) {
        try {
          const ImportStatistic = require('../models/ImportStatistic');
          await ImportStatistic.saveImportResults(storeId, 'products', {
            totalProcessed: this.importStats.products.total,
            successfulImports: this.importStats.products.imported,
            failedImports: this.importStats.products.failed,
            skippedImports: this.importStats.products.skipped,
            errorDetails: this.importStats.errors.length > 0 ? JSON.stringify(this.importStats.errors) : null,
            importMethod: 'manual',
            importSource: 'akeneo'
          });
          console.log('✅ Product import statistics saved to database');
        } catch (statsError) {
          console.error('❌ Failed to save product import statistics:', statsError.message);
        }
      }

      if (dryRun) {
        response.message = `Dry run completed. Would import ${this.importStats.products.imported} products`;
      } else {
        if (enhancedSettings.importProductModels) {
          response.message = `Successfully imported ${standaloneProducts.length} standalone + ${variantProducts.length} variants as simple products, and ${akeneoProductModels.length} product models as configurable products (variants linked to configurables)`;
        } else {
          response.message = `Successfully imported ${standaloneProducts.length} standalone + ${variantProducts.length} variants as simple products (no configurables created)`;
        }
      }

      return response;

    } catch (error) {
      console.error('Product and product model import failed:', error);
      return {
        success: false,
        error: error.message,
        stats: this.importStats.products
      };
    }
  }

  /**
   * Reset import statistics
   */
  resetStats() {
    this.importStats = {
      categories: { total: 0, imported: 0, skipped: 0, failed: 0 },
      products: { total: 0, imported: 0, skipped: 0, failed: 0 },
      families: { total: 0, imported: 0, skipped: 0, failed: 0 },
      attributes: { total: 0, imported: 0, skipped: 0, failed: 0 },
      errors: []
    };
  }

  /**
   * Get import statistics
   */
  getStats() {
    return this.importStats;
  }


  /**
   * Get configuration status
   */
  getConfigStatus() {
    return {
      hasConfig: !!(this.config.baseUrl && this.config.clientId && this.config.clientSecret),
      baseUrl: this.config.baseUrl || null,
      clientId: this.config.clientId || null,
      username: this.config.username || null
    };
  }
}

module.exports = AkeneoIntegration;